import type { Database } from "../index";

export type SeedContext = {
  db: Database;
  /** Delete the module's own rows before inserting. */
  reset: boolean;
};

export type SeedModule = {
  name: string;
  /** Must be idempotent: running it twice leaves the same rows. */
  run: (ctx: SeedContext) => Promise<string>;
};
