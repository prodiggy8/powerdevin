"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole, requireUser } from "@/core/auth";
import { withAudit } from "@/core/audit";
import {
  auditActionFor,
  canClaim,
  canDecide,
  DECISIONS,
  MIN_REASON_LENGTH,
  statusAfterClaim,
  statusFor,
} from "./policy";
import { KYC_ENTITY } from "./queries";
import { kycCases } from "./schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

const claimSchema = z.object({ caseId: z.string().min(1) });

const decideSchema = z.object({
  caseId: z.string().min(1),
  decision: z.enum(DECISIONS),
  reason: z
    .string()
    .trim()
    .min(MIN_REASON_LENGTH, `Give a reason of at least ${MIN_REASON_LENGTH} characters.`),
});

const reassignSchema = z.object({
  caseId: z.string().min(1),
  userId: z.string().min(1),
});

const AUDITED_COLUMNS = {
  id: true,
  status: true,
  assignedTo: true,
  decidedAt: true,
  decidedBy: true,
  decisionReason: true,
} as const;

const AUDITED_FIELDS = {
  id: kycCases.id,
  status: kycCases.status,
  assignedTo: kycCases.assignedTo,
  decidedAt: kycCases.decidedAt,
  decidedBy: kycCases.decidedBy,
  decisionReason: kycCases.decisionReason,
} as const;

/** Takes ownership of a case and moves it into review. */
export async function claimCase(input: { caseId: string }): Promise<ActionResult> {
  const actor = await requireUser();

  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid case." };
  }
  const { caseId } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.kycCases.findFirst({
      where: eq(kycCases.id, caseId),
      columns: AUDITED_COLUMNS,
    });
    if (!before) {
      return { ok: false as const, error: "Case not found." };
    }

    const assignee = before.assignedTo
      ? await tx.query.users.findFirst({
          where: eq(users.id, before.assignedTo),
          columns: { name: true, email: true },
        })
      : undefined;

    const allowed = canClaim(actor, {
      ...before,
      assigneeName: assignee?.name ?? assignee?.email,
    });
    if (!allowed.ok) {
      return { ok: false as const, error: allowed.error };
    }

    const [after] = await tx
      .update(kycCases)
      .set({ assignedTo: actor.id, status: statusAfterClaim(before.status) })
      .where(eq(kycCases.id, caseId))
      .returning(AUDITED_FIELDS);

    await withAudit(tx, {
      actorId: actor.id,
      action: "kyc_case.claimed",
      entity: KYC_ENTITY,
      entityId: caseId,
      before,
      after,
    });

    return { ok: true as const };
  });

  if (result.ok) revalidate(caseId);
  return result;
}

/** Approves, rejects or escalates a case, subject to the role's risk ceiling. */
export async function decideCase(input: {
  caseId: string;
  decision: string;
  reason: string;
}): Promise<ActionResult> {
  const actor = await requireUser();

  const parsed = decideSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Invalid decision.",
    };
  }
  const { caseId, decision, reason } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.kycCases.findFirst({
      where: eq(kycCases.id, caseId),
      columns: { ...AUDITED_COLUMNS, riskScore: true },
    });
    if (!before) {
      return { ok: false as const, error: "Case not found." };
    }

    const allowed = canDecide(actor.role, before);
    if (!allowed.ok) {
      return { ok: false as const, error: allowed.error };
    }

    const status = statusFor(decision);
    const [after] = await tx
      .update(kycCases)
      .set({
        status,
        decisionReason: reason,
        decidedAt: new Date(),
        decidedBy: actor.id,
        // An escalation stays with whoever picks it up next.
        assignedTo: status === "escalated" ? null : before.assignedTo,
      })
      .where(eq(kycCases.id, caseId))
      .returning(AUDITED_FIELDS);

    await withAudit(tx, {
      actorId: actor.id,
      action: auditActionFor(decision),
      entity: KYC_ENTITY,
      entityId: caseId,
      before,
      after,
    });

    return { ok: true as const };
  });

  if (result.ok) revalidate(caseId);
  return result;
}

/** Admin-only: hands a case to another reviewer. */
export async function reassignCase(input: {
  caseId: string;
  userId: string;
}): Promise<ActionResult> {
  const actor = await requireRole("admin");

  const parsed = reassignSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid assignee." };
  }
  const { caseId, userId } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const before = await tx.query.kycCases.findFirst({
      where: eq(kycCases.id, caseId),
      columns: AUDITED_COLUMNS,
    });
    if (!before) {
      return { ok: false as const, error: "Case not found." };
    }
    const assignee = await tx.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true },
    });
    if (!assignee) {
      return { ok: false as const, error: "Assignee not found." };
    }

    const [after] = await tx
      .update(kycCases)
      .set({ assignedTo: userId })
      .where(eq(kycCases.id, caseId))
      .returning(AUDITED_FIELDS);

    await withAudit(tx, {
      actorId: actor.id,
      action: "kyc_case.reassigned",
      entity: KYC_ENTITY,
      entityId: caseId,
      before,
      after,
    });

    return { ok: true as const };
  });

  if (result.ok) revalidate(caseId);
  return result;
}

function revalidate(caseId: string) {
  revalidatePath("/kyc");
  revalidatePath(`/kyc/${caseId}`);
}
