import { DEMO_CHANNELS, DEMO_CHANNEL_LABELS, demoReach, ledgerRows, ledgerTotals, selectLedger, sumLedger, type LedgerRow } from "./demo-ledger";
import type { MappedRecord } from "./readers";
import type { Breakdown, MasterReport, Metric, Section, Unit } from "./report";

const metric=(key:string,label:string,value:number,unit:Unit,definition:string):Metric=>({key,label,value,unit,definition});
const ratio=(n:number,d:number,scale=1)=>d ? n/d*scale : 0;
export function buildCompleteReport(records:MappedRecord[],start:string,end:string):MasterReport {
  const selected=selectLedger(ledgerRows(records),start,end,"all");
  const sections:Section[]=DEMO_CHANNELS.map(channel=>{
    const rows=selected.filter(r=>r.channel===channel), t=ledgerTotals(rows), sum=(key:string)=>sumLedger(rows,key);
    const metrics:Metric[]=[], breakdowns:Breakdown[]=[];
    const add=(key:string,label:string,unit:Unit="count")=>metrics.push(metric(key,label,sum(key),unit,`SUM(${key}) from the canonical generated ${channel} daily ledger`));
    const calc=(key:string,label:string,n:number,d:number,unit:Unit,scale=1)=>metrics.push(metric(key,label,ratio(n,d,scale),unit,`Full-selection compatible totals; ${n} ÷ ${d}${scale!==1?` × ${scale}`:""}`));
    let note="Fully synthetic campaign simulation. Responses are generated website sessions; at most one action of each type per session. Attributed revenue is assigned once. The ledger replaces, and is never added to, its reference export.";
    if (channel === "ga4") {
      note="Site-wide generated observations; not campaign-attributed. Daily allocation preserves the original period's sessions, engagement, key-event and revenue totals. Never add this revenue or these sessions to the media cohorts.";
      add("users","Generated users");add("new_users","Generated new users");add("website_sessions","Sessions");add("engaged_sessions","Engaged sessions");
      calc("engagement_rate","Engagement rate",sum("engaged_sessions"),t.sessions,"pct",100);
      calc("bounce_rate","Bounce rate",t.sessions-sum("engaged_sessions"),t.sessions,"pct",100);
      add("event_count","Event count");add("key_events","Configured key events");add("key_event_sessions","Sessions with a key event");
      calc("session_key_event_rate","Session key event rate",sum("key_event_sessions"),t.sessions,"pct",100);
      calc("events_per_session","Events / session",sum("event_count"),t.sessions,"ratio");
      calc("avg_engagement_time","Avg. engagement time",sum("engagement_time_total_s"),t.sessions,"seconds");
      add("purchase_revenue","Site-wide revenue","eur");
    } else if(channel === "stores") {
      note="Wholly generated store visits and offline transactions. Before/during/after counts refer to distinct synthetic comparison cohorts, not a claimed measured trend. Store sales are kept separate from website revenue.";
      add("footfall_week_before","Footfall before");add("footfall_during","Footfall during");add("footfall_week_after","Footfall after");add("sales_documents","Sales documents");add("quantity","Quantity");add("net_sales","Offline net sales","eur");add("spend","Local promotion spend","eur");
      calc("store_purchase_rate","Visit-to-sale rate",sum("sales_documents"),sum("footfall_during"),"pct",100);
    } else {
      add("spend","Generated media spend","eur");add("impressions",channel==="tv"?"Simulated TV exposures":"Simulated impressions");
      metrics.push(metric("reach","Simulated deduplicated reach",demoReach(rows),"count","Union of rotating synthetic integer cohorts; never sums daily reach; no real audience identities"));
      if(channel!=="tv") {add("clicks",channel==="meta"?"Link clicks":"Generated clicks");calc("ctr","CTR",t.clicks,t.impressions,"pct",100);calc("cpc","CPC",t.spend,t.clicks,"eur");}
      add("website_sessions",channel==="tv"?"Simulated website responses":"Simulated website sessions");add("view_item","Product views");add("add_to_cart","Add to basket");add("begin_checkout","Checkouts started");add("purchases","Purchases");add("purchase_revenue","Simulated attributed revenue","eur");
      calc("purchase_rate","Demo purchase rate",t.purchases,t.sessions,"pct",100);calc("cpa","Cost per purchase",t.spend,t.purchases,"eur");calc("roas","Demo ROAS",t.revenue,t.spend,"ratio");
      if(channel==="meta") {
        add("post_engagement","Generated post engagement");
        const refs=records.filter(r=>r.source_id==="meta"&&r.period_start>=start&&r.period_end<=end);
        for(const [key,label] of [["clicks_all","Clicks (all)"],["shop_clicks","Shop clicks"],["landing_page_views","Landing page views"],["results","Results: landing-page views"]]) if(key&&label) metrics.push(metric(key,label,refs.reduce((s,r)=>s+Number(r.metrics[key]),0),"count",`Sum of compatible ${key} in the generated Meta daily export; results are not purchases`));
      }
      if(channel==="youtube") {add("video_views","Studio daily views");add("watch_time_hours","Allocated watch time","hours");add("subscribers","Allocated subscriber gains");add("thumbnail_impressions","Organic thumbnail impressions");calc("thumbnail_ctr","Organic thumbnail CTR",sum("thumbnail_clicks"),sum("thumbnail_impressions"),"pct",100); note+=" Studio activity and a newly generated promotion budget are different metrics; paid results are simulated, not measured Studio ads.";}
      if(channel==="spotify") {for(const [key,label] of [["starts","Creative starts"],["first_quartile","First quartile"],["midpoint","Midpoint"],["third_quartile","Third quartile"],["completes","Completes"]]) if(key&&label) add(key,label);calc("completion_rate","Creative completion rate",sum("completes"),sum("starts"),"pct",100);note+=" Creative milestones model playback or display exposure duration; these are generated progression counts.";}
      if(channel==="tv") {add("grps_ttl","Allocated GRPs (TTL)","grp");add("trps_16","Allocated TRPs (16+)","grp");note+=" TV has no measured ad-click count. Cent/point allocations preserve each flight's totals; website responses are an independent simulation.";}
      if(channel==="lwm") note+=" The three example networks have disjoint generated inventory; their reference deliveries are combined exactly once.";
    }
    // Named source fields remain in per-source breakdowns; interval rows use explicit cumulative daily allocation.
    const allocation=(n:number,r:MappedRecord,scale=1)=>{
      const totalDays=Math.round((Date.parse(r.period_end)-Date.parse(r.period_start))/86400000)+1;
      const a=start>r.period_start?start:r.period_start,b=end<r.period_end?end:r.period_end;
      if(a>b)return 0;
      const before=Math.round((Date.parse(a)-Date.parse(r.period_start))/86400000),after=Math.round((Date.parse(b)-Date.parse(r.period_start))/86400000)+1;
      return (Math.floor(n*scale*after/totalDays)-Math.floor(n*scale*before/totalDays))/scale;
    };
    if(channel==="google_ads") {
      const refs=records.filter(r=>r.source_id==="google_ads"&&r.period_start<=end&&r.period_end>=start);
      const googlePart=(r:MappedRecord,key:string,first:number,step:number,scale=1)=>{
        const a=Math.max(0,Math.min(30,Math.round((Date.parse(start)-Date.parse("2026-10-15"))/86400000))),b=Math.max(0,Math.min(30,Math.round((Date.parse(end)-Date.parse("2026-10-15"))/86400000)+1));
        const cumulative=(n:number)=>first*n+step*n*(n-1)/2;
        return (Math.floor(Number(r.metrics[key])*scale*cumulative(b)/cumulative(30))-Math.floor(Number(r.metrics[key])*scale*cumulative(a)/cumulative(30)))/scale;
      };
      const allocated=refs.map(r=>({campaign:r.source_campaign,status:r.metrics["status"],cost:googlePart(r,"cost",150,2,100),impressions:googlePart(r,"impressions",5000,100),clicks:googlePart(r,"clicks",150,3),conversions:allocation(Number(r.metrics["conversions"]),r,2)}));
      // Last campaign receives exact rounding residuals so every selected-day breakdown reconciles.
      const last=allocated.at(-1);if(last){last.cost=Math.round((t.spend-allocated.slice(0,-1).reduce((s,r)=>s+r.cost,0))*100)/100;last.impressions=t.impressions-allocated.slice(0,-1).reduce((s,r)=>s+r.impressions,0);last.clicks=t.clicks-allocated.slice(0,-1).reduce((s,r)=>s+r.clicks,0);}
      const conversions=allocated.reduce((s,r)=>s+r.conversions,0);
      metrics.push(metric("conversions","Allocated platform conversions",conversions,"ratio","Explicit half-conversion daily allocation of the synthetic campaign period; not a purchase count"));
      if(conversions)calc("cost_per_conversion","Cost / platform conversion",t.spend,conversions,"eur");
      breakdowns.push({title:"Campaign period totals — simulated selected-day allocation",columns:[{key:"campaign",label:"Campaign",unit:"text"},{key:"status",label:"Status",unit:"text"},{key:"impressions",label:"Impr.",unit:"count"},{key:"clicks",label:"Clicks",unit:"count"},{key:"cost",label:"Cost",unit:"eur"},{key:"conversions",label:"Conv.",unit:"ratio"}],rows:allocated as Record<string,number|string|null>[]});
    }
    if(channel==="ga4") {
      const refs=records.filter(r=>r.source_id==="ga4"&&r.period_start<=end&&r.period_end>=start);
      breakdowns.push({title:"Channel groups — simulated selected-day allocation",columns:[{key:"channel",label:"Channel group",unit:"text"},{key:"sessions",label:"Sessions",unit:"count"},{key:"engaged_sessions",label:"Engaged",unit:"count"},{key:"event_count",label:"Events",unit:"count"},{key:"key_events",label:"Key events",unit:"count"},{key:"key_event_rate_pct",label:"Source-period key event rate",unit:"pct"},{key:"total_revenue",label:"Revenue",unit:"eur"}],rows:refs.map(r=>({channel:r.dimension_value,sessions:allocation(Number(r.metrics["sessions"]),r),engaged_sessions:allocation(Number(r.metrics["engaged_sessions"]),r),event_count:allocation(Number(r.metrics["event_count"]),r),key_events:allocation(Number(r.metrics["key_events"]),r),key_event_rate_pct:Number(r.metrics["reported_session_key_event_rate"])*100,total_revenue:allocation(Number(r.metrics["total_revenue"]),r,100)}))});
    }
    if(channel==="tv") {
      const refs=records.filter(r=>r.source_id==="tv"&&r.period_start>=start&&r.period_end<=end);
      if(refs.length)breakdowns.push({title:"Full-flight audience definitions (reach is not summed)",columns:[{key:"period",label:"Flight",unit:"text"},{key:"grps_ttl",label:"GRPs TTL",unit:"grp"},{key:"trps_16",label:"TRPs 16+",unit:"grp"},{key:"reach1_ttl_pct",label:"R1+ TTL",unit:"pct"},{key:"reach3_ttl_pct",label:"R3+ TTL",unit:"pct"},{key:"reach1_16_pct",label:"R1+ 16+",unit:"pct"},{key:"reach3_16_pct",label:"R3+ 16+",unit:"pct"}],rows:refs.map(r=>({period:`${r.period_start} → ${r.period_end}`,...Object.fromEntries(["grps_ttl","trps_16","reach1_ttl_pct","reach3_ttl_pct","reach1_16_pct","reach3_16_pct"].map(k=>[k,r.metrics[k]??null]))}))});
    }
    return {id:channel==="ga4"?"website":channel,title:DEMO_CHANNEL_LABELS[channel],kind:channel==="ga4"?"website":channel==="stores"?"stores":channel==="tv"?"offline":"ad_platform",sources:["simulation"],available:rows.length>0,note,metrics:rows.length?metrics:[],breakdowns:rows.length?breakdowns:[]};
  });
  return {campaign:"Synthetic Autumn Demo",campaign_key:"demo-autumn",start,end,days:Math.round((Date.parse(end)-Date.parse(start))/86400000)+1,sections,excluded:[]};
}
