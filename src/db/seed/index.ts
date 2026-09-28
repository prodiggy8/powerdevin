import type { Database } from "../index";
import { seedFlags } from "./flags";
import { seedUsers } from "./users";
import type { SeedModule } from "./types";

/** Later modules (kyc, refunds, flags) append themselves here. */
export const SEED_MODULES: SeedModule[] = [seedUsers, seedFlags];

export async function runSeed({
  db,
  reset = false,
  log = console.log,
}: {
  db: Database;
  reset?: boolean;
  log?: (message: string) => void;
}) {
  for (const seedModule of SEED_MODULES) {
    const summary = await seedModule.run({ db, reset });
    log(`seed:${seedModule.name} ${reset ? "(reset) " : ""}→ ${summary}`);
  }
}

export { seedUsers, seedFlags };
export type { SeedContext, SeedModule } from "./types";
