import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hasRole, type Role } from "@/core/rbac";
import { approvalRequests, auditLog, refundRequests, users } from "@/db/schema";
import { testDb } from "./db";

type Actor = { id: string; role: Role };
const session = vi.hoisted(() => ({ actor: null as Actor | null }));

vi.mock("@/db", async () => {
  const { testDb: db } = await import("./db");
  return { db: db() };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/core/auth", () => ({
  requireUser: async () => {
    if (!session.actor) throw new Error("NEXT_REDIRECT /login");
    return session.actor;
  },
  requireRole: async (required: Role | Role[]) => {
    if (!session.actor) throw new Error("NEXT_REDIRECT /login");
    if (!hasRole(session.actor.role, required)) {
      throw new Error("NEXT_REDIRECT /forbidden");
    }
    return session.actor;
  },
}));

const { createRefund, decideRefund, markPaid } = await import(
  "@/modules/refunds/actions"
);

const db = testDb();

async function createUser(email: string, role: Role): Promise<Actor> {
  const [row] = await db
    .insert(users)
    .values({ name: email, email, role })
    .returning();
  return { id: row.id, role: row.role };
}

function refundInput(amount: string) {
  return {
    orderRef: `ORD-${amount}`,
    customerName: "Jane Customer",
    customerEmail: "jane@example.invalid",
    amount,
    currency: "USD",
    reason: "customer_request",
  };
}

async function submitAs(actor: Actor, amount: string) {
  session.actor = actor;
  const result = await createRefund(refundInput(amount));
  if (!result.ok) throw new Error(result.error);
  return result;
}

const refund = (id: string) =>
  db.query.refundRequests.findFirst({ where: eq(refundRequests.id, id) });

const auditFor = (entity: string, entityId: string) =>
  db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entity, entity), eq(auditLog.entityId, entityId)));

let analyst: Actor;
let otherAnalyst: Actor;
let approver: Actor;
let otherApprover: Actor;

beforeEach(async () => {
  analyst = await createUser("analyst@contoso.com", "analyst");
  otherAnalyst = await createUser("analyst2@contoso.com", "analyst");
  approver = await createUser("approver@contoso.com", "approver");
  otherApprover = await createUser("approver2@contoso.com", "approver");
  session.actor = null;
});

describe("refunds actions", () => {
  it("approves a 499.99 refund directly with one audit row and no approval request", async () => {
    const { id, path } = await submitAs(analyst, "499.99");
    expect(path).toBe("direct");

    const before = await auditFor("refund_request", id);
    expect(before.map((row) => row.action)).toEqual(["refund_request.created"]);

    session.actor = otherAnalyst;
    const result = await decideRefund({ refundId: id, decision: "approve" });
    expect(result).toEqual({ ok: true });

    const row = await refund(id);
    expect(row?.status).toBe("approved");
    expect(row?.decidedBy).toBe(otherAnalyst.id);
    expect(row?.decidedAt).toBeInstanceOf(Date);

    const decisionRows = (await auditFor("refund_request", id)).filter(
      (entry) => entry.action !== "refund_request.created",
    );
    expect(decisionRows).toHaveLength(1);
    expect(decisionRows[0]).toMatchObject({
      action: "refund_request.approved",
      actorId: otherAnalyst.id,
      before: expect.objectContaining({ status: "pending" }),
      after: expect.objectContaining({ status: "approved" }),
    });
    expect(await db.select().from(approvalRequests)).toHaveLength(0);
  });

  it("keeps a 500.00 refund pending with an approval request and audit rows for both", async () => {
    const { id, path } = await submitAs(analyst, "500.00");
    expect(path).toBe("approval");
    expect((await refund(id))?.status).toBe("pending");

    const approvals = await db.select().from(approvalRequests);
    expect(approvals).toHaveLength(1);
    expect(approvals[0]).toMatchObject({
      entity: "refund_request",
      entityId: id,
      requestedBy: analyst.id,
      status: "pending",
      threshold: "500.00",
    });

    const refundAudit = await auditFor("refund_request", id);
    expect(refundAudit.map((row) => row.action)).toEqual([
      "refund_request.created",
    ]);
    const approvalAudit = await auditFor("approval_request", approvals[0].id);
    expect(approvalAudit.map((row) => row.action)).toEqual([
      "approval_request.created",
    ]);
    expect(approvalAudit[0].actorId).toBe(analyst.id);
  });

  it("rejects a requester approving their own above-threshold refund", async () => {
    const { id } = await submitAs(approver, "750.00");
    const auditBefore = await db.select().from(auditLog);

    const result = await decideRefund({ refundId: id, decision: "approve" });
    expect(result).toEqual({
      ok: false,
      error: "You requested this refund, so a different approver must decide it.",
    });

    expect((await refund(id))?.status).toBe("pending");
    const [approval] = await db.select().from(approvalRequests);
    expect(approval.status).toBe("pending");
    expect(approval.approvedBy).toBeNull();
    expect(await db.select().from(auditLog)).toHaveLength(auditBefore.length);
  });

  it("rejects a requester deciding their own below-threshold refund", async () => {
    const { id, path } = await submitAs(analyst, "20.00");
    expect(path).toBe("direct");
    const auditBefore = await db.select().from(auditLog);

    for (const input of [
      { refundId: id, decision: "approve" as const },
      { refundId: id, decision: "reject" as const, note: "Not needed" },
    ]) {
      expect(await decideRefund(input)).toEqual({
        ok: false,
        error: "You requested this refund, so a different approver must decide it.",
      });
    }

    const row = await refund(id);
    expect(row?.status).toBe("pending");
    expect(row?.decidedBy).toBeNull();
    expect(await db.select().from(auditLog)).toHaveLength(auditBefore.length);
  });

  it("lets a different approver decide an above-threshold refund", async () => {
    const { id } = await submitAs(approver, "750.00");
    session.actor = otherApprover;

    expect(await decideRefund({ refundId: id, decision: "approve" })).toEqual({
      ok: true,
    });

    const [approval] = await db.select().from(approvalRequests);
    expect(approval).toMatchObject({ status: "approved", approvedBy: otherApprover.id });
    expect((await auditFor("approval_request", approval.id)).map((r) => r.action).sort())
      .toEqual(["approval_request.created", "approval_request.decided"]);
    expect((await refund(id))?.status).toBe("approved");
  });

  it("rejects an analyst approving an above-threshold refund", async () => {
    const { id } = await submitAs(approver, "500.00");
    session.actor = analyst;
    const auditBefore = await db.select().from(auditLog);

    const result = await decideRefund({ refundId: id, decision: "approve" });
    expect(result.ok).toBe(false);

    expect((await refund(id))?.status).toBe("pending");
    const [approval] = await db.select().from(approvalRequests);
    expect(approval.status).toBe("pending");
    expect(await db.select().from(auditLog)).toHaveLength(auditBefore.length);
  });

  it("requires a note to reject", async () => {
    const { id } = await submitAs(analyst, "20.00");
    session.actor = otherAnalyst;
    const result = await decideRefund({ refundId: id, decision: "reject" });
    expect(result).toEqual({
      ok: false,
      error: "A note is required to reject a refund.",
    });

    expect(
      await decideRefund({ refundId: id, decision: "reject", note: "Duplicate" }),
    ).toEqual({ ok: true });
    const row = await refund(id);
    expect(row).toMatchObject({ status: "rejected", decisionNote: "Duplicate" });
    expect(
      (await auditFor("refund_request", id)).map((entry) => entry.action).sort(),
    ).toEqual(["refund_request.created", "refund_request.rejected"]);

    expect(await decideRefund({ refundId: id, decision: "approve" })).toMatchObject({
      ok: false,
    });
  });

  it("refuses to mark a pending refund paid", async () => {
    const { id } = await submitAs(analyst, "100.00");
    session.actor = approver;

    const result = await markPaid({ refundId: id });
    expect(result).toEqual({
      ok: false,
      error: "Only approved refunds can be marked paid.",
    });
    expect((await refund(id))?.status).toBe("pending");
    expect(
      (await auditFor("refund_request", id)).map((entry) => entry.action),
    ).toEqual(["refund_request.created"]);
  });

  it("marks an approved refund paid by an approver and audits it", async () => {
    const { id } = await submitAs(analyst, "100.00");
    session.actor = otherAnalyst;
    await decideRefund({ refundId: id, decision: "approve" });
    session.actor = approver;

    expect(await markPaid({ refundId: id })).toEqual({ ok: true });

    const row = await refund(id);
    expect(row?.status).toBe("paid");
    expect(row?.paidAt).toBeInstanceOf(Date);
    const [paid] = (await auditFor("refund_request", id)).filter(
      (entry) => entry.action === "refund_request.paid",
    );
    expect(paid).toMatchObject({
      actorId: approver.id,
      before: expect.objectContaining({ status: "approved" }),
      after: expect.objectContaining({ status: "paid" }),
    });

    expect(await markPaid({ refundId: id })).toMatchObject({ ok: false });
  });

  it("forbids analysts from marking refunds paid", async () => {
    const { id } = await submitAs(analyst, "100.00");
    session.actor = otherAnalyst;
    await decideRefund({ refundId: id, decision: "approve" });

    await expect(markPaid({ refundId: id })).rejects.toThrow("/forbidden");
    expect((await refund(id))?.status).toBe("approved");
  });

  it("validates input before writing", async () => {
    session.actor = analyst;
    const result = await createRefund({ ...refundInput("-5"), reason: "nope" });
    expect(result.ok).toBe(false);
    expect(await db.select().from(refundRequests)).toHaveLength(0);
    expect(await db.select().from(auditLog)).toHaveLength(0);
  });
});
