<template>
  <div>
    <!-- Page Header -->
    <section class="bg-base-100 border-b border-base-300 py-12">
      <div class="container">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 class="text-3xl font-bold">{{ t('header.title') }}</h1>
            <p class="text-base-content/70 mt-2">{{ t('header.subtitle') }}</p>
          </div>
          <NuxtLink to="/exchange/wanted/new" class="btn btn-primary">
            <i class="fas fa-plus text-lg"></i>
            {{ t('header.postBtn') }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Content -->
    <section class="py-12">
      <div class="container">
        <!-- Tabs -->
        <div role="tablist" class="tabs tabs-box mb-8">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            role="tab"
            class="tab"
            :class="{ 'tab-active': activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            <i :class="tab.icon" class="mr-2"></i>
            {{ t(`tabs.${tab.key}`) }}
            <span v-if="getTabCount(tab.filter) > 0" class="badge badge-sm ml-2">
              {{ getTabCount(tab.filter) }}
            </span>
          </button>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="i in 6" :key="i" class="skeleton h-64 w-full rounded-lg"></div>
        </div>

        <!-- Posts Grid -->
        <div v-else-if="filteredPosts.length > 0" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ExchangeWantedCard
            v-for="post in filteredPosts"
            :key="post.id"
            :post="post"
            :show-actions="true"
            @fulfill="handleFulfill"
            @renew="handleRenew"
            @delete="handleDeleteClick"
          />
        </div>

        <!-- Empty States -->
        <div v-else class="text-center py-16">
          <i :class="emptyStateIcon" class="text-6xl mx-auto mb-4 block text-base-content/30"></i>
          <h3 class="text-xl font-semibold mb-2">{{ emptyStateTitle }}</h3>
          <p class="text-base-content/70 mb-6">{{ emptyStateDescription }}</p>
          <NuxtLink v-if="activeTab === 'all' || activeTab === 'active'" to="/exchange/wanted/new" class="btn btn-primary">
            <i class="fas fa-plus"></i>
            {{ t('empty.firstPostBtn') }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Delete Confirmation Dialog -->
    <dialog ref="deleteDialogRef" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg">{{ t('deleteDialog.title') }}</h3>
        <p class="py-4">{{ t('deleteDialog.body') }}</p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="deleteDialogRef?.close()">{{ t('deleteDialog.cancel') }}</button>
          <button class="btn btn-error" @click="confirmDelete">{{ t('deleteDialog.confirm') }}</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>{{ t('deleteDialog.close') }}</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
  import type { WantedPost } from '~/composables/useWantedPosts';

  const { t } = useI18n();

  useSeoMeta({
    title: () => t('seoTitle'),
    robots: 'noindex, nofollow',
  });

  const { user } = useAuth();
  const { wantedPosts, loading, fetchUserWantedPosts, deleteWantedPost, markFulfilled, renewWantedPost } =
    useWantedPosts();
  const { handleError } = useErrorHandler();
  const toast = useToast();
  const { capture } = usePostHog();

  const activeTab = ref('all');
  const pendingDeleteId = ref<string | null>(null);
  const deleteDialogRef = ref<HTMLDialogElement | null>(null);

  const tabs = [
    { key: 'all', icon: 'fas fa-table-cells-large', filter: null },
    { key: 'active', icon: 'fas fa-circle-check', filter: 'active' },
    { key: 'fulfilled', icon: 'fas fa-circle-check', filter: 'fulfilled' },
    { key: 'expired', icon: 'fas fa-clock', filter: 'expired' },
  ];

  /**
   * Count posts matching a given status filter.
   */
  const getTabCount = (filter: string | null): number => {
    if (!filter) return wantedPosts.value.length;
    return wantedPosts.value.filter((p) => p.status === filter).length;
  };

  /**
   * Filter posts by the active tab's status.
   */
  const filteredPosts = computed<WantedPost[]>(() => {
    const tab = tabs.find((t) => t.key === activeTab.value);
    if (!tab || !tab.filter) return wantedPosts.value;
    return wantedPosts.value.filter((p) => p.status === tab.filter);
  });

  /**
   * Empty state content based on active tab.
   */
  const emptyStateIcon = computed(() => {
    switch (activeTab.value) {
      case 'fulfilled':
        return 'fas fa-circle-check';
      case 'expired':
        return 'fas fa-clock';
      default:
        return 'fas fa-bullhorn';
    }
  });

  const emptyStateTitle = computed(() => {
    switch (activeTab.value) {
      case 'active':
        return t('empty.active.title');
      case 'fulfilled':
        return t('empty.fulfilled.title');
      case 'expired':
        return t('empty.expired.title');
      default:
        return t('empty.all.title');
    }
  });

  const emptyStateDescription = computed(() => {
    switch (activeTab.value) {
      case 'active':
        return t('empty.active.description');
      case 'fulfilled':
        return t('empty.fulfilled.description');
      case 'expired':
        return t('empty.expired.description');
      default:
        return t('empty.all.description');
    }
  });

  /**
   * Mark a post as fulfilled.
   */
  const handleFulfill = async (id: string) => {
    const success = await markFulfilled(id);
    if (success) {
      capture('wanted_post_fulfilled_from_dashboard', { wanted_post_id: id });
    }
  };

  /**
   * Renew an expired post.
   */
  const handleRenew = async (id: string) => {
    const success = await renewWantedPost(id);
    if (success) {
      capture('wanted_post_renewed_from_dashboard', { wanted_post_id: id });
    }
  };

  /**
   * Open delete confirmation dialog.
   */
  const handleDeleteClick = (id: string) => {
    pendingDeleteId.value = id;
    deleteDialogRef.value?.showModal();
  };

  /**
   * Execute deletion after confirmation.
   */
  const confirmDelete = async () => {
    if (!pendingDeleteId.value) return;

    const id = pendingDeleteId.value;
    pendingDeleteId.value = null;

    const success = await deleteWantedPost(id);
    if (success) {
      capture('wanted_post_deleted_from_dashboard', { wanted_post_id: id });
    }
  };

  /**
   * Track dashboard view once loading finishes.
   */
  watch(loading, (isLoading, wasLoading) => {
    if (wasLoading && !isLoading) {
      capture('wanted_dashboard_viewed', {
        total_count: wantedPosts.value.length,
        active_count: wantedPosts.value.filter((p) => p.status === 'active').length,
        fulfilled_count: wantedPosts.value.filter((p) => p.status === 'fulfilled').length,
        expired_count: wantedPosts.value.filter((p) => p.status === 'expired').length,
      });
    }
  });

  onMounted(() => {
    fetchUserWantedPosts();
  });
</script>

<i18n lang="json">
{
  "en": {
    "seoTitle": "My Wanted Posts - Classic Mini DIY",
    "header": { "title": "My Wanted Posts", "subtitle": "Manage your wanted ads for Classic Mini vehicles and parts", "postBtn": "Post a Want" },
    "tabs": { "all": "All", "active": "Active", "fulfilled": "Fulfilled", "expired": "Expired" },
    "empty": {
      "all": { "title": "No Wanted Posts Yet", "description": "Get started by posting what Classic Mini parts or vehicles you are looking for." },
      "active": { "title": "No Active Wanted Posts", "description": "Post a wanted ad to let the community know what Classic Mini parts or vehicles you need." },
      "fulfilled": { "title": "No Fulfilled Posts Yet", "description": "Posts you've marked as fulfilled will appear here." },
      "expired": { "title": "No Expired Posts", "description": "Expired posts will appear here. You can renew them to make them active again." },
      "firstPostBtn": "Post Your First Want"
    },
    "deleteDialog": { "title": "Delete Wanted Post", "body": "Are you sure you want to delete this wanted post? This action cannot be undone.", "cancel": "Cancel", "confirm": "Delete", "close": "close" }
  },
  "es": {
    "seoTitle": "Mis anuncios de búsqueda - Classic Mini DIY",
    "header": { "title": "Mis anuncios de búsqueda", "subtitle": "Gestiona tus anuncios de búsqueda de vehículos y piezas de Classic Mini", "postBtn": "Publicar búsqueda" },
    "tabs": { "all": "Todos", "active": "Activos", "fulfilled": "Conseguidos", "expired": "Caducados" },
    "empty": {
      "all": { "title": "Aún no hay anuncios de búsqueda", "description": "Empieza publicando qué piezas o vehículos de Classic Mini estás buscando." },
      "active": { "title": "No hay anuncios de búsqueda activos", "description": "Publica un anuncio de búsqueda para que la comunidad sepa qué piezas o vehículos de Classic Mini necesitas." },
      "fulfilled": { "title": "Aún no hay anuncios conseguidos", "description": "Los anuncios que hayas marcado como conseguidos aparecerán aquí." },
      "expired": { "title": "No hay anuncios caducados", "description": "Los anuncios caducados aparecerán aquí. Puedes renovarlos para activarlos de nuevo." },
      "firstPostBtn": "Publica tu primera búsqueda"
    },
    "deleteDialog": { "title": "Eliminar anuncio de búsqueda", "body": "¿Seguro que quieres eliminar este anuncio de búsqueda? Esta acción no se puede deshacer.", "cancel": "Cancelar", "confirm": "Eliminar", "close": "cerrar" }
  },
  "fr": {
    "seoTitle": "Mes annonces de recherche - Classic Mini DIY",
    "header": { "title": "Mes annonces de recherche", "subtitle": "Gérez vos annonces de recherche de véhicules et pièces Classic Mini", "postBtn": "Publier une recherche" },
    "tabs": { "all": "Toutes", "active": "Actives", "fulfilled": "Trouvées", "expired": "Expirées" },
    "empty": {
      "all": { "title": "Aucune annonce de recherche", "description": "Commencez par publier les pièces ou véhicules Classic Mini que vous recherchez." },
      "active": { "title": "Aucune annonce de recherche active", "description": "Publiez une annonce de recherche pour faire savoir à la communauté quelles pièces ou véhicules Classic Mini vous cherchez." },
      "fulfilled": { "title": "Aucune annonce trouvée pour l'instant", "description": "Les annonces que vous avez marquées comme trouvées apparaîtront ici." },
      "expired": { "title": "Aucune annonce expirée", "description": "Les annonces expirées apparaîtront ici. Vous pouvez les renouveler pour les réactiver." },
      "firstPostBtn": "Publiez votre première recherche"
    },
    "deleteDialog": { "title": "Supprimer l'annonce de recherche", "body": "Voulez-vous vraiment supprimer cette annonce de recherche ? Cette action est irréversible.", "cancel": "Annuler", "confirm": "Supprimer", "close": "fermer" }
  },
  "de": {
    "seoTitle": "Meine Gesuche - Classic Mini DIY",
    "header": { "title": "Meine Gesuche", "subtitle": "Verwalte deine Gesuche für Classic-Mini-Fahrzeuge und -Teile", "postBtn": "Gesuch aufgeben" },
    "tabs": { "all": "Alle", "active": "Aktiv", "fulfilled": "Gefunden", "expired": "Abgelaufen" },
    "empty": {
      "all": { "title": "Noch keine Gesuche", "description": "Lege los, indem du angibst, welche Classic-Mini-Teile oder -Fahrzeuge du suchst." },
      "active": { "title": "Keine aktiven Gesuche", "description": "Gib ein Gesuch auf, damit die Community weiß, welche Classic-Mini-Teile oder -Fahrzeuge du brauchst." },
      "fulfilled": { "title": "Noch keine gefundenen Gesuche", "description": "Gesuche, die du als gefunden markiert hast, erscheinen hier." },
      "expired": { "title": "Keine abgelaufenen Gesuche", "description": "Abgelaufene Gesuche erscheinen hier. Du kannst sie erneuern, um sie wieder zu aktivieren." },
      "firstPostBtn": "Gib dein erstes Gesuch auf"
    },
    "deleteDialog": { "title": "Gesuch löschen", "body": "Möchtest du dieses Gesuch wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.", "cancel": "Abbrechen", "confirm": "Löschen", "close": "schließen" }
  },
  "it": {
    "seoTitle": "I miei annunci di ricerca - Classic Mini DIY",
    "header": { "title": "I miei annunci di ricerca", "subtitle": "Gestisci i tuoi annunci di ricerca per veicoli e ricambi Classic Mini", "postBtn": "Pubblica una ricerca" },
    "tabs": { "all": "Tutti", "active": "Attivi", "fulfilled": "Trovati", "expired": "Scaduti" },
    "empty": {
      "all": { "title": "Ancora nessun annuncio di ricerca", "description": "Inizia pubblicando quali ricambi o veicoli Classic Mini stai cercando." },
      "active": { "title": "Nessun annuncio di ricerca attivo", "description": "Pubblica un annuncio di ricerca per far sapere alla comunità quali ricambi o veicoli Classic Mini ti servono." },
      "fulfilled": { "title": "Ancora nessun annuncio trovato", "description": "Gli annunci che hai contrassegnato come trovati appariranno qui." },
      "expired": { "title": "Nessun annuncio scaduto", "description": "Gli annunci scaduti appariranno qui. Puoi rinnovarli per renderli di nuovo attivi." },
      "firstPostBtn": "Pubblica la tua prima ricerca"
    },
    "deleteDialog": { "title": "Elimina annuncio di ricerca", "body": "Sei sicuro di voler eliminare questo annuncio di ricerca? Questa azione non può essere annullata.", "cancel": "Annulla", "confirm": "Elimina", "close": "chiudi" }
  },
  "pt": {
    "seoTitle": "Meus anúncios de procura - Classic Mini DIY",
    "header": { "title": "Meus anúncios de procura", "subtitle": "Gerencie seus anúncios de procura de veículos e peças Classic Mini", "postBtn": "Publicar procura" },
    "tabs": { "all": "Todos", "active": "Ativos", "fulfilled": "Encontrados", "expired": "Expirados" },
    "empty": {
      "all": { "title": "Ainda não há anúncios de procura", "description": "Comece publicando quais peças ou veículos Classic Mini você procura." },
      "active": { "title": "Nenhum anúncio de procura ativo", "description": "Publique um anúncio de procura para que a comunidade saiba quais peças ou veículos Classic Mini você precisa." },
      "fulfilled": { "title": "Ainda não há anúncios encontrados", "description": "Os anúncios que você marcou como encontrados aparecerão aqui." },
      "expired": { "title": "Nenhum anúncio expirado", "description": "Anúncios expirados aparecerão aqui. Você pode renová-los para ativá-los novamente." },
      "firstPostBtn": "Publique sua primeira procura"
    },
    "deleteDialog": { "title": "Excluir anúncio de procura", "body": "Tem certeza de que deseja excluir este anúncio de procura? Esta ação não pode ser desfeita.", "cancel": "Cancelar", "confirm": "Excluir", "close": "fechar" }
  },
  "ru": {
    "seoTitle": "Мои объявления о поиске - Classic Mini DIY",
    "header": { "title": "Мои объявления о поиске", "subtitle": "Управляйте своими объявлениями о поиске автомобилей и запчастей Classic Mini", "postBtn": "Разместить запрос" },
    "tabs": { "all": "Все", "active": "Активные", "fulfilled": "Найдено", "expired": "Истёкшие" },
    "empty": {
      "all": { "title": "Пока нет объявлений о поиске", "description": "Начните с публикации того, какие запчасти или автомобили Classic Mini вы ищете." },
      "active": { "title": "Нет активных объявлений о поиске", "description": "Разместите объявление о поиске, чтобы сообщество знало, какие запчасти или автомобили Classic Mini вам нужны." },
      "fulfilled": { "title": "Пока нет найденных объявлений", "description": "Объявления, которые вы отметили как найденные, появятся здесь." },
      "expired": { "title": "Нет истёкших объявлений", "description": "Истёкшие объявления появятся здесь. Вы можете продлить их, чтобы снова активировать." },
      "firstPostBtn": "Разместите первый запрос"
    },
    "deleteDialog": { "title": "Удалить объявление о поиске", "body": "Вы уверены, что хотите удалить это объявление о поиске? Это действие нельзя отменить.", "cancel": "Отмена", "confirm": "Удалить", "close": "закрыть" }
  },
  "ja": {
    "seoTitle": "募集中の投稿 - Classic Mini DIY",
    "header": { "title": "募集中の投稿", "subtitle": "クラシックミニの車両やパーツの募集広告を管理します", "postBtn": "募集を投稿" },
    "tabs": { "all": "すべて", "active": "アクティブ", "fulfilled": "見つかった", "expired": "期限切れ" },
    "empty": {
      "all": { "title": "まだ募集投稿がありません", "description": "探しているクラシックミニのパーツや車両を投稿して始めましょう。" },
      "active": { "title": "アクティブな募集投稿はありません", "description": "募集広告を投稿して、必要なクラシックミニのパーツや車両をコミュニティに知らせましょう。" },
      "fulfilled": { "title": "まだ見つかった投稿はありません", "description": "見つかったとマークした投稿はここに表示されます。" },
      "expired": { "title": "期限切れの投稿はありません", "description": "期限切れの投稿はここに表示されます。更新すると再びアクティブにできます。" },
      "firstPostBtn": "最初の募集を投稿"
    },
    "deleteDialog": { "title": "募集投稿を削除", "body": "この募集投稿を削除してもよろしいですか？この操作は取り消せません。", "cancel": "キャンセル", "confirm": "削除", "close": "閉じる" }
  },
  "zh": {
    "seoTitle": "我的求购 - Classic Mini DIY",
    "header": { "title": "我的求购", "subtitle": "管理你的经典 Mini 车辆和零件求购广告", "postBtn": "发布求购" },
    "tabs": { "all": "全部", "active": "进行中", "fulfilled": "已找到", "expired": "已过期" },
    "empty": {
      "all": { "title": "还没有求购", "description": "发布你正在寻找的经典 Mini 零件或车辆来开始吧。" },
      "active": { "title": "没有进行中的求购", "description": "发布求购广告，让社区知道你需要哪些经典 Mini 零件或车辆。" },
      "fulfilled": { "title": "还没有已找到的求购", "description": "你标记为已找到的求购将显示在此处。" },
      "expired": { "title": "没有已过期的求购", "description": "已过期的求购将显示在此处。你可以续期使其重新生效。" },
      "firstPostBtn": "发布你的第一个求购"
    },
    "deleteDialog": { "title": "删除求购", "body": "确定要删除这条求购吗？此操作无法撤销。", "cancel": "取消", "confirm": "删除", "close": "关闭" }
  },
  "ko": {
    "seoTitle": "내 구함 게시물 - Classic Mini DIY",
    "header": { "title": "내 구함 게시물", "subtitle": "클래식 미니 차량 및 부품 구함 광고를 관리하세요", "postBtn": "구함 등록" },
    "tabs": { "all": "전체", "active": "활성", "fulfilled": "구함 완료", "expired": "만료됨" },
    "empty": {
      "all": { "title": "아직 구함 게시물이 없습니다", "description": "찾고 있는 클래식 미니 부품이나 차량을 등록하여 시작하세요." },
      "active": { "title": "활성 구함 게시물이 없습니다", "description": "구함 광고를 등록하여 필요한 클래식 미니 부품이나 차량을 커뮤니티에 알리세요." },
      "fulfilled": { "title": "아직 구함 완료된 게시물이 없습니다", "description": "구함 완료로 표시한 게시물이 여기에 표시됩니다." },
      "expired": { "title": "만료된 게시물이 없습니다", "description": "만료된 게시물이 여기에 표시됩니다. 갱신하여 다시 활성화할 수 있습니다." },
      "firstPostBtn": "첫 구함을 등록하세요"
    },
    "deleteDialog": { "title": "구함 게시물 삭제", "body": "이 구함 게시물을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.", "cancel": "취소", "confirm": "삭제", "close": "닫기" }
  }
}
</i18n>
