import { BarChart3, CalendarDays, CreditCard, Eye, Globe, Layers3, MousePointer2, Percent, ShoppingBag, ShoppingBasket, Target, TrendingUp, Users, Wallet, type LucideIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState } from "react";
import { bucketLabel, fmtEUR, fmtInt, fmtPct, type Granularity } from "@/lib/metrics";
import { DEMO_CHANNELS, DEMO_CHANNEL_LABELS, MEDIA_CHANNELS, ledgerPeriods, ledgerRows, ledgerTotals, selectLedger, type DemoChannel, type LedgerRow } from "@/lib/sources/demo-ledger";
import type { MappedRecord } from "@/lib/sources/readers";
import { DashboardPanel } from "./dashboard-panel";
import { Button } from "./ui/button";

export function DemoKpi({id,label,value,icon}:{id:string;label:string;value:string;icon:LucideIcon}){return <DashboardPanel id={id} title={label} icon={icon} compact summary={value}><p className="break-words text-xl font-semibold text-primary">{value}</p></DashboardPanel>;}
const CHANNEL_COLORS:Record<DemoChannel,string>={meta:"var(--chart-1)",google_ads:"var(--chart-2)",youtube:"var(--analytics-youtube)",spotify:"var(--analytics-spotify)",ga4:"var(--analytics-website)",lwm:"var(--analytics-lwm)",tv:"var(--analytics-tv)",stores:"var(--analytics-stores)"};
export function AllChannelReport({records,start,end,channel,granularity}:{records:MappedRecord[];start:string;end:string;channel:"all"|DemoChannel;granularity:Granularity}){
  const all=selectLedger(ledgerRows(records),start,end,channel),[view,setView]=useState<"ad"|"web">("ad");
  if(!all.length)return <p role="status" className="border-y border-border bg-card p-6 text-sm text-muted-foreground">No generated observations match this date range. Choose dates inside 15 October–13 November 2026.</p>;
  const scoped=channel==="all"?all.filter(r=>MEDIA_CHANNELS.includes(r.channel)):all,t=ledgerTotals(scoped);
  const direct=channel==="meta"||channel==="google_ads",site=channel==="ga4",store=channel==="stores";
  const channels=DEMO_CHANNELS.filter(c=>channel==="all"||channel===c);
  const periods=ledgerPeriods(all,granularity);
  const chart=new Map<string,Record<string,string|number>>();
  for(const p of periods){const row=chart.get(p.key)??{label:bucketLabel(p.key,granularity)};row[p.channel]=p.totals.spend;chart.set(p.key,row);}
  const scope=channel==="all"?"Media cohorts only (Meta, Google Ads, YouTube, Spotify, LWM & TV)":DEMO_CHANNEL_LABELS[channel];
  const note="Period-only examples use labelled, deterministic daily allocations preserving source totals. TV responses are simulated website sessions, not measured clicks. Site-wide GA4 and offline Stores observations stay separate; there is no overlapping grand total.";
  return <div className="space-y-6">
    <DashboardPanel id="performance" title={site?"Website observations":store?"Store observations":"Campaign performance"} icon={BarChart3} summary={`${scope} · ${fmtEUR(t.spend)}`}>
      <p className="mb-4 text-xs text-muted-foreground">{scope} · generated evidence, not real performance.</p>
      <div className="dashboard-kpi-grid grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <DemoKpi id="kpi-spend" icon={Wallet} label={site?"Site-wide revenue":store?"Offline sales":"Total spend"} value={fmtEUR(site||store?t.revenue:t.spend)}/>
        <DemoKpi id="kpi-impressions" icon={Eye} label={site?"Sessions":store?"Footfall":"Impressions / exposures"} value={fmtInt(site?t.sessions:t.impressions)}/>
        <DemoKpi id="kpi-responses" icon={MousePointer2} label={direct?"Clicks":store?"Sales documents":"Simulated website responses"} value={fmtInt(direct?t.clicks:store?t.purchases:t.sessions)}/>
        <DemoKpi id="kpi-rate" icon={Percent} label={direct?"CTR":"Demo purchase rate"} value={fmtPct(direct?t.ctr:t.purchaseRate)}/>
        <DemoKpi id="kpi-cost" icon={Target} label={site||store?"Average sale value":direct?"CPC":"Cost per response"} value={fmtEUR(site||store?t.revenue/t.purchases:direct?t.cpc:t.costPerResponse)}/>
      </div>
    </DashboardPanel>
    <DashboardPanel id="spend-chart" title="Spend over time" icon={TrendingUp} summary={`${granularity} · ${channels.length} channels`}>
      <p className="mb-3 text-xs text-muted-foreground">{note} GA4 has zero media spend; Stores shows its separate local promotion cost.</p>
      <div className="h-80 min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={[...chart.values()]}><CartesianGrid vertical={false} stroke="var(--border)"/><XAxis dataKey="label" tick={{fontSize:11,fill:"var(--muted-foreground)"}}/><YAxis tick={{fontSize:11,fill:"var(--muted-foreground)"}} tickFormatter={v=>`€${v}`}/><Tooltip formatter={(v:number)=>fmtEUR(v)}/><Legend wrapperStyle={{fontSize:11}}/>{channels.map(c=><Bar key={c} dataKey={c} name={DEMO_CHANNEL_LABELS[c]} stackId="spend" fill={CHANNEL_COLORS[c]}/>)}</BarChart></ResponsiveContainer></div>
    </DashboardPanel>
    <DashboardPanel id="by-period" title="By period" icon={CalendarDays} summary={`${periods.length} ${granularity} channel rows`}>
      <p className="mb-3 text-xs text-muted-foreground">{note}</p>
      <div className="max-h-[32rem] overflow-auto"><table className="w-full min-w-[800px] text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground">{["Period","Channel","Dates","Spend","Impressions / visits","Website responses / visits","Purchases / sales","Revenue"].map(h=><th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{periods.map(p=><tr key={p.id} className="border-b border-border"><td className="px-3 py-2 whitespace-nowrap">{bucketLabel(p.key,granularity)}</td><td className="px-3 py-2 font-medium whitespace-nowrap">{DEMO_CHANNEL_LABELS[p.channel]}</td><td className="px-3 py-2 text-xs whitespace-nowrap">{p.from} → {p.to}{p.partial?" (partial calendar period)":""}</td><td className="px-3 py-2 text-right">{fmtEUR(p.totals.spend)}</td><td className="px-3 py-2 text-right">{fmtInt(p.totals.impressions)}</td><td className="px-3 py-2 text-right">{fmtInt(p.totals.sessions)}</td><td className="px-3 py-2 text-right">{fmtInt(p.totals.purchases)}</td><td className="px-3 py-2 text-right">{fmtEUR(p.totals.revenue)}</td></tr>)}</tbody></table></div>
    </DashboardPanel>
    <DashboardPanel id="website-actions" title={store?"Store shopping actions":"Website actions"} icon={Globe} summary={`${fmtInt(t.sessions)} sessions / visits · ${fmtInt(t.purchases)} purchases`}>
      <p className="mb-4 text-xs text-muted-foreground">{site?"Separate site-wide observations, not attributed campaign outcomes.":store?"Offline store visits and sales, not website transactions.":"Non-overlapping generated media cohorts; revenue is assigned once to its generated campaign."}</p>
      <div className="dashboard-kpi-grid grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{([["Sessions",t.sessions,Users],["Product views",t.views,Eye],["Add to basket",t.basket,ShoppingBasket],["Checkouts started",t.checkout,CreditCard],["Purchases",t.purchases,ShoppingBag],["Revenue (EUR)",t.revenue,TrendingUp]] as const).map(([label,n,icon])=><DemoKpi key={label} id={`web-${label}`} label={label} icon={icon} value={label==="Revenue (EUR)"?fmtEUR(n):fmtInt(n)}/>)}</div>
    </DashboardPanel>
    <div className="grid gap-4 lg:grid-cols-3">
      <DashboardPanel id="shopping-journey" title="Demo shopping journey" icon={ShoppingBasket} className="lg:col-span-2" summary={`${fmtInt(t.sessions)} → ${fmtInt(t.purchases)} sessions reaching purchase`}>
        <p className="mb-4 text-xs text-muted-foreground">Demo counts represent sessions reaching each stage, with at most one action of each type per session.</p>
        <ol className="space-y-3">{([["Sessions",t.sessions],["Product view",t.views],["Add to basket",t.basket],["Checkout",t.checkout],["Purchase",t.purchases]] as const).map(([name,n])=><li key={name} className="grid grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] items-center gap-2 text-sm"><span className="text-muted-foreground">{name}</span><span className="h-4 rounded bg-muted"><span className="block h-full rounded bg-chart-1" style={{width:`${n/t.sessions*100}%`}}/></span><span className="text-right font-medium">{fmtInt(n)} <small className="text-muted-foreground">{Math.round(n/t.sessions*100)}%</small></span></li>)}</ol>
      </DashboardPanel>
      <DashboardPanel id="demo-outcomes" title="Demo outcomes" icon={Target} summary={`${fmtPct(t.purchaseRate)} purchase rate`}>
        <dl className="space-y-3">{[["Demo purchase rate",fmtPct(t.purchaseRate)],[site||store?"Average sale value":"Cost per purchase",fmtEUR(site||store?t.revenue/t.purchases:t.cpa)],...(!site?[[store?"Sales / promotion cost":"Demo ROAS",`${(t.revenue/t.spend).toFixed(2)}×`]]:[])].map(([label,v])=><div key={label} className="flex items-start justify-between gap-3 border-b border-border pb-2 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="font-semibold text-primary">{v}</dd></div>)}</dl>
        <p className="mt-4 text-xs text-muted-foreground">{site?"Site-wide revenue is not campaign ROAS.":store?"Offline sales remain separate from website outcomes.":"Demo revenue is assigned once to its generated campaign."}</p>
      </DashboardPanel>
    </div>
    <DashboardPanel id="channel-comparison" title="Channel comparison" icon={Layers3} summary={`${channels.length} channels · ${start} → ${end}`} actions={<div className="flex gap-1" role="group" aria-label="Table view">{(["ad","web"] as const).map(k=><Button variant={view===k?"secondary":"ghost"} size="sm" key={k} aria-pressed={view===k} onClick={()=>setView(k)}>{k==="ad"?"Ad metrics":"Website events"}</Button>)}</div>}>
      <p className="mb-3 text-xs text-muted-foreground">{note}</p><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground">{(view==="ad"?["Channel","Scope","Spend","Impressions / visits","Website responses / visits","Purchases / sales","Revenue"]:["Channel","Scope","Sessions / visits","Views","Basket","Checkout","Purchases / sales","Revenue","Purchase rate"]).map(h=><th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{channels.map(c=>{const n=ledgerTotals(all.filter(r=>r.channel===c));const cells=view==="ad"?[fmtEUR(n.spend),fmtInt(n.impressions),fmtInt(n.sessions),fmtInt(n.purchases),fmtEUR(n.revenue)]:[fmtInt(n.sessions),fmtInt(n.views),fmtInt(n.basket),fmtInt(n.checkout),fmtInt(n.purchases),fmtEUR(n.revenue),fmtPct(n.purchaseRate)];return <tr key={c} className="border-b border-border"><td className="px-3 py-3 whitespace-nowrap font-medium">{DEMO_CHANNEL_LABELS[c]}</td><td className="px-3 py-3 text-xs whitespace-nowrap">{c==="ga4"?"Site-wide":c==="stores"?"Offline stores":"Simulated campaign"}</td>{cells.map((v,i)=><td key={i} className="px-3 py-3 text-right whitespace-nowrap">{v}</td>)}</tr>;})}</tbody></table></div>
    </DashboardPanel>
  </div>;
}
