/**
 * Wrapper around useFetch for authenticated user API endpoints.
 *
 * Injects the Supabase access token as an Authorization header so server-side
 * `requireUserAuth` can validate the caller. Use this for any /api/* endpoint
 * that requires the user to be logged in (non-admin).
 */
export const useAuthFetch = <T>(url: string, opts: Record<string, any> = {}) => {
  const supabase = useSupabase();

  return useFetch<T>(url, {
    ...opts,
    server: false,
    async onRequest({ options }) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        options.headers = new Headers(options.headers);
        options.headers.set('Authorization', `Bearer ${session.access_token}`);
      }
    },
  });
};

/**
 * Wrapper around $fetch for authenticated user mutations.
 */
export const $authFetch = async <T>(url: string, opts: Record<string, any> = {}): Promise<T> => {
  const supabase = useSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(opts.headers);
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  return $fetch<T>(url, {
    ...opts,
    headers,
  });
};
