import { describe, expect, it } from "vitest";

import { ROLES } from "@/core/rbac";
import { SEED_EMAIL_DOMAIN, seedUserFixtures } from "@/db/seed/users";

const NOW = Date.UTC(2026, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

describe("seedUserFixtures", () => {
  const fixtures = seedUserFixtures(NOW);

  it("produces 40 users", () => {
    expect(fixtures).toHaveLength(40);
  });

  it("keeps every address on the reserved domain and unique", () => {
    const emails = fixtures.map((user) => user.email);
    for (const email of emails) {
      expect(email.endsWith(`@${SEED_EMAIL_DOMAIN}`)).toBe(true);
      expect(email).toMatch(/^[a-z0-9.]+@/);
    }
    expect(new Set(emails).size).toBe(emails.length);
  });

  it("covers all three roles", () => {
    const used = new Set(fixtures.map((user) => user.role));
    for (const role of ROLES) {
      expect(used.has(role)).toBe(true);
    }
  });

  it("spreads created_at over the last 90 days", () => {
    for (const user of fixtures) {
      expect(user.createdAt.getTime()).toBeLessThanOrEqual(NOW + DAY_MS);
      expect(user.createdAt.getTime()).toBeGreaterThan(NOW - 90 * DAY_MS);
    }
    const distinctDays = new Set(
      fixtures.map((user) => user.createdAt.toISOString().slice(0, 10)),
    );
    expect(distinctDays.size).toBeGreaterThan(30);
  });

  it("is deterministic for a given clock", () => {
    expect(seedUserFixtures(NOW)).toEqual(fixtures);
  });
});
