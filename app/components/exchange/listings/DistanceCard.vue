<script setup lang="ts">
  import type { CurrencyCode } from '~/composables/useCurrency';

  // Local copy of the camino distance endpoint's response shape. The endpoint
  // itself (/api/exchange/camino/distance) is ported in Stage 8; defining the
  // type here decouples this component from the not-yet-ported server route so
  // it builds now. Keep in sync with server/api/exchange/camino/distance.post.ts.
  interface DistanceResponse {
    distance_km: number;
    distance_miles: number;
    driving_time: string;
    duration_seconds: number;
    direction: string;
    description: string;
  }

  const { t } = useI18n();

  interface Props {
    listingLat: number;
    listingLon: number;
    listingCity: string;
  }

  const props = defineProps<Props>();

  const { location, loading: locLoading, error: locError, requestBrowserLocation } = useBuyerLocation();
  const { userProfile } = useAuth();
  const { convertCurrency, formatCurrency, fetchExchangeRates } = useCurrency();

  const distanceData = ref<DistanceResponse | null>(null);
  const distanceLoading = ref(false);
  const distanceError = ref(false);

  const AVG_MPG = 25;
  const AVG_FUEL_PRICE = 3.2;

  // Fetch exchange rates on mount for currency conversion
  onMounted(() => {
    fetchExchangeRates();
  });

  // Fetch distance when buyer location becomes available
  watch(
    () => location.value,
    async (loc) => {
      if (!loc) return;

      distanceLoading.value = true;
      distanceError.value = false;

      try {
        distanceData.value = await $fetch<DistanceResponse>('/api/exchange/camino/distance', {
          method: 'POST',
          body: {
            buyerLat: loc.lat,
            buyerLon: loc.lon,
            listingLat: props.listingLat,
            listingLon: props.listingLon,
          },
        });
      } catch {
        distanceError.value = true;
      } finally {
        distanceLoading.value = false;
      }
    },
    { immediate: true }
  );

  // Calculate fuel cost in USD
  const fuelCostUSD = computed(() => {
    if (!distanceData.value?.distance_miles) return null;
    const roundTripMiles = distanceData.value.distance_miles * 2;
    return Math.round((roundTripMiles / AVG_MPG) * AVG_FUEL_PRICE);
  });

  // Format fuel cost in user's preferred currency
  const formattedFuelCost = computed(() => {
    if (!fuelCostUSD.value) return null;

    const preferredCurrency = (userProfile.value?.preferred_currency || 'USD') as CurrencyCode;

    if (preferredCurrency === 'USD') {
      return formatCurrency(fuelCostUSD.value, 'USD');
    }

    const converted = convertCurrency(fuelCostUSD.value, 'USD', preferredCurrency);
    if (converted === null) {
      // Fallback to USD if conversion fails
      return formatCurrency(fuelCostUSD.value, 'USD');
    }

    return formatCurrency(converted, preferredCurrency);
  });

  const mapsUrl = computed(() => {
    if (!location.value) return '';
    return `https://www.google.com/maps/dir/${location.value.lat},${location.value.lon}/${props.listingLat},${props.listingLon}`;
  });
</script>

<template>
  <!-- No location yet — prompt -->
  <div v-if="!location" class="card bg-base-200 shadow-sm">
    <div class="card-body items-center text-center py-4 gap-2">
      <p class="text-sm text-base-content/70">{{ t('prompt') }}</p>
      <button class="btn btn-sm btn-primary" :disabled="locLoading" @click="requestBrowserLocation">
        <span v-if="locLoading" class="loading loading-spinner loading-xs"></span>
        <i v-else class="fas fa-location-dot"></i>
        {{ t('useMyLocation') }}
      </button>
      <p v-if="locError" class="text-xs text-error">{{ locError }}</p>
    </div>
  </div>

  <!-- Loading distance -->
  <div v-else-if="distanceLoading" class="card bg-base-200">
    <div class="card-body py-4">
      <div class="flex items-center gap-2">
        <span class="loading loading-spinner loading-sm text-primary"></span>
        <span class="text-sm text-base-content/70">{{ t('calculating') }}</span>
      </div>
    </div>
  </div>

  <!-- Error state -->
  <div v-else-if="distanceError" class="card bg-base-200 shadow-sm">
    <div class="card-body py-4">
      <p class="text-sm text-base-content/60">{{ t('error') }}</p>
    </div>
  </div>

  <!-- Distance result -->
  <div v-else-if="distanceData" class="card bg-base-200 shadow-sm">
    <div class="card-body py-4 gap-3">
      <!-- Header row with title and route button -->
      <div class="flex items-center justify-between">
        <p class="text-xs font-medium uppercase tracking-wide text-base-content/50">
          {{ t('distanceFrom', { city: location.city || t('you') }) }}
        </p>
        <a :href="mapsUrl" target="_blank" rel="noopener" class="btn btn-xs btn-ghost text-primary gap-1">
          {{ t('viewRoute') }}
          <i class="fas fa-arrow-up-right-from-square"></i>
        </a>
      </div>

      <!-- Primary stat: distance -->
      <div class="flex items-baseline gap-2">
        <span class="text-3xl font-bold">{{ Math.round(distanceData.distance_miles) }}</span>
        <span class="text-base-content/70">{{ t('milesTo', { city: listingCity }) }}</span>
      </div>

      <!-- Secondary stats row -->
      <div class="flex gap-4 text-sm text-base-content/60">
        <div v-if="distanceData.driving_time" class="flex items-center gap-1.5">
          <i class="fas fa-clock"></i>
          <span>{{ distanceData.driving_time }}</span>
        </div>
        <div v-if="formattedFuelCost" class="flex items-center gap-1.5">
          <i class="fas fa-fire"></i>
          <span>{{ t('fuelEstimate', { cost: formattedFuelCost }) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": { "prompt": "See how far this Mini is from you", "useMyLocation": "Use My Location", "calculating": "Calculating distance...", "error": "Could not calculate distance.", "distanceFrom": "Distance from {city}", "you": "you", "viewRoute": "View Route", "milesTo": "miles to {city}", "fuelEstimate": "~{cost} fuel" },
  "es": { "prompt": "Mira a qué distancia está este Mini de ti", "useMyLocation": "Usar mi ubicación", "calculating": "Calculando distancia...", "error": "No se pudo calcular la distancia.", "distanceFrom": "Distancia desde {city}", "you": "ti", "viewRoute": "Ver ruta", "milesTo": "millas hasta {city}", "fuelEstimate": "~{cost} de combustible" },
  "fr": { "prompt": "Voyez à quelle distance se trouve cette Mini", "useMyLocation": "Utiliser ma position", "calculating": "Calcul de la distance...", "error": "Impossible de calculer la distance.", "distanceFrom": "Distance depuis {city}", "you": "vous", "viewRoute": "Voir l'itinéraire", "milesTo": "miles jusqu'à {city}", "fuelEstimate": "~{cost} de carburant" },
  "de": { "prompt": "Sehen Sie, wie weit dieser Mini von Ihnen entfernt ist", "useMyLocation": "Meinen Standort verwenden", "calculating": "Entfernung wird berechnet...", "error": "Entfernung konnte nicht berechnet werden.", "distanceFrom": "Entfernung von {city}", "you": "Ihnen", "viewRoute": "Route ansehen", "milesTo": "Meilen bis {city}", "fuelEstimate": "~{cost} Kraftstoff" },
  "it": { "prompt": "Scopri quanto dista questa Mini da te", "useMyLocation": "Usa la mia posizione", "calculating": "Calcolo della distanza...", "error": "Impossibile calcolare la distanza.", "distanceFrom": "Distanza da {city}", "you": "te", "viewRoute": "Vedi percorso", "milesTo": "miglia fino a {city}", "fuelEstimate": "~{cost} di carburante" },
  "pt": { "prompt": "Veja a que distância esta Mini está de você", "useMyLocation": "Usar minha localização", "calculating": "Calculando distância...", "error": "Não foi possível calcular a distância.", "distanceFrom": "Distância de {city}", "you": "você", "viewRoute": "Ver rota", "milesTo": "milhas até {city}", "fuelEstimate": "~{cost} de combustível" },
  "ru": { "prompt": "Узнайте, как далеко этот Mini от вас", "useMyLocation": "Использовать мое местоположение", "calculating": "Расчет расстояния...", "error": "Не удалось рассчитать расстояние.", "distanceFrom": "Расстояние от {city}", "you": "вас", "viewRoute": "Посмотреть маршрут", "milesTo": "миль до {city}", "fuelEstimate": "~{cost} на топливо" },
  "ja": { "prompt": "このMiniがあなたからどれだけ離れているか確認", "useMyLocation": "現在地を使用", "calculating": "距離を計算中...", "error": "距離を計算できませんでした。", "distanceFrom": "{city}からの距離", "you": "あなた", "viewRoute": "ルートを表示", "milesTo": "マイル先：{city}", "fuelEstimate": "燃料 約{cost}" },
  "zh": { "prompt": "查看这辆 Mini 离您有多远", "useMyLocation": "使用我的位置", "calculating": "正在计算距离...", "error": "无法计算距离。", "distanceFrom": "距离 {city}", "you": "您", "viewRoute": "查看路线", "milesTo": "英里到 {city}", "fuelEstimate": "约 {cost} 燃油" },
  "ko": { "prompt": "이 Mini가 당신에게서 얼마나 떨어져 있는지 확인하세요", "useMyLocation": "내 위치 사용", "calculating": "거리 계산 중...", "error": "거리를 계산할 수 없습니다.", "distanceFrom": "{city}에서의 거리", "you": "당신", "viewRoute": "경로 보기", "milesTo": "마일 거리: {city}", "fuelEstimate": "~{cost} 연료" }
}
</i18n>
