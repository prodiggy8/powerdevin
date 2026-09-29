import { hasRole, type Role } from "../../core/rbac";
import type { SecondApproverCheck } from "../../core/approvals";

export const REFUND_ENTITY = "refund_request";
export const APPROVAL_ENTITY = "approval_request";
export const REFUND_THRESHOLD = "500.00";

export const REFUND_REASONS = [
  "duplicate",
  "fraud",
  "customer_request",
  "service_failure",
  "other",
] as const;
export type RefundReason = (typeof REFUND_REASONS)[number];

export const REFUND_STATUSES = ["pending", "approved", "rejected", "paid"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const REASON_LABELS: Record<RefundReason, string> = {
  duplicate: "Duplicate",
  fraud: "Fraud",
  customer_request: "Customer request",
  service_failure: "Service failure",
  other: "Other",
};

export const STATUS_LABELS: Record<RefundStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

export const APPROVAL_STATUS_LABELS: Record<"pending" | "approved" | "rejected", string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export const ACTION_LABELS: Record<string, string> = {
  "refund_request.created": "Requested",
  "refund_request.approved": "Approved",
  "refund_request.rejected": "Rejected",
  "refund_request.paid": "Paid",
  "approval_request.created": "Approval requested",
  "approval_request.decided": "Approval decided",
};

/** Matches numeric(14,2): up to 12 integer digits and 2 decimals. */
export const AMOUNT_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;

/** Integer cents, so threshold comparisons never touch floating point. */
export function toCents(amount: string): number {
  const [whole, fraction = ""] = amount.trim().split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
}

export function needsApprover(amount: string): boolean {
  return toCents(amount) >= toCents(REFUND_THRESHOLD);
}

export function canDecide(role: Role, amount: string): boolean {
  return hasRole(role, needsApprover(amount) ? "approver" : "analyst");
}

export function isFinal(status: RefundStatus): boolean {
  return status === "rejected" || status === "paid";
}

export function canMarkPaid(role: Role, status: RefundStatus): boolean {
  return hasRole(role, "approver") && status === "approved";
}

export function secondApproverError(
  reason: Extract<SecondApproverCheck, { ok: false }>["reason"],
): string {
  switch (reason) {
    case "self-approval":
      return "You requested this refund, so a different approver must decide it.";
    case "already-decided":
      return "The approval request for this refund has already been decided.";
    case "no-request":
      return "This refund has no approval request to decide.";
  }
}

export function formatMoney(amount: string | number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    Number(amount),
  );
}
