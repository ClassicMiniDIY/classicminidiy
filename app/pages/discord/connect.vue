<script lang="ts" setup>
  const { t } = useI18n();
  const supabase = useSupabase();
  const { track } = useAnalytics();
  const { isAuthenticated, waitForAuth } = useAuth();

  // Self-serve Discord claim for signed-in Sustaining Members (keystone §5.3).
  // The mobile apps' "Claim Discord Access" buttons (and any bookmark) open
  // /discord/claim with no token; the server proxy routes those bare hits here.
  // We mint a fresh claim token via /api/discord/reissue (discord-claim-reissue
  // Edge Function — paid members only), then re-enter the normal tokened chain:
  // /discord/claim?token= → discord-claim → Discord OAuth → role granted.
  //
  // App users arrive in the system browser with NO web session even though
  // they're signed in to the app, so the signin card is the common first stop —
  // the copy points them at using the same account as the app.

  type ConnectState =
    | 'checking' // resolving auth
    | 'signin' // logged out — needs the login round trip first
    | 'connecting' // reissue in flight / redirecting into Discord OAuth
    | 'active' // already linked — nothing to claim
    | 'not_member' // signed in but no active Sustaining Membership
    | 'error'; // transient proxy/network failure — retryable
  const state = ref<ConnectState>('checking');
  const discordUrl = ref<string | null>(null);

  const loginWithIntentHref = `/login?redirect=${encodeURIComponent('/discord/connect')}`;

  async function getAccessToken(): Promise<string | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function connect() {
    state.value = 'connecting';
    try {
      const token = await getAccessToken();
      if (!token) {
        // Session evaporated between the auth check and the claim — send them
        // back through sign-in with the connect intent preserved.
        await navigateTo(loginWithIntentHref);
        return;
      }
      const res = await $fetch<{ status?: string; claim_url?: string; discord_url?: string }>('/api/discord/reissue', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
      if (res?.status === 'active') {
        discordUrl.value = res.discord_url ?? null;
        state.value = 'active';
        track('discord_claim_reissued', { source: 'web', result: 'already_active' });
        return;
      }
      if (res?.status === 'pending' && res.claim_url) {
        track('discord_claim_reissued', { source: 'web', result: 'pending' });
        // Full document navigation into the OAuth chain — same external
        // redirect convention as the Stripe checkout hand-off.
        await navigateTo(res.claim_url, { external: true });
        return;
      }
      throw new Error('Unexpected reissue response shape');
    } catch (err: any) {
      const status = err?.statusCode ?? err?.status ?? err?.response?.status;
      if (status === 403) {
        state.value = 'not_member';
        track('discord_claim_reissue_failed', { source: 'web', reason: 'not_member' });
        return;
      }
      if (status === 401) {
        // The local session looked valid but the server rejected the token
        // (deleted user, auth incident). Clear it first — otherwise /login
        // sees isAuthenticated, bounces straight back here, and we loop.
        await supabase.auth.signOut().catch(() => {});
        await navigateTo(loginWithIntentHref);
        return;
      }
      console.error('Discord claim reissue failed:', err);
      state.value = 'error';
      track('discord_claim_reissue_failed', { source: 'web', reason: 'exception' });
    }
  }

  onMounted(async () => {
    await waitForAuth();
    if (!isAuthenticated.value) {
      state.value = 'signin';
      return;
    }
    await connect();
  });

  // Transient claim-chain page — never index it.
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

          <!-- Reissue in flight / redirecting to Discord -->
          <template v-else-if="state === 'connecting'">
            <span class="loading loading-spinner loading-lg text-primary mt-4"></span>
            <h1 class="text-2xl font-bold mt-3">{{ t('connecting.title') }}</h1>
            <p class="opacity-70">{{ t('connecting.body') }}</p>
          </template>

          <!-- Logged out: connect intent rides the existing /login?redirect= flow.
               App users land here without a web session — same account as the app. -->
          <template v-else-if="state === 'signin'">
            <i class="fas fa-right-to-bracket text-4xl text-primary mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('signin.title') }}</h1>
            <p class="opacity-70">{{ t('signin.body') }}</p>
            <NuxtLink :to="loginWithIntentHref" class="btn btn-primary mt-4">
              <i class="fas fa-right-to-bracket"></i>
              {{ t('signin.cta') }}
            </NuxtLink>
          </template>

          <!-- Already linked -->
          <template v-else-if="state === 'active'">
            <i class="fas fa-circle-check text-4xl text-success mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('active.title') }}</h1>
            <p class="opacity-70">{{ t('active.body') }}</p>
            <a v-if="discordUrl" :href="discordUrl" class="btn btn-primary mt-4">
              <i class="fab fa-discord"></i>
              {{ t('active.cta') }}
            </a>
          </template>

          <!-- Signed in but not a paid Sustaining Member -->
          <template v-else-if="state === 'not_member'">
            <i class="fas fa-star text-4xl text-warning mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('not_member.title') }}</h1>
            <p class="opacity-70">{{ t('not_member.body') }}</p>
            <NuxtLink to="/membership" class="btn btn-primary mt-4">
              <i class="fas fa-star"></i>
              {{ t('not_member.cta') }}
            </NuxtLink>
          </template>

          <!-- Transient failure -->
          <template v-else>
            <i class="fas fa-triangle-exclamation text-4xl text-error mt-2"></i>
            <h1 class="text-2xl font-bold mt-3">{{ t('error.title') }}</h1>
            <p class="opacity-70">{{ t('error.body') }}</p>
            <button type="button" class="btn btn-primary mt-4" @click="connect">
              <i class="fas fa-rotate-right"></i>
              {{ t('error.retry') }}
            </button>
          </template>

          <!-- Contact fallback on dead-end states -->
          <p v-if="state === 'not_member' || state === 'error'" class="text-sm opacity-70 mt-4">
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
      "title": "Connect your Discord — Classic Mini DIY"
    },
    "eyebrow": "Members-only Discord",
    "checking": "Checking your membership…",
    "connecting": {
      "title": "Connecting your Discord",
      "body": "Hang tight — we're sending you to Discord to authorize your members-only access."
    },
    "signin": {
      "title": "Sign in to claim your access",
      "body": "Sign in with the same Classic Mini DIY account you use in the Toolbox app, and we'll connect your Discord right after.",
      "cta": "Sign in"
    },
    "active": {
      "title": "You're already connected",
      "body": "Your Discord is linked and your members-only role is active. See you in there!",
      "cta": "Open Discord"
    },
    "not_member": {
      "title": "Membership required",
      "body": "The members-only Discord is a Sustaining Member benefit. Check your membership status or become a member to join.",
      "cta": "View membership"
    },
    "error": {
      "title": "Something went wrong",
      "body": "We couldn't start your Discord claim. Give it another try in a moment.",
      "retry": "Try again"
    },
    "contact_question": "Still stuck?",
    "contact_cta": "Contact us"
  },
  "es": {
    "meta": {
      "title": "Conecta tu Discord — Classic Mini DIY"
    },
    "eyebrow": "Discord exclusivo para socios",
    "checking": "Comprobando tu membresía…",
    "connecting": {
      "title": "Conectando tu Discord",
      "body": "Un momento: te estamos enviando a Discord para autorizar tu acceso exclusivo de socio."
    },
    "signin": {
      "title": "Inicia sesión para reclamar tu acceso",
      "body": "Inicia sesión con la misma cuenta de Classic Mini DIY que usas en la app Toolbox y conectaremos tu Discord justo después.",
      "cta": "Iniciar sesión"
    },
    "active": {
      "title": "Ya estás conectado",
      "body": "Tu Discord está vinculado y tu rol de socio está activo. ¡Nos vemos dentro!",
      "cta": "Abrir Discord"
    },
    "not_member": {
      "title": "Se requiere membresía",
      "body": "El Discord exclusivo es una ventaja para Socios Colaboradores. Consulta el estado de tu membresía o hazte socio para entrar.",
      "cta": "Ver membresía"
    },
    "error": {
      "title": "Algo ha salido mal",
      "body": "No hemos podido iniciar tu solicitud de Discord. Vuelve a intentarlo en un momento.",
      "retry": "Reintentar"
    },
    "contact_question": "¿Sigues atascado?",
    "contact_cta": "Contáctanos"
  },
  "fr": {
    "meta": {
      "title": "Connectez votre Discord — Classic Mini DIY"
    },
    "eyebrow": "Discord réservé aux membres",
    "checking": "Vérification de votre adhésion…",
    "connecting": {
      "title": "Connexion de votre Discord",
      "body": "Un instant : nous vous redirigeons vers Discord pour autoriser votre accès réservé aux membres."
    },
    "signin": {
      "title": "Connectez-vous pour obtenir votre accès",
      "body": "Connectez-vous avec le même compte Classic Mini DIY que vous utilisez dans l'application Toolbox, et nous connecterons votre Discord juste après.",
      "cta": "Se connecter"
    },
    "active": {
      "title": "Vous êtes déjà connecté",
      "body": "Votre Discord est lié et votre rôle de membre est actif. À tout de suite !",
      "cta": "Ouvrir Discord"
    },
    "not_member": {
      "title": "Adhésion requise",
      "body": "Le Discord réservé aux membres est un avantage Membre de soutien. Vérifiez le statut de votre adhésion ou devenez membre pour nous rejoindre.",
      "cta": "Voir l'adhésion"
    },
    "error": {
      "title": "Une erreur est survenue",
      "body": "Nous n'avons pas pu lancer votre demande Discord. Réessayez dans un instant.",
      "retry": "Réessayer"
    },
    "contact_question": "Toujours bloqué ?",
    "contact_cta": "Contactez-nous"
  },
  "de": {
    "meta": {
      "title": "Discord verbinden — Classic Mini DIY"
    },
    "eyebrow": "Discord nur für Mitglieder",
    "checking": "Mitgliedschaft wird geprüft…",
    "connecting": {
      "title": "Discord wird verbunden",
      "body": "Einen Moment – wir leiten dich zu Discord weiter, um deinen Mitgliederzugang zu autorisieren."
    },
    "signin": {
      "title": "Melde dich an, um deinen Zugang zu erhalten",
      "body": "Melde dich mit demselben Classic-Mini-DIY-Konto an, das du in der Toolbox-App nutzt, und wir verbinden gleich danach dein Discord.",
      "cta": "Anmelden"
    },
    "active": {
      "title": "Du bist bereits verbunden",
      "body": "Dein Discord ist verknüpft und deine Mitgliederrolle ist aktiv. Bis gleich!",
      "cta": "Discord öffnen"
    },
    "not_member": {
      "title": "Mitgliedschaft erforderlich",
      "body": "Der Discord nur für Mitglieder ist ein Vorteil für Fördermitglieder. Prüfe deinen Mitgliedsstatus oder werde Mitglied, um beizutreten.",
      "cta": "Mitgliedschaft ansehen"
    },
    "error": {
      "title": "Etwas ist schiefgelaufen",
      "body": "Wir konnten deine Discord-Anfrage nicht starten. Versuche es gleich noch einmal.",
      "retry": "Erneut versuchen"
    },
    "contact_question": "Kommst du nicht weiter?",
    "contact_cta": "Kontaktiere uns"
  },
  "it": {
    "meta": {
      "title": "Collega il tuo Discord — Classic Mini DIY"
    },
    "eyebrow": "Discord riservato ai soci",
    "checking": "Verifica dell'iscrizione in corso…",
    "connecting": {
      "title": "Collegamento del tuo Discord",
      "body": "Un attimo: ti stiamo inviando a Discord per autorizzare il tuo accesso riservato ai soci."
    },
    "signin": {
      "title": "Accedi per ottenere il tuo accesso",
      "body": "Accedi con lo stesso account Classic Mini DIY che usi nell'app Toolbox e collegheremo il tuo Discord subito dopo.",
      "cta": "Accedi"
    },
    "active": {
      "title": "Sei già collegato",
      "body": "Il tuo Discord è collegato e il tuo ruolo da socio è attivo. Ci vediamo dentro!",
      "cta": "Apri Discord"
    },
    "not_member": {
      "title": "Iscrizione necessaria",
      "body": "Il Discord riservato ai soci è un vantaggio per i Soci Sostenitori. Controlla lo stato della tua iscrizione o diventa socio per entrare.",
      "cta": "Vedi l'iscrizione"
    },
    "error": {
      "title": "Qualcosa è andato storto",
      "body": "Non siamo riusciti ad avviare la tua richiesta Discord. Riprova tra un momento.",
      "retry": "Riprova"
    },
    "contact_question": "Ancora bloccato?",
    "contact_cta": "Contattaci"
  },
  "pt": {
    "meta": {
      "title": "Conecte o seu Discord — Classic Mini DIY"
    },
    "eyebrow": "Discord exclusivo para membros",
    "checking": "A verificar a sua adesão…",
    "connecting": {
      "title": "A ligar o seu Discord",
      "body": "Um momento — estamos a enviá-lo para o Discord para autorizar o seu acesso exclusivo de membro."
    },
    "signin": {
      "title": "Inicie sessão para obter o seu acesso",
      "body": "Inicie sessão com a mesma conta Classic Mini DIY que usa na app Toolbox e ligamos o seu Discord logo a seguir.",
      "cta": "Iniciar sessão"
    },
    "active": {
      "title": "Já está ligado",
      "body": "O seu Discord está associado e a sua função de membro está ativa. Até já!",
      "cta": "Abrir o Discord"
    },
    "not_member": {
      "title": "Adesão necessária",
      "body": "O Discord exclusivo para membros é uma vantagem de Membro Apoiador. Verifique o estado da sua adesão ou torne-se membro para entrar.",
      "cta": "Ver adesão"
    },
    "error": {
      "title": "Algo correu mal",
      "body": "Não conseguimos iniciar o seu pedido de Discord. Tente novamente daqui a pouco.",
      "retry": "Tentar novamente"
    },
    "contact_question": "Continua sem conseguir?",
    "contact_cta": "Fale connosco"
  },
  "ru": {
    "meta": {
      "title": "Подключите Discord — Classic Mini DIY"
    },
    "eyebrow": "Discord только для участников",
    "checking": "Проверяем ваше участие…",
    "connecting": {
      "title": "Подключаем ваш Discord",
      "body": "Одну минуту — мы перенаправляем вас в Discord, чтобы подтвердить доступ для участников."
    },
    "signin": {
      "title": "Войдите, чтобы получить доступ",
      "body": "Войдите в тот же аккаунт Classic Mini DIY, который вы используете в приложении Toolbox, и сразу после этого мы подключим ваш Discord.",
      "cta": "Войти"
    },
    "active": {
      "title": "Вы уже подключены",
      "body": "Ваш Discord привязан, роль участника активна. До встречи внутри!",
      "cta": "Открыть Discord"
    },
    "not_member": {
      "title": "Требуется участие",
      "body": "Discord только для участников — это привилегия постоянных участников. Проверьте статус участия или станьте участником, чтобы присоединиться.",
      "cta": "Посмотреть участие"
    },
    "error": {
      "title": "Что-то пошло не так",
      "body": "Не удалось начать подключение Discord. Повторите попытку через минуту.",
      "retry": "Повторить"
    },
    "contact_question": "Всё ещё не получается?",
    "contact_cta": "Свяжитесь с нами"
  },
  "ja": {
    "meta": {
      "title": "Discord を連携 — Classic Mini DIY"
    },
    "eyebrow": "メンバー限定 Discord",
    "checking": "メンバーシップを確認しています…",
    "connecting": {
      "title": "Discord を連携しています",
      "body": "少々お待ちください。メンバー限定アクセスを承認するため Discord に移動します。"
    },
    "signin": {
      "title": "サインインしてアクセスを受け取る",
      "body": "Toolbox アプリで使用しているものと同じ Classic Mini DIY アカウントでサインインしてください。その直後に Discord を連携します。",
      "cta": "サインイン"
    },
    "active": {
      "title": "すでに連携済みです",
      "body": "Discord が連携され、メンバー限定ロールが有効になっています。それではまた中で!",
      "cta": "Discord を開く"
    },
    "not_member": {
      "title": "メンバーシップが必要です",
      "body": "メンバー限定 Discord はサステイニングメンバーの特典です。メンバーシップの状態を確認するか、メンバーになってご参加ください。",
      "cta": "メンバーシップを見る"
    },
    "error": {
      "title": "問題が発生しました",
      "body": "Discord の連携を開始できませんでした。しばらくしてからもう一度お試しください。",
      "retry": "再試行"
    },
    "contact_question": "解決しませんか?",
    "contact_cta": "お問い合わせ"
  },
  "zh": {
    "meta": {
      "title": "连接你的 Discord — Classic Mini DIY"
    },
    "eyebrow": "会员专属 Discord",
    "checking": "正在检查你的会员资格…",
    "connecting": {
      "title": "正在连接你的 Discord",
      "body": "请稍候，我们正将你转到 Discord 以授权你的会员专属访问权限。"
    },
    "signin": {
      "title": "登录以领取访问权限",
      "body": "请使用你在 Toolbox 应用中使用的同一个 Classic Mini DIY 账号登录，随后我们会立即连接你的 Discord。",
      "cta": "登录"
    },
    "active": {
      "title": "你已经连接好了",
      "body": "你的 Discord 已关联，会员专属身份组已生效。里面见!",
      "cta": "打开 Discord"
    },
    "not_member": {
      "title": "需要会员资格",
      "body": "会员专属 Discord 是持续支持会员的权益。查看你的会员状态，或成为会员后加入。",
      "cta": "查看会员资格"
    },
    "error": {
      "title": "出了点问题",
      "body": "我们无法开始你的 Discord 领取流程。请稍后再试一次。",
      "retry": "重试"
    },
    "contact_question": "还是不行?",
    "contact_cta": "联系我们"
  },
  "ko": {
    "meta": {
      "title": "Discord 연결 — Classic Mini DIY"
    },
    "eyebrow": "멤버 전용 Discord",
    "checking": "멤버십을 확인하는 중…",
    "connecting": {
      "title": "Discord를 연결하는 중",
      "body": "잠시만 기다려 주세요. 멤버 전용 접근 권한을 승인하기 위해 Discord로 이동합니다."
    },
    "signin": {
      "title": "로그인하고 접근 권한 받기",
      "body": "Toolbox 앱에서 사용하는 것과 같은 Classic Mini DIY 계정으로 로그인하시면 바로 이어서 Discord를 연결해 드립니다.",
      "cta": "로그인"
    },
    "active": {
      "title": "이미 연결되어 있습니다",
      "body": "Discord가 연결되었고 멤버 전용 역할이 활성화되었습니다. 안에서 뵙겠습니다!",
      "cta": "Discord 열기"
    },
    "not_member": {
      "title": "멤버십이 필요합니다",
      "body": "멤버 전용 Discord는 서포팅 멤버 혜택입니다. 멤버십 상태를 확인하거나 멤버가 되어 참여하세요.",
      "cta": "멤버십 보기"
    },
    "error": {
      "title": "문제가 발생했습니다",
      "body": "Discord 연결을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      "retry": "다시 시도"
    },
    "contact_question": "여전히 해결되지 않나요?",
    "contact_cta": "문의하기"
  }
}
</i18n>
