import { count, eq, isNotNull, like } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { auditLog, kycCases } from "@/db/schema";
import { runSeed } from "@/db/seed/index";
import { SEED_CASE_COUNT, SEED_CASE_ID_PREFIX } from "@/db/seed/kyc";
import { testDb } from "./db";

const db = testDb();
const silent = () => {};

const seededCases = () =>
  db
    .select()
    .from(kycCases)
    .where(like(kycCases.id, `${SEED_CASE_ID_PREFIX}%`));

const countByStatus = async (status: "pending" | "in_review" | "approved" | "rejected" | "escalated") => {
  const [row] = await db
    .select({ value: count() })
    .from(kycCases)
    .where(eq(kycCases.status, status));
  return row.value;
};

describe("seed:kyc", () => {
  it("inserts the planned queue", async () => {
    await runSeed({ db, log: silent });

    expect(await seededCases()).toHaveLength(SEED_CASE_COUNT);
    expect(await countByStatus("pending")).toBe(30);
    expect(await countByStatus("in_review")).toBe(12);
    expect(await countByStatus("approved")).toBe(10);
    expect(await countByStatus("rejected")).toBe(5);
    expect(await countByStatus("escalated")).toBe(3);
  });

  it("covers all three risk bands and eight countries", async () => {
    await runSeed({ db, log: silent });
    const rows = await seededCases();

    const bands = new Set(
      rows.map((row) =>
        row.riskScore >= 70 ? "high" : row.riskScore >= 40 ? "medium" : "low",
      ),
    );
    expect([...bands].sort()).toEqual(["high", "low", "medium"]);
    expect(new Set(rows.map((row) => row.country)).size).toBe(8);
  });

  it("writes an audit row for every historical decision", async () => {
    await runSeed({ db, log: silent });

    const decided = (await seededCases()).filter((row) => row.decidedAt);
    const entries = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entity, "kyc_case"));

    expect(decided).toHaveLength(18);
    expect(entries).toHaveLength(decided.length);
    expect(new Set(entries.map((entry) => entry.entityId))).toEqual(
      new Set(decided.map((row) => row.id)),
    );
    expect(
      decided.every((row) => row.decisionReason && row.decisionReason.length > 10),
    ).toBe(true);
  });

  it("is idempotent", async () => {
    await runSeed({ db, log: silent });
    await runSeed({ db, log: silent });

    expect(await seededCases()).toHaveLength(SEED_CASE_COUNT);
    const [entries] = await db
      .select({ value: count() })
      .from(auditLog)
      .where(eq(auditLog.entity, "kyc_case"));
    expect(entries.value).toBe(18);
  });

  it("--reset leaves the same queue behind", async () => {
    await runSeed({ db, log: silent });
    await runSeed({ db, reset: true, log: silent });

    const rows = await seededCases();
    expect(rows).toHaveLength(SEED_CASE_COUNT);
    const [assigned] = await db
      .select({ value: count() })
      .from(kycCases)
      .where(isNotNull(kycCases.assignedTo));
    expect(assigned.value).toBe(42);
  });
});
