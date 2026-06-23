/**
 * Markdown renderer for chat messages.
 *
 * Supports a deliberately narrow subset of CommonMark/GFM:
 *   - Bold, italic, strikethrough
 *   - Inline code and fenced code blocks
 *   - Bulleted and numbered lists
 *   - Links (forced to open in a new tab with noopener/noreferrer/nofollow/ugc)
 *   - Line breaks
 *
 * Disallowed: headings, blockquotes, tables, images, raw HTML.
 *
 * On the client, output is sanitized with DOMPurify.
 * On the server (SSR), we rely on marked's controlled renderer (raw HTML is
 * disabled) and simple tag-stripping — the client re-sanitizes during hydration.
 *
 * This avoids pulling jsdom into the production server bundle, which caused
 * ESM/CJS crashes with html-encoding-sniffer.
 */

import { Marked } from 'marked';

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'del',
  'code',
  'pre',
  'ul',
  'ol',
  'li',
  'a',
];

const ALLOWED_ATTR = ['href', 'target', 'rel'];

// Configure a marked instance that ignores headings and blockquotes by
// rendering them as plain paragraphs. Raw HTML is disabled by default.
const marked = new Marked({
  gfm: true,
  breaks: true,
});

marked.use({
  renderer: {
    heading({ tokens }) {
      // Collapse headings to paragraphs so `# big` shows as plain text.
      return `<p>${this.parser.parseInline(tokens)}</p>`;
    },
    blockquote({ tokens }) {
      return `<p>${this.parser.parse(tokens)}</p>`;
    },
    image() {
      // Inline markdown images are not allowed in chat.
      return '';
    },
    html() {
      // Strip any raw HTML that slipped past marked.
      return '';
    },
  },
});

// Lazy-loaded DOMPurify instance (client-only)
let purifyInstance: typeof import('dompurify').default | null = null;
let hooksInstalled = false;

async function getPurify() {
  if (purifyInstance) return purifyInstance;
  const mod = await import('dompurify');
  purifyInstance = mod.default;
  return purifyInstance;
}

/**
 * DOMPurify hook: force safe link attributes on every <a> tag.
 */
function installLinkHardening(purify: typeof import('dompurify').default) {
  if (hooksInstalled) return;
  purify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName === 'A') {
      const el = node as Element;
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer nofollow ugc');
    }
  });
  hooksInstalled = true;
}

/**
 * Server-side fallback: strip disallowed HTML tags.
 * Since our marked renderer already blocks raw HTML, headings, images, etc.,
 * this is a belt-and-suspenders measure. The client re-sanitizes with DOMPurify.
 */
function serverSanitize(html: string): string {
  const allowedTagPattern = ALLOWED_TAGS.join('|');
  // Remove any tag that isn't in our allowed list
  return html.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
    if (ALLOWED_TAGS.includes(tag.toLowerCase())) {
      return match;
    }
    return '';
  });
}

/**
 * Force safe attributes on links in the server-side output.
 * Also strips dangerous protocols (javascript:, data:, vbscript:).
 */
function serverHardenLinks(html: string): string {
  return html.replace(/<a(\s+[^>]*)?>/gi, (_match, attrs = '') => {
    // Handle double-quoted, single-quoted, or unquoted href values
    const hrefMatch = attrs.match(/href=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const href = hrefMatch ? (hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3] ?? '') : '';
    // Strip dangerous protocols
    const normalized = href.replace(/\s/g, '').toLowerCase();
    if (normalized.startsWith('javascript:') || normalized.startsWith('data:') || normalized.startsWith('vbscript:')) {
      return '<a href="" target="_blank" rel="noopener noreferrer nofollow ugc">';
    }
    // Escape any quotes in the href to prevent attribute injection
    const safeHref = href.replace(/"/g, '&quot;');
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer nofollow ugc">`;
  });
}

/**
 * Render a user-supplied message as sanitized HTML.
 * Safe for `v-html`.
 */
export function renderMessageMarkdown(content: string): string {
  if (!content) return '';
  const rawHtml = marked.parse(content, { async: false }) as string;

  // Client: full DOMPurify sanitization
  if (import.meta.client) {
    // DOMPurify is loaded synchronously after the first async load.
    // On SSR-hydrated pages, the client will re-render so the first paint
    // uses the server output, then the client takes over with full sanitization.
    if (purifyInstance) {
      installLinkHardening(purifyInstance);
      return purifyInstance.sanitize(rawHtml, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        FORBID_TAGS: ['img', 'script', 'style', 'iframe'],
      });
    }
    // Trigger lazy load for next render; return server-sanitized for now
    getPurify().then((p) => installLinkHardening(p));
  }

  // Server (or client before DOMPurify loads): lightweight sanitization
  return serverHardenLinks(serverSanitize(rawHtml));
}

/**
 * Strip markdown formatting for plaintext contexts (email previews, notifications).
 * Not a complete markdown-to-text converter, but covers the formatting we allow.
 */
export function stripMessageMarkdown(content: string): string {
  if (!content) return '';
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}
