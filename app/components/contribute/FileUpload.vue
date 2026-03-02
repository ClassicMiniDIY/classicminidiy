<script lang="ts" setup>
  declare const URL: {
    createObjectURL(file: File): string;
    revokeObjectURL(url: string): void;
  };

  import { humanFileSize } from '../../data/models/helper-utils';

  const { t } = useI18n();

  const props = withDefaults(
    defineProps<{
      accept?: string;
      maxFiles?: number;
      maxSizeMb?: number;
      required?: boolean;
      label?: string;
    }>(),
    {
      accept: 'image/jpeg,image/png',
      maxFiles: 5,
      maxSizeMb: 5,
      required: false,
    }
  );

  const emit = defineEmits<{
    'update:files': [files: File[]];
  }>();

  const files = ref<File[]>([]);
  const fileInput = ref<HTMLInputElement | null>(null);
  const error = ref('');
  const isDragOver = ref(false);

  // Computed list of allowed MIME types from the accept prop
  const allowedTypes = computed(() =>
    props.accept
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
  );

  // Human-readable accepted type labels for the helper text
  const acceptedTypeLabels = computed(() => {
    const labelMap: Record<string, string> = {
      'image/jpeg': 'JPG',
      'image/png': 'PNG',
      'application/pdf': 'PDF',
      'image/gif': 'GIF',
      'image/webp': 'WebP',
    };
    return allowedTypes.value.map((type) => labelMap[type] || type).join(', ');
  });

  const maxFilesReached = computed(() => files.value.length >= props.maxFiles);

  function isImage(file: File): boolean {
    return file.type.startsWith('image/');
  }

  function getPreviewUrl(file: File): string {
    return URL.createObjectURL(file);
  }

  function formatSize(bytes: number): string {
    return humanFileSize(bytes, true);
  }

  function validateAndAddFiles(incoming: File[]) {
    error.value = '';
    const maxBytes = props.maxSizeMb * 1024 * 1024;
    const validFiles: File[] = [];

    for (const file of incoming) {
      // Check file count limit
      if (files.value.length + validFiles.length >= props.maxFiles) {
        error.value = t('max_files_reached', { max: props.maxFiles });
        break;
      }

      // Check file type
      if (!allowedTypes.value.includes(file.type)) {
        error.value = t('invalid_type', { name: file.name });
        continue;
      }

      // Check file size
      if (file.size > maxBytes) {
        error.value = t('file_too_large', { name: file.name, max: props.maxSizeMb });
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      files.value = [...files.value, ...validFiles];
      emit('update:files', files.value);
    }
  }

  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      validateAndAddFiles(Array.from(input.files));
    }
    // Reset so the same file can be selected again
    input.value = '';
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver.value = false;
    if (event.dataTransfer?.files) {
      validateAndAddFiles(Array.from(event.dataTransfer.files));
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragOver.value = true;
  }

  function handleDragLeave() {
    isDragOver.value = false;
  }

  function openFilePicker() {
    fileInput.value?.click();
  }

  function removeFile(index: number) {
    files.value.splice(index, 1);
    error.value = '';
    emit('update:files', files.value);
  }

  // Cleanup object URLs on unmount
  onBeforeUnmount(() => {
    files.value.forEach((file) => {
      if (isImage(file)) {
        try {
          URL.revokeObjectURL(getPreviewUrl(file));
        } catch {
          // Ignore errors during cleanup
        }
      }
    });
  });
</script>

<template>
  <div>
    <!-- Label -->
    <label v-if="label" class="fieldset-legend mb-2 block">
      {{ label }}
      <span v-if="required" class="text-error">*</span>
    </label>

    <!-- Drop zone (hidden when maxFiles reached) -->
    <div
      v-if="!maxFilesReached"
      class="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors duration-200"
      :class="isDragOver ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-primary/50'"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @click="openFilePicker"
    >
      <i class="fad fa-cloud-arrow-up text-4xl opacity-40 mb-3 block"></i>
      <p class="font-medium">{{ t('drop_zone_text') }}</p>
      <p class="text-sm opacity-50 mt-1">
        {{ t('accepted_types', { types: acceptedTypeLabels }) }} &mdash; {{ t('max_size', { size: maxSizeMb }) }}
      </p>
      <input
        type="file"
        hidden
        ref="fileInput"
        :accept="accept"
        multiple
        @change="handleFileChange"
      />
    </div>

    <!-- Max files notice -->
    <div v-else class="border-2 border-dashed border-base-300 rounded-xl p-6 text-center opacity-60">
      <i class="fad fa-check-circle text-2xl text-success mb-2 block"></i>
      <p class="text-sm">{{ t('max_files_reached', { max: maxFiles }) }}</p>
    </div>

    <!-- File previews grid -->
    <div v-if="files.length > 0" class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
      <div v-for="(file, index) in files" :key="`${file.name}-${file.size}-${index}`" class="relative group">
        <!-- Image preview -->
        <img
          v-if="isImage(file)"
          :src="getPreviewUrl(file)"
          :alt="file.name"
          class="rounded-lg object-cover aspect-square w-full"
        />
        <!-- PDF / non-image preview -->
        <div v-else class="rounded-lg bg-base-200 flex items-center justify-center aspect-square w-full">
          <i class="fad fa-file-pdf text-3xl"></i>
        </div>

        <!-- File info -->
        <p class="text-xs truncate mt-1">{{ file.name }}</p>
        <p class="text-xs opacity-50">{{ formatSize(file.size) }}</p>

        <!-- Remove button -->
        <button
          type="button"
          class="btn btn-circle btn-xs btn-error absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
          @click.stop="removeFile(index)"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <!-- Validation errors -->
    <p v-if="error" class="text-sm text-error mt-2">
      <i class="fas fa-exclamation-circle mr-1"></i>
      {{ error }}
    </p>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "drop_zone_text": "Drag & drop files or click to browse",
    "accepted_types": "Accepted: {types}",
    "max_size": "Max {size}MB each",
    "file_too_large": "File too large: {name}. Maximum size is {max}MB.",
    "invalid_type": "Invalid file type: {name}",
    "max_files_reached": "Maximum {max} files allowed"
  },
  "es": {
    "drop_zone_text": "Arrastra y suelta archivos o haz clic para buscar",
    "accepted_types": "Aceptados: {types}",
    "max_size": "Maximo {size}MB cada uno",
    "file_too_large": "Archivo demasiado grande: {name}. El tamano maximo es {max}MB.",
    "invalid_type": "Tipo de archivo no valido: {name}",
    "max_files_reached": "Maximo {max} archivos permitidos"
  },
  "fr": {
    "drop_zone_text": "Glissez-deposez des fichiers ou cliquez pour parcourir",
    "accepted_types": "Acceptes: {types}",
    "max_size": "Max {size}Mo chacun",
    "file_too_large": "Fichier trop volumineux: {name}. La taille maximale est de {max}Mo.",
    "invalid_type": "Type de fichier non valide: {name}",
    "max_files_reached": "Maximum {max} fichiers autorises"
  },
  "it": {
    "drop_zone_text": "Trascina e rilascia i file o clicca per sfogliare",
    "accepted_types": "Accettati: {types}",
    "max_size": "Max {size}MB ciascuno",
    "file_too_large": "File troppo grande: {name}. La dimensione massima e {max}MB.",
    "invalid_type": "Tipo di file non valido: {name}",
    "max_files_reached": "Massimo {max} file consentiti"
  },
  "de": {
    "drop_zone_text": "Dateien hierher ziehen oder klicken zum Durchsuchen",
    "accepted_types": "Akzeptiert: {types}",
    "max_size": "Max {size}MB pro Datei",
    "file_too_large": "Datei zu gross: {name}. Maximale Groesse ist {max}MB.",
    "invalid_type": "Ungueltiger Dateityp: {name}",
    "max_files_reached": "Maximal {max} Dateien erlaubt"
  },
  "pt": {
    "drop_zone_text": "Arraste e solte arquivos ou clique para procurar",
    "accepted_types": "Aceitos: {types}",
    "max_size": "Max {size}MB cada",
    "file_too_large": "Arquivo muito grande: {name}. O tamanho maximo e {max}MB.",
    "invalid_type": "Tipo de arquivo invalido: {name}",
    "max_files_reached": "Maximo de {max} arquivos permitidos"
  },
  "ru": {
    "drop_zone_text": "Перетащите файлы или нажмите для выбора",
    "accepted_types": "Допустимые: {types}",
    "max_size": "Макс. {size}МБ каждый",
    "file_too_large": "Файл слишком большой: {name}. Максимальный размер {max}МБ.",
    "invalid_type": "Недопустимый тип файла: {name}",
    "max_files_reached": "Максимум {max} файлов разрешено"
  },
  "ja": {
    "drop_zone_text": "ファイルをドラッグ&ドロップまたはクリックして選択",
    "accepted_types": "対応形式: {types}",
    "max_size": "最大{size}MB/ファイル",
    "file_too_large": "ファイルが大きすぎます: {name}。最大サイズは{max}MBです。",
    "invalid_type": "無効なファイル形式: {name}",
    "max_files_reached": "最大{max}ファイルまで許可されています"
  },
  "zh": {
    "drop_zone_text": "拖放文件或点击浏览",
    "accepted_types": "支持格式: {types}",
    "max_size": "每个最大{size}MB",
    "file_too_large": "文件过大: {name}。最大大小为{max}MB。",
    "invalid_type": "无效的文件类型: {name}",
    "max_files_reached": "最多允许{max}个文件"
  },
  "ko": {
    "drop_zone_text": "파일을 드래그 앤 드롭하거나 클릭하여 찾아보기",
    "accepted_types": "허용 형식: {types}",
    "max_size": "파일당 최대 {size}MB",
    "file_too_large": "파일이 너무 큽니다: {name}. 최대 크기는 {max}MB입니다.",
    "invalid_type": "잘못된 파일 형식: {name}",
    "max_files_reached": "최대 {max}개 파일 허용"
  }
}
</i18n>
