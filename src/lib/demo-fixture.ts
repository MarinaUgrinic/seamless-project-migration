import { z } from "zod";

export const DEMO_SCHEMA_VERSION = "demo.v2";
export const DEMO_ROW_COUNT = 60;
export const DEMO_START_DATE = "2026-10-15";
export const DEMO_END_DATE = "2026-11-13";
export const DEMO_CURRENCY = "EUR";
export const DEMO_CAMPAIGNS = {
  meta: "demo-meta-01",
  google_ads: "demo-google-01",
} as const;

export interface DemoFixtureRow {
  date: string;
  channel: "meta" | "google_ads";
  campaign_id: string;
  currency: "EUR";
  spend: number;
  impressions: number;
  clicks: number;
  website_sessions: number;
  view_item: number;
  add_to_cart: number;
  begin_checkout: number;
  purchases: number;
  purchase_revenue: number;
}

export const DEMO_NUMERIC_FIELDS = [
  "spend",
  "impressions",
  "clicks",
  "website_sessions",
  "view_item",
  "add_to_cart",
  "begin_checkout",
  "purchases",
  "purchase_revenue",
] as const;

export const DEMO_BASELINE_TOTALS = {
  spend: 8805,
  impressions: 537000,
  clicks: 12675,
  website_sessions: 9540,
  view_item: 7170,
  add_to_cart: 1790,
  begin_checkout: 1020,
  purchases: 450,
  purchase_revenue: 41925,
} as const;

/** The independent, wholly synthetic fixture used by both the dashboard seed and n8n demo. */
export function generateDemoFixture(): DemoFixtureRow[] {
  const rows: DemoFixtureRow[] = [];
  for (let i = 0; i < 30; i++) {
    const date = new Date(Date.UTC(2026, 9, 15 + i)).toISOString().slice(0, 10);
    const purchasesMeta = 5 + (i % 3);
    const purchasesGoogle = 8 + (i % 3);
    rows.push(
      {
        date,
        channel: "meta",
        campaign_id: DEMO_CAMPAIGNS.meta,
        currency: DEMO_CURRENCY,
        spend: 100 + i,
        impressions: 10000 + 100 * i,
        clicks: 200 + 2 * i,
        website_sessions: 140 + 2 * i,
        view_item: 110 + i,
        add_to_cart: 24 + (i % 7),
        begin_checkout: 12 + (i % 5),
        purchases: purchasesMeta,
        purchase_revenue: purchasesMeta * (80 + 5 * (i % 4)),
      },
      {
        date,
        channel: "google_ads",
        campaign_id: DEMO_CAMPAIGNS.google_ads,
        currency: DEMO_CURRENCY,
        spend: 150 + 2 * i,
        impressions: 5000 + 100 * i,
        clicks: 150 + 3 * i,
        website_sessions: 120 + 2 * i,
        view_item: 100 + i,
        add_to_cart: 30 + (i % 7),
        begin_checkout: 18 + (i % 5),
        purchases: purchasesGoogle,
        purchase_revenue: purchasesGoogle * (90 + 5 * (i % 4)),
      },
    );
  }
  return rows;
}

const countField = z.number().finite().int().nonnegative();
const moneyField = z.number().finite().nonnegative();
const rowSchema = z.looseObject({
  date: z.string(),
  channel: z.string(),
  campaign_id: z.string(),
  currency: z.string(),
  spend: moneyField,
  impressions: countField,
  clicks: countField,
  website_sessions: countField,
  view_item: countField,
  add_to_cart: countField,
  begin_checkout: countField,
  purchases: countField,
  purchase_revenue: moneyField,
});
const payloadSchema = z.looseObject({
  metadata: z.looseObject({
    synthetic: z.literal(true),
    schema_version: z.literal(DEMO_SCHEMA_VERSION),
    row_count: z.literal(DEMO_ROW_COUNT),
  }),
  rows: z.array(rowSchema).length(DEMO_ROW_COUNT),
});

type DemoPayload = z.infer<typeof payloadSchema>;
export type DemoValidationResult =
  | { success: true; rows: DemoFixtureRow[] }
  | { success: false; status: 400 | 409 | 422; error: string };

const rowKey = (row: { date: string; channel: string; campaign_id: string; currency: string }) =>
  JSON.stringify([row.date, row.channel, row.campaign_id, row.currency]);

/**
 * Rejects everything except the complete canonical fixture. No input value is
 * included in errors, and callers must not write before this returns success.
 */
export function validateDemoPayload(input: unknown): DemoValidationResult {
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue && issue.path.length > 0 ? issue.path.join(".") : "payload";
    return {
      success: false,
      status: 400,
      error: `Invalid demo payload at ${path}: expected metadata synthetic=true, schema_version=${DEMO_SCHEMA_VERSION}, row_count=${DEMO_ROW_COUNT}, and ${DEMO_ROW_COUNT} records with non-negative finite values.`,
    };
  }

  const expectedRows = generateDemoFixture();
  const expectedByKey = new Map(expectedRows.map((row) => [rowKey(row), row]));
  const inputKeys = new Set<string>();
  for (const [index, row] of parsed.data.rows.entries()) {
    const key = rowKey(row);
    if (inputKeys.has(key)) {
      return {
        success: false,
        status: 409,
        error: `Duplicate fixture identity at rows.${index}: date, channel, campaign_id and currency must be unique.`,
      };
    }
    inputKeys.add(key);
    const expected = expectedByKey.get(key);
    if (!expected) {
      return {
        success: false,
        status: 422,
        error: `Unknown demo record at rows.${index}: only the fixed dates, channels, campaign IDs and EUR currency are accepted.`,
      };
    }
    for (const field of DEMO_NUMERIC_FIELDS) {
      if (row[field] !== expected[field]) {
        return {
          success: false,
          status: 422,
          error: `Fixture mismatch at rows.${index}.${field}: the value does not match the canonical synthetic record.`,
        };
      }
    }
  }

  return { success: true, rows: expectedRows };
}

export function createDemoPayload(rows: DemoFixtureRow[] = generateDemoFixture()) {
  return {
    metadata: {
      synthetic: true,
      schema_version: DEMO_SCHEMA_VERSION,
      generated_at: new Date().toISOString(),
      row_count: DEMO_ROW_COUNT,
    },
    rows,
  };
}

export function summarizeDemoRows(rows: DemoFixtureRow[]) {
  const totals: Record<(typeof DEMO_NUMERIC_FIELDS)[number], number> = { ...DEMO_BASELINE_TOTALS };
  for (const field of DEMO_NUMERIC_FIELDS) totals[field] = 0;
  for (const row of rows) {
    for (const field of DEMO_NUMERIC_FIELDS) totals[field] += row[field];
  }
  return totals;
}

export type ValidDemoPayload = DemoPayload;
