<script setup lang="ts">
  import type { MeetingSpot } from '~~/server/utils/exchange/meetingSpots';

  const { t } = useI18n();

  interface Props {
    sellerLat: number;
    sellerLon: number;
    conversationId: string;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<{
    (e: 'spotSuggested'): void;
  }>();

  const { location: buyerLocation, loading: locLoading, error: locError, requestBrowserLocation } = useBuyerLocation();
  const { sendMessage } = useMessages();

  interface MeetingSpotsResponse {
    midpoint: { lat: number; lon: number };
    suggestions: MeetingSpot[];
  }

  const spots = ref<MeetingSpotsResponse | null>(null);
  const loading = ref(false);
  const fetchError = ref(false);
  const sendingSpotIndex = ref<number | null>(null);

  async function suggestSpots() {
    if (!buyerLocation.value) return;

    loading.value = true;
    fetchError.value = false;

    try {
      spots.value = await $fetch<MeetingSpotsResponse>('/api/exchange/camino/meeting-spots', {
        method: 'POST',
        body: {
          buyerLat: buyerLocation.value.lat,
          buyerLon: buyerLocation.value.lon,
          sellerLat: props.sellerLat,
          sellerLon: props.sellerLon,
        },
      });
    } catch {
      fetchError.value = true;
    } finally {
      loading.value = false;
    }
  }

  async function sendSpotMessage(spot: MeetingSpot, index: number) {
    sendingSpotIndex.value = index;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lon}`;
    const content = `${t('messagePrefix')}: ${spot.name}${spot.address ? `\n${spot.address}` : ''}\n${mapsUrl}`;

    const success = await sendMessage(props.conversationId, content);
    sendingSpotIndex.value = null;

    if (success) {
      emit('spotSuggested');
    }
  }

  function getMapsUrl(spot: MeetingSpot): string {
    return `https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lon}`;
  }
</script>

<template>
  <div class="space-y-3">
    <!-- Need location first -->
    <div v-if="!buyerLocation && !spots" class="card bg-base-200 shadow-sm">
      <div class="card-body py-4 items-center text-center gap-2">
        <p class="text-sm text-base-content/70">{{ t('shareLocationPrompt') }}</p>
        <button class="btn btn-sm btn-secondary" :disabled="locLoading" @click="requestBrowserLocation">
          <span v-if="locLoading" class="loading loading-spinner loading-xs"></span>
          <i v-else class="fas fa-location-dot"></i>
          {{ t('useMyLocation') }}
        </button>
        <p v-if="locError" class="text-xs text-error">{{ locError }}</p>
      </div>
    </div>

    <!-- Trigger button (location available, spots not yet loaded) -->
    <button
      v-else-if="buyerLocation && !spots && !loading"
      class="btn btn-outline btn-secondary btn-block"
      @click="suggestSpots"
    >
      <i class="fas fa-location-dot"></i>
      {{ t('suggestMeetingSpot') }}
    </button>

    <!-- Loading -->
    <div v-if="loading" class="card bg-base-200">
      <div class="card-body py-4">
        <div class="flex items-center gap-2">
          <span class="loading loading-spinner loading-sm text-secondary"></span>
          <span class="text-sm text-base-content/70">{{ t('finding') }}</span>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="fetchError" class="alert alert-warning text-sm">
      <i class="fas fa-triangle-exclamation"></i>
      <span>{{ t('fetchError') }}</span>
    </div>

    <!-- Results -->
    <div v-if="spots && spots.suggestions.length > 0" class="card bg-base-200 shadow-sm">
      <div class="card-body gap-3">
        <h3 class="card-title text-base">
          <i class="fas fa-hand text-secondary"></i>
          {{ t('suggestedTitle') }}
        </h3>
        <p class="text-xs text-base-content/60">
          {{ t('suggestedSubtitle') }}
        </p>

        <div v-for="(spot, i) in spots.suggestions" :key="i" class="flex items-start gap-3 p-3 bg-base-100 rounded-lg">
          <div class="badge badge-secondary badge-sm mt-1">{{ i + 1 }}</div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-sm">{{ spot.name }}</p>
            <p v-if="spot.address" class="text-xs text-base-content/60 truncate">
              {{ spot.address }}
            </p>
            <p v-if="spot.buyerDriveTime || spot.sellerDriveTime" class="text-xs text-base-content/70 mt-1">
              <i class="fas fa-clock inline"></i>
              <template v-if="spot.buyerDriveTime">{{ t('fromYou', { time: spot.buyerDriveTime }) }}</template>
              <template v-if="spot.buyerDriveTime && spot.sellerDriveTime"> · </template>
              <template v-if="spot.sellerDriveTime">{{ t('fromSeller', { time: spot.sellerDriveTime }) }}</template>
            </p>
          </div>
          <div class="flex flex-col gap-1 shrink-0">
            <a
              :href="getMapsUrl(spot)"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-xs btn-ghost"
              :title="t('openInMaps')"
            >
              <i class="fas fa-arrow-up-right-from-square"></i>
            </a>
            <button
              class="btn btn-xs btn-secondary"
              :disabled="sendingSpotIndex === i"
              :title="t('sendInConversation')"
              @click="sendSpotMessage(spot, i)"
            >
              <span v-if="sendingSpotIndex === i" class="loading loading-spinner loading-xs"></span>
              <i v-else class="fas fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- No results -->
    <div v-if="spots && spots.suggestions.length === 0" class="alert alert-info text-sm">
      <i class="fas fa-circle-info"></i>
      <span>{{ t('noResults') }}</span>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "shareLocationPrompt": "Share your location to find a safe meeting spot",
    "useMyLocation": "Use My Location",
    "suggestMeetingSpot": "Suggest Meeting Spot",
    "finding": "Finding safe meeting spots...",
    "fetchError": "Could not find meeting spots. Try again later.",
    "suggestedTitle": "Suggested Meeting Spots",
    "suggestedSubtitle": "Safe, public locations roughly halfway between you and the seller. Your exact address is never shared.",
    "fromYou": "{time} from you",
    "fromSeller": "{time} from seller",
    "openInMaps": "Open in Maps",
    "sendInConversation": "Send this spot in the conversation",
    "noResults": "No meeting spots found in this area. You may be too far apart for a halfway meeting point.",
    "messagePrefix": "Suggested meeting spot"
  },
  "es": {
    "shareLocationPrompt": "Comparte tu ubicación para encontrar un punto de encuentro seguro",
    "useMyLocation": "Usar mi ubicación",
    "suggestMeetingSpot": "Sugerir punto de encuentro",
    "finding": "Buscando puntos de encuentro seguros...",
    "fetchError": "No se pudieron encontrar puntos de encuentro. Inténtalo más tarde.",
    "suggestedTitle": "Puntos de encuentro sugeridos",
    "suggestedSubtitle": "Lugares públicos y seguros aproximadamente a medio camino entre tú y el vendedor. Tu dirección exacta nunca se comparte.",
    "fromYou": "{time} desde tu ubicación",
    "fromSeller": "{time} desde el vendedor",
    "openInMaps": "Abrir en Maps",
    "sendInConversation": "Enviar este punto en la conversación",
    "noResults": "No se encontraron puntos de encuentro en esta zona. Puede que estéis demasiado lejos para un punto a medio camino.",
    "messagePrefix": "Punto de encuentro sugerido"
  },
  "fr": {
    "shareLocationPrompt": "Partagez votre position pour trouver un lieu de rendez-vous sûr",
    "useMyLocation": "Utiliser ma position",
    "suggestMeetingSpot": "Suggérer un lieu de rendez-vous",
    "finding": "Recherche de lieux de rendez-vous sûrs...",
    "fetchError": "Impossible de trouver des lieux de rendez-vous. Réessayez plus tard.",
    "suggestedTitle": "Lieux de rendez-vous suggérés",
    "suggestedSubtitle": "Lieux publics et sûrs à peu près à mi-chemin entre vous et le vendeur. Votre adresse exacte n'est jamais partagée.",
    "fromYou": "{time} depuis chez vous",
    "fromSeller": "{time} depuis le vendeur",
    "openInMaps": "Ouvrir dans Maps",
    "sendInConversation": "Envoyer ce lieu dans la conversation",
    "noResults": "Aucun lieu de rendez-vous trouvé dans cette zone. Vous êtes peut-être trop éloignés pour un point à mi-chemin.",
    "messagePrefix": "Lieu de rendez-vous suggéré"
  },
  "de": {
    "shareLocationPrompt": "Teile deinen Standort, um einen sicheren Treffpunkt zu finden",
    "useMyLocation": "Meinen Standort verwenden",
    "suggestMeetingSpot": "Treffpunkt vorschlagen",
    "finding": "Sichere Treffpunkte werden gesucht...",
    "fetchError": "Es konnten keine Treffpunkte gefunden werden. Bitte später erneut versuchen.",
    "suggestedTitle": "Vorgeschlagene Treffpunkte",
    "suggestedSubtitle": "Sichere, öffentliche Orte ungefähr auf halbem Weg zwischen dir und dem Verkäufer. Deine genaue Adresse wird nie geteilt.",
    "fromYou": "{time} von dir",
    "fromSeller": "{time} vom Verkäufer",
    "openInMaps": "In Maps öffnen",
    "sendInConversation": "Diesen Treffpunkt in der Unterhaltung senden",
    "noResults": "In diesem Gebiet wurden keine Treffpunkte gefunden. Ihr seid möglicherweise zu weit voneinander entfernt für einen Treffpunkt auf halbem Weg.",
    "messagePrefix": "Vorgeschlagener Treffpunkt"
  },
  "it": {
    "shareLocationPrompt": "Condividi la tua posizione per trovare un punto d'incontro sicuro",
    "useMyLocation": "Usa la mia posizione",
    "suggestMeetingSpot": "Suggerisci punto d'incontro",
    "finding": "Ricerca di punti d'incontro sicuri...",
    "fetchError": "Impossibile trovare punti d'incontro. Riprova più tardi.",
    "suggestedTitle": "Punti d'incontro suggeriti",
    "suggestedSubtitle": "Luoghi pubblici e sicuri all'incirca a metà strada tra te e il venditore. Il tuo indirizzo esatto non viene mai condiviso.",
    "fromYou": "{time} da te",
    "fromSeller": "{time} dal venditore",
    "openInMaps": "Apri in Maps",
    "sendInConversation": "Invia questo punto nella conversazione",
    "noResults": "Nessun punto d'incontro trovato in questa zona. Potreste essere troppo distanti per un punto a metà strada.",
    "messagePrefix": "Punto d'incontro suggerito"
  },
  "pt": {
    "shareLocationPrompt": "Compartilhe sua localização para encontrar um ponto de encontro seguro",
    "useMyLocation": "Usar minha localização",
    "suggestMeetingSpot": "Sugerir ponto de encontro",
    "finding": "Procurando pontos de encontro seguros...",
    "fetchError": "Não foi possível encontrar pontos de encontro. Tente novamente mais tarde.",
    "suggestedTitle": "Pontos de encontro sugeridos",
    "suggestedSubtitle": "Locais públicos e seguros aproximadamente a meio caminho entre você e o vendedor. Seu endereço exato nunca é compartilhado.",
    "fromYou": "{time} de você",
    "fromSeller": "{time} do vendedor",
    "openInMaps": "Abrir no Maps",
    "sendInConversation": "Enviar este ponto na conversa",
    "noResults": "Nenhum ponto de encontro encontrado nesta área. Vocês podem estar distantes demais para um ponto a meio caminho.",
    "messagePrefix": "Ponto de encontro sugerido"
  },
  "ru": {
    "shareLocationPrompt": "Поделитесь своим местоположением, чтобы найти безопасное место встречи",
    "useMyLocation": "Использовать моё местоположение",
    "suggestMeetingSpot": "Предложить место встречи",
    "finding": "Поиск безопасных мест встречи...",
    "fetchError": "Не удалось найти места встречи. Повторите попытку позже.",
    "suggestedTitle": "Предлагаемые места встречи",
    "suggestedSubtitle": "Безопасные общественные места примерно на полпути между вами и продавцом. Ваш точный адрес никогда не передаётся.",
    "fromYou": "{time} от вас",
    "fromSeller": "{time} от продавца",
    "openInMaps": "Открыть в Maps",
    "sendInConversation": "Отправить это место в переписке",
    "noResults": "В этом районе места встречи не найдены. Возможно, вы слишком далеко друг от друга для точки на полпути.",
    "messagePrefix": "Предлагаемое место встречи"
  },
  "ja": {
    "shareLocationPrompt": "安全な待ち合わせ場所を探すために位置情報を共有してください",
    "useMyLocation": "現在地を使用",
    "suggestMeetingSpot": "待ち合わせ場所を提案",
    "finding": "安全な待ち合わせ場所を検索中...",
    "fetchError": "待ち合わせ場所が見つかりませんでした。後でもう一度お試しください。",
    "suggestedTitle": "おすすめの待ち合わせ場所",
    "suggestedSubtitle": "あなたと出品者のほぼ中間にある安全で公共の場所です。正確な住所が共有されることはありません。",
    "fromYou": "あなたから{time}",
    "fromSeller": "出品者から{time}",
    "openInMaps": "Mapsで開く",
    "sendInConversation": "この場所を会話で送信",
    "noResults": "このエリアでは待ち合わせ場所が見つかりませんでした。中間地点を取るには距離が離れすぎている可能性があります。",
    "messagePrefix": "おすすめの待ち合わせ場所"
  },
  "zh": {
    "shareLocationPrompt": "共享您的位置以寻找安全的见面地点",
    "useMyLocation": "使用我的位置",
    "suggestMeetingSpot": "建议见面地点",
    "finding": "正在查找安全的见面地点...",
    "fetchError": "未能找到见面地点。请稍后再试。",
    "suggestedTitle": "建议的见面地点",
    "suggestedSubtitle": "位于您和卖家之间大约中点的安全公共场所。您的确切地址绝不会被共享。",
    "fromYou": "距您 {time}",
    "fromSeller": "距卖家 {time}",
    "openInMaps": "在 Maps 中打开",
    "sendInConversation": "在对话中发送此地点",
    "noResults": "此区域未找到见面地点。你们之间的距离可能太远，无法找到中间见面点。",
    "messagePrefix": "建议的见面地点"
  },
  "ko": {
    "shareLocationPrompt": "안전한 만남 장소를 찾으려면 위치를 공유하세요",
    "useMyLocation": "내 위치 사용",
    "suggestMeetingSpot": "만남 장소 제안",
    "finding": "안전한 만남 장소를 찾는 중...",
    "fetchError": "만남 장소를 찾을 수 없습니다. 나중에 다시 시도하세요.",
    "suggestedTitle": "추천 만남 장소",
    "suggestedSubtitle": "당신과 판매자 사이 대략 중간 지점에 있는 안전한 공공장소입니다. 정확한 주소는 절대 공유되지 않습니다.",
    "fromYou": "내 위치에서 {time}",
    "fromSeller": "판매자 위치에서 {time}",
    "openInMaps": "Maps에서 열기",
    "sendInConversation": "이 장소를 대화에 보내기",
    "noResults": "이 지역에서 만남 장소를 찾지 못했습니다. 중간 지점을 잡기에는 거리가 너무 멀 수 있습니다.",
    "messagePrefix": "추천 만남 장소"
  }
}
</i18n>
