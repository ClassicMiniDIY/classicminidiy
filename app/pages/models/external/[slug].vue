<script setup lang="ts">
  import { HERO_TYPES } from '~~/data/models/generic';
  import type { ExternalModelDetail } from '~~/data/models/external-models';

  const { t } = useI18n();
  const route = useRoute();
  const slug = computed(() => String(route.params.slug));

  const { data, error } = await useFetch<ExternalModelDetail>(() => `/api/models/external/${slug.value}`);
  if (error.value) {
    throw createError({ statusCode: error.value.statusCode || 404, statusMessage: 'Model not found', fatal: true });
  }
  const model = computed(() => data.value);

  // ── SEO ──────────────────────────────────────────────────────────────────────
  const SITE_DEFAULT_OG = 'https://classicminidiy.s3.us-east-1.amazonaws.com/misc/seo-images/avatar.jpg';

  const seoTitle = computed(() =>
    model.value ? `${model.value.title} | Classic Mini DIY` : t('meta.defaultTitle')
  );
  const seoDesc = computed(() => {
    const m = model.value;
    if (!m) return t('meta.defaultDescription');
    const raw = m.summary || m.description || '';
    const clean = raw.replace(/\s+/g, ' ').trim();
    return clean.length > 160 ? `${clean.slice(0, 159).trimEnd()}…` : clean || t('meta.defaultDescription');
  });
  const seoImage = computed(() => {
    const m = model.value;
    if (!m) return SITE_DEFAULT_OG;
    return m.images.find((i) => i.isPrimary)?.url ?? m.images[0]?.url ?? SITE_DEFAULT_OG;
  });

  useHead(() => ({ title: seoTitle.value }));
  useSeoMeta({
    description: () => seoDesc.value,
    ogTitle: () => seoTitle.value,
    ogDescription: () => seoDesc.value,
    ogImage: () => seoImage.value,
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: () => seoTitle.value,
    twitterDescription: () => seoDesc.value,
    twitterImage: () => seoImage.value,
  });

  // ── Analytics ─────────────────────────────────────────────────────────────────
  const { track } = useAnalytics();
  onMounted(() => {
    if (!model.value) return;
    track('external_model_viewed', { source_site: model.value.sourceSite, slug: model.value.slug });
  });

  // ── Image gallery ─────────────────────────────────────────────────────────────
  type GalleryImage = { url: string; alt: string };
  const activeImage = ref<GalleryImage | null>(null);

  function initGallery() {
    const m = model.value;
    if (!m || !m.images.length) {
      activeImage.value = null;
      return;
    }
    const primary = m.images.find((i) => i.isPrimary) ?? m.images[0]!;
    activeImage.value = { url: primary.url, alt: primary.altText || m.title };
  }
  watch(model, initGallery, { immediate: true });
</script>

<template>
  <hero :navigation="true" :title="t('hero.title')" :heroType="HERO_TYPES.ARCHIVE" />
  <div class="container mx-auto px-4" v-if="model">
    <breadcrumb class="my-6" :page="model.title" :subpage="t('breadcrumb.subpage')" subpageHref="/models" />

    <!-- MakerWorld-style layout: media on the left, sticky action panel on the right -->
    <div class="grid grid-cols-12 gap-6 items-start">
      <!-- MEDIA (mobile: first; desktop: top-left) -->
      <div class="col-span-12 lg:col-span-8 lg:col-start-1 lg:row-start-1 space-y-3">
        <!-- Active image display -->
        <div
          v-if="activeImage"
          class="rounded-xl overflow-hidden border border-base-300 bg-base-200"
          style="aspect-ratio: 4 / 3"
        >
          <img :src="activeImage.url" :alt="activeImage.alt" class="w-full h-full object-contain" />
        </div>
        <!-- No images placeholder -->
        <div
          v-else
          class="rounded-xl border border-base-300 bg-base-200 flex items-center justify-center"
          style="aspect-ratio: 4 / 3"
        >
          <i class="fas fa-cube text-5xl opacity-20"></i>
        </div>

        <!-- Thumbnail strip: only shown when there are multiple images -->
        <div v-if="model.images.length > 1" class="flex flex-wrap gap-2">
          <button
            v-for="img in model.images"
            :key="img.id"
            class="w-16 h-16 rounded-lg border-2 overflow-hidden"
            :class="
              activeImage?.url === img.url
                ? 'border-primary'
                : 'border-base-300 hover:border-primary/50'
            "
            @click="activeImage = { url: img.url, alt: img.altText || model.title }"
          >
            <img :src="img.url" :alt="img.altText || model.title" class="w-full h-full object-cover" loading="lazy" />
          </button>
        </div>
      </div>

      <!-- ACTION PANEL (mobile: right after media; desktop: right column, sticky) -->
      <div class="col-span-12 lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:row-span-2">
        <div class="lg:sticky lg:top-4 space-y-4">
          <!-- Title + summary -->
          <div>
            <h1 class="text-2xl font-bold leading-tight">{{ model.title }}</h1>
            <p v-if="model.summary" class="mt-1 text-sm opacity-70">{{ model.summary }}</p>
          </div>

          <!-- Source badge -->
          <div>
            <ModelsSourceBadge :site="model.sourceSite" size="lg" />
          </div>

          <!-- Stats row -->
          <div class="flex items-center gap-3 flex-wrap text-sm">
            <ModelsExternalModelLikeButton :external-model-id="model.id" :initial-count="model.likeCount" />
            <span class="opacity-70">
              <i class="fas fa-arrow-up-right-from-square mr-1"></i>{{ model.clickCount }}
              <span class="ml-0.5 text-xs">{{ t('stats.visits') }}</span>
            </span>
          </div>

          <!-- Hero CTA card -->
          <div class="card bg-base-100 border border-base-300 shadow-md">
            <div class="card-body p-5 gap-4">
              <!-- Outbound link button -->
              <ModelsExternalLinkButton
                :external-model-id="model.id"
                :slug="model.slug"
                :source-url="model.sourceUrl"
                :site="model.sourceSite"
              />

              <!-- External-hosting notice -->
              <p class="text-xs opacity-60 text-center leading-relaxed">
                {{ t('externalNotice') }}
              </p>

              <!-- Attribution -->
              <div v-if="model.sourceAuthorName" class="flex items-center gap-1.5 text-sm">
                <i class="fas fa-user-pen opacity-50 text-xs"></i>
                <span class="opacity-70">{{ t('attribution.by') }}</span>
                <a
                  v-if="model.sourceAuthorUrl"
                  :href="model.sourceAuthorUrl"
                  target="_blank"
                  rel="nofollow noopener"
                  class="link link-hover font-semibold"
                >{{ model.sourceAuthorName }}</a>
                <span v-else class="font-semibold">{{ model.sourceAuthorName }}</span>
              </div>
            </div>
          </div>

          <!-- Source license card -->
          <div class="card bg-base-100 border border-base-300 shadow-sm">
            <div class="card-body p-4 gap-3">
              <h3 class="text-xs font-semibold uppercase tracking-wide opacity-50">{{ t('license.heading') }}</h3>

              <p class="text-sm font-medium">
                {{ model.sourceLicense || t('license.notSpecified') }}
              </p>

              <!-- remixesAllowed / commercialUseAllowed chips (only when not null) -->
              <div
                v-if="model.remixesAllowed !== null || model.commercialUseAllowed !== null"
                class="flex flex-wrap gap-1.5"
              >
                <span
                  v-if="model.remixesAllowed !== null"
                  class="badge badge-sm gap-1"
                  :class="model.remixesAllowed ? 'badge-success' : 'badge-error badge-outline'"
                >
                  <i class="fas text-[0.55rem]" :class="model.remixesAllowed ? 'fa-check' : 'fa-xmark'"></i>
                  {{ model.remixesAllowed ? t('license.remixYes') : t('license.remixNo') }}
                </span>
                <span
                  v-if="model.commercialUseAllowed !== null"
                  class="badge badge-sm gap-1"
                  :class="model.commercialUseAllowed ? 'badge-success' : 'badge-error badge-outline'"
                >
                  <i class="fas text-[0.55rem]" :class="model.commercialUseAllowed ? 'fa-check' : 'fa-xmark'"></i>
                  {{ model.commercialUseAllowed ? t('license.commercialYes') : t('license.commercialNo') }}
                </span>
              </div>

              <p class="text-xs opacity-50 leading-relaxed">{{ t('license.disclaimer') }}</p>
            </div>
          </div>

          <!-- Print settings (only when non-empty) -->
          <ModelsModelPrintSettings :settings="model.printSettings" />

          <!-- Tags -->
          <div v-if="model.tags.length" class="flex flex-wrap gap-1.5">
            <span v-for="tag in model.tags" :key="tag" class="badge badge-ghost badge-sm">#{{ tag }}</span>
          </div>
        </div>
      </div>

      <!-- CONTENT (below media on left column) -->
      <div class="col-span-12 lg:col-span-8 lg:col-start-1 lg:row-start-2 space-y-6">
        <!-- Description -->
        <div v-if="model.description" class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h2 class="card-title text-lg">
              <i class="fas fa-align-left text-primary mr-1"></i> {{ t('about.heading') }}
            </h2>
            <p class="whitespace-pre-line text-sm leading-relaxed">{{ model.description }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Support -->
    <div class="md:w-10/12 md:mx-auto pb-10 pt-6">
      <patreon-card size="large" />
    </div>
  </div>

  <!-- Not-found state (when fetch 404s, createError handles it server-side,
       but guard against null data on CSR navigations just in case) -->
  <div v-else class="container mx-auto px-4 py-24 text-center space-y-4">
    <i class="fas fa-cube text-6xl opacity-20"></i>
    <h1 class="text-2xl font-bold">{{ t('notFound.title') }}</h1>
    <p class="opacity-60">{{ t('notFound.body') }}</p>
    <NuxtLink to="/models" class="btn btn-primary">{{ t('notFound.cta') }}</NuxtLink>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "hero": { "title": "3D Model Library" },
    "breadcrumb": { "subpage": "3D Models" },
    "meta": {
      "defaultTitle": "External 3D Model | Classic Mini DIY",
      "defaultDescription": "A community-shared 3D-printable part for the Classic Mini, sourced from around the web."
    },
    "externalNotice": "This model is hosted on an external site. Downloads happen directly on the source platform.",
    "attribution": { "by": "Originally shared by" },
    "stats": { "visits": "outbound visits" },
    "license": {
      "heading": "Source license",
      "notSpecified": "Not specified",
      "remixYes": "Remixes allowed",
      "remixNo": "No remixes",
      "commercialYes": "Commercial use OK",
      "commercialNo": "No commercial use",
      "disclaimer": "License information is reported by the source site and is not a Classic Mini DIY license. Verify terms on the original listing before use."
    },
    "about": { "heading": "About this model" },
    "notFound": {
      "title": "Model not found",
      "body": "This listing may have been removed or the link is incorrect.",
      "cta": "Browse all models"
    }
  },
  "es": {
    "hero": { "title": "Biblioteca de modelos 3D" },
    "breadcrumb": { "subpage": "Modelos 3D" },
    "meta": {
      "defaultTitle": "Modelo 3D externo | Classic Mini DIY",
      "defaultDescription": "Una pieza imprimible en 3D para el Classic Mini, compartida por la comunidad desde la web."
    },
    "externalNotice": "Este modelo está alojado en un sitio externo. Las descargas se realizan directamente en la plataforma de origen.",
    "attribution": { "by": "Compartido originalmente por" },
    "stats": { "visits": "visitas salientes" },
    "license": {
      "heading": "Licencia de origen",
      "notSpecified": "No especificada",
      "remixYes": "Remixes permitidos",
      "remixNo": "Sin remixes",
      "commercialYes": "Uso comercial permitido",
      "commercialNo": "Sin uso comercial",
      "disclaimer": "La información de licencia es reportada por el sitio de origen y no es una licencia de Classic Mini DIY. Verifique los términos en el listado original antes de usar."
    },
    "about": { "heading": "Acerca de este modelo" },
    "notFound": {
      "title": "Modelo no encontrado",
      "body": "Este listado puede haber sido eliminado o el enlace es incorrecto.",
      "cta": "Ver todos los modelos"
    }
  },
  "fr": {
    "hero": { "title": "Bibliothèque de modèles 3D" },
    "breadcrumb": { "subpage": "Modèles 3D" },
    "meta": {
      "defaultTitle": "Modèle 3D externe | Classic Mini DIY",
      "defaultDescription": "Une pièce imprimable en 3D pour la Classic Mini, partagée par la communauté depuis le web."
    },
    "externalNotice": "Ce modèle est hébergé sur un site externe. Les téléchargements s'effectuent directement sur la plateforme source.",
    "attribution": { "by": "Partagé à l'origine par" },
    "stats": { "visits": "visites sortantes" },
    "license": {
      "heading": "Licence source",
      "notSpecified": "Non spécifiée",
      "remixYes": "Remixes autorisés",
      "remixNo": "Pas de remixes",
      "commercialYes": "Usage commercial autorisé",
      "commercialNo": "Pas d'usage commercial",
      "disclaimer": "Les informations de licence sont fournies par le site source et ne constituent pas une licence Classic Mini DIY. Vérifiez les conditions sur l'annonce originale avant utilisation."
    },
    "about": { "heading": "À propos de ce modèle" },
    "notFound": {
      "title": "Modèle introuvable",
      "body": "Cette annonce a peut-être été supprimée ou le lien est incorrect.",
      "cta": "Parcourir tous les modèles"
    }
  },
  "de": {
    "hero": { "title": "3D-Modellbibliothek" },
    "breadcrumb": { "subpage": "3D-Modelle" },
    "meta": {
      "defaultTitle": "Externes 3D-Modell | Classic Mini DIY",
      "defaultDescription": "Ein 3D-druckbares Teil für den Classic Mini, aus der Community geteilt."
    },
    "externalNotice": "Dieses Modell wird auf einer externen Website gehostet. Downloads erfolgen direkt auf der Quellplattform.",
    "attribution": { "by": "Ursprünglich geteilt von" },
    "stats": { "visits": "ausgehende Besuche" },
    "license": {
      "heading": "Quelllizenz",
      "notSpecified": "Nicht angegeben",
      "remixYes": "Remixes erlaubt",
      "remixNo": "Keine Remixes",
      "commercialYes": "Kommerzielle Nutzung erlaubt",
      "commercialNo": "Keine kommerzielle Nutzung",
      "disclaimer": "Lizenzinformationen werden von der Quellseite bereitgestellt und sind keine Classic Mini DIY-Lizenz. Prüfen Sie die Bedingungen im Originaleintrag vor der Nutzung."
    },
    "about": { "heading": "Über dieses Modell" },
    "notFound": {
      "title": "Modell nicht gefunden",
      "body": "Dieser Eintrag wurde möglicherweise entfernt oder der Link ist falsch.",
      "cta": "Alle Modelle durchsuchen"
    }
  },
  "it": {
    "hero": { "title": "Libreria di modelli 3D" },
    "breadcrumb": { "subpage": "Modelli 3D" },
    "meta": {
      "defaultTitle": "Modello 3D esterno | Classic Mini DIY",
      "defaultDescription": "Un pezzo stampabile in 3D per la Classic Mini, condiviso dalla community dal web."
    },
    "externalNotice": "Questo modello è ospitato su un sito esterno. I download avvengono direttamente sulla piattaforma di origine.",
    "attribution": { "by": "Condiviso originariamente da" },
    "stats": { "visits": "visite in uscita" },
    "license": {
      "heading": "Licenza sorgente",
      "notSpecified": "Non specificata",
      "remixYes": "Remix consentiti",
      "remixNo": "Nessun remix",
      "commercialYes": "Uso commerciale consentito",
      "commercialNo": "Nessun uso commerciale",
      "disclaimer": "Le informazioni sulla licenza sono fornite dal sito sorgente e non costituiscono una licenza Classic Mini DIY. Verifica i termini nell'annuncio originale prima dell'uso."
    },
    "about": { "heading": "Informazioni su questo modello" },
    "notFound": {
      "title": "Modello non trovato",
      "body": "Questo annuncio potrebbe essere stato rimosso o il link non è corretto.",
      "cta": "Sfoglia tutti i modelli"
    }
  },
  "pt": {
    "hero": { "title": "Biblioteca de modelos 3D" },
    "breadcrumb": { "subpage": "Modelos 3D" },
    "meta": {
      "defaultTitle": "Modelo 3D externo | Classic Mini DIY",
      "defaultDescription": "Uma peça impressa em 3D para o Classic Mini, compartilhada pela comunidade da web."
    },
    "externalNotice": "Este modelo está hospedado em um site externo. Os downloads ocorrem diretamente na plataforma de origem.",
    "attribution": { "by": "Originalmente compartilhado por" },
    "stats": { "visits": "visitas de saída" },
    "license": {
      "heading": "Licença de origem",
      "notSpecified": "Não especificada",
      "remixYes": "Remixes permitidos",
      "remixNo": "Sem remixes",
      "commercialYes": "Uso comercial permitido",
      "commercialNo": "Sem uso comercial",
      "disclaimer": "As informações de licença são fornecidas pelo site de origem e não constituem uma licença da Classic Mini DIY. Verifique os termos no anúncio original antes de usar."
    },
    "about": { "heading": "Sobre este modelo" },
    "notFound": {
      "title": "Modelo não encontrado",
      "body": "Este anúncio pode ter sido removido ou o link está incorreto.",
      "cta": "Ver todos os modelos"
    }
  },
  "ru": {
    "hero": { "title": "Библиотека 3D-моделей" },
    "breadcrumb": { "subpage": "3D-модели" },
    "meta": {
      "defaultTitle": "Внешняя 3D-модель | Classic Mini DIY",
      "defaultDescription": "Деталь для 3D-печати для Classic Mini, опубликованная сообществом."
    },
    "externalNotice": "Эта модель размещена на внешнем сайте. Загрузки осуществляются непосредственно на исходной платформе.",
    "attribution": { "by": "Первоначально опубликовано пользователем" },
    "stats": { "visits": "внешних переходов" },
    "license": {
      "heading": "Исходная лицензия",
      "notSpecified": "Не указана",
      "remixYes": "Ремиксы разрешены",
      "remixNo": "Ремиксы запрещены",
      "commercialYes": "Коммерческое использование разрешено",
      "commercialNo": "Коммерческое использование запрещено",
      "disclaimer": "Информация о лицензии предоставляется исходным сайтом и не является лицензией Classic Mini DIY. Проверьте условия в исходном объявлении перед использованием."
    },
    "about": { "heading": "Об этой модели" },
    "notFound": {
      "title": "Модель не найдена",
      "body": "Это объявление могло быть удалено или ссылка неверна.",
      "cta": "Смотреть все модели"
    }
  },
  "ja": {
    "hero": { "title": "3Dモデルライブラリ" },
    "breadcrumb": { "subpage": "3Dモデル" },
    "meta": {
      "defaultTitle": "外部3Dモデル | Classic Mini DIY",
      "defaultDescription": "クラシックミニ用の3Dプリントパーツ。コミュニティがウェブから共有しています。"
    },
    "externalNotice": "このモデルは外部サイトでホストされています。ダウンロードはソースプラットフォームで直接行われます。",
    "attribution": { "by": "元々共有したユーザー：" },
    "stats": { "visits": "外部アクセス" },
    "license": {
      "heading": "ソースライセンス",
      "notSpecified": "未指定",
      "remixYes": "リミックス可",
      "remixNo": "リミックス不可",
      "commercialYes": "商用利用可",
      "commercialNo": "商用利用不可",
      "disclaimer": "ライセンス情報はソースサイトが提供するものであり、Classic Mini DIYのライセンスではありません。使用前に元のリスティングで条件を確認してください。"
    },
    "about": { "heading": "このモデルについて" },
    "notFound": {
      "title": "モデルが見つかりません",
      "body": "このリスティングは削除されたか、リンクが正しくない可能性があります。",
      "cta": "すべてのモデルを見る"
    }
  },
  "zh": {
    "hero": { "title": "3D模型库" },
    "breadcrumb": { "subpage": "3D模型" },
    "meta": {
      "defaultTitle": "外部3D模型 | Classic Mini DIY",
      "defaultDescription": "由社区从网络分享的经典迷你3D打印零件。"
    },
    "externalNotice": "此模型托管在外部网站上。下载直接在源平台上进行。",
    "attribution": { "by": "最初由以下用户分享：" },
    "stats": { "visits": "外部访问次数" },
    "license": {
      "heading": "源许可证",
      "notSpecified": "未指定",
      "remixYes": "允许混搭",
      "remixNo": "不允许混搭",
      "commercialYes": "允许商业使用",
      "commercialNo": "不允许商业使用",
      "disclaimer": "许可证信息由源网站提供，并非 Classic Mini DIY 许可证。使用前请在原始列表中核实条款。"
    },
    "about": { "heading": "关于此模型" },
    "notFound": {
      "title": "未找到模型",
      "body": "此列表可能已被删除或链接不正确。",
      "cta": "浏览所有模型"
    }
  },
  "ko": {
    "hero": { "title": "3D 모델 라이브러리" },
    "breadcrumb": { "subpage": "3D 모델" },
    "meta": {
      "defaultTitle": "외부 3D 모델 | Classic Mini DIY",
      "defaultDescription": "커뮤니티가 웹에서 공유한 클래식 미니용 3D 프린팅 부품."
    },
    "externalNotice": "이 모델은 외부 사이트에서 호스팅됩니다. 다운로드는 소스 플랫폼에서 직접 이루어집니다.",
    "attribution": { "by": "원래 공유한 사람:" },
    "stats": { "visits": "외부 방문" },
    "license": {
      "heading": "소스 라이선스",
      "notSpecified": "지정되지 않음",
      "remixYes": "리믹스 허용",
      "remixNo": "리믹스 불가",
      "commercialYes": "상업적 사용 가능",
      "commercialNo": "상업적 사용 불가",
      "disclaimer": "라이선스 정보는 소스 사이트에서 제공하며 Classic Mini DIY 라이선스가 아닙니다. 사용 전 원본 목록에서 조건을 확인하세요."
    },
    "about": { "heading": "이 모델에 대하여" },
    "notFound": {
      "title": "모델을 찾을 수 없음",
      "body": "이 목록이 삭제되었거나 링크가 올바르지 않을 수 있습니다.",
      "cta": "모든 모델 보기"
    }
  }
}
</i18n>
