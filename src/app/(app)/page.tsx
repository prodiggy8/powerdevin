import Link from "next/link";
import { FileCheck, Flag, ReceiptText, Users } from "lucide-react";

import { requireUser } from "@/core/auth";
import { hasRole } from "@/core/rbac";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const MODULES = [
  {
    href: "/kyc",
    title: "KYC review queue",
    description: "Triage and decide on identity verification cases.",
    icon: FileCheck,
    ready: false,
  },
  {
    href: "/refunds",
    title: "Refunds dashboard",
    description: "Review refund requests and approvals above threshold.",
    icon: ReceiptText,
    ready: false,
  },
  {
    href: "/flags",
    title: "Feature flags",
    description: "Toggle and audit feature flags per environment.",
    icon: Flag,
    ready: false,
  },
];

export default async function HomePage() {
  const user = await requireUser();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Operations console"
        description={`Signed in as ${user.name ?? user.email}.`}
        actions={
          <Badge variant="secondary" className="h-7 px-2.5 capitalize">
            {user.role}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((module) => (
          <Card key={module.href} className="gap-0 shadow-none">
            <CardHeader>
              <module.icon className="mb-3 size-5 text-muted-foreground" />
              <CardTitle className="text-base">{module.title}</CardTitle>
              <CardDescription>{module.description}</CardDescription>
              <Badge variant="outline" className="mt-3 w-fit">
                Coming next
              </Badge>
            </CardHeader>
          </Card>
        ))}

        {hasRole(user.role, "admin") ? (
          <Link href="/admin/users" className="group">
            <Card className="h-full gap-0 shadow-none transition-colors group-hover:border-foreground/30">
              <CardHeader>
                <Users className="mb-3 size-5 text-muted-foreground" />
                <CardTitle className="text-base">Users &amp; roles</CardTitle>
                <CardDescription>
                  Manage access. Every role change is written to the audit log.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
