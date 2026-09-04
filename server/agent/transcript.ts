import type { UIMessage } from 'ai';

/**
 * Drop replayed `web_search` machinery that only the turn that ran the search
 * could ever use.
 *
 * The chat client stores the whole conversation and POSTs all of it back on
 * every message, so an assistant turn that ran a search carries that search
 * forward for the rest of the conversation. Anthropic returns an opaque
 * `encryptedContent` blob per `web_search_result` — the verbatim page text a
 * citation points into — and it dominates the payload. Measured on the live
 * path: one `tool-web_search` part serialises to **18,520 characters**, of
 * which the urls, titles and page ages are about 2,300.
 *
 * All of that exists to let the model CITE a page while it is answering. Once
 * the answer is finished the citations are baked into the stored message and no
 * later turn can add one to it, so replaying the blob buys nothing and is
 * charged as input tokens on every subsequent message.
 *
 * ## Why the part goes rather than just the blob
 *
 * Emptying `encryptedContent` and replaying the rest is the obvious version of
 * this and it does not work: the API answers
 * `Invalid encrypted_content in search_result block`. The blob is validated, not
 * merely carried, so the only options are all of it or none of it.
 *
 * So a prior search becomes a short text note naming the query and the pages it
 * returned. That keeps the part of the result a later turn can actually reason
 * about — which sources were consulted — in a form the API has no opinion about.
 *
 * `anthropic.citations` on text parts has to go with it. A citation is a pointer
 * INTO a search result (`web_search_result_location`, carrying its own
 * `encrypted_index`), so leaving them behind would replay pointers to results
 * that are no longer in the message. They are also only needed on the way out:
 * the client already stored them, and the rendered links in an earlier answer
 * come from that stored copy, not from anything sent back here.
 *
 * ## Which turns are exempt
 *
 * Only a TRAILING assistant message, and it never occurs on this route.
 *
 * The obvious exemption is "the most recent assistant turn", on the theory that
 * its citations might still be in flight. They cannot be. Citations are produced
 * inside one `streamText` call, and that call's multi-step loop keeps its own
 * response content — it never comes back through here. Every assistant message
 * in a request BODY is a turn that already finished streaming to the browser,
 * whether it is the last one or the first.
 *
 * Exempting the last one anyway would also undo the point of the change: a turn
 * may run up to `maxUses` searches (4, in `webSearchTool`), so one exempt turn is
 * worth ~80,000 characters on its own and `MAX_CHARS` could not come down.
 *
 * The one shape that would genuinely be mid-turn is the AI SDK's client-side
 * tool resubmission, where the client POSTs a message list ENDING in an
 * assistant message for the model to continue. `/api/chat` has no client-side
 * tools so it cannot produce one, but the guard costs a comparison and the
 * failure it prevents is a corrupted turn.
 */

/** The part type the AI SDK gives Anthropic's provider-executed search. The key
 *  in `buildAgentTools` is `web_search` because that is the name Anthropic
 *  itself requires, and the UI part type is that name with a `tool-` prefix. */
const WEB_SEARCH_PART = 'tool-web_search';

/** Truncation for a page title inside the replacement note. Long enough to tell
 *  two Mini Spares part pages apart, short enough that ten of them stay small. */
const MAX_TITLE = 120;

/** Pages named in the note. `maxUses` is 4 and each search returns up to ten
 *  results, so an unbounded list is the one way this could stop being small. */
const MAX_RESULTS_LISTED = 10;

function isWebSearchPart(part: any): boolean {
  if (part?.type === WEB_SEARCH_PART) return true;
  // A dynamic tool part names the tool in a field instead of in `type`. The
  // agent registers `web_search` statically, but a client replaying an older
  // stored conversation is not something this helper should assume about.
  return part?.type === 'dynamic-tool' && part?.toolName === 'web_search';
}

/** The results array, wherever the transport put it. A tool UI part holds the
 *  tool's own return value directly; a model message wraps it as
 *  `{ type: 'json', value }`. Accept both rather than silently skipping a
 *  payload this exists to shrink. */
function resultsOf(output: any): any[] | null {
  if (Array.isArray(output)) return output;
  if (output && typeof output === 'object' && Array.isArray(output.value)) return output.value;
  return null;
}

/** A prior search, as a line of prose. Empty string when there is nothing worth
 *  saying, which tells the caller to drop the part outright — a search that
 *  errored or never completed has no urls to preserve. */
function summarise(part: any): string {
  const query = typeof part?.input?.query === 'string' ? part.input.query.trim() : '';
  const results = resultsOf(part?.output) ?? [];

  const pages = results
    .filter((result: any) => result && typeof result.url === 'string')
    .slice(0, MAX_RESULTS_LISTED)
    .map((result: any) => {
      const title = typeof result.title === 'string' ? result.title.slice(0, MAX_TITLE) : '';
      return title ? `${title} (${result.url})` : result.url;
    });

  if (!pages.length) return '';
  const dropped = results.length - pages.length;
  const more = dropped > 0 ? `, and ${dropped} more` : '';
  const asked = query ? ` for "${query}"` : '';
  return `[An earlier web search${asked} returned: ${pages.join('; ')}${more}. The page text is no longer attached, so cite it again only after searching again.]`;
}

/** Whether a part becomes content in the message Anthropic receives.
 *
 *  A search that errored has no urls, so it leaves nothing behind — and an
 *  assistant turn whose ONLY part was that search would convert to a message
 *  with empty content, which the API rejects outright. Cheaper to notice here
 *  than to debug as a 400 on a conversation nobody can reproduce. */
function isSubstantive(part: any): boolean {
  const type = part?.type;
  if (typeof type !== 'string') return false;
  return (
    type === 'text' || type === 'reasoning' || type === 'file' || type.startsWith('tool-') || type === 'dynamic-tool'
  );
}

/** Strip Anthropic's citation pointers from one part's provider metadata,
 *  returning `null` when there were none — the caller then keeps the original
 *  object rather than copying it. */
function withoutCitations(part: any): any | null {
  const anthropic = part?.providerMetadata?.anthropic;
  if (!anthropic || typeof anthropic !== 'object' || !('citations' in anthropic)) return null;

  const { citations: _dropped, ...rest } = anthropic;
  const metadata = { ...part.providerMetadata, anthropic: rest };
  return { ...part, providerMetadata: metadata };
}

/**
 * Compact every `web_search` result in a finished assistant turn.
 *
 * Returns a new array and never mutates the input: `messages` comes straight off
 * the request body, and the size guard in the chat route measures the result of
 * this function, so the two must not be reading the same objects through
 * different names. Messages and parts that need no change are passed through by
 * reference, which is the whole conversation in the common case where nobody
 * searched.
 */
export function stripStaleWebSearchContent(messages: UIMessage[]): UIMessage[] {
  // A trailing assistant message is the only turn that could still be running.
  const openTurn = messages.length - 1;
  const isOpen = messages[openTurn]?.role === 'assistant';

  let touched = false;
  const next = messages.map((message, index) => {
    if (isOpen && index === openTurn) return message;
    const parts = message?.parts;
    if (!Array.isArray(parts)) return message;

    let changed = false;
    const nextParts: any[] = [];

    for (const part of parts as any[]) {
      if (isWebSearchPart(part)) {
        changed = true;
        const note = summarise(part);
        if (note) nextParts.push({ type: 'text', text: note });
        continue;
      }
      const cleaned = withoutCitations(part);
      if (cleaned) {
        changed = true;
        nextParts.push(cleaned);
        continue;
      }
      nextParts.push(part);
    }

    if (!changed) return message;
    if (!nextParts.some(isSubstantive)) {
      nextParts.push({ type: 'text', text: '[An earlier web search returned nothing usable.]' });
    }
    touched = true;
    return { ...message, parts: nextParts } as UIMessage;
  });

  // The common case is a conversation that never searched. Handing back the
  // same array keeps that free and makes "nothing was stripped" observable.
  return touched ? next : messages;
}
