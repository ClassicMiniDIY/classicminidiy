// @vitest-environment node
/**
 * The supplier directory's data and its page have to agree.
 *
 * `data/suppliers.json` is hand-curated and `/archive/suppliers` renders every
 * one of its fields through `t()`. That is a join between a data file and a
 * translation block, and nothing in the build checks a join like that: a
 * supplier from a country the page has no label for renders the raw key
 * `country.XX` on the card, in all ten languages, with no warning. `i18n.config.ts`
 * sets `missingWarn: false`, so the page does not even complain in dev.
 *
 * The i18n suite already holds the block to key parity ACROSS locales. This one
 * holds the DATA to the block, which is the direction that breaks when somebody
 * adds a shop from a thirteenth country.
 *
 * The rest is the promise the page makes to the reader in its own words — "each
 * one was checked by hand" — expressed as things that must stay true.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import suppliers from '../../data/suppliers.json';
import provenance from '../../data/suppliers-provenance.json';
import { SUPPLIER_FILTER_TAGS, SUPPLIER_GROUP_ORDER, flagFor, type Supplier } from '../../data/models/suppliers';
import { REPO_ROOT, parseVue } from './_scan';

const rows = suppliers as Supplier[];

/** The page's own `<i18n>` block, which is where every label actually lives. */
function pageMessages(): Record<string, Record<string, unknown>> {
  const file = join(REPO_ROOT, 'app/pages/archive/suppliers.vue');
  const sfc = parseVue(file);
  // `parseVue` returns i18n as an ARRAY — a file may carry several blocks. This
  // page has one, and asserting that is part of the check: a second block would
  // silently shadow half the labels.
  expect(sfc.i18n.length, 'the suppliers page must carry exactly one <i18n> block').toBe(1);
  return JSON.parse(sfc.i18n[0]!.content) as Record<string, Record<string, unknown>>;
}

describe('supplier directory data', () => {
  it('has entries, and every id is unique', () => {
    expect(rows.length).toBeGreaterThan(0);
    const ids = rows.map((s) => s.id);
    expect(new Set(ids).size, 'duplicate supplier id').toBe(ids.length);
  });

  it('lists each shop once', () => {
    // Two entries for one shop is the commonest way a curated list rots: the
    // same business added again under a different trading name.
    const hosts = rows.map((s) => new URL(s.url).host.replace(/^www\./, ''));
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const [i, host] of hosts.entries()) {
      const first = seen.get(host);
      if (first) duplicates.push(`${host}: ${first} and ${rows[i]!.id}`);
      else seen.set(host, rows[i]!.id);
    }
    expect(duplicates, duplicates.join('\n')).toEqual([]);
  });

  it('uses only the declared groups and tags', () => {
    const groups = new Set<string>(SUPPLIER_GROUP_ORDER);
    const tags = new Set<string>([...SUPPLIER_FILTER_TAGS, 'tools', 'archive']);
    for (const s of rows) {
      expect(groups.has(s.group), `${s.id} has group ${s.group}`).toBe(true);
      expect(s.tags.length, `${s.id} has no tags`).toBeGreaterThan(0);
      for (const tag of s.tags) expect(tags.has(tag), `${s.id} has tag ${tag}`).toBe(true);
    }
  });

  it('describes each shop in one short neutral line', () => {
    for (const s of rows) {
      expect(s.speciality.length, `${s.id} has no speciality`).toBeGreaterThan(10);
      // The card is a fixed-height grid cell. Long enough to overflow it is a
      // layout bug that only shows up on the one card nobody scrolled to.
      expect(s.speciality.length, `${s.id} speciality is too long`).toBeLessThanOrEqual(160);
    }
  });

  it('links somewhere real, over https, with one recorded exception', () => {
    // heritagegarage.com serves its catalogue over plain HTTP; its HTTPS
    // presents a certificate a browser will not accept. It is listed anyway
    // because dropping it would cut United States coverage, and the reason is
    // recorded in data/suppliers-provenance.json rather than left to be
    // rediscovered. Any OTHER http:// entry is a mistake, not a decision.
    const HTTP_ALLOWED = new Set(['heritage-garage']);
    for (const s of rows) {
      const url = new URL(s.url);
      expect(['http:', 'https:']).toContain(url.protocol);
      if (url.protocol === 'http:') {
        expect(HTTP_ALLOWED.has(s.id), `${s.id} links over plain http and is not a recorded exception`).toBe(true);
      }
      expect(url.host.length, `${s.id} has no host`).toBeGreaterThan(3);
    }
  });

  it('marks exactly one entry as ours', () => {
    const ours = rows.filter((s) => s.ours);
    expect(ours.map((s) => s.id)).toEqual(['classic-mini-diy']);
  });

  it('distinguishes "ships worldwide" from "did not say"', () => {
    // Null is not false. Rendering "did not say" as "does not ship
    // internationally" would tell a reader in Japan that a shop which ships
    // everywhere does not — the exact failure this page exists to fix.
    for (const s of rows) {
      expect([true, false, null], `${s.id} shipsInternationally`).toContain(s.shipsInternationally);
    }
  });
});

describe('supplier directory labels', () => {
  it('has a country label, in every locale, for every country in the data', () => {
    const messages = pageMessages();
    const countries = [...new Set(rows.map((s) => s.country))].sort();
    const missing: string[] = [];
    for (const [locale, bundle] of Object.entries(messages)) {
      const labels = (bundle.country ?? {}) as Record<string, string>;
      for (const code of countries) {
        if (!labels[code]) missing.push(`${locale}.country.${code}`);
      }
    }
    expect(missing, `add these keys to app/pages/archive/suppliers.vue:\n${missing.join('\n')}`).toEqual([]);
  });

  it('has a group and tag label, in every locale, for everything the page offers', () => {
    const messages = pageMessages();
    const missing: string[] = [];
    for (const [locale, bundle] of Object.entries(messages)) {
      const groups = (bundle.group ?? {}) as Record<string, string>;
      const tags = (bundle.tag ?? {}) as Record<string, string>;
      for (const g of SUPPLIER_GROUP_ORDER) if (!groups[g]) missing.push(`${locale}.group.${g}`);
      for (const t of SUPPLIER_FILTER_TAGS) if (!tags[t]) missing.push(`${locale}.tag.${t}`);
    }
    expect(missing, missing.join('\n')).toEqual([]);
  });

  it('carries no country label the data does not use', () => {
    // A stale label is not a rendering bug, but it is how a translation block
    // grows entries nobody can explain. Fails on the English block only; the
    // i18n suite holds the other nine to it.
    const labels = Object.keys((pageMessages().en!.country ?? {}) as Record<string, string>);
    const used = new Set(rows.map((s) => s.country));
    expect(labels.filter((code) => !used.has(code))).toEqual([]);
  });

  it('renders a flag for every country code in the data', () => {
    for (const s of rows) {
      expect(flagFor(s.country).length, `${s.id} country ${s.country}`).toBeGreaterThan(0);
    }
  });
});

describe('supplier directory provenance', () => {
  it('records a check for every listed shop', () => {
    // The page tells the reader every shop was checked by hand. This is what
    // stands behind that sentence.
    const checked = new Set((provenance.checked as Array<{ id: string }>).map((c) => c.id));
    const unchecked = rows.filter((s) => !checked.has(s.id)).map((s) => s.id);
    expect(unchecked, `listed without a recorded check: ${unchecked.join(', ')}`).toEqual([]);
  });

  it('keeps the rejected candidates, so nobody researches them twice', () => {
    const rejected = provenance.rejected as Array<{ name: string; reason: string }>;
    expect(rejected.length).toBeGreaterThan(0);
    for (const r of rejected) expect(r.reason.length, `${r.name} has no reason`).toBeGreaterThan(10);
  });

  it('never lists a shop it also rejected', () => {
    const listedHosts = new Set(rows.map((s) => new URL(s.url).host.replace(/^www\./, '')));
    const clashes: string[] = [];
    for (const r of provenance.rejected as Array<{ name: string; tried: string }>) {
      try {
        const host = new URL(r.tried).host.replace(/^www\./, '');
        if (listedHosts.has(host)) clashes.push(`${r.name} (${host})`);
      } catch {
        /* a rejection may record a bare name rather than a URL */
      }
    }
    expect(clashes, clashes.join('\n')).toEqual([]);
  });

  it('is dated, so a stale directory can be spotted', () => {
    expect(provenance.verified_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('the directory is reachable', () => {
  it('is listed on /archive, the only place archive sections are discoverable', () => {
    // The header link is flat: there is no archive dropdown and no subnav, so a
    // section missing from ArchiveItems is a section nobody can navigate to.
    // That is exactly what happened to /archive/parts when it shipped.
    const generic = readFileSync(join(REPO_ROOT, 'data/models/generic.ts'), 'utf8');
    expect(generic).toContain("to: '/archive/suppliers'");
  });
});
