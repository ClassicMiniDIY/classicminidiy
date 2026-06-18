<template>
  <div v-if="user">
    <button class="btn btn-outline btn-sm w-full gap-2" @click="showModal = true">
      <i class="fas fa-bell"></i>
      {{ t('saveThisSearch') }}
    </button>

    <dialog :class="['modal', { 'modal-open': showModal }]">
      <div class="modal-box">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">{{ t('saveSearch') }}</h3>
          <button class="btn btn-ghost btn-sm btn-circle" @click="closeModal">
            <i class="fas fa-xmark"></i>
          </button>
        </div>

        <p class="text-base-content/70 text-sm mb-4">{{ t('description') }}</p>

        <fieldset class="fieldset mb-4">
          <legend class="fieldset-legend">{{ t('searchNameLabel') }}</legend>
          <input
            v-model="searchName"
            type="text"
            :placeholder="t('searchNamePlaceholder')"
            class="input w-full"
            maxlength="100"
          />
        </fieldset>

        <div v-if="filterSummary" class="bg-base-200 rounded-lg p-3 mb-4">
          <p class="text-xs text-base-content/70 mb-1">{{ t('matchingFilters') }}</p>
          <p class="text-sm">{{ filterSummary }}</p>
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" @click="closeModal">{{ t('cancel') }}</button>
          <button class="btn btn-primary" :disabled="!searchName.trim() || saving" @click="handleSave">
            <span v-if="saving" class="loading loading-spinner loading-sm"></span>
            {{ t('save') }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="closeModal">{{ t('close') }}</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  const props = defineProps<{
    filters: Record<string, any>;
    filterSummary?: string;
  }>();

  const { user } = useAuth();
  const { createSavedSearch, saving } = useSavedSearches();

  const showModal = ref(false);
  const searchName = ref('');

  const closeModal = () => {
    showModal.value = false;
  };

  const handleSave = async () => {
    if (!searchName.value.trim()) return;

    const result = await createSavedSearch(searchName.value.trim(), props.filters);

    if (result) {
      searchName.value = '';
      showModal.value = false;
    }
  };
</script>

<i18n lang="json">
{
  "en": { "saveThisSearch": "Save this Search", "saveSearch": "Save Search", "description": "Get email notifications when new listings match these filters.", "searchNameLabel": "Search Name *", "searchNamePlaceholder": "e.g., My dream Cooper S", "matchingFilters": "Matching filters:", "cancel": "Cancel", "save": "Save", "close": "close" },
  "es": { "saveThisSearch": "Guardar esta búsqueda", "saveSearch": "Guardar búsqueda", "description": "Recibe notificaciones por correo cuando nuevos anuncios coincidan con estos filtros.", "searchNameLabel": "Nombre de la búsqueda *", "searchNamePlaceholder": "p. ej., Mi Cooper S soñado", "matchingFilters": "Filtros coincidentes:", "cancel": "Cancelar", "save": "Guardar", "close": "cerrar" },
  "fr": { "saveThisSearch": "Enregistrer cette recherche", "saveSearch": "Enregistrer la recherche", "description": "Recevez des notifications par e-mail lorsque de nouvelles annonces correspondent à ces filtres.", "searchNameLabel": "Nom de la recherche *", "searchNamePlaceholder": "ex. : Ma Cooper S de rêve", "matchingFilters": "Filtres correspondants :", "cancel": "Annuler", "save": "Enregistrer", "close": "fermer" },
  "de": { "saveThisSearch": "Diese Suche speichern", "saveSearch": "Suche speichern", "description": "Erhalte E-Mail-Benachrichtigungen, wenn neue Anzeigen zu diesen Filtern passen.", "searchNameLabel": "Suchname *", "searchNamePlaceholder": "z. B. Mein Traum-Cooper-S", "matchingFilters": "Passende Filter:", "cancel": "Abbrechen", "save": "Speichern", "close": "schließen" },
  "it": { "saveThisSearch": "Salva questa ricerca", "saveSearch": "Salva ricerca", "description": "Ricevi notifiche via e-mail quando nuovi annunci corrispondono a questi filtri.", "searchNameLabel": "Nome della ricerca *", "searchNamePlaceholder": "es. La mia Cooper S dei sogni", "matchingFilters": "Filtri corrispondenti:", "cancel": "Annulla", "save": "Salva", "close": "chiudi" },
  "pt": { "saveThisSearch": "Salvar esta busca", "saveSearch": "Salvar busca", "description": "Receba notificações por e-mail quando novos anúncios corresponderem a esses filtros.", "searchNameLabel": "Nome da busca *", "searchNamePlaceholder": "ex.: Meu Cooper S dos sonhos", "matchingFilters": "Filtros correspondentes:", "cancel": "Cancelar", "save": "Salvar", "close": "fechar" },
  "ru": { "saveThisSearch": "Сохранить этот поиск", "saveSearch": "Сохранить поиск", "description": "Получайте уведомления по электронной почте, когда новые объявления соответствуют этим фильтрам.", "searchNameLabel": "Название поиска *", "searchNamePlaceholder": "например, Мой Cooper S мечты", "matchingFilters": "Подходящие фильтры:", "cancel": "Отмена", "save": "Сохранить", "close": "закрыть" },
  "ja": { "saveThisSearch": "この検索を保存", "saveSearch": "検索を保存", "description": "これらのフィルターに一致する新しい出品があるとメールで通知します。", "searchNameLabel": "検索名 *", "searchNamePlaceholder": "例：理想のクーパーS", "matchingFilters": "一致するフィルター：", "cancel": "キャンセル", "save": "保存", "close": "閉じる" },
  "zh": { "saveThisSearch": "保存此搜索", "saveSearch": "保存搜索", "description": "当有新刊登匹配这些筛选条件时，通过电子邮件通知您。", "searchNameLabel": "搜索名称 *", "searchNamePlaceholder": "例如：我梦想中的 Cooper S", "matchingFilters": "匹配的筛选条件：", "cancel": "取消", "save": "保存", "close": "关闭" },
  "ko": { "saveThisSearch": "이 검색 저장", "saveSearch": "검색 저장", "description": "이 필터와 일치하는 새 매물이 있으면 이메일로 알려드립니다.", "searchNameLabel": "검색 이름 *", "searchNamePlaceholder": "예: 내 꿈의 Cooper S", "matchingFilters": "일치하는 필터:", "cancel": "취소", "save": "저장", "close": "닫기" }
}
</i18n>
