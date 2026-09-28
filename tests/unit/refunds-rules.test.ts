import { describe, expect, it } from "vitest";

import {
  REFUND_THRESHOLD,
  canDecide,
  canMarkPaid,
  isFinal,
  needsApprover,
  secondApproverError,
  toCents,
} from "@/modules/refunds/rules";

describe("refund rules", () => {
  it("converts amounts to integer cents", () => {
    expect(toCents("499.99")).toBe(49_999);
    expect(toCents("500")).toBe(50_000);
    expect(toCents("12.5")).toBe(1_250);
    expect(toCents(REFUND_THRESHOLD)).toBe(50_000);
  });

  it("routes at or above 500.00 to an approver", () => {
    expect(needsApprover("499.99")).toBe(false);
    expect(needsApprover("500.00")).toBe(true);
    expect(needsApprover("4800.00")).toBe(true);
  });

  it("lets analysts decide only below the threshold", () => {
    expect(canDecide("analyst", "499.99")).toBe(true);
    expect(canDecide("analyst", "500.00")).toBe(false);
    expect(canDecide("approver", "500.00")).toBe(true);
    expect(canDecide("admin", "4800.00")).toBe(true);
  });

  it("only lets approvers and admins pay approved refunds", () => {
    expect(canMarkPaid("analyst", "approved")).toBe(false);
    expect(canMarkPaid("approver", "approved")).toBe(true);
    expect(canMarkPaid("admin", "approved")).toBe(true);
    expect(canMarkPaid("admin", "pending")).toBe(false);
    expect(canMarkPaid("admin", "paid")).toBe(false);
  });

  it("treats rejected and paid as final", () => {
    expect(isFinal("rejected")).toBe(true);
    expect(isFinal("paid")).toBe(true);
    expect(isFinal("approved")).toBe(false);
    expect(isFinal("pending")).toBe(false);
  });

  it("maps every second-approver reason to a message", () => {
    expect(secondApproverError("self-approval")).toMatch(/different approver/);
    expect(secondApproverError("already-decided")).toMatch(/already been decided/);
    expect(secondApproverError("no-request")).toMatch(/no approval request/);
  });
});
