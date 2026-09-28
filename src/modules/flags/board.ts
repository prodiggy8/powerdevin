import type { FlagListRow, FlagStateSummary } from "./queries";

export const FLAG_BOARD_COLUMNS = [
  "off",
  "dev",
  "staging",
  "rolling_out",
  "live",
  "archived",
] as const;

export type FlagBoardColumn = (typeof FLAG_BOARD_COLUMNS)[number];

export const FLAG_BOARD_COLUMN_LABELS: Record<FlagBoardColumn, string> = {
  off: "Off everywhere",
  dev: "Dev only",
  staging: "In staging",
  rolling_out: "Rolling out in prod",
  live: "Live",
  archived: "Archived",
};

export const FLAG_BOARD_COLUMN_DESCRIPTIONS: Record<FlagBoardColumn, string> = {
  off: "Disabled in every environment.",
  dev: "Enabled in dev, not yet in staging.",
  staging: "Enabled in staging, not yet in prod.",
  rolling_out: "Enabled in prod below a full rollout.",
  live: "Enabled in prod at 100 percent.",
  archived: "Archived, kept for the audit trail.",
};

type BoardFlag = Pick<FlagListRow, "archived"> & {
  states: Pick<FlagStateSummary, "environment" | "enabled" | "rolloutPercent">[];
};

/** Where a flag sits in the dev -> staging -> prod lifecycle. */
export function flagBoardColumn(flag: BoardFlag): FlagBoardColumn {
  if (flag.archived) return "archived";

  const state = (environment: FlagStateSummary["environment"]) =>
    flag.states.find((candidate) => candidate.environment === environment);

  const prod = state("prod");
  if (prod?.enabled) {
    return prod.rolloutPercent >= 100 ? "live" : "rolling_out";
  }
  if (state("staging")?.enabled) return "staging";
  if (state("dev")?.enabled) return "dev";
  return "off";
}

export function groupFlagsByColumn<T extends BoardFlag>(
  flags: T[],
): Record<FlagBoardColumn, T[]> {
  const board = Object.fromEntries(
    FLAG_BOARD_COLUMNS.map((column) => [column, [] as T[]]),
  ) as Record<FlagBoardColumn, T[]>;

  for (const flag of flags) board[flagBoardColumn(flag)].push(flag);
  return board;
}
