import { describe, expect, it } from "vitest";

import { entraProfileToUser } from "@/core/auth/entra-profile";

const base = { sub: "entra-sub-1", name: "Dana Reviewer" };

describe("entraProfileToUser", () => {
  it("uses the email claim when present", () => {
    expect(
      entraProfileToUser({
        ...base,
        email: "dana@contoso.com",
        preferred_username: "dana.upn@contoso.com",
      }),
    ).toEqual({
      id: "entra-sub-1",
      name: "Dana Reviewer",
      email: "dana@contoso.com",
      image: null,
    });
  });

  it("falls back to preferred_username when the email claim is missing", () => {
    const profile = { ...base, preferred_username: "dana.upn@contoso.com" };
    expect(
      entraProfileToUser(profile as Parameters<typeof entraProfileToUser>[0]),
    ).toMatchObject({ email: "dana.upn@contoso.com" });
  });
});
