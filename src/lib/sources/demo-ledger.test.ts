import { describe,expect,it } from "vitest";
import { generateSourceBundle } from "./bundle";
import { readBundle } from "./readers";
import { validateSourcesPayload } from "./ingest";
import { buildMasterReport, formatValue, reportToCsv } from "./report";
import { DEMO_CHANNELS, MEDIA_CHANNELS, demoReach, ledgerRows, ledgerTotals, ledgerPeriods, selectLedger, sumLedger } from "./demo-ledger";
import { buildManagementEvidence } from "../management-report";
import { generateDemoFixture } from "../demo-fixture";
const bundle=generateSourceBundle(),records=readBundle(bundle),rows=ledgerRows(records);
const start="2026-10-15",end="2026-11-13";
describe("complete canonical synthetic ledger",()=>{
  it("has exactly 30 complete daily observations for each of the eight requested channels",()=>{
    expect(rows).toHaveLength(240);expect(new Set(rows.map(r=>`${r.channel}|${r.date}`)).size).toBe(240);
    for(const channel of DEMO_CHANNELS){const selected=selectLedger(rows,start,end,channel);expect(selected).toHaveLength(30);expect(selected[0]?.date).toBe(start);expect(selected.at(-1)?.date).toBe(end);}
    for(const r of rows){for(const [key,v] of Object.entries(r.metrics))expect(v,`${r.channel}:${key}`).not.toBeNull();expect(Number(r.metrics["reach"])).toBeLessThanOrEqual(Number(r.metrics["impressions"]));const stages=["website_sessions","view_item","add_to_cart","begin_checkout","purchases"].map(k=>Number(r.metrics[k]));for(let i=1;i<stages.length;i++)expect(stages[i]).toBeLessThanOrEqual(stages[i-1]??0);}
  });
  it("keeps every original 60-row ad and shopping fixture value unchanged",()=>{
    for(const base of generateDemoFixture()){const r=rows.find(r=>r.channel===base.channel&&r.date===base.date);expect(r).toBeDefined();for(const k of ["spend","impressions","clicks","website_sessions","view_item","add_to_cart","begin_checkout","purchases","purchase_revenue"] as const)expect(r?.metrics[k]).toBe(base[k]);}
    const baseline=ledgerTotals(rows.filter(r=>r.channel==="meta"||r.channel==="google_ads"));expect(baseline).toMatchObject({spend:8805,impressions:537000,clicks:12675,sessions:9540,purchases:450,revenue:41925});
  });
  it("preserves source-period and flight totals using exact cent/count/point allocation",()=>{
    const tv=rows.filter(r=>r.channel==="tv");expect(ledgerTotals(tv).spend).toBe(21500);expect(ledgerTotals(tv.filter(r=>r.date<="2026-10-31")).spend).toBe(12000);expect(sumLedger(tv.filter(r=>r.date<="2026-10-31"),"grps_ttl")).toBe(180.5);expect(sumLedger(tv,"trps_16")).toBe(373);
    const ga=rows.filter(r=>r.channel==="ga4");expect(ledgerTotals(ga)).toMatchObject({sessions:12650,revenue:22100.75});expect(sumLedger(ga,"engaged_sessions")).toBe(8160);expect(sumLedger(ga,"event_count")).toBe(118750);expect(sumLedger(ga,"key_events")).toBe(495);expect(sumLedger(ga,"key_event_sessions")).toBe(412);
    expect(ledgerTotals(rows.filter(r=>r.channel==="spotify"))).toMatchObject({impressions:411000,clicks:1348,spend:2055});expect(ledgerTotals(rows.filter(r=>r.channel==="lwm"))).toMatchObject({impressions:149700,clicks:339,spend:498.1});expect(sumLedger(rows.filter(r=>r.channel==="youtube"),"video_views")).toBe(16350);
  });
  for(const granularity of ["daily","weekly","monthly"] as const)it(`${granularity} provides every channel and reconciles filtered totals`,()=>{
    const periods=ledgerPeriods(rows,granularity);expect(periods).toHaveLength(granularity==="daily"?240:granularity==="weekly"?40:16);
    for(const channel of DEMO_CHANNELS){const selected=selectLedger(rows,"2026-10-20","2026-11-05",channel);const buckets=ledgerPeriods(selected,granularity);expect(buckets.every(b=>b.channel===channel)).toBe(true);for(const key of ["spend","impressions","sessions","purchases","revenue"] as const)expect(buckets.reduce((s,p)=>s+p.totals[key],0)).toBeCloseTo(ledgerTotals(selected)[key],8);}
  });
  it("computes non-additive reach as a generated cohort union",()=>{
    const meta=rows.filter(r=>r.channel==="meta");expect(demoReach(meta)).toBe(29707);expect(demoReach(meta)).toBeLessThan(sumLedger(meta,"reach"));expect(demoReach([meta[0],meta[0]].filter(r=>r!==undefined))).toBe(Number(meta[0]?.metrics["reach"]));
  });
  it("has fully observed applicable report values and finite CSV ratios in full and single-day views",()=>{
    for(const to of [start,end]){const report=buildMasterReport(records,generateDemoFixture(),start,to);expect(report.sections.map(s=>s.id)).toEqual(["meta","google_ads","youtube","spotify","website","lwm","tv","stores"]);for(const section of report.sections){expect(section.available).toBe(true);for(const metric of section.metrics){expect(typeof metric.value).toBe("number");expect(Number.isFinite(metric.value)).toBe(true);expect(formatValue(metric.value,metric.unit)).not.toMatch(/N\/A|NaN|undefined/);}}expect(reportToCsv(report,"2026-11-25T17:17:00Z")).not.toMatch(/N\/A|NaN|undefined/);}
  });
  it("every-day Google and GA4 breakdowns reconcile with their daily ledger, while raw percentages stay preserved",()=>{
    for(const day of [start,"2026-10-20",end]){const report=buildMasterReport(records,[],day,day);const ga=report.sections.find(s=>s.id==="website"),google=report.sections.find(s=>s.id==="google_ads");const site=ledgerTotals(selectLedger(rows,day,day,"ga4")),ads=ledgerTotals(selectLedger(rows,day,day,"google_ads"));expect(ga?.breakdowns[0]?.rows.reduce((s,r)=>s+Number(r["sessions"]),0)).toBe(site.sessions);expect(ga?.breakdowns[0]?.rows.reduce((s,r)=>s+Number(r["total_revenue"]),0)).toBeCloseTo(site.revenue,8);expect(google?.breakdowns[0]?.rows.reduce((s,r)=>s+Number(r["cost"]),0)).toBeCloseTo(ads.spend,8);expect(google?.breakdowns[0]?.rows.reduce((s,r)=>s+Number(r["clicks"]),0)).toBe(ads.clicks);}
    const full=buildMasterReport(records,[],start,end),ga=full.sections.find(s=>s.id==="website");expect(ga?.metrics.find(m=>m.key==="session_key_event_rate")?.value).toBeCloseTo(412/12650*100,10);expect(records.find(r=>r.source_id==="ga4"&&r.dimension_value==="Organic Search")?.metrics["reported_session_key_event_rate"]).toBe(0.0238);
  });
  it("has a whole-section empty state rather than fabricated observations outside the period",()=>{
    expect(selectLedger(rows,"2026-12-01","2026-12-10","all")).toHaveLength(0);expect(buildMasterReport(records,[],"2026-12-01","2026-12-10").sections.every(s=>!s.available&&s.metrics.length===0)).toBe(true);
  });
  it("canonical re-import keys remain unique and altered/new/non-demo ledgers are refused",()=>{
    const first=validateSourcesPayload(bundle),second=validateSourcesPayload(generateSourceBundle());expect(first.success&&first.records.length).toBe(666);expect(first).toEqual(second);
    const bad=generateSourceBundle();const row=bad.sources.simulation.sheets[0]?.rows[1];if(!row)throw new Error("Missing generated row");row[2]=99999;expect(validateSourcesPayload(bad).success).toBe(false);
    const duplicate=generateSourceBundle();const sheet=duplicate.sources.simulation.sheets[0];if(!sheet?.rows[1])throw new Error("Missing sheet");sheet.rows.push([...sheet.rows[1]]);expect(validateSourcesPayload(duplicate).success).toBe(false);
    expect(validateSourcesPayload({...bundle,metadata:{...bundle.metadata,synthetic:false}}).success).toBe(false);
  });
  it("AI evidence follows the same channel/period filters and never folds site or store revenue into media totals",()=>{
    const evidence=buildManagementEvidence(records,generateDemoFixture(),{start,end,channel:"all",granularity:"monthly"});expect(evidence.allChannelSimulation.byChannel).toHaveLength(8);expect(evidence.allChannelSimulation.byPeriod).toHaveLength(16);const media=ledgerTotals(rows.filter(r=>MEDIA_CHANNELS.includes(r.channel)));expect(evidence.allChannelSimulation.mediaOnly).toEqual(media);expect(media.revenue).toBe(117885);expect(evidence.adCohort?.totals?.spend).toBe(8805);
    const store=buildManagementEvidence(records,generateDemoFixture(),{start,end,channel:"stores",granularity:"daily"});expect(store.adCohort).toBeNull();expect(store.sourceReport.sections.map(s=>s.id)).toEqual(["stores"]);expect(store.allChannelSimulation.byChannel[0]?.totals.revenue).toBe(60120);
  });
});
