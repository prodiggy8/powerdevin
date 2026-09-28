import type { Database } from "../index";
import { seedFlags } from "./flags";
import { seedUsers } from "./users";
import { seedKyc } from "./kyc";
import { resetRefunds, seedRefunds } from "./refunds";
import type { SeedModule } from "./types";

export const SEED_MODULES: SeedModule[] = [
  resetRefunds,
  seedUsers,
  seedFlags,
  seedRefunds,
  seedKyc,
];

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

export { seedUsers, seedFlags, seedKyc };
export type { SeedContext, SeedModule } from "./types";
