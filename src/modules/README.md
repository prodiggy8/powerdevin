# Modules

One directory per app, each composing the primitives in `src/core`:

- `kyc/` — KYC review queue
- `refunds/` — refunds dashboard (approvals above threshold)
- `flags/` — feature-flag admin panel

A module owns its Drizzle tables (re-exported from `src/db/schema`), its
server actions, and its route segment under `src/app/(app)`.
