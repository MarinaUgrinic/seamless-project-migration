import { describe, expect, it } from "vitest";
import { buildManagementEvidence, normalizeDeck, presentationHtml, reportFiltersSchema } from "./management-report";
import { generateDemoFixture } from "./demo-fixture";
import { generateSourceBundle } from "./sources/bundle";
import { readBundle } from "./sources/readers";

const filters = { start: "2026-10-15", end: "2026-11-13", channel: "all", granularity: "daily" } as const;
const records = readBundle(generateSourceBundle());
describe("AI management report evidence", () => {
  it("uses the unchanged full baseline without adding the master source cohort", () => {
    const e = buildManagementEvidence(records, generateDemoFixture(), filters);
    expect(e.adCohort?.totals?.spend).toBe(8805);
    expect(e.adCohort?.totals?.clicks).toBe(12675);
    expect(e.adCohort?.website.values.purchases).toBe(450);
    expect(e.adCohort?.website.values.purchase_revenue).toBe(41925);
  });
  it("source-only TV has no misleading ad cohort and retains its own report", () => {
    const e = buildManagementEvidence(records, generateDemoFixture(), { ...filters, channel: "tv" });
    expect(e.adCohort).toBeNull();
    expect(e.hasData).toBe(true);
    expect(e.sourceReport.sections.map((s) => s.id)).toEqual(["tv"]);
    expect(e.sourceReport.sections[0]?.available).toBe(true);
  });
  it("Meta selection preserves link-click cohort totals and full-selection website semantics", () => {
    const fixture = generateDemoFixture().map((r, i) => i === 0 ? { ...r, purchases: null } : r);
    const e = buildManagementEvidence(records, fixture, { ...filters, channel: "meta" });
    expect(e.adCohort?.totals?.spend).toBe(3435);
    expect(e.adCohort?.totals?.clicks).toBe(6870);
    expect(e.adCohort?.website.values.purchases).toBeNull();
    expect(e.adCohort?.website.values.purchase_revenue).toBe(15690);
    expect(e.sourceReport.sections.map((s) => s.id)).toEqual(["meta"]);
  });
  it("single-day Google source has explicit simulated daily evidence", () => {
    const e = buildManagementEvidence(records, generateDemoFixture(), { ...filters, end: filters.start, channel: "google_ads" });
    expect(e.adCohort?.totals?.spend).toBe(150);
    expect(e.sourceReport.sections.find((s) => s.id === "google_ads")?.available).toBe(true);
    expect(e.allChannelSimulation.byChannel[0]?.totals.spend).toBe(150);
    expect(e.allChannelSimulation.byPeriod[0]?.totals.sessions).toBe(120);
  });
  it("accepts only filters, never arbitrary data or impossible dates", () => {
    expect(reportFiltersSchema.safeParse(filters).success).toBe(true);
    expect(reportFiltersSchema.safeParse({ ...filters, start: "2026-10-32" }).success).toBe(false);
    expect(reportFiltersSchema.safeParse({ ...filters, rows: [{ spend: 123 }], prompt: "Real account data" }).success).toBe(false);
  });
  it("requires a complete five-slide presentation and safely escapes download content", () => {
    const slide = { title: "<script>alert(1)</script>", takeaway: "Synthetic result", points: [{ statement: "Review & test", evidence: "Spend EUR 8805" }], speakerNotes: "No proven uplift" };
    expect(() => normalizeDeck({ title: "Report", slides: [slide] })).toThrow();
    const deck = normalizeDeck({ title: "Report", slides: Array.from({ length: 5 }, () => slide) });
    const html = presentationHtml({ deck, filters, generatedAt: "2026-11-25T16:57:00Z", dataUpdatedAt: null }, {});
    expect(html).not.toContain("<script>");
    expect(deck.slides).toHaveLength(5);
  });
});