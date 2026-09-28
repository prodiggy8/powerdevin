import { and, asc, count, desc, eq, exists, ilike, inArray, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { auditLog, users } from "@/db/schema";
import type { DataTableQuery } from "@/core/data-table";
import { featureFlags, featureFlagStates, type FlagEnvironment } from "./schema";
import { isFlagEnvironment } from "./policy";

export const FLAG_SORTABLE_COLUMNS = ["key", "owner", "createdAt"] as const;
export const FLAG_FILTER_COLUMNS = ["enabledIn", "owner", "archived"] as const;

const SORT_COLUMNS = {
  key: featureFlags.key,
  owner: users.name,
  createdAt: featureFlags.createdAt,
} as const;

export type FlagStateSummary = {
  environment: FlagEnvironment;
  enabled: boolean;
  rolloutPercent: number;
  updatedAt: string;
};

export type FlagListRow = {
  id: string;
  key: string;
  description: string;
  archived: boolean;
  createdAt: string;
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  states: FlagStateSummary[];
};

function buildWhere(query: DataTableQuery): SQL | undefined {
  const conditions: SQL[] = [];

  if (query.search) {
    const pattern = `%${query.search}%`;
    const match = or(
      ilike(featureFlags.key, pattern),
      ilike(featureFlags.description, pattern),
    );
    if (match) conditions.push(match);
  }

  const enabledIn = query.filters.enabledIn;
  if (isFlagEnvironment(enabledIn)) {
    conditions.push(
      exists(
        db
          .select({ one: featureFlagStates.id })
          .from(featureFlagStates)
          .where(
            and(
              eq(featureFlagStates.flagId, featureFlags.id),
              eq(featureFlagStates.environment, enabledIn),
              eq(featureFlagStates.enabled, true),
            ),
          ),
      ),
    );
  }

  const owner = query.filters.owner;
  if (owner) conditions.push(eq(featureFlags.ownerId, owner));

  const archived = query.filters.archived;
  if (archived === "true" || archived === "false") {
    conditions.push(eq(featureFlags.archived, archived === "true"));
  }

  return conditions.length ? and(...conditions) : undefined;
}

/** Page of flags with their owner and one state summary per environment. */
export async function listFlags(
  query: DataTableQuery,
): Promise<{ rows: FlagListRow[]; total: number }> {
  const where = buildWhere(query);

  const [totals] = await db
    .select({ value: count() })
    .from(featureFlags)
    .leftJoin(users, eq(users.id, featureFlags.ownerId))
    .where(where);
  const total = totals.value;

  const sortColumn = query.sort
    ? SORT_COLUMNS[query.sort as keyof typeof SORT_COLUMNS]
    : featureFlags.createdAt;
  const orderBy = query.order === "asc" ? asc(sortColumn) : desc(sortColumn);

  const flags = await db
    .select({
      id: featureFlags.id,
      key: featureFlags.key,
      description: featureFlags.description,
      archived: featureFlags.archived,
      createdAt: featureFlags.createdAt,
      ownerId: featureFlags.ownerId,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(featureFlags)
    .leftJoin(users, eq(users.id, featureFlags.ownerId))
    .where(where)
    .orderBy(orderBy)
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  const states = flags.length
    ? await db
        .select()
        .from(featureFlagStates)
        .where(
          inArray(
            featureFlagStates.flagId,
            flags.map((flag) => flag.id),
          ),
        )
    : [];

  const rows: FlagListRow[] = flags.map((flag) => ({
    ...flag,
    createdAt: flag.createdAt.toISOString(),
    states: states
      .filter((state) => state.flagId === flag.id)
      .map((state) => ({
        environment: state.environment,
        enabled: state.enabled,
        rolloutPercent: state.rolloutPercent,
        updatedAt: state.updatedAt.toISOString(),
      })),
  }));

  return { rows, total };
}

/** Every flag with its states, for the board view which has no pagination. */
export async function listAllFlags(): Promise<FlagListRow[]> {
  const { rows } = await listFlags({
    page: 1,
    pageSize: 500,
    search: "",
    sort: "key",
    order: "asc",
    filters: {},
  });
  return rows;
}

export type FlagDetail = {
  id: string;
  key: string;
  description: string;
  archived: boolean;
  createdAt: string;
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  states: {
    id: string;
    environment: FlagEnvironment;
    enabled: boolean;
    rolloutPercent: number;
    updatedAt: string;
    updatedByName: string | null;
    updatedByEmail: string | null;
  }[];
};

export async function getFlag(flagId: string): Promise<FlagDetail | null> {
  const [flag] = await db
    .select({
      id: featureFlags.id,
      key: featureFlags.key,
      description: featureFlags.description,
      archived: featureFlags.archived,
      createdAt: featureFlags.createdAt,
      ownerId: featureFlags.ownerId,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(featureFlags)
    .leftJoin(users, eq(users.id, featureFlags.ownerId))
    .where(eq(featureFlags.id, flagId));

  if (!flag) return null;

  const states = await db
    .select({
      id: featureFlagStates.id,
      environment: featureFlagStates.environment,
      enabled: featureFlagStates.enabled,
      rolloutPercent: featureFlagStates.rolloutPercent,
      updatedAt: featureFlagStates.updatedAt,
      updatedByName: users.name,
      updatedByEmail: users.email,
    })
    .from(featureFlagStates)
    .leftJoin(users, eq(users.id, featureFlagStates.updatedBy))
    .where(eq(featureFlagStates.flagId, flagId));

  return {
    ...flag,
    createdAt: flag.createdAt.toISOString(),
    states: states.map((state) => ({
      ...state,
      updatedAt: state.updatedAt.toISOString(),
    })),
  };
}

export type FlagAuditRow = {
  id: string;
  action: string;
  actorName: string | null;
  actorEmail: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
};

/** Audit trail for a flag and every one of its environment states, newest first. */
export async function getFlagAuditTrail(
  flagId: string,
  stateIds: string[],
): Promise<FlagAuditRow[]> {
  const entityMatch = or(
    and(eq(auditLog.entity, "feature_flag"), eq(auditLog.entityId, flagId)),
    stateIds.length
      ? and(
          eq(auditLog.entity, "feature_flag_state"),
          inArray(auditLog.entityId, stateIds),
        )
      : undefined,
  );

  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      actorName: users.name,
      actorEmail: users.email,
      before: auditLog.before,
      after: auditLog.after,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .where(entityMatch)
    .orderBy(desc(auditLog.createdAt));

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Everyone who can be picked as an owner on the create form. */
export async function listFlagOwners() {
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.disabled, false))
    .orderBy(asc(users.name));
}

/** Only users who already own a flag, so the owner filter stays short. */
export async function listFlagOwnerOptions() {
  return db
    .selectDistinct({ id: users.id, name: users.name, email: users.email })
    .from(featureFlags)
    .innerJoin(users, eq(users.id, featureFlags.ownerId))
    .orderBy(asc(users.name));
}
