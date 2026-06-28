<template>
  <div class="relative w-full">
    <label class="input input-lg flex items-center gap-2 w-full">
      <i class="fas fa-magnifying-glass text-base-content/50"></i>
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="t('placeholder')"
        class="grow"
        @keyup.enter="onEnter"
      />
      <button
        v-if="searchQuery"
        type="button"
        class="btn btn-ghost btn-xs btn-circle"
        @click="clearSearch"
        :aria-label="t('clear')"
      >
        <i class="fas fa-xmark"></i>
      </button>
    </label>

    <!-- Search suggestions (future enhancement) -->
    <div v-if="showSuggestions && suggestions.length > 0" class="absolute top-full left-0 right-0 mt-2 z-50">
      <div class="card bg-base-100 shadow-lg">
        <div class="card-body p-2" role="listbox">
          <div
            v-for="suggestion in suggestions"
            :key="suggestion"
            role="option"
            tabindex="0"
            class="px-4 py-2 hover:bg-base-200 rounded cursor-pointer"
            @click="applySuggestion(suggestion)"
            @keydown.enter="applySuggestion(suggestion)"
            @keydown.space.prevent="applySuggestion(suggestion)"
          >
            <i class="fas fa-magnifying-glass inline mr-2 text-base-content/50"></i>
            {{ suggestion }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  const searchQuery = defineModel<string>({ required: true });

  const showSuggestions = ref(false);
  const suggestions = ref<string[]>([]);

  const onEnter = () => {
    showSuggestions.value = false;
  };

  const clearSearch = () => {
    searchQuery.value = '';
    showSuggestions.value = false;
  };

  const applySuggestion = (suggestion: string) => {
    searchQuery.value = suggestion;
    showSuggestions.value = false;
  };

  // Close suggestions when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.relative')) {
      showSuggestions.value = false;
    }
  };

  onMounted(() => {
    document.addEventListener('click', handleClickOutside);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('click', handleClickOutside);
  });
</script>

<i18n lang="json">
{
  "en": { "placeholder": "Search listings by title, description, model...", "clear": "Clear search" },
  "es": { "placeholder": "Buscar anuncios por título, descripción, modelo...", "clear": "Borrar búsqueda" },
  "fr": { "placeholder": "Rechercher des annonces par titre, description, modèle...", "clear": "Effacer la recherche" },
  "de": { "placeholder": "Anzeigen nach Titel, Beschreibung, Modell suchen...", "clear": "Suche löschen" },
  "it": { "placeholder": "Cerca annunci per titolo, descrizione, modello...", "clear": "Cancella ricerca" },
  "pt": { "placeholder": "Pesquisar anúncios por título, descrição, modelo...", "clear": "Limpar pesquisa" },
  "ru": { "placeholder": "Поиск объявлений по названию, описанию, модели...", "clear": "Очистить поиск" },
  "ja": { "placeholder": "タイトル、説明、モデルで出品を検索...", "clear": "検索をクリア" },
  "zh": { "placeholder": "按标题、描述、车型搜索刊登...", "clear": "清除搜索" },
  "ko": { "placeholder": "제목, 설명, 모델로 매물 검색...", "clear": "검색 지우기" }
}
</i18n>
