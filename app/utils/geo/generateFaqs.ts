/**
 * Generative-Engine-Optimization FAQ generators.
 *
 * These derive answer-first Q&As from the site's EXISTING reference data (no
 * hand-authoring of hundreds of entries). The same {q,a}[] feeds both:
 *   - the FAQPage JSON-LD (app/utils/schema/faqPage.ts → buildFaqPage), and
 *   - the visible above-the-fold block (app/components/geo/QuickAnswer.vue),
 * so the markup always matches on-page content.
 *
 * i18n: the answers are domain data (engine codes, chassis positions, torque /
 * clearance values) which the site already renders English-only in every locale
 * (the decoder tables import these same English data files). So the FAQ content is
 * intentionally English — it mirrors what the page's tables already show. Only the
 * QuickAnswer component's CHROME (headings, toggle labels) is translated, in its
 * own SFC <i18n> block.
 *
 * Pure + deterministic → unit-tested in tests/unit/utils/generate-faqs.test.ts.
 */
import { chassisRanges, type ChassisRange } from '../../../data/models/decoders';
import torqueSpecs from '../../../data/torqueSpecs.json';
import commonClearances from '../../../data/commonClearances.json';
import engineCodes from '../../../data/engineCodes.json';
import type { Faq } from '../schema/faqPage';

export type { Faq };

// ---- shared shapes for the JSON tables -------------------------------------
interface SpecItem {
  name: string;
  lbft?: string;
  nm?: string;
  thou?: string;
  mm?: string;
  notes?: string;
}
interface SpecTable {
  title: string;
  items: SpecItem[];
}
interface EngineCode {
  code: string;
  size: string;
  variant: string;
  gearbox: string;
  description: string;
}

const tables = (data: Record<string, SpecTable>): SpecTable[] => Object.values(data);

/** First item across all tables whose name contains `fragment` (case-insensitive). */
function findSpec(data: Record<string, SpecTable>, fragment: string): SpecItem | undefined {
  const needle = fragment.toLowerCase();
  for (const t of tables(data)) {
    const hit = t.items.find((i) => i.name.toLowerCase().includes(needle));
    if (hit) return hit;
  }
  return undefined;
}

// ---- torque ----------------------------------------------------------------
// Curated, high-search-volume fasteners (not the raw 80+ rows). Each maps to a
// substring matched against the real data so values stay the single source of truth.
const TORQUE_PICKS = [
  'Cylinder Head',
  'Main Bearing',
  'Big-end Bolts',
  'Flywheel',
  'Crankshaft Pulley Bolt',
  'Clutch',
  'Spark Plug',
  'Oil Filter',
  'Sump',
  'Road Wheel',
];

export function torqueFaqs(): Faq[] {
  const data = torqueSpecs as unknown as Record<string, SpecTable>;
  const out: Faq[] = [];
  const seen = new Set<string>();
  for (const pick of TORQUE_PICKS) {
    const item = findSpec(data, pick);
    if (!item || seen.has(item.name) || !item.lbft) continue;
    seen.add(item.name);
    const nm = item.nm ? ` (${item.nm} Nm)` : '';
    const notes = item.notes ? ` Applies to ${item.notes}.` : '';
    out.push({
      q: `What is the torque spec for the ${item.name} on a Classic Mini?`,
      a: `The ${item.name} torque is ${item.lbft} lb-ft${nm}.${notes}`,
    });
  }
  return out;
}

// ---- clearances ------------------------------------------------------------
const CLEARANCE_PICKS = [
  'Rocker/Valve Clearance - Stock',
  'Crankshaft Thrust Washer Endfloat',
  'Primary Gear Endfloat',
  'Differential Bearing Preload',
  'Baulk Ring Clearance',
];

export function clearanceFaqs(): Faq[] {
  const data = commonClearances as unknown as Record<string, SpecTable>;
  const out: Faq[] = [];
  const seen = new Set<string>();
  for (const pick of CLEARANCE_PICKS) {
    const item = findSpec(data, pick);
    if (!item || seen.has(item.name) || !item.thou) continue;
    seen.add(item.name);
    // Clean trailing " - Stock"/" - Rollers" qualifiers for the question wording.
    const label = item.name.replace(/\s*-\s*(Stock|Rollers)$/i, '').trim();
    const mm = item.mm ? ` (${item.mm} mm)` : '';
    const notes = item.notes ? ` ${item.notes}` : '';
    out.push({
      q: `What is the correct ${label} on a Classic Mini A-series engine?`,
      a: `The ${item.name} is ${item.thou}"${mm}.${notes}`.trimEnd(),
    });
  }
  return out;
}

// ---- engine codes ----------------------------------------------------------
// One FAQ per displacement, listing real codes for that size. Bounded + useful
// ("classic mini 1275 engine codes" is a real query).
const SIZE_ORDER = ['850', '970', '997', '998', '1071', '1098', '1275'];

export function engineCodeFaqs(): Faq[] {
  const codes = engineCodes as unknown as EngineCode[];
  const out: Faq[] = [];
  for (const size of SIZE_ORDER) {
    const forSize = codes.filter((c) => c.size === size && c.code);
    if (!forSize.length) continue;
    const examples = forSize
      .slice(0, 5)
      .map((c) => `${c.code} (${c.description || c.variant || 'standard'})`)
      .join(', ');
    const more = forSize.length > 5 ? `, and ${forSize.length - 5} more` : '';
    out.push({
      q: `What are the Classic Mini engine codes for the ${size}cc engine?`,
      a: `Common ${size}cc Classic Mini engine codes include ${examples}${more}. The engine prefix identifies the displacement and build variant — match the code stamped on the block to confirm your engine.`,
    });
  }
  return out;
}

// ---- chassis / VIN numbers -------------------------------------------------
const findEra = (title: string): ChassisRange | undefined =>
  chassisRanges.find((r) => r.title === title);

/** Concatenate a ChassisRange.PrimaryExample into its readable example string. */
function exampleString(r: ChassisRange): string {
  const p = r.value.PrimaryExample;
  const positions = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'] as const;
  const prefix = positions.map((k) => p[k] ?? '').join('');
  return `${prefix}${p.numbers ?? ''}${p.last ?? ''}`.trim();
}

export function chassisFaqs(): Faq[] {
  const out: Faq[] = [];

  // Per-era format FAQs, straight from the data's PrimaryExample.
  for (const r of chassisRanges) {
    const example = exampleString(r);
    if (!example) continue;
    out.push({
      q: `What does a ${r.title} Classic Mini chassis number look like?`,
      a: `A ${r.title} Classic Mini chassis (VIN/commission) number follows the pattern ${example}. Each character encodes details such as the marque, engine size, body type, series/trim and assembly plant.`,
    });
  }

  // Engine-letter map — derived from the 1974-1980 era (positions cover C/E/K/L).
  const era74 = findEra('1974-1980');
  if (era74) {
    const engineLetters = era74.value.options['2']
      .filter((o) => o.value && /cc/i.test(o.name))
      .map((o) => `${o.value} = ${o.name}`)
      .join(', ');
    if (engineLetters) {
      out.push({
        q: 'What does the engine letter in a Classic Mini chassis number mean?',
        a: `On later Classic Mini chassis numbers the engine letter gives the displacement: ${engineLetters}. Earlier cars used "A" for the A-series engine generally.`,
      });
    }
  }

  // Assembly plant — derived from the first era's `last` options.
  const era59 = findEra('1959-1969');
  if (era59?.value.last?.length) {
    const plants = era59.value.last.map((o) => `${o.value} = ${o.name}`).join(', ');
    out.push({
      q: 'How can I tell where my Classic Mini was built from the chassis number?',
      a: `The assembly-plant letter at the end of an early Classic Mini chassis number identifies the factory: ${plants}.`,
    });
  }

  // Marque letters — derived from the first era's position 1.
  if (era59?.value.options['1']?.length) {
    const marques = era59.value.options['1']
      .map((o) => `${o.value} = ${o.name.trim()}`)
      .join('; ');
    out.push({
      q: 'What do the first letters of an early Classic Mini chassis number mean?',
      a: `On 1959-1969 cars the first letter is the marque: ${marques}.`,
    });
  }

  return out;
}
