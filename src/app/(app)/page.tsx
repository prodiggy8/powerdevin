import Link from "next/link";
import { FileCheck, Flag, ReceiptText, Users } from "lucide-react";

import { requireUser } from "@/core/auth";
import type { DataTableQuery } from "@/core/data-table";
import { hasRole } from "@/core/rbac";
import { listFlags } from "@/modules/flags/queries";
import { countKycCases } from "@/modules/kyc/queries";
import { listRefunds } from "@/modules/refunds/queries";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function countQuery(filters: Record<string, string>): DataTableQuery {
  return { page: 1, pageSize: 1, order: "desc", search: "", filters };
}

function ModuleCard({
  href,
  title,
  description,
  icon: Icon,
  count,
}: {
  href: string;
  title: string;
  description: string;
  icon: typeof FileCheck;
  count?: string;
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full gap-0 shadow-none transition-colors group-hover:border-foreground/30">
        <CardHeader>
          <Icon className="mb-3 size-5 text-muted-foreground" />
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
          {count ? (
            <p className="mt-3 text-sm font-medium tabular-nums">{count}</p>
          ) : null}
        </CardHeader>
      </Card>
    </Link>
  );
}

export default async function HomePage() {
  const user = await requireUser();

  const [pendingCases, awaitingApprover, prodFlags] = await Promise.all([
    countKycCases(countQuery({ status: "pending" })),
    listRefunds(countQuery({ status: "pending", threshold: "above" })),
    listFlags(countQuery({ enabledIn: "prod" })),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader title="Operations console" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ModuleCard
          href="/kyc"
          title="KYC review queue"
          description="Triage and decide on identity verification cases."
          icon={FileCheck}
          count={`${pendingCases} pending`}
        />
        <ModuleCard
          href="/refunds"
          title="Refunds dashboard"
          description="Review refund requests and approvals above threshold."
          icon={ReceiptText}
          count={`${awaitingApprover.total} awaiting approver`}
        />
        <ModuleCard
          href="/flags"
          title="Feature flags"
          description="Toggle feature flags per environment."
          icon={Flag}
          count={`${prodFlags.total} ${prodFlags.total === 1 ? "flag" : "flags"} on in prod`}
        />
        {hasRole(user.role, "admin") ? (
          <ModuleCard
            href="/admin/users"
            title="Users & roles"
            description="Manage staff access and roles."
            icon={Users}
          />
        ) : null}
      </div>
    </div>
  );
}
