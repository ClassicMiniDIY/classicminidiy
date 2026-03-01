import { getServiceClient } from '../utils/supabase';

const LEGACY_PREFIXES = ['/archive/manuals/', '/archive/adverts/', '/archive/catalogues/', '/archive/tuning/'];

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;

  // Only handle old document detail URLs
  const matchedPrefix = LEGACY_PREFIXES.find((prefix) => path.startsWith(prefix));
  if (!matchedPrefix) return;

  // Extract the legacy slug from the URL
  const legacySlug = path.slice(matchedPrefix.length).replace(/\/$/, '');
  if (!legacySlug) return;

  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from('archive_documents')
      .select('slug')
      .eq('legacy_slug', legacySlug)
      .eq('status', 'approved')
      .maybeSingle();

    if (data?.slug) {
      return sendRedirect(event, `/archive/documents/${data.slug}`, 301);
    }

    // If no legacy_slug match, try direct slug match
    const { data: directMatch } = await supabase
      .from('archive_documents')
      .select('slug')
      .eq('slug', legacySlug)
      .eq('status', 'approved')
      .maybeSingle();

    if (directMatch?.slug) {
      return sendRedirect(event, `/archive/documents/${directMatch.slug}`, 301);
    }
  } catch {
    // If Supabase lookup fails, let the request continue to the catch-all
  }
});
