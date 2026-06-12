/**
 * GET /api/models/[modelId]  (keystone §11 PR 6)
 *
 * Public detail for a PUBLISHED model, resolved by slug OR uuid (the `[modelId]`
 * param name matches the sibling `[modelId]/` download + license routes so
 * there is no Nitro param collision). Returns the model, its current published
 * version (print settings / BOM / assembly), uploaded files, gallery images,
 * frozen license (with derived flags), and author. Owner/admin preview of
 * unpublished models is deferred to the upload-wizard PR.
 */
import { getServiceClient } from '../../utils/supabase';
import type {
  ModelDetail,
  PricingMode,
  PrintSettings,
  HardwareItem,
  AssemblyInstructions,
} from '../../../data/models/model-library';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default defineEventHandler(async (event): Promise<ModelDetail> => {
  const idOrSlug = getRouterParam(event, 'modelId');
  if (!idOrSlug) {
    throw createError({ statusCode: 400, statusMessage: 'Missing model identifier' });
  }

  const config = useRuntimeConfig();
  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  const service = getServiceClient();

  const { data: model, error: modelError } = await service
    .from('models')
    .select(
      'id, slug, title, summary, description, category_slug, tags, pricing_mode, price_cents, suggested_price_cents, min_price_cents, currency, safety_critical, source_url, license_code, current_version_id, owner_id, like_count, comment_count, download_count, version_count, created_at'
    )
    .eq('status', 'published')
    .eq(UUID_RE.test(idOrSlug) ? 'id' : 'slug', idOrSlug)
    .maybeSingle();

  if (modelError) {
    console.error('[models/detail] query failed:', modelError.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to load model' });
  }
  if (!model) {
    throw createError({ statusCode: 404, statusMessage: 'Model not found' });
  }

  // Current published version (print settings / BOM / assembly + frozen license).
  let version: ModelDetail['version'] = null;
  let licenseCode = model.license_code;
  if (model.current_version_id) {
    const { data: v } = await service
      .from('model_versions')
      .select(
        'id, version_number, label, changelog, published_at, license_code, print_settings, hardware_bom, assembly, status'
      )
      .eq('id', model.current_version_id)
      .maybeSingle();
    if (v && v.status === 'published') {
      licenseCode = v.license_code ?? model.license_code;
      version = {
        id: v.id,
        versionNumber: v.version_number,
        label: v.label,
        changelog: v.changelog,
        publishedAt: v.published_at,
        printSettings: (v.print_settings as unknown as PrintSettings) ?? null,
        hardwareBom: (v.hardware_bom as unknown as HardwareItem[]) ?? [],
        assembly: (v.assembly as unknown as AssemblyInstructions) ?? null,
      };
    }
  }

  // Frozen license + derived flags.
  const { data: lic } = await service
    .from('model_licenses')
    .select(
      'code, name, url, is_paid_license, allows_commercial_use, allows_derivatives, requires_attribution, requires_share_alike, allows_file_redistribution'
    )
    .eq('code', licenseCode)
    .maybeSingle();

  // Uploaded files for the current version (renderables first).
  const files: ModelDetail['files'] = [];
  if (version) {
    const { data: fileRows } = await service
      .from('model_files')
      .select('id, file_name, file_ext, kind, size_bytes, is_renderable')
      .eq('version_id', version.id)
      .eq('upload_status', 'uploaded')
      .order('is_renderable', { ascending: false })
      .order('file_name', { ascending: true });
    for (const f of fileRows ?? []) {
      files.push({
        id: f.id,
        fileName: f.file_name,
        fileExt: f.file_ext,
        kind: f.kind,
        sizeBytes: f.size_bytes,
        isRenderable: f.is_renderable,
      });
    }
  }

  // Gallery images.
  const { data: imageRows } = await service
    .from('model_images')
    .select('id, storage_path, alt_text, is_primary, sort_order')
    .eq('model_id', model.id)
    .order('is_primary', { ascending: false })
    .order('sort_order', { ascending: true });
  const images = (imageRows ?? []).map((img) => ({
    id: img.id,
    url: `${supabaseUrl}/storage/v1/object/public/model-images/${img.storage_path}`,
    altText: img.alt_text,
    isPrimary: img.is_primary,
  }));

  // Author.
  let author: ModelDetail['author'] = null;
  const { data: profile } = await service
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .eq('id', model.owner_id)
    .maybeSingle();
  if (profile) {
    author = {
      id: profile.id,
      displayName: profile.display_name,
      username: profile.username,
      avatarUrl: profile.avatar_url,
    };
  }

  return {
    id: model.id,
    slug: model.slug,
    title: model.title,
    summary: model.summary,
    description: model.description,
    categorySlug: model.category_slug,
    tags: model.tags ?? [],
    pricingMode: model.pricing_mode as PricingMode,
    priceCents: model.price_cents,
    suggestedPriceCents: model.suggested_price_cents,
    minPriceCents: model.min_price_cents,
    currency: model.currency,
    safetyCritical: model.safety_critical,
    sourceUrl: model.source_url,
    likeCount: model.like_count,
    commentCount: model.comment_count,
    downloadCount: model.download_count,
    versionCount: model.version_count,
    createdAt: model.created_at,
    author,
    license: {
      code: lic?.code ?? licenseCode,
      name: lic?.name ?? licenseCode,
      url: lic?.url ?? null,
      isPaid: lic?.is_paid_license ?? false,
      allowsCommercialUse: lic?.allows_commercial_use ?? false,
      allowsDerivatives: lic?.allows_derivatives ?? false,
      requiresAttribution: lic?.requires_attribution ?? false,
      requiresShareAlike: lic?.requires_share_alike ?? false,
      allowsFileRedistribution: lic?.allows_file_redistribution ?? false,
    },
    version,
    files,
    images,
  };
});
