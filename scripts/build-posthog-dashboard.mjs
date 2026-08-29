#!/usr/bin/env node
/**
 * Build (or rebuild) the "Developer API (MCP)" dashboard in PostHog.
 *
 *   node scripts/build-posthog-dashboard.mjs
 *
 * Idempotent: a dashboard of that name is REUSED and its existing insights are
 * soft-deleted first, so re-running after editing the insight list converges
 * rather than accumulating duplicates or half-built tiles.
 *
 * Auth: reads POSTHOG_PERSONAL_API_KEY from .env (scopes project:read,
 * dashboard:write, insight:write). That is a PERSONAL key and is deliberately
 * NOT one of the deploy secrets — nothing in the running site needs it, this is
 * an operator tool. The project is discovered by name, so no project id is
 * hardcoded here.
 *
 * Why a script rather than clicking it together in the PostHog UI: the tiles
 * encode decisions made in the code they measure — which events exist, that
 * free-tier calls are 10% sampled while gated attempts are not, and that
 * internal/CI traffic is excluded at source (server/utils/mcpUsage.ts). When
 * those change, this file changes with them in the same commit, and the
 * dashboard is one command away from matching again.
 *
 * Reading the result — the two traps:
 *   1. mcp_tool_called is SAMPLED at 10% for the free tier (developer tier is
 *      unsampled). Weight by 1/sample_rate, which every event carries.
 *      mcp_tool_gated is unsampled at every tier.
 *   2. PostHog is directional. The authoritative per-call record is
 *      mcp_usage_daily in Supabase — use it for billing, support and abuse
 *      questions. Cached responses on the two cached tools are not counted
 *      there (see server/mcp/README.md); rate limiting is unaffected.
 */
import fs from 'node:fs';

const env = Object.fromEntries(
  fs
    .readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [
      l.slice(0, l.indexOf('=')).trim(),
      l
        .slice(l.indexOf('=') + 1)
        .trim()
        .replace(/^["']|["']$/g, ''),
    ])
);

const KEY = env.POSTHOG_PERSONAL_API_KEY;
const HOST = env.POSTHOG_API_HOST || 'https://us.posthog.com';
if (!KEY) {
  console.error('POSTHOG_PERSONAL_API_KEY not found in .env.');
  console.error('Create one at PostHog > Settings > Personal API keys with');
  console.error('scopes: project:read, dashboard:write, insight:write.');
  process.exit(1);
}

const DASHBOARD_NAME = 'Developer API (MCP)';

async function api(path, opts = {}) {
  const res = await fetch(`${HOST}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

const projects = await api('/api/organizations/@current/projects/');
const project = projects.results.find((p) => /classic|cmdiy|mini/i.test(p.name)) || projects.results[0];
if (!project) throw new Error('no PostHog project visible to this key');
console.log(`project: ${project.name} (id ${project.id})`);
const P = `/api/projects/${project.id}`;

const existing = await api(`${P}/dashboards/?limit=100`);
let dash = (existing.results || []).find((d) => d.name === DASHBOARD_NAME && !d.deleted);
if (dash) {
  // The LIST endpoint omits `tiles`; only the detail endpoint carries them.
  // Without this re-fetch the clear-then-recreate below silently clears
  // nothing and every re-run doubles the dashboard.
  dash = await api(`${P}/dashboards/${dash.id}/`);
  console.log(`reusing dashboard id ${dash.id} (clearing ${(dash.tiles || []).length} existing tiles)`);
  for (const tile of dash.tiles || []) {
    if (tile.insight?.id) {
      await api(`${P}/insights/${tile.insight.id}/`, { method: 'PATCH', body: JSON.stringify({ deleted: true }) });
    }
  }
} else {
  dash = await api(`${P}/dashboards/`, {
    method: 'POST',
    body: JSON.stringify({
      name: DASHBOARD_NAME,
      description:
        'Paid MCP usage: what gets called, by which tier, and what free users are hitting the paywall on. ' +
        'Free-tier mcp_tool_called is 10% sampled — weight by 1/sample_rate. Exact per-call counts live in ' +
        'mcp_usage_daily (Supabase). Built by scripts/build-posthog-dashboard.mjs.',
    }),
  });
  console.log(`dashboard created: id ${dash.id}`);
}

// `display` belongs inside trendsFilter, not on TrendsQuery — the query schema
// rejects it at the root with a 400 parse_error.
const trends = (series, extra = {}) => ({
  kind: 'InsightVizNode',
  source: { kind: 'TrendsQuery', series, dateRange: { date_from: '-30d' }, interval: 'day', ...extra },
});
const ev = (event, math = 'total') => ({ kind: 'EventsNode', event, math });
const breakdown = (prop) => ({ breakdownFilter: { breakdown: prop, breakdown_type: 'event' } });

const insights = [
  {
    name: 'Tool calls by tool',
    description: 'Which tools earn their keep. Free-tier events are 10% sampled.',
    query: trends([ev('mcp_tool_called')], { ...breakdown('tool'), trendsFilter: { display: 'ActionsBar' } }),
  },
  {
    name: 'Tool calls by tier',
    description: 'free vs developer traffic mix. Internal/CI traffic is excluded at source.',
    query: trends([ev('mcp_tool_called')], { ...breakdown('tier'), trendsFilter: { display: 'ActionsAreaGraph' } }),
  },
  {
    name: 'Daily call volume',
    description: 'Overall MCP call trend. A cliff means something broke.',
    query: trends([ev('mcp_tool_called')], { trendsFilter: { display: 'ActionsLineGraph' } }),
  },
  {
    name: 'Active API users per day',
    description: 'Distinct accounts making MCP calls (distinct_id is the user id). Adoption, not volume.',
    query: trends([ev('mcp_tool_called', 'dau')], { trendsFilter: { display: 'ActionsLineGraph' } }),
  },
  {
    name: 'Paywall hits by tool (upgrade demand)',
    description:
      'Free keys calling paid tools. Unsampled at every tier, so this is the most trustworthy tile here — ' +
      'and the clearest statement of what people would pay for.',
    query: trends([ev('mcp_tool_gated')], { ...breakdown('tool'), trendsFilter: { display: 'ActionsBar' } }),
  },
  {
    name: 'Paywall → checkout funnel',
    description: 'Hit the paywall, started checkout, subscribed. Where the money leaks.',
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'FunnelsQuery',
        series: [ev('mcp_tool_gated'), ev('developer_checkout_started'), ev('developer_checkout_succeeded')],
        dateRange: { date_from: '-90d' },
      },
    },
  },
];

for (const insight of insights) {
  const created = await api(`${P}/insights/`, {
    method: 'POST',
    body: JSON.stringify({ ...insight, dashboards: [dash.id], saved: true }),
  });
  console.log(`  + ${created.name}`);
}

console.log(`\nDone: ${HOST}/project/${project.id}/dashboard/${dash.id}`);
