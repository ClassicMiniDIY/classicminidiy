#!/usr/bin/env node
/**
 * Fetch a logo and a cover image for every shop in data/suppliers.json.
 *
 *   bun scripts/fetch-supplier-assets.mjs            # every shop without assets
 *   bun scripts/fetch-supplier-assets.mjs --all      # refetch everything
 *   bun scripts/fetch-supplier-assets.mjs mini-spares kad   # named ids only
 *
 * WHAT IT READS, per shop, from the homepage that the directory verified:
 *
 *   cover  — `og:image` (then `twitter:image`). The image a shop chose to
 *            represent itself when its link is shared; the closest thing to a
 *            sanctioned backdrop. Refused when it is tiny (an icon posted as the
 *            share image) or when it is the logo again.
 *   logo   — in order: JSON-LD Organization / WebSite `logo`; the first
 *            `<img>` in the header whose src, alt or class says "logo";
 *            `apple-touch-icon` (the 180 px one); the largest `rel=icon`.
 *
 * WHAT IT WRITES: `public/suppliers/<id>-logo.webp` (≤ 320 px, alpha kept),
 * `public/suppliers/<id>-cover.webp` (1200 px wide, quality 72), and
 * `data/suppliers-assets.json` — one row per shop, the two paths only, which
 * the page imports — and `data/suppliers-assets-provenance.json`, where each
 * came from and when. A shop with no row, or a null, renders its fallback
 * (initials on a brand gradient) and nothing breaks.
 *
 * Every image is fetched with the archive's named user agent, one shop at a
 * time, two requests each at most beyond the homepage. Nothing here is a crawl.
 *
 * A shop whose fetch fails is REPORTED and left alone: the previous row stays,
 * so a transient outage never removes an image that was there yesterday.
 */

import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'suppliers');
const DATA = join(ROOT, 'data', 'suppliers.json');
const ASSETS = join(ROOT, 'data', 'suppliers-assets.json');
// Where each image came from, and when. Kept OUT of suppliers-assets.json
// because the page imports that file and Vite ships a default JSON import
// whole: sixty-odd third-party URLs would ride in the client bundle to read
// two paths per shop.
const PROVENANCE = join(ROOT, 'data', 'suppliers-assets-provenance.json');
const OVERRIDES = join(ROOT, 'data', 'suppliers-assets.overrides.json');

const UA = 'ClassicMiniDIY-archive/1.0 (+https://www.classicminidiy.com; classicminidiy@gmail.com)';
const TIMEOUT_MS = 25_000;
const MAX_BYTES = 12 * 1024 * 1024;

const argv = process.argv.slice(2);
const all = argv.includes('--all');
const only = new Set(argv.filter((a) => !a.startsWith('--')));

const suppliers = JSON.parse(await readFile(DATA, 'utf8'));
let assets = {};
let provenance = {};
try {
  assets = JSON.parse(await readFile(ASSETS, 'utf8'));
  provenance = JSON.parse(await readFile(PROVENANCE, 'utf8'));
} catch {
  /* first run */
}
let overrides = {};
try {
  overrides = JSON.parse(await readFile(OVERRIDES, 'utf8'));
} catch {
  /* none */
}
await mkdir(OUT_DIR, { recursive: true });

/** An override URL, or a local file under public/, as bytes. */
async function getOverride(value) {
  if (!value) return null;
  if (value.startsWith('/')) {
    try {
      return { body: await readFile(join(ROOT, 'public', value)), url: value };
    } catch {
      return null;
    }
  }
  return get(value, 'bytes');
}

/** GET with the archive UA; text for pages, bytes for images. Null on any failure. */
async function get(url, as = 'text') {
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': UA,
        accept:
          as === 'text'
            ? 'text/html,*/*;q=0.8'
            : 'image/webp,image/png,image/jpeg,image/svg+xml,image/*;q=0.8,*/*;q=0.5',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    if (as === 'text') return { body: await res.text(), url: res.url };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;
    return { body: buf, url: res.url, type: (res.headers.get('content-type') ?? '').split(';')[0].trim() };
  } catch {
    return null;
  }
}

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[2] ?? m[3] ?? m[4] ?? '').trim() : null;
};
const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"');

function metaContent(html, prop) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = attr(tag, 'property') ?? attr(tag, 'name');
    if (key && key.toLowerCase() === prop) {
      const c = attr(tag, 'content');
      if (c) return decode(c);
    }
  }
  return null;
}

function jsonLdLogo(html) {
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed;
    try {
      parsed = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const nodes = [];
    const walk = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) return n.forEach(walk);
      nodes.push(n);
      for (const v of Object.values(n)) if (v && typeof v === 'object') walk(v);
    };
    walk(parsed);
    for (const n of nodes) {
      const t = String(n['@type'] ?? '');
      if (!/Organization|WebSite|Store|LocalBusiness/i.test(t)) continue;
      const logo = n.logo;
      const url =
        typeof logo === 'string' ? logo : logo && typeof logo === 'object' ? (logo.url ?? logo.contentUrl) : null;
      if (typeof url === 'string' && url) return url;
    }
  }
  return null;
}

function headerLogoImg(html) {
  // The header first; the whole page only if there is no header element.
  const header = html.match(/<header\b[\s\S]*?<\/header>/i)?.[0] ?? html.match(/<nav\b[\s\S]*?<\/nav>/i)?.[0] ?? html;
  const scopes = header === html ? [html] : [header, html];
  for (const scope of scopes) {
    for (const tag of scope.match(/<img\b[^>]*>/gi) ?? []) {
      const src = attr(tag, 'data-src') ?? attr(tag, 'src') ?? attr(tag, 'data-lazy-src');
      if (!src || src.startsWith('data:')) continue;
      const hay = `${src} ${attr(tag, 'alt') ?? ''} ${attr(tag, 'class') ?? ''} ${attr(tag, 'id') ?? ''}`.toLowerCase();
      if (
        /\blogo\b|_logo|-logo|logo[-_.]/.test(hay) &&
        !/payment|paypal|visa|mastercard|trustpilot|klarna|stripe|footer/.test(hay)
      )
        return decode(src);
    }
  }
  return null;
}

/**
 * Hero candidates, for a shop whose share image is its logo or missing: the
 * `<img>`s (and CSS `background-image`s) whose src or class says hero, banner,
 * slide or carousel, in page order. At most three are fetched; the first that
 * is wide enough and landscape wins.
 */
function heroCandidates(html) {
  const out = [];
  const push = (src) => {
    if (src && !src.startsWith('data:') && !out.includes(src)) out.push(decode(src));
  };
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const src = attr(tag, 'data-src') ?? attr(tag, 'src') ?? attr(tag, 'data-lazy-src');
    const srcset = attr(tag, 'data-srcset') ?? attr(tag, 'srcset');
    const hay =
      `${src ?? ''} ${attr(tag, 'alt') ?? ''} ${attr(tag, 'class') ?? ''} ${attr(tag, 'id') ?? ''}`.toLowerCase();
    if (!/hero|banner|slide|carousel|slider|header-image|home-image|jumbotron|masthead/.test(hay)) continue;
    if (/logo|icon|badge|payment/.test(hay)) continue;
    // The widest entry of a srcset beats the src.
    const widest = srcset
      ? srcset
          .split(',')
          .map((e) => e.trim().split(/\s+/))
          .sort((a, b) => parseInt(b[1] ?? '0') - parseInt(a[1] ?? '0'))[0]?.[0]
      : null;
    push(widest ?? src);
  }
  for (const m of html.matchAll(/background(?:-image)?\s*:\s*url\((['"]?)([^'")]+)\1\)/gi)) {
    if (/logo|icon|sprite|pattern|texture/i.test(m[2])) continue;
    push(m[2]);
  }
  return out.slice(0, 3);
}

function linkIcons(html) {
  const out = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (attr(tag, 'rel') ?? '').toLowerCase();
    const href = attr(tag, 'href');
    if (!href) continue;
    const sizes = attr(tag, 'sizes') ?? '';
    const size = Number(sizes.match(/(\d+)x/)?.[1] ?? (rel.includes('apple-touch') ? 180 : 0));
    if (rel.includes('apple-touch-icon')) out.push({ href: decode(href), size, kind: 'apple-touch-icon' });
    else if (/\bicon\b/.test(rel) && !/mask/.test(rel)) out.push({ href: decode(href), size, kind: 'icon' });
  }
  return out.sort((a, b) => b.size - a.size);
}

const abs = (href, base) => {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
};

/** Decode any image (svg included) to a sharp instance, or null if it is not one. */
async function decodeImage(bytes) {
  try {
    const img = sharp(bytes, { animated: false });
    const meta = await img.metadata();
    if (!meta.width || !meta.height) return null;
    return { img, meta };
  } catch {
    return null;
  }
}

async function saveLogo(bytes, file) {
  const d = await decodeImage(bytes);
  if (!d) return null;
  // Wordmarks are wide and short (Woolies 247×36, Moke Panels 310×39).
  if (d.meta.width < 48 || d.meta.height < 24) return null;
  await d.img
    .resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85, alphaQuality: 90 })
    .toFile(file);
  return { width: d.meta.width, height: d.meta.height };
}

async function saveCover(bytes, file) {
  const d = await decodeImage(bytes);
  if (!d) return null;
  // A share image narrower than 600 px, squarer than 4:3 or thinner than 5:1
  // is an icon, a logo posted as og:image, or a promo strip, not a backdrop.
  const ratio = d.meta.width / d.meta.height;
  if (d.meta.width < 600 || d.meta.height < 200 || ratio < 1.3 || ratio > 5) return null;
  // A logo on a flat ground has low entropy (MED, Minilite, Minimine: 3.1-4.0);
  // a photograph has 6-8. Calibrated on the first pass over the directory.
  const stats = await d.img.clone().stats();
  if (stats.entropy < 4.5) return null;
  await d.img.resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 72 }).toFile(file);
  return { width: d.meta.width, height: d.meta.height };
}

const today = new Date().toISOString().slice(0, 10);
const report = [];

for (const s of suppliers) {
  if (only.size > 0 && !only.has(s.id)) continue;
  const have = assets[s.id];
  if (!all && only.size === 0 && have && have.logo && have.cover) continue;

  const page = await get(s.url);
  if (!page) {
    report.push(`${s.id}: homepage unreachable, row left as it was`);
    continue;
  }
  const base = page.url;
  const html = page.body;
  const row = { logo: have?.logo ?? null, cover: have?.cover ?? null };
  const prov = { fetched_at: today, logo_source: null, cover_source: null };

  // ---- logo ----
  const candidates = [];
  const ov = overrides[s.id] ?? {};
  // An override of null means "we looked; the site has no logo image" — fall
  // straight to the card's initials rather than to a favicon.
  if ('logo' in ov && ov.logo === null) candidates.length = 0;
  else if (ov.logo) candidates.push({ url: ov.logo, source: 'override' });
  const ld = jsonLdLogo(html);
  if (ld) candidates.push({ url: abs(ld, base), source: 'json-ld' });
  const hdr = headerLogoImg(html);
  if (hdr) candidates.push({ url: abs(hdr, base), source: 'header-img' });
  for (const icon of linkIcons(html)) candidates.push({ url: abs(icon.href, base), source: icon.kind });

  row.logo = null;
  for (const c of 'logo' in ov && ov.logo === null ? [] : candidates) {
    if (!c.url) continue;
    const img = c.source === 'override' ? await getOverride(c.url) : await get(c.url, 'bytes');
    if (!img) continue;
    const file = join(OUT_DIR, `${s.id}-logo.webp`);
    const saved = await saveLogo(img.body, file);
    if (saved) {
      row.logo = `/suppliers/${s.id}-logo.webp`;
      prov.logo_source = `${c.source} ${c.url}`;
      break;
    }
  }

  // ---- cover ----
  row.cover = null;
  const og =
    metaContent(html, 'og:image') ?? metaContent(html, 'og:image:secure_url') ?? metaContent(html, 'twitter:image');
  const coverCandidates = [];
  if (ov.cover) coverCandidates.push({ url: ov.cover, source: 'override' });
  if (og) coverCandidates.push({ url: abs(og, base), source: 'og:image' });
  for (const h of heroCandidates(html)) coverCandidates.push({ url: abs(h, base), source: 'hero-img' });
  for (const c of ov.cover === null ? [] : coverCandidates) {
    if (!c.url || (prov.logo_source ?? '').endsWith(c.url)) continue;
    const img = c.source === 'override' ? await getOverride(c.url) : await get(c.url, 'bytes');
    if (!img) continue;
    const file = join(OUT_DIR, `${s.id}-cover.webp`);
    const saved = await saveCover(img.body, file);
    if (saved) {
      row.cover = `/suppliers/${s.id}-cover.webp`;
      prov.cover_source = `${c.source} ${c.url}`;
      break;
    }
  }

  assets[s.id] = row;
  provenance[s.id] = prov;
  report.push(
    `${s.id}: logo ${row.logo ? 'ok (' + prov.logo_source.split(' ')[0] + ')' : 'NONE'}, cover ${row.cover ? 'ok' : 'NONE'}`
  );
}

// Rows for shops no longer in the directory are dropped, and any file no row
// references is deleted: a logo refused on a later pass, or a shop removed from
// the directory, must not leave its image behind (the static test refuses orphans).
const ids = new Set(suppliers.map((s) => s.id));
for (const id of Object.keys(assets)) if (!ids.has(id)) delete assets[id];
for (const id of Object.keys(provenance)) if (!ids.has(id)) delete provenance[id];
const referenced = new Set(
  Object.values(assets)
    .flatMap((r) => [r.logo, r.cover])
    .filter(Boolean)
);
for (const f of await readdir(OUT_DIR)) {
  if (f.endsWith('.webp') && !referenced.has(`/suppliers/${f}`)) await unlink(join(OUT_DIR, f));
}

const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
const ordered = sorted(assets);
await writeFile(ASSETS, JSON.stringify(ordered, null, 2) + '\n');
await writeFile(PROVENANCE, JSON.stringify(sorted(provenance), null, 2) + '\n');
console.log(report.join('\n'));
const rows = Object.values(ordered);
console.log(
  `\n${rows.filter((r) => r.logo).length}/${suppliers.length} logos, ${rows.filter((r) => r.cover).length}/${suppliers.length} covers`
);
