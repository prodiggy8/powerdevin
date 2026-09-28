import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { withAudit } from "@/core/audit";
import { auditLog, users } from "@/db/schema";
import { testDb } from "./db";

const db = testDb();

async function createUser(email: string, role: "admin" | "analyst") {
  const [row] = await db
    .insert(users)
    .values({ name: email, email, role })
    .returning();
  return row;
}

describe("withAudit", () => {
  it("records the before and after of a mutation", async () => {
    const actor = await createUser("actor@contoso.com", "admin");
    const subject = await createUser("subject@contoso.com", "analyst");

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ role: "admin" })
        .where(eq(users.id, subject.id));
      await withAudit(tx, {
        actorId: actor.id,
        action: "user.role.updated",
        entity: "user",
        entityId: subject.id,
        before: { role: "analyst" },
        after: { role: "admin" },
      });
    });

    const [entry] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, subject.id));
    expect(entry.action).toBe("user.role.updated");
    expect(entry.actorId).toBe(actor.id);
    expect(entry.before).toEqual({ role: "analyst" });
    expect(entry.after).toEqual({ role: "admin" });
  });

  it("rolls the audit row back with the mutation", async () => {
    const subject = await createUser("rollback@contoso.com", "analyst");

    await expect(
      db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ role: "admin" })
          .where(eq(users.id, subject.id));
        await withAudit(tx, {
          actorId: null,
          action: "user.role.updated",
          entity: "user",
          entityId: subject.id,
        });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const unchanged = await db.query.users.findFirst({
      where: eq(users.id, subject.id),
    });
    expect(unchanged?.role).toBe("analyst");
    expect(await db.select().from(auditLog)).toHaveLength(0);
  });
});
