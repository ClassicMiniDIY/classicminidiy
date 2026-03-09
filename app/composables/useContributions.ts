export interface ContributionItem {
  id: string;
  action: 'submitted' | 'edited' | 'approved' | 'rejected';
  targetType: 'document' | 'collection' | 'registry' | 'color' | 'wheel';
  targetId: string;
  targetTitle: string | null;
  details: string | null;
  createdAt: string;
}

export interface ContributorProfile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  trustLevel: 'new' | 'contributor' | 'trusted' | 'moderator' | 'admin';
  totalSubmissions: number;
  approvedSubmissions: number;
  joinedAt: string;
}

export const useContributions = () => {
  const supabase = useSupabase();

  const mapToContribution = (row: any): ContributionItem => ({
    id: row.id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    targetTitle: row.target_title,
    details: row.details,
    createdAt: row.created_at,
  });

  const getContributorProfile = async (userId: string): Promise<ContributorProfile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, bio, trust_level, total_submissions, approved_submissions, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
      bio: data.bio,
      trustLevel: data.trust_level,
      totalSubmissions: data.total_submissions,
      approvedSubmissions: data.approved_submissions,
      joinedAt: data.created_at,
    };
  };

  const listContributions = async (
    userId: string,
    opts?: { targetType?: string; limit?: number }
  ): Promise<ContributionItem[]> => {
    let query = supabase
      .from('contributions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (opts?.targetType) query = query.eq('target_type', opts.targetType);
    if (opts?.limit) query = query.limit(opts.limit);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapToContribution);
  };

  const getContributionStats = async (userId: string): Promise<Record<string, number>> => {
    const { data, error } = await supabase
      .from('contributions')
      .select('target_type')
      .eq('user_id', userId)
      .eq('action', 'approved');

    if (error) throw error;

    const stats: Record<string, number> = {};
    for (const row of data || []) {
      stats[row.target_type] = (stats[row.target_type] || 0) + 1;
    }
    return stats;
  };

  return { getContributorProfile, listContributions, getContributionStats };
};
