/**
 * POST /api/membership/youtube-sync
 *
 * YouTube member bridge proxy (classicminidiy-supabase
 * docs/plans/2026-09-28-youtube-member-bridge.md §6). Forwards the caller's
 * Supabase access token to the `youtube-bridge-sync` Edge Function, which reads
 * the Discord identity linked to this account (Supabase Auth `linkIdentity`,
 * provider 'discord'), looks up the YouTube level role that Discord's YouTube
 * integration granted in the Classic Mini DIY server, and attaches the matching
 * membership. /membership/youtube renders the answer.
 *
 * The web never writes `subscriptions`; the edge function owns that row.
 *
 * 200 answers pass through as `{ status, plan? }`. Error answers keep the edge
 * function's status (401 / 409 / 429 / 503 / 5xx) with `data.error` set to its
 * code (409 identity_conflict: the Discord account is tied to another site
 * account, or this account holds two Discord identities; 429
 * too_many_requests: the same user checked under 30 s ago),
 * so the page can branch on the status alone. Same pattern as
 * /api/discord/reissue.
 */
import { MEMBERSHIP_PLANS, type MembershipPlan } from '../../../shared/utils/chatTiers';

const SYNC_STATUSES = ['linked', 'no_identity', 'not_in_server', 'no_level_role'] as const;
type YoutubeSyncStatus = (typeof SYNC_STATUSES)[number];

const ERROR_MESSAGES: Record<number, string> = {
  401: 'Sign in again to link your YouTube membership',
  409: 'That Discord account cannot be matched to this account',
  429: 'You just checked. Wait a moment and try again',
  503: 'Linking YouTube memberships is not available yet',
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  const authorization = getHeader(event, 'authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Sign in required to link your YouTube membership',
      data: { error: 'unauthorized' },
    });
  }

  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  const supabaseKey = config.public.supabaseKey as string;
  if (!supabaseUrl || !supabaseKey) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase configuration is incomplete' });
  }

  let res: { status?: unknown; plan?: unknown };
  try {
    res = await $fetch<{ status?: unknown; plan?: unknown }>(`${supabaseUrl}/functions/v1/youtube-bridge-sync`, {
      method: 'POST',
      headers: {
        authorization,
        apikey: supabaseKey,
      },
    });
  } catch (error: any) {
    // Keep the edge function's status and its error code, never its raw body.
    const status = error?.statusCode || error?.status || error?.response?.status || 502;
    const code = typeof error?.data?.error === 'string' ? error.data.error : 'sync_failed';
    console.error('[membership/youtube-sync] edge function error:', error?.data || error?.message || error);
    throw createError({
      statusCode: status,
      statusMessage: ERROR_MESSAGES[status] ?? 'Could not check your YouTube membership',
      data: { error: code },
    });
  }

  const status = res?.status;
  if (typeof status !== 'string' || !SYNC_STATUSES.includes(status as YoutubeSyncStatus)) {
    console.error('[membership/youtube-sync] unexpected response shape:', res);
    throw createError({
      statusCode: 502,
      statusMessage: 'YouTube membership check did not return a usable state',
      data: { error: 'sync_failed' },
    });
  }

  if (status === 'linked') {
    // An unknown plan is not a reason to hide a success: the membership is
    // attached either way. The page then shows the success without a level.
    const plan = MEMBERSHIP_PLANS.some((p) => p.plan === res.plan) ? (res.plan as MembershipPlan) : null;
    return { status, plan };
  }

  return { status: status as YoutubeSyncStatus };
});
