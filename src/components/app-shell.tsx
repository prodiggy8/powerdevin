import Link from "next/link";

import { signOut, type SessionUser } from "@/core/auth";
import { hasRole } from "@/core/rbac";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-6 py-3">
          <Link href="/" className="font-semibold">
            PowerDevin
          </Link>
          <nav className="flex items-center gap-3 text-sm text-muted-foreground">
            {hasRole(user.role, "admin") ? (
              <Link href="/admin/users" className="hover:text-foreground">
                Users
              </Link>
            ) : null}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Badge variant="secondary">{user.role}</Badge>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
