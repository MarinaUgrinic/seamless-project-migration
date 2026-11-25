import { ledgerRows, selectLedger, ledgerPeriods, ledgerTotals, DEMO_CHANNELS, MEDIA_CHANNELS } from "./sources/demo-ledger";
import { z } from "zod";
import { filterRows, totals, webTotals, type PerfRow } from "./metrics";
import { buildMasterReport } from "./sources/report";
import { isRealDate, type MappedRecord } from "./sources/readers";

export const reportFiltersSchema = z.object({
  start: z.string(), end: z.string(),
  channel: z.enum(["all", "meta", "google_ads", "youtube", "spotify", "ga4", "lwm", "tv", "stores"]),
  granularity: z.enum(["daily", "weekly", "monthly"]),
}).strict().refine((v) => isRealDate(v.start) && isRealDate(v.end) && v.start >= "2026-10-15" && v.end <= "2026-11-13" && v.start <= v.end, "Choose valid dates inside the demo reporting period.");
export type ReportFilters = z.infer<typeof reportFiltersSchema>;

export const managementDeckSchema = z.object({
  title: z.string(),
  slides: z.array(z.object({
    title: z.string(),
    takeaway: z.string(),
    points: z.array(z.object({ statement: z.string(), evidence: z.string() })),
    speakerNotes: z.string(),
  })),
});
export type ManagementDeck = z.infer<typeof managementDeckSchema>;
export interface SavedManagementReport { deck: ManagementDeck; filters: ReportFilters; generatedAt: string; dataUpdatedAt: string | null }

const sectionsFor: Record<string, string[]> = { meta: ["meta", "simulated_journey"], google_ads: ["google_ads", "simulated_journey"], youtube: ["youtube"], spotify: ["spotify"], ga4: ["website"], lwm: ["lwm"], tv: ["tv"], stores: ["stores"] };

/** Same full-selection, interval and channel rules as the visible dashboard; never combine the two cohorts. */
export function buildManagementEvidence(records: MappedRecord[], perf: PerfRow[], filters: ReportFilters) {
  const adChannel = filters.channel === "all" || filters.channel === "meta" || filters.channel === "google_ads" ? filters.channel : null;
  const selected = adChannel === null ? [] : filterRows(perf, filters.start, filters.end, adChannel);
  const master = buildMasterReport(records, selected, filters.start, filters.end);
  const keep = sectionsFor[filters.channel];
  const sections = keep ? master.sections.filter((s) => keep.includes(s.id)) : master.sections;
  const excluded = master.excluded.filter((e) => sections.some((s) => s.sources.includes(e.source)));
  const ledger = selectLedger(ledgerRows(records),filters.start,filters.end,filters.channel);
  return {
    allChannelSimulation: { scope: "Complete canonical generated daily ledger; do not add it to the duplicate baseline or reference exports", mediaOnly: ledgerTotals(ledger.filter(r=>MEDIA_CHANNELS.includes(r.channel))), byChannel: DEMO_CHANNELS.filter(c=>filters.channel==="all"||filters.channel===c).map(channel=>({channel,scope:channel==="ga4"?"site-wide":channel==="stores"?"offline stores":"campaign",totals:ledgerTotals(ledger.filter(r=>r.channel===channel))})), byPeriod: ledgerPeriods(ledger,filters.granularity).map(p=>({period:p.key,channel:p.channel,from:p.from,to:p.to,partial:p.partial,totals:p.totals})) },
    synthetic: true, filters,
    adCohort: adChannel === null ? null : {
      scope: "Separate 60-row Meta & Google Ads synthetic ad cohort, not the nine-source master report",
      totals: selected.length ? totals(selected) : null,
      website: webTotals(selected),
      byChannel: (["meta", "google_ads"] as const).filter((c) => adChannel === "all" || adChannel === c).map((c) => {
        const rs = selected.filter((r) => r.channel === c);
        return { channel: c, totals: rs.length ? totals(rs) : null, website: webTotals(rs) };
      }),
    },
    sourceReport: { sections, excluded },
    hasData: selected.length > 0 || sections.some((s) => s.available),
  };
}

export function normalizeDeck(value: unknown): ManagementDeck {
  const parsed = managementDeckSchema.parse(value);
  if (parsed.slides.length !== 5 || parsed.slides.some((s) => !s.title.trim() || !s.takeaway.trim() || !s.points.length || s.points.some((p) => !p.statement.trim() || !p.evidence.trim()))) {
    throw new Error("AI returned an incomplete presentation. No report was saved.");
  }
  return { title: parsed.title.slice(0, 160), slides: parsed.slides.map((s) => ({ title: s.title.slice(0, 120), takeaway: s.takeaway.slice(0, 400), points: s.points.slice(0, 3).map((p) => ({ statement: p.statement.slice(0, 400), evidence: p.evidence.slice(0, 500) })), speakerNotes: s.speakerNotes.slice(0, 1800) })) };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
export function presentationHtml(report: SavedManagementReport, theme: Record<string, string>): string {
  const css = ["background", "foreground", "primary", "muted-foreground", "border", "card"].map((k) => `--${k}:${escapeHtml(theme[k] ?? "inherit")}`).join(";");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(report.deck.title)}</title><style>:root{${css}}*{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--foreground);font-family:Arial,sans-serif;letter-spacing:0}section{max-width:1100px;margin:0 auto;padding:48px;min-height:90vh;border-bottom:1px solid var(--border);background:var(--card);break-after:page}h1{font-size:36px;color:var(--primary)}h2{font-size:23px;line-height:1.4}li{margin:24px 0;font-size:21px;line-height:1.5}small,p,aside{color:var(--muted-foreground);line-height:1.5}li small{display:block;font-size:16px}aside{font-size:15px;border-top:1px solid var(--border);padding-top:20px}@media(max-width:600px){section{padding:24px}h1{font-size:28px}}@media print{@page{size:A4 landscape;margin:8mm}section{min-height:0;padding:16px}h1{font-size:28px}li{font-size:17px;margin:15px 0}}</style></head><body>${report.deck.slides.map((s, i) => `<section><p>NEPTUN · MANAGEMENT REPORT · ${i + 1}/5</p><small>DEMO DATA — SYNTHETIC · AI-GENERATED DRAFT<br>${escapeHtml(report.filters.start)} → ${escapeHtml(report.filters.end)} · ${escapeHtml(report.filters.channel)} · ${escapeHtml(report.filters.granularity)}<br>Generated: ${escapeHtml(report.generatedAt)} · Data last updated: ${escapeHtml(report.dataUpdatedAt ?? "Not available")}</small><h1>${escapeHtml(s.title)}</h1><h2>${escapeHtml(s.takeaway)}</h2><ul>${s.points.map((p) => `<li>${escapeHtml(p.statement)}<small>${escapeHtml(p.evidence)}</small></li>`).join("")}</ul><aside>${escapeHtml(s.speakerNotes)}</aside><p><small>Suggestions are hypotheses for testing, not proven gains or automatic ad changes. All numbers are fictional. Review before sharing.</small></p></section>`).join("")}</body></html>`;
}