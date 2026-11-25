import { generateSourceBundle, SOURCE_IDS, SOURCES_SCHEMA_VERSION, type SourceId } from "./bundle";
import { readBundle, SourceError, type MappedRecord } from "./readers";

export type SourcesValidation =
  | { success: true; ids: SourceId[]; records: MappedRecord[] }
  | { success: false; status: 400 | 422; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Accepts only exact canonical generated samples. Error messages never echo submitted values. */
export function validateSourcesPayload(input: unknown): SourcesValidation {
  if (!isObj(input) || !isObj(input["metadata"]) || !isObj(input["sources"])) return { success: false, status: 400, error: "Body must be {metadata, sources}." };
  const md = input["metadata"];
  if (md["synthetic"] !== true) return { success: false, status: 422, error: "metadata.synthetic must be true." };
  if (md["schema_version"] !== SOURCES_SCHEMA_VERSION) return { success: false, status: 422, error: `metadata.schema_version must be ${SOURCES_SCHEMA_VERSION}.` };
  const keys = Object.keys(input["sources"]);
  if (!keys.length) return { success: false, status: 422, error: "No sources supplied." };
  const unknown = keys.filter((k) => !(SOURCE_IDS as readonly string[]).includes(k));
  if (unknown.length) return { success: false, status: 422, error: `Unknown source IDs (${unknown.length}). Allowed: ${SOURCE_IDS.join(", ")}.` };
  const canonical = generateSourceBundle();
  const ids = SOURCE_IDS.filter((id) => keys.includes(id));
  const changed = ids.filter((id) => JSON.stringify((input["sources"] as Record<string, unknown>)[id]) !== JSON.stringify(canonical.sources[id]));
  if (changed.length) return { success: false, status: 422, error: `Source sample does not match the canonical generated demo sample: ${changed.join(", ")}.` };
  try {
    return { success: true, ids, records: readBundle(canonical, ids) };
  } catch (e) {
    return { success: false, status: 422, error: e instanceof SourceError ? e.message : "Sample could not be mapped." };
  }
}

export interface SourceSummary { records: number; kinds: Record<string, number>; totals: Record<string, number> }
const TOTAL_KEYS = ["impressions", "clicks", "link_clicks", "clicks_all", "spend", "cost", "views", "sessions", "net_cost", "grps_ttl"];
/** Per-source counts and totals over authoritative records only (summary/breakdown/content rows excluded to avoid double counting). */
export function summarizeRecords(records: Pick<MappedRecord, "source_id" | "record_kind" | "metrics">[]): Record<string, SourceSummary> {
  const out: Record<string, SourceSummary> = {};
  for (const r of records) {
    const s = (out[r.source_id] ??= { records: 0, kinds: {}, totals: {} });
    s.records++; s.kinds[r.record_kind] = (s.kinds[r.record_kind] ?? 0) + 1;
    if (["summary", "site_breakdown", "content_summary", "simulated_daily"].includes(r.record_kind)) continue;
    for (const k of TOTAL_KEYS) { const v = r.metrics[k]; if (typeof v === "number") s.totals[k] = Math.round(((s.totals[k] ?? 0) + v) * 100) / 100; }
  }
  // Stable key order so repeated imports compare equal regardless of database row order.
  const sorted: Record<string, SourceSummary> = {};
  for (const id of SOURCE_IDS) {
    const s = out[id]; if (!s) continue;
    sorted[id] = { records: s.records, kinds: Object.fromEntries(Object.entries(s.kinds).sort()), totals: Object.fromEntries(TOTAL_KEYS.filter((k) => k in s.totals).map((k) => [k, s.totals[k]!])) };
  }
  return sorted;
}
