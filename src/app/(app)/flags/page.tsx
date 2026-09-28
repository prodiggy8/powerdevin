import { Flag } from "lucide-react";

import { requireUser } from "@/core/auth";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default async function FlagsPage() {
  await requireUser();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader title="Feature flags" description="Toggle and audit feature flags per environment." />
      <EmptyState
        icon={Flag}
        title="Feature flag admin not built yet"
        description="This module lands in the next iteration; every toggle will be written to the audit log."
      />
    </div>
  );
}
