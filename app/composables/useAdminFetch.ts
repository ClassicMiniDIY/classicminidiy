/**
 * Wrapper around useFetch for admin API endpoints.
 *
 * Injects the Supabase access token as an Authorization header and
 * skips SSR (admin pages are noindex and require client-side auth).
 */
export const useAdminFetch = <T>(url: string, opts: Record<string, any> = {}) => {
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
 * Wrapper around $fetch for admin API mutations (POST/PUT/DELETE).
 *
 * Injects the Supabase access token as an Authorization header.
 */
export const $adminFetch = async <T>(url: string, opts: Record<string, any> = {}): Promise<T> => {
  const supabase = useSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return $fetch<T>(url, {
    ...opts,
    headers: {
      ...opts.headers,
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  });
};
