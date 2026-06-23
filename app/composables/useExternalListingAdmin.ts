import type { ExternalListing } from './useExternalListings';

type FindCategory = 'vehicle' | 'engine' | 'parts';

export interface ExternalListingAdminFilters {
  status?: 'pending' | 'approved' | 'rejected' | 'expired';
  sourceSite?: string;
  page?: number;
  limit?: number;
}

export interface ExternalListingEditableFields {
  title?: string;
  description?: string | null;
  category?: FindCategory | null;
  tags?: string[];
  year?: number | null;
  model?: string | null;
  price?: number | null;
  price_label?: string | null;
  editor_commentary?: string | null;
  admin_notes?: string | null;
}

export const useExternalListingAdmin = () => {
  const supabase = useSupabase();
  const { user } = useAuth();
  const toast = useToast();
  const { capture } = usePostHog();

  // State
  const pendingFinds = useState<ExternalListing[]>('external-listings-admin-pending', () => []);
  const allFinds = useState<ExternalListing[]>('external-listings-admin-all', () => []);
  const loading = useState<boolean>('external-listings-admin-loading', () => false);

  /**
   * Fetch all pending finds for admin review.
   */
  const fetchPending = async () => {
    loading.value = true;
    try {
      const { data, error } = await supabase
        .from('external_listings')
        .select(
          `
          *,
          profiles!external_listings_submitted_by_fkey (
            display_name,
            avatar_url
          )
        `
        )
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      pendingFinds.value = (data as unknown as ExternalListing[]) || [];
    } catch (error: any) {
      console.error('Error fetching pending finds:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to load pending finds',
        color: 'error',
      });
    } finally {
      loading.value = false;
    }
  };

  /**
   * Fetch all finds with optional status/source filter and pagination.
   */
  const fetchAll = async (filters?: ExternalListingAdminFilters) => {
    loading.value = true;
    try {
      const page = filters?.page ?? 1;
      const limit = filters?.limit ?? 20;
      const start = (page - 1) * limit;
      const end = start + limit - 1;

      let query = supabase
        .from('external_listings')
        .select(
          `
          *,
          profiles!external_listings_submitted_by_fkey (
            display_name,
            avatar_url
          )
        `,
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(start, end);

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.sourceSite) {
        query = query.eq('source_site', filters.sourceSite);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      allFinds.value = (data as unknown as ExternalListing[]) || [];
      return { finds: allFinds.value, total: count || 0 };
    } catch (error: any) {
      console.error('Error fetching all finds:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to load finds',
        color: 'error',
      });
      return { finds: [], total: 0 };
    } finally {
      loading.value = false;
    }
  };

  /**
   * Approve a pending find. Sets status to 'approved', published_at to now,
   * and optionally sets editor commentary and editor's pick.
   */
  const approve = async (id: string, editorCommentary?: string, isEditorsPick?: boolean) => {
    if (!user.value) throw new Error('Not authenticated');

    try {
      const updates: Record<string, any> = {
        status: 'approved',
        published_at: new Date().toISOString(),
      };

      if (editorCommentary !== undefined) {
        updates.editor_commentary = editorCommentary;
      }

      if (isEditorsPick !== undefined) {
        updates.is_editors_pick = isEditorsPick;
      }

      const { error } = await supabase.from('external_listings').update(updates).eq('id', id);

      if (error) throw error;

      // Remove from pending list
      pendingFinds.value = pendingFinds.value.filter((f) => f.id !== id);

      capture('find_approved', {
        id,
        is_editors_pick: isEditorsPick || false,
      });

      toast.add({
        title: 'Find Approved',
        description: 'The find has been approved and is now visible to the community.',
        color: 'success',
      });
    } catch (error: any) {
      console.error('Error approving find:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to approve find',
        color: 'error',
      });
    }
  };

  /**
   * Reject a pending find. Sets status to 'rejected' and stores the reason in admin_notes.
   */
  const reject = async (id: string, reason?: string) => {
    if (!user.value) throw new Error('Not authenticated');

    try {
      const updates: Record<string, any> = {
        status: 'rejected',
      };

      if (reason) {
        updates.admin_notes = reason;
      }

      const { error } = await supabase.from('external_listings').update(updates).eq('id', id);

      if (error) throw error;

      // Remove from pending list
      pendingFinds.value = pendingFinds.value.filter((f) => f.id !== id);

      capture('find_rejected', {
        id,
        reason: reason || null,
      });

      toast.add({
        title: 'Find Rejected',
        description: 'The find has been rejected.',
        color: 'warning',
      });
    } catch (error: any) {
      console.error('Error rejecting find:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to reject find',
        color: 'error',
      });
    }
  };

  /**
   * Refetch metadata for a find by calling the parse API endpoint,
   * then updating the record with the new metadata.
   */
  const refetchMetadata = async (id: string) => {
    if (!user.value) throw new Error('Not authenticated');

    try {
      // Get the source URL for this record
      const { data: record, error: fetchError } = await supabase
        .from('external_listings')
        .select('source_url')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      if (!record) throw new Error('Find not found');

      // Call the parse endpoint to refetch metadata
      const response = await $fetch('/api/exchange/external-listings/parse', {
        method: 'POST',
        body: { url: record.source_url },
      });

      const { metadata } = response;

      // Update the record with the new metadata.
      // Only overwrite fields that the parser actually returned a value for —
      // null means "not found", so we skip it to preserve manual edits.
      const updates: Record<string, any> = {
        metadata_fetched_at: new Date().toISOString(),
      };

      if (metadata.title) updates.title = metadata.title;
      if (metadata.description) updates.og_description = metadata.description;
      if (metadata.imageUrl) updates.og_image_url = metadata.imageUrl;
      if (metadata.sourceSite) updates.source_site = metadata.sourceSite;
      if (metadata.year != null) updates.year = metadata.year;
      if (metadata.model) updates.model = metadata.model;
      if (metadata.price != null) updates.price = metadata.price;
      if (metadata.priceLabel) updates.price_label = metadata.priceLabel;
      if (metadata.auctionEndTime) updates.auction_end_time = metadata.auctionEndTime;
      if (metadata.category) updates.category = metadata.category;

      let { error: updateError } = await supabase.from('external_listings').update(updates).eq('id', id);

      // If the update fails due to a CHECK constraint on source_site (e.g. 'copart'
      // not yet added to the DB enum), retry without source_site so other fields
      // still get updated.
      if (updateError && updateError.code === '23514' && updates.source_site) {
        const { source_site: _, ...updatesWithoutSite } = updates;
        const retry = await supabase.from('external_listings').update(updatesWithoutSite).eq('id', id);
        updateError = retry.error;
      }

      if (updateError) throw updateError;

      toast.add({
        title: 'Metadata Refreshed',
        description: 'The listing metadata has been updated from the source.',
        color: 'success',
      });

      return metadata;
    } catch (error: any) {
      console.error('Error refetching metadata:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to refetch metadata from source',
        color: 'error',
      });
      return null;
    }
  };

  /**
   * Bulk re-fetch metadata for a list of finds.
   * Processes sequentially to avoid rate-limiting the parse endpoint.
   * Calls the provided progress callback after each find completes.
   */
  const bulkRefetchMetadata = async (
    ids: string[],
    onProgress?: (completed: number, total: number, currentTitle: string) => void
  ): Promise<{ succeeded: number; failed: number }> => {
    if (!user.value) throw new Error('Not authenticated');

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const find = allFinds.value.find((f) => f.id === id) || pendingFinds.value.find((f) => f.id === id);
      onProgress?.(i, ids.length, find?.title || 'Unknown');

      try {
        await refetchMetadata(id);
        succeeded++;
      } catch {
        failed++;
      }
    }

    onProgress?.(ids.length, ids.length, '');

    toast.add({
      title: 'Bulk Refresh Complete',
      description: `${succeeded} refreshed, ${failed} failed out of ${ids.length} finds.`,
      color: failed > 0 ? 'warning' : 'success',
    });

    return { succeeded, failed };
  };

  /**
   * Toggle the editor's pick status on a find.
   */
  const toggleEditorsPick = async (id: string) => {
    if (!user.value) throw new Error('Not authenticated');

    try {
      // Fetch current value
      const { data: record, error: fetchError } = await supabase
        .from('external_listings')
        .select('is_editors_pick')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      if (!record) throw new Error('Find not found');

      const newValue = !record.is_editors_pick;

      const { error } = await supabase.from('external_listings').update({ is_editors_pick: newValue }).eq('id', id);

      if (error) throw error;

      // Update local state
      const updateLocal = (list: ExternalListing[]) =>
        list.map((f) => (f.id === id ? { ...f, is_editors_pick: newValue } : f));
      pendingFinds.value = updateLocal(pendingFinds.value);
      allFinds.value = updateLocal(allFinds.value);

      toast.add({
        title: newValue ? "Editor's Pick Set" : "Editor's Pick Removed",
        description: newValue
          ? "This find is now highlighted as an editor's pick."
          : "This find is no longer an editor's pick.",
        color: 'success',
      });
    } catch (error: any) {
      console.error("Error toggling editor's pick:", error);
      toast.add({
        title: 'Error',
        description: "Failed to update editor's pick status",
        color: 'error',
      });
    }
  };

  /**
   * Partially update editable fields on a find.
   */
  const updateFind = async (id: string, fields: ExternalListingEditableFields) => {
    if (!user.value) throw new Error('Not authenticated');

    try {
      const { error } = await supabase.from('external_listings').update(fields).eq('id', id);

      if (error) throw error;

      // Update local state
      const updateLocal = (list: ExternalListing[]) => list.map((f) => (f.id === id ? { ...f, ...fields } : f));
      pendingFinds.value = updateLocal(pendingFinds.value);
      allFinds.value = updateLocal(allFinds.value);

      toast.add({
        title: 'Find Updated',
        description: 'The find has been updated successfully.',
        color: 'success',
      });
    } catch (error: any) {
      console.error('Error updating find:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to update find',
        color: 'error',
      });
    }
  };

  /**
   * Delete a find via the API endpoint.
   */
  const deleteFind = async (id: string) => {
    if (!user.value) throw new Error('Not authenticated');

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    await $fetch(`/api/exchange/external-listings/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    pendingFinds.value = pendingFinds.value.filter((f) => f.id !== id);
    allFinds.value = allFinds.value.filter((f) => f.id !== id);

    toast.add({
      title: 'Find Deleted',
      description: 'The find has been deleted.',
      color: 'success',
    });
  };

  return {
    // State
    pendingFinds,
    allFinds,
    loading,

    // Methods
    fetchPending,
    fetchAll,
    approve,
    reject,
    refetchMetadata,
    bulkRefetchMetadata,
    toggleEditorsPick,
    updateFind,
    deleteFind,
  };
};
