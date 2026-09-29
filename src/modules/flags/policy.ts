import { hasRole, type Role } from "@/core/rbac";
import type { FlagEnvironment } from "./schema";

export const FLAG_ENVIRONMENTS = ["dev", "staging", "prod"] as const;

export const ENV_LABELS: Record<FlagEnvironment, string> = {
  dev: "Dev",
  staging: "Staging",
  prod: "Prod",
};

export const ACTION_LABELS: Record<string, string> = {
  "feature_flag.created": "Created",
  "feature_flag.archived": "Archived",
  "feature_flag_state.updated": "State changed",
};

/** Lowercase snake_case, starting with a letter: `instant_refunds_v2`. */
export const FLAG_KEY_PATTERN = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

export const PROD_REASON_MIN_LENGTH = 10;
/** A prod rollout may not move more than this many points in one change. */
export const MAX_PROD_ROLLOUT_JUMP = 50;

export function isFlagEnvironment(value: unknown): value is FlagEnvironment {
  return (
    typeof value === "string" &&
    (FLAG_ENVIRONMENTS as readonly string[]).includes(value)
  );
}

/** Approvers own dev and staging; prod is admin-only. */
export function canChangeEnvironment(
  role: Role,
  environment: FlagEnvironment,
): boolean {
  if (environment === "prod") return hasRole(role, "admin");
  return hasRole(role, "approver");
}

export function canCreateFlag(role: Role): boolean {
  return hasRole(role, "approver");
}

export function canArchiveFlag(role: Role): boolean {
  return hasRole(role, "admin");
}

export type StateChangeCheck = { ok: true } | { ok: false; error: string };

/** The rules a state change must satisfy beyond the shape of its input. */
export function checkStateChange({
  role,
  environment,
  reason,
  currentRolloutPercent,
  nextRolloutPercent,
}: {
  role: Role;
  environment: FlagEnvironment;
  reason?: string;
  currentRolloutPercent: number;
  nextRolloutPercent: number;
}): StateChangeCheck {
  if (!canChangeEnvironment(role, environment)) {
    return {
      ok: false,
      error:
        environment === "prod"
          ? "Only admins can change prod."
          : "You do not have permission to change this environment.",
    };
  }

  if (environment === "prod") {
    if ((reason?.trim().length ?? 0) < PROD_REASON_MIN_LENGTH) {
      return {
        ok: false,
        error: `Prod changes need a reason of at least ${PROD_REASON_MIN_LENGTH} characters.`,
      };
    }
    const jump = Math.abs(nextRolloutPercent - currentRolloutPercent);
    if (jump > MAX_PROD_ROLLOUT_JUMP) {
      return {
        ok: false,
        error: `Prod rollout may not move more than ${MAX_PROD_ROLLOUT_JUMP} points at a time (tried ${currentRolloutPercent} → ${nextRolloutPercent}).`,
      };
    }
  }

  return { ok: true };
}
