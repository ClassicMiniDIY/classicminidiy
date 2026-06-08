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

  const handlePatreonClick = () => {
    capture('support_cta_clicked', { type: 'patreon', location: path });
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
          <p class="eyebrow">
            <i class="fad fa-hands-heart mr-1"></i>{{ t('title') }}
          </p>
          <p class="text-lg py-5">
            {{ t('description') }}
          </p>
          <p class="pt-3">
            <strong>{{ t('membership_benefits') }}</strong>
          </p>
          <p class="mt-4">
            <NuxtLink
              to="https://patreon.com/classicminidiy"
              target="_blank"
              rel="noopener"
              class="btn is-patreon"
              @click="handlePatreonClick"
            >
              <i class="fab fa-patreon mr-2"></i>
              <span>{{ t('button_text') }}</span>
            </NuxtLink>
          </p>
          <p class="pt-2">
            <NuxtLink to="/membership" class="link link-primary text-sm font-semibold">
              {{ t('member_link') }}
            </NuxtLink>
          </p>
        </div>
      </div>
    </template>
    <template v-if="size === 'small'">
      <div class="grid grid-cols-1 gap-2">
        <div>
          <p class="eyebrow pt-2">
            <i class="fad fa-hands-heart mr-1"></i>{{ t('title') }}
          </p>
        </div>
        <div>
          <p class="text-sm">
            {{ t('description') }}
          </p>
          <p class="pt-3">
            <strong>{{ t('membership_benefits') }}</strong>
          </p>
          <NuxtLink
            to="https://patreon.com/classicminidiy"
            target="_blank"
            rel="noopener"
            class="btn btn-sm is-patreon mt-4"
            @click="handlePatreonClick"
          >
            <i class="fab fa-patreon mr-2"></i>
            <span>{{ t('button_text') }}</span>
          </NuxtLink>
          <NuxtLink to="/membership" class="link link-primary text-xs font-semibold mt-3 inline-block">
            {{ t('member_link') }}
          </NuxtLink>
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
    "button_text": "Contribute Today",
    "member_link": "Looking for member perks? See Sustaining Member →",
    "image_alt": "Classic Mini DIY wheel mark"
  },
  "es": {
    "title": "APOYA EL SITIO",
    "description": "Classic Mini DIY es un recurso completamente gratuito apoyado por nuestros espectadores. Si estás interesado en ayudar a mantener el canal vivo, considera apoyar en Patreon.",
    "membership_benefits": "Una propina única o recurrente que ayuda a mantener todo en marcha, independiente de la Membresía de Miembro Sostenedor.",
    "button_text": "Contribuye Hoy",
    "member_link": "¿Buscas beneficios de miembro? Ver Miembro Sostenedor →",
    "image_alt": "Marca de la rueda de Classic Mini DIY"
  },
  "fr": {
    "title": "SOUTENEZ LE SITE",
    "description": "Classic Mini DIY est une ressource complètement gratuite soutenue par nos spectateurs. Si vous êtes intéressé à aider à maintenir la chaîne en vie, considérez soutenir sur Patreon.",
    "membership_benefits": "Un pourboire ponctuel ou récurrent qui aide à faire tourner la boutique — distinct de l'adhésion Membre Soutien.",
    "button_text": "Contribuez Aujourd'hui",
    "member_link": "Vous cherchez les avantages membre ? Voir Membre Soutien →",
    "image_alt": "Marque de la roue Classic Mini DIY"
  },
  "de": {
    "title": "UNTERSTÜTZE DIE SEITE",
    "description": "Classic Mini DIY ist eine völlig kostenlose Ressource, die von unseren Zuschauern unterstützt wird. Wenn Sie daran interessiert sind, den Kanal am Leben zu erhalten, erwägen Sie eine Unterstützung auf Patreon.",
    "membership_benefits": "Ein einmaliger oder wiederkehrender Beitrag, der den Betrieb am Laufen hält — getrennt von der Fördermitgliedschaft.",
    "button_text": "Heute Beitragen",
    "member_link": "Auf der Suche nach Mitglieder-Vorteilen? Zum Fördermitglied →",
    "image_alt": "Classic Mini DIY Radmarke"
  },
  "it": {
    "title": "SUPPORTA IL SITO",
    "description": "Classic Mini DIY è una risorsa completamente gratuita supportata dai nostri spettatori. Se sei interessato ad aiutare a mantenere vivo il canale, considera di supportare su Patreon.",
    "membership_benefits": "Una mancia una tantum o ricorrente che aiuta a tenere accese le luci — separata dall'iscrizione Membro Sostenitore.",
    "button_text": "Contribuisci Oggi",
    "member_link": "Cerchi i vantaggi per i membri? Vedi Membro Sostenitore →",
    "image_alt": "Marchio della ruota Classic Mini DIY"
  },
  "ja": {
    "title": "サイトをサポート",
    "description": "Classic Mini DIYは視聴者の皆様にサポートされている完全に無料のリソースです。チャンネルを維持するための支援に興味がある場合は、Patreonでのサポートをご検討ください。",
    "membership_benefits": "サイト運営を支える一回限りまたは継続的なチップです。サポーティングメンバーとは別のものです。",
    "button_text": "今日貢献する",
    "member_link": "会員特典をお探しですか？ サポーティングメンバーを見る →",
    "image_alt": "Classic Mini DIY ホイールマーク"
  },
  "ko": {
    "title": "사이트 지원",
    "description": "Classic Mini DIY는 시청자들에 의해 지원되는 완전히 무료 리소스입니다. 채널을 살아있게 유지하는 데 도움을 주고 싶다면 Patreon에서 지원을 고려해 보세요.",
    "membership_benefits": "사이트 운영을 돕는 일회성 또는 정기 후원입니다. 후원 회원과는 별개입니다.",
    "button_text": "오늘 기여하기",
    "member_link": "회원 혜택을 찾으세요? 후원 회원 보기 →",
    "image_alt": "Classic Mini DIY 휠 마크"
  },
  "pt": {
    "title": "APOIE O SITE",
    "description": "Classic Mini DIY é um recurso completamente gratuito apoiado por nossos espectadores. Se você está interessado em ajudar a manter o canal vivo, considere apoiar no Patreon.",
    "membership_benefits": "Uma gorjeta única ou recorrente que ajuda a manter tudo funcionando — separada da assinatura de Membro Sustentador.",
    "button_text": "Contribua Hoje",
    "member_link": "Procurando benefícios de membro? Ver Membro Sustentador →",
    "image_alt": "Marca da roda Classic Mini DIY"
  },
  "ru": {
    "title": "ПОДДЕРЖИТЕ САЙТ",
    "description": "Classic Mini DIY - это полностью бесплатный ресурс, поддерживаемый нашими зрителями. Если вы заинтересованы в том, чтобы помочь поддержать канал, рассмотрите возможность поддержки на Patreon.",
    "membership_benefits": "Разовый или регулярный донат, помогающий поддерживать работу сайта, — отдельно от Поддерживающего участия.",
    "button_text": "Пожертвовать сегодня",
    "member_link": "Ищете привилегии участника? Смотреть Поддерживающий участник →",
    "image_alt": "Эмблема колеса Classic Mini DIY"
  },
  "zh": {
    "title": "支持网站",
    "description": "Classic Mini DIY是一个完全免费的资源，由我们的观众支持。如果您有兴趣帮助保持频道活力，请考虑在Patreon上支持。",
    "membership_benefits": "一次性或定期的小额支持，帮助维持网站运营——与持续会员资格相互独立。",
    "button_text": "今天贡献",
    "member_link": "寻找会员权益？查看持续会员 →",
    "image_alt": "Classic Mini DIY 车轮标志"
  }
}
</i18n>
