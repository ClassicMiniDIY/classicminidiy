<script lang="ts" setup>
  const { t } = useI18n();

  const props = defineProps<{
    currentUrl?: string;
    displayName?: string;
    email?: string;
  }>();

  const emit = defineEmits<{
    upload: [file: File];
  }>();

  const fileInput = ref<HTMLInputElement | null>(null);
  const previewUrl = ref<string | null>(null);
  const error = ref('');

  const initials = computed(() => {
    const name = props.displayName || props.email || '?';
    return name.charAt(0).toUpperCase();
  });

  const avatarSrc = computed(() => previewUrl.value || props.currentUrl);

  function openFilePicker() {
    fileInput.value?.click();
  }

  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    error.value = '';

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      error.value = t('invalid_type');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      error.value = t('too_large');
      return;
    }

    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value);
    }
    previewUrl.value = URL.createObjectURL(file);
    emit('upload', file);

    // Reset input so same file can be re-selected
    input.value = '';
  }

  onUnmounted(() => {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value);
    }
  });
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <button
      type="button"
      class="relative w-24 h-24 rounded-full overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      @click="openFilePicker"
    >
      <img v-if="avatarSrc" :src="avatarSrc" :alt="t('avatar_alt')" class="w-full h-full object-cover" />
      <div
        v-else
        class="w-full h-full bg-primary text-primary-content flex items-center justify-center text-3xl font-bold"
      >
        {{ initials }}
      </div>
      <div
        class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <i class="fas fa-camera text-white text-xl"></i>
      </div>
    </button>

    <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" tabindex="-1" aria-hidden="true" @change="handleFileChange" />

    <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "avatar_alt": "Avatar",
    "invalid_type": "Please upload a JPEG, PNG, or WebP image.",
    "too_large": "Image must be under 5MB."
  },
  "de": {
    "avatar_alt": "Avatar",
    "invalid_type": "Bitte lade ein JPEG-, PNG- oder WebP-Bild hoch.",
    "too_large": "Das Bild muss kleiner als 5 MB sein."
  },
  "es": {
    "avatar_alt": "Avatar",
    "invalid_type": "Por favor, sube una imagen en formato JPEG, PNG o WebP.",
    "too_large": "La imagen debe pesar menos de 5 MB."
  },
  "fr": {
    "avatar_alt": "Avatar",
    "invalid_type": "Veuillez télécharger une image JPEG, PNG ou WebP.",
    "too_large": "L'image doit faire moins de 5 Mo."
  },
  "it": {
    "avatar_alt": "Avatar",
    "invalid_type": "Carica un'immagine in formato JPEG, PNG o WebP.",
    "too_large": "L'immagine deve essere inferiore a 5 MB."
  },
  "pt": {
    "avatar_alt": "Avatar",
    "invalid_type": "Por favor, carregue uma imagem JPEG, PNG ou WebP.",
    "too_large": "A imagem deve ter menos de 5 MB."
  },
  "ru": {
    "avatar_alt": "Аватар",
    "invalid_type": "Пожалуйста, загрузите изображение в формате JPEG, PNG или WebP.",
    "too_large": "Размер изображения не должен превышать 5 МБ."
  },
  "ja": {
    "avatar_alt": "アバター",
    "invalid_type": "JPEG、PNG、またはWebP形式の画像をアップロードしてください。",
    "too_large": "画像は5MB未満である必要があります。"
  },
  "zh": {
    "avatar_alt": "头像",
    "invalid_type": "请上传 JPEG、PNG 或 WebP 格式的图片。",
    "too_large": "图片大小必须小于 5MB。"
  },
  "ko": {
    "avatar_alt": "아바타",
    "invalid_type": "JPEG, PNG 또는 WebP 이미지를 업로드해 주세요.",
    "too_large": "이미지 크기는 5MB 미만이어야 합니다."
  }
}
</i18n>
