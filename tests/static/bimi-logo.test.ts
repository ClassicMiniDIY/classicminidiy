// @vitest-environment node
/**
 * `public/bimi/classicminidiy.svg` is the logo that BIMI records point at
 * (`default._bimi.<domain>`, published by scripts/fix-mail-dns.py). Receivers
 * accept only the SVG Tiny Portable/Secure profile and reject anything else
 * without saying why, so the mail simply shows no logo.
 *
 * On 2026-10-01 an optimiser rewrote this file between writing and commit and
 * stripped `version`, `baseProfile` and `<title>`. A generic SVG optimiser
 * will do that again, so the profile is pinned here.
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './_scan';

const FILE = join(REPO_ROOT, 'public/bimi/classicminidiy.svg');

describe('BIMI logo is SVG Tiny PS', () => {
  const svg = readFileSync(FILE, 'utf8');
  const root = svg.match(/<svg\b[^>]*>/)?.[0] ?? '';

  it('declares the Tiny PS profile on the root, with a viewBox and no x/y', () => {
    expect(root).toMatch(/\sversion="1\.2"/);
    expect(root).toMatch(/\sbaseProfile="tiny-ps"/);
    expect(root).toMatch(/\sviewBox="0 0 (\d+) \1"/); // square
    expect(root).not.toMatch(/\s(x|y)="/);
  });

  it('has a non-empty title', () => {
    expect(svg).toMatch(/<title>[^<]+<\/title>/);
  });

  it('has no scripts, raster images, external references or animation', () => {
    expect(svg).not.toMatch(/<(script|image|foreignObject|use|animate\w*|set)\b/i);
    expect(svg).not.toMatch(/(xlink:)?href=/);
    expect(svg).not.toMatch(/\son\w+=/i);
  });

  it('uses no arc commands, which SVG Tiny 1.2 lacks', () => {
    const paths = [...svg.matchAll(/\sd="([^"]*)"/g)].map((m) => m[1]);
    expect(paths.length).toBeGreaterThan(0);
    for (const d of paths) expect(d).not.toMatch(/[aA]/);
  });

  it('is under 32 KB', () => {
    expect(statSync(FILE).size).toBeLessThan(32 * 1024);
  });
});
