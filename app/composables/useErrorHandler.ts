/**
 * Standardized error handling for composables
 * Provides consistent error handling patterns across the application
 */

export interface AppError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: any;
}

/**
 * Standard error handler that logs and optionally shows toast
 */
export function useErrorHandler() {
  const toast = useToast();
  const { capture } = usePostHog();
  const route = useRoute();

  /**
   * Handle error with consistent pattern
   * @param error - The error to handle
   * @param options - Configuration options
   */
  const handleError = (
    error: any,
    options: {
      showToast?: boolean;
      toastTitle?: string;
      logToConsole?: boolean;
      rethrow?: boolean;
    } = {}
  ): AppError => {
    const { showToast = true, toastTitle = 'Error', logToConsole = true, rethrow = false } = options;

    // Normalize error
    const appError: AppError = {
      message: error?.message || error?.statusMessage || 'An unexpected error occurred',
      code: error?.code || error?.statusCode?.toString(),
      statusCode: error?.statusCode || 500,
      details: error,
    };

    // Log to console if enabled
    if (logToConsole) {
      console.error(`[Error Handler] ${toastTitle}:`, appError);
    }

    // Show toast if enabled
    if (showToast) {
      toast.add({
        title: toastTitle,
        description: appError.message,
        color: 'error',
      });

      // Track error displayed to user
      capture('error_displayed', {
        error_type: appError.code || appError.message || 'unknown',
        page: route.fullPath,
      });
    }

    // Rethrow if requested
    if (rethrow) {
      throw error;
    }

    return appError;
  };

  /**
   * Handle async operation with error handling
   */
  const withErrorHandling = async <T>(
    operation: () => Promise<T>,
    options: {
      errorTitle?: string;
      showToast?: boolean;
      defaultValue?: T;
    } = {}
  ): Promise<T | undefined> => {
    const { errorTitle = 'Operation Failed', showToast = true, defaultValue } = options;

    try {
      return await operation();
    } catch (error) {
      handleError(error, {
        showToast,
        toastTitle: errorTitle,
        rethrow: false,
      });
      return defaultValue;
    }
  };

  /**
   * Validate required field
   */
  const validateRequired = (value: any, fieldName: string): void => {
    if (!value) {
      throw new Error(`${fieldName} is required`);
    }
  };

  /**
   * Create a standardized error
   */
  const createError = (message: string, code?: string, statusCode?: number): AppError => {
    return {
      message,
      code,
      statusCode: statusCode || 400,
    };
  };

  return {
    handleError,
    withErrorHandling,
    validateRequired,
    createError,
  };
}
