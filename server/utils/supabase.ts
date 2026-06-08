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
