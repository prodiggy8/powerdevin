import Link from "next/link";

import { requireUser } from "@/core/auth";
import { hasRole } from "@/core/rbac";
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
    ready: false,
  },
  {
    href: "/refunds",
    title: "Refunds dashboard",
    description: "Review refund requests and approvals above threshold.",
    ready: false,
  },
  {
    href: "/flags",
    title: "Feature flags",
    description: "Toggle and audit feature flags per environment.",
    ready: false,
  },
];

export default async function HomePage() {
  const user = await requireUser();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Operations console</h1>
        <p className="text-muted-foreground">
          Signed in as {user.name ?? user.email}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((module) => (
          <Card key={module.href} className="opacity-60">
            <CardHeader>
              <CardTitle>{module.title}</CardTitle>
              <CardDescription>{module.description}</CardDescription>
              <p className="text-xs text-muted-foreground">Coming next</p>
            </CardHeader>
          </Card>
        ))}

        {hasRole(user.role, "admin") ? (
          <Link href="/admin/users">
            <Card className="h-full transition-colors hover:border-foreground/30">
              <CardHeader>
                <CardTitle>Users &amp; roles</CardTitle>
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
