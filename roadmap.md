# Step 3: synthetic n8n import

- [x] Add a public demo-only import endpoint with canonical fixture validation and idempotent upserts.
- [x] Add focused tests for valid, duplicate, altered, and non-demo payloads.
- [x] Add the importable Neptun Daily Report n8n workflow and setup instructions.
- [x] Add the dashboard workflow download and reliable data refresh behavior.
- [x] Verify repeated imports, rejected writes, workflow scripts, dashboard data, and layouts locally.
- [x] Verify the published production endpoint with repeated valid imports and rejected invalid payloads.
- [x] Update and verify the repository workflow, app download, setup instructions, and dashboard downloads against production.
- [x] Commit the production endpoint update.
- [x] Connect the user's n8n workspace and import the inactive Neptun workflow.
- [x] Run and verify one manual synthetic import test in n8n; the final node and database confirm 60 unique rows and every expected total.

# Step 4: Meta export mapping (synthetic)

- [x] Map synthetic Meta-style exports to daily rows; keep Link clicks and Clicks (all) distinct; dashboard clicks use Link clicks.
- [x] Load mapped Meta rows into the dashboard (via the Sources & report area; baseline table unchanged).

# Step 5: all generated sources + master report

- [x] Generated samples and readers for Meta, Google Ads, YouTube, Spotify, GA4, LWM 1–3, TV (CSV/XLS/XLSX).
- [x] Guarded demo-sources import route + source_records table (read-only to browsers).
- [x] Sources & report area: import all, preview, sample downloads, status, master report + CSV export.
- [x] Neptun All Sources Demo n8n workflow (inactive) + tests.
- [x] Published; production route verified (2 valid imports, 5 rejections); workflow imported into n8n inactive and later executed manually there.

# Step 6: review corrections

- [x] Top channel filter covers all channels; daily/weekly/monthly snap dates + By period table.
- [x] GA4 key event rate shown as % (raw fraction kept).
- [x] Preserve all standard sample columns as reported fields in mapped records.
- [x] Spotify/TV readers find headers by name at declared rows (shifted layouts).
- [x] Root README + roadmap; publish and re-verify production.
- Note: Neptun All Sources Demo was executed manually in n8n and verified — 9 sources imported twice, 426 records, totals unchanged. Both workflows stay inactive.

# Step 7: AI management presentation

- [x] Add a user-triggered AI summary of the selected persistent demo data, with evidence-based optimization suggestions.
- [x] Add presentation preview, cancellation and downloadable management slides; verify the real generation flow and regressions.
- Verified: 49 focused tests; current build/type checks pass; real all-channel and Spotify-only AI presentations, HTML download, phone layout, filter reset and Stop checked in preview. No new frontend publication requested or performed.

# Dashboard visual refresh

- [x] Add scoped blue/cyan gradients, coherent icons, readable surfaces and accessible control feedback without changing report behavior.
- [x] Verify regressions and desktop/mobile controls without paid AI generation; commit, publish and inspect production.
- Verified: 49 regression tests, automatic build OK, 1280px desktop and 375px/320px mobile without page overflow, filters/downloads/source preview, simulated AI error and Stop states; published appearance and gradients confirmed on the existing demo URL. No paid AI request or fixture change.

# Complete synthetic demo and collapsible all-channel reporting

- [x] Generate complete evidence and Stores observations; canonical versioned import, downloads and inactive workflow stay aligned.
- [x] Use the same persisted all-channel daily ledger for cards, comparison, periods, chart, master report and AI evidence, with non-overlapping media/site/store scopes.
- [x] Add accessible per-panel/KPI collapse, persistent local state and Collapse all / Expand all; filters remain available.
- [x] Verify synthetic reconciliation, every channel/period, imports, collapse and desktop/mobile without paid AI calls.
- [x] Commit, publish and inspect production.

- Verification: 80 tests pass; automatic type/build OK; two UI imports retain 666 unique sources.v2 records, including 240 complete channel-day observations; the 60-row baseline remains spend 8805, impressions 537000, clicks 12675, sessions 9540, purchases 450, revenue 41925. All source previews, eight channel filters, calendar periods, JSON/CSV/workflow downloads, remembered minimize state and desktop/375px/320px layouts checked. Updated workflow remains inactive in its download; no version-two n8n execution or paid AI generation claimed.
- Production verified: existing demo returned 200 and displayed eight channels, 240 daily rows, populated fields, Stores and persistent minimize controls; two external canonical imports retained 666 unique records and unchanged totals; altered, duplicate and non-demo requests returned 422 before writes. The existing n8n workspace workflow was not modified or executed; its updated inactive sources.v2 replacement is available through the dashboard download.
