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
import { appVueFiles, describeViolations, diffAgainstAllowlist, parseVue } from './_scan';

/** Auth-derived names that are false on the server and true after mount. */
const CLIENT_ONLY_AUTH_NAMES = ['isAuthenticated', 'isAdmin', 'isSustainingMember', 'userProfile', 'user'] as const;

/** Components that render their children only on the client. */
const CLIENT_ONLY_TAGS = new Set(['ClientOnly', 'client-only', 'NuxtClientFallback', 'nuxt-client-fallback']);

/**
 * Known ungated branches, as `file::identifier#ordinal`.
 *
 * EMPTY is the goal state, and it is now the actual state. A new entry here is
 * a regression, not a backlog item.
 *
 * The id deliberately carries NO line number. An earlier version used
 * `file:line::identifier`, and any edit ABOVE a violation shifted its line and
 * made the check report "1 new ungated auth branch" for a branch that had not
 * moved or changed — sending the reader hunting for a regression that did not
 * exist, and inviting them to "fix" it by editing a line number. The ordinal is
 * the Nth occurrence of that identifier in the file, which is stable under
 * unrelated edits. The current line is still printed in the failure message, so
 * finding the branch is no harder.
 *
 * These are latent instances of the dropdown bug. They bite less than MainNav
 * did because none is sticky chrome sitting next to another dropdown to
 * clobber — but the mechanism is identical. Gate them when you touch the file;
 * remove the entry in the same commit.
 *
 * `app/pages/dashboard.vue` is the highest-value single entry: it swaps the
 * whole page, so all 14 `/dashboard/*` routes inherit the mismatch.
 */
const KNOWN_UNGATED: readonly string[] = [];

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
  // Deliberately spans newlines: prettier wraps at printWidth 120, so a real
  // gate is often written as
  //   const isSignedIn = computed(
  //     () => hasMounted.value && isAuthenticated.value
  //   );
  // A single-line-only pattern would call that ungated and push a correctly
  // written component into the allowlist, where the shrink-only rule would
  // then keep it forever. `[^;]*` stops at the statement end, so it cannot run
  // on into an unrelated later declaration.
  const declaration = /const\s+([A-Za-z_$][\w$]*)\s*=[^;]*?\b(hasMounted|isMounted|mounted)\b[^;]*;/g;
  for (const match of script.matchAll(declaration)) names.add(match[1]!);

  // Anything destructured from useMountedAuth() is gated by construction —
  // every value that composable returns folds in the mount check. Handles the
  // renamed form too (`{ isSignedIn: signedIn }`), where the LOCAL name is what
  // the template uses.
  const composable = /const\s*\{([^}]*)\}\s*=\s*useMountedAuth\(\)/g;
  for (const match of script.matchAll(composable)) {
    for (const part of match[1]!.split(',')) {
      const local = (part.split(':')[1] ?? part).trim();
      if (local) names.add(local);
    }
  }
  return [...names];
}

interface Violation {
  /** Line-independent: `file::identifier#ordinal`. */
  id: string;
  /** Current line, for the failure message only. */
  line: number;
}

function scanFile(absPath: string): Violation[] {
  const sfc = parseVue(absPath);
  if (!sfc.template) return [];

  // scriptText covers BOTH script blocks with comments already blanked — a
  // gate declared in a plain <script> alongside <script setup> still counts.
  const gated = gatedNames(sfc.scriptText);
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
  /** Per-identifier occurrence counter, so ids survive edits elsewhere. */
  const seen = new Map<string, number>();

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
      //
      // `v-show` is deliberately NOT in this list. It only toggles CSS
      // `display`, so the element and everything under it is rendered on the
      // server regardless — a descendant `v-if` on client-only state still
      // mismatches. Treating v-show as a gate would silently exempt exactly
      // the bug this test exists to catch.
      if (['if', 'else-if'].includes(prop.name) && gated.some((n) => referencesName(expression, n))) {
        safeHere = true;
      }
    }

    if (!safeHere) {
      for (const prop of node.props ?? []) {
        if (prop.type !== 7) continue;
        if (prop.name !== 'if' && prop.name !== 'else-if') continue;
        const expression: string = prop.exp?.content ?? '';
        const hit = risky.find((name) => referencesName(expression, name));
        if (hit) {
          const ordinal = (seen.get(hit) ?? 0) + 1;
          seen.set(hit, ordinal);
          found.push({ id: `${sfc.file}::${hit}#${ordinal}`, line: lineFor(prop.loc.start.offset) });
        }
      }
    }

    for (const child of node.children ?? []) visit(child, safeHere);
  };

  for (const child of ast.children ?? []) visit(child, false);
  return found;
}

const found = appVueFiles().flatMap(scanFile);
const violations = found.map((v) => v.id);
/** id -> current line, so failures point at the branch without the id carrying it. */
const lineById = new Map(found.map((v) => [v.id, v.line]));
const withLine = (ids: string[]) => ids.map((id) => `${id} (line ${lineById.get(id) ?? '?'})`);

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
        withLine(unexpected)
      )
    ).toEqual([]);
    expect(stale, describeViolations('stale KNOWN_UNGATED entries (the gate landed — drop them)', stale)).toEqual([]);
  });

  it('MainNav stays gated — it is the reference implementation', () => {
    const mainNav = violations.filter((v) => v.startsWith('app/components/MainNav.vue'));
    expect(mainNav, describeViolations('MainNav regressions', mainNav)).toEqual([]);
  });
});
