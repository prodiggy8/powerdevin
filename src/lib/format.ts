type DateInput = Date | string | number | null | undefined;

const DATE_TIME = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const MONTH_DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const MONTH_DAY_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Sep 28, 2026, 2:05 PM" */
export function formatDateTime(value: DateInput): string {
  const date = toDate(value);
  return date ? DATE_TIME.format(date) : "—";
}

/** "Sep 28", or "Sep 28, 2025" outside the current year. */
export function formatDate(value: DateInput): string {
  const date = toDate(value);
  if (!date) return "—";
  return date.getFullYear() === new Date().getFullYear()
    ? MONTH_DAY.format(date)
    : MONTH_DAY_YEAR.format(date);
}
