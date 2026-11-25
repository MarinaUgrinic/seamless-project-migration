export type Channel = "meta" | "google_ads";
export type Granularity = "daily" | "weekly" | "monthly";
export interface PerfRow {
  date: string; // YYYY-MM-DD
  channel: Channel;
  spend: number;
  impressions: number;
  clicks: number;
  website_sessions?: number | null;
  view_item?: number | null;
  add_to_cart?: number | null;
  begin_checkout?: number | null;
  purchases?: number | null;
  purchase_revenue?: number | null;
}
export const WEB_FIELDS = ["website_sessions", "view_item", "add_to_cart", "begin_checkout", "purchases", "purchase_revenue"] as const;
export type WebField = (typeof WEB_FIELDS)[number];
export interface WebTotals {
  available: number; // rows with at least one known website field
  partial: boolean; // some field unknown on some selected row
  values: Record<WebField, number | null>; // null unless every selected row has a known value
  purchaseRate: number | null; // percent
  costPerPurchase: number | null;
  roas: number | null;
}
const known = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
/** Full-selection sums: a field is null unless every selected row has a known finite value. Ratios are sum-then-divide over the same full selection. */
export function webTotals(rows: PerfRow[]): WebTotals {
  const values = {} as Record<WebField, number | null>;
  for (const f of WEB_FIELDS) {
    values[f] = rows.length > 0 && rows.every((r) => known(r[f])) ? rows.reduce((a, r) => a + (r[f] as number), 0) : null;
  }
  const available = rows.filter((r) => WEB_FIELDS.some((f) => known(r[f]))).length;
  const partial = available > 0 && WEB_FIELDS.some((f) => values[f] === null);
  const spend = rows.length > 0 && rows.every((r) => known(r.spend)) ? rows.reduce((a, r) => a + r.spend, 0) : null;
  const s = values.website_sessions, p = values.purchases, rev = values.purchase_revenue;
  return {
    available, partial, values,
    purchaseRate: p != null && s ? (p / s) * 100 : null,
    costPerPurchase: spend != null && p ? spend / p : null,
    roas: rev != null && spend ? rev / spend : null,
  };
}
export interface Totals {
  rows: number;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null; // percent
  cpc: number | null;
}

export const CHANNEL_LABEL: Record<Channel, string> = { meta: "Meta", google_ads: "Google Ads" };

export function totals(rows: PerfRow[]): Totals {
  let spend = 0, impressions = 0, clicks = 0;
  for (const r of rows) { spend += r.spend; impressions += r.impressions; clicks += r.clicks; }
  return {
    rows: rows.length, spend, impressions, clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    cpc: clicks > 0 ? spend / clicks : null,
  };
}

export function filterRows<T extends PerfRow>(rows: T[], start: string, end: string, channel: "all" | Channel) {
  return rows.filter((r) => r.date >= start && r.date <= end && (channel === "all" || r.channel === channel));
}

function toUTC(d: string) { const [y, m, dd] = d.split("-").map(Number); return new Date(Date.UTC(y!, m! - 1, dd!)); }
function iso(d: Date) { return d.toISOString().slice(0, 10); }

export function bucketKey(date: string, g: Granularity): string {
  if (g === "daily") return date;
  if (g === "monthly") return date.slice(0, 7);
  const d = toUTC(date);
  const offset = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - offset);
  return iso(d);
}

export function aggregate(rows: PerfRow[], g: Granularity) {
  const map = new Map<string, { meta: number; google_ads: number; total: number }>();
  for (const r of rows) {
    const k = bucketKey(r.date, g);
    const b = map.get(k) ?? { meta: 0, google_ads: 0, total: 0 };
    b[r.channel] += r.spend; b.total += r.spend;
    map.set(k, b);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => ({ key, ...v }));
}

export const fmtEUR = (n: number | null) =>
  n === null ? "N/A" : new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
export const fmtInt = (n: number) => new Intl.NumberFormat("en-IE").format(n);
export const fmtPct = (n: number | null) => (n === null ? "N/A" : `${n.toFixed(2)}%`);
export const fmtSkopje = (ts: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Skopje", dateStyle: "medium", timeStyle: "short" }).format(new Date(ts)) + " (Skopje)";
export function bucketLabel(key: string, g: Granularity) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d ?? 1));
  const opts: Intl.DateTimeFormatOptions = g === "monthly" ? { month: "short", year: "numeric", timeZone: "UTC" } : { day: "2-digit", month: "short", timeZone: "UTC" };
  return (g === "weekly" ? "Wk " : "") + new Intl.DateTimeFormat("en-GB", opts).format(dt);
}

/** Calendar span of a bucket: Monday–Sunday weeks, calendar months, single days. */
export function bucketSpan(key: string, g: Granularity): { start: string; end: string } {
  if (g === "daily") return { start: key, end: key };
  if (g === "weekly") { const d = toUTC(key); d.setUTCDate(d.getUTCDate() + 6); return { start: key, end: iso(d) }; }
  const [y, m] = key.split("-").map(Number);
  return { start: `${key}-01`, end: iso(new Date(Date.UTC(y!, m!, 0))) };
}

/** Widens a date range to whole weeks/months for the chosen granularity, clamped to the available data. */
export function snapRange(start: string, end: string, g: Granularity, min: string, max: string) {
  const s = bucketSpan(bucketKey(start, g), g).start, e = bucketSpan(bucketKey(end, g), g).end;
  return { start: s < min ? min : s, end: e > max ? max : e };
}

/** Per-period totals (sum-then-divide); partial = the data covers only part of the calendar week/month. */
export function aggregatePeriods(rows: PerfRow[], g: Granularity) {
  const map = new Map<string, PerfRow[]>();
  for (const r of rows) { const k = bucketKey(r.date, g); map.set(k, [...(map.get(k) ?? []), r]); }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, rs]) => {
    const dates = rs.map((r) => r.date).sort();
    const from = dates[0]!, to = dates[dates.length - 1]!, span = bucketSpan(key, g);
    return { key, from, to, partial: from !== span.start || to !== span.end, t: totals(rs) };
  });
}
