<template>
  <div class="min-h-screen flex items-center justify-center bg-muted">
    <UCard class="w-full max-w-md">
      <div class="text-center mb-6">
        <h1 class="text-3xl font-bold">{{ t('title') }}</h1>
        <p class="opacity-70 mt-2">{{ t('subtitle') }}</p>
      </div>

      <!-- Magic link sent success state -->
      <div v-if="magicLinkSent" class="text-center space-y-4">
        <div class="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
          <i class="fad fa-envelope-circle-check text-3xl text-success"></i>
        </div>
        <h2 class="text-xl font-semibold">{{ t('magic_link_sent') }}</h2>
        <p class="opacity-70">{{ t('magic_link_description') }}</p>
        <UButton @click="resetForm" variant="ghost" size="sm">
          {{ t('try_different_email') }}
        </UButton>
      </div>

      <!-- OAuth + Email form -->
      <div v-else class="space-y-4">
        <!-- OAuth buttons -->
        <div class="space-y-3">
          <UButton class="w-full" color="neutral" variant="outline" :disabled="isLoading" @click="handleGoogleLogin">
            <template #leading>
              <i class="fab fa-google"></i>
            </template>
            {{ t('sign_in_google') }}
          </UButton>

          <UButton class="w-full" color="neutral" variant="outline" :disabled="isLoading" @click="handleAppleLogin">
            <template #leading>
              <i class="fab fa-apple"></i>
            </template>
            {{ t('sign_in_apple') }}
          </UButton>
        </div>

        <USeparator :label="t('or_divider')" class="my-4" />

        <!-- Email magic link form -->
        <form @submit.prevent="handleLogin" class="space-y-4">
          <UFormField :label="t('email_label')">
            <UInput
              v-model="email"
              type="email"
              :placeholder="t('email_placeholder')"
              class="w-full"
              :color="hasError ? 'error' : undefined"
              required
              :disabled="isLoading"
            />
          </UFormField>

          <UAlert v-if="errorMessage" color="error" icon="i-fa6-solid-triangle-exclamation" :title="errorMessage" />

          <div class="mt-6">
            <UButton type="submit" color="primary" class="w-full" :disabled="isLoading" :loading="isLoading">
              <template #leading>
                <i v-if="!isLoading" class="fad fa-paper-plane"></i>
              </template>
              {{ isLoading ? t('sending') : t('send_magic_link') }}
            </UButton>
          </div>
        </form>
      </div>

      <USeparator class="my-4" />

      <div class="text-center">
        <UButton to="/" variant="ghost" size="sm">
          <i class="fad fa-arrow-left mr-2"></i>
          {{ t('back_to_site') }}
        </UButton>
      </div>

      <div class="text-center mt-2 p-3 bg-base-200 rounded-lg">
        <p class="text-xs opacity-70">
          <i class="fad fa-link mr-1"></i>
          {{ t('unified_account_note') }}
        </p>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  // SEO and meta
  useHead({
    title: t('page_title'),
    meta: [
      {
        name: 'description',
        content: t('page_description'),
      },
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  });

  const { signInWithEmail, signInWithGoogle, signInWithApple, isAuthenticated } = useAuth();

  // Reactive state
  const email = ref('');
  const isLoading = ref(false);
  const errorMessage = ref('');
  const magicLinkSent = ref(false);
  const hasError = computed(() => !!errorMessage.value);

  // Redirect if already authenticated
  onMounted(async () => {
    const { initAuth } = useAuth();
    await initAuth();
    if (isAuthenticated.value) {
      navigateTo('/admin', { replace: true });
    }
  });

  // Login handler
  const handleLogin = async () => {
    if (!email.value) {
      errorMessage.value = t('validation_error');
      return;
    }

    isLoading.value = true;
    errorMessage.value = '';

    try {
      await signInWithEmail(email.value);
      magicLinkSent.value = true;
    } catch (error: any) {
      console.error('Login error:', error);
      errorMessage.value = error.message || t('login_error');
    } finally {
      isLoading.value = false;
    }
  };

  // Google OAuth handler
  const handleGoogleLogin = async () => {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error('Google login error:', error);
      errorMessage.value = error.message || t('oauth_error');
      isLoading.value = false;
    }
  };

  // Apple OAuth handler
  const handleAppleLogin = async () => {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      await signInWithApple();
    } catch (error: any) {
      console.error('Apple login error:', error);
      errorMessage.value = error.message || t('oauth_error');
      isLoading.value = false;
    }
  };

  // Reset form to try a different email
  const resetForm = () => {
    magicLinkSent.value = false;
    email.value = '';
    errorMessage.value = '';
  };

  // Clear error when user starts typing
  watch(email, () => {
    if (errorMessage.value) {
      errorMessage.value = '';
    }
  });
</script>

<i18n lang="json">
{
  "en": {
    "page_title": "Sign In - Classic Mini DIY",
    "page_description": "Sign in to contribute, track submissions, and more.",
    "title": "Sign In",
    "subtitle": "Sign in to contribute, track submissions, and more",
    "email_label": "Email Address",
    "email_placeholder": "Enter your email address",
    "send_magic_link": "Send Magic Link",
    "sending": "Sending...",
    "magic_link_sent": "Check Your Email",
    "magic_link_description": "We've sent a magic link to your email address. Click the link in the email to sign in.",
    "try_different_email": "Try a different email",
    "back_to_site": "Back to Site",
    "sign_in_google": "Continue with Google",
    "sign_in_apple": "Continue with Apple",
    "or_divider": "or",
    "oauth_error": "Sign in failed. Please try again.",
    "validation_error": "Please enter a valid email address",
    "login_error": "Failed to send magic link. Please try again.",
    "unified_account_note": "Your account works on both classicminidiy.com and theminiexchange.com"
  },
  "es": {
    "page_title": "Iniciar Sesión - Classic Mini DIY",
    "page_description": "Inicia sesión para contribuir, seguir tus envíos y más.",
    "title": "Iniciar Sesión",
    "subtitle": "Inicia sesión para contribuir, seguir tus envíos y más",
    "email_label": "Correo Electrónico",
    "email_placeholder": "Ingresa tu correo electrónico",
    "send_magic_link": "Enviar Enlace Mágico",
    "sending": "Enviando...",
    "magic_link_sent": "Revisa Tu Correo",
    "magic_link_description": "Hemos enviado un enlace mágico a tu correo electrónico. Haz clic en el enlace para iniciar sesión.",
    "try_different_email": "Intentar con otro correo",
    "back_to_site": "Volver al Sitio",
    "sign_in_google": "Continuar con Google",
    "sign_in_apple": "Continuar con Apple",
    "or_divider": "o",
    "oauth_error": "Error al iniciar sesión. Inténtalo de nuevo.",
    "validation_error": "Por favor ingresa un correo electrónico válido",
    "login_error": "Error al enviar el enlace mágico. Inténtalo de nuevo.",
    "unified_account_note": "Tu cuenta funciona tanto en classicminidiy.com como en theminiexchange.com"
  },
  "fr": {
    "page_title": "Connexion - Classic Mini DIY",
    "page_description": "Connectez-vous pour contribuer, suivre vos soumissions et plus encore.",
    "title": "Connexion",
    "subtitle": "Connectez-vous pour contribuer, suivre vos soumissions et plus",
    "email_label": "Adresse Email",
    "email_placeholder": "Entrez votre adresse email",
    "send_magic_link": "Envoyer le Lien Magique",
    "sending": "Envoi en cours...",
    "magic_link_sent": "Vérifiez Votre Email",
    "magic_link_description": "Nous avons envoyé un lien magique à votre adresse email. Cliquez sur le lien pour vous connecter.",
    "try_different_email": "Essayer un autre email",
    "back_to_site": "Retour au Site",
    "sign_in_google": "Continuer avec Google",
    "sign_in_apple": "Continuer avec Apple",
    "or_divider": "ou",
    "oauth_error": "Échec de la connexion. Veuillez réessayer.",
    "validation_error": "Veuillez entrer une adresse email valide",
    "login_error": "Échec de l'envoi du lien magique. Veuillez réessayer.",
    "unified_account_note": "Votre compte fonctionne sur classicminidiy.com et theminiexchange.com"
  },
  "it": {
    "page_title": "Accedi - Classic Mini DIY",
    "page_description": "Accedi per contribuire, seguire le tue proposte e altro.",
    "title": "Accedi",
    "subtitle": "Accedi per contribuire, seguire le tue proposte e altro",
    "email_label": "Indirizzo Email",
    "email_placeholder": "Inserisci il tuo indirizzo email",
    "send_magic_link": "Invia Link Magico",
    "sending": "Invio in corso...",
    "magic_link_sent": "Controlla la Tua Email",
    "magic_link_description": "Abbiamo inviato un link magico al tuo indirizzo email. Clicca sul link per accedere.",
    "try_different_email": "Prova con un'altra email",
    "back_to_site": "Torna al Sito",
    "sign_in_google": "Continua con Google",
    "sign_in_apple": "Continua con Apple",
    "or_divider": "o",
    "oauth_error": "Accesso fallito. Riprova.",
    "validation_error": "Inserisci un indirizzo email valido",
    "login_error": "Invio del link magico fallito. Riprova.",
    "unified_account_note": "Il tuo account funziona sia su classicminidiy.com che su theminiexchange.com"
  },
  "de": {
    "page_title": "Anmelden - Classic Mini DIY",
    "page_description": "Melden Sie sich an, um beizutragen, Einreichungen zu verfolgen und mehr.",
    "title": "Anmelden",
    "subtitle": "Anmelden, um beizutragen, Einreichungen zu verfolgen und mehr",
    "email_label": "E-Mail-Adresse",
    "email_placeholder": "Geben Sie Ihre E-Mail-Adresse ein",
    "send_magic_link": "Magic Link Senden",
    "sending": "Wird gesendet...",
    "magic_link_sent": "Prüfen Sie Ihre E-Mail",
    "magic_link_description": "Wir haben einen Magic Link an Ihre E-Mail-Adresse gesendet. Klicken Sie auf den Link, um sich anzumelden.",
    "try_different_email": "Andere E-Mail versuchen",
    "back_to_site": "Zurück zur Seite",
    "sign_in_google": "Weiter mit Google",
    "sign_in_apple": "Weiter mit Apple",
    "or_divider": "oder",
    "oauth_error": "Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.",
    "validation_error": "Bitte geben Sie eine gültige E-Mail-Adresse ein",
    "login_error": "Magic Link konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
    "unified_account_note": "Ihr Konto funktioniert sowohl auf classicminidiy.com als auch auf theminiexchange.com"
  },
  "pt": {
    "page_title": "Entrar - Classic Mini DIY",
    "page_description": "Entre para contribuir, acompanhar suas submissões e mais.",
    "title": "Entrar",
    "subtitle": "Entre para contribuir, acompanhar suas submissões e mais",
    "email_label": "Endereço de Email",
    "email_placeholder": "Digite seu endereço de email",
    "send_magic_link": "Enviar Link Mágico",
    "sending": "Enviando...",
    "magic_link_sent": "Verifique Seu Email",
    "magic_link_description": "Enviamos um link mágico para seu endereço de email. Clique no link para entrar.",
    "try_different_email": "Tentar outro email",
    "back_to_site": "Voltar ao Site",
    "sign_in_google": "Continuar com Google",
    "sign_in_apple": "Continuar com Apple",
    "or_divider": "ou",
    "oauth_error": "Falha ao entrar. Tente novamente.",
    "validation_error": "Por favor, digite um endereço de email válido",
    "login_error": "Falha ao enviar o link mágico. Tente novamente.",
    "unified_account_note": "Sua conta funciona tanto em classicminidiy.com quanto em theminiexchange.com"
  },
  "ru": {
    "page_title": "Вход - Classic Mini DIY",
    "page_description": "Войдите, чтобы вносить вклад, отслеживать заявки и многое другое.",
    "title": "Вход",
    "subtitle": "Войдите, чтобы вносить вклад, отслеживать заявки и многое другое",
    "email_label": "Электронная Почта",
    "email_placeholder": "Введите ваш email адрес",
    "send_magic_link": "Отправить Ссылку для Входа",
    "sending": "Отправка...",
    "magic_link_sent": "Проверьте Вашу Почту",
    "magic_link_description": "Мы отправили ссылку для входа на ваш email адрес. Нажмите на ссылку, чтобы войти.",
    "try_different_email": "Попробовать другой email",
    "back_to_site": "Назад к Сайту",
    "sign_in_google": "Продолжить с Google",
    "sign_in_apple": "Продолжить с Apple",
    "or_divider": "или",
    "oauth_error": "Ошибка входа. Попробуйте снова.",
    "validation_error": "Пожалуйста, введите действительный email адрес",
    "login_error": "Не удалось отправить ссылку для входа. Попробуйте снова.",
    "unified_account_note": "Ваш аккаунт работает как на classicminidiy.com, так и на theminiexchange.com"
  },
  "ja": {
    "page_title": "サインイン - Classic Mini DIY",
    "page_description": "サインインして投稿、提出物の追跡などを行いましょう。",
    "title": "サインイン",
    "subtitle": "サインインして投稿、提出物の追跡などを行う",
    "email_label": "メールアドレス",
    "email_placeholder": "メールアドレスを入力",
    "send_magic_link": "マジックリンクを送信",
    "sending": "送信中...",
    "magic_link_sent": "メールを確認してください",
    "magic_link_description": "マジックリンクをメールアドレスに送信しました。メール内のリンクをクリックしてサインインしてください。",
    "try_different_email": "別のメールアドレスを試す",
    "back_to_site": "サイトに戻る",
    "sign_in_google": "Googleで続行",
    "sign_in_apple": "Appleで続行",
    "or_divider": "または",
    "oauth_error": "サインインに失敗しました。もう一度お試しください。",
    "validation_error": "有効なメールアドレスを入力してください",
    "login_error": "マジックリンクの送信に失敗しました。もう一度お試しください。",
    "unified_account_note": "あなたのアカウントはclassicminidiy.comとtheminiexchange.comの両方で使えます"
  },
  "zh": {
    "page_title": "登录 - Classic Mini DIY",
    "page_description": "登录以贡献内容、跟踪提交等。",
    "title": "登录",
    "subtitle": "登录以贡献内容、跟踪提交等",
    "email_label": "邮箱地址",
    "email_placeholder": "输入您的邮箱地址",
    "send_magic_link": "发送魔法链接",
    "sending": "发送中...",
    "magic_link_sent": "请查看您的邮箱",
    "magic_link_description": "我们已向您的邮箱发送了魔法链接。点击邮件中的链接即可登录。",
    "try_different_email": "尝试其他邮箱",
    "back_to_site": "返回网站",
    "sign_in_google": "使用 Google 继续",
    "sign_in_apple": "使用 Apple 继续",
    "or_divider": "或",
    "oauth_error": "登录失败。请重试。",
    "validation_error": "请输入有效的邮箱地址",
    "login_error": "发送魔法链接失败。请重试。",
    "unified_account_note": "您的账户可在classicminidiy.com和theminiexchange.com上使用"
  },
  "ko": {
    "page_title": "로그인 - Classic Mini DIY",
    "page_description": "로그인하여 기여하고, 제출물을 추적하고, 더 많은 것을 하세요.",
    "title": "로그인",
    "subtitle": "로그인하여 기여하고, 제출물을 추적하세요",
    "email_label": "이메일 주소",
    "email_placeholder": "이메일 주소를 입력하세요",
    "send_magic_link": "매직 링크 보내기",
    "sending": "전송 중...",
    "magic_link_sent": "이메일을 확인하세요",
    "magic_link_description": "이메일 주소로 매직 링크를 보냈습니다. 이메일의 링크를 클릭하여 로그인하세요.",
    "try_different_email": "다른 이메일 시도",
    "back_to_site": "사이트로 돌아가기",
    "sign_in_google": "Google로 계속하기",
    "sign_in_apple": "Apple로 계속하기",
    "or_divider": "또는",
    "oauth_error": "로그인에 실패했습니다. 다시 시도해주세요.",
    "validation_error": "유효한 이메일 주소를 입력해주세요",
    "login_error": "매직 링크 전송에 실패했습니다. 다시 시도해주세요.",
    "unified_account_note": "계정은 classicminidiy.com과 theminiexchange.com 모두에서 사용할 수 있습니다"
  }
}
</i18n>
