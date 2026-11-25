import { ArrowDownToLine, ArrowRight, FileDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { filterRows, fmtSkopje, snapRange, WEB_FIELDS, type Channel, type Granularity, type PerfRow } from "@/lib/metrics";
import { DEMO_CHANNELS, DEMO_CHANNEL_LABELS, ledgerRows, selectLedger, type DemoChannel } from "@/lib/sources/demo-ledger";
import { SourcesArea, fetchSourceRecords } from "@/components/sources-area";
import { AllChannelReport } from "@/components/all-channel-report";
import { DashboardPanels, CollapseControls, SectionMinimizeButton, useSectionCollapsed } from "@/components/dashboard-panel";
import { ManagementReportButton } from "@/components/management-report";
import n8nWorkflow from "../../workflows/neptun-daily-report.json";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Marketing overview — Neptun Marketing Report" },
      { name: "description", content: "Generated all-channel media, website and store reporting with separate synthetic cohorts." },
      { property: "og:title", content: "Marketing overview — Neptun Marketing Report" },
      { property: "og:description", content: "Marketing performance dashboard with synthetic demo data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

interface DbRow extends PerfRow { updated_at: string; campaign_id: string; currency: string }
const num = (v: unknown) => (v == null ? null : Number(v));

async function fetchRows(): Promise<DbRow[]> {
  const { data, error } = await supabase
    .from("campaign_performance")
    .select("date, channel, campaign_id, currency, spend, impressions, clicks, website_sessions, view_item, add_to_cart, begin_checkout, purchases, purchase_revenue, updated_at")
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    date: r.date, channel: r.channel as Channel, spend: Number(r.spend),
    impressions: Number(r.impressions), clicks: Number(r.clicks), updated_at: r.updated_at,
    campaign_id: r.campaign_id, currency: r.currency,
    website_sessions: num(r.website_sessions), view_item: num(r.view_item), add_to_cart: num(r.add_to_cart),
    begin_checkout: num(r.begin_checkout), purchases: num(r.purchases), purchase_revenue: num(r.purchase_revenue),
  }));
}

function Dashboard() {
  const q=useQuery({queryKey:["campaign_performance"],queryFn:fetchRows,staleTime:0,refetchOnMount:"always",refetchOnWindowFocus:true});
  return <div className="dashboard-skin min-h-screen bg-background"><header className="dashboard-masthead border-b border-border bg-card"><div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-3 px-4 py-4 sm:px-8"><span className="text-lg font-bold tracking-[0.25em] text-primary">NEPTUN</span><span className="text-sm text-muted-foreground">Marketing Report</span></div></header><main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{q.isPending?<State title="Loading report data…"/>:q.isError?<State title="Could not load report data" detail={q.error.message} onRetry={()=>q.refetch()}/>:q.data.length===0?<State title="No saved demo data"/>:<DashboardPanels><Report rows={q.data}/></DashboardPanels>}</main></div>;
}
function State({title,detail,onRetry}:{title:string;detail?:string;onRetry?:()=>void}) {return <div role="status" className="border-y border-border bg-card p-8 text-center"><p className="font-semibold text-primary">{title}</p>{detail&&<p className="mt-2 text-sm text-muted-foreground">{detail}</p>}{onRetry&&<Button onClick={onRetry} className="mt-4">Retry</Button>}</div>;}
function saveJson(payload:unknown,name:string) {const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function Report({rows}:{rows:DbRow[]}) {
  const minDate=rows[0]?.date??"2026-10-15",maxDate=rows.at(-1)?.date??"2026-11-13";
  const [start,setStart]=useState(minDate),[end,setEnd]=useState(maxDate),[channel,setChannel]=useState<"all"|DemoChannel>("all"),[gran,setGran]=useState<Granularity>("daily");
  const q=useQuery({queryKey:["source_records"],queryFn:fetchSourceRecords,staleTime:0,refetchOnMount:"always",refetchOnWindowFocus:true});
  const overviewCollapsed=useSectionCollapsed("overview");
  const invalid=start>end,legacy=channel==="all"||channel==="meta"||channel==="google_ads",baseChannel=channel==="meta"||channel==="google_ads"?channel:"all";
  const filtered=legacy?filterRows(rows,start,end,baseChannel):[];
  const selected=selectLedger(ledgerRows(q.data??[]),start,end,channel);
  const timestamps=(q.data??[]).filter(r=>r.source_id==="simulation"&&r.period_start>=start&&r.period_end<=end&&(channel==="all"||r.dimension_value===channel)).map(r=>r.imported_at).sort();
  const last=timestamps.at(-1);
  const reset=()=>{setStart(minDate);setEnd(maxDate);setChannel("all");setGran("daily");};
  const download=()=>saveJson({metadata:{synthetic:true,schema_version:"demo.v2",generated_at:new Date().toISOString(),filters:{start,end,channel},row_count:filtered.length},rows:filtered.map(r=>({date:r.date,channel:r.channel,campaign_id:r.campaign_id,currency:r.currency,spend:r.spend,impressions:r.impressions,clicks:r.clicks,...Object.fromEntries(WEB_FIELDS.map(f=>[f,r[f]??null]))}))},`neptun-demo-data_${start}_${end}_${channel}.json`);
  return <div className="space-y-8">
    <section className="dashboard-overview flex flex-col gap-4 border-y border-border py-6 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold text-primary sm:text-3xl">Marketing overview</h1><span className="rounded-full border border-ring/30 bg-demo px-3 py-1 text-xs font-semibold text-demo-foreground">DEMO DATA — SYNTHETIC</span><SectionMinimizeButton id="overview" title="Marketing overview" controls="overview-description"/></div><p id="overview-description" hidden={overviewCollapsed} className="mt-2 max-w-2xl text-sm text-muted-foreground">Generated media performance, website observations and store results, kept in distinct cohorts.</p></div>{last&&!overviewCollapsed&&<p className="text-xs text-muted-foreground">Last generated-data import: <span className="font-medium text-foreground">{fmtSkopje(last)}</span></p>}</section>
    <section className="dashboard-filters grid gap-4 border-y border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
      <Field label="Start date"><input id="ctl-start-date" type="date" value={start} min={minDate} max={maxDate} onChange={e=>setStart(e.target.value||minDate)} className="ctl"/></Field>
      <Field label="End date"><input id="ctl-end-date" type="date" value={end} min={minDate} max={maxDate} onChange={e=>setEnd(e.target.value||maxDate)} className="ctl"/></Field>
      <Field label="Channel"><select id="ctl-channel" value={channel} onChange={e=>setChannel(e.target.value as "all"|DemoChannel)} className="ctl"><option value="all">All</option>{DEMO_CHANNELS.map(c=><option key={c} value={c}>{DEMO_CHANNEL_LABELS[c]}</option>)}</select></Field>
      <div><span id="agg-label" className="text-xs font-medium text-muted-foreground">Aggregation</span><div className="mt-1 flex rounded-md border border-input p-0.5" role="group" aria-labelledby="agg-label">{(["daily","weekly","monthly"] as const).map(g=><Button variant="ghost" key={g} aria-pressed={gran===g} onClick={()=>{setGran(g);const r=snapRange(start,end,g,minDate,maxDate);setStart(r.start);setEnd(r.end);}} className={`flex-1 px-2 capitalize ${gran===g?"bg-primary text-primary-foreground":"text-muted-foreground hover:bg-muted"}`}>{g}</Button>)}</div></div>
      <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4"><Button variant="outline" onClick={reset}><RotateCcw aria-hidden="true"/>Reset filters</Button><ManagementReportButton filters={{start,end,channel,granularity:gran}} disabled={invalid||!selected.length}/>{legacy&&<><Button className="h-auto min-h-9 whitespace-normal" onClick={download} disabled={invalid||!filtered.length}><FileDown aria-hidden="true"/>Download demo data (JSON)</Button><Button variant="outline" className="h-auto min-h-9 whitespace-normal" onClick={()=>saveJson(n8nWorkflow,"neptun-daily-report.json")}><ArrowDownToLine aria-hidden="true"/>Download n8n workflow</Button></>}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 lg:col-span-4"><p className="text-xs text-muted-foreground">{invalid?<span className="text-destructive">Start date is after end date.</span>:<>Coverage: <b className="text-foreground">{selected.length}</b> generated channel-day observations · {start} → {end}</>}</p><CollapseControls/></div>
      {channel!=="all"&&<p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">Results for {DEMO_CHANNEL_LABELS[channel]} for {start} → {end} are in the report below. <a href="#master-report" className="font-medium text-primary underline underline-offset-2">View channel report<ArrowRight aria-hidden="true" className="ml-1 inline size-4"/></a></p>}
    </section>
    {q.isPending?<State title="Loading all-channel observations…"/>:q.isError?<State title="Could not load all-channel observations" detail={q.error.message} onRetry={()=>q.refetch()}/>:invalid?<State title="Choose a valid date range"/>:<AllChannelReport records={q.data} start={start} end={end} channel={channel} granularity={gran}/>}
    <SourcesArea perfRows={rows} start={start} end={invalid?start:end} channel={channel}/>
  </div>;
}
function Field({label,children}:{label:string;children:ReactNode}) {return <div className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground"><label htmlFor={`ctl-${label.toLowerCase().replaceAll(" ","-")}`}>{label}</label>{children}</div>;}
