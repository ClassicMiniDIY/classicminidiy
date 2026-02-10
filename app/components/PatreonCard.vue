<script lang="ts" setup>
  import { TRACKING_EVENTS, trackStuff } from '../../data/models/helper-utils';

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
    trackStuff(TRACKING_EVENTS.PATREON, path);
    capture('support_cta_clicked', { type: 'patreon', location: path });
  };
</script>

<template>
  <div>
    <template v-if="size === 'large'">
      <div class="grid grid-cols-12 gap-4">
        <div class="col-span-3 avatar-container">
          <nuxt-img
            format="webp"
            loading="lazy"
            src="https://classicminidiy.s3.amazonaws.com/misc/avatar.png"
            :alt="t('image_alt')"
            class="w-full rounded-lg"
          />
        </div>
        <div class="col-span-9">
          <h3 class="fancy-font-book-oblique text-lg font-semibold">
            <i class="fad fa-hands-heart"></i> {{ t('title') }}
          </h3>
          <p class="text-lg py-5">
            {{ t('description') }}
          </p>
          <p class="pt-3">
            <strong>{{ t('membership_benefits') }}</strong>
          </p>
          <p class="mt-4">
            <UButton
              to="https://patreon.com/classicminidiy"
              target="_blank"
              rel="noopener"
              class="is-patreon"
              @click="handlePatreonClick"
            >
              <i class="fab fa-patreon mr-2"></i>
              <span>{{ t('button_text') }}</span>
            </UButton>
          </p>
        </div>
      </div>
    </template>
    <template v-if="size === 'small'">
      <div class="grid grid-cols-1 gap-2">
        <div>
          <h3 class="fancy-font-book-oblique text-lg font-semibold pt-2">
            <i class="fad fa-hands-heart"></i> {{ t('title') }}
          </h3>
        </div>
        <div>
          <p class="text-sm">
            {{ t('description') }}
          </p>
          <p class="pt-3">
            <strong>{{ t('membership_benefits') }}</strong>
          </p>
          <UButton
            to="https://patreon.com/classicminidiy"
            target="_blank"
            rel="noopener"
            size="sm"
            class="is-patreon mt-4"
            @click="handlePatreonClick"
          >
            <i class="fab fa-patreon mr-2"></i>
            <span>{{ t('button_text') }}</span>
          </UButton>
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
    "membership_benefits": "Membership comes with tons of free perks and benefits!",
    "button_text": "Contribute Today",
    "image_alt": "Image of my car on jack stands"
  },
  "es": {
    "title": "APOYA EL SITIO",
    "description": "Classic Mini DIY es un recurso completamente gratuito apoyado por nuestros espectadores. Si estás interesado en ayudar a mantener el canal vivo, considera apoyar en Patreon.",
    "membership_benefits": "¡La membresía viene con toneladas de ventajas y beneficios gratuitos!",
    "button_text": "Contribuye Hoy",
    "image_alt": "Imagen de mi coche en soportes"
  },
  "fr": {
    "title": "SOUTENEZ LE SITE",
    "description": "Classic Mini DIY est une ressource complètement gratuite soutenue par nos spectateurs. Si vous êtes intéressé à aider à maintenir la chaîne en vie, considérez soutenir sur Patreon.",
    "membership_benefits": "L'adhésion vient avec des tonnes d'avantages et de bénéfices gratuits!",
    "button_text": "Contribuez Aujourd'hui",
    "image_alt": "Image de ma voiture sur chandelles"
  },
  "de": {
    "title": "UNTERSTÜTZE DIE SEITE",
    "description": "Classic Mini DIY ist eine völlig kostenlose Ressource, die von unseren Zuschauern unterstützt wird. Wenn Sie daran interessiert sind, den Kanal am Leben zu erhalten, erwägen Sie eine Unterstützung auf Patreon.",
    "membership_benefits": "Die Mitgliedschaft bringt jede Menge kostenlose Vergünstigungen und Vorteile mit sich!",
    "button_text": "Heute Beitragen",
    "image_alt": "Bild meines Autos auf Wagenhebern"
  },
  "it": {
    "title": "SUPPORTA IL SITO",
    "description": "Classic Mini DIY è una risorsa completamente gratuita supportata dai nostri spettatori. Se sei interessato ad aiutare a mantenere vivo il canale, considera di supportare su Patreon.",
    "membership_benefits": "L'iscrizione viene con tonnellate di vantaggi e benefici gratuiti!",
    "button_text": "Contribuisci Oggi",
    "image_alt": "Immagine della mia auto sui cavalletti"
  },
  "ja": {
    "title": "サイトをサポート",
    "description": "Classic Mini DIYは視聴者の皆様にサポートされている完全に無料のリソースです。チャンネルを維持するための支援に興味がある場合は、Patreonでのサポートをご検討ください。",
    "membership_benefits": "メンバーシップにはたくさんの無料特典とメリットが付いてきます！",
    "button_text": "今日貢献する",
    "image_alt": "ジャッキスタンドの上の私の車の画像"
  },
  "ko": {
    "title": "사이트 지원",
    "description": "Classic Mini DIY는 시청자들에 의해 지원되는 완전히 무료 리소스입니다. 채널을 살아있게 유지하는 데 도움을 주고 싶다면 Patreon에서 지원을 고려해 보세요.",
    "membership_benefits": "멤버십에는 수많은 무료 혜택과 이점이 있습니다!",
    "button_text": "오늘 기여하기",
    "image_alt": "잭 스탠드 위의 내 차 이미지"
  },
  "pt": {
    "title": "APOIE O SITE",
    "description": "Classic Mini DIY é um recurso completamente gratuito apoiado por nossos espectadores. Se você está interessado em ajudar a manter o canal vivo, considere apoiar no Patreon.",
    "membership_benefits": "A associação vem com toneladas de vantagens e benefícios gratuitos!",
    "button_text": "Contribua Hoje",
    "image_alt": "Imagem do meu carro nos cavaletes"
  },
  "ru": {
    "title": "ПОДДЕРЖИТЕ САЙТ",
    "description": "Classic Mini DIY - это полностью бесплатный ресурс, поддерживаемый нашими зрителями. Если вы заинтересованы в том, чтобы помочь поддержать канал, рассмотрите возможность поддержки на Patreon.",
    "membership_benefits": "Членство поставляется с множеством бесплатных привилегий и преимуществ!",
    "button_text": "Пожертвовать сегодня",
    "image_alt": "Изображение моей машины на домкратах"
  },
  "zh": {
    "title": "支持网站",
    "description": "Classic Mini DIY是一个完全免费的资源，由我们的观众支持。如果您有兴趣帮助保持频道活力，请考虑在Patreon上支持。",
    "membership_benefits": "会员资格带有大量免费的好处和益处！",
    "button_text": "今天贡献",
    "image_alt": "我的车在千斤顶上的图片"
  }
}
</i18n>
