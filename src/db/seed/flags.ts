import { eq, inArray, like } from "drizzle-orm";

import { auditLog, featureFlags, featureFlagStates, users } from "../schema";
import { FLAG_ENVIRONMENTS } from "../../modules/flags/policy";
import { SEED_EMAIL_DOMAIN } from "./users";
import type { SeedContext, SeedModule } from "./types";

export const SEED_FLAG_AUDIT_ID_PREFIX = "seed-flag-audit-";

const DAY_MS = 24 * 60 * 60 * 1000;
const STATE_AUDIT_ROW_COUNT = 40;

type FlagFixture = { key: string; description: string; archived: boolean };

const FLAGS: FlagFixture[] = [
  ["instant_refunds_v2", "Settle eligible refunds instantly instead of T+1."],
  ["kyc_doc_ocr", "Run OCR over uploaded identity documents before review."],
  ["new_limits_page", "Ship the redesigned spending-limits page."],
  ["card_freeze_self_serve", "Let customers freeze a card without support."],
  ["sepa_instant_payouts", "Route euro payouts over SEPA Instant."],
  ["risk_score_v3", "Score transactions with the v3 risk model."],
  ["merchant_dispute_portal", "Expose the dispute portal to merchants."],
  ["ach_same_day", "Submit ACH debits in the same-day window."],
  ["statement_pdf_v2", "Generate statements with the new PDF renderer."],
  ["onboarding_liveness_check", "Require a liveness selfie during onboarding."],
  ["fx_quote_streaming", "Stream FX quotes over websockets."],
  ["virtual_cards", "Issue virtual cards from the mobile app."],
  ["chargeback_autoresponder", "Auto-answer low-value chargebacks."],
  ["spend_insights_beta", "Show the spend-insights dashboard."],
  ["pix_payouts", "Enable BRL payouts over Pix."],
  ["ledger_double_write", "Double-write postings to the new ledger."],
  ["sanctions_screening_v2", "Screen counterparties with the v2 list."],
  ["mobile_app_biometrics", "Unlock the mobile app with biometrics."],
  ["payout_batching", "Batch payouts per merchant per hour."],
  ["support_copilot", "Draft support replies with the assistant."],
  ["invoice_reminders", "Send automatic invoice reminders."],
  ["treasury_sweeps", "Sweep idle balances into the treasury account."],
  ["legacy_csv_export", "Legacy CSV export of transactions."],
  ["beta_webhooks_v1", "First-generation webhook delivery."],
  ["old_dispute_emails", "Plain-text dispute notification emails."],
].map(([key, description], index) => ({
  key,
  description,
  // The last three keys are the retired ones.
  archived: index >= 22,
}));

/** Deterministic per flag and environment, so re-seeding is stable. */
function stateFor(flagIndex: number, envIndex: number) {
  const seed = flagIndex * 3 + envIndex;
  const enabled = envIndex === 0 ? seed % 5 !== 0 : seed % 3 !== 0;
  const partial = seed % 4 === 1;
  const rolloutPercent = !enabled ? 0 : partial ? ((seed * 7) % 9) * 10 + 5 : 100;
  return { enabled, rolloutPercent: Math.min(100, rolloutPercent) };
}

export const seedFlags: SeedModule = {
  name: "flags",
  async run({ db, reset }: SeedContext) {
    const keys = FLAGS.map((flag) => flag.key);

    if (reset) {
      await db
        .delete(auditLog)
        .where(like(auditLog.id, `${SEED_FLAG_AUDIT_ID_PREFIX}%`));
      await db.delete(featureFlags).where(inArray(featureFlags.key, keys));
    }

    const owners = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(like(users.email, `%@${SEED_EMAIL_DOMAIN}`));
    if (owners.length === 0) {
      return "0 flags (no seeded users to own them)";
    }
    const sortedOwners = [...owners].sort((a, b) =>
      (a.email ?? "").localeCompare(b.email ?? ""),
    );

    const now = Date.now();

    for (const [index, flag] of FLAGS.entries()) {
      const owner = sortedOwners[index % sortedOwners.length];
      const daysAgo = 89 - Math.round((index * 89) / (FLAGS.length - 1));
      await db
        .insert(featureFlags)
        .values({
          key: flag.key,
          description: flag.description,
          ownerId: owner.id,
          archived: flag.archived,
          createdAt: new Date(
            now - daysAgo * DAY_MS + ((index * 37) % 1440) * 60_000,
          ),
        })
        .onConflictDoUpdate({
          target: featureFlags.key,
          set: {
            description: flag.description,
            ownerId: owner.id,
            archived: flag.archived,
          },
        });
    }

    const inserted = await db
      .select({ id: featureFlags.id, key: featureFlags.key })
      .from(featureFlags)
      .where(inArray(featureFlags.key, keys));
    const idByKey = new Map(inserted.map((row) => [row.key, row.id]));

    let stateCount = 0;
    for (const [flagIndex, flag] of FLAGS.entries()) {
      const flagId = idByKey.get(flag.key);
      if (!flagId) continue;
      for (const [envIndex, environment] of FLAG_ENVIRONMENTS.entries()) {
        const { enabled, rolloutPercent } = stateFor(flagIndex, envIndex);
        const actor = sortedOwners[(flagIndex + envIndex) % sortedOwners.length];
        await db
          .insert(featureFlagStates)
          .values({
            flagId,
            environment,
            enabled,
            rolloutPercent,
            updatedBy: actor.id,
            updatedAt: new Date(
              now - ((flagIndex * 3 + envIndex) % 90) * DAY_MS,
            ),
          })
          .onConflictDoUpdate({
            target: [featureFlagStates.flagId, featureFlagStates.environment],
            set: { enabled, rolloutPercent, updatedBy: actor.id },
          });
        stateCount += 1;
      }
    }

    const states = await db
      .select({
        id: featureFlagStates.id,
        flagId: featureFlagStates.flagId,
        environment: featureFlagStates.environment,
        enabled: featureFlagStates.enabled,
        rolloutPercent: featureFlagStates.rolloutPercent,
      })
      .from(featureFlagStates)
      .where(
        inArray(
          featureFlagStates.flagId,
          inserted.map((row) => row.id),
        ),
      );
    const sortedStates = [...states].sort((a, b) => a.id.localeCompare(b.id));

    let auditCount = 0;
    for (let index = 0; index < STATE_AUDIT_ROW_COUNT; index += 1) {
      const state = sortedStates[index % sortedStates.length];
      if (!state) break;
      const actor = sortedOwners[index % sortedOwners.length];
      await db
        .insert(auditLog)
        .values({
          id: `${SEED_FLAG_AUDIT_ID_PREFIX}${String(index + 1).padStart(2, "0")}`,
          actorId: actor.id,
          action: "feature_flag_state.updated",
          entity: "feature_flag_state",
          entityId: state.id,
          before: {
            environment: state.environment,
            enabled: !state.enabled,
            rolloutPercent: 0,
          },
          after: {
            environment: state.environment,
            enabled: state.enabled,
            rolloutPercent: state.rolloutPercent,
            reason:
              state.environment === "prod"
                ? "Staged rollout approved in the weekly release review."
                : null,
          },
          createdAt: new Date(now - (index + 1) * 2 * DAY_MS),
        })
        .onConflictDoNothing();
      auditCount += 1;
    }

    const archived = await db
      .select({ id: featureFlags.id })
      .from(featureFlags)
      .where(eq(featureFlags.archived, true));

    return `${FLAGS.length} flags (${archived.length} archived), ${stateCount} states, ${auditCount} audit rows`;
  },
};
