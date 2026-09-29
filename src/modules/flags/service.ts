import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@/db";
import { withAudit } from "@/core/audit";
import type { Role } from "@/core/rbac";
import { featureFlags, featureFlagStates } from "./schema";
import {
  canArchiveFlag,
  canCreateFlag,
  checkStateChange,
  FLAG_ENVIRONMENTS,
  FLAG_KEY_PATTERN,
} from "./policy";

export type Actor = { id: string; role: Role };

export type MutationResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export const createFlagSchema = z.object({
  key: z
    .string()
    .trim()
    .min(3, "Key must be at least 3 characters.")
    .max(64, "Key must be at most 64 characters.")
    .regex(
      FLAG_KEY_PATTERN,
      "Key must be lowercase snake_case, e.g. instant_refunds_v2.",
    ),
  description: z
    .string()
    .trim()
    .min(1, "Description is required.")
    .max(280, "Description must be at most 280 characters."),
  ownerId: z.string().min(1, "Owner is required."),
});

export const setFlagStateSchema = z.object({
  flagId: z.string().min(1),
  environment: z.enum(FLAG_ENVIRONMENTS),
  enabled: z.boolean(),
  rolloutPercent: z.number().int().min(0).max(100),
  reason: z.string().trim().max(500).optional(),
});

export type CreateFlagInput = z.infer<typeof createFlagSchema>;
export type SetFlagStateInput = z.infer<typeof setFlagStateSchema>;

/** Creates the flag and one disabled state per environment, in one transaction. */
export async function createFlag(
  db: Database,
  actor: Actor,
  input: unknown,
): Promise<MutationResult<{ id: string }>> {
  if (!canCreateFlag(actor.role)) {
    return { ok: false, error: "You do not have permission to create flags." };
  }

  const parsed = createFlagSchema.safeParse(input);
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrors as Record<string, string[]>,
    };
  }
  const { key, description, ownerId } = parsed.data;

  const existing = await db.query.featureFlags.findFirst({
    where: eq(featureFlags.key, key),
    columns: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      error: "That key is already in use.",
      fieldErrors: { key: ["That key is already in use."] },
    };
  }

  return db.transaction(async (tx) => {
    const [flag] = await tx
      .insert(featureFlags)
      .values({ key, description, ownerId })
      .returning();

    await tx.insert(featureFlagStates).values(
      FLAG_ENVIRONMENTS.map((environment) => ({
        flagId: flag.id,
        environment,
        enabled: false,
        rolloutPercent: 0,
        updatedBy: actor.id,
      })),
    );

    await withAudit(tx, {
      actorId: actor.id,
      action: "feature_flag.created",
      entity: "feature_flag",
      entityId: flag.id,
      after: {
        key: flag.key,
        description: flag.description,
        ownerId: flag.ownerId,
      },
    });

    return { ok: true as const, id: flag.id };
  });
}

/** Toggles or re-rolls one environment of a flag, subject to the prod rules. */
export async function setFlagState(
  db: Database,
  actor: Actor,
  input: unknown,
): Promise<MutationResult> {
  const parsed = setFlagStateSchema.safeParse(input);
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return {
      ok: false,
      error: "Rollout percent must be a whole number between 0 and 100.",
      fieldErrors: fieldErrors as Record<string, string[]>,
    };
  }
  const { flagId, environment, enabled, rolloutPercent, reason } = parsed.data;

  const flag = await db.query.featureFlags.findFirst({
    where: eq(featureFlags.id, flagId),
    columns: { id: true, key: true, archived: true },
  });
  if (!flag) return { ok: false, error: "Flag not found." };
  if (flag.archived) return { ok: false, error: "This flag is archived." };

  return db.transaction(async (tx) => {
    const [state] = await tx
      .select()
      .from(featureFlagStates)
      .where(
        and(
          eq(featureFlagStates.flagId, flagId),
          eq(featureFlagStates.environment, environment),
        ),
      )
      .for("update");
    if (!state) {
      return { ok: false as const, error: "Environment state not found." };
    }

    const check = checkStateChange({
      role: actor.role,
      environment,
      reason,
      currentRolloutPercent: state.rolloutPercent,
      nextRolloutPercent: rolloutPercent,
    });
    if (!check.ok) return { ok: false as const, error: check.error };

    if (state.enabled === enabled && state.rolloutPercent === rolloutPercent) {
      return { ok: true as const };
    }

    const [after] = await tx
      .update(featureFlagStates)
      .set({
        enabled,
        rolloutPercent,
        updatedBy: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(featureFlagStates.id, state.id))
      .returning();

    await withAudit(tx, {
      actorId: actor.id,
      action: "feature_flag_state.updated",
      entity: "feature_flag_state",
      entityId: state.id,
      before: {
        environment,
        enabled: state.enabled,
        rolloutPercent: state.rolloutPercent,
      },
      after: {
        environment,
        enabled: after.enabled,
        rolloutPercent: after.rolloutPercent,
        reason: reason?.trim() || null,
      },
    });

    return { ok: true as const };
  });
}

export async function archiveFlag(
  db: Database,
  actor: Actor,
  flagId: string,
): Promise<MutationResult> {
  if (!canArchiveFlag(actor.role)) {
    return { ok: false, error: "Only admins can archive flags." };
  }
  if (typeof flagId !== "string" || flagId.length === 0) {
    return { ok: false, error: "Flag not found." };
  }

  const flag = await db.query.featureFlags.findFirst({
    where: eq(featureFlags.id, flagId),
    columns: { id: true, key: true, archived: true },
  });
  if (!flag) return { ok: false, error: "Flag not found." };
  if (flag.archived) return { ok: true };

  await db.transaction(async (tx) => {
    const [after] = await tx
      .update(featureFlags)
      .set({ archived: true })
      .where(eq(featureFlags.id, flagId))
      .returning({ id: featureFlags.id, archived: featureFlags.archived });

    await withAudit(tx, {
      actorId: actor.id,
      action: "feature_flag.archived",
      entity: "feature_flag",
      entityId: flagId,
      before: { key: flag.key, archived: flag.archived },
      after: { key: flag.key, archived: after.archived },
    });
  });

  return { ok: true };
}
