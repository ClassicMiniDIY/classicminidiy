<script lang="ts" setup>
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
      error.value = 'Please upload a JPEG, PNG, or WebP image.';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      error.value = 'Image must be under 5MB.';
      return;
    }

    previewUrl.value = URL.createObjectURL(file);
    emit('upload', file);

    // Reset input so same file can be re-selected
    input.value = '';
  }
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <button
      type="button"
      class="relative w-24 h-24 rounded-full overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      @click="openFilePicker"
    >
      <img v-if="avatarSrc" :src="avatarSrc" alt="Avatar" class="w-full h-full object-cover" />
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

    <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="handleFileChange" />

    <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
  </div>
</template>
