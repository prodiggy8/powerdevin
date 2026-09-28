import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Relative so drizzle-kit and tsx resolve it without the tsconfig alias.
import { users } from "../../db/schema/auth";

export const kycStatusEnum = pgEnum("kyc_status", [
  "pending",
  "in_review",
  "approved",
  "rejected",
  "escalated",
]);

/** Stub for the document store: the file itself lives outside the database. */
export type KycDocument = {
  type: string;
  fileName: string;
  status: "pending" | "verified" | "rejected";
};

export const kycCases = pgTable(
  "kyc_cases",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    country: text("country").notNull(),
    riskScore: integer("risk_score").notNull(),
    status: kycStatusEnum("status").notNull().default("pending"),
    assignedTo: text("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: text("decided_by").references(() => users.id, {
      onDelete: "set null",
    }),
    decisionReason: text("decision_reason"),
    documents: jsonb("documents")
      .$type<KycDocument[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
  },
  (table) => [
    index("kyc_cases_status_idx").on(table.status),
    index("kyc_cases_submitted_at_idx").on(table.submittedAt),
    index("kyc_cases_assigned_to_idx").on(table.assignedTo),
  ],
);

export type KycCase = typeof kycCases.$inferSelect;
export type NewKycCase = typeof kycCases.$inferInsert;
export type KycStatus = KycCase["status"];
