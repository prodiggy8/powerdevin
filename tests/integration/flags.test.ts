import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { auditLog, featureFlags, featureFlagStates, users } from "@/db/schema";
import type { Role } from "@/core/rbac";
import {
  archiveFlag,
  createFlag,
  setFlagState,
  type Actor,
} from "@/modules/flags/service";
import { testDb } from "./db";

const db = testDb();

async function actorWithRole(role: Role): Promise<Actor> {
  const [row] = await db
    .insert(users)
    .values({ name: role, email: `${role}-${crypto.randomUUID()}@contoso.com`, role })
    .returning();
  return { id: row.id, role: row.role };
}

async function flagOwnedBy(actor: Actor, key = "instant_refunds_v2") {
  const result = await createFlag(db, actor, {
    key,
    description: "Settle eligible refunds instantly.",
    ownerId: actor.id,
  });
  if (!result.ok) throw new Error(result.error);
  return result.id;
}

function auditRows(action?: string) {
  return action
    ? db.select().from(auditLog).where(eq(auditLog.action, action))
    : db.select().from(auditLog);
}

async function stateOf(flagId: string, environment: "dev" | "staging" | "prod") {
  const [state] = await db
    .select()
    .from(featureFlagStates)
    .where(
      and(
        eq(featureFlagStates.flagId, flagId),
        eq(featureFlagStates.environment, environment),
      ),
    );
  return state;
}

describe("createFlag", () => {
  it("creates three disabled states and exactly one audit row", async () => {
    const admin = await actorWithRole("admin");
    const flagId = await flagOwnedBy(admin);

    const states = await db
      .select()
      .from(featureFlagStates)
      .where(eq(featureFlagStates.flagId, flagId));
    expect(states).toHaveLength(3);
    expect(states.every((state) => !state.enabled)).toBe(true);
    expect(states.every((state) => state.rolloutPercent === 0)).toBe(true);
    expect(states.map((state) => state.environment).sort()).toEqual([
      "dev",
      "prod",
      "staging",
    ]);

    const audit = await auditRows();
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("feature_flag.created");
    expect(audit[0].entityId).toBe(flagId);
    expect(audit[0].actorId).toBe(admin.id);
  });

  it("rejects a duplicate key with a field error and writes nothing", async () => {
    const admin = await actorWithRole("admin");
    await flagOwnedBy(admin);

    const result = await createFlag(db, admin, {
      key: "instant_refunds_v2",
      description: "Another one.",
      ownerId: admin.id,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.key?.[0]).toMatch(/already in use/i);
    expect(await db.select().from(featureFlags)).toHaveLength(1);
    expect(await auditRows()).toHaveLength(1);
  });

  it("rejects a key that is not lowercase snake_case", async () => {
    const admin = await actorWithRole("admin");

    const result = await createFlag(db, admin, {
      key: "Instant Refunds",
      description: "Bad key.",
      ownerId: admin.id,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.key?.[0]).toMatch(/snake_case/i);
    expect(await db.select().from(featureFlags)).toHaveLength(0);
  });

  it("refuses analysts", async () => {
    const admin = await actorWithRole("admin");
    const analyst = await actorWithRole("analyst");

    const result = await createFlag(db, analyst, {
      key: "kyc_doc_ocr",
      description: "OCR on documents.",
      ownerId: admin.id,
    });

    expect(result.ok).toBe(false);
    expect(await db.select().from(featureFlags)).toHaveLength(0);
    expect(await auditRows()).toHaveLength(0);
  });
});

describe("setFlagState", () => {
  it("lets an approver change dev and audits it", async () => {
    const admin = await actorWithRole("admin");
    const approver = await actorWithRole("approver");
    const flagId = await flagOwnedBy(admin);

    const result = await setFlagState(db, approver, {
      flagId,
      environment: "dev",
      enabled: true,
      rolloutPercent: 100,
    });

    expect(result.ok).toBe(true);
    const state = await stateOf(flagId, "dev");
    expect(state.enabled).toBe(true);
    expect(state.rolloutPercent).toBe(100);
    expect(state.updatedBy).toBe(approver.id);

    const [audit] = await auditRows("feature_flag_state.updated");
    expect(audit.entityId).toBe(state.id);
    expect(audit.actorId).toBe(approver.id);
    expect(audit.before).toEqual({
      environment: "dev",
      enabled: false,
      rolloutPercent: 0,
    });
    expect(audit.after).toEqual({
      environment: "dev",
      enabled: true,
      rolloutPercent: 100,
      reason: null,
    });
  });

  it("rejects an approver changing prod and writes no audit row", async () => {
    const admin = await actorWithRole("admin");
    const approver = await actorWithRole("approver");
    const flagId = await flagOwnedBy(admin);

    const result = await setFlagState(db, approver, {
      flagId,
      environment: "prod",
      enabled: true,
      rolloutPercent: 10,
      reason: "the approver really wants this",
    });

    expect(result.ok).toBe(false);
    expect(await auditRows("feature_flag_state.updated")).toHaveLength(0);
    expect((await stateOf(flagId, "prod")).enabled).toBe(false);
  });

  it("rejects an admin changing prod without a reason", async () => {
    const admin = await actorWithRole("admin");
    const flagId = await flagOwnedBy(admin);

    const result = await setFlagState(db, admin, {
      flagId,
      environment: "prod",
      enabled: true,
      rolloutPercent: 10,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/reason/i);
    expect(await auditRows("feature_flag_state.updated")).toHaveLength(0);
  });

  it("records the reason and environment when an admin changes prod", async () => {
    const admin = await actorWithRole("admin");
    const flagId = await flagOwnedBy(admin);

    const result = await setFlagState(db, admin, {
      flagId,
      environment: "prod",
      enabled: true,
      rolloutPercent: 10,
      reason: "starting the staged rollout",
    });

    expect(result.ok).toBe(true);
    const [audit] = await auditRows("feature_flag_state.updated");
    expect(audit.after).toEqual({
      environment: "prod",
      enabled: true,
      rolloutPercent: 10,
      reason: "starting the staged rollout",
    });
  });

  it("caps a prod rollout jump at fifty points", async () => {
    const admin = await actorWithRole("admin");
    const flagId = await flagOwnedBy(admin);

    const toTen = await setFlagState(db, admin, {
      flagId,
      environment: "prod",
      enabled: true,
      rolloutPercent: 10,
      reason: "starting the staged rollout",
    });
    expect(toTen.ok).toBe(true);

    const toEighty = await setFlagState(db, admin, {
      flagId,
      environment: "prod",
      enabled: true,
      rolloutPercent: 80,
      reason: "going wide today",
    });
    expect(toEighty.ok).toBe(false);
    expect((await stateOf(flagId, "prod")).rolloutPercent).toBe(10);

    const toSixty = await setFlagState(db, admin, {
      flagId,
      environment: "prod",
      enabled: true,
      rolloutPercent: 60,
      reason: "widening the staged rollout",
    });
    expect(toSixty.ok).toBe(true);
    expect((await stateOf(flagId, "prod")).rolloutPercent).toBe(60);
    expect(await auditRows("feature_flag_state.updated")).toHaveLength(2);
  });

  it("rejects a rollout percent outside 0-100", async () => {
    const admin = await actorWithRole("admin");
    const flagId = await flagOwnedBy(admin);

    const result = await setFlagState(db, admin, {
      flagId,
      environment: "dev",
      enabled: true,
      rolloutPercent: 140,
    });

    expect(result.ok).toBe(false);
    expect((await stateOf(flagId, "dev")).rolloutPercent).toBe(0);
  });

  it("refuses changes to an archived flag", async () => {
    const admin = await actorWithRole("admin");
    const flagId = await flagOwnedBy(admin);
    await archiveFlag(db, admin, flagId);

    const result = await setFlagState(db, admin, {
      flagId,
      environment: "dev",
      enabled: true,
      rolloutPercent: 50,
    });

    expect(result.ok).toBe(false);
    expect(await auditRows("feature_flag_state.updated")).toHaveLength(0);
  });
});

describe("archiveFlag", () => {
  it("archives the flag and audits it", async () => {
    const admin = await actorWithRole("admin");
    const flagId = await flagOwnedBy(admin);

    const result = await archiveFlag(db, admin, flagId);

    expect(result.ok).toBe(true);
    const [flag] = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.id, flagId));
    expect(flag.archived).toBe(true);

    const [audit] = await auditRows("feature_flag.archived");
    expect(audit.entityId).toBe(flagId);
    expect(audit.before).toEqual({ key: flag.key, archived: false });
    expect(audit.after).toEqual({ key: flag.key, archived: true });
  });

  it("refuses approvers and analysts", async () => {
    const admin = await actorWithRole("admin");
    const approver = await actorWithRole("approver");
    const analyst = await actorWithRole("analyst");
    const flagId = await flagOwnedBy(admin);

    expect((await archiveFlag(db, approver, flagId)).ok).toBe(false);
    expect((await archiveFlag(db, analyst, flagId)).ok).toBe(false);
    expect(await auditRows("feature_flag.archived")).toHaveLength(0);
  });
});
