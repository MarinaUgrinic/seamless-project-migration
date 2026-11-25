import { createFileRoute } from "@tanstack/react-router";
import {
  DEMO_CAMPAIGNS,
  DEMO_ROW_COUNT,
  DEMO_SCHEMA_VERSION,
  generateDemoFixture,
  summarizeDemoRows,
  validateDemoPayload,
  type DemoFixtureRow,
} from "@/lib/demo-fixture";

const JSON_HEADERS = { "Cache-Control": "no-store" };
const ON_CONFLICT = "date,channel,campaign_id,currency";

function json(body: object, status = 200) {
  return Response.json(body, { status, headers: JSON_HEADERS });
}

export const Route = createFileRoute("/api/public/demo-ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
          return json({ error: "Content-Type must be application/json." }, 415);
        }

        let input: unknown;
        try {
          input = await request.json();
        } catch {
          return json({ error: "Request body must be valid JSON." }, 400);
        }

        const validation = validateDemoPayload(input);
        if (!validation.success) {
          return json(
            { synthetic: true, schema_version: DEMO_SCHEMA_VERSION, error: validation.error },
            validation.status,
          );
        }

        const importedAt = new Date().toISOString();
        // This public route is deliberately limited to the exact synthetic fixture above.
        // The privileged client never accepts arbitrary table, campaign, or metric values.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: upsertError } = await supabaseAdmin.from("campaign_performance").upsert(
          validation.rows.map((row) => ({ ...row, updated_at: importedAt })),
          { onConflict: ON_CONFLICT },
        );
        if (upsertError) return json({ error: "The validated demo import could not be saved." }, 500);

        const { data, error: readError } = await supabaseAdmin
          .from("campaign_performance")
          .select("date, channel, campaign_id, currency, spend, impressions, clicks, website_sessions, view_item, add_to_cart, begin_checkout, purchases, purchase_revenue");
        if (readError) return json({ error: "The demo import was saved but could not be verified." }, 500);

        const storedRows: DemoFixtureRow[] = (data ?? []).map((row) => ({
          date: row.date,
          channel: row.channel as DemoFixtureRow["channel"],
          campaign_id: row.campaign_id,
          currency: row.currency as "EUR",
          spend: Number(row.spend),
          impressions: Number(row.impressions),
          clicks: Number(row.clicks),
          website_sessions: Number(row.website_sessions),
          view_item: Number(row.view_item),
          add_to_cart: Number(row.add_to_cart),
          begin_checkout: Number(row.begin_checkout),
          purchases: Number(row.purchases),
          purchase_revenue: Number(row.purchase_revenue),
        }));
        const allUniqueKeys = new Set(
          storedRows.map((row) => JSON.stringify([row.date, row.channel, row.campaign_id, row.currency])),
        );
        const demoKeys = new Set(
          generateDemoFixture().map((row) => JSON.stringify([row.date, row.channel, row.campaign_id, row.currency])),
        );
        const storedFixture = storedRows.filter((row) =>
          demoKeys.has(JSON.stringify([row.date, row.channel, row.campaign_id, row.currency])),
        );
        if (storedFixture.length !== DEMO_ROW_COUNT) {
          return json({ error: "The saved demo fixture did not pass post-import verification." }, 500);
        }

        return json({
          synthetic: true,
          schema_version: DEMO_SCHEMA_VERSION,
          imported_record_count: validation.rows.length,
          total_unique_row_count: allUniqueKeys.size,
          imported_at: importedAt,
          demo_campaign_ids: [DEMO_CAMPAIGNS.meta, DEMO_CAMPAIGNS.google_ads],
          totals: summarizeDemoRows(storedFixture),
        });
      },
    },
  },
});
