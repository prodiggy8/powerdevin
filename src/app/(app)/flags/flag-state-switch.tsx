"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Role } from "@/core/rbac";
import { setFlagState } from "@/modules/flags/actions";
import {
  canChangeEnvironment,
  ENV_LABELS,
  PROD_REASON_MIN_LENGTH,
} from "@/modules/flags/policy";
import type { FlagEnvironment } from "@/modules/flags/schema";
import { Switch } from "./switch";

export function FlagStateSwitch({
  flagId,
  flagKey,
  environment,
  enabled,
  rolloutPercent,
  role,
  archived,
}: {
  flagId: string;
  flagKey: string;
  environment: FlagEnvironment;
  enabled: boolean;
  rolloutPercent: number;
  role: Role;
  archived: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const allowed = canChangeEnvironment(role, environment) && !archived;

  const submit = (next: boolean, withReason?: string) => {
    startTransition(async () => {
      const result = await setFlagState({
        flagId,
        environment,
        enabled: next,
        rolloutPercent: next ? Math.max(rolloutPercent, 1) : 0,
        reason: withReason,
      });
      if (result.ok) {
        setReasonOpen(false);
        setReason("");
        toast.success(
          `${flagKey} is now ${next ? "on" : "off"} in ${ENV_LABELS[environment]}.`,
        );
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <>
      <Switch
        checked={enabled}
        disabled={!allowed || isPending}
        aria-label={`${flagKey} in ${ENV_LABELS[environment]}`}
        onCheckedChange={(next) => {
          if (environment === "prod") {
            setReasonOpen(true);
            return;
          }
          submit(next);
        }}
      />

      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Turn {flagKey} {enabled ? "off" : "on"} in prod
            </DialogTitle>
            <DialogDescription>
              Prod changes need a reason of at least {PROD_REASON_MIN_LENGTH}{" "}
              characters. It is stored on the audit entry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`reason-${flagId}`}>Reason</Label>
            <Textarea
              id={`reason-${flagId}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why this change, and who asked for it."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReasonOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              disabled={isPending || reason.trim().length < PROD_REASON_MIN_LENGTH}
              onClick={() => submit(!enabled, reason)}
            >
              {enabled ? "Turn off" : "Turn on"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
