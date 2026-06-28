<template>
  <!-- Soft onboarding nudge. Site-wide, takes the chat-overlay slot for logged-in
       users who haven't completed onboarding. Non-blocking; persists until done.
       Hidden on the onboarding page itself. The hard /exchange gate lives in
       middleware/exchange-onboarding.global.ts. -->
  <aside
    v-if="show"
    role="complementary"
    aria-live="polite"
    :aria-label="t('title')"
    class="fixed bottom-6 right-6 z-50 max-w-sm w-full px-4"
  >
    <div class="bg-base-100 rounded-2xl shadow-xl border border-base-300 p-5">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <i class="fas fa-user-check text-primary" aria-hidden="true"></i>
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-bold text-base">{{ t('title') }}</h3>
          <p class="text-sm text-base-content/70 mt-1">{{ t('body') }}</p>
          <button type="button" class="btn btn-primary btn-sm mt-3 w-full" @click="goToOnboarding">
            <i class="fas fa-arrow-right" aria-hidden="true"></i>
            {{ t('cta') }}
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
  const { t } = useI18n();
  const { needsOnboarding } = useOnboardingGate();
  const route = useRoute();
  const { capture } = usePostHog();

  // Never nudge on the onboarding page (they're already there) or the auth callback.
  const show = computed(() => needsOnboarding.value && route.path !== '/onboarding' && route.path !== '/auth/callback');

  const goToOnboarding = () => {
    capture('onboarding_nudge_clicked', { from: route.path });
    navigateTo(`/onboarding?redirect=${encodeURIComponent(route.fullPath)}`);
  };
</script>

<i18n lang="json">
{
  "en": { "title": "Finish setting up your account", "body": "Complete your profile to unlock The Mini Exchange — buy, sell, and message other Classic Mini owners.", "cta": "Complete your profile" },
  "es": { "title": "Termina de configurar tu cuenta", "body": "Completa tu perfil para desbloquear The Mini Exchange: compra, vende y contacta con otros propietarios de Classic Mini.", "cta": "Completar mi perfil" },
  "fr": { "title": "Terminez la configuration de votre compte", "body": "Complétez votre profil pour débloquer The Mini Exchange : achetez, vendez et échangez avec d'autres propriétaires de Classic Mini.", "cta": "Compléter mon profil" },
  "de": { "title": "Schließe die Einrichtung deines Kontos ab", "body": "Vervollständige dein Profil, um The Mini Exchange freizuschalten — kaufen, verkaufen und mit anderen Classic-Mini-Besitzern schreiben.", "cta": "Profil vervollständigen" },
  "it": { "title": "Completa la configurazione del tuo account", "body": "Completa il tuo profilo per sbloccare The Mini Exchange: compra, vendi e scrivi ad altri proprietari di Classic Mini.", "cta": "Completa il profilo" },
  "pt": { "title": "Conclua a configuração da sua conta", "body": "Complete o seu perfil para desbloquear o The Mini Exchange: compre, venda e converse com outros donos de Classic Mini.", "cta": "Completar meu perfil" },
  "ru": { "title": "Завершите настройку аккаунта", "body": "Заполните профиль, чтобы открыть The Mini Exchange — покупайте, продавайте и общайтесь с другими владельцами Classic Mini.", "cta": "Заполнить профиль" },
  "ja": { "title": "アカウント設定を完了しましょう", "body": "プロフィールを完成させて The Mini Exchange を利用しましょう — 他の Classic Mini オーナーと売買・メッセージができます。", "cta": "プロフィールを完成させる" },
  "zh": { "title": "完成账户设置", "body": "完善个人资料即可解锁 The Mini Exchange — 与其他 Classic Mini 车主买卖和私信。", "cta": "完善个人资料" },
  "ko": { "title": "계정 설정을 완료하세요", "body": "프로필을 완성하면 The Mini Exchange를 이용할 수 있습니다 — 다른 Classic Mini 오너와 사고팔고 메시지를 주고받으세요.", "cta": "프로필 완성하기" }
}
</i18n>
