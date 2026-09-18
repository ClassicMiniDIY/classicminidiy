import engineCodes from '../../data/engineCodes.json';

/**
 * Query analysis for unified search (design: docs/plans/2026-09-14-unified-search.md).
 *
 * One pure function, shared by the palette and `/api/search`, so the client
 * and the server agree on what a query IS before either of them ranks it. The
 * server uses the verdict to order surfaces and to decide which direct-answer
 * lookups to run; the client uses it to place the "Ask DIY Mini Bot" row.
 *
 * HEURISTICS ONLY, BY DECISION. This runs on every keystroke of an
 * unauthenticated endpoint. A model call here would put a per-keystroke cost
 * on the free path to make the Ask row land on the right edge of the list
 * slightly more often. The row is always present either way, so a wrong
 * verdict moves it, never hides it.
 *
 * Nothing in here may import from `server/`: this file is bundled into the
 * client. `data/engineCodes.json` is 119 rows and is the only data it needs.
 */

export const SURFACES = ['tools', 'wheels', 'archive', 'models', 'exchange', 'parts', 'suppliers', 'videos'] as const;

/** Longest query the search surfaces accept; `/api/search` and the miss log both cut here. */
export const SEARCH_QUERY_MAX_LENGTH = 120;

/**
 * The one normalisation every search entry point applies before ranking or
 * logging: trim, collapse internal whitespace, cap the length. Shared so the
 * miss log records exactly the string the search ran on.
 */
export function normaliseSearchQuery(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, SEARCH_QUERY_MAX_LENGTH);
}
export type Surface = (typeof SURFACES)[number];

export type QueryKind = 'part-number' | 'colour-code' | 'chassis' | 'engine' | 'question' | 'lookup';

export interface SearchIntent {
  kind: QueryKind;
  /** Surface order for this query. First entry leads. Every surface appears once. */
  surfaceOrder: Surface[];
  /** Where the Ask row renders relative to the results. */
  askPosition: 'top' | 'bottom';
}

/**
 * The wire shape of `/api/search`, here rather than on the route so the
 * palette and the results page can import it through `~~/shared` — a client
 * file importing a type from `server/` is erased at build but reads as a
 * layering mistake, and the route never re-exported these anyway.
 */
export interface SearchResult {
  surface: Surface;
  id: string;
  title: string;
  subtitle: string | null;
  url: string;
  /** A Font Awesome class, except on the `videos` surface, where it is the thumbnail URL. */
  icon: string;
  tag: string | null;
  contributorUsername: string | null;
  verified: boolean;
}

/**
 * A direct answer: the thing itself, rendered in the palette, rather than a
 * link to the page that holds it. Each kind is resolved server-side by the
 * same lookup the matching MCP tool runs (`server/utils/directAnswers.ts`);
 * `url` is where "open" goes.
 */
export type DirectAnswer =
  | {
      kind: 'part';
      partNumber: string;
      description: string | null;
      system: string | null;
      sourceName: string | null;
      url: string;
    }
  | {
      kind: 'colour';
      name: string;
      code: string | null;
      shortCode: string | null;
      hex: string | null;
      years: string | null;
      url: string;
    }
  | {
      kind: 'chassis';
      chassisNumber: string;
      yearRange: string;
      fields: { label: string; value: string }[];
      url: string;
    }
  | {
      kind: 'engine';
      code: string;
      capacityCc: string;
      variant: string | null;
      gearbox: string | null;
      description: string;
      url: string;
    }
  | { kind: 'torque'; item: string; section: string; lbft: string; nm: string; notes: string | null; url: string }
  | { kind: 'clearance'; item: string; section: string; thou: string; mm: string; notes: string | null; url: string };

export type DirectAnswerKind = DirectAnswer['kind'];

export interface SearchResponse {
  query: string;
  /** What the query looks like, and the surface order that follows from it. */
  intent: SearchIntent;
  /** At most two. Rendered as the first group, before any surface. */
  answers: DirectAnswer[];
  total: number;
  results: SearchResult[];
  counts: Record<string, number>;
}

/**
 * Surface order by kind.
 *
 * `lookup` is the order the palette had before this file existed, with the
 * three surfaces added by the unified-search work appended, so a query that
 * classified as nothing in particular ranks exactly as it did.
 *
 * A structured shape leads with the surface that owns the structure: a part
 * number is a parts-archive row before it is anything else, and a how-to
 * question is answered by a video far more often than by a wheel.
 */
const SURFACE_ORDER_BY_KIND: Record<QueryKind, Surface[]> = {
  'part-number': ['parts', 'tools', 'archive', 'suppliers', 'exchange', 'wheels', 'models', 'videos'],
  'colour-code': ['archive', 'tools', 'exchange', 'wheels', 'models', 'parts', 'suppliers', 'videos'],
  chassis: ['tools', 'archive', 'exchange', 'wheels', 'models', 'parts', 'suppliers', 'videos'],
  engine: ['tools', 'archive', 'parts', 'exchange', 'wheels', 'models', 'suppliers', 'videos'],
  question: ['videos', 'tools', 'archive', 'parts', 'suppliers', 'wheels', 'models', 'exchange'],
  lookup: ['tools', 'wheels', 'archive', 'models', 'exchange', 'parts', 'suppliers', 'videos'],
};

/**
 * Factory paint code prefixes, as they appear on approved `colors` rows.
 *
 * Measured from the archive rather than guessed: BLVC is the BL-era prefix and
 * carries 249 of the 300-odd coded entries; the two-letter BMC family codes
 * (BU = blue, GN = green, RD = red …) cover the rest. A four-character
 * letters-plus-digits string is ALSO a valid part-number shape, so this list
 * is what lets `GN37` be a colour and `12G940` be a part.
 */
const COLOUR_PREFIXES = ['BLVC', 'BU', 'GN', 'RD', 'GR', 'BG', 'YL', 'WT'];
const COLOUR_CODE = new RegExp(`^(${COLOUR_PREFIXES.join('|')})\\s?\\d{1,4}$`, 'i');

/**
 * Engine prefix codes, normalised the same way the query is: upper-case, with
 * spaces, hyphens, dots and slashes removed. Matched EXACTLY, not by prefix.
 * The engine-decoder tool prefix-matches because a worn block is half-legible;
 * a search box is not a worn block, and prefix-matching here would swallow
 * `8A…` and `12H…` part numbers, of which there are many.
 */
const ENGINE_CODES = new Set(
  (engineCodes as { code: string }[]).map((entry) => normaliseCode(entry.code)).filter((code) => code.length >= 3)
);

function normaliseCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s\-./]/g, '');
}

/**
 * Chassis numbers carry structure a part number does not: two to seven
 * separated groups as the plate prints them (`A-A2S7L-123A`, `A-AB1-L/807922`,
 * `SAX-X-K2S1N-777-A`, `SAXXN-N-A-Y-B-B-D-777777`), a four-plus-character
 * prefix followed by a five-to-seven digit serial with an optional plant
 * letter (`YMA2S1-12345`, `XAU1N-547206A`), or, from 1980, a 17-character
 * VIN starting `SAX`. A short prefix with a hyphen before a short number
 * (`GHF-123`, `12G-940`, `ALA-6654`) is how people write a part number, and
 * stays one.
 */
const CHASSIS_TWO_HYPHENS = /^[A-Z][A-Z0-9]{0,6}(?:[-/][A-Z0-9]{1,8}){2,7}$/i;
const CHASSIS_ONE_HYPHEN = /^[A-Z][A-Z0-9]{3,6}[-/]\d{5,7}[A-Z]?$/i;
const CHASSIS_VIN = /^SAX[A-Z0-9]{9,14}$/i;

/**
 * A part number: letters and digits together, 4–12 characters once spacing
 * and hyphens are stripped, nothing else. `12G940`, `ALA6654`, `21A1234`,
 * `GHF-123`. Purely numeric strings are excluded — `1275` is a capacity or a
 * year, not a part.
 */
const PART_NUMBER = /^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{4,12}$/;

/**
 * Words that open a question. Matched on the first word only: "how" at the
 * start is a question, "how" in `somehow` or `show` is not.
 */
const QUESTION_OPENERS = new Set([
  'how',
  'why',
  'what',
  'whats',
  "what's",
  'when',
  'where',
  'which',
  'who',
  'should',
  'can',
  'could',
  'does',
  'do',
  'is',
  'are',
  'will',
  'would',
]);

/** Five or more words reads as a sentence, and a sentence is a question here. */
const QUESTION_WORD_COUNT = 5;

function classify(query: string): QueryKind {
  const trimmed = query.trim();
  if (!trimmed) return 'lookup';

  const compact = normaliseCode(trimmed);
  const words = trimmed.toLowerCase().split(/\s+/);

  // Structured shapes first, most specific first. A code is one token, or a
  // prefix and a serial with the space the plate prints between them ("BLVC
  // 1234", "12H 397"). Two WORDS ("mk1 cooper") are never a code, even when
  // squashing them together would pass the part-number shape.
  const codeShaped = words.length === 1 || (words.length === 2 && /^\d+$/.test(words[1]!));
  if (codeShaped) {
    if (CHASSIS_VIN.test(trimmed) || CHASSIS_TWO_HYPHENS.test(trimmed) || CHASSIS_ONE_HYPHEN.test(trimmed)) {
      return 'chassis';
    }
    if (ENGINE_CODES.has(compact)) return 'engine';
    if (COLOUR_CODE.test(trimmed)) return 'colour-code';
    if (PART_NUMBER.test(compact)) return 'part-number';
  }

  if (trimmed.endsWith('?')) return 'question';
  // Two words minimum: a bare "can" or "is" is someone mid-thought, not a question.
  if (words.length >= 2 && QUESTION_OPENERS.has(words[0]!)) return 'question';
  if (words.length >= QUESTION_WORD_COUNT) return 'question';

  return 'lookup';
}

export function analyseQuery(query: string): SearchIntent {
  const kind = classify(query);
  return {
    kind,
    surfaceOrder: SURFACE_ORDER_BY_KIND[kind],
    askPosition: kind === 'question' ? 'top' : 'bottom',
  };
}
