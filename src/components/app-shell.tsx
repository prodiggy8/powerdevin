import { signOut, type SessionUser } from "@/core/auth";
import { hasRole } from "@/core/rbac";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { AppSidebar, type NavGroup } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const OPERATIONS: NavGroup = {
  label: "Operations",
  items: [
    { title: "KYC review", href: "/kyc", icon: "kyc" },
    { title: "Refunds", href: "/refunds", icon: "refunds" },
    { title: "Feature flags", href: "/flags", icon: "flags" },
  ],
};

const ADMIN: NavGroup = {
  label: "Admin",
  items: [{ title: "Users & roles", href: "/admin/users", icon: "users" }],
};

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const groups = hasRole(user.role, "admin")
    ? [OPERATIONS, ADMIN]
    : [OPERATIONS];

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <SidebarProvider>
      <AppSidebar
        groups={groups}
        user={{
          name: user.name ?? null,
          email: user.email ?? "",
          role: user.role,
        }}
        signOutAction={signOutAction}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <AppBreadcrumbs />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
