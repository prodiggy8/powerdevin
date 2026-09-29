import { notFound } from "next/navigation";

import { requireUser } from "@/core/auth";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import {
  ACTION_LABELS,
  canArchiveFlag,
  FLAG_ENVIRONMENTS,
} from "@/modules/flags/policy";
import { getFlag, getFlagAuditTrail } from "@/modules/flags/queries";
import { ArchiveFlagButton } from "../archive-flag-button";
import { FlagStateEditor } from "../flag-state-editor";

function formatChange(value: unknown) {
  if (!value || typeof value !== "object") return "—";
  return Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== null && entry !== undefined)
    .map(([name, entry]) => `${name}: ${String(entry)}`)
    .join(", ");
}

export default async function FlagDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const flag = await getFlag(id);
  if (!flag) notFound();

  const trail = await getFlagAuditTrail(
    flag.id,
    flag.states.map((state) => state.id),
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={flag.key}
        description={flag.description}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {flag.ownerName ?? flag.ownerEmail ?? flag.ownerId}
            </Badge>
            {flag.archived ? <Badge variant="outline">Archived</Badge> : null}
            {!flag.archived && canArchiveFlag(user.role) ? (
              <ArchiveFlagButton flagId={flag.id} flagKey={flag.key} />
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {FLAG_ENVIRONMENTS.map((environment) => {
          const state = flag.states.find(
            (candidate) => candidate.environment === environment,
          );
          if (!state) return null;
          return (
            <FlagStateEditor
              key={state.id}
              flagId={flag.id}
              flagKey={flag.key}
              environment={environment}
              enabled={state.enabled}
              rolloutPercent={state.rolloutPercent}
              updatedAt={state.updatedAt}
              updatedBy={state.updatedByName ?? state.updatedByEmail}
              role={user.role}
              archived={flag.archived}
            />
          );
        })}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Audit trail</h2>
        {trail.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No changes recorded yet.
          </p>
        ) : (
          <ul className="divide-y rounded-sm border">
            {trail.map((entry) => (
              <li key={entry.id} className="space-y-1 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </span>
                  <span className="text-muted-foreground">
                    {entry.actorName ?? entry.actorEmail ?? "system"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatChange(entry.before)} → {formatChange(entry.after)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
