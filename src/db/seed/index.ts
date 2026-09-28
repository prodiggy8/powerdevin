import type { Database } from "../index";
import { seedUsers } from "./users";
import { seedKyc } from "./kyc";
import type { SeedModule } from "./types";

/** Later modules (refunds, flags) append themselves here. */
export const SEED_MODULES: SeedModule[] = [seedUsers, seedKyc];

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

export { seedUsers, seedKyc };
export type { SeedContext, SeedModule } from "./types";
