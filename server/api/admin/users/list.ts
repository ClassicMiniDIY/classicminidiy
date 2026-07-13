import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const supabase = getServiceClient();
  const query = getQuery(event);

  const search = query.search?.toString();
  const trustLevel = query.trustLevel?.toString();
  const limit = parseInt(query.limit?.toString() || '50');
  const offset = parseInt(query.offset?.toString() || '0');

  // Sensitive columns (email, is_admin, warning_count, ...) live on
  // profile_private (profiles split) — embed and flatten so the response
  // shape is unchanged for the admin users table. Explicit column list (not *)
  // so legacy sensitive-column reads can't sneak back in before the Phase 4
  // column drop. Keep in sync with PROFILE_PUBLIC_COLUMNS in app/utils/constants.ts.
  const profilePublicColumns =
    'id, username, display_name, avatar_url, location, bio, social_links, show_vehicles, is_public, is_banned, preferred_currency, unit_system, trust_level, total_submissions, approved_submissions, rejected_submissions, onboarding_completed, onboarding_completed_app, profile_completed_at, created_at, updated_at';
  let q = supabase
    .from('profiles')
    .select(`${profilePublicColumns}, profile_private ( email, is_admin, warning_count, auth_provider, firebase_uid )`, {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (trustLevel && trustLevel !== 'all') {
    if (trustLevel === 'admin') {
      // is_admin moved to profile_private — resolve admin ids first.
      const { data: adminRows, error: adminError } = await supabase
        .from('profile_private')
        .select('user_id')
        .eq('is_admin', true);
      if (adminError) throw createError({ statusCode: 500, statusMessage: adminError.message });
      const adminIds = (adminRows || []).map((r) => r.user_id);
      if (adminIds.length === 0) return { users: [], total: 0 };
      q = q.in('id', adminIds);
    } else {
      q = q.eq('trust_level', trustLevel);
    }
  }
  if (search) {
    // Email search runs against profile_private; merge matches into the
    // display_name filter by id.
    const { data: emailRows, error: emailError } = await supabase
      .from('profile_private')
      .select('user_id')
      .ilike('email', `%${search}%`);
    if (emailError) throw createError({ statusCode: 500, statusMessage: emailError.message });
    const emailIds = (emailRows || []).map((r) => r.user_id);
    const orParts = [`display_name.ilike.%${search}%`];
    if (emailIds.length > 0) orParts.push(`id.in.(${emailIds.join(',')})`);
    q = q.or(orParts.join(','));
  }

  const { data, error, count } = await q;
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  return {
    users: (data || []).map(({ profile_private: priv, ...rest }: any) => ({ ...rest, ...(priv ?? {}) })),
    total: count || 0,
  };
});
