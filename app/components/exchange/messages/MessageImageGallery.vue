<template>
  <aside class="card bg-base-100 shadow-sm sticky top-20">
    <div class="card-body p-4">
      <h3 class="card-title text-base mb-3">
        <i class="fas fa-image"></i>
        {{ t('sharedImages') }}
        <span v-if="attachments.length > 0" class="badge badge-sm badge-neutral ml-auto">
          {{ attachments.length }}
        </span>
      </h3>

      <div v-if="attachments.length === 0" class="text-center py-8 text-base-content/60 text-sm">
        <i class="fas fa-image text-3xl mx-auto mb-2 text-base-content/20"></i>
        <p>{{ t('emptyTitle') }}</p>
        <p class="text-xs mt-1">{{ t('emptyHint') }}</p>
      </div>

      <div v-else class="max-h-[70vh] overflow-y-auto pr-1">
        <div class="grid grid-cols-2 gap-2">
          <ExchangeMessagesMessageAttachmentThumbnail
            v-for="attachment in attachments"
            :key="attachment.id"
            :attachment="attachment"
          />
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
  import type { Message, MessageAttachment } from '~/composables/useMessages';

  const { t } = useI18n();

  interface Props {
    messages: Message[];
  }

  const props = defineProps<Props>();

  // Flatten all attachments across every message, newest first so the most
  // recently shared images sit at the top of the sidebar where the user
  // is most likely looking.
  const attachments = computed<MessageAttachment[]>(() => {
    const all: MessageAttachment[] = [];
    for (const m of props.messages) {
      if (m.attachments && m.attachments.length > 0) {
        for (const a of m.attachments) all.push(a);
      }
    }
    return all.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });
</script>

<i18n lang="json">
{
  "en": { "sharedImages": "Shared Images", "emptyTitle": "No images shared yet.", "emptyHint": "Images you and the other person send will appear here." },
  "es": { "sharedImages": "Imágenes compartidas", "emptyTitle": "Aún no se han compartido imágenes.", "emptyHint": "Las imágenes que tú y la otra persona envíen aparecerán aquí." },
  "fr": { "sharedImages": "Images partagées", "emptyTitle": "Aucune image partagée pour l'instant.", "emptyHint": "Les images que vous et l'autre personne envoyez apparaîtront ici." },
  "de": { "sharedImages": "Geteilte Bilder", "emptyTitle": "Noch keine Bilder geteilt.", "emptyHint": "Bilder, die du und die andere Person senden, erscheinen hier." },
  "it": { "sharedImages": "Immagini condivise", "emptyTitle": "Nessuna immagine condivisa ancora.", "emptyHint": "Le immagini che tu e l'altra persona inviate appariranno qui." },
  "pt": { "sharedImages": "Imagens compartilhadas", "emptyTitle": "Nenhuma imagem compartilhada ainda.", "emptyHint": "As imagens que você e a outra pessoa enviarem aparecerão aqui." },
  "ru": { "sharedImages": "Общие изображения", "emptyTitle": "Изображения ещё не отправлялись.", "emptyHint": "Изображения, которые отправите вы и собеседник, появятся здесь." },
  "ja": { "sharedImages": "共有画像", "emptyTitle": "まだ共有された画像はありません。", "emptyHint": "あなたと相手が送信した画像がここに表示されます。" },
  "zh": { "sharedImages": "共享图片", "emptyTitle": "尚未共享任何图片。", "emptyHint": "您和对方发送的图片将显示在此处。" },
  "ko": { "sharedImages": "공유된 이미지", "emptyTitle": "아직 공유된 이미지가 없습니다.", "emptyHint": "회원님과 상대방이 보낸 이미지가 여기에 표시됩니다." }
}
</i18n>
