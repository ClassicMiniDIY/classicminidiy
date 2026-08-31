// @vitest-environment node
/**
 * Every PascalCase tag in a template must resolve to a real component.
 *
 * A tag Vue cannot resolve does not throw and does not fail the build. It logs
 * `[Vue warn]: Failed to resolve component: X` to the browser console and
 * renders NOTHING — so the feature is simply absent, and looks like it was
 * never built rather than like a bug. That is the same silent-empty-element
 * failure mode as the `i-fa6-*` icon strings documented in CLAUDE.md, and it is
 * invisible to every other check in this repo.
 *
 * It bit `<ContributorImpact>`, used on `/profile` and `/users/[id]`. The file
 * is `app/components/profile/ContributorImpact.vue`, so Nuxt registers it as
 * `ProfileContributorImpact`; the bare name resolved to nothing and the
 * contributor impact panel — the visible payoff of the whole trust and
 * contribution pipeline — rendered as empty space on both pages. Every sibling
 * in that directory was already referenced with the prefix, which is why it
 * looked right on a read-through.
 *
 * The registry is read from `.nuxt/components.d.ts` rather than derived from
 * file paths. Deriving it means reimplementing Nuxt's naming rules, including
 * the duplicate-prefix collapse that turns `archive/ArchiveSubnav.vue` into
 * `ArchiveSubnav` and not `ArchiveArchiveSubnav`. A first pass at this test did
 * exactly that and produced 20 findings, 18 of them false. Nuxt's own generated
 * manifest cannot disagree with Nuxt.
 */
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appVueFiles, blankComments, parseVue } from './_scan';

const MANIFEST = join(process.cwd(), '.nuxt/components.d.ts');

/**
 * Tags that are not components in this repo's sense: Vue and Nuxt built-ins,
 * and the SVG/MathML elements that are legitimately capitalised in templates.
 */
const BUILT_INS = new Set([
  'Component',
  'Transition',
  'TransitionGroup',
  'KeepAlive',
  'Teleport',
  'Suspense',
  'ClientOnly',
  'DevOnly',
  'NuxtPage',
  'NuxtLayout',
  'NuxtLink',
  'NuxtImg',
  'NuxtPicture',
  'NuxtErrorBoundary',
  'NuxtLoadingIndicator',
  'NuxtRouteAnnouncer',
  'NuxtClientFallback',
  'NuxtWelcome',
  'ServerPlaceholder',
  'RouterLink',
  'RouterView',
  'Head',
  'Title',
  'Meta',
  'Link',
  'Style',
  'Body',
  'Html',
  'Base',
  'NoScript',
  'Script',
]);

function registeredComponents(): { names: Set<string>; byStem: Map<string, string> } {
  const source = readFileSync(MANIFEST, 'utf8');
  const names = new Set<string>();
  const byStem = new Map<string, string>();
  // Two declaration shapes: eager (`Foo: typeof import("…")`) and lazy
  // (`LazyFoo: LazyComponent<typeof import("…")>`). Matching only the first
  // silently drops all 247 Lazy names, which then read as unresolved.
  for (const match of source.matchAll(/^export const ([A-Za-z0-9_]+):[^\n]*?import\("([^"]+)"\)/gm)) {
    const name = match[1]!;
    names.add(name);
    // `Lazy*` is a real registration — Nuxt emits a lazy-hydration alias for
    // every component, and three technical pages use it deliberately. It stays
    // a VALID name but is kept out of the suggestion map, so a fix is never
    // proposed as `<LazyFoo>` when the author wrote the eager form.
    if (name.startsWith('Lazy')) continue;
    const stem = basename(match[2]!).replace(/\.vue$/, '');
    if (!byStem.has(stem)) byStem.set(stem, name);
  }
  return { names, byStem };
}

/** Names a file provides for itself — an explicit import beats auto-import. */
function locallyProvided(source: string): Set<string> {
  const provided = new Set<string>();
  for (const m of source.matchAll(/import\s+([A-Z][A-Za-z0-9]*)\s+from/g)) provided.add(m[1]!);
  for (const m of source.matchAll(/import\s*\{([^}]*)\}/g)) {
    for (const part of m[1]!.split(',')) {
      const name = part
        .replace(/\bas\b.*/, '')
        .replace(/\btype\b/, '')
        .trim();
      if (/^[A-Z][A-Za-z0-9]*$/.test(name)) provided.add(name);
    }
  }
  for (const m of source.matchAll(/(?:const|let|var)\s+([A-Z][A-Za-z0-9]*)\s*=/g)) provided.add(m[1]!);
  // defineAsyncComponent and friends are assigned to lowercase names as often
  // as not, so also accept any capitalised destructured binding.
  for (const m of source.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) {
    for (const part of m[1]!.split(',')) {
      const name = part.split(':').pop()!.trim();
      if (/^[A-Z][A-Za-z0-9]*$/.test(name)) provided.add(name);
    }
  }
  return provided;
}

describe('component resolution', () => {
  it('has a Nuxt component manifest to check against', () => {
    expect(
      existsSync(MANIFEST),
      `.nuxt/components.d.ts is missing — run \`bunx nuxi prepare\` first.\n` +
        'This test compares templates against the names Nuxt actually registers;\n' +
        'without the manifest it would silently check nothing.'
    ).toBe(true);
  });

  it('every PascalCase tag resolves to a registered or locally imported component', () => {
    const { names, byStem } = registeredComponents();
    const unresolved: string[] = [];

    for (const file of appVueFiles()) {
      const sfc = parseVue(file);
      if (!sfc.template) continue;

      const template = blankComments(sfc.template.content, 'template');
      // scriptText joins BOTH <script setup> and plain <script>, already
      // comment-blanked — an explicit import in either one is a real provider.
      const provided = locallyProvided(sfc.scriptText ?? '');

      for (const match of new Set([...template.matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>]/g)].map((m) => m[1]!))) {
        if (names.has(match) || provided.has(match) || BUILT_INS.has(match)) continue;
        // Only report a tag whose intended target is identifiable — a bare name
        // matching exactly one component file. Anything else is a tag this test
        // has no business guessing about.
        const suggestion = byStem.get(match);
        unresolved.push(suggestion ? `${sfc.file}: <${match}> → should be <${suggestion}>` : `${sfc.file}: <${match}>`);
      }
    }

    expect(
      unresolved.sort(),
      [
        `${unresolved.length} template tag(s) resolve to nothing and render as empty space:`,
        ...unresolved.map((u) => `  - ${u}`),
        '',
        'Nuxt names a component from its path under app/components, so',
        'profile/ContributorImpact.vue registers as ProfileContributorImpact.',
      ].join('\n')
    ).toEqual([]);
  });
});
