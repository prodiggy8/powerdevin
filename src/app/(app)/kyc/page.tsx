import { FileCheck } from "lucide-react";

import { requireUser } from "@/core/auth";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default async function KycPage() {
  await requireUser();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader title="KYC review" description="Triage and decide on identity verification cases." />
      <EmptyState
        icon={FileCheck}
        title="KYC queue not built yet"
        description="This module lands in the next iteration; the shell, roles and audit trail it will use are already in place."
      />
    </div>
  );
}
