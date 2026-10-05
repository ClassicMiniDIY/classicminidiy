<script lang="ts" setup>
  import {
    RESERVED_USERNAMES,
    USERNAME_PATTERN,
    isValidForumUsername,
    isWellFormedForumUsername,
  } from '~~/shared/utils/usernames';

  // DiscourseConnect hand-off for Classic Mini DIY Community.
  // Design: docs/plans/2026-10-03-discourse-sso.md.
  //
  // The forum sends the browser here with a signed `sso` + `sig`. The Supabase
  // session lives in localStorage, so this page (not a GET API route) reads it,
  // POSTs both values to /api/discourse/sso with `Authorization: Bearer`, and
  // follows the signed `redirect` back to the forum. The `sso` nonce is single
  // use and lasts 30 minutes, so every failure after the POST points the user
  // back to the forum for a fresh one instead of retrying here.

  type SsoState =
    | 'checking' // resolving auth / reading the profile
    | 'signin' // logged out: on the way to /login with this URL as the redirect
    | 'identity' // one-time "choose your forum name" step
    | 'connecting' // POST in flight / redirecting to the forum
    | 'unverified' // 403 email_unverified
    | 'suspended' // 403 from a suspended account
    | 'error'; // missing parameters or a failed sign-in
  type IdentityError = 'invalid' | 'reserved' | 'taken' | 'display_name' | 'generic';
  type OwnProfile = { username: string | null; display_name: string | null };

  // A minimal community frame instead of the site chrome (design doc §9a item 3).
  definePageMeta({ bareLayout: true });

  const { t } = useI18n();
  const route = useRoute();
  const runtimeConfig = useRuntimeConfig();
  const supabase = useSupabase();
  const { track } = useAnalytics();
  const { user, isAuthenticated, waitForAuth } = useAuth();

  const state = ref<SsoState>('checking');
  const missingParams = ref(false);

  const ssoParam = typeof route.query.sso === 'string' ? route.query.sso : '';
  const sigParam = typeof route.query.sig === 'string' ? route.query.sig : '';
  const loginHref = `/login?redirect=${encodeURIComponent(route.fullPath)}`;
  const forumUrl = (runtimeConfig.public.discourseUrl as string) || 'https://community.classicminidiy.com';
  const forumHost = (() => {
    try {
      return new URL(forumUrl).host;
    } catch {
      return forumUrl;
    }
  })();

  // POST once per `sso` per page load. Kept in useState so a re-mount of this
  // page sees it. Cleared on a failure, because the server issued nothing then.
  const ssoPosts = useState<Record<string, 'pending' | 'done'>>('discourse-sso-posts', () => ({}));

  // Identity step.
  const usernameInput = ref('');
  const displayNameInput = ref('');
  const identityError = ref<IdentityError | null>(null);
  const saving = ref(false);
  let ownProfile: OwnProfile | null = null;

  function fail(reason: string) {
    track('forum_sso_failed', { reason });
  }

  /** The email local part, lowercase: what `handle_new_user` writes as the default display name. */
  function emailLocalPart(): string {
    const email = user.value?.email ?? '';
    const at = email.lastIndexOf('@');
    return (at > 0 ? email.slice(0, at) : email).toLowerCase();
  }

  /** A name worth prefilling: not empty and not the email-derived default. */
  function usableName(name: string | null | undefined): string {
    const trimmed = name?.trim() ?? '';
    return trimmed && trimmed.toLowerCase() !== emailLocalPart() ? trimmed : '';
  }

  /** Clean free text into a username suggestion, or '' when nothing valid is left. */
  function suggestUsername(source: string): string {
    const cleaned = source
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+/, '')
      .replace(/-{2,}/g, '-')
      .slice(0, 30)
      .replace(/-+$/, '');
    return isValidForumUsername(cleaned) ? cleaned : '';
  }

  function showIdentity() {
    const displayName = usableName(ownProfile?.display_name);
    const existing = usableName(ownProfile?.username);
    displayNameInput.value = displayName;
    usernameInput.value = suggestUsername(existing) || suggestUsername(displayName);
    identityError.value = null;
    state.value = 'identity';
  }

  function isForumUrl(value: string): boolean {
    try {
      return new URL(value).origin === new URL(forumUrl).origin;
    } catch {
      return false;
    }
  }

  async function getAccessToken(): Promise<string | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  let stopPendingWatch: (() => void) | null = null;

  function watchPendingPost() {
    stopPendingWatch?.();
    stopPendingWatch = watch(
      () => ssoPosts.value[ssoParam],
      (status) => {
        if (status === 'pending') return;
        stopPendingWatch?.();
        stopPendingWatch = null;
        if (!status) state.value = 'error';
      }
    );
  }

  onBeforeUnmount(() => stopPendingWatch?.());

  function releasePost() {
    const remaining = { ...ssoPosts.value };
    delete remaining[ssoParam];
    ssoPosts.value = remaining;
  }

  async function submit() {
    if (ssoPosts.value[ssoParam]) {
      // Already sent from this page load: never send the same nonce twice.
      // If that POST is still pending, wait for it. A release without a
      // redirect means it failed, so this instance shows the start-again link.
      state.value = 'connecting';
      if (ssoPosts.value[ssoParam] === 'pending') watchPendingPost();
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      await navigateTo(loginHref);
      return;
    }
    ssoPosts.value = { ...ssoPosts.value, [ssoParam]: 'pending' };
    state.value = 'connecting';
    try {
      const res = await $fetch<{ redirect?: unknown }>('/api/discourse/sso', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: { sso: ssoParam, sig: sigParam },
      });
      const redirect = res?.redirect;
      if (typeof redirect !== 'string' || !isForumUrl(redirect)) {
        throw new Error('Unexpected forum sign-in response');
      }
      ssoPosts.value = { ...ssoPosts.value, [ssoParam]: 'done' };
      track('forum_sso_completed');
      await navigateTo(redirect, { external: true });
    } catch (err: any) {
      releasePost();
      const status = err?.statusCode ?? err?.status ?? err?.response?.status;
      const code = err?.data?.data?.error ?? err?.data?.error;
      if (status === 401 || (status === 403 && code === 'reauth_required')) {
        // The server rejected the token, or forum sign-in needs a session from
        // one of the site's own sign-in methods. Clear it first, or /login sees
        // a session, bounces straight back here, and we loop. Local scope only.
        fail(status === 401 ? 'session_rejected' : 'reauth_required');
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        await navigateTo(loginHref);
        return;
      }
      if (status === 403) {
        const unverified = code === 'email_unverified';
        state.value = unverified ? 'unverified' : 'suspended';
        fail(unverified ? 'email_unverified' : 'suspended');
        return;
      }
      if (status === 409 && code === 'username_required') {
        showIdentity();
        return;
      }
      console.error('[discourse/sso] forum sign-in failed:', status, code);
      state.value = 'error';
      fail(typeof code === 'string' ? code : 'exception');
    }
  }

  async function saveIdentity() {
    if (saving.value) return;
    identityError.value = null;
    const username = usernameInput.value.trim().toLowerCase();
    const displayName = displayNameInput.value.trim();
    if (!USERNAME_PATTERN.test(username) || username.includes('--')) {
      identityError.value = 'invalid';
      return;
    }
    if (RESERVED_USERNAMES.has(username)) {
      identityError.value = 'reserved';
      return;
    }
    if (!displayName) {
      identityError.value = 'display_name';
      return;
    }
    const userId = user.value?.id;
    if (!userId) {
      await navigateTo(loginHref);
      return;
    }

    saving.value = true;
    try {
      if (username !== ownProfile?.username) {
        const { data: available, error } = await supabase.rpc('is_username_available', { p_username: username });
        if (error) throw error;
        if (available !== true) {
          identityError.value = 'taken';
          return;
        }
      }
      const { data, error } = await supabase
        .from('profiles')
        .update({ username, display_name: displayName })
        .eq('id', userId)
        .select('username, display_name')
        .maybeSingle();
      if (error) {
        // 23505 unique_violation: taken between the check and the save.
        // 23514 check_violation: the database refused a reserved name.
        if (error.code === '23505') {
          identityError.value = 'taken';
          return;
        }
        if (error.code === '23514') {
          identityError.value = 'reserved';
          return;
        }
        throw error;
      }
      if (!data) throw new Error('Profile row was not updated');
      ownProfile = data;
      await submit();
    } catch (err) {
      console.error('[discourse/sso] saving the forum name failed:', err);
      identityError.value = 'generic';
    } finally {
      saving.value = false;
    }
  }

  async function start() {
    if (!ssoParam || !sigParam) {
      missingParams.value = true;
      state.value = 'error';
      fail('missing_params');
      return;
    }
    track('forum_sso_started');

    await waitForAuth();
    const userId = user.value?.id;
    if (!isAuthenticated.value || !userId) {
      state.value = 'signin';
      await navigateTo(loginHref);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('[discourse/sso] profile read failed:', error.message);
      state.value = 'error';
      fail('profile_unavailable');
      return;
    }
    ownProfile = data;
    // Only a missing or malformed name needs the step here. A reserved name goes to
    // the server, which accepts it for the account that owns it and answers 409
    // username_required (→ the step) for everyone else. Never send the owner to the
    // step: saving another name there would overwrite theirs.
    if (!isWellFormedForumUsername(data?.username)) {
      showIdentity();
      return;
    }
    await submit();
  }

  onMounted(start);

  // Single-use hand-off page: never index it.
  useHead({
    title: t('meta.title'),
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  });
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center gap-6 bg-base-200 px-4 py-10">
    <!-- The forum's own mark: twin bonnet stripes (olive, orange) beside the name. -->
    <div class="flex items-center gap-3" data-testid="community-frame">
      <span class="flex gap-1 self-stretch" aria-hidden="true">
        <span class="w-1.5 rounded-sm bg-[#859369]"></span>
        <span class="w-1.5 rounded-sm bg-[#ed7135]"></span>
      </span>
      <span class="text-xl font-semibold leading-tight tracking-tight">
        Classic Mini DIY<br />
        <span class="opacity-70">Community</span>
      </span>
    </div>
    <div class="card bg-base-100 shadow-md border border-base-300 w-full max-w-md">
      <ClientOnly>
        <div class="card-body items-center text-center">
          <span class="eyebrow mb-1">{{ t('eyebrow') }}</span>

          <!-- Resolving auth / profile -->
          <template v-if="state === 'checking'">
            <span class="loading loading-spinner loading-lg text-primary mt-4"></span>
            <p class="opacity-70 mt-3">{{ t('checking') }}</p>
          </template>

          <!-- Logged out: on the way to /login with this URL as the redirect -->
          <template v-else-if="state === 'signin'">
            <i class="fas fa-right-to-bracket text-4xl text-primary mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('signin.title') }}</h1>
            <p class="opacity-70">{{ t('signin.body') }}</p>
            <!-- ph-no-capture: the href carries the sso query. -->
            <NuxtLink :to="loginHref" class="btn btn-primary mt-4 ph-no-capture">
              <i class="fas fa-right-to-bracket"></i>
              {{ t('signin.cta') }}
            </NuxtLink>
          </template>

          <!-- One-time forum name step -->
          <template v-else-if="state === 'identity'">
            <i class="fas fa-id-badge text-4xl text-primary mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('identity.title') }}</h1>
            <p class="opacity-70">{{ t('identity.body') }}</p>
            <form class="w-full text-left mt-2" novalidate @submit.prevent="saveIdentity">
              <fieldset class="fieldset">
                <legend class="fieldset-legend">{{ t('identity.username_label') }}</legend>
                <input
                  v-model="usernameInput"
                  data-testid="forum-username"
                  type="text"
                  class="input w-full"
                  maxlength="30"
                  autocomplete="off"
                  autocapitalize="none"
                  spellcheck="false"
                  :disabled="saving"
                />
                <p class="label whitespace-normal">{{ t('identity.username_hint') }}</p>
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">{{ t('identity.display_name_label') }}</legend>
                <input
                  v-model="displayNameInput"
                  data-testid="forum-display-name"
                  type="text"
                  class="input w-full"
                  maxlength="50"
                  autocomplete="nickname"
                  :disabled="saving"
                />
                <p class="label whitespace-normal">{{ t('identity.display_name_hint') }}</p>
              </fieldset>
              <div v-if="identityError" role="alert" class="alert alert-error alert-soft mt-3">
                <i class="fas fa-circle-exclamation"></i>
                <span>{{ t(`identity.errors.${identityError}`) }}</span>
              </div>
              <button type="submit" class="btn btn-primary w-full mt-4" :disabled="saving">
                <span v-if="saving" class="loading loading-spinner loading-sm"></span>
                <i v-else class="fas fa-arrow-right"></i>
                {{ t('identity.submit') }}
              </button>
            </form>
          </template>

          <!-- POST in flight / redirecting to the forum -->
          <template v-else-if="state === 'connecting'">
            <span class="loading loading-spinner loading-lg text-primary mt-4"></span>
            <h1 class="text-2xl font-bold mt-3">{{ t('connecting.title') }}</h1>
            <p class="opacity-70">{{ t('connecting.body') }}</p>
          </template>

          <!-- Email not confirmed -->
          <template v-else-if="state === 'unverified'">
            <i class="fas fa-envelope-circle-check text-4xl text-warning mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('unverified.title') }}</h1>
            <p class="opacity-70">{{ t('unverified.body') }}</p>
            <ol class="list-decimal text-left opacity-80 mt-2 pl-6 space-y-1">
              <li>{{ t('unverified.step1') }}</li>
              <li>{{ t('unverified.step2') }}</li>
              <li>{{ t('unverified.step3') }}</li>
            </ol>
          </template>

          <!-- Suspended account -->
          <template v-else-if="state === 'suspended'">
            <i class="fas fa-user-lock text-4xl text-error mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('suspended.title') }}</h1>
            <p class="opacity-70">{{ t('suspended.body') }}</p>
          </template>

          <!-- Missing parameters or a failed sign-in -->
          <template v-else>
            <i class="fas fa-triangle-exclamation text-4xl text-error mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('error.title') }}</h1>
            <p class="opacity-70">{{ missingParams ? t('error.missing') : t('error.body') }}</p>
          </template>

          <!-- A fresh click on the forum mints a fresh nonce. -->
          <a
            v-if="state === 'error' || state === 'unverified'"
            :href="forumUrl"
            data-testid="forum-restart"
            class="btn btn-primary mt-4"
          >
            <i class="fas fa-comments"></i>
            {{ t('forum_cta') }}
          </a>

          <p v-if="state === 'error' || state === 'suspended'" class="text-sm opacity-70 mt-4">
            {{ t('contact_question') }}
            <NuxtLink to="/contact" class="link link-primary">{{ t('contact_cta') }}</NuxtLink>
          </p>
        </div>

        <template #fallback>
          <!-- SSR / pre-hydration: matches the 'checking' state. -->
          <div class="card-body items-center text-center">
            <span class="eyebrow mb-1">{{ t('eyebrow') }}</span>
            <span class="loading loading-spinner loading-lg text-primary mt-4"></span>
            <p class="opacity-70 mt-3">{{ t('checking') }}</p>
          </div>
        </template>
      </ClientOnly>
    </div>
    <a :href="forumUrl" class="link link-hover text-sm opacity-70" data-testid="community-home">
      {{ forumHost }}
    </a>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "meta": { "title": "Sign in to the forum — Classic Mini DIY" },
    "eyebrow": "Classic Mini DIY Community",
    "checking": "Checking your account…",
    "signin": {
      "title": "Sign in to continue to the forum",
      "body": "Use your Classic Mini DIY account. After you sign in, we send you back to the forum.",
      "cta": "Sign in"
    },
    "identity": {
      "title": "Choose your forum name",
      "body": "You do this one time. Your username shows on your posts and in mentions on the forum.",
      "username_label": "Username",
      "username_hint": "3 to 30 characters: lowercase letters, numbers and hyphens. Start and end with a letter or number. Do not use two hyphens in a row.",
      "display_name_label": "Display name",
      "display_name_hint": "The name other members see next to your username.",
      "submit": "Continue to the forum",
      "errors": {
        "invalid": "Use 3 to 30 lowercase letters, numbers or hyphens. Start and end with a letter or number. Do not use two hyphens in a row.",
        "reserved": "That username is reserved. Choose a different one.",
        "taken": "That username is taken. Choose a different one.",
        "display_name": "Enter a display name.",
        "generic": "We could not save your forum name. Try again."
      }
    },
    "connecting": {
      "title": "Signing you in to the forum",
      "body": "One moment. We are sending you back to Classic Mini DIY Community."
    },
    "unverified": {
      "title": "Confirm your email address first",
      "body": "The forum needs a confirmed email address.",
      "step1": "Open the confirmation email from Classic Mini DIY.",
      "step2": "Select the link in that email.",
      "step3": "Start again from the forum."
    },
    "suspended": {
      "title": "This account is suspended",
      "body": "You cannot sign in to the forum with this account."
    },
    "error": {
      "title": "We could not sign you in",
      "body": "The sign-in request from the forum expired or did not complete. Start again from the forum to get a new one.",
      "missing": "This sign-in link is incomplete. Start again from the forum."
    },
    "forum_cta": "Start again from the forum",
    "contact_question": "Need help?",
    "contact_cta": "Contact us"
  },
  "es": {
    "meta": { "title": "Inicia sesión en el foro — Classic Mini DIY" },
    "eyebrow": "Comunidad Classic Mini DIY",
    "checking": "Comprobando tu cuenta…",
    "signin": {
      "title": "Inicia sesión para continuar al foro",
      "body": "Usa tu cuenta de Classic Mini DIY. Después de iniciar sesión, te devolvemos al foro.",
      "cta": "Iniciar sesión"
    },
    "identity": {
      "title": "Elige tu nombre en el foro",
      "body": "Solo lo haces una vez. Tu nombre de usuario aparece en tus mensajes y en las menciones del foro.",
      "username_label": "Nombre de usuario",
      "username_hint": "De 3 a 30 caracteres: letras minúsculas, números y guiones. Empieza y termina con una letra o un número. No uses dos guiones seguidos.",
      "display_name_label": "Nombre visible",
      "display_name_hint": "El nombre que los demás miembros ven junto a tu nombre de usuario.",
      "submit": "Continuar al foro",
      "errors": {
        "invalid": "Usa de 3 a 30 letras minúsculas, números o guiones. Empieza y termina con una letra o un número. No uses dos guiones seguidos.",
        "reserved": "Ese nombre de usuario está reservado. Elige otro.",
        "taken": "Ese nombre de usuario ya está en uso. Elige otro.",
        "display_name": "Introduce un nombre visible.",
        "generic": "No hemos podido guardar tu nombre en el foro. Inténtalo de nuevo."
      }
    },
    "connecting": {
      "title": "Iniciando tu sesión en el foro",
      "body": "Un momento. Te estamos devolviendo a la Comunidad Classic Mini DIY."
    },
    "unverified": {
      "title": "Primero confirma tu dirección de correo",
      "body": "El foro necesita una dirección de correo confirmada.",
      "step1": "Abre el correo de confirmación de Classic Mini DIY.",
      "step2": "Selecciona el enlace de ese correo.",
      "step3": "Vuelve a empezar desde el foro."
    },
    "suspended": {
      "title": "Esta cuenta está suspendida",
      "body": "No puedes iniciar sesión en el foro con esta cuenta."
    },
    "error": {
      "title": "No hemos podido iniciar tu sesión",
      "body": "La solicitud de inicio de sesión del foro caducó o no se completó. Vuelve a empezar desde el foro para obtener una nueva.",
      "missing": "Este enlace de inicio de sesión está incompleto. Vuelve a empezar desde el foro."
    },
    "forum_cta": "Volver a empezar desde el foro",
    "contact_question": "¿Necesitas ayuda?",
    "contact_cta": "Contáctanos"
  },
  "fr": {
    "meta": { "title": "Connexion au forum — Classic Mini DIY" },
    "eyebrow": "Communauté Classic Mini DIY",
    "checking": "Vérification de votre compte…",
    "signin": {
      "title": "Connectez-vous pour accéder au forum",
      "body": "Utilisez votre compte Classic Mini DIY. Après la connexion, nous vous renvoyons vers le forum.",
      "cta": "Se connecter"
    },
    "identity": {
      "title": "Choisissez votre nom sur le forum",
      "body": "Vous le faites une seule fois. Votre nom d'utilisateur apparaît sur vos messages et dans les mentions du forum.",
      "username_label": "Nom d'utilisateur",
      "username_hint": "De 3 à 30 caractères : lettres minuscules, chiffres et tirets. Commencez et terminez par une lettre ou un chiffre. N'utilisez pas deux tirets à la suite.",
      "display_name_label": "Nom affiché",
      "display_name_hint": "Le nom que les autres membres voient à côté de votre nom d'utilisateur.",
      "submit": "Continuer vers le forum",
      "errors": {
        "invalid": "Utilisez de 3 à 30 lettres minuscules, chiffres ou tirets. Commencez et terminez par une lettre ou un chiffre. N'utilisez pas deux tirets à la suite.",
        "reserved": "Ce nom d'utilisateur est réservé. Choisissez-en un autre.",
        "taken": "Ce nom d'utilisateur est déjà pris. Choisissez-en un autre.",
        "display_name": "Saisissez un nom affiché.",
        "generic": "Nous n'avons pas pu enregistrer votre nom sur le forum. Réessayez."
      }
    },
    "connecting": {
      "title": "Connexion au forum en cours",
      "body": "Un instant. Nous vous renvoyons vers la Communauté Classic Mini DIY."
    },
    "unverified": {
      "title": "Confirmez d'abord votre adresse e-mail",
      "body": "Le forum a besoin d'une adresse e-mail confirmée.",
      "step1": "Ouvrez l'e-mail de confirmation de Classic Mini DIY.",
      "step2": "Sélectionnez le lien dans cet e-mail.",
      "step3": "Recommencez depuis le forum."
    },
    "suspended": {
      "title": "Ce compte est suspendu",
      "body": "Vous ne pouvez pas vous connecter au forum avec ce compte."
    },
    "error": {
      "title": "Nous n'avons pas pu vous connecter",
      "body": "La demande de connexion du forum a expiré ou n'a pas abouti. Recommencez depuis le forum pour en obtenir une nouvelle.",
      "missing": "Ce lien de connexion est incomplet. Recommencez depuis le forum."
    },
    "forum_cta": "Recommencer depuis le forum",
    "contact_question": "Besoin d'aide ?",
    "contact_cta": "Contactez-nous"
  },
  "de": {
    "meta": { "title": "Im Forum anmelden — Classic Mini DIY" },
    "eyebrow": "Classic Mini DIY Community",
    "checking": "Dein Konto wird geprüft…",
    "signin": {
      "title": "Melde dich an, um zum Forum weiterzugehen",
      "body": "Nutze dein Classic-Mini-DIY-Konto. Nach der Anmeldung schicken wir dich zurück ins Forum.",
      "cta": "Anmelden"
    },
    "identity": {
      "title": "Wähle deinen Forumsnamen",
      "body": "Das machst du nur einmal. Dein Benutzername erscheint bei deinen Beiträgen und in Erwähnungen im Forum.",
      "username_label": "Benutzername",
      "username_hint": "3 bis 30 Zeichen: Kleinbuchstaben, Ziffern und Bindestriche. Beginne und ende mit einem Buchstaben oder einer Ziffer. Verwende keine zwei Bindestriche hintereinander.",
      "display_name_label": "Anzeigename",
      "display_name_hint": "Der Name, den andere Mitglieder neben deinem Benutzernamen sehen.",
      "submit": "Weiter zum Forum",
      "errors": {
        "invalid": "Verwende 3 bis 30 Kleinbuchstaben, Ziffern oder Bindestriche. Beginne und ende mit einem Buchstaben oder einer Ziffer. Verwende keine zwei Bindestriche hintereinander.",
        "reserved": "Dieser Benutzername ist reserviert. Wähle einen anderen.",
        "taken": "Dieser Benutzername ist vergeben. Wähle einen anderen.",
        "display_name": "Gib einen Anzeigenamen ein.",
        "generic": "Wir konnten deinen Forumsnamen nicht speichern. Versuche es noch einmal."
      }
    },
    "connecting": {
      "title": "Du wirst im Forum angemeldet",
      "body": "Einen Moment. Wir schicken dich zurück zur Classic Mini DIY Community."
    },
    "unverified": {
      "title": "Bestätige zuerst deine E-Mail-Adresse",
      "body": "Das Forum braucht eine bestätigte E-Mail-Adresse.",
      "step1": "Öffne die Bestätigungs-E-Mail von Classic Mini DIY.",
      "step2": "Wähle den Link in dieser E-Mail.",
      "step3": "Beginne erneut im Forum."
    },
    "suspended": {
      "title": "Dieses Konto ist gesperrt",
      "body": "Mit diesem Konto kannst du dich nicht im Forum anmelden."
    },
    "error": {
      "title": "Wir konnten dich nicht anmelden",
      "body": "Die Anmeldeanfrage des Forums ist abgelaufen oder wurde nicht abgeschlossen. Beginne erneut im Forum, um eine neue zu erhalten.",
      "missing": "Dieser Anmeldelink ist unvollständig. Beginne erneut im Forum."
    },
    "forum_cta": "Im Forum neu beginnen",
    "contact_question": "Brauchst du Hilfe?",
    "contact_cta": "Kontaktiere uns"
  },
  "it": {
    "meta": { "title": "Accedi al forum — Classic Mini DIY" },
    "eyebrow": "Community Classic Mini DIY",
    "checking": "Verifica del tuo account in corso…",
    "signin": {
      "title": "Accedi per continuare al forum",
      "body": "Usa il tuo account Classic Mini DIY. Dopo l'accesso ti riportiamo al forum.",
      "cta": "Accedi"
    },
    "identity": {
      "title": "Scegli il tuo nome sul forum",
      "body": "Lo fai una sola volta. Il tuo nome utente compare nei tuoi messaggi e nelle menzioni sul forum.",
      "username_label": "Nome utente",
      "username_hint": "Da 3 a 30 caratteri: lettere minuscole, numeri e trattini. Inizia e finisci con una lettera o un numero. Non usare due trattini di seguito.",
      "display_name_label": "Nome visualizzato",
      "display_name_hint": "Il nome che gli altri membri vedono accanto al tuo nome utente.",
      "submit": "Continua al forum",
      "errors": {
        "invalid": "Usa da 3 a 30 lettere minuscole, numeri o trattini. Inizia e finisci con una lettera o un numero. Non usare due trattini di seguito.",
        "reserved": "Quel nome utente è riservato. Scegline un altro.",
        "taken": "Quel nome utente è già in uso. Scegline un altro.",
        "display_name": "Inserisci un nome visualizzato.",
        "generic": "Non siamo riusciti a salvare il tuo nome sul forum. Riprova."
      }
    },
    "connecting": {
      "title": "Accesso al forum in corso",
      "body": "Un attimo. Ti stiamo riportando alla Community Classic Mini DIY."
    },
    "unverified": {
      "title": "Prima conferma il tuo indirizzo email",
      "body": "Il forum richiede un indirizzo email confermato.",
      "step1": "Apri l'email di conferma di Classic Mini DIY.",
      "step2": "Seleziona il link in quell'email.",
      "step3": "Ricomincia dal forum."
    },
    "suspended": {
      "title": "Questo account è sospeso",
      "body": "Non puoi accedere al forum con questo account."
    },
    "error": {
      "title": "Non siamo riusciti a farti accedere",
      "body": "La richiesta di accesso del forum è scaduta o non è stata completata. Ricomincia dal forum per ottenerne una nuova.",
      "missing": "Questo link di accesso è incompleto. Ricomincia dal forum."
    },
    "forum_cta": "Ricomincia dal forum",
    "contact_question": "Serve aiuto?",
    "contact_cta": "Contattaci"
  },
  "pt": {
    "meta": { "title": "Entrar no fórum — Classic Mini DIY" },
    "eyebrow": "Comunidade Classic Mini DIY",
    "checking": "A verificar a sua conta…",
    "signin": {
      "title": "Inicie sessão para continuar para o fórum",
      "body": "Use a sua conta Classic Mini DIY. Depois de iniciar sessão, enviamo-lo de volta para o fórum.",
      "cta": "Iniciar sessão"
    },
    "identity": {
      "title": "Escolha o seu nome no fórum",
      "body": "Faz isto apenas uma vez. O seu nome de utilizador aparece nas suas publicações e nas menções do fórum.",
      "username_label": "Nome de utilizador",
      "username_hint": "De 3 a 30 caracteres: letras minúsculas, números e hífenes. Comece e termine com uma letra ou um número. Não use dois hífenes seguidos.",
      "display_name_label": "Nome apresentado",
      "display_name_hint": "O nome que os outros membros veem ao lado do seu nome de utilizador.",
      "submit": "Continuar para o fórum",
      "errors": {
        "invalid": "Use de 3 a 30 letras minúsculas, números ou hífenes. Comece e termine com uma letra ou um número. Não use dois hífenes seguidos.",
        "reserved": "Esse nome de utilizador está reservado. Escolha outro.",
        "taken": "Esse nome de utilizador já está a ser usado. Escolha outro.",
        "display_name": "Introduza um nome apresentado.",
        "generic": "Não conseguimos guardar o seu nome no fórum. Tente novamente."
      }
    },
    "connecting": {
      "title": "A iniciar a sua sessão no fórum",
      "body": "Um momento. Estamos a enviá-lo de volta para a Comunidade Classic Mini DIY."
    },
    "unverified": {
      "title": "Confirme primeiro o seu endereço de email",
      "body": "O fórum precisa de um endereço de email confirmado.",
      "step1": "Abra o email de confirmação da Classic Mini DIY.",
      "step2": "Selecione a ligação nesse email.",
      "step3": "Comece novamente a partir do fórum."
    },
    "suspended": {
      "title": "Esta conta está suspensa",
      "body": "Não pode iniciar sessão no fórum com esta conta."
    },
    "error": {
      "title": "Não conseguimos iniciar a sua sessão",
      "body": "O pedido de início de sessão do fórum expirou ou não foi concluído. Comece novamente a partir do fórum para obter um novo.",
      "missing": "Esta ligação de início de sessão está incompleta. Comece novamente a partir do fórum."
    },
    "forum_cta": "Começar novamente a partir do fórum",
    "contact_question": "Precisa de ajuda?",
    "contact_cta": "Fale connosco"
  },
  "ru": {
    "meta": { "title": "Вход на форум — Classic Mini DIY" },
    "eyebrow": "Сообщество Classic Mini DIY",
    "checking": "Проверяем ваш аккаунт…",
    "signin": {
      "title": "Войдите, чтобы перейти на форум",
      "body": "Используйте аккаунт Classic Mini DIY. После входа мы вернём вас на форум.",
      "cta": "Войти"
    },
    "identity": {
      "title": "Выберите имя на форуме",
      "body": "Это нужно сделать один раз. Имя пользователя видно в ваших сообщениях и упоминаниях на форуме.",
      "username_label": "Имя пользователя",
      "username_hint": "От 3 до 30 символов: строчные латинские буквы, цифры и дефисы. Первый и последний символ — буква или цифра. Не используйте два дефиса подряд.",
      "display_name_label": "Отображаемое имя",
      "display_name_hint": "Имя, которое другие участники видят рядом с вашим именем пользователя.",
      "submit": "Перейти на форум",
      "errors": {
        "invalid": "Используйте от 3 до 30 строчных латинских букв, цифр или дефисов. Первый и последний символ — буква или цифра. Не используйте два дефиса подряд.",
        "reserved": "Это имя пользователя зарезервировано. Выберите другое.",
        "taken": "Это имя пользователя уже занято. Выберите другое.",
        "display_name": "Введите отображаемое имя.",
        "generic": "Не удалось сохранить имя на форуме. Попробуйте ещё раз."
      }
    },
    "connecting": {
      "title": "Выполняем вход на форум",
      "body": "Одну минуту. Мы возвращаем вас в сообщество Classic Mini DIY."
    },
    "unverified": {
      "title": "Сначала подтвердите адрес электронной почты",
      "body": "Для форума нужен подтверждённый адрес электронной почты.",
      "step1": "Откройте письмо с подтверждением от Classic Mini DIY.",
      "step2": "Выберите ссылку в этом письме.",
      "step3": "Начните снова с форума."
    },
    "suspended": {
      "title": "Этот аккаунт заблокирован",
      "body": "С этим аккаунтом нельзя войти на форум."
    },
    "error": {
      "title": "Не удалось выполнить вход",
      "body": "Срок запроса на вход с форума истёк, или запрос не был завершён. Начните снова с форума, чтобы получить новый.",
      "missing": "Эта ссылка для входа неполная. Начните снова с форума."
    },
    "forum_cta": "Начать снова с форума",
    "contact_question": "Нужна помощь?",
    "contact_cta": "Свяжитесь с нами"
  },
  "ja": {
    "meta": { "title": "フォーラムにサインイン — Classic Mini DIY" },
    "eyebrow": "Classic Mini DIY コミュニティ",
    "checking": "アカウントを確認しています…",
    "signin": {
      "title": "サインインしてフォーラムに進む",
      "body": "Classic Mini DIY アカウントを使用してください。サインイン後、フォーラムに戻ります。",
      "cta": "サインイン"
    },
    "identity": {
      "title": "フォーラムでの名前を選ぶ",
      "body": "この操作は一度だけです。ユーザー名はフォーラムの投稿とメンションに表示されます。",
      "username_label": "ユーザー名",
      "username_hint": "3〜30 文字。半角小文字、数字、ハイフンを使用できます。最初と最後は文字か数字にしてください。ハイフンを 2 つ続けて使わないでください。",
      "display_name_label": "表示名",
      "display_name_hint": "ほかのメンバーにユーザー名と一緒に表示される名前です。",
      "submit": "フォーラムに進む",
      "errors": {
        "invalid": "半角小文字、数字、ハイフンで 3〜30 文字にしてください。最初と最後は文字か数字にしてください。ハイフンを 2 つ続けて使わないでください。",
        "reserved": "そのユーザー名は予約されています。別の名前を選んでください。",
        "taken": "そのユーザー名は使用されています。別の名前を選んでください。",
        "display_name": "表示名を入力してください。",
        "generic": "フォーラムでの名前を保存できませんでした。もう一度お試しください。"
      }
    },
    "connecting": {
      "title": "フォーラムにサインインしています",
      "body": "少々お待ちください。Classic Mini DIY コミュニティに戻ります。"
    },
    "unverified": {
      "title": "先にメールアドレスを確認してください",
      "body": "フォーラムには確認済みのメールアドレスが必要です。",
      "step1": "Classic Mini DIY からの確認メールを開きます。",
      "step2": "そのメールのリンクを選択します。",
      "step3": "フォーラムからもう一度始めます。"
    },
    "suspended": {
      "title": "このアカウントは停止されています",
      "body": "このアカウントではフォーラムにサインインできません。"
    },
    "error": {
      "title": "サインインできませんでした",
      "body": "フォーラムからのサインイン要求の期限が切れたか、完了しませんでした。フォーラムからもう一度始めて、新しい要求を取得してください。",
      "missing": "このサインインリンクは不完全です。フォーラムからもう一度始めてください。"
    },
    "forum_cta": "フォーラムからもう一度始める",
    "contact_question": "お困りですか?",
    "contact_cta": "お問い合わせ"
  },
  "zh": {
    "meta": { "title": "登录论坛 — Classic Mini DIY" },
    "eyebrow": "Classic Mini DIY 社区",
    "checking": "正在检查你的账号…",
    "signin": {
      "title": "登录后继续前往论坛",
      "body": "请使用你的 Classic Mini DIY 账号。登录后，我们会把你送回论坛。",
      "cta": "登录"
    },
    "identity": {
      "title": "选择你的论坛名称",
      "body": "此操作只需一次。你的用户名会显示在你的帖子和论坛提及中。",
      "username_label": "用户名",
      "username_hint": "3 到 30 个字符：小写英文字母、数字和连字符。首尾必须是字母或数字。不要连续使用两个连字符。",
      "display_name_label": "显示名称",
      "display_name_hint": "其他会员在你的用户名旁边看到的名称。",
      "submit": "继续前往论坛",
      "errors": {
        "invalid": "请使用 3 到 30 个小写英文字母、数字或连字符。首尾必须是字母或数字。不要连续使用两个连字符。",
        "reserved": "该用户名已被保留。请选择其他用户名。",
        "taken": "该用户名已被占用。请选择其他用户名。",
        "display_name": "请输入显示名称。",
        "generic": "无法保存你的论坛名称。请重试。"
      }
    },
    "connecting": {
      "title": "正在登录论坛",
      "body": "请稍候。我们正在把你送回 Classic Mini DIY 社区。"
    },
    "unverified": {
      "title": "请先确认你的电子邮箱地址",
      "body": "论坛需要已确认的电子邮箱地址。",
      "step1": "打开 Classic Mini DIY 发送的确认邮件。",
      "step2": "选择该邮件中的链接。",
      "step3": "从论坛重新开始。"
    },
    "suspended": {
      "title": "此账号已被停用",
      "body": "你无法使用此账号登录论坛。"
    },
    "error": {
      "title": "无法完成登录",
      "body": "来自论坛的登录请求已过期或未完成。请从论坛重新开始以获取新的请求。",
      "missing": "此登录链接不完整。请从论坛重新开始。"
    },
    "forum_cta": "从论坛重新开始",
    "contact_question": "需要帮助?",
    "contact_cta": "联系我们"
  },
  "ko": {
    "meta": { "title": "포럼 로그인 — Classic Mini DIY" },
    "eyebrow": "Classic Mini DIY 커뮤니티",
    "checking": "계정을 확인하는 중…",
    "signin": {
      "title": "로그인하고 포럼으로 계속하기",
      "body": "Classic Mini DIY 계정을 사용하세요. 로그인하면 포럼으로 다시 보내 드립니다.",
      "cta": "로그인"
    },
    "identity": {
      "title": "포럼 이름 선택",
      "body": "한 번만 하면 됩니다. 사용자 이름은 포럼의 게시물과 멘션에 표시됩니다.",
      "username_label": "사용자 이름",
      "username_hint": "3~30자: 영문 소문자, 숫자, 하이픈. 처음과 끝은 문자나 숫자여야 합니다. 하이픈을 두 개 연속으로 쓰지 마세요.",
      "display_name_label": "표시 이름",
      "display_name_hint": "다른 멤버가 사용자 이름 옆에서 보는 이름입니다.",
      "submit": "포럼으로 계속",
      "errors": {
        "invalid": "영문 소문자, 숫자, 하이픈으로 3~30자를 사용하세요. 처음과 끝은 문자나 숫자여야 합니다. 하이픈을 두 개 연속으로 쓰지 마세요.",
        "reserved": "예약된 사용자 이름입니다. 다른 이름을 선택하세요.",
        "taken": "이미 사용 중인 사용자 이름입니다. 다른 이름을 선택하세요.",
        "display_name": "표시 이름을 입력하세요.",
        "generic": "포럼 이름을 저장하지 못했습니다. 다시 시도하세요."
      }
    },
    "connecting": {
      "title": "포럼에 로그인하는 중",
      "body": "잠시만 기다려 주세요. Classic Mini DIY 커뮤니티로 다시 보내 드립니다."
    },
    "unverified": {
      "title": "먼저 이메일 주소를 확인하세요",
      "body": "포럼에는 확인된 이메일 주소가 필요합니다.",
      "step1": "Classic Mini DIY에서 보낸 확인 이메일을 여세요.",
      "step2": "그 이메일의 링크를 선택하세요.",
      "step3": "포럼에서 다시 시작하세요."
    },
    "suspended": {
      "title": "이 계정은 정지되었습니다",
      "body": "이 계정으로는 포럼에 로그인할 수 없습니다."
    },
    "error": {
      "title": "로그인하지 못했습니다",
      "body": "포럼의 로그인 요청이 만료되었거나 완료되지 않았습니다. 포럼에서 다시 시작해 새 요청을 받으세요.",
      "missing": "이 로그인 링크는 불완전합니다. 포럼에서 다시 시작하세요."
    },
    "forum_cta": "포럼에서 다시 시작",
    "contact_question": "도움이 필요하신가요?",
    "contact_cta": "문의하기"
  }
}
</i18n>
