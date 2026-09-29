"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { decideRefund, markPaid } from "@/modules/refunds/actions";

export function DecisionPanel({
  refundId,
  canDecide,
  canMarkPaid,
}: {
  refundId: string;
  canDecide: boolean;
  canMarkPaid: boolean;
}) {
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const decide = (decision: "approve" | "reject") => {
    startTransition(async () => {
      const result = await decideRefund({ refundId, decision, note });
      if (result.ok) {
        toast.success(decision === "approve" ? "Refund approved" : "Refund rejected");
        setNote("");
      } else {
        toast.error(result.error);
      }
    });
  };

  const pay = () => {
    startTransition(async () => {
      const result = await markPaid({ refundId });
      if (result.ok) toast.success("Refund marked paid");
      else toast.error(result.error);
    });
  };

  return (
    <div className="space-y-3">
      {canDecide ? (
        <>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Decision note (required to reject)"
            aria-label="Decision note"
            disabled={isPending}
          />
          <div className="flex gap-2">
            <Button disabled={isPending} onClick={() => decide("approve")}>
              Approve
            </Button>
            <Button
              variant="destructive"
              disabled={isPending || !note.trim()}
              onClick={() => decide("reject")}
            >
              Reject
            </Button>
          </div>
        </>
      ) : null}
      {canMarkPaid ? (
        <Button variant="outline" disabled={isPending} onClick={pay}>
          Mark paid
        </Button>
      ) : null}
    </div>
  );
}
