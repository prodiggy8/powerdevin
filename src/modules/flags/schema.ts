import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { users } from "../../db/schema/auth";

export const flagEnvironmentEnum = pgEnum("flag_environment", [
  "dev",
  "staging",
  "prod",
]);

export const featureFlags = pgTable(
  "feature_flags",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    key: text("key").notNull().unique(),
    description: text("description").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("feature_flags_owner_idx").on(table.ownerId)],
);

export const featureFlagStates = pgTable(
  "feature_flag_states",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    flagId: text("flag_id")
      .notNull()
      .references(() => featureFlags.id, { onDelete: "cascade" }),
    environment: flagEnvironmentEnum("environment").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    rolloutPercent: integer("rollout_percent").notNull().default(0),
    updatedBy: text("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("feature_flag_states_flag_environment_key").on(
      table.flagId,
      table.environment,
    ),
  ],
);

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type FeatureFlagState = typeof featureFlagStates.$inferSelect;
export type FlagEnvironment = (typeof flagEnvironmentEnum.enumValues)[number];
