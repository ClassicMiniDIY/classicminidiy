import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const useSupabase = () => {
  const config = useRuntimeConfig();

  // Client-side: use useState for singleton with automatic hydration
  if (import.meta.client) {
    const client = useState<SupabaseClient>('supabase-client', () => {
      return createClient(config.public.supabaseUrl as string, config.public.supabaseKey as string, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
          flowType: 'pkce',
          // In-memory mutex to replace Web Locks API, which causes AbortError
          // during SSR/client hydration. Queues concurrent operations instead of
          // dropping them, preserving token refresh race condition protection.
          lock: (() => {
            const locks = new Map<string, Promise<any>>();
            return async (name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
              const existing = locks.get(name) ?? Promise.resolve();
              const next = existing.then(
                () => fn(),
                () => fn()
              );
              locks.set(name, next);
              next.finally(() => {
                if (locks.get(name) === next) locks.delete(name);
              });
              return next;
            };
          })(),
        },
      });
    });

    return client.value;
  }

  // Server-side: create new instance per request (no session sharing)
  return createClient(config.public.supabaseUrl as string, config.public.supabaseKey as string, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};
