import { inArray, like } from "drizzle-orm";

import { auditLog, users } from "../schema";
import type { Role } from "../../core/rbac";
import type { SeedContext, SeedModule } from "./types";

/**
 * Seeded identities live on a reserved TLD so they can never collide with a
 * real Microsoft account, and they get no `accounts` row, so they cannot
 * sign in. The only admin that can sign in still comes from SEED_ADMIN_EMAIL
 * on first Microsoft login.
 */
export const SEED_EMAIL_DOMAIN = "example.invalid";
export const SEED_AUDIT_ID_PREFIX = "seed-audit-";

const NAMES = [
  "Amara Okafor",
  "Priya Raghunathan",
  "Lucas Moreau",
  "Ingrid Halvorsen",
  "Mateo Fernández",
  "Hana Kobayashi",
  "Yusuf Demir",
  "Zhang Qing",
  "Nora Lindqvist",
  "Diego Salazar",
  "Fatima Zahra Idrissi",
  "Tomasz Wójcik",
  "Grace Mbeki",
  "Elena Petrova",
  "Samuel Adeyemi",
  "Clara Beaumont",
  "Rahul Menon",
  "Sofia Karlsson",
  "Daniel Osei",
  "Marta Kowalczyk",
  "Ahmed El-Sayed",
  "Julia Ferreira",
  "Kenji Watanabe",
  "Aisha Rahman",
  "Victor Nkemelu",
  "Camille Rousseau",
  "Owen Pritchard",
  "Leila Haddad",
  "Nikolai Sorokin",
  "Beatriz Almeida",
  "Hugo Lindberg",
  "Anaya Chatterjee",
  "Marcus Halloran",
  "Selin Yildirim",
  "Isabel Navarro",
  "Peter Vandenberg",
  "Chiara Bellini",
  "Jonas Krüger",
  "Meera Iyer",
  "Ruth Kimani",
] as const;

// Every third user approves, every seventh administrates: enough of each role
// for the faceted filter to be worth using.
function roleFor(index: number): Role {
  if (index % 7 === 0) return "admin";
  if (index % 3 === 0) return "approver";
  return "analyst";
}

function emailFor(name: string, index: number) {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]+/g, ".")
    .replace(/^\.|\.$/g, "")
    .toLowerCase();
  return `${slug || `user${index}`}.${index + 1}@${SEED_EMAIL_DOMAIN}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Deterministic spread over the last 90 days so sorting by date is visible. */
function createdAtFor(index: number, now: number) {
  const daysAgo = 89 - Math.round((index * 89) / (NAMES.length - 1));
  const minutes = (index * 37) % (24 * 60);
  return new Date(now - daysAgo * DAY_MS + minutes * 60_000);
}

export type SeedUserFixture = {
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
};

export function seedUserFixtures(now = Date.now()): SeedUserFixture[] {
  return NAMES.map((name, index) => ({
    name,
    email: emailFor(name, index),
    role: roleFor(index),
    createdAt: createdAtFor(index, now),
  }));
}

export const seedUsers: SeedModule = {
  name: "users",
  async run({ db, reset }: SeedContext) {
    if (reset) {
      const seeded = await db
        .select({ id: users.id })
        .from(users)
        .where(like(users.email, `%@${SEED_EMAIL_DOMAIN}`));
      const ids = seeded.map((row) => row.id);
      if (ids.length) {
        await db.delete(auditLog).where(inArray(auditLog.actorId, ids));
        await db.delete(users).where(inArray(users.id, ids));
      }
    }

    const now = Date.now();
    const rows = seedUserFixtures(now);

    for (const row of rows) {
      await db
        .insert(users)
        .values(row)
        .onConflictDoUpdate({
          target: users.email,
          // createdAt is left alone so re-seeding does not reshuffle history.
          set: { name: row.name, role: row.role },
        });
    }

    const inserted = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(like(users.email, `%@${SEED_EMAIL_DOMAIN}`));

    const auditRows = buildAuditRows(inserted, now);
    for (const row of auditRows) {
      await db.insert(auditLog).values(row).onConflictDoNothing();
    }

    return `${rows.length} users, ${auditRows.length} audit rows`;
  },
};

const AUDIT_ROW_COUNT = 25;

function buildAuditRows(
  seeded: { id: string; email: string | null; role: string }[],
  now: number,
) {
  const sorted = [...seeded].sort((a, b) =>
    (a.email ?? "").localeCompare(b.email ?? ""),
  );
  if (sorted.length === 0) return [];

  return Array.from({ length: AUDIT_ROW_COUNT }, (_, index) => {
    const actor = sorted[index % sorted.length];
    const subject = sorted[(index * 5 + 3) % sorted.length];
    const before = index % 2 === 0 ? "analyst" : "approver";
    const after = subject.role;
    return {
      id: `${SEED_AUDIT_ID_PREFIX}${String(index + 1).padStart(2, "0")}`,
      actorId: actor.id,
      action: "user.role.updated",
      entity: "user",
      entityId: subject.id,
      before: { role: before },
      after: { role: after },
      createdAt: new Date(now - (index + 1) * 3 * DAY_MS),
    };
  });
}
