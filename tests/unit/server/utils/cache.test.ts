import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('server/utils/cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function importCache() {
    const mod = await import('~/server/utils/cache');
    return mod;
  }

  describe('getCached', () => {
    it('returns null for a missing key', async () => {
      const { getCached } = await importCache();
      const result = await getCached('nonexistent');
      expect(result).toBeNull();
    });

    it('returns the cached value for an existing key', async () => {
      const { getCached, setCache } = await importCache();
      await setCache('mykey', 'hello');
      const result = await getCached<string>('mykey');
      expect(result).toBe('hello');
    });

    it('returns null and deletes entry after TTL expires', async () => {
      const { getCached, setCache } = await importCache();
      await setCache('expiring', 'value', 10); // 10-second TTL

      // Still valid at 9 seconds
      vi.advanceTimersByTime(9_000);
      expect(await getCached<string>('expiring')).toBe('value');

      // Expired at 11 seconds
      vi.advanceTimersByTime(2_000);
      expect(await getCached<string>('expiring')).toBeNull();

      // Confirm the entry was truly deleted from the map (second call still null)
      expect(await getCached<string>('expiring')).toBeNull();
    });

    it('returns values of different types correctly', async () => {
      const { getCached, setCache } = await importCache();

      await setCache('number', 42);
      expect(await getCached<number>('number')).toBe(42);

      await setCache('object', { foo: 'bar', count: 7 });
      expect(await getCached<{ foo: string; count: number }>('object')).toEqual({ foo: 'bar', count: 7 });

      await setCache('array', [1, 2, 3]);
      expect(await getCached<number[]>('array')).toEqual([1, 2, 3]);

      await setCache('boolean', false);
      expect(await getCached<boolean>('boolean')).toBe(false);

      await setCache('null-value', null);
      expect(await getCached('null-value')).toBeNull();
    });
  });

  describe('setCache', () => {
    it('stores and retrieves values correctly', async () => {
      const { getCached, setCache } = await importCache();
      await setCache('key1', 'value1');
      await setCache('key2', 'value2');
      expect(await getCached<string>('key1')).toBe('value1');
      expect(await getCached<string>('key2')).toBe('value2');
    });

    it('uses a default TTL of 3600 seconds', async () => {
      const { getCached, setCache } = await importCache();
      await setCache('default-ttl', 'data');

      // Still valid at 3599 seconds
      vi.advanceTimersByTime(3_599_000);
      expect(await getCached<string>('default-ttl')).toBe('data');

      // Expired at 3601 seconds
      vi.advanceTimersByTime(2_000);
      expect(await getCached<string>('default-ttl')).toBeNull();
    });

    it('respects a custom TTL', async () => {
      const { getCached, setCache } = await importCache();
      await setCache('short-ttl', 'temp', 5); // 5-second TTL

      // Valid at 4 seconds
      vi.advanceTimersByTime(4_000);
      expect(await getCached<string>('short-ttl')).toBe('temp');

      // Expired at 6 seconds
      vi.advanceTimersByTime(2_000);
      expect(await getCached<string>('short-ttl')).toBeNull();
    });

    it('overwrites existing keys', async () => {
      const { getCached, setCache } = await importCache();
      await setCache('overwrite', 'first');
      expect(await getCached<string>('overwrite')).toBe('first');

      await setCache('overwrite', 'second');
      expect(await getCached<string>('overwrite')).toBe('second');
    });

    it('overwrites existing keys and resets TTL', async () => {
      const { getCached, setCache } = await importCache();
      await setCache('reset-ttl', 'original', 10);

      // Advance 8 seconds (within original TTL)
      vi.advanceTimersByTime(8_000);
      expect(await getCached<string>('reset-ttl')).toBe('original');

      // Overwrite with a new TTL of 10 seconds from now
      await setCache('reset-ttl', 'updated', 10);

      // Advance 8 more seconds (16 total from start, but only 8 from overwrite)
      vi.advanceTimersByTime(8_000);
      expect(await getCached<string>('reset-ttl')).toBe('updated');

      // Advance 3 more seconds (11 from overwrite - should be expired)
      vi.advanceTimersByTime(3_000);
      expect(await getCached<string>('reset-ttl')).toBeNull();
    });
  });

  describe('TTL behavior', () => {
    it('entry is valid just before TTL boundary', async () => {
      const { getCached, setCache } = await importCache();
      await setCache('boundary', 'alive', 60);

      // Advance to 59.999 seconds - still within TTL
      vi.advanceTimersByTime(59_999);
      expect(await getCached<string>('boundary')).toBe('alive');
    });

    it('entry expires exactly at TTL boundary', async () => {
      const { getCached, setCache } = await importCache();
      await setCache('boundary-exact', 'alive', 60);

      // Advance to exactly 60 seconds
      // The check is `cached.expires < Date.now()`, so at exactly expires time it should still be valid
      // because expires === Date.now() means NOT less than
      vi.advanceTimersByTime(60_000);
      expect(await getCached<string>('boundary-exact')).toBe('alive');

      // One more millisecond pushes it past
      vi.advanceTimersByTime(1);
      expect(await getCached<string>('boundary-exact')).toBeNull();
    });

    it('multiple keys expire independently', async () => {
      const { getCached, setCache } = await importCache();
      await setCache('short', 'a', 5);
      await setCache('medium', 'b', 30);
      await setCache('long', 'c', 120);

      // After 6 seconds: short expired, others alive
      vi.advanceTimersByTime(6_000);
      expect(await getCached<string>('short')).toBeNull();
      expect(await getCached<string>('medium')).toBe('b');
      expect(await getCached<string>('long')).toBe('c');

      // After 31 seconds total: medium also expired
      vi.advanceTimersByTime(25_000);
      expect(await getCached<string>('medium')).toBeNull();
      expect(await getCached<string>('long')).toBe('c');

      // After 121 seconds total: all expired
      vi.advanceTimersByTime(90_000);
      expect(await getCached<string>('long')).toBeNull();
    });

    it('deleted expired entries cannot be retrieved even if time resets', async () => {
      const { getCached, setCache } = await importCache();
      await setCache('ephemeral', 'gone', 2);

      // Expire it
      vi.advanceTimersByTime(3_000);
      expect(await getCached<string>('ephemeral')).toBeNull();

      // Entry was deleted from the map, so even a fresh getCached returns null
      expect(await getCached<string>('ephemeral')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles empty string as key', async () => {
      const { getCached, setCache } = await importCache();
      await setCache('', 'empty-key-value');
      expect(await getCached<string>('')).toBe('empty-key-value');
    });

    it('handles empty string as value', async () => {
      const { getCached, setCache } = await importCache();
      await setCache('empty-val', '');
      expect(await getCached<string>('empty-val')).toBe('');
    });

    it('handles zero as value', async () => {
      const { getCached, setCache } = await importCache();
      await setCache('zero', 0);
      expect(await getCached<number>('zero')).toBe(0);
    });

    it('handles undefined as value (stored as undefined, getCached returns it)', async () => {
      const { getCached, setCache } = await importCache();
      await setCache('undef', undefined);
      // The cache stores undefined; getCached returns `cached.value as T`
      // Since the key exists and hasn't expired, it returns undefined (not null)
      const result = await getCached('undef');
      expect(result).toBeUndefined();
    });

    it('each test gets a fresh cache due to resetModules', async () => {
      const { getCached } = await importCache();
      // Keys from other tests should not exist
      expect(await getCached('mykey')).toBeNull();
      expect(await getCached('key1')).toBeNull();
      expect(await getCached('overwrite')).toBeNull();
    });
  });
});
