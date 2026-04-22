<script lang="ts" setup>
  import { chartOptions, type Needle, type NeedleResponse } from '../../../data/models/needles';
  import {
    NEEDLE_BANDS,
    bandLabel,
    buildDiffSeriesData,
    findRelativeNeedles,
    type NeedleBand,
    type NeedleDirection,
    type RankedNeedle,
  } from '../../composables/useNeedleCompare';

  const { t } = useI18n();

  // Dark mode support
  const colorMode = useColorMode();
  const isDark = computed(() => colorMode.isDark.value);

  // Dark mode chart colors
  const darkModeChartOptions = {
    chart: {
      backgroundColor: '#171717',
    },
    title: {
      style: { color: '#e5e5e5' },
    },
    subtitle: {
      style: { color: '#a3a3a3' },
    },
    xAxis: {
      labels: { style: { color: '#a3a3a3' } },
      title: { style: { color: '#e5e5e5' } },
      gridLineColor: '#404040',
      lineColor: '#404040',
      tickColor: '#404040',
    },
    yAxis: {
      labels: { style: { color: '#a3a3a3' } },
      title: { style: { color: '#e5e5e5' } },
      gridLineColor: '#404040',
      lineColor: '#404040',
      tickColor: '#404040',
    },
    legend: {
      itemStyle: { color: '#e5e5e5' },
      itemHoverStyle: { color: '#ffffff' },
    },
    tooltip: {
      backgroundColor: '#262626',
      style: { color: '#e5e5e5' },
    },
  };

  // Light mode chart colors
  const lightModeChartOptions = {
    chart: {
      backgroundColor: '#ffffff',
    },
    title: {
      style: { color: '#171717' },
    },
    subtitle: {
      style: { color: '#525252' },
    },
    xAxis: {
      labels: { style: { color: '#525252' } },
      title: { style: { color: '#171717' } },
      gridLineColor: '#e5e5e5',
      lineColor: '#d4d4d4',
      tickColor: '#d4d4d4',
    },
    yAxis: {
      labels: { style: { color: '#525252' } },
      title: { style: { color: '#171717' } },
      gridLineColor: '#e5e5e5',
      lineColor: '#d4d4d4',
      tickColor: '#d4d4d4',
    },
    legend: {
      itemStyle: { color: '#171717' },
      itemHoverStyle: { color: '#000000' },
    },
    tooltip: {
      backgroundColor: '#ffffff',
      style: { color: '#171717' },
    },
  };

  // Fetch needles data
  const { data: needles, pending }: any = await useFetch(() => '/api/needles/list');

  // Merge chart options with color mode options
  const getChartOptionsForMode = () => {
    const modeOptions = isDark.value ? darkModeChartOptions : lightModeChartOptions;
    return {
      ...chartOptions,
      chart: { ...chartOptions.chart, ...modeOptions.chart },
      title: { ...chartOptions.title, ...modeOptions.title },
      subtitle: { ...chartOptions.subtitle, ...modeOptions.subtitle },
      xAxis: { ...chartOptions.xAxis, ...modeOptions.xAxis },
      yAxis: { ...chartOptions.yAxis, ...modeOptions.yAxis },
      legend: { ...chartOptions.legend, ...modeOptions.legend },
      tooltip: { ...chartOptions.tooltip, ...modeOptions.tooltip },
    };
  };

  // Reactive chart options
  const reactiveChartOptions = ref(getChartOptionsForMode());
  const selectedNeedles = ref<Needle[]>(needles?.value?.initial ? [...needles.value.initial] : []);
  const alreadyExistsError = ref(false);

  // Modal and UI state
  const showDiagramModal = ref(false);

  // ---------------------------------------------------------------------------
  // Relative search + diff overlay state
  // ---------------------------------------------------------------------------
  // The user picks a "reference" needle from the currently selected set. The
  // diff overlay shades every other selected needle against this reference,
  // and the relative-search panel uses it as the pivot for richer/leaner
  // queries. See docs/needle-relative-search.md for the full algorithm.
  const referenceNeedleName = ref<string | null>(null);
  const showDiff = ref(false);
  const relativeBand = ref<NeedleBand | 'any'>('low');
  const relativeDirection = ref<NeedleDirection>('richer');
  const relativeSameSize = ref(true);
  const relativeIsolate = ref(true);

  // Keep reference selection valid as the selected-needle list shrinks/grows.
  watchEffect(() => {
    if (!selectedNeedles.value.length) {
      referenceNeedleName.value = null;
      return;
    }
    const stillPresent = selectedNeedles.value.some((n) => n.name === referenceNeedleName.value);
    if (!stillPresent) {
      referenceNeedleName.value = selectedNeedles.value[0]!.name;
    }
  });

  const referenceNeedle = computed<Needle | null>(() => {
    if (!referenceNeedleName.value) return null;
    return selectedNeedles.value.find((n) => n.name === referenceNeedleName.value) ?? null;
  });

  const relativeResults = computed<RankedNeedle[]>(() => {
    const ref = referenceNeedle.value;
    const pool = needles.value?.all;
    if (!ref || !pool || !pool.length) return [];
    return findRelativeNeedles(ref, pool, {
      band: relativeBand.value,
      direction: relativeDirection.value,
      sameSizeOnly: relativeSameSize.value,
      isolateBand: relativeIsolate.value,
      limit: 8,
    });
  });

  function formatPct(value: number | null): string {
    if (value === null || Number.isNaN(value)) return '—';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  }

  function richnessClass(value: number | null): string {
    if (value === null) return 'opacity-50';
    if (value > 0.01) return 'text-success font-semibold';
    if (value < -0.01) return 'text-error font-semibold';
    return 'opacity-70';
  }

  // Custom autocomplete state
  const searchQuery = ref('');
  const isDropdownOpen = ref(false);
  const displayLimit = ref(50);
  const dropdownRef = ref<HTMLElement | null>(null);
  const inputContainerRef = ref<HTMLElement | null>(null);
  const dropdownPosition = ref({ top: 0, left: 0, width: 0 });

  // Compute dropdown position based on input location
  const updateDropdownPosition = () => {
    if (inputContainerRef.value) {
      const rect = inputContainerRef.value.getBoundingClientRect();
      dropdownPosition.value = {
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      };
    }
  };

  // Style for the teleported dropdown
  const dropdownStyle = computed(() => ({
    top: `${dropdownPosition.value.top}px`,
    left: `${dropdownPosition.value.left}px`,
    width: `${dropdownPosition.value.width}px`,
    zIndex: 9999,
  }));

  // Update position when dropdown opens
  watch(isDropdownOpen, (open) => {
    if (open) {
      updateDropdownPosition();
    }
  });

  // Create a lookup map for fast needle retrieval
  const needleLookup = computed(() => {
    if (!needles.value?.all) return new Map<string, Needle>();
    return new Map(needles.value.all.map((needle: Needle) => [needle.name, needle]));
  });

  // Pre-compute needle names with lowercase versions for fast filtering
  const needleSearchData = computed(() => {
    if (!needles.value?.all) return [];
    return needles.value.all.map((needle: Needle) => ({
      name: needle.name,
      lower: needle.name.toLowerCase(),
    }));
  });

  // Filtered results - search entire dataset
  const filteredResults = computed(() => {
    const query = searchQuery.value.toLowerCase().trim();
    const data = needleSearchData.value;

    if (!query) {
      return data.map((d) => d.name);
    }

    const results: string[] = [];
    for (const item of data) {
      if (item.lower.includes(query)) {
        results.push(item.name);
      }
    }
    return results;
  });

  // Lazy-loaded display items - only show up to displayLimit
  const displayedItems = computed(() => {
    return filteredResults.value.slice(0, displayLimit.value);
  });

  // Check if there are more items to load
  const hasMoreItems = computed(() => {
    return filteredResults.value.length > displayLimit.value;
  });

  // Load more items when scrolling near bottom
  const loadMoreItems = () => {
    if (hasMoreItems.value) {
      displayLimit.value += 50;
    }
  };

  // Handle scroll in dropdown
  const onDropdownScroll = (event: Event) => {
    const target = event.target as HTMLElement;
    const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (scrollBottom < 100) {
      loadMoreItems();
    }
  };

  // Reset display limit when search changes
  watch(searchQuery, () => {
    displayLimit.value = 50;
  });

  const { capture } = usePostHog();

  // Select a needle from dropdown
  const selectNeedle = (name: string, source: 'search' | 'relative_search' = 'search') => {
    const needle = needleLookup.value.get(name);
    if (!needle) return;

    if (selectedNeedles.value.some((n) => n.name === name)) {
      alreadyExistsError.value = true;
      window.setTimeout(() => (alreadyExistsError.value = false), 5000);
      return;
    }

    selectedNeedles.value.push(needle);
    searchQuery.value = '';
    isDropdownOpen.value = false;
    displayLimit.value = 50;
    updateArrayItem();

    capture('calculator_used', {
      calculator: 'needles',
      needle_count: selectedNeedles.value.length,
      needles: selectedNeedles.value.map((n) => n.name),
      source,
    });
  };

  // Toggle a needle in/out of the chart from the relative-search result list.
  // Add-icon → present, minus-icon → present & will be removed.
  function toggleNeedleInChart(name: string) {
    const existing = selectedNeedles.value.find((n) => n.name === name);
    if (existing) {
      removeArrayItem(existing);
      return;
    }
    selectNeedle(name, 'relative_search');
  }

  function trackRelativeSearch() {
    capture('relative_needle_search', {
      reference: referenceNeedleName.value,
      band: relativeBand.value,
      direction: relativeDirection.value,
      same_size_only: relativeSameSize.value,
      isolate_band: relativeIsolate.value,
      result_count: relativeResults.value.length,
    });
  }

  // Fire one tracking event per unique (reference, band, direction) combo the
  // user settles on so we capture real queries but avoid spamming analytics
  // while they're still tweaking the form.
  let relativeSearchDebounce: ReturnType<typeof setTimeout> | null = null;
  watch([referenceNeedleName, relativeBand, relativeDirection, relativeSameSize, relativeIsolate], () => {
    if (!referenceNeedleName.value) return;
    if (relativeSearchDebounce) clearTimeout(relativeSearchDebounce);
    relativeSearchDebounce = setTimeout(trackRelativeSearch, 800);
  });

  // Close dropdown when clicking outside
  const onClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    // Check if click is inside input container or dropdown
    const isInsideInput = inputContainerRef.value?.contains(target);
    const isInsideDropdown = dropdownRef.value?.contains(target);
    if (!isInsideInput && !isInsideDropdown) {
      isDropdownOpen.value = false;
    }
  };

  // Update position on scroll/resize
  const onScrollOrResize = () => {
    if (isDropdownOpen.value) {
      updateDropdownPosition();
    }
  };

  onMounted(() => {
    document.addEventListener('click', onClickOutside);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
  });

  onUnmounted(() => {
    document.removeEventListener('click', onClickOutside);
    window.removeEventListener('scroll', onScrollOrResize, true);
    window.removeEventListener('resize', onScrollOrResize);
  });

  // Watch for color mode changes
  watch(isDark, () => {
    updateArrayItem();
  });

  // ---------------------------------------------------------------------------
  // Chart series construction
  // ---------------------------------------------------------------------------
  // When diff-overlay is enabled we build two `arearange` series per
  // non-reference needle — one filled green (candidate richer than reference)
  // and one filled red (candidate leaner). The reference line is also thickened
  // so it reads as the baseline curve in the chart.
  function buildSeries(): any[] {
    const refName = referenceNeedleName.value;
    const diffEnabled = showDiff.value && selectedNeedles.value.length >= 2 && referenceNeedle.value !== null;

    const lineSeries = selectedNeedles.value.map((needle) => ({
      ...needle,
      type: 'spline',
      lineWidth: diffEnabled && needle.name === refName ? 3 : 2,
      dashStyle: diffEnabled && needle.name === refName ? 'ShortDash' : 'Solid',
      zIndex: diffEnabled && needle.name === refName ? 5 : 4,
    }));

    if (!diffEnabled) return lineSeries;

    const reference = referenceNeedle.value!;
    const diffSeries: any[] = [];
    for (const candidate of selectedNeedles.value) {
      if (candidate.name === reference.name) continue;
      const { richer, leaner } = buildDiffSeriesData(reference, candidate);
      diffSeries.push(
        {
          type: 'arearange',
          name: `${candidate.name} richer vs ${reference.name}`,
          data: richer,
          color: 'rgba(74, 222, 128, 0.35)',
          lineWidth: 0,
          fillOpacity: 0.35,
          enableMouseTracking: false,
          showInLegend: false,
          zIndex: 1,
          marker: { enabled: false },
        },
        {
          type: 'arearange',
          name: `${candidate.name} leaner vs ${reference.name}`,
          data: leaner,
          color: 'rgba(248, 113, 113, 0.35)',
          lineWidth: 0,
          fillOpacity: 0.35,
          enableMouseTracking: false,
          showInLegend: false,
          zIndex: 1,
          marker: { enabled: false },
        }
      );
    }
    return [...diffSeries, ...lineSeries];
  }

  function updateArrayItem() {
    const newOptions = getChartOptionsForMode();
    reactiveChartOptions.value = {
      ...newOptions,
      series: buildSeries(),
    };
  }

  // Rebuild series whenever reference selection or diff toggle changes.
  watch([referenceNeedleName, showDiff], () => updateArrayItem());

  function removeArrayItem(currentItem: Needle) {
    // Find the index of the item you want to remove
    const itemIndex = selectedNeedles.value.indexOf(currentItem);
    // Remove the specific needle value which automatically triggers a redraw
    selectedNeedles.value.splice(itemIndex, 1);
    updateArrayItem();
  }

  // Watch for changes in needles data and update selectedNeedles
  watch(needles, (newNeedles) => {
    selectedNeedles.value = newNeedles?.initial ? [...newNeedles.initial] : [];
    updateArrayItem();
  });
</script>

<template>
  <div class="grid grid-cols-12 gap-3 configurator-component">
    <div class="col-span-12 md:col-span-6">
      <div class="card bg-base-100 shadow-md border border-base-300 h-full">
        <div class="card-body">
          <h3 class="fancy-font-bold text-xl pb-3">{{ t('title') }}</h3>
          <p class="pb-3">
            {{ t('description') }}
          </p>
          <!-- Modal dialog for diagram -->
          <div>
            <button class="btn btn-sm btn-neutral mb-5" @click="showDiagramModal = true">
              {{ t('diagram_button') }}
            </button>
            <div class="modal" :class="{ 'modal-open': showDiagramModal }">
              <div class="modal-box max-w-3xl">
                <h3 class="font-bold text-lg">{{ t('diagram_modal.title') }}</h3>
                <img
                  loading="lazy"
                  class="diagram mx-auto"
                  src="https://classicminidiy.s3.us-east-1.amazonaws.com/misc/diagram.jpg"
                  :alt="t('diagram_modal.alt_text')"
                />
                <div class="modal-action">
                  <button class="btn btn-primary" @click="showDiagramModal = false">
                    {{ t('diagram_modal.close_button') }}
                  </button>
                </div>
              </div>
              <div class="modal-backdrop" @click="showDiagramModal = false"></div>
            </div>
          </div>

          <template v-if="pending">
            <!-- Loading state -->
            <div class="skeleton h-32 w-full"></div>
          </template>
          <template v-else-if="needles && selectedNeedles">
            <!-- Custom needle autocomplete -->
            <div class="needle-autocomplete relative" ref="inputContainerRef">
              <input
                v-model="searchQuery"
                type="text"
                class="input input-bordered w-full"
                :placeholder="t('form.select_placeholder')"
                :aria-label="t('form.select_placeholder')"
                autocomplete="off"
                role="combobox"
                :aria-expanded="isDropdownOpen"
                aria-controls="needle-listbox"
                aria-autocomplete="list"
                @focus="isDropdownOpen = true"
                @input="isDropdownOpen = true"
              />

              <!-- Dropdown results - teleported to body to avoid overflow clipping -->
              <Teleport to="body">
                <div
                  v-if="isDropdownOpen && filteredResults.length > 0"
                  ref="dropdownRef"
                  id="needle-listbox"
                  role="listbox"
                  class="fixed bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-64 overflow-y-auto"
                  :style="dropdownStyle"
                  @scroll="onDropdownScroll"
                >
                  <button
                    v-for="name in displayedItems"
                    :key="name"
                    type="button"
                    role="option"
                    class="w-full px-3 py-2 text-left hover:bg-base-200 text-sm transition-colors"
                    :class="{
                      'opacity-50': selectedNeedles.some((n) => n.name === name),
                    }"
                    @click="selectNeedle(name)"
                  >
                    {{ name }}
                    <span v-if="selectedNeedles.some((n) => n.name === name)" class="text-xs ml-2">(added)</span>
                  </button>

                  <!-- Load more indicator -->
                  <div v-if="hasMoreItems" class="px-3 py-2 text-center text-xs opacity-60">
                    Scroll for more ({{ filteredResults.length - displayLimit }} remaining)
                  </div>
                </div>

                <!-- No results -->
                <div
                  v-if="isDropdownOpen && searchQuery && filteredResults.length === 0"
                  class="fixed bg-base-100 border border-base-300 rounded-lg shadow-lg px-3 py-2 text-sm opacity-70"
                  :style="dropdownStyle"
                >
                  No needles found
                </div>
              </Teleport>
            </div>

            <!-- Alerts -->
            <div v-if="alreadyExistsError" role="alert" class="alert alert-info mt-4">
              <i class="fas fa-circle-info"></i>
              <span>{{ t('alerts.already_exists') }}</span>
            </div>

            <div class="divider my-4"></div>

            <h3 class="text-lg font-medium">{{ t('selected_needles_title') }}</h3>
            <p class="text-xs opacity-60 mt-1">{{ t('reference_hint') }}</p>
            <ul v-if="selectedNeedles.length" class="mt-3 space-y-1">
              <li
                v-for="(needle, index) in selectedNeedles"
                :key="needle.name"
                class="flex items-center gap-2 px-2 py-1 rounded border border-base-300 bg-base-200/40"
              >
                <input
                  type="radio"
                  name="reference-needle"
                  class="radio radio-xs radio-primary"
                  :value="needle.name"
                  v-model="referenceNeedleName"
                  :aria-label="t('reference_aria', { name: needle.name })"
                />
                <span class="flex-1 text-sm">
                  {{ needle.name }}
                  <span v-if="needle.name === referenceNeedleName" class="badge badge-xs badge-primary ml-1">
                    {{ t('reference_badge') }}
                  </span>
                </span>
                <button
                  v-if="selectedNeedles.length > 1"
                  type="button"
                  class="btn btn-ghost btn-xs"
                  @click="removeArrayItem(selectedNeedles[index] as Needle)"
                  :aria-label="t('remove_aria', { name: needle.name })"
                >
                  <i class="fas fa-times text-xs"></i>
                </button>
              </li>
            </ul>

            <div class="divider my-3"></div>

            <label class="label cursor-pointer justify-start gap-3 py-1">
              <input type="checkbox" class="toggle toggle-sm toggle-primary" v-model="showDiff" />
              <span class="label-text">{{ t('diff.toggle_label') }}</span>
            </label>
            <p v-if="showDiff" class="text-xs opacity-60 mt-1">
              <span class="inline-block w-2 h-2 rounded-sm bg-success mr-1 align-middle"></span>
              {{ t('diff.legend_richer') }}
              <span class="inline-block w-2 h-2 rounded-sm bg-error ml-3 mr-1 align-middle"></span>
              {{ t('diff.legend_leaner') }}
            </p>
          </template>
        </div>
      </div>

    </div>

    <!-- Relative Search (top-right column on desktop) -->
    <div class="col-span-12 md:col-span-6">
      <div
        v-if="selectedNeedles.length && !pending"
        class="card bg-base-100 shadow-md border border-base-300 h-full"
      >
        <div class="card-body">
          <h3 class="fancy-font-bold text-lg">{{ t('relative.title') }}</h3>
          <p class="text-sm opacity-70">{{ t('relative.description') }}</p>

          <div class="form-control w-full mt-3">
            <label class="label py-1"><span class="label-text text-sm">{{ t('relative.band_label') }}</span></label>
            <select v-model="relativeBand" class="select select-bordered select-sm">
              <option value="low">{{ t('relative.band_low') }}</option>
              <option value="mid">{{ t('relative.band_mid') }}</option>
              <option value="high">{{ t('relative.band_high') }}</option>
              <option value="any">{{ t('relative.band_any') }}</option>
            </select>
          </div>

          <div class="form-control w-full mt-2">
            <label class="label py-1"><span class="label-text text-sm">{{ t('relative.direction_label') }}</span></label>
            <div class="join w-full">
              <button
                type="button"
                class="btn btn-sm join-item flex-1"
                :class="relativeDirection === 'richer' ? 'btn-success' : 'btn-outline'"
                @click="relativeDirection = 'richer'"
              >
                {{ t('relative.direction_richer') }}
              </button>
              <button
                type="button"
                class="btn btn-sm join-item flex-1"
                :class="relativeDirection === 'similar' ? 'btn-neutral' : 'btn-outline'"
                @click="relativeDirection = 'similar'"
              >
                {{ t('relative.direction_similar') }}
              </button>
              <button
                type="button"
                class="btn btn-sm join-item flex-1"
                :class="relativeDirection === 'leaner' ? 'btn-error' : 'btn-outline'"
                @click="relativeDirection = 'leaner'"
              >
                {{ t('relative.direction_leaner') }}
              </button>
            </div>
          </div>

          <div class="flex flex-wrap gap-4 mt-3">
            <label class="label cursor-pointer gap-2 py-0">
              <input type="checkbox" class="checkbox checkbox-xs" v-model="relativeSameSize" />
              <span class="label-text text-xs">{{ t('relative.same_size') }}</span>
            </label>
            <label
              v-if="relativeBand !== 'any' && relativeDirection !== 'similar'"
              class="label cursor-pointer gap-2 py-0"
            >
              <input type="checkbox" class="checkbox checkbox-xs" v-model="relativeIsolate" />
              <span class="label-text text-xs">{{ t('relative.isolate_band') }}</span>
            </label>
          </div>

          <div class="divider my-2"></div>

          <p v-if="!referenceNeedle" class="text-sm opacity-70">{{ t('relative.needs_reference') }}</p>
          <p v-else-if="relativeResults.length === 0" class="text-sm opacity-70">
            {{ t('relative.no_results') }}
          </p>
          <ul v-else class="space-y-2 max-h-80 overflow-y-auto pr-1">
            <li
              v-for="result in relativeResults"
              :key="result.candidate.name"
              class="flex items-start gap-2 p-2 rounded border border-base-300 bg-base-200/40"
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-sm">{{ result.candidate.name }}</span>
                  <span class="text-xs opacity-50">{{ result.candidate.size }}</span>
                </div>
                <div class="text-xs mt-1 grid grid-cols-3 gap-1">
                  <span :class="richnessClass(result.bands.low.richnessPct)">
                    {{ t('relative.cell_low') }} {{ formatPct(result.bands.low.richnessPct) }}
                  </span>
                  <span :class="richnessClass(result.bands.mid.richnessPct)">
                    {{ t('relative.cell_mid') }} {{ formatPct(result.bands.mid.richnessPct) }}
                  </span>
                  <span :class="richnessClass(result.bands.high.richnessPct)">
                    {{ t('relative.cell_high') }} {{ formatPct(result.bands.high.richnessPct) }}
                  </span>
                </div>
              </div>
              <button
                type="button"
                class="btn btn-xs btn-square"
                :class="selectedNeedles.some((n) => n.name === result.candidate.name) ? 'btn-error' : 'btn-primary'"
                @click="toggleNeedleInChart(result.candidate.name)"
                :aria-label="
                  selectedNeedles.some((n) => n.name === result.candidate.name)
                    ? t('remove_aria', { name: result.candidate.name })
                    : t('relative.add_aria', { name: result.candidate.name })
                "
              >
                <i
                  :class="
                    selectedNeedles.some((n) => n.name === result.candidate.name)
                      ? 'fas fa-minus text-xs'
                      : 'fas fa-plus text-xs'
                  "
                ></i>
              </button>
            </li>
          </ul>
          <p class="text-xs opacity-50 mt-3">{{ t('relative.caveat') }}</p>
        </div>
      </div>
    </div>
    <div class="col-span-12">
      <div class="card bg-base-100 shadow-md border border-base-300">
        <div class="card-body p-2">
          <ClientOnly fallback-tag="span">
            <highcharts ref="needlesChart" :options="reactiveChartOptions"></highcharts>
            <template #fallback>
              <p class="p-10 text-center text-xl">{{ t('chart.loading') }}</p>
            </template>
          </ClientOnly>
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Add a Needle To Compare",
    "description": "Start typing the name of the needles you would like to compare. Unsure of what the graph values mean? Check out the needle diagram below to learn more.",
    "diagram_button": "Helpful diagram",
    "diagram_modal": {
      "title": "Diagram of Needle Measurements",
      "alt_text": "Diagram of Needle Measurements",
      "close_button": "Close"
    },
    "form": {
      "select_placeholder": "Select a needle",
      "add_button": "Add Needle"
    },
    "alerts": {
      "already_exists": "Needle already exists in your list",
      "empty_selection": "You must select another needle to add before clicking add."
    },
    "selected_needles_title": "Currently selected Needles",
    "reference_hint": "Pick a reference needle to compare the rest against.",
    "reference_aria": "Use {name} as the reference needle",
    "reference_badge": "Reference",
    "remove_aria": "Remove needle {name}",
    "diff": {
      "toggle_label": "Show diff vs reference",
      "legend_richer": "Richer than reference",
      "legend_leaner": "Leaner than reference"
    },
    "relative": {
      "title": "Find Similar Needles",
      "description": "Based on your reference needle, find candidates that are richer, leaner, or similar in a specific range.",
      "band_label": "Range",
      "band_low": "Low (off-idle → ~2500 rpm)",
      "band_mid": "Mid (cruise → ~4000 rpm)",
      "band_high": "High (WOT → redline)",
      "band_any": "Any range (uniform change)",
      "direction_label": "Direction",
      "direction_richer": "Richer",
      "direction_leaner": "Leaner",
      "direction_similar": "Similar",
      "same_size": "Same carb size only",
      "isolate_band": "Isolate to this range only",
      "needs_reference": "Add a needle to the chart first to use as your reference.",
      "no_results": "No needles in the database match these criteria — try widening the search.",
      "cell_low": "Low",
      "cell_mid": "Mid",
      "cell_high": "High",
      "add_aria": "Add {name} to chart",
      "caveat": "Station → RPM mapping is approximate and depends on carb size and spring. Percentages are candidate richness relative to your reference."
    },
    "chart": {
      "loading": "Chart is loading"
    }
  },
  "es": {
    "title": "Agregar una Aguja para Comparar",
    "description": "Comienza escribiendo el nombre de las agujas que te gustaría comparar. ¿No estás seguro de lo que significan los valores del gráfico? Revisa el diagrama de agujas abajo para aprender más.",
    "diagram_button": "Diagrama útil",
    "diagram_modal": {
      "title": "Diagrama de Medidas de Agujas",
      "alt_text": "Diagrama de Medidas de Agujas",
      "close_button": "Cerrar"
    },
    "form": {
      "select_placeholder": "Seleccionar una aguja",
      "add_button": "Agregar Aguja"
    },
    "alerts": {
      "already_exists": "La aguja ya existe en tu lista",
      "empty_selection": "Debes seleccionar otra aguja para agregar antes de hacer clic en agregar."
    },
    "selected_needles_title": "Agujas Actualmente Seleccionadas",
    "reference_hint": "Elige una aguja de referencia para comparar el resto con ella.",
    "reference_aria": "Usar {name} como aguja de referencia",
    "reference_badge": "Referencia",
    "remove_aria": "Eliminar aguja {name}",
    "diff": {
      "toggle_label": "Mostrar diferencia respecto a la referencia",
      "legend_richer": "Más rica que la referencia",
      "legend_leaner": "Más pobre que la referencia"
    },
    "relative": {
      "title": "Encontrar Agujas Similares",
      "description": "Basado en tu aguja de referencia, encuentra candidatas que sean más ricas, más pobres o similares en un rango específico.",
      "band_label": "Rango",
      "band_low": "Bajo (ralentí → ~2500 rpm)",
      "band_mid": "Medio (crucero → ~4000 rpm)",
      "band_high": "Alto (aceleración máxima → línea roja)",
      "band_any": "Cualquier rango (cambio uniforme)",
      "direction_label": "Dirección",
      "direction_richer": "Más rica",
      "direction_leaner": "Más pobre",
      "direction_similar": "Similar",
      "same_size": "Solo el mismo tamaño de carburador",
      "isolate_band": "Aislar solo a este rango",
      "needs_reference": "Añade primero una aguja al gráfico para usarla como referencia.",
      "no_results": "Ninguna aguja en la base de datos coincide con estos criterios — intenta ampliar la búsqueda.",
      "cell_low": "Bajo",
      "cell_mid": "Medio",
      "cell_high": "Alto",
      "add_aria": "Añadir {name} al gráfico",
      "caveat": "La correspondencia estación → RPM es aproximada y depende del tamaño del carburador y el muelle. Los porcentajes son la riqueza del candidato relativa a tu referencia."
    },
    "chart": {
      "loading": "El gráfico está cargando"
    }
  },
  "fr": {
    "title": "Ajouter une aiguille à comparer",
    "description": "Commencez à taper le nom des aiguilles que vous souhaitez comparer. Vous n'êtes pas sûr de ce que signifient les valeurs du graphique ? Consultez le diagramme des aiguilles ci-dessous pour en savoir plus.",
    "diagram_button": "Diagramme utile",
    "diagram_modal": {
      "title": "Diagramme des mesures d'aiguilles",
      "alt_text": "Diagramme des mesures d'aiguilles",
      "close_button": "Fermer"
    },
    "form": {
      "select_placeholder": "Sélectionner une aiguille",
      "add_button": "Ajouter une aiguille"
    },
    "alerts": {
      "already_exists": "L'aiguille existe déjà dans votre liste",
      "empty_selection": "Vous devez sélectionner une autre aiguille à ajouter avant de cliquer sur ajouter."
    },
    "selected_needles_title": "Aiguilles actuellement sélectionnées",
    "reference_hint": "Choisissez une aiguille de référence pour comparer les autres.",
    "reference_aria": "Utiliser {name} comme aiguille de référence",
    "reference_badge": "Référence",
    "remove_aria": "Supprimer l'aiguille {name}",
    "diff": {
      "toggle_label": "Afficher la différence par rapport à la référence",
      "legend_richer": "Plus riche que la référence",
      "legend_leaner": "Plus pauvre que la référence"
    },
    "relative": {
      "title": "Trouver des aiguilles similaires",
      "description": "En fonction de votre aiguille de référence, trouvez des candidates plus riches, plus pauvres ou similaires dans une plage spécifique.",
      "band_label": "Plage",
      "band_low": "Bas (ralenti → ~2500 rpm)",
      "band_mid": "Milieu (croisière → ~4000 rpm)",
      "band_high": "Haut (plein gaz → régime maxi)",
      "band_any": "Toute plage (changement uniforme)",
      "direction_label": "Direction",
      "direction_richer": "Plus riche",
      "direction_leaner": "Plus pauvre",
      "direction_similar": "Similaire",
      "same_size": "Même taille de carburateur uniquement",
      "isolate_band": "Isoler à cette plage uniquement",
      "needs_reference": "Ajoutez d'abord une aiguille au graphique pour l'utiliser comme référence.",
      "no_results": "Aucune aiguille dans la base de données ne correspond à ces critères — essayez d'élargir la recherche.",
      "cell_low": "Bas",
      "cell_mid": "Milieu",
      "cell_high": "Haut",
      "add_aria": "Ajouter {name} au graphique",
      "caveat": "La correspondance station → RPM est approximative et dépend de la taille du carburateur et du ressort. Les pourcentages représentent la richesse du candidat par rapport à votre référence."
    },
    "chart": {
      "loading": "Le graphique se charge"
    }
  },
  "de": {
    "title": "Eine Nadel zum Vergleichen hinzufügen",
    "description": "Beginnen Sie mit der Eingabe des Namens der Nadeln, die Sie vergleichen möchten. Unsicher, was die Diagrammwerte bedeuten? Schauen Sie sich das Nadeldiagramm unten an, um mehr zu erfahren.",
    "diagram_button": "Hilfreiches Diagramm",
    "diagram_modal": {
      "title": "Diagramm der Nadelmessungen",
      "alt_text": "Diagramm der Nadelmessungen",
      "close_button": "Schließen"
    },
    "form": {
      "select_placeholder": "Eine Nadel auswählen",
      "add_button": "Nadel hinzufügen"
    },
    "alerts": {
      "already_exists": "Nadel existiert bereits in Ihrer Liste",
      "empty_selection": "Sie müssen eine andere Nadel auswählen, bevor Sie auf Hinzufügen klicken."
    },
    "selected_needles_title": "Aktuell ausgewählte Nadeln",
    "reference_hint": "Wähle eine Referenznadel, um die anderen damit zu vergleichen.",
    "reference_aria": "{name} als Referenznadel verwenden",
    "reference_badge": "Referenz",
    "remove_aria": "Nadel {name} entfernen",
    "diff": {
      "toggle_label": "Unterschied zur Referenz anzeigen",
      "legend_richer": "Fetter als Referenz",
      "legend_leaner": "Magerer als Referenz"
    },
    "relative": {
      "title": "Ähnliche Nadeln finden",
      "description": "Basierend auf deiner Referenznadel findest du Kandidaten, die in einem bestimmten Bereich fetter, magerer oder ähnlich sind.",
      "band_label": "Bereich",
      "band_low": "Niedrig (Leerlauf → ~2500 rpm)",
      "band_mid": "Mittel (Reisefahrt → ~4000 rpm)",
      "band_high": "Hoch (Vollgas → Drehzahlbegrenzer)",
      "band_any": "Beliebiger Bereich (gleichmäßige Änderung)",
      "direction_label": "Richtung",
      "direction_richer": "Fetter",
      "direction_leaner": "Magerer",
      "direction_similar": "Ähnlich",
      "same_size": "Nur gleiche Vergasergröße",
      "isolate_band": "Nur auf diesen Bereich beschränken",
      "needs_reference": "Füge zuerst eine Nadel zum Diagramm hinzu, um sie als Referenz zu verwenden.",
      "no_results": "Keine Nadeln in der Datenbank entsprechen diesen Kriterien — versuche die Suche zu erweitern.",
      "cell_low": "Niedrig",
      "cell_mid": "Mittel",
      "cell_high": "Hoch",
      "add_aria": "{name} zum Diagramm hinzufügen",
      "caveat": "Die Station-→-RPM-Zuordnung ist näherungsweise und hängt von Vergasergröße und Feder ab. Prozentwerte geben die Gemischfülle des Kandidaten relativ zur Referenz an."
    },
    "chart": {
      "loading": "Diagramm lädt"
    }
  },
  "it": {
    "title": "Aggiungi un ago da confrontare",
    "description": "Inizia digitando il nome degli aghi che vorresti confrontare. Non sei sicuro di cosa significhino i valori del grafico? Guarda il diagramma dell'ago qui sotto per saperne di più.",
    "diagram_button": "Diagramma utile",
    "diagram_modal": {
      "title": "Diagramma delle misure dell'ago",
      "alt_text": "Diagramma delle misure dell'ago",
      "close_button": "Chiudi"
    },
    "form": {
      "select_placeholder": "Seleziona un ago",
      "add_button": "Aggiungi ago"
    },
    "alerts": {
      "already_exists": "L'ago esiste già nella tua lista",
      "empty_selection": "Devi selezionare un altro ago da aggiungere prima di fare clic su aggiungi."
    },
    "selected_needles_title": "Aghi attualmente selezionati",
    "reference_hint": "Scegli un ago di riferimento per confrontare gli altri con esso.",
    "reference_aria": "Usa {name} come ago di riferimento",
    "reference_badge": "Riferimento",
    "remove_aria": "Rimuovi ago {name}",
    "diff": {
      "toggle_label": "Mostra differenza rispetto al riferimento",
      "legend_richer": "Più ricco del riferimento",
      "legend_leaner": "Più magro del riferimento"
    },
    "relative": {
      "title": "Trova aghi simili",
      "description": "In base al tuo ago di riferimento, trova candidati che siano più ricchi, più magri o simili in un intervallo specifico.",
      "band_label": "Intervallo",
      "band_low": "Basso (minimo → ~2500 rpm)",
      "band_mid": "Medio (crociera → ~4000 rpm)",
      "band_high": "Alto (pieno gas → regime massimo)",
      "band_any": "Qualsiasi intervallo (variazione uniforme)",
      "direction_label": "Direzione",
      "direction_richer": "Più ricco",
      "direction_leaner": "Più magro",
      "direction_similar": "Simile",
      "same_size": "Solo stessa misura carburatore",
      "isolate_band": "Isola solo a questo intervallo",
      "needs_reference": "Aggiungi prima un ago al grafico da usare come riferimento.",
      "no_results": "Nessun ago nel database corrisponde a questi criteri — prova ad ampliare la ricerca.",
      "cell_low": "Basso",
      "cell_mid": "Medio",
      "cell_high": "Alto",
      "add_aria": "Aggiungi {name} al grafico",
      "caveat": "La corrispondenza stazione → RPM è approssimativa e dipende dalla misura del carburatore e dalla molla. Le percentuali rappresentano la ricchezza del candidato rispetto al tuo riferimento."
    },
    "chart": {
      "loading": "Il grafico si sta caricando"
    }
  },
  "ja": {
    "title": "比較するニードルを追加",
    "description": "比較したいニードルの名前を入力し始めてください。グラフの値が何を意味するかわからない？詳しく学ぶには下のニードル図を確認してください。",
    "diagram_button": "役立つ図表",
    "diagram_modal": {
      "title": "ニードル測定の図表",
      "alt_text": "ニードル測定の図表",
      "close_button": "閉じる"
    },
    "form": {
      "select_placeholder": "ニードルを選択",
      "add_button": "ニードルを追加"
    },
    "alerts": {
      "already_exists": "ニードルはすでにリストに存在します",
      "empty_selection": "追加をクリックする前に別のニードルを選択する必要があります。"
    },
    "selected_needles_title": "現在選択されているニードル",
    "reference_hint": "基準ニードルを選択して、他のニードルと比較してください。",
    "reference_aria": "{name} を基準ニードルとして使用",
    "reference_badge": "基準",
    "remove_aria": "ニードル {name} を削除",
    "diff": {
      "toggle_label": "基準との差分を表示",
      "legend_richer": "基準より濃い",
      "legend_leaner": "基準より薄い"
    },
    "relative": {
      "title": "類似ニードルを探す",
      "description": "基準ニードルをもとに、特定の回転域で濃い・薄い・近似のニードルを探します。",
      "band_label": "回転域",
      "band_low": "低回転（アイドル → 約2500 rpm）",
      "band_mid": "中回転（クルーズ → 約4000 rpm）",
      "band_high": "高回転（全開 → レブリミット）",
      "band_any": "全回転域（均一変化）",
      "direction_label": "方向",
      "direction_richer": "濃い（リッチ）",
      "direction_leaner": "薄い（リーン）",
      "direction_similar": "近似",
      "same_size": "同じキャブサイズのみ",
      "isolate_band": "この回転域のみに絞る",
      "needs_reference": "まずチャートにニードルを追加して基準として使用してください。",
      "no_results": "この条件に一致するニードルがデータベースにありません — 検索条件を広げてみてください。",
      "cell_low": "低",
      "cell_mid": "中",
      "cell_high": "高",
      "add_aria": "{name} をチャートに追加",
      "caveat": "ステーション → RPM の対応は近似値であり、キャブサイズやスプリングにより異なります。パーセントは基準に対する候補の濃さの比率です。"
    },
    "chart": {
      "loading": "チャートを読み込み中"
    }
  },
  "ko": {
    "title": "비교할 니들 추가",
    "description": "비교하고 싶은 니들의 이름을 입력하기 시작하세요. 그래프 값이 무엇을 의미하는지 확실하지 않다면? 아래 니들 다이어그램을 확인하여 자세히 알아보세요.",
    "diagram_button": "도움이 되는 다이어그램",
    "diagram_modal": {
      "title": "니들 측정 다이어그램",
      "alt_text": "니들 측정 다이어그램",
      "close_button": "닫기"
    },
    "form": {
      "select_placeholder": "니들 선택",
      "add_button": "니들 추가"
    },
    "alerts": {
      "already_exists": "니들이 이미 목록에 있습니다",
      "empty_selection": "추가를 클릭하기 전에 다른 니들을 선택해야 합니다."
    },
    "selected_needles_title": "현재 선택된 니들",
    "reference_hint": "나머지와 비교할 기준 니들을 선택하세요.",
    "reference_aria": "{name}을(를) 기준 니들로 사용",
    "reference_badge": "기준",
    "remove_aria": "니들 {name} 제거",
    "diff": {
      "toggle_label": "기준과의 차이 표시",
      "legend_richer": "기준보다 농후",
      "legend_leaner": "기준보다 희박"
    },
    "relative": {
      "title": "유사 니들 찾기",
      "description": "기준 니들을 바탕으로 특정 영역에서 더 농후하거나, 더 희박하거나, 유사한 니들 후보를 찾습니다.",
      "band_label": "범위",
      "band_low": "저속 (공회전 → ~2500 rpm)",
      "band_mid": "중속 (순항 → ~4000 rpm)",
      "band_high": "고속 (전개 → 레드라인)",
      "band_any": "전체 범위 (균일 변화)",
      "direction_label": "방향",
      "direction_richer": "농후",
      "direction_leaner": "희박",
      "direction_similar": "유사",
      "same_size": "동일 카브 크기만",
      "isolate_band": "이 범위로만 제한",
      "needs_reference": "기준으로 사용할 니들을 먼저 차트에 추가하세요.",
      "no_results": "데이터베이스에 이 조건과 일치하는 니들이 없습니다 — 검색 범위를 넓혀보세요.",
      "cell_low": "저속",
      "cell_mid": "중속",
      "cell_high": "고속",
      "add_aria": "차트에 {name} 추가",
      "caveat": "스테이션 → RPM 매핑은 근사값이며 카브 크기와 스프링에 따라 다릅니다. 백분율은 기준 대비 후보의 농후도를 나타냅니다."
    },
    "chart": {
      "loading": "차트 로딩 중"
    }
  },
  "pt": {
    "title": "Adicionar uma Agulha para Comparar",
    "description": "Comece digitando o nome das agulhas que você gostaria de comparar. Não tem certeza do que os valores do gráfico significam? Confira o diagrama da agulha abaixo para saber mais.",
    "diagram_button": "Diagrama útil",
    "diagram_modal": {
      "title": "Diagrama das Medidas da Agulha",
      "alt_text": "Diagrama das Medidas da Agulha",
      "close_button": "Fechar"
    },
    "form": {
      "select_placeholder": "Selecionar uma agulha",
      "add_button": "Adicionar Agulha"
    },
    "alerts": {
      "already_exists": "A agulha já existe na sua lista",
      "empty_selection": "Você deve selecionar outra agulha para adicionar antes de clicar em adicionar."
    },
    "selected_needles_title": "Agulhas Atualmente Selecionadas",
    "reference_hint": "Escolha uma agulha de referência para comparar as restantes com ela.",
    "reference_aria": "Usar {name} como agulha de referência",
    "reference_badge": "Referência",
    "remove_aria": "Remover agulha {name}",
    "diff": {
      "toggle_label": "Mostrar diferença em relação à referência",
      "legend_richer": "Mais rica que a referência",
      "legend_leaner": "Mais pobre que a referência"
    },
    "relative": {
      "title": "Encontrar Agulhas Semelhantes",
      "description": "Com base na sua agulha de referência, encontre candidatas que sejam mais ricas, mais pobres ou semelhantes numa faixa específica.",
      "band_label": "Faixa",
      "band_low": "Baixa (marcha lenta → ~2500 rpm)",
      "band_mid": "Média (cruzeiro → ~4000 rpm)",
      "band_high": "Alta (aceleração máxima → rotação limite)",
      "band_any": "Qualquer faixa (mudança uniforme)",
      "direction_label": "Direção",
      "direction_richer": "Mais rica",
      "direction_leaner": "Mais pobre",
      "direction_similar": "Semelhante",
      "same_size": "Apenas o mesmo tamanho de carburador",
      "isolate_band": "Isolar apenas a esta faixa",
      "needs_reference": "Adicione primeiro uma agulha ao gráfico para usar como referência.",
      "no_results": "Nenhuma agulha na base de dados corresponde a estes critérios — tente ampliar a pesquisa.",
      "cell_low": "Baixa",
      "cell_mid": "Média",
      "cell_high": "Alta",
      "add_aria": "Adicionar {name} ao gráfico",
      "caveat": "O mapeamento estação → RPM é aproximado e depende do tamanho do carburador e da mola. Os percentuais representam a riqueza do candidato em relação à sua referência."
    },
    "chart": {
      "loading": "O gráfico está carregando"
    }
  },
  "ru": {
    "title": "Добавить иглу для сравнения",
    "description": "Начните вводить название игл, которые вы хотели бы сравнить. Не уверены, что означают значения графика? Посмотрите диаграмму иглы ниже, чтобы узнать больше.",
    "diagram_button": "Полезная диаграмма",
    "diagram_modal": {
      "title": "Диаграмма измерений иглы",
      "alt_text": "Диаграмма измерений иглы",
      "close_button": "Закрыть"
    },
    "form": {
      "select_placeholder": "Выберите иглу",
      "add_button": "Добавить иглу"
    },
    "alerts": {
      "already_exists": "Игла уже существует в вашем списке",
      "empty_selection": "Вы должны выбрать другую иглу для добавления перед нажатием добавить."
    },
    "selected_needles_title": "Текущие выбранные иглы",
    "reference_hint": "Выберите эталонную иглу для сравнения с остальными.",
    "reference_aria": "Использовать {name} как эталонную иглу",
    "reference_badge": "Эталон",
    "remove_aria": "Удалить иглу {name}",
    "diff": {
      "toggle_label": "Показать разницу относительно эталона",
      "legend_richer": "Богаче эталона",
      "legend_leaner": "Беднее эталона"
    },
    "relative": {
      "title": "Найти похожие иглы",
      "description": "На основе эталонной иглы найдите кандидатов, которые богаче, беднее или похожи в определённом диапазоне.",
      "band_label": "Диапазон",
      "band_low": "Низкий (холостой ход → ~2500 об/мин)",
      "band_mid": "Средний (крейсерский → ~4000 об/мин)",
      "band_high": "Высокий (полный газ → ограничитель)",
      "band_any": "Любой диапазон (равномерное изменение)",
      "direction_label": "Направление",
      "direction_richer": "Богаче",
      "direction_leaner": "Беднее",
      "direction_similar": "Похожее",
      "same_size": "Только тот же размер карбюратора",
      "isolate_band": "Ограничить только этим диапазоном",
      "needs_reference": "Сначала добавьте иглу на график для использования в качестве эталона.",
      "no_results": "Иглы в базе данных, соответствующие этим критериям, не найдены — попробуйте расширить поиск.",
      "cell_low": "Низкий",
      "cell_mid": "Средний",
      "cell_high": "Высокий",
      "add_aria": "Добавить {name} на график",
      "caveat": "Соответствие станции → об/мин является приблизительным и зависит от размера карбюратора и пружины. Проценты отражают обогащённость кандидата относительно вашего эталона."
    },
    "chart": {
      "loading": "График загружается"
    }
  },
  "zh": {
    "title": "添加要比较的针",
    "description": "开始输入您想要比较的针的名称。不确定图表值的含义？查看下面的针图表以了解更多信息。",
    "diagram_button": "有用的图表",
    "diagram_modal": {
      "title": "针测量图表",
      "alt_text": "针测量图表",
      "close_button": "关闭"
    },
    "form": {
      "select_placeholder": "选择一个针",
      "add_button": "添加针"
    },
    "alerts": {
      "already_exists": "针已存在于您的列表中",
      "empty_selection": "您必须在点击添加之前选择另一个针来添加。"
    },
    "selected_needles_title": "当前选择的针",
    "reference_hint": "选择一根参考针，以便与其余针进行比较。",
    "reference_aria": "将 {name} 用作参考针",
    "reference_badge": "参考",
    "remove_aria": "移除针 {name}",
    "diff": {
      "toggle_label": "显示与参考的差异",
      "legend_richer": "比参考更浓",
      "legend_leaner": "比参考更稀"
    },
    "relative": {
      "title": "查找相似针",
      "description": "根据您的参考针，在特定范围内查找更浓、更稀或相似的候选针。",
      "band_label": "范围",
      "band_low": "低速（怠速 → ~2500 rpm）",
      "band_mid": "中速（巡航 → ~4000 rpm）",
      "band_high": "高速（全油门 → 转速上限）",
      "band_any": "任意范围（均匀变化）",
      "direction_label": "方向",
      "direction_richer": "更浓",
      "direction_leaner": "更稀",
      "direction_similar": "相似",
      "same_size": "仅限相同化油器尺寸",
      "isolate_band": "仅限此范围",
      "needs_reference": "请先向图表添加一根针作为参考。",
      "no_results": "数据库中没有符合这些条件的针 — 请尝试扩大搜索范围。",
      "cell_low": "低",
      "cell_mid": "中",
      "cell_high": "高",
      "add_aria": "将 {name} 添加到图表",
      "caveat": "站点 → RPM 的映射是近似值，取决于化油器尺寸和弹簧。百分比为候选针相对于参考针的混合浓度。"
    },
    "chart": {
      "loading": "图表加载中"
    }
  }
}
</i18n>

<style lang="scss" scoped>
  .diagram {
    max-height: 600px;
    width: auto;
    margin: auto;
    display: inline-block;
  }
</style>

<style lang="scss">
  .highcharts-credits {
    display: none !important;
  }
</style>
