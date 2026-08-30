// @vitest-environment node
/**
 * No template may change its STRUCTURE based on auth state that only exists on
 * the client.
 *
 * The Supabase session lives in localStorage, so `useAuth().isAuthenticated` is
 * always false during SSR and flips true after `initAuth()`. A `v-if`/`v-else`
 * pair on that value makes the server emit one subtree and the client's first
 * render want a different one. Vue's hydration repair then MERGES them, and the
 * result is not "a flash of the wrong content" — it is structural DOM
 * corruption. That is what orphaned the account dropdown from its `.dropdown`
 * wrapper: the menu lost `position: absolute` AND its closed-state
 * `display: none` at once, so it rendered permanently visible and off-screen,
 * and took the neighbouring language dropdown down with it.
 *
 * The fix is always the same shape — gate on a `hasMounted` ref:
 *
 *     const hasMounted = ref(false);
 *     onMounted(() => (hasMounted.value = true));
 *     const isSignedIn = computed(() => hasMounted.value && isAuthenticated.value);
 *
 * See `app/components/MainNav.vue` for the reference implementation and
 * `tests/unit/components/main-nav-hydration.test.ts` for its behavioural test.
 *
 * A branch is accepted when it is inside `<ClientOnly>`, inside a subtree
 * already gated by a hasMounted-derived name, or when the identifier itself is
 * hasMounted-derived.
 */
import { describe, expect, it } from 'vitest';
import { parse as parseTemplate } from '@vue/compiler-dom';
import { appVueFiles, blankComments, describeViolations, diffAgainstAllowlist, parseVue } from './_scan';

/** Auth-derived names that are false on the server and true after mount. */
const CLIENT_ONLY_AUTH_NAMES = ['isAuthenticated', 'isAdmin', 'isSustainingMember', 'userProfile', 'user'] as const;

/** Components that render their children only on the client. */
const CLIENT_ONLY_TAGS = new Set(['ClientOnly', 'client-only', 'NuxtClientFallback', 'nuxt-client-fallback']);

/**
 * Known ungated branches, as `file:line::identifier`.
 *
 * These are latent instances of the dropdown bug. They bite less than MainNav
 * did because none is sticky chrome sitting next to another dropdown to
 * clobber — but the mechanism is identical. Gate them when you touch the file;
 * remove the entry in the same commit.
 *
 * `app/pages/dashboard.vue` is the highest-value single entry: it swaps the
 * whole page, so all 14 `/dashboard/*` routes inherit the mismatch.
 */
const KNOWN_UNGATED: readonly string[] = [
  'app/components/Calculators/Alignment.vue:368::isAuthenticated',
  'app/components/Calculators/Gearbox.vue:516::isAuthenticated',
  'app/components/Calculators/GearboxConfigCard.vue:150::isAuthenticated',
  'app/components/exchange/listings/Comment.vue:40::user',
  'app/components/exchange/listings/Comment.vue:47::user',
  'app/components/exchange/listings/Comment.vue:58::isAdmin',
  'app/components/exchange/listings/Comment.vue:69::user',
  'app/components/exchange/listings/CommentSection.vue:21::user',
  'app/components/exchange/listings/SaveSearchButton.vue:2::user',
  'app/components/exchange/listings/wizard/StepPricing.vue:7::isSustainingMember',
  'app/components/exchange/listings/wizard/StepPricing.vue:73::isSustainingMember',
  'app/components/exchange/listings/wizard/StepPricing.vue:134::isSustainingMember',
  'app/components/exchange/listings/wizard/StepPricing.vue:141::isSustainingMember',
  'app/components/exchange/listings/wizard/StepReview.vue:415::isSustainingMember',
  'app/components/models/ModelComments.vue:70::isAuthenticated',
  'app/components/models/ModelComments.vue:120::isAuthenticated',
  'app/pages/archive/documents/[slug].vue:358::isAuthenticated',
  'app/pages/archive/documents/[slug].vue:415::isAuthenticated',
  'app/pages/archive/wheels/[...wheel].vue:257::isAuthenticated',
  'app/pages/contribute/color.vue:217::isAuthenticated',
  'app/pages/contribute/index.vue:74::isAuthenticated',
  'app/pages/contribute/index.vue:125::userProfile',
  'app/pages/dashboard.vue:53::isAuthenticated',
  'app/pages/exchange/finds/index.vue:21::isAuthenticated',
  'app/pages/exchange/finds/index.vue:77::isAuthenticated',
  'app/pages/models/[slug].vue:361::isAuthenticated',
  'app/pages/models/submit-external.vue:38::isAuthenticated',
  'app/pages/models/upload.vue:202::isAuthenticated',
  'app/pages/profile/edit.vue:215::isAuthenticated',
  'app/pages/profile/index.vue:92::isAuthenticated',
  'app/pages/profile/index.vue:134::isSustainingMember',
  'app/pages/profile/index.vue:187::user',
];

/** Whole-word match that ignores property access (`foo.user` is not `user`). */
function referencesName(expression: string, name: string): boolean {
  return new RegExp(`(^|[^\\w.$])${name}\\b`).test(expression);
}

/**
 * Names in this file that already fold in a mount check — either
 * `const isSignedIn = computed(() => hasMounted.value && ...)` or a direct
 * `hasMounted`/`mounted` ref. A branch on one of these is safe, and so is
 * everything inside it.
 */
function gatedNames(script: string): string[] {
  const names = new Set<string>(['hasMounted', 'mounted', 'isMounted']);
  const declaration = /const\s+([A-Za-z_$][\w$]*)\s*=[^;\n]*\b(hasMounted|isMounted|mounted)\b/g;
  for (const match of script.matchAll(declaration)) names.add(match[1]!);
  return [...names];
}

interface Violation {
  id: string;
}

function scanFile(absPath: string): Violation[] {
  const sfc = parseVue(absPath);
  if (!sfc.template) return [];

  const script = blankComments(sfc.script?.content ?? '', 'script');
  const gated = gatedNames(script);
  // A name is only risky if this file has NOT redefined it as mount-aware.
  const risky = CLIENT_ONLY_AUTH_NAMES.filter((name) => !gated.includes(name));
  if (risky.length === 0) return [];

  let ast;
  try {
    ast = parseTemplate(sfc.template.content, { comments: false });
  } catch {
    // A template the compiler cannot parse is a build failure that other
    // tooling will surface far more clearly than this check would.
    return [];
  }

  const templateStart = sfc.template.startLine;
  const lineFor = (offset: number) =>
    templateStart + (sfc.template!.content.slice(0, offset).match(/\n/g)?.length ?? 0);

  const found: Violation[] = [];

  const visit = (node: any, insideSafeSubtree: boolean) => {
    if (node.type !== 1) {
      for (const child of node.children ?? []) visit(child, insideSafeSubtree);
      return;
    }

    let safeHere = insideSafeSubtree || CLIENT_ONLY_TAGS.has(node.tag);

    for (const prop of node.props ?? []) {
      if (prop.type !== 7) continue; // directive
      const expression: string = prop.exp?.content ?? '';
      // A branch on a hasMounted-derived name makes its whole subtree safe.
      if (['if', 'else-if', 'show'].includes(prop.name) && gated.some((n) => referencesName(expression, n))) {
        safeHere = true;
      }
    }

    if (!safeHere) {
      for (const prop of node.props ?? []) {
        if (prop.type !== 7) continue;
        if (prop.name !== 'if' && prop.name !== 'else-if') continue;
        const expression: string = prop.exp?.content ?? '';
        const hit = risky.find((name) => referencesName(expression, name));
        if (hit) found.push({ id: `${sfc.file}:${lineFor(prop.loc.start.offset)}::${hit}` });
      }
    }

    for (const child of node.children ?? []) visit(child, safeHere);
  };

  for (const child of ast.children ?? []) visit(child, false);
  return found;
}

const violations = appVueFiles()
  .flatMap(scanFile)
  .map((v) => v.id);

describe('hydration: structural auth branches', () => {
  it('scans a non-trivial number of templates', () => {
    // Guards against a scanner regression making every assertion vacuous.
    expect(appVueFiles().length).toBeGreaterThan(200);
  });

  it('no template branches structurally on ungated client-only auth state', () => {
    const { unexpected, stale } = diffAgainstAllowlist(violations, KNOWN_UNGATED);
    expect(
      unexpected,
      describeViolations(
        'new ungated auth branches — gate on a hasMounted ref (see app/components/MainNav.vue)',
        unexpected
      )
    ).toEqual([]);
    expect(stale, describeViolations('stale KNOWN_UNGATED entries (the gate landed — drop them)', stale)).toEqual([]);
  });

  it('MainNav stays gated — it is the reference implementation', () => {
    const mainNav = violations.filter((v) => v.startsWith('app/components/MainNav.vue'));
    expect(mainNav, describeViolations('MainNav regressions', mainNav)).toEqual([]);
  });
});
