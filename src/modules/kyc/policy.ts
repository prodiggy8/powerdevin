import type { Role } from "@/core/rbac";
import { hasRole } from "@/core/rbac";
import type { KycStatus } from "./schema";

export const RISK_BANDS = ["low", "medium", "high"] as const;
export type RiskBand = (typeof RISK_BANDS)[number];

/** Scores at or above this need an approver. */
export const HIGH_RISK_THRESHOLD = 70;
export const MEDIUM_RISK_THRESHOLD = 40;
export const MIN_REASON_LENGTH = 10;

export const DECISIONS = ["approve", "reject", "escalate"] as const;
export type Decision = (typeof DECISIONS)[number];

const DECISION_STATUS: Record<Decision, KycStatus> = {
  approve: "approved",
  reject: "rejected",
  escalate: "escalated",
};

const DECISION_ACTION: Record<Decision, string> = {
  approve: "kyc_case.approved",
  reject: "kyc_case.rejected",
  escalate: "kyc_case.escalated",
};

export function riskBand(riskScore: number): RiskBand {
  if (riskScore >= HIGH_RISK_THRESHOLD) return "high";
  if (riskScore >= MEDIUM_RISK_THRESHOLD) return "medium";
  return "low";
}

export function riskBandRange(band: RiskBand): { min: number; max: number } {
  if (band === "low") return { min: 0, max: MEDIUM_RISK_THRESHOLD - 1 };
  if (band === "medium")
    return { min: MEDIUM_RISK_THRESHOLD, max: HIGH_RISK_THRESHOLD - 1 };
  return { min: HIGH_RISK_THRESHOLD, max: 100 };
}

export function isRiskBand(value: unknown): value is RiskBand {
  return (
    typeof value === "string" && (RISK_BANDS as readonly string[]).includes(value)
  );
}

/** Approved and rejected cases are terminal; nothing may change them. */
export function isFinal(status: KycStatus): boolean {
  return status === "approved" || status === "rejected";
}

export function statusFor(decision: Decision): KycStatus {
  return DECISION_STATUS[decision];
}

export function auditActionFor(decision: Decision): string {
  return DECISION_ACTION[decision];
}

export type PolicyCheck = { ok: true } | { ok: false; error: string };

/** Escalated and high-risk cases are an approver's call, not an analyst's. */
export function canDecide(
  role: Role,
  candidate: { status: KycStatus; riskScore: number },
): PolicyCheck {
  if (isFinal(candidate.status)) {
    return { ok: false, error: "This case is already final." };
  }
  if (hasRole(role, "approver")) {
    return { ok: true };
  }
  if (candidate.status === "escalated") {
    return { ok: false, error: "Escalated cases need an approver." };
  }
  if (candidate.riskScore >= HIGH_RISK_THRESHOLD) {
    return { ok: false, error: "High-risk cases need an approver." };
  }
  return { ok: true };
}

/** Only admins may take a case that is already assigned to someone else. */
export function canClaim(
  actor: { id: string; role: Role },
  candidate: {
    status: KycStatus;
    assignedTo: string | null;
    assigneeName?: string | null;
  },
): PolicyCheck {
  if (isFinal(candidate.status)) {
    return { ok: false, error: "This case is already final." };
  }
  if (
    candidate.assignedTo &&
    candidate.assignedTo !== actor.id &&
    !hasRole(actor.role, "admin")
  ) {
    return {
      ok: false,
      error: `This case is assigned to ${candidate.assigneeName || "another user"}.`,
    };
  }
  return { ok: true };
}

/** Claiming takes ownership; it never lifts an escalation. */
export function statusAfterClaim(status: KycStatus): KycStatus {
  return status === "escalated" ? "escalated" : "in_review";
}
