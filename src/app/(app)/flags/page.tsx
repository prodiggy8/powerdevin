import Link from "next/link";

import { requireUser } from "@/core/auth";
import { clampPage, parseDataTableQuery } from "@/core/data-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { canCreateFlag } from "@/modules/flags/policy";
import {
  FLAG_FILTER_COLUMNS,
  FLAG_SORTABLE_COLUMNS,
  listFlagOwnerOptions,
  listFlags,
} from "@/modules/flags/queries";
import { FlagsTable } from "./flags-table";

export default async function FlagsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();

  const requested = parseDataTableQuery(await searchParams, {
    sortableColumns: [...FLAG_SORTABLE_COLUMNS],
    filterColumns: [...FLAG_FILTER_COLUMNS],
  });

  const firstPass = await listFlags(requested);
  const query = clampPage(requested, firstPass.total);
  const { rows, total } =
    query === requested ? firstPass : await listFlags(query);

  const owners = await listFlagOwnerOptions();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Feature flags"
        description="Toggle flags per environment. Every change is written to the audit log; prod needs a reason."
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link href="/flags/board">Board view</Link>
            </Button>
            {canCreateFlag(user.role) ? (
              <Button asChild size="sm">
                <Link href="/flags/new">New flag</Link>
              </Button>
            ) : null}
          </>
        }
      />
      <FlagsTable
        data={rows}
        total={total}
        query={query}
        role={user.role}
        ownerOptions={owners.map((owner) => ({
          label: owner.name ?? owner.email ?? owner.id,
          value: owner.id,
        }))}
      />
    </div>
  );
}
