<template>
  <div class="min-h-screen flex items-center justify-center bg-base-200 px-4 py-12">
    <div class="card bg-base-100 shadow-md border border-base-300 w-full max-w-md">
      <div class="card-body">
        <div class="text-center mb-4">
          <i class="fad fa-envelope-open-text text-4xl text-primary"></i>
          <h1 class="text-2xl font-bold mt-3">{{ t('heading') }}</h1>
          <p class="opacity-70 mt-2">{{ t('intro') }}</p>
        </div>

        <div v-if="state === 'sent'" role="status" class="alert alert-success">
          <i class="fas fa-circle-check"></i>
          <div>
            <p class="font-semibold">{{ t('sent_title') }}</p>
            <p class="text-sm">{{ t('sent_body') }}</p>
          </div>
        </div>

        <form v-else class="space-y-4" @submit.prevent="submit">
          <label class="form-control w-full">
            <div class="label">
              <span class="label-text">{{ t('email_label') }}</span>
            </div>
            <input
              v-model="email"
              type="email"
              autocomplete="email"
              :placeholder="t('email_placeholder')"
              class="input input-bordered w-full"
              :class="{ 'input-error': state === 'invalid' }"
              required
              :disabled="state === 'sending'"
            />
          </label>

          <div v-if="errorKey" role="alert" class="alert alert-error">
            <i class="fas fa-triangle-exclamation"></i>
            <span>{{ t(errorKey) }}</span>
          </div>

          <div class="flex justify-center">
            <NuxtTurnstile ref="turnstileRef" v-model="turnstileToken" :options="{ theme: 'auto' }" />
          </div>

          <button type="submit" class="btn btn-primary btn-block" :disabled="state === 'sending' || !turnstileToken">
            <i v-if="state === 'sending'" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fad fa-paper-plane"></i>
            {{ state === 'sending' ? t('sending') : t('subscribe') }}
          </button>

          <p class="text-xs opacity-60 text-center">
            {{ t('consent_note') }}
            <NuxtLink to="/privacy" class="link">{{ t('privacy_link') }}</NuxtLink>
          </p>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  // Newsletter signup (Ghost retirement Phase 2). POST /api/newsletter/subscribe
  // verifies Turnstile and sends a double opt-in email; nobody is subscribed until
  // they press the link (/email/confirm). The server answers the same for every
  // list state, so this page only ever says "check your inbox".
  const { t } = useI18n();

  useHead({
    title: t('page_title'),
    meta: [{ name: 'description', content: t('page_description') }],
    link: [{ rel: 'canonical', href: 'https://www.classicminidiy.com/newsletter' }],
  });
  useSeoMeta({
    ogTitle: t('page_title'),
    ogDescription: t('page_description'),
    ogUrl: 'https://www.classicminidiy.com/newsletter',
    ogType: 'website',
  });

  type State = 'idle' | 'sending' | 'sent' | 'invalid' | 'error';
  const email = ref('');
  const turnstileToken = ref('');
  const turnstileRef = ref<{ reset: () => void } | null>(null);
  const state = ref<State>('idle');
  const errorKey = ref<string | null>(null);

  async function submit() {
    if (!turnstileToken.value) return;
    state.value = 'sending';
    errorKey.value = null;
    try {
      await $fetch('/api/newsletter/subscribe', {
        method: 'POST',
        body: { email: email.value, turnstileToken: turnstileToken.value },
      });
      state.value = 'sent';
    } catch (error: any) {
      const message = error?.statusMessage || error?.data?.statusMessage;
      if (message === 'invalid_email') {
        state.value = 'invalid';
        errorKey.value = 'error_invalid';
      } else if (error?.statusCode === 429) {
        state.value = 'error';
        errorKey.value = 'error_rate';
      } else {
        state.value = 'error';
        errorKey.value = 'error_generic';
      }
    } finally {
      // A Turnstile token is single-use.
      turnstileToken.value = '';
      turnstileRef.value?.reset();
    }
  }
</script>

<i18n lang="json">
{
  "en": {
    "page_title": "Newsletter — Classic Mini DIY",
    "page_description": "Get the Classic Mini DIY newsletter: new videos, technical articles and workshop updates for Classic Mini owners.",
    "heading": "Get the newsletter",
    "intro": "New videos, technical articles and the odd workshop update. A few emails a month at most.",
    "email_label": "Email address",
    "email_placeholder": "you{'@'}example.com",
    "subscribe": "Subscribe",
    "sending": "Sending…",
    "sent_title": "Check your inbox",
    "sent_body": "If this address can receive the newsletter, we have sent a confirmation link. Press it to finish. It works for 7 days.",
    "error_invalid": "That email address does not look right. Please check it.",
    "error_rate": "Too many tries. Please wait a minute and try again.",
    "error_generic": "Something went wrong. Please try again in a moment.",
    "consent_note": "We email you only to confirm and then the newsletter. Every email has a one-click unsubscribe.",
    "privacy_link": "Privacy policy"
  },
  "es": {
    "page_title": "Boletín — Classic Mini DIY",
    "page_description": "Recibe el boletín de Classic Mini DIY: nuevos vídeos, artículos técnicos y novedades del taller para propietarios de Classic Mini.",
    "heading": "Recibe el boletín",
    "intro": "Nuevos vídeos, artículos técnicos y alguna novedad del taller. Pocos correos al mes como máximo.",
    "email_label": "Correo electrónico",
    "email_placeholder": "tu{'@'}ejemplo.com",
    "subscribe": "Suscribirse",
    "sending": "Enviando…",
    "sent_title": "Revisa tu bandeja de entrada",
    "sent_body": "Si esta dirección puede recibir el boletín, te hemos enviado un enlace de confirmación. Púlsalo para terminar. Funciona durante 7 días.",
    "error_invalid": "Esa dirección de correo no parece correcta. Revísala.",
    "error_rate": "Demasiados intentos. Espera un minuto y vuelve a intentarlo.",
    "error_generic": "Algo salió mal. Inténtalo de nuevo en un momento.",
    "consent_note": "Solo te escribimos para confirmar y después para el boletín. Cada correo tiene un enlace para darte de baja con un clic.",
    "privacy_link": "Política de privacidad"
  },
  "fr": {
    "page_title": "Newsletter — Classic Mini DIY",
    "page_description": "Recevez la newsletter Classic Mini DIY : nouvelles vidéos, articles techniques et nouvelles de l'atelier pour les propriétaires de Classic Mini.",
    "heading": "Recevoir la newsletter",
    "intro": "Nouvelles vidéos, articles techniques et nouvelles de l'atelier. Quelques e-mails par mois au maximum.",
    "email_label": "Adresse e-mail",
    "email_placeholder": "vous{'@'}exemple.com",
    "subscribe": "S'abonner",
    "sending": "Envoi…",
    "sent_title": "Vérifiez votre boîte de réception",
    "sent_body": "Si cette adresse peut recevoir la newsletter, nous avons envoyé un lien de confirmation. Cliquez dessus pour terminer. Il est valable 7 jours.",
    "error_invalid": "Cette adresse e-mail semble incorrecte. Vérifiez-la.",
    "error_rate": "Trop de tentatives. Attendez une minute et réessayez.",
    "error_generic": "Une erreur s'est produite. Réessayez dans un instant.",
    "consent_note": "Nous vous écrivons uniquement pour confirmer, puis pour la newsletter. Chaque e-mail contient un lien de désabonnement en un clic.",
    "privacy_link": "Politique de confidentialité"
  },
  "it": {
    "page_title": "Newsletter — Classic Mini DIY",
    "page_description": "Ricevi la newsletter di Classic Mini DIY: nuovi video, articoli tecnici e novità dall'officina per i proprietari di Classic Mini.",
    "heading": "Ricevi la newsletter",
    "intro": "Nuovi video, articoli tecnici e qualche novità dall'officina. Al massimo poche email al mese.",
    "email_label": "Indirizzo email",
    "email_placeholder": "tu{'@'}esempio.com",
    "subscribe": "Iscriviti",
    "sending": "Invio…",
    "sent_title": "Controlla la tua casella",
    "sent_body": "Se questo indirizzo può ricevere la newsletter, ti abbiamo inviato un link di conferma. Premilo per completare. Vale 7 giorni.",
    "error_invalid": "Questo indirizzo email non sembra corretto. Controllalo.",
    "error_rate": "Troppi tentativi. Attendi un minuto e riprova.",
    "error_generic": "Qualcosa è andato storto. Riprova tra un momento.",
    "consent_note": "Ti scriviamo solo per la conferma e poi per la newsletter. Ogni email ha un link per annullare l'iscrizione con un clic.",
    "privacy_link": "Informativa sulla privacy"
  },
  "de": {
    "page_title": "Newsletter — Classic Mini DIY",
    "page_description": "Erhalte den Classic Mini DIY Newsletter: neue Videos, technische Artikel und Neues aus der Werkstatt für Classic-Mini-Besitzer.",
    "heading": "Newsletter abonnieren",
    "intro": "Neue Videos, technische Artikel und gelegentlich Neues aus der Werkstatt. Höchstens ein paar E-Mails im Monat.",
    "email_label": "E-Mail-Adresse",
    "email_placeholder": "du{'@'}beispiel.de",
    "subscribe": "Abonnieren",
    "sending": "Wird gesendet…",
    "sent_title": "Sieh in dein Postfach",
    "sent_body": "Wenn diese Adresse den Newsletter empfangen kann, haben wir einen Bestätigungslink geschickt. Klicke ihn an, um abzuschließen. Er gilt 7 Tage.",
    "error_invalid": "Diese E-Mail-Adresse sieht nicht richtig aus. Bitte prüfe sie.",
    "error_rate": "Zu viele Versuche. Bitte warte eine Minute und versuche es erneut.",
    "error_generic": "Etwas ist schiefgelaufen. Bitte versuche es gleich noch einmal.",
    "consent_note": "Wir schreiben dir nur zur Bestätigung und danach den Newsletter. Jede E-Mail hat einen Abmeldelink mit einem Klick.",
    "privacy_link": "Datenschutzerklärung"
  },
  "pt": {
    "page_title": "Newsletter — Classic Mini DIY",
    "page_description": "Receba a newsletter do Classic Mini DIY: novos vídeos, artigos técnicos e novidades da oficina para donos de Classic Mini.",
    "heading": "Receba a newsletter",
    "intro": "Novos vídeos, artigos técnicos e algumas novidades da oficina. No máximo alguns e-mails por mês.",
    "email_label": "Endereço de e-mail",
    "email_placeholder": "voce{'@'}exemplo.com",
    "subscribe": "Inscrever-se",
    "sending": "Enviando…",
    "sent_title": "Verifique sua caixa de entrada",
    "sent_body": "Se este endereço puder receber a newsletter, enviamos um link de confirmação. Clique nele para concluir. Ele vale por 7 dias.",
    "error_invalid": "Esse endereço de e-mail não parece correto. Verifique-o.",
    "error_rate": "Tentativas demais. Aguarde um minuto e tente novamente.",
    "error_generic": "Algo deu errado. Tente novamente em instantes.",
    "consent_note": "Só escrevemos para confirmar e depois para a newsletter. Todo e-mail tem um link para cancelar com um clique.",
    "privacy_link": "Política de privacidade"
  },
  "ru": {
    "page_title": "Рассылка — Classic Mini DIY",
    "page_description": "Подпишитесь на рассылку Classic Mini DIY: новые видео, технические статьи и новости мастерской для владельцев Classic Mini.",
    "heading": "Подписаться на рассылку",
    "intro": "Новые видео, технические статьи и иногда новости из мастерской. Не больше нескольких писем в месяц.",
    "email_label": "Адрес электронной почты",
    "email_placeholder": "vy{'@'}example.com",
    "subscribe": "Подписаться",
    "sending": "Отправка…",
    "sent_title": "Проверьте почту",
    "sent_body": "Если этот адрес может получать рассылку, мы отправили ссылку для подтверждения. Нажмите её, чтобы завершить. Она действует 7 дней.",
    "error_invalid": "Этот адрес выглядит неправильно. Проверьте его.",
    "error_rate": "Слишком много попыток. Подождите минуту и попробуйте снова.",
    "error_generic": "Что-то пошло не так. Попробуйте ещё раз чуть позже.",
    "consent_note": "Мы пишем только для подтверждения, а затем присылаем рассылку. В каждом письме есть ссылка для отписки в один клик.",
    "privacy_link": "Политика конфиденциальности"
  },
  "ja": {
    "page_title": "ニュースレター — Classic Mini DIY",
    "page_description": "Classic Mini DIY のニュースレター：Classic Mini オーナー向けの新しい動画、技術記事、ワークショップの近況をお届けします。",
    "heading": "ニュースレターを受け取る",
    "intro": "新しい動画、技術記事、ときどきワークショップの近況。多くても月に数通です。",
    "email_label": "メールアドレス",
    "email_placeholder": "you{'@'}example.com",
    "subscribe": "登録する",
    "sending": "送信中…",
    "sent_title": "受信トレイを確認してください",
    "sent_body": "このアドレスでニュースレターを受け取れる場合、確認リンクを送信しました。リンクを押すと完了します。有効期限は 7 日間です。",
    "error_invalid": "メールアドレスが正しくないようです。確認してください。",
    "error_rate": "試行回数が多すぎます。1 分待ってからもう一度お試しください。",
    "error_generic": "問題が発生しました。しばらくしてからもう一度お試しください。",
    "consent_note": "確認のメールとニュースレター以外は送りません。すべてのメールにワンクリックの配信停止リンクがあります。",
    "privacy_link": "プライバシーポリシー"
  },
  "zh": {
    "page_title": "电子报 — Classic Mini DIY",
    "page_description": "订阅 Classic Mini DIY 电子报：为 Classic Mini 车主提供新视频、技术文章和车间动态。",
    "heading": "订阅电子报",
    "intro": "新视频、技术文章和偶尔的车间动态。每月最多几封邮件。",
    "email_label": "电子邮箱地址",
    "email_placeholder": "you{'@'}example.com",
    "subscribe": "订阅",
    "sending": "正在发送…",
    "sent_title": "请查看收件箱",
    "sent_body": "如果此地址可以接收电子报，我们已发送确认链接。点击即可完成订阅。链接 7 天内有效。",
    "error_invalid": "该邮箱地址似乎不正确，请检查。",
    "error_rate": "尝试次数过多。请等待一分钟后再试。",
    "error_generic": "出现问题，请稍后再试。",
    "consent_note": "我们只会发送确认邮件和电子报。每封邮件都有一键退订链接。",
    "privacy_link": "隐私政策"
  },
  "ko": {
    "page_title": "뉴스레터 — Classic Mini DIY",
    "page_description": "Classic Mini DIY 뉴스레터를 받아보세요: Classic Mini 오너를 위한 새 영상, 기술 기사, 작업장 소식.",
    "heading": "뉴스레터 받기",
    "intro": "새 영상, 기술 기사, 가끔 작업장 소식. 많아야 한 달에 몇 통입니다.",
    "email_label": "이메일 주소",
    "email_placeholder": "you{'@'}example.com",
    "subscribe": "구독하기",
    "sending": "보내는 중…",
    "sent_title": "받은편지함을 확인하세요",
    "sent_body": "이 주소로 뉴스레터를 받을 수 있다면 확인 링크를 보냈습니다. 링크를 누르면 완료됩니다. 7일 동안 유효합니다.",
    "error_invalid": "이메일 주소가 올바르지 않은 것 같습니다. 확인해 주세요.",
    "error_rate": "시도 횟수가 너무 많습니다. 1분 후 다시 시도해 주세요.",
    "error_generic": "문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    "consent_note": "확인 메일과 뉴스레터만 보냅니다. 모든 메일에 원클릭 구독 취소 링크가 있습니다.",
    "privacy_link": "개인정보 처리방침"
  }
}
</i18n>
