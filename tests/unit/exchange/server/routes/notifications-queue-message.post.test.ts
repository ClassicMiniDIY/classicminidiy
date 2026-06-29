/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../../setup/mockSupabase';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// The route imports auth + service deps via relative specifiers
// (../../../utils/userAuth, ../../../utils/supabase,
// ../../../utils/exchange/notificationQueue). Vitest resolves those to the same
// absolute modules as the `~~/server/utils/*` ids below; vi.mock matches by
// resolved id.
//
// notificationQueue is mocked so we can assert the exact enqueue shape without
// hitting the DB. buildBatchKey is mocked to a sentinel; the route only forwards
// its return value, so the (eventType, context) ARGS are what we assert — the
// real msg:{conversationId} mapping is covered by the notificationQueue unit
// test, not here.
// ---------------------------------------------------------------------------
vi.mock('~~/server/utils/userAuth', () => ({
  requireUserClient: vi.fn(),
  requireUserAuth: vi.fn(),
}));
vi.mock('~~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(),
}));
vi.mock('~~/server/utils/exchange/notificationQueue', () => ({
  queueNotification: vi.fn(),
  queueAdminNotification: vi.fn(),
  buildBatchKey: vi.fn(() => 'bk'),
}));

import { requireUserClient } from '~~/server/utils/userAuth';
import { getServiceClient } from '~~/server/utils/supabase';
import { queueNotification, buildBatchKey } from '~~/server/utils/exchange/notificationQueue';

const handler = (await import('~~/server/api/exchange/notifications/queue-message.post')).default;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const BUYER = { id: 'buyer-1', email: 'buyer@example.com' };
const SELLER_ID = 'seller-9';
const CONVO = { buyer_id: BUYER.id, seller_id: SELLER_ID };
const SENDER_PROFILE = { display_name: 'Mini Mike' };

function evt(): any {
  return { context: {} };
}

function setBody(body: any) {
  (readBody as any).mockResolvedValue(body);
}

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

/**
 * Wire a fresh chainable supabase client whose sequential `.single()` calls
 * resolve, in order, to the values supplied. The route's happy path calls
 * `.single()` twice:
 *   1. conversation lookup (conversations select buyer_id,seller_id)
 *   2. sender profile lookup (profiles select display_name)
 */
function wireSingles(...results: Array<{ data: any; error: any }>) {
  mockSupabase = createMockSupabaseClient();
  let chain = mockSupabase._mockSingle as any;
  for (const r of results) {
    chain = chain.mockResolvedValueOnce(r);
  }
  (getServiceClient as any).mockReturnValue(mockSupabase);
}

beforeEach(() => {
  vi.clearAllMocks();

  (requireUserClient as any).mockResolvedValue({ user: { ...BUYER } });
  (queueNotification as any).mockResolvedValue(undefined);
  (buildBatchKey as any).mockReturnValue('msg:convo-123');

  setBody({ conversationId: 'convo-123', messagePreview: 'Is this still for sale?' });

  // Default wiring: conversation found -> sender profile found.
  wireSingles({ data: { ...CONVO }, error: null }, { data: { ...SENDER_PROFILE }, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  (readBody as any).mockResolvedValue({});
});

describe('server/api/exchange/notifications/queue-message.post', () => {
  // =========================================================================
  //  Happy path
  // =========================================================================
  it('returns { success: true } on the happy path', async () => {
    const result = await handler(evt());
    expect(result).toEqual({ success: true });
    expect(getServiceClient).toHaveBeenCalled();
  });

  it('queues a new_message notification to the OTHER participant (buyer -> seller)', async () => {
    await handler(evt());

    expect(queueNotification).toHaveBeenCalledTimes(1);
    const arg = (queueNotification as any).mock.calls[0][0];
    expect(arg.userId).toBe(SELLER_ID); // recipient = the non-sender participant
    expect(arg.eventType).toBe('new_message');
    expect(arg.channel).toBe('both');
    expect(arg.payload).toEqual({
      conversationId: 'convo-123',
      senderName: 'Mini Mike',
      messagePreview: 'Is this still for sale?',
    });
  });

  it('resolves the recipient as the buyer when the SELLER is the sender', async () => {
    (requireUserClient as any).mockResolvedValue({ user: { id: SELLER_ID, email: 's@e.com' } });
    wireSingles({ data: { ...CONVO }, error: null }, { data: { ...SENDER_PROFILE }, error: null });

    await handler(evt());

    const arg = (queueNotification as any).mock.calls[0][0];
    expect(arg.userId).toBe(BUYER.id);
  });

  it('builds the batch key from the conversationId (msg:{conversationId} mapping)', async () => {
    await handler(evt());
    expect(buildBatchKey).toHaveBeenCalledWith('new_message', { conversationId: 'convo-123' });
    // The route forwards buildBatchKey's return verbatim as batchKey.
    const arg = (queueNotification as any).mock.calls[0][0];
    expect(arg.batchKey).toBe('msg:convo-123');
  });

  // =========================================================================
  //  Preview handling
  // =========================================================================
  it('truncates the message preview to 200 chars', async () => {
    const long = 'x'.repeat(300);
    setBody({ conversationId: 'convo-123', messagePreview: long });
    wireSingles({ data: { ...CONVO }, error: null }, { data: { ...SENDER_PROFILE }, error: null });

    await handler(evt());

    const arg = (queueNotification as any).mock.calls[0][0];
    expect(arg.payload.messagePreview.length).toBe(200);
    expect(arg.payload.messagePreview).toBe('x'.repeat(200));
  });

  it('keeps a preview exactly at the 200-char boundary intact', async () => {
    const exactly200 = 'y'.repeat(200);
    setBody({ conversationId: 'convo-123', messagePreview: exactly200 });
    wireSingles({ data: { ...CONVO }, error: null }, { data: { ...SENDER_PROFILE }, error: null });

    await handler(evt());

    const arg = (queueNotification as any).mock.calls[0][0];
    expect(arg.payload.messagePreview).toBe(exactly200);
  });

  it('defaults the preview to an empty string when messagePreview is omitted', async () => {
    setBody({ conversationId: 'convo-123' });
    wireSingles({ data: { ...CONVO }, error: null }, { data: { ...SENDER_PROFILE }, error: null });

    await handler(evt());

    const arg = (queueNotification as any).mock.calls[0][0];
    expect(arg.payload.messagePreview).toBe('');
  });

  it('defaults the preview to an empty string when messagePreview is a non-string', async () => {
    // typeof guard: only a string is sliced; anything else -> ''.
    setBody({ conversationId: 'convo-123', messagePreview: 12345 as any });
    wireSingles({ data: { ...CONVO }, error: null }, { data: { ...SENDER_PROFILE }, error: null });

    await handler(evt());

    const arg = (queueNotification as any).mock.calls[0][0];
    expect(arg.payload.messagePreview).toBe('');
  });

  // =========================================================================
  //  Sender name resolution
  // =========================================================================
  it('falls back to "Someone" when the sender profile has no display_name', async () => {
    wireSingles({ data: { ...CONVO }, error: null }, { data: { display_name: null }, error: null });

    await handler(evt());

    const arg = (queueNotification as any).mock.calls[0][0];
    expect(arg.payload.senderName).toBe('Someone');
  });

  it('falls back to "Someone" when the sender profile lookup returns nothing', async () => {
    wireSingles({ data: { ...CONVO }, error: null }, { data: null, error: null });

    await handler(evt());

    const arg = (queueNotification as any).mock.calls[0][0];
    expect(arg.payload.senderName).toBe('Someone');
  });

  it('still queues even when the sender profile lookup errors (no throw on profile error)', async () => {
    // The route ignores the profile error (only destructures data), so it
    // proceeds with the "Someone" fallback.
    wireSingles({ data: { ...CONVO }, error: null }, { data: null, error: { message: 'profile boom' } });

    const result = await handler(evt());
    expect(result).toEqual({ success: true });
    const arg = (queueNotification as any).mock.calls[0][0];
    expect(arg.payload.senderName).toBe('Someone');
  });

  // =========================================================================
  //  Validation (400)
  // =========================================================================
  it('throws 400 when conversationId is missing', async () => {
    setBody({ messagePreview: 'hi' });
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 400,
      message: 'Missing required field: conversationId',
    });
    expect(getServiceClient).not.toHaveBeenCalled();
    expect(queueNotification).not.toHaveBeenCalled();
  });

  it('throws 400 when conversationId is an empty string', async () => {
    setBody({ conversationId: '', messagePreview: 'hi' });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
    expect(queueNotification).not.toHaveBeenCalled();
  });

  it('throws 400 when the body is empty', async () => {
    setBody({});
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
  });

  // =========================================================================
  //  Conversation lookup (404)
  // =========================================================================
  it('throws 404 when the conversation is not found', async () => {
    wireSingles({ data: null, error: null });
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 404,
      message: 'Conversation not found',
    });
    expect(queueNotification).not.toHaveBeenCalled();
  });

  it('throws 404 when the conversation lookup errors', async () => {
    wireSingles({ data: null, error: { message: 'no rows' } });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
    expect(queueNotification).not.toHaveBeenCalled();
  });

  it('queries the conversations table filtered by id, selecting only buyer_id,seller_id', async () => {
    await handler(evt());

    expect(mockSupabase.from).toHaveBeenCalledWith('conversations');
    expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'convo-123');
    const convoSelect = (mockSupabase._mockSelect as any).mock.calls[0][0];
    expect(convoSelect).toContain('buyer_id');
    expect(convoSelect).toContain('seller_id');
    // INVARIANT: the conversation select must not leak email.
    expect(convoSelect).not.toContain('email');
  });

  // =========================================================================
  //  Participant authorization (403)
  // =========================================================================
  it('throws 403 when the caller is neither the buyer nor the seller', async () => {
    (requireUserClient as any).mockResolvedValue({ user: { id: 'stranger-7', email: 'x@e.com' } });
    wireSingles({ data: { ...CONVO }, error: null });

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 403,
      message: 'Not a participant in this conversation',
    });
    expect(queueNotification).not.toHaveBeenCalled();
  });

  it('does not look up the sender profile when authorization fails', async () => {
    (requireUserClient as any).mockResolvedValue({ user: { id: 'stranger-7', email: 'x@e.com' } });
    wireSingles({ data: { ...CONVO }, error: null });

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
    // profiles must never be queried; only the conversation lookup ran.
    expect(mockSupabase.from).not.toHaveBeenCalledWith('profiles');
  });

  // =========================================================================
  //  Sender profile query shape
  // =========================================================================
  it('looks up the sender profile by the authenticated user id, selecting display_name only', async () => {
    await handler(evt());

    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', BUYER.id);
    const profileSelect = (mockSupabase._mockSelect as any).mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('display_name')
    )?.[0] as string;
    expect(profileSelect).toBe('display_name');
    expect(profileSelect).not.toContain('email');
  });

  // =========================================================================
  //  Fire-and-forget enqueue (INVARIANT: a queue failure must not fail the route)
  // =========================================================================
  it('returns success even when queueNotification rejects (fire-and-forget)', async () => {
    (queueNotification as any).mockRejectedValue(new Error('queue down'));

    const result = await handler(evt());
    expect(result).toEqual({ success: true });
  });

  // =========================================================================
  //  Auth propagation (401)
  // =========================================================================
  it('propagates auth failure (401) from requireUserClient before reading the body', async () => {
    (requireUserClient as any).mockRejectedValue(Object.assign(new Error('Unauthorized'), { statusCode: 401 }));

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
    expect(readBody).not.toHaveBeenCalled();
    expect(getServiceClient).not.toHaveBeenCalled();
  });
});
