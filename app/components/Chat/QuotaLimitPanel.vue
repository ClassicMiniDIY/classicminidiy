<template>
  <!--
    The limit-reached panel.

    Deliberately NOT the red error alert this replaces. Hitting a ceiling is not
    a failure — it is the one moment when someone has demonstrably found the
    assistant useful, fifteen times over, and the only moment membership is
    genuinely relevant to them. Rendering it as "something went wrong, please
    try again" wasted that and, worse, was untrue: the retry it invited could
    never succeed.

    Three audiences, three asks. An anonymous visitor may not have an account at
    all, so selling them a subscription skips a step; a signed-in free user
    already has one and needs the upgrade; a member has nothing left to buy and
    just needs to know when their allowance returns.
  -->
  <div role="status" class="rounded-2xl border border-base-300 bg-base-200/60 p-5">
    <div class="flex items-start gap-3">
      <div
        class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
        aria-hidden="true"
      >
        <i :class="quota.tier === 'member' ? 'fas fa-hourglass-half' : 'fas fa-star'"></i>
      </div>

      <div class="min-w-0 flex-1">
        <h2 class="text-base font-semibold">{{ t(`${quota.tier}.title`) }}</h2>

        <!-- `!== undefined`, not truthiness: a ceiling of 0 is a plausible
             kill-switch for a tier, and `used && limit` would then hide the
             numbers and leave the panel saying nothing concrete. -->
        <p v-if="quota.used !== undefined && quota.limit !== undefined" class="mt-0.5 text-sm text-base-content/60">
          {{ t('used_of', { used: quota.used, limit: quota.limit }) }}
        </p>

        <p class="mt-2 text-sm text-base-content/80">{{ t(`${quota.tier}.body`) }}</p>

        <ul v-if="quota.tier !== 'member'" class="mt-3 space-y-1.5 text-sm text-base-content/80">
          <li v-for="benefit in benefits" :key="benefit" class="flex items-start gap-2">
            <i class="fas fa-check mt-1 text-xs text-primary" aria-hidden="true"></i>
            <span>{{ benefit }}</span>
          </li>
        </ul>

        <div v-if="quota.tier !== 'member'" class="mt-4 flex flex-wrap items-center gap-2">
          <!--
            An anonymous visitor is sent to sign-in, not to checkout: signing in
            is free, trebles their allowance, and is the step that has to happen
            first anyway. Selling before that is asking for a card from someone
            who has not yet made an account.
          -->
          <NuxtLink
            v-if="quota.tier === 'anonymous'"
            :to="`/login?redirect=${encodeURIComponent(route.fullPath)}`"
            class="btn btn-primary btn-sm"
            @click="trackCta('sign_in')"
          >
            <i class="fas fa-right-to-bracket" aria-hidden="true"></i>
            {{ t('anonymous.cta') }}
          </NuxtLink>

          <NuxtLink v-else :to="quota.upgradeUrl" class="btn btn-primary btn-sm" @click="trackCta('membership')">
            <i class="fas fa-star" aria-hidden="true"></i>
            {{ t('free.cta') }}
          </NuxtLink>

          <NuxtLink
            v-if="quota.tier === 'anonymous'"
            :to="quota.upgradeUrl"
            class="btn btn-ghost btn-sm font-normal"
            @click="trackCta('membership_secondary')"
          >
            {{ t('anonymous.secondary') }}
          </NuxtLink>
        </div>

        <!--
          OUTSIDE the tier block on purpose. This is the way out of a panel this
          component cannot date: a window rolls from the last ACCEPTED message,
          which the client has no way to know, so a remembered refusal has no
          reliable expiry. A member has no other control here at all — the CTAs
          above are for anonymous and free tiers — so nesting it left the paying
          tier facing a buttonless panel and a locked composer with no way back.
          Their window is monthly, the one most likely to outlive the stored
          verdict. The server re-adjudicates every send; the worst case of
          pressing this is the panel returning.
        -->
        <div class="mt-4">
          <button type="button" class="btn btn-ghost btn-sm font-normal" @click="emit('dismiss')">
            {{ t('try_again') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, watch } from 'vue';
  import type { QuotaExhausted } from '~/utils/chatQuotaError';

  const props = defineProps<{ quota: QuotaExhausted; restored?: boolean }>();
  const emit = defineEmits<{ dismiss: [] }>();
  const { t } = useI18n();
  const { capture } = usePostHog();
  const route = useRoute();

  const benefits = computed(() =>
    props.quota.tier === 'anonymous'
      ? [t('benefit.free_allowance'), t('benefit.history'), t('benefit.free_forever')]
      : [t('benefit.member_allowance'), t('benefit.synced_history'), t('benefit.supports')]
  );

  /**
   * The conversion funnel this panel exists for. Without the impression event
   * the click-through rate has no denominator, and "does hitting the limit sell
   * memberships" stays unanswerable.
   *
   * Keyed on the TIER changing rather than on mount. The panel survives a New
   * chat without remounting, so a mount-only capture could record a CTA click
   * against no impression — a funnel whose numerator exceeds its denominator,
   * which reads as a conversion rate above 100%.
   *
   * `restored` separates the two ways this panel can appear. It used to mount
   * only from a live 429, so the event meant "a refusal happened". Now that a
   * verdict is remembered across navigation, the panel also mounts from storage
   * on every later visit inside the window — and without this flag one refusal
   * would emit an event per page view, inflating the count and silently
   * redefining the metric mid-series. Filter to `restored: false` to keep the
   * original meaning and comparability with data from before this shipped.
   */
  watch(
    () => props.quota.tier,
    (tier) => {
      capture('chat_limit_reached', {
        tier,
        used: props.quota.used ?? null,
        limit: props.quota.limit ?? null,
        restored: props.restored === true,
      });
    },
    { immediate: true }
  );

  function trackCta(target: string) {
    capture('chat_limit_cta_clicked', { tier: props.quota.tier, target });
  }
</script>

<i18n lang="json">
{
  "en": {
    "used_of": "{used} of {limit} messages used",
    "anonymous": {
      "title": "You've used today's free messages",
      "body": "Sign in to get a bigger allowance — it's free, and it takes a moment.",
      "cta": "Sign in",
      "secondary": "See membership"
    },
    "free": {
      "title": "You've used this month's messages",
      "body": "Sustaining Members get a much larger allowance, and it helps keep the archive free for everyone.",
      "cta": "Become a Sustaining Member"
    },
    "member": {
      "title": "You've used this month's messages",
      "body": "Your allowance resets at the start of next month. Thanks for supporting Classic Mini DIY."
    },
    "benefit": {
      "free_allowance": "30 messages a month instead of 15 a day",
      "history": "Your conversations saved to your account",
      "free_forever": "Free — no card needed",
      "member_allowance": "100 messages a month",
      "synced_history": "Conversations synced across your devices",
      "supports": "Supports the archive, the videos and the tools"
    },
    "try_again": "Try again"
  },
  "es": {
    "used_of": "{used} de {limit} mensajes usados",
    "anonymous": {
      "title": "Has usado los mensajes gratuitos de hoy",
      "body": "Inicia sesión para obtener más — es gratis y toma un momento.",
      "cta": "Iniciar sesión",
      "secondary": "Ver membresía"
    },
    "free": {
      "title": "Has usado los mensajes de este mes",
      "body": "Los Miembros Sustaining tienen muchos más mensajes, y ayudan a mantener el archivo gratuito para todos.",
      "cta": "Hazte Miembro Sustaining"
    },
    "member": {
      "title": "Has usado los mensajes de este mes",
      "body": "Tu límite se restablece al inicio del próximo mes. Gracias por apoyar a Classic Mini DIY."
    },
    "benefit": {
      "free_allowance": "30 mensajes al mes en vez de 15 al día",
      "history": "Tus conversaciones guardadas en tu cuenta",
      "free_forever": "Gratis — sin tarjeta",
      "member_allowance": "100 mensajes al mes",
      "synced_history": "Conversaciones sincronizadas entre tus dispositivos",
      "supports": "Apoya el archivo, los vídeos y las herramientas"
    },
    "try_again": "Intentar de nuevo"
  },
  "fr": {
    "used_of": "{used} messages sur {limit} utilisés",
    "anonymous": {
      "title": "Vous avez utilisé vos messages gratuits du jour",
      "body": "Connectez-vous pour en obtenir plus — c'est gratuit et rapide.",
      "cta": "Se connecter",
      "secondary": "Voir l'adhésion"
    },
    "free": {
      "title": "Vous avez utilisé vos messages du mois",
      "body": "Les membres Sustaining disposent de bien plus de messages, et cela garde l'archive gratuite pour tous.",
      "cta": "Devenir membre Sustaining"
    },
    "member": {
      "title": "Vous avez utilisé vos messages du mois",
      "body": "Votre quota se réinitialise au début du mois prochain. Merci de soutenir Classic Mini DIY."
    },
    "benefit": {
      "free_allowance": "30 messages par mois au lieu de 15 par jour",
      "history": "Vos conversations enregistrées sur votre compte",
      "free_forever": "Gratuit — sans carte bancaire",
      "member_allowance": "100 messages par mois",
      "synced_history": "Conversations synchronisées entre vos appareils",
      "supports": "Soutient l'archive, les vidéos et les outils"
    },
    "try_again": "Réessayer"
  },
  "de": {
    "used_of": "{used} von {limit} Nachrichten verwendet",
    "anonymous": {
      "title": "Du hast die kostenlosen Nachrichten für heute verbraucht",
      "body": "Melde dich an, um mehr zu erhalten — kostenlos und in einem Moment erledigt.",
      "cta": "Anmelden",
      "secondary": "Mitgliedschaft ansehen"
    },
    "free": {
      "title": "Du hast die Nachrichten dieses Monats verbraucht",
      "body": "Sustaining Member haben deutlich mehr Nachrichten und halten das Archiv für alle kostenlos.",
      "cta": "Sustaining Member werden"
    },
    "member": {
      "title": "Du hast die Nachrichten dieses Monats verbraucht",
      "body": "Dein Kontingent wird zu Beginn des nächsten Monats zurückgesetzt. Danke für deine Unterstützung."
    },
    "benefit": {
      "free_allowance": "30 Nachrichten pro Monat statt 15 pro Tag",
      "history": "Deine Unterhaltungen in deinem Konto gespeichert",
      "free_forever": "Kostenlos — keine Karte nötig",
      "member_allowance": "100 Nachrichten pro Monat",
      "synced_history": "Unterhaltungen auf allen Geräten synchronisiert",
      "supports": "Unterstützt das Archiv, die Videos und die Werkzeuge"
    },
    "try_again": "Erneut versuchen"
  },
  "it": {
    "used_of": "{used} di {limit} messaggi usati",
    "anonymous": {
      "title": "Hai usato i messaggi gratuiti di oggi",
      "body": "Accedi per averne di più — è gratis e ci vuole un attimo.",
      "cta": "Accedi",
      "secondary": "Vedi l'abbonamento"
    },
    "free": {
      "title": "Hai usato i messaggi di questo mese",
      "body": "I Sustaining Member hanno molti più messaggi e aiutano a mantenere l'archivio gratuito per tutti.",
      "cta": "Diventa Sustaining Member"
    },
    "member": {
      "title": "Hai usato i messaggi di questo mese",
      "body": "Il tuo limite si azzera all'inizio del mese prossimo. Grazie per il supporto."
    },
    "benefit": {
      "free_allowance": "30 messaggi al mese invece di 15 al giorno",
      "history": "Le tue conversazioni salvate sul tuo account",
      "free_forever": "Gratis — senza carta",
      "member_allowance": "100 messaggi al mese",
      "synced_history": "Conversazioni sincronizzate su tutti i dispositivi",
      "supports": "Sostiene l'archivio, i video e gli strumenti"
    },
    "try_again": "Riprova"
  },
  "ja": {
    "used_of": "{limit} 件中 {used} 件のメッセージを使用しました",
    "anonymous": {
      "title": "本日の無料メッセージを使い切りました",
      "body": "ログインするとより多く使えます。無料で、すぐに完了します。",
      "cta": "ログイン",
      "secondary": "メンバーシップを見る"
    },
    "free": {
      "title": "今月のメッセージを使い切りました",
      "body": "Sustaining Member はより多くのメッセージを使え、アーカイブを無料で維持する助けになります。",
      "cta": "Sustaining Member になる"
    },
    "member": {
      "title": "今月のメッセージを使い切りました",
      "body": "来月の初めにリセットされます。ご支援ありがとうございます。"
    },
    "benefit": {
      "free_allowance": "1日15件ではなく、月30件",
      "history": "会話がアカウントに保存されます",
      "free_forever": "無料 — カード不要",
      "member_allowance": "月100件のメッセージ",
      "synced_history": "会話が全デバイスで同期されます",
      "supports": "アーカイブ、動画、ツールを支援します"
    },
    "try_again": "もう一度試す"
  },
  "ko": {
    "used_of": "{limit}개 중 {used}개 메시지 사용",
    "anonymous": {
      "title": "오늘의 무료 메시지를 모두 사용했습니다",
      "body": "로그인하면 더 많이 사용할 수 있습니다. 무료이며 금방 끝납니다.",
      "cta": "로그인",
      "secondary": "멤버십 보기"
    },
    "free": {
      "title": "이번 달 메시지를 모두 사용했습니다",
      "body": "Sustaining Member는 훨씬 많은 메시지를 사용할 수 있고, 아카이브를 모두에게 무료로 유지하는 데 도움이 됩니다.",
      "cta": "Sustaining Member 되기"
    },
    "member": {
      "title": "이번 달 메시지를 모두 사용했습니다",
      "body": "다음 달 초에 초기화됩니다. 후원해 주셔서 감사합니다."
    },
    "benefit": {
      "free_allowance": "하루 15개 대신 월 30개",
      "history": "대화가 계정에 저장됩니다",
      "free_forever": "무료 — 카드 불필요",
      "member_allowance": "월 100개 메시지",
      "synced_history": "모든 기기에서 대화 동기화",
      "supports": "아카이브와 영상, 도구를 후원합니다"
    },
    "try_again": "다시 시도"
  },
  "pt": {
    "used_of": "{used} de {limit} mensagens usadas",
    "anonymous": {
      "title": "Você usou as mensagens gratuitas de hoje",
      "body": "Entre para receber mais — é grátis e leva um momento.",
      "cta": "Entrar",
      "secondary": "Ver assinatura"
    },
    "free": {
      "title": "Você usou as mensagens deste mês",
      "body": "Sustaining Members têm muito mais mensagens e ajudam a manter o arquivo gratuito para todos.",
      "cta": "Torne-se Sustaining Member"
    },
    "member": {
      "title": "Você usou as mensagens deste mês",
      "body": "Seu limite é renovado no início do próximo mês. Obrigado pelo apoio."
    },
    "benefit": {
      "free_allowance": "30 mensagens por mês em vez de 15 por dia",
      "history": "Suas conversas salvas na sua conta",
      "free_forever": "Grátis — sem cartão",
      "member_allowance": "100 mensagens por mês",
      "synced_history": "Conversas sincronizadas entre dispositivos",
      "supports": "Apoia o arquivo, os vídeos e as ferramentas"
    },
    "try_again": "Tentar novamente"
  },
  "ru": {
    "used_of": "Использовано {used} из {limit} сообщений",
    "anonymous": {
      "title": "Вы использовали бесплатные сообщения на сегодня",
      "body": "Войдите, чтобы получить больше — это бесплатно и займёт минуту.",
      "cta": "Войти",
      "secondary": "О членстве"
    },
    "free": {
      "title": "Вы использовали сообщения за этот месяц",
      "body": "У Sustaining Member гораздо больше сообщений, и это помогает сохранять архив бесплатным для всех.",
      "cta": "Стать Sustaining Member"
    },
    "member": {
      "title": "Вы использовали сообщения за этот месяц",
      "body": "Лимит обновится в начале следующего месяца. Спасибо за поддержку."
    },
    "benefit": {
      "free_allowance": "30 сообщений в месяц вместо 15 в день",
      "history": "Ваши переписки сохраняются в аккаунте",
      "free_forever": "Бесплатно — карта не нужна",
      "member_allowance": "100 сообщений в месяц",
      "synced_history": "Переписки синхронизируются между устройствами",
      "supports": "Поддерживает архив, видео и инструменты"
    },
    "try_again": "Попробовать снова"
  },
  "zh": {
    "used_of": "已使用 {used} / {limit} 条消息",
    "anonymous": {
      "title": "您已用完今天的免费消息",
      "body": "登录即可获得更多 — 免费，只需片刻。",
      "cta": "登录",
      "secondary": "查看会员"
    },
    "free": {
      "title": "您已用完本月的消息",
      "body": "Sustaining 会员拥有更多消息，也帮助我们让档案对所有人保持免费。",
      "cta": "成为 Sustaining 会员"
    },
    "member": {
      "title": "您已用完本月的消息",
      "body": "您的额度将在下月初重置。感谢您的支持。"
    },
    "benefit": {
      "free_allowance": "每月 30 条，而不是每天 15 条",
      "history": "对话保存到您的账户",
      "free_forever": "免费 — 无需银行卡",
      "member_allowance": "每月 100 条消息",
      "synced_history": "对话在各设备间同步",
      "supports": "支持档案、视频与工具"
    },
    "try_again": "重试"
  }
}
</i18n>
