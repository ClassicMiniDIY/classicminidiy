<template>
  <div class="space-y-4">
    <!-- Autocomplete Search Input -->
    <fieldset class="fieldset relative w-full">
      <legend class="fieldset-legend">{{ t('searchLegend') }}</legend>
      <div class="relative">
        <label class="input flex items-center gap-2 w-full validator" :class="{ 'input-error': error }">
          <i class="fas fa-location-dot text-base-content/50"></i>
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('searchPlaceholder')"
            class="grow"
            @input="onSearchInput"
            @focus="onFocus"
            @blur="onBlur"
          />
          <span v-if="isSearching" class="loading loading-spinner loading-xs"></span>
        </label>

        <!-- Suggestions Dropdown -->
        <div
          v-if="showSuggestions && suggestions.length > 0"
          class="absolute z-50 w-full mt-2 menu bg-base-100 rounded-box shadow-lg border border-base-300 max-h-64 overflow-y-auto"
        >
          <li v-for="suggestion in suggestions" :key="suggestion.id">
            <button type="button" class="text-left" @mousedown.prevent="selectSuggestion(suggestion)">
              <i class="fas fa-location-dot"></i>
              <div>
                <div class="font-medium">{{ suggestion.text }}</div>
                <div class="text-xs text-base-content/70">{{ suggestion.place_name }}</div>
              </div>
            </button>
          </li>
        </div>

        <!-- No Results Message -->
        <div
          v-if="showSuggestions && searchQuery.length >= 2 && suggestions.length === 0 && !isSearching"
          class="absolute z-50 w-full mt-2 p-4 bg-base-100 rounded-box shadow-lg border border-base-300"
        >
          <p class="text-sm text-base-content/70">{{ t('noResults') }}</p>
        </div>
      </div>

      <!-- Error Message -->
      <p v-if="error" class="validator-hint text-error">{{ error }}</p>

      <!-- Helper Text and Coordinates Display -->
      <div v-if="modelValue.formatted_address" class="mt-2 space-y-1">
        <p class="text-sm text-base-content/100 pb-2">
          {{ t('helperText') }}
        </p>
        <div v-if="modelValue.latitude && modelValue.longitude" class="text-sm text-secondary">
          {{ t('coordinates', { lat: modelValue.latitude.toFixed(6), lng: modelValue.longitude.toFixed(6) }) }}
        </div>
      </div>
    </fieldset>

    <!-- Use Current Location Button -->
    <button
      type="button"
      class="btn btn-outline btn-sm w-full"
      @click="useCurrentLocation"
      :disabled="isGettingLocation"
    >
      <i class="fas fa-location-dot"></i>
      {{ isGettingLocation ? t('gettingLocation') : t('useMyLocation') }}
    </button>
  </div>
</template>

<script setup lang="ts">
  import type { MapboxSuggestion, GeocodedLocation } from '~/composables/useMapbox';

  const { t } = useI18n();

  interface LocationData {
    city: string;
    state_province: string;
    country: string;
    postal_code: string;
    latitude: number | null;
    longitude: number | null;
    formatted_address: string;
  }

  interface Props {
    modelValue: LocationData;
    error?: string;
  }

  interface Emits {
    (e: 'update:modelValue', value: LocationData): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const { searchSuggestions, extractLocationData, reverseGeocode, getCurrentLocation } = useMapbox();
  const toast = useToast();

  // Search state
  const searchQuery = ref('');
  const suggestions = ref<MapboxSuggestion[]>([]);
  const showSuggestions = ref(false);
  const isSearching = ref(false);
  const isGettingLocation = ref(false);

  // Debounced search
  const searchTimeout = ref<NodeJS.Timeout | null>(null);
  const blurTimeout = ref<NodeJS.Timeout | null>(null);

  const performSearch = async () => {
    if (searchQuery.value.length < 2) {
      suggestions.value = [];
      return;
    }

    isSearching.value = true;
    try {
      suggestions.value = await searchSuggestions(searchQuery.value, {
        types: ['place', 'locality', 'postcode', 'region'],
        countries: ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE'],
        limit: 8,
      });
    } catch (error) {
      console.error('Error searching locations:', error);
      toast.add({
        title: t('searchErrorTitle'),
        description: t('searchErrorDesc'),
        color: 'error',
      });
    } finally {
      isSearching.value = false;
    }
  };

  const onSearchInput = () => {
    if (searchTimeout.value) {
      clearTimeout(searchTimeout.value);
    }

    if (searchQuery.value.length < 2) {
      suggestions.value = [];
      return;
    }

    searchTimeout.value = setTimeout(performSearch, 300);
  };

  const onFocus = () => {
    showSuggestions.value = true;
    // If there's already text, trigger a search to show suggestions
    if (searchQuery.value.length >= 2) {
      performSearch();
    }
  };

  const selectSuggestion = (suggestion: MapboxSuggestion) => {
    const locationData = extractLocationData(suggestion);

    emit('update:modelValue', {
      city: locationData.city,
      state_province: locationData.state_province,
      country: locationData.country,
      postal_code: locationData.postal_code,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      formatted_address: locationData.formatted_address,
    });

    searchQuery.value = locationData.formatted_address;
    suggestions.value = [];
    showSuggestions.value = false;
  };

  const onBlur = () => {
    // Delay to allow click on suggestion
    blurTimeout.value = setTimeout(() => {
      showSuggestions.value = false;
    }, 200);
  };

  const useCurrentLocation = async () => {
    isGettingLocation.value = true;

    try {
      const coords = await getCurrentLocation();

      if (!coords) {
        toast.add({
          title: t('locationDeniedTitle'),
          description: t('locationDeniedDesc'),
          color: 'warning',
        });
        return;
      }

      const locationData = await reverseGeocode(coords.longitude, coords.latitude);

      if (!locationData) {
        toast.add({
          title: t('geocodingErrorTitle'),
          description: t('geocodingErrorDesc'),
          color: 'error',
        });
        return;
      }

      emit('update:modelValue', {
        city: locationData.city,
        state_province: locationData.state_province,
        country: locationData.country,
        postal_code: locationData.postal_code,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        formatted_address: locationData.formatted_address,
      });

      searchQuery.value = locationData.formatted_address;

      toast.add({
        title: t('locationFoundTitle'),
        description: t('locationFoundDesc', { address: locationData.formatted_address }),
        color: 'success',
      });
    } catch (error) {
      console.error('Error getting current location:', error);
      toast.add({
        title: t('locationErrorTitle'),
        description: t('locationErrorDesc'),
        color: 'error',
      });
    } finally {
      isGettingLocation.value = false;
    }
  };

  onBeforeUnmount(() => {
    if (searchTimeout.value) {
      clearTimeout(searchTimeout.value);
    }
    if (blurTimeout.value) {
      clearTimeout(blurTimeout.value);
    }
  });

  // Initialize search query from modelValue
  watch(
    () => props.modelValue,
    (newValue) => {
      if (newValue && newValue.formatted_address && searchQuery.value !== newValue.formatted_address) {
        searchQuery.value = newValue.formatted_address;
      }
    },
    { immediate: true, deep: true }
  );
</script>

<i18n lang="json">
{
  "en": {
    "searchLegend": "Search for a location *",
    "searchPlaceholder": "Start typing city, state, or postal code...",
    "noResults": "No locations found. Try a different search.",
    "helperText": "Just enter your city and state/region - no need for street addresses",
    "coordinates": "Coordinates: {lat}, {lng}",
    "gettingLocation": "Getting location...",
    "useMyLocation": "Use my current location",
    "searchErrorTitle": "Search Error",
    "searchErrorDesc": "Failed to search locations. Please try again.",
    "locationDeniedTitle": "Location Access Denied",
    "locationDeniedDesc": "Please enable location access in your browser settings.",
    "geocodingErrorTitle": "Geocoding Error",
    "geocodingErrorDesc": "Could not determine your location address.",
    "locationFoundTitle": "Location Found",
    "locationFoundDesc": "Using location: {address}",
    "locationErrorTitle": "Location Error",
    "locationErrorDesc": "Failed to get your current location."
  },
  "es": {
    "searchLegend": "Buscar una ubicación *",
    "searchPlaceholder": "Empieza a escribir ciudad, estado o código postal...",
    "noResults": "No se encontraron ubicaciones. Prueba con otra búsqueda.",
    "helperText": "Solo introduce tu ciudad y estado/región: no hace falta la dirección postal",
    "coordinates": "Coordenadas: {lat}, {lng}",
    "gettingLocation": "Obteniendo ubicación...",
    "useMyLocation": "Usar mi ubicación actual",
    "searchErrorTitle": "Error de búsqueda",
    "searchErrorDesc": "No se pudieron buscar ubicaciones. Inténtalo de nuevo.",
    "locationDeniedTitle": "Acceso a la ubicación denegado",
    "locationDeniedDesc": "Habilita el acceso a la ubicación en la configuración de tu navegador.",
    "geocodingErrorTitle": "Error de geocodificación",
    "geocodingErrorDesc": "No se pudo determinar la dirección de tu ubicación.",
    "locationFoundTitle": "Ubicación encontrada",
    "locationFoundDesc": "Usando ubicación: {address}",
    "locationErrorTitle": "Error de ubicación",
    "locationErrorDesc": "No se pudo obtener tu ubicación actual."
  },
  "fr": {
    "searchLegend": "Rechercher un lieu *",
    "searchPlaceholder": "Commencez à taper ville, région ou code postal...",
    "noResults": "Aucun lieu trouvé. Essayez une autre recherche.",
    "helperText": "Indiquez simplement votre ville et région - pas besoin d'adresse postale",
    "coordinates": "Coordonnées : {lat}, {lng}",
    "gettingLocation": "Localisation en cours...",
    "useMyLocation": "Utiliser ma position actuelle",
    "searchErrorTitle": "Erreur de recherche",
    "searchErrorDesc": "Échec de la recherche de lieux. Veuillez réessayer.",
    "locationDeniedTitle": "Accès à la localisation refusé",
    "locationDeniedDesc": "Veuillez autoriser l'accès à la localisation dans les paramètres de votre navigateur.",
    "geocodingErrorTitle": "Erreur de géocodage",
    "geocodingErrorDesc": "Impossible de déterminer l'adresse de votre position.",
    "locationFoundTitle": "Position trouvée",
    "locationFoundDesc": "Position utilisée : {address}",
    "locationErrorTitle": "Erreur de localisation",
    "locationErrorDesc": "Échec de l'obtention de votre position actuelle."
  },
  "de": {
    "searchLegend": "Nach einem Ort suchen *",
    "searchPlaceholder": "Stadt, Bundesland oder Postleitzahl eingeben...",
    "noResults": "Keine Orte gefunden. Versuche eine andere Suche.",
    "helperText": "Gib einfach deine Stadt und dein Bundesland/Region an - keine Straßenadresse nötig",
    "coordinates": "Koordinaten: {lat}, {lng}",
    "gettingLocation": "Standort wird ermittelt...",
    "useMyLocation": "Meinen aktuellen Standort verwenden",
    "searchErrorTitle": "Suchfehler",
    "searchErrorDesc": "Suche nach Orten fehlgeschlagen. Bitte versuche es erneut.",
    "locationDeniedTitle": "Standortzugriff verweigert",
    "locationDeniedDesc": "Bitte aktiviere den Standortzugriff in deinen Browsereinstellungen.",
    "geocodingErrorTitle": "Geokodierungsfehler",
    "geocodingErrorDesc": "Die Adresse deines Standorts konnte nicht ermittelt werden.",
    "locationFoundTitle": "Standort gefunden",
    "locationFoundDesc": "Standort wird verwendet: {address}",
    "locationErrorTitle": "Standortfehler",
    "locationErrorDesc": "Dein aktueller Standort konnte nicht ermittelt werden."
  },
  "it": {
    "searchLegend": "Cerca una località *",
    "searchPlaceholder": "Inizia a digitare città, provincia o codice postale...",
    "noResults": "Nessuna località trovata. Prova con un'altra ricerca.",
    "helperText": "Inserisci solo la tua città e provincia/regione - non serve l'indirizzo",
    "coordinates": "Coordinate: {lat}, {lng}",
    "gettingLocation": "Rilevamento posizione...",
    "useMyLocation": "Usa la mia posizione attuale",
    "searchErrorTitle": "Errore di ricerca",
    "searchErrorDesc": "Ricerca delle località non riuscita. Riprova.",
    "locationDeniedTitle": "Accesso alla posizione negato",
    "locationDeniedDesc": "Abilita l'accesso alla posizione nelle impostazioni del browser.",
    "geocodingErrorTitle": "Errore di geocodifica",
    "geocodingErrorDesc": "Impossibile determinare l'indirizzo della tua posizione.",
    "locationFoundTitle": "Posizione trovata",
    "locationFoundDesc": "Posizione usata: {address}",
    "locationErrorTitle": "Errore di posizione",
    "locationErrorDesc": "Impossibile ottenere la tua posizione attuale."
  },
  "pt": {
    "searchLegend": "Pesquisar uma localização *",
    "searchPlaceholder": "Comece a digitar cidade, estado ou código postal...",
    "noResults": "Nenhuma localização encontrada. Tente outra pesquisa.",
    "helperText": "Basta inserir sua cidade e estado/região - não precisa de endereço",
    "coordinates": "Coordenadas: {lat}, {lng}",
    "gettingLocation": "Obtendo localização...",
    "useMyLocation": "Usar minha localização atual",
    "searchErrorTitle": "Erro de pesquisa",
    "searchErrorDesc": "Falha ao pesquisar localizações. Tente novamente.",
    "locationDeniedTitle": "Acesso à localização negado",
    "locationDeniedDesc": "Ative o acesso à localização nas configurações do navegador.",
    "geocodingErrorTitle": "Erro de geocodificação",
    "geocodingErrorDesc": "Não foi possível determinar o endereço da sua localização.",
    "locationFoundTitle": "Localização encontrada",
    "locationFoundDesc": "Usando localização: {address}",
    "locationErrorTitle": "Erro de localização",
    "locationErrorDesc": "Falha ao obter sua localização atual."
  },
  "ru": {
    "searchLegend": "Поиск местоположения *",
    "searchPlaceholder": "Начните вводить город, регион или почтовый индекс...",
    "noResults": "Местоположения не найдены. Попробуйте другой запрос.",
    "helperText": "Просто укажите город и регион - адрес улицы не нужен",
    "coordinates": "Координаты: {lat}, {lng}",
    "gettingLocation": "Получение местоположения...",
    "useMyLocation": "Использовать моё текущее местоположение",
    "searchErrorTitle": "Ошибка поиска",
    "searchErrorDesc": "Не удалось выполнить поиск местоположений. Попробуйте снова.",
    "locationDeniedTitle": "Доступ к местоположению запрещён",
    "locationDeniedDesc": "Включите доступ к местоположению в настройках браузера.",
    "geocodingErrorTitle": "Ошибка геокодирования",
    "geocodingErrorDesc": "Не удалось определить адрес вашего местоположения.",
    "locationFoundTitle": "Местоположение найдено",
    "locationFoundDesc": "Используется местоположение: {address}",
    "locationErrorTitle": "Ошибка местоположения",
    "locationErrorDesc": "Не удалось получить ваше текущее местоположение."
  },
  "ja": {
    "searchLegend": "場所を検索 *",
    "searchPlaceholder": "市区町村、都道府県、郵便番号を入力...",
    "noResults": "場所が見つかりません。別の検索を試してください。",
    "helperText": "市区町村と都道府県/地域を入力するだけ - 番地は不要です",
    "coordinates": "座標: {lat}, {lng}",
    "gettingLocation": "位置情報を取得中...",
    "useMyLocation": "現在地を使用",
    "searchErrorTitle": "検索エラー",
    "searchErrorDesc": "場所の検索に失敗しました。もう一度お試しください。",
    "locationDeniedTitle": "位置情報へのアクセスが拒否されました",
    "locationDeniedDesc": "ブラウザの設定で位置情報へのアクセスを有効にしてください。",
    "geocodingErrorTitle": "ジオコーディングエラー",
    "geocodingErrorDesc": "位置情報の住所を特定できませんでした。",
    "locationFoundTitle": "位置情報が見つかりました",
    "locationFoundDesc": "使用する位置情報: {address}",
    "locationErrorTitle": "位置情報エラー",
    "locationErrorDesc": "現在地の取得に失敗しました。"
  },
  "zh": {
    "searchLegend": "搜索位置 *",
    "searchPlaceholder": "开始输入城市、省份或邮政编码...",
    "noResults": "未找到位置。请尝试其他搜索。",
    "helperText": "只需输入您的城市和省份/地区 - 无需街道地址",
    "coordinates": "坐标：{lat}, {lng}",
    "gettingLocation": "正在获取位置...",
    "useMyLocation": "使用我的当前位置",
    "searchErrorTitle": "搜索错误",
    "searchErrorDesc": "搜索位置失败。请重试。",
    "locationDeniedTitle": "位置访问被拒绝",
    "locationDeniedDesc": "请在浏览器设置中启用位置访问权限。",
    "geocodingErrorTitle": "地理编码错误",
    "geocodingErrorDesc": "无法确定您的位置地址。",
    "locationFoundTitle": "已找到位置",
    "locationFoundDesc": "使用位置：{address}",
    "locationErrorTitle": "位置错误",
    "locationErrorDesc": "获取您的当前位置失败。"
  },
  "ko": {
    "searchLegend": "위치 검색 *",
    "searchPlaceholder": "도시, 주/도 또는 우편번호를 입력하세요...",
    "noResults": "위치를 찾을 수 없습니다. 다른 검색을 시도하세요.",
    "helperText": "도시와 주/지역만 입력하면 됩니다 - 도로명 주소는 필요 없습니다",
    "coordinates": "좌표: {lat}, {lng}",
    "gettingLocation": "위치 가져오는 중...",
    "useMyLocation": "현재 위치 사용",
    "searchErrorTitle": "검색 오류",
    "searchErrorDesc": "위치 검색에 실패했습니다. 다시 시도하세요.",
    "locationDeniedTitle": "위치 접근 거부됨",
    "locationDeniedDesc": "브라우저 설정에서 위치 접근을 활성화하세요.",
    "geocodingErrorTitle": "지오코딩 오류",
    "geocodingErrorDesc": "위치 주소를 확인할 수 없습니다.",
    "locationFoundTitle": "위치를 찾았습니다",
    "locationFoundDesc": "사용 중인 위치: {address}",
    "locationErrorTitle": "위치 오류",
    "locationErrorDesc": "현재 위치를 가져오는 데 실패했습니다."
  }
}
</i18n>
