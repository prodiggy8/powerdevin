import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hasRole, type Role } from "@/core/rbac";
import { auditLog, kycCases, users } from "@/db/schema";
import { testDb } from "./db";

type Actor = { id: string; role: Role };

const { session } = vi.hoisted(() => ({
  session: { actor: null as { id: string; role: string } | null },
}));

vi.mock("@/db", async () => {
  const { testDb } = await import("./db");
  return { db: testDb(), getDb: testDb };
});

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// Stands in for the redirects requireUser/requireRole issue in the browser.
vi.mock("@/core/auth", async () => {
  const { hasRole } = await import("@/core/rbac");
  return {
    requireUser: async () => {
      if (!session.actor) throw new Error("unauthenticated");
      return session.actor;
    },
    requireRole: async (required: Role | Role[]) => {
      if (!session.actor) throw new Error("unauthenticated");
      if (!hasRole(session.actor.role as Role, required)) {
        throw new Error("forbidden");
      }
      return session.actor;
    },
  };
});

const { claimCase, decideCase, reassignCase } = await import(
  "@/modules/kyc/actions"
);

const db = testDb();

async function createUser(email: string, role: Role): Promise<Actor> {
  const [row] = await db
    .insert(users)
    .values({ name: email, email, role })
    .returning();
  return { id: row.id, role: row.role };
}

async function createCase(
  overrides: Partial<typeof kycCases.$inferInsert> = {},
) {
  const [row] = await db
    .insert(kycCases)
    .values({
      customerName: "Aurora Lindgren",
      customerEmail: "aurora@contoso.com",
      country: "SE",
      riskScore: 30,
      ...overrides,
    })
    .returning();
  return row;
}

function signIn(actor: Actor) {
  session.actor = actor;
}

const auditFor = (caseId: string) =>
  db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entity, "kyc_case"), eq(auditLog.entityId, caseId)));

const reload = (caseId: string) =>
  db.query.kycCases.findFirst({ where: eq(kycCases.id, caseId) });

beforeEach(() => {
  session.actor = null;
});

describe("claimCase", () => {
  it("assigns the case to the caller and writes kyc_case.claimed", async () => {
    const analyst = await createUser("analyst@contoso.com", "analyst");
    const kycCase = await createCase();
    signIn(analyst);

    expect(await claimCase({ caseId: kycCase.id })).toEqual({ ok: true });

    const after = await reload(kycCase.id);
    expect(after?.status).toBe("in_review");
    expect(after?.assignedTo).toBe(analyst.id);

    const [entry] = await auditFor(kycCase.id);
    expect(entry.action).toBe("kyc_case.claimed");
    expect(entry.actorId).toBe(analyst.id);
    expect(entry.before).toMatchObject({ status: "pending" });
    expect(entry.after).toMatchObject({ status: "in_review" });
  });

  it("refuses a case that is already final", async () => {
    const analyst = await createUser("analyst@contoso.com", "analyst");
    const kycCase = await createCase({ status: "approved" });
    signIn(analyst);

    const result = await claimCase({ caseId: kycCase.id });

    expect(result).toEqual({ ok: false, error: "This case is already final." });
    expect(await auditFor(kycCase.id)).toHaveLength(0);
  });
});

describe("decideCase", () => {
  const reason = "Documents verified against the national register.";

  it("refuses a high-risk case for an analyst and leaves no trace", async () => {
    const analyst = await createUser("analyst@contoso.com", "analyst");
    const kycCase = await createCase({ riskScore: 85 });
    signIn(analyst);

    const result = await decideCase({
      caseId: kycCase.id,
      decision: "approve",
      reason,
    });

    expect(result).toEqual({
      ok: false,
      error: "High-risk cases need an approver.",
    });
    expect((await reload(kycCase.id))?.status).toBe("pending");
    expect(await auditFor(kycCase.id)).toHaveLength(0);
  });

  it("lets an approver decide the same high-risk case", async () => {
    const approver = await createUser("approver@contoso.com", "approver");
    const kycCase = await createCase({ riskScore: 85 });
    signIn(approver);

    expect(
      await decideCase({ caseId: kycCase.id, decision: "approve", reason }),
    ).toEqual({ ok: true });

    const after = await reload(kycCase.id);
    expect(after?.status).toBe("approved");
    expect(after?.decidedBy).toBe(approver.id);
    expect(after?.decisionReason).toBe(reason);
    expect(after?.decidedAt).toBeInstanceOf(Date);

    const [entry] = await auditFor(kycCase.id);
    expect(entry.action).toBe("kyc_case.approved");
    expect(entry.actorId).toBe(approver.id);
  });

  it("refuses an analyst on an escalated case but not an approver", async () => {
    const analyst = await createUser("analyst@contoso.com", "analyst");
    const approver = await createUser("approver@contoso.com", "approver");
    const kycCase = await createCase({ riskScore: 12, status: "escalated" });

    signIn(analyst);
    expect(
      await decideCase({ caseId: kycCase.id, decision: "reject", reason }),
    ).toEqual({ ok: false, error: "Escalated cases need an approver." });

    signIn(approver);
    expect(
      await decideCase({ caseId: kycCase.id, decision: "reject", reason }),
    ).toEqual({ ok: true });
    expect((await reload(kycCase.id))?.status).toBe("rejected");
  });

  it("refuses a decision on a final case", async () => {
    const approver = await createUser("approver@contoso.com", "approver");
    const kycCase = await createCase({ status: "rejected", riskScore: 10 });
    signIn(approver);

    expect(
      await decideCase({ caseId: kycCase.id, decision: "approve", reason }),
    ).toEqual({ ok: false, error: "This case is already final." });
    expect((await reload(kycCase.id))?.status).toBe("rejected");
    expect(await auditFor(kycCase.id)).toHaveLength(0);
  });

  it("refuses a reason shorter than ten characters", async () => {
    const approver = await createUser("approver@contoso.com", "approver");
    const kycCase = await createCase();
    signIn(approver);

    const result = await decideCase({
      caseId: kycCase.id,
      decision: "approve",
      reason: "too short",
    });

    expect(result.ok).toBe(false);
    expect((await reload(kycCase.id))?.status).toBe("pending");
    expect(await auditFor(kycCase.id)).toHaveLength(0);
  });

  it("returns an escalated case to the unassigned pool", async () => {
    const approver = await createUser("approver@contoso.com", "approver");
    const kycCase = await createCase({
      status: "in_review",
      assignedTo: approver.id,
      riskScore: 80,
    });
    signIn(approver);

    expect(
      await decideCase({ caseId: kycCase.id, decision: "escalate", reason }),
    ).toEqual({ ok: true });

    const after = await reload(kycCase.id);
    expect(after?.status).toBe("escalated");
    expect(after?.assignedTo).toBeNull();
    expect((await auditFor(kycCase.id))[0].action).toBe("kyc_case.escalated");
  });
});

describe("reassignCase", () => {
  it("is refused for anyone below admin", async () => {
    const approver = await createUser("approver@contoso.com", "approver");
    const analyst = await createUser("analyst@contoso.com", "analyst");
    const kycCase = await createCase();
    signIn(approver);

    await expect(
      reassignCase({ caseId: kycCase.id, userId: analyst.id }),
    ).rejects.toThrow("forbidden");
    expect(await auditFor(kycCase.id)).toHaveLength(0);
    expect(hasRole(approver.role, "admin")).toBe(false);
  });

  it("moves the case and writes kyc_case.reassigned", async () => {
    const admin = await createUser("admin@contoso.com", "admin");
    const analyst = await createUser("analyst@contoso.com", "analyst");
    const kycCase = await createCase({ status: "in_review" });
    signIn(admin);

    expect(
      await reassignCase({ caseId: kycCase.id, userId: analyst.id }),
    ).toEqual({ ok: true });

    expect((await reload(kycCase.id))?.assignedTo).toBe(analyst.id);
    const [entry] = await auditFor(kycCase.id);
    expect(entry.action).toBe("kyc_case.reassigned");
    expect(entry.actorId).toBe(admin.id);
  });
});
