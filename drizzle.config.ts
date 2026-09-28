import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// drizzle-kit only reads .env; this picks up .env.local like `next dev` does.
loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set (see .env.example)");
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
