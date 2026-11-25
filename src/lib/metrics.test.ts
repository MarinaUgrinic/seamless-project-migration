import { describe, expect, it } from "vitest";
import { aggregate, filterRows, totals, bucketKey, type PerfRow } from "./metrics";

const rows: PerfRow[] = [];
for (let i = 0; i < 30; i++) {
  const d = new Date(Date.UTC(2026, 9, 15 + i)).toISOString().slice(0, 10);
  rows.push({ date: d, channel: "meta", spend: 100 + i, impressions: 10000 + 100 * i, clicks: 200 + 2 * i });
  rows.push({ date: d, channel: "google_ads", spend: 150 + 2 * i, impressions: 5000 + 100 * i, clicks: 150 + 3 * i });
}
const S = "2026-10-15", E = "2026-11-13";

describe("metrics", () => {
  it("full period all channels", () => {
    const t = totals(filterRows(rows, S, E, "all"));
    expect([t.rows, t.spend, t.impressions, t.clicks]).toEqual([60, 8805, 537000, 12675]);
    expect(t.ctr).toBeCloseTo(2.3603351955, 9);
    expect(t.cpc).toBeCloseTo(0.6946745562, 9);
  });
  it("meta only", () => {
    const t = totals(filterRows(rows, S, E, "meta"));
    expect([t.rows, t.spend, t.impressions, t.clicks]).toEqual([30, 3435, 343500, 6870]);
  });
  it("google only", () => {
    const t = totals(filterRows(rows, S, E, "google_ads"));
    expect([t.rows, t.spend, t.impressions, t.clicks]).toEqual([30, 5370, 193500, 5805]);
  });
  it("single day", () => {
    const t = totals(filterRows(rows, S, S, "all"));
    expect([t.rows, t.spend, t.impressions, t.clicks]).toEqual([2, 250, 15000, 350]);
    expect(t.ctr).toBeCloseTo(2.3333333333, 9);
    expect(t.cpc).toBeCloseTo(0.7142857143, 9);
  });
  it("zero denominators give null", () => {
    const t = totals([]);
    expect(t.ctr).toBeNull(); expect(t.cpc).toBeNull();
  });
  it("weeks start Monday, months are calendar", () => {
    expect(bucketKey("2026-10-15", "weekly")).toBe("2026-10-12");
    expect(bucketKey("2026-10-19", "weekly")).toBe("2026-10-19");
    expect(aggregate(rows, "monthly").map((b) => [b.key, b.total])).toEqual([["2026-10", 17 * 250 + 3 * (136)], ["2026-11", 8805 - (17 * 250 + 3 * 136)]]);
    expect(aggregate(rows, "weekly").length).toBe(5);
  });
});

import { webTotals } from "./metrics";
const wrows: PerfRow[] = rows.map((r) => {
  const i = (Date.parse(r.date) - Date.parse(S)) / 86400000;
  const m = r.channel === "meta";
  const purchases = (m ? 5 : 8) + (i % 3);
  return { ...r, website_sessions: (m ? 140 : 120) + 2 * i, view_item: (m ? 110 : 100) + i, add_to_cart: (m ? 24 : 30) + (i % 7),
    begin_checkout: (m ? 12 : 18) + (i % 5), purchases, purchase_revenue: purchases * ((m ? 80 : 90) + 5 * (i % 4)) };
});
const vals = (w: ReturnType<typeof webTotals>) => [w.values.website_sessions, w.values.view_item, w.values.add_to_cart, w.values.begin_checkout, w.values.purchases, w.values.purchase_revenue];
describe("website actions", () => {
  it("all", () => expect(vals(webTotals(filterRows(wrows, S, E, "all")))).toEqual([9540, 7170, 1790, 1020, 450, 41925]));
  it("meta", () => expect(vals(webTotals(filterRows(wrows, S, E, "meta")))).toEqual([5070, 3735, 805, 420, 180, 15690]));
  it("google", () => expect(vals(webTotals(filterRows(wrows, S, E, "google_ads")))).toEqual([4470, 3435, 985, 600, 270, 26235]));
  it("first day", () => expect(vals(webTotals(filterRows(wrows, S, S, "all")))).toEqual([260, 210, 54, 30, 13, 1120]));
  it("ratios sum-then-divide", () => {
    const w = webTotals(wrows);
    expect(w.purchaseRate).toBeCloseTo(450 / 9540 * 100, 9);
    expect(w.costPerPurchase).toBeCloseTo(8805 / 450, 9);
    expect(w.roas).toBeCloseTo(41925 / 8805, 9);
  });
  it("missing data is N/A not zero", () => {
    const w = webTotals(rows);
    expect(w.values.purchases).toBeNull(); expect(w.roas).toBeNull(); expect(w.costPerPurchase).toBeNull();
  });
});

describe("website actions: full-selection boundaries", () => {
  const base = { date: "2026-10-15", channel: "meta" as const, spend: 100, impressions: 1000, clicks: 10 };
  const full = { website_sessions: 100, view_item: 50, add_to_cart: 10, begin_checkout: 5, purchases: 2, purchase_revenue: 200 };
  it("one missing purchase count hides purchases, rate and cost per purchase only", () => {
    const w = webTotals([{ ...base, ...full }, { ...base, ...full, purchases: null }]);
    expect(w.values.purchases).toBeNull(); expect(w.purchaseRate).toBeNull(); expect(w.costPerPurchase).toBeNull();
    expect(w.values.view_item).toBe(100); expect(w.values.purchase_revenue).toBe(400); expect(w.roas).toBe(2);
    expect(w.partial).toBe(true);
  });
  it("missing sessions do not erase complete purchases", () => {
    const w = webTotals([{ ...base, ...full }, { ...base, ...full, website_sessions: null }]);
    expect(w.values.website_sessions).toBeNull(); expect(w.purchaseRate).toBeNull();
    expect(w.values.purchases).toBe(4); expect(w.costPerPurchase).toBe(50);
  });
  it("known zeros are not missing", () => {
    const w = webTotals([{ ...base, ...full, purchases: 0, purchase_revenue: 0 }]);
    expect(w.values.purchases).toBe(0); expect(w.purchaseRate).toBe(0); expect(w.roas).toBe(0);
    expect(w.costPerPurchase).toBeNull(); expect(w.partial).toBe(false);
  });
  it("empty selection is N/A", () => {
    const w = webTotals([]);
    expect(w.values.website_sessions).toBeNull(); expect(w.roas).toBeNull(); expect(w.available).toBe(0);
  });
});

import { aggregatePeriods, snapRange } from "./metrics";
describe("granularity date snapping", () => {
  const MIN = "2026-10-15", MAX = "2026-11-13";
  it("weekly widens to Monday–Sunday within the data range", () => {
    expect(snapRange("2026-10-21", "2026-10-28", "weekly", MIN, MAX)).toEqual({ start: "2026-10-19", end: "2026-11-01" });
    expect(snapRange("2026-10-16", "2026-11-12", "weekly", MIN, MAX)).toEqual({ start: MIN, end: MAX });
  });
  it("monthly widens to calendar months within the data range", () => {
    expect(snapRange("2026-11-03", "2026-11-05", "monthly", MIN, MAX)).toEqual({ start: "2026-11-01", end: MAX });
  });
  it("daily keeps the dates", () => {
    expect(snapRange("2026-10-20", "2026-10-22", "daily", MIN, MAX)).toEqual({ start: "2026-10-20", end: "2026-10-22" });
  });
  it("period totals add up to the full total and flag partial weeks", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, 15 + i)).toISOString().slice(0, 10), channel: "meta" as const, spend: 100 + i, impressions: 1, clicks: 1 }));
    const w = aggregatePeriods(rows, "weekly");
    expect(w.reduce((s, p) => s + p.t.spend, 0)).toBe(3435);
    expect(w[0]).toMatchObject({ key: "2026-10-12", from: "2026-10-15", partial: true });
    expect(aggregatePeriods(rows, "monthly").map((p) => p.t.spend)).toEqual([1836, 1599]);
  });
});
