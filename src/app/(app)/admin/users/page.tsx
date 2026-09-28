import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/core/auth";
import { parseDataTableQuery } from "@/core/data-table";
import { isRole, type Role } from "@/core/rbac";
import { UsersTable, type UserRow } from "./users-table";

const SORTABLE = {
  name: users.name,
  email: users.email,
  role: users.role,
  createdAt: users.createdAt,
} as const;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireRole("admin");

  const query = parseDataTableQuery(await searchParams, {
    sortableColumns: Object.keys(SORTABLE),
    filterColumns: ["role"],
  });

  const conditions: SQL[] = [];
  if (query.search) {
    const pattern = `%${query.search}%`;
    const match = or(ilike(users.name, pattern), ilike(users.email, pattern));
    if (match) conditions.push(match);
  }
  if (isRole(query.filters.role)) {
    conditions.push(eq(users.role, query.filters.role));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const sortColumn = query.sort
    ? SORTABLE[query.sort as keyof typeof SORTABLE]
    : users.createdAt;
  const orderBy = query.order === "asc" ? asc(sortColumn) : desc(sortColumn);

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ value: count() }).from(users).where(where),
  ]);

  const data: UserRow[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Users &amp; roles</h1>
        <p className="text-muted-foreground">
          Role changes take effect on the user&apos;s next request and are
          written to the audit log.
        </p>
      </div>
      <UsersTable
        data={data}
        total={totals.value}
        query={query}
        currentUserId={actor.id}
      />
    </div>
  );
}
