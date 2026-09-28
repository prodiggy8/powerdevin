import { loadEnvConfig } from "@next/env";

// drizzle-kit and tsx only read .env; this picks up .env.local like `next dev`.
loadEnvConfig(process.cwd());

async function main() {
  const reset = process.argv.includes("--reset");

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set (see .env.example)");
  }

  const { getDb, getPool } = await import("./index");
  const { runSeed } = await import("./seed/index");

  await runSeed({ db: getDb(), reset });
  await getPool().end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
