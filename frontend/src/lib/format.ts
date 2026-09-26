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
