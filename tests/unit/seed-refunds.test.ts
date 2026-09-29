import { describe, expect, it } from "vitest";

import { needsApprover } from "@/modules/refunds/rules";
import {
  CUSTOMER_EMAIL_DOMAINS,
  refundSeedFixtures,
  seedOrderRef,
} from "@/db/seed/refunds";
import { SEED_EMAIL_DOMAIN } from "@/db/seed/users";

const NOW = Date.UTC(2026, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

const requesters = Array.from({ length: 40 }, (_, index) => `user-${index}`);
const deciders = requesters.filter((_, index) => index % 3 === 0);

describe("refundSeedFixtures", () => {
  const fixtures = refundSeedFixtures({ requesters, deciders }, NOW);
  const byStatus = (status: string) =>
    fixtures.filter((fixture) => fixture.status === status);

  it("produces 80 refunds in the specified buckets", () => {
    expect(fixtures).toHaveLength(80);
    expect(byStatus("pending")).toHaveLength(25);
    expect(byStatus("paid")).toHaveLength(30);
    expect(byStatus("approved")).toHaveLength(10);
    expect(byStatus("rejected")).toHaveLength(15);
    expect(
      byStatus("pending").filter((fixture) => needsApprover(fixture.amount)),
    ).toHaveLength(10);
  });

  it("numbers orders from ORD-48120 in steps of 7", () => {
    expect(fixtures[0].orderRef).toBe("ORD-48120");
    expect(fixtures[1].orderRef).toBe("ORD-48127");
    expect(fixtures.at(-1)?.orderRef).toBe(seedOrderRef(79));
    expect(new Set(fixtures.map((fixture) => fixture.orderRef)).size).toBe(80);
  });

  it("puts customers on consumer domains, never the staff domain", () => {
    const domains = new Set<string>();
    for (const { customerEmail } of fixtures) {
      const [local, domain] = customerEmail.split("@");
      expect(local).not.toMatch(/\d/);
      expect(domain).not.toBe(SEED_EMAIL_DOMAIN);
      domains.add(domain);
    }
    expect([...domains].sort()).toEqual([...CUSTOMER_EMAIL_DOMAINS].sort());
  });

  it("covers 12.00 to 4,800.00 on both sides of the threshold", () => {
    const amounts = fixtures.map((fixture) => Number(fixture.amount));
    expect(Math.min(...amounts)).toBe(12);
    expect(Math.max(...amounts)).toBe(4800);
    for (const status of ["paid", "approved", "rejected"]) {
      const above = byStatus(status).filter((f) => needsApprover(f.amount));
      expect(above.length).toBeGreaterThan(0);
      expect(above.length).toBeLessThan(byStatus(status).length);
    }
  });

  it("keeps timestamps ordered and within the last 90 days", () => {
    for (const fixture of fixtures) {
      const requested = fixture.requestedAt.getTime();
      expect(requested).toBeGreaterThan(NOW - 90 * DAY_MS);
      expect(requested).toBeLessThanOrEqual(NOW);
      if (fixture.decidedAt) {
        expect(fixture.decidedAt.getTime()).toBeGreaterThan(requested);
        expect(fixture.decidedAt.getTime()).toBeLessThan(NOW);
      }
      if (fixture.paidAt) {
        expect(fixture.paidAt.getTime()).toBeGreaterThan(fixture.decidedAt!.getTime());
        expect(fixture.paidAt.getTime()).toBeLessThan(NOW);
      }
    }
  });

  it("never lets a requester approve their own above-threshold refund", () => {
    for (const fixture of fixtures) {
      if (fixture.decidedBy && needsApprover(fixture.amount)) {
        expect(fixture.decidedBy).not.toBe(fixture.requestedBy);
        expect(deciders).toContain(fixture.decidedBy);
      }
      if (fixture.paidBy) expect(deciders).toContain(fixture.paidBy);
    }
  });
});
