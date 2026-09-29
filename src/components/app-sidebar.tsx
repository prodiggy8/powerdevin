"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileCheck, Flag, ReceiptText, Users } from "lucide-react";

import type { Role } from "@/core/rbac";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

export type NavGroup = {
  label: string;
  items: { title: string; href: string; icon: keyof typeof ICONS }[];
};

const ICONS = {
  kyc: FileCheck,
  refunds: ReceiptText,
  flags: Flag,
  users: Users,
} as const;

export function AppSidebar({
  groups,
  user,
  signOutAction,
}: {
  groups: NavGroup[];
  user: { name: string | null; email: string; role: Role };
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="PowerDevin">
              <Link href="/">
                <span className="truncate font-semibold">PowerDevin</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = ICONS[item.icon];
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <Icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser
          name={user.name}
          email={user.email}
          role={user.role}
          signOutAction={signOutAction}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
