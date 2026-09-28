import { describe, expect, it } from "vitest";

import { breadcrumbTrail } from "@/components/breadcrumb-trail";

describe("breadcrumbTrail", () => {
  it("marks the console as current at the root", () => {
    expect(breadcrumbTrail("/")).toEqual([
      { label: "Console", href: undefined, current: true },
    ]);
  });

  it("links the console and names the current page", () => {
    expect(breadcrumbTrail("/kyc")).toEqual([
      { label: "Console", href: "/", current: false },
      { label: "KYC review", href: undefined, current: true },
    ]);
  });

  it("does not link grouping segments that have no page", () => {
    const trail = breadcrumbTrail("/admin/users");
    expect(trail.map((crumb) => crumb.href)).toEqual(["/", undefined, undefined]);
    expect(trail.map((crumb) => crumb.label)).toEqual([
      "Console",
      "Admin",
      "Users & roles",
    ]);
  });

  it("falls back to a humanised segment", () => {
    expect(breadcrumbTrail("/feature-flags").at(-1)?.label).toBe(
      "feature flags",
    );
  });
});
