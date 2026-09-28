import { and, eq, inArray, like, or } from "drizzle-orm";

import { approvalRequests, auditLog, refundRequests, users } from "../schema";
import {
  APPROVAL_ENTITY,
  REFUND_ENTITY,
  REFUND_REASONS,
  needsApprover,
  type RefundReason,
  type RefundStatus,
} from "../../modules/refunds/rules";
import { SEED_EMAIL_DOMAIN } from "./users";
import type { SeedContext, SeedModule } from "./types";

export const SEED_ORDER_PREFIX = "SEED-ORD-";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const SEED_REFUND_BUCKETS = {
  pendingAbove: 10,
  pendingBelow: 15,
  paid: 30,
  approved: 10,
  rejected: 15,
} as const;

const CUSTOMERS = [
  "Olivia Grant",
  "Mohammed Aziz",
  "Sara Lindholm",
  "Kwame Mensah",
  "Lena Hoffmann",
  "Ravi Shankar",
  "Maya Cohen",
  "Tobias Berg",
  "Ana Souza",
  "Liam O'Connor",
  "Yuki Tanaka",
  "Paula Jiménez",
  "Ethan Brooks",
  "Noor Hassan",
  "Eva Novak",
  "Jin Park",
] as const;

const REJECTION_NOTES = [
  "Order was already refunded through the payment provider.",
  "Outside the refund window in the terms of service.",
  "Chargeback already filed; refund would double-pay.",
  "Customer confirmed the service was delivered.",
];

export type RefundSeedFixture = {
  orderRef: string;
  customerName: string;
  customerEmail: string;
  amount: string;
  currency: string;
  reason: RefundReason;
  note: string | null;
  status: RefundStatus;
  requestedBy: string;
  requestedAt: Date;
  decidedBy: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  paidBy: string | null;
  paidAt: Date | null;
};

function money(cents: number) {
  return (cents / 100).toFixed(2);
}

/** Deterministic amounts: 500.00–4,800.00 above threshold, 12.00–499.99 below. */
function amountFor(index: number, above: boolean) {
  if (above) {
    if (index === 0) return "4800.00";
    return money(50_000 + ((index * 73_331) % 430_000));
  }
  if (index === 10) return "12.00";
  return money(1_200 + ((index * 9_973) % 48_799));
}

function slug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]+/g, ".")
    .replace(/^\.|\.$/g, "")
    .toLowerCase();
}

function pick<T>(list: readonly T[], index: number): T {
  return list[index % list.length];
}

function statusFor(index: number): { status: RefundStatus; above: boolean } {
  const b = SEED_REFUND_BUCKETS;
  let offset = index;
  if (offset < b.pendingAbove) return { status: "pending", above: true };
  offset -= b.pendingAbove;
  if (offset < b.pendingBelow) return { status: "pending", above: false };
  offset -= b.pendingBelow;
  // Decided refunds alternate so both paths appear in every final status.
  const above = index % 3 === 0;
  if (offset < b.paid) return { status: "paid", above };
  offset -= b.paid;
  if (offset < b.approved) return { status: "approved", above };
  return { status: "rejected", above };
}

export const SEED_REFUND_COUNT = Object.values(SEED_REFUND_BUCKETS).reduce(
  (sum, value) => sum + value,
  0,
);

/**
 * Builds the refund history from seeded user ids. `deciders` must hold
 * approvers or admins; requesters of above-threshold refunds are never their
 * own approver.
 */
export function refundSeedFixtures(
  pools: { requesters: string[]; deciders: string[] },
  now = Date.now(),
): RefundSeedFixture[] {
  const { requesters, deciders } = pools;
  if (!requesters.length || deciders.length < 2) return [];

  return Array.from({ length: SEED_REFUND_COUNT }, (_, index) => {
    const { status, above } = statusFor(index);
    const customer = pick(CUSTOMERS, index * 7 + 3);
    const requestedBy = pick(requesters, index * 5 + 1);

    let decider = pick(deciders, index * 3);
    if (decider === requestedBy) decider = pick(deciders, index * 3 + 1);
    const belowDecider = pick(requesters, index * 5 + 2);

    const requestedAt =
      status === "pending"
        ? new Date(now - ((index * 11) % 21) * DAY_MS - ((index * 7) % 23) * HOUR_MS)
        : new Date(now - (7 + ((index * 7) % 83)) * DAY_MS - ((index * 5) % 23) * HOUR_MS);
    const decidedAt =
      status === "pending"
        ? null
        : new Date(requestedAt.getTime() + (2 + ((index * 13) % 70)) * HOUR_MS);
    const paidAt =
      status === "paid" && decidedAt
        ? new Date(decidedAt.getTime() + (1 + (index % 3)) * DAY_MS)
        : null;

    return {
      orderRef: `${SEED_ORDER_PREFIX}${10_000 + index}`,
      customerName: customer,
      customerEmail: `${slug(customer)}@${SEED_EMAIL_DOMAIN}`,
      amount: amountFor(index, above),
      currency: "USD",
      reason: pick(REFUND_REASONS, index * 3 + 1),
      note: index % 4 === 0 ? "Customer contacted support by email." : null,
      status,
      requestedBy,
      requestedAt,
      decidedBy: decidedAt ? (above ? decider : belowDecider) : null,
      decidedAt,
      decisionNote:
        status === "rejected" ? pick(REJECTION_NOTES, index) : null,
      paidBy: paidAt ? pick(deciders, index + 1) : null,
      paidAt,
    };
  });
}

async function seededRefundIds(db: SeedContext["db"]) {
  const rows = await db
    .select({ id: refundRequests.id })
    .from(refundRequests)
    .where(like(refundRequests.orderRef, `${SEED_ORDER_PREFIX}%`));
  return rows.map((row) => row.id);
}

async function deleteSeededRefunds(db: SeedContext["db"]) {
  const ids = await seededRefundIds(db);
  if (!ids.length) return 0;

  await db.transaction(async (tx) => {
    const approvals = await tx
      .select({ id: approvalRequests.id })
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.entity, REFUND_ENTITY),
          inArray(approvalRequests.entityId, ids),
        ),
      );
    const approvalIds = approvals.map((row) => row.id);

    const refundAudit = and(
      eq(auditLog.entity, REFUND_ENTITY),
      inArray(auditLog.entityId, ids),
    );
    await tx
      .delete(auditLog)
      .where(
        approvalIds.length
          ? or(
              refundAudit,
              and(
                eq(auditLog.entity, APPROVAL_ENTITY),
                inArray(auditLog.entityId, approvalIds),
              ),
            )
          : refundAudit,
      );
    if (approvalIds.length) {
      await tx
        .delete(approvalRequests)
        .where(inArray(approvalRequests.id, approvalIds));
    }
    await tx.delete(refundRequests).where(inArray(refundRequests.id, ids));
  });
  return ids.length;
}

/**
 * Runs before the users seed: seeded refunds reference seeded users through
 * restrict foreign keys, so they have to go before users are replaced.
 */
export const resetRefunds: SeedModule = {
  name: "refunds:reset",
  async run({ db, reset }: SeedContext) {
    if (!reset) return "skipped";
    return `${await deleteSeededRefunds(db)} refunds removed`;
  },
};

export const seedRefunds: SeedModule = {
  name: "refunds",
  async run({ db }: SeedContext) {
    const existing = await seededRefundIds(db);
    if (existing.length) return `${existing.length} refunds already seeded`;

    const seeded = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(like(users.email, `%@${SEED_EMAIL_DOMAIN}`));
    const sorted = [...seeded].sort((a, b) =>
      (a.email ?? "").localeCompare(b.email ?? ""),
    );
    const fixtures = refundSeedFixtures({
      requesters: sorted.map((user) => user.id),
      deciders: sorted
        .filter((user) => user.role === "approver" || user.role === "admin")
        .map((user) => user.id),
    });
    if (!fixtures.length) return "no seeded users, skipped";

    let auditCount = 0;
    let approvalCount = 0;

    await db.transaction(async (tx) => {
      for (const fixture of fixtures) {
        const { paidBy, ...values } = fixture;
        const [refund] = await tx.insert(refundRequests).values(values).returning();

        const audit: (typeof auditLog.$inferInsert)[] = [
          {
            actorId: refund.requestedBy,
            action: `${REFUND_ENTITY}.created`,
            entity: REFUND_ENTITY,
            entityId: refund.id,
            after: { status: "pending", amount: refund.amount, currency: refund.currency },
            createdAt: refund.requestedAt,
          },
        ];

        if (needsApprover(refund.amount)) {
          const approvalStatus =
            refund.status === "pending"
              ? "pending"
              : refund.status === "rejected"
                ? "rejected"
                : "approved";
          const [approval] = await tx
            .insert(approvalRequests)
            .values({
              entity: REFUND_ENTITY,
              entityId: refund.id,
              requestedBy: refund.requestedBy,
              approvedBy: refund.decidedBy,
              status: approvalStatus,
              threshold: refund.amount,
              createdAt: refund.requestedAt,
              decidedAt: refund.decidedAt,
            })
            .returning();
          approvalCount += 1;

          audit.push({
            actorId: refund.requestedBy,
            action: `${APPROVAL_ENTITY}.created`,
            entity: APPROVAL_ENTITY,
            entityId: approval.id,
            after: { status: "pending", threshold: approval.threshold },
            createdAt: refund.requestedAt,
          });
          if (refund.decidedAt) {
            audit.push({
              actorId: refund.decidedBy,
              action: `${APPROVAL_ENTITY}.decided`,
              entity: APPROVAL_ENTITY,
              entityId: approval.id,
              before: { status: "pending" },
              after: { status: approvalStatus, approvedBy: refund.decidedBy },
              createdAt: refund.decidedAt,
            });
          }
        }

        if (refund.decidedAt) {
          const decided = refund.status === "rejected" ? "rejected" : "approved";
          audit.push({
            actorId: refund.decidedBy,
            action: `${REFUND_ENTITY}.${decided}`,
            entity: REFUND_ENTITY,
            entityId: refund.id,
            before: { status: "pending" },
            after: { status: decided, decisionNote: refund.decisionNote },
            createdAt: refund.decidedAt,
          });
        }
        if (refund.paidAt) {
          audit.push({
            actorId: paidBy,
            action: `${REFUND_ENTITY}.paid`,
            entity: REFUND_ENTITY,
            entityId: refund.id,
            before: { status: "approved" },
            after: { status: "paid" },
            createdAt: refund.paidAt,
          });
        }

        await tx.insert(auditLog).values(audit);
        auditCount += audit.length;
      }
    });

    return `${fixtures.length} refunds, ${approvalCount} approval requests, ${auditCount} audit rows`;
  },
};
