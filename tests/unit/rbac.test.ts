import { describe, expect, it } from "vitest";

import { hasRole, isRole, ROLES } from "@/core/rbac";

describe("isRole", () => {
  it("accepts every declared role", () => {
    for (const role of ROLES) {
      expect(isRole(role)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    for (const value of ["", "ADMIN", "owner", null, undefined, 1, {}]) {
      expect(isRole(value)).toBe(false);
    }
  });
});

describe("hasRole", () => {
  it("is satisfied by the exact role", () => {
    expect(hasRole("analyst", "analyst")).toBe(true);
    expect(hasRole("approver", "approver")).toBe(true);
    expect(hasRole("admin", "admin")).toBe(true);
  });

  it("lets higher ranks stand in for lower ones", () => {
    expect(hasRole("admin", "approver")).toBe(true);
    expect(hasRole("admin", "analyst")).toBe(true);
    expect(hasRole("approver", "analyst")).toBe(true);
  });

  it("does not let lower ranks escalate", () => {
    expect(hasRole("analyst", "approver")).toBe(false);
    expect(hasRole("analyst", "admin")).toBe(false);
    expect(hasRole("approver", "admin")).toBe(false);
  });

  it("treats a list as any-of", () => {
    expect(hasRole("approver", ["admin", "approver"])).toBe(true);
    expect(hasRole("analyst", ["admin", "approver"])).toBe(false);
  });
});
