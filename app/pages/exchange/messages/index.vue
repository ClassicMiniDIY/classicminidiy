<template>
  <div class="container py-8">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-3xl font-bold mb-2">{{ t('header.title') }}</h1>
        <p class="text-base-content/70">{{ t('header.subtitle') }}</p>
      </div>

      <!-- Error State -->
      <div v-if="error" class="alert alert-error">
        <i class="fas fa-triangle-exclamation text-xl"></i>
        <div>
          <h3 class="font-bold">{{ t('error.title') }}</h3>
          <p>{{ t('error.body') }}</p>
        </div>
        <button class="btn btn-sm" @click="retryFetch">{{ t('error.retry') }}</button>
      </div>

      <template v-else>
        <!-- Search -->
        <div class="mb-4">
          <label class="input input-bordered flex items-center gap-2">
            <i class="fas fa-magnifying-glass opacity-70"></i>
            <input
              v-model="searchQuery"
              type="search"
              class="grow"
              :placeholder="t('search.placeholder')"
              :aria-label="t('search.ariaLabel')"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="btn btn-ghost btn-xs btn-circle"
              :aria-label="t('search.clear')"
              @click="searchQuery = ''"
            >
              <i class="fas fa-xmark"></i>
            </button>
          </label>
        </div>

        <!-- Tabs -->
        <div role="tablist" class="tabs tabs-bordered mb-4">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            role="tab"
            type="button"
            class="tab"
            :class="{ 'tab-active font-semibold': activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
            <span
              v-if="tab.count > 0"
              class="badge badge-sm ml-2"
              :class="tab.key === activeTab ? 'badge-primary' : 'badge-ghost'"
            >
              {{ tab.count }}
            </span>
          </button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg"></span>
        </div>

        <!-- Empty (no conversations at all) -->
        <div v-else-if="conversations.length === 0" class="text-center py-16">
          <i class="fas fa-inbox text-6xl mx-auto mb-4 text-base-content/30"></i>
          <h3 class="text-xl font-semibold mb-2">{{ t('empty.title') }}</h3>
          <p class="text-base-content/70 mb-6">{{ t('empty.body') }}</p>
          <NuxtLink to="/exchange/listings" class="btn btn-primary">
            <i class="fas fa-magnifying-glass"></i>
            {{ t('empty.browse') }}
          </NuxtLink>
        </div>

        <!-- Empty search / empty tab -->
        <div v-else-if="visibleGroups.length === 0" class="text-center py-12">
          <i
            class="fas mx-auto mb-3 text-base-content/30 text-5xl"
            :class="searchQuery ? 'fa-magnifying-glass' : 'fa-inbox'"
          ></i>
          <p class="text-base-content/70">
            <template v-if="searchQuery">{{ t('emptySearch.noMatch', { query: searchQuery }) }}</template>
            <template v-else>{{ t('emptySearch.noTab') }}</template>
          </p>
        </div>

        <!-- Grouped conversation list -->
        <div v-else class="space-y-3">
          <ExchangeMessagesListingConversationGroup
            v-for="group in visibleGroups"
            :key="group.id"
            :group="group"
            :is-open="isGroupOpen(group.id)"
            @toggle="toggleGroup(group.id)"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { Conversation } from '~/composables/useMessages';
  import type { ConversationGroup } from '~/components/exchange/messages/ListingConversationGroup.vue';

  const { t } = useI18n();

  definePageMeta({
    middleware: 'exchange-auth',
  });

  useSeoMeta({
    title: t('seo.title'),
    robots: 'noindex, nofollow',
  });

  const { fetchConversations, getOtherParticipant, loading } = useMessages();
  const { getPhotoUrl } = useListings();
  const { capture } = usePostHog();
  const { user } = useAuth();

  const conversations = ref<Conversation[]>([]);
  const error = ref(false);
  const searchQuery = ref('');
  type TabKey = 'active' | 'sold' | 'all';
  const activeTab = ref<TabKey>('active');

  // --- Helpers ---

  const getUnreadCount = (c: Conversation): number => {
    if (!user.value) return 0;
    if (c.buyer_id === user.value.id) return c.buyer_unread_count || 0;
    if (c.seller_id === user.value.id) return c.seller_unread_count || 0;
    return 0;
  };

  const getListingImage = (c: Conversation): string | null => {
    const photos = c.listing?.listing_photos;
    if (!photos || photos.length === 0) return null;
    const photo = photos.find((p) => p.is_primary) || photos[0];
    return photo ? getPhotoUrl(photo.storage_path) : null;
  };

  // --- Grouping: collapse conversations by listing / wanted post ---

  const allGroups = computed<ConversationGroup[]>(() => {
    const map = new Map<string, ConversationGroup>();

    for (const c of conversations.value) {
      let key: string;
      let group: ConversationGroup;

      if (c.listing) {
        key = `l:${c.listing.id}`;
        if (!map.has(key)) {
          group = {
            kind: 'listing',
            id: key,
            title: c.listing.title,
            thumbnailUrl: getListingImage(c),
            status: c.listing.status || null,
            price: c.listing.price ?? null,
            conversations: [],
            totalUnread: 0,
            latestMessageAt: c.last_message_at,
          };
          map.set(key, group);
        }
      } else if (c.wanted_post) {
        key = `w:${c.wanted_post.id}`;
        if (!map.has(key)) {
          group = {
            kind: 'wanted_post',
            id: key,
            title: `Wanted: ${c.wanted_post.title}`,
            thumbnailUrl: null,
            status: null,
            price: null,
            conversations: [],
            totalUnread: 0,
            latestMessageAt: c.last_message_at,
          };
          map.set(key, group);
        }
      } else {
        key = `o:${c.id}`;
        if (!map.has(key)) {
          group = {
            kind: 'orphan',
            id: key,
            title: 'Conversation',
            thumbnailUrl: null,
            status: null,
            price: null,
            conversations: [],
            totalUnread: 0,
            latestMessageAt: c.last_message_at,
          };
          map.set(key, group);
        }
      }

      const g = map.get(key)!;
      g.conversations.push(c);
      g.totalUnread += getUnreadCount(c);
      if (new Date(c.last_message_at).getTime() > new Date(g.latestMessageAt).getTime()) {
        g.latestMessageAt = c.last_message_at;
      }
    }

    // Sort groups by latest message, and sort inner conversations the same way
    const list = Array.from(map.values());
    list.sort(
      (a, b) => new Date(b.latestMessageAt).getTime() - new Date(a.latestMessageAt).getTime()
    );
    for (const g of list) {
      g.conversations.sort(
        (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      );
    }
    return list;
  });

  // --- Tab filtering (sold/active/all) ---

  const tabGroups = (key: TabKey) => {
    if (key === 'all') return allGroups.value;
    if (key === 'sold') return allGroups.value.filter((g) => g.status === 'sold');
    // active = everything that isn't sold (includes wanted posts / orphans)
    return allGroups.value.filter((g) => g.status !== 'sold');
  };

  const tabs = computed(() => [
    { key: 'active' as TabKey, label: t('tabs.active'), count: tabGroups('active').length },
    { key: 'sold' as TabKey, label: t('tabs.sold'), count: tabGroups('sold').length },
    { key: 'all' as TabKey, label: t('tabs.all'), count: allGroups.value.length },
  ]);

  // --- Search ---
  // A group appears if (a) its title matches, OR (b) at least one of its
  // conversations has a matching participant name. Within a shown group,
  // if the title didn't match, only matching conversations are rendered.

  const matchesTitle = (group: ConversationGroup, q: string) =>
    group.title.toLowerCase().includes(q);

  const matchesParticipant = (c: Conversation, q: string) => {
    const p = getOtherParticipant(c);
    return (p?.name || '').toLowerCase().includes(q);
  };

  const visibleGroups = computed<ConversationGroup[]>(() => {
    const base = tabGroups(activeTab.value);
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return base;

    const result: ConversationGroup[] = [];
    for (const g of base) {
      if (matchesTitle(g, q)) {
        // Title matches — keep the whole group
        result.push(g);
        continue;
      }
      const matchingConvos = g.conversations.filter((c) => matchesParticipant(c, q));
      if (matchingConvos.length > 0) {
        result.push({
          ...g,
          conversations: matchingConvos,
          totalUnread: matchingConvos.reduce((sum, c) => sum + getUnreadCount(c), 0),
        });
      }
    }
    return result;
  });

  // --- Group open/close state ---
  // Default open: groups with unread messages, or all groups when searching.
  const manuallyToggled = ref<Record<string, boolean>>({});

  const isGroupOpen = (groupId: string) => {
    if (groupId in manuallyToggled.value) return manuallyToggled.value[groupId];
    if (searchQuery.value.trim()) return true;
    const g = allGroups.value.find((x) => x.id === groupId);
    return !!g && g.totalUnread > 0;
  };

  const toggleGroup = (groupId: string) => {
    manuallyToggled.value = {
      ...manuallyToggled.value,
      [groupId]: !isGroupOpen(groupId),
    };
  };

  // --- Data loading ---

  const retryFetch = async () => {
    error.value = false;
    try {
      conversations.value = await fetchConversations();
    } catch {
      error.value = true;
    }
  };

  onMounted(async () => {
    try {
      conversations.value = await fetchConversations();
    } catch {
      error.value = true;
      return;
    }

    capture('inbox_viewed', {
      conversation_count: conversations.value.length,
      unread_total: conversations.value.reduce(
        (sum, c) => sum + (c.buyer_unread_count || 0) + (c.seller_unread_count || 0),
        0
      ),
    });
  });

  // Real-time subscription for new/updated conversations
  const supabase = useSupabase();

  onMounted(() => {
    if (!user.value) return;

    const channel = supabase
      .channel('conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `buyer_id=eq.${user.value.id}`,
        },
        async () => {
          conversations.value = await fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `seller_id=eq.${user.value.id}`,
        },
        async () => {
          conversations.value = await fetchConversations();
        }
      )
      .subscribe();

    onBeforeUnmount(() => {
      supabase.removeChannel(channel);
    });
  });
</script>

<i18n lang="json">
{
  "en": {
    "seo": { "title": "Messages - The Mini Exchange | Classic Mini DIY" },
    "header": { "title": "Messages", "subtitle": "Grouped by listing — click a listing to see everyone who messaged you about it" },
    "error": { "title": "Failed to load messages", "body": "Something went wrong. Please try again.", "retry": "Try Again" },
    "search": { "placeholder": "Search by listing title or person...", "ariaLabel": "Search conversations", "clear": "Clear search" },
    "tabs": { "active": "Active", "sold": "Sold", "all": "All" },
    "empty": { "title": "No messages yet", "body": "Start a conversation by contacting a seller on a listing", "browse": "Browse Listings" },
    "emptySearch": { "noMatch": "No conversations match \"{query}\"", "noTab": "No conversations in this tab" }
  },
  "es": {
    "seo": { "title": "Mensajes - The Mini Exchange | Classic Mini DIY" },
    "header": { "title": "Mensajes", "subtitle": "Agrupados por anuncio — haz clic en un anuncio para ver a todos los que te escribieron sobre él" },
    "error": { "title": "Error al cargar los mensajes", "body": "Algo salió mal. Inténtalo de nuevo.", "retry": "Reintentar" },
    "search": { "placeholder": "Buscar por título de anuncio o persona...", "ariaLabel": "Buscar conversaciones", "clear": "Borrar búsqueda" },
    "tabs": { "active": "Activos", "sold": "Vendidos", "all": "Todos" },
    "empty": { "title": "Aún no hay mensajes", "body": "Inicia una conversación contactando a un vendedor en un anuncio", "browse": "Explorar anuncios" },
    "emptySearch": { "noMatch": "Ninguna conversación coincide con \"{query}\"", "noTab": "No hay conversaciones en esta pestaña" }
  },
  "fr": {
    "seo": { "title": "Messages - The Mini Exchange | Classic Mini DIY" },
    "header": { "title": "Messages", "subtitle": "Regroupés par annonce — cliquez sur une annonce pour voir tous ceux qui vous ont écrit à son sujet" },
    "error": { "title": "Échec du chargement des messages", "body": "Une erreur s'est produite. Veuillez réessayer.", "retry": "Réessayer" },
    "search": { "placeholder": "Rechercher par titre d'annonce ou personne...", "ariaLabel": "Rechercher des conversations", "clear": "Effacer la recherche" },
    "tabs": { "active": "Actives", "sold": "Vendues", "all": "Toutes" },
    "empty": { "title": "Aucun message pour l'instant", "body": "Démarrez une conversation en contactant un vendeur sur une annonce", "browse": "Parcourir les annonces" },
    "emptySearch": { "noMatch": "Aucune conversation ne correspond à \"{query}\"", "noTab": "Aucune conversation dans cet onglet" }
  },
  "de": {
    "seo": { "title": "Nachrichten - The Mini Exchange | Classic Mini DIY" },
    "header": { "title": "Nachrichten", "subtitle": "Nach Anzeige gruppiert — klicken Sie auf eine Anzeige, um alle zu sehen, die Ihnen dazu geschrieben haben" },
    "error": { "title": "Nachrichten konnten nicht geladen werden", "body": "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.", "retry": "Erneut versuchen" },
    "search": { "placeholder": "Nach Anzeigentitel oder Person suchen...", "ariaLabel": "Konversationen durchsuchen", "clear": "Suche löschen" },
    "tabs": { "active": "Aktiv", "sold": "Verkauft", "all": "Alle" },
    "empty": { "title": "Noch keine Nachrichten", "body": "Starten Sie eine Konversation, indem Sie einen Verkäufer zu einer Anzeige kontaktieren", "browse": "Anzeigen durchsuchen" },
    "emptySearch": { "noMatch": "Keine Konversationen passen zu \"{query}\"", "noTab": "Keine Konversationen in diesem Tab" }
  },
  "it": {
    "seo": { "title": "Messaggi - The Mini Exchange | Classic Mini DIY" },
    "header": { "title": "Messaggi", "subtitle": "Raggruppati per annuncio — clicca su un annuncio per vedere tutti quelli che ti hanno scritto al riguardo" },
    "error": { "title": "Impossibile caricare i messaggi", "body": "Qualcosa è andato storto. Riprova.", "retry": "Riprova" },
    "search": { "placeholder": "Cerca per titolo annuncio o persona...", "ariaLabel": "Cerca conversazioni", "clear": "Cancella ricerca" },
    "tabs": { "active": "Attivi", "sold": "Venduti", "all": "Tutti" },
    "empty": { "title": "Ancora nessun messaggio", "body": "Avvia una conversazione contattando un venditore su un annuncio", "browse": "Sfoglia annunci" },
    "emptySearch": { "noMatch": "Nessuna conversazione corrisponde a \"{query}\"", "noTab": "Nessuna conversazione in questa scheda" }
  },
  "pt": {
    "seo": { "title": "Mensagens - The Mini Exchange | Classic Mini DIY" },
    "header": { "title": "Mensagens", "subtitle": "Agrupadas por anúncio — clique num anúncio para ver todos que lhe enviaram mensagem sobre ele" },
    "error": { "title": "Falha ao carregar as mensagens", "body": "Algo correu mal. Tente novamente.", "retry": "Tentar novamente" },
    "search": { "placeholder": "Pesquisar por título do anúncio ou pessoa...", "ariaLabel": "Pesquisar conversas", "clear": "Limpar pesquisa" },
    "tabs": { "active": "Ativas", "sold": "Vendidas", "all": "Todas" },
    "empty": { "title": "Ainda não há mensagens", "body": "Inicie uma conversa contactando um vendedor num anúncio", "browse": "Explorar anúncios" },
    "emptySearch": { "noMatch": "Nenhuma conversa corresponde a \"{query}\"", "noTab": "Nenhuma conversa neste separador" }
  },
  "ru": {
    "seo": { "title": "Сообщения - The Mini Exchange | Classic Mini DIY" },
    "header": { "title": "Сообщения", "subtitle": "Сгруппированы по объявлению — нажмите на объявление, чтобы увидеть всех, кто вам по нему написал" },
    "error": { "title": "Не удалось загрузить сообщения", "body": "Что-то пошло не так. Пожалуйста, попробуйте снова.", "retry": "Повторить" },
    "search": { "placeholder": "Поиск по названию объявления или человеку...", "ariaLabel": "Поиск по переписке", "clear": "Очистить поиск" },
    "tabs": { "active": "Активные", "sold": "Проданные", "all": "Все" },
    "empty": { "title": "Сообщений пока нет", "body": "Начните переписку, связавшись с продавцом по объявлению", "browse": "Просмотреть объявления" },
    "emptySearch": { "noMatch": "Нет переписок, соответствующих \"{query}\"", "noTab": "Нет переписок на этой вкладке" }
  },
  "ja": {
    "seo": { "title": "メッセージ - The Mini Exchange | Classic Mini DIY" },
    "header": { "title": "メッセージ", "subtitle": "出品ごとにグループ化 — 出品をクリックすると、その件であなたに連絡した全員を確認できます" },
    "error": { "title": "メッセージの読み込みに失敗しました", "body": "問題が発生しました。もう一度お試しください。", "retry": "再試行" },
    "search": { "placeholder": "出品タイトルまたは人物で検索...", "ariaLabel": "会話を検索", "clear": "検索をクリア" },
    "tabs": { "active": "アクティブ", "sold": "売却済み", "all": "すべて" },
    "empty": { "title": "まだメッセージはありません", "body": "出品の販売者に連絡して会話を始めましょう", "browse": "出品を見る" },
    "emptySearch": { "noMatch": "「{query}」に一致する会話はありません", "noTab": "このタブに会話はありません" }
  },
  "zh": {
    "seo": { "title": "消息 - The Mini Exchange | Classic Mini DIY" },
    "header": { "title": "消息", "subtitle": "按刊登分组 — 点击某个刊登即可查看就此联系过你的所有人" },
    "error": { "title": "加载消息失败", "body": "出了点问题，请重试。", "retry": "重试" },
    "search": { "placeholder": "按刊登标题或人员搜索...", "ariaLabel": "搜索会话", "clear": "清除搜索" },
    "tabs": { "active": "进行中", "sold": "已售", "all": "全部" },
    "empty": { "title": "暂无消息", "body": "通过在刊登上联系卖家来开始对话", "browse": "浏览刊登" },
    "emptySearch": { "noMatch": "没有与“{query}”匹配的会话", "noTab": "此标签下没有会话" }
  },
  "ko": {
    "seo": { "title": "메시지 - The Mini Exchange | Classic Mini DIY" },
    "header": { "title": "메시지", "subtitle": "매물별로 그룹화 — 매물을 클릭하면 그 건에 대해 당신에게 메시지를 보낸 모든 사람을 볼 수 있습니다" },
    "error": { "title": "메시지를 불러오지 못했습니다", "body": "문제가 발생했습니다. 다시 시도해 주세요.", "retry": "다시 시도" },
    "search": { "placeholder": "매물 제목 또는 사람으로 검색...", "ariaLabel": "대화 검색", "clear": "검색 지우기" },
    "tabs": { "active": "활성", "sold": "판매됨", "all": "전체" },
    "empty": { "title": "아직 메시지가 없습니다", "body": "매물에서 판매자에게 연락하여 대화를 시작하세요", "browse": "매물 둘러보기" },
    "emptySearch": { "noMatch": "\"{query}\"와 일치하는 대화가 없습니다", "noTab": "이 탭에 대화가 없습니다" }
  }
}
</i18n>
