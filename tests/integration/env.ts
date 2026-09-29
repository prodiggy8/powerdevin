import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

/** Matches the credentials in docker-compose.yml, with `powerdevin_test`. */
const DEFAULT_TEST_URL =
  "postgres://powerdevin:powerdevin@localhost:5432/powerdevin_test";

export const testDatabaseUrl = process.env.DATABASE_URL_TEST ?? DEFAULT_TEST_URL;

export function testDatabaseName(url = testDatabaseUrl) {
  return new URL(url).pathname.replace(/^\//, "");
}

/** Every suite truncates tables, so refuse anything but a `_test` database. */
export function assertTestDatabase(url: string) {
  const name = testDatabaseName(url);
  if (!name.endsWith("_test")) {
    throw new Error(
      `Refusing to run integration tests against "${name}": the database name must end in _test.`,
    );
  }
}

assertTestDatabase(testDatabaseUrl);

/** Same server, but pointed at `postgres` so the test database can be created. */
export function maintenanceUrl() {
  const url = new URL(testDatabaseUrl);
  url.pathname = "/postgres";
  return url.toString();
}
