import { describe, expect, it } from "vitest";

import {
  auditActionFor,
  canClaim,
  canDecide,
  isFinal,
  isRiskBand,
  riskBand,
  riskBandRange,
  statusAfterClaim,
  statusFor,
} from "@/modules/kyc/policy";

describe("riskBand", () => {
  it("splits scores into low, medium and high", () => {
    expect(riskBand(0)).toBe("low");
    expect(riskBand(39)).toBe("low");
    expect(riskBand(40)).toBe("medium");
    expect(riskBand(69)).toBe("medium");
    expect(riskBand(70)).toBe("high");
    expect(riskBand(100)).toBe("high");
  });

  it("has ranges that agree with the bands", () => {
    for (const band of ["low", "medium", "high"] as const) {
      const { min, max } = riskBandRange(band);
      expect(riskBand(min)).toBe(band);
      expect(riskBand(max)).toBe(band);
    }
  });

  it("recognises only the three bands", () => {
    expect(isRiskBand("low")).toBe(true);
    expect(isRiskBand("severe")).toBe(false);
    expect(isRiskBand(70)).toBe(false);
  });
});

describe("isFinal", () => {
  it("treats approved and rejected as terminal", () => {
    expect(isFinal("approved")).toBe(true);
    expect(isFinal("rejected")).toBe(true);
    expect(isFinal("pending")).toBe(false);
    expect(isFinal("in_review")).toBe(false);
    expect(isFinal("escalated")).toBe(false);
  });
});

describe("canDecide", () => {
  it("lets an analyst decide low and medium risk", () => {
    expect(canDecide("analyst", { status: "pending", riskScore: 39 }).ok).toBe(
      true,
    );
    expect(canDecide("analyst", { status: "in_review", riskScore: 69 }).ok).toBe(
      true,
    );
  });

  it("stops an analyst on high risk and on escalations", () => {
    expect(canDecide("analyst", { status: "pending", riskScore: 70 })).toEqual({
      ok: false,
      error: "High-risk cases need an approver.",
    });
    expect(
      canDecide("analyst", { status: "escalated", riskScore: 10 }),
    ).toEqual({ ok: false, error: "Escalated cases need an approver." });
  });

  it("lets approvers and admins decide anything open", () => {
    for (const role of ["approver", "admin"] as const) {
      expect(canDecide(role, { status: "pending", riskScore: 99 }).ok).toBe(true);
      expect(canDecide(role, { status: "escalated", riskScore: 99 }).ok).toBe(
        true,
      );
    }
  });

  it("stops everyone on a final case", () => {
    for (const role of ["analyst", "approver", "admin"] as const) {
      expect(canDecide(role, { status: "approved", riskScore: 1 })).toEqual({
        ok: false,
        error: "This case is already final.",
      });
    }
  });
});

describe("statusAfterClaim", () => {
  it("moves open cases into review but keeps escalations escalated", () => {
    expect(statusAfterClaim("pending")).toBe("in_review");
    expect(statusAfterClaim("in_review")).toBe("in_review");
    expect(statusAfterClaim("escalated")).toBe("escalated");
  });
});

describe("canClaim", () => {
  const analyst = { id: "u-analyst", role: "analyst" } as const;
  const approver = { id: "u-approver", role: "approver" } as const;
  const admin = { id: "u-admin", role: "admin" } as const;

  it("allows open cases and refuses final ones", () => {
    expect(canClaim(analyst, { status: "pending", assignedTo: null }).ok).toBe(true);
    expect(canClaim(analyst, { status: "escalated", assignedTo: null }).ok).toBe(
      true,
    );
    expect(canClaim(analyst, { status: "rejected", assignedTo: null }).ok).toBe(
      false,
    );
  });

  it("lets the current assignee claim their own case again", () => {
    expect(
      canClaim(analyst, { status: "in_review", assignedTo: analyst.id }).ok,
    ).toBe(true);
  });

  it("refuses a case assigned to someone else unless the actor is admin", () => {
    const candidate = {
      status: "in_review",
      assignedTo: "u-other",
      assigneeName: "Dana Reviewer",
    } as const;
    expect(canClaim(analyst, candidate)).toEqual({
      ok: false,
      error: "This case is assigned to Dana Reviewer.",
    });
    expect(canClaim(approver, candidate)).toEqual({
      ok: false,
      error: "This case is assigned to Dana Reviewer.",
    });
    expect(canClaim(admin, candidate)).toEqual({ ok: true });
  });

  it("still refuses a final case for an admin", () => {
    expect(
      canClaim(admin, { status: "approved", assignedTo: "u-other" }).ok,
    ).toBe(false);
  });
});

describe("decision mapping", () => {
  it("maps each decision to its status and audit action", () => {
    expect(statusFor("approve")).toBe("approved");
    expect(statusFor("reject")).toBe("rejected");
    expect(statusFor("escalate")).toBe("escalated");
    expect(auditActionFor("approve")).toBe("kyc_case.approved");
    expect(auditActionFor("reject")).toBe("kyc_case.rejected");
    expect(auditActionFor("escalate")).toBe("kyc_case.escalated");
  });
});
