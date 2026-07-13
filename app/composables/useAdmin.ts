import { ADMIN_CACHE_TTL_MS, PROFILE_PUBLIC_COLUMNS } from '~/utils/constants';

export interface MessageQueueItem {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  moderation_status: string;
  moderation_issues: string[] | null;
  reported_by: string[] | null;
  reported_at: string | null;
  report_reason: string | null;
  deleted_at: string | null;
  is_system_message: boolean;
  created_at: string;
  sender?: {
    id: string;
    display_name: string | null;
    email: string | null;
    warning_count: number;
    is_banned: boolean;
  };
  conversation?: {
    id: string;
    listing_id: string | null;
    buyer_id: string;
    seller_id: string;
    listing?: {
      id: string;
      title: string;
      slug: string;
    } | null;
    buyer?: {
      id: string;
      display_name: string | null;
      email: string | null;
    };
    seller?: {
      id: string;
      display_name: string | null;
      email: string | null;
    };
  };
  context_messages?: Array<{
    id: string;
    sender_id: string;
    content: string;
    created_at: string;
    sender?: {
      id: string;
      display_name: string | null;
      email: string | null;
    };
  }>;
}

export interface AdminConversation {
  id: string;
  listing_id: string | null;
  buyer_id: string;
  seller_id: string;
  last_message_at: string;
  created_at: string;
  buyer?: {
    id: string;
    display_name: string | null;
    email: string | null;
  };
  seller?: {
    id: string;
    display_name: string | null;
    email: string | null;
  };
  listing?: {
    id: string;
    title: string;
    slug: string;
  } | null;
  message_count?: number;
  flagged_count?: number;
}

/**
 * Merge an embedded `profile_private` row into its parent profile object so
 * existing consumers keep reading flat fields (email, warning_count, is_admin).
 * Sensitive columns moved to `profile_private` in the profiles split — admin
 * views read them via a PostgREST embed and flatten here.
 */
const flattenProfilePrivate = <T extends Record<string, any>>(profile: T | null | undefined): any => {
  if (!profile || typeof profile !== 'object') return profile;
  const { profile_private: priv, ...rest } = profile as any;
  return { ...rest, ...(priv ?? {}) };
};

export const useAdmin = () => {
  const supabase = useSupabase();
  const { user } = useAuth();
  const { capture } = usePostHog();
  const { handleError } = useErrorHandler();

  // Dashboard caches via useState — shared across SPA navigations on the client
  // but isolated per request on the server (a module-level cache would leak one
  // user's admin data across requests during SSR).
  const statsCache = useState<{ data: any; timestamp: number } | null>('admin-stats-cache', () => null);
  const trendCache = useState<{ data: any; timestamp: number } | null>('admin-trend-cache', () => null);
  const invalidateCache = () => {
    statsCache.value = null;
    trendCache.value = null;
  };

  /**
   * Check if current user is admin
   */
  const isAdmin = async () => {
    if (!user.value) return false;

    const { data, error } = await supabase
      .from('profile_private')
      .select('is_admin')
      .eq('user_id', user.value.id)
      .single();

    if (error) return false;
    return data?.is_admin || false;
  };

  /**
   * Get dashboard statistics (parallelized, cached for 2 min)
   */
  const getStats = async () => {
    if (statsCache.value && Date.now() - statsCache.value.timestamp < ADMIN_CACHE_TTL_MS) {
      return statsCache.value.data;
    }

    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoISO = sevenDaysAgo.toISOString();

      const [
        { count: totalUsers },
        { count: newUsers },
        { count: totalListings },
        { count: activeListings },
        { count: pendingListings },
        { count: draftListings },
        { count: soldListings },
        { count: recentListings },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgoISO),
        supabase.from('listings').select('*', { count: 'exact', head: true }),
        supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'sold'),
        supabase.from('listings').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgoISO),
      ]);

      const result = {
        totalUsers: totalUsers || 0,
        newUsers: newUsers || 0,
        totalListings: totalListings || 0,
        activeListings: activeListings || 0,
        pendingListings: pendingListings || 0,
        draftListings: draftListings || 0,
        soldListings: soldListings || 0,
        recentListings: recentListings || 0,
      };

      statsCache.value = { data: result, timestamp: Date.now() };
      return result;
    } catch (error) {
      handleError(error, { toastTitle: 'Dashboard Statistics', showToast: false, rethrow: true });
    }
  };

  /**
   * Get all listings with pagination
   */
  const getAllListings = async (page = 1, limit = 20, status?: string) => {
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    let query = supabase
      .from('listings')
      .select(
        `
        *,
        listing_photos (
          id,
          storage_path,
          display_order,
          category,
          is_primary
        ),
        profiles!listings_user_id_fkey (
          id,
          display_name,
          location,
          profile_private ( email )
        )
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });
    query = applyPhotoOrdering(query).range(start, end);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      handleError(error, { toastTitle: 'Failed to fetch listings', rethrow: true });
    }

    return {
      listings: (data || []).map((l: any) => ({ ...l, profiles: flattenProfilePrivate(l.profiles) })),
      total: count || 0,
    };
  };

  /**
   * Get all users with pagination
   */
  const getAllUsers = async (page = 1, limit = 20) => {
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    const { data, error, count } = await supabase
      .from('profiles')
      .select(`${PROFILE_PUBLIC_COLUMNS}, profile_private ( email, is_admin, warning_count, auth_provider, firebase_uid )`, {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(start, end);

    if (error) {
      handleError(error, { toastTitle: 'Failed to fetch users', rethrow: true });
    }

    return {
      users: (data || []).map(flattenProfilePrivate),
      total: count || 0,
    };
  };

  /**
   * Delete a listing and its associated storage files (admin only)
   */
  const deleteListing = async (listingId: string) => {
    // First, get all photo storage paths before deleting
    const { data: photos } = await supabase.from('listing_photos').select('storage_path').eq('listing_id', listingId);

    // Delete storage files if any exist
    if (photos && photos.length > 0) {
      const storagePaths = photos.map((p) => p.storage_path);
      const { error: storageError } = await supabase.storage.from('listing-photos').remove(storagePaths);

      if (storageError) {
        console.error('Failed to delete storage files:', storageError);
        // Continue with listing deletion even if storage cleanup fails
      }
    }

    // Delete the listing (photo records will cascade delete)
    const { error } = await supabase.from('listings').delete().eq('id', listingId);

    if (error) {
      handleError(error, { toastTitle: 'Failed to delete listing', rethrow: true });
    }

    capture('admin_listing_moderated', {
      listing_id: listingId,
      action: 'deleted',
    });

    invalidateCache();
  };

  /**
   * Update listing status (admin only)
   * Uses server API to send email notifications when appropriate
   */
  const updateListingStatus = async (listingId: string, status: string) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await $fetch(`/api/admin/listings/${listingId}/status`, {
      method: 'PUT',
      body: { status },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.success) {
      throw new Error('Failed to update listing status');
    }

    // Map listing status to moderation action
    const moderationAction = status === 'active' ? 'approved' : status === 'rejected' ? 'rejected' : undefined;
    if (moderationAction) {
      capture('admin_listing_moderated', {
        listing_id: listingId,
        action: moderationAction,
      });
    }

    invalidateCache();
  };

  /**
   * Relist a listing (admin only)
   * Resets sale metadata and sets status to active via server API
   */
  const relistListing = async (listingId: string) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await $fetch(`/api/admin/listings/${listingId}/status`, {
      method: 'PUT',
      body: { status: 'active', relist: true },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.success) {
      throw new Error('Failed to relist listing');
    }

    invalidateCache();
  };

  /**
   * Update listing tier (admin only)
   * Uses server API to update tier and featured_until
   */
  const updateListingTier = async (listingId: string, tier: 'free' | 'paid') => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await $fetch(`/api/admin/listings/${listingId}/tier`, {
      method: 'PUT',
      body: { tier },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.success) {
      throw new Error('Failed to update listing tier');
    }

    capture('admin_listing_moderated', {
      listing_id: listingId,
      action: 'approved',
      reason: `Tier changed to ${tier}`,
    });

    invalidateCache();
  };

  /**
   * Ban or unban a user
   */
  const toggleUserBan = async (userId: string, isBanned: boolean) => {
    const { error } = await supabase.from('profiles').update({ is_banned: isBanned }).eq('id', userId);

    if (error) {
      handleError(error, { toastTitle: `Failed to ${isBanned ? 'ban' : 'unban'} user`, rethrow: true });
    }

    capture('admin_user_moderated', {
      target_user_id: userId,
      action: isBanned ? 'banned' : 'unbanned',
    });

    invalidateCache();
  };

  /**
   * Get user details with their listings
   */
  const getUserDetails = async (userId: string) => {
    const [profileResult, listingsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select(`${PROFILE_PUBLIC_COLUMNS}, profile_private ( email, is_admin, warning_count, auth_provider, firebase_uid )`)
        .eq('id', userId)
        .single(),
      applyPhotoOrdering(
        supabase
          .from('listings')
          .select(
            `
          *,
          listing_photos (
            id,
            storage_path,
            is_primary
          )
        `
          )
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      ),
    ]);

    if (profileResult.error) {
      handleError(profileResult.error, { toastTitle: 'Failed to fetch user', rethrow: true });
    }

    return {
      profile: flattenProfilePrivate(profileResult.data),
      listings: listingsResult.data || [],
    };
  };

  /**
   * Update user profile (admin only)
   */
  const updateUser = async (
    userId: string,
    updates: Partial<{
      display_name: string;
      email: string;
      avatar_url: string | null;
      location: string;
      bio: string;
      preferred_currency: string;
      is_admin: boolean;
    }>
  ) => {
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);

    if (error) {
      handleError(error, { toastTitle: 'Failed to update user', rethrow: true });
    }
  };

  /**
   * Delete user account (admin only)
   */
  const deleteUser = async (userId: string) => {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);

    if (error) {
      handleError(error, { toastTitle: 'Failed to delete user', rethrow: true });
    }
  };

  /**
   * Clean up orphaned storage files (admin only)
   * Finds and deletes files in storage that don't have database records
   */
  const cleanupOrphanedStorage = async () => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await $fetch('/api/admin/storage/cleanup-orphans', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 120000, // 2 minute timeout for large storage buckets
    });

    return response;
  };

  /**
   * Get trend data for charts (last 30 days, cached for 2 min)
   */
  const getTrendData = async () => {
    if (trendCache.value && Date.now() - trendCache.value.timestamp < ADMIN_CACHE_TTL_MS) {
      return trendCache.value.data;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [listingsResult, profilesResult, allListingsResult] = await Promise.all([
      supabase
        .from('listings')
        .select('created_at, status')
        .not('status', 'in', '("example_free","example_paid")')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true }),
      supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true }),
      // All listings (not time-limited) for the status breakdown chart
      supabase.from('listings').select('status, tier').not('status', 'in', '("example_free","example_paid")'),
    ]);

    const groupByDay = (rows: Array<{ created_at: string }>) => {
      const counts: Record<string, number> = {};
      for (const row of rows) {
        const day = row.created_at.slice(0, 10); // 'YYYY-MM-DD'
        counts[day] = (counts[day] || 0) + 1;
      }
      return counts;
    };

    const listings = listingsResult.data || [];
    const profiles = profilesResult.data || [];
    const allListings = allListingsResult.data || [];

    // Count listings by status, splitting active by tier
    const statusCounts: Record<string, number> = {};
    for (const listing of allListings) {
      const status = listing.status || 'unknown';
      if (status === 'active') {
        const tierLabel = listing.tier === 'paid' ? 'active_paid' : 'active_free';
        statusCounts[tierLabel] = (statusCounts[tierLabel] || 0) + 1;
      } else {
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      }
    }

    const result = {
      listingsByDay: groupByDay(listings),
      usersByDay: groupByDay(profiles),
      statusCounts,
    };

    trendCache.value = { data: result, timestamp: Date.now() };
    return result;
  };

  /**
   * Get moderation queue — flagged and reported messages
   */
  const getMessageQueue = async (page = 1, limit = 20) => {
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    const { data, error, count } = await supabase
      .from('messages')
      .select(
        `
      *,
      sender:profiles!messages_sender_id_fkey (
        id, display_name, is_banned,
        profile_private ( email, warning_count )
      ),
      conversation:conversations!messages_conversation_id_fkey (
        id, listing_id, buyer_id, seller_id,
        listing:listings!conversations_listing_id_fkey (
          id, title, slug
        ),
        buyer:profiles!conversations_buyer_id_fkey (
          id, display_name,
          profile_private ( email )
        ),
        seller:profiles!conversations_seller_id_fkey (
          id, display_name,
          profile_private ( email )
        )
      )
    `,
        { count: 'exact' }
      )
      .or('reported_by.not.is.null,moderation_status.in.("flagged","pending")')
      .is('deleted_at', null)
      .order('reported_at', { ascending: false, nullsFirst: false })
      .range(start, end);

    if (error) {
      handleError(error, { toastTitle: 'Failed to fetch message queue', rethrow: true });
    }

    const items = (data || []).map((m: any) => ({
      ...m,
      sender: flattenProfilePrivate(m.sender),
      conversation: m.conversation
        ? {
            ...m.conversation,
            buyer: flattenProfilePrivate(m.conversation.buyer),
            seller: flattenProfilePrivate(m.conversation.seller),
          }
        : m.conversation,
    }));

    return {
      items: items as MessageQueueItem[],
      total: count || 0,
    };
  };

  /**
   * Get count of unresolved moderation queue items (for sidebar badge)
   */
  const getMessageQueueCount = async (): Promise<number> => {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .or('reported_by.not.is.null,moderation_status.in.("flagged","pending")')
      .is('deleted_at', null);

    if (error) {
      handleError(error, { toastTitle: 'Message Queue', showToast: false });
      return 0;
    }
    return count || 0;
  };

  /**
   * Get all conversations for admin browser
   */
  const getAdminConversations = async (
    page = 1,
    limit = 20,
    filters?: {
      search?: string;
      flaggedOnly?: boolean;
      dateFrom?: string;
      dateTo?: string;
    }
  ) => {
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    // Pre-filter: collect conversation IDs to restrict results
    let conversationIdFilter: string[] | null = null;

    // Flagged only: find conversations that contain flagged/reported messages
    if (filters?.flaggedOnly) {
      const { data: flagged } = await supabase
        .from('messages')
        .select('conversation_id')
        .or('reported_by.not.is.null,moderation_status.in.("flagged","pending")')
        .is('deleted_at', null);

      const ids = [...new Set((flagged || []).map((m) => m.conversation_id))];
      conversationIdFilter = ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000'];
    }

    // Search: find conversations where buyer/seller name/email or listing title matches
    if (filters?.search) {
      const q = `%${filters.search}%`;

      // Email lives on profile_private (sensitive-column split) — search it
      // separately from display_name and merge the id sets.
      const [nameResult, emailResult, listingResult] = await Promise.all([
        supabase.from('profiles').select('id').ilike('display_name', q),
        supabase.from('profile_private').select('user_id').ilike('email', q),
        supabase.from('listings').select('id').ilike('title', q),
      ]);

      const profileIds = [
        ...new Set([...(nameResult.data || []).map((p) => p.id), ...(emailResult.data || []).map((p) => p.user_id)]),
      ];
      const listingIds = (listingResult.data || []).map((l) => l.id);

      // Find conversations matching these profiles or listings
      const orFilters: string[] = [];
      if (profileIds.length > 0) {
        const joined = profileIds.join(',');
        orFilters.push(`buyer_id.in.(${joined})`);
        orFilters.push(`seller_id.in.(${joined})`);
      }
      if (listingIds.length > 0) {
        orFilters.push(`listing_id.in.(${listingIds.join(',')})`);
      }

      if (orFilters.length > 0) {
        const { data: matchedConvs } = await supabase.from('conversations').select('id').or(orFilters.join(','));

        const searchIds = (matchedConvs || []).map((c) => c.id);
        // Intersect with existing filter if flaggedOnly is also active
        if (conversationIdFilter) {
          conversationIdFilter = conversationIdFilter.filter((id) => searchIds.includes(id));
          if (conversationIdFilter.length === 0) {
            conversationIdFilter = ['00000000-0000-0000-0000-000000000000'];
          }
        } else {
          conversationIdFilter = searchIds.length > 0 ? searchIds : ['00000000-0000-0000-0000-000000000000'];
        }
      } else {
        // No matching profiles or listings — return empty
        conversationIdFilter = ['00000000-0000-0000-0000-000000000000'];
      }
    }

    let query = supabase
      .from('conversations')
      .select(
        `
      *,
      buyer:profiles!conversations_buyer_id_fkey (
        id, display_name,
        profile_private ( email )
      ),
      seller:profiles!conversations_seller_id_fkey (
        id, display_name,
        profile_private ( email )
      ),
      listing:listings!conversations_listing_id_fkey (
        id, title, slug
      )
    `,
        { count: 'exact' }
      )
      .order('last_message_at', { ascending: false });

    if (conversationIdFilter) {
      query = query.in('id', conversationIdFilter);
    }

    if (filters?.dateFrom) {
      query = query.gte('created_at', filters.dateFrom);
    }
    if (filters?.dateTo) {
      query = query.lte('created_at', filters.dateTo);
    }

    query = query.range(start, end);

    const { data, error, count } = await query;

    if (error) {
      handleError(error, { toastTitle: 'Failed to fetch conversations', rethrow: true });
    }

    const conversations = (data || []).map((c: any) => ({
      ...c,
      buyer: flattenProfilePrivate(c.buyer),
      seller: flattenProfilePrivate(c.seller),
    }));

    return {
      conversations: conversations as AdminConversation[],
      total: count || 0,
    };
  };

  /**
   * Get all messages in a conversation (admin view — includes soft-deleted)
   */
  const getAdminConversationMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select(
        `
      *,
      sender:profiles!messages_sender_id_fkey (
        id, display_name, is_banned,
        profile_private ( email, warning_count )
      )
    `
      )
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      handleError(error, { toastTitle: 'Failed to fetch messages', rethrow: true });
    }
    return (data || []).map((m: any) => ({ ...m, sender: flattenProfilePrivate(m.sender) }));
  };

  /**
   * Soft-delete a message (sets deleted_at, hides from users)
   */
  const adminDeleteMessage = async (messageId: string, conversationId: string, senderId: string) => {
    const { error } = await supabase
      .from('messages')
      .update({
        deleted_at: new Date().toISOString(),
        moderation_status: 'rejected',
      })
      .eq('id', messageId);

    if (error) {
      handleError(error, { toastTitle: 'Failed to delete message', rethrow: true });
    }

    capture('admin_message_deleted', {
      message_id: messageId,
      conversation_id: conversationId,
      sender_id: senderId,
    });
  };

  /**
   * Warn a user — atomically increments warning_count via RPC and injects system message
   */
  const adminWarnUser = async (userId: string, conversationId: string, reason?: string) => {
    if (!user.value) throw new Error('Not authenticated');

    // 1. Atomically increment warning count via RPC (avoids read-then-write race)
    const { data: newCount, error: rpcError } = await supabase.rpc('admin_increment_warning_count', {
      p_user_id: userId,
    });

    if (rpcError) {
      handleError(rpcError, { toastTitle: 'Failed to increment warning count', rethrow: true });
    }

    // 2. Inject system message
    const messageContent = reason
      ? `A moderator has reviewed this conversation. ${reason}`
      : 'A moderator has reviewed this conversation. Please keep communications respectful and on-topic.';

    const { error: msgError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.value.id,
      content: messageContent,
      is_system_message: true,
      moderation_status: 'approved',
    });

    if (msgError) {
      handleError(msgError, { toastTitle: 'Failed to send system message', rethrow: true });
    }

    capture('admin_user_warned', {
      user_id: userId,
      conversation_id: conversationId,
      warning_count: newCount,
    });
  };

  /**
   * Dismiss a report — sets moderation_status to approved, clears from queue
   */
  const dismissReport = async (messageId: string) => {
    const { error } = await supabase.from('messages').update({ moderation_status: 'approved' }).eq('id', messageId);

    if (error) {
      handleError(error, { toastTitle: 'Failed to dismiss report', rethrow: true });
    }

    capture('admin_report_dismissed', {
      message_id: messageId,
    });
  };

  /**
   * Get context messages around a specific message (3 before, 3 after)
   */
  const getMessageContext = async (messageId: string, conversationId: string) => {
    const { data: targetMsg } = await supabase.from('messages').select('created_at').eq('id', messageId).single();

    if (!targetMsg) return [];

    const { data: before } = await supabase
      .from('messages')
      .select(
        `
      id, sender_id, content, created_at,
      sender:profiles!messages_sender_id_fkey (id, display_name, profile_private ( email ))
    `
      )
      .eq('conversation_id', conversationId)
      .lt('created_at', targetMsg.created_at)
      .order('created_at', { ascending: false })
      .limit(3);

    const { data: after } = await supabase
      .from('messages')
      .select(
        `
      id, sender_id, content, created_at,
      sender:profiles!messages_sender_id_fkey (id, display_name, profile_private ( email ))
    `
      )
      .eq('conversation_id', conversationId)
      .gt('created_at', targetMsg.created_at)
      .order('created_at', { ascending: true })
      .limit(3);

    return [...(before || []).reverse(), ...(after || [])].map((m: any) => ({
      ...m,
      sender: flattenProfilePrivate(m.sender),
    }));
  };

  return {
    isAdmin,
    getStats,
    getTrendData,
    getAllListings,
    getAllUsers,
    deleteListing,
    updateListingStatus,
    relistListing,
    updateListingTier,
    toggleUserBan,
    getUserDetails,
    updateUser,
    deleteUser,
    cleanupOrphanedStorage,
    getMessageQueue,
    getMessageQueueCount,
    getAdminConversations,
    getAdminConversationMessages,
    adminDeleteMessage,
    adminWarnUser,
    dismissReport,
    getMessageContext,
  };
};
