import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";
import { testDatabaseUrl } from "./env";

let pool: Pool | undefined;
let db: NodePgDatabase<typeof schema> | undefined;

export function testDb(): NodePgDatabase<typeof schema> {
  pool ??= new Pool({ connectionString: testDatabaseUrl });
  db ??= drizzle(pool, { schema });
  return db;
}

const TABLES = [
  "audit_log",
  "approval_requests",
  "accounts",
  "sessions",
  "verification_tokens",
  "users",
];

export async function truncateAll() {
  const list = TABLES.map((table) => `"${table}"`).join(", ");
  await testDb().execute(`truncate table ${list} restart identity cascade`);
}

export async function closeTestDb() {
  await pool?.end();
  pool = undefined;
  db = undefined;
}
