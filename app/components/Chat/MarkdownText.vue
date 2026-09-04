<template>
  <!--
    The caret is a pseudo-element on the last rendered block, not a sibling
    element. Markdown output ends in a block (`<p>`, `<li>`, …), so a sibling
    span was pushed onto a line of its own beneath the text.
  -->
  <div class="markdown-content" :class="{ 'is-streaming': showCursor }" v-html="renderedHtml"></div>
</template>

<script setup lang="ts">
  import { renderAssistantMarkdown } from '~/utils/chatMarkdown';
  import type { MarkdownTextProps } from '../../../data/models/chat';

  const props = withDefaults(defineProps<MarkdownTextProps>(), {
    showCursor: false,
  });

  /**
   * The whole message is parsed on every update, as one document.
   *
   * The previous implementation split the message into "settled" HTML plus a
   * tail of per-word animated spans. Settled content was parsed as a block
   * (`marked.parse`) while the tail was parsed inline (`marked.parseInline`), so
   * whenever a stream chunk landed mid-word the settled half closed a paragraph
   * and the rest of the word rendered after it — "I don" / "'t have specific…"
   * as two blocks. Parsing the cumulative content in one pass cannot produce
   * that.
   *
   * But `messages/partial` is cumulative and arrives roughly per token, so
   * rendering `props.content` directly would re-parse and re-sanitize the whole
   * growing message hundreds of times for one answer — quadratic in reply
   * length, and visible as dropped frames on a phone. While streaming we
   * therefore coalesce updates onto one animation frame; once the stream ends
   * the final content is rendered synchronously so nothing is left truncated.
   */
  const displayContent = ref(props.content);
  let frame: number | null = null;

  function cancelFrame() {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  }

  watch(
    () => [props.content, props.showCursor] as const,
    ([content, streaming]) => {
      if (!streaming || !import.meta.client) {
        // Settle immediately: this is the final content for this message.
        cancelFrame();
        displayContent.value = content;
        return;
      }

      if (frame !== null) return; // An update is already queued for this frame.
      frame = requestAnimationFrame(() => {
        frame = null;
        displayContent.value = props.content;
      });
    },
    { immediate: true }
  );

  onUnmounted(cancelFrame);

  const renderedHtml = computed(() => renderAssistantMarkdown(displayContent.value));
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

  /* YouTube cards.
     Emitted by `youtubeCard()` in app/utils/chatMarkdown.ts when the assistant
     links one of Cole's videos. `display: flex` on the anchor is what turns it
     from an inline underlined URL into a card; `text-decoration: none` has to
     override the link rule above, which is why this block follows it. */
  .markdown-content :deep(a.chat-video-card) {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0.75rem 0;
    padding: 0.5rem;
    border: 1px solid var(--color-base-300);
    border-radius: 0.625rem;
    background-color: var(--color-base-200);
    text-decoration: none;
    font-weight: 400;
    color: var(--color-base-content);
    transition: border-color 0.15s ease;
  }

  .markdown-content :deep(a.chat-video-card:hover) {
    border-color: var(--color-error);
    text-decoration: none;
  }

  .markdown-content :deep(.chat-video-card__thumb) {
    position: relative;
    flex-shrink: 0;
    width: 7.5rem;
    aspect-ratio: 16 / 9;
    border-radius: 0.375rem;
    overflow: hidden;
    background-color: var(--color-base-300);
  }

  /* Overrides the generic image rule below — a thumbnail has no bottom margin
     and must fill its box rather than keep its intrinsic height. */
  .markdown-content :deep(.chat-video-card__thumb img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    margin-bottom: 0;
    border-radius: 0;
  }

  .markdown-content :deep(.chat-video-card__play) {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 0.75rem;
  }

  .markdown-content :deep(.chat-video-card__play i) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 9999px;
    background-color: var(--color-error);
  }

  .markdown-content :deep(.chat-video-card__body) {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .markdown-content :deep(.chat-video-card__title) {
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--color-primary);
    /* A long video title must not push the transcript column wide. */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .markdown-content :deep(.chat-video-card__meta) {
    font-size: 0.75rem;
    color: color-mix(in oklch, var(--color-base-content) 60%, transparent);
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
