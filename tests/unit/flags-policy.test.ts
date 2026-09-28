import { describe, expect, it } from "vitest";

import {
  canArchiveFlag,
  canChangeEnvironment,
  canCreateFlag,
  checkStateChange,
  FLAG_KEY_PATTERN,
  isFlagEnvironment,
} from "@/modules/flags/policy";

const base = {
  currentRolloutPercent: 0,
  nextRolloutPercent: 0,
} as const;

describe("FLAG_KEY_PATTERN", () => {
  it("accepts lowercase snake_case keys", () => {
    for (const key of ["instant_refunds_v2", "kyc_doc_ocr", "flags2"]) {
      expect(FLAG_KEY_PATTERN.test(key)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    for (const key of ["Instant_Refunds", "kyc-doc-ocr", "_leading", "trailing_", "two__underscores", "9lives"]) {
      expect(FLAG_KEY_PATTERN.test(key)).toBe(false);
    }
  });
});

describe("isFlagEnvironment", () => {
  it("accepts the three environments only", () => {
    expect(isFlagEnvironment("dev")).toBe(true);
    expect(isFlagEnvironment("staging")).toBe(true);
    expect(isFlagEnvironment("prod")).toBe(true);
    expect(isFlagEnvironment("production")).toBe(false);
    expect(isFlagEnvironment(undefined)).toBe(false);
  });
});

describe("environment permissions", () => {
  it("keeps analysts read-only", () => {
    expect(canChangeEnvironment("analyst", "dev")).toBe(false);
    expect(canCreateFlag("analyst")).toBe(false);
    expect(canArchiveFlag("analyst")).toBe(false);
  });

  it("lets approvers change dev and staging but not prod", () => {
    expect(canChangeEnvironment("approver", "dev")).toBe(true);
    expect(canChangeEnvironment("approver", "staging")).toBe(true);
    expect(canChangeEnvironment("approver", "prod")).toBe(false);
    expect(canCreateFlag("approver")).toBe(true);
    expect(canArchiveFlag("approver")).toBe(false);
  });

  it("lets admins do everything", () => {
    expect(canChangeEnvironment("admin", "prod")).toBe(true);
    expect(canCreateFlag("admin")).toBe(true);
    expect(canArchiveFlag("admin")).toBe(true);
  });
});

describe("checkStateChange", () => {
  it("rejects an approver touching prod", () => {
    const result = checkStateChange({
      ...base,
      role: "approver",
      environment: "prod",
      reason: "a long enough reason",
    });
    expect(result).toEqual({ ok: false, error: "Only admins can change prod." });
  });

  it("requires a reason of ten characters in prod", () => {
    expect(
      checkStateChange({
        ...base,
        role: "admin",
        environment: "prod",
        reason: "too short",
      }).ok,
    ).toBe(false);
    expect(
      checkStateChange({
        ...base,
        role: "admin",
        environment: "prod",
        reason: "rolling out to ten percent",
      }).ok,
    ).toBe(true);
  });

  it("does not ask dev and staging for a reason", () => {
    expect(
      checkStateChange({ ...base, role: "approver", environment: "dev" }).ok,
    ).toBe(true);
  });

  it("caps a prod rollout jump at fifty points", () => {
    const change = (next: number) =>
      checkStateChange({
        role: "admin",
        environment: "prod",
        reason: "staged rollout approved",
        currentRolloutPercent: 10,
        nextRolloutPercent: next,
      });
    expect(change(60).ok).toBe(true);
    expect(change(80).ok).toBe(false);
    expect(change(0).ok).toBe(true);
  });
});
