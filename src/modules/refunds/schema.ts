import {
  char,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "../../db/schema/auth";

export const refundReasonEnum = pgEnum("refund_reason", [
  "duplicate",
  "fraud",
  "customer_request",
  "service_failure",
  "other",
]);

export const refundStatusEnum = pgEnum("refund_status", [
  "pending",
  "approved",
  "rejected",
  "paid",
]);

export const refundRequests = pgTable(
  "refund_requests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orderRef: text("order_ref").notNull(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    reason: refundReasonEnum("reason").notNull(),
    note: text("note"),
    status: refundStatusEnum("status").notNull().default("pending"),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    decidedBy: text("decided_by").references(() => users.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (table) => [
    index("refund_requests_status_idx").on(table.status),
    index("refund_requests_requested_at_idx").on(table.requestedAt),
  ],
);
