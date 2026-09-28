import { inArray, like } from "drizzle-orm";

import { auditLog, kycCases, users } from "../schema";
import type { KycDocument, KycStatus, NewKycCase } from "../../modules/kyc/schema";
import { SEED_EMAIL_DOMAIN } from "./users";
import type { SeedContext, SeedModule } from "./types";

export const SEED_CASE_ID_PREFIX = "seed-kyc-";
export const SEED_CASE_AUDIT_ID_PREFIX = "seed-kyc-audit-";

const COUNTRIES = ["DE", "BR", "NG", "IN", "GB", "SE", "JP", "MX"] as const;

const CUSTOMERS = [
  "Aurora Lindgren",
  "Bilal Karam",
  "Camila Duarte",
  "Dmitri Volkov",
  "Esther Nwosu",
  "Farid Haidari",
  "Greta Sandberg",
  "Hiroshi Tanabe",
  "Imani Otieno",
  "Jonas Beckmann",
  "Kavya Srinivasan",
  "Lorenzo Ricci",
  "Maja Nowak",
  "Nils Andersen",
  "Oyelaran Adebayo",
  "Paloma Estévez",
  "Qadir Rahimi",
  "Rosa Martín",
  "Stefan Horvath",
  "Tara Mullins",
] as const;

/** 30 pending, 12 in review, 10 approved, 5 rejected, 3 escalated. */
const STATUS_PLAN: { status: KycStatus; count: number }[] = [
  { status: "pending", count: 30 },
  { status: "in_review", count: 12 },
  { status: "approved", count: 10 },
  { status: "rejected", count: 5 },
  { status: "escalated", count: 3 },
];

export const SEED_CASE_COUNT = STATUS_PLAN.reduce(
  (total, entry) => total + entry.count,
  0,
);

const DAY_MS = 24 * 60 * 60 * 1000;

const DECISION_REASONS: Record<string, string> = {
  approved: "Documents verified against the register; no adverse media found.",
  rejected: "Identity document expired and the selfie check did not match.",
  escalated: "Politically exposed person match needs an approver's review.",
};

const DECISION_ACTION: Record<string, string> = {
  approved: "kyc_case.approved",
  rejected: "kyc_case.rejected",
  escalated: "kyc_case.escalated",
};

/** Deterministic so re-seeding neither reshuffles nor duplicates the queue. */
function riskScoreFor(index: number): number {
  const band = index % 3;
  if (band === 0) return (index * 7) % 40; // low
  if (band === 1) return 40 + ((index * 11) % 30); // medium
  return 70 + ((index * 13) % 31); // high
}

function documentsFor(index: number): KycDocument[] {
  const passport: KycDocument = {
    type: "passport",
    fileName: `passport-${String(index + 1).padStart(3, "0")}.pdf`,
    status: index % 4 === 0 ? "pending" : "verified",
  };
  const proofOfAddress: KycDocument = {
    type: "proof_of_address",
    fileName: `utility-bill-${String(index + 1).padStart(3, "0")}.pdf`,
    status: index % 5 === 0 ? "rejected" : "verified",
  };
  return index % 7 === 0 ? [passport] : [passport, proofOfAddress];
}

function statusFor(index: number): KycStatus {
  let cursor = index;
  for (const entry of STATUS_PLAN) {
    if (cursor < entry.count) return entry.status;
    cursor -= entry.count;
  }
  return "pending";
}

function caseId(index: number) {
  return `${SEED_CASE_ID_PREFIX}${String(index + 1).padStart(2, "0")}`;
}

export type SeedCaseFixture = NewKycCase & {
  id: string;
  /** Index into the seeded users, resolved once their ids are known. */
  reviewerIndex: number | null;
};

export function seedCaseFixtures(now = Date.now()): SeedCaseFixture[] {
  return Array.from({ length: SEED_CASE_COUNT }, (_, index) => {
    const status = statusFor(index);
    const decided = status !== "pending" && status !== "in_review";
    const submittedAt = new Date(
      now - (89 - Math.floor((index * 89) / SEED_CASE_COUNT)) * DAY_MS,
    );
    const name = CUSTOMERS[index % CUSTOMERS.length];
    const slug = name.toLowerCase().replace(/[^a-z]+/g, ".");

    return {
      id: caseId(index),
      customerName: name,
      customerEmail: `${slug}.${index + 1}@${SEED_EMAIL_DOMAIN}`,
      country: COUNTRIES[index % COUNTRIES.length],
      riskScore: riskScoreFor(index),
      status,
      submittedAt,
      decidedAt: decided ? new Date(submittedAt.getTime() + 2 * DAY_MS) : null,
      decisionReason: decided ? DECISION_REASONS[status] : null,
      documents: documentsFor(index),
      reviewerIndex: status === "pending" ? null : index,
    };
  });
}

export const seedKyc: SeedModule = {
  name: "kyc",
  async run({ db, reset }: SeedContext) {
    if (reset) {
      const ids = seedCaseFixtures().map((row) => row.id);
      await db.delete(auditLog).where(inArray(auditLog.entityId, ids));
      await db.delete(kycCases).where(inArray(kycCases.id, ids));
    }

    const reviewers = await db
      .select({ id: users.id })
      .from(users)
      .where(like(users.email, `%@${SEED_EMAIL_DOMAIN}`))
      .orderBy(users.email);

    if (reviewers.length === 0) {
      return "0 cases (no seeded users to assign)";
    }

    const fixtures = seedCaseFixtures();
    const auditRows: (typeof auditLog.$inferInsert)[] = [];

    for (const [index, fixture] of fixtures.entries()) {
      const { reviewerIndex, ...row } = fixture;
      const reviewer =
        reviewerIndex === null
          ? null
          : reviewers[reviewerIndex % reviewers.length].id;
      const decided = row.decidedAt !== null;

      const values = {
        ...row,
        assignedTo: row.status === "escalated" ? null : reviewer,
        decidedBy: decided ? reviewer : null,
      };

      await db
        .insert(kycCases)
        .values(values)
        .onConflictDoUpdate({ target: kycCases.id, set: values });

      if (decided && reviewer) {
        auditRows.push({
          id: `${SEED_CASE_AUDIT_ID_PREFIX}${String(index + 1).padStart(2, "0")}`,
          actorId: reviewer,
          action: DECISION_ACTION[row.status as string],
          entity: "kyc_case",
          entityId: row.id,
          before: { status: "in_review" },
          after: { status: row.status, decisionReason: row.decisionReason },
          createdAt: row.decidedAt as Date,
        });
      }
    }

    for (const row of auditRows) {
      await db.insert(auditLog).values(row).onConflictDoNothing();
    }

    return `${fixtures.length} cases, ${auditRows.length} audit rows`;
  },
};
