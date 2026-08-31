/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { randomUuid, randomToken } from '~/utils/randomId';

describe('randomUuid', () => {
  it('produces a well-formed v4 UUID', () => {
    for (let i = 0; i < 50; i++) {
      expect(randomUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });

  it('does not repeat across many draws', () => {
    const seen = new Set(Array.from({ length: 5000 }, () => randomUuid()));
    expect(seen.size).toBe(5000);
  });

  // The reason this module exists: randomUUID is secure-context only, so the
  // fallback path is what actually runs over plain HTTP.
  it('falls back to getRandomValues when randomUUID is unavailable', () => {
    const real = globalThis.crypto;
    const calls: number[] = [];
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        getRandomValues: (a: Uint8Array) => {
          calls.push(a.length);
          for (let i = 0; i < a.length; i++) a[i] = i * 7 + 1;
          return a;
        },
      },
      configurable: true,
    });
    try {
      const id = randomUuid();
      expect(calls).toEqual([16]);
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: real, configurable: true });
    }
  });
});

describe('randomToken', () => {
  it('is lowercase hex of the requested length', () => {
    expect(randomToken()).toMatch(/^[0-9a-f]{8}$/);
    expect(randomToken(12)).toMatch(/^[0-9a-f]{12}$/);
  });
});
