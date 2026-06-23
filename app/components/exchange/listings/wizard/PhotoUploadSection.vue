<template>
  <div class="card bg-base-200">
    <div class="card-body">
      <h4 class="font-bold">{{ title }}</h4>
      <p class="text-sm text-base-content/70 mb-2">{{ description }}</p>
      <p v-if="localPhotos.length > 1" class="text-xs text-base-content/50 mb-4">
        {{ t('reorderHint') }}
      </p>

      <!-- Draggable Photo Grid -->
      <div class="mb-4">
        <draggable
          v-model="localPhotos"
          item-key="preview"
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
          ghost-class="opacity-30"
          animation="200"
          @end="onDragEnd"
        >
          <template #item="{ element: photo, index }">
            <div
              class="relative aspect-square rounded-lg overflow-hidden bg-base-300 cursor-grab active:cursor-grabbing"
            >
              <img
                :src="photo.preview"
                :alt="t('photoAlt', { number: index + 1 })"
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <!-- Primary badge on first photo -->
              <span v-if="index === 0" class="absolute top-1 left-1 badge badge-primary badge-sm gap-1">
                <i class="fas fa-star"></i>
                {{ t('primary') }}
              </span>
              <!-- Delete button -->
              <button
                type="button"
                class="absolute top-1 right-1 btn btn-circle btn-xs btn-error"
                :aria-label="t('removePhoto')"
                @click.stop="removePhoto(index)"
              >
                <i class="fas fa-xmark"></i>
              </button>
              <!-- Drag handle hint -->
              <div class="absolute bottom-1 right-1 text-white/60 pointer-events-none">
                <i class="fas fa-up-right-and-down-left-from-center drop-shadow"></i>
              </div>
            </div>
          </template>
        </draggable>

        <!-- Add Photo Button -->
        <div
          v-if="localPhotos.length < maxPhotos"
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
          :class="{ 'mt-4': localPhotos.length > 0 }"
        >
          <label
            class="aspect-square rounded-lg border-2 border-dashed border-base-content/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-base-300 transition-colors"
          >
            <i class="fas fa-plus text-2xl text-base-content/50"></i>
            <span class="text-xs text-base-content/50 mt-1">{{ t('addPhoto') }}</span>
            <input type="file" accept="image/*" multiple class="hidden" @change="handleFileSelect" />
          </label>
        </div>
      </div>

      <p class="text-xs text-base-content/50">{{ t('photoCount', { count: localPhotos.length, max: maxPhotos }) }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import draggable from 'vuedraggable';
  import type { OptimizeResult } from '~/utils/imageOptimizer';

  const { t } = useI18n();

  const props = defineProps<{
    title: string;
    description: string;
    photos: OptimizeResult[];
    maxPhotos: number;
  }>();

  const emit = defineEmits<{
    'update:photos': [value: OptimizeResult[]];
  }>();

  const { prepareFileForUpload } = useListingPhotos();
  const toast = useToast();

  // Local copy of photos for draggable v-model (avoids mutating props)
  const localPhotos = ref<OptimizeResult[]>([...props.photos]);

  // Sync from parent when props change (e.g. after file upload adds new photos)
  watch(
    () => props.photos,
    (newPhotos) => {
      localPhotos.value = [...newPhotos];
    },
    { deep: true }
  );

  const onDragEnd = () => {
    emit('update:photos', [...localPhotos.value]);
  };

  const removePhoto = (index: number) => {
    localPhotos.value.splice(index, 1);
    emit('update:photos', [...localPhotos.value]);
  };

  const handleFileSelect = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    const files = Array.from(input.files);
    const remaining = props.maxPhotos - localPhotos.value.length;

    if (files.length > remaining) {
      toast.add({
        title: t('photoLimitTitle'),
        description: t('photoLimitDesc', { remaining }),
        color: 'warning',
      });
    }

    const filesToAdd = files.slice(0, remaining);
    const processedFiles: OptimizeResult[] = [];

    for (const file of filesToAdd) {
      try {
        const processed = await prepareFileForUpload(file);
        if (processed) {
          processedFiles.push(processed);
        }
      } catch (error) {
        console.error('Error processing file:', error);
      }
    }

    emit('update:photos', [...localPhotos.value, ...processedFiles]);
    input.value = '';
  };
</script>

<i18n lang="json">
{
  "en": {
    "reorderHint": "Drag photos to reorder. The first photo is used as the primary image.",
    "photoAlt": "Photo {number} preview",
    "primary": "Primary",
    "removePhoto": "Remove photo",
    "addPhoto": "Add Photo",
    "photoCount": "{count}/{max} photos",
    "photoLimitTitle": "Photo Limit",
    "photoLimitDesc": "You can only add {remaining} more photo(s)"
  },
  "es": {
    "reorderHint": "Arrastra las fotos para reordenarlas. La primera foto se usa como imagen principal.",
    "photoAlt": "Vista previa de la foto {number}",
    "primary": "Principal",
    "removePhoto": "Eliminar foto",
    "addPhoto": "Añadir foto",
    "photoCount": "{count}/{max} fotos",
    "photoLimitTitle": "Límite de fotos",
    "photoLimitDesc": "Solo puedes añadir {remaining} foto(s) más"
  },
  "fr": {
    "reorderHint": "Faites glisser les photos pour les réorganiser. La première photo sert d'image principale.",
    "photoAlt": "Aperçu de la photo {number}",
    "primary": "Principale",
    "removePhoto": "Supprimer la photo",
    "addPhoto": "Ajouter une photo",
    "photoCount": "{count}/{max} photos",
    "photoLimitTitle": "Limite de photos",
    "photoLimitDesc": "Vous ne pouvez ajouter que {remaining} photo(s) de plus"
  },
  "de": {
    "reorderHint": "Ziehe Fotos, um sie neu zu ordnen. Das erste Foto wird als Hauptbild verwendet.",
    "photoAlt": "Vorschau von Foto {number}",
    "primary": "Hauptbild",
    "removePhoto": "Foto entfernen",
    "addPhoto": "Foto hinzufügen",
    "photoCount": "{count}/{max} Fotos",
    "photoLimitTitle": "Foto-Limit",
    "photoLimitDesc": "Du kannst nur noch {remaining} Foto(s) hinzufügen"
  },
  "it": {
    "reorderHint": "Trascina le foto per riordinarle. La prima foto viene usata come immagine principale.",
    "photoAlt": "Anteprima della foto {number}",
    "primary": "Principale",
    "removePhoto": "Rimuovi foto",
    "addPhoto": "Aggiungi foto",
    "photoCount": "{count}/{max} foto",
    "photoLimitTitle": "Limite foto",
    "photoLimitDesc": "Puoi aggiungere solo altre {remaining} foto"
  },
  "pt": {
    "reorderHint": "Arraste as fotos para reordenar. A primeira foto é usada como imagem principal.",
    "photoAlt": "Pré-visualização da foto {number}",
    "primary": "Principal",
    "removePhoto": "Remover foto",
    "addPhoto": "Adicionar foto",
    "photoCount": "{count}/{max} fotos",
    "photoLimitTitle": "Limite de fotos",
    "photoLimitDesc": "Você só pode adicionar mais {remaining} foto(s)"
  },
  "ru": {
    "reorderHint": "Перетащите фотографии для изменения порядка. Первая фотография используется как основная.",
    "photoAlt": "Предпросмотр фото {number}",
    "primary": "Основное",
    "removePhoto": "Удалить фото",
    "addPhoto": "Добавить фото",
    "photoCount": "{count}/{max} фото",
    "photoLimitTitle": "Лимит фотографий",
    "photoLimitDesc": "Вы можете добавить ещё только {remaining} фото"
  },
  "ja": {
    "reorderHint": "写真をドラッグして並べ替えます。最初の写真がメイン画像として使用されます。",
    "photoAlt": "写真 {number} のプレビュー",
    "primary": "メイン",
    "removePhoto": "写真を削除",
    "addPhoto": "写真を追加",
    "photoCount": "{count}/{max} 枚の写真",
    "photoLimitTitle": "写真の上限",
    "photoLimitDesc": "あと {remaining} 枚しか追加できません"
  },
  "zh": {
    "reorderHint": "拖动照片以重新排序。第一张照片将用作主图。",
    "photoAlt": "照片 {number} 预览",
    "primary": "主图",
    "removePhoto": "移除照片",
    "addPhoto": "添加照片",
    "photoCount": "{count}/{max} 张照片",
    "photoLimitTitle": "照片数量上限",
    "photoLimitDesc": "您最多只能再添加 {remaining} 张照片"
  },
  "ko": {
    "reorderHint": "사진을 드래그하여 순서를 변경하세요. 첫 번째 사진이 대표 이미지로 사용됩니다.",
    "photoAlt": "사진 {number} 미리보기",
    "primary": "대표",
    "removePhoto": "사진 삭제",
    "addPhoto": "사진 추가",
    "photoCount": "{count}/{max} 장",
    "photoLimitTitle": "사진 제한",
    "photoLimitDesc": "최대 {remaining}장만 더 추가할 수 있습니다"
  }
}
</i18n>
