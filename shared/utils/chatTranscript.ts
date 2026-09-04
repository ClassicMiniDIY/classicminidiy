/**
 * The size half of the chat request contract, shared by both ends.
 *
 * `/api/chat` refuses a body over `CHAT_REQUEST_MAX_CHARS`. The client windows
 * every request so that refusal cannot happen during an honest conversation —
 * see `REQUEST_MESSAGE_WINDOW` in `ChatWindow.vue`, whose whole reason for
 * existing is that a 413 reaches the visitor as "something went wrong, please
 * try again", advice that can never work.
 *
 * That contract only holds if both ends measure the same way, which is why the
 * budget and the measurement live here rather than being restated on each side.
 * Counting messages is not enough on its own: an assistant turn that called
 * `vehicle-weights` or `torque-specs` carries thousands of characters of rows,
 * so twenty-four messages can be anywhere between a few hundred characters and
 * well past the ceiling.
 *
 * Client-safe: plain functions and constants, no H3 and no imports. It ships in
 * the public bundle.
 */

/**
 * Ceiling on a single request body, in characters.
 *
 * This bounds what a scripted caller can push into a model on an
 * UNAUTHENTICATED endpoint. It is deliberately not the conversation-length
 * control — `MAX_MESSAGES` is — and it is not everyday UX either, because the
 * client trims to fit before it ever sends.
 *
 * It was 24,000, went to 120,000 when `web_search` was added because one turn's
 * encrypted search results no longer fitted inside the whole budget, and came
 * back to 40,000 once `server/agent/transcript.ts` began compacting a finished
 * search on replay. Measured on the live path across one conversation:
 * 22,666 -> 10,367 characters replayed, then 23,847 -> 11,548.
 */
export const CHAT_REQUEST_MAX_CHARS = 40_000;

/**
 * Trim the client's request to fit, with room to spare.
 *
 * The server measures AFTER compacting stale searches, so its total is the
 * smaller of the two and this margin is already conservative. It is here for
 * the one direction that could still surprise: a compaction that replaces a
 * near-empty part with a fixed note, which grows the payload by tens of
 * characters rather than shrinking it.
 */
export const CHAT_REQUEST_TRIM_TARGET = 36_000;

/**
 * Approximate the size a message contributes to the prompt.
 *
 * Counts EVERY part, not just text. The client replays the conversation each
 * turn, and an assistant turn carries tool parts whose `output` can dwarf the
 * prose — `wheel-search` and `torque-specs` return dozens of rows, and
 * `site-search` up to twenty results. Counting text alone let a tool-heavy
 * conversation read as a few hundred characters while carrying tens of
 * thousands into the model, so the ceiling this exists to enforce did not hold.
 */
export function messageChars(message: { parts?: unknown[] } | null | undefined): number {
  let total = 0;
  for (const part of message?.parts ?? []) {
    const anyPart = part as any;
    if (anyPart?.type === 'text' && typeof anyPart.text === 'string') {
      total += anyPart.text.length;
      continue;
    }
    // Tool parts, reasoning, files: measure the serialised payload. A part that
    // cannot be serialised (a cycle) is charged a nominal amount rather than
    // throwing — this is a size estimate, not a validator.
    try {
      total += JSON.stringify(anyPart)?.length ?? 0;
    } catch {
      total += 1_000;
    }
  }
  return total;
}

export function transcriptChars(messages: readonly { parts?: unknown[] }[]): number {
  return messages.reduce((sum, message) => sum + messageChars(message), 0);
}

/**
 * The longest trailing run of messages that fits inside both budgets.
 *
 * Trailing, because the newest turns are the ones the answer depends on, and
 * because dropping from the front is what keeps a long conversation usable
 * instead of dead.
 *
 * The result always STARTS on a user message. Dropping one message at a time
 * can otherwise leave an assistant turn first, and Anthropic rejects a
 * conversation that opens with one. The count-only window this replaced never
 * hit that because it took an even number from a list ending in a user message,
 * so parity did the work silently — a size-driven trim removes an odd number
 * whenever it wants to, and the invariant has to be stated rather than implied.
 *
 * ALWAYS returns at least the final message, even when that one message is over
 * budget on its own — someone who pastes a whole forum thread should get the
 * route's own 413 rather than an empty `messages` array and a 400 that says
 * something else. Trimming cannot fix that case and should not pretend to.
 */
export function windowTranscript<T extends { role?: string; parts?: unknown[] }>(
  messages: readonly T[],
  options: { maxMessages: number; maxChars: number }
): T[] {
  if (messages.length === 0) return [];

  const candidates = messages.slice(-Math.max(1, options.maxMessages));
  const last = candidates.length - 1;

  let start = 0;
  let total = transcriptChars(candidates);
  while (total > options.maxChars && start < last) {
    total -= messageChars(candidates[start]!);
    start += 1;
  }
  while (start < last && candidates[start]!.role !== 'user') {
    start += 1;
  }

  return candidates.slice(start);
}
