// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  CHAT_REQUEST_MAX_CHARS,
  CHAT_REQUEST_TRIM_TARGET,
  messageChars,
  transcriptChars,
  windowTranscript,
} from '~~/shared/utils/chatTranscript';

function user(text: string) {
  return { id: `u-${text}`, role: 'user', parts: [{ type: 'text', text }] };
}

/** An assistant turn carrying a reference-tool result, which is where the
 *  characters actually go — `vehicle-weights` returns dozens of rows. */
function assistant(text: string, toolRows = 0) {
  const parts: any[] = [{ type: 'text', text }];
  if (toolRows) {
    parts.push({
      type: 'tool-vehicle-weights',
      toolCallId: `c-${text}`,
      state: 'output-available',
      output: Array.from({ length: toolRows }, (_, i) => ({ item: `Part ${i}`, weight: i * 1.5, unit: 'kg' })),
    });
  }
  return { id: `a-${text}`, role: 'assistant', parts };
}

describe('messageChars', () => {
  it('counts text parts by their text', () => {
    expect(messageChars(user('hello'))).toBe(5);
  });

  it('counts a tool part by its serialised payload, not zero', () => {
    expect(messageChars(assistant('ok', 30))).toBeGreaterThan(1_000);
  });

  it('charges a nominal amount for a part it cannot serialise', () => {
    const cyclic: any = { type: 'tool-x' };
    cyclic.self = cyclic;
    expect(messageChars({ parts: [cyclic] })).toBe(1_000);
  });

  it('tolerates a message with no parts', () => {
    expect(messageChars({})).toBe(0);
    expect(messageChars(null)).toBe(0);
    expect(messageChars(undefined)).toBe(0);
  });
});

describe('windowTranscript', () => {
  const budget = { maxMessages: 24, maxChars: 2_000 };

  it('passes a short conversation through untouched', () => {
    const messages = [user('q1'), assistant('a1'), user('q2')];
    expect(windowTranscript(messages, budget)).toEqual(messages);
  });

  it('drops the oldest turns once the character budget is exceeded', () => {
    const messages = [user('q1'), assistant('a1', 30), user('q2'), assistant('a2', 30), user('q3')];

    const out = windowTranscript(messages, budget);

    expect(transcriptChars(out)).toBeLessThanOrEqual(budget.maxChars);
    expect(out.at(-1)).toBe(messages.at(-1));
    expect(out.length).toBeLessThan(messages.length);
  });

  it('still applies the message-count bound', () => {
    const messages = Array.from({ length: 60 }, (_, i) => (i % 2 ? assistant(`a${i}`) : user(`q${i}`)));
    expect(windowTranscript(messages, { maxMessages: 24, maxChars: 1_000_000 })).toHaveLength(24);
  });

  it('always starts on a user message', () => {
    // A size trim removes one message at a time, so it can land on an assistant
    // turn — which Anthropic rejects as the first message.
    const messages = [user('q1'), assistant('a1', 40), user('q2'), assistant('a2', 40), user('q3')];

    for (const maxChars of [500, 1_000, 2_000, 3_000, 4_000, 6_000]) {
      const out = windowTranscript(messages, { maxMessages: 24, maxChars });
      expect(out[0]!.role, `maxChars=${maxChars}`).toBe('user');
    }
  });

  it('keeps the final message even when it alone is over budget', () => {
    const huge = user('X'.repeat(50_000));
    const messages = [user('q1'), assistant('a1'), huge];

    expect(windowTranscript(messages, budget)).toEqual([huge]);
  });

  it('returns an empty array for an empty conversation', () => {
    expect(windowTranscript([], budget)).toEqual([]);
  });

  it('never returns fewer than one message', () => {
    expect(windowTranscript([user('only')], { maxMessages: 0, maxChars: 0 })).toHaveLength(1);
  });

  it('does not mutate the input', () => {
    const messages = [user('q1'), assistant('a1', 30), user('q2'), assistant('a2', 30), user('q3')];
    const snapshot = JSON.stringify(messages);

    windowTranscript(messages, budget);

    expect(JSON.stringify(messages)).toBe(snapshot);
  });
});

describe('the client and server budgets', () => {
  it('leaves the client room below the route ceiling', () => {
    // The route measures AFTER compacting stale searches, so its total is the
    // smaller of the two. The margin covers the one compaction that can grow a
    // message: a failed search replaced by a fixed note.
    expect(CHAT_REQUEST_TRIM_TARGET).toBeLessThan(CHAT_REQUEST_MAX_CHARS);
  });

  it('fits a browsing conversation that fills the message window', () => {
    // The regression this pair exists to prevent: twenty-four messages of
    // reference-tool answers passed the count bound and failed the character
    // one, so every further send 413'd with no way out but New chat.
    const messages = Array.from({ length: 24 }, (_, i) => (i % 2 ? assistant(`a${i}`, 60) : user(`q${i}`)));

    const out = windowTranscript(messages, { maxMessages: 24, maxChars: CHAT_REQUEST_TRIM_TARGET });

    expect(transcriptChars(out)).toBeLessThanOrEqual(CHAT_REQUEST_MAX_CHARS);
    expect(out[0]!.role).toBe('user');
  });
});
