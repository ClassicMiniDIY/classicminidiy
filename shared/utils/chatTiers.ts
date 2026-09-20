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
 *   member    — active Sustaining Member on the base plan ($1.99).
 *   plus      — Sustaining Member on the Plus plan ($4.99).
 *   pro       — Sustaining Member on the Pro plan ($9.99).
 *
 * The three paid tiers are ONE membership (same badge, sync, Discord, listings)
 * that differs in exactly one thing: this allowance. Design and the schema
 * behind it: `classicminidiy-supabase/docs/plans/2026-09-19-chat-tiers.md`.
 */
export type ChatTier = 'anonymous' | 'free' | 'member' | 'plus' | 'pro';

/**
 * Cheapest to dearest. Every wall quotes the tier ABOVE the one just hit
 * (`nextTier`), never the ceiling the caller already has.
 */
export const CHAT_TIER_ORDER: readonly ChatTier[] = ['anonymous', 'free', 'member', 'plus', 'pro'];

/** The tier a quota-exhausted caller is offered, or null at the top. */
export function nextTier(tier: ChatTier): ChatTier | null {
  const i = CHAT_TIER_ORDER.indexOf(tier);
  return i >= 0 && i < CHAT_TIER_ORDER.length - 1 ? CHAT_TIER_ORDER[i + 1]! : null;
}

/** Any paying tier: what "is a Sustaining Member" means for the chat. */
export function isPaidChatTier(tier: ChatTier | null | undefined): boolean {
  return tier === 'member' || tier === 'plus' || tier === 'pro';
}

/**
 * `subscriptions.plan` on the granting row, as `get_membership_plan(uid)`
 * returns it (NULL = not a member). Only chat-tier resolution reads it.
 */
export type MembershipPlan = 'base' | 'plus' | 'pro';

/** plan → tier. Anything unrecognised is treated as the base plan: a paying
 *  member on an unknown plan must never be dropped to `free`. */
export function chatTierForPlan(plan: string | null | undefined): ChatTier {
  if (plan === 'plus' || plan === 'pro') return plan;
  if (plan === 'base') return 'member';
  return plan ? 'member' : 'free';
}

/**
 * The three plans as sold, for copy only (the price a store or Stripe charges
 * is the store's, never restated from here into a purchase). `tier` is what
 * chat resolution yields for a member on that plan.
 */
export const MEMBERSHIP_PLANS = [
  { plan: 'base', tier: 'member', usd: 1.99 },
  { plan: 'plus', tier: 'plus', usd: 4.99 },
  { plan: 'pro', tier: 'pro', usd: 9.99 },
] as const satisfies ReadonlyArray<{ plan: MembershipPlan; tier: ChatTier; usd: number }>;

/**
 * The `subscriptions.product_id` that grants the tier. Matches the default of
 * the `user_has_subscription` RPC, which is `'sustaining'`; all three plans
 * share it.
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
 * These are cost ceilings, not expected spend. Median usage is far below any
 * of them; they exist so that the tail — one account using every question at
 * worst-case cost — still clears what its plan brings in after the store cut.
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
export const CHAT_QUOTAS = {
  anonymous: { perDay: 15, perMonth: null },
  // 2026-09-19: free 30 → 20, member 100 → 75; then with the plans, member
  // 75 → 25 and Plus 65 / Pro 135. Measured on Sonnet 5 a run costs ~$0.03
  // (cache hitting) to ~$0.05 (not); each paid cap is the break-even at
  // $0.05/run and a 30% store cut, rounded down (design §3), so no plan loses
  // money on a subscriber who uses every question. The native apps put the
  // bot front and centre and read `limit` from the peek and the 429, so this
  // is the single place to tune. Re-tune from `chat_run_completed` token
  // averages, never by feel.
  free: { perDay: null, perMonth: 20 },
  member: { perDay: null, perMonth: 25 },
  plus: { perDay: null, perMonth: 65 },
  pro: { perDay: null, perMonth: 135 },
} as const satisfies Record<ChatTier, ChatQuota>;

/** Where a quota-exhausted visitor is sent to upgrade. */
export const MEMBERSHIP_URL = 'https://www.classicminidiy.com/membership';

/** Cookie holding the anonymous session id the daily count is keyed on. */
export const ANON_CHAT_SESSION_COOKIE = 'cmdiy_chat_anon';
