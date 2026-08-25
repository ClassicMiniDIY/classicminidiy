<template>
  <!--
    The caret is a pseudo-element on the last rendered block, not a sibling
    element. Markdown output ends in a block (`<p>`, `<li>`, …), so a sibling
    span was pushed onto a line of its own beneath the text.
  -->
  <div class="markdown-content" :class="{ 'is-streaming': showCursor }" v-html="renderedHtml"></div>
</template>

<script setup lang="ts">
  import { marked } from 'marked';
  import { markedHighlight } from 'marked-highlight';
  import hljs from 'highlight.js';
  import DOMPurify from 'dompurify';
  import type { MarkdownTextProps } from '../../../data/models/chat';

  const props = withDefaults(defineProps<MarkdownTextProps & { showCursor?: boolean }>(), {
    showCursor: false,
  });

  // Function to add UTM parameters to URLs
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

  // Custom renderer for links
  const renderer = new marked.Renderer();
  renderer.link = function ({ href, title, tokens }: any) {
    const processedHref = addUtmParameters(href);
    const titleAttr = title ? ` title="${title}"` : '';
    const text = this.parser.parseInline(tokens);
    return `<a href="${processedHref}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
  };

  marked.use(
    markedHighlight({
      langPrefix: 'language-',
      highlight(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
      },
    })
  );

  marked.setOptions({
    breaks: true,
    gfm: true,
    renderer: renderer,
  });

  // The assistant renders a wider markdown subset than the marketplace message
  // renderer in `app/utils/markdown.ts` — it needs headings, tables and fenced
  // code. `class` is allowed because highlight.js marks up tokens with spans.
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

  let hookInstalled = false;
  function installLinkHardening() {
    if (hookInstalled || !import.meta.client) return;
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.nodeName === 'A') {
        const el = node as Element;
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    });
    hookInstalled = true;
  }

  /**
   * The whole message is parsed on every update, as one document.
   *
   * The previous implementation split the message into "settled" HTML plus a
   * tail of per-word animated spans. Settled content was parsed as a block
   * (`marked.parse`) while the tail was parsed inline (`marked.parseInline`), so
   * whenever a stream chunk landed mid-word the settled half closed a paragraph
   * and the rest of the word rendered after it — "I don" / "'t have specific…"
   * as two blocks. Parsing the cumulative content in one pass cannot produce
   * that; `messages/partial` already sends the full message each time.
   */
  const renderedHtml = computed(() => {
    if (!props.content) return '';
    const raw = marked.parse(props.content) as string;

    if (import.meta.client) {
      installLinkHardening();
      return DOMPurify.sanitize(raw, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input'],
      });
    }

    return raw;
  });
</script>

<style scoped>
  /* Import highlight.js theme */
  @import 'highlight.js/styles/github-dark.css';

  /* NOTE: colours here use daisyUI 5 variable names (`--color-base-content`,
     `--color-primary`, …). This block previously used the daisyUI 4 names
     (`--bc`, `--p`, `--b2`, `--b3`) wrapped in `hsl()`, none of which resolve
     under daisyUI 5 — every colour, border and code background in this
     stylesheet was being dropped by the parser. */

  .markdown-content {
    font-size: 1rem;
    line-height: 1.7;
    color: var(--color-base-content);
    /* Long part numbers and URLs must wrap rather than push the column wide. */
    overflow-wrap: anywhere;
  }

  /* Headings */
  .markdown-content :deep(h1) {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.75rem;
    margin-top: 1.5rem;
  }

  .markdown-content :deep(h2) {
    font-size: 1.25rem;
    font-weight: 700;
    margin-bottom: 0.75rem;
    margin-top: 1.5rem;
  }

  .markdown-content :deep(h3) {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    margin-top: 1.25rem;
  }

  .markdown-content :deep(h4),
  .markdown-content :deep(h5),
  .markdown-content :deep(h6) {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    margin-top: 1rem;
  }

  /* Paragraphs */
  .markdown-content :deep(p) {
    margin-bottom: 1rem;
  }

  /* Lists */
  .markdown-content :deep(ul) {
    list-style-type: disc;
    margin-bottom: 1rem;
    padding-left: 1.5rem;
  }

  .markdown-content :deep(ol) {
    list-style-type: decimal;
    margin-bottom: 1rem;
    padding-left: 1.5rem;
  }

  .markdown-content :deep(li) {
    margin-bottom: 0.375rem;
  }

  .markdown-content :deep(ul ul),
  .markdown-content :deep(ol ol),
  .markdown-content :deep(ul ol),
  .markdown-content :deep(ol ul) {
    margin-top: 0.375rem;
    margin-bottom: 0.375rem;
  }

  /* Links */
  .markdown-content :deep(a) {
    color: var(--color-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
    font-weight: 500;
  }

  .markdown-content :deep(a:hover) {
    text-decoration-thickness: 2px;
  }

  /* Code */
  .markdown-content :deep(code) {
    background-color: var(--color-base-200);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.875em;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  }

  .markdown-content :deep(pre) {
    background-color: #0d1117;
    color: #f0f6fc;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin-bottom: 1rem;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  }

  .markdown-content :deep(pre code) {
    background-color: transparent;
    padding: 0;
    color: inherit;
    /* A code block scrolls inside itself; it must not wrap like prose. */
    overflow-wrap: normal;
  }

  /* Blockquotes */
  .markdown-content :deep(blockquote) {
    border-left: 3px solid var(--color-base-300);
    padding-left: 1rem;
    margin: 1rem 0;
    color: color-mix(in oklch, var(--color-base-content) 75%, transparent);
  }

  /* Tables — scroll inside their own container rather than widening the page. */
  .markdown-content :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1rem;
    display: block;
    overflow-x: auto;
  }

  .markdown-content :deep(th),
  .markdown-content :deep(td) {
    border: 1px solid var(--color-base-300);
    padding: 0.5rem 0.75rem;
    text-align: left;
  }

  .markdown-content :deep(th) {
    background-color: var(--color-base-200);
    font-weight: 600;
  }

  /* Horizontal rules */
  .markdown-content :deep(hr) {
    border: none;
    border-top: 1px solid var(--color-base-300);
    margin: 1.5rem 0;
  }

  .markdown-content :deep(strong) {
    font-weight: 700;
  }

  .markdown-content :deep(em) {
    font-style: italic;
  }

  /* Images */
  .markdown-content :deep(img) {
    max-width: 100%;
    height: auto;
    margin-bottom: 1rem;
    border-radius: 0.375rem;
  }

  /* Remove default margins from first and last elements */
  .markdown-content :deep(> *:first-child) {
    margin-top: 0;
  }

  .markdown-content :deep(> *:last-child) {
    margin-bottom: 0;
  }

  /* Streaming caret, attached to the end of the last block so it sits on the
     same line as the final word rather than dropping below it. */
  .markdown-content.is-streaming :deep(> *:last-child)::after {
    content: '';
    display: inline-block;
    width: 0.375rem;
    height: 1rem;
    background-color: var(--color-primary);
    animation: chatCursorPulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    margin-left: 0.125rem;
    vertical-align: text-bottom;
  }

  /* An empty message still shows a caret while the first token is awaited. */
  .markdown-content.is-streaming:empty::after {
    content: '';
    display: inline-block;
    width: 0.375rem;
    height: 1rem;
    background-color: var(--color-primary);
    animation: chatCursorPulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    vertical-align: text-bottom;
  }

  @keyframes chatCursorPulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.25;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .markdown-content.is-streaming :deep(> *:last-child)::after,
    .markdown-content.is-streaming:empty::after {
      animation: none;
    }
  }
</style>
