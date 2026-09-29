import type { MicrosoftEntraIDProfile } from "next-auth/providers/microsoft-entra-id";

/**
 * Entra only sends `email` when the claim is configured; `preferred_username`
 * is the sign-in address otherwise. The stock provider also inlines the Graph
 * profile photo as a base64 data URI, which bloats both the users row and the
 * session cookie, so no image is kept.
 */
export function entraProfileToUser(
  profile: Pick<MicrosoftEntraIDProfile, "sub" | "name" | "email" | "preferred_username">,
) {
  return {
    id: profile.sub,
    name: profile.name ?? null,
    email: profile.email ?? profile.preferred_username,
    image: null,
  };
}
