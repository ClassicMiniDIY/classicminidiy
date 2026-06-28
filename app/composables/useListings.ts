import type { Database } from '~~/types/database';

type Listing = Database['public']['Tables']['listings']['Row'];
type ListingInsert = Database['public']['Tables']['listings']['Insert'];
type ListingUpdate = Database['public']['Tables']['listings']['Update'];

const FEATURED_DURATION_DAYS = 30;

export interface ListingWithPhotos extends Listing {
  // Geocoding fields (added via migration, may not be in generated types yet)
  latitude?: number | null;
  longitude?: number | null;
  formatted_address?: string | null;

  // Currency support (added via migration)
  currency?: string | null;
  final_price?: number | null;

  listing_photos: Array<{
    id: string;
    storage_path: string;
    display_order: number;
    category: string | null;
    caption: string | null;
    is_primary: boolean;
  }>;
  profiles: {
    id: string;
    display_name: string | null;
    username: string | null;
    location: string | null;
    avatar_url: string | null;
  } | null;
}

export const useListings = () => {
  const supabase = useSupabase();
  const { capture } = usePostHog();

  // Lazy-load auth only when needed (for create/update/delete operations)
  // This allows public pages to load listings without requiring authentication
  const getUser = () => {
    const { user } = useAuth();
    return user.value;
  };

  /**
   * Fetch all active listings with photos and user info
   */
  const fetchListings = async (filters?: {
    status?: string;
    min_price?: number;
    max_price?: number;
    year_min?: number;
    year_max?: number;
    model?: string;
    condition?: string;
    search?: string;
  }) => {
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
          caption,
          is_primary
        ),
        profiles:public_profiles!listings_user_id_fkey (
          id,
          display_name,
          username,
          location,
          avatar_url
        )
      `
      )
      .order('created_at', { ascending: false });
    query = applyPhotoOrdering(query);

    // Apply filters
    if (filters?.status) {
      query = query.eq('status', filters.status);
    } else {
      const { loadVisibility, activeStatuses } = useExampleListings();
      await loadVisibility();
      query = query.in('status', activeStatuses.value);
    }

    if (filters?.min_price) {
      query = query.gte('price', filters.min_price);
    }

    if (filters?.max_price) {
      query = query.lte('price', filters.max_price);
    }

    if (filters?.year_min) {
      query = query.gte('year', filters.year_min);
    }

    if (filters?.year_max) {
      query = query.lte('year', filters.year_max);
    }

    if (filters?.model) {
      query = query.eq('model', filters.model);
    }

    if (filters?.condition) {
      query = query.eq('condition', filters.condition);
    }

    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as ListingWithPhotos[];
  };

  /**
   * Fetch a single listing by slug
   */
  const fetchListingBySlug = async (slug: string) => {
    const { data, error } = await applyPhotoOrdering(
      supabase
        .from('listings')
        .select(
          `
        *,
        listing_photos (
          id,
          storage_path,
          display_order,
          category,
          caption,
          is_primary
        ),
        profiles:public_profiles!listings_user_id_fkey (
          id,
          display_name,
          username,
          location,
          avatar_url
        )
      `
        )
        .eq('slug', slug)
    ).single();

    if (error) throw error;

    // Atomically increment view count using RPC — client-only so crawler / SSR
    // hits don't inflate counts, and so we never fire an un-awaited promise
    // during SSR (the serverless context can freeze before it resolves).
    if (data && import.meta.client) {
      // Fire and forget - don't wait for response or throw errors
      supabase.rpc('increment_listing_views', { listing_id_param: data.id }).then(({ error: rpcError }) => {
        if (rpcError) {
          console.error('Failed to increment view count:', rpcError);
          // Don't throw - listing view is more important than view count
        }
      });
    }

    return data as ListingWithPhotos;
  };

  /**
   * Fetch a single listing by ID
   */
  const getListingById = async (listingId: string) => {
    const { data, error } = await applyPhotoOrdering(
      supabase
        .from('listings')
        .select(
          `
        *,
        listing_photos (
          id,
          storage_path,
          display_order,
          category,
          caption,
          is_primary
        ),
        profiles:public_profiles!listings_user_id_fkey (
          id,
          display_name,
          username,
          location,
          avatar_url
        )
      `
        )
        .eq('id', listingId)
    ).single();

    if (error) throw error;
    return data as ListingWithPhotos;
  };

  /**
   * Fetch listings for current user
   */
  const fetchUserListings = async (userId?: string) => {
    const user = getUser();
    const targetUserId = userId || user?.id;

    if (!targetUserId) throw new Error('User not authenticated');

    const { data, error } = await applyPhotoOrdering(
      supabase
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
        )
      `
        )
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
    );

    if (error) throw error;
    return data as ListingWithPhotos[];
  };

  /**
   * Create a new listing
   */
  const createListing = async (listingData: Omit<ListingInsert, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    const user = getUser();
    if (!user) throw new Error('User not authenticated');

    // Generate slug from title
    const slug = generateSlug(listingData.title as string);

    const insertData = {
      ...listingData,
      user_id: user.id,
      slug,
    };

    const { data, error } = await supabase.from('listings').insert(insertData).select().single();

    if (error) throw error;
    return data as Listing;
  };

  /**
   * Update an existing listing
   */
  const updateListing = async (listingId: string, updates: ListingUpdate) => {
    const user = getUser();
    if (!user) throw new Error('User not authenticated');

    // If title is being updated, regenerate slug
    if (updates.title) {
      updates.slug = generateSlug(updates.title as string);
    }

    const { data, error } = await supabase
      .from('listings')
      .update(updates)
      .eq('id', listingId)
      .eq('user_id', user.id) // Ensure user owns the listing
      .select()
      .single();

    if (error) throw error;

    // Track listing edit
    capture('listing_edited', {
      listing_id: listingId,
      fields_changed: Object.keys(updates),
    });

    return data as Listing;
  };

  /**
   * Delete a listing and its associated storage files
   */
  const deleteListing = async (listingId: string) => {
    const user = getUser();
    if (!user) throw new Error('User not authenticated');

    // First, get all photo storage paths before deleting
    const { data: photos } = await supabase.from('listing_photos').select('storage_path').eq('listing_id', listingId);

    // Delete the listing record first (photo records will cascade delete)
    // This order prevents orphaned DB records pointing to missing files.
    // Orphaned storage files are less critical and can be cleaned by admin tool.
    const { error } = await supabase.from('listings').delete().eq('id', listingId).eq('user_id', user.id);

    if (error) throw error;

    // Clean up storage files after successful DB deletion
    if (photos && photos.length > 0) {
      const storagePaths = photos.map((p) => p.storage_path);
      const { error: storageError } = await supabase.storage.from('listing-photos').remove(storagePaths);

      if (storageError) {
        console.error('Failed to delete storage files after deleting listing record:', storageError);
      }
    }

    // Track listing deletion
    capture('listing_deleted', {
      listing_id: listingId,
    });
  };

  /**
   * Publish a draft listing
   */
  const publishListing = async (listingId: string) => {
    return updateListing(listingId, {
      status: 'active',
      published_at: new Date().toISOString(),
    });
  };

  /**
   * Get public URL for a photo
   */
  const getPhotoUrl = (storagePath: string) => {
    const { data } = supabase.storage.from('listing-photos').getPublicUrl(storagePath);

    return data.publicUrl;
  };

  /**
   * Get the primary photo URL for a listing, or the first photo if no primary is set
   */
  const getPrimaryPhoto = (listing: ListingWithPhotos): string | undefined => {
    if (!listing.listing_photos || listing.listing_photos.length === 0) {
      return undefined;
    }

    // Find primary photo
    const primaryPhoto = listing.listing_photos.find((photo) => photo.is_primary);
    const photo = primaryPhoto || listing.listing_photos[0];

    // Convert storage path to public URL
    return photo ? getPhotoUrl(photo.storage_path) : undefined;
  };

  /**
   * Relist a sold, expired, or cancelled listing back to active
   * Resets sale-related fields, preserves tier, optionally updates price
   */
  const relistListing = async (listingId: string, previousStatus: string, tier: string, newPrice?: number) => {
    const user = getUser();
    if (!user) throw new Error('User not authenticated');

    const updates: Record<string, any> = {
      status: 'active',
      published_at: new Date().toISOString(),
      sold_date: null,
      final_price: null,
      tracking_number: null,
      tracking_carrier: null,
      promoted_on_social_at: null,
      featured_until:
        tier === 'paid' ? new Date(Date.now() + FEATURED_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString() : null,
    };

    if (newPrice !== undefined) {
      updates.price = newPrice;
    }

    const { data, error } = await supabase
      .from('listings')
      .update(updates)
      .eq('id', listingId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    capture('listing_relisted', {
      listing_id: listingId,
      previous_status: previousStatus,
      tier,
      price_changed: newPrice !== undefined,
    });

    return data as Listing;
  };

  return {
    fetchListings,
    fetchListingBySlug,
    getListingById,
    fetchUserListings,
    createListing,
    updateListing,
    deleteListing,
    publishListing,
    getPhotoUrl,
    getPrimaryPhoto,
    relistListing,
  };
};

/**
 * Generate URL-friendly slug from title with uniqueness guarantee
 */
function generateSlug(title: string): string {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50); // Limit length

  // Use crypto.randomUUID for better uniqueness than timestamp
  // Take first 8 chars of UUID for shorter URLs
  const uniqueId = crypto.randomUUID().split('-')[0];

  return `${baseSlug}-${uniqueId}`;
}
