import type { PasskeyListItem } from '@supabase/supabase-js';

/**
 * WebAuthn passkeys, on top of Supabase Auth's experimental passkey API.
 *
 * Two load-bearing facts about that API drive the shape of this composable:
 *
 * 1. Every passkey method THROWS unless the client was created with
 *    `auth.experimental.passkey: true`. That flag is set in `useSupabase()`;
 *    do not remove it.
 * 2. The methods return `{ data, error }` rather than throwing on failure —
 *    including the very common "user closed the system prompt" case, which is
 *    a normal outcome and not something to surface as an error. `isCancelled()`
 *    below is what separates the two, so a dismissed prompt leaves the UI
 *    exactly as it was.
 *
 * Passkeys are scoped to the Relying Party ID configured in the Supabase
 * dashboard (`classicminidiy.com`), and the browser refuses the ceremony
 * outright if the page origin is not one of the configured RP origins. That is
 * why `isSupported` is not the only gate a caller needs — a supported browser
 * on an unlisted origin still fails, and it fails inside the browser rather
 * than at our API.
 */
export const usePasskeys = () => {
  const supabase = useSupabase();
  const { track } = useAnalytics();

  const passkeys = useState<PasskeyListItem[]>('passkeys', () => []);
  const loading = useState<boolean>('passkeys-loading', () => false);

  /**
   * Whether this browser can run a WebAuthn ceremony at all. Server-side this
   * is always false: `navigator` does not exist, and the whole passkey UI is
   * client-only. Components must therefore render the passkey affordance
   * behind an `onMounted` flag rather than during setup — branching the
   * template on this value directly is a structural hydration mismatch of the
   * same kind documented for /chat in CLAUDE.md.
   */
  const isSupported = (): boolean =>
    import.meta.client && typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function';

  /**
   * Whether the platform can offer a built-in authenticator (Touch ID, Face ID,
   * Windows Hello). Used only to word the prompt — a security key over USB
   * still works when this is false.
   */
  const hasPlatformAuthenticator = async (): Promise<boolean> => {
    if (!isSupported()) return false;
    try {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  };

  /**
   * A dismissed system prompt, a timed-out ceremony, or an aborted one. All
   * three arrive as a DOMException-derived error whose name is NotAllowedError
   * or AbortError. Treat them as "the user changed their mind": no toast, no
   * error state, no analytics failure event.
   */
  const isCancelled = (error: unknown): boolean => {
    const name = (error as { name?: string } | null)?.name;
    if (name === 'NotAllowedError' || name === 'AbortError') return true;
    const message = (error as { message?: string } | null)?.message ?? '';
    return /NotAllowedError|AbortError|cancel/i.test(message);
  };

  /** List the signed-in user's passkeys. Requires an active session. */
  const listPasskeys = async (): Promise<PasskeyListItem[]> => {
    if (!isSupported()) return [];
    loading.value = true;
    try {
      const { data, error } = await supabase.auth.passkey.list();
      if (error) throw error;
      passkeys.value = data ?? [];
      return passkeys.value;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Register a passkey for the signed-in user and refresh the local list.
   * Resolves to null when the user dismisses the prompt.
   */
  const registerPasskey = async (friendlyName?: string): Promise<PasskeyListItem | null> => {
    const { data, error } = await supabase.auth.registerPasskey();

    if (error) {
      if (isCancelled(error)) return null;
      track('passkey_register_failed', { error_message: error.message });
      throw error;
    }

    // Name it in a second call: the registration endpoint takes no name, so an
    // unnamed passkey is indistinguishable from the user's other passkeys in
    // the list. A failure here is cosmetic — the passkey itself is already
    // registered and usable, so never surface it as a registration failure.
    if (friendlyName && data?.id) {
      try {
        await supabase.auth.passkey.update({ passkeyId: data.id, friendlyName });
      } catch (nameError) {
        console.error('Passkey registered but naming it failed:', nameError);
      }
    }

    track('passkey_registered');
    await listPasskeys();
    return passkeys.value.find((key) => key.id === data?.id) ?? data ?? null;
  };

  /** Rename a passkey. `friendlyName` is capped at 120 characters server-side. */
  const renamePasskey = async (passkeyId: string, friendlyName: string): Promise<void> => {
    const { error } = await supabase.auth.passkey.update({ passkeyId, friendlyName: friendlyName.slice(0, 120) });
    if (error) throw error;
    track('passkey_renamed');
    await listPasskeys();
  };

  /**
   * Delete a passkey. The caller is responsible for confirming first — this is
   * irreversible, and deleting the last passkey can strand a user who has no
   * other way in (see `isOnlySignInMethod` note in PasskeyManager).
   */
  const deletePasskey = async (passkeyId: string): Promise<void> => {
    const { error } = await supabase.auth.passkey.delete({ passkeyId });
    if (error) throw error;
    track('passkey_deleted');
    await listPasskeys();
  };

  /**
   * Sign in with a passkey. Discoverable-credential flow: the browser shows the
   * user every passkey it holds for this Relying Party, so no email is needed
   * up front.
   *
   * Resolves to false when the user dismisses the prompt. On success the
   * session is already persisted and SIGNED_IN has been emitted by auth-js, so
   * `useAuth`'s onAuthStateChange listener has the user before this returns —
   * callers only need to handle their own redirect.
   */
  const signInWithPasskey = async (captchaToken?: string): Promise<boolean> => {
    const { data, error } = await supabase.auth.signInWithPasskey({ options: { captchaToken } });

    if (error) {
      if (isCancelled(error)) return false;
      throw error;
    }

    return !!data?.session;
  };

  return {
    passkeys,
    loading,
    isSupported,
    hasPlatformAuthenticator,
    isCancelled,
    listPasskeys,
    registerPasskey,
    renamePasskey,
    deletePasskey,
    signInWithPasskey,
  };
};
