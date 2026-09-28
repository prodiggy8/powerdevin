"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable, type DataTableQuery } from "@/core/data-table";
import {
  REASON_LABELS,
  REFUND_REASONS,
  REFUND_STATUSES,
  formatMoney,
  needsApprover,
  type RefundReason,
  type RefundStatus,
} from "@/modules/refunds/rules";
import {
  NeedsApproverBadge,
  RefundStatusBadge,
} from "@/modules/refunds/status-badge";

export type RefundTableRow = {
  id: string;
  orderRef: string;
  customerName: string;
  customerEmail: string;
  amount: string;
  currency: string;
  reason: RefundReason;
  status: RefundStatus;
  requestedAt: string;
  requesterName: string | null;
};

export function RefundsTable({
  data,
  total,
  query,
}: {
  data: RefundTableRow[];
  total: number;
  query: DataTableQuery;
}) {
  const columns = useMemo<ColumnDef<RefundTableRow, unknown>[]>(
    () => [
      {
        accessorKey: "orderRef",
        header: "Order",
        enableHiding: false,
        cell: ({ row }) => (
          <Link
            href={`/refunds/${row.original.id}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {row.original.orderRef}
          </Link>
        ),
      },
      {
        accessorKey: "customerName",
        header: "Customer",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{row.original.customerName}</span>
            <span className="text-xs text-muted-foreground">
              {row.original.customerEmail}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="tabular-nums">
              {formatMoney(row.original.amount, row.original.currency)}
            </span>
            {row.original.status === "pending" &&
            needsApprover(row.original.amount) ? (
              <NeedsApproverBadge />
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => REASON_LABELS[row.original.reason],
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <RefundStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "requesterName",
        header: "Requested by",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.requesterName ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "requestedAt",
        header: "Requested",
        cell: ({ row }) =>
          new Date(row.original.requestedAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      total={total}
      query={query}
      sortableColumns={["requestedAt", "amount", "status"]}
      filters={[
        {
          id: "status",
          label: "Status",
          options: REFUND_STATUSES.map((status) => ({
            label: status,
            value: status,
          })),
        },
        {
          id: "reason",
          label: "Reason",
          options: REFUND_REASONS.map((reason) => ({
            label: REASON_LABELS[reason],
            value: reason,
          })),
        },
        {
          id: "threshold",
          label: "Threshold",
          options: [
            { label: "At or above 500.00", value: "above" },
            { label: "Below 500.00", value: "below" },
          ],
        },
      ]}
      searchPlaceholder="Search order, customer or email…"
      emptyMessage="No refunds found"
      emptyDescription="Refund requests appear here once submitted."
    />
  );
}
