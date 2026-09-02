<script lang="ts" setup>
  const { t } = useI18n();
  const { capture } = usePostHog();

  const { path } = useRoute();

  defineProps({
    size: {
      type: String,
      default: 'large',
      required: true,
    },
  });

  /**
   * Sustaining membership is the PRIMARY action; Patreon and the one-off
   * donation are alternatives beside it.
   *
   * Patreon used to be the only button, with membership demoted to a text link
   * underneath — which pointed people at the thing that funds the site least
   * and is hardest to attribute. The membership is the first-party product, it
   * carries the entitlements (Discord, the badge, free premium listings), and
   * it is what the assistant's own quota panel upsells, so the support card
   * should not disagree with the rest of the site about where to send someone.
   *
   * Each destination keeps its own `type` on the analytics event so the three
   * stay separable — the whole point of the change is being able to see which
   * one people actually take.
   */
  const STRIPE_DONATE_URL = 'https://buy.stripe.com/3cs8yWe1P1ER3Oo5kl';
  const PATREON_URL = 'https://patreon.com/classicminidiy';

  const trackSupport = (type: 'membership' | 'patreon' | 'donate') => {
    capture('support_cta_clicked', { type, location: path });
  };
</script>

<template>
  <div>
    <template v-if="size === 'large'">
      <div class="grid grid-cols-12 gap-4 items-center">
        <div class="col-span-3 avatar-container">
          <nuxt-img
            format="webp"
            loading="lazy"
            src="/brand/cmdiy-mark.jpg"
            :alt="t('image_alt')"
            class="w-full rounded-box shadow-md"
          />
        </div>
        <div class="col-span-9">
          <p class="eyebrow"><i class="fad fa-hands-heart mr-1"></i>{{ t('title') }}</p>
          <p class="text-lg py-5">
            {{ t('description') }}
          </p>
          <p class="pt-3">
            <strong>{{ t('membership_benefits') }}</strong>
          </p>
          <div class="mt-4 flex flex-wrap items-center gap-2">
            <NuxtLink to="/membership" class="btn btn-primary" @click="trackSupport('membership')">
              <i class="fas fa-star mr-2"></i>
              <span>{{ t('membership_cta') }}</span>
            </NuxtLink>
            <NuxtLink
              :to="PATREON_URL"
              target="_blank"
              rel="noopener"
              class="btn btn-outline"
              @click="trackSupport('patreon')"
            >
              <i class="fab fa-patreon mr-2"></i>
              <span>{{ t('patreon_cta') }}</span>
            </NuxtLink>
            <NuxtLink
              :to="STRIPE_DONATE_URL"
              target="_blank"
              rel="noopener"
              class="btn btn-ghost"
              @click="trackSupport('donate')"
            >
              <i class="fas fa-heart mr-2"></i>
              <span>{{ t('donate_cta') }}</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </template>
    <template v-if="size === 'small'">
      <div class="grid grid-cols-1 gap-2">
        <div>
          <p class="eyebrow pt-2"><i class="fad fa-hands-heart mr-1"></i>{{ t('title') }}</p>
        </div>
        <div>
          <p class="text-sm">
            {{ t('description') }}
          </p>
          <p class="pt-3">
            <strong>{{ t('membership_benefits') }}</strong>
          </p>
          <div class="mt-4 flex flex-wrap items-center gap-2">
            <NuxtLink to="/membership" class="btn btn-sm btn-primary" @click="trackSupport('membership')">
              <i class="fas fa-star mr-2"></i>
              <span>{{ t('membership_cta') }}</span>
            </NuxtLink>
            <NuxtLink
              :to="PATREON_URL"
              target="_blank"
              rel="noopener"
              class="btn btn-sm btn-outline"
              @click="trackSupport('patreon')"
            >
              <i class="fab fa-patreon mr-2"></i>
              <span>{{ t('patreon_cta') }}</span>
            </NuxtLink>
            <NuxtLink
              :to="STRIPE_DONATE_URL"
              target="_blank"
              rel="noopener"
              class="btn btn-sm btn-ghost"
              @click="trackSupport('donate')"
            >
              <i class="fas fa-heart mr-2"></i>
              <span>{{ t('donate_cta') }}</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "SUPPORT THE SITE",
    "description": "Classic Mini DIY is completely free resource supported by our viewers. If you are interested in helping to keep the channel alive, consider supporting on Patreon.",
    "membership_benefits": "A one-time or recurring tip that helps keep the lights on — separate from Sustaining Membership.",
    "image_alt": "Classic Mini DIY wheel mark",
    "membership_cta": "Become a Sustaining Member",
    "patreon_cta": "Support on Patreon",
    "donate_cta": "Donate"
  },
  "es": {
    "title": "APOYA EL SITIO",
    "description": "Classic Mini DIY es un recurso completamente gratuito apoyado por nuestros espectadores. Si estás interesado en ayudar a mantener el canal vivo, considera apoyar en Patreon.",
    "membership_benefits": "Una propina única o recurrente que ayuda a mantener todo en marcha, independiente de la Membresía de Miembro Sostenedor.",
    "image_alt": "Marca de la rueda de Classic Mini DIY",
    "membership_cta": "Hazte Miembro Sostenedor",
    "patreon_cta": "Apoya en Patreon",
    "donate_cta": "Donar"
  },
  "fr": {
    "title": "SOUTENEZ LE SITE",
    "description": "Classic Mini DIY est une ressource complètement gratuite soutenue par nos spectateurs. Si vous êtes intéressé à aider à maintenir la chaîne en vie, considérez soutenir sur Patreon.",
    "membership_benefits": "Un pourboire ponctuel ou récurrent qui aide à faire tourner la boutique — distinct de l'adhésion Membre Soutien.",
    "image_alt": "Marque de la roue Classic Mini DIY",
    "membership_cta": "Devenir Membre de Soutien",
    "patreon_cta": "Soutenir sur Patreon",
    "donate_cta": "Faire un don"
  },
  "de": {
    "title": "UNTERSTÜTZE DIE SEITE",
    "description": "Classic Mini DIY ist eine völlig kostenlose Ressource, die von unseren Zuschauern unterstützt wird. Wenn Sie daran interessiert sind, den Kanal am Leben zu erhalten, erwägen Sie eine Unterstützung auf Patreon.",
    "membership_benefits": "Ein einmaliger oder wiederkehrender Beitrag, der den Betrieb am Laufen hält — getrennt von der Fördermitgliedschaft.",
    "image_alt": "Classic Mini DIY Radmarke",
    "membership_cta": "Fördermitglied werden",
    "patreon_cta": "Auf Patreon unterstützen",
    "donate_cta": "Spenden"
  },
  "it": {
    "title": "SUPPORTA IL SITO",
    "description": "Classic Mini DIY è una risorsa completamente gratuita supportata dai nostri spettatori. Se sei interessato ad aiutare a mantenere vivo il canale, considera di supportare su Patreon.",
    "membership_benefits": "Una mancia una tantum o ricorrente che aiuta a tenere accese le luci — separata dall'iscrizione Membro Sostenitore.",
    "image_alt": "Marchio della ruota Classic Mini DIY",
    "membership_cta": "Diventa Membro Sostenitore",
    "patreon_cta": "Sostieni su Patreon",
    "donate_cta": "Dona"
  },
  "ja": {
    "title": "サイトをサポート",
    "description": "Classic Mini DIYは視聴者の皆様にサポートされている完全に無料のリソースです。チャンネルを維持するための支援に興味がある場合は、Patreonでのサポートをご検討ください。",
    "membership_benefits": "サイト運営を支える一回限りまたは継続的なチップです。サポーティングメンバーとは別のものです。",
    "image_alt": "Classic Mini DIY ホイールマーク",
    "membership_cta": "サポートメンバーになる",
    "patreon_cta": "Patreonで支援",
    "donate_cta": "寄付"
  },
  "ko": {
    "title": "사이트 지원",
    "description": "Classic Mini DIY는 시청자들에 의해 지원되는 완전히 무료 리소스입니다. 채널을 살아있게 유지하는 데 도움을 주고 싶다면 Patreon에서 지원을 고려해 보세요.",
    "membership_benefits": "사이트 운영을 돕는 일회성 또는 정기 후원입니다. 후원 회원과는 별개입니다.",
    "image_alt": "Classic Mini DIY 휠 마크",
    "membership_cta": "서포팅 멤버 되기",
    "patreon_cta": "Patreon에서 후원",
    "donate_cta": "기부"
  },
  "pt": {
    "title": "APOIE O SITE",
    "description": "Classic Mini DIY é um recurso completamente gratuito apoiado por nossos espectadores. Se você está interessado em ajudar a manter o canal vivo, considere apoiar no Patreon.",
    "membership_benefits": "Uma gorjeta única ou recorrente que ajuda a manter tudo funcionando — separada da assinatura de Membro Sustentador.",
    "image_alt": "Marca da roda Classic Mini DIY",
    "membership_cta": "Torne-se Membro Apoiador",
    "patreon_cta": "Apoie no Patreon",
    "donate_cta": "Doar"
  },
  "ru": {
    "title": "ПОДДЕРЖИТЕ САЙТ",
    "description": "Classic Mini DIY - это полностью бесплатный ресурс, поддерживаемый нашими зрителями. Если вы заинтересованы в том, чтобы помочь поддержать канал, рассмотрите возможность поддержки на Patreon.",
    "membership_benefits": "Разовый или регулярный донат, помогающий поддерживать работу сайта, — отдельно от Поддерживающего участия.",
    "image_alt": "Эмблема колеса Classic Mini DIY",
    "membership_cta": "Стать участником поддержки",
    "patreon_cta": "Поддержать на Patreon",
    "donate_cta": "Пожертвовать"
  },
  "zh": {
    "title": "支持网站",
    "description": "Classic Mini DIY是一个完全免费的资源，由我们的观众支持。如果您有兴趣帮助保持频道活力，请考虑在Patreon上支持。",
    "membership_benefits": "一次性或定期的小额支持，帮助维持网站运营——与持续会员资格相互独立。",
    "image_alt": "Classic Mini DIY 车轮标志",
    "membership_cta": "成为支持会员",
    "patreon_cta": "在 Patreon 支持",
    "donate_cta": "捐赠"
  }
}
</i18n>
