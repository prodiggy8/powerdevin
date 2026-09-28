# Project scope (verbatim brief)

> This is our scope (please save in memory):
>
> - We are working for a Series C startup that currently spends 250k annually on power apps and they use it for 3 apps: a KYC review queue, a refunds dashboard, and a feature-flag admin panel
>
> - We will show them how you can build these for cheaper and better.
>
> Stack:
> NextJS since we're minimizing complexity (alternative is low-code)
> Local Postgres via docker compose, drizzle for ORM
> For UI use shadcn/ui, Tailwind, TanStack Table
> For auth use NextAuth
>
> 1. Create a repo named PowerDevin in my GH provider
>
> Format:
> src/core/ -> auth, rbac audit, approvals, data-table, schema-form
> src/modules/ -> each app goes here
> src/db -> db related
> docs/ -> copy this prompt inside this folder
>
> 2. Build an authentication page/scaffold
>
> It needs to have support for Microsoft SSO. Build assuming it works and then I will provide you with the Entra ID creds. It will be initially open to any personal MS account since this is a demo.
>
> Session and JWT carry role. Export auth(), requireUser(), requireRole() from src/core/auth.
>
> Every route except /login and /api/auth redirects unauthenticated users to /login
>
> /login: shadcn Card with one "Continue with Microsoft" button
>
> Roles are stored in the users table and the only sign-in path is Microsoft SSO, so the first admin has to come from somewhere. Use an environment variable SEED_ADMIN_EMAIL set to "gustavogabrielp@hotmail.com". In the sign-in callback, when a user row is created for the first time, compare the signed-in email to SEED_ADMIN_EMAIL (case-insensitive). If it matches, create the row with role admin; otherwise create it with role analyst.
>
> - audit_log table: id, actorId, action, entity, entityId, before jsonb, after jsonb, createdAt. Export withAudit(tx, ...) from src/core/audit so every mutation writes an audit row in the same transaction. Wire it into the role change in /admin/users.
> - src/core/approvals: schema for approval_requests (entity, entityId, requestedBy, approvedBy, status, threshold) and a stub requireSecondApprover() helper. No UI yet.
> - src/core/data-table: generic TanStack table with server-side pagination, sorting, and filtering props. Use it for /admin/users.
>
> After building successful authentication. Stop and PR. My turn to review.
