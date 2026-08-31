#!/usr/bin/env node
/**
 * Export the LangGraph thread store to a local file, before it is retired.
 *
 * WHY THIS EXISTS
 * The threads held in the LangGraph deployment are the only record of what
 * people actually ask the assistant. They are readable today only through
 * /admin/threads, which reads that deployment directly — so when the chat moves
 * in-repo and the deployment is decommissioned, the questions go with it.
 *
 * They are the evidence that decides the rebuild. ~1.2 messages per chatter is
 * equally consistent with "the answer was wrong", "the answer was fine and I
 * left", and "I never understood what this was for", and only the first is
 * fixed by better tooling. Classify the real questions before committing to it.
 *
 * PRIVACY — read before running
 * The output contains what real people typed. It is user data, so:
 *   - the default destination is OUTSIDE the repo, and
 *   - it must NEVER be committed, pasted into an issue, or put in a fixture.
 * `CLAUDE.md` is explicit that no real user data enters this public repo, not
 * even in a comment. Use obviously fake values if you need a test fixture.
 *
 * Usage (reads the same credentials the server proxy uses):
 *   NUXT_LANGGRAPH_API_URL=... NUXT_LANGSMITH_API_KEY=... \
 *     node scripts/harvest-chat-threads.mjs [outfile]
 *
 * Writes newline-delimited JSON, one thread per line.
 */
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const apiUrl = process.env.NUXT_LANGGRAPH_API_URL;
const apiKey = process.env.NUXT_LANGSMITH_API_KEY;

if (!apiUrl || !apiKey) {
  console.error('Set NUXT_LANGGRAPH_API_URL and NUXT_LANGSMITH_API_KEY (both are in the project .env).');
  process.exit(1);
}

const outfile = process.argv[2] || join(tmpdir(), `cmdiy-chat-threads-${Date.now()}.jsonl`);
const PAGE = 100;

async function searchThreads(offset) {
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/threads/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ limit: PAGE, offset }),
  });
  if (!response.ok) {
    throw new Error(`threads/search ${response.status} ${response.statusText}: ${await response.text()}`);
  }
  return response.json();
}

const all = [];
for (let offset = 0; ; offset += PAGE) {
  const page = await searchThreads(offset);
  if (!Array.isArray(page) || page.length === 0) break;
  all.push(...page);
  console.error(`fetched ${all.length} threads...`);
  if (page.length < PAGE) break;
}

writeFileSync(outfile, all.map((t) => JSON.stringify(t)).join('\n') + '\n', 'utf8');

// Summary only — never print message content to a terminal that may be logged.
const withMessages = all.filter((t) => Array.isArray(t?.values?.messages) && t.values.messages.length > 0);
const humanTurns = withMessages.reduce(
  (sum, t) => sum + t.values.messages.filter((m) => m?.type === 'human').length,
  0
);
const toolNames = new Set();
for (const thread of withMessages) {
  for (const message of thread.values.messages) {
    if (message?.type === 'tool' && message.name) toolNames.add(message.name);
    for (const call of message?.tool_calls ?? []) if (call?.name) toolNames.add(call.name);
  }
}

console.error(`\nthreads:            ${all.length}`);
console.error(`with messages:      ${withMessages.length}`);
console.error(`human turns:        ${humanTurns}`);
console.error(`tools ever called:  ${toolNames.size ? [...toolNames].sort().join(', ') : '(none)'}`);
console.error(`\nwritten to ${outfile}`);
console.error('This file contains real user questions. Do not commit it.');
