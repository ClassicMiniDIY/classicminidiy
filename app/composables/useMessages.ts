/**
 * Messaging Composable
 * Handles conversations and messages between buyers and sellers
 */

import { checkMessageContent, validateMessageLength, getModerationWarning } from '~/utils/moderation';

export interface Conversation {
  id: string;
  listing_id: string | null;
  wanted_post_id: string | null;
  buyer_id: string;
  seller_id: string;
  last_message_at: string;
  buyer_unread_count: number;
  seller_unread_count: number;
  created_at: string;
  updated_at: string;
  listing?: {
    id: string;
    title: string;
    slug: string;
    price: number;
    status: string | null;
    latitude: number | null;
    longitude: number | null;
    city: string | null;
    location: string | null;
    listing_photos: Array<{
      storage_path: string;
      is_primary: boolean;
    }>;
  } | null;
  wanted_post?: {
    id: string;
    title: string;
  } | null;
  buyer?: {
    id: string;
    display_name: string | null;
    username: string | null;
    created_at?: string | null;
  };
  seller?: {
    id: string;
    display_name: string | null;
    username: string | null;
    created_at?: string | null;
  };
  latest_message?: Message;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  created_at: string;
  expires_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  moderation_status: 'approved' | 'flagged' | 'rejected' | 'pending';
  moderation_issues: string[] | null;
  is_read: boolean;
  created_at: string;
  updated_at: string;
  reported_by?: string[] | null;
  reported_at?: string | null;
  report_reason?: string | null;
  deleted_at?: string | null;
  is_system_message?: boolean;
  sender?: {
    id: string;
    display_name: string | null;
    username: string | null;
  };
  attachments?: MessageAttachment[];
}

export const useMessages = () => {
  const supabase = useSupabase();
  const { user } = useAuth();
  const toast = useToast();
  const { capture } = usePostHog();

  const MESSAGE_PAGE_SIZE = 50;

  const loading = ref(false);
  const sending = ref(false);

  /**
   * Fetch all conversations for the current user
   */
  const fetchConversations = async (): Promise<Conversation[]> => {
    if (!user.value) return [];

    loading.value = true;

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(
          `
          *,
          listing:listings!conversations_listing_id_fkey (
            id,
            title,
            slug,
            price,
            status,
            latitude,
            longitude,
            city,
            location,
            listing_photos!listing_photos_listing_id_fkey (
              storage_path,
              is_primary
            )
          ),
          wanted_post:wanted_posts!conversations_wanted_post_id_fkey (
            id,
            title
          ),
          buyer:public_profiles!conversations_buyer_id_fkey (
            id,
            display_name,
            username,
            created_at
          ),
          seller:public_profiles!conversations_seller_id_fkey (
            id,
            display_name,
            username,
            created_at
          )
        `
        )
        .or(`buyer_id.eq.${user.value.id},seller_id.eq.${user.value.id}`)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      return (data as Conversation[]) || [];
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to load conversations',
        color: 'error',
      });
      return [];
    } finally {
      loading.value = false;
    }
  };

  /**
   * Fetch a single conversation by ID with messages
   */
  const fetchConversation = async (conversationId: string): Promise<Conversation | null> => {
    if (!user.value) return null;

    loading.value = true;

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(
          `
          *,
          listing:listings!conversations_listing_id_fkey (
            id,
            title,
            slug,
            price,
            status,
            latitude,
            longitude,
            city,
            location,
            listing_photos!listing_photos_listing_id_fkey (
              storage_path,
              is_primary
            )
          ),
          wanted_post:wanted_posts!conversations_wanted_post_id_fkey (
            id,
            title
          ),
          buyer:public_profiles!conversations_buyer_id_fkey (
            id,
            display_name,
            username,
            created_at
          ),
          seller:public_profiles!conversations_seller_id_fkey (
            id,
            display_name,
            username,
            created_at
          )
        `
        )
        .eq('id', conversationId)
        .single();

      if (error) throw error;

      return data as Conversation;
    } catch (error: any) {
      console.error('Error fetching conversation:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to load conversation',
        color: 'error',
      });
      return null;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Fetch messages for a conversation with cursor-based pagination.
   * Returns the most recent messages first, with support for loading older ones.
   */
  const fetchMessages = async (
    conversationId: string,
    options?: { before?: string; limit?: number }
  ): Promise<{ messages: Message[]; hasMore: boolean }> => {
    if (!user.value) return { messages: [], hasMore: false };

    const limit = options?.limit || MESSAGE_PAGE_SIZE;

    try {
      let query = supabase
        .from('messages')
        .select(
          `
          *,
          sender:public_profiles!messages_sender_id_fkey (
            id,
            display_name,
            username
          ),
          attachments:message_attachments (
            id,
            message_id,
            storage_path,
            mime_type,
            size_bytes,
            width,
            height,
            created_at,
            expires_at
          )
        `
        )
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(limit + 1); // Fetch one extra to detect hasMore

      if (options?.before) {
        query = query.lt('created_at', options.before);
      }

      const { data, error } = await query;

      if (error) throw error;

      const results = (data as Message[]) || [];
      const hasMore = results.length > limit;
      const messages = hasMore ? results.slice(0, limit) : results;

      // Reverse to chronological order (oldest first)
      messages.reverse();

      return { messages, hasMore };
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to load messages',
        color: 'error',
      });
      return { messages: [], hasMore: false };
    }
  };

  /**
   * Start a new conversation or get existing one.
   * Supports both listing-based and wanted-post-based conversations.
   */
  const startConversation = async (options: {
    listingId?: string;
    wantedPostId?: string;
    recipientId: string;
  }): Promise<string | null> => {
    const { listingId, wantedPostId, recipientId } = options;

    if (!user.value) {
      toast.add({
        title: 'Authentication Required',
        description: 'Please sign in to send a message',
        color: 'warning',
      });
      return null;
    }

    if (user.value.id === recipientId) {
      toast.add({
        title: 'Invalid Action',
        description: 'You cannot message yourself',
        color: 'error',
      });
      return null;
    }

    sending.value = true;

    try {
      // Check if conversation already exists
      let query = supabase
        .from('conversations')
        .select('id')
        .eq('buyer_id', user.value.id)
        .eq('seller_id', recipientId);

      if (listingId) {
        query = query.eq('listing_id', listingId);
      } else if (wantedPostId) {
        query = query.eq('wanted_post_id', wantedPostId);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        return existing.id;
      }

      // Create new conversation
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          listing_id: listingId || null,
          wanted_post_id: wantedPostId || null,
          buyer_id: user.value.id,
          seller_id: recipientId,
        })
        .select('id')
        .single();

      if (error) throw error;

      return data.id;
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to start conversation',
        color: 'error',
      });
      return null;
    } finally {
      sending.value = false;
    }
  };

  /**
   * Send a message in a conversation.
   *
   * Optionally includes image attachments that have already been prepared
   * (compressed, dimensions read) via useMessageAttachments().prepareAttachment.
   * The message row is inserted first, then attachments are uploaded and
   * linked. On attachment failure we surface the error but keep the text
   * message — the cleanup cron sweeps any orphaned storage objects.
   */
  const sendMessage = async (
    conversationId: string,
    content: string,
    context?: {
      conversation?: { listing_id?: string; buyer_id?: string; seller_id?: string };
      existingMessageCount?: number;
      attachments?: Array<{ file: File; width: number; height: number }>;
    }
  ): Promise<boolean> => {
    if (!user.value) return false;

    const hasAttachments = (context?.attachments?.length ?? 0) > 0;

    // Validate message length. If attachments are present we allow a
    // shorter minimum but still require some text so the notification
    // email/inbox preview isn't blank.
    const lengthValidation = validateMessageLength(content);
    if (!lengthValidation.valid) {
      toast.add({
        title: 'Invalid Message',
        description: lengthValidation.message,
        color: 'error',
      });
      return false;
    }

    // Check for moderation issues (client-side pre-check)
    const moderation = checkMessageContent(content);
    if (!moderation.isClean) {
      const warning = getModerationWarning(moderation.issues);
      toast.add({
        title: 'Message Flagged',
        description: warning,
        color: 'warning',
        duration: 8000,
      });
      // Still allow sending, but warn user
    }

    sending.value = true;

    try {
      const { data: inserted, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.value.id,
          content: content.trim(),
        })
        .select('id, moderation_status, moderation_issues')
        .single();

      if (error) throw error;

      // The shared Supabase backend may "hold" a message from a new/probationary
      // account when it contains an external link: the row is saved with
      // moderation_status='pending' (and 'external_url' in moderation_issues),
      // and RLS hides it from the recipient until an admin approves it. The
      // sender still sees their own pending message, so this is NOT a failure —
      // we just let them know it's awaiting review and skip notifying the
      // recipient (who can't see it yet).
      const isPending = (inserted as any)?.moderation_status === 'pending';

      // Upload and link any attachments. If this fails we keep the text
      // message and surface a toast; orphaned storage objects (if any)
      // will be swept by the cleanup cron.
      if (hasAttachments && inserted) {
        try {
          const { attachToMessage } = useMessageAttachments();
          await attachToMessage(conversationId, inserted.id, context!.attachments!);
          capture('message_image_uploaded', {
            conversation_id: conversationId,
            count: context!.attachments!.length,
          });
        } catch (attachErr: any) {
          console.error('Failed to attach images:', attachErr);
          capture('message_image_upload_failed', {
            conversation_id: conversationId,
            error: attachErr?.message || 'unknown',
          });
          toast.add({
            title: 'Images not attached',
            description: attachErr?.message || 'Your message was sent, but the images could not be uploaded.',
            color: 'warning',
            duration: 8000,
          });
        }
      }

      // Track message sent with full context
      capture('message_sent', {
        conversation_id: conversationId,
        listing_id: context?.conversation?.listing_id || undefined,
        message_length: content.length,
        is_first_message: (context?.existingMessageCount ?? 0) === 0,
        moderation_status: isPending ? 'pending' : 'approved',
      });

      if (isPending) {
        toast.add({
          title: 'Message Pending Review',
          description:
            "Because your account is new, messages containing links are checked before the other person sees them. This lifts as your account ages — your message will appear once it's approved.",
          color: 'info',
          duration: 9000,
        });
        // Don't notify the recipient about a message they can't see yet.
        return true;
      }

      // Fire-and-forget: queue notification for the recipient
      // Server derives recipient and sender name from the conversation + auth token
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (accessToken) {
        $fetch('/api/exchange/notifications/queue-message', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: {
            conversationId,
            messagePreview: content.slice(0, 200),
          },
        }).catch((err) => console.error('Failed to queue message notification:', err));
      }

      return true;
    } catch (error: any) {
      console.error('Error sending message:', error);

      // Track message failure
      capture('message_failed', {
        error_type: error?.code || error?.message || 'unknown',
        conversation_id: conversationId,
      });

      // The shared Supabase backend enforces anti-abuse limits at the DB layer.
      // A blocked insert surfaces as a Postgres error (SQLSTATE 42501) carrying
      // a specific message. Translate the known cases into friendly copy
      // instead of a generic failure.
      const { title, description } = friendlySendError(error);
      toast.add({
        title,
        description,
        color: 'error',
        duration: 9000,
      });
      return false;
    } finally {
      sending.value = false;
    }
  };

  /**
   * Translate a failed message insert into user-friendly copy.
   *
   * The shared Supabase backend (classicminidiy-supabase messaging probation)
   * rejects sends at the DB layer with SQLSTATE 42501 and a recognizable
   * message for two cases:
   *   - Banned sender: "Account is banned from sending messages"
   *   - Fan-out cap:   "New accounts are limited to N new conversations per 24 hours…"
   * Anything else falls back to a generic-but-clear message.
   */
  const friendlySendError = (error: any): { title: string; description: string } => {
    const message: string = error?.message || '';
    const lower = message.toLowerCase();

    if (lower.includes('banned')) {
      return {
        title: 'Account Restricted',
        description:
          "Your account can't send messages right now. If you believe this is a mistake, please contact support.",
      };
    }

    if (lower.includes('new accounts are limited') || lower.includes('conversations per') || lower.includes('24 hours')) {
      return {
        title: 'New-Account Message Limit',
        description:
          // Surface the server's own message when present — it states the exact cap.
          message ||
          'New accounts can only start a few new conversations per day. This lifts as your account ages, or after 24 hours.',
      };
    }

    if (error?.code === '42501') {
      return {
        title: "Message Couldn't Be Sent",
        description:
          "You don't have permission to send this message, or a sending limit applies. New accounts have lighter limits that lift as the account ages.",
      };
    }

    return {
      title: 'Error',
      description: 'Failed to send message. Please try again.',
    };
  };

  /**
   * Mark messages as read in a conversation
   */
  const markAsRead = async (conversationId: string): Promise<void> => {
    if (!user.value) return;

    try {
      const { error } = await supabase.rpc('mark_messages_as_read', {
        p_conversation_id: conversationId,
        p_user_id: user.value.id,
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Error marking messages as read:', error);
      // Don't show toast for this - it's a background operation
    }
  };

  /**
   * Get total unread message count for current user
   */
  const getUnreadCount = async (): Promise<number> => {
    if (!user.value) return 0;

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('buyer_unread_count, seller_unread_count, buyer_id, seller_id')
        .or(`buyer_id.eq.${user.value.id},seller_id.eq.${user.value.id}`);

      if (error) throw error;
      if (!data) return 0;

      // Sum up unread counts based on user role in each conversation
      return data.reduce((total, conv) => {
        if (conv.buyer_id === user.value!.id) {
          return total + conv.buyer_unread_count;
        } else if (conv.seller_id === user.value!.id) {
          return total + conv.seller_unread_count;
        }
        return total;
      }, 0);
    } catch (error: any) {
      // Suppress AbortError (happens when navigating away)
      if (error.message?.includes('AbortError') || error.code === 'ABORT_ERR') {
        return 0;
      }
      console.error('Error getting unread count:', error);
      return 0;
    }
  };

  /**
   * Get display name for other participant in conversation
   */
  const getOtherParticipant = (
    conversation: Conversation
  ): { name: string; id: string; created_at?: string | null } | null => {
    if (!user.value) return null;

    if (conversation.buyer_id === user.value.id && conversation.seller) {
      return {
        name: conversation.seller.display_name || conversation.seller.username || 'Anonymous',
        id: conversation.seller.id,
        created_at: conversation.seller.created_at ?? null,
      };
    } else if (conversation.seller_id === user.value.id && conversation.buyer) {
      return {
        name: conversation.buyer.display_name || conversation.buyer.username || 'Anonymous',
        id: conversation.buyer.id,
        created_at: conversation.buyer.created_at ?? null,
      };
    }

    return null;
  };

  /**
   * Report a message for admin review
   */
  const reportMessage = async (messageId: string, conversationId: string, reason: string): Promise<boolean> => {
    if (!user.value) return false;

    try {
      // Use SECURITY DEFINER RPC to safely update only reporting fields
      const { error } = await supabase.rpc('report_message', {
        p_message_id: messageId,
        p_reason: reason,
      });

      if (error) {
        // Handle "Already reported" gracefully
        if (error.message?.includes('Already reported')) {
          toast.add({
            title: 'Already Reported',
            description: 'You have already reported this message.',
            color: 'info',
          });
          return false;
        }
        throw error;
      }

      capture('message_reported', {
        message_id: messageId,
        conversation_id: conversationId,
      });

      toast.add({
        title: 'Message Reported',
        description: 'Our team will review this message. Thank you.',
        color: 'success',
      });

      return true;
    } catch (error: any) {
      console.error('Error reporting message:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to report message. Please try again.',
        color: 'error',
      });
      return false;
    }
  };

  return {
    loading,
    sending,
    fetchConversations,
    fetchConversation,
    fetchMessages,
    startConversation,
    sendMessage,
    markAsRead,
    getUnreadCount,
    getOtherParticipant,
    reportMessage,
  };
};
