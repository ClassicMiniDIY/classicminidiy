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
    "description": "Classic Mini DIY is a free resource, kept going by the people who use it. Sustaining Membership is the best way to support it — and it comes with members-only extras.",
    "membership_benefits": "Prefer Patreon, or a one-off tip? Both help too.",
    "image_alt": "Classic Mini DIY wheel mark",
    "membership_cta": "Become a Sustaining Member",
    "patreon_cta": "Support on Patreon",
    "donate_cta": "Donate"
  },
  "es": {
    "title": "APOYA EL SITIO",
    "description": "Classic Mini DIY es un recurso gratuito, sostenido por quienes lo usan. Hacerte Miembro Sostenedor es la mejor forma de apoyarlo, y trae ventajas exclusivas.",
    "membership_benefits": "¿Prefieres Patreon o una aportación puntual? También ayudan.",
    "image_alt": "Marca de la rueda de Classic Mini DIY",
    "membership_cta": "Hazte Miembro Sostenedor",
    "patreon_cta": "Apoya en Patreon",
    "donate_cta": "Donar"
  },
  "fr": {
    "title": "SOUTENEZ LE SITE",
    "description": "Classic Mini DIY est une ressource gratuite, portée par ceux qui l’utilisent. Devenir Membre de Soutien est la meilleure façon de nous aider, avec des avantages réservés aux membres.",
    "membership_benefits": "Vous préférez Patreon ou un don ponctuel ? Cela aide aussi.",
    "image_alt": "Marque de la roue Classic Mini DIY",
    "membership_cta": "Devenir Membre de Soutien",
    "patreon_cta": "Soutenir sur Patreon",
    "donate_cta": "Faire un don"
  },
  "de": {
    "title": "UNTERSTÜTZE DIE SEITE",
    "description": "Classic Mini DIY ist eine kostenlose Ressource, getragen von denen, die sie nutzen. Eine Fördermitgliedschaft ist die beste Unterstützung — mit Extras nur für Mitglieder.",
    "membership_benefits": "Lieber Patreon oder eine einmalige Spende? Hilft ebenfalls.",
    "image_alt": "Classic Mini DIY Radmarke",
    "membership_cta": "Fördermitglied werden",
    "patreon_cta": "Auf Patreon unterstützen",
    "donate_cta": "Spenden"
  },
  "it": {
    "title": "SUPPORTA IL SITO",
    "description": "Classic Mini DIY è una risorsa gratuita, sostenuta da chi la usa. Diventare Membro Sostenitore è il modo migliore per supportarla, con vantaggi riservati ai membri.",
    "membership_benefits": "Preferisci Patreon o un contributo una tantum? Aiutano anche quelli.",
    "image_alt": "Marchio della ruota Classic Mini DIY",
    "membership_cta": "Diventa Membro Sostenitore",
    "patreon_cta": "Sostieni su Patreon",
    "donate_cta": "Dona"
  },
  "ja": {
    "title": "サイトをサポート",
    "description": "Classic Mini DIY は利用者に支えられた無料のリソースです。サポートメンバーになることが最良の支援方法で、メンバー限定の特典もあります。",
    "membership_benefits": "Patreon や単発の寄付でも構いません。どちらも助かります。",
    "image_alt": "Classic Mini DIY ホイールマーク",
    "membership_cta": "サポートメンバーになる",
    "patreon_cta": "Patreonで支援",
    "donate_cta": "寄付"
  },
  "ko": {
    "title": "사이트 지원",
    "description": "Classic Mini DIY는 이용자들이 지탱하는 무료 자료입니다. 서포팅 멤버가 되는 것이 가장 좋은 후원 방법이며, 멤버 전용 혜택도 있습니다.",
    "membership_benefits": "Patreon이나 일회성 후원도 좋습니다. 모두 도움이 됩니다.",
    "image_alt": "Classic Mini DIY 휠 마크",
    "membership_cta": "서포팅 멤버 되기",
    "patreon_cta": "Patreon에서 후원",
    "donate_cta": "기부"
  },
  "pt": {
    "title": "APOIE O SITE",
    "description": "O Classic Mini DIY é um recurso gratuito, mantido por quem o usa. Tornar-se Membro Apoiador é a melhor forma de apoiar, com vantagens exclusivas.",
    "membership_benefits": "Prefere o Patreon ou uma contribuição única? Também ajudam.",
    "image_alt": "Marca da roda Classic Mini DIY",
    "membership_cta": "Torne-se Membro Apoiador",
    "patreon_cta": "Apoie no Patreon",
    "donate_cta": "Doar"
  },
  "ru": {
    "title": "ПОДДЕРЖИТЕ САЙТ",
    "description": "Classic Mini DIY — бесплатный ресурс, который держится на его читателях. Участие в программе поддержки — лучший способ помочь, и оно даёт бонусы для участников.",
    "membership_benefits": "Предпочитаете Patreon или разовый донат? Это тоже помогает.",
    "image_alt": "Эмблема колеса Classic Mini DIY",
    "membership_cta": "Стать участником поддержки",
    "patreon_cta": "Поддержать на Patreon",
    "donate_cta": "Пожертвовать"
  },
  "zh": {
    "title": "支持网站",
    "description": "Classic Mini DIY 是一个由使用者支持的免费资源。成为支持会员是最好的支持方式，并可获得会员专属福利。",
    "membership_benefits": "更喜欢 Patreon 或一次性捐赠？同样很有帮助。",
    "image_alt": "Classic Mini DIY 车轮标志",
    "membership_cta": "成为支持会员",
    "patreon_cta": "在 Patreon 支持",
    "donate_cta": "捐赠"
  }
}
</i18n>
