/**
 * POST /api/discourse/sso
 *
 * DiscourseConnect identity provider for Classic Mini DIY Community
 * (community.classicminidiy.com). Design: docs/plans/2026-10-03-discourse-sso.md.
 *
 * The page /discourse/sso receives Discourse's signed `sso` + `sig`, reads the
 * Supabase session from the browser and POSTs both here with
 * `Authorization: Bearer`. This route checks the request, the user and the
 * membership, and answers `{ redirect }`: the forum's `return_sso_url` with a
 * signed answer. The page then does the external navigation. This route never
 * issues a 302 itself, because the page calls it with `$fetch`.
 *
 * Errors carry `data.error` so the page can branch:
 *   400 bad_request | bad_signature, 401 (requireUserAuth), 403 email_unverified,
 *   reauth_required or a suspended account (requireUserAuth), 409 username_required,
 *   503 sso_unconfigured | profile_unavailable | membership_unavailable.
 *
 * Never log `sso`, `sig` or the user's email.
 */
import { SUSTAINING_PRODUCT_ID } from '../../../shared/utils/chatTiers';
import { RESERVED_USERNAMES, isWellFormedForumUsername } from '../../../shared/utils/usernames';
import {
  DISCOURSE_SSO_MAX_LENGTH,
  decodeDiscoursePayload,
  isValidDiscourseSig,
  isValidDiscourseSsoParam,
  signDiscoursePayload,
  verifyDiscourseSig,
} from '../../utils/discourseConnect';
import { serverRuntimeConfig } from '../../utils/runtimeConfig';
import { getServiceClient } from '../../utils/supabase';
import { extractAccessToken, requireUserAuth } from '../../utils/userAuth';

/** Body limit. A real body is about 250 bytes. */
const MAX_BODY_BYTES = 2048;

/** The forum group that carries the Sustaining Member flair. */
const MEMBER_GROUP = 'sustaining_members';

/** Discourse's DiscourseConnect endpoint. `return_sso_url` must be exactly this path. */
const RETURN_PATH = '/session/sso_login';

/** Supabase Storage prefix for profile avatars. Only these are forwarded to the forum. */
const AVATAR_PATH_PREFIX = '/storage/v1/object/public/avatars/';
/**
 * Hosts that serve our Supabase Storage: the custom domain, and the project host that
 * older avatar URLs still use. The configured runtime host is added as well.
 */
const AVATAR_HOSTS = ['auth.classicminidiy.com', 'psoqirvbujwohemmwplv.supabase.co'] as const;

function fail(statusCode: number, error: string, statusMessage: string): never {
  throw createError({ statusCode, statusMessage, data: { error } });
}

/** The configured forum origin, or null when unset or not an https URL. */
function forumOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * `return_sso_url` must be https on exactly the forum origin, at exactly
 * RETURN_PATH, with no credentials, query or fragment. The raw string is
 * checked for `?` and `#` too, because URL parsing drops an empty query or
 * fragment. Returns the parsed URL, or null.
 */
function parseForumReturnUrl(value: string | null | undefined, origin: string): URL | null {
  if (!value || value.includes('?') || value.includes('#')) return null;
  try {
    const url = new URL(value);
    const ok =
      url.protocol === 'https:' &&
      url.origin === origin &&
      url.pathname === RETURN_PATH &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash;
    return ok ? url : null;
  } catch {
    return null;
  }
}

/**
 * The sign-in methods recorded in the access token's `amr` claim, or null when
 * the claim is absent or unreadable. The token was already verified by GoTrue
 * in requireUserAuth; this only reads its payload.
 */
function sessionMethods(token: string | undefined): string[] | null {
  const part = token?.split('.')[1];
  if (!part) return null;
  try {
    const json = atob(
      part
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(part.length / 4) * 4, '=')
    );
    const amr = (JSON.parse(json) as { amr?: unknown }).amr;
    if (!Array.isArray(amr)) return null;
    return amr.map((entry) => (typeof entry === 'string' ? entry : String(entry?.method ?? '')));
  } catch {
    return null;
  }
}

/** The part of an email address before the last `@`, lowercase. */
function emailLocalPart(email: string): string {
  const at = email.lastIndexOf('@');
  return (at > 0 ? email.slice(0, at) : email).toLowerCase();
}

/** The host of the configured Supabase URL, or null. */
function hostOf(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

/** An avatar the forum may fetch: https, on our Supabase hosts, in the public avatars bucket. */
function isSiteAvatarUrl(value: unknown, hosts: readonly string[]): value is string {
  if (typeof value !== 'string' || !value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && hosts.includes(url.host) && url.pathname.startsWith(AVATAR_PATH_PREFIX);
  } catch {
    return false;
  }
}

export default defineEventHandler(async (event) => {
  // 1. Config. Either value missing → 503; the route is inert until both exist.
  const config = serverRuntimeConfig(event);
  const secret = config.DISCOURSE_CONNECT_SECRET as string;
  const origin = forumOrigin(config.public.discourseUrl);
  if (!secret || !origin) {
    fail(503, 'sso_unconfigured', 'Forum sign-in is not available yet');
  }

  // 2. Body shape and size.
  const contentLength = Number(getHeader(event, 'content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) fail(400, 'bad_request', 'Invalid forum sign-in request');
  const body = await readBody<{ sso?: unknown; sig?: unknown }>(event).catch(() => null);
  const sso = body?.sso;
  const sig = body?.sig;
  if (
    !isValidDiscourseSsoParam(sso) ||
    sso.length > DISCOURSE_SSO_MAX_LENGTH ||
    !isValidDiscourseSig(sig) ||
    sso.length + sig.length > MAX_BODY_BYTES
  ) {
    fail(400, 'bad_request', 'Invalid forum sign-in request');
  }

  // 3. Signature (constant-time, Web Crypto).
  if (!(await verifyDiscourseSig(sso, sig, secret))) {
    fail(400, 'bad_signature', 'Invalid forum sign-in request');
  }

  // 4. Payload. The signature proves Discourse made it; the origin check stops
  // a misconfigured or leaked secret from making this an open redirect that
  // carries a user's email.
  const request = decodeDiscoursePayload(sso);
  const nonce = request?.get('nonce');
  const returnUrl = parseForumReturnUrl(request?.get('return_sso_url'), origin);
  if (!request || !nonce || !returnUrl) {
    fail(400, 'bad_request', 'Invalid forum sign-in request');
  }

  // 5. Session (401 no/invalid token, 403 suspended account).
  const { user } = await requireUserAuth(event);

  // 5a. Forum sign-in requires a session from one of the site's own sign-in
  // methods (magic link / OTP, Google, Apple, passkey). The site offers no
  // password sign-in, so a session whose methods are all `password` is sent
  // back through /login. A missing `amr` claim is accepted.
  const methods = sessionMethods(extractAccessToken(event));
  if (methods && methods.length > 0 && methods.every((method) => method === 'password')) {
    fail(403, 'reauth_required', 'Sign in again to continue to the forum');
  }

  // 6. Confirmed email only. Discourse links a DiscourseConnect login to an
  // existing forum account with the same email, so an unconfirmed address
  // could claim someone else's account.
  if (!user.email || !user.email_confirmed_at) {
    fail(403, 'email_unverified', 'Confirm your email address before you sign in to the forum');
  }

  const db = getServiceClient();

  // 7. Profile. Re-check the username here; never trust that the page ran
  // the identity step.
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('username, display_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) {
    console.error('[discourse/sso] profile read failed:', profileError.message);
    fail(503, 'profile_unavailable', 'Forum sign-in is temporarily unavailable');
  }
  if (!profile || !isWellFormedForumUsername(profile.username)) {
    fail(409, 'username_required', 'Choose a forum username first');
  }
  // A reserved name is accepted only for the account the database grants it to
  // (reserved_username_owners, service-role only; the profiles trigger enforces
  // the same rule on write).
  if (RESERVED_USERNAMES.has(profile.username)) {
    const { data: owner, error: ownerError } = await db
      .from('reserved_username_owners')
      .select('user_id')
      .eq('username', profile.username)
      .eq('user_id', user.id)
      .maybeSingle();
    if (ownerError) {
      console.error('[discourse/sso] reserved-name owner read failed:', ownerError.message);
      fail(503, 'profile_unavailable', 'Forum sign-in is temporarily unavailable');
    }
    if (!owner) fail(409, 'username_required', 'Choose a forum username first');
  }

  // 8. Membership. Gate on user_has_subscription, never on `plan`. A failed
  // check is a 503: guessing would add or remove someone's flair wrongly.
  const { data: isMember, error: membershipError } = await db.rpc('user_has_subscription', {
    p_user_id: user.id,
    p_product_id: SUSTAINING_PRODUCT_ID,
  });
  if (membershipError) {
    console.error('[discourse/sso] membership check failed:', membershipError.message);
    fail(503, 'membership_unavailable', 'Forum sign-in is temporarily unavailable');
  }

  // 9. Answer payload. Booleans are the strings "true"/"false". Never send
  // admin, moderator, groups, title, bio, website or location: forum staff and
  // forum profiles are managed in Discourse.
  const answer = new URLSearchParams();
  answer.set('nonce', nonce);
  answer.set('external_id', user.id);
  answer.set('email', user.email);
  answer.set('username', profile.username);
  const displayName = profile.display_name?.trim() ?? '';
  if (displayName && displayName.toLowerCase() !== emailLocalPart(user.email)) {
    answer.set('name', displayName);
  }
  const avatarHosts = [...AVATAR_HOSTS, hostOf(config.public.supabaseUrl)].filter((h): h is string => !!h);
  if (isSiteAvatarUrl(profile.avatar_url, avatarHosts)) answer.set('avatar_url', profile.avatar_url);
  answer.set('require_activation', 'false');
  answer.set(isMember === true ? 'add_groups' : 'remove_groups', MEMBER_GROUP);

  // 10. Sign and hand the URL back to the page.
  const signed = await signDiscoursePayload(answer, secret);
  setHeader(event, 'cache-control', 'no-store');
  returnUrl.searchParams.set('sso', signed.sso);
  returnUrl.searchParams.set('sig', signed.sig);
  return { redirect: returnUrl.href };
});
