import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  pool?: Pool;
  db?: NodePgDatabase<typeof schema>;
};

export function getPool(): Pool {
  if (globalForDb.pool) {
    return globalForDb.pool;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const created = new Pool({ connectionString });
  globalForDb.pool = created;
  return created;
}

export function getDb(): NodePgDatabase<typeof schema> {
  globalForDb.db ??= drizzle(getPool(), { schema });
  return globalForDb.db;
}

function lazy<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const real = resolve();
      const value = Reflect.get(real, prop, real);
      return typeof value === "function" ? value.bind(real) : value;
    },
  });
}

// Connecting eagerly would break `next build`, which imports modules without a
// database available, so the pool is created on first use instead.
export const pool = lazy(getPool);
export const db = lazy(getDb);

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export { schema };
