<template>
  <button
    @click.prevent="handleToggle"
    :disabled="loading"
    class="btn btn-circle"
    :class="{
      'btn-ghost': !isSaved,
      'btn-error': isSaved,
      loading: loading,
    }"
    :title="isSaved ? t('removeFromWatchlist') : t('addToWatchlist')"
  >
    <i v-if="!loading" :class="isSaved ? 'fas fa-heart' : 'far fa-heart'"></i>
  </button>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  const props = defineProps<{
    listingId: string;
    externalListingId?: string;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'circle' | 'square' | 'text';
  }>();

  const { isWatchlisted: isListingWatchlisted, toggleWatchlist: toggleListingWatchlist } = useWatchlist();
  const { isWatchlisted: isExternalWatchlisted, toggleWatchlist: toggleExternalWatchlist } = useExternalListings();
  const { user } = useAuth();
  const loading = ref(false);

  // Check if this listing is in the user's watchlist
  const isSaved = computed(() => {
    if (props.externalListingId) {
      return isExternalWatchlisted(props.externalListingId);
    }
    return isListingWatchlisted(props.listingId);
  });

  const handleToggle = async () => {
    const targetId = props.externalListingId || props.listingId;
    const toggleFn = props.externalListingId ? toggleExternalWatchlist : toggleListingWatchlist;

    if (!user.value) {
      // Show login modal or redirect to auth
      // For now, the composable will show a toast
      await toggleFn(targetId);
      return;
    }

    loading.value = true;
    try {
      await toggleFn(targetId);
    } finally {
      loading.value = false;
    }
  };
</script>

<i18n lang="json">
{
  "en": { "addToWatchlist": "Add to watchlist", "removeFromWatchlist": "Remove from watchlist" },
  "es": { "addToWatchlist": "Añadir a la lista de seguimiento", "removeFromWatchlist": "Quitar de la lista de seguimiento" },
  "fr": { "addToWatchlist": "Ajouter à la liste de suivi", "removeFromWatchlist": "Retirer de la liste de suivi" },
  "de": { "addToWatchlist": "Zur Merkliste hinzufügen", "removeFromWatchlist": "Von der Merkliste entfernen" },
  "it": { "addToWatchlist": "Aggiungi alla lista di osservati", "removeFromWatchlist": "Rimuovi dalla lista di osservati" },
  "pt": { "addToWatchlist": "Adicionar à lista de interesses", "removeFromWatchlist": "Remover da lista de interesses" },
  "ru": { "addToWatchlist": "Добавить в список отслеживания", "removeFromWatchlist": "Удалить из списка отслеживания" },
  "ja": { "addToWatchlist": "ウォッチリストに追加", "removeFromWatchlist": "ウォッチリストから削除" },
  "zh": { "addToWatchlist": "加入关注列表", "removeFromWatchlist": "从关注列表移除" },
  "ko": { "addToWatchlist": "관심 목록에 추가", "removeFromWatchlist": "관심 목록에서 제거" }
}
</i18n>
