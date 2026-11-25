import { DEMO_CAMPAIGNS, generateDemoFixture } from "./demo-fixture";

/** Standard Meta Ads export columns (headers on row 1). */
export const META_HEADERS = [
  "Reporting starts",
  "Reporting ends",
  "Campaign name",
  "Amount spent (EUR)",
  "Impressions",
  "Clicks (all)",
  "Link clicks",
] as const;

export type ClicksMetric = "link_clicks" | "clicks_all";

export interface MetaMappedRow {
  date: string;
  channel: "meta";
  campaign_id: string;
  currency: "EUR";
  spend: number;
  impressions: number;
  link_clicks: number;
  clicks_all: number;
  /** Dashboard clicks, chosen explicitly via clicksMetric — never mixed. */
  clicks: number;
}

export interface MetaParseOptions {
  /** Explicit campaign name -> stable campaign_id mapping. Names are never used as identity. */
  campaignMap: Record<string, string>;
  clicksMetric: ClicksMetric;
}

export class MetaExportError extends Error {}

/** Synthetic Meta-style name used only for the demo campaign. */
export const SYNTHETIC_META_CAMPAIGN_NAME = "Synthetic Demo Campaign A";

/** Synthetic-only Clicks (all) generator: link clicks plus a fixed amount of other clicks. */
const otherClicks = (i: number) => 40 + i;

/** Builds a wholly synthetic Meta-style CSV from the demo fixture, including a summary row. */
export function generateSyntheticMetaExportCsv(): string {
  const meta = generateDemoFixture().filter((r) => r.channel === "meta");
  const lines = [META_HEADERS.join(",")];
  let spend = 0, impr = 0, all = 0, link = 0;
  meta.forEach((r, i) => {
    const clicksAll = r.clicks + otherClicks(i);
    spend += r.spend; impr += r.impressions; all += clicksAll; link += r.clicks;
    lines.push([r.date, r.date, `"${SYNTHETIC_META_CAMPAIGN_NAME}"`, r.spend.toFixed(2), r.impressions, clicksAll, r.clicks].join(","));
  });
  // Meta-style total row: no campaign name. Must be excluded by the parser.
  lines.push([meta[0]!.date, meta.at(-1)!.date, "", spend.toFixed(2), impr, all, link].join(","));
  return lines.join("\n");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function int(v: string, field: string, line: number): number {
  const n = Number(v.trim());
  if (v.trim() === "" || !Number.isInteger(n) || n < 0) throw new MetaExportError(`Line ${line}: ${field} must be a nonnegative whole number`);
  return n;
}

/** Maps a Meta-style export to daily rows. Rejects interval totals instead of inventing daily values. */
export function parseMetaExport(csv: string, opts: MetaParseOptions): MetaMappedRow[] {
  const table = parseCsv(csv);
  const header = (table[0] ?? []).map((h) => h.trim());
  const idx = Object.fromEntries(META_HEADERS.map((h) => [h, header.indexOf(h)])) as Record<(typeof META_HEADERS)[number], number>;
  const missing = META_HEADERS.filter((h) => idx[h] < 0);
  if (missing.length) throw new MetaExportError(`Missing columns: ${missing.join(", ")}`);

  const out: MetaMappedRow[] = [];
  const seen = new Set<string>();
  table.slice(1).forEach((cells, k) => {
    const line = k + 2;
    const get = (h: (typeof META_HEADERS)[number]) => (cells[idx[h]] ?? "").trim();
    const name = get("Campaign name");
    if (name === "") return; // summary/total row
    const start = get("Reporting starts"), end = get("Reporting ends");
    if (!DATE_RE.test(start) || !DATE_RE.test(end)) throw new MetaExportError(`Line ${line}: reporting dates must be YYYY-MM-DD`);
    if (start !== end) throw new MetaExportError(`Line ${line}: interval ${start}–${end} is a period total, not a daily row`);
    const campaign_id = opts.campaignMap[name];
    if (!campaign_id) throw new MetaExportError(`Line ${line}: campaign has no explicit ID mapping`);
    const spend = Number(get("Amount spent (EUR)"));
    if (get("Amount spent (EUR)") === "" || !Number.isFinite(spend) || spend < 0) throw new MetaExportError(`Line ${line}: spend must be a nonnegative number`);
    const impressions = int(get("Impressions"), "Impressions", line);
    const clicks_all = int(get("Clicks (all)"), "Clicks (all)", line);
    const link_clicks = int(get("Link clicks"), "Link clicks", line);
    if (link_clicks > clicks_all) throw new MetaExportError(`Line ${line}: Link clicks exceed Clicks (all)`);
    const key = `${start}|${campaign_id}`;
    if (seen.has(key)) throw new MetaExportError(`Line ${line}: duplicate date and campaign`);
    seen.add(key);
    out.push({
      date: start, channel: "meta", campaign_id, currency: "EUR", spend, impressions,
      link_clicks, clicks_all, clicks: opts.clicksMetric === "link_clicks" ? link_clicks : clicks_all,
    });
  });
  return out;
}

export const DEMO_META_CAMPAIGN_MAP = { [SYNTHETIC_META_CAMPAIGN_NAME]: DEMO_CAMPAIGNS.meta };
