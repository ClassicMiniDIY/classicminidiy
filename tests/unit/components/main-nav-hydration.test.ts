/**
 * Guards the two invariants behind a bug that kept coming back: the account
 * dropdown in the global header rendering permanently, off-screen, to the right.
 *
 * Root cause was never CSS. The Supabase session lives in localStorage, so
 * `useAuth().isAuthenticated` is ALWAYS false during SSR and flips true on the
 * client. `MainNav` branched a `v-if`/`v-else` pair straight off it, so the
 * server emitted the signed-OUT subtree while the client's first render wanted
 * the signed-IN one. Vue's hydration repair merged them: the signed-out wrapper
 * survived and the account `<ul class="dropdown-content">` was patched into it,
 * orphaned from any `.dropdown` ancestor.
 *
 * That orphaning is what produced BOTH symptoms, because every daisyUI rule that
 * positions or hides a menu is scoped `.dropdown … .dropdown-content`:
 *   - no `position: absolute`  -> laid out in the header's flex row, spilling right
 *   - no closed-state `display: none` -> permanently visible
 *
 * So: test 1 stops the mismatch at the source, test 2 asserts the structural
 * invariant it violated. Verified in Firefox 154 — every prior fix was checked
 * in a Chromium preview pane, which is why this survived repeated "fixes".
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from '@vue/compiler-sfc';

const APP_DIR = join(process.cwd(), 'app');
const MAIN_NAV = join(APP_DIR, 'components', 'MainNav.vue');

function vueFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) vueFiles(full, acc);
    else if (entry.endsWith('.vue')) acc.push(full);
  }
  return acc;
}

const CLASS_OF = (node: any): string => {
  for (const prop of node.props ?? []) {
    // Static class only. A `:class` binding can't be resolved statically, and
    // nothing in this codebase builds `dropdown`/`dropdown-content` dynamically.
    if (prop.type === 6 && prop.name === 'class') return prop.value?.content ?? '';
  }
  return '';
};

describe('MainNav hydration safety', () => {
  const src = readFileSync(MAIN_NAV, 'utf-8');

  it('never branches structurally on ungated auth state', () => {
    // `v-if`/`v-else-if` change STRUCTURE, so an SSR/client disagreement
    // corrupts the DOM. Route them through a mounted-gated computed instead.
    const offenders = [...src.matchAll(/v-(?:if|else-if)="([^"]*)"/g)]
      .map((m) => m[1] as string)
      .filter((expr) => /\b(isAuthenticated|isAdmin)\b/.test(expr))
      .filter((expr) => !/\bhasMounted\b/.test(expr));

    expect(
      offenders,
      'Bind these to a hasMounted-gated computed (isSignedIn / showAdminLink), ' +
        'or the server and the client render different structures and Vue orphans nodes.'
    ).toEqual([]);
  });

  it('defines the mounted gate the template relies on', () => {
    expect(src).toMatch(/const hasMounted = ref\(false\)/);
    expect(src).toMatch(/onMounted\(\(\) => \(hasMounted\.value = true\)\)/);
    expect(src).toMatch(/const isSignedIn = computed\(\(\) => hasMounted\.value && isAuthenticated\.value\)/);
    expect(src).toMatch(/const showAdminLink = computed\(\(\) => hasMounted\.value && isAdmin\.value\)/);
  });
});

describe('dropdown structure', () => {
  it('never orphans a .dropdown-content from its .dropdown wrapper', () => {
    const orphans: string[] = [];

    for (const file of vueFiles(APP_DIR)) {
      const { descriptor } = parse(readFileSync(file, 'utf-8'), { filename: file });
      const root = descriptor.template?.ast;
      if (!root) continue;

      const walk = (node: any, insideDropdown: boolean) => {
        const cls = CLASS_OF(node);
        // `dropdown-content` contains `dropdown` as a substring, so match tokens.
        const tokens = cls.split(/\s+/);
        const isContent = tokens.includes('dropdown-content');
        const isWrapper = tokens.includes('dropdown');

        if (isContent && !insideDropdown && !isWrapper) {
          orphans.push(`${relative(process.cwd(), file)}:${node.loc?.start?.line} (class="${cls}")`);
        }
        for (const child of node.children ?? []) {
          if (child.type === 1) walk(child, insideDropdown || isWrapper);
        }
      };

      for (const child of root.children ?? []) if (child.type === 1) walk(child, false);
    }

    expect(
      orphans,
      'A .dropdown-content outside a .dropdown gets none of daisyUI\'s scoped rules: ' +
        'no position:absolute and no closed-state display:none, so it renders in normal ' +
        'flow, always visible, and spills off-screen.'
    ).toEqual([]);
  });
});
