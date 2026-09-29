import { notFound } from "next/navigation";

import { requireUser } from "@/core/auth";
import { hasRole } from "@/core/rbac";
import {
  getKycCase,
  listCaseAudit,
  listReviewers,
} from "@/modules/kyc/queries";
import { RiskBadge, StatusBadge } from "@/modules/kyc/risk-badge";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DecisionPanel } from "./decision-panel";

const DOCUMENT_VARIANT = {
  verified: "default",
  pending: "outline",
  rejected: "destructive",
} as const;

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function formatDate(value: Date | null) {
  return value
    ? value.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "—";
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
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Customer</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Country" value={kycCase.country} />
            <Field
              label="Submitted"
              value={formatDate(kycCase.submittedAt)}
            />
            <Field
              label="Assignee"
              value={
                kycCase.assignee?.name ?? kycCase.assignee?.email ?? "Unassigned"
              }
            />
            <Field label="Decided" value={formatDate(kycCase.decidedAt)} />
            <Field
              label="Decided by"
              value={kycCase.decider?.name ?? kycCase.decider?.email ?? "—"}
            />
            <Field label="Reason" value={kycCase.decisionReason ?? "—"} />
          </CardContent>
        </Card>

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

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Documents</CardTitle>
          <CardDescription>
            Placeholder records until the document store lands.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {kycCase.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents.</p>
          ) : (
            kycCase.documents.map((document) => (
              <div
                key={document.fileName}
                className="flex items-center justify-between rounded-sm border px-3 py-2 text-sm"
              >
                <span className="font-medium capitalize">{document.type}</span>
                <span className="text-muted-foreground">
                  {document.fileName}
                </span>
                <Badge variant={DOCUMENT_VARIANT[document.status]}>
                  {document.status}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Audit trail</CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing has happened to this case yet.
            </p>
          ) : (
            audit.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center gap-2 rounded-sm border px-3 py-2 text-sm"
              >
                <Badge variant="outline">{entry.action}</Badge>
                <span className="text-muted-foreground">
                  {entry.actorName ?? "system"}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDate(entry.createdAt)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
