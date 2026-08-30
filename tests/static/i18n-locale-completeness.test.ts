// @vitest-environment node
/**
 * Every translatable surface must carry all 10 locales with an identical key
 * set, and every `<i18n>` block must be shaped the way the build expects.
 *
 * Why this is a test and not a code review note: `i18n.config.ts` sets
 * `missingWarn: false` and `fallbackWarn: false`, so a missing locale or a
 * missing key degrades SILENTLY to English. Nothing warns in dev, nothing
 * fails the build, and the only way to notice is to read the page in that
 * language. Three whole pages and 54 individual keys had drifted before this
 * check existed.
 *
 * Two of the rules here are hard build-breakers with no allowlist, because
 * `unplugin-vue-i18n` compiles these blocks at build time:
 *   - invalid JSON in a block fails the build
 *   - HTML inside a message value fails the build ("Detected HTML in '…'")
 * Keep markup in the template around `{{ t() }}`, or split the sentence into
 * keyed segments. Never `v-html` a message.
 */
import { describe, expect, it } from 'vitest';
import { appVueFiles, describeViolations, diffAgainstAllowlist, parseVue, rel } from './_scan';

/** The 10 shipped locales, from `i18n.locales` in nuxt.config.ts. */
const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'zh', 'ko'] as const;

/**
 * Locales entirely absent from a file's block. `file::locale`.
 * Every entry here is a page that renders in English no matter what the
 * visitor picked. Tracked by the i18n backfill issue; remove an entry when its
 * translations land.
 */
const KNOWN_MISSING_LOCALES: readonly string[] = [
  // /membership — 63 English-only strings on a public, indexable marketing page.
  ...LOCALES.filter((l) => l !== 'en').map((l) => `app/pages/membership/index.vue::${l}`),
  // /membership/claim — 27 strings, reached from the Discord claim email.
  ...LOCALES.filter((l) => l !== 'en').map((l) => `app/pages/membership/claim.vue::${l}`),
  // /discord/connect — 19 strings, the self-serve claim-recovery page.
  ...LOCALES.filter((l) => l !== 'en').map((l) => `app/pages/discord/connect.vue::${l}`),
];

/**
 * Individual keys present in `en` but missing elsewhere. `file::locale::key`.
 * These render the English string mid-page in an otherwise translated view.
 */
const KNOWN_MISSING_KEYS: readonly string[] = [
  // Homepage support CTA.
  ...LOCALES.filter((l) => l !== 'en').map((l) => `app/pages/index.vue::${l}::home.support.member_cta`),
  // Needle relative-search result labels.
  ...LOCALES.filter((l) => l !== 'en').flatMap((l) => [
    `app/components/Calculators/Needles.vue::${l}::relative.size_match`,
    `app/components/Calculators/Needles.vue::${l}::relative.size_mismatch`,
  ]),
  // Gearbox RPM dropdown options — es/fr/de only.
  ...['es', 'fr', 'de'].flatMap((l) =>
    [5000, 5500, 6000, 6500, 7000, 7500, 8000, 8500, 9000].map(
      (rpm) => `app/components/Calculators/GearboxSharedSettings.vue::${l}::rpm_options.${rpm}`
    )
  ),
];

/**
 * Files that legitimately have no `<i18n>` block while still calling `t()`.
 * Both supply their messages inline via `useI18n({ messages })` with all 10
 * locales present — a style deviation, not a coverage gap.
 */
const KNOWN_INLINE_MESSAGE_FILES: readonly string[] = ['app/components/Footer.vue', 'app/components/HomeToolCard.vue'];

/** Blocks still written as bare `<i18n>` rather than `<i18n lang="json">`. */
const KNOWN_UNTYPED_BLOCKS: readonly string[] = ['app/pages/[...slug].vue'];

/** Flatten a message object to dotted key paths. Arrays are leaves — an array
 * of FAQ entries is one key, and its length is checked separately below. */
function flattenKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return prefix ? [prefix] : [];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    flattenKeys(v, prefix ? `${prefix}.${k}` : k)
  );
}

/** Every string leaf, as `[keyPath, value]`. Arrays are walked by index. */
function flattenValues(value: unknown, prefix = ''): [string, string][] {
  if (typeof value === 'string') return [[prefix, value]];
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    flattenValues(v, prefix ? `${prefix}.${k}` : k)
  );
}

interface Block {
  file: string;
  lang: string | true | undefined;
  json: Record<string, unknown> | null;
  parseError: string | null;
}

const blocks: Block[] = [];
const filesUsingT: string[] = [];
const filesWithBlock = new Set<string>();

for (const abs of appVueFiles()) {
  const sfc = parseVue(abs);
  const searchable = `${sfc.scriptText}\n${sfc.template?.content ?? ''}`;
  if (/\buseI18n\s*\(|[^\w$]\$?t\s*\(\s*['"`]/.test(searchable)) filesUsingT.push(rel(abs));

  for (const block of sfc.i18n) {
    filesWithBlock.add(rel(abs));
    let json: Record<string, unknown> | null = null;
    let parseError: string | null = null;
    try {
      json = JSON.parse(block.content);
    } catch (error) {
      parseError = (error as Error).message;
    }
    blocks.push({ file: rel(abs), lang: block.attrs.lang as string | undefined, json, parseError });
  }
}

describe('i18n block shape (build-breakers — no allowlist)', () => {
  it('scans a non-trivial number of blocks', () => {
    // Guards against the scanner silently matching nothing, which would make
    // every assertion below vacuously true.
    expect(blocks.length).toBeGreaterThan(150);
    expect(filesUsingT.length).toBeGreaterThan(150);
  });

  it('every <i18n> block is valid JSON', () => {
    const bad = blocks.filter((b) => b.parseError).map((b) => `${b.file}: ${b.parseError}`);
    expect(bad, describeViolations('unparseable <i18n> blocks', bad)).toEqual([]);
  });

  it('no <i18n> block declares a locale outside the shipped 10', () => {
    const bad = blocks.flatMap((b) =>
      Object.keys(b.json ?? {})
        .filter((locale) => !(LOCALES as readonly string[]).includes(locale))
        .map((locale) => `${b.file}::${locale}`)
    );
    expect(bad, describeViolations('unknown locales', bad)).toEqual([]);
  });

  it('no message value contains HTML — unplugin-vue-i18n hard-fails the build on it', () => {
    const bad = blocks.flatMap((b) =>
      Object.entries(b.json ?? {}).flatMap(([locale, messages]) =>
        flattenValues(messages)
          .filter(([, value]) => /<[a-zA-Z/][^>]*>/.test(value))
          .map(([key, value]) => `${b.file}::${locale}::${key} — ${value.slice(0, 60)}`)
      )
    );
    expect(bad, describeViolations('messages containing HTML', bad)).toEqual([]);
  });
});

describe('i18n locale coverage', () => {
  it('every <i18n> block declares lang="json"', () => {
    const actual = blocks.filter((b) => b.lang !== 'json').map((b) => b.file);
    const { unexpected, stale } = diffAgainstAllowlist(actual, KNOWN_UNTYPED_BLOCKS);
    expect(unexpected, describeViolations('new bare <i18n> blocks', unexpected)).toEqual([]);
    expect(stale, describeViolations('stale KNOWN_UNTYPED_BLOCKS entries', stale)).toEqual([]);
  });

  it('every block carries all 10 locales', () => {
    const actual = blocks.flatMap((b) =>
      LOCALES.filter((locale) => !(locale in (b.json ?? {}))).map((locale) => `${b.file}::${locale}`)
    );
    const { unexpected, stale } = diffAgainstAllowlist(actual, KNOWN_MISSING_LOCALES);
    expect(unexpected, describeViolations('newly missing locales', unexpected)).toEqual([]);
    expect(stale, describeViolations('stale KNOWN_MISSING_LOCALES entries (fix landed — drop them)', stale)).toEqual(
      []
    );
  });

  it('every locale has the same key set as en', () => {
    const actual = blocks.flatMap((b) => {
      const enKeys = new Set(flattenKeys(b.json?.en));
      return LOCALES.filter((l) => l !== 'en' && l in (b.json ?? {})).flatMap((locale) => {
        const localeKeys = new Set(flattenKeys(b.json?.[locale]));
        return [...enKeys].filter((k) => !localeKeys.has(k)).map((k) => `${b.file}::${locale}::${k}`);
      });
    });
    const { unexpected, stale } = diffAgainstAllowlist(actual, KNOWN_MISSING_KEYS);
    expect(unexpected, describeViolations('newly missing keys', unexpected)).toEqual([]);
    expect(stale, describeViolations('stale KNOWN_MISSING_KEYS entries (fix landed — drop them)', stale)).toEqual([]);
  });

  it('every file that calls t() has a block or supplies messages inline', () => {
    const actual = filesUsingT.filter((f) => !filesWithBlock.has(f));
    const { unexpected, stale } = diffAgainstAllowlist(actual, KNOWN_INLINE_MESSAGE_FILES);
    expect(unexpected, describeViolations('files calling t() with no messages', unexpected)).toEqual([]);
    expect(stale, describeViolations('stale KNOWN_INLINE_MESSAGE_FILES entries', stale)).toEqual([]);
  });
});
