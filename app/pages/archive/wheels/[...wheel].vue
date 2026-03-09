<script lang="ts" setup>
  import { HERO_TYPES } from '../../../../data/models/generic';
  import { shareWheelItem } from '../../../../data/models/helper-utils';
  import type { IWheelsData } from '../../../../data/models/wheels';

  const { t } = useI18n();

  const { isAuthenticated } = useAuth();
  const route = useRoute();
  const wheelId = ref(route.params.wheel);
  const { getWheel } = useWheels();
  const {
    data: wheel,
    pending,
    error,
  } = await useAsyncData(`wheel-${wheelId.value?.[0] || 'noWheel'}`, () => getWheel(wheelId.value?.[0] || 'noWheel'), {
    server: !!wheelId.value?.[0],
    default: () => ({}) as IWheelsData,
  });

  const copied = ref<boolean>(false);
  const showSuggestEdit = ref(false);
  const shareImage = computed(() => {
    if (!wheel.value?.images?.length) return 'no-image';
    return wheel.value.images[0].src;
  });

  async function copyUrl() {
    const url = `https://classicminidiy.com/archive/wheels/${wheel.value?.uuid}`;
    try {
      await navigator.clipboard.writeText(url);
      copied.value = true;
      setTimeout(() => (copied.value = false), 1000);
    } catch ($e) {
      copied.value = false;
    }
  }

  // Update head and meta tags when wheel data is loaded
  watchEffect(() => {
    if (wheel.value) {
      const title = t('seo.title_template', {
        name: wheel.value.name,
        size: wheel.value.size,
        width: wheel.value.width,
      });
      const description = t('seo.description');

      useHead({
        title,
        meta: [
          {
            key: 'description',
            name: 'description',
            content: description,
          },
          {
            key: 'keywords',
            name: 'keywords',
            content: t('seo.keywords'),
          },
        ],
        link: [
          {
            rel: 'canonical',
            href: `https://classicminidiy.com/archive/wheels/${wheel.value.uuid}`,
          },
          {
            rel: 'preconnect',
            href: 'https://classicminidiy.s3.amazonaws.com',
          },
        ],
      });

      useSeoMeta({
        ogTitle: title,
        ogDescription: description,
        ogUrl: `classicminidiy.com/archive/wheels/${wheel.value.uuid}`,
        ogImage: shareImage.value,
        ogType: 'website',
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        twitterImage: shareImage.value,
      });
    }
  });
</script>
<template>
  <hero :navigation="true" :title="t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />
  <div class="container mx-auto px-4 py-4">
    <!-- Loading State -->
    <div v-if="pending" class="flex justify-center items-center min-h-[50vh]">
      <div class="text-center">
        <span class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary inline-block"></span>
        <p class="mt-4">{{ t('loading_text') }}</p>
      </div>
    </div>

    <!-- Error State -->
    <UAlert v-else-if="error" color="error" class="my-8" icon="i-fa6-solid-triangle-exclamation">
      <template #title>{{ t('error_message') }}</template>
      <template #actions>
        <UButton to="/archive/wheels" size="sm" variant="ghost">
          <i class="fas fa-arrow-left mr-2"></i> {{ t('back_to_wheels') }}
        </UButton>
      </template>
    </UAlert>

    <!-- Content -->
    <div v-else>
      <div class="grid grid-cols-12 gap-4 items-center">
        <div class="col-span-12 md:col-span-8">
          <breadcrumb
            class="mt-6"
            :page="wheel?.name || t('breadcrumb_fallback')"
            :subpage="t('breadcrumb_subpage')"
            subpage-href="/archive/wheels"
          ></breadcrumb>
        </div>
      </div>
      <div class="grid grid-cols-12 gap-4">
        <div class="col-span-12">
          <UCard>
            <div v-if="wheel">
              <div class="flex flex-col md:flex-row gap-8">
                <div class="flex-1">
                  <h1 class="text-3xl font-bold mb-4">{{ wheel.name }}</h1>
                  <p v-if="wheel.notes" class="text-gray-600 text-lg">{{ wheel.notes }}</p>
                </div>

                <div class="w-full md:w-1/3 flex justify-center">
                  <div class="w-full max-w-sm">
                    <div
                      v-if="wheel.images && wheel.images.length > 1"
                      class="carousel w-full rounded-lg overflow-hidden"
                    >
                      <div
                        v-for="(image, index) in wheel.images"
                        :key="index"
                        :id="`slide${index}`"
                        class="carousel-item relative w-full aspect-[4/3]"
                      >
                        <img :src="image.src" class="w-full h-full object-cover" />
                        <div class="absolute flex justify-between transform -translate-y-1/2 left-2 right-2 top-1/2">
                          <a
                            :href="`#slide${index === 0 ? wheel.images.length - 1 : index - 1}`"
                            class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/80 hover:bg-white text-gray-800 shadow-md"
                          >
                            <i class="fas fa-chevron-left"></i>
                          </a>
                          <a
                            :href="`#slide${index === wheel.images.length - 1 ? 0 : index + 1}`"
                            class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/80 hover:bg-white text-gray-800 shadow-md"
                          >
                            <i class="fas fa-chevron-right"></i>
                          </a>
                        </div>
                      </div>
                    </div>
                    <img
                      v-else-if="wheel.images && wheel.images[0]"
                      :alt="t('image_alt', { name: wheel.name })"
                      class="w-full h-auto rounded-lg shadow-md"
                      :src="wheel.images[0].src"
                    />
                    <div v-else class="w-full aspect-square flex items-center justify-center bg-gray-100 rounded-lg">
                      <i class="fas fa-image text-6xl text-gray-300" :title="t('no_image_placeholder')"></i>
                    </div>
                  </div>
                </div>
              </div>

              <USeparator class="my-4" />
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 py-4">
                <div class="flex flex-col items-center text-center">
                  <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <i class="fad fa-arrow-right-to-line text-xl text-primary"></i>
                  </div>
                  <h3 class="font-semibold text-gray-600 mb-1">
                    {{ t('specifications.offset') }}
                  </h3>
                  <p v-if="wheel.offset" class="text-lg font-medium">{{ wheel.offset }}</p>
                  <p v-else class="text-error text-sm">
                    {{ t('specifications.not_specified') }}
                  </p>
                </div>
                <div class="flex flex-col items-center text-center">
                  <div class="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-2">
                    <i class="fad fa-arrows-to-line text-xl text-secondary"></i>
                  </div>
                  <h3 class="font-semibold text-gray-600 mb-1">
                    {{ t('specifications.diameter') }}
                  </h3>
                  <p v-if="wheel.size" class="text-lg font-medium">{{ wheel.size }}</p>
                  <p v-else class="text-error text-sm">
                    {{ t('specifications.not_specified') }}
                  </p>
                </div>
                <div class="flex flex-col items-center text-center">
                  <div class="w-12 h-12 rounded-full bg-info/10 flex items-center justify-center mb-2">
                    <i class="fad fa-arrows-left-right-to-line text-xl text-info"></i>
                  </div>
                  <h3 class="font-semibold text-gray-600 mb-1">
                    {{ t('specifications.width') }}
                  </h3>
                  <p v-if="wheel.width" class="text-lg font-medium">{{ wheel.width }}</p>
                  <p v-else class="text-error text-sm">
                    {{ t('specifications.not_specified') }}
                  </p>
                </div>
              </div>
              <USeparator class="my-4" />
              <div class="flex flex-wrap justify-center gap-3 pt-2">
                <UButton v-if="copied" size="lg" color="neutral" disabled>
                  <i class="fad fa-check text-success mr-2"></i>
                  <span>{{ t('actions.copied') }}</span>
                </UButton>
                <UButton v-else size="lg" color="primary" @click="copyUrl">
                  <i class="fad fa-link mr-2"></i>
                  <span>{{ t('actions.copy_link') }}</span>
                </UButton>
                <UButton
                  v-if="wheel.name && wheel.uuid"
                  size="lg"
                  color="secondary"
                  @click="shareWheelItem(wheel.name, wheel.uuid)"
                >
                  <i class="fad fa-share mr-2"></i>
                  <span>{{ t('actions.share') }}</span>
                </UButton>
                <UButton v-if="wheel.uuid" :to="`/contribute/wheel?uuid=${wheel.uuid}`" size="lg" variant="outline">
                  <i class="fad fa-edit mr-2"></i>
                  <span>{{ t('actions.contribute') }}</span>
                </UButton>
                <UButton v-if="isAuthenticated" variant="outline" size="sm" @click="showSuggestEdit = true">
                  <i class="fad fa-pen-to-square mr-2"></i>
                  <span>{{ t('suggest_edit') }}</span>
                </UButton>
              </div>
            </div>
          </UCard>
        </div>
      </div>

      <SuggestEditModal
        v-if="wheel?.uuid"
        v-model="showSuggestEdit"
        target-type="wheel"
        :target-id="wheel.uuid"
        :current-data="{ name: wheel.name, width: wheel.width, size: wheel.size, offset: wheel.offset }"
        :editable-fields="[
          { key: 'name', label: t('field_name'), type: 'text' },
          { key: 'width', label: t('field_width'), type: 'text' },
          { key: 'size', label: t('field_size'), type: 'text' },
          { key: 'offset', label: t('field_offset'), type: 'text' },
        ]"
      />
    </div>
  </div>
</template>

<style lang="scss">
  @media (max-width: 600px) {
    .top-section {
      text-align: center;
    }
  }

  .wheel-image {
    margin-left: auto;

    @media (max-width: 600px) {
      margin-left: unset;
      margin: auto;
    }
  }
</style>

<i18n lang="json">
{
  "en": {
    "hero_title": "Classic Mini Wheels",
    "loading_text": "Loading wheel details...",
    "error_message": "Failed to load wheel details. Please try again later.",
    "back_to_wheels": "Back to Wheels",
    "breadcrumb_fallback": "Wheel Details",
    "breadcrumb_subpage": "Wheels",
    "image_alt": "Image of {name} wheel",
    "no_image_placeholder": "No image available",
    "specifications": {
      "offset": "Offset",
      "diameter": "Diameter",
      "width": "Width",
      "not_specified": "Not specified"
    },
    "suggest_edit": "Suggest Edit",
    "field_name": "Name",
    "field_width": "Width",
    "field_size": "Diameter",
    "field_offset": "Offset",
    "actions": {
      "copied": "Link copied!",
      "copy_link": "Copy Link",
      "share": "Share",
      "contribute": "Edit/Contribute"
    },
    "seo": {
      "title_template": "{name} - {size}x{width} Classic Mini Wheel",
      "description": "Detailed specifications and images for this Classic Mini wheel",
      "keywords": "classic mini, wheels, specifications, offset, diameter, width"
    }
  },
  "es": {
    "hero_title": "Llantas Classic Mini",
    "loading_text": "Cargando detalles de la llanta...",
    "error_message": "Error al cargar los detalles de la llanta. Por favor, inténtalo más tarde.",
    "back_to_wheels": "Volver a Llantas",
    "breadcrumb_fallback": "Detalles de la Llanta",
    "breadcrumb_subpage": "Llantas",
    "image_alt": "Imagen de la llanta {name}",
    "no_image_placeholder": "No hay imagen disponible",
    "specifications": {
      "offset": "Offset",
      "diameter": "Diámetro",
      "width": "Anchura",
      "not_specified": "No especificado"
    },
    "suggest_edit": "Sugerir Edición",
    "field_name": "Nombre",
    "field_width": "Anchura",
    "field_size": "Diámetro",
    "field_offset": "Offset",
    "actions": {
      "copied": "¡Enlace copiado!",
      "copy_link": "Copiar Enlace",
      "share": "Compartir",
      "contribute": "Editar/Contribuir"
    },
    "seo": {
      "title_template": "{name} - {size}x{width} Llanta Classic Mini",
      "description": "Especificaciones detalladas e imágenes de esta llanta Classic Mini",
      "keywords": "classic mini, llantas, especificaciones, offset, diámetro, anchura"
    }
  },
  "fr": {
    "hero_title": "Jantes Classic Mini",
    "loading_text": "Chargement des détails de la jante...",
    "error_message": "Échec du chargement des détails de la jante. Veuillez réessayer plus tard.",
    "back_to_wheels": "Retour aux Jantes",
    "breadcrumb_fallback": "Détails de la Jante",
    "breadcrumb_subpage": "Jantes",
    "image_alt": "Image de la jante {name}",
    "no_image_placeholder": "Aucune image disponible",
    "specifications": {
      "offset": "Offset",
      "diameter": "Diamètre",
      "width": "Largeur",
      "not_specified": "Non spécifié"
    },
    "suggest_edit": "Suggérer une Modification",
    "field_name": "Nom",
    "field_width": "Largeur",
    "field_size": "Diamètre",
    "field_offset": "Offset",
    "actions": {
      "copied": "Lien copié !",
      "copy_link": "Copier le Lien",
      "share": "Partager",
      "contribute": "Modifier/Contribuer"
    },
    "seo": {
      "title_template": "{name} - {size}x{width} Jante Classic Mini",
      "description": "Spécifications détaillées et images de cette jante Classic Mini",
      "keywords": "classic mini, jantes, spécifications, offset, diamètre, largeur"
    }
  },
  "it": {
    "hero_title": "Cerchi Classic Mini",
    "loading_text": "Caricamento dettagli cerchio...",
    "error_message": "Impossibile caricare i dettagli del cerchio. Riprova più tardi.",
    "back_to_wheels": "Torna ai Cerchi",
    "breadcrumb_fallback": "Dettagli Cerchio",
    "breadcrumb_subpage": "Cerchi",
    "image_alt": "Immagine del cerchio {name}",
    "no_image_placeholder": "Nessuna immagine disponibile",
    "specifications": {
      "offset": "Offset",
      "diameter": "Diametro",
      "width": "Larghezza",
      "not_specified": "Non specificato"
    },
    "suggest_edit": "Suggerisci Modifica",
    "field_name": "Nome",
    "field_width": "Larghezza",
    "field_size": "Diametro",
    "field_offset": "Offset",
    "actions": {
      "copied": "Link copiato!",
      "copy_link": "Copia Link",
      "share": "Condividi",
      "contribute": "Modifica/Contribuisci"
    },
    "seo": {
      "title_template": "{name} - {size}x{width} Cerchio Classic Mini",
      "description": "Specifiche dettagliate e immagini di questo cerchio Classic Mini",
      "keywords": "classic mini, cerchi, specifiche, offset, diametro, larghezza"
    }
  },
  "de": {
    "hero_title": "Classic Mini Felgen",
    "loading_text": "Felgendetails werden geladen...",
    "error_message": "Felgendetails konnten nicht geladen werden. Bitte versuchen Sie es später erneut.",
    "back_to_wheels": "Zurück zu den Felgen",
    "breadcrumb_fallback": "Felgendetails",
    "breadcrumb_subpage": "Felgen",
    "image_alt": "Bild der Felge {name}",
    "no_image_placeholder": "Kein Bild verfügbar",
    "specifications": {
      "offset": "Einpresstiefe",
      "diameter": "Durchmesser",
      "width": "Breite",
      "not_specified": "Nicht angegeben"
    },
    "suggest_edit": "Bearbeitung vorschlagen",
    "field_name": "Name",
    "field_width": "Breite",
    "field_size": "Durchmesser",
    "field_offset": "Einpresstiefe",
    "actions": {
      "copied": "Link kopiert!",
      "copy_link": "Link kopieren",
      "share": "Teilen",
      "contribute": "Bearbeiten/Beitragen"
    },
    "seo": {
      "title_template": "{name} - {size}x{width} Classic Mini Felge",
      "description": "Detaillierte Spezifikationen und Bilder dieser Classic Mini Felge",
      "keywords": "classic mini, felgen, spezifikationen, einpresstiefe, durchmesser, breite"
    }
  },
  "pt": {
    "hero_title": "Rodas Classic Mini",
    "loading_text": "A carregar detalhes da roda...",
    "error_message": "Falha ao carregar os detalhes da roda. Por favor, tente novamente mais tarde.",
    "back_to_wheels": "Voltar às Rodas",
    "breadcrumb_fallback": "Detalhes da Roda",
    "breadcrumb_subpage": "Rodas",
    "image_alt": "Imagem da roda {name}",
    "no_image_placeholder": "Nenhuma imagem disponível",
    "specifications": {
      "offset": "Offset",
      "diameter": "Diâmetro",
      "width": "Largura",
      "not_specified": "Não especificado"
    },
    "suggest_edit": "Sugerir Edição",
    "field_name": "Nome",
    "field_width": "Largura",
    "field_size": "Diâmetro",
    "field_offset": "Offset",
    "actions": {
      "copied": "Link copiado!",
      "copy_link": "Copiar Link",
      "share": "Partilhar",
      "contribute": "Editar/Contribuir"
    },
    "seo": {
      "title_template": "{name} - {size}x{width} Roda Classic Mini",
      "description": "Especificações detalhadas e imagens desta roda Classic Mini",
      "keywords": "classic mini, rodas, especificações, offset, diâmetro, largura"
    }
  },
  "ru": {
    "hero_title": "Диски Classic Mini",
    "loading_text": "Загрузка информации о диске...",
    "error_message": "Не удалось загрузить информацию о диске. Пожалуйста, повторите попытку позже.",
    "back_to_wheels": "Назад к дискам",
    "breadcrumb_fallback": "Информация о диске",
    "breadcrumb_subpage": "Диски",
    "image_alt": "Изображение диска {name}",
    "no_image_placeholder": "Изображение отсутствует",
    "specifications": {
      "offset": "Вылет",
      "diameter": "Диаметр",
      "width": "Ширина",
      "not_specified": "Не указано"
    },
    "suggest_edit": "Предложить правку",
    "field_name": "Название",
    "field_width": "Ширина",
    "field_size": "Диаметр",
    "field_offset": "Вылет",
    "actions": {
      "copied": "Ссылка скопирована!",
      "copy_link": "Копировать ссылку",
      "share": "Поделиться",
      "contribute": "Редактировать/Добавить"
    },
    "seo": {
      "title_template": "{name} - {size}x{width} диск Classic Mini",
      "description": "Подробные характеристики и изображения этого диска Classic Mini",
      "keywords": "classic mini, диски, характеристики, вылет, диаметр, ширина"
    }
  },
  "ja": {
    "hero_title": "クラシックミニ ホイール",
    "loading_text": "ホイールの詳細を読み込んでいます...",
    "error_message": "ホイールの詳細の読み込みに失敗しました。後でもう一度お試しください。",
    "back_to_wheels": "ホイール一覧に戻る",
    "breadcrumb_fallback": "ホイール詳細",
    "breadcrumb_subpage": "ホイール",
    "image_alt": "{name} ホイールの画像",
    "no_image_placeholder": "画像なし",
    "specifications": {
      "offset": "オフセット",
      "diameter": "径",
      "width": "幅",
      "not_specified": "未指定"
    },
    "suggest_edit": "編集を提案",
    "field_name": "名前",
    "field_width": "幅",
    "field_size": "径",
    "field_offset": "オフセット",
    "actions": {
      "copied": "リンクをコピーしました！",
      "copy_link": "リンクをコピー",
      "share": "シェア",
      "contribute": "編集・投稿"
    },
    "seo": {
      "title_template": "{name} - {size}x{width} クラシックミニ ホイール",
      "description": "このクラシックミニ ホイールの詳細な仕様と画像",
      "keywords": "クラシックミニ, ホイール, 仕様, オフセット, 径, 幅"
    }
  },
  "zh": {
    "hero_title": "经典迷你轮毂",
    "loading_text": "正在加载轮毂详情...",
    "error_message": "加载轮毂详情失败。请稍后重试。",
    "back_to_wheels": "返回轮毂列表",
    "breadcrumb_fallback": "轮毂详情",
    "breadcrumb_subpage": "轮毂",
    "image_alt": "{name} 轮毂图片",
    "no_image_placeholder": "暂无图片",
    "specifications": {
      "offset": "偏距",
      "diameter": "直径",
      "width": "宽度",
      "not_specified": "未指定"
    },
    "suggest_edit": "建议修改",
    "field_name": "名称",
    "field_width": "宽度",
    "field_size": "直径",
    "field_offset": "偏距",
    "actions": {
      "copied": "链接已复制！",
      "copy_link": "复制链接",
      "share": "分享",
      "contribute": "编辑/贡献"
    },
    "seo": {
      "title_template": "{name} - {size}x{width} 经典迷你轮毂",
      "description": "该经典迷你轮毂的详细规格和图片",
      "keywords": "经典迷你, 轮毂, 规格, 偏距, 直径, 宽度"
    }
  },
  "ko": {
    "hero_title": "클래식 미니 휠",
    "loading_text": "휠 상세 정보를 불러오는 중...",
    "error_message": "휠 상세 정보를 불러오지 못했습니다. 나중에 다시 시도해 주세요.",
    "back_to_wheels": "휠 목록으로 돌아가기",
    "breadcrumb_fallback": "휠 상세 정보",
    "breadcrumb_subpage": "휠",
    "image_alt": "{name} 휠 이미지",
    "no_image_placeholder": "이미지 없음",
    "specifications": {
      "offset": "오프셋",
      "diameter": "직경",
      "width": "폭",
      "not_specified": "미지정"
    },
    "suggest_edit": "수정 제안",
    "field_name": "이름",
    "field_width": "폭",
    "field_size": "직경",
    "field_offset": "오프셋",
    "actions": {
      "copied": "링크가 복사되었습니다!",
      "copy_link": "링크 복사",
      "share": "공유",
      "contribute": "편집/기여"
    },
    "seo": {
      "title_template": "{name} - {size}x{width} 클래식 미니 휠",
      "description": "이 클래식 미니 휠의 상세 사양 및 이미지",
      "keywords": "클래식 미니, 휠, 사양, 오프셋, 직경, 폭"
    }
  }
}
</i18n>
