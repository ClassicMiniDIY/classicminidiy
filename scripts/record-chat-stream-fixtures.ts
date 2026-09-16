/**
 * Record the `/api/chat` stream fixtures under `tests/fixtures/chat-stream/`.
 *
 *   bun run scripts/record-chat-stream-fixtures.ts
 *
 * The scenarios and the rendering pipeline live in
 * `tests/fixtures/chat-stream/scenarios.ts`, so the unit test can regenerate
 * the same bytes and compare them to what is committed. This script only
 * writes files. Re-run it after an `ai` upgrade, read the diff, and copy the
 * directory verbatim into both native app repos' test resources.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  quota429Body,
  renderScenarioExpected,
  renderScenarioSse,
  scenarios,
} from '../tests/fixtures/chat-stream/scenarios';

const OUT_DIR = join(fileURLToPath(new URL('../', import.meta.url)), 'tests/fixtures/chat-stream');

mkdirSync(OUT_DIR, { recursive: true });
for (const scenario of scenarios) {
  const raw = await renderScenarioSse(scenario);
  const expected = await renderScenarioExpected(scenario);
  writeFileSync(join(OUT_DIR, `${scenario.name}.sse`), raw);
  writeFileSync(join(OUT_DIR, `${scenario.name}.expected.json`), JSON.stringify(expected, null, 2) + '\n');
  console.log(`recorded ${scenario.name}: ${raw.length} bytes, ${expected.parts.length} parts`);
}
writeFileSync(join(OUT_DIR, 'quota-429.json'), JSON.stringify(quota429Body, null, 2) + '\n');
console.log('recorded quota-429.json');
