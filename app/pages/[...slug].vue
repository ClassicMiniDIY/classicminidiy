<script setup lang="ts">
  import { HERO_TYPES } from '../../data/models/generic';
  import { determineArchiveType, shareArchiveItem, submitArchiveFile } from '../../data/models/helper-utils';

  const { path, fullPath } = useRoute();
  const crumbs = ref([
    {
      title: $t('breadcrumb_archive'),
      disabled: false,
      href: '/archive',
    },
  ]);

  // Fetch document from Supabase archive_documents table
  const { getByPath } = useArchiveDocuments();
  const {
    data: currentPostData,
    status,
    error,
  } = await useAsyncData(path, async () => {
    const result = await getByPath(path);
    return result || null;
  });

  // Provide default values and handle potential undefined values
  const archiveType = determineArchiveType(path) || 'unknown';
  const fileType = currentPostData.value?.download?.split('.')?.pop() || 'unknown';

  // Function to handle image loading errors
  const handleImageError = (event: Event) => {
    const imgElement = event.target as HTMLImageElement;
    if (imgElement) {
      imgElement.src = 'https://classicminidiy.s3.amazonaws.com/misc/placeholder.png';
      imgElement.classList.add('error');
    }
  };

  // Only add to breadcrumbs if we have valid data
  if (currentPostData.value?.title) {
    crumbs.value.push({
      title: currentPostData.value.title,
      disabled: true,
      href: '',
    });
  }

  await useHead({
    title: `${currentPostData.value?.title} ${$t('seo.title_suffix')}`,
    meta: [
      {
        key: 'description',
        name: 'description',
        content:
          currentPostData.value?.description || $t('seo.description_fallback', { title: currentPostData.value?.title }),
      },
      {
        key: 'keywords',
        name: 'keywords',
        content: $t('seo.keywords_template', {
          title: currentPostData.value?.title,
          fileType: fileType || 'resource',
          archiveType,
        }),
      },
    ],
    link: [
      {
        rel: 'canonical',
        href: `https://classicminidiy.com${fullPath}`,
      },
      {
        rel: 'preconnect',
        href: 'https://classicminidiy.s3.amazonaws.com',
      },
    ],
  });

  await useSeoMeta({
    ogTitle: `${currentPostData.value?.title} ${$t('seo.og_title_suffix')}`,
    ogDescription:
      currentPostData.value?.description || $t('seo.description_fallback', { title: currentPostData.value?.title }),
    ogUrl: `https://classicminidiy.com${fullPath}`,
    ogImage: currentPostData.value?.image,
    ogType: 'article',
    author: currentPostData.value?.author,
    twitterCard: 'summary_large_image',
    twitterTitle: `${currentPostData.value?.title} ${$t('seo.twitter_title_suffix')}`,
    twitterDescription:
      currentPostData.value?.description || $t('seo.description_fallback', { title: currentPostData.value?.title }),
    twitterImage: currentPostData.value?.image,
  });

  // Add structured data for the archive item
  const archiveItemJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DigitalDocument',
    name: currentPostData.value?.title,
    description: currentPostData.value?.description,
    url: `https://classicminidiy.com${fullPath}`,
    image: currentPostData.value?.image,
    encodingFormat: fileType, // Using plain string value, not computed
    author: {
      '@type': 'Person',
      name: currentPostData.value?.author || $t('structured_data.author_fallback'),
    },
    publisher: {
      '@type': 'Organization',
      name: $t('structured_data.publisher_name'),
      logo: {
        '@type': 'ImageObject',
        url: 'https://classicminidiy.s3.amazonaws.com/misc/logo.png',
      },
    },
    isPartOf: {
      '@type': 'CollectionPage',
      name: $t('structured_data.collection_name'),
      url: 'https://classicminidiy.com/archive',
    },
  };

  // Add JSON-LD structured data to head
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(archiveItemJsonLd),
      },
    ],
  });
</script>

<template>
  <hero
    :navigation="true"
    :title="$t('hero_title')"
    textSize="text-3xl"
    :subtitle="currentPostData?.title"
    :heroType="HERO_TYPES.ARCHIVE"
  />
  <div class="container mx-auto px-4">
    <div class="mt-5">
      <div class="w-full">
        <div class="breadcrumbs text-sm">
          <ul>
            <li v-for="(crumb, index) in crumbs" :key="index">
              <template v-if="!crumb.disabled">
                <a :href="crumb.href">
                  <i v-if="index === 0" class="fa-duotone fa-book mr-2"></i>
                  {{ crumb.title }}
                </a>
              </template>
              <template v-else>
                <span>
                  {{ crumb.title }}
                </span>
              </template>
            </li>
          </ul>
        </div>
      </div>
      <!-- Loading state with skeleton loader -->
      <div v-if="status === 'pending'" class="mx-auto max-w-xs border p-4 rounded-lg">
        <USkeleton class="h-32 w-full" />
        <USkeleton class="h-4 w-28 mt-4" />
        <USkeleton class="h-4 w-full mt-2" />
        <USkeleton class="h-4 w-full mt-2" />
      </div>

      <!-- Error state -->
      <UAlert v-else-if="error" color="error" class="max-w-2xl mx-auto" icon="i-fa6-solid-circle-exclamation">
        <template #title>{{ $t('loading_error') }}</template>
      </UAlert>
      <!-- Content state - only show if we have data and no errors -->
      <div v-if="currentPostData && status !== 'pending' && !error" class="flex justify-center">
        <UCard class="w-full max-w-4xl">
          <div class="px-10 pt-4 pb-6 flex justify-center">
            <!-- No image case -->
            <i
              v-if="!currentPostData.image || currentPostData.image === ''"
              class="fa-duotone fa-image-slash text-6xl"
              :aria-label="$t('no_image_alt')"
            ></i>
            <!-- Image with download link -->
            <a
              v-else-if="currentPostData.download && currentPostData.download !== ''"
              :href="currentPostData.download"
              :aria-label="$t('download_aria_label', { title: currentPostData.title || 'file' })"
              class="block"
            >
              <img
                :src="currentPostData.image"
                class="rounded-xl max-h-50 object-contain"
                :alt="
                  $t('preview_image_alt', {
                    title: currentPostData.title || $t('fallback_title'),
                  })
                "
                loading="lazy"
                @error="(e: Event) => handleImageError(e)"
              />
            </a>
            <!-- Image without download link -->
            <img
              v-else
              :src="currentPostData.image"
              class="rounded-xl max-h-50 object-contain"
              :alt="
                $t('archive_item_alt', {
                  title: currentPostData.title || $t('fallback_title'),
                })
              "
              loading="lazy"
              @error="(e: Event) => handleImageError(e)"
            />
          </div>
          <div class="items-center text-center">
            <!-- Title with fallback -->
            <h2 class="text-2xl font-bold capitalize">
              {{ currentPostData.title?.toLowerCase() || $t('fallback_title') }}
            </h2>

            <div class="flex flex-wrap items-center justify-center gap-4 my-2">
              <!-- Code/reference number if available -->
              <div v-if="currentPostData.code" class="flex items-center">
                <i class="fa-duotone fa-list-timeline text-primary mr-2"></i>
                <span class="font-medium">{{ currentPostData.code }}</span>
              </div>

              <!-- File type if available -->
              <div v-if="currentPostData.download" class="flex items-center">
                <i class="fa-duotone fa-file text-secondary mr-2"></i>
                <span class="font-medium"
                  >{{ $t('file_type_label') }} {{ currentPostData.download?.split('.')?.pop() || 'unknown' }}</span
                >
              </div>
            </div>

            <!-- Description with fallback -->
            <p class="my-4">{{ currentPostData.description || $t('no_description') }}</p>

            <div class="flex flex-wrap justify-center mt-4 gap-2">
              <ClientOnly>
                <UButton
                  variant="outline"
                  color="info"
                  class="m-1"
                  @click="shareArchiveItem(currentPostData.title, currentPostData.path)"
                >
                  <i class="fa-duotone fa-solid fa-arrow-up-from-bracket mr-2"></i>
                  {{ $t('share_button') }}
                </UButton>
                <UButton
                  color="secondary"
                  class="m-1"
                  @click="
                    submitArchiveFile(
                      archiveType,
                      currentPostData.title,
                      currentPostData.path,
                      currentPostData.code,
                      currentPostData.description
                    )
                  "
                >
                  <i class="fa-duotone fa-solid fa-plus-large mr-2"></i>
                  {{ $t('contribute_button') }}
                </UButton>
                <UButton
                  v-if="
                    (!currentPostData.download || currentPostData.download === '') &&
                    !currentPostData.path?.includes('companies')
                  "
                  class="m-1"
                  disabled
                >
                  <i class="fa-duotone fa-solid fa-question mr-2"></i>
                  {{ $t('missing_file_button') }}
                </UButton>
                <UButton
                  v-else-if="!currentPostData.path?.includes('companies')"
                  color="primary"
                  class="m-1"
                  :to="currentPostData.download"
                >
                  <i class="fa-duotone fa-solid fa-download mr-2"></i>
                  {{ $t('download_button') }}
                </UButton>
              </ClientOnly>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<i18n>
{
  "en": {
    "breadcrumb_archive": "Archive",
    "hero_title": "Classic Mini Archives",
    "loading_error": "Error loading content. Please try again later.",
    "no_image_alt": "No image available",
    "download_aria_label": "Download {title}",
    "preview_image_alt": "{title} preview image",
    "archive_item_alt": "{title} image",
    "fallback_title": "Archive Item",
    "file_type_label": "Type:",
    "no_description": "No description available.",
    "share_button": "Share",
    "contribute_button": "Contribute",
    "missing_file_button": "Missing File",
    "download_button": "Download",
    "seo": {
      "title_suffix": "- Classic Mini Archive - Classic Mini DIY",
      "description_fallback": "Archive resource for {title} in the Classic Mini DIY collection.",
      "keywords_template": "Classic Mini, {title}, archive, Mini Cooper, {fileType}, {archiveType}",
      "og_title_suffix": "- Classic Mini Archive",
      "twitter_title_suffix": "- Classic Mini Archive"
    },
    "structured_data": {
      "author_fallback": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "collection_name": "Classic Mini Archives"
    }
  },
  "es": {
    "breadcrumb_archive": "Archivo",
    "hero_title": "Archivos Classic Mini",
    "loading_error": "Error al cargar el contenido. Por favor, inténtalo de nuevo más tarde.",
    "no_image_alt": "No hay imagen disponible",
    "download_aria_label": "Descargar {title}",
    "preview_image_alt": "Imagen de vista previa de {title}",
    "archive_item_alt": "Imagen de {title}",
    "fallback_title": "Elemento del Archivo",
    "file_type_label": "Tipo:",
    "no_description": "No hay descripción disponible.",
    "share_button": "Compartir",
    "contribute_button": "Contribuir",
    "missing_file_button": "Archivo Faltante",
    "download_button": "Descargar",
    "seo": {
      "title_suffix": "- Archivo Classic Mini - Classic Mini DIY",
      "description_fallback": "Recurso de archivo para {title} en la colección Classic Mini DIY.",
      "keywords_template": "Classic Mini, {title}, archivo, Mini Cooper, {fileType}, {archiveType}",
      "og_title_suffix": "- Archivo Classic Mini",
      "twitter_title_suffix": "- Archivo Classic Mini"
    },
    "structured_data": {
      "author_fallback": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "collection_name": "Archivos Classic Mini"
    }
  },
  "fr": {
    "breadcrumb_archive": "Archive",
    "hero_title": "Archives Classic Mini",
    "loading_error": "Erreur lors du chargement du contenu. Veuillez réessayer plus tard.",
    "no_image_alt": "Aucune image disponible",
    "download_aria_label": "Télécharger {title}",
    "preview_image_alt": "Image d'aperçu de {title}",
    "archive_item_alt": "Image de {title}",
    "fallback_title": "Élément d'Archive",
    "file_type_label": "Type :",
    "no_description": "Aucune description disponible.",
    "share_button": "Partager",
    "contribute_button": "Contribuer",
    "missing_file_button": "Fichier Manquant",
    "download_button": "Télécharger",
    "seo": {
      "title_suffix": "- Archive Classic Mini - Classic Mini DIY",
      "description_fallback": "Ressource d'archive pour {title} dans la collection Classic Mini DIY.",
      "keywords_template": "Classic Mini, {title}, archive, Mini Cooper, {fileType}, {archiveType}",
      "og_title_suffix": "- Archive Classic Mini",
      "twitter_title_suffix": "- Archive Classic Mini"
    },
    "structured_data": {
      "author_fallback": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "collection_name": "Archives Classic Mini"
    }
  },
  "it": {
    "breadcrumb_archive": "Archivio",
    "hero_title": "Archivi Classic Mini",
    "loading_error": "Errore nel caricamento del contenuto. Riprova più tardi.",
    "no_image_alt": "Nessuna immagine disponibile",
    "download_aria_label": "Scarica {title}",
    "preview_image_alt": "Immagine di anteprima di {title}",
    "archive_item_alt": "Immagine di {title}",
    "fallback_title": "Elemento dell'Archivio",
    "file_type_label": "Tipo:",
    "no_description": "Nessuna descrizione disponibile.",
    "share_button": "Condividi",
    "contribute_button": "Contribuisci",
    "missing_file_button": "File Mancante",
    "download_button": "Scarica",
    "seo": {
      "title_suffix": "- Archivio Classic Mini - Classic Mini DIY",
      "description_fallback": "Risorsa di archivio per {title} nella collezione Classic Mini DIY.",
      "keywords_template": "Classic Mini, {title}, archivio, Mini Cooper, {fileType}, {archiveType}",
      "og_title_suffix": "- Archivio Classic Mini",
      "twitter_title_suffix": "- Archivio Classic Mini"
    },
    "structured_data": {
      "author_fallback": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "collection_name": "Archivi Classic Mini"
    }
  },
  "de": {
    "breadcrumb_archive": "Archiv",
    "hero_title": "Classic Mini Archive",
    "loading_error": "Fehler beim Laden des Inhalts. Bitte versuchen Sie es später erneut.",
    "no_image_alt": "Kein Bild verfügbar",
    "download_aria_label": "{title} herunterladen",
    "preview_image_alt": "Vorschaubild von {title}",
    "archive_item_alt": "Bild von {title}",
    "fallback_title": "Archiv-Element",
    "file_type_label": "Typ:",
    "no_description": "Keine Beschreibung verfügbar.",
    "share_button": "Teilen",
    "contribute_button": "Beitragen",
    "missing_file_button": "Fehlende Datei",
    "download_button": "Herunterladen",
    "seo": {
      "title_suffix": "- Classic Mini Archiv - Classic Mini DIY",
      "description_fallback": "Archiv-Ressource für {title} in der Classic Mini DIY Sammlung.",
      "keywords_template": "Classic Mini, {title}, Archiv, Mini Cooper, {fileType}, {archiveType}",
      "og_title_suffix": "- Classic Mini Archiv",
      "twitter_title_suffix": "- Classic Mini Archiv"
    },
    "structured_data": {
      "author_fallback": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "collection_name": "Classic Mini Archive"
    }
  },
  "pt": {
    "breadcrumb_archive": "Arquivo",
    "hero_title": "Arquivos Classic Mini",
    "loading_error": "Erro ao carregar o conteúdo. Tente novamente mais tarde.",
    "no_image_alt": "Nenhuma imagem disponível",
    "download_aria_label": "Baixar {title}",
    "preview_image_alt": "Imagem de visualização de {title}",
    "archive_item_alt": "Imagem de {title}",
    "fallback_title": "Item do Arquivo",
    "file_type_label": "Tipo:",
    "no_description": "Nenhuma descrição disponível.",
    "share_button": "Compartilhar",
    "contribute_button": "Contribuir",
    "missing_file_button": "Arquivo Ausente",
    "download_button": "Baixar",
    "seo": {
      "title_suffix": "- Arquivo Classic Mini - Classic Mini DIY",
      "description_fallback": "Recurso de arquivo para {title} na coleção Classic Mini DIY.",
      "keywords_template": "Classic Mini, {title}, arquivo, Mini Cooper, {fileType}, {archiveType}",
      "og_title_suffix": "- Arquivo Classic Mini",
      "twitter_title_suffix": "- Arquivo Classic Mini"
    },
    "structured_data": {
      "author_fallback": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "collection_name": "Arquivos Classic Mini"
    }
  },
  "ru": {
    "breadcrumb_archive": "Архив",
    "hero_title": "Архивы Classic Mini",
    "loading_error": "Ошибка загрузки контента. Пожалуйста, попробуйте позже.",
    "no_image_alt": "Изображение недоступно",
    "download_aria_label": "Скачать {title}",
    "preview_image_alt": "Превью изображение {title}",
    "archive_item_alt": "Изображение {title}",
    "fallback_title": "Элемент Архива",
    "file_type_label": "Тип:",
    "no_description": "Описание недоступно.",
    "share_button": "Поделиться",
    "contribute_button": "Внести вклад",
    "missing_file_button": "Отсутствующий Файл",
    "download_button": "Скачать",
    "seo": {
      "title_suffix": "- Архив Classic Mini - Classic Mini DIY",
      "description_fallback": "Архивный ресурс для {title} в коллекции Classic Mini DIY.",
      "keywords_template": "Classic Mini, {title}, архив, Mini Cooper, {fileType}, {archiveType}",
      "og_title_suffix": "- Архив Classic Mini",
      "twitter_title_suffix": "- Архив Classic Mini"
    },
    "structured_data": {
      "author_fallback": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "collection_name": "Архивы Classic Mini"
    }
  },
  "ja": {
    "breadcrumb_archive": "アーカイブ",
    "hero_title": "Classic Mini アーカイブ",
    "loading_error": "コンテンツの読み込みエラーです。後でもう一度お試しください。",
    "no_image_alt": "画像がありません",
    "download_aria_label": "{title}をダウンロード",
    "preview_image_alt": "{title}のプレビュー画像",
    "archive_item_alt": "{title}の画像",
    "fallback_title": "アーカイブアイテム",
    "file_type_label": "タイプ：",
    "no_description": "説明がありません。",
    "share_button": "共有",
    "contribute_button": "貢献",
    "missing_file_button": "ファイルが見つかりません",
    "download_button": "ダウンロード",
    "seo": {
      "title_suffix": "- Classic Mini アーカイブ - Classic Mini DIY",
      "description_fallback": "Classic Mini DIYコレクションの{title}のアーカイブリソース。",
      "keywords_template": "Classic Mini, {title}, アーカイブ, Mini Cooper, {fileType}, {archiveType}",
      "og_title_suffix": "- Classic Mini アーカイブ",
      "twitter_title_suffix": "- Classic Mini アーカイブ"
    },
    "structured_data": {
      "author_fallback": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "collection_name": "Classic Mini アーカイブ"
    }
  },
  "zh": {
    "breadcrumb_archive": "档案",
    "hero_title": "Classic Mini 档案",
    "loading_error": "加载内容时出错。请稍后重试。",
    "no_image_alt": "无可用图片",
    "download_aria_label": "下载 {title}",
    "preview_image_alt": "{title} 预览图片",
    "archive_item_alt": "{title} 图片",
    "fallback_title": "档案项目",
    "file_type_label": "类型：",
    "no_description": "无可用描述。",
    "share_button": "分享",
    "contribute_button": "贡献",
    "missing_file_button": "缺少文件",
    "download_button": "下载",
    "seo": {
      "title_suffix": "- Classic Mini 档案 - Classic Mini DIY",
      "description_fallback": "Classic Mini DIY 收藏中 {title} 的档案资源。",
      "keywords_template": "Classic Mini, {title}, 档案, Mini Cooper, {fileType}, {archiveType}",
      "og_title_suffix": "- Classic Mini 档案",
      "twitter_title_suffix": "- Classic Mini 档案"
    },
    "structured_data": {
      "author_fallback": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "collection_name": "Classic Mini 档案"
    }
  },
  "ko": {
    "breadcrumb_archive": "아카이브",
    "hero_title": "Classic Mini 아카이브",
    "loading_error": "콘텐츠 로딩 중 오류가 발생했습니다. 나중에 다시 시도해 주세요.",
    "no_image_alt": "사용 가능한 이미지가 없습니다",
    "download_aria_label": "{title} 다운로드",
    "preview_image_alt": "{title} 미리보기 이미지",
    "archive_item_alt": "{title} 이미지",
    "fallback_title": "아카이브 항목",
    "file_type_label": "유형:",
    "no_description": "사용 가능한 설명이 없습니다.",
    "share_button": "공유",
    "contribute_button": "기여",
    "missing_file_button": "누락된 파일",
    "download_button": "다운로드",
    "seo": {
      "title_suffix": "- Classic Mini 아카이브 - Classic Mini DIY",
      "description_fallback": "Classic Mini DIY 컬렉션의 {title} 아카이브 리소스.",
      "keywords_template": "Classic Mini, {title}, 아카이브, Mini Cooper, {fileType}, {archiveType}",
      "og_title_suffix": "- Classic Mini 아카이브",
      "twitter_title_suffix": "- Classic Mini 아카이브"
    },
    "structured_data": {
      "author_fallback": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "collection_name": "Classic Mini 아카이브"
    }
  }
}
</i18n>

<style lang="scss">
  .companies-content {
    h2 {
      font-size: 1.5rem;
      font-weight: 600;
      padding-bottom: 1rem;
    }
    h3 {
      font-size: 1.25rem;
      font-weight: 600;
      padding-bottom: 1rem;
    }
    p {
      padding-bottom: 1.5rem;
    }
  }

  /* Fallback for image loading errors */
  img {
    &.error {
      opacity: 0.5;
    }
  }
</style>
