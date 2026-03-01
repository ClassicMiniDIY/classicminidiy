import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';
import type { RegistryItem } from '../../../../data/models/registry';

export default defineEventHandler(async (event): Promise<RegistryItem[]> => {
  await requireAdminAuth(event);

  setResponseHeaders(event, {
    'Cache-Control': 'public, max-age=300, s-maxage=300',
    'CDN-Cache-Control': 'public, max-age=300',
  });

  const supabase = getServiceClient();

  try {
    const { data, error } = await supabase
      .from('submission_queue')
      .select('*')
      .eq('target_type', 'registry')
      .order('created_at', { ascending: false });

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message });
    }

    // Map submission_queue rows to RegistryItem shape for the admin page
    return (data || []).map((item: any) => {
      const regData = item.data || {};
      return {
        uniqueId: item.id,
        year: regData.year || 0,
        model: regData.model || '',
        bodyNum: regData.bodyNum || regData.body_number || '',
        engineNum: regData.engineNum || regData.engine_number || '',
        engineSize: regData.engineSize || regData.engine_size || 0,
        bodyType: regData.bodyType || regData.body_type || '',
        color: regData.color || '',
        trim: regData.trim || '',
        buildDate: regData.buildDate || regData.build_date || null,
        notes: regData.notes || '',
        submittedBy: regData.submittedBy || regData.legacy_submitted_by || '',
        submittedByEmail: regData.submittedByEmail || regData.legacy_submitted_by_email || '',
        status: item.status === 'pending' ? 'P' : item.status === 'approved' ? 'A' : 'R',
      } as RegistryItem;
    });
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error('Error getting registry queue info:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Error getting registry queue: ${error.message || 'Unknown error'}`,
    });
  }
});
