<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->
- Report data lives in public.campaign_performance (read-only for anon via RLS, unique on date+channel+campaign_id+currency); generated website-action columns live on the same row and are NULL when not generated. Seed/backfill only in migrations, idempotently and scoped to the demo campaign IDs. KPI math lives in src/lib/metrics.ts (sum-then-divide, null for missing data or zero denominators) so it stays testable.
- The public demo ingestion route accepts only the canonical demo.v2 synthetic fixture before a privileged upsert, keeping arbitrary and real-source data out of this integration path.

## Generated source feeds
- The synthetic source bundle lives in `src/lib/sources/generate.ts` as one self-contained plain-JS function, because its source text is embedded into `workflows/neptun-all-sources-demo.json` by `scripts/build-sources-workflow.ts`; regenerate the workflow after changing generator or readers.
- Mapped source records go to `public.source_records` (separate from `campaign_performance`) via `/api/public/demo-sources-ingest`, which accepts only exact canonical generated samples before any privileged upsert.
- Master report math lives in `src/lib/sources/report.ts`: period records are included only when fully inside the selection (never prorated), non-additive reach is never summed, and summary/breakdown rows are never added to their detail rows.
- AI management reports accept only validated dashboard filters; server-side read-only queries build evidence through existing metric/report math, and Responses streams generate a five-slide draft without changing ads or data. This keeps confidential inputs and invented cross-source totals out of the public demo.
- AI provider denials persist in server-only `ai_report_access_state`; only verified restored access plus an explicit owner request may clear it, preventing blocked paid calls across reloads.

- Scope dashboard visual tokens and surface treatments to `.dashboard-skin` and `.management-dialog`; use the Button analytics variant for AI actions so dashboard refreshes do not restyle pitch slides.

- Dashboard panels share a hydration-safe collapse context with locally persisted per-panel overrides and global collapse/expand defaults, so filters remain reachable and new panels inherit the global choice.
