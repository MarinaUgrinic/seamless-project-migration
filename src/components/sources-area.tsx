import { useMemo, useState } from "react";
import { BarChart3, Download, FileDown, Files, FileSearch, Globe, Layers3, MonitorPlay, Music2, Radio, ShoppingBag, Upload, type LucideIcon } from "lucide-react";
import { DashboardPanel } from "./dashboard-panel";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtSkopje, type PerfRow } from "@/lib/metrics";
import { generateSourceBundle, SOURCE_IDS, SOURCE_INFO, type SourceId } from "@/lib/sources/bundle";
import { DEMO_READER_OPTIONS, READERS, type MappedRecord } from "@/lib/sources/readers";
import { buildMasterReport, formatValue, reportToCsv, type Section } from "@/lib/sources/report";
import allSourcesWorkflow from "../../workflows/neptun-all-sources-demo.json";

type DbRecord = MappedRecord & { imported_at: string };

export async function fetchSourceRecords(): Promise<DbRecord[]> {
  const { data, error } = await supabase.from("source_records")
    .select("source_id, record_key, record_kind, campaign_key, source_campaign, period_start, period_end, granularity, dimension, dimension_value, currency, metrics, provenance, imported_at")
    .eq("fixture_version", "sources.v2").order("source_id").order("record_key").limit(2000);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DbRecord[];
}

function save(data: BlobPart, mime: string, name: string) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement("a"); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
const btn = "dashboard-action h-auto min-h-9 whitespace-normal text-left";
const btnPrimary = "dashboard-action h-auto min-h-9 whitespace-normal text-left";
const sourceIcons: Record<string, LucideIcon> = { meta: BarChart3, google_ads: BarChart3, youtube: MonitorPlay, spotify: Music2, ga4: Globe, website: Globe, lwm: Radio, lwm1: Radio, lwm2: Radio, lwm3: Radio, tv: MonitorPlay, simulated_journey: ShoppingBag, stores: ShoppingBag };
function SourceIcon({ id }: { id: string }) { const Icon = sourceIcons[id] ?? Files; return <Icon aria-hidden="true" className="dashboard-heading-icon" />; }

export function SourcesArea({ perfRows, start, end, channel }: { perfRows: PerfRow[]; start: string; end: string; channel: string }) {
  const q = useQuery({ queryKey: ["source_records"], queryFn: fetchSourceRecords, staleTime: 0, refetchOnMount: "always" });
  const qc = useQueryClient();
  const bundle = useMemo(() => generateSourceBundle(), []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const importAll = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/public/demo-sources-ingest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ metadata: bundle.metadata, sources: bundle.sources }) });
      const body = (await res.json()) as { error?: string; imported_record_count?: number; imported_at?: string };
      if (!res.ok) throw new Error(body.error ?? `Import failed (${res.status})`);
      setMsg({ ok: true, text: `Imported ${body.imported_record_count} generated records from 10 source bundles at ${fmtSkopje(body.imported_at!)}.` });
      await qc.invalidateQueries({ queryKey: ["source_records"] });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Import failed" }); }
    finally { setBusy(false); }
  };
  const downloadSample = async (id: SourceId) => {
    const { workbookToFile } = await import("@/lib/sources/files");
    const f = workbookToFile(bundle.sources[id]);
    save(f.data as BlobPart, f.mime, `synthetic-${SOURCE_INFO[id].file}`);
  };

  const status = useMemo(() => {
    const m = new Map<string, { n: number; last: string }>();
    for (const r of q.data ?? []) { const s = m.get(r.source_id) ?? { n: 0, last: r.imported_at }; s.n++; if (r.imported_at > s.last) s.last = r.imported_at; m.set(r.source_id, s); }
    return m;
  }, [q.data]);

  return (
    <DashboardPanel id="sources-area" title="Sources & report" icon={Files} summary="Generated source previews, downloads and channel reports"><div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-8">
        <h2 id="sources-h" className="text-lg font-semibold text-primary"><Files aria-hidden="true" className="dashboard-heading-icon" />Sources &amp; report</h2>
        <span className="rounded-full border border-ring/30 bg-demo px-3 py-1 text-xs font-semibold tracking-wide text-demo-foreground">GENERATED DEMO DATA</span>
      </div>
      <p className="-mt-3 max-w-3xl text-sm text-muted-foreground">Nine generated example feeds plus a complete all-channel and Stores simulation in standard export layouts, mapped by working readers into one master report. Only these canonical generated samples can be imported; no live accounts or real files are connected.</p>

      <DashboardPanel id="source-feeds" title="Generated source feeds" icon={Layers3} summary="10 source bundles · canonical examples only">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={importAll} disabled={busy} className={btnPrimary}><Upload aria-hidden="true" />{busy ? "Importing…" : "Import all generated samples"}</Button>
          <Button onClick={() => save(JSON.stringify(allSourcesWorkflow, null, 2), "application/json", "neptun-all-sources-demo.json")} variant="outline" className={btn}><FileDown aria-hidden="true" />Download n8n workflow (all sources)</Button>
        </div>
        {msg && <p role="status" className={`mt-3 text-sm ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}
        {q.isError && <p className="mt-3 text-sm text-destructive">Could not load import status: {q.error.message}</p>}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-2 pr-3">Source</th><th className="py-2 pr-3">Format</th><th className="py-2 pr-3 text-right">Records in database</th><th className="py-2 pr-3">Last imported</th><th className="py-2" /></tr></thead>
            <tbody>
              {SOURCE_IDS.map((id) => { const s = status.get(id); return (
                <tr key={id} className="border-b border-border">
                  <td className="py-2 pr-3 font-medium text-foreground"><SourceIcon id={id} />{SOURCE_INFO[id].label}</td>
                  <td className="py-2 pr-3 text-muted-foreground uppercase">{bundle.sources[id].format}</td>
                  <td className="py-2 pr-3 text-right">{q.isPending ? "…" : s?.n ?? 0}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{q.isPending ? "…" : s ? fmtSkopje(s.last) : "Not imported"}</td>
                  <td className="py-2 text-right"><Button onClick={() => downloadSample(id)} variant="link" size="sm" className="h-auto px-0"><Download aria-hidden="true" />Download sample</Button></td>
                </tr>); })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Readers support the demonstrated formats: CSV, legacy XLS and XLSX with the fixed header rows/columns shown in the preview. Uploading other files is not part of this public demo.</p>
      </DashboardPanel>

      <SourcePreview bundle={bundle} />
      {q.isPending ? <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Loading source records…</div>
        : q.isError ? null
        : q.data.length === 0 ? <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">No source records imported yet. Use <b>Import all generated samples</b> to build the master report.</div>
        : <MasterReportView records={q.data} perfRows={perfRows} start={start} end={end} channel={channel} />}
    </div></DashboardPanel>
  );
}

function SourcePreview({ bundle }: { bundle: ReturnType<typeof generateSourceBundle> }) {
  const [id, setId] = useState<SourceId>("meta");
  const [tab, setTab] = useState<"raw" | "mapped">("mapped");
  const [sheetIx, setSheetIx] = useState(0);
  const wb = bundle.sources[id];
  const mapped = useMemo(() => READERS[id](wb, DEMO_READER_OPTIONS), [id, wb]);
  const sheet = wb.sheets[Math.min(sheetIx, wb.sheets.length - 1)]!;
  const [kind,setKind] = useState("");
  const kinds=[...new Set(mapped.map(r=>r.record_kind))];
  const chosen=kinds.includes(kind)?kind:kinds[0];
  const preview=mapped.filter(r=>r.record_kind===chosen).slice(0,12);
  const metricKeys=[...new Set(preview.flatMap(r=>Object.keys(r.metrics)))].filter(k=>preview.every(r=>r.metrics[k]!=null));
  return (
    <DashboardPanel id="source-preview" title="Source preview" icon={FileSearch} summary={SOURCE_INFO[id].label}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Source
          <select value={id} onChange={(e) => { setId(e.target.value as SourceId); setSheetIx(0); }} className="ctl">{SOURCE_IDS.map((s) => <option key={s} value={s}>{SOURCE_INFO[s].label}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Record type<select className="ctl" value={chosen} onChange={e=>setKind(e.target.value)}>{kinds.map(k=><option key={k} value={k}>{k}</option>)}</select></label>
        <div className="flex rounded-md border border-input p-0.5" role="group" aria-label="Preview view">
          {(["mapped", "raw"] as const).map((t) => <Button variant="ghost" key={t} aria-pressed={tab === t} onClick={() => setTab(t)} className={`rounded px-3 py-1.5 text-sm ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{t === "mapped" ? "Mapped fields" : "Raw sample"}</Button>)}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{SOURCE_INFO[id].layout} · {mapped.length} mapped records</p>
      {tab === "raw" ? (<>
        {wb.sheets.length > 1 && <div className="mt-3 flex flex-wrap gap-2">{wb.sheets.map((s, i) => <Button variant="ghost" key={s.name} aria-pressed={i === sheetIx} onClick={() => setSheetIx(i)} className={`rounded border px-2 py-1 text-xs ${i === sheetIx ? "border-primary text-primary" : "border-input text-muted-foreground"}`}>{s.name}</Button>)}</div>}
        <div className="mt-3 max-h-80 overflow-auto rounded border border-border">
          <table className="text-xs"><tbody>
            {sheet.rows.map((r,i)=>({r,i})).filter(({r})=>r.some(c=>c!=null&&String(c)!=="" )).slice(0,30).map(({r,i})=><tr key={i} className="border-b border-border"><td className="bg-muted px-2 py-1 text-right text-muted-foreground">{i+1}</td><td className="px-2 py-1"><div className="flex gap-4">{r.map((c,j)=>c==null||String(c)===""?null:<span key={j} className="whitespace-nowrap">{String(c)}</span>)}</div></td></tr>)}
          </tbody></table>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">First {Math.min(30, sheet.rows.length)} of {sheet.rows.length} sheet rows (row numbers as in the file).</p>
      </>) : (
        <div className="mt-3 max-h-80 overflow-auto rounded border border-border">
          <table className="text-xs">
            <thead><tr className="bg-muted text-left text-muted-foreground">{["kind", "period", "granularity", "dimension", "currency", ...metricKeys].map((h) => <th key={h} className="px-2 py-1 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>{preview.map((r) => <tr key={r.record_key} className="border-b border-border">
              <td className="px-2 py-1 whitespace-nowrap">{r.record_kind}</td><td className="px-2 py-1 whitespace-nowrap">{r.period_start === r.period_end ? r.period_start : `${r.period_start} → ${r.period_end}`}</td><td className="px-2 py-1">{r.granularity}</td>
              <td className="px-2 py-1 whitespace-nowrap">{r.dimension_value ?? r.source_campaign ?? "Site-wide property"}</td><td className="px-2 py-1">{r.currency ?? "Count-based source"}</td>
              {metricKeys.map((k) => <td key={k} className="px-2 py-1 whitespace-nowrap">{String(r.metrics[k])}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </DashboardPanel>
  );
}

// Which master-report sections belong to each dashboard channel filter.
const SECTIONS_FOR: Record<string, string[]> = { meta: ["meta", "simulated_journey"], google_ads: ["google_ads", "simulated_journey"], youtube: ["youtube"], spotify: ["spotify"], ga4: ["website"], lwm: ["lwm"], tv: ["tv"], stores: ["stores"] };
function MasterReportView({ records, perfRows, start, end, channel }: { records: MappedRecord[]; perfRows: PerfRow[]; start: string; end: string; channel: string }) {
  const full = useMemo(() => buildMasterReport(records, perfRows, start, end), [records, perfRows, start, end]);
  const keep = SECTIONS_FOR[channel];
  const report = keep ? { ...full, sections: full.sections.filter((s) => keep.includes(s.id)), excluded: full.excluded.filter((e) => full.sections.some((s) => keep.includes(s.id) && s.sources.includes(e.source))) } : full;
  const exportCsv = () => save(reportToCsv(report, new Date().toISOString()), "text/csv", `neptun-master-report_synthetic_${start}_${end}.csv`);
  return (
    <div className="space-y-4">
      <div id="master-report" className="scroll-mt-4"><DashboardPanel id="master-report-summary" title="Master report" icon={BarChart3} summary={`${report.campaign} · ${report.start} → ${report.end}`}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="mr-auto">
            <h3 className="font-semibold text-primary"><BarChart3 aria-hidden="true" className="dashboard-heading-icon" />Master report — {report.campaign}</h3>
            <p className="text-xs text-muted-foreground">Period {report.start} → {report.end} · promotion duration {report.days} days · generated demo data</p>
          </div>
          <span className="text-xs text-muted-foreground">Follows the dates and channel chosen at the top.</span>
          <Button onClick={exportCsv} className={btnPrimary}><FileDown aria-hidden="true" />Export report (CSV)</Button>
        </div>
        {report.excluded.length > 0 && (
          <div className="mt-3 rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
            <b className="text-foreground">Excluded period totals (not prorated):</b>{" "}
            {report.excluded.map((e) => `${SOURCE_INFO[e.source].label} ${e.record_kind} ${e.period}`).join(" · ")}
          </div>
        )}
      </DashboardPanel></div>
      <div className="grid gap-4 lg:grid-cols-2">{report.sections.map((s) => <SectionCard key={s.id} s={s} />)}</div>
    </div>
  );
}

const KIND_LABEL: Record<Section["kind"], string> = { ad_platform: "Ad platform", website: "Website (GA4)", simulated: "Simulated", offline: "Offline media", stores: "Stores" };
function SectionCard({ s }: { s: Section }) {
  return (
    <DashboardPanel id={`channel-${s.id}`} title={s.title} icon={sourceIcons[s.id] ?? Files} summary={s.available?`${s.metrics.length} populated metrics · ${KIND_LABEL[s.kind]}`:"No observations in the selected period"} className={s.breakdowns.some(b=>b.columns.length>6)?"lg:col-span-2":""}>
      <div className="flex flex-wrap items-center gap-2"><span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{KIND_LABEL[s.kind]}</span>{!s.available && <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{"No observations in period"}</span>}</div>
      <p className="mt-1 text-xs text-muted-foreground">{s.note}</p>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        {s.metrics.map((m) => (
          <div key={m.key} className="flex items-baseline justify-between gap-2 border-b border-border py-1.5" title={`${m.definition}${m.note ? ` — ${m.note}` : ""}`}>
            <dt className="text-sm text-muted-foreground">{m.label}</dt>
            <dd className={`shrink-0 text-sm font-medium ${m.value == null ? "text-muted-foreground" : "text-foreground"}`}>{formatValue(m.value, m.unit)}</dd>
          </div>
        ))}
      </dl>
      {s.breakdowns.map((b) => (
        <div key={b.title} className="mt-4">
          <p className="mb-1 text-xs font-semibold text-primary">{b.title}</p>
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead><tr className="border-b border-border text-left text-muted-foreground">{b.columns.map((c) => <th key={c.key} className={`py-1 pr-3 whitespace-nowrap ${c.unit === "text" ? "" : "text-right"}`}>{c.label}</th>)}</tr></thead>
            <tbody>{b.rows.map((r, i) => <tr key={i} className="border-b border-border">{b.columns.map((c) => <td key={c.key} className={`py-1 pr-3 whitespace-nowrap ${c.unit === "text" ? "" : "text-right"}`}>{formatValue(r[c.key] ?? null, c.unit)}</td>)}</tr>)}</tbody>
          </table></div>
        </div>
      ))}
      <details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer text-primary">Metric definitions</summary>
        <ul className="mt-2 space-y-1">{s.metrics.map((m) => <li key={m.key}><b className="text-foreground">{m.label}:</b> {m.definition}{m.note ? ` (${m.note})` : ""}</li>)}</ul>
      </details>
    </DashboardPanel>
  );
}
