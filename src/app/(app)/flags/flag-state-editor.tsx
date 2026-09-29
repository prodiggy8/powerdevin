"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Role } from "@/core/rbac";
import { formatDateTime } from "@/lib/format";
import { setFlagState } from "@/modules/flags/actions";
import {
  canChangeEnvironment,
  ENV_LABELS,
  MAX_PROD_ROLLOUT_JUMP,
  PROD_REASON_MIN_LENGTH,
} from "@/modules/flags/policy";
import type { FlagEnvironment } from "@/modules/flags/schema";
import { Switch } from "./switch";

/** Detail-page control for one environment: enabled, rollout and prod reason. */
export function FlagStateEditor({
  flagId,
  flagKey,
  environment,
  enabled,
  rolloutPercent,
  updatedAt,
  updatedBy,
  role,
  archived,
}: {
  flagId: string;
  flagKey: string;
  environment: FlagEnvironment;
  enabled: boolean;
  rolloutPercent: number;
  updatedAt: string;
  updatedBy: string | null;
  role: Role;
  archived: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [nextEnabled, setNextEnabled] = useState(enabled);
  const [nextPercent, setNextPercent] = useState(String(rolloutPercent));
  const [reason, setReason] = useState("");
  const allowed = canChangeEnvironment(role, environment) && !archived;
  const isProd = environment === "prod";

  const dirty =
    nextEnabled !== enabled || Number(nextPercent) !== rolloutPercent;

  const save = () => {
    startTransition(async () => {
      const result = await setFlagState({
        flagId,
        environment,
        enabled: nextEnabled,
        rolloutPercent: Number(nextPercent),
        reason: isProd ? reason : undefined,
      });
      if (result.ok) {
        setReason("");
        toast.success(`${flagKey} updated in ${ENV_LABELS[environment]}.`);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-3 rounded-sm border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{ENV_LABELS[environment]}</span>
        <Switch
          checked={nextEnabled}
          disabled={!allowed || isPending}
          aria-label={`${flagKey} in ${ENV_LABELS[environment]}`}
          onCheckedChange={setNextEnabled}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`rollout-${environment}`}>Rollout percent</Label>
        <Input
          id={`rollout-${environment}`}
          type="number"
          min={0}
          max={100}
          value={nextPercent}
          disabled={!allowed || isPending}
          onChange={(event) => setNextPercent(event.target.value)}
        />
        {isProd ? (
          <p className="text-xs text-muted-foreground">
            Prod may not move more than {MAX_PROD_ROLLOUT_JUMP} points at a
            time.
          </p>
        ) : null}
      </div>

      {isProd && allowed ? (
        <div className="space-y-1.5">
          <Label htmlFor={`reason-editor-${environment}`}>Reason</Label>
          <Textarea
            id={`reason-editor-${environment}`}
            value={reason}
            disabled={isPending}
            onChange={(event) => setReason(event.target.value)}
            placeholder={`At least ${PROD_REASON_MIN_LENGTH} characters.`}
          />
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Updated {formatDateTime(updatedAt)}
        {updatedBy ? ` by ${updatedBy}` : ""}
      </p>

      {allowed ? (
        <Button disabled={!dirty || isPending} onClick={save}>
          Save {ENV_LABELS[environment]}
        </Button>
      ) : null}
    </div>
  );
}
