/**
 * Markdown renderer for CMDIY Assistant replies.
 *
 * Separate from `app/utils/markdown.ts`, which renders marketplace messages
 * through a deliberately narrow subset (no headings, tables or code blocks).
 * The assistant needs the wider set, so the two cannot share a config.
 *
 * Everything here is module scope on purpose. When this lived inside
 * MarkdownText.vue's `<script setup>` it ran once per component instance, and
 * two of the three things it does mutate process-wide singletons:
 *
 *   - `marked.use()` / `marked.setOptions()` on the default `marked` export
 *     appended another markedHighlight extension per assistant turn, all of
 *     which then ran on every parse. This module uses its own `new Marked()`
 *     instance, so it cannot affect anything else that imports `marked`.
 *
 *   - `DOMPurify.addHook()` is global and has no per-caller scope. Worse,
 *     `app/utils/markdown.ts` installs its own `afterSanitizeAttributes` hook
 *     forcing `rel="noopener noreferrer nofollow ugc"` on marketplace links.
 *     A second hook setting a plain `rel` runs after it and wins, so the chat
 *     component was in a position to strip `nofollow ugc` off marketplace
 *     message links. There is therefore NO hook here: raw HTML is dropped at
 *     the parser (see the `html` renderer below), so every anchor comes from
 *     our own `link` renderer with safe attributes already set, and DOMPurify
 *     is left as pure defence in depth.
 */

import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';

// A wider subset than the marketplace renderer: the assistant answers with
// headings, spec tables and fenced code. `class` is allowed because
// highlight.js marks up code tokens with classed spans.
const ALLOWED_TAGS = [
  'p',
  'br',
  'span',
  'strong',
  'em',
  'del',
  'code',
  'pre',
  'ul',
  'ol',
  'li',
  'a',
  'blockquote',
  'hr',
  'img',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
];

const ALLOWED_ATTR = ['href', 'title', 'target', 'rel', 'class', 'src', 'alt'];

const FORBID_TAGS = ['script', 'style', 'iframe', 'form', 'input'];

/** Tag outbound links from the assistant so store traffic is attributable. */
function addUtmParameters(url: string): string {
  try {
    const urlObj = new URL(url);

    const utmParams = {
      utm_source: 'diy_chat_bot',
      utm_medium: 'chat',
      utm_campaign: 'assistant_recommendation',
      utm_content: 'chat_response',
    };

    Object.entries(utmParams).forEach(([key, value]) => {
      if (!urlObj.searchParams.has(key)) {
        urlObj.searchParams.set(key, value);
      }
    });

    return urlObj.toString();
  } catch {
    // Relative links and anything unparseable are left alone.
    return url;
  }
}

const marked = new Marked(
  markedHighlight({
    langPrefix: 'language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
  })
);

marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    link({ href, title, tokens }: any) {
      const processedHref = addUtmParameters(href);
      const titleAttr = title ? ` title="${title}"` : '';
      const text = this.parser.parseInline(tokens);
      return `<a href="${processedHref}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
    // Drop raw HTML at the parser. This is what lets us skip a DOMPurify link
    // hook: with no passthrough HTML, every anchor is emitted by `link` above.
    html() {
      return '';
    },
  },
});

/**
 * Render an assistant reply as sanitized HTML. Safe for `v-html`.
 *
 * Returns '' on the server. Chat messages never render during SSR — the page
 * always server-renders the empty state (see the hydration invariant in
 * CLAUDE.md) — and DOMPurify needs a DOM, so emitting the unsanitized string
 * there would be a silent way to ship unsanitized markup if that ever changed.
 */
export function renderAssistantMarkdown(content: string): string {
  if (!content) return '';
  if (!import.meta.client) return '';

  const raw = marked.parse(content, { async: false }) as string;
  return DOMPurify.sanitize(raw, { ALLOWED_TAGS, ALLOWED_ATTR, FORBID_TAGS });
}
