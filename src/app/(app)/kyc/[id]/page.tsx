import { notFound } from "next/navigation";

import { requireUser } from "@/core/auth";
import { hasRole } from "@/core/rbac";
import { formatDateTime } from "@/lib/format";
import {
  ACTION_LABELS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
} from "@/modules/kyc/labels";
import {
  getKycCase,
  listCaseAudit,
  listReviewers,
} from "@/modules/kyc/queries";
import { RiskBadge, StatusBadge } from "@/modules/kyc/risk-badge";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { DecisionPanel } from "./decision-panel";

const DOCUMENT_VARIANT = {
  verified: "default",
  pending: "outline",
  rejected: "destructive",
} as const;

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <li className="flex items-baseline justify-between gap-4 p-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </li>
  );
}

export default async function KycCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const kycCase = await getKycCase(id);
  if (!kycCase) notFound();

  const [audit, reviewers] = await Promise.all([
    listCaseAudit(id),
    hasRole(user.role, "admin") ? listReviewers() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={kycCase.customerName}
        description={kycCase.customerEmail}
        actions={
          <>
            <RiskBadge score={kycCase.riskScore} />
            <StatusBadge status={kycCase.status} />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Customer</h2>
          <ul className="divide-y rounded-sm border">
            <Field label="Country" value={kycCase.country} />
            <Field label="Submitted" value={formatDateTime(kycCase.submittedAt)} />
            <Field
              label="Assignee"
              value={
                kycCase.assignee?.name ?? kycCase.assignee?.email ?? "Unassigned"
              }
            />
            <Field label="Decided" value={formatDateTime(kycCase.decidedAt)} />
            <Field
              label="Decided by"
              value={kycCase.decider?.name ?? kycCase.decider?.email ?? "—"}
            />
            <Field label="Reason" value={kycCase.decisionReason ?? "—"} />
          </ul>
        </section>

        <DecisionPanel
          caseId={kycCase.id}
          status={kycCase.status}
          riskScore={kycCase.riskScore}
          userId={user.id}
          role={user.role}
          assignedTo={kycCase.assignedTo}
          assigneeName={kycCase.assignee?.name ?? kycCase.assignee?.email ?? null}
          reviewers={reviewers.map((reviewer) => ({
            id: reviewer.id,
            label: reviewer.name ?? reviewer.email ?? reviewer.id,
          }))}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Documents</h2>
        {kycCase.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents.</p>
        ) : (
          <ul className="divide-y rounded-sm border">
            {kycCase.documents.map((document) => (
              <li
                key={document.fileName}
                className="flex items-center justify-between gap-4 p-3 text-sm"
              >
                <span className="font-medium">
                  {DOCUMENT_TYPE_LABELS[document.type] ?? document.type}
                </span>
                <span className="text-muted-foreground">
                  {document.fileName}
                </span>
                <Badge variant={DOCUMENT_VARIANT[document.status]}>
                  {DOCUMENT_STATUS_LABELS[document.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Audit trail</h2>
        {audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing has happened to this case yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {audit.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-3 text-sm last:border-0 last:pb-0"
              >
                <span className="font-medium">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </span>
                <span>{entry.actorName ?? "System"}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDateTime(entry.createdAt)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
