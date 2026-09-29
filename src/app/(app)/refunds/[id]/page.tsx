import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireRole } from "@/core/auth";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { getRefund, refundAuditTrail } from "@/modules/refunds/queries";
import {
  ACTION_LABELS,
  APPROVAL_STATUS_LABELS,
  REASON_LABELS,
  canDecide,
  canMarkPaid,
  formatMoney,
  needsApprover,
} from "@/modules/refunds/rules";
import {
  NeedsApproverBadge,
  RefundStatusBadge,
} from "@/modules/refunds/status-badge";
import { DecisionPanel } from "./decision-panel";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function RefundDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireRole("analyst");
  const { id } = await params;
  const { created } = await searchParams;

  const detail = await getRefund(id);
  if (!detail) notFound();
  const { refund, approval } = detail;
  const trail = await refundAuditTrail(refund.id, approval?.request.id);

  const aboveThreshold = needsApprover(refund.amount);
  const isRequester = refund.requestedBy === actor.id;
  const decidable =
    refund.status === "pending" &&
    canDecide(actor.role, refund.amount) &&
    !(aboveThreshold && isRequester);
  const payable = canMarkPaid(actor.role, refund.status);

  let blockedReason: string | null = null;
  if (refund.status === "pending" && !decidable) {
    blockedReason = !canDecide(actor.role, refund.amount)
      ? "This refund is at or above the threshold and needs an approver."
      : "You requested this refund, so a different approver must decide it.";
  } else if (refund.status === "approved" && !payable) {
    blockedReason = "An approver or admin marks approved refunds as paid.";
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={`Refund ${refund.orderRef}`}
        description={`${refund.customerName} · ${refund.customerEmail}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/refunds">
              <ArrowLeft className="size-4" />
              All refunds
            </Link>
          </Button>
        }
      />

      {created === "direct" || created === "approval" ? (
        <div className="rounded-sm border bg-muted/40 p-3 text-sm">
          {created === "approval"
            ? "Submitted for approval: the amount is at or above the threshold, so an approval request was opened and an approver other than you must decide it."
            : "Submitted: the amount is below the threshold, so an analyst can approve or reject it directly."}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-none lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="tabular-nums">
                {formatMoney(refund.amount, refund.currency)}
              </span>
              <RefundStatusBadge status={refund.status} />
              {refund.status === "pending" && aboveThreshold ? (
                <NeedsApproverBadge />
              ) : null}
            </CardTitle>
            <CardDescription>{REASON_LABELS[refund.reason]}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Requested by">
                {detail.requesterName ?? detail.requesterEmail ?? "—"}
              </Field>
              <Field label="Requested at">{formatDateTime(refund.requestedAt)}</Field>
              <Field label="Decided by">
                {detail.deciderName ?? detail.deciderEmail ?? "—"}
              </Field>
              <Field label="Decided at">{formatDateTime(refund.decidedAt)}</Field>
              <Field label="Paid at">{formatDateTime(refund.paidAt)}</Field>
              <Field label="Currency">{refund.currency}</Field>
              <Field label="Note">{refund.note ?? "—"}</Field>
              <Field label="Decision note">{refund.decisionNote ?? "—"}</Field>
            </dl>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Decision</CardTitle>
              <CardDescription>
                {refund.status === "rejected" || refund.status === "paid"
                  ? "This refund is final."
                  : (blockedReason ?? "Choose how to proceed.")}
              </CardDescription>
            </CardHeader>
            {decidable || payable ? (
              <CardContent>
                <DecisionPanel
                  refundId={refund.id}
                  canDecide={decidable}
                  canMarkPaid={payable}
                />
              </CardContent>
            ) : null}
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Approval request</CardTitle>
              <CardDescription>
                {approval
                  ? `Threshold ${formatMoney(approval.request.threshold ?? "0", refund.currency)}`
                  : "Below threshold, no approval request needed."}
              </CardDescription>
            </CardHeader>
            {approval ? (
              <CardContent>
                <dl className="grid gap-3">
                  <Field label="Status">
                    <Badge variant="outline">
                      {APPROVAL_STATUS_LABELS[approval.request.status]}
                    </Badge>
                  </Field>
                  <Field label="Approver">{approval.approverName ?? "—"}</Field>
                  <Field label="Opened">{formatDateTime(approval.request.createdAt)}</Field>
                  <Field label="Decided">{formatDateTime(approval.request.decidedAt)}</Field>
                </dl>
              </CardContent>
            ) : null}
          </Card>
        </div>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Audit trail</CardTitle>
          <CardDescription>Newest first, from the audit log.</CardDescription>
        </CardHeader>
        <CardContent>
          {trail.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries.</p>
          ) : (
            <ol className="space-y-3">
              {trail.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-3 text-sm last:border-0 last:pb-0">
                  <span className="font-medium">
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </span>
                  <span>{entry.actorName ?? entry.actorEmail ?? "System"}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
