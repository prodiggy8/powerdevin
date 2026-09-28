import NextAuth, { type Session } from "next-auth";
import { redirect } from "next/navigation";

import { hasRole, type Role } from "@/core/rbac";
import { authConfig } from "./config";

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export type SessionUser = Session["user"];

/** Returns the signed-in user, redirecting to /login when there is none. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

/** Returns the signed-in user, redirecting to /forbidden without the role. */
export async function requireRole(
  required: Role | Role[],
): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasRole(user.role, required)) {
    redirect("/forbidden");
  }
  return user;
}

export { authConfig };
