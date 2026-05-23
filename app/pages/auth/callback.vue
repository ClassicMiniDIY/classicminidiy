<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <div v-if="errorMessage">
        <div role="alert" class="alert alert-error">
          <i class="fas fa-circle-xmark"></i>
          <div>
            <div class="font-semibold">{{ t('auth_error') }}</div>
            <div class="text-sm">{{ errorMessage }}</div>
          </div>
        </div>
        <NuxtLink to="/login" class="btn btn-primary mt-4">{{ t('back_to_login') }}</NuxtLink>
      </div>
      <div v-else class="space-y-4">
        <div class="flex justify-center">
          <span class="loading loading-spinner loading-lg"></span>
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

  const supabase = useSupabase();
  const { initAuth, isAuthenticated, isAdmin, userProfile, waitForAuth } = useAuth();
  const errorMessage = ref('');

  onMounted(async () => {
    try {
      // Manual PKCE code exchange. useSupabase has detectSessionInUrl: false,
      // so supabase-js will not auto-process the ?code= param — this call is
      // the only thing that completes the OAuth / magic-link flow.
      const code = new URLSearchParams(window.location.search).get('code');

      // --- DIAGNOSTICS (temporary) ---------------------------------------
      // Tracking a production sign-in failure where flow_state rows are
      // created server-side but no auth.sessions row appears. We need to
      // see the actual error the client surfaces, the storage state at the
      // time of the exchange, and whether getSession sees a session after.
      // Remove this block once the regression is identified.
      const sbStorageKeys = Object.keys(window.localStorage).filter((k) => k.startsWith('sb-'));
      console.log('[auth/callback] sb-* localStorage keys before exchange:', sbStorageKeys);
      console.log('[auth/callback] code present:', !!code);
      // -------------------------------------------------------------------

      let exchangeError: { message?: string; code?: string; status?: number; name?: string } | null = null;
      let exchangeReturnedSession = false;
      if (code) {
        // Pass the code string only, NOT window.location.href — supabase-js
        // puts this value directly into the /token POST body's auth_code field.
        const result = await supabase.auth.exchangeCodeForSession(code);
        exchangeError = result.error as typeof exchangeError;
        exchangeReturnedSession = !!result.data?.session;
        console.log('[auth/callback] exchange result:', {
          hasSession: exchangeReturnedSession,
          error: result.error
            ? {
                name: (result.error as any).name,
                code: (result.error as any).code,
                status: (result.error as any).status,
                message: result.error.message,
              }
            : null,
        });
      }

      await initAuth();
      // Wait briefly for session to be detected from URL
      await new Promise((resolve) => setTimeout(resolve, 500));

      // --- DIAGNOSTICS (temporary) ---------------------------------------
      const { data: sessionCheck } = await supabase.auth.getSession();
      console.log('[auth/callback] post-init getSession:', {
        hasSession: !!sessionCheck.session,
        userId: sessionCheck.session?.user?.id ?? null,
        isAuthenticatedFlag: isAuthenticated.value,
      });
      // -------------------------------------------------------------------

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
        // Surface every signal the exchange gave us so we can diagnose
        // failures from a screenshot alone instead of needing console logs.
        const parts: string[] = [];
        if (exchangeError) {
          if (exchangeError.code) parts.push(`code=${exchangeError.code}`);
          if (exchangeError.status) parts.push(`status=${exchangeError.status}`);
          if (exchangeError.message) parts.push(exchangeError.message);
        }
        if (code && !exchangeError && !exchangeReturnedSession) {
          parts.push('exchange returned no session and no error');
        }
        if (!code) {
          parts.push('no auth code in callback URL');
        }
        errorMessage.value = parts.length ? parts.join(' | ') : 'Authentication failed. Please try again.';
      }
    } catch (e: any) {
      console.error('[auth/callback] thrown:', e);
      const label = [e.name, e.code, e.message].filter(Boolean).join(' | ');
      errorMessage.value = label || 'Authentication failed';
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
