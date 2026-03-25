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
          title: 'Location Access Denied',
          description: 'Please enable location access in your browser settings.',
          color: 'warning',
          icon: 'i-fa6-solid-location-crosshairs',
        });
        return;
      }

      const locationData = await reverseGeocode(coords.longitude, coords.latitude);

      if (!locationData) {
        toast.add({
          title: 'Location Not Found',
          description: 'Could not determine your location. Please type it manually.',
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
        title: 'Location Error',
        description: 'Failed to get your current location.',
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
        placeholder="Start typing a city, state, or postal code..."
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
        <p class="text-sm opacity-60">No locations found. Try a different search.</p>
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
      {{ isGettingLocation ? 'Getting location...' : 'Use my current location' }}
    </UButton>
  </div>
</template>
