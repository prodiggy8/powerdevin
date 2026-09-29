"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { Role } from "@/core/rbac";
import { claimCase, decideCase, reassignCase } from "@/modules/kyc/actions";
import {
  canClaim,
  canDecide,
  MIN_REASON_LENGTH,
  type Decision,
} from "@/modules/kyc/policy";
import type { KycStatus } from "@/modules/kyc/schema";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const DECISION_LABEL: Record<Decision, string> = {
  approve: "Approve",
  reject: "Reject",
  escalate: "Escalate",
};

const DECISION_DONE: Record<Decision, string> = {
  approve: "Case approved.",
  reject: "Case rejected.",
  escalate: "Case escalated.",
};

export function DecisionPanel({
  caseId,
  status,
  riskScore,
  role,
  reviewers,
}: {
  caseId: string;
  status: KycStatus;
  riskScore: number;
  role: Role;
  reviewers: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [assignee, setAssignee] = useState("");
  const [isPending, startTransition] = useTransition();

  const claimable = canClaim({ status });
  const decidable = canDecide(role, { status, riskScore });
  const reasonTooShort = reason.trim().length < MIN_REASON_LENGTH;

  function run(action: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(done);
        setReason("");
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Decision</h2>
        <p className="text-sm text-muted-foreground">
          {decidable.ok
            ? `Every decision needs a reason of at least ${MIN_REASON_LENGTH} characters.`
            : decidable.error}
        </p>
      </div>
      <div className="space-y-4 rounded-sm border p-3">
        {claimable.ok ? (
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => claimCase({ caseId }), "Case claimed.")}
          >
            Claim case
          </Button>
        ) : null}

        {decidable.ok ? (
          <div className="space-y-3">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason for the decision…"
              aria-label="Decision reason"
              rows={3}
            />
            <div className="flex flex-wrap gap-2">
              {(Object.keys(DECISION_LABEL) as Decision[]).map((decision) => (
                <Button
                  key={decision}
                  variant={decision === "approve" ? "default" : "outline"}
                  disabled={isPending || reasonTooShort}
                  onClick={() =>
                    run(
                      () => decideCase({ caseId, decision, reason }),
                      DECISION_DONE[decision],
                    )
                  }
                >
                  {DECISION_LABEL[decision]}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {role === "admin" ? (
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Reassign to…" />
              </SelectTrigger>
              <SelectContent>
                {reviewers.map((reviewer) => (
                  <SelectItem key={reviewer.id} value={reviewer.id}>
                    {reviewer.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={isPending || !assignee}
              onClick={() =>
                run(
                  () => reassignCase({ caseId, userId: assignee }),
                  "Case reassigned.",
                )
              }
            >
              Reassign
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
