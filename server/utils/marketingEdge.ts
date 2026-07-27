/**
 * Thin caller for the send-marketing-email edge function. All marketing admin
 * routes forward through here with the service-role bearer (the edge fn
 * enforces service-grade auth itself; callers must gate on
 * requireMarketingAdmin BEFORE invoking this).
 */
export async function callMarketingEdge<T = any>(
  body: Record<string, unknown>,
  opts: { timeout?: number } = {}
): Promise<T> {
  const config = useRuntimeConfig();
  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  const serviceKey = config.SUPABASE_SERVICE_KEY as string;
  if (!supabaseUrl || !serviceKey) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase not configured' });
  }

  try {
    return await $fetch<T>(`${supabaseUrl}/functions/v1/send-marketing-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: config.public.supabaseKey as string,
        'content-type': 'application/json',
      },
      body,
      timeout: opts.timeout,
    });
  } catch (error: any) {
    const status = error?.statusCode || error?.response?.status || 502;
    const message = error?.data?.error || error?.statusMessage || 'Marketing email service error';
    console.error('[marketing] edge function error:', error?.data || error?.message || error);
    throw createError({ statusCode: status, statusMessage: message });
  }
}
