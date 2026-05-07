<script lang="ts" setup>
  const { t } = useI18n();
  const { capture } = usePostHog();

  type LinkItem = {
    id: string;
    label: string;
    sub?: string;
    href: string;
    icon: string;
    btnClass: string;
  };

  const primaryLinks = computed<LinkItem[]>(() => [
    {
      id: 'patreon',
      label: t('links.patreon.label'),
      sub: t('links.patreon.sub'),
      href: 'https://patreon.com/classicminidiy',
      icon: 'fab fa-patreon',
      btnClass: 'is-patreon',
    },
    {
      id: 'newsletter',
      label: t('links.newsletter.label'),
      sub: t('links.newsletter.sub'),
      href: 'https://classicminidiy.substack.com/',
      icon: 'fad fa-envelope-open-text',
      btnClass: 'btn-primary',
    },
    {
      id: 'store',
      label: t('links.store.label'),
      sub: t('links.store.sub'),
      href: 'https://store.classicminidiy.com/',
      icon: 'fad fa-store',
      btnClass: 'btn-secondary',
    },
  ]);

  const secondaryLinks = computed<LinkItem[]>(() => [
    {
      id: 'toolbox',
      label: t('links.toolbox.label'),
      href: '/technical',
      icon: 'fad fa-toolbox',
      btnClass: 'btn-neutral',
    },
    {
      id: 'maps',
      label: t('links.maps.label'),
      href: '/maps',
      icon: 'fad fa-map',
      btnClass: 'btn-neutral',
    },
  ]);

  function trackClick(link: { id: string; label: string; href: string }, group: string) {
    capture('links_page_click', {
      link_id: link.id,
      label: link.label,
      destination: link.href,
      group,
    });
  }

  const { data: videos, status, error } = await useFetch('/api/youtube/videos', {
    query: { limit: 10 },
    key: 'links-page-videos',
  });

  useHead(() => ({
    title: t('links.seo.title'),
    meta: [
      { name: 'description', content: t('links.seo.description') },
      { name: 'keywords', content: t('links.seo.keywords') },
    ],
    link: [
      { rel: 'canonical', href: 'https://classicminidiy.com/links' },
      { rel: 'preconnect', href: 'https://classicminidiy.s3.amazonaws.com' },
    ],
  }));

  useSeoMeta({
    ogTitle: () => t('links.seo.title'),
    ogDescription: () => t('links.seo.description'),
    ogUrl: 'https://classicminidiy.com/links',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/root.jpg',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: () => t('links.seo.title'),
    twitterDescription: () => t('links.seo.description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/root.jpg',
  });

  const allLinks = computed(() => [...primaryLinks.value, ...secondaryLinks.value]);
  const linksJsonLd = computed(() => ({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t('links.seo.title'),
    url: 'https://classicminidiy.com/links',
    description: t('links.seo.description'),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: allLinks.value.map((link, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: link.label,
        url: link.href,
      })),
    },
  }));

  useHead(() => ({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(linksJsonLd.value),
      },
    ],
  }));
</script>

<template>
  <div class="bg-base-200">
    <div class="container mx-auto px-4 py-10 md:py-16">
      <div class="max-w-md mx-auto">
        <div class="flex flex-col items-center text-center mb-8">
          <nuxt-img
            src="https://classicminidiy.s3.amazonaws.com/misc/seo-images/avatar.jpg"
            alt="Classic Mini DIY"
            width="120"
            height="120"
            loading="eager"
            class="rounded-full shadow-lg ring-4 ring-base-100 mb-4"
          />
          <h1 class="fancy-font-bold text-3xl md:text-4xl">{{ t('links.heading') }}</h1>
          <p class="fancy-font-book-oblique text-base-content/70 mt-2">{{ t('links.tagline') }}</p>
        </div>

        <div class="flex flex-col gap-3 mb-6">
          <a
            v-for="link in primaryLinks"
            :key="link.id"
            :href="link.href"
            target="_blank"
            rel="noopener"
            :class="['btn', 'btn-block', 'btn-lg', 'h-auto', 'min-h-16', 'py-3', 'justify-start', link.btnClass]"
            @click="trackClick(link, 'primary')"
          >
            <i :class="[link.icon, 'text-2xl', 'shrink-0', 'w-8']"></i>
            <span class="flex flex-col items-start text-left leading-tight grow">
              <span class="font-bold">{{ link.label }}</span>
              <span v-if="link.sub" class="text-xs font-normal opacity-80">{{ link.sub }}</span>
            </span>
            <i class="fas fa-arrow-right opacity-60 shrink-0"></i>
          </a>
        </div>

        <div class="flex flex-col gap-2">
          <NuxtLink
            v-for="link in secondaryLinks"
            :key="link.id"
            :to="link.href"
            :target="link.href.startsWith('/') ? undefined : '_blank'"
            :rel="link.href.startsWith('/') ? undefined : 'noopener'"
            :class="['btn', 'btn-block', 'btn-md', 'justify-start', 'btn-outline']"
            @click="trackClick(link, 'secondary')"
          >
            <i :class="[link.icon, 'text-lg', 'w-6']"></i>
            <span class="font-medium">{{ link.label }}</span>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>

  <div class="container mx-auto px-4 py-12">
    <div class="max-w-5xl mx-auto">
      <div class="text-center mb-8">
        <p class="fancy-font-book-oblique"><i class="fab fa-youtube text-red-600"></i> {{ t('links.videos.eyebrow') }}</p>
        <h2 class="text-3xl font-bold pt-2">{{ t('links.videos.heading') }}</h2>
      </div>

      <div v-if="status === 'pending'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="i in 6" :key="i" class="card bg-base-200 animate-pulse h-80"></div>
      </div>

      <div v-else-if="error" class="alert alert-warning">
        <i class="fas fa-triangle-exclamation"></i>
        <span>{{ t('links.videos.error') }}</span>
      </div>

      <div v-else-if="videos && videos.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <a
          v-for="video in videos"
          :key="video.videoUrl"
          :href="video.videoUrl"
          target="_blank"
          rel="noopener"
          class="card bg-base-100 shadow-md border border-base-300 overflow-hidden hover:shadow-lg transition-shadow"
          @click="capture('links_page_click', { link_id: 'video', group: 'video', destination: video.videoUrl, label: video.title })"
        >
          <figure class="relative">
            <nuxt-picture
              :src="video.thumbnails.maxres"
              :alt="video.title"
              class="w-full"
              loading="lazy"
              width="720"
              height="404"
            />
            <span class="absolute inset-0 flex items-center justify-center">
              <span class="rounded-full bg-black/60 text-white w-14 h-14 flex items-center justify-center">
                <i class="fas fa-play text-xl"></i>
              </span>
            </span>
          </figure>
          <div class="card-body p-4">
            <h3 class="card-title text-base font-semibold line-clamp-2">{{ video.title }}</h3>
            <p class="text-xs text-base-content/60">{{ t('links.videos.published_on') }} {{ video.publishedOn }}</p>
          </div>
        </a>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>

<i18n lang="json">
{
  "en": {
    "links": {
      "heading": "Classic Mini DIY",
      "tagline": "Your friendly neighborhood Classic Mini resource",
      "patreon": {
        "label": "Support on Patreon",
        "sub": "Help keep the channel rolling"
      },
      "newsletter": {
        "label": "Subscribe to the Newsletter",
        "sub": "Build updates, deep dives, and project notes"
      },
      "store": {
        "label": "CMDIY Store",
        "sub": "Merch, tools, and Mini gear"
      },
      "toolbox": { "label": "Online Toolbox" },
      "maps": { "label": "ECU Maps" },
      "videos": {
        "eyebrow": "FROM THE CHANNEL",
        "heading": "Latest YouTube Videos",
        "published_on": "Published",
        "error": "Couldn't load videos right now — try the YouTube channel directly."
      },
      "seo": {
        "title": "Links | Classic Mini DIY",
        "description": "Every Classic Mini DIY link in one place — Patreon, newsletter, store, toolbox, ECU maps, and the latest YouTube videos.",
        "keywords": "classic mini diy, links, patreon, newsletter, store, youtube, classic mini cooper"
      }
    }
  },
  "es": {
    "links": {
      "heading": "Classic Mini DIY",
      "tagline": "Tu recurso amigable de Classic Mini",
      "patreon": {
        "label": "Apoya en Patreon",
        "sub": "Ayuda a mantener el canal en marcha"
      },
      "newsletter": {
        "label": "Suscríbete al boletín",
        "sub": "Actualizaciones, análisis y notas de proyectos"
      },
      "store": {
        "label": "Tienda CMDIY",
        "sub": "Mercancía, herramientas y artículos Mini"
      },
      "toolbox": { "label": "Caja de herramientas en línea" },
      "maps": { "label": "Mapas ECU" },
      "videos": {
        "eyebrow": "DEL CANAL",
        "heading": "Últimos videos de YouTube",
        "published_on": "Publicado",
        "error": "No se pudieron cargar los videos — visita el canal de YouTube directamente."
      },
      "seo": {
        "title": "Enlaces | Classic Mini DIY",
        "description": "Todos los enlaces de Classic Mini DIY en un solo lugar: Patreon, boletín, tienda, caja de herramientas, mapas ECU y los últimos videos.",
        "keywords": "classic mini diy, enlaces, patreon, boletín, tienda, youtube, classic mini cooper"
      }
    }
  },
  "fr": {
    "links": {
      "heading": "Classic Mini DIY",
      "tagline": "Votre ressource amicale Classic Mini",
      "patreon": {
        "label": "Soutenir sur Patreon",
        "sub": "Aidez à faire vivre la chaîne"
      },
      "newsletter": {
        "label": "S'abonner à la newsletter",
        "sub": "Mises à jour, analyses et notes de projet"
      },
      "store": {
        "label": "Boutique CMDIY",
        "sub": "Produits, outils et accessoires Mini"
      },
      "toolbox": { "label": "Boîte à outils en ligne" },
      "maps": { "label": "Cartes ECU" },
      "videos": {
        "eyebrow": "DE LA CHAÎNE",
        "heading": "Dernières vidéos YouTube",
        "published_on": "Publié",
        "error": "Impossible de charger les vidéos — visitez la chaîne YouTube directement."
      },
      "seo": {
        "title": "Liens | Classic Mini DIY",
        "description": "Tous les liens Classic Mini DIY en un seul endroit : Patreon, newsletter, boutique, boîte à outils, cartes ECU et dernières vidéos.",
        "keywords": "classic mini diy, liens, patreon, newsletter, boutique, youtube, classic mini cooper"
      }
    }
  },
  "it": {
    "links": {
      "heading": "Classic Mini DIY",
      "tagline": "La tua risorsa amichevole Classic Mini",
      "patreon": {
        "label": "Supporta su Patreon",
        "sub": "Aiuta a mantenere vivo il canale"
      },
      "newsletter": {
        "label": "Iscriviti alla newsletter",
        "sub": "Aggiornamenti, approfondimenti e note di progetto"
      },
      "store": {
        "label": "Negozio CMDIY",
        "sub": "Merch, strumenti e articoli Mini"
      },
      "toolbox": { "label": "Cassetta degli attrezzi online" },
      "maps": { "label": "Mappe ECU" },
      "videos": {
        "eyebrow": "DAL CANALE",
        "heading": "Ultimi video YouTube",
        "published_on": "Pubblicato",
        "error": "Impossibile caricare i video — visita il canale YouTube direttamente."
      },
      "seo": {
        "title": "Link | Classic Mini DIY",
        "description": "Tutti i link Classic Mini DIY in un unico posto: Patreon, newsletter, negozio, cassetta degli attrezzi, mappe ECU e ultimi video.",
        "keywords": "classic mini diy, link, patreon, newsletter, negozio, youtube, classic mini cooper"
      }
    }
  },
  "de": {
    "links": {
      "heading": "Classic Mini DIY",
      "tagline": "Ihre freundliche Classic Mini Ressource",
      "patreon": {
        "label": "Auf Patreon unterstützen",
        "sub": "Hilf, den Kanal am Leben zu halten"
      },
      "newsletter": {
        "label": "Newsletter abonnieren",
        "sub": "Updates, Analysen und Projektnotizen"
      },
      "store": {
        "label": "CMDIY Shop",
        "sub": "Merch, Werkzeuge und Mini-Zubehör"
      },
      "toolbox": { "label": "Online-Werkzeugkasten" },
      "maps": { "label": "ECU-Maps" },
      "videos": {
        "eyebrow": "VOM KANAL",
        "heading": "Neueste YouTube-Videos",
        "published_on": "Veröffentlicht",
        "error": "Videos konnten nicht geladen werden — besuche den YouTube-Kanal direkt."
      },
      "seo": {
        "title": "Links | Classic Mini DIY",
        "description": "Alle Classic Mini DIY Links an einem Ort: Patreon, Newsletter, Shop, Werkzeugkasten, ECU-Maps und neueste Videos.",
        "keywords": "classic mini diy, links, patreon, newsletter, shop, youtube, classic mini cooper"
      }
    }
  },
  "pt": {
    "links": {
      "heading": "Classic Mini DIY",
      "tagline": "Seu recurso amigável Classic Mini",
      "patreon": {
        "label": "Apoie no Patreon",
        "sub": "Ajude a manter o canal funcionando"
      },
      "newsletter": {
        "label": "Assine a newsletter",
        "sub": "Atualizações, análises e notas de projeto"
      },
      "store": {
        "label": "Loja CMDIY",
        "sub": "Mercadorias, ferramentas e itens Mini"
      },
      "toolbox": { "label": "Caixa de ferramentas online" },
      "maps": { "label": "Mapas ECU" },
      "videos": {
        "eyebrow": "DO CANAL",
        "heading": "Vídeos recentes do YouTube",
        "published_on": "Publicado",
        "error": "Não foi possível carregar os vídeos — visite o canal do YouTube diretamente."
      },
      "seo": {
        "title": "Links | Classic Mini DIY",
        "description": "Todos os links Classic Mini DIY em um só lugar: Patreon, newsletter, loja, caixa de ferramentas, mapas ECU e vídeos recentes.",
        "keywords": "classic mini diy, links, patreon, newsletter, loja, youtube, classic mini cooper"
      }
    }
  },
  "ru": {
    "links": {
      "heading": "Classic Mini DIY",
      "tagline": "Ваш дружелюбный ресурс Classic Mini",
      "patreon": {
        "label": "Поддержать на Patreon",
        "sub": "Помогите сохранить канал"
      },
      "newsletter": {
        "label": "Подписаться на рассылку",
        "sub": "Обновления, разборы и заметки о проектах"
      },
      "store": {
        "label": "Магазин CMDIY",
        "sub": "Товары, инструменты и аксессуары Mini"
      },
      "toolbox": { "label": "Онлайн-инструменты" },
      "maps": { "label": "Карты ECU" },
      "videos": {
        "eyebrow": "С КАНАЛА",
        "heading": "Последние видео YouTube",
        "published_on": "Опубликовано",
        "error": "Не удалось загрузить видео — посетите канал YouTube напрямую."
      },
      "seo": {
        "title": "Ссылки | Classic Mini DIY",
        "description": "Все ссылки Classic Mini DIY в одном месте: Patreon, рассылка, магазин, инструменты, карты ECU и последние видео.",
        "keywords": "classic mini diy, ссылки, patreon, рассылка, магазин, youtube, classic mini cooper"
      }
    }
  },
  "ja": {
    "links": {
      "heading": "Classic Mini DIY",
      "tagline": "あなたの親しみやすいClassic Miniリソース",
      "patreon": {
        "label": "Patreonでサポート",
        "sub": "チャンネルの運営を支援"
      },
      "newsletter": {
        "label": "ニュースレターを購読",
        "sub": "アップデート、詳細解説、プロジェクトノート"
      },
      "store": {
        "label": "CMDIYストア",
        "sub": "グッズ、ツール、Miniアイテム"
      },
      "toolbox": { "label": "オンラインツールボックス" },
      "maps": { "label": "ECUマップ" },
      "videos": {
        "eyebrow": "チャンネルから",
        "heading": "最新のYouTube動画",
        "published_on": "公開日",
        "error": "動画を読み込めませんでした — YouTubeチャンネルを直接ご確認ください。"
      },
      "seo": {
        "title": "リンク | Classic Mini DIY",
        "description": "Classic Mini DIYのすべてのリンクを一箇所に：Patreon、ニュースレター、ストア、ツールボックス、ECUマップ、最新動画。",
        "keywords": "classic mini diy, リンク, patreon, ニュースレター, ストア, youtube, classic mini cooper"
      }
    }
  },
  "zh": {
    "links": {
      "heading": "Classic Mini DIY",
      "tagline": "您友好的 Classic Mini 资源",
      "patreon": {
        "label": "在 Patreon 上支持",
        "sub": "帮助维持频道运营"
      },
      "newsletter": {
        "label": "订阅时事通讯",
        "sub": "更新、深度解析和项目笔记"
      },
      "store": {
        "label": "CMDIY 商店",
        "sub": "商品、工具和 Mini 配件"
      },
      "toolbox": { "label": "在线工具箱" },
      "maps": { "label": "ECU 地图" },
      "videos": {
        "eyebrow": "来自频道",
        "heading": "最新 YouTube 视频",
        "published_on": "发布于",
        "error": "暂时无法加载视频 — 请直接访问 YouTube 频道。"
      },
      "seo": {
        "title": "链接 | Classic Mini DIY",
        "description": "所有 Classic Mini DIY 链接集中一处：Patreon、时事通讯、商店、工具箱、ECU 地图和最新视频。",
        "keywords": "classic mini diy, 链接, patreon, 时事通讯, 商店, youtube, classic mini cooper"
      }
    }
  },
  "ko": {
    "links": {
      "heading": "Classic Mini DIY",
      "tagline": "당신의 친근한 Classic Mini 리소스",
      "patreon": {
        "label": "Patreon에서 지원",
        "sub": "채널 운영을 도와주세요"
      },
      "newsletter": {
        "label": "뉴스레터 구독",
        "sub": "업데이트, 심층 분석, 프로젝트 노트"
      },
      "store": {
        "label": "CMDIY 스토어",
        "sub": "상품, 도구 및 Mini 용품"
      },
      "toolbox": { "label": "온라인 도구상자" },
      "maps": { "label": "ECU 맵" },
      "videos": {
        "eyebrow": "채널에서",
        "heading": "최신 YouTube 동영상",
        "published_on": "게시일",
        "error": "동영상을 불러올 수 없습니다 — YouTube 채널을 직접 방문하세요."
      },
      "seo": {
        "title": "링크 | Classic Mini DIY",
        "description": "Classic Mini DIY의 모든 링크를 한곳에: Patreon, 뉴스레터, 스토어, 도구상자, ECU 맵, 최신 동영상.",
        "keywords": "classic mini diy, 링크, patreon, 뉴스레터, 스토어, youtube, classic mini cooper"
      }
    }
  }
}
</i18n>
