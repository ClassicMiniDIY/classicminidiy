<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <div v-if="errorMessage">
        <UAlert color="error" :title="t('auth_error')" :description="errorMessage" />
        <UButton to="/login" class="mt-4">{{ t('back_to_login') }}</UButton>
      </div>
      <div v-else class="space-y-4">
        <div class="flex justify-center">
          <UButton loading variant="ghost" size="xl" />
        </div>
        <p class="opacity-70">{{ t('verifying') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  useHead({
    title: 'Verifying Login - Classic Mini DIY',
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  });

  const { initAuth, isAuthenticated, isAdmin, userProfile, waitForAuth } = useAuth();
  const errorMessage = ref('');

  onMounted(async () => {
    try {
      await initAuth();
      // Wait briefly for session to be detected from URL
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (isAuthenticated.value) {
        // Wait for profile to be fetched
        await waitForAuth();

        // First-time user: null display_name means they haven't onboarded
        if (!userProfile.value?.display_name) {
          const redirect = isAdmin.value ? '/admin' : '/';
          navigateTo(`/welcome?redirect=${encodeURIComponent(redirect)}`, { replace: true });
        } else if (isAdmin.value) {
          navigateTo('/admin', { replace: true });
        } else {
          navigateTo('/', { replace: true });
        }
      } else {
        errorMessage.value = 'Authentication failed. Please try again.';
      }
    } catch (e: any) {
      errorMessage.value = e.message || 'Authentication failed';
    }
  });
</script>

<i18n lang="json">
{
  "en": {
    "auth_error": "Authentication Error",
    "back_to_login": "Back to Login",
    "verifying": "Verifying your login..."
  },
  "es": {
    "auth_error": "Error de Autenticación",
    "back_to_login": "Volver al Inicio de Sesión",
    "verifying": "Verificando tu inicio de sesión..."
  },
  "fr": {
    "auth_error": "Erreur d'Authentification",
    "back_to_login": "Retour à la Connexion",
    "verifying": "Vérification de votre connexion..."
  },
  "it": {
    "auth_error": "Errore di Autenticazione",
    "back_to_login": "Torna al Login",
    "verifying": "Verifica del tuo accesso..."
  },
  "de": {
    "auth_error": "Authentifizierungsfehler",
    "back_to_login": "Zurück zum Login",
    "verifying": "Überprüfung Ihrer Anmeldung..."
  },
  "pt": {
    "auth_error": "Erro de Autenticação",
    "back_to_login": "Voltar ao Login",
    "verifying": "Verificando seu login..."
  },
  "ru": {
    "auth_error": "Ошибка Аутентификации",
    "back_to_login": "Вернуться к Входу",
    "verifying": "Проверка вашего входа..."
  },
  "ja": {
    "auth_error": "認証エラー",
    "back_to_login": "ログインに戻る",
    "verifying": "ログインを確認中..."
  },
  "zh": {
    "auth_error": "认证错误",
    "back_to_login": "返回登录",
    "verifying": "正在验证您的登录..."
  },
  "ko": {
    "auth_error": "인증 오류",
    "back_to_login": "로그인으로 돌아가기",
    "verifying": "로그인 확인 중..."
  }
}
</i18n>
