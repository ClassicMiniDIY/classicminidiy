import { z } from 'zod';
import needlesData from '../../../data/needles.json';
import {
  bandAverages,
  compareNeedles,
  findRelativeNeedles,
  type NeedleBand,
  type NeedleDirection,
} from '../../../app/composables/useNeedleCompare';
import type { Needle } from '../../../data/models/needles';

/**
 * SU Needle MCP Tool
 *
 * The archive's most distinctive dataset — 709 SU carburettor needle profiles,
 * with the same comparison logic the on-site configurator uses. No other MCP
 * server can answer "what is richer than an AAA only at low throttle".
 *
 * useNeedleCompare.ts is deliberately framework-free TypeScript, so it is
 * imported directly rather than reimplemented. Needle stations are 16 diameter
 * readings along the needle; richness is compared as FUEL-FLOW AREA (mm²), not
 * raw diameter, because area is what actually meters fuel.
 */

const needles = needlesData as Needle[];

const BAND_DESCRIPTION =
  'Throttle band: "low" = stations 1-4 (idle and light throttle), "mid" = stations 5-9 (cruise and part throttle), "high" = stations 10-15 (full throttle), "any" = across all three.';

function findNeedle(name: string): Needle | undefined {
  const needle = name.trim().toLowerCase();
  return (
    needles.find((n) => n.name.toLowerCase() === needle) ??
    needles.find((n) => n.name.toLowerCase().replace(/\s+/g, '') === needle.replace(/\s+/g, ''))
  );
}

/** 4dp is well below the resolution of a needle measurement; the rest is float noise. */
function round4(v: number | null): number | null {
  return v === null ? null : Math.round((v + Number.EPSILON) * 10000) / 10000;
}

function summarise(n: Needle) {
  const avg = bandAverages(n);
  return {
    name: n.name,
    size: n.size,
    /** Mean fuel-flow area per band, mm². Higher = richer. */
    bandAverages: { low: round4(avg.low), mid: round4(avg.mid), high: round4(avg.high) },
  };
}

export default defineMcpTool({
  description:
    'Look up and compare SU carburettor needles for the Classic Mini, from a database of 709 needle profiles. Three modes: `lookup` a single needle\'s profile, `compare` two needles band by band, or `find` needles that are richer/leaner/similar to a reference — optionally isolated to one throttle band, which is the usual tuning question ("richer at low throttle, unchanged elsewhere"). Richness is measured as fuel-flow area in mm², not needle diameter, because area is what meters fuel.',

  inputSchema: {
    mode: z
      .enum(['lookup', 'compare', 'find'])
      .describe(
        "lookup = one needle's profile; compare = two needles band by band; find = search for needles related to a reference."
      ),
    needle: z
      .string()
      .min(1)
      .max(20)
      .describe('Needle name, e.g. "AAA", "ABB", "M". For `compare` and `find` this is the REFERENCE needle.'),
    against: z
      .string()
      .min(1)
      .max(20)
      .optional()
      .describe('Second needle name. Required for mode="compare"; ignored otherwise.'),
    direction: z
      .enum(['richer', 'leaner', 'similar'])
      .optional()
      .describe('For mode="find": what relationship to the reference to search for. Defaults to "richer".'),
    band: z
      .enum(['low', 'mid', 'high', 'any'])
      .optional()
      .describe(`For mode="find": which band to target. Defaults to "any". ${BAND_DESCRIPTION}`),
    sameSizeOnly: z
      .boolean()
      .optional()
      .describe(
        'For mode="find": only return needles of the same nominal size as the reference. Default true — a different size will not physically suit the same jet.'
      ),
    isolateBand: z
      .boolean()
      .optional()
      .describe(
        'For mode="find" with a specific band: require the other two bands to stay approximately unchanged. Default true, which is what makes "richer ONLY down low" answerable.'
      ),
    limit: z.number().int().positive().max(50).default(10).describe('Maximum needles to return for mode="find".'),
  },

  async handler({ mode, needle, against, direction, band, sameSizeOnly, isolateBand, limit }) {
    const reference = findNeedle(needle);
    if (!reference) {
      return errorResult(
        `Unknown needle "${needle}". Names are short SU codes such as AAA, ABB, BQ or M. ${needles.length} needles are available.`
      );
    }

    if (mode === 'lookup') {
      return jsonResult({
        mode,
        needle: summarise(reference),
        stations: reference.data,
        notes:
          'stations are 16 diameter readings (mm) along the needle, station 1 nearest the tip (idle). A 0 means the needle has no data at that station. bandAverages are fuel-flow areas in mm² — higher is richer.',
        formattedText: `**${reference.name}** (size ${reference.size})\n\nBand averages (mm² fuel area, higher = richer):\n- Low (idle/light): ${summarise(reference).bandAverages.low}\n- Mid (cruise): ${summarise(reference).bandAverages.mid}\n- High (full): ${summarise(reference).bandAverages.high}`,
      });
    }

    if (mode === 'compare') {
      if (!against) {
        return errorResult('mode="compare" requires `against` — the second needle name to compare with.');
      }
      const candidate = findNeedle(against);
      if (!candidate) {
        return errorResult(`Unknown needle "${against}". Names are short SU codes such as AAA, ABB, BQ or M.`);
      }

      const c = compareNeedles(reference, candidate);
      const dir = (b: { richness: number | null }) =>
        b.richness === null ? 'no data' : b.richness > 0 ? 'richer' : b.richness < 0 ? 'leaner' : 'same';

      return jsonResult({
        mode,
        reference: summarise(reference),
        candidate: summarise(candidate),
        sameSize: c.sameSize,
        bands: c.bands,
        overallDistance: round4(c.overallDistance),
        uniformlyRicher: c.uniformlyRicher,
        uniformlyLeaner: c.uniformlyLeaner,
        notes:
          'richness is the candidate minus the reference in mm² of fuel-flow area — positive means the candidate is RICHER. sameSize false means the two will not suit the same jet.',
        formattedText: [
          `**${candidate.name} compared with ${reference.name}**`,
          c.sameSize
            ? ''
            : `\n> Different nominal sizes (${reference.size} vs ${candidate.size}) — these do not suit the same jet.`,
          '',
          `- Low (idle/light): ${dir(c.bands.low)}${c.bands.low.richnessPct !== null ? ` (${c.bands.low.richnessPct}%)` : ''}`,
          `- Mid (cruise): ${dir(c.bands.mid)}${c.bands.mid.richnessPct !== null ? ` (${c.bands.mid.richnessPct}%)` : ''}`,
          `- High (full): ${dir(c.bands.high)}${c.bands.high.richnessPct !== null ? ` (${c.bands.high.richnessPct}%)` : ''}`,
          '',
          c.uniformlyRicher
            ? `${candidate.name} is richer than ${reference.name} across the whole range.`
            : c.uniformlyLeaner
              ? `${candidate.name} is leaner than ${reference.name} across the whole range.`
              : 'Mixed — richer in some bands, leaner in others.',
        ].join('\n'),
      });
    }

    // mode === 'find'
    const ranked = findRelativeNeedles(reference, needles, {
      band: (band ?? 'any') as NeedleBand | 'any',
      direction: (direction ?? 'richer') as NeedleDirection,
      sameSizeOnly: sameSizeOnly ?? true,
      isolateBand: isolateBand ?? true,
      limit,
    });

    if (ranked.length === 0) {
      return jsonResult({
        mode,
        reference: summarise(reference),
        criteria: {
          direction: direction ?? 'richer',
          band: band ?? 'any',
          sameSizeOnly: sameSizeOnly ?? true,
          isolateBand: isolateBand ?? true,
        },
        totalMatches: 0,
        matches: [],
        hint: 'No needle matched. Try sameSizeOnly=false to widen to other jet sizes, isolateBand=false to allow the other bands to move, or band="any".',
      });
    }

    return jsonResult({
      mode,
      reference: summarise(reference),
      criteria: {
        direction: direction ?? 'richer',
        band: band ?? 'any',
        sameSizeOnly: sameSizeOnly ?? true,
        isolateBand: isolateBand ?? true,
      },
      totalMatches: ranked.length,
      matches: ranked.map((r) => ({
        ...summarise(r.candidate),
        sameSize: r.sameSize,
        bands: r.bands,
        overallDistance: round4(r.overallDistance),
        score: round4(r.score),
      })),
      notes: 'ranked best-first; lower score is a closer match to the requested direction and band.',
      formattedText: [
        `**Needles ${direction ?? 'richer'} than ${reference.name}${band && band !== 'any' ? ` in the ${band} band` : ''}** — ${ranked.length} match${ranked.length === 1 ? '' : 'es'}`,
        '',
        ...ranked.map((r, i) => `${i + 1}. **${r.candidate.name}** (size ${r.candidate.size})`),
      ].join('\n'),
    });
  },
});
