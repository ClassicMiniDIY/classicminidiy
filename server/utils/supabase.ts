import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '~~/types/database';

let serviceClient: SupabaseClient<Database> | null = null;

export function getServiceClient(): SupabaseClient<Database> {
  if (!serviceClient) {
    const config = useRuntimeConfig();
    serviceClient = createClient<Database>(config.public.supabaseUrl as string, config.SUPABASE_SERVICE_KEY as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceClient;
}

/**
 * Build a per-request Supabase client bound to a user's access token (anon key +
 * `Authorization: Bearer <jwt>`). Every query runs under that user's identity,
 * so RLS is enforced — used where a write must respect row policies rather than
 * bypass them with the service role (e.g. the model-upload presign route inserts
 * a `model_files` row that RLS only permits for the owner of a draft version).
 *
 * Not cached: each call is scoped to one caller's JWT.
 */
export function getUserClient(accessToken: string): SupabaseClient<Database> {
  const config = useRuntimeConfig();
  return createClient<Database>(config.public.supabaseUrl as string, config.public.supabaseKey as string, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
