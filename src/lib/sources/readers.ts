import type { Cell, SourceBundle, SourceId, Workbook } from "./bundle";
import { SOURCE_IDS } from "./bundle";

export type MetricValue = number | string | null;
export interface MappedRecord {
  source_id: SourceId;
  record_key: string;
  record_kind: string;
  campaign_key: string;
  source_campaign: string | null;
  period_start: string;
  period_end: string;
  granularity: "day" | "period";
  dimension: string | null;
  dimension_value: string | null;
  currency: string | null;
  metrics: Record<string, MetricValue>;
  provenance: Record<string, string | number | boolean | null>;
}

export class SourceError extends Error {}

export interface Period { start: string; end: string }
/** Explicit options: campaign identity mapping, currency and periods are never guessed from file contents alone. */
export interface ReaderOptions {
  campaignMap: Record<string, string>;
  currency: "EUR";
  period: Period;
  lwm2SitePeriod: Period;
}

export const MASTER_CAMPAIGN = { key: "demo-autumn", label: "Synthetic Autumn Demo" };
export const DEMO_READER_OPTIONS: ReaderOptions = {
  campaignMap: {
    "meta:Synthetic Demo Campaign A": MASTER_CAMPAIGN.key,
    "google_ads:Synthetic Search Demo": MASTER_CAMPAIGN.key,
    "google_ads:Synthetic Brand Demo": MASTER_CAMPAIGN.key,
    "spotify:Synthetic Audio Demo": MASTER_CAMPAIGN.key,
    "youtube:Synthetic channel": MASTER_CAMPAIGN.key,
    "lwm1:Synthetic LWM Display 1": MASTER_CAMPAIGN.key,
    "lwm2:Synthetic LWM Video 2": MASTER_CAMPAIGN.key,
    "lwm3:Synthetic LWM Display 3": MASTER_CAMPAIGN.key,
    "tv:Synthetic TV Autumn": MASTER_CAMPAIGN.key,
  },
  currency: "EUR",
  period: { start: "2026-10-15", end: "2026-11-13" },
  lwm2SitePeriod: { start: "2026-11-01", end: "2026-11-10" },
};

// ---------- helpers ----------
const str = (v: Cell | undefined) => (v == null ? "" : String(v).trim());
const blankRow = (r: Cell[] | undefined) => !r || r.every((c) => str(c) === "");

export function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}
function isoDate(v: Cell | undefined, where: string): string {
  const s = str(v);
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s;
  if (!isRealDate(iso)) throw new SourceError(`${where}: invalid calendar date`);
  return iso;
}
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function monthDate(s: string, where: string): string {
  const m = /^([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(s.trim());
  const mi = m ? MONTHS.indexOf(m[1]!) : -1;
  if (!m || mi < 0) throw new SourceError(`${where}: unreadable report period`);
  return isoDate(`${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[2]!.padStart(2, "0")}`, where);
}
function range(s: string, where: string, parse: (x: string) => string = (x) => isoDate(x, where)): Period {
  const parts = s.split(/\s+[-–]\s+/);
  if (parts.length !== 2) throw new SourceError(`${where}: unreadable period`);
  const p = { start: parse(parts[0]!), end: parse(parts[1]!) };
  if (p.end < p.start) throw new SourceError(`${where}: period ends before it starts`);
  return p;
}
/** Known nonnegative finite number; null only where `nullable` and the cell is blank or "--". */
function num(v: Cell | undefined, where: string, opts: { int?: boolean; nullable?: boolean } = {}): number | null {
  const s = str(v);
  if (s === "" || s === "--") {
    if (opts.nullable) return null;
    throw new SourceError(`${where}: value is missing`);
  }
  const n = typeof v === "number" ? v : /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
  if (!Number.isFinite(n) || n < 0) throw new SourceError(`${where}: must be a nonnegative finite number`);
  if (opts.int && !Number.isInteger(n)) throw new SourceError(`${where}: must be a whole number`);
  return n;
}
const req = (v: Cell | undefined, where: string, int = false) => num(v, where, { int }) as number;
/** Source-reported value kept as-is for display/provenance (never summed): blank or "--" → null, numeric → number, else text. */
export function reported(v: Cell | undefined): number | string | null {
  const s = str(v);
  if (s === "" || s === "--") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s;
}
/** Copies named source columns into metrics under explicit keys. */
const keep = (r: Cell[], ix: Record<string, number>, map: Record<string, string>) =>
  Object.fromEntries(Object.entries(map).map(([col, key]) => [key, ix[col]! >= 0 ? reported(r[ix[col]!]) : null]));
/** Column positions for headers found anywhere in the declared header row. */
function headerCols(rows: Cell[][], rowNo: number, needed: readonly string[], where: string) {
  const ix = headerIndex(rows, rowNo, needed, where);
  return ix;
}
function headerAt(rows: Cell[][], rowNo: number, col: number, expected: readonly string[], where: string) {
  const got = (rows[rowNo - 1] ?? []).slice(col, col + expected.length).map(str);
  const missing = expected.filter((h, i) => got[i] !== h);
  if (missing.length) throw new SourceError(`${where}: expected headers at row ${rowNo} (missing/misplaced: ${missing.join(", ")})`);
}
function headerIndex(rows: Cell[][], rowNo: number, needed: readonly string[], where: string) {
  const hdr = (rows[rowNo - 1] ?? []).map(str);
  const idx: Record<string, number> = {};
  const missing: string[] = [];
  for (const h of needed) { const i = hdr.indexOf(h); if (i < 0) missing.push(h); idx[h] = i; }
  if (missing.length) throw new SourceError(`${where}: missing columns ${missing.join(", ")}`);
  return idx;
}
function mapCampaign(o: ReaderOptions, source: SourceId, name: string, where: string) {
  const key = o.campaignMap[`${source}:${name}`];
  if (!key) throw new SourceError(`${where}: campaign has no explicit mapping`);
  return key;
}
function metaLine(rows: Cell[][], prefix: string, where: string, col = 0): string {
  for (const r of rows) for (const c of col >= 0 ? r : []) { const s = str(c); if (s.startsWith(prefix)) return s.slice(prefix.length).trim(); }
  throw new SourceError(`${where}: metadata "${prefix}" not found`);
}
const sheet = (wb: Workbook, i: number, where: string) => {
  const s = wb.sheets[i];
  if (!s) throw new SourceError(`${where}: sheet ${i + 1} missing`);
  return s.rows;
};
function pushUnique(out: MappedRecord[], seen: Set<string>, r: MappedRecord, where: string) {
  if (seen.has(r.record_key)) throw new SourceError(`${where}: duplicate record`);
  seen.add(r.record_key);
  out.push(r);
}
const base = (source_id: SourceId) => ({ source_id, dimension: null, dimension_value: null, source_campaign: null, currency: null }) as const;

// ---------- readers ----------
const META_REPORTED = {
  "Frequency": "reported_frequency", "Cost per results": "reported_cost_per_result_eur", "Ends": "ends",
  "CPM (cost per 1,000 impressions) (EUR)": "reported_cpm_eur", "CPC (cost per link click) (EUR)": "reported_cpc_link_eur",
  "CTR (link click-through rate)": "reported_ctr_link_pct", "CTR (all)": "reported_ctr_all_pct", "CPC (all) (EUR)": "reported_cpc_all_eur",
  "Cost per landing page view (EUR)": "reported_cost_per_lpv_eur", "Results (initial)": "results_initial", "Results (initial) indicator": "results_initial_indicator",
} as const;
const META_COLS = ["Reporting starts", "Reporting ends", "Campaign name", "Campaign delivery", "Attribution setting", "Results", "Result indicator", "Reach", "Ad set budget", "Ad set budget type", "Amount spent (EUR)", "Impressions", "Link clicks", "shop_clicks", "Clicks (all)", "Landing page views", ...Object.keys(META_REPORTED)] as const;
export function readMeta(wb: Workbook, o: ReaderOptions): MappedRecord[] {
  const rows = sheet(wb, 0, "Meta");
  const ix = headerIndex(rows, 1, META_COLS, "Meta");
  const c = (r: Cell[], h: (typeof META_COLS)[number]) => r[ix[h]!];
  const out: MappedRecord[] = []; const seen = new Set<string>();
  rows.slice(1).forEach((r, k) => {
    const w = `Meta row ${k + 2}`;
    if (blankRow(r)) return;
    const name = str(c(r, "Campaign name"));
    if (!name) return; // Meta summary row (no campaign) is not a record
    const start = isoDate(c(r, "Reporting starts"), w), end = isoDate(c(r, "Reporting ends"), w);
    if (end < start) throw new SourceError(`${w}: reporting interval ends before it starts`);
    const campaign_key = mapCampaign(o, "meta", name, w);
    const link = req(c(r, "Link clicks"), `${w} Link clicks`, true), all = req(c(r, "Clicks (all)"), `${w} Clicks (all)`, true);
    if (link > all) throw new SourceError(`${w}: Link clicks exceed Clicks (all)`);
    pushUnique(out, seen, {
      ...base("meta"), record_key: `meta|${campaign_key}|${start}|${end}`, record_kind: start === end ? "daily" : "interval",
      campaign_key, source_campaign: name, period_start: start, period_end: end, granularity: start === end ? "day" : "period", currency: "EUR",
      metrics: {
        spend: req(c(r, "Amount spent (EUR)"), `${w} spend`), impressions: req(c(r, "Impressions"), `${w} Impressions`, true),
        reach: num(c(r, "Reach"), `${w} Reach`, { int: true, nullable: true }), link_clicks: link, clicks_all: all,
        shop_clicks: num(c(r, "shop_clicks"), `${w} shop_clicks`, { int: true, nullable: true }),
        landing_page_views: num(c(r, "Landing page views"), `${w} LPV`, { int: true, nullable: true }),
        results: num(c(r, "Results"), `${w} Results`, { nullable: true }), result_indicator: str(c(r, "Result indicator")) || null,
        attribution_setting: str(c(r, "Attribution setting")) || null, ad_set_budget: num(c(r, "Ad set budget"), `${w} budget`, { nullable: true }),
        ad_set_budget_type: str(c(r, "Ad set budget type")) || null, delivery: str(c(r, "Campaign delivery")) || null,
        ...keep(r, ix, META_REPORTED),
      },
      provenance: { sheet: "Meta export", row: k + 2 },
    }, w);
  });
  return out;
}

const GOOGLE_REPORTED = {
  "Budget name": "budget_name", "Budget type": "budget_type", "Status reasons": "status_reasons", "Optimization score": "reported_optimization_score",
  "Cost / conv.": "reported_cost_per_conversion_eur", "Viewable CTR": "reported_viewable_ctr", "Avg. CPC": "reported_avg_cpc_eur",
  "% Engaged sessions (GA4)": "reported_ga4_engaged_sessions_pct", "CTR": "reported_ctr", "Relative CTR": "reported_relative_ctr",
} as const;
const GOOGLE_COLS = ["Campaign status", "Campaign", "Budget", "Currency code", "Status", "Campaign type", "Conversions", "Clicks", "Impr.", "Cost", ...Object.keys(GOOGLE_REPORTED)] as const;
export function readGoogleAds(wb: Workbook, o: ReaderOptions): MappedRecord[] {
  const rows = sheet(wb, 0, "Google Ads");
  const period = range(str(rows[1]?.[0]), "Google Ads row 2", (x) => monthDate(x, "Google Ads row 2"));
  if (period.start !== o.period.start || period.end !== o.period.end) throw new SourceError("Google Ads: export period differs from the supplied reporting period");
  const ix = headerIndex(rows, 3, GOOGLE_COLS, "Google Ads");
  const c = (r: Cell[], h: (typeof GOOGLE_COLS)[number]) => r[ix[h]!];
  const out: MappedRecord[] = []; const seen = new Set<string>();
  rows.slice(3).forEach((r, k) => {
    const w = `Google Ads row ${k + 4}`;
    if (blankRow(r) || str(r[0]).startsWith("Total:")) return; // account/campaign totals are summaries
    const name = str(c(r, "Campaign"));
    const campaign_key = mapCampaign(o, "google_ads", name, w);
    if (str(c(r, "Currency code")) !== o.currency) throw new SourceError(`${w}: currency must be ${o.currency}`);
    pushUnique(out, seen, {
      ...base("google_ads"), record_key: `google_ads|${name}|${period.start}|${period.end}`, record_kind: "campaign_period",
      campaign_key, source_campaign: name, period_start: period.start, period_end: period.end, granularity: "period", currency: o.currency,
      metrics: {
        cost: req(c(r, "Cost"), `${w} Cost`), impressions: req(c(r, "Impr."), `${w} Impr.`, true), clicks: req(c(r, "Clicks"), `${w} Clicks`, true),
        conversions: req(c(r, "Conversions"), `${w} Conversions`), budget: num(c(r, "Budget"), `${w} Budget`, { nullable: true }),
        campaign_type: str(c(r, "Campaign type")) || null, status: str(c(r, "Status")) || null, campaign_status: str(c(r, "Campaign status")) || null,
        ...keep(r, ix, GOOGLE_REPORTED),
      },
      provenance: { sheet: "Campaign report", row: k + 4, period_source: "export metadata row 2" },
    }, w);
  });
  return out;
}

export function readYouTube(wb: Workbook, o: ReaderOptions): MappedRecord[] {
  const content = sheet(wb, 0, "YouTube"), daily = sheet(wb, 1, "YouTube");
  headerAt(content, 1, 0, ["Content", "Views", "Watch time (hours)", "Subscribers", "Thumbnail impressions", "Thumbnail click-through rate (%)"], "YouTube content");
  headerAt(daily, 1, 0, ["Date", "Views"], "YouTube daily");
  const campaign_key = mapCampaign(o, "youtube", "Synthetic channel", "YouTube");
  const out: MappedRecord[] = []; const seen = new Set<string>();
  let contentViews = 0, dailyViews = 0;
  content.slice(1).forEach((r, k) => {
    const w = `YouTube content row ${k + 2}`;
    if (blankRow(r) || str(r[0]) === "Total") return;
    const views = req(r[1], `${w} Views`, true); contentViews += views;
    pushUnique(out, seen, {
      ...base("youtube"), record_key: `youtube|content|${str(r[0])}`, record_kind: "content_summary", campaign_key, source_campaign: "Synthetic channel",
      period_start: o.period.start, period_end: o.period.end, granularity: "period", dimension: "content", dimension_value: str(r[0]),
      metrics: { views, watch_time_hours: req(r[2], `${w} Watch time`), subscribers: req(r[3], `${w} Subscribers`, true), thumbnail_impressions: req(r[4], `${w} Thumbnail impressions`, true), thumbnail_ctr_pct: req(r[5], `${w} Thumbnail CTR`) },
      provenance: { sheet: wb.sheets[0]!.name, row: k + 2, period_source: "supplied option" },
    }, w);
  });
  daily.slice(1).forEach((r, k) => {
    const w = `YouTube daily row ${k + 2}`;
    if (blankRow(r) || str(r[0]) === "Total") return;
    const date = isoDate(r[0], w); const views = req(r[1], `${w} Views`, true); dailyViews += views;
    pushUnique(out, seen, {
      ...base("youtube"), record_key: `youtube|daily|${date}`, record_kind: "daily_views", campaign_key, source_campaign: "Synthetic channel",
      period_start: date, period_end: date, granularity: "day", metrics: { views }, provenance: { sheet: wb.sheets[1]!.name, row: k + 2 },
    }, w);
  });
  for (const r of out) r.provenance["reconciled_views"] = contentViews === dailyViews;
  return out;
}

const SPOTIFY_DETAIL = ["Order", "Line item", "Creative", "Date", "Ad server impressions", "Ad server clicks", "Ad server CTR", "Start", "First quartile", "Midpoint", "Third quartile", "Complete", "Completion rate"] as const;
export function readSpotify(wb: Workbook, o: ReaderOptions): MappedRecord[] {
  const summary = sheet(wb, 0, "Spotify");
  const campaign = metaLine(summary, "Campaign:", "Spotify summary");
  const campaign_key = mapCampaign(o, "spotify", campaign, "Spotify");
  const period = range(metaLine(summary, "Reporting period:", "Spotify summary"), "Spotify summary");
  const out: MappedRecord[] = []; const seen = new Set<string>();
  const blocks: number[] = [];
  summary.forEach((r, i) => { const f = r.map(str).indexOf("Format"); if (f >= 0 && str(r[f + 1]) === "Creative") blocks.push(i + 1); });
  if (!blocks.length) throw new SourceError("Spotify summary: no Format/Creative blocks");
  for (const h of blocks) {
    const ix = headerCols(summary, h, ["Format", "Creative", "Impressions", "Clicks", "CTR"], "Spotify summary");
    const F = ix["Format"]!, C = ix["Creative"]!, I = ix["Impressions"]!, K = ix["Clicks"]!, T = ix["CTR"]!;
    for (let i = h; i < summary.length && !blankRow(summary[i]); i++) {
      const raw = summary[i]!; const w = `Spotify summary row ${i + 1}`;
      const r: Cell[] = [raw[F] ?? null, raw[C] ?? null, raw[I] ?? null, raw[K] ?? null, raw[T] ?? null];
      if (str(r[0]) === "Total" || str(r[0]) === "Format") continue;
      pushUnique(out, seen, {
        ...base("spotify"), record_key: `spotify|summary|${str(r[1])}`, record_kind: "summary", campaign_key, source_campaign: campaign,
        period_start: period.start, period_end: period.end, granularity: "period", dimension: "creative", dimension_value: str(r[1]),
        metrics: { format: str(r[0]), impressions: req(r[2], `${w} Impressions`, true), clicks: req(r[3], `${w} Clicks`, true), reported_ctr_pct: reported(r[4]) },
        provenance: { sheet: "Summary", row: i + 1, header_row: h, role: "reconciliation only — not additive with detail" },
      }, w);
    }
  }
  wb.sheets.slice(1).forEach((s) => {
    const fmt = s.name.replace(/ detail$/, "");
    headerAt(s.rows, 1, 0, SPOTIFY_DETAIL, `Spotify ${s.name}`);
    s.rows.slice(1).forEach((r, k) => {
      const w = `Spotify ${s.name} row ${k + 2}`;
      if (blankRow(r)) return;
      const date = isoDate(r[3], w);
      const n = (i: number, f: string) => num(r[i], `${w} ${f}`, { int: true, nullable: true });
      pushUnique(out, seen, {
        ...base("spotify"), record_key: `spotify|detail|${str(r[2])}|${date}`, record_kind: "daily_detail", campaign_key, source_campaign: campaign,
        period_start: date, period_end: date, granularity: "day", dimension: "creative", dimension_value: str(r[2]),
        metrics: { format: fmt, line_item: str(r[1]), impressions: req(r[4], `${w} impressions`, true), clicks: req(r[5], `${w} clicks`, true), starts: n(7, "Start"), first_quartile: n(8, "First quartile"), midpoint: n(9, "Midpoint"), third_quartile: n(10, "Third quartile"), completes: n(11, "Complete"), reported_ctr_pct: reported(r[6]), reported_completion_rate_pct: reported(r[12]) },
        provenance: { sheet: s.name, row: k + 2, order: str(r[0]) },
      }, w);
    });
  });
  return out;
}

const GA4_COLS = ["Session primary channel group (Default Channel Group)", "Sessions", "Engaged sessions", "Engagement rate", "Average engagement time per session", "Events per session", "Event count", "Key events", "Session key event rate", "Total revenue"] as const;
export function readGA4(wb: Workbook, o: ReaderOptions): MappedRecord[] {
  const rows = sheet(wb, 0, "GA4");
  headerAt(rows, 10, 0, GA4_COLS, "GA4");
  const period = { start: isoDate(metaLine(rows.slice(0, 9), "# Start date:", "GA4"), "GA4 start"), end: isoDate(metaLine(rows.slice(0, 9), "# End date:", "GA4"), "GA4 end") };
  const out: MappedRecord[] = []; const seen = new Set<string>();
  rows.slice(10).forEach((r, k) => {
    const w = `GA4 row ${k + 11}`;
    if (blankRow(r) || str(r[0]) === "Total") return;
    const sessions = req(r[1], `${w} Sessions`, true), engaged = req(r[2], `${w} Engaged sessions`, true);
    if (engaged > sessions) throw new SourceError(`${w}: engaged sessions exceed sessions`);
    pushUnique(out, seen, {
      ...base("ga4"), record_key: `ga4|${str(r[0])}|${period.start}|${period.end}`, record_kind: "channel_period", campaign_key: "property", source_campaign: null,
      period_start: period.start, period_end: period.end, granularity: "period", dimension: "channel_group", dimension_value: str(r[0]), currency: o.currency,
      metrics: {
        sessions, engaged_sessions: engaged, engagement_time_total_s: req(r[4], `${w} avg time`) * sessions,
        event_count: req(r[6], `${w} Event count`, true), key_events: req(r[7], `${w} Key events`), total_revenue: req(r[9], `${w} Total revenue`),
        reported_session_key_event_rate: req(r[8], `${w} Session key event rate`),
        reported_engagement_rate: reported(r[3]), reported_avg_engagement_time_s: reported(r[4]), reported_events_per_session: reported(r[5]),
      },
      provenance: { sheet: "Traffic acquisition", row: k + 11, attribution: "GA4 session channel group; not joined to ad campaigns" },
    }, w);
  });
  return out;
}

function readLwmLegacy(id: "lwm1" | "lwm3", wb: Workbook, o: ReaderOptions): MappedRecord[] {
  const rows = sheet(wb, 0, id);
  headerAt(rows, 10, 1, ["Day", "Impr.", "Clicks"], id);
  const campaign = metaLine(rows.slice(0, 9), "Campaign:", id, 1);
  const inventory = metaLine(rows.slice(0, 9), "Inventory:", id, 1);
  const campaign_key = mapCampaign(o, id, campaign, id);
  const out: MappedRecord[] = []; const seen = new Set<string>();
  for (let i = 10; i < rows.length && !blankRow(rows[i]); i++) {
    const r = rows[i]!; const w = `${id} row ${i + 1}`;
    if (str(r[1]) === "Total") continue;
    const date = isoDate(r[1], w);
    pushUnique(out, seen, {
      ...base(id), record_key: `${id}|${date}`, record_kind: "daily", campaign_key, source_campaign: campaign, period_start: date, period_end: date, granularity: "day", currency:o.currency,
      metrics: { impressions: req(r[2], `${w} Impr.`, true), clicks: req(r[3], `${w} Clicks`, true), cost: req(r[4], `${w} Generated cost`), generated_reach: req(r[5], `${w} Generated reach`, true) },
      provenance: { sheet: "Report", row: i + 1, inventory, inventory_distinct: /distinct generated inventory/.test(inventory) },
    }, w);
  }
  return out;
}
export const readLwm1 = (wb: Workbook, o: ReaderOptions) => readLwmLegacy("lwm1", wb, o);
export const readLwm3 = (wb: Workbook, o: ReaderOptions) => readLwmLegacy("lwm3", wb, o);

const LWM2_METRICS = ["Impressions", "Daily Reach", "Clicks", "CTR", "CPC", "CPM", "Amount"] as const;
export function readLwm2(wb: Workbook, o: ReaderOptions): MappedRecord[] {
  const rows = sheet(wb, 0, "lwm2");
  headerAt(rows, 5, 1, ["Days", ...LWM2_METRICS], "lwm2 daily table");
  headerAt(rows, 18, 1, ["Sites", ...LWM2_METRICS], "lwm2 site table");
  const campaign = metaLine(rows.slice(0, 4), "Campaign:", "lwm2", 1);
  const inventory = metaLine(rows.slice(0, 4), "Inventory:", "lwm2", 1);
  const campaign_key = mapCampaign(o, "lwm2", campaign, "lwm2");
  const out: MappedRecord[] = []; const seen = new Set<string>();
  const prov = (row: number, table: string) => ({ sheet: "Report", row, table, inventory, inventory_distinct: /distinct generated inventory/.test(inventory), currency_source: "supplied option" });
  for (let i = 5; i < 17 && !blankRow(rows[i]); i++) {
    const r = rows[i]!; const w = `lwm2 row ${i + 1}`;
    if (str(r[1]) === "Total") continue;
    const date = isoDate(r[1], w);
    pushUnique(out, seen, {
      ...base("lwm2"), record_key: `lwm2|daily|${date}`, record_kind: "daily", campaign_key, source_campaign: campaign, period_start: date, period_end: date, granularity: "day", currency: o.currency,
      metrics: { impressions: req(r[2], `${w} Impressions`, true), daily_reach: req(r[3], `${w} Daily Reach`, true), clicks: req(r[4], `${w} Clicks`, true), cost: req(r[8], `${w} Amount`), reported_ctr_pct: reported(r[5]), reported_cpc_eur: reported(r[6]), reported_cpm_eur: reported(r[7]) },
      provenance: prov(i + 1, "daily"),
    }, w);
  }
  for (let i = 18; i < rows.length && !blankRow(rows[i]); i++) {
    const r = rows[i]!; const w = `lwm2 row ${i + 1}`;
    if (str(r[1]) === "Total") continue;
    pushUnique(out, seen, {
      ...base("lwm2"), record_key: `lwm2|site|${str(r[1])}`, record_kind: "site_breakdown", campaign_key, source_campaign: campaign,
      period_start: o.lwm2SitePeriod.start, period_end: o.lwm2SitePeriod.end, granularity: "period", dimension: "site", dimension_value: str(r[1]), currency: o.currency,
      metrics: { impressions: req(r[2], `${w} Impressions`, true), reach: req(r[3], `${w} Reach`, true), clicks: req(r[4], `${w} Clicks`, true), cost: req(r[8], `${w} Amount`), reported_ctr_pct: reported(r[5]), reported_cpc_eur: reported(r[6]), reported_cpm_eur: reported(r[7]) },
      provenance: { ...prov(i + 1, "site"), role: "breakdown of the same delivery — not additive with daily table" },
    }, w);
  }
  return out;
}

const TV_COLS = ["Campaign", "Period", "GRPs (TTL)", "Reach 1+ (TTL)", "Reach 3+ (TTL)", "TRPs (all 16+)", "Reach 1+ (all 16+)", "Reach 3+ (all 16+)", "Net Cost", "note"] as const;
export function readTV(wb: Workbook, o: ReaderOptions): MappedRecord[] {
  const rows = sheet(wb, 0, "TV");
  const ix = headerCols(rows, 2, TV_COLS, "TV"); // columns located by name (e.g. Campaign in D, spacer columns allowed)
  const out: MappedRecord[] = []; const seen = new Set<string>();
  for (let i = 2; i < rows.length && !blankRow(rows[i]); i++) {
    const raw = rows[i]!; const w = `TV row ${i + 1}`;
    const r: Cell[] = TV_COLS.map((h) => raw[ix[h]!] ?? null);
    if (str(r[0]) === "Total") continue;
    const p = range(str(r[1]), w);
    const campaign_key = mapCampaign(o, "tv", str(r[0]), w);
    pushUnique(out, seen, {
      ...base("tv"), record_key: `tv|${str(r[0])}|${p.start}|${p.end}`, record_kind: "flight", campaign_key, source_campaign: str(r[0]),
      period_start: p.start, period_end: p.end, granularity: "period", currency: o.currency,
      metrics: { grps_ttl: req(r[2], `${w} GRPs`), reach1_ttl_pct: req(r[3], `${w} Reach 1+`), reach3_ttl_pct: req(r[4], `${w} Reach 3+`), trps_16: req(r[5], `${w} TRPs`), reach1_16_pct: req(r[6], `${w} Reach 1+ 16+`), reach3_16_pct: req(r[7], `${w} Reach 3+ 16+`), net_cost: req(r[8], `${w} Net Cost`), note: str(r[9]) || null },
      provenance: { sheet: wb.sheets[0]!.name, row: i + 1, currency_source: "supplied option" },
    }, w);
  }
  return out;
}

const LEDGER_KEYS = ["spend","impressions","reach","clicks","website_sessions","view_item","add_to_cart","begin_checkout","purchases","purchase_revenue","post_engagement","video_views","starts","first_quartile","midpoint","third_quartile","completes","watch_time_hours","subscribers","thumbnail_impressions","thumbnail_clicks","users","new_users","engaged_sessions","engagement_time_total_s","event_count","key_events","key_event_sessions","grps_ttl","trps_16","reach1_ttl_pct","reach3_ttl_pct","reach1_16_pct","reach3_16_pct","footfall_week_before","footfall_during","footfall_week_after","sales_documents","quantity","net_sales"] as const;
export function readSimulation(wb: Workbook): MappedRecord[] {
  const out: MappedRecord[] = []; const seen = new Set<string>();
  for (const sheet of wb.sheets) {
    headerAt(sheet.rows,1,0,["Date","Channel","Spend EUR","Impressions","Reach","Clicks"],"Synthetic ledger");
    for (const row of sheet.rows.slice(1)) {
    const date = isoDate(row[0], "Synthetic ledger"); const channel = str(row[1]);
    const metrics: Record<string, MetricValue> = { channel };
    LEDGER_KEYS.forEach((key,i) => { metrics[key] = req(row[i+2], `Synthetic ledger ${key}`); });
    metrics["reach_cohort_start"] = req(row[43], "Reach cohort start", true);
    metrics["reach_universe"] = req(row[44], "Reach universe", true);
    metrics["allocation"] = str(row[42]);
    const stages=["website_sessions","view_item","add_to_cart","begin_checkout","purchases"].map(k=>Number(metrics[k]));
    if(stages.some((n,i)=>i>0&&n>(stages[i-1]??0))||Number(metrics["reach"])>Number(metrics["impressions"]))throw new SourceError("Synthetic stage/reach counts do not reconcile");
    pushUnique(out,seen,{ ...base("simulation"), record_key:`simulation|${channel}|${date}`, record_kind:"simulated_daily", campaign_key:channel === "ga4" ? "property" : channel === "stores" ? "stores" : MASTER_CAMPAIGN.key,
      source_campaign: `Synthetic ${channel} cohort`, period_start:date, period_end:date, granularity:"day", dimension:"channel",dimension_value:channel,currency:"EUR",metrics,
      provenance:{ synthetic:true, complete_demo:true, allocation:str(row[42]), scope:channel === "ga4" ? "site_wide" : channel === "stores" ? "offline_store" : "campaign", reach_model:"rotating synthetic integer cohort; union, never summed" } },"Synthetic ledger");
  }
  }
  return out;
}

export const READERS: Record<SourceId, (wb: Workbook, o: ReaderOptions) => MappedRecord[]> = {
  meta: readMeta, google_ads: readGoogleAds, youtube: readYouTube, spotify: readSpotify, ga4: readGA4, lwm1: readLwm1, lwm2: readLwm2, lwm3: readLwm3, tv: readTV, simulation: readSimulation,
};

export function readBundle(bundle: Pick<SourceBundle, "sources">, ids: readonly SourceId[] = SOURCE_IDS, o = DEMO_READER_OPTIONS): MappedRecord[] {
  return ids.flatMap((id) => READERS[id](bundle.sources[id], o));
}
