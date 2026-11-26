# Neptun Marketing Report — synthetic demo

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A marketing reporting dashboard built for a hackathon. **Every number in it is generated demo data — not real Neptun performance.** No company files, advertising accounts or GA4 properties are connected.

## Dashboard
- The fixed 60-row Meta/Google baseline and demo.v2 import are unchanged. The refreshed dashboard reads the persisted complete all-channel daily simulation, not a frontend fallback.
- Filters: dates, channel (All, Meta, Google Ads, YouTube, Spotify, Website/GA4, LWM, TV, Stores) and Daily/Weekly/Monthly. Weekly/Monthly widen the dates to whole weeks/months and fill the **By period** table.
- Every section and KPI has a minimize/expand control; Collapse all / Expand all preserve local choices across reloads and never hide filters.
- Simulated website actions (sessions → product view → basket → checkout → purchase), clearly labelled as simulated.

## Sources & report
- Nine generated sample feeds plus a tenth all-channel/Stores simulation workbook in standard export layouts: Meta, Google Ads, YouTube, Spotify, GA4 traffic, LWM 1, LWM 2, LWM 3, TV.
- Demonstrated formats: **CSV** (Meta, Google Ads, GA4), **legacy XLS** (LWM 1, LWM 3), **XLSX** (YouTube, Spotify, LWM 2, TV). Readers use the declared header rows and locate columns by name; summary/total rows are excluded. Every standard column is kept: core metrics for calculations and source-reported ratios/text as `reported_*` fields, which are never summed.
- **Import all generated samples** sends the canonical bundle to `/api/public/demo-sources-ingest`. It accepts only the exact generated samples (`synthetic: true`, `schema_version: sources.v2`) and rejects anything else before writing. There is no upload of arbitrary or real files.
- Per-source sample downloads, raw/mapped preview and last-import status.
- **Master report**, KPIs, comparison, By period and chart use the same eight-channel daily ledger. Explicit synthetic allocations preserve period totals (including each TV flight); there are no invented measured daily results. Site-wide GA4 and offline Stores observations never enter media totals. Reach uses a generated integer-cohort union, never summed daily reach. Raw reference exports remain separate; summary/detail views are not added. Applicable metrics are populated at their source; formatters still return N/A for genuinely unavailable values outside the complete demo. Deliberately empty ranges show a whole-section empty state.

## n8n
- `workflows/neptun-daily-report.json` — imports the 60-row baseline.
- `workflows/neptun-all-sources-demo.json` — generates the 10-source sources.v2 bundle, imports it twice and verifies 666 unique records (426 reference rows + 240 channel-day simulation rows), source totals and per-channel ledger totals and unchanged totals.
- Both are manual-only and inactive. To run: open the workflow in n8n and click **Execute workflow**. See `workflows/README.md`.

## AI management report
- **AI management report** opens a five-slide manager/director briefing for the selected channel and dates. Generation runs only after **Generate presentation** is clicked and consumes Lovable AI credits.
- Slides include evidence, optimization test hypotheses, limitations and speaker notes. Preview with previous/next; download a self-contained HTML presentation (also printable to PDF). Reports are temporary in the current dashboard session, not stored in campaign tables.
- `/api/management-report` accepts only same-origin, validated demo filters. Server-side read-only queries use the same complete ledger and sum-then-divide rules as the dashboard; reference exports are never added to the ledger. No arbitrary prompts, uploads, real accounts or automatic ad changes are supported.
- The AI is working from fictional data: recommendations are experiments to evaluate, never proven gains. The duplicate baseline, complete ledger, site-wide observations and offline sales remain separate.
- **Stop** cancels generation; errors do not auto-retry. Provider access denials persist in the private server-only `ai_report_access_state` table until an owner explicitly requests resuming after access is restored.

## Development
`bun install`, `bun run dev`, tests with `bunx vitest run`. Regenerate the All Sources workflow after changing the generator: `bun scripts/build-sources-workflow.ts`.

## Version-two rollout
The existing schema stores sources.v2 alongside its legacy generated access policy; only approved generated source IDs are readable and ordinary clients cannot write. Both existing n8n workflows remain inactive. Their earlier manual executions were verified; the updated All Sources download must replace its previous sources.v1 version before another manual run. No new version-two n8n execution or paid AI generation is claimed.

## License
Released under the MIT License — see [LICENSE](LICENSE). Every number in the demo is synthetic; the license covers the code, not any real marketing data.
