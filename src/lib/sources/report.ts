import { buildCompleteReport } from "./complete-report";
import { webTotals, type PerfRow } from "../metrics";
import { SOURCE_INFO, type SourceId } from "./bundle";
import { MASTER_CAMPAIGN, type MappedRecord } from "./readers";

export type Unit = "count" | "eur" | "pct" | "ratio" | "hours" | "seconds" | "text" | "grp";
export interface Metric { key: string; label: string; value: number | string | null; unit: Unit; definition: string; note?: string }
export interface Breakdown { title: string; columns: { key: string; label: string; unit: Unit }[]; rows: Record<string, number | string | null>[] }
export interface Section { id: string; title: string; kind: "ad_platform" | "website" | "simulated" | "offline" | "stores"; sources: SourceId[]; note: string; available: boolean; metrics: Metric[]; breakdowns: Breakdown[] }
export interface Excluded { source: SourceId; record_kind: string; period: string; records: number; reason: string }
export interface MasterReport { campaign: string; campaign_key: string; start: string; end: string; days: number; sections: Section[]; excluded: Excluded[] }

const known = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
/** Sum over the full selection: null when empty or any record lacks a known value. */
export function sumKnown(recs: MappedRecord[], key: string): number | null {
  if (!recs.length) return null;
  let s = 0;
  for (const r of recs) { const v = r.metrics[key]; if (!known(v)) return null; s += v; }
  return Math.round(s * 1e6) / 1e6;
}
/** Weighted rate from compatible totals; N/A when either side is unknown or the denominator is zero. */
export const rate = (n: number | null, d: number | null, scale = 1) => (n == null || d == null || d === 0 ? null : (n / d) * scale);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) + 1;
const M = (key: string, label: string, value: Metric["value"], unit: Unit, definition: string, note?: string): Metric => (note ? { key, label, value, unit, definition, note } : { key, label, value, unit, definition });
const NA = (key: string, label: string, unit: Unit, definition: string, note: string) => M(key, label, null, unit, definition, note);
const sameCurrency = (recs: MappedRecord[]) => new Set(recs.map((r) => r.currency).filter(Boolean)).size <= 1;

/** Daily records in range, plus period records fully inside it. Partially overlapping periods are excluded (never prorated). */
export function selectRecords(records: MappedRecord[], start: string, end: string) {
  const included: MappedRecord[] = [];
  const excluded = new Map<string, Excluded>();
  for (const r of records) {
    const inside = r.period_start >= start && r.period_end <= end;
    const overlaps = r.period_start <= end && r.period_end >= start;
    if (inside) included.push(r);
    else if (overlaps) {
      const k = `${r.source_id}|${r.record_kind}|${r.period_start}|${r.period_end}`;
      const e = excluded.get(k) ?? { source: r.source_id, record_kind: r.record_kind, period: `${r.period_start} → ${r.period_end}`, records: 0, reason: "Reporting interval only partly inside the selected period — excluded, not prorated" };
      e.records++; excluded.set(k, e);
    }
  }
  return { included, excluded: [...excluded.values()] };
}

export function buildMasterReport(records: MappedRecord[], perfRows: PerfRow[], start: string, end: string): MasterReport {
  if (records.some(r => r.source_id === "simulation")) return buildCompleteReport(records,start,end);
  const { included, excluded } = selectRecords(records, start, end);
  const by = (id: SourceId, kinds?: string[]) => included.filter((r) => r.source_id === id && (!kinds || kinds.includes(r.record_kind)));
  const sections: Section[] = [];

  // META — daily rows preferred; interval rows used only when no daily rows exist (never both).
  {
    const daily = by("meta", ["daily"]); const recs = daily.length ? daily : by("meta", ["interval"]);
    const spend = sameCurrency(recs) ? sumKnown(recs, "spend") : null, impr = sumKnown(recs, "impressions"), link = sumKnown(recs, "link_clicks"), all = sumKnown(recs, "clicks_all");
    const indicators = new Set(recs.map((r) => `${r.metrics["result_indicator"]}|${r.metrics["attribution_setting"]}`));
    const results = indicators.size === 1 ? sumKnown(recs, "results") : null;
    const [ind] = [...indicators];
    sections.push({
      id: "meta", title: "Meta", kind: "ad_platform", sources: ["meta"], available: recs.length > 0,
      note: "Ad-platform reported. Link clicks drive CPC/CTR; Clicks (all) is a separate definition. Results keep their indicator and attribution; they are not purchases.",
      metrics: [
        M("impressions", "Impressions", impr, "count", "SUM(Impressions)"),
        recs.length === 1 ? M("reach", "Reach", sumKnown(recs, "reach"), "count", "Reach for the single selected reporting row") : NA("reach", "Reach", "count", "Unique accounts reached", "Not additive across days/campaigns — N/A for multi-row selections"),
        NA("post_engagement", "Post engagement", "count", "Post engagement", "Not in this export"),
        M("clicks_all", "Clicks (all)", all, "count", "SUM(Clicks (all)) — all click types"),
        M("link_clicks", "Link clicks", link, "count", "SUM(Link clicks)"),
        M("link_cpc", "CPC (link)", rate(spend, link), "eur", "SUM(spend) ÷ SUM(link clicks)"),
        M("link_ctr", "CTR (link)", rate(link, impr, 100), "pct", "SUM(link clicks) ÷ SUM(impressions) × 100"),
        M("spend", "Amount spent", spend, "eur", "SUM(Amount spent (EUR))"),
        M("landing_page_views", "Landing page views", sumKnown(recs, "landing_page_views"), "count", "SUM(Landing page views)"),
        M("shop_clicks", "Shop clicks", sumKnown(recs, "shop_clicks"), "count", "SUM(shop_clicks)"),
        M("results", "Results", results, "count", `SUM(Results) — indicator/attribution: ${ind ? ind.replace("|", " · ") : "N/A"}`, indicators.size > 1 ? "Mixed result indicators — not summed" : undefined),
      ],
      breakdowns: [],
    });
  }

  // YOUTUBE — daily views are authoritative for dates; content summary only when its full period is selected.
  {
    const daily = by("youtube", ["daily_views"]), content = by("youtube", ["content_summary"]);
    const ti = sumKnown(content, "thumbnail_impressions");
    const weighted = content.length && content.every((r) => known(r.metrics["thumbnail_ctr_pct"]) && known(r.metrics["thumbnail_impressions"]))
      ? content.reduce((s, r) => s + (r.metrics["thumbnail_ctr_pct"] as number) * (r.metrics["thumbnail_impressions"] as number), 0) : null;
    const ad = (k: string, l: string, u: Unit) => NA(k, l, u, "Paid YouTube ad metric", "No paid YouTube ads feed — organic Studio data only");
    sections.push({
      id: "youtube", title: "YouTube", kind: "ad_platform", sources: ["youtube"], available: daily.length + content.length > 0,
      note: "Organic YouTube Studio data. Thumbnail impressions/CTR are not paid ad impressions/CTR. Daily views and the content summary describe the same activity and are never added together.",
      metrics: [
        ad("ad_impressions", "Ad impressions", "count"), M("views", "Views", sumKnown(daily, "views"), "count", "SUM(daily Views) for selected dates"),
        ad("clicks", "Clicks", "count"), ad("avg_cpc", "Avg. CPC", "eur"), ad("cpm", "CPM", "eur"), ad("cost", "Cost", "eur"),
        M("watch_time_hours", "Watch time", sumKnown(content, "watch_time_hours"), "hours", "SUM(Watch time (hours)) from content summary", content.length ? undefined : "Content summary period not fully selected"),
        M("subscribers", "Subscribers gained", sumKnown(content, "subscribers"), "count", "SUM(Subscribers) from content summary"),
        M("thumbnail_impressions", "Thumbnail impressions", ti, "count", "SUM(Thumbnail impressions) — organic surface impressions"),
        M("thumbnail_ctr", "Thumbnail CTR", rate(weighted, ti), "pct", "Impression-weighted Thumbnail click-through rate (%)"),
      ],
      breakdowns: content.length ? [{ title: "Content summary", columns: [{ key: "content", label: "Content", unit: "text" }, { key: "views", label: "Views", unit: "count" }, { key: "watch_time_hours", label: "Watch h", unit: "hours" }, { key: "subscribers", label: "Subs", unit: "count" }, { key: "thumbnail_impressions", label: "Thumb impr.", unit: "count" }, { key: "thumbnail_ctr_pct", label: "Thumb CTR", unit: "pct" }],
        rows: content.map((r) => ({ content: r.dimension_value, ...pick(r, ["views", "watch_time_hours", "subscribers", "thumbnail_impressions", "thumbnail_ctr_pct"]) })) }] : [],
    });
  }

  // SPOTIFY — daily detail is authoritative; summary blocks used only to reconcile.
  {
    const detail = by("spotify", ["daily_detail"]), summary = by("spotify", ["summary"]);
    const playback = detail.filter((r) => r.metrics["starts"] != null);
    const impr = sumKnown(detail, "impressions"), clicks = sumKnown(detail, "clicks"), starts = sumKnown(playback, "starts"), completes = sumKnown(playback, "completes");
    const reconciled = summary.length ? sumKnown(summary, "impressions") === impr && sumKnown(summary, "clicks") === clicks : null;
    const formats = [...new Set(detail.map((r) => String(r.metrics["format"])))];
    sections.push({
      id: "spotify", title: "Spotify", kind: "ad_platform", sources: ["spotify"], available: detail.length > 0,
      note: `Ad-server reported. Daily detail is authoritative; summary blocks are reconciliation only${reconciled == null ? "" : reconciled ? " (summary matches detail ✓)" : " (summary does NOT match detail)"}. Playback metrics cover formats that report them.`,
      metrics: [
        M("impressions", "Ad server impressions", impr, "count", "SUM(daily Ad server impressions)"),
        M("clicks", "Ad server clicks", clicks, "count", "SUM(daily Ad server clicks)"),
        M("ctr", "CTR", rate(clicks, impr, 100), "pct", "SUM(clicks) ÷ SUM(impressions) × 100"),
        M("starts", "Playback starts", starts, "count", "SUM(Start), formats reporting playback"),
        M("first_quartile", "First quartile", sumKnown(playback, "first_quartile"), "count", "SUM(First quartile)"),
        M("midpoint", "Midpoint", sumKnown(playback, "midpoint"), "count", "SUM(Midpoint)"),
        M("third_quartile", "Third quartile", sumKnown(playback, "third_quartile"), "count", "SUM(Third quartile)"),
        M("completes", "Completes", completes, "count", "SUM(Complete)"),
        M("completion_rate", "Completion rate", rate(completes, starts, 100), "pct", "SUM(Complete) ÷ SUM(Start) × 100"),
        NA("spend", "Spend", "eur", "Spend", "Not in this export"),
      ],
      breakdowns: detail.length ? [{ title: "By format", columns: [{ key: "format", label: "Format", unit: "text" }, { key: "impressions", label: "Impr.", unit: "count" }, { key: "clicks", label: "Clicks", unit: "count" }, { key: "ctr", label: "CTR", unit: "pct" }, { key: "starts", label: "Starts", unit: "count" }, { key: "completes", label: "Completes", unit: "count" }, { key: "completion_rate", label: "Compl. rate", unit: "pct" }],
        rows: formats.map((f) => { const rs = detail.filter((r) => r.metrics["format"] === f); const pb = rs.filter((r) => r.metrics["starts"] != null); const i = sumKnown(rs, "impressions"), c = sumKnown(rs, "clicks"), s = sumKnown(pb, "starts"), co = sumKnown(pb, "completes");
          return { format: f, impressions: i, clicks: c, ctr: rate(c, i, 100), starts: s, completes: co, completion_rate: rate(co, s, 100) }; }) }] : [],
    });
  }

  // GOOGLE ADS — campaign period totals; Budget is never spend.
  {
    const recs = by("google_ads");
    const cost = sameCurrency(recs) ? sumKnown(recs, "cost") : null, impr = sumKnown(recs, "impressions"), clicks = sumKnown(recs, "clicks"), conv = sumKnown(recs, "conversions");
    sections.push({
      id: "google_ads", title: "Google Ads", kind: "ad_platform", sources: ["google_ads"], available: recs.length > 0,
      note: "Ad-platform reported campaign totals for the export period (no per-day rows). Budget is not spend. Conversions may be fractional.",
      metrics: [
        M("clicks", "Clicks", clicks, "count", "SUM(Clicks)"), M("impressions", "Impressions", impr, "count", "SUM(Impr.)"),
        M("ctr", "CTR", rate(clicks, impr, 100), "pct", "SUM(Clicks) ÷ SUM(Impr.) × 100"), M("cost", "Cost", cost, "eur", "SUM(Cost)"),
        M("conversions", "Conversions", conv, "ratio", "SUM(Conversions) — platform-attributed, may be fractional"),
        M("cost_per_conversion", "Cost / conv.", rate(cost, conv), "eur", "SUM(Cost) ÷ SUM(Conversions)"),
      ],
      breakdowns: recs.length ? [{ title: "Campaigns", columns: [{ key: "campaign", label: "Campaign", unit: "text" }, { key: "status", label: "Status", unit: "text" }, { key: "impressions", label: "Impr.", unit: "count" }, { key: "clicks", label: "Clicks", unit: "count" }, { key: "ctr", label: "CTR", unit: "pct" }, { key: "cost", label: "Cost", unit: "eur" }, { key: "conversions", label: "Conv.", unit: "ratio" }],
        rows: recs.map((r) => ({ campaign: r.source_campaign, status: r.metrics["status"] ?? null, impressions: r.metrics["impressions"] as number, clicks: r.metrics["clicks"] as number, ctr: rate(r.metrics["clicks"] as number, r.metrics["impressions"] as number, 100), cost: r.metrics["cost"] as number, conversions: r.metrics["conversions"] as number })) }] : [],
    });
  }

  // WEBSITE (GA4) — property-level channel groups, not joined to campaigns.
  {
    const recs = by("ga4");
    const s = sumKnown(recs, "sessions"), e = sumKnown(recs, "engaged_sessions"), ev = sumKnown(recs, "event_count"), t = sumKnown(recs, "engagement_time_total_s");
    sections.push({
      id: "website", title: "Website (GA4 traffic)", kind: "website", sources: ["ga4"], available: recs.length > 0,
      note: "Site-wide GA4 session results by default channel group for the GA4 export period. Not campaign-attributed and not joined to Meta/Google campaigns. Key events do not enumerate add-to-cart or purchases.",
      metrics: [
        NA("users", "Users", "count", "Total users", "Not present in this feed"), NA("new_users", "New users", "count", "New users", "Not present in this feed"),
        M("sessions", "Sessions", s, "count", "SUM(Sessions)"), M("engaged_sessions", "Engaged sessions", e, "count", "SUM(Engaged sessions)"),
        M("engagement_rate", "Engagement rate", rate(e, s, 100), "pct", "SUM(Engaged sessions) ÷ SUM(Sessions) × 100"),
        M("bounce_rate", "Bounce rate", e != null && s ? (1 - e / s) * 100 : null, "pct", "(1 − Engaged sessions ÷ Sessions) × 100 (GA4 definition)"),
        M("events_per_session", "Events / session", rate(ev, s), "ratio", "SUM(Event count) ÷ SUM(Sessions)"),
        M("event_count", "Event count", ev, "count", "SUM(Event count)"), M("key_events", "Key events", sumKnown(recs, "key_events"), "count", "SUM(Key events) — configured key events, not a purchase count"),
        M("avg_engagement_time", "Avg. engagement time / session", rate(t, s), "seconds", "Σ(avg time × sessions) ÷ SUM(Sessions)"),
        NA("session_key_event_rate", "Session key event rate", "pct", "Sessions with a key event ÷ sessions", "Numerator not in feed — shown per channel only"),
        M("total_revenue", "GA4 total revenue", sameCurrency(recs) ? sumKnown(recs, "total_revenue") : null, "eur", "SUM(Total revenue) — GA4-measured, separate from simulated attributed revenue"),
      ],
      breakdowns: recs.length ? [{ title: "By channel group", columns: [{ key: "channel", label: "Channel group", unit: "text" }, { key: "sessions", label: "Sessions", unit: "count" }, { key: "engaged_sessions", label: "Engaged", unit: "count" }, { key: "event_count", label: "Events", unit: "count" }, { key: "key_events", label: "Key events", unit: "count" }, { key: "key_event_rate_pct", label: "Key event rate (reported)", unit: "pct" }, { key: "total_revenue", label: "Revenue", unit: "eur" }],
        rows: recs.map((r) => { const f = r.metrics["reported_session_key_event_rate"];
          return { channel: r.dimension_value, ...pick(r, ["sessions", "engaged_sessions", "event_count", "key_events"]), key_event_rate_pct: known(f) ? Math.round(f * 1e6) / 1e4 : null, total_revenue: (r.metrics["total_revenue"] ?? null) as number | null }; }) }] : [],
    });
  }

  // SIMULATED SHOPPING JOURNEY — the existing generated website actions, kept apart from GA4.
  {
    const rows = perfRows.filter((r) => r.date >= start && r.date <= end);
    const w = webTotals(rows);
    sections.push({
      id: "simulated_journey", title: "Simulated shopping journey", kind: "simulated", sources: [], available: w.available > 0,
      note: "Generated demo cohort from the dashboard (Meta + Google Ads demo campaigns). Simulated attribution — never added to GA4 revenue.",
      metrics: [
        M("website_sessions", "Sessions", w.values.website_sessions, "count", "SUM(simulated website_sessions)"),
        M("view_item", "Product views", w.values.view_item, "count", "Sessions reaching product view"), M("add_to_cart", "Add to basket", w.values.add_to_cart, "count", "Sessions reaching add to basket"),
        M("begin_checkout", "Checkouts started", w.values.begin_checkout, "count", "Sessions reaching checkout"), M("purchases", "Purchases", w.values.purchases, "count", "Sessions with a purchase"),
        M("purchase_revenue", "Simulated attributed revenue", w.values.purchase_revenue, "eur", "SUM(purchase_revenue), assigned once to its generated campaign"),
      ],
      breakdowns: [],
    });
  }

  // LWM — variants shown with provenance; combined only because the generator guarantees distinct inventory.
  {
    const variants = (["lwm1", "lwm2", "lwm3"] as const).map((id) => ({ id, recs: by(id, ["daily"]) })).filter((v) => v.recs.length);
    const all = variants.flatMap((v) => v.recs);
    const distinct = all.length > 0 && all.every((r) => r.provenance["inventory_distinct"] === true);
    const impr = distinct ? sumKnown(all, "impressions") : null, clicks = distinct ? sumKnown(all, "clicks") : null, cost = distinct ? sumKnown(all, "cost") : null;
    const sites = by("lwm2", ["site_breakdown"]);
    const row = (id: SourceId, rs: MappedRecord[]) => { const i = sumKnown(rs, "impressions"), c = sumKnown(rs, "clicks"), co = sumKnown(rs, "cost");
      return { variant: SOURCE_INFO[id].label, inventory: String(rs[0]?.provenance["inventory"] ?? ""), period: `${rs[0]?.period_start} → ${rs.at(-1)?.period_end}`, impressions: i, clicks: c, ctr: rate(c, i, 100), cost: co, cpc: rate(co, c), cpm: rate(co, i, 1000) }; };
    sections.push({
      id: "lwm", title: "LWM", kind: "ad_platform", sources: ["lwm1", "lwm2", "lwm3"], available: all.length > 0,
      note: distinct ? "Combined totals allowed: each generated variant uses an explicitly distinct generated inventory. Real files would need proof of disjoint inventory. Cost is known for LWM 2 only; daily reach is never summed." : "Variants shown separately — distinct inventory not guaranteed, so no combined total.",
      metrics: [
        M("impressions", "Impressions (combined)", impr, "count", "SUM(daily impressions) across distinct generated inventories"),
        M("clicks", "Clicks (combined)", clicks, "count", "SUM(daily clicks)"), M("ctr", "CTR (combined)", rate(clicks, impr, 100), "pct", "SUM(clicks) ÷ SUM(impressions) × 100"),
        M("cost", "Cost (combined)", cost, "eur", "SUM(Amount) — N/A unless every included variant reports cost", cost == null && all.length ? "LWM 1/3 report no cost" : undefined),
        M("cpc", "CPC (combined)", rate(cost, clicks), "eur", "SUM(cost) ÷ SUM(clicks)"), M("cpm", "CPM (combined)", rate(cost, impr, 1000), "eur", "SUM(cost) ÷ SUM(impressions) × 1000"),
        NA("reach", "Reach", "count", "Deduplicated reach", "Daily reach is not additive — not available"),
      ],
      breakdowns: [
        ...(variants.length ? [{ title: "By variant", columns: [{ key: "variant", label: "Variant", unit: "text" as Unit }, { key: "inventory", label: "Inventory (provenance)", unit: "text" as Unit }, { key: "period", label: "Dates", unit: "text" as Unit }, { key: "impressions", label: "Impr.", unit: "count" as Unit }, { key: "clicks", label: "Clicks", unit: "count" as Unit }, { key: "ctr", label: "CTR", unit: "pct" as Unit }, { key: "cost", label: "Cost", unit: "eur" as Unit }, { key: "cpc", label: "CPC", unit: "eur" as Unit }, { key: "cpm", label: "CPM", unit: "eur" as Unit }], rows: variants.map((v) => row(v.id, v.recs)) }] : []),
        ...(sites.length ? [{ title: "LWM 2 site breakdown (same delivery as its daily table — not additive)", columns: [{ key: "site", label: "Site", unit: "text" as Unit }, { key: "impressions", label: "Impr.", unit: "count" as Unit }, { key: "reach", label: "Reach (site)", unit: "count" as Unit }, { key: "clicks", label: "Clicks", unit: "count" as Unit }, { key: "cost", label: "Cost", unit: "eur" as Unit }],
          rows: sites.map((r) => ({ site: r.dimension_value, ...pick(r, ["impressions", "reach", "clicks", "cost"]) })) }] : []),
      ],
    });
  }

  // TV — flight periods; ratings points add up, reach does not.
  {
    const recs = by("tv");
    sections.push({
      id: "tv", title: "TV", kind: "offline", sources: ["tv"], available: recs.length > 0,
      note: "Flight-period totals. GRPs (TTL universe) and TRPs (16+ universe) are kept separate; reach is never combined across flights or relabelled as frequency.",
      metrics: [
        M("grps_ttl", "GRPs (TTL)", sumKnown(recs, "grps_ttl"), "grp", "SUM(GRPs) across fully selected flights"),
        M("trps_16", "TRPs (all 16+)", sumKnown(recs, "trps_16"), "grp", "SUM(TRPs) across fully selected flights"),
        ...(["reach1_ttl_pct:Reach 1+ (TTL)", "reach3_ttl_pct:Reach 3+ (TTL)", "reach1_16_pct:Reach 1+ (all 16+)", "reach3_16_pct:Reach 3+ (all 16+)"].map((s) => { const [k, l] = s.split(":") as [string, string];
          return recs.length === 1 ? M(k, l, recs[0]!.metrics[k] as number, "pct", `${l} for the single selected flight`) : NA(k, l, "pct", `${l} — % of universe`, "Reach is not additive across flights — see per-flight table"); })),
        M("net_cost", "Net cost", sameCurrency(recs) ? sumKnown(recs, "net_cost") : null, "eur", "SUM(Net Cost)"),
      ],
      breakdowns: recs.length ? [{ title: "Flights", columns: [{ key: "period", label: "Period", unit: "text" }, { key: "grps_ttl", label: "GRPs TTL", unit: "grp" }, { key: "reach1_ttl_pct", label: "R1+ TTL", unit: "pct" }, { key: "reach3_ttl_pct", label: "R3+ TTL", unit: "pct" }, { key: "trps_16", label: "TRPs 16+", unit: "grp" }, { key: "reach1_16_pct", label: "R1+ 16+", unit: "pct" }, { key: "reach3_16_pct", label: "R3+ 16+", unit: "pct" }, { key: "net_cost", label: "Net cost", unit: "eur" }],
        rows: recs.map((r) => ({ period: `${r.period_start} → ${r.period_end}`, ...pick(r, ["grps_ttl", "reach1_ttl_pct", "reach3_ttl_pct", "trps_16", "reach1_16_pct", "reach3_16_pct", "net_cost"]) })) }] : [],
    });
  }

  // STORES — no feed in this demo.
  sections.push({
    id: "stores", title: "Stores", kind: "stores", sources: [], available: false, note: "No store feed. These fields stay N/A until a store source exists.",
    metrics: [["footfall_week_before", "Footfall — week before"], ["footfall_during", "Footfall — during"], ["footfall_week_after", "Footfall — week after"], ["sales_documents", "Sales documents"], ["quantity", "Quantity"], ["net_sales", "Net sales"]].map(([k, l]) => NA(k!, l!, k === "net_sales" ? "eur" : "count", l!, "No store feed")),
    breakdowns: [],
  });

  return { campaign: MASTER_CAMPAIGN.label, campaign_key: MASTER_CAMPAIGN.key, start, end, days: daysBetween(start, end), sections, excluded };
}

function pick(r: MappedRecord, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, (r.metrics[k] ?? null) as number | string | null]));
}

export function formatValue(v: number | string | null, unit: Unit): string {
  if (v == null) return "N/A";
  if (typeof v === "string") return v;
  switch (unit) {
    case "eur": return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(v);
    case "pct": return `${v.toFixed(2)}%`;
    case "ratio": return v.toLocaleString("en-IE", { maximumFractionDigits: 2 });
    case "hours": return `${v.toLocaleString("en-IE", { maximumFractionDigits: 2 })} h`;
    case "seconds": return `${v.toFixed(1)} s`;
    case "grp": return v.toLocaleString("en-IE", { maximumFractionDigits: 1 });
    default: return v.toLocaleString("en-IE", { maximumFractionDigits: 2 });
  }
}

const csvCell = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** CSV with synthetic labels, period and provenance. Raw numbers; empty cell + "N/A" status for unavailable values. */
export function reportToCsv(r: MasterReport, exportedAt: string): string {
  const L: unknown[][] = [
    ["# Neptun Master Report — GENERATED DEMO DATA (synthetic; not real Neptun performance)"],
    ["# synthetic", "true"], ["# schema_version", "sources.v2"], ["# campaign", r.campaign], ["# period", `${r.start} to ${r.end}`], ["# promotion_duration_days", r.days], ["# exported_at", exportedAt],
    [],
    ["section", "section_kind", "metric", "value", "status", "unit", "definition", "note", "sources"],
  ];
  for (const s of r.sections) for (const m of s.metrics) L.push([s.title, s.kind, m.label, m.value ?? "", m.value == null ? "N/A" : "ok", m.unit, m.definition, m.note ?? "", s.sources.map((x) => SOURCE_INFO[x].label).join(" + ") || (s.kind === "simulated" ? "Dashboard simulated cohort" : "none")]);
  for (const s of r.sections) for (const b of s.breakdowns) {
    L.push([], [`# breakdown: ${s.title} — ${b.title}`], b.columns.map((c) => c.label));
    for (const row of b.rows) L.push(b.columns.map((c) => row[c.key] ?? "N/A"));
  }
  if (r.excluded.length) {
    L.push([], ["# excluded (partial reporting intervals, not prorated)"], ["source", "record_kind", "period", "records", "reason"]);
    for (const e of r.excluded) L.push([SOURCE_INFO[e.source].label, e.record_kind, e.period, e.records, e.reason]);
  }
  return L.map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}
