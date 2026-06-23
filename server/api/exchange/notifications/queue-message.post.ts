/**
 * POST /api/exchange/notifications/queue-message
 *
 * Called by the client after sending a message; queues a `new_message`
 * notification for the recipient (converged onto notification_queue —
 * new_message is a registered event type with a process-notifications builder).
 * Converged from TheMiniExchange's /api/notifications/queue-message: auth rewired
 * to requireUserClient; service lookups via getServiceClient.
 *
 * Body: { conversationId, messagePreview? }
 */
import { requireUserClient } from '../../../utils/userAuth';
import { getServiceClient } from '../../../utils/supabase';
import { queueNotification, buildBatchKey } from '../../../utils/exchange/notificationQueue';

export default defineEventHandler(async (event) => {
  const { user } = await requireUserClient(event);

  const body = await readBody<{ conversationId?: string; messagePreview?: string }>(event);
  const { conversationId, messagePreview } = body;
  if (!conversationId) {
    throw createError({ statusCode: 400, message: 'Missing required field: conversationId' });
  }

  const serviceClient = getServiceClient();

  // Verify the caller is a participant and derive the recipient.
  const { data: conversation, error: convError } = await serviceClient
    .from('conversations')
    .select('buyer_id, seller_id')
    .eq('id', conversationId)
    .single();

  if (convError || !conversation) {
    throw createError({ statusCode: 404, message: 'Conversation not found' });
  }

  const { buyer_id, seller_id } = conversation;
  if (user.id !== buyer_id && user.id !== seller_id) {
    throw createError({ statusCode: 403, message: 'Not a participant in this conversation' });
  }

  const recipientId = user.id === buyer_id ? seller_id : buyer_id;

  const { data: senderProfile } = await serviceClient
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  const senderName = senderProfile?.display_name || 'Someone';
  const preview = typeof messagePreview === 'string' ? messagePreview.slice(0, 200) : '';

  try {
    await queueNotification({
      userId: recipientId,
      eventType: 'new_message',
      payload: { conversationId, senderName, messagePreview: preview },
      channel: 'both',
      batchKey: buildBatchKey('new_message', { conversationId }),
    });
  } catch (err) {
    // Log but don't fail — the message itself was already sent.
    console.error('[QueueMessage] Failed to queue notification:', err);
  }

  return { success: true };
});
