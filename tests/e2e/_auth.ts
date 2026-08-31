import { createClient } from '@supabase/supabase-js';

export { AUTH_STATE_PATH } from './paths';

/**
 * Signing in for E2E, without touching the sign-in UI.
 *
 * This site has NO password auth. `useAuth` offers exactly three paths and each
 * is hostile to CI:
 *
 *  - magic link (`signInWithOtp`) needs an inbox;
 *  - OAuth needs Google's or Apple's consent screen;
 *  - passkeys CANNOT run against localhost at all — an origin must be, or be a
 *    subdomain of, the RP ID `classicminidiy.com`, so no localhost origin is
 *    compatible (see the passkey invariants in CLAUDE.md).
 *
 * `/login` also mounts a Turnstile widget whose token the passkey challenge
 * spends. So driving the real form is not a realistic option, and an
 * `E2E_TEST_USER_PASSWORD` secret would be meaningless — there is nothing to
 * give it to.
 *
 * Instead the session is minted server-side with the service role and handed to
 * the browser as Playwright storage state. That is the same shape the app ends
 * up in after a real magic-link sign-in: a session object in localStorage.
 */

/** Env the setup needs. All must be present or the authenticated specs skip. */
export interface AuthEnv {
  supabaseUrl: string;
  anonKey: string;
  serviceKey: string;
  email: string;
}

export function readAuthEnv(): AuthEnv | null {
  const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NUXT_PUBLIC_SUPABASE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const email = process.env.E2E_TEST_USER_EMAIL;
  if (!supabaseUrl || !anonKey || !serviceKey || !email) return null;
  return { supabaseUrl, anonKey, serviceKey, email };
}

/**
 * The localStorage key supabase-js writes the session under.
 *
 * supabase-js derives it as `sb-<first hostname label>-auth-token` when no
 * explicit `storageKey` is set, and `app/composables/useSupabase.ts` sets none.
 *
 * Note what that means HERE: the project is reached through the custom domain
 * `auth.classicminidiy.com` (every URL is built from NUXT_PUBLIC_SUPABASE_URL),
 * so the key is `sb-auth-auth-token` — NOT `sb-<project-ref>-auth-token` as it
 * would be on the raw supabase.co host. Confirmed against a running browser,
 * which logs `GoTrueClient@sb-auth-auth-token`.
 *
 * `assertSessionAdopted` below re-checks this at runtime rather than trusting
 * it, because a change to the Supabase URL silently changes the key and the
 * only symptom would be "the authenticated specs quietly run signed out".
 */
export function storageKeyFor(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
}

/**
 * Resolve `email` to a real auth user, or refuse to go any further.
 *
 * This exists because `generateLink` creates users as a side effect (see
 * mintSession), so an unverified email is an account-creation hazard rather
 * than a harmless miss.
 *
 * It deliberately does NOT use `admin.listUsers()`, which is the obvious call:
 * on this project that returns `Database error finding users`, and a check that
 * errors is a check that either fails every run or gets "temporarily" removed.
 *
 * Instead it resolves the id through `profile_private.email` — service role
 * bypasses RLS, and every account gets a row via the profile trigger — and then
 * confirms that id against auth.users with `getUserById`, which is
 * authoritative and cheap. Two lookups, each with its own clear failure.
 */
async function resolveTestUserId(admin: ReturnType<typeof createClient>, email: string): Promise<string> {
  const wanted = email.trim().toLowerCase();

  const { data: row, error: rowError } = await admin
    .from('profile_private')
    .select('user_id')
    // .eq, NOT .ilike. PostgREST passes an ilike value through as a LIKE
    // PATTERN, so `_` and `%` in the address become wildcards: verified against
    // the live table that `email ilike '_2e-bot@...'` matches the real
    // `e2e-bot@...` row, and 12 accounts currently contain an underscore. A
    // wildcard match could resolve to a DIFFERENT user and mint a session for
    // their account. Case-insensitivity is not lost by this: all 492 stored
    // addresses are already lowercase, and `wanted` is lowercased above.
    .eq('email', wanted)
    .maybeSingle();

  if (rowError) {
    throw new Error(`Could not look up ${email} in profile_private: ${rowError.message}`);
  }
  if (!row?.user_id) {
    throw new Error(
      `E2E_TEST_USER_EMAIL is set to "${email}", which matches no account.\n` +
        'Refusing to continue: generateLink() would CREATE that user rather than fail, ' +
        'so a typo here would silently add an account to production on every run.\n' +
        'Create the user deliberately (Supabase dashboard -> Authentication -> Users -> ' +
        'Add user, auto-confirm), or point the secret at an address that already exists.'
    );
  }

  const { data: user, error: userError } = await admin.auth.admin.getUserById(row.user_id as string);
  if (userError || !user?.user) {
    throw new Error(
      `${email} has a profile_private row but no auth.users record (${userError?.message ?? 'not found'}). ` +
        'That is a broken account, not a usable test user.'
    );
  }

  return row.user_id as string;
}

/**
 * Mint a real session for `email` using the service role.
 *
 * `generateLink` does not email anything — it returns the token directly — and
 * `verifyOtp` exchanges it for a genuine access/refresh pair. No inbox, no
 * Turnstile, no third-party consent screen.
 */
export async function mintSession(env: AuthEnv) {
  const admin = createClient(env.supabaseUrl, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // MUST come before generateLink. `generateLink({ type: 'magiclink' })` is NOT
  // read-only: given an address with no auth.users row it CREATES one and
  // returns a token for it. Verified the hard way — a probe against a
  // deliberately non-existent `@example.invalid` address produced a real user
  // row in production.
  //
  // Without this guard a typo'd E2E_TEST_USER_EMAIL would silently mint a new
  // account on every nightly run, and nothing would report it: the specs would
  // pass, because the freshly created user signs in perfectly well.
  await resolveTestUserId(admin, env.email);

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: env.email,
  });
  if (linkError || !link?.properties?.hashed_token) {
    throw new Error(
      `Could not generate a sign-in link for ${env.email}: ${linkError?.message ?? 'no hashed_token returned'}.`
    );
  }

  // Verify with the ANON client: the session must be one the browser could
  // itself have obtained. A service-role token would not behave like a user.
  const anon = createClient(env.supabaseUrl, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink',
  });
  if (error || !data.session) {
    throw new Error(`Could not exchange the sign-in link for a session: ${error?.message ?? 'no session returned'}`);
  }

  return data.session;
}

/**
 * Fail loudly if the page did not actually adopt the session.
 *
 * Without this the failure mode is silent and misleading: the specs run signed
 * OUT, every auth-gated assertion "passes" by finding a sign-in prompt, and the
 * suite reports green while covering nothing. That is precisely the shape of
 * bug this whole harness exists to prevent, so it must not be reintroduced by
 * the harness itself.
 */
export async function assertSessionAdopted(page: import('@playwright/test').Page, key: string): Promise<void> {
  const stored = await page.evaluate((k) => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  }, key);

  if (stored) {
    // Presence is not validity. The state is minted once per run and reused, so
    // an expired access_token would still sit under the key while the app
    // renders signed OUT — every auth-gated assertion would then pass against
    // the wrong page state and the suite would report green while covering
    // nothing, which is the exact silent pass this function exists to prevent.
    let expiresAt: number | undefined;
    try {
      expiresAt = (JSON.parse(stored) as { expires_at?: number }).expires_at;
    } catch {
      throw new Error(`The session stored under "${key}" is not valid JSON.`);
    }
    if (typeof expiresAt === 'number' && expiresAt * 1000 <= Date.now()) {
      throw new Error(
        `The session under "${key}" expired at ${new Date(expiresAt * 1000).toISOString()}. ` +
          'Storage state is minted once per run; a long run can outlive the token.'
      );
    }
    return;
  }

  if (!stored) {
    const keys = await page.evaluate(() => {
      try {
        return Object.keys(window.localStorage).filter((k) => k.startsWith('sb-'));
      } catch {
        return [];
      }
    });
    throw new Error(
      `The browser has no Supabase session under "${key}".\n` +
        `Supabase-ish keys actually present: ${keys.length ? keys.join(', ') : '(none)'}.\n` +
        'If a key is listed under a different name, NUXT_PUBLIC_SUPABASE_URL changed ' +
        'and storageKeyFor() needs to follow it.'
    );
  }
}
