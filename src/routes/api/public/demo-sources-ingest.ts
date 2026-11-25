import { DEMO_CHANNELS, ledgerRows, ledgerTotals } from "@/lib/sources/demo-ledger";
import { createFileRoute } from "@tanstack/react-router";
import { SOURCES_SCHEMA_VERSION } from "@/lib/sources/bundle";
import { summarizeRecords, validateSourcesPayload } from "@/lib/sources/ingest";

const HEADERS = { "Cache-Control": "no-store" };
const MAX_BYTES = 1_000_000;
const json = (body: object, status = 200) => Response.json(body, { status, headers: HEADERS });

export const Route = createFileRoute("/api/public/demo-sources-ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) return json({ error: "Content-Type must be application/json." }, 415);
        const text = await request.text();
        if (text.length > MAX_BYTES) return json({ error: "Payload too large for the demo bundle." }, 413);
        let input: unknown;
        try { input = JSON.parse(text); } catch { return json({ error: "Request body must be valid JSON." }, 400); }

        // Only the exact canonical generated samples pass; nothing is written before this check.
        const v = validateSourcesPayload(input);
        if (!v.success) return json({ synthetic: true, schema_version: SOURCES_SCHEMA_VERSION, error: v.error }, v.status);

        const importedAt = new Date().toISOString();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("source_records").upsert(
          v.records.map((r) => ({ ...r, fixture_version: SOURCES_SCHEMA_VERSION, imported_at: importedAt })),
          { onConflict: "source_id,record_key" },
        );
        if (error) return json({ error: "The validated demo sources could not be saved." }, 500);

        const { data, error: readError } = await supabaseAdmin.from("source_records").select("source_id, record_key, record_kind, campaign_key, source_campaign, period_start, period_end, granularity, dimension, dimension_value, currency, metrics, provenance").eq("fixture_version", SOURCES_SCHEMA_VERSION);
        if (readError) return json({ error: "Saved, but verification read failed." }, 500);
        const stored = summarizeRecords((data ?? []) as Parameters<typeof summarizeRecords>[0]);

        const daily = ledgerRows((data ?? []) as unknown as import("@/lib/sources/readers").MappedRecord[]);
        return json({
          synthetic: true, schema_version: SOURCES_SCHEMA_VERSION, imported_at: importedAt,
          imported_sources: v.ids, imported_record_count: v.records.length,
          channel_totals: Object.fromEntries(DEMO_CHANNELS.map(c=>[c,ledgerTotals(daily.filter(r=>r.channel===c))])),
          total_source_record_count: (data ?? []).length, imported: summarizeRecords(v.records), stored,
        });
      },
    },
  },
});
