<script lang="ts" setup>
  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const supabase = useSupabase();
  const { track } = useAnalytics();
  const { add: addToast } = useToast();
  const { isAuthenticated, user, waitForAuth, fetchUserProfile } = useAuth();

  // The emailed claim link (Ghost/Patreon inbound channels) lands here as
  // /membership/claim?code=<claim_jti>. Redemption = claim_external_membership(p_code)
  // while signed in: it writes the subscriptions row (fan-out: badge, Discord,
  // Ghost comp, TME listings) and marks the pending row claimed. The RPC is
  // idempotent for the same user re-clicking the same emailed link.
  const code = computed(() => {
    const raw = route.query.code;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
  });

  // Logged-out claim intent: same /login?redirect= round trip the membership
  // page uses (login re-validates via sanitizeRedirectPath and stashes the path
  // in localStorage; /auth/callback consumes it after the OAuth/magic-link
  // round trip). Re-encode the code so the query survives both decode passes.
  const claimIntentPath = computed(() =>
    code.value ? `/membership/claim?code=${encodeURIComponent(code.value)}` : '/membership/claim'
  );
  const loginWithIntentHref = computed(() => `/login?redirect=${encodeURIComponent(claimIntentPath.value)}`);

  type ClaimState =
    | 'checking' // resolving auth / about to redeem
    | 'missing_code' // no ?code= in the URL
    | 'signin' // logged out — needs the login round trip first
    | 'redeeming' // RPC in flight
    | 'success' // membership attached
    | 'invalid' // unknown / malformed code (P0002 generic, 22004)
    | 'already_claimed' // code consumed by a different account
    | 'expired' // stale link (>30 days) — reconciliation cron re-issues
    | 'error'; // transient RPC/network failure — retryable
  const state = ref<ClaimState>('checking');

  // Let the user actually see the success card before landing on /membership.
  const SUCCESS_REDIRECT_DELAY_MS = 1500;

  // Map RPC failures onto distinct friendly states. All three business errors
  // raise ERRCODE P0002 with distinct messages (see migration
  // 20260609000001_inbound_membership_channels.sql), so the message is the
  // discriminator; anything else is treated as transient and retryable.
  function handleClaimError(error: { code?: string; message?: string } | null) {
    const message = error?.message ?? '';
    let reason: string;
    if (message.includes('already been claimed')) {
      state.value = 'already_claimed';
      reason = 'already_claimed';
    } else if (message.includes('expired') && message.includes('emailed')) {
      state.value = 'expired';
      reason = 'expired';
    } else if (error?.code === 'P0002' || error?.code === '22004') {
      state.value = 'invalid';
      reason = 'invalid';
    } else {
      state.value = 'error';
      reason = 'rpc_error';
    }
    track('membership_claim_failed', { source: 'web', reason, error_code: error?.code });
  }

  async function redeem() {
    if (!code.value) return;
    state.value = 'redeeming';
    try {
      // Cast the RPC name until types/database.ts is regenerated post-deploy
      // (same precedent as get_my_membership on /membership).
      const { data, error } = await supabase.rpc('claim_external_membership' as any, { p_code: code.value });
      if (error) {
        console.error('Membership claim failed:', error);
        handleClaimError(error);
        return;
      }
      // RETURNS TABLE → PostgREST hands back an array of rows.
      const row = (Array.isArray(data) ? data[0] : data) as { platform?: string | null } | undefined;
      track('membership_claim_redeemed', { source: 'web', platform: row?.platform ?? undefined });
      state.value = 'success';
      addToast({
        title: t('toasts.success_title'),
        description: t('toasts.success_body'),
        color: 'success',
        icon: 'fas fa-circle-check',
        timeout: 8000,
      });
      // The RPC writes the subscriptions row synchronously — refresh the shared
      // membership gate so /membership renders the member area on arrival.
      if (user.value) await fetchUserProfile(user.value.id);
      setTimeout(() => navigateTo('/membership'), SUCCESS_REDIRECT_DELAY_MS);
    } catch (err) {
      console.error('Membership claim failed:', err);
      track('membership_claim_failed', { source: 'web', reason: 'exception' });
      state.value = 'error';
    }
  }

  async function begin() {
    state.value = 'checking';
    await waitForAuth();
    if (!isAuthenticated.value) {
      state.value = 'signin';
      return;
    }
    await redeem();
  }

  // Run exactly once, as soon as a code is available. The code can arrive
  // late: when the PWA service worker serves the precached '/' shell (or a
  // statically-served copy boots the app), the router can briefly disagree
  // with the address bar — the same failure mode the /auth/callback
  // routeRules entry documents. So: route.query first, location.search as
  // the fallback, and a watcher to catch the router syncing up after mount.
  let begun = false;
  function tryBegin(): boolean {
    if (begun || !code.value) return begun;
    begun = true;
    void begin();
    return true;
  }
  watch(code, () => {
    tryBegin();
  });
  onMounted(() => {
    if (tryBegin()) return;
    const locCode = (new URLSearchParams(window.location.search).get('code') ?? '').trim();
    if (locCode) {
      // The address bar has the code but the router lost it — re-sync the
      // route (keeps `code`/`claimIntentPath` consistent); the watcher begins.
      void router.replace({ query: { ...route.query, code: locCode } });
      return;
    }
    state.value = 'missing_code';
    track('membership_claim_failed', { source: 'web', reason: 'missing_code' });
  });

  // Transient page reached from a single-use emailed link — never index it.
  useHead({
    title: t('meta.title'),
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  });
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-base-200 px-4">
    <div class="card bg-base-100 shadow-md border border-base-300 w-full max-w-md">
      <ClientOnly>
        <div class="card-body items-center text-center">
          <span class="eyebrow mb-1">{{ t('eyebrow') }}</span>

          <!-- Resolving auth -->
          <template v-if="state === 'checking'">
            <span class="loading loading-spinner loading-lg text-primary mt-4"></span>
            <p class="opacity-70 mt-3">{{ t('checking') }}</p>
          </template>

          <!-- RPC in flight -->
          <template v-else-if="state === 'redeeming'">
            <span class="loading loading-spinner loading-lg text-primary mt-4"></span>
            <h1 class="text-2xl font-bold mt-3">{{ t('redeeming.title') }}</h1>
            <p class="opacity-70">{{ t('redeeming.body') }}</p>
          </template>

          <!-- Membership attached -->
          <template v-else-if="state === 'success'">
            <i class="fas fa-circle-check text-4xl text-success mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('success.title') }}</h1>
            <p class="opacity-70">{{ t('success.body') }}</p>
            <NuxtLink to="/membership" class="btn btn-primary mt-4">
              <i class="fas fa-star"></i>
              {{ t('success.cta') }}
            </NuxtLink>
          </template>

          <!-- Logged out: claim intent rides the existing /login?redirect= flow -->
          <template v-else-if="state === 'signin'">
            <i class="fas fa-right-to-bracket text-4xl text-primary mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('signin.title') }}</h1>
            <p class="opacity-70">{{ t('signin.body') }}</p>
            <NuxtLink :to="loginWithIntentHref" class="btn btn-primary mt-4">
              <i class="fas fa-right-to-bracket"></i>
              {{ t('signin.cta') }}
            </NuxtLink>
          </template>

          <!-- No ?code= in the URL -->
          <template v-else-if="state === 'missing_code'">
            <i class="fas fa-circle-exclamation text-4xl text-warning mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('missing_code.title') }}</h1>
            <p class="opacity-70">{{ t('missing_code.body') }}</p>
            <NuxtLink to="/membership" class="btn btn-primary mt-4">
              <i class="fas fa-star"></i>
              {{ t('membership_link') }}
            </NuxtLink>
          </template>

          <!-- Code consumed by a different account -->
          <template v-else-if="state === 'already_claimed'">
            <i class="fas fa-user-lock text-4xl text-warning mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('already_claimed.title') }}</h1>
            <p class="opacity-70">{{ t('already_claimed.body') }}</p>
          </template>

          <!-- Stale link (>30 days) — a fresh one is re-issued automatically -->
          <template v-else-if="state === 'expired'">
            <i class="fas fa-hourglass-half text-4xl text-warning mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('expired.title') }}</h1>
            <p class="opacity-70">{{ t('expired.body') }}</p>
          </template>

          <!-- Unknown / malformed code -->
          <template v-else-if="state === 'invalid'">
            <i class="fas fa-circle-xmark text-4xl text-error mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('invalid.title') }}</h1>
            <p class="opacity-70">{{ t('invalid.body') }}</p>
          </template>

          <!-- Transient RPC/network failure -->
          <template v-else>
            <i class="fas fa-triangle-exclamation text-4xl text-error mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('error.title') }}</h1>
            <p class="opacity-70">{{ t('error.body') }}</p>
            <button type="button" class="btn btn-primary mt-4" @click="redeem">
              <i class="fas fa-rotate-right"></i>
              {{ t('error.retry') }}
            </button>
          </template>

          <!-- Contact fallback on every dead-end error state -->
          <p
            v-if="state === 'invalid' || state === 'already_claimed' || state === 'expired' || state === 'error'"
            class="text-sm opacity-70 mt-4"
          >
            {{ t('contact_question') }}
            <NuxtLink to="/contact" class="link link-primary">{{ t('contact_cta') }}</NuxtLink>
          </p>
        </div>

        <template #fallback>
          <!-- SSR / pre-hydration: matches the 'checking' state so there is no
               flash between server render and the resolved client state. -->
          <div class="card-body items-center text-center">
            <span class="eyebrow mb-1">{{ t('eyebrow') }}</span>
            <span class="loading loading-spinner loading-lg text-primary mt-4"></span>
            <p class="opacity-70 mt-3">{{ t('checking') }}</p>
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "meta": {
      "title": "Claim your membership — Classic Mini DIY"
    },
    "eyebrow": "SUSTAINING MEMBER",
    "checking": "Checking your claim link…",
    "redeeming": {
      "title": "Activating your membership…",
      "body": "Hang tight — we're attaching your Sustaining Membership to this account."
    },
    "signin": {
      "title": "Sign in to claim your membership",
      "body": "You're almost there — sign in (or create a free account) and we'll attach your Sustaining Membership to it. You'll come right back here afterwards.",
      "cta": "Sign in to claim"
    },
    "success": {
      "title": "Your membership is active!",
      "body": "Welcome, Sustaining Member — your benefits are switched on across every Classic Mini DIY property.",
      "cta": "See your benefits"
    },
    "missing_code": {
      "title": "That link is missing its claim code",
      "body": "This page only works from the claim link in your membership email. Open the email and click the button again — or learn more about Sustaining Membership below."
    },
    "already_claimed": {
      "title": "This membership was already claimed",
      "body": "This claim link has already been used on a different account. If that doesn't sound right — maybe you signed in with another email — we can move it for you."
    },
    "expired": {
      "title": "This claim link has expired",
      "body": "Claim links are valid for 30 days. No need to do anything — a fresh link is on its way to your inbox automatically."
    },
    "invalid": {
      "title": "We couldn't find that claim code",
      "body": "This claim link doesn't match a pending membership. Double-check you opened the most recent email — older links stop working once a newer one is issued."
    },
    "error": {
      "title": "Something went wrong",
      "body": "We couldn't reach the membership service just now. Your claim link is still valid — give it another try.",
      "retry": "Try again"
    },
    "contact_question": "Something not right?",
    "contact_cta": "Contact us and we'll sort it out.",
    "membership_link": "About Sustaining Membership",
    "toasts": {
      "success_title": "Your membership is active!",
      "success_body": "Thanks for supporting Classic Mini DIY — your benefits are live everywhere you sign in."
    }
  },
  "es": {
    "meta": {
      "title": "Reclama tu membresía — Classic Mini DIY"
    },
    "eyebrow": "SOCIO COLABORADOR",
    "checking": "Comprobando tu enlace de reclamación…",
    "redeeming": {
      "title": "Activando tu membresía…",
      "body": "Un momento: estamos vinculando tu Membresía Colaboradora a esta cuenta."
    },
    "signin": {
      "title": "Inicia sesión para reclamar tu membresía",
      "body": "Ya casi está: inicia sesión (o crea una cuenta gratuita) y vincularemos tu Membresía Colaboradora. Volverás aquí justo después.",
      "cta": "Iniciar sesión para reclamar"
    },
    "success": {
      "title": "¡Tu membresía está activa!",
      "body": "Bienvenido, Socio Colaborador: tus ventajas están activadas en todos los sitios de Classic Mini DIY.",
      "cta": "Ver tus ventajas"
    },
    "missing_code": {
      "title": "A ese enlace le falta el código de reclamación",
      "body": "Esta página solo funciona desde el enlace de reclamación de tu correo de membresía. Abre el correo y vuelve a pulsar el botón, o consulta más abajo qué es la Membresía Colaboradora."
    },
    "already_claimed": {
      "title": "Esta membresía ya fue reclamada",
      "body": "Este enlace ya se ha usado en otra cuenta. Si no te cuadra —quizá iniciaste sesión con otro correo— podemos moverla por ti."
    },
    "expired": {
      "title": "Este enlace de reclamación ha caducado",
      "body": "Los enlaces son válidos durante 30 días. No tienes que hacer nada: ya va camino de tu bandeja de entrada uno nuevo."
    },
    "invalid": {
      "title": "No hemos encontrado ese código de reclamación",
      "body": "Este enlace no corresponde a ninguna membresía pendiente. Comprueba que has abierto el correo más reciente: los enlaces antiguos dejan de funcionar cuando se emite uno nuevo."
    },
    "error": {
      "title": "Algo ha salido mal",
      "body": "Ahora mismo no hemos podido contactar con el servicio de membresías. Tu enlace sigue siendo válido; inténtalo de nuevo.",
      "retry": "Reintentar"
    },
    "contact_question": "¿Algo no cuadra?",
    "contact_cta": "Contáctanos y lo solucionamos.",
    "membership_link": "Sobre la Membresía Colaboradora",
    "toasts": {
      "success_title": "¡Tu membresía está activa!",
      "success_body": "Gracias por apoyar a Classic Mini DIY: tus ventajas están activas allá donde inicies sesión."
    }
  },
  "fr": {
    "meta": {
      "title": "Activez votre adhésion — Classic Mini DIY"
    },
    "eyebrow": "MEMBRE DE SOUTIEN",
    "checking": "Vérification de votre lien d'activation…",
    "redeeming": {
      "title": "Activation de votre adhésion…",
      "body": "Un instant : nous rattachons votre adhésion de soutien à ce compte."
    },
    "signin": {
      "title": "Connectez-vous pour activer votre adhésion",
      "body": "Vous y êtes presque : connectez-vous (ou créez un compte gratuit) et nous y rattacherons votre adhésion de soutien. Vous reviendrez ici juste après.",
      "cta": "Se connecter pour activer"
    },
    "success": {
      "title": "Votre adhésion est active !",
      "body": "Bienvenue, membre de soutien — vos avantages sont activés sur tous les sites Classic Mini DIY.",
      "cta": "Voir vos avantages"
    },
    "missing_code": {
      "title": "Ce lien n'a pas de code d'activation",
      "body": "Cette page ne fonctionne qu'avec le lien d'activation reçu par e-mail. Ouvrez l'e-mail et cliquez à nouveau sur le bouton, ou découvrez l'adhésion de soutien ci-dessous."
    },
    "already_claimed": {
      "title": "Cette adhésion a déjà été activée",
      "body": "Ce lien a déjà été utilisé sur un autre compte. Si cela vous semble étrange — vous vous êtes peut-être connecté avec une autre adresse — nous pouvons la transférer pour vous."
    },
    "expired": {
      "title": "Ce lien d'activation a expiré",
      "body": "Les liens sont valables 30 jours. Rien à faire de votre côté : un nouveau lien arrive automatiquement dans votre boîte de réception."
    },
    "invalid": {
      "title": "Nous n'avons pas trouvé ce code d'activation",
      "body": "Ce lien ne correspond à aucune adhésion en attente. Vérifiez que vous avez ouvert l'e-mail le plus récent : les anciens liens cessent de fonctionner dès qu'un nouveau est émis."
    },
    "error": {
      "title": "Une erreur est survenue",
      "body": "Nous n'avons pas pu joindre le service d'adhésion pour le moment. Votre lien reste valable — réessayez.",
      "retry": "Réessayer"
    },
    "contact_question": "Quelque chose ne va pas ?",
    "contact_cta": "Contactez-nous, nous réglerons ça.",
    "membership_link": "À propos de l'adhésion de soutien",
    "toasts": {
      "success_title": "Votre adhésion est active !",
      "success_body": "Merci de soutenir Classic Mini DIY — vos avantages sont actifs partout où vous vous connectez."
    }
  },
  "de": {
    "meta": {
      "title": "Mitgliedschaft aktivieren — Classic Mini DIY"
    },
    "eyebrow": "FÖRDERMITGLIED",
    "checking": "Dein Aktivierungslink wird geprüft…",
    "redeeming": {
      "title": "Deine Mitgliedschaft wird aktiviert…",
      "body": "Einen Moment – wir verknüpfen deine Fördermitgliedschaft mit diesem Konto."
    },
    "signin": {
      "title": "Melde dich an, um deine Mitgliedschaft zu aktivieren",
      "body": "Fast geschafft: Melde dich an (oder erstelle ein kostenloses Konto) und wir verknüpfen deine Fördermitgliedschaft damit. Danach kommst du direkt hierher zurück.",
      "cta": "Zum Aktivieren anmelden"
    },
    "success": {
      "title": "Deine Mitgliedschaft ist aktiv!",
      "body": "Willkommen, Fördermitglied – deine Vorteile sind auf allen Classic-Mini-DIY-Seiten freigeschaltet.",
      "cta": "Vorteile ansehen"
    },
    "missing_code": {
      "title": "Diesem Link fehlt der Aktivierungscode",
      "body": "Diese Seite funktioniert nur über den Aktivierungslink aus deiner Mitglieder-E-Mail. Öffne die E-Mail und klicke den Button erneut – oder erfahre unten mehr über die Fördermitgliedschaft."
    },
    "already_claimed": {
      "title": "Diese Mitgliedschaft wurde bereits aktiviert",
      "body": "Dieser Link wurde bereits mit einem anderen Konto verwendet. Falls das nicht stimmen kann – vielleicht hast du dich mit einer anderen E-Mail angemeldet – verschieben wir sie gern für dich."
    },
    "expired": {
      "title": "Dieser Aktivierungslink ist abgelaufen",
      "body": "Aktivierungslinks sind 30 Tage gültig. Du musst nichts tun – ein neuer Link ist automatisch schon unterwegs in dein Postfach."
    },
    "invalid": {
      "title": "Wir konnten diesen Aktivierungscode nicht finden",
      "body": "Dieser Link passt zu keiner ausstehenden Mitgliedschaft. Prüfe, ob du die neueste E-Mail geöffnet hast – ältere Links werden ungültig, sobald ein neuer ausgestellt wird."
    },
    "error": {
      "title": "Etwas ist schiefgelaufen",
      "body": "Wir konnten den Mitgliederdienst gerade nicht erreichen. Dein Link bleibt gültig – versuche es noch einmal.",
      "retry": "Erneut versuchen"
    },
    "contact_question": "Stimmt etwas nicht?",
    "contact_cta": "Kontaktiere uns, wir klären das.",
    "membership_link": "Über die Fördermitgliedschaft",
    "toasts": {
      "success_title": "Deine Mitgliedschaft ist aktiv!",
      "success_body": "Danke, dass du Classic Mini DIY unterstützt – deine Vorteile sind überall aktiv, wo du dich anmeldest."
    }
  },
  "it": {
    "meta": {
      "title": "Attiva la tua iscrizione — Classic Mini DIY"
    },
    "eyebrow": "SOCIO SOSTENITORE",
    "checking": "Verifica del link di attivazione…",
    "redeeming": {
      "title": "Attivazione dell'iscrizione…",
      "body": "Un attimo: stiamo collegando la tua iscrizione da sostenitore a questo account."
    },
    "signin": {
      "title": "Accedi per attivare la tua iscrizione",
      "body": "Ci siamo quasi: accedi (o crea un account gratuito) e collegheremo la tua iscrizione da sostenitore. Tornerai subito qui.",
      "cta": "Accedi per attivare"
    },
    "success": {
      "title": "La tua iscrizione è attiva!",
      "body": "Benvenuto, Socio Sostenitore: i tuoi vantaggi sono attivi su tutti i siti Classic Mini DIY.",
      "cta": "Vedi i tuoi vantaggi"
    },
    "missing_code": {
      "title": "A questo link manca il codice di attivazione",
      "body": "Questa pagina funziona solo dal link di attivazione contenuto nella tua email. Apri l'email e premi di nuovo il pulsante, oppure scopri di più sull'iscrizione da sostenitore qui sotto."
    },
    "already_claimed": {
      "title": "Questa iscrizione è già stata attivata",
      "body": "Questo link è già stato usato su un altro account. Se non ti torna — magari hai effettuato l'accesso con un'altra email — possiamo spostarla noi."
    },
    "expired": {
      "title": "Questo link di attivazione è scaduto",
      "body": "I link sono validi 30 giorni. Non devi fare nulla: un link nuovo è già in arrivo nella tua casella di posta."
    },
    "invalid": {
      "title": "Non abbiamo trovato questo codice di attivazione",
      "body": "Questo link non corrisponde a nessuna iscrizione in sospeso. Controlla di aver aperto l'email più recente: i link vecchi smettono di funzionare quando ne viene emesso uno nuovo."
    },
    "error": {
      "title": "Qualcosa è andato storto",
      "body": "Al momento non siamo riusciti a contattare il servizio iscrizioni. Il tuo link è ancora valido: riprova.",
      "retry": "Riprova"
    },
    "contact_question": "Qualcosa non va?",
    "contact_cta": "Contattaci e risolviamo.",
    "membership_link": "Info sull'iscrizione da sostenitore",
    "toasts": {
      "success_title": "La tua iscrizione è attiva!",
      "success_body": "Grazie per sostenere Classic Mini DIY: i tuoi vantaggi sono attivi ovunque effettui l'accesso."
    }
  },
  "pt": {
    "meta": {
      "title": "Ative a sua adesão — Classic Mini DIY"
    },
    "eyebrow": "MEMBRO APOIADOR",
    "checking": "A verificar o seu link de ativação…",
    "redeeming": {
      "title": "A ativar a sua adesão…",
      "body": "Um momento — estamos a associar a sua Adesão Apoiadora a esta conta."
    },
    "signin": {
      "title": "Inicie sessão para ativar a sua adesão",
      "body": "Falta pouco: inicie sessão (ou crie uma conta gratuita) e associaremos a sua Adesão Apoiadora. Volta logo a seguir para aqui.",
      "cta": "Iniciar sessão para ativar"
    },
    "success": {
      "title": "A sua adesão está ativa!",
      "body": "Bem-vindo, Membro Apoiador — as suas vantagens estão ligadas em todos os sites Classic Mini DIY.",
      "cta": "Ver as suas vantagens"
    },
    "missing_code": {
      "title": "Falta o código de ativação nesse link",
      "body": "Esta página só funciona a partir do link de ativação do seu email de adesão. Abra o email e clique novamente no botão — ou saiba mais sobre a Adesão Apoiadora abaixo."
    },
    "already_claimed": {
      "title": "Esta adesão já foi ativada",
      "body": "Este link já foi usado noutra conta. Se isso não lhe parece certo — talvez tenha iniciado sessão com outro email — podemos transferi-la por si."
    },
    "expired": {
      "title": "Este link de ativação expirou",
      "body": "Os links são válidos durante 30 dias. Não precisa de fazer nada: um link novo já segue automaticamente para a sua caixa de entrada."
    },
    "invalid": {
      "title": "Não encontrámos esse código de ativação",
      "body": "Este link não corresponde a nenhuma adesão pendente. Confirme que abriu o email mais recente — os links antigos deixam de funcionar assim que é emitido um novo."
    },
    "error": {
      "title": "Algo correu mal",
      "body": "Não conseguimos contactar o serviço de adesões neste momento. O seu link continua válido — tente novamente.",
      "retry": "Tentar novamente"
    },
    "contact_question": "Algo não está certo?",
    "contact_cta": "Fale connosco e resolvemos.",
    "membership_link": "Sobre a Adesão Apoiadora",
    "toasts": {
      "success_title": "A sua adesão está ativa!",
      "success_body": "Obrigado por apoiar a Classic Mini DIY — as suas vantagens estão ativas onde quer que inicie sessão."
    }
  },
  "ru": {
    "meta": {
      "title": "Активируйте участие — Classic Mini DIY"
    },
    "eyebrow": "ПОСТОЯННЫЙ УЧАСТНИК",
    "checking": "Проверяем вашу ссылку активации…",
    "redeeming": {
      "title": "Активируем ваше участие…",
      "body": "Одну минуту — мы привязываем ваше постоянное участие к этому аккаунту."
    },
    "signin": {
      "title": "Войдите, чтобы активировать участие",
      "body": "Почти готово: войдите (или создайте бесплатный аккаунт), и мы привяжем к нему ваше постоянное участие. Сразу после этого вы вернётесь сюда.",
      "cta": "Войти и активировать"
    },
    "success": {
      "title": "Ваше участие активно!",
      "body": "Добро пожаловать, постоянный участник — ваши привилегии включены на всех ресурсах Classic Mini DIY.",
      "cta": "Посмотреть привилегии"
    },
    "missing_code": {
      "title": "В этой ссылке нет кода активации",
      "body": "Эта страница работает только по ссылке активации из письма об участии. Откройте письмо и нажмите кнопку ещё раз — или узнайте больше о постоянном участии ниже."
    },
    "already_claimed": {
      "title": "Это участие уже активировано",
      "body": "Эта ссылка уже использована на другом аккаунте. Если это не похоже на правду — возможно, вы вошли с другой почты — мы можем перенести участие за вас."
    },
    "expired": {
      "title": "Срок действия ссылки истёк",
      "body": "Ссылки активации действуют 30 дней. Ничего делать не нужно: новая ссылка уже автоматически идёт на вашу почту."
    },
    "invalid": {
      "title": "Не удалось найти этот код активации",
      "body": "Эта ссылка не соответствует ожидающему участию. Проверьте, что вы открыли самое свежее письмо — старые ссылки перестают работать, как только выпущена новая."
    },
    "error": {
      "title": "Что-то пошло не так",
      "body": "Сейчас не удалось связаться со службой участия. Ваша ссылка всё ещё действительна — попробуйте снова.",
      "retry": "Повторить"
    },
    "contact_question": "Что-то не так?",
    "contact_cta": "Свяжитесь с нами, и мы всё решим.",
    "membership_link": "О постоянном участии",
    "toasts": {
      "success_title": "Ваше участие активно!",
      "success_body": "Спасибо за поддержку Classic Mini DIY — ваши привилегии активны везде, где вы входите."
    }
  },
  "ja": {
    "meta": {
      "title": "メンバーシップを有効化 — Classic Mini DIY"
    },
    "eyebrow": "サステイニングメンバー",
    "checking": "有効化リンクを確認しています…",
    "redeeming": {
      "title": "メンバーシップを有効化しています…",
      "body": "少々お待ちください。サステイニングメンバーシップをこのアカウントに紐づけています。"
    },
    "signin": {
      "title": "サインインしてメンバーシップを有効化",
      "body": "あと少しです。サインイン (または無料アカウントを作成) していただければ、サステイニングメンバーシップを紐づけます。その後すぐにこのページへ戻ります。",
      "cta": "サインインして有効化"
    },
    "success": {
      "title": "メンバーシップが有効になりました!",
      "body": "ようこそ、サステイニングメンバー。特典はすべての Classic Mini DIY サイトで有効です。",
      "cta": "特典を見る"
    },
    "missing_code": {
      "title": "このリンクには有効化コードがありません",
      "body": "このページはメンバーシップのメールに記載された有効化リンクからのみ動作します。メールを開いてもう一度ボタンを押すか、下でサステイニングメンバーシップについてご確認ください。"
    },
    "already_claimed": {
      "title": "このメンバーシップは有効化済みです",
      "body": "この有効化リンクは別のアカウントですでに使用されています。心当たりがない場合 (別のメールアドレスでサインインした可能性など) は、こちらで移行いたします。"
    },
    "expired": {
      "title": "この有効化リンクは期限切れです",
      "body": "有効化リンクの有効期間は 30 日です。お手続きは不要です。新しいリンクが自動的に受信トレイへ届きます。"
    },
    "invalid": {
      "title": "その有効化コードは見つかりませんでした",
      "body": "この有効化リンクは保留中のメンバーシップと一致しません。最新のメールを開いたかご確認ください。新しいリンクが発行されると、古いリンクは使えなくなります。"
    },
    "error": {
      "title": "問題が発生しました",
      "body": "ただいまメンバーシップサービスに接続できませんでした。有効化リンクは引き続き有効です。もう一度お試しください。",
      "retry": "再試行"
    },
    "contact_question": "うまくいきませんか?",
    "contact_cta": "お問い合わせいただければ解決します。",
    "membership_link": "サステイニングメンバーシップについて",
    "toasts": {
      "success_title": "メンバーシップが有効になりました!",
      "success_body": "Classic Mini DIY へのご支援ありがとうございます。サインインするすべての場所で特典が有効です。"
    }
  },
  "zh": {
    "meta": {
      "title": "激活你的会员资格 — Classic Mini DIY"
    },
    "eyebrow": "持续支持会员",
    "checking": "正在检查你的激活链接…",
    "redeeming": {
      "title": "正在激活你的会员资格…",
      "body": "请稍候，我们正在把你的持续支持会员资格关联到此账号。"
    },
    "signin": {
      "title": "登录以激活你的会员资格",
      "body": "就快好了：登录(或创建一个免费账号)，我们会把你的持续支持会员资格关联上去。之后会立即回到这里。",
      "cta": "登录并激活"
    },
    "success": {
      "title": "你的会员资格已生效!",
      "body": "欢迎你,持续支持会员——你的权益已在所有 Classic Mini DIY 站点开启。",
      "cta": "查看你的权益"
    },
    "missing_code": {
      "title": "该链接缺少激活码",
      "body": "本页面只能通过会员邮件中的激活链接打开。请打开邮件并重新点击按钮,或在下方了解持续支持会员。"
    },
    "already_claimed": {
      "title": "该会员资格已被激活",
      "body": "此激活链接已在另一个账号上使用过。如果这不合常理——也许你用了另一个邮箱登录——我们可以帮你转移。"
    },
    "expired": {
      "title": "该激活链接已过期",
      "body": "激活链接有效期为 30 天。你无需操作:新的链接已自动发往你的收件箱。"
    },
    "invalid": {
      "title": "找不到该激活码",
      "body": "此激活链接与任何待处理的会员资格都不匹配。请确认你打开的是最新的邮件——一旦签发新链接,旧链接便会失效。"
    },
    "error": {
      "title": "出了点问题",
      "body": "我们暂时无法连接会员服务。你的激活链接仍然有效,请再试一次。",
      "retry": "重试"
    },
    "contact_question": "有什么不对劲?",
    "contact_cta": "联系我们,我们会帮你处理。",
    "membership_link": "关于持续支持会员",
    "toasts": {
      "success_title": "你的会员资格已生效!",
      "success_body": "感谢你支持 Classic Mini DIY——你登录的任何地方权益都已生效。"
    }
  },
  "ko": {
    "meta": {
      "title": "멤버십 활성화 — Classic Mini DIY"
    },
    "eyebrow": "서포팅 멤버",
    "checking": "활성화 링크를 확인하는 중…",
    "redeeming": {
      "title": "멤버십을 활성화하는 중…",
      "body": "잠시만 기다려 주세요. 서포팅 멤버십을 이 계정에 연결하고 있습니다."
    },
    "signin": {
      "title": "로그인하고 멤버십을 활성화하세요",
      "body": "거의 다 됐습니다. 로그인(또는 무료 계정 생성)하시면 서포팅 멤버십을 연결해 드립니다. 그 후 바로 이 페이지로 돌아옵니다.",
      "cta": "로그인하고 활성화"
    },
    "success": {
      "title": "멤버십이 활성화되었습니다!",
      "body": "환영합니다, 서포팅 멤버님. 모든 Classic Mini DIY 사이트에서 혜택이 켜졌습니다.",
      "cta": "혜택 보기"
    },
    "missing_code": {
      "title": "이 링크에 활성화 코드가 없습니다",
      "body": "이 페이지는 멤버십 이메일의 활성화 링크로만 작동합니다. 이메일을 열어 버튼을 다시 누르시거나, 아래에서 서포팅 멤버십에 대해 알아보세요."
    },
    "already_claimed": {
      "title": "이 멤버십은 이미 활성화되었습니다",
      "body": "이 활성화 링크는 다른 계정에서 이미 사용되었습니다. 이상하다고 느끼신다면(다른 이메일로 로그인하셨을 수 있습니다) 저희가 옮겨 드리겠습니다."
    },
    "expired": {
      "title": "이 활성화 링크는 만료되었습니다",
      "body": "활성화 링크는 30일 동안 유효합니다. 따로 하실 일은 없습니다. 새 링크가 자동으로 받은편지함으로 가는 중입니다."
    },
    "invalid": {
      "title": "해당 활성화 코드를 찾을 수 없습니다",
      "body": "이 활성화 링크는 대기 중인 멤버십과 일치하지 않습니다. 가장 최근 이메일을 여셨는지 확인해 주세요. 새 링크가 발급되면 이전 링크는 작동하지 않습니다."
    },
    "error": {
      "title": "문제가 발생했습니다",
      "body": "지금은 멤버십 서비스에 연결하지 못했습니다. 활성화 링크는 여전히 유효하니 다시 시도해 주세요.",
      "retry": "다시 시도"
    },
    "contact_question": "뭔가 잘못되었나요?",
    "contact_cta": "문의해 주시면 해결해 드리겠습니다.",
    "membership_link": "서포팅 멤버십 안내",
    "toasts": {
      "success_title": "멤버십이 활성화되었습니다!",
      "success_body": "Classic Mini DIY를 후원해 주셔서 감사합니다. 로그인하시는 모든 곳에서 혜택이 적용됩니다."
    }
  }
}
</i18n>
