# PowerDevin

Internal operations console replacing three Power Apps: a KYC review queue, a
refunds dashboard, and a feature-flag admin panel. See
[docs/00-scope.md](docs/00-scope.md) for the brief.

Stack: Next.js (App Router) · Postgres + Drizzle · Auth.js v5 with Microsoft
Entra ID SSO · Tailwind + shadcn/ui · TanStack Table.

## Layout

```
src/core/      auth, rbac, audit, approvals, data-table, schema-form
src/modules/   one directory per app (kyc, refunds, flags)
src/db/        drizzle schema, migrations, client
src/app/       routes
docs/          project brief and notes
```

## Getting started

```bash
cp .env.example .env.local        # fill AUTH_SECRET and the Entra credentials
npm install
npm run db:up                     # postgres 17 via docker compose
npm run db:migrate                # apply drizzle migrations
npm run dev
```

`AUTH_SECRET` can be generated with `openssl rand -base64 32`.

### Microsoft Entra ID

The provider is configured against the `common` issuer so personal, work, and
school Microsoft accounts can sign in. Register the app in Entra with redirect
URI `http://localhost:3000/api/auth/callback/microsoft-entra-id` (plus the
deployed origin) and set `AUTH_MICROSOFT_ENTRA_ID_ID` and
`AUTH_MICROSOFT_ENTRA_ID_SECRET`.

Roles live in the `users` table (`admin`, `approver`, `analyst`). The first user
whose email matches `SEED_ADMIN_EMAIL` is created as an admin; everyone else
starts as an analyst. Admins change roles at `/admin/users`, and every change is
written to `audit_log` in the same transaction as the update.

## Scripts

| script | purpose |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm run lint` | eslint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | generate a migration from the schema |
| `npm run db:migrate` | apply migrations |
| `npm run db:studio` | drizzle studio |
