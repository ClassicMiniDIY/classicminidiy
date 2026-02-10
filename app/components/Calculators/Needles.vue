<script lang="ts" setup>
  const { t } = useI18n();
  import { chartOptions, type Needle, type NeedleResponse } from '../../../data/models/needles';

  // Dark mode support
  const colorMode = useColorMode();
  const isDark = computed(() => colorMode.value === 'dark');

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
  const selectNeedle = (name: string) => {
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
    });
  };

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
    const newOptions = getChartOptionsForMode();
    reactiveChartOptions.value = {
      ...newOptions,
      series: selectedNeedles.value,
    };
  });

  function updateArrayItem() {
    const newOptions = getChartOptionsForMode();
    reactiveChartOptions.value = {
      ...newOptions,
      series: selectedNeedles.value,
    };
  }

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
    <div class="col-span-12 md:col-span-4">
      <UCard>
        <h3 class="fancy-font-bold text-xl pb-3">{{ t('title') }}</h3>
        <p class="pb-3">
          {{ t('description') }}
        </p>
        <!-- Modal dialog for diagram -->
        <div>
          <UButton size="sm" color="neutral" class="mb-5" @click="showDiagramModal = true">
            {{ t('diagram_button') }}
          </UButton>
          <UModal v-model:open="showDiagramModal">
            <template #content>
              <UCard>
                <template #header>
                  <h3 class="font-bold text-lg">{{ t('diagram_modal.title') }}</h3>
                </template>
                <img
                  loading="lazy"
                  class="diagram mx-auto"
                  src="https://classicminidiy.s3.us-east-1.amazonaws.com/misc/diagram.jpg"
                  :alt="t('diagram_modal.alt_text')"
                />
                <template #footer>
                  <div class="flex justify-end">
                    <UButton color="primary" @click="showDiagramModal = false">
                      {{ t('diagram_modal.close_button') }}
                    </UButton>
                  </div>
                </template>
              </UCard>
            </template>
          </UModal>
        </div>

        <template v-if="pending">
          <!-- Loading state -->
          <USkeleton class="h-32 w-full" />
        </template>
        <template v-else-if="needles && selectedNeedles">
          <!-- Custom needle autocomplete -->
          <div class="needle-autocomplete relative" ref="inputContainerRef">
            <UInput
              v-model="searchQuery"
              :placeholder="t('form.select_placeholder')"
              class="w-full"
              autocomplete="off"
              @focus="isDropdownOpen = true"
              @input="isDropdownOpen = true"
            />

            <!-- Dropdown results - teleported to body to avoid overflow clipping -->
            <Teleport to="body">
              <div
                v-if="isDropdownOpen && filteredResults.length > 0"
                ref="dropdownRef"
                class="fixed bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg max-h-64 overflow-y-auto"
                :style="dropdownStyle"
                @scroll="onDropdownScroll"
              >
                <button
                  v-for="name in displayedItems"
                  :key="name"
                  type="button"
                  class="w-full px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 text-sm transition-colors"
                  :class="{
                    'text-neutral-400 dark:text-neutral-500': selectedNeedles.some((n) => n.name === name),
                  }"
                  @click="selectNeedle(name)"
                >
                  {{ name }}
                  <span v-if="selectedNeedles.some((n) => n.name === name)" class="text-xs ml-2">(added)</span>
                </button>

                <!-- Load more indicator -->
                <div v-if="hasMoreItems" class="px-3 py-2 text-center text-xs text-neutral-500">
                  Scroll for more ({{ filteredResults.length - displayLimit }} remaining)
                </div>
              </div>

              <!-- No results -->
              <div
                v-if="isDropdownOpen && searchQuery && filteredResults.length === 0"
                class="fixed bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg px-3 py-2 text-sm text-neutral-500"
                :style="dropdownStyle"
              >
                No needles found
              </div>
            </Teleport>
          </div>

          <!-- Alerts -->
          <UAlert
            v-if="alreadyExistsError"
            color="info"
            class="mt-4"
            icon="i-fa6-solid-circle-info"
            :title="t('alerts.already_exists')"
          />

          <USeparator class="my-4" />

          <h3 class="text-lg font-medium">{{ t('selected_needles_title') }}</h3>
          <div v-if="selectedNeedles" class="flex flex-wrap gap-2 mt-3">
            <UBadge
              v-for="(needle, index) in selectedNeedles"
              :key="index"
              size="lg"
              :color="selectedNeedles.length === 1 ? 'neutral' : 'primary'"
              class="gap-1"
            >
              <span>{{ needle.name }}</span>
              <button
                v-if="selectedNeedles.length > 1"
                @click="removeArrayItem(selectedNeedles[index] as Needle)"
                class="ml-1 hover:opacity-70"
              >
                <i class="fas fa-times text-xs"></i>
              </button>
            </UBadge>
          </div>
        </template>
      </UCard>
    </div>
    <div class="col-span-12 md:col-span-8">
      <UCard class="p-2">
        <ClientOnly fallback-tag="span">
          <highcharts ref="needlesChart" :options="reactiveChartOptions"></highcharts>
          <template #fallback>
            <p class="p-10 text-center text-xl">{{ t('chart.loading') }}</p>
          </template>
        </ClientOnly>
      </UCard>
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
