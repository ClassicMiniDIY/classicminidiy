<template>
  <dialog ref="dialogRef" class="modal modal-bottom sm:modal-middle" @close="emit('close')">
    <div class="modal-box max-w-lg">
      <div class="mb-4 flex items-center gap-2">
        <h3 class="text-lg font-semibold">{{ t('title') }}</h3>
        <button
          v-if="entries.length > 0"
          type="button"
          class="btn btn-ghost btn-xs ml-auto font-normal text-base-content/60"
          @click="emit('clear')"
        >
          <i class="fas fa-trash" aria-hidden="true"></i>
          {{ t('clear_all') }}
        </button>
        <form method="dialog" :class="entries.length > 0 ? '' : 'ml-auto'">
          <button class="btn btn-ghost btn-sm btn-square" :aria-label="t('close')">
            <i class="fas fa-xmark" aria-hidden="true"></i>
          </button>
        </form>
      </div>

      <p v-if="entries.length === 0" class="py-6 text-center text-sm text-base-content/60">
        {{ t('empty') }}
      </p>

      <ul v-else class="max-h-[60vh] space-y-1 overflow-y-auto">
        <li v-for="entry in entries" :key="entry.threadId">
          <div
            class="flex items-center gap-2 rounded-lg border border-transparent p-2 transition-colors hover:border-base-300 hover:bg-base-200"
            :class="entry.threadId === activeThreadId ? 'border-primary/40 bg-base-200' : ''"
          >
            <button type="button" class="min-w-0 flex-1 text-left" @click="emit('select', entry.threadId)">
              <span class="block truncate text-sm">{{ entry.title || t('untitled') }}</span>
              <span class="block text-xs text-base-content/50">
                {{ formatWhen(entry.lastUsedAt) }}
                <template v-if="entry.threadId === activeThreadId"> · {{ t('current') }}</template>
              </span>
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-square text-base-content/50"
              :aria-label="t('delete_one', { title: entry.title || t('untitled') })"
              @click="emit('remove', entry.threadId)"
            >
              <i class="fas fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        </li>
      </ul>

      <p class="mt-4 text-xs text-base-content/50">{{ t('local_only') }}</p>
    </div>

    <form method="dialog" class="modal-backdrop">
      <button>{{ t('close') }}</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
  import type { ChatHistoryEntry } from '~/composables/useChatHistory';

  const { t, locale } = useI18n();

  const props = defineProps<{
    entries: ChatHistoryEntry[];
    activeThreadId?: string | null;
    open: boolean;
  }>();

  const emit = defineEmits<{
    select: [threadId: string];
    remove: [threadId: string];
    clear: [];
    close: [];
  }>();

  const dialogRef = ref<HTMLDialogElement>();

  // `showModal()` is what gives the dialog its focus trap, backdrop and
  // Escape-to-close, so the open state is driven imperatively rather than with
  // the `open` attribute (which renders a non-modal dialog).
  watch(
    () => props.open,
    (isOpen) => {
      const el = dialogRef.value;
      if (!el) return;
      if (isOpen && !el.open) el.showModal();
      if (!isOpen && el.open) el.close();
    }
  );

  const relativeFormatter = computed(() => new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' }));

  function formatWhen(timestamp: number): string {
    const diffMs = timestamp - Date.now();
    const minutes = Math.round(diffMs / 60000);

    if (Math.abs(minutes) < 60) return relativeFormatter.value.format(minutes, 'minute');

    const hours = Math.round(diffMs / 3600000);
    if (Math.abs(hours) < 24) return relativeFormatter.value.format(hours, 'hour');

    const days = Math.round(diffMs / 86400000);
    return relativeFormatter.value.format(days, 'day');
  }
</script>

<i18n lang="json">
{
  "en": {
    "title": "Recent chats",
    "empty": "No previous chats yet.",
    "untitled": "Untitled chat",
    "current": "current",
    "clear_all": "Clear all",
    "close": "Close",
    "delete_one": "Delete {title}",
    "local_only": "Saved in this browser only. Clearing site data removes them."
  },
  "es": {
    "title": "Chats recientes",
    "empty": "Aún no hay chats anteriores.",
    "untitled": "Chat sin título",
    "current": "actual",
    "clear_all": "Borrar todo",
    "close": "Cerrar",
    "delete_one": "Eliminar {title}",
    "local_only": "Guardado solo en este navegador. Borrar los datos del sitio los elimina."
  },
  "fr": {
    "title": "Discussions récentes",
    "empty": "Aucune discussion précédente.",
    "untitled": "Discussion sans titre",
    "current": "en cours",
    "clear_all": "Tout effacer",
    "close": "Fermer",
    "delete_one": "Supprimer {title}",
    "local_only": "Enregistré uniquement dans ce navigateur. Effacer les données du site les supprime."
  },
  "de": {
    "title": "Letzte Chats",
    "empty": "Noch keine früheren Chats.",
    "untitled": "Chat ohne Titel",
    "current": "aktuell",
    "clear_all": "Alle löschen",
    "close": "Schließen",
    "delete_one": "{title} löschen",
    "local_only": "Nur in diesem Browser gespeichert. Beim Löschen der Websitedaten verschwinden sie."
  },
  "it": {
    "title": "Chat recenti",
    "empty": "Nessuna chat precedente.",
    "untitled": "Chat senza titolo",
    "current": "corrente",
    "clear_all": "Cancella tutto",
    "close": "Chiudi",
    "delete_one": "Elimina {title}",
    "local_only": "Salvate solo in questo browser. Cancellando i dati del sito spariscono."
  },
  "pt": {
    "title": "Conversas recentes",
    "empty": "Ainda não há conversas anteriores.",
    "untitled": "Conversa sem título",
    "current": "atual",
    "clear_all": "Limpar tudo",
    "close": "Fechar",
    "delete_one": "Excluir {title}",
    "local_only": "Salvas apenas neste navegador. Limpar os dados do site as remove."
  },
  "ru": {
    "title": "Недавние чаты",
    "empty": "Предыдущих чатов пока нет.",
    "untitled": "Чат без названия",
    "current": "текущий",
    "clear_all": "Очистить всё",
    "close": "Закрыть",
    "delete_one": "Удалить {title}",
    "local_only": "Хранится только в этом браузере. Очистка данных сайта их удалит."
  },
  "ja": {
    "title": "最近のチャット",
    "empty": "まだ以前のチャットはありません。",
    "untitled": "無題のチャット",
    "current": "現在",
    "clear_all": "すべて削除",
    "close": "閉じる",
    "delete_one": "{title} を削除",
    "local_only": "このブラウザにのみ保存されます。サイトデータを消去すると削除されます。"
  },
  "zh": {
    "title": "最近的对话",
    "empty": "还没有以前的对话。",
    "untitled": "未命名对话",
    "current": "当前",
    "clear_all": "全部清除",
    "close": "关闭",
    "delete_one": "删除 {title}",
    "local_only": "仅保存在此浏览器中。清除网站数据会将其删除。"
  },
  "ko": {
    "title": "최근 대화",
    "empty": "아직 이전 대화가 없습니다.",
    "untitled": "제목 없는 대화",
    "current": "현재",
    "clear_all": "모두 지우기",
    "close": "닫기",
    "delete_one": "{title} 삭제",
    "local_only": "이 브라우저에만 저장됩니다. 사이트 데이터를 지우면 삭제됩니다."
  }
}
</i18n>
