<template>
  <div class="min-h-screen flex items-center justify-center bg-muted">
    <UCard class="w-full max-w-md">
      <div class="text-center mb-6">
        <h1 class="text-3xl font-bold">{{ $t('title') }}</h1>
        <p class="opacity-70 mt-2">{{ $t('subtitle') }}</p>
      </div>

      <!-- Magic link sent success state -->
      <div v-if="magicLinkSent" class="text-center space-y-4">
        <div class="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
          <i class="fad fa-envelope-circle-check text-3xl text-success"></i>
        </div>
        <h2 class="text-xl font-semibold">{{ $t('magic_link_sent') }}</h2>
        <p class="opacity-70">{{ $t('magic_link_description') }}</p>
        <UButton @click="resetForm" variant="ghost" size="sm">
          {{ $t('try_different_email') }}
        </UButton>
      </div>

      <!-- OAuth + Email form -->
      <div v-else class="space-y-4">
        <!-- OAuth buttons -->
        <div class="space-y-3">
          <UButton
            class="w-full"
            color="neutral"
            variant="outline"
            :disabled="isLoading"
            @click="handleGoogleLogin"
          >
            <template #leading>
              <i class="fab fa-google"></i>
            </template>
            {{ $t('sign_in_google') }}
          </UButton>

          <UButton
            class="w-full"
            color="neutral"
            variant="outline"
            :disabled="isLoading"
            @click="handleAppleLogin"
          >
            <template #leading>
              <i class="fab fa-apple"></i>
            </template>
            {{ $t('sign_in_apple') }}
          </UButton>
        </div>

        <USeparator :label="$t('or_divider')" class="my-4" />

        <!-- Email magic link form -->
        <form @submit.prevent="handleLogin" class="space-y-4">
          <UFormField :label="$t('email_label')">
            <UInput
              v-model="email"
              type="email"
              :placeholder="$t('email_placeholder')"
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
              {{ isLoading ? $t('sending') : $t('send_magic_link') }}
            </UButton>
          </div>
        </form>
      </div>

      <USeparator class="my-4" />

      <div class="text-center">
        <UButton to="/" variant="ghost" size="sm">
          <i class="fad fa-arrow-left mr-2"></i>
          {{ $t('back_to_site') }}
        </UButton>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
  // SEO and meta
  useHead({
    title: $t('page_title'),
    meta: [
      {
        name: 'description',
        content: $t('page_description'),
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
      errorMessage.value = $t('validation_error');
      return;
    }

    isLoading.value = true;
    errorMessage.value = '';

    try {
      await signInWithEmail(email.value);
      magicLinkSent.value = true;
    } catch (error: any) {
      console.error('Login error:', error);
      errorMessage.value = error.message || $t('login_error');
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
      errorMessage.value = error.message || $t('oauth_error');
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
      errorMessage.value = error.message || $t('oauth_error');
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
    "page_description": "Sign in to access Classic Mini DIY admin panel.",
    "title": "Sign In",
    "subtitle": "Access Classic Mini DIY admin panel",
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
    "login_error": "Failed to send magic link. Please try again."
  },
  "es": {
    "page_title": "Iniciar Sesión - Classic Mini DIY",
    "page_description": "Inicia sesión para acceder al panel de administración de Classic Mini DIY.",
    "title": "Iniciar Sesión",
    "subtitle": "Accede al panel de administración de Classic Mini DIY",
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
    "login_error": "Error al enviar el enlace mágico. Inténtalo de nuevo."
  },
  "fr": {
    "page_title": "Connexion - Classic Mini DIY",
    "page_description": "Connectez-vous pour accéder au panneau d'administration Classic Mini DIY.",
    "title": "Connexion",
    "subtitle": "Accédez au panneau d'administration Classic Mini DIY",
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
    "login_error": "Échec de l'envoi du lien magique. Veuillez réessayer."
  },
  "it": {
    "page_title": "Accedi - Classic Mini DIY",
    "page_description": "Accedi per accedere al pannello di amministrazione Classic Mini DIY.",
    "title": "Accedi",
    "subtitle": "Accedi al pannello di amministrazione Classic Mini DIY",
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
    "login_error": "Invio del link magico fallito. Riprova."
  },
  "de": {
    "page_title": "Anmelden - Classic Mini DIY",
    "page_description": "Melden Sie sich an, um auf das Classic Mini DIY Admin-Panel zuzugreifen.",
    "title": "Anmelden",
    "subtitle": "Zugriff auf das Classic Mini DIY Admin-Panel",
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
    "login_error": "Magic Link konnte nicht gesendet werden. Bitte versuchen Sie es erneut."
  },
  "pt": {
    "page_title": "Entrar - Classic Mini DIY",
    "page_description": "Entre para acessar o painel de administração Classic Mini DIY.",
    "title": "Entrar",
    "subtitle": "Acesse o painel de administração Classic Mini DIY",
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
    "login_error": "Falha ao enviar o link mágico. Tente novamente."
  },
  "ru": {
    "page_title": "Вход - Classic Mini DIY",
    "page_description": "Войдите для доступа к панели управления Classic Mini DIY.",
    "title": "Вход",
    "subtitle": "Доступ к панели администрирования Classic Mini DIY",
    "email_label": "Электронная Почта",
    "email_placeholder": "Введите ваш email адрес",
    "send_magic_link": "Отправить Ссылку для Входа",
    "sending": "Отправка...",
    "magic_link_sent": "Проверьте Вашу Почту",
    "magic_link_description": "Мы отправили ссылку для входа на ваш email адрес. Нажмите на ссылку, чтобы войти.",
    "try_different_email": "Попробовать другой email",
    "back_to_site": "Назад к Сайту",
    "sign_in_google": "Google で続行",
    "sign_in_apple": "Apple で続行",
    "or_divider": "или",
    "oauth_error": "Ошибка входа. Попробуйте снова.",
    "validation_error": "Пожалуйста, введите действительный email адрес",
    "login_error": "Не удалось отправить ссылку для входа. Попробуйте снова."
  },
  "ja": {
    "page_title": "サインイン - Classic Mini DIY",
    "page_description": "Classic Mini DIY管理パネルにアクセスするためにサインインしてください。",
    "title": "サインイン",
    "subtitle": "Classic Mini DIY管理パネルにアクセス",
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
    "login_error": "マジックリンクの送信に失敗しました。もう一度お試しください。"
  },
  "zh": {
    "page_title": "登录 - Classic Mini DIY",
    "page_description": "登录以访问Classic Mini DIY管理面板。",
    "title": "登录",
    "subtitle": "访问Classic Mini DIY管理面板",
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
    "login_error": "发送魔法链接失败。请重试。"
  },
  "ko": {
    "page_title": "로그인 - Classic Mini DIY",
    "page_description": "Classic Mini DIY 관리 패널에 액세스하려면 로그인하세요.",
    "title": "로그인",
    "subtitle": "Classic Mini DIY 관리 패널에 액세스",
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
    "login_error": "매직 링크 전송에 실패했습니다. 다시 시도해주세요."
  }
}
</i18n>
