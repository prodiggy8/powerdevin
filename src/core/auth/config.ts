import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { NextAuthConfig } from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { eq } from "drizzle-orm";

import { db, getDb } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { isRole, type Role } from "@/core/rbac";

/**
 * The only sign-in path is Microsoft SSO, so the first admin cannot be granted
 * through the UI. The first user row whose email matches SEED_ADMIN_EMAIL is
 * created as an admin; every other new user is an analyst.
 */
function initialRoleFor(email: string | null | undefined): Role {
  const seedAdmin = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (seedAdmin && email && email.trim().toLowerCase() === seedAdmin) {
    return "admin";
  }
  return "analyst";
}

function createAdapter(): Adapter {
  const adapter = DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  });

  return {
    ...adapter,

    async createUser(user) {
      const [created] = await db
        .insert(users)
        .values({
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          image: user.image,
          role: initialRoleFor(user.email),
        })
        .returning();
      return created as AdapterUser;
    },
  };
}

let adapterInstance: Adapter | undefined;

// Resolved on first use: `next build` imports this module without a database.
const lazyAdapter = new Proxy({} as Adapter, {
  get(_target, prop) {
    adapterInstance ??= createAdapter();
    const value = Reflect.get(adapterInstance, prop, adapterInstance);
    return typeof value === "function" ? value.bind(adapterInstance) : value;
  },
  has(_target, prop) {
    adapterInstance ??= createAdapter();
    return prop in adapterInstance;
  },
});

export const authConfig = {
  adapter: lazyAdapter,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      if (!token.sub) {
        return token;
      }

      const row = await db.query.users.findFirst({
        where: eq(users.id, token.sub),
        columns: { role: true, disabled: true, name: true, email: true },
      });

      if (!row || row.disabled) {
        // Revoke the token as soon as the user is removed or disabled.
        return null;
      }

      token.role = row.role;
      token.name = row.name;
      token.email = row.email;
      return token;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      session.user.role = isRole(token.role) ? token.role : "analyst";
      return session;
    },
  },
} satisfies NextAuthConfig;
