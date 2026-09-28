import { count, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { auditLog, featureFlags, featureFlagStates } from "@/db/schema";
import { runSeed } from "@/db/seed/index";
import { testDb } from "./db";

const db = testDb();
const silent = () => {};

async function counts() {
  const [flags] = await db.select({ value: count() }).from(featureFlags);
  const [states] = await db.select({ value: count() }).from(featureFlagStates);
  const [archived] = await db
    .select({ value: count() })
    .from(featureFlags)
    .where(eq(featureFlags.archived, true));
  const [audit] = await db
    .select({ value: count() })
    .from(auditLog)
    .where(eq(auditLog.action, "feature_flag_state.updated"));
  return {
    flags: flags.value,
    states: states.value,
    archived: archived.value,
    audit: audit.value,
  };
}

describe("db:seed flags", () => {
  it("inserts 25 flags with three states each and 40 state audit rows", async () => {
    await runSeed({ db, log: silent });

    expect(await counts()).toEqual({
      flags: 25,
      states: 75,
      archived: 3,
      audit: 40,
    });
  });

  it("is idempotent", async () => {
    await runSeed({ db, log: silent });
    const before = await db.select().from(featureFlags);

    await runSeed({ db, log: silent });
    const after = await db.select().from(featureFlags);

    expect(await counts()).toEqual({
      flags: 25,
      states: 75,
      archived: 3,
      audit: 40,
    });
    expect(after.map((row) => row.id).sort()).toEqual(
      before.map((row) => row.id).sort(),
    );
  });

  it("--reset replaces the seeded flags", async () => {
    await runSeed({ db, log: silent });
    const before = await db.select().from(featureFlags);

    await runSeed({ db, reset: true, log: silent });
    const after = await db.select().from(featureFlags);

    expect(after).toHaveLength(25);
    expect(after.map((row) => row.id)).not.toEqual(
      before.map((row) => row.id),
    );
  });

  it("gives several flags a partial rollout", async () => {
    await runSeed({ db, log: silent });

    const partial = (await db.select().from(featureFlagStates)).filter(
      (state) => state.rolloutPercent > 0 && state.rolloutPercent < 100,
    );
    expect(partial.length).toBeGreaterThanOrEqual(5);
  });
});
