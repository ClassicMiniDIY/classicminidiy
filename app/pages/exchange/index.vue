<script lang="ts" setup>
  // Placeholder section landing for The Mini Exchange consolidation (Stage 0).
  // Gated by app/middleware/exchange-flag.global.ts — only reachable when
  // NUXT_PUBLIC_EXCHANGE_ENABLED is true. Real browse UI lands in Stage 3.
  const { t } = useI18n();

  useHead({
    title: t('seo.title'),
    meta: [{ key: 'description', name: 'description', content: t('seo.description') }],
    link: [{ rel: 'canonical', href: 'https://www.classicminidiy.com/exchange' }],
  });
</script>

<template>
  <div class="hero min-h-[60vh] bg-base-200">
    <div class="hero-content text-center">
      <div class="max-w-xl">
        <i class="fas fa-shop text-5xl text-primary mb-4"></i>
        <h1 class="text-4xl font-bold">{{ t('hero.title') }}</h1>
        <p class="py-6 text-base-content/70">{{ t('hero.subtitle') }}</p>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "seo": {
      "title": "The Mini Exchange — Classic Mini Marketplace | Classic Mini DIY",
      "description": "Buy and sell Classic Mini Coopers, parts, and project cars in the Classic Mini DIY marketplace."
    },
    "hero": {
      "title": "The Mini Exchange",
      "subtitle": "Classic Mini classifieds, now part of Classic Mini DIY."
    }
  },
  "es": {
    "seo": {
      "title": "The Mini Exchange — Mercado del Classic Mini | Classic Mini DIY",
      "description": "Compra y vende Classic Mini Cooper, piezas y coches de proyecto en el mercado de Classic Mini DIY."
    },
    "hero": {
      "title": "The Mini Exchange",
      "subtitle": "Anuncios clasificados del Classic Mini, ahora parte de Classic Mini DIY."
    }
  },
  "fr": {
    "seo": {
      "title": "The Mini Exchange — Place de marché Classic Mini | Classic Mini DIY",
      "description": "Achetez et vendez des Classic Mini Cooper, des pièces et des voitures à restaurer sur la place de marché Classic Mini DIY."
    },
    "hero": {
      "title": "The Mini Exchange",
      "subtitle": "Petites annonces Classic Mini, désormais intégrées à Classic Mini DIY."
    }
  },
  "de": {
    "seo": {
      "title": "The Mini Exchange — Classic-Mini-Marktplatz | Classic Mini DIY",
      "description": "Kaufen und verkaufen Sie Classic Mini Cooper, Teile und Projektfahrzeuge auf dem Classic-Mini-DIY-Marktplatz."
    },
    "hero": {
      "title": "The Mini Exchange",
      "subtitle": "Classic-Mini-Kleinanzeigen, jetzt Teil von Classic Mini DIY."
    }
  },
  "it": {
    "seo": {
      "title": "The Mini Exchange — Mercato Classic Mini | Classic Mini DIY",
      "description": "Compra e vendi Classic Mini Cooper, ricambi e auto da restauro nel mercato di Classic Mini DIY."
    },
    "hero": {
      "title": "The Mini Exchange",
      "subtitle": "Annunci Classic Mini, ora parte di Classic Mini DIY."
    }
  },
  "pt": {
    "seo": {
      "title": "The Mini Exchange — Mercado Classic Mini | Classic Mini DIY",
      "description": "Compre e venda Classic Mini Cooper, peças e carros para restauro no mercado da Classic Mini DIY."
    },
    "hero": {
      "title": "The Mini Exchange",
      "subtitle": "Classificados Classic Mini, agora parte da Classic Mini DIY."
    }
  },
  "ru": {
    "seo": {
      "title": "The Mini Exchange — площадка Classic Mini | Classic Mini DIY",
      "description": "Покупайте и продавайте Classic Mini Cooper, запчасти и проектные автомобили на площадке Classic Mini DIY."
    },
    "hero": {
      "title": "The Mini Exchange",
      "subtitle": "Объявления Classic Mini теперь часть Classic Mini DIY."
    }
  },
  "ja": {
    "seo": {
      "title": "The Mini Exchange — クラシックミニ マーケットプレイス | Classic Mini DIY",
      "description": "Classic Mini DIY のマーケットプレイスで、クラシックミニ クーパーや部品、プロジェクト車を売買できます。"
    },
    "hero": {
      "title": "The Mini Exchange",
      "subtitle": "クラシックミニの売買が Classic Mini DIY の一部になりました。"
    }
  },
  "zh": {
    "seo": {
      "title": "The Mini Exchange — 经典 Mini 交易市场 | Classic Mini DIY",
      "description": "在 Classic Mini DIY 交易市场买卖经典 Mini Cooper、零件和项目车。"
    },
    "hero": {
      "title": "The Mini Exchange",
      "subtitle": "经典 Mini 分类信息，现已并入 Classic Mini DIY。"
    }
  },
  "ko": {
    "seo": {
      "title": "The Mini Exchange — 클래식 미니 마켓플레이스 | Classic Mini DIY",
      "description": "Classic Mini DIY 마켓플레이스에서 클래식 미니 쿠퍼, 부품, 프로젝트 차량을 사고팔 수 있습니다."
    },
    "hero": {
      "title": "The Mini Exchange",
      "subtitle": "클래식 미니 중고 거래가 이제 Classic Mini DIY의 일부입니다."
    }
  }
}
</i18n>
