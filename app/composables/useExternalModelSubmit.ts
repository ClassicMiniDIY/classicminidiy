/**
 * Form state machine for the "Around the Web" external model submit flow.
 *
 * Two-step: fetch a preview from the source URL (no DB write), then submit
 * with user-selected category and optional edits. Auth pattern mirrors
 * useModelUpload: the Supabase session lives in localStorage, so every
 * authed API call carries an explicit Authorization: Bearer header.
 */
import {
  detectSourceSite,
  isValidExternalUrl,
  type ExternalSourceSite,
} from '~~/data/models/external-sources';
import type { ExternalModelPreview } from '~~/data/models/external-models';

export function useExternalModelSubmit() {
  const supabase = useSupabase();
  const { track } = useAnalytics();

  // ── Step 1: URL input ─────────────────────────────────────────────────────
  const url = ref('');

  const isValidUrl = computed(() => isValidExternalUrl(url.value));
  const detectedSite = computed<ExternalSourceSite | null>(() =>
    url.value ? detectSourceSite(url.value) : null
  );

  // ── Preview state ─────────────────────────────────────────────────────────
  const fetching = ref(false);
  const preview = ref<ExternalModelPreview | null>(null);
  const fetchError = ref<string | null>(null);

  // Tracks an already-listed slug (from preview.alreadyListed or a 409 on submit).
  const alreadyListed = ref<{ slug: string } | null>(null);

  // ── Editable Step 2 fields (pre-filled from preview) ─────────────────────
  const title = ref('');
  const description = ref('');
  const categorySlug = ref('');
  const tags = ref<string[]>([]);

  // ── Submit state ──────────────────────────────────────────────────────────
  const submitting = ref(false);
  const submitError = ref<string | null>(null);
  // slug of the successfully submitted listing; drives success UI.
  const submittedSlug = ref<string | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────
  async function authHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /** POST /api/models/external/fetch — no DB write. */
  async function fetchPreview(): Promise<void> {
    if (fetching.value || !isValidUrl.value) return; // guard against concurrent fetches
    fetching.value = true;
    fetchError.value = null;
    preview.value = null;
    alreadyListed.value = null;

    try {
      const headers = await authHeaders();
      const result = await $fetch<ExternalModelPreview>('/api/models/external/fetch', {
        method: 'POST',
        headers,
        body: { url: url.value },
      });

      preview.value = result;

      // Pre-fill editable fields from scraped data.
      title.value = result.title || '';
      description.value = result.description || '';
      tags.value = result.tags?.slice() ?? [];

      // Surface dedupe hint immediately.
      if (result.alreadyListed) {
        alreadyListed.value = result.alreadyListed;
      }

      track('external_model_preview_fetched', { source_site: result.sourceSite });
    } catch (e: any) {
      fetchError.value =
        e?.data?.message || e?.data?.statusMessage || e?.statusMessage || 'Could not fetch details for that URL.';
    } finally {
      fetching.value = false;
    }
  }

  /** POST /api/models/external/submit — persists the listing as pending. */
  async function submit(): Promise<{ slug: string } | null> {
    if (!preview.value || !categorySlug.value) return null;
    submitting.value = true;
    submitError.value = null;

    try {
      const headers = await authHeaders();
      const res = await $fetch<{ id: string; slug: string; status: string; savedImages: number }>(
        '/api/models/external/submit',
        {
          method: 'POST',
          headers,
          body: {
            url: preview.value.sourceUrl,
            title: title.value.trim() || undefined,
            description: description.value.trim() || undefined,
            categorySlug: categorySlug.value,
            tags: tags.value.length ? tags.value : undefined,
          },
        }
      );

      submittedSlug.value = res.slug;
      track('external_model_submitted', {
        source_site: preview.value.sourceSite,
        slug: res.slug,
      });
      return { slug: res.slug };
    } catch (e: any) {
      // 409 = already listed; createError({ data }) nests it at e.data.data.slug.
      const dupSlug = e?.data?.data?.slug ?? e?.data?.slug;
      if (e?.statusCode === 409 && dupSlug) {
        alreadyListed.value = { slug: dupSlug };
        submitError.value = 'This model is already in the library.';
      } else {
        submitError.value =
          e?.data?.message || e?.data?.statusMessage || e?.statusMessage || 'Could not submit the listing.';
      }
      return null;
    } finally {
      submitting.value = false;
    }
  }

  /** Reset the whole form back to step 1. */
  function reset() {
    url.value = '';
    preview.value = null;
    fetchError.value = null;
    submitError.value = null;
    alreadyListed.value = null;
    title.value = '';
    description.value = '';
    categorySlug.value = '';
    tags.value = [];
    submitting.value = false;
    fetching.value = false;
    submittedSlug.value = null;
  }

  return {
    // Step 1
    url,
    isValidUrl,
    detectedSite,
    // Preview
    fetching,
    preview,
    fetchError,
    alreadyListed,
    fetchPreview,
    // Step 2 fields
    title,
    description,
    categorySlug,
    tags,
    // Submit
    submitting,
    submitError,
    submittedSlug,
    submit,
    // Util
    reset,
  };
}
