/**
 * Which Model Variant is this registry car?
 *
 * One pure scorer, shared by three callers so they cannot disagree:
 *   * the registry → variant backfill (classicminidiy-supabase migration
 *     20260923000001, generated from this and then reviewed by hand),
 *   * the approve route, which links a new registry entry when the owner did
 *     not pick a variant and the match is confident,
 *   * the contribute wizard, which offers the top suggestions to the owner.
 *
 * Owners type free text ("Austin", "Rover Mini", "Morris Cooper S") and often
 * a non-original engine (a 1960 Seven on a 1275), so engine size is a weak
 * signal. The strong ones are the year, named-edition words (Mayfair, Thirty,
 * City E), the family (Cooper S, 1275 GT, Clubman, Van, Moke), the body and
 * the marque. A limited edition only wins when its own name is in the text.
 */
import type { ModelVariantCard, VariantBody, VariantFamily, VariantMarque } from '../../data/models/variants';

export interface RegistryMatchInput {
  year: number | null;
  model: string | null;
  trim: string | null;
  engine_size: number | null;
  body_type: string | null;
  body_number?: string | null;
}

export type VariantMatchCandidate = Pick<
  ModelVariantCard,
  | 'slug'
  | 'name'
  | 'marque'
  | 'family'
  | 'body_style'
  | 'mark'
  | 'market'
  | 'year_start'
  | 'year_end'
  | 'engine_cc'
  | 'is_limited_edition'
>;

export interface VariantMatch {
  slug: string;
  score: number;
  reasons: string[];
}

export interface VariantMatchResult {
  best: VariantMatch | null;
  /** Top candidates, best first (for a picker). */
  ranked: VariantMatch[];
  /** True when the best candidate is safe to link without a human. */
  confident: boolean;
}

/** Words that name a family, marque or era rather than a specific edition. */
const GENERIC = new Set([
  'mini',
  'minor',
  'austin',
  'morris',
  'rover',
  'leyland',
  'blmc',
  'authi',
  'innocenti',
  'riley',
  'wolseley',
  'mk',
  'mk1',
  'mk2',
  'mk3',
  'mk4',
  'mk5',
  'mk6',
  'mk7',
  'cooper',
  's',
  'gt',
  'e',
  'le',
  'the',
  'by',
  'de',
  'd',
  'f',
  'gb',
  'nl',
  'fr',
  'ch',
  'sa',
  'nz',
  'uk',
  'i',
  'ii',
  'saloon',
  'van',
  'pick',
  'up',
  'pickup',
  'estate',
  'clubman',
  'moke',
  'countryman',
  'traveller',
  'automatic',
  'export',
  'japan',
  'deutschland',
  'france',
  'south',
  'africa',
  'australia',
  'new',
  'zealand',
  'nederland',
  'portugal',
  'spi',
  'mpi',
  'cabriolet',
  'sport',
  'special',
  'limited',
  'edition',
]);

function normalise(text: string): string {
  return ` ${text} `
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/1275\s*gts?\b/g, '1275 gt')
    .replace(/\bthirty\b/g, '30')
    .replace(/\bthirty[\s-]?five\b/g, '35')
    .replace(/\bforty\b/g, '40')
    .replace(/\bcheck\s*mate\b/g, 'check mate')
    .replace(/\bde\s*luxe\b/g, 'deluxe')
    .replace(/\bmayfield\b/g, 'mayfair')
    .replace(/\bsixty\b/g, '60')
    .replace(/[^a-z0-9]+/g, ' ');
}

const has = (text: string, phrase: string) => text.includes(` ${phrase} `);

function wordsOf(name: string): string[] {
  return normalise(name)
    .trim()
    .split(' ')
    .filter((w) => w && !GENERIC.has(w) && !/^\d{3,4}$/.test(w));
}

/** Body text as owners type it → the variant body (or the family it implies). */
function bodyFrom(bodyType: string | null): { body?: VariantBody; family?: VariantFamily } {
  const b = (bodyType ?? '').toLowerCase();
  if (b.includes('clubman')) return { family: 'clubman' };
  if (b.includes('estate') || b.includes('traveller') || b.includes('countryman')) return { body: 'estate' };
  if (b.includes('van')) return { body: 'van' };
  if (b.includes('pick')) return { body: 'pickup' };
  if (b.includes('cabrio')) return { body: 'cabriolet' };
  if (b.includes('moke')) return { body: 'moke' };
  if (b.includes('saloon') || b.includes('hornet')) return { body: 'saloon' };
  return {};
}

const MARQUE_WORDS: [string, VariantMarque[]][] = [
  ['authi', ['authi']],
  ['innocenti', ['innocenti']],
  ['riley', ['riley']],
  ['wolseley', ['wolseley']],
  ['leyland', ['leyland']],
  ['rover', ['rover', 'mini']],
  ['austin', ['austin', 'austin_morris']],
  ['morris', ['morris', 'austin_morris']],
];

function inYears(v: VariantMatchCandidate, year: number): boolean {
  if (!v.year_start) return false;
  // Stricter than the archive's own year filter (which treats a missing end as
  // open to 2000): for matching, an unknown end means "about then". A limited
  // edition with one recorded year sold into the next; anything else gets a
  // few years, not the rest of production.
  const end = v.year_end ?? v.year_start + (v.is_limited_edition ? 1 : 3);
  return v.year_start <= year && year <= end;
}

export function matchRegistryToVariant(
  entry: RegistryMatchInput,
  variants: readonly VariantMatchCandidate[],
  limit = 5
): VariantMatchResult {
  const text = normalise(`${entry.model ?? ''} ${entry.trim ?? ''}`);
  const { body, family: bodyFamily } = bodyFrom(entry.body_type);
  const saysCooperS = has(text, 'cooper s') || / cooper s /.test(text);
  const saysCooper = has(text, 'cooper');
  const saysGt = has(text, '1275 gt') || has(text, 'gt');
  const saysClubman = has(text, 'clubman') || bodyFamily === 'clubman';
  const saysVan = has(text, 'van') || body === 'van';
  const saysPickup = has(text, 'pick up') || has(text, 'pickup') || body === 'pickup';
  const saysMoke = has(text, 'moke') || body === 'moke';
  const saysEstate = has(text, 'estate') || has(text, 'traveller') || has(text, 'countryman') || body === 'estate';
  const saysElf = has(text, 'elf');
  const saysHornet = has(text, 'hornet');
  const saysAustralian = has(text, 'australian') || has(text, 'australia');
  const marquesSaid = MARQUE_WORDS.filter(([w]) => has(text, w)).flatMap(([, m]) => m);

  const scored: VariantMatch[] = [];
  for (const v of variants) {
    const reasons: string[] = [];
    let score = 0;

    if (entry.year) {
      if (!inYears(v, entry.year)) continue;
      score += 10;
      reasons.push('year');
    }

    // Named editions: the variant's own distinctive words in the owner's text.
    const own = wordsOf(v.name);
    const hits = own.filter((w) => has(text, w));
    if (hits.length) {
      score += 40 * hits.length;
      reasons.push(`name: ${hits.join(' ')}`);
    }
    // A capacity in the variant's NAME ("Mini 1000", "Van 850") is part of what
    // the owner called the car, unlike the engine field, which records what is
    // fitted now.
    const capacities = normalise(v.name)
      .trim()
      .split(' ')
      .filter((w) => /^\d{3,4}$/.test(w));
    if (capacities.some((c) => has(text, c))) {
      score += 15;
      reasons.push('name capacity');
    }
    // A limited edition wins only when its own name is in the text (or the
    // owner says "limited edition" and the edition has no distinctive name).
    const saysLe = has(text, 'limited edition') || has(text, 'le');
    if (v.is_limited_edition && !hits.length && !(saysLe && !own.length)) score -= 35;

    // Family.
    if (v.family === 'cooper_s') score += saysCooperS ? 30 : -25;
    else if (v.family === 'cooper') score += saysCooper && !saysCooperS ? 25 : saysCooperS ? 5 : -20;
    else if (saysCooper) score -= 15;
    if (v.family === '1275_gt') score += saysGt ? 30 : -20;
    else if (saysGt) score -= 15;
    if (v.family === 'clubman' || v.family === 'clubman_estate') score += saysClubman ? 20 : -10;
    else if (saysClubman && v.family !== '1275_gt') score -= 15;
    if (v.family === 'elf_hornet') score += saysElf || saysHornet ? 30 : -30;

    // Body.
    if (v.body_style === 'van') score += saysVan ? 25 : -25;
    else if (saysVan) score -= 25;
    if (v.body_style === 'pickup') score += saysPickup ? 25 : -25;
    else if (saysPickup) score -= 25;
    if (v.body_style === 'moke') score += saysMoke ? 30 : -25;
    else if (saysMoke) score -= 25;
    if (v.body_style === 'estate') score += saysEstate ? 20 : -15;
    else if (saysEstate) score -= 15;
    if (v.body_style === 'cabriolet') score += body === 'cabriolet' ? 10 : -10;
    if (body === 'saloon' && v.body_style === 'saloon') score += 3;

    // Marque and market.
    if (marquesSaid.length) {
      if (marquesSaid.includes(v.marque)) {
        score += v.marque === 'authi' || v.marque === 'innocenti' ? 30 : 10;
        reasons.push('marque');
      } else if (v.marque === 'authi' || v.marque === 'innocenti') score -= 30;
      // "Austin" and "Morris" were separate badges on the same car; saying one
      // is evidence against a variant that is only the other.
      else if (['austin', 'morris', 'riley', 'wolseley', 'leyland'].includes(v.marque)) score -= 8;
    } else if (v.marque === 'authi' || v.marque === 'innocenti') score -= 20;
    if (saysAustralian) score += v.market === 'australia' ? 15 : 0;
    else if (v.market !== 'uk') score -= 8;

    // Engine: weak, owners often fit a bigger one — except on a Cooper or
    // Cooper S, where the capacity IS the variant (970 / 1071 / 1275).
    if (entry.engine_size && v.engine_cc) {
      const diff = Math.abs(entry.engine_size - v.engine_cc);
      if (diff <= 5) {
        score += v.family === 'cooper_s' || v.family === 'cooper' ? 12 : 4;
        reasons.push('engine');
      }
    }

    scored.push({ slug: v.slug, score, reasons });
  }

  scored.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
  const [first, second] = scored;
  const best = first && first.score > 0 ? first : null;
  const margin = best ? best.score - (second?.score ?? 0) : 0;
  return {
    best,
    ranked: scored.filter((m) => m.score > 0).slice(0, limit),
    // Confident only with a year AND a clear gap to the runner-up.
    confident: Boolean(best && entry.year && best.score >= 20 && margin >= 8),
  };
}
