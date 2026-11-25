import { DEMO_CHANNELS, ledgerRows, ledgerTotals } from "./demo-ledger";
import { describe, expect, it } from "vitest";
import wf from "../../../workflows/neptun-all-sources-demo.json";
import { generateDemoFixture } from "../demo-fixture";
import { generateSourceBundle, SOURCE_IDS, type Workbook } from "./bundle";
import { fileToWorkbook, workbookToFile } from "./files";
import { summarizeRecords, validateSourcesPayload } from "./ingest";
import { DEMO_READER_OPTIONS as O, READERS, readBundle, readGoogleAds, readLwm1, readMeta, readSpotify, readTV } from "./readers";
import { buildMasterReport, rate, sumKnown } from "./report";

const fresh = () => generateSourceBundle();
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const metric = (r: ReturnType<typeof buildMasterReport>, s: string, k: string) => r.sections.find((x) => x.id === s)!.metrics.find((m) => m.key === k)!.value;
const FULL = ["2026-10-15", "2026-11-13"] as const;

describe("source mappings", () => {
  const recs = readBundle(fresh());
  const sum = summarizeRecords(recs);
  it("maps all 10 source bundles to the expected record counts", () => {
    expect(Object.fromEntries(SOURCE_IDS.map((id) => [id, sum[id]!.records]))).toEqual({ meta: 30, google_ads: 2, youtube: 33, spotify: 310, ga4: 6, lwm1: 14, lwm2: 13, lwm3: 16, tv: 2, simulation: 240 });
    expect(recs).toHaveLength(666);
  });
  it("Meta matches the dashboard baseline and keeps link clicks separate from all clicks", () => {
    expect(sum['meta']!.totals).toMatchObject({ spend: 3435, impressions: 343500, link_clicks: 6870, clicks_all: 8505 });
    const base = generateDemoFixture().filter((r) => r.channel === "meta");
    readMeta(fresh().sources.meta, O).forEach((r, i) => expect(r.metrics["link_clicks"]).toBe(base[i]!.clicks));
  });
  it("excludes summary/total rows", () => {
    expect(readMeta(fresh().sources.meta, O).every((r) => r.source_campaign)).toBe(true); // Meta summary row skipped
    expect(readGoogleAds(fresh().sources.google_ads, O).map((r) => r.source_campaign)).toEqual(["Synthetic Search Demo", "Synthetic Brand Demo"]);
    expect(readLwm1(fresh().sources.lwm1, O).some((r) => r.record_key.includes("Total"))).toBe(false);
    expect(readTV(fresh().sources.tv, O)).toHaveLength(2);
  });
  it("Google Ads keeps fractional conversions, reads the export period, and never treats Budget as spend", () => {
    const [a, b] = readGoogleAds(fresh().sources.google_ads, O);
    expect(a!.metrics["conversions"]).toBe(250.5);
    expect([a!.period_start, a!.period_end]).toEqual([...FULL]);
    expect(a!.metrics["cost"]).toBe(5000);
    expect(b!.metrics["impressions"]).toBe(13500); // known zero, not missing
  });
  it("honours header offsets (Spotify blocks rows 8/14/19/25, GA4 row 10, LWM row 10 col B, LWM2 rows 5/18, Google row 3)", () => {
    const b = fresh();
    const rows = b.sources.spotify.sheets[0]!.rows;
    expect([8, 14, 19, 25].map((n) => rows[n - 1]![0])).toEqual(["Format", "Format", "Format", "Format"]);
    expect(b.sources.ga4.sheets[0]!.rows[9]![0]).toMatch(/^Session primary channel group/);
    expect(b.sources.lwm1.sheets[0]!.rows[9]!.slice(1)).toEqual(["Day", "Impr.", "Clicks", "Generated cost (EUR)", "Generated reach"]);
    expect([b.sources.lwm2.sheets[0]!.rows[4]![1], b.sources.lwm2.sheets[0]!.rows[17]![1]]).toEqual(["Days", "Sites"]);
    const shifted = clone(b.sources.ga4); shifted.sheets[0]!.rows.splice(0, 1);
    expect(() => READERS.ga4(shifted, O)).toThrow(/row 10/);
  });
  it("reads files back from CSV, legacy XLS and XLSX with identical mappings", () => {
    const b = fresh();
    for (const id of SOURCE_IDS) {
      const wb = b.sources[id]; const f = workbookToFile(wb);
      expect(READERS[id](fileToWorkbook(f.data, wb.format), O)).toEqual(READERS[id](wb, O));
    }
  });
  it("Spotify detail is authoritative and the summary reconciles without being added", () => {
    const r = readSpotify(fresh().sources.spotify, O);
    const detail = r.filter((x) => x.record_kind === "daily_detail"), summary = r.filter((x) => x.record_kind === "summary");
    expect(sumKnown(summary, "impressions")).toBe(sumKnown(detail, "impressions"));
    expect(summarizeRecords(r)['spotify']!.totals["impressions"]).toBe(411000);
  });
  it("rejects invalid calendar dates, wrong currency and duplicate rows", () => {
    const m = clone(fresh().sources.meta); m.sheets[0]!.rows[1]![0] = "2026-02-30"; m.sheets[0]!.rows[1]![1] = "2026-02-30";
    expect(() => readMeta(m, O)).toThrow(/calendar date/);
    const g = clone(fresh().sources.google_ads); g.sheets[0]!.rows[3]![5] = "USD";
    expect(() => readGoogleAds(g, O)).toThrow(/currency/);
    const d = clone(fresh().sources.lwm1) as Workbook; d.sheets[0]!.rows.splice(11, 0, d.sheets[0]!.rows[10]!);
    expect(() => readLwm1(d, O)).toThrow(/duplicate/);
    const n = clone(fresh().sources.meta); n.sheets[0]!.rows[1]![14] = -5;
    expect(() => readMeta(n, O)).toThrow(/nonnegative/);
  });
});

describe("legacy reference report math (separate from the complete ledger)", () => {
  const recs = readBundle(fresh()).filter(r=>r.source_id!=="simulation");
  const full = buildMasterReport(recs, generateDemoFixture(), ...FULL);
  it("uses weighted rates from compatible totals", () => {
    expect(metric(full, "meta", "link_ctr")).toBeCloseTo(2, 10);
    expect(metric(full, "meta", "link_cpc")).toBeCloseTo(0.5, 10);
    expect(metric(full, "google_ads", "ctr")).toBeCloseTo(3, 10);
    expect(metric(full, "website", "bounce_rate")).toBeCloseTo((1 - 8160 / 12650) * 100, 10);
    expect(rate(5, 0)).toBeNull();
  });
  it("never sums non-additive reach or the YouTube summary with daily views", () => {
    expect(metric(full, "meta", "reach")).toBeNull();
    expect(metric(full, "lwm", "reach")).toBeNull();
    expect(metric(full, "tv", "reach1_ttl_pct")).toBeNull();
    expect(metric(full, "tv", "grps_ttl")).toBe(320.5);
    expect(metric(full, "youtube", "views")).toBe(16350);
  });
  it("keeps GA4 revenue and simulated attributed revenue separate", () => {
    expect(metric(full, "website", "total_revenue")).toBe(22100.75);
    expect(metric(full, "simulated_journey", "purchase_revenue")).toBe(41925);
  });
  it("missing values stay N/A while known zeros stay zero", () => {
    expect(metric(full, "lwm", "cost")).toBe(498.1); // LWM 1/3 have no cost
    expect(metric(full, "spotify", "spend")).toBeNull();
    expect(metric(full, "stores", "net_sales")).toBeNull();
    expect(sumKnown([{ metrics: { x: 0 } }, { metrics: { x: 0 } }] as never, "x")).toBe(0);
    expect(sumKnown([{ metrics: { x: 1 } }, { metrics: {} }] as never, "x")).toBeNull();
  });
  it("excludes partly selected period records instead of prorating them", () => {
    const part = buildMasterReport(recs, [], "2026-10-15", "2026-10-31");
    expect(metric(part, "google_ads", "cost")).toBeNull();
    expect(part.excluded.map((e) => e.source)).toEqual(expect.arrayContaining(["google_ads", "ga4", "youtube"]));
    expect(metric(part, "tv", "grps_ttl")).toBe(180.5); // flight 1 fully inside
    expect(metric(part, "tv", "reach1_ttl_pct")).toBe(52.3); // single flight → reach shown
    expect(metric(part, "meta", "spend")).toBe(sumKnown(recs.filter((r) => r.source_id === "meta" && r.period_end <= "2026-10-31"), "spend"));
  });
});

describe("guarded import validation", () => {
  const payload = () => { const b = fresh(); return { metadata: b.metadata, sources: b.sources }; };
  it("accepts the canonical bundle or any subset of it", () => {
    const v = validateSourcesPayload(payload());
    expect(v.success && v.records.length).toBe(666);
    const p = payload(); const sub = { metadata: p.metadata, sources: { tv: p.sources.tv } };
    expect(validateSourcesPayload(sub).success).toBe(true);
  });
  it("rejects non-synthetic, wrong schema, unknown source and altered samples before writes", () => {
    const p1 = payload(); (p1.metadata as { synthetic: unknown }).synthetic = false;
    expect(validateSourcesPayload(p1)).toMatchObject({ success: false, status: 422 });
    const p2 = payload(); (p2.metadata as { schema_version: unknown }).schema_version = "demo.v2";
    expect(validateSourcesPayload(p2).success).toBe(false);
    const p3 = payload() as { metadata: unknown; sources: Record<string, unknown> }; p3.sources["crm"] = {};
    expect(validateSourcesPayload(p3).success).toBe(false);
    const p4 = payload(); p4.sources.google_ads.sheets[0]!.rows[3]![18] = 5371;
    expect(validateSourcesPayload(p4)).toMatchObject({ success: false, error: expect.stringContaining("google_ads") });
    const p5 = payload(); p5.sources.lwm1.sheets[0]!.rows.splice(11, 0, p5.sources.lwm1.sheets[0]!.rows[10]!);
    expect(validateSourcesPayload(p5).success).toBe(false);
    expect(validateSourcesPayload({ metadata: payload().metadata, sources: {} }).success).toBe(false);
    expect(validateSourcesPayload("x").success).toBe(false);
  });
  it("repeated validation yields identical records (idempotent upsert keys)", () => {
    const a = validateSourcesPayload(payload()), b = validateSourcesPayload(payload());
    expect(a.success && b.success && JSON.stringify(a.records) === JSON.stringify(b.records)).toBe(true);
    if (a.success) expect(new Set(a.records.map((r) => `${r.source_id}|${r.record_key}`)).size).toBe(666);
  });
  it("leaves the 60-row dashboard baseline untouched", () => {
    const f = generateDemoFixture();
    expect(f).toHaveLength(60);
    expect(f.reduce((s, r) => s + r.spend, 0)).toBe(8805);
  });
});

describe("All Sources n8n workflow", () => {
  const nodes = wf.nodes as { name: string; type: string; parameters: Record<string, unknown> }[];
  const code = (i: number) => String(nodes[i]!.parameters["jsCode"]);
  it("is inactive, manual-only and posts to the guarded route", () => {
    expect(wf.active).toBe(false);
    expect(wf.settings.timezone).toBe("Europe/Skopje");
    expect(nodes.map((n) => n.type)).toEqual(["n8n-nodes-base.manualTrigger", "n8n-nodes-base.code", "n8n-nodes-base.httpRequest", "n8n-nodes-base.httpRequest", "n8n-nodes-base.code"]);
    expect(nodes[2]!.parameters["url"]).toBe("https://neptun-marketing-demo.lovable.app/api/public/demo-sources-ingest");
  });
  it("generator node reproduces the canonical bundle, and the verifier passes on matching responses and fails on changed ones", () => {
    const out = new Function(code(1))() as { json: unknown }[];
    expect(validateSourcesPayload(out[0]!.json).success).toBe(true);
    const stored = summarizeRecords(readBundle(fresh()));
    const resp = (s = stored) => ({ synthetic: true, schema_version: "sources.v2", imported_record_count: 666, total_source_record_count: 666, imported_at: new Date().toISOString(), channel_totals:Object.fromEntries(DEMO_CHANNELS.map(c=>[c,ledgerTotals(ledgerRows(readBundle(fresh())).filter(r=>r.channel===c))])), stored: s });
    const run = (first: unknown, second: unknown) => new Function("$", "$json", code(4))(() => ({ first: () => ({ json: first }) }), second);
    expect(run(resp(), resp())[0].json.success).toBe(true);
    const bad = clone(stored); bad['tv']!.totals["net_cost"] = 1;
    expect(() => run(resp(), resp(bad))).toThrow(/net_cost/);
  });
});

describe("review corrections", () => {
  const recs = readBundle(fresh());
  it("GA4 key event rate shows as a percentage, keeps the raw fraction, and stays N/A in aggregate", async () => {
    const { reportToCsv, formatValue } = await import("./report");
    const r = buildMasterReport(recs.filter(r=>r.source_id!=="simulation"), [], ...FULL);
    const ga4 = r.sections.find((s) => s.id === "website")!;
    const organic = ga4.breakdowns[0]!.rows.find((x) => x["channel"] === "Organic Search")!;
    expect(organic["key_event_rate_pct"]).toBe(2.38);
    expect(formatValue(organic["key_event_rate_pct"] ?? null, "pct")).toBe("2.38%");
    expect(recs.find((x) => x.dimension_value === "Organic Search")!.metrics["reported_session_key_event_rate"]).toBe(0.0238);
    expect(metric(r, "website", "session_key_event_rate")).toBeNull();
    expect(reportToCsv(r, "t")).toContain("Organic Search,4200,2900,33600,120,2.38,5400.5");
  });
  it("keeps every standard sample column as reported fields without changing totals", () => {
    const m = recs.find((r) => r.source_id === "meta")!.metrics;
    expect(m).toMatchObject({ reported_frequency: 1.43, reported_cpm_eur: 10, reported_cpc_link_eur: 0.5, reported_ctr_link_pct: 2, reported_ctr_all_pct: 2.4, reported_cpc_all_eur: 0.42, reported_cost_per_lpv_eur: 0.67, reported_cost_per_result_eur: 0.67, ends: "Ongoing", results_initial: 150, results_initial_indicator: "actions:landing_page_view" });
    const g = recs.find((r) => r.source_campaign === "Synthetic Search Demo")!.metrics;
    expect(g).toMatchObject({ budget_name: "Synthetic search budget", budget_type: "Daily", status_reasons: "Generated eligible campaign", reported_optimization_score: "84.0%", reported_cost_per_conversion_eur: 19.96, reported_viewable_ctr: "2.80%", reported_avg_cpc_eur: 0.93, reported_ga4_engaged_sessions_pct: "61.20%", reported_ctr: "3.00%", reported_relative_ctr: 1.12 });
    expect(recs.find((r) => r.source_campaign === "Synthetic Brand Demo")!.metrics["status_reasons"]).toBe("Generated eligible campaign");
    expect(recs.find((r) => r.source_id === "ga4")!.metrics).toMatchObject({ reported_engagement_rate: 0.6905, reported_avg_engagement_time_s: 60, reported_events_per_session: 8 });
    const sp = recs.find((r) => r.record_kind === "daily_detail")!.metrics;
    expect(typeof sp["reported_ctr_pct"]).toBe("number"); expect(typeof sp["reported_completion_rate_pct"]).toBe("number");
    expect(recs.find((r) => r.record_kind === "summary")!.metrics["reported_ctr_pct"]).toBeTypeOf("number");
    expect(recs.find((r) => r.source_id === "lwm2")!.metrics).toMatchObject({ reported_ctr_pct: 0.2, reported_cpc_eur: 2, reported_cpm_eur: 4 });
    expect(recs).toHaveLength(666);
    expect(summarizeRecords(recs)["tv"]!.totals).toEqual({ net_cost: 21500, grps_ttl: 320.5 });
  });
  it("finds Spotify summary headers in B–F and TV headers from D with a spacer column (synthetic shifted copies)", () => {
    const sp = clone(fresh().sources.spotify);
    sp.sheets[0]!.rows = sp.sheets[0]!.rows.map((r) => (r.length ? [null, ...r] : r));
    expect(readSpotify(sp, O)).toEqual(readSpotify(fresh().sources.spotify, O));
    const tv = clone(fresh().sources.tv);
    tv.sheets[0]!.rows = tv.sheets[0]!.rows.map((r, i) => (i >= 1 && r.length ? [null, null, null, r[0]!, r[1]!, null, ...r.slice(2)] : r));
    expect(tv.sheets[0]!.rows[1]!.slice(3, 7)).toEqual(["Campaign", "Period", null, "GRPs (TTL)"]);
    expect(readTV(tv, O)).toEqual(readTV(fresh().sources.tv, O));
  });
});
