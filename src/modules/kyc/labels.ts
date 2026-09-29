import type { KycDocument } from "./schema";

export const ACTION_LABELS: Record<string, string> = {
  "kyc_case.claimed": "Claimed",
  "kyc_case.approved": "Approved",
  "kyc_case.rejected": "Rejected",
  "kyc_case.escalated": "Escalated",
  "kyc_case.reassigned": "Reassigned",
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  passport: "Passport",
  national_id: "National ID",
  drivers_license: "Driver's license",
  proof_of_address: "Proof of address",
};

export const DOCUMENT_STATUS_LABELS: Record<KycDocument["status"], string> = {
  pending: "Pending",
  verified: "Verified",
  rejected: "Rejected",
};
