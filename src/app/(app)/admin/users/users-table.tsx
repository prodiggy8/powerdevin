"use client";

import { useMemo, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

import { DataTable, type DataTableQuery } from "@/core/data-table";
import { ROLES, type Role } from "@/core/rbac";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateUserRole } from "./actions";

function initials(value: string) {
  return value
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
  createdAt: string;
};

function RoleSelect({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      value={user.role}
      disabled={isSelf || isPending}
      onValueChange={(role) => {
        startTransition(async () => {
          const result = await updateUserRole({ userId: user.id, role });
          if (result.ok) {
            toast.success(`${user.email ?? user.id} is now ${role}`);
          } else {
            toast.error(result.error);
          }
        });
      }}
    >
      <SelectTrigger className="h-8 w-[140px] capitalize">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((role) => (
          <SelectItem key={role} value={role} className="capitalize">
            {role}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function UsersTable({
  data,
  total,
  query,
  currentUserId,
}: {
  data: UserRow[];
  total: number;
  query: DataTableQuery;
  currentUserId: string;
}) {
  const columns = useMemo<ColumnDef<UserRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-muted text-xs font-medium text-muted-foreground">
              {initials(row.original.name ?? row.original.email ?? "?")}
            </span>
            <span className="font-medium">{row.original.name ?? "—"}</span>
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email}</span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) =>
          new Date(row.original.createdAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
      },
      {
        accessorKey: "role",
        header: "Role",
        enableHiding: false,
        cell: ({ row }) => (
          <RoleSelect
            user={row.original}
            isSelf={row.original.id === currentUserId}
          />
        ),
      },
    ],
    [currentUserId],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      total={total}
      query={query}
      sortableColumns={["name", "email", "role", "createdAt"]}
      filters={[
        {
          id: "role",
          label: "Role",
          options: ROLES.map((role) => ({ label: role, value: role })),
        },
      ]}
      searchPlaceholder="Search name or email…"
      emptyMessage="No users found"
      emptyDescription="Users appear here after their first Microsoft sign-in."
    />
  );
}
