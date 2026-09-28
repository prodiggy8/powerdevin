Overview
  Add one internal tool to PowerDevin as a module on the existing foundation.
  A module is a Drizzle schema, a set of server actions, and pages that
  compose the primitives in src/core. It never re-implements auth, RBAC,
  audit or tables. The module spec is provided with the session prompt.

  What I need from the user
  - The module spec: name, tables, roles, pages, seed volume, tests.
  - Confirmation of the base branch (default: main).

  Procedure
  1. Read src/core/* and one existing consumer (src/app/(app)/admin/users)
     before writing anything. Match its patterns exactly.
  2. Create the branch devin/<module>-module from the base branch.
  3. Schema: src/modules/<module>/schema.ts. Re-export from
     src/db/schema/index.ts with one line. Generate one migration with
     drizzle-kit named <module>_init. Do not edit existing migrations.
  4. Actions: src/modules/<module>/actions.ts, all "use server". Every
     action starts with requireRole or requireUser, validates input with Zod,
     and performs every write inside db.transaction with withAudit(tx, ...)
     in the same transaction. Action names follow <entity>.<verb>, for
     example kyc_case.approved.
  5. Queries: src/modules/<module>/queries.ts. List queries accept
     DataTableQuery from parseDataTableQuery and return { rows, total }.
     Sort and filter columns are allow-listed.
  6. Pages: src/app/(app)/<module>/page.tsx for the list, using DataTable.
     Detail or form pages beside it. Forms use SchemaForm with a Zod schema
     and validateFormData.
  7. Navigation: add one entry to the sidebar nav config. Mark the module
     ready on the home page card.
  8. Seed: src/db/seed/<module>.ts, imported with one line in
     src/db/seed/index.ts. Idempotent, uses seeded users as actors,
     spreads timestamps over the last 90 days.
  9. Tests: unit tests for pure helpers, integration tests for each action
     asserting the audit row and the RBAC rejections, following the
     patterns in the existing tests.
  10. Verify: npm run lint, typecheck, test:all pass. Fresh path works:
      db:migrate, db:seed, dev; open the module's pages as an admin session.
  11. Open a PR titled "<module> module". Description: files created, shared
      files touched (must be only the three allowed), decisions not in the
      spec, time spent, anything not done.

  Specifications
  - Shared files you may edit, one line each: src/db/schema/index.ts,
    src/db/seed/index.ts, the sidebar nav config. Nothing else outside
    src/modules/<module>, src/app/(app)/<module>, src/db/seed/<module>.ts,
    the new migration, and new test files.
  - Any row a user can act on shows its audit trail on the detail page,
    read from audit_log by entity and entityId, newest first.
  - Role gates are enforced in actions, not only in the UI. Hide controls the
    role cannot use, and still reject in the action.
  - Money is numeric(14,2). Enums are pgEnum. IDs are text uuid like users.
  - No new runtime dependencies. If you believe one is needed, stop and say
    why in the PR instead of adding it.

  Advice
  - Read the audit-in-transaction test for updateUserRole first. Copy its
    shape for every action.
  - Another module is being built in a parallel session. Keep to your paths
    and the three shared one-line edits so the branches merge cleanly.
  - Prefer server components. Client components only where interaction
    requires it, as in users-table.tsx.

  Forbidden
  - Editing src/core, src/proxy.ts, auth config, or existing migrations.
  - Adding providers, API keys, or external services.
  - Writing to any table without withAudit in the same transaction.
  - Spending more than 40 minutes. Stop, push, and list what is not done.
