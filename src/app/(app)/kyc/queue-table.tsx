"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable, type DataTableQuery } from "@/core/data-table";
import { formatDate } from "@/lib/format";
import { RISK_BANDS } from "@/modules/kyc/policy";
import { RiskBadge, StatusBadge, STATUS_LABEL } from "@/modules/kyc/risk-badge";
import type { KycCaseRow } from "@/modules/kyc/queries";

export type QueueRow = Omit<KycCaseRow, "submittedAt"> & {
  submittedAt: string;
};

const RISK_LABEL: Record<(typeof RISK_BANDS)[number], string> = {
  low: "Low (<40)",
  medium: "Medium (40–69)",
  high: "High (≥70)",
};

export function QueueTable({
  data,
  total,
  query,
  countries,
}: {
  data: QueueRow[];
  total: number;
  query: DataTableQuery;
  countries: string[];
}) {
  const columns = useMemo<ColumnDef<QueueRow, unknown>[]>(
    () => [
      {
        accessorKey: "customerName",
        header: "Customer",
        enableHiding: false,
        cell: ({ row }) => (
          <Link href={`/kyc/${row.original.id}`} className="flex flex-col">
            <span className="font-medium">{row.original.customerName}</span>
            <span className="text-xs text-muted-foreground">
              {row.original.customerEmail}
            </span>
          </Link>
        ),
      },
      {
        accessorKey: "country",
        header: "Country",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.country}</span>
        ),
      },
      {
        accessorKey: "riskScore",
        header: "Risk",
        cell: ({ row }) => <RiskBadge score={row.original.riskScore} />,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "assignee",
        header: "Assignee",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.assignee ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "submittedAt",
        header: "Submitted",
        cell: ({ row }) => formatDate(row.original.submittedAt),
      },
    ],
    [],
  );

  return (
      <DataTable
        columns={columns}
        rowHref={(row) => `/kyc/${row.id}`}
        data={data}
        total={total}
        query={query}
        sortableColumns={["submittedAt", "riskScore", "status", "country"]}
        filters={[
          {
            id: "status",
            label: "Status",
            options: Object.entries(STATUS_LABEL).map(([value, label]) => ({
              label,
              value,
            })),
          },
          {
            id: "risk",
            label: "Risk band",
            options: RISK_BANDS.map((band) => ({
              label: RISK_LABEL[band],
              value: band,
            })),
          },
          {
            id: "country",
            label: "Country",
            options: countries.map((country) => ({
              label: country,
              value: country,
            })),
          },
        ]}
        searchPlaceholder="Search name or email…"
        emptyMessage="No cases found"
        emptyDescription="Cases appear here as customers submit verification."
      />
  );
}
