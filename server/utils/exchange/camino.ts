/**
 * Shared Camino AI API client
 * Proxies all requests through the server to keep the API key private
 */

const CAMINO_API_BASE = 'https://api.getcamino.ai';

export interface CaminoRelationshipResponse {
  distance: string;
  direction: string;
  walking_time: string;
  actual_distance_km: number;
  duration_seconds: number;
  driving_time: string;
  description: string;
}

export interface CaminoQueryResult {
  name: string;
  lat: number;
  lon: number;
  address?: string;
  distance?: number;
  relevance_score?: number;
  tags?: string[];
  type?: string;
}

export interface CaminoQueryResponse {
  results: CaminoQueryResult[];
  answer?: string;
}

export async function caminoFetch<T = any>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST';
    params?: Record<string, string | number | boolean>;
    body?: Record<string, any>;
  } = {}
): Promise<T> {
  const config = useRuntimeConfig();
  const apiKey = config.caminoApiKey;

  if (!apiKey) {
    throw new Error('CAMINO_API_KEY is not configured');
  }

  const { method = 'GET', params, body } = options;

  const url = new URL(`${CAMINO_API_BASE}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }

  const response = await $fetch<T>(url.toString(), {
    method,
    headers: { 'X-API-Key': apiKey },
    ...(body ? { body } : {}),
  });

  return response;
}
