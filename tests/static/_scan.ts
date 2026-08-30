/**
 * Shared filesystem scanner for the `tests/static/**` invariant suite.
 *
 * These tests do not mount anything. They read the repo the way a linter would
 * and assert contracts that the unit suite structurally cannot see — a page
 * that never renders, a locale that silently falls back, an API path with no
 * handler behind it. Every rule they enforce is one that has already shipped a
 * production defect (see docs/plans/2026-08-30-hardening-and-e2e.md).
 *
 * Everything here is deliberately dependency-light: `@vue/compiler-sfc` for
 * block boundaries (so line numbers in failure messages are real) and Node's
 * own fs. No Nuxt, no Vite, no test server.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseSFC } from '@vue/compiler-sfc';

export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Directories that are never part of the shipped app. `.claude/worktrees/`
 * holds full repo copies from past sessions — the same reason
 * vitest.config.ts excludes it from test discovery. */
const SKIP_DIRS = new Set(['node_modules', '.nuxt', '.output', '.git', '.claude', 'coverage', 'dist']);

/** Recursively collect files under `dir` (repo-relative) matching `ext`. */
export function walk(dir: string, ext: string): string[] {
  const abs = join(REPO_ROOT, dir);
  const out: string[] = [];
  const visit = (current: string) => {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(current, entry);
      if (statSync(full).isDirectory()) visit(full);
      else if (entry.endsWith(ext)) out.push(full);
    }
  };
  visit(abs);
  return out.sort();
}

/** Repo-relative POSIX path, so failure messages are copy-pasteable. */
export function rel(absPath: string): string {
  return relative(REPO_ROOT, absPath).split(sep).join('/');
}

export function read(absPath: string): string {
  return readFileSync(absPath, 'utf8');
}

export interface SfcBlock {
  content: string;
  /** 1-based line in the FILE where this block's content starts. */
  startLine: number;
  attrs: Record<string, string | true>;
}

export interface Sfc {
  file: string;
  raw: string;
  template: SfcBlock | null;
  /** `<script setup>` and plain `<script>` concatenated for text scanning. */
  script: SfcBlock | null;
  i18n: SfcBlock[];
}

function toBlock(block: { content: string; loc: { start: { line: number } }; attrs: any }): SfcBlock {
  return { content: block.content, startLine: block.loc.start.line, attrs: block.attrs ?? {} };
}

export function parseVue(absPath: string): Sfc {
  const raw = read(absPath);
  const { descriptor } = parseSFC(raw, { filename: absPath });
  // scriptSetup is what every component in this repo uses; plain <script> is
  // rare but real (definePageMeta-only blocks), so prefer setup and fall back.
  const scriptBlock = descriptor.scriptSetup ?? descriptor.script;
  return {
    file: rel(absPath),
    raw,
    template: descriptor.template ? toBlock(descriptor.template as any) : null,
    script: scriptBlock ? toBlock(scriptBlock as any) : null,
    i18n: descriptor.customBlocks.filter((b) => b.type === 'i18n').map((b) => toBlock(b as any)),
  };
}

/**
 * Absolute file line for a character offset inside a block's content.
 * `block.startLine` is the line the content begins on, so the offset only ever
 * adds whole newlines to it.
 */
export function lineAt(block: SfcBlock, offset: number): number {
  let line = block.startLine;
  for (let i = 0; i < offset && i < block.content.length; i++) {
    if (block.content[i] === '\n') line++;
  }
  return line;
}

/**
 * Strip HTML comments from a template so a commented-out example never trips a
 * rule, and strip line/block comments from script text for the same reason.
 * Replaces with spaces so every remaining character keeps its offset — line
 * numbers stay accurate.
 */
export function blankComments(source: string, kind: 'template' | 'script'): string {
  const patterns = kind === 'template' ? [/<!--[\s\S]*?-->/g] : [/\/\*[\s\S]*?\*\//g, /(^|[^:])\/\/[^\n]*/g];
  let out = source;
  for (const re of patterns) {
    out = out.replace(re, (match) => match.replace(/[^\n]/g, ' '));
  }
  return out;
}

/** All `.vue` files under `app/`. */
export function appVueFiles(): string[] {
  return walk('app', '.vue');
}

/**
 * Format a violation list for an assertion message. Vitest truncates long
 * diffs, so the count goes first and each entry is one line.
 */
export function describeViolations(title: string, violations: string[]): string {
  return [`${violations.length} ${title}:`, ...violations.map((v) => `  - ${v}`)].join('\n');
}

/**
 * Compare an actual violation set against a seeded allowlist of known ones.
 * Returns the two directions that must both be empty:
 *   `unexpected` — a NEW violation, i.e. a regression. Always fails.
 *   `stale`      — an allowlist entry that no longer violates, i.e. the fix
 *                  landed but its entry was not removed. Also fails, so the
 *                  allowlist can only ever shrink.
 */
export function diffAgainstAllowlist(actual: string[], allowed: readonly string[]) {
  const allowedSet = new Set(allowed);
  const actualSet = new Set(actual);
  return {
    unexpected: actual.filter((v) => !allowedSet.has(v)).sort(),
    stale: [...allowedSet].filter((v) => !actualSet.has(v)).sort(),
  };
}
