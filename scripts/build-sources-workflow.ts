// Regenerates workflows/neptun-all-sources-demo.json from the canonical generator. Run: bun scripts/build-sources-workflow.ts
import { writeFileSync } from "node:fs";
import { generateSourceBundle, generatorSource } from "../src/lib/sources/bundle";
import { readBundle } from "../src/lib/sources/readers";
import { DEMO_CHANNELS, ledgerRows, ledgerTotals } from "../src/lib/sources/demo-ledger";
import { summarizeRecords } from "../src/lib/sources/ingest";

const ENDPOINT = "https://neptun-marketing-demo.lovable.app/api/public/demo-sources-ingest";
const records = readBundle(generateSourceBundle());
const expected = summarizeRecords(records);
const expectedChannels = Object.fromEntries(DEMO_CHANNELS.map(c=>[c,ledgerTotals(ledgerRows(records).filter(r=>r.channel===c))]));
const GEN = "Code: Generate synthetic source bundle";
const FIRST = "HTTP Request: Import (first run)";

const http = (id: string, name: string, x: number) => ({
  id, name, type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [x, 0],
  parameters: { method: "POST", url: ENDPOINT, sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] }, sendBody: true, specifyBody: "json", jsonBody: `={{ JSON.stringify($('${GEN}').first().json) }}`, options: {} },
});

const verify = `const first = $('${FIRST}').first().json;
const second = $json;
const expectedCount = ${records.length};
const expected = ${JSON.stringify(expected)};
const expectedChannels = ${JSON.stringify(expectedChannels)};
const failures = [];
for (const [label, r] of [['first', first], ['second', second]]) {
  if (r.synthetic !== true) failures.push(label + ': synthetic flag is not true');
  if (r.schema_version !== 'sources.v2') failures.push(label + ': schema version is not sources.v2');
  if (r.imported_record_count !== expectedCount) failures.push(label + ': imported ' + r.imported_record_count + ' records, expected ' + expectedCount);
  if (r.total_source_record_count !== expectedCount) failures.push(label + ': stored ' + r.total_source_record_count + ' records, expected ' + expectedCount);
  if (!r.imported_at || !Number.isFinite(Date.parse(r.imported_at))) failures.push(label + ': import timestamp missing');
  for (const [channel, exp] of Object.entries(expectedChannels)) {
    const got=r.channel_totals && r.channel_totals[channel];
    if(!got || ['spend','impressions','sessions','purchases','revenue'].some(k=>got[k]!==exp[k])) failures.push(label + ': '+channel+' daily ledger totals differ');
  }
  for (const [src, exp] of Object.entries(expected)) {
    const got = r.stored && r.stored[src];
    if (!got || got.records !== exp.records) { failures.push(label + ': ' + src + ' record count differs'); continue; }
    for (const [k, v] of Object.entries(exp.totals)) if (got.totals[k] !== v) failures.push(label + ': ' + src + ' ' + k + ' total is ' + got.totals[k] + ', expected ' + v);
  }
}
if (JSON.stringify(first.stored) !== JSON.stringify(second.stored)) failures.push('second import changed stored totals (not idempotent)');
if (failures.length) throw new Error('Neptun all-sources demo verification failed: ' + failures.join('; '));
return [{ json: { success: true, message: 'All 10 generated demo sources imported twice: ' + expectedCount + ' records, totals unchanged (idempotent).', record_count: expectedCount, first_imported_at: first.imported_at, second_imported_at: second.imported_at, stored: second.stored } }];`;

const wf = {
  name: "Neptun All Sources Demo",
  nodes: [
    { id: "20000000-0000-4000-8000-000000000001", name: "Manual Trigger", type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-700, 0], parameters: {} },
    { id: "20000000-0000-4000-8000-000000000002", name: GEN, type: "n8n-nodes-base.code", typeVersion: 2, position: [-440, 0],
      parameters: { jsCode: `// Wholly synthetic generated samples for 10 source bundles (including the complete channel/Stores simulation). Reads no files, accounts or databases.\nconst generateSourceBundle = ${generatorSource()};\nconst bundle = generateSourceBundle();\nif (bundle.metadata.synthetic !== true || Object.keys(bundle.sources).length !== 10) throw new Error('Generator did not produce the synthetic 10-source bundle');\nreturn [{ json: { metadata: bundle.metadata, sources: bundle.sources } }];` } },
    http("20000000-0000-4000-8000-000000000003", FIRST, -160),
    http("20000000-0000-4000-8000-000000000004", "HTTP Request: Import again (idempotency)", 120),
    { id: "20000000-0000-4000-8000-000000000005", name: "Code: Verify counts, totals and idempotency", type: "n8n-nodes-base.code", typeVersion: 2, position: [400, 0], parameters: { jsCode: verify } },
  ],
  pinData: {},
  connections: {
    "Manual Trigger": { main: [[{ node: GEN, type: "main", index: 0 }]] },
    [GEN]: { main: [[{ node: FIRST, type: "main", index: 0 }]] },
    [FIRST]: { main: [[{ node: "HTTP Request: Import again (idempotency)", type: "main", index: 0 }]] },
    "HTTP Request: Import again (idempotency)": { main: [[{ node: "Code: Verify counts, totals and idempotency", type: "main", index: 0 }]] },
  },
  active: false,
  settings: { executionOrder: "v1", timezone: "Europe/Skopje", saveManualExecutions: true },
  versionId: "20000000-0000-4000-8000-0000000000aa",
  meta: { templateCredsSetupCompleted: true },
  tags: [],
};
writeFileSync(new URL("../workflows/neptun-all-sources-demo.json", import.meta.url), JSON.stringify(wf, null, 2) + "\n");
console.log("records", records.length);
