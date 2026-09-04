// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { UIMessage } from 'ai';
import { stripStaleWebSearchContent } from '~~/server/agent/transcript';

/** A web-search result in the shape `@ai-sdk/anthropic` hands to the UI. */
function result(url: string, title: string | null = `Title for ${url}`) {
  return {
    type: 'web_search_result',
    url,
    title,
    pageAge: 'March 3, 2024',
    // Stands in for the real blob, which measured ~14k characters across a
    // whole part on the live path.
    encryptedContent: 'E'.repeat(5_000),
  };
}

function searchPart(urls: string[], query = 'fuel filter 1996 spi') {
  return {
    type: 'tool-web_search',
    toolCallId: `call-${urls[0]}`,
    state: 'output-available',
    providerExecuted: true,
    input: { query },
    output: urls.map((url) => result(url)),
  };
}

/** A text part carrying the citation pointers Anthropic streams alongside an
 *  answer. `encrypted_index` points INTO a search result, which is why these
 *  cannot outlive it. */
function citedText(text: string, url: string) {
  return {
    type: 'text',
    text,
    state: 'done',
    providerMetadata: {
      anthropic: {
        citations: [
          {
            type: 'web_search_result_location',
            cited_text: text,
            url,
            title: `Title for ${url}`,
            encrypted_index: 'I'.repeat(400),
          },
        ],
      },
    },
  };
}

function assistant(parts: any[], id = `a-${Math.random()}`): UIMessage {
  return { id, role: 'assistant', parts } as unknown as UIMessage;
}

function user(text: string, id = `u-${Math.random()}`): UIMessage {
  return { id, role: 'user', parts: [{ type: 'text', text }] } as unknown as UIMessage;
}

/** Every value in the transcript that Anthropic would validate against a search
 *  result it no longer holds. */
function encryptedRemnants(messages: UIMessage[]): string[] {
  const found: string[] = [];
  const walk = (node: any) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if ((key === 'encryptedContent' || key === 'encrypted_index') && typeof value === 'string') found.push(key);
      else walk(value);
    }
  };
  walk(messages);
  return found;
}

function partTypes(message: UIMessage): string[] {
  return ((message as any).parts ?? []).map((part: any) => part.type);
}

describe('stripStaleWebSearchContent', () => {
  it('replaces a finished search with a note naming the pages it returned', () => {
    const messages = [
      user('what fuel filter for my 1996 mini spi'),
      assistant([searchPart(['https://minispares.com/gfe7059', 'https://minispares.com/gfe7057'])]),
      user('how often should I replace it?'),
    ];

    const parts = (stripStaleWebSearchContent(messages)[1] as any).parts;

    expect(partTypes(stripStaleWebSearchContent(messages)[1]!)).toEqual(['text']);
    expect(parts[0].text).toContain('An earlier web search');
    expect(parts[0].text).toContain('fuel filter 1996 spi');
    expect(parts[0].text).toContain('https://minispares.com/gfe7059');
    expect(parts[0].text).toContain('https://minispares.com/gfe7057');
  });

  it('leaves no encrypted payload behind — the API rejects a partial one', () => {
    const messages = [
      user('q'),
      assistant([
        searchPart(['https://minispares.com/gfe7059']),
        citedText('replaced every 2 years', 'https://minispares.com/gfe7059'),
      ]),
      user('follow up'),
    ];

    expect(encryptedRemnants(messages)).toEqual(['encryptedContent', 'encrypted_index']);
    expect(encryptedRemnants(stripStaleWebSearchContent(messages))).toEqual([]);
  });

  it('keeps the cited prose, dropping only the pointers into the search result', () => {
    const messages = [
      user('q'),
      assistant([citedText('replaced every 2 years', 'https://minispares.com/gfe7059')]),
      user('follow up'),
    ];

    const part = (stripStaleWebSearchContent(messages)[1] as any).parts[0];

    expect(part.text).toBe('replaced every 2 years');
    expect(part.state).toBe('done');
    // The metadata object survives minus `citations`, so a signature or any
    // other provider field on the same part is not collateral damage.
    expect(part.providerMetadata.anthropic).toEqual({});
  });

  it('leaves other provider metadata on the part alone', () => {
    const reasoning = {
      type: 'reasoning',
      text: 'thinking',
      providerMetadata: { anthropic: { signature: 'sig-abc', citations: [{ type: 'web_search_result_location' }] } },
    };
    const messages = [user('q'), assistant([reasoning]), user('follow up')];

    const part = (stripStaleWebSearchContent(messages)[1] as any).parts[0];
    expect(part.providerMetadata.anthropic).toEqual({ signature: 'sig-abc' });
  });

  it('is a large reduction — the whole point of the helper', () => {
    const messages = [
      user('q'),
      assistant([searchPart(['a', 'b', 'c', 'd', 'e']), citedText('cited claim', 'a')]),
      user('follow up'),
    ];

    const before = JSON.stringify(messages).length;
    const after = JSON.stringify(stripStaleWebSearchContent(messages)).length;

    expect(after).toBeLessThan(before * 0.05);
  });

  it('caps the note so a ten-result search cannot become a long one', () => {
    const urls = Array.from({ length: 14 }, (_, i) => `https://minispares.com/p${i}`);
    const messages = [user('q'), assistant([searchPart(urls)]), user('follow up')];

    const note = (stripStaleWebSearchContent(messages)[1] as any).parts[0].text;

    expect(note).toContain('https://minispares.com/p9');
    expect(note).not.toContain('https://minispares.com/p10');
    expect(note).toContain('and 4 more');
  });

  it('truncates a very long page title', () => {
    const part = searchPart(['https://minispares.com/x']);
    part.output[0]!.title = 'T'.repeat(400);
    const messages = [user('q'), assistant([part]), user('follow up')];

    const note = (stripStaleWebSearchContent(messages)[1] as any).parts[0].text;
    expect(note).toContain('T'.repeat(120));
    expect(note).not.toContain('T'.repeat(121));
  });

  it('falls back to the bare url when a result has no title', () => {
    const messages = [user('q'), assistant([searchPart(['https://minispares.com/x'], '')]), user('follow up')];
    (messages[1] as any).parts[0].output[0].title = null;

    const note = (stripStaleWebSearchContent(messages)[1] as any).parts[0].text;
    expect(note).toContain('returned: https://minispares.com/x.');
    expect(note).not.toContain(' for ""');
  });

  it('drops a search that returned nothing rather than leaving an empty note', () => {
    const empty = { ...searchPart(['x']), output: [] };
    const messages = [user('q'), assistant([empty, { type: 'text', text: 'no luck' }]), user('follow up')];

    expect(partTypes(stripStaleWebSearchContent(messages)[1]!)).toEqual(['text']);
    expect((stripStaleWebSearchContent(messages)[1] as any).parts[0].text).toBe('no luck');
  });

  it('drops an errored or still-streaming search part', () => {
    const errored = {
      type: 'tool-web_search',
      toolCallId: 'c5',
      state: 'output-error',
      errorText: 'max_uses_exceeded',
    };
    const pending = { type: 'tool-web_search', toolCallId: 'c6', state: 'input-available', input: { query: 'x' } };
    const messages = [user('q'), assistant([errored, pending, { type: 'text', text: 'ok' }]), user('follow up')];

    expect(partTypes(stripStaleWebSearchContent(messages)[1]!)).toEqual(['text']);
  });

  it('never leaves an assistant message with nothing in it', () => {
    // An assistant turn whose only part was a failed search would otherwise
    // convert to a message with empty content, which the API rejects.
    const errored = { type: 'tool-web_search', toolCallId: 'c7', state: 'output-error', errorText: 'boom' };
    const messages = [user('q'), assistant([{ type: 'step-start' }, errored]), user('follow up')];

    const parts = (stripStaleWebSearchContent(messages)[1] as any).parts;
    expect(parts.filter((p: any) => p.type === 'text')).toHaveLength(1);
    expect(parts.at(-1).text).toContain('nothing usable');
  });

  it('handles a dynamic-tool part naming web_search', () => {
    const dynamic = {
      type: 'dynamic-tool',
      toolName: 'web_search',
      toolCallId: 'c3',
      state: 'output-available',
      input: { query: 'x' },
      output: [result('https://minispares.com/z')],
    };
    const messages = [user('q'), assistant([dynamic]), user('follow up')];

    expect(partTypes(stripStaleWebSearchContent(messages)[1]!)).toEqual(['text']);
    expect(encryptedRemnants(stripStaleWebSearchContent(messages))).toEqual([]);
  });

  it('handles an output wrapped as { type: "json", value }', () => {
    const wrapped = {
      type: 'tool-web_search',
      toolCallId: 'c4',
      state: 'output-available',
      input: { query: 'x' },
      output: { type: 'json', value: [result('https://minispares.com/w')] },
    };
    const messages = [user('q'), assistant([wrapped]), user('follow up')];

    const note = (stripStaleWebSearchContent(messages)[1] as any).parts[0].text;
    expect(note).toContain('https://minispares.com/w');
  });

  it('does not touch a non-web-search tool part', () => {
    const torque = {
      type: 'tool-torque-specs',
      toolCallId: 'c2',
      state: 'output-available',
      output: [{ fastener: 'Main bearing cap', lbFt: 63 }],
    };
    const messages = [user('q'), assistant([torque]), user('follow up')];

    expect(stripStaleWebSearchContent(messages)).toBe(messages);
  });

  it('compacts EVERY finished assistant turn, including the most recent one', () => {
    // Every assistant message in a request body has already finished streaming
    // to the browser. Exempting the newest one would leave a whole search
    // budget in the payload and put the ceiling back where it was.
    const messages = [
      user('q1'),
      assistant([searchPart(['https://minispares.com/a'])]),
      user('q2'),
      assistant([searchPart(['https://minispares.com/b'])]),
      user('q3'),
    ];

    expect(encryptedRemnants(stripStaleWebSearchContent(messages))).toEqual([]);
  });

  it('leaves a TRAILING assistant message intact — that turn may still be open', () => {
    const open = assistant([searchPart(['https://minispares.com/b'])]);
    const messages = [user('q1'), assistant([searchPart(['https://minispares.com/a'])]), user('q2'), open];

    const out = stripStaleWebSearchContent(messages);

    expect(out[3]).toBe(open);
    expect(partTypes(out[1]!)).toEqual(['text']);
  });

  it('returns the same array when there is nothing to compact', () => {
    const messages = [user('q'), assistant([{ type: 'text', text: 'plain answer' }]), user('follow up')];
    expect(stripStaleWebSearchContent(messages)).toBe(messages);
  });

  it('does not mutate the input', () => {
    const messages = [
      user('q'),
      assistant([searchPart(['https://minispares.com/a']), citedText('claim', 'https://minispares.com/a')]),
      user('follow up'),
    ];
    const snapshot = JSON.stringify(messages);

    stripStaleWebSearchContent(messages);

    expect(JSON.stringify(messages)).toBe(snapshot);
  });

  it('passes untouched messages through by reference', () => {
    const plain = assistant([{ type: 'text', text: 'earlier answer' }]);
    const messages = [user('q'), plain, user('q2'), assistant([searchPart(['https://minispares.com/b'])]), user('q3')];

    expect(stripStaleWebSearchContent(messages)[1]).toBe(plain);
  });

  it('tolerates a message with no parts array', () => {
    const malformed = { id: 'm', role: 'assistant' } as unknown as UIMessage;
    const messages = [user('q'), malformed, user('follow up')];

    expect(() => stripStaleWebSearchContent(messages)).not.toThrow();
  });

  it('tolerates an empty conversation', () => {
    expect(stripStaleWebSearchContent([])).toEqual([]);
  });
});
