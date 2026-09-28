import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { riskBand } from "./policy";
import type { KycStatus } from "./schema";

const BAND_CLASS = {
  low: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  high: "bg-red-500/10 text-red-700 dark:text-red-400",
} as const;

export function RiskBadge({ score }: { score: number }) {
  const band = riskBand(score);
  return (
    <Badge variant="ghost" className={cn("capitalize", BAND_CLASS[band])}>
      {band} · {score}
    </Badge>
  );
}

const STATUS_LABEL: Record<KycStatus, string> = {
  pending: "Pending",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
  escalated: "Escalated",
};

const STATUS_VARIANT: Record<
  KycStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "outline",
  in_review: "secondary",
  approved: "default",
  rejected: "destructive",
  escalated: "destructive",
};

export function StatusBadge({ status }: { status: KycStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export { STATUS_LABEL };
