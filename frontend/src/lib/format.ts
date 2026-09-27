const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const currencyPrecise = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const date = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export function formatCurrency(value: number | null | undefined, { precise = false } = {}): string {
  if (value === null || value === undefined) return "—";
  return (precise ? currencyPrecise : currency).format(value);
}

export function formatDate(iso: string): string {
  return date.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

const integer = new Intl.NumberFormat("en-US");
const dateOnly = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : integer.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

/** Calendar dates (e.g. close dates) are timezone-less: show them exactly as stored. */
export function formatCalendarDate(isoDate: string): string {
  return dateOnly.format(new Date(`${isoDate}T00:00:00Z`));
}
