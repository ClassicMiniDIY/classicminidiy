import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';
import type { IWheelsData } from '../../../../data/models/wheels';

export default defineEventHandler(async (event): Promise<IWheelsData[]> => {
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
      .eq('target_type', 'wheel')
      .order('created_at', { ascending: false });

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message });
    }

    // Map submission_queue rows to IWheelsData shape for the admin page
    return (data || []).map((item: any) => {
      const wheelData = item.data || {};
      return {
        uuid: item.id,
        name: wheelData.name || '',
        type: wheelData.type || wheelData.wheel_type || '',
        size: wheelData.size || '',
        width: wheelData.width || '',
        offset: wheelData.offset || wheelData.offset_value || '',
        notes: wheelData.notes || '',
        userName: wheelData.userName || wheelData.legacy_submitted_by || '',
        emailAddress: wheelData.emailAddress || wheelData.legacy_submitted_by_email || '',
        referral: wheelData.referral || '',
        images: wheelData.images || wheelData.photos || [],
        manufacturer: wheelData.manufacturer || '',
        boltPattern: wheelData.boltPattern || wheelData.bolt_pattern || '',
        centerBore: wheelData.centerBore || wheelData.center_bore || '',
        weight: wheelData.weight || '',
        newWheel: wheelData.newWheel ?? true,
        status: item.status === 'pending' ? 'P' : item.status === 'approved' ? 'A' : 'R',
      } as IWheelsData;
    });
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error('Error fetching wheels review queue:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Error fetching wheels review queue: ${error.message || 'Unknown error'}`,
    });
  }
});
