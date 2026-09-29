<script lang="ts" setup>
  import { HERO_TYPES, BREADCRUMB_VERSIONS } from '~~/data/models/generic';
  import type { AccountNavGroup } from '~/components/account/Shell.vue';

  /**
   * /settings is open to every visitor. Preferences (language, currency) work
   * signed out; every other section belongs to an account.
   *
   * A child that needs a session declares `definePageMeta({ settingsAuth: true })`
   * and this parent renders the resolving state or the sign-in card in its
   * place, so a child never renders signed out. Auth is only knowable after
   * mount (the Supabase session is in localStorage), so every branch here goes
   * through `useMountedAuth()`; see the hydration rule in CLAUDE.md.
   */
  const { t } = useI18n();
  const route = useRoute();
  const { authReady, isSignedIn } = useMountedAuth();

  // Notification preferences are marketplace preferences; the route is 404'd by
  // exchange-flag.global.ts until the flag is live, so the entry follows it.
  const exchangeEnabled = useRuntimeConfig().public.exchangeEnabled;

  const needsAuth = computed(() => route.meta.settingsAuth === true);

  const navGroups = computed<AccountNavGroup[]>(() => {
    const groups: AccountNavGroup[] = [
      {
        label: t('groups.site'),
        entries: [{ to: '/settings/preferences', label: t('entries.preferences'), icon: 'fas fa-language' }],
      },
    ];
    if (isSignedIn.value) {
      groups.push({
        label: t('groups.account'),
        entries: [
          { to: '/settings/membership', label: t('entries.membership'), icon: 'fas fa-heart' },
          ...(exchangeEnabled
            ? [{ to: '/settings/notifications', label: t('entries.notifications'), icon: 'fas fa-bell' }]
            : []),
          { to: '/settings/api-keys', label: t('entries.api_keys'), icon: 'fas fa-key' },
          { to: '/settings/security', label: t('entries.security'), icon: 'fas fa-shield-halved' },
        ],
      });
    }
    return groups;
  });

  const loginHref = computed(() => `/login?redirect=${encodeURIComponent(route.fullPath)}`);

  useHead({
    title: t('title'),
    meta: [
      { name: 'description', content: t('description') },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  });
</script>

<template>
  <hero :navigation="true" :title="t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />

  <div class="container mx-auto px-4 py-6">
    <div class="mb-6">
      <breadcrumb :version="BREADCRUMB_VERSIONS.PROFILE" :page="t('hero_title')" />
    </div>

    <div class="mb-8">
      <PageIntro :eyebrow="t('eyebrow')" :title="t('hero_title')" as="h2" />
    </div>

    <AccountShell :groups="navGroups" :nav-label="t('nav_label')">
      <AccountSignInGate
        :required="needsAuth"
        :title="t('auth.sign_in_title')"
        :description="t('auth.sign_in_description')"
        :button-label="t('auth.sign_in_button')"
      >
        <NuxtPage />
      </AccountSignInGate>

      <template #nav-footer>
        <p v-if="authReady && !isSignedIn" class="mt-3 px-2 text-sm opacity-70" data-testid="settings-signed-out-hint">
          {{ t('signed_out_hint') }}
          <NuxtLink :to="loginHref" class="link link-primary">{{ t('sign_in_link') }}</NuxtLink>
        </p>
      </template>
    </AccountShell>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Settings - Classic Mini DIY",
    "description": "Language, currency, membership, notifications, API keys and account security.",
    "hero_title": "Settings",
    "eyebrow": "ACCOUNT",
    "nav_label": "Settings sections",
    "groups": {
      "site": "Site",
      "account": "Account"
    },
    "entries": {
      "preferences": "Language & currency",
      "membership": "Membership",
      "notifications": "Notifications",
      "api_keys": "API keys",
      "security": "Account & security"
    },
    "signed_out_hint": "Sign in to manage your membership, notifications, API keys and security.",
    "sign_in_link": "Sign in",
    "auth": {
      "sign_in_title": "Sign in to view this setting",
      "sign_in_description": "This section belongs to your account. Sign in or create a free account to continue.",
      "sign_in_button": "Sign in to continue"
    }
  },
  "es": {
    "title": "Ajustes - Classic Mini DIY",
    "description": "Idioma, moneda, membresía, notificaciones, claves de API y seguridad de la cuenta.",
    "hero_title": "Ajustes",
    "eyebrow": "CUENTA",
    "nav_label": "Secciones de ajustes",
    "groups": {
      "site": "Sitio",
      "account": "Cuenta"
    },
    "entries": {
      "preferences": "Idioma y moneda",
      "membership": "Membresía",
      "notifications": "Notificaciones",
      "api_keys": "Claves de API",
      "security": "Cuenta y seguridad"
    },
    "signed_out_hint": "Inicia sesión para gestionar tu membresía, notificaciones, claves de API y seguridad.",
    "sign_in_link": "Iniciar sesión",
    "auth": {
      "sign_in_title": "Inicia sesión para ver este ajuste",
      "sign_in_description": "Esta sección pertenece a tu cuenta. Inicia sesión o crea una cuenta gratuita para continuar.",
      "sign_in_button": "Iniciar sesión para continuar"
    }
  },
  "fr": {
    "title": "Paramètres - Classic Mini DIY",
    "description": "Langue, devise, adhésion, notifications, clés d'API et sécurité du compte.",
    "hero_title": "Paramètres",
    "eyebrow": "COMPTE",
    "nav_label": "Sections des paramètres",
    "groups": {
      "site": "Site",
      "account": "Compte"
    },
    "entries": {
      "preferences": "Langue et devise",
      "membership": "Adhésion",
      "notifications": "Notifications",
      "api_keys": "Clés d'API",
      "security": "Compte et sécurité"
    },
    "signed_out_hint": "Connectez-vous pour gérer votre adhésion, vos notifications, vos clés d'API et votre sécurité.",
    "sign_in_link": "Se connecter",
    "auth": {
      "sign_in_title": "Connectez-vous pour voir ce paramètre",
      "sign_in_description": "Cette section appartient à votre compte. Connectez-vous ou créez un compte gratuit pour continuer.",
      "sign_in_button": "Se connecter pour continuer"
    }
  },
  "de": {
    "title": "Einstellungen - Classic Mini DIY",
    "description": "Sprache, Währung, Mitgliedschaft, Benachrichtigungen, API-Schlüssel und Kontosicherheit.",
    "hero_title": "Einstellungen",
    "eyebrow": "KONTO",
    "nav_label": "Einstellungsbereiche",
    "groups": {
      "site": "Website",
      "account": "Konto"
    },
    "entries": {
      "preferences": "Sprache und Währung",
      "membership": "Mitgliedschaft",
      "notifications": "Benachrichtigungen",
      "api_keys": "API-Schlüssel",
      "security": "Konto und Sicherheit"
    },
    "signed_out_hint": "Melden Sie sich an, um Mitgliedschaft, Benachrichtigungen, API-Schlüssel und Sicherheit zu verwalten.",
    "sign_in_link": "Anmelden",
    "auth": {
      "sign_in_title": "Anmelden, um diese Einstellung zu sehen",
      "sign_in_description": "Dieser Bereich gehört zu Ihrem Konto. Melden Sie sich an oder erstellen Sie ein kostenloses Konto.",
      "sign_in_button": "Anmelden und fortfahren"
    }
  },
  "it": {
    "title": "Impostazioni - Classic Mini DIY",
    "description": "Lingua, valuta, abbonamento, notifiche, chiavi API e sicurezza dell'account.",
    "hero_title": "Impostazioni",
    "eyebrow": "ACCOUNT",
    "nav_label": "Sezioni delle impostazioni",
    "groups": {
      "site": "Sito",
      "account": "Account"
    },
    "entries": {
      "preferences": "Lingua e valuta",
      "membership": "Abbonamento",
      "notifications": "Notifiche",
      "api_keys": "Chiavi API",
      "security": "Account e sicurezza"
    },
    "signed_out_hint": "Accedi per gestire abbonamento, notifiche, chiavi API e sicurezza.",
    "sign_in_link": "Accedi",
    "auth": {
      "sign_in_title": "Accedi per vedere questa impostazione",
      "sign_in_description": "Questa sezione appartiene al tuo account. Accedi o crea un account gratuito per continuare.",
      "sign_in_button": "Accedi per continuare"
    }
  },
  "pt": {
    "title": "Configurações - Classic Mini DIY",
    "description": "Idioma, moeda, assinatura, notificações, chaves de API e segurança da conta.",
    "hero_title": "Configurações",
    "eyebrow": "CONTA",
    "nav_label": "Seções de configurações",
    "groups": {
      "site": "Site",
      "account": "Conta"
    },
    "entries": {
      "preferences": "Idioma e moeda",
      "membership": "Assinatura",
      "notifications": "Notificações",
      "api_keys": "Chaves de API",
      "security": "Conta e segurança"
    },
    "signed_out_hint": "Entre para gerenciar sua assinatura, notificações, chaves de API e segurança.",
    "sign_in_link": "Entrar",
    "auth": {
      "sign_in_title": "Entre para ver esta configuração",
      "sign_in_description": "Esta seção pertence à sua conta. Entre ou crie uma conta gratuita para continuar.",
      "sign_in_button": "Entrar para continuar"
    }
  },
  "ru": {
    "title": "Настройки - Classic Mini DIY",
    "description": "Язык, валюта, членство, уведомления, ключи API и безопасность аккаунта.",
    "hero_title": "Настройки",
    "eyebrow": "АККАУНТ",
    "nav_label": "Разделы настроек",
    "groups": {
      "site": "Сайт",
      "account": "Аккаунт"
    },
    "entries": {
      "preferences": "Язык и валюта",
      "membership": "Членство",
      "notifications": "Уведомления",
      "api_keys": "Ключи API",
      "security": "Аккаунт и безопасность"
    },
    "signed_out_hint": "Войдите, чтобы управлять членством, уведомлениями, ключами API и безопасностью.",
    "sign_in_link": "Войти",
    "auth": {
      "sign_in_title": "Войдите, чтобы открыть этот раздел",
      "sign_in_description": "Этот раздел относится к вашему аккаунту. Войдите или создайте бесплатный аккаунт.",
      "sign_in_button": "Войти и продолжить"
    }
  },
  "ja": {
    "title": "設定 - Classic Mini DIY",
    "description": "言語、通貨、メンバーシップ、通知、APIキー、アカウントのセキュリティ。",
    "hero_title": "設定",
    "eyebrow": "アカウント",
    "nav_label": "設定のセクション",
    "groups": {
      "site": "サイト",
      "account": "アカウント"
    },
    "entries": {
      "preferences": "言語と通貨",
      "membership": "メンバーシップ",
      "notifications": "通知",
      "api_keys": "APIキー",
      "security": "アカウントとセキュリティ"
    },
    "signed_out_hint": "メンバーシップ、通知、APIキー、セキュリティを管理するにはログインしてください。",
    "sign_in_link": "ログイン",
    "auth": {
      "sign_in_title": "この設定を表示するにはログインしてください",
      "sign_in_description": "このセクションはアカウント用です。ログインするか、無料アカウントを作成してください。",
      "sign_in_button": "ログインして続ける"
    }
  },
  "zh": {
    "title": "设置 - Classic Mini DIY",
    "description": "语言、货币、会员、通知、API 密钥和账户安全。",
    "hero_title": "设置",
    "eyebrow": "账户",
    "nav_label": "设置栏目",
    "groups": {
      "site": "网站",
      "account": "账户"
    },
    "entries": {
      "preferences": "语言和货币",
      "membership": "会员",
      "notifications": "通知",
      "api_keys": "API 密钥",
      "security": "账户与安全"
    },
    "signed_out_hint": "登录以管理您的会员、通知、API 密钥和安全设置。",
    "sign_in_link": "登录",
    "auth": {
      "sign_in_title": "登录以查看此设置",
      "sign_in_description": "此栏目属于您的账户。请登录或创建免费账户以继续。",
      "sign_in_button": "登录并继续"
    }
  },
  "ko": {
    "title": "설정 - Classic Mini DIY",
    "description": "언어, 통화, 멤버십, 알림, API 키 및 계정 보안.",
    "hero_title": "설정",
    "eyebrow": "계정",
    "nav_label": "설정 섹션",
    "groups": {
      "site": "사이트",
      "account": "계정"
    },
    "entries": {
      "preferences": "언어 및 통화",
      "membership": "멤버십",
      "notifications": "알림",
      "api_keys": "API 키",
      "security": "계정 및 보안"
    },
    "signed_out_hint": "멤버십, 알림, API 키, 보안을 관리하려면 로그인하세요.",
    "sign_in_link": "로그인",
    "auth": {
      "sign_in_title": "이 설정을 보려면 로그인하세요",
      "sign_in_description": "이 섹션은 계정에 속합니다. 로그인하거나 무료 계정을 만드세요.",
      "sign_in_button": "로그인하고 계속하기"
    }
  }
}
</i18n>
