import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, Pool } from "pg";

import { maintenanceUrl, testDatabaseName, testDatabaseUrl } from "./env";

/** Creates `powerdevin_test` if needed and applies the drizzle migrations. */
export default async function setup() {
  const database = testDatabaseName();

  const admin = new Client({ connectionString: maintenanceUrl() });
  await admin.connect();
  try {
    const existing = await admin.query(
      "select 1 from pg_database where datname = $1",
      [database],
    );
    if (existing.rowCount === 0) {
      await admin.query(`create database "${database}"`);
    }
  } finally {
    await admin.end();
  }

  const pool = new Pool({ connectionString: testDatabaseUrl });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./src/db/migrations" });
  } finally {
    await pool.end();
  }
}
