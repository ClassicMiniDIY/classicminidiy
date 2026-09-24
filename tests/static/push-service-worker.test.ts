// @vitest-environment node
/**
 * The site's service worker is push-only. Until 2026-09-23 `nuxt.config.ts`
 * set `pwa.selfDestroying: true` and loaded no register plugin, so no browser
 * had a worker and Web Push had nothing to deliver to, while the notifications
 * page still let users turn it "on". The worker (`service-worker/sw.ts`) now
 * handles push and nothing else; it has no fetch handler, so it cannot bring
 * back the 2024 caching problems. Rules: .claude/rules/push-notifications.md.
 *
 * Behaviour is tested in tests/unit/service-worker/sw.test.ts. This file pins
 * the config and source shape that the behaviour depends on.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './_scan';

const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), 'utf8');
// Strip comments so a note that names a forbidden option does not trip the check.
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('push service worker contract', () => {
  const config = code(read('nuxt.config.ts'));
  const sw = code(read('service-worker/sw.ts'));

  it('nuxt.config builds the push worker, not a self-destroying or Workbox one', () => {
    expect(config).not.toMatch(/selfDestroying\s*:\s*true/);
    expect(config).toMatch(/strategies:\s*'injectManifest'/);
    expect(config).toMatch(/filename:\s*'sw\.ts'/);
    expect(config).toMatch(/injectionPoint:\s*undefined/);
    expect(config).not.toMatch(/runtimeCaching\s*:/);
  });

  it('nothing registers the worker on page load', () => {
    expect(config).toMatch(/injectRegister:\s*false/);
    expect(config).toMatch(/registerPlugin:\s*false/);
  });

  it('the worker has no fetch handler and does not claim clients', () => {
    expect(sw).not.toMatch(/addEventListener\(\s*['"]fetch['"]/);
    expect(sw).not.toMatch(/\bonfetch\b/);
    expect(sw).not.toMatch(/clients\.claim\(/);
    expect(sw).toMatch(/addEventListener\(\s*'push'/);
    expect(sw).toMatch(/addEventListener\(\s*'notificationclick'/);
  });
});
