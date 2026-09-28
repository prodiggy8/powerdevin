import { requireUser } from "@/core/auth";
import { clampPage, parseDataTableQuery } from "@/core/data-table";
import {
  countKycCases,
  FILTER_COLUMNS,
  listCountries,
  listKycCases,
  SORTABLE_COLUMNS,
} from "@/modules/kyc/queries";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { QueueTable, type QueueRow } from "./queue-table";

export default async function KycPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();

  const requested = parseDataTableQuery(await searchParams, {
    sortableColumns: SORTABLE_COLUMNS,
    filterColumns: FILTER_COLUMNS,
  });

  const query = clampPage(requested, await countKycCases(requested));
  const [{ rows, total }, countries] = await Promise.all([
    listKycCases(query),
    listCountries(),
  ]);

  const data: QueueRow[] = rows.map((row) => ({
    ...row,
    submittedAt: row.submittedAt.toISOString(),
  }));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="KYC review"
        description="Triage and decide on identity verification cases. Oldest pending cases first."
        actions={
          <Badge variant="outline" className="h-7 px-2.5">
            {total} {total === 1 ? "case" : "cases"}
          </Badge>
        }
      />
      <QueueTable
        data={data}
        total={total}
        query={query}
        countries={countries}
      />
    </div>
  );
}
