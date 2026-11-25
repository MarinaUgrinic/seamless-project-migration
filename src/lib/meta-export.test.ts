import { describe, expect, it } from "vitest";
import { generateDemoFixture } from "./demo-fixture";
import { DEMO_META_CAMPAIGN_MAP, META_HEADERS, generateSyntheticMetaExportCsv, parseMetaExport } from "./meta-export";

const opts = { campaignMap: DEMO_META_CAMPAIGN_MAP, clicksMetric: "link_clicks" as const };
const H = META_HEADERS.join(",");

describe("Meta export mapping (synthetic)", () => {
  it("maps the synthetic export to the 30 Meta fixture rows and skips the total row", () => {
    const rows = parseMetaExport(generateSyntheticMetaExportCsv(), opts);
    const meta = generateDemoFixture().filter((r) => r.channel === "meta");
    expect(rows).toHaveLength(30);
    rows.forEach((r, i) => {
      expect([r.date, r.campaign_id, r.spend, r.impressions, r.clicks]).toEqual([meta[i]!.date, meta[i]!.campaign_id, meta[i]!.spend, meta[i]!.impressions, meta[i]!.clicks]);
    });
    expect(rows.reduce((s, r) => s + r.spend, 0)).toBe(3435);
    expect(rows.reduce((s, r) => s + r.link_clicks, 0)).toBe(6870);
  });
  it("keeps link clicks and all clicks distinct", () => {
    const all = parseMetaExport(generateSyntheticMetaExportCsv(), { ...opts, clicksMetric: "clicks_all" });
    expect(all[0]!.link_clicks).toBe(200);
    expect(all[0]!.clicks_all).toBe(240);
    expect(all[0]!.clicks).toBe(240);
  });
  it("rejects period totals instead of fabricating daily rows", () => {
    expect(() => parseMetaExport(`${H}\n2026-10-15,2026-10-21,Synthetic Demo Campaign A,10,100,5,3`, opts)).toThrow(/period total/);
  });
  it("rejects unmapped campaign names", () => {
    expect(() => parseMetaExport(`${H}\n2026-10-15,2026-10-15,Other,10,100,5,3`, opts)).toThrow(/mapping/);
  });
  it("rejects duplicates, missing columns, negatives and link > all", () => {
    const row = "2026-10-15,2026-10-15,Synthetic Demo Campaign A,10,100,5,3";
    expect(() => parseMetaExport(`${H}\n${row}\n${row}`, opts)).toThrow(/duplicate/);
    expect(() => parseMetaExport("Campaign name,Impressions\nx,1", opts)).toThrow(/Missing columns/);
    expect(() => parseMetaExport(`${H}\n2026-10-15,2026-10-15,Synthetic Demo Campaign A,10,-1,5,3`, opts)).toThrow(/nonnegative/);
    expect(() => parseMetaExport(`${H}\n2026-10-15,2026-10-15,Synthetic Demo Campaign A,10,100,3,5`, opts)).toThrow(/exceed/);
  });
});
