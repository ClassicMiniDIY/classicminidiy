<script lang="ts" setup>
  // Public on purpose: language and currency are the only preferences a
  // signed-out visitor has, and this is the only place to set them.
  const { t } = useI18n();
</script>

<template>
  <div class="space-y-6" data-testid="settings-preferences">
    <div>
      <h2 class="text-xl font-semibold">{{ t('heading') }}</h2>
      <p class="mt-1 text-sm opacity-70">{{ t('intro') }}</p>
    </div>

    <div class="card border border-base-300 bg-base-100 shadow-sm">
      <div class="card-body">
        <LanguageSwitcher />
      </div>
    </div>

    <div class="card border border-base-300 bg-base-100 shadow-sm">
      <div class="card-body">
        <SettingsCurrencySelect />
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "heading": "Language & currency",
    "intro": "These preferences apply in this browser. When you are signed in, the currency is also saved to your account."
  },
  "es": {
    "heading": "Idioma y moneda",
    "intro": "Estas preferencias se aplican en este navegador. Con sesión iniciada, la moneda también se guarda en tu cuenta."
  },
  "fr": {
    "heading": "Langue et devise",
    "intro": "Ces préférences s'appliquent dans ce navigateur. Si vous êtes connecté, la devise est aussi enregistrée sur votre compte."
  },
  "de": {
    "heading": "Sprache und Währung",
    "intro": "Diese Einstellungen gelten in diesem Browser. Wenn Sie angemeldet sind, wird die Währung auch im Konto gespeichert."
  },
  "it": {
    "heading": "Lingua e valuta",
    "intro": "Queste preferenze valgono in questo browser. Con l'accesso, la valuta viene salvata anche nel tuo account."
  },
  "pt": {
    "heading": "Idioma e moeda",
    "intro": "Estas preferências valem neste navegador. Com sessão iniciada, a moeda também é salva na sua conta."
  },
  "ru": {
    "heading": "Язык и валюта",
    "intro": "Эти настройки действуют в этом браузере. При входе валюта также сохраняется в аккаунте."
  },
  "ja": {
    "heading": "言語と通貨",
    "intro": "これらの設定はこのブラウザーに適用されます。ログイン中は通貨もアカウントに保存されます。"
  },
  "zh": {
    "heading": "语言和货币",
    "intro": "这些偏好适用于此浏览器。登录后，货币也会保存到您的账户。"
  },
  "ko": {
    "heading": "언어 및 통화",
    "intro": "이 설정은 이 브라우저에 적용됩니다. 로그인하면 통화도 계정에 저장됩니다."
  }
}
</i18n>
