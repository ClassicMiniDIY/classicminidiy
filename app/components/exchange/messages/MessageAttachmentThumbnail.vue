<template>
  <div class="relative">
    <!-- Expired / deleted state -->
    <div
      v-if="state === 'expired'"
      class="flex flex-col items-center justify-center gap-1 w-full aspect-square max-w-[180px] rounded-lg bg-base-200/80 text-base-content/70 p-2 text-center"
    >
      <i class="fas fa-clock text-xl"></i>
      <p class="text-[10px] leading-tight">
        {{ t('expired') }}
      </p>
    </div>

    <!-- Loading state -->
    <div
      v-else-if="state === 'loading'"
      class="flex items-center justify-center w-full aspect-square max-w-[180px] rounded-lg bg-base-200/60"
    >
      <span class="loading loading-spinner loading-sm"></span>
    </div>

    <!-- OK state -->
    <button
      v-else
      type="button"
      class="block w-full max-w-[180px] rounded-lg overflow-hidden border border-current/10 bg-base-200 focus:outline-none focus:ring-2 focus:ring-primary"
      @click="openLightbox"
    >
      <img
        :src="signedUrl!"
        :alt="t('attachmentAlt', { id: attachment.id })"
        class="w-full h-auto max-h-[240px] object-cover block"
        loading="lazy"
        @error="onImageError"
      />
    </button>

    <!-- Lightbox modal -->
    <dialog v-if="lightboxOpen" ref="dialogRef" class="modal modal-open">
      <div class="modal-box max-w-4xl bg-base-100 p-2">
        <img v-if="signedUrl" :src="signedUrl" :alt="t('attachmentAlt', { id: attachment.id })" class="w-full h-auto rounded" />
        <div class="modal-action mt-2">
          <button type="button" class="btn btn-sm" @click="closeLightbox">{{ t('close') }}</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="button" @click="closeLightbox">{{ t('close') }}</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
  import type { MessageAttachment } from '~/composables/useMessages';

  const { t } = useI18n();

  interface Props {
    attachment: MessageAttachment;
  }

  const props = defineProps<Props>();

  const { getSignedUrl } = useMessageAttachments();

  type State = 'loading' | 'ok' | 'expired';
  const state = ref<State>('loading');
  const signedUrl = ref<string | null>(null);
  const lightboxOpen = ref(false);
  const dialogRef = ref<HTMLDialogElement | null>(null);

  const isExpiredByDate = computed(() => {
    const expiresAt = new Date(props.attachment.expires_at).getTime();
    return Number.isFinite(expiresAt) && expiresAt <= Date.now();
  });

  const onImageError = () => {
    // Storage object is gone even though the DB row still exists.
    // Treat as the end-of-life state, no error toast.
    state.value = 'expired';
  };

  const openLightbox = () => {
    lightboxOpen.value = true;
  };

  const closeLightbox = () => {
    lightboxOpen.value = false;
  };

  onMounted(async () => {
    if (isExpiredByDate.value) {
      state.value = 'expired';
      return;
    }

    const url = await getSignedUrl(props.attachment.storage_path);
    if (!url) {
      state.value = 'expired';
      return;
    }
    signedUrl.value = url;
    state.value = 'ok';
  });
</script>

<i18n lang="json">
{
  "en": { "expired": "Images in chats are only stored for 1 year — this image has automatically been deleted.", "attachmentAlt": "Attachment {id}", "close": "Close" },
  "es": { "expired": "Las imágenes en los chats solo se almacenan durante 1 año — esta imagen se ha eliminado automáticamente.", "attachmentAlt": "Adjunto {id}", "close": "Cerrar" },
  "fr": { "expired": "Les images dans les discussions ne sont conservées qu'un an — cette image a été supprimée automatiquement.", "attachmentAlt": "Pièce jointe {id}", "close": "Fermer" },
  "de": { "expired": "Bilder in Chats werden nur 1 Jahr gespeichert — dieses Bild wurde automatisch gelöscht.", "attachmentAlt": "Anhang {id}", "close": "Schließen" },
  "it": { "expired": "Le immagini nelle chat vengono conservate solo per 1 anno — questa immagine è stata eliminata automaticamente.", "attachmentAlt": "Allegato {id}", "close": "Chiudi" },
  "pt": { "expired": "As imagens nos chats são armazenadas apenas por 1 ano — esta imagem foi excluída automaticamente.", "attachmentAlt": "Anexo {id}", "close": "Fechar" },
  "ru": { "expired": "Изображения в чатах хранятся только 1 год — это изображение было автоматически удалено.", "attachmentAlt": "Вложение {id}", "close": "Закрыть" },
  "ja": { "expired": "チャット内の画像は1年間のみ保存されます — この画像は自動的に削除されました。", "attachmentAlt": "添付ファイル {id}", "close": "閉じる" },
  "zh": { "expired": "聊天中的图片仅保存1年 — 此图片已被自动删除。", "attachmentAlt": "附件 {id}", "close": "关闭" },
  "ko": { "expired": "채팅의 이미지는 1년 동안만 저장됩니다 — 이 이미지는 자동으로 삭제되었습니다.", "attachmentAlt": "첨부파일 {id}", "close": "닫기" }
}
</i18n>
