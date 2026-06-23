import { MAX_CONTENT_LENGTH } from '~/utils/constants';

export interface Comment {
  id: string;
  listing_id: string | null;
  external_listing_id: string | null;
  user_id: string;
  parent_id: string | null;
  content: string;
  is_question: boolean;
  is_seller_response: boolean;
  is_flagged: boolean;
  moderation_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    email: string;
  };
  replies?: Comment[];
}

export const useComments = (targetId: string, targetType: 'listing' | 'external' = 'listing') => {
  const toast = useToast();
  const { user } = useAuth();
  const supabase = useSupabase();
  const { capture } = usePostHog();

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  };

  // State keys differ by target type to avoid collisions
  const statePrefix = targetType === 'external' ? `comments-external-${targetId}` : `comments-${targetId}`;
  const comments = useState<Comment[]>(statePrefix, () => []);
  const loading = useState<boolean>(`${statePrefix}-loading`, () => false);
  const submitting = useState<boolean>(`${statePrefix}-submitting`, () => false);
  const hasMore = useState<boolean>(`${statePrefix}-hasMore`, () => false);
  const commentOffset = ref(0);
  const PAGE_SIZE = 20;
  const totalComments = computed(() => {
    // Count all comments and replies recursively
    const countReplies = (comment: Comment): number => {
      let count = 1;
      if (comment.replies && comment.replies.length > 0) {
        count += comment.replies.reduce((sum, reply) => sum + countReplies(reply), 0);
      }
      return count;
    };
    return comments.value.reduce((sum, comment) => sum + countReplies(comment), 0);
  });

  // Fetch comments for a listing or external listing
  const fetchComments = async (append = false) => {
    if (!append) {
      loading.value = true;
      commentOffset.value = 0;
    }
    try {
      const queryParams = new URLSearchParams();
      if (targetType === 'external') queryParams.set('type', 'external');
      queryParams.set('limit', PAGE_SIZE.toString());
      queryParams.set('offset', commentOffset.value.toString());

      const response = await $fetch(`/api/exchange/comments/${targetId}?${queryParams.toString()}`);

      if (append) {
        comments.value = [...comments.value, ...response.comments];
      } else {
        comments.value = response.comments;
      }
      hasMore.value = response.hasMore;
    } catch (error: any) {
      console.error('Error fetching comments:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to load comments',
        color: 'error',
      });
    } finally {
      loading.value = false;
    }
  };

  const loadMore = async () => {
    commentOffset.value += PAGE_SIZE;
    await fetchComments(true);
  };

  // Post a new comment
  const postComment = async (content: string, parentId: string | null = null, isQuestion: boolean = false) => {
    if (!user.value) {
      toast.add({
        title: 'Authentication Required',
        description: 'Please sign in to post comments',
        color: 'warning',
      });
      return false;
    }

    if (!content.trim()) {
      toast.add({
        title: 'Validation Error',
        description: 'Comment cannot be empty',
        color: 'warning',
      });
      return false;
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      toast.add({
        title: 'Validation Error',
        description: `Comment must be less than ${MAX_CONTENT_LENGTH} characters`,
        color: 'warning',
      });
      return false;
    }

    submitting.value = true;
    try {
      const body: Record<string, any> = {
        content: content.trim(),
        parentId,
        isQuestion,
      };

      // Send the correct ID field based on target type
      if (targetType === 'external') {
        body.externalListingId = targetId;
      } else {
        body.listingId = targetId;
      }

      const headers = await getAuthHeaders();
      const response = await $fetch('/api/exchange/comments/create', {
        method: 'POST',
        headers,
        body,
      });

      // Refresh comments to show the new comment
      await fetchComments();

      // Track successful comment posting
      capture('comment_posted', {
        listing_id: targetId,
        is_reply: !!parentId,
        content_length: content.trim().length,
        target_type: targetType,
      });

      toast.add({
        title: 'Success',
        description: 'Your comment has been posted',
        color: 'success',
      });

      return true;
    } catch (error: any) {
      console.error('Error posting comment:', error);

      // Track comment failure
      capture('comment_failed', {
        listing_id: targetId,
        error_type: error.data?.message || error.message || 'unknown',
        target_type: targetType,
      });

      toast.add({
        title: 'Error',
        description: error.data?.message || 'Failed to post comment',
        color: 'error',
      });
      return false;
    } finally {
      submitting.value = false;
    }
  };

  // Flag a comment as inappropriate
  const flagComment = async (commentId: string) => {
    if (!user.value) {
      toast.add({
        title: 'Authentication Required',
        description: 'Please sign in to flag comments',
        color: 'warning',
      });
      return false;
    }

    try {
      const headers = await getAuthHeaders();
      await $fetch(`/api/exchange/comments/${commentId}/flag`, {
        method: 'PATCH',
        headers,
      });

      toast.add({
        title: 'Flagged',
        description: 'Comment has been flagged for review',
        color: 'info',
      });

      // Refresh comments
      await fetchComments();

      return true;
    } catch (error: any) {
      console.error('Error flagging comment:', error);
      toast.add({
        title: 'Error',
        description: error.data?.message || 'Failed to flag comment',
        color: 'error',
      });
      return false;
    }
  };

  // Delete a comment
  const deleteComment = async (commentId: string) => {
    if (!user.value) {
      return false;
    }

    try {
      const headers = await getAuthHeaders();
      await $fetch(`/api/exchange/comments/${commentId}/delete`, {
        method: 'DELETE',
        headers,
      });

      toast.add({
        title: 'Deleted',
        description: 'Comment has been deleted',
        color: 'info',
      });

      // Refresh comments
      await fetchComments();

      return true;
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      toast.add({
        title: 'Error',
        description: error.data?.message || 'Failed to delete comment',
        color: 'error',
      });
      return false;
    }
  };

  return {
    comments,
    loading,
    submitting,
    totalComments,
    hasMore,
    fetchComments,
    loadMore,
    postComment,
    flagComment,
    deleteComment,
  };
};
