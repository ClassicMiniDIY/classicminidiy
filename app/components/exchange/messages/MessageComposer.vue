<template>
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body p-4">
      <!-- Moderation Warning -->
      <div v-if="moderationWarning" class="alert alert-warning mb-4">
        <i class="fas fa-triangle-exclamation"></i>
        <span>{{ moderationWarning }}</span>
      </div>

      <!-- Staged attachment previews -->
      <div v-if="stagedAttachments.length > 0" class="flex flex-wrap gap-2 mb-3">
        <div
          v-for="(staged, index) in stagedAttachments"
          :key="staged.id"
          class="relative w-20 h-20 rounded-lg overflow-hidden border border-base-300 bg-base-200"
        >
          <img :src="staged.previewUrl" :alt="staged.file.name" class="w-full h-full object-cover" />
          <button
            type="button"
            class="btn btn-circle btn-xs absolute top-1 right-1 bg-base-100/90 border-none"
            :aria-label="t('removeImage')"
            @click="removeAttachment(index)"
          >
            <i class="fas fa-xmark"></i>
          </button>
        </div>
        <div v-if="preparingAttachments" class="w-20 h-20 flex items-center justify-center">
          <span class="loading loading-spinner loading-sm"></span>
        </div>
      </div>

      <!-- Message Input -->
      <div class="fieldset">
        <label class="fieldset-legend">
          <span class="sr-only">{{ t('messageLabel') }}</span>
        </label>
        <textarea
          v-model="message"
          :disabled="sending"
          class="textarea textarea-bordered w-full"
          :class="{ 'textarea-error': hasError }"
          :placeholder="t('placeholder')"
          rows="4"
          maxlength="2000"
          @input="handleInput"
          @keydown.ctrl.enter="handleSend"
          @keydown.meta.enter="handleSend"
        />
      </div>

      <!-- Hidden file input -->
      <input
        ref="fileInputRef"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple
        class="hidden"
        @change="onFilesSelected"
      />

      <!-- Footer with character count and send button -->
      <div class="flex items-center justify-between mt-2 gap-2">
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="btn btn-ghost btn-sm btn-circle"
            :disabled="sending || preparingAttachments || stagedAttachments.length >= MESSAGE_ATTACHMENT_MAX_COUNT"
            :aria-label="t('attachImage')"
            @click="fileInputRef?.click()"
          >
            <i class="fas fa-paperclip"></i>
          </button>
          <div class="text-sm" :class="characterCountColor">
            {{ message.length }}/2000
            <span v-if="message.length > 1900" class="ml-2 text-warning"> ({{ t('charsLeft', { count: 2000 - message.length }) }}) </span>
          </div>
        </div>

        <button
          class="btn btn-primary"
          :class="{ 'btn-disabled': !canSend }"
          :disabled="!canSend || sending || preparingAttachments"
          @click="handleSend"
        >
          <i v-if="sending" class="fas fa-arrows-rotate animate-spin"></i>
          <i v-else class="fas fa-paper-plane"></i>
          {{ t('send') }}
        </button>
      </div>

      <!-- Helper text -->
      <div class="text-xs text-base-content/60 mt-2">
        {{ t('helperShortcut.before') }} <kbd class="kbd kbd-xs">{{ t('helperShortcut.ctrl') }}</kbd> +
        <kbd class="kbd kbd-xs">{{ t('helperShortcut.enter') }}</kbd> {{ t('helperShortcut.after') }}
        <span class="ml-2">{{ t('helperFormatting', { count: MESSAGE_ATTACHMENT_MAX_COUNT }) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { checkMessageContent, validateMessageLength, getModerationWarning } from '~/utils/moderation';

  const { t } = useI18n();

  interface Props {
    conversationId: string;
    disabled?: boolean;
    listingId?: string;
    messageCount?: number;
  }

  interface Emits {
    (e: 'sent'): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const { sendMessage, sending } = useMessages();
  const { prepareAttachment, validateBatch, MESSAGE_ATTACHMENT_MAX_COUNT } = useMessageAttachments();
  const toast = useToast();

  const message = ref('');
  const moderationWarning = ref('');
  const hasError = ref(false);
  const fileInputRef = ref<HTMLInputElement | null>(null);

  interface StagedAttachment {
    id: string;
    file: File;
    width: number;
    height: number;
    previewUrl: string;
  }

  const stagedAttachments = ref<StagedAttachment[]>([]);
  const preparingAttachments = ref(false);

  // Computed properties
  const canSend = computed(() => {
    if (props.disabled || sending.value) return false;

    const trimmed = message.value.trim();
    return trimmed.length >= 2 && trimmed.length <= 2000;
  });

  const characterCountColor = computed(() => {
    const length = message.value.length;
    if (length > 1950) return 'text-error';
    if (length > 1800) return 'text-warning';
    return 'text-base-content/60';
  });

  // Methods
  const handleInput = () => {
    hasError.value = false;
    moderationWarning.value = '';

    // Real-time validation
    const validation = validateMessageLength(message.value);
    if (!validation.valid && message.value.length > 0) {
      hasError.value = true;
    }

    // Check for moderation issues
    if (message.value.trim().length > 10) {
      const moderation = checkMessageContent(message.value);
      if (!moderation.isClean) {
        moderationWarning.value = getModerationWarning(moderation.issues);
      }
    }
  };

  const onFilesSelected = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    // Reset input so selecting the same file again still fires change.
    input.value = '';

    if (files.length === 0) return;

    const remainingSlots = MESSAGE_ATTACHMENT_MAX_COUNT - stagedAttachments.value.length;
    if (remainingSlots <= 0) {
      toast.add({
        title: t('tooManyImagesTitle'),
        description: t('tooManyImagesDesc', { count: MESSAGE_ATTACHMENT_MAX_COUNT }),
        color: 'warning',
      });
      return;
    }
    const filesToProcess = files.slice(0, remainingSlots);

    const errors = validateBatch(filesToProcess);
    if (errors.length > 0) {
      for (const err of errors) {
        toast.add({ title: t('invalidImageTitle'), description: err, color: 'error' });
      }
      return;
    }

    preparingAttachments.value = true;
    try {
      for (const file of filesToProcess) {
        try {
          const prepared = await prepareAttachment(file);
          stagedAttachments.value.push({
            id: crypto.randomUUID(),
            file: prepared.file,
            width: prepared.width,
            height: prepared.height,
            previewUrl: URL.createObjectURL(prepared.file),
          });
        } catch (err: any) {
          toast.add({
            title: t('couldNotAttachTitle'),
            description: err?.message || t('unknownPrepareError'),
            color: 'error',
          });
        }
      }
    } finally {
      preparingAttachments.value = false;
    }
  };

  const removeAttachment = (index: number) => {
    const [removed] = stagedAttachments.value.splice(index, 1);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
  };

  const clearStaged = () => {
    for (const s of stagedAttachments.value) URL.revokeObjectURL(s.previewUrl);
    stagedAttachments.value = [];
  };

  const handleSend = async () => {
    if (!canSend.value) return;

    const attachments = stagedAttachments.value.map((s) => ({
      file: s.file,
      width: s.width,
      height: s.height,
    }));

    const success = await sendMessage(props.conversationId, message.value, {
      conversation: { listing_id: props.listingId },
      existingMessageCount: props.messageCount,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (success) {
      message.value = '';
      moderationWarning.value = '';
      hasError.value = false;
      clearStaged();
      emit('sent');
    }
  };

  onBeforeUnmount(() => clearStaged());
</script>

<i18n lang="json">
{
  "en": {
    "messageLabel": "Message",
    "placeholder": "Type your message... (markdown supported)",
    "send": "Send",
    "attachImage": "Attach image",
    "removeImage": "Remove image",
    "charsLeft": "{count} left",
    "helperShortcut": { "before": "Press", "ctrl": "Ctrl", "enter": "Enter", "after": "to send." },
    "helperFormatting": "**bold**, *italic*, lists, and links supported. Images up to 1 MB, max {count}.",
    "tooManyImagesTitle": "Too many images",
    "tooManyImagesDesc": "You can attach at most {count} images per message.",
    "invalidImageTitle": "Invalid image",
    "couldNotAttachTitle": "Could not attach image",
    "unknownPrepareError": "Unknown error preparing image."
  },
  "es": {
    "messageLabel": "Mensaje",
    "placeholder": "Escribe tu mensaje... (compatible con markdown)",
    "send": "Enviar",
    "attachImage": "Adjuntar imagen",
    "removeImage": "Eliminar imagen",
    "charsLeft": "quedan {count}",
    "helperShortcut": { "before": "Pulsa", "ctrl": "Ctrl", "enter": "Intro", "after": "para enviar." },
    "helperFormatting": "Compatible con **negrita**, *cursiva*, listas y enlaces. Imágenes de hasta 1 MB, máximo {count}.",
    "tooManyImagesTitle": "Demasiadas imágenes",
    "tooManyImagesDesc": "Puedes adjuntar como máximo {count} imágenes por mensaje.",
    "invalidImageTitle": "Imagen no válida",
    "couldNotAttachTitle": "No se pudo adjuntar la imagen",
    "unknownPrepareError": "Error desconocido al preparar la imagen."
  },
  "fr": {
    "messageLabel": "Message",
    "placeholder": "Tapez votre message... (markdown pris en charge)",
    "send": "Envoyer",
    "attachImage": "Joindre une image",
    "removeImage": "Supprimer l'image",
    "charsLeft": "{count} restants",
    "helperShortcut": { "before": "Appuyez sur", "ctrl": "Ctrl", "enter": "Entrée", "after": "pour envoyer." },
    "helperFormatting": "**gras**, *italique*, listes et liens pris en charge. Images jusqu'à 1 Mo, max {count}.",
    "tooManyImagesTitle": "Trop d'images",
    "tooManyImagesDesc": "Vous pouvez joindre au maximum {count} images par message.",
    "invalidImageTitle": "Image non valide",
    "couldNotAttachTitle": "Impossible de joindre l'image",
    "unknownPrepareError": "Erreur inconnue lors de la préparation de l'image."
  },
  "de": {
    "messageLabel": "Nachricht",
    "placeholder": "Gib deine Nachricht ein... (Markdown unterstützt)",
    "send": "Senden",
    "attachImage": "Bild anhängen",
    "removeImage": "Bild entfernen",
    "charsLeft": "{count} übrig",
    "helperShortcut": { "before": "Drücke", "ctrl": "Strg", "enter": "Enter", "after": "zum Senden." },
    "helperFormatting": "**fett**, *kursiv*, Listen und Links unterstützt. Bilder bis 1 MB, max. {count}.",
    "tooManyImagesTitle": "Zu viele Bilder",
    "tooManyImagesDesc": "Du kannst höchstens {count} Bilder pro Nachricht anhängen.",
    "invalidImageTitle": "Ungültiges Bild",
    "couldNotAttachTitle": "Bild konnte nicht angehängt werden",
    "unknownPrepareError": "Unbekannter Fehler beim Vorbereiten des Bildes."
  },
  "it": {
    "messageLabel": "Messaggio",
    "placeholder": "Scrivi il tuo messaggio... (markdown supportato)",
    "send": "Invia",
    "attachImage": "Allega immagine",
    "removeImage": "Rimuovi immagine",
    "charsLeft": "{count} rimasti",
    "helperShortcut": { "before": "Premi", "ctrl": "Ctrl", "enter": "Invio", "after": "per inviare." },
    "helperFormatting": "**grassetto**, *corsivo*, elenchi e link supportati. Immagini fino a 1 MB, max {count}.",
    "tooManyImagesTitle": "Troppe immagini",
    "tooManyImagesDesc": "Puoi allegare al massimo {count} immagini per messaggio.",
    "invalidImageTitle": "Immagine non valida",
    "couldNotAttachTitle": "Impossibile allegare l'immagine",
    "unknownPrepareError": "Errore sconosciuto durante la preparazione dell'immagine."
  },
  "pt": {
    "messageLabel": "Mensagem",
    "placeholder": "Digite sua mensagem... (markdown suportado)",
    "send": "Enviar",
    "attachImage": "Anexar imagem",
    "removeImage": "Remover imagem",
    "charsLeft": "{count} restantes",
    "helperShortcut": { "before": "Pressione", "ctrl": "Ctrl", "enter": "Enter", "after": "para enviar." },
    "helperFormatting": "**negrito**, *itálico*, listas e links suportados. Imagens de até 1 MB, máx {count}.",
    "tooManyImagesTitle": "Imagens demais",
    "tooManyImagesDesc": "Você pode anexar no máximo {count} imagens por mensagem.",
    "invalidImageTitle": "Imagem inválida",
    "couldNotAttachTitle": "Não foi possível anexar a imagem",
    "unknownPrepareError": "Erro desconhecido ao preparar a imagem."
  },
  "ru": {
    "messageLabel": "Сообщение",
    "placeholder": "Введите ваше сообщение... (поддерживается markdown)",
    "send": "Отправить",
    "attachImage": "Прикрепить изображение",
    "removeImage": "Удалить изображение",
    "charsLeft": "осталось {count}",
    "helperShortcut": { "before": "Нажмите", "ctrl": "Ctrl", "enter": "Enter", "after": "для отправки." },
    "helperFormatting": "Поддерживаются **жирный**, *курсив*, списки и ссылки. Изображения до 1 МБ, максимум {count}.",
    "tooManyImagesTitle": "Слишком много изображений",
    "tooManyImagesDesc": "К одному сообщению можно прикрепить не более {count} изображений.",
    "invalidImageTitle": "Недопустимое изображение",
    "couldNotAttachTitle": "Не удалось прикрепить изображение",
    "unknownPrepareError": "Неизвестная ошибка при подготовке изображения."
  },
  "ja": {
    "messageLabel": "メッセージ",
    "placeholder": "メッセージを入力...（マークダウン対応）",
    "send": "送信",
    "attachImage": "画像を添付",
    "removeImage": "画像を削除",
    "charsLeft": "残り {count}",
    "helperShortcut": { "before": "", "ctrl": "Ctrl", "enter": "Enter", "after": "で送信します。" },
    "helperFormatting": "**太字**、*斜体*、リスト、リンクに対応。画像は最大1 MB、最大{count}枚。",
    "tooManyImagesTitle": "画像が多すぎます",
    "tooManyImagesDesc": "1件のメッセージに添付できる画像は最大{count}枚です。",
    "invalidImageTitle": "無効な画像",
    "couldNotAttachTitle": "画像を添付できませんでした",
    "unknownPrepareError": "画像の準備中に不明なエラーが発生しました。"
  },
  "zh": {
    "messageLabel": "消息",
    "placeholder": "输入您的消息...（支持 markdown）",
    "send": "发送",
    "attachImage": "添加图片",
    "removeImage": "移除图片",
    "charsLeft": "剩余 {count}",
    "helperShortcut": { "before": "按", "ctrl": "Ctrl", "enter": "Enter", "after": "发送。" },
    "helperFormatting": "支持 **粗体**、*斜体*、列表和链接。图片最大 1 MB，最多 {count} 张。",
    "tooManyImagesTitle": "图片过多",
    "tooManyImagesDesc": "每条消息最多可附加 {count} 张图片。",
    "invalidImageTitle": "无效图片",
    "couldNotAttachTitle": "无法附加图片",
    "unknownPrepareError": "准备图片时发生未知错误。"
  },
  "ko": {
    "messageLabel": "메시지",
    "placeholder": "메시지를 입력하세요... (마크다운 지원)",
    "send": "보내기",
    "attachImage": "이미지 첨부",
    "removeImage": "이미지 제거",
    "charsLeft": "{count}자 남음",
    "helperShortcut": { "before": "", "ctrl": "Ctrl", "enter": "Enter", "after": "을(를) 눌러 보냅니다." },
    "helperFormatting": "**굵게**, *기울임*, 목록, 링크를 지원합니다. 이미지는 최대 1 MB, 최대 {count}개.",
    "tooManyImagesTitle": "이미지가 너무 많습니다",
    "tooManyImagesDesc": "메시지당 최대 {count}개의 이미지를 첨부할 수 있습니다.",
    "invalidImageTitle": "잘못된 이미지",
    "couldNotAttachTitle": "이미지를 첨부할 수 없습니다",
    "unknownPrepareError": "이미지를 준비하는 중 알 수 없는 오류가 발생했습니다."
  }
}
</i18n>
