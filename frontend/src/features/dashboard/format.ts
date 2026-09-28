import type { AnalyticsRange } from "./api";

export const RANGE_LABELS: Record<AnalyticsRange, string> = {
  LAST_30_DAYS: "Last 30 days",
  LAST_90_DAYS: "Last 90 days",
  THIS_YEAR: "This year",
  LAST_12_MONTHS: "Last 12 months",
};

export const RANGES = Object.keys(RANGE_LABELS) as AnalyticsRange[];
export const DEFAULT_RANGE: AnalyticsRange = "LAST_12_MONTHS";

export function parseRange(value: string | undefined): AnalyticsRange {
  return value && (RANGES as string[]).includes(value) ? (value as AnalyticsRange) : DEFAULT_RANGE;
}

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const wholeCurrency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Money for headline figures and axes: $950, $12.5K, $4.2M. Exact values live in tooltips and tables. */
export function formatMoneyCompact(value: number): string {
  return Math.abs(value) < 10_000 ? wholeCurrency.format(value) : compactCurrency.format(value);
}

/**
 * A percentage the API may not be able to give (no closed deals, no quota). Missing is shown as "—", never as 0%,
 * so an absence of data is not mistaken for a result.
 */
export function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`;
}

const monthShort = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const monthLong = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const dayShort = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const dayLong = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

const asDate = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);

/** Axis label for a trend bucket (dates are UTC calendar dates from the API). */
export function bucketLabel(isoDate: string, bucket: "WEEK" | "MONTH"): string {
  return bucket === "MONTH" ? monthShort.format(asDate(isoDate)) : dayShort.format(asDate(isoDate));
}

/** Tooltip / table label for a trend bucket. */
export function bucketTitle(isoDate: string, bucket: "WEEK" | "MONTH"): string {
  return bucket === "MONTH" ? monthLong.format(asDate(isoDate)) : `Week of ${dayLong.format(asDate(isoDate))}`;
}

export function periodSummary(from: string, to: string): string {
  return `${dayLong.format(asDate(from))} – ${dayLong.format(asDate(to))}`;
}
