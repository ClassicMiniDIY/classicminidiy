import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { useDebounce, useDebouncedFunction, useThrottledFunction } from '~/app/composables/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('useDebounce<T>(source, delay?)', () => {
    it('returns a ref with the initial value immediately', () => {
      const source = ref('hello');
      const debounced = useDebounce(source);
      expect(debounced.value).toBe('hello');
    });

    it('returns a ref with initial value for non-string types', () => {
      const source = ref(42);
      const debounced = useDebounce(source);
      expect(debounced.value).toBe(42);
    });

    it('does not update debounced value immediately on source change', async () => {
      const source = ref('initial');
      const debounced = useDebounce(source, 300);

      source.value = 'changed';
      await nextTick();

      expect(debounced.value).toBe('initial');
    });

    it('updates debounced value after the specified delay', async () => {
      const source = ref('initial');
      const debounced = useDebounce(source, 500);

      source.value = 'updated';
      await nextTick();

      // Not yet updated at 499ms
      vi.advanceTimersByTime(499);
      expect(debounced.value).toBe('initial');

      // Updated at 500ms
      vi.advanceTimersByTime(1);
      expect(debounced.value).toBe('updated');
    });

    it('uses a default delay of 300ms', async () => {
      const source = ref('start');
      const debounced = useDebounce(source);

      source.value = 'end';
      await nextTick();

      vi.advanceTimersByTime(299);
      expect(debounced.value).toBe('start');

      vi.advanceTimersByTime(1);
      expect(debounced.value).toBe('end');
    });

    it('only applies the last value when rapid changes occur', async () => {
      const source = ref('a');
      const debounced = useDebounce(source, 200);

      source.value = 'b';
      await nextTick();

      vi.advanceTimersByTime(100);

      source.value = 'c';
      await nextTick();

      vi.advanceTimersByTime(100);

      source.value = 'd';
      await nextTick();

      // 100ms after last change, not yet fired
      vi.advanceTimersByTime(100);
      expect(debounced.value).toBe('a');

      // Full 200ms after the last change
      vi.advanceTimersByTime(100);
      expect(debounced.value).toBe('d');
    });

    it('resets the timer on each change', async () => {
      const source = ref(0);
      const debounced = useDebounce(source, 300);

      source.value = 1;
      await nextTick();
      vi.advanceTimersByTime(200);
      expect(debounced.value).toBe(0);

      // Change again at 200ms - timer should reset
      source.value = 2;
      await nextTick();
      vi.advanceTimersByTime(200);
      // Only 200ms since last change, should not have fired
      expect(debounced.value).toBe(0);

      // 100 more ms = 300ms total since last change
      vi.advanceTimersByTime(100);
      expect(debounced.value).toBe(2);
    });

    it('handles object values', async () => {
      const source = ref({ name: 'Alice' });
      const debounced = useDebounce(source, 100);

      source.value = { name: 'Bob' };
      await nextTick();

      vi.advanceTimersByTime(100);
      expect(debounced.value).toEqual({ name: 'Bob' });
    });

    it('handles null and undefined values', async () => {
      const source = ref<string | null>('value');
      const debounced = useDebounce(source, 100);

      source.value = null;
      await nextTick();

      vi.advanceTimersByTime(100);
      expect(debounced.value).toBeNull();
    });

    it('handles multiple independent debounced refs', async () => {
      const source1 = ref('a');
      const source2 = ref('x');
      const debounced1 = useDebounce(source1, 100);
      const debounced2 = useDebounce(source2, 200);

      source1.value = 'b';
      source2.value = 'y';
      await nextTick();

      vi.advanceTimersByTime(100);
      expect(debounced1.value).toBe('b');
      expect(debounced2.value).toBe('x');

      vi.advanceTimersByTime(100);
      expect(debounced2.value).toBe('y');
    });
  });

  describe('useDebouncedFunction(func, delay?)', () => {
    it('does not call the function immediately', () => {
      const fn = vi.fn();
      const debouncedFn = useDebouncedFunction(fn, 300);

      debouncedFn();

      expect(fn).not.toHaveBeenCalled();
    });

    it('calls the function after the specified delay', () => {
      const fn = vi.fn();
      const debouncedFn = useDebouncedFunction(fn, 200);

      debouncedFn();

      vi.advanceTimersByTime(200);
      expect(fn).toHaveBeenCalledOnce();
    });

    it('uses a default delay of 300ms', () => {
      const fn = vi.fn();
      const debouncedFn = useDebouncedFunction(fn);

      debouncedFn();

      vi.advanceTimersByTime(299);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalledOnce();
    });

    it('only calls with the last arguments when called rapidly', () => {
      const fn = vi.fn();
      const debouncedFn = useDebouncedFunction(fn, 100);

      debouncedFn('first');
      debouncedFn('second');
      debouncedFn('third');

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledOnce();
      expect(fn).toHaveBeenCalledWith('third');
    });

    it('results in a single invocation from rapid calls', () => {
      const fn = vi.fn();
      const debouncedFn = useDebouncedFunction(fn, 100);

      for (let i = 0; i < 10; i++) {
        debouncedFn(i);
      }

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledOnce();
      expect(fn).toHaveBeenCalledWith(9);
    });

    it('resets the timer on each call', () => {
      const fn = vi.fn();
      const debouncedFn = useDebouncedFunction(fn, 200);

      debouncedFn('a');
      vi.advanceTimersByTime(150);
      expect(fn).not.toHaveBeenCalled();

      // Call again, resetting the timer
      debouncedFn('b');
      vi.advanceTimersByTime(150);
      // Only 150ms since the second call, should not have fired
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledOnce();
      expect(fn).toHaveBeenCalledWith('b');
    });

    it('can be called again after the delay has passed', () => {
      const fn = vi.fn();
      const debouncedFn = useDebouncedFunction(fn, 100);

      debouncedFn('first');
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('first');

      debouncedFn('second');
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenCalledWith('second');
    });

    it('passes multiple arguments correctly', () => {
      const fn = vi.fn();
      const debouncedFn = useDebouncedFunction(fn, 100);

      debouncedFn('arg1', 42, true);
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 42, true);
    });
  });

  describe('useThrottledFunction(func, delay?)', () => {
    it('executes the first call immediately', () => {
      const fn = vi.fn();
      const throttledFn = useThrottledFunction(fn, 100);

      throttledFn();

      expect(fn).toHaveBeenCalledOnce();
    });

    it('drops subsequent calls within the throttle window', () => {
      const fn = vi.fn();
      const throttledFn = useThrottledFunction(fn, 200);

      throttledFn('first');
      throttledFn('second');
      throttledFn('third');

      expect(fn).toHaveBeenCalledOnce();
      expect(fn).toHaveBeenCalledWith('first');
    });

    it('allows function to fire again after the throttle window', () => {
      const fn = vi.fn();
      const throttledFn = useThrottledFunction(fn, 100);

      throttledFn('first');
      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);

      throttledFn('second');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('second');
    });

    it('uses a default delay of 100ms', () => {
      const fn = vi.fn();
      const throttledFn = useThrottledFunction(fn);

      throttledFn('first');
      expect(fn).toHaveBeenCalledTimes(1);

      // Within default 100ms window, calls should be dropped
      vi.advanceTimersByTime(99);
      throttledFn('dropped');
      expect(fn).toHaveBeenCalledTimes(1);

      // After 100ms, call should go through
      vi.advanceTimersByTime(1);
      throttledFn('allowed');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('allowed');
    });

    it('handles multiple throttle cycles', () => {
      const fn = vi.fn();
      const throttledFn = useThrottledFunction(fn, 50);

      // Cycle 1
      throttledFn(1);
      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(50);

      // Cycle 2
      throttledFn(2);
      expect(fn).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(50);

      // Cycle 3
      throttledFn(3);
      expect(fn).toHaveBeenCalledTimes(3);

      expect(fn).toHaveBeenNthCalledWith(1, 1);
      expect(fn).toHaveBeenNthCalledWith(2, 2);
      expect(fn).toHaveBeenNthCalledWith(3, 3);
    });

    it('passes arguments correctly on the first call', () => {
      const fn = vi.fn();
      const throttledFn = useThrottledFunction(fn, 100);

      throttledFn('arg1', 42, { key: 'value' });

      expect(fn).toHaveBeenCalledWith('arg1', 42, { key: 'value' });
    });

    it('ignores calls during the throttle window even with different args', () => {
      const fn = vi.fn();
      const throttledFn = useThrottledFunction(fn, 100);

      throttledFn('keep');
      vi.advanceTimersByTime(50);
      throttledFn('ignore');
      vi.advanceTimersByTime(50);

      expect(fn).toHaveBeenCalledOnce();
      expect(fn).toHaveBeenCalledWith('keep');

      // After throttle resets, new call should work
      throttledFn('new');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('new');
    });

    it('works with a custom delay', () => {
      const fn = vi.fn();
      const throttledFn = useThrottledFunction(fn, 500);

      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(499);
      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      throttledFn();
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
