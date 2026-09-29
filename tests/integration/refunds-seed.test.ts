import { count, eq, like } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { approvalRequests, auditLog, refundRequests, users } from "@/db/schema";
import { runSeed } from "@/db/seed/index";
import { SEED_ORDER_PREFIX } from "@/db/seed/refunds";
import { testDb } from "./db";

const db = testDb();
const silent = () => {};

const seededRefunds = () =>
  db
    .select()
    .from(refundRequests)
    .where(like(refundRequests.orderRef, `${SEED_ORDER_PREFIX}%`));

describe("db:seed refunds", () => {
  it("seeds 80 refunds with pending approval requests for the 10 above threshold", async () => {
    await runSeed({ db, log: silent });

    expect(await seededRefunds()).toHaveLength(80);
    const pendingApprovals = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.status, "pending"));
    expect(pendingApprovals).toHaveLength(10);

    const [created] = await db
      .select({ value: count() })
      .from(auditLog)
      .where(eq(auditLog.action, "refund_request.created"));
    expect(created.value).toBe(80);
    const [paid] = await db
      .select({ value: count() })
      .from(auditLog)
      .where(eq(auditLog.action, "refund_request.paid"));
    expect(paid.value).toBe(30);
  });

  it("is idempotent and survives --reset", async () => {
    await runSeed({ db, log: silent });
    const [auditBefore] = await db.select({ value: count() }).from(auditLog);

    await runSeed({ db, log: silent });
    expect(await seededRefunds()).toHaveLength(80);
    const [auditAfter] = await db.select({ value: count() }).from(auditLog);
    expect(auditAfter.value).toBe(auditBefore.value);

    await runSeed({ db, reset: true, log: silent });
    expect(await seededRefunds()).toHaveLength(80);
    const [auditReset] = await db.select({ value: count() }).from(auditLog);
    expect(auditReset.value).toBe(auditBefore.value);
  });

  it("--reset keeps real refunds that share the order prefix", async () => {
    await runSeed({ db, log: silent });
    const [staff] = await db
      .insert(users)
      .values({ name: "Real Analyst", email: "real.analyst@contoso.com" })
      .returning();
    await db.insert(refundRequests).values({
      orderRef: `${SEED_ORDER_PREFIX}10492`,
      customerName: "Real Customer",
      customerEmail: "real.customer@gmail.com",
      amount: "25.00",
      currency: "USD",
      reason: "customer_request",
      requestedBy: staff.id,
    });

    await runSeed({ db, reset: true, log: silent });

    const refs = (await seededRefunds()).map((row) => row.orderRef);
    expect(refs).toHaveLength(81);
    expect(refs).toContain(`${SEED_ORDER_PREFIX}10492`);
  });
});
