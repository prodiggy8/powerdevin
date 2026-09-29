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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export function DecisionPanel({
  caseId,
  status,
  riskScore,
  userId,
  role,
  assignedTo,
  assigneeName,
  reviewers,
}: {
  caseId: string;
  status: KycStatus;
  riskScore: number;
  userId: string;
  role: Role;
  assignedTo: string | null;
  assigneeName: string | null;
  reviewers: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [assignee, setAssignee] = useState("");
  const [isPending, startTransition] = useTransition();

  const claimable = canClaim(
    { id: userId, role },
    { status, assignedTo, assigneeName },
  );
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
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Decision</CardTitle>
        <CardDescription>
          {decidable.ok
            ? `Every decision needs a reason of at least ${MIN_REASON_LENGTH} characters.`
            : decidable.error}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
                      `Case ${decision}d.`,
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
      </CardContent>
    </Card>
  );
}
