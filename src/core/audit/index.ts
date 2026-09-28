import { auditLog } from "@/db/schema";
import type { Transaction } from "@/db";

export type AuditEntry = {
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

/**
 * Writes an audit row inside the caller's transaction, so a mutation and its
 * audit trail either both land or both roll back.
 */
export async function withAudit(tx: Transaction, entry: AuditEntry) {
  const [row] = await tx
    .insert(auditLog)
    .values({
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      before: entry.before ?? null,
      after: entry.after ?? null,
    })
    .returning();
  return row;
}
