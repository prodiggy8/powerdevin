import Link from "next/link";

import { requireUser } from "@/core/auth";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FLAG_BOARD_COLUMNS,
  FLAG_BOARD_COLUMN_DESCRIPTIONS,
  FLAG_BOARD_COLUMN_LABELS,
  groupFlagsByColumn,
} from "@/modules/flags/board";
import { FLAG_ENVIRONMENTS } from "@/modules/flags/policy";
import { listAllFlags, type FlagListRow } from "@/modules/flags/queries";

function FlagCard({ flag }: { flag: FlagListRow }) {
  return (
    <Link
      href={`/flags/${flag.id}`}
      className="bg-card hover:border-primary/40 block rounded-lg border p-3 transition-colors"
    >
      <p className="font-mono text-sm font-medium">{flag.key}</p>
      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
        {flag.description}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {FLAG_ENVIRONMENTS.map((environment) => {
          const state = flag.states.find(
            (candidate) => candidate.environment === environment,
          );
          return (
            <Badge
              key={environment}
              variant={state?.enabled ? "default" : "outline"}
              className="font-mono text-[10px]"
            >
              {environment} {state?.enabled ? `${state.rolloutPercent}%` : "off"}
            </Badge>
          );
        })}
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        {flag.ownerName ?? flag.ownerEmail ?? "Unassigned"}
      </p>
    </Link>
  );
}

export default async function FlagBoardPage() {
  await requireUser();

  const flags = await listAllFlags();
  const board = groupFlagsByColumn(flags);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Feature flag board"
        description="Read-only view of where each flag sits in the dev to prod lifecycle."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/flags">Table view</Link>
          </Button>
        }
      />
      {flags.length === 0 ? (
        <EmptyState
          title="No flags yet"
          description="Create a flag to see it on the board."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {FLAG_BOARD_COLUMNS.map((column) => (
            <section
              key={column}
              className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-3"
            >
              <header>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-medium">
                    {FLAG_BOARD_COLUMN_LABELS[column]}
                  </h2>
                  <Badge variant="secondary">{board[column].length}</Badge>
                </div>
                <p className="text-muted-foreground text-xs">
                  {FLAG_BOARD_COLUMN_DESCRIPTIONS[column]}
                </p>
              </header>
              <div className="flex flex-col gap-2">
                {board[column].map((flag) => (
                  <FlagCard key={flag.id} flag={flag} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
