import { generateSourceBundle as gen } from "./generate";

export type Cell = string | number | null;
export interface Sheet { name: string; rows: Cell[][] }
export type SourceFormat = "csv" | "xls" | "xlsx";
export interface Workbook { format: SourceFormat; sheets: Sheet[] }

export const SOURCE_IDS = ["meta", "google_ads", "youtube", "spotify", "ga4", "lwm1", "lwm2", "lwm3", "tv", "simulation"] as const;
export type SourceId = (typeof SOURCE_IDS)[number];
export const SOURCES_SCHEMA_VERSION = "sources.v2";

export interface SourceBundle {
  metadata: { synthetic: true; schema_version: "sources.v2"; campaign: string; period_start: string; period_end: string; note: string };
  sources: Record<SourceId, Workbook>;
}

export const generateSourceBundle = (): SourceBundle => gen() as SourceBundle;
/** Exact source text embedded in the n8n workflow. */
export const generatorSource = (): string => gen.toString();

export const SOURCE_INFO: Record<SourceId, { label: string; file: string; layout: string }> = {
  meta: { label: "Meta", file: "meta-export.csv", layout: "CSV · headers row 1 · daily rows (Reporting starts = ends) · summary row excluded" },
  google_ads: { label: "Google Ads", file: "google-ads-campaigns.csv", layout: "CSV · 2 metadata rows, headers row 3 · period totals per campaign · Total rows excluded" },
  youtube: { label: "YouTube", file: "youtube-analytics.xlsx", layout: "XLSX · sheet 1 content summary, sheet 2 daily views (row 1 headers) · Total rows excluded" },
  spotify: { label: "Spotify", file: "spotify-ad-studio.xlsx", layout: "XLSX · summary blocks headers rows 8/14/19/25 · per-format daily detail sheets (authoritative)" },
  ga4: { label: "GA4 traffic", file: "ga4-traffic-acquisition.csv", layout: "CSV · 9 metadata lines, headers row 10 · period totals per channel group" },
  lwm1: { label: "LWM 1", file: "lwm1-report.xls", layout: "Legacy XLS · metadata above, headers row 10 in B–D · Total excluded" },
  lwm2: { label: "LWM 2", file: "lwm2-report.xlsx", layout: "XLSX · daily table row 5 (B–I) · site table row 18 (B–I)" },
  lwm3: { label: "LWM 3", file: "lwm3-report.xls", layout: "Legacy XLS · metadata above, headers row 10 in B–D · Total excluded" },
  simulation: { label: "All-channel & Stores simulation", file: "complete-demo-ledger.xlsx", layout: "XLSX · eight fully synthetic daily channel ledgers · explicit allocation provenance; never added to reference exports" },
  tv: { label: "TV", file: "tv-campaign.xlsx", layout: "XLSX · headers row 2 · one row per flight period · metadata labels below" },
};
