<script lang="ts" setup>
  import type { MapboxSuggestion } from '~/composables/useMapbox';

  const props = defineProps<{
    modelValue: string;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: string];
  }>();

  const { searchSuggestions, extractLocationData, reverseGeocode, getCurrentLocation } = useMapbox();
  const toast = useToast();
  const { t } = useI18n();

  const searchQuery = ref('');
  const suggestions = ref<MapboxSuggestion[]>([]);
  const showSuggestions = ref(false);
  const isSearching = ref(false);
  const isGettingLocation = ref(false);

  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  let blurTimeout: ReturnType<typeof setTimeout> | null = null;

  const performSearch = async () => {
    if (searchQuery.value.length < 2) {
      suggestions.value = [];
      return;
    }

    isSearching.value = true;
    try {
      suggestions.value = await searchSuggestions(searchQuery.value, {
        types: ['place', 'locality', 'postcode', 'region'],
        countries: ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'JP', 'NZ'],
        limit: 6,
      });
    } catch {
      suggestions.value = [];
    } finally {
      isSearching.value = false;
    }
  };

  const onInput = () => {
    if (searchTimeout) clearTimeout(searchTimeout);

    if (searchQuery.value.length < 2) {
      suggestions.value = [];
      return;
    }

    searchTimeout = setTimeout(performSearch, 300);
  };

  const onFocus = () => {
    showSuggestions.value = true;
    if (searchQuery.value.length >= 2) {
      performSearch();
    }
  };

  const onBlur = () => {
    blurTimeout = setTimeout(() => {
      showSuggestions.value = false;
    }, 200);
  };

  /**
   * Format location as "City, State, Country" to match TME's format.
   * Never saves the full address — only city-level granularity.
   */
  function formatLocation(loc: { city: string; state_province: string; country: string }): string {
    return [loc.city, loc.state_province, loc.country].filter(Boolean).join(', ');
  }

  const selectSuggestion = (suggestion: MapboxSuggestion) => {
    const locationData = extractLocationData(suggestion);
    const short = formatLocation(locationData);
    searchQuery.value = short;
    emit('update:modelValue', short);
    suggestions.value = [];
    showSuggestions.value = false;
  };

  const useCurrentLocation = async () => {
    isGettingLocation.value = true;

    try {
      const coords = await getCurrentLocation();

      if (!coords) {
        toast.add({
          title: t('toast.denied_title'),
          description: t('toast.denied_description'),
          color: 'warning',
          icon: 'i-fa6-solid-location-crosshairs',
        });
        return;
      }

      const locationData = await reverseGeocode(coords.longitude, coords.latitude);

      if (!locationData) {
        toast.add({
          title: t('toast.not_found_title'),
          description: t('toast.not_found_description'),
          color: 'error',
          icon: 'i-fa6-solid-circle-xmark',
        });
        return;
      }

      const short = formatLocation(locationData);
      searchQuery.value = short;
      emit('update:modelValue', short);
    } catch {
      toast.add({
        title: t('toast.error_title'),
        description: t('toast.error_description'),
        color: 'error',
        icon: 'i-fa6-solid-circle-xmark',
      });
    } finally {
      isGettingLocation.value = false;
    }
  };

  // Dropdown positioning — teleported to body to escape card overflow-hidden
  const inputWrapper = ref<HTMLElement | null>(null);
  const dropdownStyle = ref<Record<string, string>>({});

  function updateDropdownPosition() {
    if (!inputWrapper.value) return;
    const rect = inputWrapper.value.getBoundingClientRect();
    dropdownStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      zIndex: '9999',
    };
  }

  watch(showSuggestions, (val) => {
    if (val) updateDropdownPosition();
  });

  // Initialize from modelValue
  watch(
    () => props.modelValue,
    (val) => {
      if (val && searchQuery.value !== val) {
        searchQuery.value = val;
      }
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    if (searchTimeout) clearTimeout(searchTimeout);
    if (blurTimeout) clearTimeout(blurTimeout);
  });
</script>

<template>
  <div class="space-y-2">
    <div ref="inputWrapper">
      <UInput
        v-model="searchQuery"
        type="text"
        :placeholder="t('placeholder')"
        class="w-full"
        icon="i-fa6-solid-location-dot"
        :loading="isSearching"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
      />
    </div>

    <!-- Teleport dropdown to body so it escapes card overflow-hidden -->
    <Teleport to="body">
      <!-- Suggestions dropdown -->
      <div
        v-if="showSuggestions && suggestions.length > 0"
        :style="dropdownStyle"
        class="bg-default rounded-lg shadow-lg border border-default overflow-hidden"
      >
        <button
          v-for="suggestion in suggestions"
          :key="suggestion.id"
          type="button"
          class="w-full px-3 py-2.5 text-left hover:bg-muted flex items-start gap-2 transition-colors cursor-pointer"
          @mousedown.prevent="selectSuggestion(suggestion)"
        >
          <i class="fas fa-location-dot mt-0.5 opacity-40 shrink-0"></i>
          <div class="min-w-0">
            <div class="font-medium text-sm truncate">{{ suggestion.text }}</div>
            <div class="text-xs opacity-60 truncate">{{ suggestion.place_name }}</div>
          </div>
        </button>
      </div>

      <!-- No results -->
      <div
        v-if="showSuggestions && searchQuery.length >= 2 && suggestions.length === 0 && !isSearching"
        :style="dropdownStyle"
        class="p-3 bg-default rounded-lg shadow-lg border border-default"
      >
        <p class="text-sm opacity-60">{{ t('no_results') }}</p>
      </div>
    </Teleport>

    <!-- Use current location button -->
    <UButton
      variant="ghost"
      color="neutral"
      size="xs"
      :loading="isGettingLocation"
      @click="useCurrentLocation"
    >
      <i class="fas fa-location-crosshairs mr-1"></i>
      {{ isGettingLocation ? t('getting_location') : t('use_current') }}
    </UButton>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "placeholder": "Start typing a city, state, or postal code...",
    "no_results": "No locations found. Try a different search.",
    "getting_location": "Getting location...",
    "use_current": "Use my current location",
    "toast": {
      "denied_title": "Location Access Denied",
      "denied_description": "Please enable location access in your browser settings.",
      "not_found_title": "Location Not Found",
      "not_found_description": "Could not determine your location. Please type it manually.",
      "error_title": "Location Error",
      "error_description": "Failed to get your current location."
    }
  },
  "de": {
    "placeholder": "Stadt, Bundesland oder Postleitzahl eingeben...",
    "no_results": "Keine Orte gefunden. Versuche eine andere Suche.",
    "getting_location": "Standort wird ermittelt...",
    "use_current": "Meinen aktuellen Standort verwenden",
    "toast": {
      "denied_title": "Standortzugriff verweigert",
      "denied_description": "Bitte aktiviere den Standortzugriff in deinen Browsereinstellungen.",
      "not_found_title": "Standort nicht gefunden",
      "not_found_description": "Dein Standort konnte nicht ermittelt werden. Bitte tippe ihn manuell ein.",
      "error_title": "Standortfehler",
      "error_description": "Dein aktueller Standort konnte nicht abgerufen werden."
    }
  },
  "es": {
    "placeholder": "Empieza a escribir una ciudad, estado o código postal...",
    "no_results": "No se encontraron ubicaciones. Prueba con otra búsqueda.",
    "getting_location": "Obteniendo ubicación...",
    "use_current": "Usar mi ubicación actual",
    "toast": {
      "denied_title": "Acceso a ubicación denegado",
      "denied_description": "Por favor, habilita el acceso a la ubicación en la configuración de tu navegador.",
      "not_found_title": "Ubicación no encontrada",
      "not_found_description": "No se pudo determinar tu ubicación. Por favor, escríbela manualmente.",
      "error_title": "Error de ubicación",
      "error_description": "No se pudo obtener tu ubicación actual."
    }
  },
  "fr": {
    "placeholder": "Commencez à saisir une ville, un état ou un code postal...",
    "no_results": "Aucun lieu trouvé. Essayez une autre recherche.",
    "getting_location": "Récupération de la position...",
    "use_current": "Utiliser ma position actuelle",
    "toast": {
      "denied_title": "Accès à la position refusé",
      "denied_description": "Veuillez activer l'accès à la position dans les paramètres de votre navigateur.",
      "not_found_title": "Position introuvable",
      "not_found_description": "Impossible de déterminer votre position. Veuillez la saisir manuellement.",
      "error_title": "Erreur de position",
      "error_description": "Impossible de récupérer votre position actuelle."
    }
  },
  "it": {
    "placeholder": "Inizia a digitare una città, stato o codice postale...",
    "no_results": "Nessun luogo trovato. Prova una ricerca diversa.",
    "getting_location": "Recupero posizione in corso...",
    "use_current": "Usa la mia posizione attuale",
    "toast": {
      "denied_title": "Accesso alla posizione negato",
      "denied_description": "Abilita l'accesso alla posizione nelle impostazioni del browser.",
      "not_found_title": "Posizione non trovata",
      "not_found_description": "Impossibile determinare la tua posizione. Inseriscila manualmente.",
      "error_title": "Errore di posizione",
      "error_description": "Impossibile ottenere la tua posizione attuale."
    }
  },
  "pt": {
    "placeholder": "Comece a digitar uma cidade, estado ou código postal...",
    "no_results": "Nenhum local encontrado. Tente uma pesquisa diferente.",
    "getting_location": "Obtendo localização...",
    "use_current": "Usar minha localização atual",
    "toast": {
      "denied_title": "Acesso à localização negado",
      "denied_description": "Por favor, ative o acesso à localização nas configurações do seu navegador.",
      "not_found_title": "Localização não encontrada",
      "not_found_description": "Não foi possível determinar sua localização. Por favor, digite-a manualmente.",
      "error_title": "Erro de localização",
      "error_description": "Falha ao obter sua localização atual."
    }
  },
  "ru": {
    "placeholder": "Начните вводить город, регион или почтовый индекс...",
    "no_results": "Места не найдены. Попробуйте другой запрос.",
    "getting_location": "Определение местоположения...",
    "use_current": "Использовать моё текущее местоположение",
    "toast": {
      "denied_title": "Доступ к местоположению запрещён",
      "denied_description": "Пожалуйста, включите доступ к местоположению в настройках браузера.",
      "not_found_title": "Местоположение не найдено",
      "not_found_description": "Не удалось определить ваше местоположение. Пожалуйста, введите его вручную.",
      "error_title": "Ошибка местоположения",
      "error_description": "Не удалось получить ваше текущее местоположение."
    }
  },
  "ja": {
    "placeholder": "市区町村、都道府県、または郵便番号を入力してください...",
    "no_results": "該当する場所が見つかりません。別のキーワードで検索してください。",
    "getting_location": "位置情報を取得中...",
    "use_current": "現在地を使用する",
    "toast": {
      "denied_title": "位置情報へのアクセスが拒否されました",
      "denied_description": "ブラウザの設定で位置情報へのアクセスを有効にしてください。",
      "not_found_title": "位置情報が見つかりません",
      "not_found_description": "現在地を特定できませんでした。手動で入力してください。",
      "error_title": "位置情報エラー",
      "error_description": "現在地の取得に失敗しました。"
    }
  },
  "zh": {
    "placeholder": "开始输入城市、州/省或邮政编码...",
    "no_results": "未找到相关地点。请尝试其他搜索词。",
    "getting_location": "正在获取位置...",
    "use_current": "使用我的当前位置",
    "toast": {
      "denied_title": "位置访问被拒绝",
      "denied_description": "请在浏览器设置中启用位置访问权限。",
      "not_found_title": "未找到位置",
      "not_found_description": "无法确定您的位置。请手动输入。",
      "error_title": "位置错误",
      "error_description": "获取当前位置失败。"
    }
  },
  "ko": {
    "placeholder": "도시, 주 또는 우편번호를 입력하세요...",
    "no_results": "위치를 찾을 수 없습니다. 다른 검색어를 시도해 보세요.",
    "getting_location": "위치 가져오는 중...",
    "use_current": "현재 위치 사용",
    "toast": {
      "denied_title": "위치 접근이 거부되었습니다",
      "denied_description": "브라우저 설정에서 위치 접근을 허용해 주세요.",
      "not_found_title": "위치를 찾을 수 없습니다",
      "not_found_description": "위치를 확인할 수 없습니다. 직접 입력해 주세요.",
      "error_title": "위치 오류",
      "error_description": "현재 위치를 가져오지 못했습니다."
    }
  }
}
</i18n>
