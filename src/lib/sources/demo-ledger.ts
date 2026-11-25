import { bucketKey, bucketSpan, type Granularity } from "../metrics";
import type { MappedRecord } from "./readers";

export const DEMO_CHANNELS = ["meta", "google_ads", "youtube", "spotify", "ga4", "lwm", "tv", "stores"] as const;
export type DemoChannel = typeof DEMO_CHANNELS[number];
export const DEMO_CHANNEL_LABELS: Record<DemoChannel, string> = { meta: "Meta", google_ads: "Google Ads", youtube: "YouTube", spotify: "Spotify", ga4: "Website (GA4)", lwm: "LWM", tv: "TV", stores: "Stores" };
export const isDemoChannel = (v: unknown): v is DemoChannel => DEMO_CHANNELS.some(c => c === v);
export const MEDIA_CHANNELS: readonly DemoChannel[] = DEMO_CHANNELS.filter(c => c !== "ga4" && c !== "stores");
export interface LedgerRow { date: string; channel: DemoChannel; metrics: Record<string, number | string | null>; record: MappedRecord }
export function ledgerRows(records: MappedRecord[]): LedgerRow[] {
  return records.filter(r => r.source_id === "simulation" && r.record_kind === "simulated_daily").map(r => {
    const channel = r.metrics["channel"];
    if (!isDemoChannel(channel)) throw new Error("Saved synthetic ledger has an unsupported channel.");
    return { date: r.period_start, channel, metrics: r.metrics, record: r };
  });
}
export function selectLedger(rows: LedgerRow[], start: string, end: string, channel: "all" | DemoChannel) {
  return rows.filter(r => r.date >= start && r.date <= end && (channel === "all" || channel === r.channel));
}
export function value(row: LedgerRow, key: string): number {
  const n = row.metrics[key];
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) throw new Error(`Saved generated field ${key} is incomplete. Re-import the canonical samples.`);
  return n;
}
export const sumLedger = (rows: LedgerRow[], key: string) => Math.round(rows.reduce((s,r) => s + value(r,key),0) * 1e6) / 1e6;
/** Union of generated rotating integer cohorts, not a sum of daily reach. No real identities exist. */
export function demoReach(rows: LedgerRow[]): number {
  const intervals: [number, number][] = [];
  for (const row of rows) {
    const n = value(row,"reach"), universe = value(row,"reach_universe"), start = value(row,"reach_cohort_start");
    if (n > universe) throw new Error("Synthetic reach exceeds its model universe.");
    intervals.push([start, Math.min(start+n,universe)]);
    if (start+n>universe) intervals.push([0,start+n-universe]);
  }
  intervals.sort((a,b)=>a[0]-b[0]);
  let total=0, from=0, to=0;
  for (const [a,b] of intervals) { if (a>to) { total+=to-from; from=a; to=b; } else to=Math.max(to,b); }
  return total+to-from;
}
export function ledgerTotals(rows: LedgerRow[]) {
  const spend=sumLedger(rows,"spend"), impressions=sumLedger(rows,"impressions"), clicks=sumLedger(rows,"clicks"), sessions=sumLedger(rows,"website_sessions"), purchases=sumLedger(rows,"purchases"), revenue=sumLedger(rows,"purchase_revenue");
  return { records:rows.length, spend, impressions, clicks, sessions, purchases, revenue,
    views:sumLedger(rows,"view_item"), basket:sumLedger(rows,"add_to_cart"), checkout:sumLedger(rows,"begin_checkout"),
    purchaseRate:sessions ? purchases/sessions*100 : null, cpa:purchases ? spend/purchases : null, roas:spend ? revenue/spend : null,
    responseRate:impressions ? sessions/impressions*100 : null, costPerResponse:sessions ? spend/sessions : null,
    ctr:impressions ? clicks/impressions*100 : null, cpc:clicks ? spend/clicks : null };
}
/** Each channel stays a separate population; there is deliberately no website+media+store grand total. */
export function ledgerPeriods(rows: LedgerRow[], granularity: Granularity) {
  const map=new Map<string,LedgerRow[]>();
  for (const r of rows) { const key=`${bucketKey(r.date,granularity)}|${r.channel}`; const group=map.get(key)??[]; group.push(r); map.set(key,group); }
  return [...map.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([id,rs])=>{
    const first=rs[0]; if (!first) throw new Error("Empty period group.");
    const key=bucketKey(first.date,granularity), span=bucketSpan(key,granularity), dates=rs.map(r=>r.date).sort(), from=dates[0]??key, to=dates.at(-1)??key;
    return { id,key,channel:first.channel,from,to,partial:from!==span.start||to!==span.end,totals:ledgerTotals(rs),rows:rs };
  });
}
