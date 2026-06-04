<script setup lang="ts">
  import { HERO_TYPES } from '../../data/models/generic';

  const { t } = useI18n();
  const { track, trackOutbound } = useAnalytics();
  let styleObject: any;

  const props = defineProps({
    title: {
      type: String,
      default: '',
    },
    titleKey: {
      type: String,
      default: '',
    },
    showImage: {
      type: Boolean,
      default: true,
    },
    blog: {
      type: Boolean,
      default: false,
    },
    ecuMap: {
      type: Boolean,
      default: false,
    },
    subtitle: {
      type: String,
      default: '',
    },
    subtitleKey: {
      type: String,
      default: '',
    },
    textSize: {
      type: String,
      default: '',
    },
    special: {
      type: Boolean,
      default: false,
    },
    heroType: {
      type: String as PropType<HERO_TYPES>,
      required: true,
      default: HERO_TYPES.TECH,
    },
    background: {
      type: String,
      default: '/technical',
    },
    centered: {
      type: Boolean,
      default: false,
    },
  });

  const displayTitle = computed(() => {
    return props.titleKey ? t(props.titleKey) : props.title;
  });

  const displaySubtitle = computed(() => {
    return props.subtitleKey ? t(props.subtitleKey) : props.subtitle;
  });

  switch (props.heroType) {
    case HERO_TYPES.HOME:
      styleObject = {
        backgroundImage: `url(https://classicminidiy.s3.amazonaws.com/misc${props.background}.webp)`,
        backgroundSize: 'contain',
        backgroundPosition: 'right',
      };
      break;
    case HERO_TYPES.TECH:
      styleObject = {
        backgroundImage: `url(https://classicminidiy.s3.amazonaws.com/misc${props.background}.webp)`,
      };
      break;
    case HERO_TYPES.ARCHIVE:
      styleObject = {
        backgroundImage: `url(https://classicminidiy.s3.amazonaws.com/misc/archive2.jpg)`,
      };
      break;
    case HERO_TYPES.BLOG:
      styleObject = { backgroundImage: `url(https://classicminidiy.s3.us-east-1.amazonaws.com/misc/typewriter.jpg)` };
      break;
    case HERO_TYPES.MAPS:
      styleObject = { backgroundImage: `url(https://classicminidiy.s3.us-east-1.amazonaws.com/misc/macbook.jpg)` };
      break;
    default:
      styleObject = {
        backgroundImage: `url(https://classicminidiy.s3.amazonaws.com/misc${props.background}.webp)`,
      };
      break;
  }
</script>

<template>
  <section
    class="hero-section relative flex bg-[#242424] bg-cover bg-center bg-no-repeat"
    :class="{
      [textSize]: textSize,
      'hero-section--scrim': displayTitle || displaySubtitle,
      'md:h-144 sm:h-96': heroType === HERO_TYPES.HOME,
      'md:h-60 sm:h-48': heroType === HERO_TYPES.TECH || heroType === HERO_TYPES.ARCHIVE,
      'md:h-112 sm:h-96': heroType === HERO_TYPES.BLOG || heroType === HERO_TYPES.MAPS,
    }"
    :style="[!showImage ? { backgroundImage: 'none' } : styleObject]"
  >
    <div
      class="hero-content relative z-10 flex flex-col items-start justify-center"
      :style="[blog ? { paddingTop: '4rem', paddingBottom: '4rem' } : {}]"
    >
      <div class="pl-20" :class="{ 'text-center': centered }">
        <p class="eyebrow" :class="{ 'text-center': blog }">
          {{ displaySubtitle }}
        </p>
        <h1
          v-if="displayTitle"
          class="fancy-font-bold text-white text-4xl lg:text-5xl mt-2"
          :class="{ 'special-title': special, 'text-center': blog }"
        >
          <span v-if="heroType === HERO_TYPES.HOME">
            {{ t('home_title') }}
          </span>
          <span v-else>
            {{ displayTitle }}
          </span>
        </h1>
        <div v-if="heroType === HERO_TYPES.HOME" class="mt-6 flex flex-wrap gap-2">
          <NuxtLink to="/technical" class="btn btn-secondary" @click="track('home_cta_clicked', { cta: 'toolbox', location: 'hero' })">
            <i class="fad fa-toolbox mr-2"></i>{{ t('cta_open_toolbox') }}
          </NuxtLink>
          <a
            href="https://youtube.com/c/classicminidiy?sub_confirmation=1"
            target="_blank"
            rel="noopener"
            class="btn btn-outline text-white border-white/50 hover:bg-white/10 hover:border-white"
            @click="trackOutbound({ destination: 'https://youtube.com/c/classicminidiy?sub_confirmation=1', group: 'youtube_channel', location: 'hero' })"
          >
            <i class="fab fa-youtube mr-2"></i>{{ t('cta_watch_channel') }}
          </a>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
  .hero-section {
    /* Text-protection scrim — sits between the bg image and content
       so white titles and the orange eyebrow stay legible on busy
       photographic backgrounds. Only applied when the hero has text
       to protect (.hero-section--scrim); otherwise the decorative
       photo shows clean. Tone is driven by --cm-scrim-bg so the dark
       theme can supply a deeper alpha. */
    &.hero-section--scrim::before {
      content: '';
      position: absolute;
      inset: 0;
      background-color: var(--cm-scrim-bg);
      pointer-events: none;
    }

    .special-title {
      font-size: 100px;
    }

    @media screen and (max-width: 1023px) {
      .special-title {
        font-size: 2rem;
      }
    }
  }
</style>

<i18n lang="json">
{
  "en": {
    "home_title": "Classic Mini DIY",
    "home_subtitle": "YOUR FRIENDLY NEIGHBORHOOD",
    "cta_open_toolbox": "Open the Toolbox",
    "cta_watch_channel": "Watch the channel"
  },
  "es": {
    "home_title": "Classic Mini DIY",
    "home_subtitle": "TU RECURSO AMIGABLE DEL BARRIO",
    "cta_open_toolbox": "Abrir la caja de herramientas",
    "cta_watch_channel": "Ver el canal"
  },
  "fr": {
    "home_title": "Classic Mini DIY",
    "home_subtitle": "VOTRE RESSOURCE AMICALE DE QUARTIER",
    "cta_open_toolbox": "Ouvrir la boîte à outils",
    "cta_watch_channel": "Voir la chaîne"
  },
  "de": {
    "home_title": "Classic Mini DIY",
    "home_subtitle": "IHRE FREUNDLICHE NACHBARSCHAFTSRESSOURCE",
    "cta_open_toolbox": "Werkzeugkasten öffnen",
    "cta_watch_channel": "Kanal ansehen"
  },
  "it": {
    "home_title": "Classic Mini DIY",
    "home_subtitle": "LA TUA RISORSA AMICHEVOLE DI QUARTIERE",
    "cta_open_toolbox": "Apri la cassetta degli attrezzi",
    "cta_watch_channel": "Guarda il canale"
  },
  "ja": {
    "home_title": "Classic Mini DIY",
    "home_subtitle": "あなたの親しみやすい近所のリソース",
    "cta_open_toolbox": "ツールボックスを開く",
    "cta_watch_channel": "チャンネルを見る"
  },
  "ko": {
    "home_title": "Classic Mini DIY",
    "home_subtitle": "당신의 친근한 동네 리소스",
    "cta_open_toolbox": "도구상자 열기",
    "cta_watch_channel": "채널 보기"
  },
  "pt": {
    "home_title": "Classic Mini DIY",
    "home_subtitle": "SEU RECURSO AMIGÁVEL DA VIZINHANÇA",
    "cta_open_toolbox": "Abrir a caixa de ferramentas",
    "cta_watch_channel": "Ver o canal"
  },
  "ru": {
    "home_title": "Classic Mini DIY",
    "home_subtitle": "ВАШ ДРУЖЕЛЮБНЫЙ СОСЕДСКИЙ РЕСУРС",
    "cta_open_toolbox": "Открыть набор инструментов",
    "cta_watch_channel": "Смотреть канал"
  },
  "zh": {
    "home_title": "Classic Mini DIY",
    "home_subtitle": "您友好的邻里资源",
    "cta_open_toolbox": "打开工具箱",
    "cta_watch_channel": "观看频道"
  }
}
</i18n>
