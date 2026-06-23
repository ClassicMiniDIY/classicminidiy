<template>
  <div class="container mx-auto py-8">
    <div class="max-w-3xl mx-auto">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold mb-2">{{ t('header.title') }}</h1>
        <p class="text-base-content/70">{{ t('header.subtitle') }}</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 3" :key="i" class="card bg-base-100 shadow">
          <div class="card-body">
            <div class="skeleton h-6 w-48 mb-2"></div>
            <div class="skeleton h-4 w-64 mb-2"></div>
            <div class="skeleton h-4 w-32"></div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="savedSearches.length === 0" class="text-center py-16">
        <i class="fas fa-bell-slash text-5xl mx-auto mb-4 block text-base-content/30"></i>
        <h3 class="text-xl font-semibold mb-2">{{ t('empty.title') }}</h3>
        <p class="text-base-content/70 mb-6">
          {{ t('empty.description') }}
        </p>
        <NuxtLink to="/exchange/listings" class="btn btn-primary">{{ t('empty.browseBtn') }}</NuxtLink>
      </div>

      <!-- Saved Search List -->
      <div v-else class="space-y-4">
        <div v-for="search in savedSearches" :key="search.id" class="card bg-base-100 shadow">
          <div class="card-body">
            <div class="flex flex-col sm:flex-row sm:items-center gap-4">
              <!-- Search Info -->
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-lg">{{ search.name }}</h3>
                <p class="text-sm text-base-content/70">{{ formatFilterSummary(search.filters) }}</p>
                <p class="text-xs text-base-content/50 mt-1">{{ t('savedOn', { date: formatDate(search.created_at) }) }}</p>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-2 shrink-0">
                <!-- Active Toggle -->
                <input
                  type="checkbox"
                  :checked="search.is_active"
                  @change="toggleActive(search.id)"
                  class="toggle toggle-primary toggle-sm"
                  :aria-label="`${search.is_active ? t('aria.pause') : t('aria.activate')} ${search.name}`"
                />

                <!-- View Results -->
                <NuxtLink
                  :to="buildSearchUrl(search.filters)"
                  class="btn btn-ghost btn-sm"
                  :aria-label="t('aria.viewResults')"
                >
                  <i class="fas fa-magnifying-glass"></i>
                </NuxtLink>

                <!-- Delete -->
                <button
                  class="btn btn-ghost btn-sm text-error"
                  :aria-label="t('aria.delete', { name: search.name })"
                  @click="confirmDelete(search.id)"
                >
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { formatFilterSummary } from '~/utils/filterLabels';

  const { t, locale } = useI18n();

  useSeoMeta({
    title: () => t('seoTitle'),
    robots: 'noindex, nofollow',
  });

  const { savedSearches, loading, fetchSavedSearches, toggleActive, deleteSavedSearch } = useSavedSearches();

  onMounted(() => {
    fetchSavedSearches();
  });

  /**
   * Build a /exchange/listings URL with the appropriate query parameters from the saved filters.
   */
  const buildSearchUrl = (filters: Record<string, any>): string => {
    const paramMap: Record<string, string> = {
      listing_category: 'category',
      parts_subcategory: 'subcategory',
      year_range: 'year',
      manufacturer: 'manufacturer',
      model: 'model',
      condition: 'condition',
      price_range: 'price',
      transmission: 'transmission',
      location: 'location',
    };

    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
      if (value && paramMap[key]) {
        params.set(paramMap[key], value);
      }
    }

    const qs = params.toString();
    return qs ? `/exchange/listings?${qs}` : '/exchange/listings';
  };

  /**
   * Format a date string to "Mon DD" format (e.g. "Feb 21").
   */
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale.value, { month: 'short', day: 'numeric' });
  };

  /**
   * Confirm before deleting a saved search.
   */
  const confirmDelete = async (searchId: string) => {
    if (window.confirm(t('confirmDelete'))) {
      await deleteSavedSearch(searchId);
    }
  };
</script>

<i18n lang="json">
{
  "en": {
    "seoTitle": "Saved Searches - Classic Mini DIY",
    "header": { "title": "Saved Searches", "subtitle": "Get notified when new listings match your saved search criteria." },
    "empty": { "title": "No saved searches yet", "description": "Browse listings and use the \"Save this Search\" button in the filters to create alerts.", "browseBtn": "Browse Listings" },
    "savedOn": "Saved {date}",
    "aria": { "pause": "Pause", "activate": "Activate", "viewResults": "View search results", "delete": "Delete {name}" },
    "confirmDelete": "Are you sure you want to delete this saved search?"
  },
  "es": {
    "seoTitle": "Búsquedas guardadas - Classic Mini DIY",
    "header": { "title": "Búsquedas guardadas", "subtitle": "Recibe avisos cuando nuevos anuncios coincidan con tus criterios de búsqueda guardados." },
    "empty": { "title": "Aún no hay búsquedas guardadas", "description": "Explora los anuncios y usa el botón «Guardar esta búsqueda» en los filtros para crear alertas.", "browseBtn": "Explorar anuncios" },
    "savedOn": "Guardada el {date}",
    "aria": { "pause": "Pausar", "activate": "Activar", "viewResults": "Ver resultados de búsqueda", "delete": "Eliminar {name}" },
    "confirmDelete": "¿Seguro que quieres eliminar esta búsqueda guardada?"
  },
  "fr": {
    "seoTitle": "Recherches enregistrées - Classic Mini DIY",
    "header": { "title": "Recherches enregistrées", "subtitle": "Soyez averti lorsque de nouvelles annonces correspondent à vos critères de recherche enregistrés." },
    "empty": { "title": "Aucune recherche enregistrée", "description": "Parcourez les annonces et utilisez le bouton « Enregistrer cette recherche » dans les filtres pour créer des alertes.", "browseBtn": "Parcourir les annonces" },
    "savedOn": "Enregistrée le {date}",
    "aria": { "pause": "Mettre en pause", "activate": "Activer", "viewResults": "Voir les résultats de recherche", "delete": "Supprimer {name}" },
    "confirmDelete": "Voulez-vous vraiment supprimer cette recherche enregistrée ?"
  },
  "de": {
    "seoTitle": "Gespeicherte Suchen - Classic Mini DIY",
    "header": { "title": "Gespeicherte Suchen", "subtitle": "Werde benachrichtigt, wenn neue Anzeigen deinen gespeicherten Suchkriterien entsprechen." },
    "empty": { "title": "Noch keine gespeicherten Suchen", "description": "Durchstöbere Anzeigen und nutze die Schaltfläche „Diese Suche speichern“ in den Filtern, um Benachrichtigungen zu erstellen.", "browseBtn": "Anzeigen durchstöbern" },
    "savedOn": "Gespeichert am {date}",
    "aria": { "pause": "Pausieren", "activate": "Aktivieren", "viewResults": "Suchergebnisse ansehen", "delete": "{name} löschen" },
    "confirmDelete": "Möchtest du diese gespeicherte Suche wirklich löschen?"
  },
  "it": {
    "seoTitle": "Ricerche salvate - Classic Mini DIY",
    "header": { "title": "Ricerche salvate", "subtitle": "Ricevi un avviso quando nuovi annunci corrispondono ai tuoi criteri di ricerca salvati." },
    "empty": { "title": "Ancora nessuna ricerca salvata", "description": "Sfoglia gli annunci e usa il pulsante «Salva questa ricerca» nei filtri per creare avvisi.", "browseBtn": "Sfoglia gli annunci" },
    "savedOn": "Salvata il {date}",
    "aria": { "pause": "Metti in pausa", "activate": "Attiva", "viewResults": "Vedi i risultati della ricerca", "delete": "Elimina {name}" },
    "confirmDelete": "Sei sicuro di voler eliminare questa ricerca salvata?"
  },
  "pt": {
    "seoTitle": "Buscas salvas - Classic Mini DIY",
    "header": { "title": "Buscas salvas", "subtitle": "Seja avisado quando novos anúncios corresponderem aos seus critérios de busca salvos." },
    "empty": { "title": "Ainda não há buscas salvas", "description": "Navegue pelos anúncios e use o botão \"Salvar esta busca\" nos filtros para criar alertas.", "browseBtn": "Navegar pelos anúncios" },
    "savedOn": "Salva em {date}",
    "aria": { "pause": "Pausar", "activate": "Ativar", "viewResults": "Ver resultados da busca", "delete": "Excluir {name}" },
    "confirmDelete": "Tem certeza de que deseja excluir esta busca salva?"
  },
  "ru": {
    "seoTitle": "Сохранённые поиски - Classic Mini DIY",
    "header": { "title": "Сохранённые поиски", "subtitle": "Получайте уведомления, когда новые объявления совпадают с вашими сохранёнными критериями поиска." },
    "empty": { "title": "Пока нет сохранённых поисков", "description": "Просматривайте объявления и используйте кнопку «Сохранить этот поиск» в фильтрах, чтобы создавать оповещения.", "browseBtn": "Просмотреть объявления" },
    "savedOn": "Сохранено {date}",
    "aria": { "pause": "Приостановить", "activate": "Активировать", "viewResults": "Посмотреть результаты поиска", "delete": "Удалить {name}" },
    "confirmDelete": "Вы уверены, что хотите удалить этот сохранённый поиск?"
  },
  "ja": {
    "seoTitle": "保存した検索 - Classic Mini DIY",
    "header": { "title": "保存した検索", "subtitle": "保存した検索条件に一致する新着出品があったときに通知を受け取ります。" },
    "empty": { "title": "まだ保存した検索がありません", "description": "出品を閲覧し、フィルターの「この検索を保存」ボタンを使ってアラートを作成しましょう。", "browseBtn": "出品を閲覧" },
    "savedOn": "{date} に保存",
    "aria": { "pause": "一時停止", "activate": "有効化", "viewResults": "検索結果を表示", "delete": "{name} を削除" },
    "confirmDelete": "この保存した検索を削除してもよろしいですか？"
  },
  "zh": {
    "seoTitle": "已保存的搜索 - Classic Mini DIY",
    "header": { "title": "已保存的搜索", "subtitle": "当新刊登匹配你保存的搜索条件时收到通知。" },
    "empty": { "title": "还没有已保存的搜索", "description": "浏览刊登并使用筛选器中的“保存此搜索”按钮来创建提醒。", "browseBtn": "浏览刊登" },
    "savedOn": "保存于 {date}",
    "aria": { "pause": "暂停", "activate": "启用", "viewResults": "查看搜索结果", "delete": "删除 {name}" },
    "confirmDelete": "确定要删除这个已保存的搜索吗？"
  },
  "ko": {
    "seoTitle": "저장된 검색 - Classic Mini DIY",
    "header": { "title": "저장된 검색", "subtitle": "저장된 검색 조건에 일치하는 새 매물이 있을 때 알림을 받습니다." },
    "empty": { "title": "아직 저장된 검색이 없습니다", "description": "매물을 둘러보고 필터의 \"이 검색 저장\" 버튼을 사용하여 알림을 만드세요.", "browseBtn": "매물 둘러보기" },
    "savedOn": "{date}에 저장됨",
    "aria": { "pause": "일시중지", "activate": "활성화", "viewResults": "검색 결과 보기", "delete": "{name} 삭제" },
    "confirmDelete": "이 저장된 검색을 삭제하시겠습니까?"
  }
}
</i18n>
