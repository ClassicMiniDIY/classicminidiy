<template>
  <!-- Empty State -->
  <div
    v-if="sortedPhotos.length === 0"
    class="flex flex-col items-center justify-center border-2 border-dashed border-base-300 rounded-lg p-12 text-base-content/50"
  >
    <i class="fas fa-camera text-6xl mb-4"></i>
    <p class="text-lg font-medium">{{ t('noPhotos') }}</p>
  </div>

  <!-- Photo Gallery -->
  <div v-else>
    <!-- Category Tabs (Vehicle listings only) -->
    <div v-if="listingCategory === 'vehicle' && sortedPhotos.length > 0" data-testid="category-tabs" class="mb-4">
      <div class="tabs tabs-box">
        <button
          data-testid="tab-all"
          class="tab"
          :class="{ 'tab-active': activeCategory === 'all' }"
          @click="activeCategory = 'all'"
        >
          {{ t('tabAll', { count: sortedPhotos.length }) }}
        </button>
        <button
          v-if="photosByCategory.body.length > 0"
          data-testid="tab-body"
          class="tab"
          :class="{ 'tab-active': activeCategory === 'body' }"
          @click="activeCategory = 'body'"
        >
          <i class="fas fa-image mr-1"></i>
          {{ t('tabBody', { count: photosByCategory.body.length }) }}
        </button>
        <button
          v-if="photosByCategory.engine.length > 0"
          data-testid="tab-engine"
          class="tab"
          :class="{ 'tab-active': activeCategory === 'engine' }"
          @click="activeCategory = 'engine'"
        >
          <i class="fas fa-gear mr-1"></i>
          {{ t('tabEngine', { count: photosByCategory.engine.length }) }}
        </button>
        <button
          v-if="photosByCategory.interior.length > 0"
          data-testid="tab-interior"
          class="tab"
          :class="{ 'tab-active': activeCategory === 'interior' }"
          @click="activeCategory = 'interior'"
        >
          <i class="fas fa-table-cells-large mr-1"></i>
          {{ t('tabInterior', { count: photosByCategory.interior.length }) }}
        </button>
        <button
          v-if="photosByCategory.details.length > 0"
          data-testid="tab-details"
          class="tab"
          :class="{ 'tab-active': activeCategory === 'details' }"
          @click="activeCategory = 'details'"
        >
          <i class="fas fa-wand-magic-sparkles mr-1"></i>
          {{ t('tabDetails', { count: photosByCategory.details.length }) }}
        </button>
      </div>
    </div>

    <!-- Hero Main Image -->
    <div class="relative overflow-hidden rounded-lg bg-base-200">
      <img
        v-if="activePhoto"
        data-testid="hero-image"
        :src="getPhotoUrl(activePhoto.storage_path)"
        :alt="t('heroAlt', { title: listingTitle, category: activePhoto.category || t('photo'), index: activeFilteredIndex + 1 })"
        class="w-full aspect-4/3 md:aspect-video object-contain cursor-zoom-in"
        style="object-fit: contain"
        @click="openLightbox"
      />

      <!-- Nav Arrows (hidden when 1 photo) -->
      <template v-if="filteredPhotos.length > 1">
        <button
          data-testid="prev-button"
          :aria-label="t('previousPhoto')"
          class="btn btn-circle btn-sm absolute left-2 top-1/2 -translate-y-1/2 bg-base-100/80 hover:bg-base-100 border-none shadow-md"
          @click="navigate('prev')"
        >
          <i class="fas fa-chevron-left"></i>
        </button>
        <button
          data-testid="next-button"
          :aria-label="t('nextPhoto')"
          class="btn btn-circle btn-sm absolute right-2 top-1/2 -translate-y-1/2 bg-base-100/80 hover:bg-base-100 border-none shadow-md"
          @click="navigate('next')"
        >
          <i class="fas fa-chevron-right"></i>
        </button>
      </template>

      <!-- Photo Counter (hidden when 1 photo) -->
      <div
        v-if="filteredPhotos.length > 1"
        data-testid="photo-counter"
        class="absolute bottom-3 right-3 badge badge-neutral badge-sm gap-1"
      >
        {{ activeFilteredIndex + 1 }} / {{ filteredPhotos.length }}
      </div>
    </div>

    <!-- Thumbnail Strip (hidden when 1 photo) -->
    <div
      v-if="filteredPhotos.length > 1"
      ref="thumbnailStripRef"
      data-testid="thumbnail-strip"
      class="flex gap-2 mt-3 overflow-x-auto pb-2"
      style="scroll-snap-type: x mandatory"
    >
      <button
        v-for="(photo, index) in filteredPhotos"
        :key="photo.id"
        :data-testid="`thumbnail-${index}`"
        :ref="(el) => setThumbnailRef(index, el)"
        class="shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-md overflow-hidden border-2 transition-all duration-150"
        :class="
          photo.id === activePhotoId
            ? 'border-primary ring-2 ring-primary ring-offset-1'
            : 'border-transparent hover:border-base-300'
        "
        style="scroll-snap-align: center"
        @click="selectPhoto(photo)"
      >
        <img
          :src="getPhotoUrl(photo.storage_path)"
          :alt="t('thumbnailAlt', { title: listingTitle, index: index + 1 })"
          class="w-full h-full object-cover"
          loading="lazy"
        />
      </button>
    </div>

    <!-- Lightbox Modal -->
    <dialog ref="lightboxModal" class="modal" data-testid="lightbox-modal">
      <div class="modal-box max-w-7xl w-full p-0 bg-transparent shadow-none">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10 bg-base-100/80 hover:bg-base-100">
            ✕
          </button>
        </form>

        <div class="relative">
          <div class="carousel w-full bg-base-100 rounded-lg">
            <div
              v-for="(photo, index) in sortedPhotos"
              :key="photo.id"
              :ref="(el) => setLightboxSlideRef(index, el)"
              class="carousel-item relative w-full"
            >
              <img
                :src="getPhotoUrl(photo.storage_path)"
                :alt="t('lightboxAlt', { title: listingTitle, index: index + 1 })"
                class="w-full max-h-[80vh] object-contain mx-auto"
                loading="lazy"
              />

              <div
                v-if="sortedPhotos.length > 1"
                class="absolute left-5 right-5 top-1/2 flex -translate-y-1/2 transform justify-between"
              >
                <button
                  data-testid="lightbox-prev"
                  @click="navigateLightbox(-1)"
                  class="btn btn-circle bg-base-100/80 hover:bg-base-100"
                  :aria-label="t('previousPhoto')"
                >
                  <i class="fas fa-chevron-left"></i>
                </button>
                <button
                  data-testid="lightbox-next"
                  @click="navigateLightbox(1)"
                  class="btn btn-circle bg-base-100/80 hover:bg-base-100"
                  :aria-label="t('nextPhoto')"
                >
                  <i class="fas fa-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>

          <div
            v-if="sortedPhotos.length > 1"
            data-testid="lightbox-counter"
            class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-base-100/80 px-4 py-2 rounded-full text-sm font-medium"
          >
            {{ lightboxIndex + 1 }} / {{ sortedPhotos.length }}
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>{{ t('close') }}</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  type ListingPhoto = {
    id: string;
    storage_path: string;
    display_order: number;
    category: string | null;
    caption: string | null;
    is_primary: boolean;
  };

  interface Props {
    photos: ListingPhoto[];
    listingTitle: string;
    listingCategory: 'vehicle' | 'engine' | 'parts';
    getPhotoUrl: (path: string) => string;
  }

  const props = defineProps<Props>();

  // Category sort order
  const CATEGORY_ORDER: Record<string, number> = {
    body: 0,
    engine: 1,
    interior: 2,
    details: 3,
  };

  // Sorted photos: by category order, then primary first, then display_order
  const sortedPhotos = computed(() => {
    return [...props.photos].sort((a, b) => {
      const catA = CATEGORY_ORDER[a.category || ''] ?? 99;
      const catB = CATEGORY_ORDER[b.category || ''] ?? 99;
      if (catA !== catB) return catA - catB;
      // Primary photos first within category
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return a.display_order - b.display_order;
    });
  });

  // Active category filter (Task 3 will add category tabs UI)
  const activeCategory = ref<'all' | 'body' | 'engine' | 'interior' | 'details'>('all');

  // Group photos by category
  const photosByCategory = computed(() => {
    const groups: Record<string, ListingPhoto[]> = {
      body: [],
      engine: [],
      interior: [],
      details: [],
    };
    for (const photo of sortedPhotos.value) {
      if (photo.category && groups[photo.category]) {
        groups[photo.category].push(photo);
      }
    }
    return groups;
  });

  // Filtered photos based on active category
  const filteredPhotos = computed(() => {
    if (activeCategory.value === 'all') return sortedPhotos.value;
    return sortedPhotos.value.filter((p) => p.category === activeCategory.value);
  });

  // Currently active photo ID
  const activePhotoId = ref<string | null>(null);

  // Initialize activePhotoId when photos first become available
  watch(
    sortedPhotos,
    (photos) => {
      if (photos.length > 0 && !activePhotoId.value) {
        activePhotoId.value = photos[0].id;
      }
    },
    { immediate: true }
  );

  // Active photo object
  const activePhoto = computed(() => {
    if (!activePhotoId.value) return filteredPhotos.value[0] ?? null;
    return filteredPhotos.value.find((p) => p.id === activePhotoId.value) ?? filteredPhotos.value[0] ?? null;
  });

  // Active photo index in filtered list
  const activeFilteredIndex = computed(() => {
    if (!activePhoto.value) return 0;
    const idx = filteredPhotos.value.findIndex((p) => p.id === activePhoto.value!.id);
    return idx >= 0 ? idx : 0;
  });

  // Thumbnail refs for scroll-into-view
  const thumbnailStripRef = ref<HTMLElement | null>(null);
  const thumbnailRefs = ref<Record<number, HTMLElement | null>>({});

  const setThumbnailRef = (index: number, el: any) => {
    thumbnailRefs.value[index] = el as HTMLElement | null;
  };

  // Navigate prev/next with wrap-around
  const navigate = (direction: 'prev' | 'next') => {
    const len = filteredPhotos.value.length;
    if (len <= 1) return;

    let newIndex = activeFilteredIndex.value;
    if (direction === 'next') {
      newIndex = (newIndex + 1) % len;
    } else {
      newIndex = (newIndex - 1 + len) % len;
    }

    const newPhoto = filteredPhotos.value[newIndex];
    activePhotoId.value = newPhoto.id;
    scrollThumbnailIntoView(newIndex);
  };

  // Select a specific photo
  const selectPhoto = (photo: ListingPhoto) => {
    activePhotoId.value = photo.id;
    const idx = filteredPhotos.value.findIndex((p) => p.id === photo.id);
    if (idx >= 0) scrollThumbnailIntoView(idx);
  };

  // Auto-scroll thumbnail strip
  const scrollThumbnailIntoView = (index: number) => {
    nextTick(() => {
      const el = thumbnailRefs.value[index];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  };

  // Reset active photo when category changes
  watch(activeCategory, () => {
    const first = filteredPhotos.value[0];
    activePhotoId.value = first?.id ?? null;
  });

  // ===== Lightbox =====
  const lightboxModal = ref<HTMLDialogElement | null>(null);
  const lightboxIndex = ref(0);
  const lightboxSlideRefs = ref<Record<number, HTMLElement | null>>({});

  const setLightboxSlideRef = (index: number, el: any) => {
    lightboxSlideRefs.value[index] = el as HTMLElement | null;
  };

  const openLightbox = () => {
    // Find the active photo's index in the FULL unfiltered set
    const allIdx = sortedPhotos.value.findIndex((p) => p.id === activePhoto.value?.id);
    lightboxIndex.value = allIdx >= 0 ? allIdx : 0;
    lightboxModal.value?.showModal();
    scrollLightboxTo(lightboxIndex.value, 'instant');
  };

  const navigateLightbox = (direction: number) => {
    const total = sortedPhotos.value.length;
    let newIdx = lightboxIndex.value + direction;
    if (newIdx < 0) newIdx = total - 1;
    if (newIdx >= total) newIdx = 0;
    lightboxIndex.value = newIdx;
    scrollLightboxTo(newIdx, 'smooth');
  };

  const scrollLightboxTo = (index: number, behavior: ScrollBehavior) => {
    nextTick(() => {
      lightboxSlideRefs.value[index]?.scrollIntoView({
        behavior,
        block: 'nearest',
        inline: 'center',
      });
    });
  };

  // Keyboard navigation for lightbox
  const handleKeyDown = (event: KeyboardEvent) => {
    if (lightboxModal.value?.open) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateLightbox(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigateLightbox(1);
      }
    }
  };

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  // Expose for potential parent use and testing
  defineExpose({
    activeCategory,
    activePhotoId,
    activePhoto,
    filteredPhotos,
    photosByCategory,
    lightboxModal,
    lightboxIndex,
    openLightbox,
    navigateLightbox,
    scrollLightboxTo,
    handleKeyDown,
  });
</script>

<i18n lang="json">
{
  "en": {
    "noPhotos": "No photos available",
    "tabAll": "All ({count})",
    "tabBody": "Body ({count})",
    "tabEngine": "Engine ({count})",
    "tabInterior": "Interior ({count})",
    "tabDetails": "Details ({count})",
    "previousPhoto": "Previous photo",
    "nextPhoto": "Next photo",
    "photo": "photo",
    "heroAlt": "{title} - {category} {index}",
    "thumbnailAlt": "{title} thumbnail {index}",
    "lightboxAlt": "{title} - Photo {index}",
    "close": "close"
  },
  "es": {
    "noPhotos": "No hay fotos disponibles",
    "tabAll": "Todas ({count})",
    "tabBody": "Carrocería ({count})",
    "tabEngine": "Motor ({count})",
    "tabInterior": "Interior ({count})",
    "tabDetails": "Detalles ({count})",
    "previousPhoto": "Foto anterior",
    "nextPhoto": "Foto siguiente",
    "photo": "foto",
    "heroAlt": "{title} - {category} {index}",
    "thumbnailAlt": "{title} miniatura {index}",
    "lightboxAlt": "{title} - Foto {index}",
    "close": "cerrar"
  },
  "fr": {
    "noPhotos": "Aucune photo disponible",
    "tabAll": "Toutes ({count})",
    "tabBody": "Carrosserie ({count})",
    "tabEngine": "Moteur ({count})",
    "tabInterior": "Intérieur ({count})",
    "tabDetails": "Détails ({count})",
    "previousPhoto": "Photo précédente",
    "nextPhoto": "Photo suivante",
    "photo": "photo",
    "heroAlt": "{title} - {category} {index}",
    "thumbnailAlt": "{title} miniature {index}",
    "lightboxAlt": "{title} - Photo {index}",
    "close": "fermer"
  },
  "de": {
    "noPhotos": "Keine Fotos verfügbar",
    "tabAll": "Alle ({count})",
    "tabBody": "Karosserie ({count})",
    "tabEngine": "Motor ({count})",
    "tabInterior": "Innenraum ({count})",
    "tabDetails": "Details ({count})",
    "previousPhoto": "Vorheriges Foto",
    "nextPhoto": "Nächstes Foto",
    "photo": "Foto",
    "heroAlt": "{title} - {category} {index}",
    "thumbnailAlt": "{title} Miniaturbild {index}",
    "lightboxAlt": "{title} - Foto {index}",
    "close": "schließen"
  },
  "it": {
    "noPhotos": "Nessuna foto disponibile",
    "tabAll": "Tutte ({count})",
    "tabBody": "Carrozzeria ({count})",
    "tabEngine": "Motore ({count})",
    "tabInterior": "Interni ({count})",
    "tabDetails": "Dettagli ({count})",
    "previousPhoto": "Foto precedente",
    "nextPhoto": "Foto successiva",
    "photo": "foto",
    "heroAlt": "{title} - {category} {index}",
    "thumbnailAlt": "{title} miniatura {index}",
    "lightboxAlt": "{title} - Foto {index}",
    "close": "chiudi"
  },
  "pt": {
    "noPhotos": "Nenhuma foto disponível",
    "tabAll": "Todas ({count})",
    "tabBody": "Carroceria ({count})",
    "tabEngine": "Motor ({count})",
    "tabInterior": "Interior ({count})",
    "tabDetails": "Detalhes ({count})",
    "previousPhoto": "Foto anterior",
    "nextPhoto": "Próxima foto",
    "photo": "foto",
    "heroAlt": "{title} - {category} {index}",
    "thumbnailAlt": "{title} miniatura {index}",
    "lightboxAlt": "{title} - Foto {index}",
    "close": "fechar"
  },
  "ru": {
    "noPhotos": "Фотографии отсутствуют",
    "tabAll": "Все ({count})",
    "tabBody": "Кузов ({count})",
    "tabEngine": "Двигатель ({count})",
    "tabInterior": "Салон ({count})",
    "tabDetails": "Детали ({count})",
    "previousPhoto": "Предыдущее фото",
    "nextPhoto": "Следующее фото",
    "photo": "фото",
    "heroAlt": "{title} - {category} {index}",
    "thumbnailAlt": "{title} миниатюра {index}",
    "lightboxAlt": "{title} - Фото {index}",
    "close": "закрыть"
  },
  "ja": {
    "noPhotos": "利用可能な写真はありません",
    "tabAll": "すべて ({count})",
    "tabBody": "ボディ ({count})",
    "tabEngine": "エンジン ({count})",
    "tabInterior": "インテリア ({count})",
    "tabDetails": "ディテール ({count})",
    "previousPhoto": "前の写真",
    "nextPhoto": "次の写真",
    "photo": "写真",
    "heroAlt": "{title} - {category} {index}",
    "thumbnailAlt": "{title} サムネイル {index}",
    "lightboxAlt": "{title} - 写真 {index}",
    "close": "閉じる"
  },
  "zh": {
    "noPhotos": "暂无照片",
    "tabAll": "全部 ({count})",
    "tabBody": "车身 ({count})",
    "tabEngine": "发动机 ({count})",
    "tabInterior": "内饰 ({count})",
    "tabDetails": "细节 ({count})",
    "previousPhoto": "上一张照片",
    "nextPhoto": "下一张照片",
    "photo": "照片",
    "heroAlt": "{title} - {category} {index}",
    "thumbnailAlt": "{title} 缩略图 {index}",
    "lightboxAlt": "{title} - 照片 {index}",
    "close": "关闭"
  },
  "ko": {
    "noPhotos": "사용 가능한 사진이 없습니다",
    "tabAll": "전체 ({count})",
    "tabBody": "차체 ({count})",
    "tabEngine": "엔진 ({count})",
    "tabInterior": "실내 ({count})",
    "tabDetails": "세부 사항 ({count})",
    "previousPhoto": "이전 사진",
    "nextPhoto": "다음 사진",
    "photo": "사진",
    "heroAlt": "{title} - {category} {index}",
    "thumbnailAlt": "{title} 썸네일 {index}",
    "lightboxAlt": "{title} - 사진 {index}",
    "close": "닫기"
  }
}
</i18n>
