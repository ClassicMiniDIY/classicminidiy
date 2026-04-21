import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useToast } from '~/app/composables/useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (global as any).__resetNuxtState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('add', () => {
    it('returns a ToastRecord with defaults applied', () => {
      const { add } = useToast();
      const record = add({ title: 'Hello' });

      expect(record.title).toBe('Hello');
      expect(record.description).toBe('');
      expect(record.color).toBe('info');
      expect(record.icon).toBe('');
      expect(record.timeout).toBe(5000);
      expect(typeof record.id).toBe('string');
      expect(record.id.length).toBeGreaterThan(0);
    });

    it('uses a caller-provided id when present', () => {
      const { add } = useToast();
      const record = add({ id: 'custom-id', title: 'Hi' });
      expect(record.id).toBe('custom-id');
    });

    it('generates a unique id when none is provided', () => {
      const { add } = useToast();
      const a = add({ title: 'A' });
      const b = add({ title: 'B' });
      expect(a.id).not.toBe(b.id);
    });

    it('appends the toast to the shared toasts state', () => {
      const { add, toasts } = useToast();
      add({ title: 'One' });
      add({ title: 'Two' });

      expect(toasts.value).toHaveLength(2);
      expect(toasts.value[0]?.title).toBe('One');
      expect(toasts.value[1]?.title).toBe('Two');
    });

    it('respects custom color, description, and timeout values', () => {
      const { add } = useToast();
      const record = add({
        title: 'Saved',
        description: 'Your profile was updated',
        color: 'success',
        timeout: 2000,
      });
      expect(record.description).toBe('Your profile was updated');
      expect(record.color).toBe('success');
      expect(record.timeout).toBe(2000);
    });

    it('auto-removes the toast after the timeout elapses', () => {
      const { add, toasts } = useToast();
      add({ title: 'Vanish', timeout: 1000 });

      expect(toasts.value).toHaveLength(1);
      vi.advanceTimersByTime(999);
      expect(toasts.value).toHaveLength(1);

      vi.advanceTimersByTime(1);
      expect(toasts.value).toHaveLength(0);
    });

    it('does NOT schedule removal when timeout is 0', () => {
      const { add, toasts } = useToast();
      add({ title: 'Sticky', timeout: 0 });

      vi.advanceTimersByTime(60_000);
      expect(toasts.value).toHaveLength(1);
    });

    it('does NOT schedule removal when timeout is negative', () => {
      const { add, toasts } = useToast();
      add({ title: 'Persistent', timeout: -1 });

      vi.advanceTimersByTime(60_000);
      expect(toasts.value).toHaveLength(1);
    });

    it('leaves other toasts in place when one auto-removes', () => {
      const { add, toasts } = useToast();
      add({ id: 'short', title: 'Short', timeout: 500 });
      add({ id: 'long', title: 'Long', timeout: 5000 });

      vi.advanceTimersByTime(500);
      expect(toasts.value).toHaveLength(1);
      expect(toasts.value[0]?.id).toBe('long');
    });
  });

  describe('icon normalization', () => {
    it('converts i-fa6-solid-* to fas fa-* classes', () => {
      const { add } = useToast();
      const record = add({ title: 't', icon: 'i-fa6-solid-circle-check' });
      expect(record.icon).toBe('fas fa-circle-check');
    });

    it('converts i-fa6-regular-* to far fa-* classes', () => {
      const { add } = useToast();
      const record = add({ title: 't', icon: 'i-fa6-regular-heart' });
      expect(record.icon).toBe('far fa-heart');
    });

    it('converts i-fa6-brands-* to fab fa-* classes', () => {
      const { add } = useToast();
      const record = add({ title: 't', icon: 'i-fa6-brands-github' });
      expect(record.icon).toBe('fab fa-github');
    });

    it('converts i-heroicons-* to fas fa-* as a best-effort fallback', () => {
      const { add } = useToast();
      const record = add({ title: 't', icon: 'i-heroicons-bell' });
      expect(record.icon).toBe('fas fa-bell');
    });

    it('passes raw fas/far/fab class strings through unchanged', () => {
      const { add } = useToast();
      const record = add({ title: 't', icon: 'fas fa-rocket' });
      expect(record.icon).toBe('fas fa-rocket');
    });

    it('returns an empty string when no icon is supplied', () => {
      const { add } = useToast();
      const record = add({ title: 't' });
      expect(record.icon).toBe('');
    });
  });

  describe('remove', () => {
    it('removes the toast whose id matches', () => {
      const { add, remove, toasts } = useToast();
      add({ id: 'a', title: 'A' });
      add({ id: 'b', title: 'B' });

      remove('a');

      expect(toasts.value).toHaveLength(1);
      expect(toasts.value[0]?.id).toBe('b');
    });

    it('is a no-op for an unknown id', () => {
      const { add, remove, toasts } = useToast();
      add({ id: 'a', title: 'A' });
      remove('does-not-exist');

      expect(toasts.value).toHaveLength(1);
      expect(toasts.value[0]?.id).toBe('a');
    });
  });

  describe('clear', () => {
    it('empties the toasts array', () => {
      const { add, clear, toasts } = useToast();
      add({ title: 'One' });
      add({ title: 'Two' });
      add({ title: 'Three' });

      clear();
      expect(toasts.value).toHaveLength(0);
    });

    it('is a no-op when there are no toasts', () => {
      const { clear, toasts } = useToast();
      expect(() => clear()).not.toThrow();
      expect(toasts.value).toHaveLength(0);
    });
  });

  describe('shared state across invocations', () => {
    it('two useToast() callers share the same underlying list', () => {
      const first = useToast();
      const second = useToast();

      first.add({ id: 'shared', title: 'Shared' });
      expect(second.toasts.value).toHaveLength(1);
      expect(second.toasts.value[0]?.id).toBe('shared');
    });

    it('remove from one instance is visible to the other', () => {
      const a = useToast();
      const b = useToast();

      a.add({ id: 'x', title: 'X' });
      b.remove('x');

      expect(a.toasts.value).toHaveLength(0);
    });
  });
});
