import Link from "next/link";
import { Plus } from "lucide-react";

import { requireRole } from "@/core/auth";
import { parseDataTableQuery } from "@/core/data-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  REFUND_FILTERS,
  REFUND_SORTABLE,
  listRefunds,
  refundStats,
} from "@/modules/refunds/queries";
import { REFUND_THRESHOLD, formatMoney } from "@/modules/refunds/rules";
import { RefundsTable, type RefundTableRow } from "./refunds-table";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-0 shadow-none">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending" value={String(stats.pendingCount)} />
        <StatCard label="Pending total" value={formatMoney(stats.pendingTotal)} />
        <StatCard
          label="Approved, not paid"
          value={formatMoney(stats.approvedUnpaidTotal)}
        />
        <StatCard
          label="Avg. hours to decision (30d)"
          value={
            stats.avgHoursToDecision === null
              ? "—"
              : stats.avgHoursToDecision.toFixed(1)
          }
        />
      </div>
      <RefundsTable data={data} total={total} query={query} />
    </div>
  );
}
