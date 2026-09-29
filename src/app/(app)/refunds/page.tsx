import Link from "next/link";
import { Plus } from "lucide-react";

import { requireRole } from "@/core/auth";
import { parseDataTableQuery } from "@/core/data-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  REFUND_FILTERS,
  REFUND_SORTABLE,
  listRefunds,
  refundStats,
} from "@/modules/refunds/queries";
import { REFUND_THRESHOLD, formatMoney } from "@/modules/refunds/rules";
import { RefundsTable, type RefundTableRow } from "./refunds-table";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 space-y-1 px-4 py-3">
      <dt className="text-xs text-muted-foreground uppercase">{label}</dt>
      <dd className="text-lg tabular-nums">{value}</dd>
    </div>
  );
}

export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("analyst");

  const requested = parseDataTableQuery(await searchParams, {
    sortableColumns: Object.keys(REFUND_SORTABLE),
    filterColumns: [...REFUND_FILTERS],
  });

  const [stats, { rows, total, query }] = await Promise.all([
    refundStats(),
    listRefunds(requested),
  ]);

  const data: RefundTableRow[] = rows.map((row) => ({
    ...row,
    requestedAt: row.requestedAt.toISOString(),
  }));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Refunds"
        description={`Refunds of ${formatMoney(REFUND_THRESHOLD)} or more need a second approver.`}
        actions={
          <Button asChild size="sm">
            <Link href="/refunds/new">
              <Plus className="size-4" />
              New refund
            </Link>
          </Button>
        }
      />
      <dl className="flex divide-x rounded-sm border">
        <Stat label="Pending" value={String(stats.pendingCount)} />
        <Stat label="Pending total" value={formatMoney(stats.pendingTotal)} />
        <Stat
          label="Approved, not paid"
          value={formatMoney(stats.approvedUnpaidTotal)}
        />
        <Stat
          label="Avg. hours to decision (30d)"
          value={
            stats.avgHoursToDecision === null
              ? "—"
              : stats.avgHoursToDecision.toFixed(1)
          }
        />
      </dl>
      <RefundsTable data={data} total={total} query={query} />
    </div>
  );
}
