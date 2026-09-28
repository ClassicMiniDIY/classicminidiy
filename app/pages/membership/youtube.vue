<script lang="ts" setup>
  import type { MembershipPlan } from '~~/shared/utils/chatTiers';

  /**
   * /membership/youtube — the YouTube member bridge (classicminidiy-supabase
   * docs/plans/2026-09-28-youtube-member-bridge.md §6, §8).
   *
   * The only YouTube signal we can read is the level role that Discord's YouTube
   * integration grants in the Classic Mini DIY server. So the member connects
   * YouTube in Discord, joins the server, and links that Discord account to this
   * site account with Supabase Auth `linkIdentity` (provider 'discord'). The
   * `youtube-bridge-sync` Edge Function (via POST /api/membership/youtube-sync)
   * then reads the role and attaches the membership.
   *
   * Redirect: `linkIdentity` comes back HERE (`?linked=1&code=…`), not to
   * /auth/callback. The callback has no redirect parameter (it uses the /login
   * localStorage stash), it records a `login_success` and can divert a user to
   * /welcome, and on a GoTrue error redirect it drops the `error_code` that tells
   * "Discord account already linked to another user" apart from other failures.
   * This page does the same explicit PKCE exchange (useSupabase has
   * detectSessionInUrl: false) and reads the error parameters itself.
   * The Supabase Auth redirect allowlist must contain this path.
   */
  const { t } = useI18n();
  const supabase = useSupabase();
  const route = useRoute();
  const router = useRouter();
  const { track } = useAnalytics();
  const { isAuthenticated, waitForAuth, user, fetchUserProfile } = useAuth();

  const SELF_PATH = '/membership/youtube';
  const loginHref = `/login?redirect=${encodeURIComponent(SELF_PATH)}`;
  const YOUTUBE_MEMBERSHIPS_URL = 'https://www.youtube.com/paid_memberships';

  type PageState = 'checking' | 'signin' | 'ready' | 'linking' | 'syncing';
  type Outcome =
    'linked' | 'no_identity' | 'not_in_server' | 'no_level_role' | 'conflict' | 'unavailable' | 'link_failed' | 'error';

  const state = ref<PageState>('checking');
  const hasDiscord = ref(false);
  const outcome = ref<Outcome | null>(null);
  const linkedPlan = ref<MembershipPlan | null>(null);

  const busy = computed(() => state.value === 'linking' || state.value === 'syncing');

  const OUTCOME_ALERT: Record<Outcome, { alert: string; icon: string }> = {
    linked: { alert: 'alert-success', icon: 'fas fa-circle-check' },
    no_identity: { alert: 'alert-warning', icon: 'fab fa-discord' },
    not_in_server: { alert: 'alert-warning', icon: 'fab fa-discord' },
    no_level_role: { alert: 'alert-warning', icon: 'fab fa-youtube' },
    conflict: { alert: 'alert-error', icon: 'fas fa-user-lock' },
    unavailable: { alert: 'alert-info', icon: 'fas fa-hourglass-half' },
    link_failed: { alert: 'alert-error', icon: 'fas fa-link-slash' },
    error: { alert: 'alert-error', icon: 'fas fa-triangle-exclamation' },
  };

  const outcomeBody = computed(() => {
    if (outcome.value === 'linked') {
      return linkedPlan.value
        ? t('result.linked.body', { level: t(`levels.${linkedPlan.value}`) })
        : t('result.linked.body_no_level');
    }
    return outcome.value ? t(`result.${outcome.value}.body`) : '';
  });

  /** Map an auth-js / GoTrue error code (or message) from linkIdentity to an outcome. */
  function outcomeForLinkError(code: string | null | undefined, message: string | null | undefined): Outcome {
    if (code === 'identity_already_exists') return 'conflict';
    if (code === 'manual_linking_disabled' || code === 'provider_disabled') return 'unavailable';
    // A disabled provider answers 400 validation_failed "Unsupported provider:
    // provider is not enabled"; the message is the only way to tell it apart.
    if (message && /not enabled|manual linking/i.test(message)) return 'unavailable';
    return 'link_failed';
  }

  async function getAccessToken(): Promise<string | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function loadHasDiscord() {
    try {
      const { data, error } = await supabase.auth.getUserIdentities();
      if (!error && data?.identities) {
        hasDiscord.value = data.identities.some((identity) => identity.provider === 'discord');
        return;
      }
    } catch (err) {
      console.error('[membership/youtube] getUserIdentities failed:', err);
    }
    // Fall back to the identities on the cached user object.
    hasDiscord.value = (user.value?.identities ?? []).some((identity) => identity.provider === 'discord');
  }

  async function linkDiscord() {
    outcome.value = null;
    state.value = 'linking';
    track('youtube_bridge_link_started', { source: 'web' });
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: 'discord',
        options: { redirectTo: `${window.location.origin}${SELF_PATH}?linked=1` },
      });
      if (error) {
        outcome.value = outcomeForLinkError((error as { code?: string }).code, error.message);
        track('youtube_bridge_link_failed', { source: 'web', reason: outcome.value });
        state.value = 'ready';
      }
      // No error: auth-js has already sent the browser to Discord.
    } catch (err: any) {
      console.error('[membership/youtube] linkIdentity threw:', err);
      outcome.value = outcomeForLinkError(err?.code, err?.message);
      track('youtube_bridge_link_failed', { source: 'web', reason: outcome.value });
      state.value = 'ready';
    }
  }

  async function checkMembership() {
    outcome.value = null;
    state.value = 'syncing';
    try {
      const token = await getAccessToken();
      if (!token) {
        state.value = 'signin';
        return;
      }
      const res = await $fetch<{
        status: Exclude<Outcome, 'conflict' | 'unavailable' | 'link_failed' | 'error'>;
        plan?: MembershipPlan | null;
      }>('/api/membership/youtube-sync', { method: 'POST', headers: { authorization: `Bearer ${token}` } });
      outcome.value = res.status;
      linkedPlan.value = res.status === 'linked' ? (res.plan ?? null) : null;
      if (res.status === 'no_identity') hasDiscord.value = false;
      if (res.status === 'linked' && user.value) {
        // Pick up the Sustaining Member badge without a reload.
        void fetchUserProfile?.(user.value.id);
      }
      track('youtube_bridge_synced', { source: 'web', result: res.status, plan: linkedPlan.value ?? undefined });
    } catch (err: any) {
      const status = err?.statusCode ?? err?.status ?? err?.response?.status;
      if (status === 401) {
        // The server rejected a token the browser still holds. Clear it so
        // /login does not bounce straight back here in a loop.
        await supabase.auth.signOut().catch(() => {});
        state.value = 'signin';
        return;
      }
      outcome.value = status === 409 ? 'conflict' : status === 503 ? 'unavailable' : 'error';
      if (outcome.value === 'error') console.error('[membership/youtube] sync failed:', err);
      track('youtube_bridge_sync_failed', { source: 'web', reason: outcome.value });
    }
    state.value = 'ready';
  }

  /** Query and hash parameters of the linkIdentity return trip. */
  function readReturnParams() {
    const query = route.query;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const pick = (key: string): string | null => {
      const value = query[key];
      if (typeof value === 'string') return value;
      return hash.get(key);
    };
    return {
      linked: pick('linked') === '1',
      code: pick('code'),
      errorCode: pick('error_code') ?? pick('error'),
      errorDescription: pick('error_description'),
    };
  }

  onMounted(async () => {
    const back = readReturnParams();
    const returning = back.linked || !!back.code || !!back.errorCode;

    if (back.code) {
      // The identity is linked on the server before GoTrue redirects here; the
      // exchange only swaps in a session that lists it. A failed exchange is
      // therefore not a failed link, and the sync below is the real check.
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(back.code);
        if (error) console.error('[membership/youtube] code exchange failed:', error.message);
      } catch (err) {
        console.error('[membership/youtube] code exchange threw:', err);
      }
    }
    // A single-use code must not survive a reload.
    if (returning) {
      router.replace({ path: SELF_PATH, query: {}, hash: '' }).catch(() => {});
    }

    await waitForAuth();
    if (!isAuthenticated.value) {
      state.value = 'signin';
      return;
    }

    await loadHasDiscord();

    if (back.errorCode) {
      outcome.value = outcomeForLinkError(back.errorCode, back.errorDescription);
      track('youtube_bridge_link_failed', { source: 'web', reason: outcome.value });
      state.value = 'ready';
      return;
    }

    if (back.linked) {
      await checkMembership();
      return;
    }

    state.value = 'ready';
  });

  useHead({
    title: t('meta.title'),
    meta: [
      { name: 'description', content: t('meta.description') },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  });
</script>

<template>
  <div class="min-h-screen bg-base-200 px-4 py-10">
    <div class="mx-auto w-full max-w-2xl">
      <div class="card bg-base-100 shadow-md border border-base-300">
        <ClientOnly>
          <div class="card-body gap-4">
            <div>
              <p class="eyebrow"><i class="fab fa-youtube mr-1"></i>{{ t('eyebrow') }}</p>
              <h1 class="text-2xl sm:text-3xl font-bold mt-1">{{ t('title') }}</h1>
              <p class="opacity-70 mt-2">{{ t('lead') }}</p>
            </div>

            <!-- Resolving auth / the return trip -->
            <div v-if="state === 'checking'" class="flex items-center gap-3 py-6" data-testid="yt-checking">
              <span class="loading loading-spinner loading-md text-primary"></span>
              <span class="opacity-70">{{ t('checking') }}</span>
            </div>

            <!-- Signed out: come back here after sign-in -->
            <div
              v-else-if="state === 'signin'"
              class="rounded-box border border-base-300 p-4 text-center"
              data-testid="yt-signin"
            >
              <i class="fas fa-right-to-bracket text-3xl text-primary"></i>
              <h2 class="text-xl font-bold mt-2">{{ t('signin.title') }}</h2>
              <p class="opacity-70 mt-1">{{ t('signin.body') }}</p>
              <NuxtLink :to="loginHref" class="btn btn-primary mt-4">
                <i class="fas fa-right-to-bracket"></i>
                {{ t('signin.cta') }}
              </NuxtLink>
            </div>

            <template v-else>
              <ol class="space-y-4" data-testid="yt-steps">
                <li class="flex gap-3">
                  <span class="badge badge-primary shrink-0 mt-0.5">1</span>
                  <p class="min-w-0">{{ t('steps.youtube') }}</p>
                </li>
                <li class="flex gap-3">
                  <span class="badge badge-primary shrink-0 mt-0.5">2</span>
                  <p class="min-w-0">{{ t('steps.server') }}</p>
                </li>
                <li class="flex gap-3">
                  <span class="badge badge-primary shrink-0 mt-0.5">3</span>
                  <p class="min-w-0">{{ hasDiscord ? t('steps.check') : t('steps.link') }}</p>
                </li>
              </ol>

              <div class="flex flex-col gap-3 sm:flex-row sm:items-center" data-testid="yt-actions">
                <button
                  v-if="!hasDiscord"
                  type="button"
                  class="btn btn-primary"
                  :disabled="busy"
                  data-testid="yt-link-discord"
                  @click="linkDiscord"
                >
                  <span v-if="state === 'linking'" class="loading loading-spinner loading-sm"></span>
                  <i v-else class="fab fa-discord"></i>
                  {{ t('cta.link') }}
                </button>
                <template v-else>
                  <button
                    type="button"
                    class="btn btn-primary"
                    :disabled="busy"
                    data-testid="yt-check"
                    @click="checkMembership"
                  >
                    <span v-if="state === 'syncing'" class="loading loading-spinner loading-sm"></span>
                    <i v-else class="fab fa-youtube"></i>
                    {{ outcome ? t('cta.check_again') : t('cta.check') }}
                  </button>
                  <p class="text-sm opacity-70" data-testid="yt-discord-linked">
                    <i class="fas fa-circle-check text-success mr-1"></i>{{ t('discord_linked') }}
                  </p>
                </template>
              </div>

              <p class="sr-only" aria-live="polite">
                {{ state === 'linking' ? t('linking') : state === 'syncing' ? t('syncing') : '' }}
              </p>

              <!-- Result of the last link or check -->
              <div
                v-if="outcome"
                :role="OUTCOME_ALERT[outcome].alert === 'alert-error' ? 'alert' : 'status'"
                class="alert items-start"
                :class="OUTCOME_ALERT[outcome].alert"
                :data-outcome="outcome"
                data-testid="yt-outcome"
              >
                <i :class="OUTCOME_ALERT[outcome].icon" class="mt-1"></i>
                <div class="min-w-0">
                  <p class="font-semibold">{{ t(`result.${outcome}.title`) }}</p>
                  <p class="text-sm break-words">{{ outcomeBody }}</p>
                  <NuxtLink
                    v-if="outcome === 'linked'"
                    to="/membership"
                    class="link font-semibold text-sm mt-1 inline-block"
                    data-testid="yt-benefits-link"
                    >{{ t('result.linked.cta') }}</NuxtLink
                  >
                  <NuxtLink
                    v-else-if="outcome === 'conflict' || outcome === 'error'"
                    to="/contact"
                    class="link font-semibold text-sm mt-1 inline-block"
                    >{{ t('contact_cta') }}</NuxtLink
                  >
                </div>
              </div>

              <p class="text-xs opacity-60">
                {{ t('manage_note') }}
                <a :href="YOUTUBE_MEMBERSHIPS_URL" target="_blank" rel="noopener" class="link">{{ t('manage_cta') }}</a>
              </p>
            </template>

            <NuxtLink to="/membership#ways-to-join" class="link link-primary text-sm">
              <i class="fas fa-arrow-left mr-1"></i>{{ t('back') }}
            </NuxtLink>
          </div>

          <template #fallback>
            <!-- SSR / pre-hydration: matches the 'checking' state. -->
            <div class="card-body gap-4">
              <div>
                <p class="eyebrow"><i class="fab fa-youtube mr-1"></i>{{ t('eyebrow') }}</p>
                <h1 class="text-2xl sm:text-3xl font-bold mt-1">{{ t('title') }}</h1>
                <p class="opacity-70 mt-2">{{ t('lead') }}</p>
              </div>
              <div class="flex items-center gap-3 py-6">
                <span class="loading loading-spinner loading-md text-primary"></span>
                <span class="opacity-70">{{ t('checking') }}</span>
              </div>
            </div>
          </template>
        </ClientOnly>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "meta": {
      "title": "Link your YouTube membership - Classic Mini DIY",
      "description": "Link your YouTube channel membership to your Classic Mini DIY account through Discord."
    },
    "eyebrow": "YOUTUBE MEMBERS",
    "title": "Link your YouTube membership",
    "lead": "Get the benefits of your YouTube level on your Classic Mini DIY account. Discord makes the connection.",
    "checking": "Checking your account...",
    "signin": {
      "title": "Sign in first",
      "body": "Sign in to the Classic Mini DIY account that gets your YouTube benefits. You come back here after sign-in.",
      "cta": "Sign in"
    },
    "steps": {
      "youtube": "In Discord, open User Settings → Connections → YouTube. Sign in with the Google account that has your membership.",
      "server": "Join the Classic Mini DIY Discord server.",
      "link": "Press Link Discord below and approve the request in Discord.",
      "check": "Press Check my YouTube membership below."
    },
    "cta": {
      "link": "Link Discord",
      "check": "Check my YouTube membership",
      "check_again": "Check again"
    },
    "discord_linked": "Your Discord account is linked.",
    "linking": "Opening Discord...",
    "syncing": "Checking your YouTube membership...",
    "levels": { "base": "Member", "plus": "Plus", "pro": "Pro" },
    "result": {
      "linked": {
        "title": "Your YouTube membership is linked",
        "body": "Level: {level}. The benefits are on your account now.",
        "body_no_level": "The benefits are on your account now.",
        "cta": "See your benefits"
      },
      "no_identity": {
        "title": "No Discord account is linked",
        "body": "Press Link Discord to link the Discord account that has your YouTube connection."
      },
      "not_in_server": {
        "title": "You are not in the Classic Mini DIY Discord server",
        "body": "Join the server with the Discord account you linked. Then check again."
      },
      "no_level_role": {
        "title": "We could not find your YouTube membership",
        "body": "Connect YouTube in Discord with the Google account that has your membership. Wait a few minutes, then check again."
      },
      "conflict": {
        "title": "That Discord account is linked to a different account",
        "body": "It belongs to another Classic Mini DIY account. Sign in with that account, or contact us."
      },
      "unavailable": {
        "title": "Not available yet",
        "body": "Linking a YouTube membership is not available yet. Try again later."
      },
      "link_failed": {
        "title": "Discord did not complete the link",
        "body": "Press Link Discord to try again."
      },
      "error": {
        "title": "Something went wrong",
        "body": "We could not check your membership. Try again in a minute."
      }
    },
    "contact_cta": "Contact us",
    "manage_note": "You pay for and cancel your membership on YouTube.",
    "manage_cta": "Manage it on YouTube",
    "back": "Back to ways to join"
  },
  "es": {
    "meta": {
      "title": "Vincula tu membresía de YouTube - Classic Mini DIY",
      "description": "Vincula tu membresía del canal de YouTube a tu cuenta de Classic Mini DIY a través de Discord."
    },
    "eyebrow": "MIEMBROS DE YOUTUBE",
    "title": "Vincula tu membresía de YouTube",
    "lead": "Obtén los beneficios de tu nivel de YouTube en tu cuenta de Classic Mini DIY. Discord hace la conexión.",
    "checking": "Comprobando tu cuenta...",
    "signin": {
      "title": "Inicia sesión primero",
      "body": "Inicia sesión en la cuenta de Classic Mini DIY que recibe tus beneficios de YouTube. Volverás aquí después de iniciar sesión.",
      "cta": "Iniciar sesión"
    },
    "steps": {
      "youtube": "En Discord, abre Ajustes de usuario → Conexiones → YouTube. Inicia sesión con la cuenta de Google que tiene tu membresía.",
      "server": "Únete al servidor de Discord de Classic Mini DIY.",
      "link": "Pulsa Vincular Discord abajo y aprueba la solicitud en Discord.",
      "check": "Pulsa Comprobar mi membresía de YouTube abajo."
    },
    "cta": {
      "link": "Vincular Discord",
      "check": "Comprobar mi membresía de YouTube",
      "check_again": "Comprobar de nuevo"
    },
    "discord_linked": "Tu cuenta de Discord está vinculada.",
    "linking": "Abriendo Discord...",
    "syncing": "Comprobando tu membresía de YouTube...",
    "levels": { "base": "Member", "plus": "Plus", "pro": "Pro" },
    "result": {
      "linked": {
        "title": "Tu membresía de YouTube está vinculada",
        "body": "Nivel: {level}. Los beneficios ya están en tu cuenta.",
        "body_no_level": "Los beneficios ya están en tu cuenta.",
        "cta": "Ver tus beneficios"
      },
      "no_identity": {
        "title": "No hay ninguna cuenta de Discord vinculada",
        "body": "Pulsa Vincular Discord para vincular la cuenta de Discord que tiene tu conexión de YouTube."
      },
      "not_in_server": {
        "title": "No estás en el servidor de Discord de Classic Mini DIY",
        "body": "Únete al servidor con la cuenta de Discord que vinculaste. Después, comprueba de nuevo."
      },
      "no_level_role": {
        "title": "No encontramos tu membresía de YouTube",
        "body": "Conecta YouTube en Discord con la cuenta de Google que tiene tu membresía. Espera unos minutos y comprueba de nuevo."
      },
      "conflict": {
        "title": "Esa cuenta de Discord está vinculada a otra cuenta",
        "body": "Pertenece a otra cuenta de Classic Mini DIY. Inicia sesión con esa cuenta o contáctanos."
      },
      "unavailable": {
        "title": "Aún no disponible",
        "body": "Todavía no se puede vincular una membresía de YouTube. Inténtalo más tarde."
      },
      "link_failed": {
        "title": "Discord no completó la vinculación",
        "body": "Pulsa Vincular Discord para intentarlo de nuevo."
      },
      "error": {
        "title": "Algo salió mal",
        "body": "No pudimos comprobar tu membresía. Inténtalo de nuevo en un minuto."
      }
    },
    "contact_cta": "Contáctanos",
    "manage_note": "Pagas y cancelas tu membresía en YouTube.",
    "manage_cta": "Gestionarla en YouTube",
    "back": "Volver a las formas de unirte"
  },
  "fr": {
    "meta": {
      "title": "Lier votre abonnement YouTube - Classic Mini DIY",
      "description": "Liez votre abonnement à la chaîne YouTube à votre compte Classic Mini DIY via Discord."
    },
    "eyebrow": "MEMBRES YOUTUBE",
    "title": "Lier votre abonnement YouTube",
    "lead": "Recevez les avantages de votre niveau YouTube sur votre compte Classic Mini DIY. Discord fait le lien.",
    "checking": "Vérification de votre compte...",
    "signin": {
      "title": "Connectez-vous d'abord",
      "body": "Connectez-vous au compte Classic Mini DIY qui reçoit vos avantages YouTube. Vous revenez ici après la connexion.",
      "cta": "Se connecter"
    },
    "steps": {
      "youtube": "Dans Discord, ouvrez Paramètres utilisateur → Connexions → YouTube. Connectez-vous avec le compte Google qui a votre abonnement.",
      "server": "Rejoignez le serveur Discord Classic Mini DIY.",
      "link": "Appuyez sur Lier Discord ci-dessous et acceptez la demande dans Discord.",
      "check": "Appuyez sur Vérifier mon abonnement YouTube ci-dessous."
    },
    "cta": {
      "link": "Lier Discord",
      "check": "Vérifier mon abonnement YouTube",
      "check_again": "Vérifier à nouveau"
    },
    "discord_linked": "Votre compte Discord est lié.",
    "linking": "Ouverture de Discord...",
    "syncing": "Vérification de votre abonnement YouTube...",
    "levels": { "base": "Member", "plus": "Plus", "pro": "Pro" },
    "result": {
      "linked": {
        "title": "Votre abonnement YouTube est lié",
        "body": "Niveau : {level}. Les avantages sont maintenant sur votre compte.",
        "body_no_level": "Les avantages sont maintenant sur votre compte.",
        "cta": "Voir vos avantages"
      },
      "no_identity": {
        "title": "Aucun compte Discord n'est lié",
        "body": "Appuyez sur Lier Discord pour lier le compte Discord qui a votre connexion YouTube."
      },
      "not_in_server": {
        "title": "Vous n'êtes pas sur le serveur Discord Classic Mini DIY",
        "body": "Rejoignez le serveur avec le compte Discord que vous avez lié. Puis vérifiez à nouveau."
      },
      "no_level_role": {
        "title": "Nous n'avons pas trouvé votre abonnement YouTube",
        "body": "Connectez YouTube dans Discord avec le compte Google qui a votre abonnement. Attendez quelques minutes, puis vérifiez à nouveau."
      },
      "conflict": {
        "title": "Ce compte Discord est lié à un autre compte",
        "body": "Il appartient à un autre compte Classic Mini DIY. Connectez-vous avec ce compte, ou contactez-nous."
      },
      "unavailable": {
        "title": "Pas encore disponible",
        "body": "Lier un abonnement YouTube n'est pas encore disponible. Réessayez plus tard."
      },
      "link_failed": {
        "title": "Discord n'a pas terminé la liaison",
        "body": "Appuyez sur Lier Discord pour réessayer."
      },
      "error": {
        "title": "Un problème est survenu",
        "body": "Nous n'avons pas pu vérifier votre abonnement. Réessayez dans une minute."
      }
    },
    "contact_cta": "Nous contacter",
    "manage_note": "Vous payez et résiliez votre abonnement sur YouTube.",
    "manage_cta": "Le gérer sur YouTube",
    "back": "Retour aux façons de rejoindre"
  },
  "de": {
    "meta": {
      "title": "YouTube-Mitgliedschaft verknüpfen - Classic Mini DIY",
      "description": "Verknüpfe deine YouTube-Kanalmitgliedschaft über Discord mit deinem Classic Mini DIY Konto."
    },
    "eyebrow": "YOUTUBE-MITGLIEDER",
    "title": "YouTube-Mitgliedschaft verknüpfen",
    "lead": "Erhalte die Vorteile deiner YouTube-Stufe in deinem Classic Mini DIY Konto. Discord stellt die Verbindung her.",
    "checking": "Dein Konto wird geprüft...",
    "signin": {
      "title": "Melde dich zuerst an",
      "body": "Melde dich bei dem Classic Mini DIY Konto an, das deine YouTube-Vorteile erhält. Nach der Anmeldung kommst du hierher zurück.",
      "cta": "Anmelden"
    },
    "steps": {
      "youtube": "Öffne in Discord Benutzereinstellungen → Verknüpfungen → YouTube. Melde dich mit dem Google-Konto an, das deine Mitgliedschaft hat.",
      "server": "Tritt dem Classic Mini DIY Discord-Server bei.",
      "link": "Tippe unten auf Discord verknüpfen und bestätige die Anfrage in Discord.",
      "check": "Tippe unten auf Meine YouTube-Mitgliedschaft prüfen."
    },
    "cta": {
      "link": "Discord verknüpfen",
      "check": "Meine YouTube-Mitgliedschaft prüfen",
      "check_again": "Erneut prüfen"
    },
    "discord_linked": "Dein Discord-Konto ist verknüpft.",
    "linking": "Discord wird geöffnet...",
    "syncing": "Deine YouTube-Mitgliedschaft wird geprüft...",
    "levels": { "base": "Member", "plus": "Plus", "pro": "Pro" },
    "result": {
      "linked": {
        "title": "Deine YouTube-Mitgliedschaft ist verknüpft",
        "body": "Stufe: {level}. Die Vorteile sind jetzt in deinem Konto.",
        "body_no_level": "Die Vorteile sind jetzt in deinem Konto.",
        "cta": "Deine Vorteile ansehen"
      },
      "no_identity": {
        "title": "Kein Discord-Konto ist verknüpft",
        "body": "Tippe auf Discord verknüpfen, um das Discord-Konto mit deiner YouTube-Verknüpfung zu verbinden."
      },
      "not_in_server": {
        "title": "Du bist nicht auf dem Classic Mini DIY Discord-Server",
        "body": "Tritt dem Server mit dem verknüpften Discord-Konto bei. Prüfe dann erneut."
      },
      "no_level_role": {
        "title": "Wir haben deine YouTube-Mitgliedschaft nicht gefunden",
        "body": "Verknüpfe YouTube in Discord mit dem Google-Konto, das deine Mitgliedschaft hat. Warte ein paar Minuten und prüfe dann erneut."
      },
      "conflict": {
        "title": "Dieses Discord-Konto ist mit einem anderen Konto verknüpft",
        "body": "Es gehört zu einem anderen Classic Mini DIY Konto. Melde dich mit diesem Konto an oder kontaktiere uns."
      },
      "unavailable": {
        "title": "Noch nicht verfügbar",
        "body": "Das Verknüpfen einer YouTube-Mitgliedschaft ist noch nicht verfügbar. Versuche es später erneut."
      },
      "link_failed": {
        "title": "Discord hat die Verknüpfung nicht abgeschlossen",
        "body": "Tippe auf Discord verknüpfen, um es erneut zu versuchen."
      },
      "error": {
        "title": "Etwas ist schiefgelaufen",
        "body": "Wir konnten deine Mitgliedschaft nicht prüfen. Versuche es in einer Minute erneut."
      }
    },
    "contact_cta": "Kontaktiere uns",
    "manage_note": "Du bezahlst und kündigst deine Mitgliedschaft auf YouTube.",
    "manage_cta": "Auf YouTube verwalten",
    "back": "Zurück zu den Wegen zur Mitgliedschaft"
  },
  "it": {
    "meta": {
      "title": "Collega il tuo abbonamento YouTube - Classic Mini DIY",
      "description": "Collega il tuo abbonamento al canale YouTube al tuo account Classic Mini DIY tramite Discord."
    },
    "eyebrow": "MEMBRI YOUTUBE",
    "title": "Collega il tuo abbonamento YouTube",
    "lead": "Ottieni i vantaggi del tuo livello YouTube sul tuo account Classic Mini DIY. Discord crea il collegamento.",
    "checking": "Verifica del tuo account...",
    "signin": {
      "title": "Accedi prima",
      "body": "Accedi all'account Classic Mini DIY che riceve i tuoi vantaggi YouTube. Dopo l'accesso torni qui.",
      "cta": "Accedi"
    },
    "steps": {
      "youtube": "In Discord, apri Impostazioni utente → Connessioni → YouTube. Accedi con l'account Google che ha il tuo abbonamento.",
      "server": "Entra nel server Discord di Classic Mini DIY.",
      "link": "Premi Collega Discord qui sotto e approva la richiesta in Discord.",
      "check": "Premi Verifica il mio abbonamento YouTube qui sotto."
    },
    "cta": {
      "link": "Collega Discord",
      "check": "Verifica il mio abbonamento YouTube",
      "check_again": "Verifica di nuovo"
    },
    "discord_linked": "Il tuo account Discord è collegato.",
    "linking": "Apertura di Discord...",
    "syncing": "Verifica del tuo abbonamento YouTube...",
    "levels": { "base": "Member", "plus": "Plus", "pro": "Pro" },
    "result": {
      "linked": {
        "title": "Il tuo abbonamento YouTube è collegato",
        "body": "Livello: {level}. I vantaggi sono ora sul tuo account.",
        "body_no_level": "I vantaggi sono ora sul tuo account.",
        "cta": "Vedi i tuoi vantaggi"
      },
      "no_identity": {
        "title": "Nessun account Discord è collegato",
        "body": "Premi Collega Discord per collegare l'account Discord che ha la tua connessione YouTube."
      },
      "not_in_server": {
        "title": "Non sei nel server Discord di Classic Mini DIY",
        "body": "Entra nel server con l'account Discord che hai collegato. Poi verifica di nuovo."
      },
      "no_level_role": {
        "title": "Non abbiamo trovato il tuo abbonamento YouTube",
        "body": "Collega YouTube in Discord con l'account Google che ha il tuo abbonamento. Attendi qualche minuto, poi verifica di nuovo."
      },
      "conflict": {
        "title": "Quell'account Discord è collegato a un altro account",
        "body": "Appartiene a un altro account Classic Mini DIY. Accedi con quell'account, oppure contattaci."
      },
      "unavailable": {
        "title": "Non ancora disponibile",
        "body": "Il collegamento di un abbonamento YouTube non è ancora disponibile. Riprova più tardi."
      },
      "link_failed": {
        "title": "Discord non ha completato il collegamento",
        "body": "Premi Collega Discord per riprovare."
      },
      "error": {
        "title": "Qualcosa è andato storto",
        "body": "Non siamo riusciti a verificare il tuo abbonamento. Riprova tra un minuto."
      }
    },
    "contact_cta": "Contattaci",
    "manage_note": "Paghi e disdici il tuo abbonamento su YouTube.",
    "manage_cta": "Gestiscilo su YouTube",
    "back": "Torna ai modi per abbonarti"
  },
  "pt": {
    "meta": {
      "title": "Ligar a sua subscrição do YouTube - Classic Mini DIY",
      "description": "Ligue a sua subscrição do canal do YouTube à sua conta Classic Mini DIY através do Discord."
    },
    "eyebrow": "MEMBROS DO YOUTUBE",
    "title": "Ligar a sua subscrição do YouTube",
    "lead": "Receba os benefícios do seu nível do YouTube na sua conta Classic Mini DIY. O Discord faz a ligação.",
    "checking": "A verificar a sua conta...",
    "signin": {
      "title": "Inicie sessão primeiro",
      "body": "Inicie sessão na conta Classic Mini DIY que recebe os seus benefícios do YouTube. Volta aqui depois de iniciar sessão.",
      "cta": "Iniciar sessão"
    },
    "steps": {
      "youtube": "No Discord, abra Definições de utilizador → Ligações → YouTube. Inicie sessão com a conta Google que tem a sua subscrição.",
      "server": "Entre no servidor do Discord da Classic Mini DIY.",
      "link": "Prima Ligar Discord abaixo e aprove o pedido no Discord.",
      "check": "Prima Verificar a minha subscrição do YouTube abaixo."
    },
    "cta": {
      "link": "Ligar Discord",
      "check": "Verificar a minha subscrição do YouTube",
      "check_again": "Verificar novamente"
    },
    "discord_linked": "A sua conta do Discord está ligada.",
    "linking": "A abrir o Discord...",
    "syncing": "A verificar a sua subscrição do YouTube...",
    "levels": { "base": "Member", "plus": "Plus", "pro": "Pro" },
    "result": {
      "linked": {
        "title": "A sua subscrição do YouTube está ligada",
        "body": "Nível: {level}. Os benefícios já estão na sua conta.",
        "body_no_level": "Os benefícios já estão na sua conta.",
        "cta": "Ver os seus benefícios"
      },
      "no_identity": {
        "title": "Não há nenhuma conta do Discord ligada",
        "body": "Prima Ligar Discord para ligar a conta do Discord que tem a sua ligação ao YouTube."
      },
      "not_in_server": {
        "title": "Não está no servidor do Discord da Classic Mini DIY",
        "body": "Entre no servidor com a conta do Discord que ligou. Depois, verifique novamente."
      },
      "no_level_role": {
        "title": "Não encontrámos a sua subscrição do YouTube",
        "body": "Ligue o YouTube no Discord com a conta Google que tem a sua subscrição. Aguarde alguns minutos e verifique novamente."
      },
      "conflict": {
        "title": "Essa conta do Discord está ligada a outra conta",
        "body": "Pertence a outra conta Classic Mini DIY. Inicie sessão com essa conta ou contacte-nos."
      },
      "unavailable": {
        "title": "Ainda não disponível",
        "body": "Ainda não é possível ligar uma subscrição do YouTube. Tente mais tarde."
      },
      "link_failed": {
        "title": "O Discord não concluiu a ligação",
        "body": "Prima Ligar Discord para tentar novamente."
      },
      "error": {
        "title": "Algo correu mal",
        "body": "Não conseguimos verificar a sua subscrição. Tente novamente dentro de um minuto."
      }
    },
    "contact_cta": "Contacte-nos",
    "manage_note": "Paga e cancela a sua subscrição no YouTube.",
    "manage_cta": "Gerir no YouTube",
    "back": "Voltar às formas de aderir"
  },
  "ru": {
    "meta": {
      "title": "Привязать спонсорство YouTube - Classic Mini DIY",
      "description": "Привяжите спонсорство канала YouTube к своему аккаунту Classic Mini DIY через Discord."
    },
    "eyebrow": "СПОНСОРЫ YOUTUBE",
    "title": "Привязать спонсорство YouTube",
    "lead": "Получите преимущества своего уровня YouTube в аккаунте Classic Mini DIY. Связь создаёт Discord.",
    "checking": "Проверяем ваш аккаунт...",
    "signin": {
      "title": "Сначала войдите",
      "body": "Войдите в аккаунт Classic Mini DIY, который получит преимущества YouTube. После входа вы вернётесь сюда.",
      "cta": "Войти"
    },
    "steps": {
      "youtube": "В Discord откройте Настройки пользователя → Интеграции → YouTube. Войдите в аккаунт Google, с которым оформлено спонсорство.",
      "server": "Вступите на сервер Discord Classic Mini DIY.",
      "link": "Нажмите Привязать Discord ниже и подтвердите запрос в Discord.",
      "check": "Нажмите Проверить моё спонсорство YouTube ниже."
    },
    "cta": {
      "link": "Привязать Discord",
      "check": "Проверить моё спонсорство YouTube",
      "check_again": "Проверить снова"
    },
    "discord_linked": "Ваш аккаунт Discord привязан.",
    "linking": "Открываем Discord...",
    "syncing": "Проверяем ваше спонсорство YouTube...",
    "levels": { "base": "Member", "plus": "Plus", "pro": "Pro" },
    "result": {
      "linked": {
        "title": "Ваше спонсорство YouTube привязано",
        "body": "Уровень: {level}. Преимущества уже в вашем аккаунте.",
        "body_no_level": "Преимущества уже в вашем аккаунте.",
        "cta": "Посмотреть преимущества"
      },
      "no_identity": {
        "title": "Аккаунт Discord не привязан",
        "body": "Нажмите Привязать Discord, чтобы привязать аккаунт Discord с интеграцией YouTube."
      },
      "not_in_server": {
        "title": "Вас нет на сервере Discord Classic Mini DIY",
        "body": "Вступите на сервер с привязанным аккаунтом Discord. Затем проверьте снова."
      },
      "no_level_role": {
        "title": "Мы не нашли ваше спонсорство YouTube",
        "body": "Подключите YouTube в Discord с аккаунтом Google, с которым оформлено спонсорство. Подождите несколько минут и проверьте снова."
      },
      "conflict": {
        "title": "Этот аккаунт Discord привязан к другому аккаунту",
        "body": "Он принадлежит другому аккаунту Classic Mini DIY. Войдите в тот аккаунт или свяжитесь с нами."
      },
      "unavailable": {
        "title": "Пока недоступно",
        "body": "Привязка спонсорства YouTube пока недоступна. Попробуйте позже."
      },
      "link_failed": {
        "title": "Discord не завершил привязку",
        "body": "Нажмите Привязать Discord, чтобы попробовать снова."
      },
      "error": {
        "title": "Что-то пошло не так",
        "body": "Не удалось проверить ваше спонсорство. Попробуйте через минуту."
      }
    },
    "contact_cta": "Свяжитесь с нами",
    "manage_note": "Оплата и отмена спонсорства выполняются на YouTube.",
    "manage_cta": "Управлять на YouTube",
    "back": "Назад к способам вступить"
  },
  "ja": {
    "meta": {
      "title": "YouTube メンバーシップを連携 - Classic Mini DIY",
      "description": "Discord を通じて YouTube チャンネルメンバーシップを Classic Mini DIY アカウントに連携します。"
    },
    "eyebrow": "YOUTUBE メンバー",
    "title": "YouTube メンバーシップを連携",
    "lead": "YouTube のレベルの特典を Classic Mini DIY アカウントで受け取れます。連携には Discord を使います。",
    "checking": "アカウントを確認中...",
    "signin": {
      "title": "まずログインしてください",
      "body": "YouTube の特典を受け取る Classic Mini DIY アカウントにログインしてください。ログイン後、このページに戻ります。",
      "cta": "ログイン"
    },
    "steps": {
      "youtube": "Discord で ユーザー設定 → 接続 → YouTube を開き、メンバーシップのある Google アカウントでログインします。",
      "server": "Classic Mini DIY の Discord サーバーに参加します。",
      "link": "下の Discord を連携 を押し、Discord でリクエストを承認します。",
      "check": "下の YouTube メンバーシップを確認 を押します。"
    },
    "cta": {
      "link": "Discord を連携",
      "check": "YouTube メンバーシップを確認",
      "check_again": "もう一度確認"
    },
    "discord_linked": "Discord アカウントは連携済みです。",
    "linking": "Discord を開いています...",
    "syncing": "YouTube メンバーシップを確認中...",
    "levels": { "base": "Member", "plus": "Plus", "pro": "Pro" },
    "result": {
      "linked": {
        "title": "YouTube メンバーシップを連携しました",
        "body": "レベル: {level}。特典はアカウントに反映されています。",
        "body_no_level": "特典はアカウントに反映されています。",
        "cta": "特典を見る"
      },
      "no_identity": {
        "title": "Discord アカウントが連携されていません",
        "body": "Discord を連携 を押して、YouTube と接続した Discord アカウントを連携してください。"
      },
      "not_in_server": {
        "title": "Classic Mini DIY の Discord サーバーに参加していません",
        "body": "連携した Discord アカウントでサーバーに参加してから、もう一度確認してください。"
      },
      "no_level_role": {
        "title": "YouTube メンバーシップが見つかりませんでした",
        "body": "メンバーシップのある Google アカウントで Discord に YouTube を接続してください。数分待ってから、もう一度確認してください。"
      },
      "conflict": {
        "title": "その Discord アカウントは別のアカウントに連携されています",
        "body": "別の Classic Mini DIY アカウントのものです。そのアカウントでログインするか、お問い合わせください。"
      },
      "unavailable": {
        "title": "まだご利用いただけません",
        "body": "YouTube メンバーシップの連携はまだご利用いただけません。後でもう一度お試しください。"
      },
      "link_failed": {
        "title": "Discord で連携が完了しませんでした",
        "body": "Discord を連携 を押して、もう一度お試しください。"
      },
      "error": {
        "title": "問題が発生しました",
        "body": "メンバーシップを確認できませんでした。1 分後にもう一度お試しください。"
      }
    },
    "contact_cta": "お問い合わせ",
    "manage_note": "メンバーシップの支払いと解約は YouTube で行います。",
    "manage_cta": "YouTube で管理",
    "back": "参加方法に戻る"
  },
  "zh": {
    "meta": {
      "title": "关联你的 YouTube 会员 - Classic Mini DIY",
      "description": "通过 Discord 将你的 YouTube 频道会员关联到 Classic Mini DIY 账号。"
    },
    "eyebrow": "YOUTUBE 会员",
    "title": "关联你的 YouTube 会员",
    "lead": "在你的 Classic Mini DIY 账号上获得 YouTube 会员等级的权益。Discord 负责建立关联。",
    "checking": "正在检查你的账号...",
    "signin": {
      "title": "请先登录",
      "body": "登录要获得 YouTube 权益的 Classic Mini DIY 账号。登录后你会回到这里。",
      "cta": "登录"
    },
    "steps": {
      "youtube": "在 Discord 中打开 用户设置 → 关联 → YouTube,用开通会员的 Google 账号登录。",
      "server": "加入 Classic Mini DIY 的 Discord 服务器。",
      "link": "点击下方的 关联 Discord,并在 Discord 中批准请求。",
      "check": "点击下方的 检查我的 YouTube 会员。"
    },
    "cta": {
      "link": "关联 Discord",
      "check": "检查我的 YouTube 会员",
      "check_again": "再次检查"
    },
    "discord_linked": "你的 Discord 账号已关联。",
    "linking": "正在打开 Discord...",
    "syncing": "正在检查你的 YouTube 会员...",
    "levels": { "base": "Member", "plus": "Plus", "pro": "Pro" },
    "result": {
      "linked": {
        "title": "你的 YouTube 会员已关联",
        "body": "等级:{level}。权益已添加到你的账号。",
        "body_no_level": "权益已添加到你的账号。",
        "cta": "查看你的权益"
      },
      "no_identity": {
        "title": "没有关联的 Discord 账号",
        "body": "点击 关联 Discord,关联已连接 YouTube 的 Discord 账号。"
      },
      "not_in_server": {
        "title": "你不在 Classic Mini DIY 的 Discord 服务器中",
        "body": "用已关联的 Discord 账号加入服务器,然后再次检查。"
      },
      "no_level_role": {
        "title": "我们没有找到你的 YouTube 会员",
        "body": "在 Discord 中用开通会员的 Google 账号连接 YouTube。等几分钟后再次检查。"
      },
      "conflict": {
        "title": "该 Discord 账号已关联到其他账号",
        "body": "它属于另一个 Classic Mini DIY 账号。请用该账号登录,或联系我们。"
      },
      "unavailable": {
        "title": "暂不可用",
        "body": "暂时还不能关联 YouTube 会员。请稍后再试。"
      },
      "link_failed": {
        "title": "Discord 未完成关联",
        "body": "点击 关联 Discord 重试。"
      },
      "error": {
        "title": "出现问题",
        "body": "我们无法检查你的会员。请一分钟后再试。"
      }
    },
    "contact_cta": "联系我们",
    "manage_note": "会员的付款和取消都在 YouTube 上进行。",
    "manage_cta": "在 YouTube 上管理",
    "back": "返回加入方式"
  },
  "ko": {
    "meta": {
      "title": "YouTube 멤버십 연결 - Classic Mini DIY",
      "description": "Discord를 통해 YouTube 채널 멤버십을 Classic Mini DIY 계정에 연결합니다."
    },
    "eyebrow": "YOUTUBE 멤버",
    "title": "YouTube 멤버십 연결",
    "lead": "YouTube 등급의 혜택을 Classic Mini DIY 계정에서 받으세요. 연결은 Discord가 담당합니다.",
    "checking": "계정을 확인하는 중...",
    "signin": {
      "title": "먼저 로그인해 주세요",
      "body": "YouTube 혜택을 받을 Classic Mini DIY 계정에 로그인해 주세요. 로그인 후 이 페이지로 돌아옵니다.",
      "cta": "로그인"
    },
    "steps": {
      "youtube": "Discord에서 사용자 설정 → 연결 → YouTube를 열고, 멤버십이 있는 Google 계정으로 로그인하세요.",
      "server": "Classic Mini DIY Discord 서버에 참가하세요.",
      "link": "아래의 Discord 연결을 누르고 Discord에서 요청을 승인하세요.",
      "check": "아래의 내 YouTube 멤버십 확인을 누르세요."
    },
    "cta": {
      "link": "Discord 연결",
      "check": "내 YouTube 멤버십 확인",
      "check_again": "다시 확인"
    },
    "discord_linked": "Discord 계정이 연결되어 있습니다.",
    "linking": "Discord를 여는 중...",
    "syncing": "YouTube 멤버십을 확인하는 중...",
    "levels": { "base": "Member", "plus": "Plus", "pro": "Pro" },
    "result": {
      "linked": {
        "title": "YouTube 멤버십이 연결되었습니다",
        "body": "등급: {level}. 혜택이 계정에 적용되었습니다.",
        "body_no_level": "혜택이 계정에 적용되었습니다.",
        "cta": "혜택 보기"
      },
      "no_identity": {
        "title": "연결된 Discord 계정이 없습니다",
        "body": "Discord 연결을 눌러 YouTube가 연결된 Discord 계정을 연결하세요."
      },
      "not_in_server": {
        "title": "Classic Mini DIY Discord 서버에 참가하지 않았습니다",
        "body": "연결한 Discord 계정으로 서버에 참가한 뒤 다시 확인하세요."
      },
      "no_level_role": {
        "title": "YouTube 멤버십을 찾지 못했습니다",
        "body": "멤버십이 있는 Google 계정으로 Discord에 YouTube를 연결하세요. 몇 분 기다린 뒤 다시 확인하세요."
      },
      "conflict": {
        "title": "해당 Discord 계정은 다른 계정에 연결되어 있습니다",
        "body": "다른 Classic Mini DIY 계정의 것입니다. 그 계정으로 로그인하시거나 문의해 주세요."
      },
      "unavailable": {
        "title": "아직 이용할 수 없습니다",
        "body": "YouTube 멤버십 연결은 아직 이용할 수 없습니다. 나중에 다시 시도해 주세요."
      },
      "link_failed": {
        "title": "Discord에서 연결이 완료되지 않았습니다",
        "body": "Discord 연결을 눌러 다시 시도하세요."
      },
      "error": {
        "title": "문제가 발생했습니다",
        "body": "멤버십을 확인하지 못했습니다. 1분 후에 다시 시도해 주세요."
      }
    },
    "contact_cta": "문의하기",
    "manage_note": "멤버십 결제와 해지는 YouTube에서 합니다.",
    "manage_cta": "YouTube에서 관리",
    "back": "가입 방법으로 돌아가기"
  }
}
</i18n>
