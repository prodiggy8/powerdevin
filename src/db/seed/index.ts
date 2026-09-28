import type { Database } from "../index";
import { seedUsers } from "./users";
import { resetRefunds, seedRefunds } from "./refunds";
import type { SeedModule } from "./types";

/** Later modules (kyc, refunds, flags) append themselves here. */
export const SEED_MODULES: SeedModule[] = [resetRefunds, seedUsers, seedRefunds];

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

export { seedUsers };
export type { SeedContext, SeedModule } from "./types";
