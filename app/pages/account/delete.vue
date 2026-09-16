<script lang="ts" setup>
  const { t, tm, rt } = useI18n();
  const route = useRoute();
  const config = useRuntimeConfig();
  const supabase = useSupabase();
  const { track, resetIdentity } = useAnalytics();
  const { user, isAuthenticated, waitForAuth, signOut } = useAuth();

  // Public, indexable, reachable logged out: this URL is the one on the Google
  // Play Data Safety form, and Play reviewers open it without an account. The
  // explanation renders on the server for everyone; only the action card is
  // client-side, gated on the resolved session.
  //
  // The deletion itself is POST /api/account/delete → `delete-account` Edge
  // Function → `delete_my_account()` + auth.admin.deleteUser. Contract and the
  // per-table disposition live in the private repo
  // (classicminidiy-supabase/docs/plans/2026-09-16-account-deletion.md).

  const CONFIRM_WORD = 'DELETE';
  const SUPPORT_EMAIL = 'bugs@classicminidiy.com';

  type ActionState =
    | 'checking' // resolving auth
    | 'signin' // logged out
    | 'ready' // signed in, waiting for the typed confirmation
    | 'deleting' // request in flight
    | 'done' // deleted (also reached via ?done=1 after the local sign-out)
    | 'error'; // proxy/network failure — retryable
  const state = ref<ActionState>('checking');
  const confirmText = ref('');
  const errorMessage = ref<string | null>(null);

  const canDelete = computed(() => confirmText.value.trim() === CONFIRM_WORD);
  const loginHref = `/login?redirect=${encodeURIComponent('/account/delete')}`;

  // Manage-subscription targets. Stripe members go to the Customer Portal
  // (NUXT_PUBLIC_STRIPE_PORTAL_URL, same as /membership); store members go to
  // the store's own subscription list.
  const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';
  const GOOGLE_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions';
  const stripePortalHref = computed(() => {
    const base = (config.public.stripePortalUrl as string) || '';
    if (!base) return '';
    const email = user.value?.email;
    return email ? `${base}?prefilled_email=${encodeURIComponent(email)}` : base;
  });

  // Which channel (if any) bills the signed-in user, via get_my_membership().
  // Drives the "cancel this first" call-out. null = not a member, unknown, or
  // a channel with nothing to cancel (comp).
  const activePlatform = ref<'apple' | 'google' | 'stripe' | null>(null);
  async function loadMembership() {
    try {
      const { data, error } = await supabase.rpc('get_my_membership').single();
      if (error || !data?.is_member) return;
      const platform = data.platform;
      if (platform === 'apple' || platform === 'google' || platform === 'stripe') {
        activePlatform.value = platform;
      }
    } catch (err) {
      console.error('Error loading membership for account deletion:', err);
    }
  }

  const platformLabel = computed(() => (activePlatform.value ? t(`platform.${activePlatform.value}`) : ''));
  const platformHref = computed(() => {
    switch (activePlatform.value) {
      case 'apple':
        return APPLE_SUBSCRIPTIONS_URL;
      case 'google':
        return GOOGLE_SUBSCRIPTIONS_URL;
      case 'stripe':
        return stripePortalHref.value;
      default:
        return '';
    }
  });

  async function getAccessToken(): Promise<string | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function deleteAccount() {
    if (!canDelete.value || state.value === 'deleting') return;
    state.value = 'deleting';
    errorMessage.value = null;
    track('account_deletion_started');
    try {
      const token = await getAccessToken();
      if (!token) {
        await navigateTo(loginHref);
        return;
      }
      await $fetch<{ deleted: boolean }>('/api/account/delete', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
      track('account_deletion_completed');
      // The server has already removed the auth user; clear the local session
      // and analytics identity, then land on the confirmation state. The
      // query flag survives the sign-out re-render.
      resetIdentity();
      await signOut().catch(() => supabase.auth.signOut());
      await navigateTo('/account/delete?done=1', { replace: true });
      state.value = 'done';
    } catch (err: any) {
      const status = err?.statusCode ?? err?.status ?? err?.response?.status;
      // 502 = GoTrue unreachable (AUTH_UNAVAILABLE): keep the session, show
      // the retryable error. Only a rejected token (401/404) signs out.
      if (status === 401 || status === 404) {
        // The local session looked valid but the server rejected the token.
        // Clear it first so /login does not bounce straight back here.
        await supabase.auth.signOut().catch(() => {});
        await navigateTo(loginHref);
        return;
      }
      console.error('Account deletion failed:', err);
      errorMessage.value = err?.statusMessage || err?.data?.statusMessage || null;
      state.value = 'error';
    }
  }

  onMounted(async () => {
    if (route.query.done === '1') {
      state.value = 'done';
      return;
    }
    await waitForAuth();
    if (!isAuthenticated.value) {
      state.value = 'signin';
      return;
    }
    state.value = 'ready';
    await loadMembership();
  });

  useHead({
    title: t('meta.title'),
    meta: [{ name: 'description', content: t('meta.description') }],
    link: [{ rel: 'canonical', href: 'https://classicminidiy.com/account/delete' }],
  });
  useSeoMeta({
    ogTitle: t('meta.title'),
    ogDescription: t('meta.description'),
    ogUrl: 'https://classicminidiy.com/account/delete',
    ogType: 'website',
  });
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="bg-base-100 border-b border-base-300 py-12">
      <div class="container">
        <div class="max-w-3xl">
          <div class="flex items-center gap-3 mb-4">
            <i class="fas fa-user-xmark text-3xl text-error"></i>
            <h1 class="text-4xl font-bold">{{ t('hero.title') }}</h1>
          </div>
          <p class="text-lg text-base-content/70">{{ t('hero.subtitle') }}</p>
        </div>
      </div>
    </section>

    <section class="py-12">
      <div class="container">
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-10">
          <!-- Explanation: server-rendered for everyone, including logged-out reviewers -->
          <div class="lg:col-span-3 max-w-3xl space-y-10">
            <!-- What is deleted -->
            <div>
              <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
                <i class="fas fa-trash-can text-error"></i>
                {{ t('deleted.title') }}
              </h2>
              <p class="text-base-content/80 mb-3">{{ t('deleted.intro') }}</p>
              <ul class="space-y-2">
                <li v-for="(item, i) in tm('deleted.items')" :key="i" class="flex gap-3 items-start">
                  <i class="fas fa-xmark text-error shrink-0 mt-1"></i>
                  <span class="text-base-content/80">{{ rt(item) }}</span>
                </li>
              </ul>
            </div>

            <!-- What is kept -->
            <div>
              <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
                <i class="fas fa-box-archive text-primary"></i>
                {{ t('kept.title') }}
              </h2>
              <p class="text-base-content/80 mb-3">{{ t('kept.intro') }}</p>
              <ul class="space-y-2">
                <li v-for="(item, i) in tm('kept.items')" :key="i" class="flex gap-3 items-start">
                  <i class="fas fa-lock text-primary shrink-0 mt-1"></i>
                  <span class="text-base-content/80">{{ rt(item) }}</span>
                </li>
              </ul>
              <p class="text-sm text-base-content/60 mt-3">{{ t('kept.note') }}</p>
            </div>

            <!-- Membership first -->
            <div>
              <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
                <i class="fas fa-credit-card text-warning"></i>
                {{ t('membership.title') }}
              </h2>
              <p class="text-base-content/80 mb-4">{{ t('membership.body') }}</p>
              <div class="flex flex-wrap gap-2">
                <a
                  :href="APPLE_SUBSCRIPTIONS_URL"
                  target="_blank"
                  rel="noopener"
                  class="btn btn-outline btn-sm"
                  @click="
                    track('outbound_link_clicked', { destination: APPLE_SUBSCRIPTIONS_URL, group: 'account_delete' })
                  "
                >
                  <i class="fab fa-apple"></i>
                  {{ t('membership.apple') }}
                </a>
                <a
                  :href="GOOGLE_SUBSCRIPTIONS_URL"
                  target="_blank"
                  rel="noopener"
                  class="btn btn-outline btn-sm"
                  @click="
                    track('outbound_link_clicked', { destination: GOOGLE_SUBSCRIPTIONS_URL, group: 'account_delete' })
                  "
                >
                  <i class="fab fa-google-play"></i>
                  {{ t('membership.google') }}
                </a>
                <NuxtLink to="/membership" class="btn btn-outline btn-sm">
                  <i class="fab fa-stripe-s"></i>
                  {{ t('membership.stripe') }}
                </NuxtLink>
              </div>
            </div>

            <!-- Timing -->
            <div>
              <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
                <i class="fas fa-clock text-primary"></i>
                {{ t('timing.title') }}
              </h2>
              <p class="text-base-content/80">{{ t('timing.body') }}</p>
            </div>

            <!-- Help -->
            <div>
              <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
                <i class="fas fa-envelope text-primary"></i>
                {{ t('help.title') }}
              </h2>
              <p class="text-base-content/80">
                {{ t('help.body') }}
                <a :href="`mailto:${SUPPORT_EMAIL}`" class="link link-primary">{{ SUPPORT_EMAIL }}</a>
              </p>
              <p class="text-sm text-base-content/60 mt-2">
                {{ t('help.privacy') }}
                <NuxtLink to="/privacy" class="link link-primary">{{ t('help.privacy_link') }}</NuxtLink>
              </p>
            </div>
          </div>

          <!-- Action card (client-only: depends on the localStorage session) -->
          <div class="lg:col-span-2">
            <div class="card bg-base-100 shadow-md border border-base-300 lg:sticky lg:top-24">
              <ClientOnly>
                <div class="card-body">
                  <h2 class="card-title">{{ t('action.title') }}</h2>

                  <!-- Resolving auth -->
                  <template v-if="state === 'checking'">
                    <div class="flex items-center gap-3 py-4">
                      <span class="loading loading-spinner text-primary"></span>
                      <span class="opacity-70">{{ t('action.checking') }}</span>
                    </div>
                  </template>

                  <!-- Deleted -->
                  <template v-else-if="state === 'done'">
                    <div class="text-center py-4">
                      <i class="fas fa-circle-check text-4xl text-success"></i>
                      <h3 class="text-xl font-bold mt-3">{{ t('done.title') }}</h3>
                      <p class="opacity-70 mt-2">{{ t('done.body') }}</p>
                      <NuxtLink to="/" class="btn btn-primary mt-4">
                        <i class="fas fa-house"></i>
                        {{ t('done.home') }}
                      </NuxtLink>
                    </div>
                  </template>

                  <!-- Logged out -->
                  <template v-else-if="state === 'signin'">
                    <p class="opacity-70">{{ t('action.signin_body') }}</p>
                    <div class="card-actions mt-4">
                      <NuxtLink :to="loginHref" class="btn btn-primary w-full">
                        <i class="fas fa-right-to-bracket"></i>
                        {{ t('action.signin_cta') }}
                      </NuxtLink>
                    </div>
                  </template>

                  <!-- Signed in -->
                  <template v-else>
                    <div v-if="activePlatform" role="alert" class="alert alert-warning text-sm">
                      <i class="fas fa-triangle-exclamation"></i>
                      <span>
                        {{ t('membership.active_warning', { platform: platformLabel }) }}
                        <a
                          v-if="platformHref"
                          :href="platformHref"
                          target="_blank"
                          rel="noopener"
                          class="link font-semibold"
                        >
                          {{ t('membership.active_cta', { platform: platformLabel }) }}
                        </a>
                      </span>
                    </div>

                    <p v-if="user?.email" class="text-sm opacity-70">
                      {{ t('action.signed_in_as') }} <span class="font-semibold">{{ user.email }}</span>
                    </p>

                    <label class="form-control w-full mt-2">
                      <div class="label">
                        <span class="label-text">{{ t('action.confirm_label', { word: CONFIRM_WORD }) }}</span>
                      </div>
                      <input
                        v-model="confirmText"
                        type="text"
                        autocomplete="off"
                        autocapitalize="characters"
                        spellcheck="false"
                        :placeholder="CONFIRM_WORD"
                        class="input input-bordered w-full font-mono"
                        :disabled="state === 'deleting'"
                        @keyup.enter="deleteAccount"
                      />
                    </label>

                    <div v-if="state === 'error'" role="alert" class="alert alert-error text-sm mt-3">
                      <i class="fas fa-circle-exclamation"></i>
                      <span>{{ errorMessage || t('action.error', { email: SUPPORT_EMAIL }) }}</span>
                    </div>

                    <div class="card-actions mt-4">
                      <button
                        type="button"
                        class="btn btn-error w-full"
                        :disabled="!canDelete || state === 'deleting'"
                        @click="deleteAccount"
                      >
                        <span v-if="state === 'deleting'" class="loading loading-spinner loading-sm"></span>
                        <i v-else class="fas fa-user-xmark"></i>
                        {{ state === 'deleting' ? t('action.deleting') : t('action.button') }}
                      </button>
                    </div>
                    <p class="text-xs opacity-60 mt-2">{{ t('action.irreversible') }}</p>
                  </template>
                </div>

                <template #fallback>
                  <div class="card-body">
                    <h2 class="card-title">{{ t('action.title') }}</h2>
                    <div class="flex items-center gap-3 py-4">
                      <span class="loading loading-spinner text-primary"></span>
                      <span class="opacity-70">{{ t('action.checking') }}</span>
                    </div>
                  </div>
                </template>
              </ClientOnly>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "meta": {
      "title": "Delete Your Account | Classic Mini DIY",
      "description": "Delete your Classic Mini DIY account from the website or the Toolbox apps. See what is removed, what is kept for accounting, and how long it takes."
    },
    "hero": {
      "title": "Delete your account",
      "subtitle": "One account covers classicminidiy.com, The Mini Exchange and the Classic Mini DIY Toolbox apps. Deleting it removes your data from all of them."
    },
    "deleted": {
      "title": "What is deleted",
      "intro": "When you confirm, we remove:",
      "items": [
        "Your profile, sign-in methods and passkeys",
        "Marketplace messages, watchlist, saved searches, and listings that were neither sold nor paid for",
        "Garage vehicles, maintenance records and saved calculator setups from the Toolbox apps",
        "AI chat history and Developer API keys",
        "Your Discord link and members-only role",
        "Notification settings and push subscriptions"
      ]
    },
    "kept": {
      "title": "What we keep, and why",
      "intro": "Some records must stay for legal and accounting reasons. The link to your account is removed from all of them.",
      "items": [
        "Sold listings and listings you paid to upgrade (closed, with your name and location details removed), plus every payment record (listing upgrades, memberships, 3D model purchases), kept for up to 7 years for accounting and dispute handling",
        "Archive contributions that were approved and published (registry entries, colours, wheels, documents), which stay published without your name",
        "3D models that other people have paid for, so buyers keep what they bought"
      ],
      "note": "Usage analytics are handled separately. See the help section below."
    },
    "membership": {
      "title": "Cancel your membership first",
      "body": "Deleting your account does not cancel a Sustaining Membership. Billing is handled by the store you paid through, and we cannot stop it for you. Cancel it first, then come back and delete the account.",
      "apple": "App Store subscriptions",
      "google": "Google Play subscriptions",
      "stripe": "Web membership (Stripe)",
      "active_warning": "This account has an active membership billed through {platform}. Cancel it before you delete the account, or you will keep being charged.",
      "active_cta": "Manage in {platform}"
    },
    "platform": {
      "apple": "the App Store",
      "google": "Google Play",
      "stripe": "Stripe"
    },
    "timing": {
      "title": "How long it takes",
      "body": "Deletion is immediate. Your data is removed the moment you confirm, and it cannot be recovered. You will receive one confirmation email at the address on the account."
    },
    "help": {
      "title": "Cannot sign in, or want analytics removed too?",
      "body": "If you cannot sign in to confirm the deletion, or you want the usage analytics tied to your account removed, email",
      "privacy": "For the full picture of what we store, read the",
      "privacy_link": "Privacy Policy"
    },
    "action": {
      "title": "Delete this account",
      "checking": "Checking your sign-in…",
      "signin_body": "Sign in with the account you want to delete. Use the same sign-in method you use in the app.",
      "signin_cta": "Sign in to delete your account",
      "signed_in_as": "Signed in as",
      "confirm_label": "Type {word} to confirm",
      "button": "Delete my account permanently",
      "deleting": "Deleting…",
      "error": "Something went wrong and nothing was deleted. Try again, or email {email}.",
      "irreversible": "This cannot be undone."
    },
    "done": {
      "title": "Your account has been deleted",
      "body": "You are signed out everywhere. Thanks for being part of Classic Mini DIY.",
      "home": "Back to the homepage"
    }
  },
  "es": {
    "meta": {
      "title": "Eliminar tu cuenta | Classic Mini DIY",
      "description": "Elimina tu cuenta de Classic Mini DIY desde el sitio web o las apps Toolbox. Consulta qué se elimina, qué se conserva por contabilidad y cuánto tarda."
    },
    "hero": {
      "title": "Eliminar tu cuenta",
      "subtitle": "Una sola cuenta cubre classicminidiy.com, The Mini Exchange y las apps Classic Mini DIY Toolbox. Eliminarla borra tus datos de todas ellas."
    },
    "deleted": {
      "title": "Qué se elimina",
      "intro": "Cuando confirmes, eliminaremos:",
      "items": [
        "Tu perfil, métodos de inicio de sesión y passkeys",
        "Mensajes del mercado, lista de seguimiento, búsquedas guardadas y los anuncios que no se vendieron ni se pagaron",
        "Vehículos del garaje, registros de mantenimiento y configuraciones guardadas de las calculadoras de las apps Toolbox",
        "Historial del chat de IA y claves de la API para desarrolladores",
        "Tu vínculo con Discord y el rol exclusivo para miembros",
        "Ajustes de notificaciones y suscripciones push"
      ]
    },
    "kept": {
      "title": "Qué conservamos y por qué",
      "intro": "Algunos registros deben conservarse por motivos legales y contables. El vínculo con tu cuenta se elimina de todos ellos.",
      "items": [
        "Anuncios vendidos y anuncios que pagaste por mejorar (cerrados, sin tu nombre ni datos de ubicación), más cada registro de pago (mejoras de anuncios, membresías, compras de modelos 3D), conservados hasta 7 años para contabilidad y gestión de disputas",
        "Contribuciones al archivo aprobadas y publicadas (entradas del registro, colores, llantas, documentos), que siguen publicadas sin tu nombre",
        "Modelos 3D que otras personas han pagado, para que los compradores conserven lo que compraron"
      ],
      "note": "Las analíticas de uso se gestionan por separado. Consulta la sección de ayuda más abajo."
    },
    "membership": {
      "title": "Cancela primero tu membresía",
      "body": "Eliminar tu cuenta no cancela una Membresía de Apoyo. La facturación la gestiona la tienda a través de la que pagaste y no podemos detenerla por ti. Cancélala primero y luego vuelve para eliminar la cuenta.",
      "apple": "Suscripciones de App Store",
      "google": "Suscripciones de Google Play",
      "stripe": "Membresía web (Stripe)",
      "active_warning": "Esta cuenta tiene una membresía activa facturada a través de {platform}. Cancélala antes de eliminar la cuenta o seguirás pagando.",
      "active_cta": "Gestionar en {platform}"
    },
    "platform": {
      "apple": "App Store",
      "google": "Google Play",
      "stripe": "Stripe"
    },
    "timing": {
      "title": "Cuánto tarda",
      "body": "La eliminación es inmediata. Tus datos se borran en el momento en que confirmas y no se pueden recuperar. Recibirás un correo de confirmación en la dirección de la cuenta."
    },
    "help": {
      "title": "¿No puedes iniciar sesión o quieres eliminar también las analíticas?",
      "body": "Si no puedes iniciar sesión para confirmar la eliminación, o quieres que se eliminen las analíticas de uso vinculadas a tu cuenta, escribe a",
      "privacy": "Para ver todo lo que almacenamos, lee la",
      "privacy_link": "Política de privacidad"
    },
    "action": {
      "title": "Eliminar esta cuenta",
      "checking": "Comprobando tu sesión…",
      "signin_body": "Inicia sesión con la cuenta que quieres eliminar. Usa el mismo método de inicio de sesión que usas en la app.",
      "signin_cta": "Inicia sesión para eliminar tu cuenta",
      "signed_in_as": "Sesión iniciada como",
      "confirm_label": "Escribe {word} para confirmar",
      "button": "Eliminar mi cuenta de forma permanente",
      "deleting": "Eliminando…",
      "error": "Algo salió mal y no se eliminó nada. Inténtalo de nuevo o escribe a {email}.",
      "irreversible": "Esto no se puede deshacer."
    },
    "done": {
      "title": "Tu cuenta ha sido eliminada",
      "body": "Has cerrado sesión en todas partes. Gracias por formar parte de Classic Mini DIY.",
      "home": "Volver a la página de inicio"
    }
  },
  "fr": {
    "meta": {
      "title": "Supprimer votre compte | Classic Mini DIY",
      "description": "Supprimez votre compte Classic Mini DIY depuis le site web ou les applications Toolbox. Découvrez ce qui est supprimé, ce qui est conservé pour la comptabilité et le délai."
    },
    "hero": {
      "title": "Supprimer votre compte",
      "subtitle": "Un seul compte couvre classicminidiy.com, The Mini Exchange et les applications Classic Mini DIY Toolbox. Le supprimer efface vos données de tous ces services."
    },
    "deleted": {
      "title": "Ce qui est supprimé",
      "intro": "Lorsque vous confirmez, nous supprimons :",
      "items": [
        "Votre profil, vos méthodes de connexion et vos passkeys",
        "Les messages de la place de marché, la liste de suivi, les recherches enregistrées et les annonces ni vendues ni payées",
        "Les véhicules du garage, les carnets d'entretien et les réglages de calculateurs enregistrés dans les applications Toolbox",
        "L'historique du chat IA et les clés de l'API développeur",
        "Votre lien Discord et le rôle réservé aux membres",
        "Les réglages de notification et les abonnements push"
      ]
    },
    "kept": {
      "title": "Ce que nous conservons, et pourquoi",
      "intro": "Certains enregistrements doivent être conservés pour des raisons légales et comptables. Le lien avec votre compte est retiré de chacun d'eux.",
      "items": [
        "Les annonces vendues et celles dont vous avez payé l'option (clôturées, sans votre nom ni vos données de localisation), plus chaque enregistrement de paiement (options d'annonce, adhésions, achats de modèles 3D), conservés jusqu'à 7 ans pour la comptabilité et le traitement des litiges",
        "Les contributions aux archives approuvées et publiées (entrées du registre, couleurs, jantes, documents), qui restent publiées sans votre nom",
        "Les modèles 3D que d'autres personnes ont achetés, afin que les acheteurs conservent leur achat"
      ],
      "note": "Les données d'analyse d'utilisation sont traitées séparément. Voir la section d'aide ci-dessous."
    },
    "membership": {
      "title": "Résiliez d'abord votre adhésion",
      "body": "Supprimer votre compte ne résilie pas une adhésion Sustaining Member. La facturation est gérée par la boutique via laquelle vous avez payé et nous ne pouvons pas l'arrêter à votre place. Résiliez-la d'abord, puis revenez supprimer le compte.",
      "apple": "Abonnements App Store",
      "google": "Abonnements Google Play",
      "stripe": "Adhésion web (Stripe)",
      "active_warning": "Ce compte a une adhésion active facturée via {platform}. Résiliez-la avant de supprimer le compte, sinon vous continuerez à être facturé.",
      "active_cta": "Gérer dans {platform}"
    },
    "platform": {
      "apple": "l'App Store",
      "google": "Google Play",
      "stripe": "Stripe"
    },
    "timing": {
      "title": "Délai",
      "body": "La suppression est immédiate. Vos données sont effacées dès que vous confirmez et ne peuvent pas être récupérées. Vous recevrez un e-mail de confirmation à l'adresse du compte."
    },
    "help": {
      "title": "Impossible de vous connecter, ou vous souhaitez aussi supprimer les données d'analyse ?",
      "body": "Si vous ne pouvez pas vous connecter pour confirmer la suppression, ou si vous souhaitez que les données d'analyse liées à votre compte soient supprimées, écrivez à",
      "privacy": "Pour une vue complète de ce que nous stockons, lisez la",
      "privacy_link": "Politique de confidentialité"
    },
    "action": {
      "title": "Supprimer ce compte",
      "checking": "Vérification de votre connexion…",
      "signin_body": "Connectez-vous avec le compte que vous souhaitez supprimer. Utilisez la même méthode de connexion que dans l'application.",
      "signin_cta": "Se connecter pour supprimer votre compte",
      "signed_in_as": "Connecté en tant que",
      "confirm_label": "Tapez {word} pour confirmer",
      "button": "Supprimer définitivement mon compte",
      "deleting": "Suppression…",
      "error": "Une erreur s'est produite et rien n'a été supprimé. Réessayez ou écrivez à {email}.",
      "irreversible": "Cette action est irréversible."
    },
    "done": {
      "title": "Votre compte a été supprimé",
      "body": "Vous êtes déconnecté partout. Merci d'avoir fait partie de Classic Mini DIY.",
      "home": "Retour à l'accueil"
    }
  },
  "de": {
    "meta": {
      "title": "Konto löschen | Classic Mini DIY",
      "description": "Lösche dein Classic Mini DIY-Konto über die Website oder die Toolbox-Apps. Erfahre, was gelöscht wird, was aus buchhalterischen Gründen bleibt und wie lange es dauert."
    },
    "hero": {
      "title": "Konto löschen",
      "subtitle": "Ein Konto gilt für classicminidiy.com, The Mini Exchange und die Classic Mini DIY Toolbox-Apps. Beim Löschen werden deine Daten aus allen entfernt."
    },
    "deleted": {
      "title": "Was gelöscht wird",
      "intro": "Nach deiner Bestätigung entfernen wir:",
      "items": [
        "Dein Profil, deine Anmeldemethoden und Passkeys",
        "Marktplatz-Nachrichten, Merkliste, gespeicherte Suchen und alle Anzeigen, die weder verkauft noch bezahlt wurden",
        "Garagen-Fahrzeuge, Wartungseinträge und gespeicherte Rechner-Einstellungen aus den Toolbox-Apps",
        "KI-Chatverlauf und Entwickler-API-Schlüssel",
        "Deine Discord-Verknüpfung und die Mitgliederrolle",
        "Benachrichtigungseinstellungen und Push-Abonnements"
      ]
    },
    "kept": {
      "title": "Was wir behalten und warum",
      "intro": "Einige Datensätze müssen aus rechtlichen und buchhalterischen Gründen bleiben. Die Verknüpfung zu deinem Konto wird aus allen entfernt.",
      "items": [
        "Verkaufte Anzeigen und Anzeigen mit bezahltem Upgrade (geschlossen, ohne Ihren Namen und Standortdaten) sowie jeder Zahlungsdatensatz (Anzeigen-Upgrades, Mitgliedschaften, 3D-Modell-Käufe), bis zu 7 Jahre für Buchhaltung und Streitfälle",
        "Genehmigte und veröffentlichte Archivbeiträge (Registereinträge, Farben, Felgen, Dokumente), die ohne deinen Namen veröffentlicht bleiben",
        "3D-Modelle, die andere Personen gekauft haben, damit Käufer behalten, was sie gekauft haben"
      ],
      "note": "Nutzungsanalysen werden separat behandelt. Siehe den Hilfe-Abschnitt unten."
    },
    "membership": {
      "title": "Kündige zuerst deine Mitgliedschaft",
      "body": "Das Löschen des Kontos kündigt keine Sustaining-Mitgliedschaft. Die Abrechnung erfolgt über den Store, in dem du bezahlt hast, und wir können sie nicht für dich stoppen. Kündige sie zuerst und lösche dann das Konto.",
      "apple": "App Store-Abos",
      "google": "Google Play-Abos",
      "stripe": "Web-Mitgliedschaft (Stripe)",
      "active_warning": "Dieses Konto hat eine aktive Mitgliedschaft, die über {platform} abgerechnet wird. Kündige sie vor dem Löschen, sonst wird weiter abgebucht.",
      "active_cta": "In {platform} verwalten"
    },
    "platform": {
      "apple": "dem App Store",
      "google": "Google Play",
      "stripe": "Stripe"
    },
    "timing": {
      "title": "Wie lange es dauert",
      "body": "Die Löschung erfolgt sofort. Deine Daten werden im Moment der Bestätigung entfernt und können nicht wiederhergestellt werden. Du erhältst eine Bestätigungs-E-Mail an die Adresse des Kontos."
    },
    "help": {
      "title": "Keine Anmeldung möglich oder sollen auch Analysedaten gelöscht werden?",
      "body": "Wenn du dich nicht anmelden kannst, um die Löschung zu bestätigen, oder die mit deinem Konto verknüpften Nutzungsanalysen gelöscht werden sollen, schreibe an",
      "privacy": "Was wir insgesamt speichern, steht in der",
      "privacy_link": "Datenschutzrichtlinie"
    },
    "action": {
      "title": "Dieses Konto löschen",
      "checking": "Anmeldung wird geprüft…",
      "signin_body": "Melde dich mit dem Konto an, das du löschen möchtest. Verwende dieselbe Anmeldemethode wie in der App.",
      "signin_cta": "Anmelden, um das Konto zu löschen",
      "signed_in_as": "Angemeldet als",
      "confirm_label": "Gib {word} ein, um zu bestätigen",
      "button": "Mein Konto endgültig löschen",
      "deleting": "Wird gelöscht…",
      "error": "Etwas ist schiefgelaufen und nichts wurde gelöscht. Versuche es erneut oder schreibe an {email}.",
      "irreversible": "Das kann nicht rückgängig gemacht werden."
    },
    "done": {
      "title": "Dein Konto wurde gelöscht",
      "body": "Du bist überall abgemeldet. Danke, dass du Teil von Classic Mini DIY warst.",
      "home": "Zurück zur Startseite"
    }
  },
  "it": {
    "meta": {
      "title": "Elimina il tuo account | Classic Mini DIY",
      "description": "Elimina il tuo account Classic Mini DIY dal sito web o dalle app Toolbox. Scopri cosa viene rimosso, cosa viene conservato per la contabilità e quanto tempo richiede."
    },
    "hero": {
      "title": "Elimina il tuo account",
      "subtitle": "Un solo account copre classicminidiy.com, The Mini Exchange e le app Classic Mini DIY Toolbox. Eliminarlo rimuove i tuoi dati da tutti."
    },
    "deleted": {
      "title": "Cosa viene eliminato",
      "intro": "Quando confermi, rimuoviamo:",
      "items": [
        "Il tuo profilo, i metodi di accesso e le passkey",
        "Messaggi del mercatino, lista dei preferiti, ricerche salvate e gli annunci né venduti né a pagamento",
        "Veicoli del garage, registri di manutenzione e configurazioni salvate dei calcolatori delle app Toolbox",
        "Cronologia della chat IA e chiavi API per sviluppatori",
        "Il tuo collegamento Discord e il ruolo riservato ai membri",
        "Impostazioni di notifica e iscrizioni push"
      ]
    },
    "kept": {
      "title": "Cosa conserviamo e perché",
      "intro": "Alcuni dati devono restare per motivi legali e contabili. Il collegamento al tuo account viene rimosso da tutti.",
      "items": [
        "Annunci venduti e annunci per cui hai pagato un potenziamento (chiusi, senza il tuo nome e i dati di posizione), più ogni registrazione di pagamento (potenziamenti degli annunci, abbonamenti, acquisti di modelli 3D), conservati fino a 7 anni per contabilità e gestione delle controversie",
        "Contributi all'archivio approvati e pubblicati (voci del registro, colori, cerchi, documenti), che restano pubblicati senza il tuo nome",
        "Modelli 3D che altre persone hanno pagato, così gli acquirenti conservano ciò che hanno comprato"
      ],
      "note": "Le analisi di utilizzo sono gestite separatamente. Vedi la sezione di aiuto qui sotto."
    },
    "membership": {
      "title": "Annulla prima il tuo abbonamento",
      "body": "Eliminare l'account non annulla un abbonamento Sustaining Member. La fatturazione è gestita dallo store attraverso cui hai pagato e non possiamo interromperla per te. Annullalo prima, poi torna a eliminare l'account.",
      "apple": "Abbonamenti App Store",
      "google": "Abbonamenti Google Play",
      "stripe": "Abbonamento web (Stripe)",
      "active_warning": "Questo account ha un abbonamento attivo fatturato tramite {platform}. Annullalo prima di eliminare l'account, altrimenti continuerai a pagare.",
      "active_cta": "Gestisci su {platform}"
    },
    "platform": {
      "apple": "App Store",
      "google": "Google Play",
      "stripe": "Stripe"
    },
    "timing": {
      "title": "Quanto tempo richiede",
      "body": "L'eliminazione è immediata. I tuoi dati vengono rimossi nel momento in cui confermi e non possono essere recuperati. Riceverai un'email di conferma all'indirizzo dell'account."
    },
    "help": {
      "title": "Non riesci ad accedere o vuoi rimuovere anche le analisi?",
      "body": "Se non riesci ad accedere per confermare l'eliminazione, o vuoi che vengano rimosse le analisi di utilizzo legate al tuo account, scrivi a",
      "privacy": "Per il quadro completo di ciò che conserviamo, leggi l'",
      "privacy_link": "Informativa sulla privacy"
    },
    "action": {
      "title": "Elimina questo account",
      "checking": "Verifica dell'accesso…",
      "signin_body": "Accedi con l'account che vuoi eliminare. Usa lo stesso metodo di accesso che usi nell'app.",
      "signin_cta": "Accedi per eliminare il tuo account",
      "signed_in_as": "Accesso effettuato come",
      "confirm_label": "Digita {word} per confermare",
      "button": "Elimina definitivamente il mio account",
      "deleting": "Eliminazione…",
      "error": "Qualcosa è andato storto e non è stato eliminato nulla. Riprova o scrivi a {email}.",
      "irreversible": "Questa operazione non può essere annullata."
    },
    "done": {
      "title": "Il tuo account è stato eliminato",
      "body": "Sei disconnesso ovunque. Grazie per aver fatto parte di Classic Mini DIY.",
      "home": "Torna alla home"
    }
  },
  "pt": {
    "meta": {
      "title": "Excluir sua conta | Classic Mini DIY",
      "description": "Exclua sua conta Classic Mini DIY pelo site ou pelos apps Toolbox. Veja o que é removido, o que é mantido para contabilidade e quanto tempo leva."
    },
    "hero": {
      "title": "Excluir sua conta",
      "subtitle": "Uma única conta cobre classicminidiy.com, The Mini Exchange e os apps Classic Mini DIY Toolbox. Excluí-la remove seus dados de todos eles."
    },
    "deleted": {
      "title": "O que é excluído",
      "intro": "Quando você confirmar, removemos:",
      "items": [
        "Seu perfil, métodos de login e passkeys",
        "Mensagens do marketplace, lista de acompanhamento, buscas salvas e anúncios que não foram vendidos nem pagos",
        "Veículos da garagem, registros de manutenção e configurações de calculadoras salvas nos apps Toolbox",
        "Histórico do chat de IA e chaves da API de desenvolvedor",
        "Seu vínculo com o Discord e o cargo exclusivo para membros",
        "Configurações de notificação e inscrições push"
      ]
    },
    "kept": {
      "title": "O que mantemos e por quê",
      "intro": "Alguns registros precisam ficar por motivos legais e contábeis. O vínculo com sua conta é removido de todos eles.",
      "items": [
        "Anúncios vendidos e anúncios com upgrade pago (encerrados, sem seu nome e dados de localização), além de cada registro de pagamento (upgrades de anúncio, assinaturas, compras de modelos 3D), mantidos por até 7 anos para contabilidade e disputas",
        "Contribuições ao arquivo aprovadas e publicadas (entradas do registro, cores, rodas, documentos), que continuam publicadas sem o seu nome",
        "Modelos 3D pelos quais outras pessoas pagaram, para que os compradores mantenham o que compraram"
      ],
      "note": "As análises de uso são tratadas separadamente. Veja a seção de ajuda abaixo."
    },
    "membership": {
      "title": "Cancele sua assinatura primeiro",
      "body": "Excluir sua conta não cancela uma assinatura Sustaining Member. A cobrança é feita pela loja pela qual você pagou e não podemos interrompê-la por você. Cancele primeiro e depois volte para excluir a conta.",
      "apple": "Assinaturas da App Store",
      "google": "Assinaturas do Google Play",
      "stripe": "Assinatura web (Stripe)",
      "active_warning": "Esta conta tem uma assinatura ativa cobrada por {platform}. Cancele-a antes de excluir a conta, ou você continuará sendo cobrado.",
      "active_cta": "Gerenciar em {platform}"
    },
    "platform": {
      "apple": "App Store",
      "google": "Google Play",
      "stripe": "Stripe"
    },
    "timing": {
      "title": "Quanto tempo leva",
      "body": "A exclusão é imediata. Seus dados são removidos no momento em que você confirma e não podem ser recuperados. Você receberá um e-mail de confirmação no endereço da conta."
    },
    "help": {
      "title": "Não consegue entrar ou quer remover as análises também?",
      "body": "Se você não consegue entrar para confirmar a exclusão, ou quer que as análises de uso vinculadas à sua conta sejam removidas, escreva para",
      "privacy": "Para ver tudo o que armazenamos, leia a",
      "privacy_link": "Política de Privacidade"
    },
    "action": {
      "title": "Excluir esta conta",
      "checking": "Verificando seu login…",
      "signin_body": "Entre com a conta que deseja excluir. Use o mesmo método de login que usa no app.",
      "signin_cta": "Entrar para excluir sua conta",
      "signed_in_as": "Conectado como",
      "confirm_label": "Digite {word} para confirmar",
      "button": "Excluir minha conta permanentemente",
      "deleting": "Excluindo…",
      "error": "Algo deu errado e nada foi excluído. Tente novamente ou escreva para {email}.",
      "irreversible": "Isso não pode ser desfeito."
    },
    "done": {
      "title": "Sua conta foi excluída",
      "body": "Você saiu de todos os lugares. Obrigado por fazer parte do Classic Mini DIY.",
      "home": "Voltar à página inicial"
    }
  },
  "ru": {
    "meta": {
      "title": "Удалить аккаунт | Classic Mini DIY",
      "description": "Удалите свой аккаунт Classic Mini DIY через сайт или приложения Toolbox. Узнайте, что удаляется, что сохраняется для бухгалтерии и сколько это занимает."
    },
    "hero": {
      "title": "Удалить аккаунт",
      "subtitle": "Один аккаунт охватывает classicminidiy.com, The Mini Exchange и приложения Classic Mini DIY Toolbox. Его удаление стирает ваши данные во всех них."
    },
    "deleted": {
      "title": "Что удаляется",
      "intro": "После подтверждения мы удалим:",
      "items": [
        "Ваш профиль, способы входа и ключи доступа (passkeys)",
        "Сообщения на площадке, список отслеживания, сохранённые поиски и объявления, которые не были ни проданы, ни оплачены",
        "Автомобили в гараже, записи о обслуживании и сохранённые настройки калькуляторов из приложений Toolbox",
        "Историю ИИ-чата и ключи API для разработчиков",
        "Вашу привязку Discord и роль участника",
        "Настройки уведомлений и push-подписки"
      ]
    },
    "kept": {
      "title": "Что мы сохраняем и почему",
      "intro": "Некоторые записи должны остаться по юридическим и бухгалтерским причинам. Связь с вашим аккаунтом удаляется из всех них.",
      "items": [
        "Проданные объявления и объявления с оплаченным улучшением (закрытые, без вашего имени и данных о местоположении), а также каждая запись о платеже (улучшения объявлений, членство, покупки 3D-моделей) хранятся до 7 лет для бухгалтерии и разрешения споров",
        "Одобренные и опубликованные вклады в архив (записи реестра, цвета, диски, документы) остаются опубликованными без вашего имени",
        "3D-модели, за которые заплатили другие люди, чтобы покупатели сохранили купленное"
      ],
      "note": "Аналитика использования обрабатывается отдельно. См. раздел помощи ниже."
    },
    "membership": {
      "title": "Сначала отмените членство",
      "body": "Удаление аккаунта не отменяет членство Sustaining Member. Оплатой управляет магазин, через который вы платили, и мы не можем остановить её за вас. Сначала отмените её, затем вернитесь и удалите аккаунт.",
      "apple": "Подписки App Store",
      "google": "Подписки Google Play",
      "stripe": "Веб-членство (Stripe)",
      "active_warning": "У этого аккаунта есть активное членство с оплатой через {platform}. Отмените его перед удалением аккаунта, иначе списания продолжатся.",
      "active_cta": "Управлять в {platform}"
    },
    "platform": {
      "apple": "App Store",
      "google": "Google Play",
      "stripe": "Stripe"
    },
    "timing": {
      "title": "Сколько это занимает",
      "body": "Удаление происходит немедленно. Ваши данные удаляются в момент подтверждения и не могут быть восстановлены. Вы получите одно письмо с подтверждением на адрес аккаунта."
    },
    "help": {
      "title": "Не можете войти или хотите удалить и аналитику?",
      "body": "Если вы не можете войти, чтобы подтвердить удаление, или хотите удалить аналитику использования, связанную с вашим аккаунтом, напишите на",
      "privacy": "Полную картину того, что мы храним, см. в",
      "privacy_link": "Политике конфиденциальности"
    },
    "action": {
      "title": "Удалить этот аккаунт",
      "checking": "Проверяем вход…",
      "signin_body": "Войдите в аккаунт, который хотите удалить. Используйте тот же способ входа, что и в приложении.",
      "signin_cta": "Войти, чтобы удалить аккаунт",
      "signed_in_as": "Вы вошли как",
      "confirm_label": "Введите {word} для подтверждения",
      "button": "Удалить мой аккаунт навсегда",
      "deleting": "Удаление…",
      "error": "Что-то пошло не так, и ничего не было удалено. Попробуйте ещё раз или напишите на {email}.",
      "irreversible": "Это действие нельзя отменить."
    },
    "done": {
      "title": "Ваш аккаунт удалён",
      "body": "Вы вышли из системы везде. Спасибо, что были частью Classic Mini DIY.",
      "home": "На главную"
    }
  },
  "ja": {
    "meta": {
      "title": "アカウントを削除 | Classic Mini DIY",
      "description": "ウェブサイトまたはToolboxアプリからClassic Mini DIYアカウントを削除できます。削除されるもの、会計上保持されるもの、所要時間をご確認ください。"
    },
    "hero": {
      "title": "アカウントを削除",
      "subtitle": "1つのアカウントでclassicminidiy.com、The Mini Exchange、Classic Mini DIY Toolboxアプリを利用しています。削除するとすべてからデータが消去されます。"
    },
    "deleted": {
      "title": "削除されるもの",
      "intro": "確認すると、次のものを削除します：",
      "items": [
        "プロフィール、ログイン方法、パスキー",
        "マーケットプレイスのメッセージ、ウォッチリスト、保存した検索、売却も有料アップグレードもされていない出品",
        "Toolboxアプリのガレージ車両、メンテナンス記録、保存した計算機の設定",
        "AIチャット履歴と開発者APIキー",
        "Discordの連携とメンバー限定ロール",
        "通知設定とプッシュ購読"
      ]
    },
    "kept": {
      "title": "保持するものとその理由",
      "intro": "一部の記録は法律上・会計上の理由で保持する必要があります。それらからアカウントとの紐付けは削除されます。",
      "items": [
        "売却済み出品と有料アップグレードした出品（終了済み、氏名と位置情報は削除）、および各支払いの記録（出品アップグレード、メンバーシップ、3Dモデル購入）は、会計と紛争対応のため最長7年間保持されます",
        "承認・公開済みのアーカイブ投稿（登録エントリ、カラー、ホイール、資料）は、氏名なしで公開され続けます",
        "他の方が購入した3Dモデルは、購入者が入手したものを保持できるよう残されます"
      ],
      "note": "利用状況の分析データは別途扱われます。下のヘルプ欄をご覧ください。"
    },
    "membership": {
      "title": "先にメンバーシップを解約してください",
      "body": "アカウントを削除してもSustaining Memberは解約されません。請求はお支払いいただいたストアが管理しており、当方で停止することはできません。先に解約してから、戻ってアカウントを削除してください。",
      "apple": "App Storeのサブスクリプション",
      "google": "Google Playの定期購入",
      "stripe": "ウェブメンバーシップ（Stripe）",
      "active_warning": "このアカウントには{platform}経由で請求される有効なメンバーシップがあります。アカウントを削除する前に解約しないと、請求が続きます。",
      "active_cta": "{platform}で管理"
    },
    "platform": {
      "apple": "App Store",
      "google": "Google Play",
      "stripe": "Stripe"
    },
    "timing": {
      "title": "所要時間",
      "body": "削除は即時です。確認した時点でデータは削除され、復元できません。アカウントのメールアドレスに確認メールが1通届きます。"
    },
    "help": {
      "title": "ログインできない、または分析データも削除したい場合",
      "body": "削除を確認するためにログインできない場合、またはアカウントに紐付く利用分析データの削除を希望する場合は、次のアドレスまでメールしてください：",
      "privacy": "保存している情報の全体像については、",
      "privacy_link": "プライバシーポリシー"
    },
    "action": {
      "title": "このアカウントを削除",
      "checking": "ログイン状態を確認中…",
      "signin_body": "削除したいアカウントでログインしてください。アプリで使っているのと同じログイン方法をお使いください。",
      "signin_cta": "ログインしてアカウントを削除",
      "signed_in_as": "ログイン中：",
      "confirm_label": "確認のため {word} と入力してください",
      "button": "アカウントを完全に削除する",
      "deleting": "削除中…",
      "error": "問題が発生し、何も削除されませんでした。もう一度お試しいただくか、{email} までメールしてください。",
      "irreversible": "この操作は元に戻せません。"
    },
    "done": {
      "title": "アカウントを削除しました",
      "body": "すべての場所からログアウトされました。Classic Mini DIYをご利用いただきありがとうございました。",
      "home": "ホームに戻る"
    }
  },
  "zh": {
    "meta": {
      "title": "删除您的账户 | Classic Mini DIY",
      "description": "通过网站或Toolbox应用删除您的Classic Mini DIY账户。了解哪些内容会被删除、哪些会因会计原因保留，以及需要多长时间。"
    },
    "hero": {
      "title": "删除您的账户",
      "subtitle": "一个账户通用于classicminidiy.com、The Mini Exchange和Classic Mini DIY Toolbox应用。删除后，您的数据将从所有这些服务中移除。"
    },
    "deleted": {
      "title": "会被删除的内容",
      "intro": "确认后，我们将删除：",
      "items": [
        "您的个人资料、登录方式和通行密钥",
        "交易市场消息、关注列表、已保存的搜索，以及既未售出也未付费的商品",
        "Toolbox应用中的车库车辆、保养记录和已保存的计算器设置",
        "AI聊天记录和开发者API密钥",
        "您的Discord关联和会员专属角色",
        "通知设置和推送订阅"
      ]
    },
    "kept": {
      "title": "我们保留的内容及原因",
      "intro": "出于法律和会计原因，部分记录必须保留。这些记录中与您账户的关联都会被移除。",
      "items": [
        "已售商品和您付费升级过的商品（已关闭，并移除您的姓名和位置信息），以及每笔付款记录（商品升级、会员资格、3D模型购买），出于会计和争议处理需要最长保留7年",
        "已审核并发布的档案贡献（登记条目、颜色、轮毂、文档）将继续发布，但不显示您的姓名",
        "其他人已付费购买的3D模型，以便买家保留所购内容"
      ],
      "note": "使用分析数据另行处理。请参阅下方的帮助部分。"
    },
    "membership": {
      "title": "请先取消您的会员资格",
      "body": "删除账户不会取消Sustaining Member会员资格。扣费由您付款所用的商店管理，我们无法代您停止。请先取消，然后再回来删除账户。",
      "apple": "App Store订阅",
      "google": "Google Play订阅",
      "stripe": "网页会员（Stripe）",
      "active_warning": "此账户有一项通过{platform}扣费的有效会员资格。请在删除账户前取消，否则将继续扣费。",
      "active_cta": "在{platform}中管理"
    },
    "platform": {
      "apple": "App Store",
      "google": "Google Play",
      "stripe": "Stripe"
    },
    "timing": {
      "title": "需要多长时间",
      "body": "删除是即时的。您确认的那一刻数据就会被移除，且无法恢复。您将在账户邮箱收到一封确认邮件。"
    },
    "help": {
      "title": "无法登录，或者也想删除分析数据？",
      "body": "如果您无法登录以确认删除，或者希望删除与您账户关联的使用分析数据，请发送邮件至",
      "privacy": "要全面了解我们存储的内容，请阅读",
      "privacy_link": "隐私政策"
    },
    "action": {
      "title": "删除此账户",
      "checking": "正在检查登录状态…",
      "signin_body": "请使用您要删除的账户登录。使用与应用中相同的登录方式。",
      "signin_cta": "登录以删除您的账户",
      "signed_in_as": "当前登录：",
      "confirm_label": "输入 {word} 以确认",
      "button": "永久删除我的账户",
      "deleting": "正在删除…",
      "error": "出现问题，未删除任何内容。请重试，或发送邮件至 {email}。",
      "irreversible": "此操作无法撤销。"
    },
    "done": {
      "title": "您的账户已删除",
      "body": "您已在所有地方退出登录。感谢您成为Classic Mini DIY的一员。",
      "home": "返回首页"
    }
  },
  "ko": {
    "meta": {
      "title": "계정 삭제 | Classic Mini DIY",
      "description": "웹사이트 또는 Toolbox 앱에서 Classic Mini DIY 계정을 삭제하세요. 삭제되는 항목, 회계상 보관되는 항목, 소요 시간을 확인하세요."
    },
    "hero": {
      "title": "계정 삭제",
      "subtitle": "하나의 계정으로 classicminidiy.com, The Mini Exchange, Classic Mini DIY Toolbox 앱을 이용합니다. 삭제하면 모든 서비스에서 데이터가 제거됩니다."
    },
    "deleted": {
      "title": "삭제되는 항목",
      "intro": "확인하시면 다음 항목을 제거합니다:",
      "items": [
        "프로필, 로그인 방법, 패스키",
        "마켓플레이스 메시지, 관심 목록, 저장된 검색, 그리고 판매되지도 결제되지도 않은 매물",
        "Toolbox 앱의 차고 차량, 정비 기록, 저장된 계산기 설정",
        "AI 채팅 기록 및 개발자 API 키",
        "Discord 연결 및 회원 전용 역할",
        "알림 설정 및 푸시 구독"
      ]
    },
    "kept": {
      "title": "보관하는 항목과 그 이유",
      "intro": "일부 기록은 법적·회계상 이유로 보관해야 합니다. 모든 기록에서 계정과의 연결은 제거됩니다.",
      "items": [
        "판매된 매물과 유료 업그레이드한 매물(종료됨, 이름과 위치 정보 제거), 그리고 모든 결제 기록(매물 업그레이드, 멤버십, 3D 모델 구매)은 회계 및 분쟁 처리를 위해 최대 7년간 보관됩니다",
        "승인되어 게시된 아카이브 기여(등록 항목, 색상, 휠, 문서)는 이름 없이 계속 게시됩니다",
        "다른 사람이 구매한 3D 모델은 구매자가 구매한 것을 유지할 수 있도록 남습니다"
      ],
      "note": "사용 분석 데이터는 별도로 처리됩니다. 아래 도움말 섹션을 참조하세요."
    },
    "membership": {
      "title": "먼저 멤버십을 해지하세요",
      "body": "계정을 삭제해도 Sustaining Member 멤버십은 해지되지 않습니다. 결제는 결제하신 스토어에서 관리하므로 저희가 대신 중단할 수 없습니다. 먼저 해지한 다음 돌아와서 계정을 삭제하세요.",
      "apple": "App Store 구독",
      "google": "Google Play 구독",
      "stripe": "웹 멤버십(Stripe)",
      "active_warning": "이 계정에는 {platform}을(를) 통해 결제되는 활성 멤버십이 있습니다. 계정을 삭제하기 전에 해지하지 않으면 계속 청구됩니다.",
      "active_cta": "{platform}에서 관리"
    },
    "platform": {
      "apple": "App Store",
      "google": "Google Play",
      "stripe": "Stripe"
    },
    "timing": {
      "title": "소요 시간",
      "body": "삭제는 즉시 이루어집니다. 확인하는 순간 데이터가 제거되며 복구할 수 없습니다. 계정 이메일 주소로 확인 메일이 한 통 발송됩니다."
    },
    "help": {
      "title": "로그인할 수 없거나 분석 데이터도 삭제하고 싶으신가요?",
      "body": "삭제를 확인하기 위해 로그인할 수 없거나 계정에 연결된 사용 분석 데이터의 삭제를 원하시면 다음 주소로 이메일을 보내주세요:",
      "privacy": "저희가 저장하는 정보의 전체 내용은",
      "privacy_link": "개인정보 처리방침"
    },
    "action": {
      "title": "이 계정 삭제",
      "checking": "로그인 확인 중…",
      "signin_body": "삭제하려는 계정으로 로그인하세요. 앱에서 사용하는 것과 같은 로그인 방법을 사용하세요.",
      "signin_cta": "로그인하여 계정 삭제",
      "signed_in_as": "로그인 계정:",
      "confirm_label": "확인하려면 {word}을(를) 입력하세요",
      "button": "내 계정 영구 삭제",
      "deleting": "삭제 중…",
      "error": "문제가 발생하여 아무것도 삭제되지 않았습니다. 다시 시도하거나 {email}으로 이메일을 보내주세요.",
      "irreversible": "이 작업은 되돌릴 수 없습니다."
    },
    "done": {
      "title": "계정이 삭제되었습니다",
      "body": "모든 곳에서 로그아웃되었습니다. Classic Mini DIY와 함께해 주셔서 감사합니다.",
      "home": "홈으로 돌아가기"
    }
  }
}
</i18n>
