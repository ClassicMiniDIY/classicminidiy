<template>
  <!-- Compact variant: single line for listing cards -->
  <div v-if="compact" class="text-xs text-base-content/60">
    <template v-if="loading">
      <span class="skeleton h-3 w-32 inline-block"></span>
    </template>
    <template v-else-if="stats">
      {{ t('compactSummary', { year: memberSinceYear, count: stats.sold_listings }) }}
    </template>
  </div>

  <!-- Full variant: detailed trust signals for listing sidebar / profile -->
  <div v-else class="bg-base-200 rounded-lg p-4 space-y-3">
    <template v-if="loading">
      <div v-for="i in 4" :key="i" class="flex items-center gap-3">
        <span class="skeleton h-5 w-5 rounded-full shrink-0"></span>
        <span class="skeleton h-4 w-36"></span>
      </div>
    </template>

    <template v-else-if="stats">
      <!-- Sustaining Member badge -->
      <div v-if="stats.is_sustaining_member" class="flex items-center gap-2">
        <i class="fas fa-star text-success shrink-0"></i>
        <span class="text-sm font-medium text-success">{{ t('sustainingMember') }}</span>
      </div>

      <!-- Member Since -->
      <div class="flex items-center gap-2">
        <i class="fas fa-calendar-days text-base-content/50 shrink-0"></i>
        <span class="text-sm text-base-content/70">{{ t('memberSince', { date: memberSinceFormatted }) }}</span>
      </div>

      <!-- Response Time -->
      <div class="flex items-center gap-2">
        <i class="fas fa-clock shrink-0" :class="responseTimeColorClass"></i>
        <span class="text-sm text-base-content/70">{{ responseTimeLabel }}</span>
      </div>

      <!-- Listings Sold -->
      <div class="flex items-center gap-2">
        <i class="fas fa-circle-check text-base-content/50 shrink-0"></i>
        <span class="text-sm text-base-content/70">
          {{ t('salesCompleted', { count: stats.sold_listings }) }}
        </span>
      </div>

      <!-- Active Listings -->
      <div class="flex items-center gap-2">
        <i class="fas fa-tag text-base-content/50 shrink-0"></i>
        <span class="text-sm text-base-content/70">
          {{ t('activeListings', { count: stats.active_listings }) }}
        </span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  interface SellerStats {
    member_since: string;
    total_listings: number;
    active_listings: number;
    sold_listings: number;
    avg_response_time_hours: number | null;
    is_sustaining_member: boolean;
  }

  interface Props {
    sellerId: string;
    compact?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    compact: false,
  });

  const supabase = useSupabase();

  const loading = ref(true);
  const stats = ref<SellerStats | null>(null);

  // Cache by sellerId to avoid refetching
  const cachedSellerId = ref<string | null>(null);

  const fetchStats = async () => {
    if (cachedSellerId.value === props.sellerId && stats.value) {
      return;
    }

    loading.value = true;
    try {
      const { data, error } = await supabase.rpc('get_seller_stats', {
        p_user_id: props.sellerId,
      });

      if (error) throw error;

      // get_seller_stats is a RETURNS TABLE function, so PostgREST hands back a
      // single-row array — unwrap it to the row object.
      stats.value = (Array.isArray(data) ? (data[0] ?? null) : data) as SellerStats | null;
      cachedSellerId.value = props.sellerId;
    } catch (err) {
      console.error('Failed to fetch seller stats:', err);
      stats.value = null;
    } finally {
      loading.value = false;
    }
  };

  // Format "Jan 2024" — use UTC to avoid SSR/client hydration mismatch
  const memberSinceFormatted = computed(() => {
    if (!stats.value?.member_since) return '';
    const date = new Date(stats.value.member_since);
    return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
  });

  // Format just the year for compact mode — use UTC for SSR consistency
  const memberSinceYear = computed(() => {
    if (!stats.value?.member_since) return '';
    return new Date(stats.value.member_since).getUTCFullYear().toString();
  });

  // Response time display
  const responseTimeLabel = computed(() => {
    if (!stats.value || stats.value.avg_response_time_hours === null) {
      return t('newSeller');
    }
    const hours = stats.value.avg_response_time_hours;
    if (hours < 1) return t('respondsUnderHour');
    if (hours < 24) {
      const rounded = Math.round(hours);
      return t('respondsHours', { count: rounded });
    }
    const days = Math.round(hours / 24);
    return t('respondsDays', { count: days });
  });

  // Response time color: green (<4hrs), yellow (4-24hrs), orange (>24hrs)
  const responseTimeColorClass = computed(() => {
    if (!stats.value || stats.value.avg_response_time_hours === null) {
      return 'text-base-content/50';
    }
    const hours = stats.value.avg_response_time_hours;
    if (hours < 4) return 'text-success';
    if (hours <= 24) return 'text-warning';
    return 'text-orange-500';
  });

  // Refetch when sellerId changes
  watch(
    () => props.sellerId,
    () => {
      fetchStats();
    },
    { immediate: true }
  );
</script>

<i18n lang="json">
{
  "en": {
    "compactSummary": "Member since {year} · {count} sold",
    "sustainingMember": "Sustaining Member",
    "memberSince": "Member since {date}",
    "salesCompleted": "{count} sale completed | {count} sales completed",
    "activeListings": "{count} active listing | {count} active listings",
    "newSeller": "New seller",
    "respondsUnderHour": "Responds in < 1 hour",
    "respondsHours": "Responds in ~{count} hour | Responds in ~{count} hours",
    "respondsDays": "Responds in ~{count} day | Responds in ~{count} days"
  },
  "es": {
    "compactSummary": "Miembro desde {year} · {count} vendidos",
    "sustainingMember": "Miembro colaborador",
    "memberSince": "Miembro desde {date}",
    "salesCompleted": "{count} venta completada | {count} ventas completadas",
    "activeListings": "{count} anuncio activo | {count} anuncios activos",
    "newSeller": "Vendedor nuevo",
    "respondsUnderHour": "Responde en < 1 hora",
    "respondsHours": "Responde en ~{count} hora | Responde en ~{count} horas",
    "respondsDays": "Responde en ~{count} día | Responde en ~{count} días"
  },
  "fr": {
    "compactSummary": "Membre depuis {year} · {count} vendus",
    "sustainingMember": "Membre bienfaiteur",
    "memberSince": "Membre depuis {date}",
    "salesCompleted": "{count} vente réalisée | {count} ventes réalisées",
    "activeListings": "{count} annonce active | {count} annonces actives",
    "newSeller": "Nouveau vendeur",
    "respondsUnderHour": "Répond en < 1 heure",
    "respondsHours": "Répond en ~{count} heure | Répond en ~{count} heures",
    "respondsDays": "Répond en ~{count} jour | Répond en ~{count} jours"
  },
  "de": {
    "compactSummary": "Mitglied seit {year} · {count} verkauft",
    "sustainingMember": "Fördermitglied",
    "memberSince": "Mitglied seit {date}",
    "salesCompleted": "{count} Verkauf abgeschlossen | {count} Verkäufe abgeschlossen",
    "activeListings": "{count} aktive Anzeige | {count} aktive Anzeigen",
    "newSeller": "Neuer Verkäufer",
    "respondsUnderHour": "Antwortet in < 1 Stunde",
    "respondsHours": "Antwortet in ~{count} Stunde | Antwortet in ~{count} Stunden",
    "respondsDays": "Antwortet in ~{count} Tag | Antwortet in ~{count} Tagen"
  },
  "it": {
    "compactSummary": "Membro dal {year} · {count} venduti",
    "sustainingMember": "Membro sostenitore",
    "memberSince": "Membro dal {date}",
    "salesCompleted": "{count} vendita completata | {count} vendite completate",
    "activeListings": "{count} annuncio attivo | {count} annunci attivi",
    "newSeller": "Nuovo venditore",
    "respondsUnderHour": "Risponde in < 1 ora",
    "respondsHours": "Risponde in ~{count} ora | Risponde in ~{count} ore",
    "respondsDays": "Risponde in ~{count} giorno | Risponde in ~{count} giorni"
  },
  "pt": {
    "compactSummary": "Membro desde {year} · {count} vendidos",
    "sustainingMember": "Membro mantenedor",
    "memberSince": "Membro desde {date}",
    "salesCompleted": "{count} venda concluída | {count} vendas concluídas",
    "activeListings": "{count} anúncio ativo | {count} anúncios ativos",
    "newSeller": "Vendedor novo",
    "respondsUnderHour": "Responde em < 1 hora",
    "respondsHours": "Responde em ~{count} hora | Responde em ~{count} horas",
    "respondsDays": "Responde em ~{count} dia | Responde em ~{count} dias"
  },
  "ru": {
    "compactSummary": "Участник с {year} · продано: {count}",
    "sustainingMember": "Постоянный участник",
    "memberSince": "Участник с {date}",
    "salesCompleted": "{count} продажа завершена | {count} продаж завершено",
    "activeListings": "{count} активное объявление | {count} активных объявлений",
    "newSeller": "Новый продавец",
    "respondsUnderHour": "Отвечает менее чем за 1 час",
    "respondsHours": "Отвечает примерно за {count} час | Отвечает примерно за {count} часов",
    "respondsDays": "Отвечает примерно за {count} день | Отвечает примерно за {count} дней"
  },
  "ja": {
    "compactSummary": "{year}年から会員 · {count}件販売",
    "sustainingMember": "サステイニングメンバー",
    "memberSince": "{date}から会員",
    "salesCompleted": "{count}件の販売完了",
    "activeListings": "出品中 {count}件",
    "newSeller": "新規出品者",
    "respondsUnderHour": "1時間以内に返信",
    "respondsHours": "約{count}時間で返信",
    "respondsDays": "約{count}日で返信"
  },
  "zh": {
    "compactSummary": "{year}年起的会员 · 已售 {count} 件",
    "sustainingMember": "持续支持会员",
    "memberSince": "{date}起的会员",
    "salesCompleted": "已完成 {count} 笔交易",
    "activeListings": "{count} 个在售刊登",
    "newSeller": "新卖家",
    "respondsUnderHour": "1 小时内回复",
    "respondsHours": "约 {count} 小时内回复",
    "respondsDays": "约 {count} 天内回复"
  },
  "ko": {
    "compactSummary": "{year}년부터 회원 · {count}건 판매",
    "sustainingMember": "서스테이닝 멤버",
    "memberSince": "{date}부터 회원",
    "salesCompleted": "{count}건 판매 완료",
    "activeListings": "활성 매물 {count}건",
    "newSeller": "신규 판매자",
    "respondsUnderHour": "1시간 이내 응답",
    "respondsHours": "약 {count}시간 이내 응답",
    "respondsDays": "약 {count}일 이내 응답"
  }
}
</i18n>
