import {
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
]);

export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    approvedBy: text("approved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    status: approvalStatusEnum("status").notNull().default("pending"),
    threshold: numeric("threshold", { precision: 14, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (table) => [
    index("approval_requests_entity_idx").on(table.entity, table.entityId),
    index("approval_requests_status_idx").on(table.status),
  ],
);
