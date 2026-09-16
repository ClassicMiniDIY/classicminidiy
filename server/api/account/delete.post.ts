/**
 * POST /api/account/delete
 *
 * Self-service account deletion proxy for /account/delete. Forwards the
 * caller's Supabase access token to the `delete-account` Edge Function, which
 * verifies the token, runs `delete_my_account()` (personal data deleted, money
 * records and sold listings detached), removes the auth user and returns
 * `{ deleted: true }`. Contract and per-table disposition live in the private
 * repo: `classicminidiy-supabase/docs/plans/2026-09-16-account-deletion.md`.
 *
 * The client must be signed in: it sends `Authorization: Bearer <access token>`
 * — same pattern as /api/discord/reissue. The token is the only thing that
 * identifies the account; there is no body and no user id parameter, so a
 * caller can only ever delete themselves.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  const authorization = getHeader(event, 'authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required to delete your account' });
  }

  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  const supabaseKey = config.public.supabaseKey as string;
  if (!supabaseUrl || !supabaseKey) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase configuration is incomplete' });
  }

  try {
    const res = await $fetch<{ deleted?: boolean }>(`${supabaseUrl}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        authorization,
        apikey: supabaseKey,
      },
    });

    if (res?.deleted !== true) {
      throw createError({ statusCode: 502, statusMessage: 'Account deletion did not complete' });
    }

    return { deleted: true };
  } catch (error: any) {
    // Preserve the Edge Function's status (401/404 drive the page's sign-in
    // state) but never leak its raw error body.
    const status = error?.statusCode || error?.status || error?.response?.status || 502;
    const message =
      status === 401 || status === 404
        ? 'Your session is no longer valid. Sign in again to delete your account'
        : error?.statusMessage || 'Could not delete your account';
    console.error('[account/delete] edge function error:', error?.data || error?.message || error);
    throw createError({ statusCode: status, statusMessage: message });
  }
});
