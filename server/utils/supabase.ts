import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let serviceClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    const config = useRuntimeConfig();
    serviceClient = createClient(
      config.public.supabaseUrl as string,
      config.SUPABASE_SERVICE_KEY as string,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return serviceClient;
}
