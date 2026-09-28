import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

/** Matches the credentials in docker-compose.yml, with `powerdevin_test`. */
const DEFAULT_TEST_URL =
  "postgres://powerdevin:powerdevin@localhost:5432/powerdevin_test";

export const testDatabaseUrl = process.env.DATABASE_URL_TEST ?? DEFAULT_TEST_URL;

export function testDatabaseName() {
  return new URL(testDatabaseUrl).pathname.replace(/^\//, "");
}

/** Same server, but pointed at `postgres` so the test database can be created. */
export function maintenanceUrl() {
  const url = new URL(testDatabaseUrl);
  url.pathname = "/postgres";
  return url.toString();
}
