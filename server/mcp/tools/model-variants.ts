import { z } from 'zod';
import {
  BODY_LABELS,
  FAMILY_LABELS,
  FUEL_SYSTEM_LABELS,
  MARKET_LABELS,
  MARQUE_LABELS,
  SPEC_ROW_COUNT,
  VARIANT_BODIES,
  VARIANT_FAMILIES,
  VARIANT_MARKETS,
  VARIANT_MARQUES,
  VARIANT_UNITS,
  countSourcedSpecs,
  markLabel,
  toKmh,
  toKw,
  toLb,
  toNm,
  toPs,
  yearsLabel,
  type ModelVariant,
} from '../../../data/models/variants';
import { listModelVariants, relatedModelVariantsFor } from '../../utils/modelVariants';

/**
 * Model Variants MCP Tool
 *
 * The archive of every Classic Mini model variant (1959–2000) with a typed spec
 * sheet: engine, power, torque, carburation, final drive, wheels, tyres, kerb
 * weight, top speed, production numbers and factory colours. Seeded from the
 * austinminiwebsearch.com library (preserved via the Wayback Machine) and
 * corrected by contributors; every row links back to its archive page.
 *
 * Reads through `server/utils/modelVariants.ts` (the `model_variants` table,
 * approved rows only, cached per isolate). Never query the tables directly
 * here: that module owns the approved-only filter.
 *
 * Units are stated in `units` on every response — stored figures are the
 * source unit (bhp, lb-ft, kg, mph) and the metric figures beside them are
 * derived. A null field means the source did not record it, not zero.
 */
const SITE = 'https://www.classicminidiy.com';

function specSheet(v: ModelVariant) {
  return {
    engine_cc: v.engine_cc,
    compression_ratio: v.compression_ratio,
    power_bhp: v.power_bhp,
    power_ps: v.power_bhp === null ? null : toPs(v.power_bhp),
    power_kw: v.power_bhp === null ? null : toKw(v.power_bhp),
    power_rpm: v.power_rpm,
    power_standard: v.power_standard,
    torque_lbft: v.torque_lbft,
    torque_nm: v.torque_lbft === null ? null : toNm(v.torque_lbft),
    torque_rpm: v.torque_rpm,
    fuel_system: v.fuel_system ? FUEL_SYSTEM_LABELS[v.fuel_system] : null,
    carburettor: v.carburettor,
    final_drive: v.final_drive,
    wheels: v.wheels,
    tyres: v.tyres,
    kerb_weight_kg: v.kerb_weight_kg,
    kerb_weight_lb: v.kerb_weight_kg === null ? null : toLb(v.kerb_weight_kg),
    top_speed_mph: v.top_speed_mph,
    top_speed_kmh: v.top_speed_mph === null ? null : toKmh(v.top_speed_mph),
  };
}

function describe(v: ModelVariant) {
  return {
    slug: v.slug,
    name: v.name,
    marque: MARQUE_LABELS[v.marque],
    family: FAMILY_LABELS[v.family],
    body_style: BODY_LABELS[v.body_style],
    mark: v.mark,
    mark_label: markLabel(v.mark) || null,
    market: MARKET_LABELS[v.market],
    years: yearsLabel(v.year_start, v.year_end) || null,
    year_start: v.year_start,
    year_end: v.year_end,
    is_limited_edition: v.is_limited_edition,
    edition_size: v.edition_size,
    production_total: v.production_total,
    production: v.production,
    specs: specSheet(v),
    specs_sourced: `${countSourcedSpecs(v)} of ${SPEC_ROW_COUNT}`,
    colors: v.colors.map((c) => c.name),
    notes: [v.notes, v.engine_note].filter(Boolean).join(' ') || null,
    sources: v.sources.map((s) => ({ type: s.type, title: s.title, url: s.url ?? null })),
    photo_count: v.photos.length,
    url: `${SITE}/archive/variants/${v.slug}`,
  };
}

function line(v: ModelVariant): string {
  const s = specSheet(v);
  const bits = [
    s.engine_cc ? `${s.engine_cc} cc` : null,
    s.power_bhp !== null ? `${s.power_bhp} bhp${s.power_rpm ? ` @ ${s.power_rpm} rpm` : ''}` : null,
    s.torque_lbft !== null ? `${s.torque_lbft} lb-ft${s.torque_rpm ? ` @ ${s.torque_rpm} rpm` : ''}` : null,
    s.carburettor,
    s.final_drive !== null ? `FD ${s.final_drive}` : null,
    s.kerb_weight_kg !== null ? `${s.kerb_weight_kg} kg` : null,
    s.top_speed_mph !== null ? `${s.top_speed_mph} mph` : null,
    v.production_total !== null ? `${v.production_total.toLocaleString('en-GB')} built` : null,
  ].filter(Boolean);
  const years = yearsLabel(v.year_start, v.year_end);
  return `- **${v.name}**${years ? ` (${years})` : ''}${v.mark ? ` · ${markLabel(v.mark)}` : ''} · ${MARKET_LABELS[v.market]}\n  ${bits.join(' · ')}${v.colors.length ? `\n  Colours: ${v.colors.map((c) => c.name).join(', ')}` : ''}\n  ${SITE}/archive/variants/${v.slug}`;
}

export default defineMcpTool({
  description:
    'Look up Classic Mini model variants (1959–2000) from the archive: Austin Seven, Morris Mini-Minor, Cooper and Cooper S (997/998/970/1071/1275), Clubman and 1275 GT, vans, pick-ups, estates, Moke, Riley Elf, Wolseley Hornet, Innocenti, Authi, and every UK limited edition (Mini 25/30/35/40, Mayfair, Sprite, Cooper RSP, Italian Job, Paul Smith…). Returns the factory spec sheet — engine cc, compression, power, torque, carburation, final drive, wheels, tyres, kerb weight, top speed — plus production numbers, factory colours and a link to the archive page. Search by name fragment, or filter by marque, family, mark (1–7), a production year or engine capacity.',

  inputSchema: {
    query: z
      .string()
      .max(80)
      .optional()
      .describe(
        'Name fragment, e.g. "cooper s 1275", "innocenti", "1275 gt", "sprite", "mayfair". Every word must prefix-match, so extra words narrow. Omit to browse with the filters.'
      ),
    marque: z.enum(VARIANT_MARQUES).optional().describe('Restrict to one marque.'),
    family: z
      .enum(VARIANT_FAMILIES)
      .optional()
      .describe('Restrict to one family, e.g. "cooper_s", "clubman", "van", "limited_edition".'),
    body: z.enum(VARIANT_BODIES).optional().describe('Restrict to one body style.'),
    market: z.enum(VARIANT_MARKETS).optional().describe('Restrict to one home market, e.g. "italy" for Innocenti.'),
    mark: z.number().int().min(1).max(7).optional().describe('UK mark number 1–7. Overseas cars carry no mark.'),
    year: z
      .number()
      .int()
      .min(1959)
      .max(2000)
      .optional()
      .describe(
        'A year the variant was in production. A variant with no recorded end year is treated as open-ended to 2000.'
      ),
    engine_cc: z.number().int().optional().describe('Exact engine capacity: 848, 970, 997, 998, 1071, 1098 or 1275.'),
    limit: z.number().int().positive().max(50).default(10).describe('Maximum variants to return. Default 10.'),
  },

  async handler({ query, marque, family, body, market, mark, year, engine_cc, limit }) {
    let all;
    try {
      all = await listModelVariants({ query, marque, family, body, market, mark: mark ?? null, year, engine_cc });
    } catch (err) {
      console.error('model-variants MCP error:', err);
      return errorResult('The model variants archive is unavailable right now; try again shortly.');
    }
    const matches = all.slice(0, limit);
    const truncated = all.length > matches.length;

    if (matches.length === 0) {
      return jsonResult({
        query: query ?? null,
        totalMatches: 0,
        matches: [],
        hint: 'No variant matched. Try fewer words (the family name alone, e.g. "cooper s"), or drop a filter. Overseas cars (Innocenti, Authi) carry no mark number.',
        availableMarques: VARIANT_MARQUES,
        availableFamilies: VARIANT_FAMILIES,
      });
    }

    // One exact-looking hit gets its siblings so the agent can offer "did you
    // mean the Mk II" without a second call.
    const related = matches.length === 1 ? await relatedModelVariantsFor(matches[0]!, 5) : [];

    return jsonResult({
      query: query ?? null,
      totalMatches: all.length,
      returned: matches.length,
      truncated,
      matches: matches.map(describe),
      ...(related.length
        ? {
            related: related.map((r) => ({ slug: r.slug, name: r.name, years: yearsLabel(r.year_start, r.year_end) })),
          }
        : {}),
      units: VARIANT_UNITS,
      source:
        'Classic Mini DIY archive, seeded from austinminiwebsearch.com (Wayback Machine, 2023 capture) and corrected by reviewed contributions. Cite the archive page url.',
      formattedText: [
        `**Model Variants** — ${all.length} match${all.length === 1 ? '' : 'es'}` +
          (truncated ? ` (showing ${matches.length})` : ''),
        '',
        ...matches.map(line),
      ].join('\n'),
    });
  },

  // Not cached: an in-memory filter over 141 rows costs less than a cache
  // round-trip, and the args are scalars so nothing would be gained.
});
