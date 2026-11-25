import { describe, expect, it } from "vitest";
import {
  createDemoPayload,
  DEMO_BASELINE_TOTALS,
  generateDemoFixture,
  summarizeDemoRows,
  validateDemoPayload,
} from "./demo-fixture";

const validPayload = () => createDemoPayload();

describe("canonical synthetic fixture", () => {
  it("contains exactly 60 unique records and the validated baseline totals", () => {
    const rows = generateDemoFixture();
    const keys = new Set(rows.map((row) => [row.date, row.channel, row.campaign_id, row.currency].join("|")));
    expect(rows).toHaveLength(60);
    expect(keys.size).toBe(60);
    expect(rows[0]?.date).toBe("2026-10-15");
    expect(rows.at(-1)?.date).toBe("2026-11-13");
    expect(summarizeDemoRows(rows)).toEqual(DEMO_BASELINE_TOTALS);
  });

  it("accepts the exact demo.v2 payload", () => {
    const result = validateDemoPayload(validPayload());
    expect(result.success).toBe(true);
    if (result.success) expect(result.rows).toEqual(generateDemoFixture());
  });

  it("rejects non-demo metadata", () => {
    const payload = validPayload();
    payload.metadata.synthetic = false;
    const result = validateDemoPayload(payload);
    expect(result).toMatchObject({ success: false, status: 400 });
  });

  it("rejects duplicate identities", () => {
    const payload = validPayload();
    payload.rows[1] = { ...payload.rows[0]! };
    const result = validateDemoPayload(payload);
    expect(result).toMatchObject({ success: false, status: 409 });
  });

  it("rejects one altered business value", () => {
    const payload = validPayload();
    payload.rows[0]!.spend += 1;
    const result = validateDemoPayload(payload);
    expect(result).toMatchObject({ success: false, status: 422 });
    if (!result.success) expect(result.error).toContain("rows.0.spend");
  });

  it("rejects an arbitrary campaign", () => {
    const payload = validPayload();
    payload.rows[0]!.campaign_id = "real-campaign";
    const result = validateDemoPayload(payload);
    expect(result).toMatchObject({ success: false, status: 422 });
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid count %s", (value) => {
    const payload = validPayload();
    payload.rows[0]!.purchases = value;
    const result = validateDemoPayload(payload);
    expect(result).toMatchObject({ success: false, status: 400 });
  });

  it("rejects an incomplete batch", () => {
    const payload = validPayload();
    payload.rows.pop();
    payload.metadata.row_count = 59;
    const result = validateDemoPayload(payload);
    expect(result).toMatchObject({ success: false, status: 400 });
  });
});
