/**
 * The client-safe half of the chat tier contract.
 *
 * Everything here is a plain constant or type, importable from BOTH the app
 * bundle (the /membership benefits table) and server code. The server-only half
 * — the H3 context accessors and the cache key — lives in
 * `server/utils/chatTiers.ts`, which re-exports this module so server consumers
 * keep one import path. Keep server-only imports OUT of this file: it ships in
 * the public client bundle.
 *
 * Mirrors the shape of `shared/utils/mcpTiers.ts` deliberately. The two gates
 * differ in one important way — see the fail-direction note in
 * `server/middleware/chat-auth.ts`.
 */

/**
 * Who is asking.
 *
 *   anonymous — no session. The assistant MUST keep working for them; that is
 *               the point of the surface and why it is indexed. Bounded at the
 *               edge only, never counted in Postgres.
 *   free      — signed in, no active membership.
 *   member    — active Sustaining Member.
 */
export type ChatTier = 'anonymous' | 'free' | 'member';

/**
 * The `subscriptions.product_id` that grants the tier. Matches the default of
 * the `user_has_subscription` RPC, which is `'sustaining'`.
 */
export const SUSTAINING_PRODUCT_ID = 'sustaining';

export interface ChatQuota {
  /**
   * Messages per rolling 24 hours, counted in KV against an anonymous browser
   * session. `null` for signed-in tiers, which are counted monthly instead.
   */
  perDay: number | null;
  /**
   * Messages per calendar month, counted exactly in Postgres against a user id.
   * `null` for the anonymous tier, which has no account to count against.
   */
  perMonth: number | null;
}

/**
 * Per-tier quotas.
 *
 * These are ABUSE CEILINGS, not expected spend. Measured usage is ~1.2 messages
 * per conversation and about forty messages a month across the whole site, so
 * nobody reaches these in normal use — they exist to bound the tail. At roughly
 * $0.01 a message on Haiku 4.5, the member ceiling caps one abusive account at
 * about $1/month against ~$1.69 of net revenue after the store cut.
 *
 * **The anonymous tier is bounded on purpose, and it has to be.** Leaving it
 * unlimited would make the whole gate decorative: signing out would be the
 * cheapest way past it. Its window is short and its ceiling generous, so a real
 * visitor never meets it while a casual abuser does.
 *
 * The member benefit is deliberately CAPABILITY, not a better model. Upgrading
 * members to Sonnet would roughly double per-message cost — the entire shared
 * budget on its own — for a difference nobody perceives on a torque lookup.
 * Sell synced history and a higher ceiling instead.
 */
export const CHAT_QUOTAS: Record<ChatTier, ChatQuota> = {
  anonymous: { perDay: 15, perMonth: null },
  free: { perDay: null, perMonth: 30 },
  member: { perDay: null, perMonth: 100 },
};

/** Where a quota-exhausted visitor is sent to upgrade. */
export const MEMBERSHIP_URL = 'https://www.classicminidiy.com/membership';

/** Cookie holding the anonymous session id the daily count is keyed on. */
export const ANON_CHAT_SESSION_COOKIE = 'cmdiy_chat_anon';
