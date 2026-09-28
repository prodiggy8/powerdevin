import { ReceiptText } from "lucide-react";

import { requireUser } from "@/core/auth";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default async function RefundsPage() {
  await requireUser();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader title="Refunds" description="Review refund requests and approvals above threshold." />
      <EmptyState
        icon={ReceiptText}
        title="Refunds dashboard not built yet"
        description="This module lands in the next iteration; approvals above threshold will use src/core/approvals."
      />
    </div>
  );
}
