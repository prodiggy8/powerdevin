import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import { auditLog, users } from "@/db/schema";
import type { DataTableQuery } from "@/core/data-table";
import { isRiskBand, riskBandRange } from "./policy";
import { kycCases, kycStatusEnum, type KycCase } from "./schema";

export const KYC_ENTITY = "kyc_case";

const SORTABLE = {
  submittedAt: kycCases.submittedAt,
  riskScore: kycCases.riskScore,
  status: kycCases.status,
  country: kycCases.country,
} as const;

export const SORTABLE_COLUMNS = Object.keys(SORTABLE);
export const FILTER_COLUMNS = ["status", "risk", "country"];

export type KycCaseRow = {
  id: string;
  customerName: string;
  customerEmail: string;
  country: string;
  riskScore: number;
  status: KycCase["status"];
  assignee: string | null;
  submittedAt: Date;
};

function isKycStatus(value: unknown): value is KycCase["status"] {
  return (
    typeof value === "string" &&
    (kycStatusEnum.enumValues as readonly string[]).includes(value)
  );
}

function whereFor(query: DataTableQuery): SQL | undefined {
  const conditions: SQL[] = [];

  if (query.search) {
    const pattern = `%${query.search}%`;
    const match = or(
      ilike(kycCases.customerName, pattern),
      ilike(kycCases.customerEmail, pattern),
    );
    if (match) conditions.push(match);
  }
  if (isKycStatus(query.filters.status)) {
    conditions.push(eq(kycCases.status, query.filters.status));
  }
  if (isRiskBand(query.filters.risk)) {
    const { min, max } = riskBandRange(query.filters.risk);
    conditions.push(gte(kycCases.riskScore, min), lte(kycCases.riskScore, max));
  }
  if (query.filters.country) {
    conditions.push(eq(kycCases.country, query.filters.country.toUpperCase()));
  }

  return conditions.length ? and(...conditions) : undefined;
}

export async function countKycCases(query: DataTableQuery): Promise<number> {
  const [totals] = await db
    .select({ value: count() })
    .from(kycCases)
    .where(whereFor(query));
  return totals.value;
}

/** Oldest pending first by default: the queue is worked from the top. */
export async function listKycCases(
  query: DataTableQuery,
): Promise<{ rows: KycCaseRow[]; total: number }> {
  const where = whereFor(query);
  const [totals] = await db
    .select({ value: count() })
    .from(kycCases)
    .where(where);

  const orderBy = query.sort
    ? [
        query.order === "asc"
          ? asc(SORTABLE[query.sort as keyof typeof SORTABLE])
          : desc(SORTABLE[query.sort as keyof typeof SORTABLE]),
      ]
    : [asc(kycCases.status), asc(kycCases.submittedAt)];

  const rows = await db
    .select({
      id: kycCases.id,
      customerName: kycCases.customerName,
      customerEmail: kycCases.customerEmail,
      country: kycCases.country,
      riskScore: kycCases.riskScore,
      status: kycCases.status,
      assignee: users.name,
      submittedAt: kycCases.submittedAt,
    })
    .from(kycCases)
    .leftJoin(users, eq(users.id, kycCases.assignedTo))
    .where(where)
    .orderBy(...orderBy)
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  return { rows, total: totals.value };
}

export async function getKycCase(id: string) {
  const row = await db.query.kycCases.findFirst({
    where: eq(kycCases.id, id),
  });
  if (!row) return null;

  const [assignee, decider] = await Promise.all([
    row.assignedTo ? findUser(row.assignedTo) : null,
    row.decidedBy ? findUser(row.decidedBy) : null,
  ]);

  return { ...row, assignee, decider };
}

async function findUser(id: string) {
  const row = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: { id: true, name: true, email: true },
  });
  return row ?? null;
}

export async function listCountries(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ country: kycCases.country })
    .from(kycCases)
    .orderBy(asc(kycCases.country));
  return rows.map((row) => row.country);
}

/** Everyone can review, so any user is a valid assignee. */
export async function listReviewers() {
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.disabled, false))
    .orderBy(asc(users.name));
}

export type AuditEntry = {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: Date;
  before: unknown;
  after: unknown;
};

/** Audit trail for one case, newest first. */
export async function listCaseAudit(caseId: string): Promise<AuditEntry[]> {
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      actorName: users.name,
      createdAt: auditLog.createdAt,
      before: auditLog.before,
      after: auditLog.after,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .where(
      and(eq(auditLog.entity, KYC_ENTITY), eq(auditLog.entityId, caseId)),
    )
    .orderBy(desc(auditLog.createdAt));
}
