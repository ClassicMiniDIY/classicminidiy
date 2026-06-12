/**
 * GET /api/models/[modelId]/edit  (keystone §11 PR 7 — resume/edit + new version)
 *
 * Owner-scoped load for the upload wizard: the model's content plus the WORKING
 * version (the latest draft/rejected one — what you can still add files to and
 * submit) and that version's files + the model's images. Runs under the caller's
 * JWT so RLS confirms ownership and returns drafts. `version` is null for a
 * published model with no open draft (then the wizard edits content only).
 */
import { requireUserClient } from '../../../utils/userAuth';
import type { PrintSettings, HardwareItem, AssemblyInstructions } from '../../../../data/models/model-library';

export default defineEventHandler(async (event) => {
  const { supabase } = await requireUserClient(event);
  const modelId = getRouterParam(event, 'modelId');
  if (!modelId) throw createError({ statusCode: 400, statusMessage: 'Missing model id' });

  const config = useRuntimeConfig();
  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');

  const { data: model, error: modelError } = await supabase
    .from('models')
    .select(
      'id, slug, title, summary, description, category_slug, tags, license_code, pricing_mode, price_cents, min_price_cents, suggested_price_cents, currency, safety_critical, source_url, status'
    )
    .eq('id', modelId)
    .single();
  if (modelError || !model) throw createError({ statusCode: 404, statusMessage: 'Model not found' });

  // Working version: latest draft/rejected (editable). RLS only returns own rows.
  const { data: versions } = await supabase
    .from('model_versions')
    .select('id, version_number, label, changelog, print_settings, hardware_bom, assembly, status')
    .eq('model_id', modelId)
    .in('status', ['draft', 'rejected'])
    .order('version_number', { ascending: false })
    .limit(1);
  const v = versions?.[0] ?? null;

  let files: any[] = [];
  if (v) {
    const { data: fileRows } = await supabase
      .from('model_files')
      .select('id, file_name, file_ext, size_bytes, is_renderable, upload_status')
      .eq('version_id', v.id)
      .eq('upload_status', 'uploaded')
      .order('file_name', { ascending: true });
    files = (fileRows ?? []).map((f) => ({
      fileId: f.id,
      name: f.file_name,
      ext: f.file_ext,
      sizeBytes: f.size_bytes,
      isRenderable: f.is_renderable,
    }));
  }

  const { data: imageRows } = await supabase
    .from('model_images')
    .select('id, storage_path, is_primary, sort_order')
    .eq('model_id', modelId)
    .order('is_primary', { ascending: false })
    .order('sort_order', { ascending: true });
  const images = (imageRows ?? []).map((img) => ({
    id: img.id,
    url: `${supabaseUrl}/storage/v1/object/public/model-images/${img.storage_path}`,
    isPrimary: img.is_primary,
  }));

  return {
    model: {
      id: model.id,
      slug: model.slug,
      title: model.title,
      summary: model.summary,
      description: model.description,
      categorySlug: model.category_slug,
      tags: model.tags ?? [],
      licenseCode: model.license_code,
      pricingMode: model.pricing_mode,
      priceCents: model.price_cents,
      minPriceCents: model.min_price_cents,
      suggestedPriceCents: model.suggested_price_cents,
      safetyCritical: model.safety_critical,
      sourceUrl: model.source_url,
      status: model.status,
    },
    version: v
      ? {
          id: v.id,
          versionNumber: v.version_number,
          label: v.label,
          changelog: v.changelog,
          printSettings: (v.print_settings as unknown as PrintSettings) ?? null,
          hardwareBom: (v.hardware_bom as unknown as HardwareItem[]) ?? [],
          assembly: (v.assembly as unknown as AssemblyInstructions) ?? null,
        }
      : null,
    files,
    images,
  };
});
