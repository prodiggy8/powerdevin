"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { approvalRequests } from "@/db/schema";
import { requireRole } from "@/core/auth";
import { withAudit } from "@/core/audit";
import { requireSecondApprover } from "@/core/approvals";
import { validateFormData, type FormState } from "@/core/schema-form";
import { refundRequests } from "./schema";
import {
  AMOUNT_PATTERN,
  APPROVAL_ENTITY,
  REFUND_ENTITY,
  REFUND_REASONS,
  canDecide,
  needsApprover,
  secondApproverError,
  toCents,
} from "./rules";

export type RefundPath = "direct" | "approval";

export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const createRefundSchema = z.object({
  orderRef: z.string().trim().min(1, "Order reference is required.").max(64),
  customerName: z.string().trim().min(1, "Customer name is required.").max(200),
  customerEmail: z.email("Enter a valid email address.").trim().max(320),
  amount: z
    .string()
    .trim()
    .regex(AMOUNT_PATTERN, "Enter an amount like 125.00.")
    .refine((value) => toCents(value) > 0, "Amount must be greater than zero."),
  currency: z.preprocess(
    (value) => (value === "" || value == null ? "USD" : value),
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Use a 3-letter ISO code."),
  ),
  reason: z.enum(REFUND_REASONS, "Choose a reason."),
  note: z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .transform((value) => value || null),
});

export type CreateRefundInput = {
  orderRef: string;
  customerName: string;
  customerEmail: string;
  amount: string;
  currency?: string;
  reason: string;
  note?: string | null;
};

const decideRefundSchema = z
  .object({
    refundId: z.string().min(1),
    decision: z.enum(["approve", "reject"]),
    note: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((value) => value || null),
  })
  .refine((input) => input.decision === "approve" || input.note, {
    message: "A note is required to reject a refund.",
    path: ["note"],
  });

const markPaidSchema = z.object({ refundId: z.string().min(1) });

type RefundRow = typeof refundRequests.$inferSelect;

function snapshot(row: RefundRow) {
  return {
    status: row.status,
    amount: row.amount,
    currency: row.currency,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decisionNote: row.decisionNote,
    paidAt: row.paidAt?.toISOString() ?? null,
  };
}

function revalidateRefund(id: string) {
  revalidatePath("/refunds");
  revalidatePath(`/refunds/${id}`);
}

export async function createRefund(
  input: CreateRefundInput,
): Promise<ActionResult<{ id: string; path: RefundPath }>> {
  const actor = await requireRole("analyst");

  const parsed = createRefundSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid refund request." };
  }
  const data = parsed.data;
  const path: RefundPath = needsApprover(data.amount) ? "approval" : "direct";

  const id = await db.transaction(async (tx) => {
    const [refund] = await tx
      .insert(refundRequests)
      .values({ ...data, requestedBy: actor.id })
      .returning();

    await withAudit(tx, {
      actorId: actor.id,
      action: `${REFUND_ENTITY}.created`,
      entity: REFUND_ENTITY,
      entityId: refund.id,
      after: { ...snapshot(refund), orderRef: refund.orderRef, reason: refund.reason },
    });

    if (path === "approval") {
      const [approval] = await tx
        .insert(approvalRequests)
        .values({
          entity: REFUND_ENTITY,
          entityId: refund.id,
          requestedBy: actor.id,
          threshold: refund.amount,
        })
        .returning();

      await withAudit(tx, {
        actorId: actor.id,
        action: `${APPROVAL_ENTITY}.created`,
        entity: APPROVAL_ENTITY,
        entityId: approval.id,
        after: {
          entity: approval.entity,
          entityId: approval.entityId,
          status: approval.status,
          threshold: approval.threshold,
        },
      });
    }

    return refund.id;
  });

  revalidateRefund(id);
  return { ok: true, id, path };
}

export async function createRefundFromForm(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const validated = validateFormData(createRefundSchema, formData);
  if (!validated.success) return validated.state;

  const result = await createRefund(validated.data);
  if (!result.ok) return { status: "error", message: result.error };

  redirect(`/refunds/${result.id}?created=${result.path}`);
}

export async function decideRefund(input: {
  refundId: string;
  decision: "approve" | "reject";
  note?: string;
}): Promise<ActionResult> {
  const actor = await requireRole("analyst");

  const parsed = decideRefundSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid decision.",
    };
  }
  const { refundId, decision, note } = parsed.data;
  const status = decision === "approve" ? "approved" : "rejected";

  const current = await db.query.refundRequests.findFirst({
    where: eq(refundRequests.id, refundId),
  });
  if (!current) return { ok: false, error: "Refund not found." };
  if (current.status !== "pending") {
    return { ok: false, error: "Only pending refunds can be decided." };
  }
  if (current.requestedBy === actor.id) {
    return { ok: false, error: secondApproverError("self-approval") };
  }
  if (!canDecide(actor.role, current.amount)) {
    return {
      ok: false,
      error: "Refunds at or above the threshold need an approver.",
    };
  }
  const viaApproval = needsApprover(current.amount);
  if (viaApproval) {
    const check = await requireSecondApprover(REFUND_ENTITY, refundId, actor.id);
    if (!check.ok) return { ok: false, error: secondApproverError(check.reason) };
  }

  const result = await db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(refundRequests)
      .where(eq(refundRequests.id, refundId))
      .for("update");
    if (!before || before.status !== "pending") {
      return { ok: false as const, error: "Only pending refunds can be decided." };
    }

    const decidedAt = new Date();

    if (viaApproval) {
      const [approvalBefore] = await tx
        .select()
        .from(approvalRequests)
        .where(
          and(
            eq(approvalRequests.entity, REFUND_ENTITY),
            eq(approvalRequests.entityId, refundId),
            eq(approvalRequests.status, "pending"),
          ),
        )
        .for("update");
      if (!approvalBefore) {
        return { ok: false as const, error: secondApproverError("already-decided") };
      }

      const [approvalAfter] = await tx
        .update(approvalRequests)
        .set({ status, approvedBy: actor.id, decidedAt })
        .where(eq(approvalRequests.id, approvalBefore.id))
        .returning();

      await withAudit(tx, {
        actorId: actor.id,
        action: `${APPROVAL_ENTITY}.decided`,
        entity: APPROVAL_ENTITY,
        entityId: approvalBefore.id,
        before: { status: approvalBefore.status, approvedBy: null },
        after: {
          status: approvalAfter.status,
          approvedBy: approvalAfter.approvedBy,
          decidedAt: decidedAt.toISOString(),
        },
      });
    }

    const [after] = await tx
      .update(refundRequests)
      .set({ status, decidedBy: actor.id, decidedAt, decisionNote: note })
      .where(eq(refundRequests.id, refundId))
      .returning();

    await withAudit(tx, {
      actorId: actor.id,
      action: `${REFUND_ENTITY}.${status}`,
      entity: REFUND_ENTITY,
      entityId: refundId,
      before: snapshot(before),
      after: snapshot(after),
    });

    return { ok: true as const };
  });

  if (result.ok) revalidateRefund(refundId);
  return result;
}

export async function markPaid(input: { refundId: string }): Promise<ActionResult> {
  const actor = await requireRole("approver");

  const parsed = markPaidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid refund." };
  const { refundId } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(refundRequests)
      .where(eq(refundRequests.id, refundId))
      .for("update");
    if (!before) return { ok: false as const, error: "Refund not found." };
    if (before.status !== "approved") {
      return { ok: false as const, error: "Only approved refunds can be marked paid." };
    }

    const [after] = await tx
      .update(refundRequests)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(refundRequests.id, refundId))
      .returning();

    await withAudit(tx, {
      actorId: actor.id,
      action: `${REFUND_ENTITY}.paid`,
      entity: REFUND_ENTITY,
      entityId: refundId,
      before: snapshot(before),
      after: snapshot(after),
    });

    return { ok: true as const };
  });

  if (result.ok) revalidateRefund(refundId);
  return result;
}
