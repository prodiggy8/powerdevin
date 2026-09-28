"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableQuery } from "@/core/data-table";
import type { Role } from "@/core/rbac";
import { FLAG_ENVIRONMENTS } from "@/modules/flags/policy";
import type { FlagListRow } from "@/modules/flags/queries";
import { FlagStateSwitch } from "./flag-state-switch";

export function FlagsTable({
  data,
  total,
  query,
  role,
  ownerOptions,
}: {
  data: FlagListRow[];
  total: number;
  query: DataTableQuery;
  role: Role;
  ownerOptions: { label: string; value: string }[];
}) {
  const columns = useMemo<ColumnDef<FlagListRow, unknown>[]>(
    () => [
      {
        accessorKey: "key",
        header: "Key",
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Link
              href={`/flags/${row.original.id}`}
              className="font-mono text-sm font-medium hover:underline"
            >
              {row.original.key}
            </Link>
            {row.original.archived ? (
              <Badge variant="outline">Archived</Badge>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.description}
          </span>
        ),
      },
      {
        accessorKey: "owner",
        header: "Owner",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.ownerName ?? row.original.ownerEmail ?? "—"}
          </span>
        ),
      },
      ...FLAG_ENVIRONMENTS.map<ColumnDef<FlagListRow, unknown>>(
        (environment) => ({
          id: environment,
          header: environment,
          cell: ({ row }) => {
            const state = row.original.states.find(
              (candidate) => candidate.environment === environment,
            );
            if (!state) return <span className="text-muted-foreground">—</span>;
            return (
              <div className="flex items-center gap-2">
                <FlagStateSwitch
                  flagId={row.original.id}
                  flagKey={row.original.key}
                  environment={environment}
                  enabled={state.enabled}
                  rolloutPercent={state.rolloutPercent}
                  role={role}
                  archived={row.original.archived}
                />
                <span className="w-10 text-xs text-muted-foreground tabular-nums">
                  {state.rolloutPercent}%
                </span>
              </div>
            );
          },
        }),
      ),
    ],
    [role],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      total={total}
      query={query}
      sortableColumns={["key", "owner", "createdAt"]}
      filters={[
        {
          id: "enabledIn",
          label: "Enabled in",
          options: FLAG_ENVIRONMENTS.map((environment) => ({
            label: environment,
            value: environment,
          })),
        },
        { id: "owner", label: "Owner", options: ownerOptions },
        {
          id: "archived",
          label: "Archived",
          options: [
            { label: "Archived", value: "true" },
            { label: "Active", value: "false" },
          ],
        },
      ]}
      searchPlaceholder="Search key or description…"
      emptyMessage="No feature flags found"
      emptyDescription="Create a flag to start rolling changes out per environment."
    />
  );
}
