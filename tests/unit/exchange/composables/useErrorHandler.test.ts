import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupGlobalMocks } from '../../../setup/testHelpers';

// useErrorHandler depends on three globals: useToast, usePostHog (capital H,
// destructures { capture }), and useRoute (reads route.fullPath). vitest.setup
// globally stubs usePostHog + useRoute, but does NOT stub useToast and does not
// give us a handle on the posthog capture spy. So we stub all three per-test and
// keep handles on the spies. This composable touches no useAuth/useSupabase.
let mockToast: { add: ReturnType<typeof vi.fn> };
let mockCapture: ReturnType<typeof vi.fn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

const ROUTE_PATH = '/test-page';

const stubEnv = () => {
  mockToast = { add: vi.fn() };
  mockCapture = vi.fn();
  vi.stubGlobal('useToast', () => mockToast);
  vi.stubGlobal('usePostHog', () => ({ capture: mockCapture, identify: vi.fn(), reset: vi.fn() }));
  vi.stubGlobal('useRoute', () => ({ fullPath: ROUTE_PATH }));
};

const importComposable = async () => {
  const mod = await import('~/app/composables/useErrorHandler');
  return mod.useErrorHandler;
};

beforeEach(() => {
  vi.resetModules();
  stubEnv();
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  cleanupGlobalMocks();
  vi.clearAllMocks();
});

describe('useErrorHandler', () => {
  // ---------------------------------------------------------------------------
  // handleError() — error normalization
  // ---------------------------------------------------------------------------
  describe('handleError() normalization', () => {
    it('normalizes message from error.message', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      const result = handleError(new Error('test error'));

      expect(result.message).toBe('test error');
    });

    it('falls back to error.statusMessage when message is absent', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      const result = handleError({ statusMessage: 'Not Found' });

      expect(result.message).toBe('Not Found');
    });

    it('prefers error.message over error.statusMessage when both present', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      const result = handleError({ message: 'primary', statusMessage: 'secondary' });

      expect(result.message).toBe('primary');
    });

    it('uses the default message for an empty/unknown error', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      const result = handleError({});

      expect(result.message).toBe('An unexpected error occurred');
    });

    it('uses the default message when error is null', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      const result = handleError(null);

      expect(result.message).toBe('An unexpected error occurred');
    });

    it('derives code from error.code when present', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      const result = handleError({ message: 'x', code: 'PGRST116' });

      expect(result.code).toBe('PGRST116');
    });

    it('derives code from stringified statusCode when error.code is absent', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      const result = handleError({ message: 'x', statusCode: 404 });

      expect(result.code).toBe('404');
    });

    it('leaves code undefined when neither code nor statusCode exist', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      const result = handleError({ message: 'x' });

      expect(result.code).toBeUndefined();
    });

    it('uses error.statusCode for statusCode', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      const result = handleError({ message: 'x', statusCode: 403 });

      expect(result.statusCode).toBe(403);
    });

    it('defaults statusCode to 500 when not provided', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      const result = handleError(new Error('boom'));

      expect(result.statusCode).toBe(500);
    });

    it('stores the original error in details', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      const err = new Error('boom');
      const result = handleError(err);

      expect(result.details).toBe(err);
    });
  });

  // ---------------------------------------------------------------------------
  // handleError() — toast behavior
  // ---------------------------------------------------------------------------
  describe('handleError() toast', () => {
    it('shows an error-colored toast by default', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      handleError(new Error('oops'));

      expect(mockToast.add).toHaveBeenCalledTimes(1);
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'error' })
      );
    });

    it('uses the default "Error" title and the normalized message as description', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      handleError(new Error('oops'));

      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'oops',
        color: 'error',
      });
    });

    it('honors a custom toastTitle', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      handleError(new Error('oops'), { toastTitle: 'Save Failed' });

      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Save Failed', description: 'oops' })
      );
    });

    it('does not show a toast when showToast is false', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      handleError(new Error('oops'), { showToast: false });

      expect(mockToast.add).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // handleError() — analytics
  // ---------------------------------------------------------------------------
  describe('handleError() analytics', () => {
    it('captures error_displayed with the current route when a toast is shown', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      handleError(new Error('oops'));

      expect(mockCapture).toHaveBeenCalledWith(
        'error_displayed',
        expect.objectContaining({ page: ROUTE_PATH })
      );
    });

    it('uses the error code as error_type when present', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      handleError({ message: 'denied', code: 'AUTH_401' });

      expect(mockCapture).toHaveBeenCalledWith(
        'error_displayed',
        expect.objectContaining({ error_type: 'AUTH_401' })
      );
    });

    it('falls back to the message for error_type when no code exists', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      handleError({ message: 'plain message' });

      expect(mockCapture).toHaveBeenCalledWith(
        'error_displayed',
        expect.objectContaining({ error_type: 'plain message' })
      );
    });

    it('does not capture analytics when the toast is suppressed', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      handleError(new Error('oops'), { showToast: false });

      expect(mockCapture).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // handleError() — console logging
  // ---------------------------------------------------------------------------
  describe('handleError() logging', () => {
    it('logs to console by default with the title prefix', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      handleError(new Error('logged'), { toastTitle: 'Boom' });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Handler] Boom:',
        expect.objectContaining({ message: 'logged' })
      );
    });

    it('does not log when logToConsole is false', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      handleError(new Error('not logged'), { logToConsole: false });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // handleError() — rethrow
  // ---------------------------------------------------------------------------
  describe('handleError() rethrow', () => {
    it('rethrows the original error when rethrow is true', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      const err = new Error('rethrown');

      expect(() => handleError(err, { rethrow: true })).toThrow(err);
    });

    it('still shows toast and logs before rethrowing', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      expect(() => handleError(new Error('rethrown'), { rethrow: true })).toThrow();
      expect(mockToast.add).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('returns the normalized AppError when rethrow is false', async () => {
      const useErrorHandler = await importComposable();
      const { handleError } = useErrorHandler();

      const result = handleError(new Error('returned'), { rethrow: false });

      expect(result).toMatchObject({ message: 'returned', statusCode: 500 });
    });
  });

  // ---------------------------------------------------------------------------
  // withErrorHandling()
  // ---------------------------------------------------------------------------
  describe('withErrorHandling()', () => {
    it('returns the operation result on success', async () => {
      const useErrorHandler = await importComposable();
      const { withErrorHandling } = useErrorHandler();

      const result = await withErrorHandling(async () => 'success');

      expect(result).toBe('success');
    });

    it('does not show a toast or log on success', async () => {
      const useErrorHandler = await importComposable();
      const { withErrorHandling } = useErrorHandler();

      await withErrorHandling(async () => 42);

      expect(mockToast.add).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('returns the provided defaultValue on failure', async () => {
      const useErrorHandler = await importComposable();
      const { withErrorHandling } = useErrorHandler();

      const result = await withErrorHandling(
        async () => {
          throw new Error('fail');
        },
        { defaultValue: 'fallback' }
      );

      expect(result).toBe('fallback');
    });

    it('returns undefined on failure when no defaultValue is given', async () => {
      const useErrorHandler = await importComposable();
      const { withErrorHandling } = useErrorHandler();

      const result = await withErrorHandling(async () => {
        throw new Error('fail');
      });

      expect(result).toBeUndefined();
    });

    it('routes the failure through handleError (toast + analytics) by default', async () => {
      const useErrorHandler = await importComposable();
      const { withErrorHandling } = useErrorHandler();

      await withErrorHandling(async () => {
        throw new Error('fail');
      });

      expect(mockToast.add).toHaveBeenCalledTimes(1);
      expect(mockCapture).toHaveBeenCalledWith('error_displayed', expect.any(Object));
    });

    it('uses the default "Operation Failed" title on the toast', async () => {
      const useErrorHandler = await importComposable();
      const { withErrorHandling } = useErrorHandler();

      await withErrorHandling(async () => {
        throw new Error('fail');
      });

      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Operation Failed', description: 'fail' })
      );
    });

    it('honors a custom errorTitle', async () => {
      const useErrorHandler = await importComposable();
      const { withErrorHandling } = useErrorHandler();

      await withErrorHandling(
        async () => {
          throw new Error('fail');
        },
        { errorTitle: 'Upload Failed' }
      );

      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Upload Failed' })
      );
    });

    it('suppresses the toast when showToast is false on failure', async () => {
      const useErrorHandler = await importComposable();
      const { withErrorHandling } = useErrorHandler();

      const result = await withErrorHandling(
        async () => {
          throw new Error('fail');
        },
        { showToast: false, defaultValue: 'fallback' }
      );

      expect(result).toBe('fallback');
      expect(mockToast.add).not.toHaveBeenCalled();
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('does not rethrow — failures are swallowed into the defaultValue', async () => {
      const useErrorHandler = await importComposable();
      const { withErrorHandling } = useErrorHandler();

      await expect(
        withErrorHandling(async () => {
          throw new Error('fail');
        })
      ).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // validateRequired()
  // ---------------------------------------------------------------------------
  describe('validateRequired()', () => {
    it('throws "<field> is required" for null', async () => {
      const useErrorHandler = await importComposable();
      const { validateRequired } = useErrorHandler();

      expect(() => validateRequired(null, 'Name')).toThrow('Name is required');
    });

    it('throws for an empty string', async () => {
      const useErrorHandler = await importComposable();
      const { validateRequired } = useErrorHandler();

      expect(() => validateRequired('', 'Email')).toThrow('Email is required');
    });

    it('throws for undefined', async () => {
      const useErrorHandler = await importComposable();
      const { validateRequired } = useErrorHandler();

      expect(() => validateRequired(undefined, 'ID')).toThrow('ID is required');
    });

    it('throws for 0 (falsy)', async () => {
      const useErrorHandler = await importComposable();
      const { validateRequired } = useErrorHandler();

      expect(() => validateRequired(0, 'Count')).toThrow('Count is required');
    });

    it('does not throw for a non-empty string', async () => {
      const useErrorHandler = await importComposable();
      const { validateRequired } = useErrorHandler();

      expect(() => validateRequired('value', 'Field')).not.toThrow();
    });

    it('does not throw for a positive number', async () => {
      const useErrorHandler = await importComposable();
      const { validateRequired } = useErrorHandler();

      expect(() => validateRequired(123, 'Number')).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // createError()
  // ---------------------------------------------------------------------------
  describe('createError()', () => {
    it('creates an AppError with the message and defaults', async () => {
      const useErrorHandler = await importComposable();
      const { createError } = useErrorHandler();

      const err = createError('Bad input');

      expect(err.message).toBe('Bad input');
      expect(err.statusCode).toBe(400);
      expect(err.code).toBeUndefined();
    });

    it('creates an AppError with custom code and statusCode', async () => {
      const useErrorHandler = await importComposable();
      const { createError } = useErrorHandler();

      const err = createError('Not found', 'NOT_FOUND', 404);

      expect(err).toEqual({ message: 'Not found', code: 'NOT_FOUND', statusCode: 404 });
    });

    it('falls back to statusCode 400 when statusCode is omitted but code is given', async () => {
      const useErrorHandler = await importComposable();
      const { createError } = useErrorHandler();

      const err = createError('Validation', 'VALIDATION');

      expect(err.code).toBe('VALIDATION');
      expect(err.statusCode).toBe(400);
    });

    it('does not show a toast or capture analytics (pure factory)', async () => {
      const useErrorHandler = await importComposable();
      const { createError } = useErrorHandler();

      createError('Bad input');

      expect(mockToast.add).not.toHaveBeenCalled();
      expect(mockCapture).not.toHaveBeenCalled();
    });
  });
});
