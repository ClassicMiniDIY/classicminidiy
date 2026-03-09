import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('usePostHog', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  describe('when PostHog is not initialized', () => {
    beforeEach(() => {
      vi.stubGlobal('useNuxtApp', () => ({ $posthog: undefined }));
    });

    it('capture does not throw when PostHog is undefined', async () => {
      const { usePostHog } = await import('~/app/composables/usePostHog');
      const { capture } = usePostHog();
      expect(() => capture('test_event')).not.toThrow();
    });

    it('capture does not throw when called with properties', async () => {
      const { usePostHog } = await import('~/app/composables/usePostHog');
      const { capture } = usePostHog();
      expect(() => capture('test_event', { key: 'value' })).not.toThrow();
    });

    it('identify does not throw when PostHog is undefined', async () => {
      const { usePostHog } = await import('~/app/composables/usePostHog');
      const { identify } = usePostHog();
      expect(() => identify('user-123')).not.toThrow();
    });

    it('identify does not throw when called with properties', async () => {
      const { usePostHog } = await import('~/app/composables/usePostHog');
      const { identify } = usePostHog();
      expect(() => identify('user-123', { email: 'test@example.com' })).not.toThrow();
    });

    it('reset does not throw when PostHog is undefined', async () => {
      const { usePostHog } = await import('~/app/composables/usePostHog');
      const { reset } = usePostHog();
      expect(() => reset()).not.toThrow();
    });

    it('returns an object with capture, identify, and reset functions', async () => {
      const { usePostHog } = await import('~/app/composables/usePostHog');
      const result = usePostHog();
      expect(typeof result.capture).toBe('function');
      expect(typeof result.identify).toBe('function');
      expect(typeof result.reset).toBe('function');
    });
  });

  describe('when PostHog is initialized', () => {
    let mockPosthog: {
      capture: ReturnType<typeof vi.fn>;
      identify: ReturnType<typeof vi.fn>;
      reset: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockPosthog = {
        capture: vi.fn(),
        identify: vi.fn(),
        reset: vi.fn(),
      };
      vi.stubGlobal('useNuxtApp', () => ({ $posthog: mockPosthog }));
    });

    it('capture forwards event name to PostHog', async () => {
      const { usePostHog } = await import('~/app/composables/usePostHog');
      const { capture } = usePostHog();
      capture('page_viewed');
      expect(mockPosthog.capture).toHaveBeenCalledOnce();
      expect(mockPosthog.capture).toHaveBeenCalledWith('page_viewed', undefined);
    });

    it('capture forwards event name and properties to PostHog', async () => {
      const { usePostHog } = await import('~/app/composables/usePostHog');
      const { capture } = usePostHog();
      capture('button_clicked', { button: 'submit', page: '/listings' });
      expect(mockPosthog.capture).toHaveBeenCalledOnce();
      expect(mockPosthog.capture).toHaveBeenCalledWith('button_clicked', { button: 'submit', page: '/listings' });
    });

    it('identify forwards distinctId to PostHog', async () => {
      const { usePostHog } = await import('~/app/composables/usePostHog');
      const { identify } = usePostHog();
      identify('user-abc-123');
      expect(mockPosthog.identify).toHaveBeenCalledOnce();
      expect(mockPosthog.identify).toHaveBeenCalledWith('user-abc-123', undefined);
    });

    it('identify forwards distinctId and properties to PostHog', async () => {
      const { usePostHog } = await import('~/app/composables/usePostHog');
      const { identify } = usePostHog();
      identify('user-abc-123', { email: 'user@example.com', name: 'Test User' });
      expect(mockPosthog.identify).toHaveBeenCalledOnce();
      expect(mockPosthog.identify).toHaveBeenCalledWith('user-abc-123', {
        email: 'user@example.com',
        name: 'Test User',
      });
    });

    it('reset forwards to PostHog', async () => {
      const { usePostHog } = await import('~/app/composables/usePostHog');
      const { reset } = usePostHog();
      reset();
      expect(mockPosthog.reset).toHaveBeenCalledOnce();
    });

    it('each method can be called multiple times', async () => {
      const { usePostHog } = await import('~/app/composables/usePostHog');
      const { capture, identify, reset } = usePostHog();

      capture('event_1');
      capture('event_2');
      capture('event_3');
      expect(mockPosthog.capture).toHaveBeenCalledTimes(3);

      identify('user-1');
      identify('user-2');
      expect(mockPosthog.identify).toHaveBeenCalledTimes(2);

      reset();
      reset();
      expect(mockPosthog.reset).toHaveBeenCalledTimes(2);
    });
  });

  describe('when $posthog is null', () => {
    beforeEach(() => {
      vi.stubGlobal('useNuxtApp', () => ({ $posthog: null }));
    });

    it('capture does not throw when $posthog is null', async () => {
      const { usePostHog } = await import('~/app/composables/usePostHog');
      const { capture } = usePostHog();
      expect(() => capture('test_event')).not.toThrow();
    });

    it('identify does not throw when $posthog is null', async () => {
      const { usePostHog } = await import('~/app/composables/usePostHog');
      const { identify } = usePostHog();
      expect(() => identify('user-123')).not.toThrow();
    });

    it('reset does not throw when $posthog is null', async () => {
      const { usePostHog } = await import('~/app/composables/usePostHog');
      const { reset } = usePostHog();
      expect(() => reset()).not.toThrow();
    });
  });
});
