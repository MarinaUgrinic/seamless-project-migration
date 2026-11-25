# Neptun Daily Report — synthetic n8n demo

`neptun-daily-report.json` is an importable, inactive n8n workflow using only built-in nodes. It generates the canonical 60-row synthetic fixture locally; it reads no company files, advertising accounts, GA4, or existing dashboard data.

## Import and run

1. In the Neptun dashboard, choose **Download n8n workflow**.
2. In n8n, create a workflow and use **Import from File** with the downloaded JSON.
3. Leave the workflow inactive. Choose **Execute workflow** to run the Manual Trigger once.
4. Confirm that **Code: Verify result** reports success, 60 imported records, 60 total unique rows, and the baseline totals.
5. Reload the Neptun dashboard to fetch the new import time. Running the manual workflow again is safe: it upserts the same 60 business records.

The workflow timezone is **Europe/Skopje**. No schedule is configured or activated.

## Demo endpoint

The HTTP Request node is already configured to POST JSON to:

`https://neptun-marketing-demo.lovable.app/api/public/demo-ingest`

This is the published synthetic demo's production endpoint. No authentication credential or API key is required for this tightly restricted public demo route. Do not add private keys to the workflow.

The endpoint accepts only `schema_version: demo.v2`, `synthetic: true`, and the exact canonical 60 records for `demo-meta-01` and `demo-google-01`, in EUR, from 2026-10-15 through 2026-11-13. Altered values, arbitrary campaigns or dates, duplicates, and invalid counts are rejected before any database write.

## Expected verification totals

- Spend: 8,805 EUR
- Impressions: 537,000
- Clicks: 12,675
- Website sessions: 9,540
- Add to basket: 1,790
- Purchases: 450
- Purchase revenue: 41,925 EUR

The original Daily Report manual run was confirmed in n8n; the workflow remains inactive.

---

# Neptun All Sources Demo — synthetic n8n demo

`neptun-all-sources-demo.json` is a second, separate, **inactive, manual-only** workflow (Neptun Daily Report is unchanged). Chain:

Manual Trigger → Code: Generate synthetic source bundle → HTTP Request: Import (first run) → HTTP Request: Import again (idempotency) → Code: Verify counts, totals and idempotency.

- The generator builds the canonical `sources.v2` bundle of 10 generated sources (Meta, Google Ads, YouTube, Spotify, GA4 traffic, LWM 1, LWM 2, LWM 3, TV, plus the complete eight-channel/Stores simulation workbook) in their standard column layouts. It reads no files, accounts or databases.
- Both HTTP nodes POST to `https://neptun-marketing-demo.lovable.app/api/public/demo-sources-ingest`. That route accepts only the exact canonical generated samples (`synthetic: true`, `schema_version: sources.v2`, known source IDs) and rejects anything else before any write.
- The verifier expects 666 records after both runs (426 reference + 240 complete synthetic channel-days), identical per-source and per-channel ledger totals, and fails otherwise.
- Regenerate the file after changing the generator: `bun scripts/build-sources-workflow.ts`.

Run it with **Execute workflow** in the n8n editor; do not activate it.

The earlier sources.v1 All Sources manual execution was confirmed in n8n. Import the updated downloadable JSON over that inactive workflow before executing sources.v2; no new n8n execution or schedule activation is part of this rollout. The daily ledger preserves source period totals, explicitly labels synthetic allocation and keeps site/store observations separate from campaign outcomes.
