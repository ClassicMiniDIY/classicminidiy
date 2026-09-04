/**
 * POST /api/admin/parts/set-crawl  (admin — start/pause a source's crawl)
 *
 * Flips `part_source_private.crawl_enabled`. The ingest reads this in two
 * places, which is what makes "pause" mean something:
 *
 *   * at startup, where it refuses to make ANY request when the flag is false
 *     (a dry run included — a dry run is still traffic)
 *   * between pages during a drain, where a running job notices the flag going
 *     false and stops cleanly at the next page boundary
 *
 * Without the second check this would be a "stop before the next run" button
 * wearing a "pause" label, which is the wrong thing to hand someone who has
 * just been telephoned by a retailer.
 *
 * A DECLINED SOURCE CANNOT BE STARTED. Declining already sets crawl_enabled to
 * false; letting this route turn it back on would be a way to walk around a
 * takedown from a different screen.
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const body = await readBody<{ sourceId?: string; enabled?: boolean }>(event);

  const sourceId = body?.sourceId;
  const enabled = body?.enabled;

  if (!sourceId) throw createError({ statusCode: 400, statusMessage: 'Missing sourceId' });
  if (typeof enabled !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'enabled must be true or false' });
  }

  const db = getServiceClient();

  const { data: source, error: readError } = await db
    .from('part_sources')
    .select('id, slug, name, licence_status')
    .eq('id', sourceId)
    .single();

  if (readError || !source) throw createError({ statusCode: 404, statusMessage: 'Part source not found' });

  if (enabled && source.licence_status === 'declined') {
    throw createError({
      statusCode: 409,
      statusMessage: `${source.name} is declined — that source asked us to stop. Change its licence status first.`,
    });
  }

  const { data: existing } = await db
    .from('part_source_private')
    .select('crawl_enabled')
    .eq('source_id', sourceId)
    .maybeSingle();

  if (existing && existing.crawl_enabled === enabled) return { ok: true, unchanged: true };

  const { error: updateError } = await db
    .from('part_source_private')
    .upsert({ source_id: sourceId, crawl_enabled: enabled }, { onConflict: 'source_id' });

  if (updateError) throw createError({ statusCode: 500, statusMessage: updateError.message });

  const { error: auditError } = await db.from('admin_audit_log').insert({
    admin_id: user.id,
    action: enabled ? 'part_source_crawl_started' : 'part_source_crawl_paused',
    target_type: 'part_source',
    target_id: sourceId,
    details: { slug: source.slug, name: source.name, crawl_enabled: enabled },
  });

  if (auditError) {
    throw createError({
      statusCode: 500,
      statusMessage: `Crawl ${enabled ? 'started' : 'paused'}, but the audit entry could not be written: ${auditError.message}`,
    });
  }

  return { ok: true, enabled };
});
