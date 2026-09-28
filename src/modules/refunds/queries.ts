import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { approvalRequests, auditLog, users } from "@/db/schema";
import { clampPage, type DataTableQuery } from "@/core/data-table";
import { refundRequests } from "./schema";
import {
  APPROVAL_ENTITY,
  REFUND_ENTITY,
  REFUND_REASONS,
  REFUND_STATUSES,
  REFUND_THRESHOLD,
  type RefundReason,
  type RefundStatus,
} from "./rules";

export const REFUND_SORTABLE = {
  requestedAt: refundRequests.requestedAt,
  amount: refundRequests.amount,
  status: refundRequests.status,
} as const;

export const REFUND_FILTERS = ["status", "reason", "threshold"] as const;

export const THRESHOLD_FILTERS = ["above", "below"] as const;

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

function refundWhere(query: DataTableQuery): SQL | undefined {
  const conditions: SQL[] = [];
  if (query.search) {
    const pattern = `%${query.search}%`;
    const match = or(
      ilike(refundRequests.orderRef, pattern),
      ilike(refundRequests.customerName, pattern),
      ilike(refundRequests.customerEmail, pattern),
    );
    if (match) conditions.push(match);
  }
  const { status, reason, threshold } = query.filters;
  if (isOneOf(REFUND_STATUSES, status)) {
    conditions.push(eq(refundRequests.status, status));
  }
  if (isOneOf(REFUND_REASONS, reason)) {
    conditions.push(eq(refundRequests.reason, reason));
  }
  if (threshold === "above") {
    conditions.push(gte(refundRequests.amount, REFUND_THRESHOLD));
  } else if (threshold === "below") {
    conditions.push(lt(refundRequests.amount, REFUND_THRESHOLD));
  }
  return conditions.length ? and(...conditions) : undefined;
}

export type RefundListRow = {
  id: string;
  orderRef: string;
  customerName: string;
  customerEmail: string;
  amount: string;
  currency: string;
  reason: RefundReason;
  status: RefundStatus;
  requestedAt: Date;
  requesterName: string | null;
};

export async function listRefunds(
  requested: DataTableQuery,
): Promise<{ rows: RefundListRow[]; total: number; query: DataTableQuery }> {
  const where = refundWhere(requested);
  const sortColumn = requested.sort
    ? REFUND_SORTABLE[requested.sort as keyof typeof REFUND_SORTABLE]
    : refundRequests.requestedAt;
  const direction = requested.order === "asc" ? asc : desc;

  const [totals] = await db
    .select({ value: count() })
    .from(refundRequests)
    .where(where);
  const total = totals.value;
  const query = clampPage(requested, total);

  const rows = await db
    .select({
      id: refundRequests.id,
      orderRef: refundRequests.orderRef,
      customerName: refundRequests.customerName,
      customerEmail: refundRequests.customerEmail,
      amount: refundRequests.amount,
      currency: refundRequests.currency,
      reason: refundRequests.reason,
      status: refundRequests.status,
      requestedAt: refundRequests.requestedAt,
      requesterName: users.name,
    })
    .from(refundRequests)
    .leftJoin(users, eq(users.id, refundRequests.requestedBy))
    .where(where)
    .orderBy(direction(sortColumn), desc(refundRequests.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  return { rows, total, query };
}

export type RefundStats = {
  pendingCount: number;
  pendingTotal: string;
  approvedUnpaidTotal: string;
  avgHoursToDecision: number | null;
};

export async function refundStats(now = new Date()): Promise<RefundStats> {
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({
      pendingCount: sql<number>`count(*) filter (where ${refundRequests.status} = 'pending')`.mapWith(Number),
      pendingTotal: sql<string>`coalesce(sum(${refundRequests.amount}) filter (where ${refundRequests.status} = 'pending'), 0)::text`,
      approvedUnpaidTotal: sql<string>`coalesce(sum(${refundRequests.amount}) filter (where ${refundRequests.status} = 'approved'), 0)::text`,
      avgHoursToDecision: sql<string | null>`avg(extract(epoch from (${refundRequests.decidedAt} - ${refundRequests.requestedAt})) / 3600) filter (where ${refundRequests.decidedAt} >= ${since.toISOString()})`,
    })
    .from(refundRequests);

  return {
    pendingCount: row.pendingCount,
    pendingTotal: row.pendingTotal,
    approvedUnpaidTotal: row.approvedUnpaidTotal,
    avgHoursToDecision:
      row.avgHoursToDecision === null ? null : Number(row.avgHoursToDecision),
  };
}

const requester = alias(users, "requester");
const decider = alias(users, "decider");

export async function getRefund(id: string) {
  const [row] = await db
    .select({
      refund: refundRequests,
      requesterName: requester.name,
      requesterEmail: requester.email,
      deciderName: decider.name,
      deciderEmail: decider.email,
    })
    .from(refundRequests)
    .leftJoin(requester, eq(requester.id, refundRequests.requestedBy))
    .leftJoin(decider, eq(decider.id, refundRequests.decidedBy))
    .where(eq(refundRequests.id, id));
  if (!row) return null;

  const approver = alias(users, "approver");
  const [approval] = await db
    .select({ request: approvalRequests, approverName: approver.name })
    .from(approvalRequests)
    .leftJoin(approver, eq(approver.id, approvalRequests.approvedBy))
    .where(
      and(
        eq(approvalRequests.entity, REFUND_ENTITY),
        eq(approvalRequests.entityId, id),
      ),
    )
    .orderBy(desc(approvalRequests.createdAt))
    .limit(1);

  return { ...row, approval: approval ?? null };
}

export type RefundDetail = NonNullable<Awaited<ReturnType<typeof getRefund>>>;

/** Audit trail for a refund and its approval request, newest first. */
export async function refundAuditTrail(refundId: string, approvalId?: string) {
  const targets = [
    and(eq(auditLog.entity, REFUND_ENTITY), eq(auditLog.entityId, refundId)),
  ];
  if (approvalId) {
    targets.push(
      and(
        eq(auditLog.entity, APPROVAL_ENTITY),
        eq(auditLog.entityId, approvalId),
      ),
    );
  }

  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entity: auditLog.entity,
      before: auditLog.before,
      after: auditLog.after,
      createdAt: auditLog.createdAt,
      actorName: users.name,
      actorEmail: users.email,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .where(or(...targets))
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id));
}
