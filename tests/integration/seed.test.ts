import { count, eq, like } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { auditLog, users } from "@/db/schema";
import { runSeed } from "@/db/seed/index";
import { SEED_EMAIL_DOMAIN } from "@/db/seed/users";
import { testDb } from "./db";

const db = testDb();
const seededUsers = () =>
  db
    .select()
    .from(users)
    .where(like(users.email, `%@${SEED_EMAIL_DOMAIN}`));

const silent = () => {};

describe("db:seed", () => {
  it("inserts 40 users and 25 audit rows", async () => {
    await runSeed({ db, log: silent });

    expect(await seededUsers()).toHaveLength(40);
    const [audit] = await db
      .select({ value: count() })
      .from(auditLog)
      .where(eq(auditLog.action, "user.role.updated"));
    expect(audit.value).toBe(25);
  });

  it("is idempotent", async () => {
    await runSeed({ db, log: silent });
    const first = await seededUsers();

    await runSeed({ db, log: silent });
    const second = await seededUsers();

    expect(second).toHaveLength(first.length);
    expect(second.map((row) => row.id).sort()).toEqual(
      first.map((row) => row.id).sort(),
    );
    const [audit] = await db
      .select({ value: count() })
      .from(auditLog)
      .where(eq(auditLog.action, "user.role.updated"));
    expect(audit.value).toBe(25);
  });

  it("gives seeded users no way to sign in", async () => {
    await runSeed({ db, log: silent });

    const accounts = await db.query.accounts.findMany();
    expect(accounts).toHaveLength(0);
  });

  it("covers all three roles", async () => {
    await runSeed({ db, log: silent });

    const roles = new Set((await seededUsers()).map((row) => row.role));
    expect([...roles].sort()).toEqual(["admin", "analyst", "approver"]);
  });

  it("--reset replaces seeded rows and leaves real users alone", async () => {
    await runSeed({ db, log: silent });
    const [real] = await db
      .insert(users)
      .values({ name: "Real Admin", email: "admin@contoso.com", role: "admin" })
      .returning();
    const before = await seededUsers();

    await runSeed({ db, reset: true, log: silent });
    const after = await seededUsers();

    expect(after).toHaveLength(40);
    expect(after.map((row) => row.id)).not.toEqual(
      before.map((row) => row.id),
    );
    expect(await db.query.users.findFirst({ where: eq(users.id, real.id) }))
      .toBeDefined();
  });
});
