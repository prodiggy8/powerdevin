import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { approvalRequests } from "@/db/schema";

export { approvalRequests, approvalStatusEnum } from "@/db/schema";

export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type NewApprovalRequest = typeof approvalRequests.$inferInsert;

export type SecondApproverCheck =
  | { ok: true }
  | { ok: false; reason: "no-request" | "self-approval" | "already-decided" };

/**
 * Stub: enforces that the approver of a pending request is not its requester.
 * Threshold-based routing and multi-step chains land with the approvals UI.
 */
export async function requireSecondApprover(
  entity: string,
  entityId: string,
  approverId: string,
): Promise<SecondApproverCheck> {
  const request = await db.query.approvalRequests.findFirst({
    where: and(
      eq(approvalRequests.entity, entity),
      eq(approvalRequests.entityId, entityId),
    ),
  });

  if (!request) return { ok: false, reason: "no-request" };
  if (request.status !== "pending") return { ok: false, reason: "already-decided" };
  if (request.requestedBy === approverId) return { ok: false, reason: "self-approval" };
  return { ok: true };
}
