<template>
  <div class="flex items-center gap-2">
    <span v-if="showLabel" class="text-sm text-base-content/70 mr-2">{{ t('share') }}</span>

    <!-- Facebook -->
    <button
      @click="shareOnFacebook"
      class="btn btn-circle btn-sm btn-ghost"
      :title="t('shareOnFacebook')"
      :aria-label="t('shareOnFacebook')"
    >
      <i class="fab fa-facebook"></i>
    </button>

    <!-- Twitter/X -->
    <button
      @click="shareOnTwitter"
      class="btn btn-circle btn-sm btn-ghost"
      :title="t('shareOnTwitter')"
      :aria-label="t('shareOnTwitter')"
    >
      <i class="fab fa-x-twitter"></i>
    </button>

    <!-- Email -->
    <button
      @click="shareViaEmail"
      class="btn btn-circle btn-sm btn-ghost"
      :title="t('shareViaEmail')"
      :aria-label="t('shareViaEmail')"
    >
      <i class="fas fa-envelope"></i>
    </button>

    <!-- Copy Link -->
    <button
      @click="copyLink"
      class="btn btn-circle btn-sm btn-ghost"
      :title="copied ? t('copied') : t('copyLink')"
      :aria-label="copied ? t('copied') : t('copyLink')"
    >
      <i :class="[copied ? 'fas fa-check' : 'fas fa-link', { 'text-success': copied }]"></i>
    </button>

    <!-- Native Share (mobile) -->
    <button
      v-if="canShare"
      @click="nativeShare"
      class="btn btn-circle btn-sm btn-ghost"
      :title="t('shareTitle')"
      :aria-label="t('shareTitle')"
    >
      <i class="fas fa-share-nodes"></i>
    </button>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  const props = defineProps<{
    title: string;
    url: string;
    description?: string;
    showLabel?: boolean;
    listingId?: string;
  }>();

  const toast = useToast();
  const { capture } = usePostHog();
  const copied = ref(false);
  const copiedTimeout = ref<NodeJS.Timeout | null>(null);

  // Track share event
  const trackShare = (method: 'facebook' | 'twitter' | 'email' | 'copy_link' | 'native') => {
    if (props.listingId) {
      capture('listing_shared', {
        listing_id: props.listingId,
        method,
      });
    }
  };

  // Check if native share is available (mobile)
  const canShare = computed(() => {
    return typeof navigator !== 'undefined' && 'share' in navigator;
  });

  // Share on Facebook
  const shareOnFacebook = () => {
    trackShare('facebook');
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(props.url)}`;
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  // Share on Twitter/X
  const shareOnTwitter = () => {
    trackShare('twitter');
    const text = props.description || props.title;
    const shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(props.url)}&text=${encodeURIComponent(text)}`;
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  // Share via Email
  const shareViaEmail = () => {
    trackShare('email');
    const subject = encodeURIComponent(props.title);
    const body = encodeURIComponent(
      `Check out this Classic Mini listing:\n\n${props.description || ''}\n\n${props.url}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // Copy link to clipboard
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(props.url);
      copied.value = true;
      trackShare('copy_link');

      toast.add({
        title: t('linkCopied'),
        description: t('linkCopiedDescription'),
        color: 'success',
        duration: 3000,
      });

      copiedTimeout.value = setTimeout(() => {
        copied.value = false;
      }, 3000);
    } catch (error) {
      console.error('Error copying link:', error);
      toast.add({
        title: t('error'),
        description: t('copyFailed'),
        color: 'error',
      });
    }
  };

  onBeforeUnmount(() => {
    if (copiedTimeout.value) {
      clearTimeout(copiedTimeout.value);
    }
  });

  // Native share (mobile)
  const nativeShare = async () => {
    try {
      await navigator.share({
        title: props.title,
        text: props.description,
        url: props.url,
      });
      // Track only on successful share (not when cancelled)
      trackShare('native');
    } catch (error: any) {
      // User cancelled or error occurred
      if (error.name !== 'AbortError') {
        console.error('Error sharing:', error);
      }
    }
  };
</script>

<i18n lang="json">
{
  "en": { "share": "Share:", "shareTitle": "Share", "shareOnFacebook": "Share on Facebook", "shareOnTwitter": "Share on Twitter", "shareViaEmail": "Share via Email", "copyLink": "Copy Link", "copied": "Copied!", "linkCopied": "Link Copied", "linkCopiedDescription": "Link copied to clipboard", "error": "Error", "copyFailed": "Failed to copy link" },
  "es": { "share": "Compartir:", "shareTitle": "Compartir", "shareOnFacebook": "Compartir en Facebook", "shareOnTwitter": "Compartir en Twitter", "shareViaEmail": "Compartir por correo", "copyLink": "Copiar enlace", "copied": "¡Copiado!", "linkCopied": "Enlace copiado", "linkCopiedDescription": "Enlace copiado al portapapeles", "error": "Error", "copyFailed": "No se pudo copiar el enlace" },
  "fr": { "share": "Partager :", "shareTitle": "Partager", "shareOnFacebook": "Partager sur Facebook", "shareOnTwitter": "Partager sur Twitter", "shareViaEmail": "Partager par e-mail", "copyLink": "Copier le lien", "copied": "Copié !", "linkCopied": "Lien copié", "linkCopiedDescription": "Lien copié dans le presse-papiers", "error": "Erreur", "copyFailed": "Échec de la copie du lien" },
  "de": { "share": "Teilen:", "shareTitle": "Teilen", "shareOnFacebook": "Auf Facebook teilen", "shareOnTwitter": "Auf Twitter teilen", "shareViaEmail": "Per E-Mail teilen", "copyLink": "Link kopieren", "copied": "Kopiert!", "linkCopied": "Link kopiert", "linkCopiedDescription": "Link in die Zwischenablage kopiert", "error": "Fehler", "copyFailed": "Link konnte nicht kopiert werden" },
  "it": { "share": "Condividi:", "shareTitle": "Condividi", "shareOnFacebook": "Condividi su Facebook", "shareOnTwitter": "Condividi su Twitter", "shareViaEmail": "Condividi via e-mail", "copyLink": "Copia link", "copied": "Copiato!", "linkCopied": "Link copiato", "linkCopiedDescription": "Link copiato negli appunti", "error": "Errore", "copyFailed": "Impossibile copiare il link" },
  "pt": { "share": "Compartilhar:", "shareTitle": "Compartilhar", "shareOnFacebook": "Compartilhar no Facebook", "shareOnTwitter": "Compartilhar no Twitter", "shareViaEmail": "Compartilhar por e-mail", "copyLink": "Copiar link", "copied": "Copiado!", "linkCopied": "Link copiado", "linkCopiedDescription": "Link copiado para a área de transferência", "error": "Erro", "copyFailed": "Falha ao copiar o link" },
  "ru": { "share": "Поделиться:", "shareTitle": "Поделиться", "shareOnFacebook": "Поделиться в Facebook", "shareOnTwitter": "Поделиться в Twitter", "shareViaEmail": "Поделиться по эл. почте", "copyLink": "Копировать ссылку", "copied": "Скопировано!", "linkCopied": "Ссылка скопирована", "linkCopiedDescription": "Ссылка скопирована в буфер обмена", "error": "Ошибка", "copyFailed": "Не удалось скопировать ссылку" },
  "ja": { "share": "共有:", "shareTitle": "共有", "shareOnFacebook": "Facebookで共有", "shareOnTwitter": "Twitterで共有", "shareViaEmail": "メールで共有", "copyLink": "リンクをコピー", "copied": "コピーしました！", "linkCopied": "リンクをコピーしました", "linkCopiedDescription": "リンクをクリップボードにコピーしました", "error": "エラー", "copyFailed": "リンクのコピーに失敗しました" },
  "zh": { "share": "分享：", "shareTitle": "分享", "shareOnFacebook": "分享到 Facebook", "shareOnTwitter": "分享到 Twitter", "shareViaEmail": "通过电子邮件分享", "copyLink": "复制链接", "copied": "已复制！", "linkCopied": "链接已复制", "linkCopiedDescription": "链接已复制到剪贴板", "error": "错误", "copyFailed": "复制链接失败" },
  "ko": { "share": "공유:", "shareTitle": "공유", "shareOnFacebook": "Facebook에 공유", "shareOnTwitter": "Twitter에 공유", "shareViaEmail": "이메일로 공유", "copyLink": "링크 복사", "copied": "복사됨!", "linkCopied": "링크 복사됨", "linkCopiedDescription": "링크가 클립보드에 복사되었습니다", "error": "오류", "copyFailed": "링크 복사에 실패했습니다" }
}
</i18n>
