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
  // `<i>` is here for the Font Awesome glyph inside a YouTube card, not for
  // italics — marked emits `<em>` for those. CLAUDE.md requires the FA class
  // form (`<i class="fas fa-play">`), and the Kit needs the element to survive
  // sanitisation to swap it.
  'i',
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

/**
 * The YouTube video id in a watch or short-form URL, or '' for anything else.
 *
 * Parsed with `URL`, never a regex over the raw href. A regex that matches
 * "youtube.com" anywhere in a string also matches
 * `https://evil.example/?x=youtube.com/watch?v=…`, which would render an
 * attacker-chosen thumbnail inside a card that reads as Cole's own video. The
 * hostname check below is an exact match against a known list, after parsing.
 *
 * Only `youtube.com/watch?v=`, `youtu.be/<id>` and `youtube.com/shorts/<id>`
 * are recognised. A channel page, a playlist or a search URL is left as an
 * ordinary link, because a card promises a single watchable video.
 */
function youtubeVideoId(href: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return '';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let id = '';

  if (host === 'youtu.be') {
    id = url.pathname.slice(1);
  } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v') ?? '';
    else if (url.pathname.startsWith('/shorts/')) id = url.pathname.slice('/shorts/'.length);
  }

  // YouTube ids are 11 characters of URL-safe base64. Anything else is not one,
  // and the id is interpolated into an <img src>, so this is the check that
  // keeps it from being interpolated into something else.
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
}

/**
 * Escape a string for interpolation into an HTML attribute or text node.
 *
 * The card is built by string concatenation, so anything interpolated has to be
 * escaped HERE — the sanitizer runs afterwards and is defence in depth, not the
 * primary control. Validating a PARSED copy of a URL and then emitting the RAW
 * original is the specific mistake this closes: `?v=dQw4w9WgXcQ&z="onmouseover="…`
 * passes the id check (v is a valid 11-character id) while the untouched href
 * still carries the quotes that break out of the attribute.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * A YouTube link, rendered as a card rather than an underlined URL.
 *
 * Cole's videos are frequently the best answer the assistant can give, and a
 * bare `https://www.youtube.com/watch?v=…` in the middle of a paragraph reads
 * as noise. This gives one the thumbnail and a play glyph, so it looks like
 * what it is.
 *
 * Emitted as `<a>`, `<span>` and `<img>` with `href`, `class`, `src` and `alt`
 * — every one of which is ALREADY in ALLOWED_TAGS/ALLOWED_ATTR above. That is
 * deliberate: the card needs no change to the sanitizer, so it cannot widen
 * what an assistant reply is permitted to emit. The `html` renderer still drops
 * raw HTML, so this markup can only come from here.
 *
 * NO UTM PARAMETERS. `addUtmParameters` tags outbound links so store traffic is
 * attributable; a YouTube watch URL with query parameters appended is a link
 * YouTube may handle differently, and the video id is the only thing in it that
 * should matter.
 */
function youtubeCard(videoId: string, href: string, label: string): string {
  // `label` arrives as marked's ALREADY-ESCAPED inline HTML with its tags
  // stripped by the caller, so it must not be escaped a second time — that
  // would render "Rock &amp; Roll" as "Rock &amp;amp; Roll". `videoId` passed a
  // strict `[A-Za-z0-9_-]{11}` test, so the thumbnail URL cannot carry anything.
  // `href` is the one value that is neither escaped nor constrained.
  const safeLabel = label.trim() || 'Watch on Classic Mini DIY';
  const safeHref = escapeHtml(href);
  const thumbnail = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
  return (
    `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="chat-video-card">` +
    `<span class="chat-video-card__thumb">` +
    `<img src="${thumbnail}" alt="" loading="lazy" />` +
    `<span class="chat-video-card__play"><i class="fas fa-play"></i></span>` +
    `</span>` +
    `<span class="chat-video-card__body">` +
    `<span class="chat-video-card__title">${safeLabel}</span>` +
    `<span class="chat-video-card__meta">Classic Mini DIY on YouTube</span>` +
    `</span>` +
    `</a>`
  );
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
      const text = this.parser.parseInline(tokens);

      // A YouTube video becomes a card. Checked BEFORE the UTM tagging below,
      // because a watch URL should reach YouTube with nothing appended.
      const videoId = youtubeVideoId(href);
      if (videoId) {
        // `text` is already-parsed inline HTML. A card's title is plain text, so
        // any markup in the link label is stripped rather than nested inside the
        // card — and stripping it here means the card cannot smuggle a tag past
        // the tag list.
        return youtubeCard(videoId, href, text.replace(/<[^>]*>/g, ''));
      }

      const processedHref = addUtmParameters(href);
      const titleAttr = title ? ` title="${title}"` : '';
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
