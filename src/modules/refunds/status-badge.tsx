import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type RefundStatus } from "./rules";

const VARIANTS: Record<RefundStatus, "outline" | "secondary" | "default" | "destructive"> = {
  pending: "outline",
  approved: "secondary",
  paid: "default",
  rejected: "destructive",
};

export function RefundStatusBadge({ status }: { status: RefundStatus }) {
  return (
    <Badge variant={VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
  );
}

export function NeedsApproverBadge() {
  return (
    <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
      Needs approver
    </Badge>
  );
}
