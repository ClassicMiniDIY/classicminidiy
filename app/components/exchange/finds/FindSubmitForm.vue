<template>
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body">
      <h2 class="card-title text-xl mb-4">{{ t('heading') }}</h2>

      <!-- Step 1: URL Input -->
      <fieldset class="fieldset mb-4">
        <legend class="fieldset-legend">{{ t('urlLabel') }}</legend>
        <div class="flex gap-2">
          <input
            v-model="url"
            type="url"
            :placeholder="t('urlPlaceholder')"
            class="input input-bordered flex-1"
            :disabled="fetching"
            @keydown.enter.prevent="fetchPreview"
          />
          <button class="btn btn-primary" :disabled="!url || fetching" @click="fetchPreview">
            <span v-if="fetching" class="loading loading-spinner loading-sm"></span>
            <i v-else class="fas fa-magnifying-glass"></i>
            {{ t('fetchPreview') }}
          </button>
        </div>
        <p class="text-xs text-base-content/50 mt-1">
          {{ t('urlHelp') }}
        </p>
      </fieldset>

      <!-- Fetch Error -->
      <div v-if="fetchError" class="alert alert-error mb-4">
        <i class="fas fa-triangle-exclamation"></i>
        <span>{{ fetchError }}</span>
      </div>

      <!-- Step 2: Preview & Editable Fields -->
      <div v-if="preview" class="space-y-4">
        <!-- Blocked site warning -->
        <div v-if="metadataBlocked" class="alert alert-warning mb-2">
          <i class="fas fa-shield-halved"></i>
          <div>
            <p class="font-medium">{{ t('blockedTitle') }}</p>
            <p class="text-sm">{{ t('blockedBody') }}</p>
          </div>
        </div>

        <!-- Preview Card -->
        <div class="card card-side bg-base-200/50 shadow-sm">
          <figure v-if="preview.imageUrl" class="w-48 shrink-0">
            <img :src="preview.imageUrl" :alt="preview.title" class="w-full h-full object-cover" />
          </figure>
          <div class="card-body p-4">
            <h3 class="card-title text-base">{{ preview.title }}</h3>
            <p v-if="preview.description" class="text-sm text-base-content/60 line-clamp-2">
              {{ preview.description }}
            </p>
            <div class="flex flex-wrap items-center gap-2 text-sm text-base-content/50">
              <span v-if="preview.sourceSite" class="badge badge-sm badge-ghost">
                {{ sourceSiteDisplayNames[preview.sourceSite] || preview.sourceSite }}
              </span>
              <span v-if="preview.year">{{ preview.year }}</span>
              <span v-if="preview.model">{{ preview.model }}</span>
              <span v-if="preview.priceLabel" class="font-semibold text-primary">
                {{ preview.priceLabel }}
              </span>
              <span v-else-if="preview.price != null" class="font-semibold text-primary">
                {{ formatPrice(preview.price) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Editable Fields -->
        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('titleLabel') }} <span class="text-error">*</span></legend>
          <input
            v-model="title"
            type="text"
            class="input input-bordered w-full"
            :placeholder="t('titlePlaceholder')"
            maxlength="200"
          />
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('whyInterestingLabel') }}</legend>
          <textarea
            v-model="description"
            class="textarea textarea-bordered w-full"
            :placeholder="t('whyInterestingPlaceholder')"
            rows="3"
            maxlength="2000"
          ></textarea>
          <div class="text-xs text-base-content/50 text-right mt-1">{{ description.length }} / 2000</div>
        </fieldset>

        <div class="flex flex-col sm:flex-row gap-4">
          <fieldset class="fieldset flex-1">
            <legend class="fieldset-legend">{{ t('categoryLabel') }}</legend>
            <select v-model="category" class="select select-bordered w-full">
              <option value="">{{ t('categoryAutoDetect') }}</option>
              <option value="vehicle">{{ t('categoryVehicle') }}</option>
              <option value="engine">{{ t('categoryEngine') }}</option>
              <option value="parts">{{ t('categoryParts') }}</option>
            </select>
          </fieldset>

          <fieldset class="fieldset flex-1">
            <legend class="fieldset-legend">{{ t('tagsLabel') }}</legend>
            <input
              v-model="tagsInput"
              type="text"
              class="input input-bordered w-full"
              :placeholder="t('tagsPlaceholder')"
            />
            <p class="text-xs text-base-content/50 mt-1">{{ t('tagsHelp') }}</p>
          </fieldset>
        </div>

        <!-- Submit -->
        <div class="flex justify-end gap-2 pt-2">
          <button class="btn btn-ghost" @click="resetForm">{{ t('cancel') }}</button>
          <button class="btn btn-primary" :disabled="!canSubmit || submitting" @click="handleSubmit">
            <span v-if="submitting" class="loading loading-spinner loading-sm"></span>
            <i v-else class="fas fa-paper-plane"></i>
            {{ t('submitFind') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { SubmitFindData } from '~/composables/useExternalListings';

  const { t } = useI18n();

  const { submitFind, submitting } = useExternalListings();
  const router = useRouter();

  // Form state
  const url = ref('');
  const title = ref('');
  const description = ref('');
  const category = ref('');
  const tagsInput = ref('');
  const fetching = ref(false);
  const fetchError = ref('');

  // Preview data from the parse endpoint
  const preview = ref<{
    title: string;
    description: string | null;
    imageUrl: string | null;
    sourceSite: string;
    year: number | null;
    model: string | null;
    price: number | null;
    priceLabel: string | null;
    auctionEndTime: string | null;
    category: string | null;
  } | null>(null);

  // Source site display names (reused from FindCard)
  const sourceSiteDisplayNames: Record<string, string> = {
    bat: 'Bring a Trailer',
    carsandbids: 'Cars & Bids',
    copart: 'Copart',
    craigslist: 'Craigslist',
    facebook: 'Facebook',
    ebay: 'eBay',
    other: 'Other',
  };

  // Format price as currency
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Parse tags from comma-separated input
  const parsedTags = computed(() => {
    return tagsInput.value
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
  });

  // Detect when the site blocked our metadata fetch (title is just the URL, no image/description)
  const metadataBlocked = computed(() => {
    if (!preview.value) return false;
    return !preview.value.imageUrl && !preview.value.description && preview.value.title === url.value.trim();
  });

  // Validation
  const canSubmit = computed(() => {
    return url.value.trim().length > 0 && title.value.trim().length > 0 && description.value.length <= 2000;
  });

  /**
   * Fetch preview metadata from the parse API endpoint.
   */
  const fetchPreview = async () => {
    if (!url.value.trim()) return;

    fetchError.value = '';
    fetching.value = true;
    preview.value = null;

    try {
      const response = await $fetch('/api/exchange/external-listings/parse', {
        method: 'POST',
        body: { url: url.value.trim() },
      });

      if (response.success && response.metadata) {
        preview.value = response.metadata;
        // Pre-populate title from metadata
        title.value = response.metadata.title || '';
        // Pre-populate category from metadata if detected
        if (response.metadata.category) {
          category.value = response.metadata.category;
        }
      }
    } catch (error: any) {
      console.error('Error fetching preview:', error);
      fetchError.value = error.data?.message || error.message || t('fetchErrorFallback');
    } finally {
      fetching.value = false;
    }
  };

  /**
   * Submit the find for moderation.
   */
  const handleSubmit = async () => {
    if (!canSubmit.value) return;

    const data: SubmitFindData = {
      url: url.value.trim(),
      title: title.value.trim(),
      description: description.value.trim() || undefined,
      category: (category.value as 'vehicle' | 'engine' | 'parts') || undefined,
      tags: parsedTags.value.length > 0 ? parsedTags.value : undefined,
      og_image_url: preview.value?.imageUrl || undefined,
      og_description: preview.value?.description || undefined,
      year: preview.value?.year ?? undefined,
      model: preview.value?.model || undefined,
      price: preview.value?.price ?? undefined,
      price_label: preview.value?.priceLabel || undefined,
      auction_end_time: preview.value?.auctionEndTime || undefined,
    };

    const result = await submitFind(data);

    if (result) {
      resetForm();
      router.push('/exchange/finds');
    }
  };

  /**
   * Reset the form to its initial state.
   */
  const resetForm = () => {
    url.value = '';
    title.value = '';
    description.value = '';
    category.value = '';
    tagsInput.value = '';
    preview.value = null;
    fetchError.value = '';
  };
</script>

<i18n lang="json">
{
  "en": {
    "heading": "Submit a Find",
    "urlLabel": "Listing URL",
    "urlPlaceholder": "https://bringatrailer.com/listing/...",
    "fetchPreview": "Fetch Preview",
    "urlHelp": "Paste a link from Bring a Trailer, Cars & Bids, Copart, eBay, Craigslist, Facebook, or any site.",
    "blockedTitle": "This site blocked automatic metadata fetching.",
    "blockedBody": "Please fill in the title and details manually. An admin can add the image later.",
    "titleLabel": "Title",
    "titlePlaceholder": "Listing title",
    "whyInterestingLabel": "Why is this interesting?",
    "whyInterestingPlaceholder": "Tell the community why this find is worth checking out...",
    "categoryLabel": "Category",
    "categoryAutoDetect": "Auto-detect",
    "categoryVehicle": "Vehicle",
    "categoryEngine": "Engine",
    "categoryParts": "Parts",
    "tagsLabel": "Tags",
    "tagsPlaceholder": "e.g. cooper-s, restored, low-mileage",
    "tagsHelp": "Comma-separated",
    "cancel": "Cancel",
    "submitFind": "Submit Find",
    "fetchErrorFallback": "Failed to fetch metadata from the provided URL. You can still submit manually."
  },
  "es": {
    "heading": "Enviar un hallazgo",
    "urlLabel": "URL del anuncio",
    "urlPlaceholder": "https://bringatrailer.com/listing/...",
    "fetchPreview": "Obtener vista previa",
    "urlHelp": "Pega un enlace de Bring a Trailer, Cars & Bids, Copart, eBay, Craigslist, Facebook o cualquier sitio.",
    "blockedTitle": "Este sitio bloqueó la obtención automática de metadatos.",
    "blockedBody": "Completa el título y los detalles manualmente. Un administrador puede añadir la imagen más tarde.",
    "titleLabel": "Título",
    "titlePlaceholder": "Título del anuncio",
    "whyInterestingLabel": "¿Por qué es interesante?",
    "whyInterestingPlaceholder": "Cuéntale a la comunidad por qué vale la pena ver este hallazgo...",
    "categoryLabel": "Categoría",
    "categoryAutoDetect": "Detección automática",
    "categoryVehicle": "Vehículo",
    "categoryEngine": "Motor",
    "categoryParts": "Piezas",
    "tagsLabel": "Etiquetas",
    "tagsPlaceholder": "p. ej. cooper-s, restaurado, pocos-kilómetros",
    "tagsHelp": "Separadas por comas",
    "cancel": "Cancelar",
    "submitFind": "Enviar hallazgo",
    "fetchErrorFallback": "No se pudieron obtener los metadatos de la URL proporcionada. Aún puedes enviarlo manualmente."
  },
  "fr": {
    "heading": "Soumettre une trouvaille",
    "urlLabel": "URL de l'annonce",
    "urlPlaceholder": "https://bringatrailer.com/listing/...",
    "fetchPreview": "Charger l'aperçu",
    "urlHelp": "Collez un lien de Bring a Trailer, Cars & Bids, Copart, eBay, Craigslist, Facebook ou de tout autre site.",
    "blockedTitle": "Ce site a bloqué la récupération automatique des métadonnées.",
    "blockedBody": "Veuillez saisir le titre et les détails manuellement. Un administrateur pourra ajouter l'image plus tard.",
    "titleLabel": "Titre",
    "titlePlaceholder": "Titre de l'annonce",
    "whyInterestingLabel": "Pourquoi est-ce intéressant ?",
    "whyInterestingPlaceholder": "Dites à la communauté pourquoi cette trouvaille vaut le détour...",
    "categoryLabel": "Catégorie",
    "categoryAutoDetect": "Détection automatique",
    "categoryVehicle": "Véhicule",
    "categoryEngine": "Moteur",
    "categoryParts": "Pièces",
    "tagsLabel": "Étiquettes",
    "tagsPlaceholder": "ex. cooper-s, restaurée, faible-kilométrage",
    "tagsHelp": "Séparées par des virgules",
    "cancel": "Annuler",
    "submitFind": "Soumettre la trouvaille",
    "fetchErrorFallback": "Échec de la récupération des métadonnées depuis l'URL fournie. Vous pouvez tout de même soumettre manuellement."
  },
  "de": {
    "heading": "Einen Fund einreichen",
    "urlLabel": "Anzeigen-URL",
    "urlPlaceholder": "https://bringatrailer.com/listing/...",
    "fetchPreview": "Vorschau laden",
    "urlHelp": "Füge einen Link von Bring a Trailer, Cars & Bids, Copart, eBay, Craigslist, Facebook oder einer beliebigen Seite ein.",
    "blockedTitle": "Diese Seite hat das automatische Abrufen von Metadaten blockiert.",
    "blockedBody": "Bitte fülle Titel und Details manuell aus. Ein Administrator kann das Bild später hinzufügen.",
    "titleLabel": "Titel",
    "titlePlaceholder": "Anzeigentitel",
    "whyInterestingLabel": "Warum ist das interessant?",
    "whyInterestingPlaceholder": "Erzähle der Community, warum sich dieser Fund lohnt...",
    "categoryLabel": "Kategorie",
    "categoryAutoDetect": "Automatisch erkennen",
    "categoryVehicle": "Fahrzeug",
    "categoryEngine": "Motor",
    "categoryParts": "Teile",
    "tagsLabel": "Schlagwörter",
    "tagsPlaceholder": "z. B. cooper-s, restauriert, wenig-kilometer",
    "tagsHelp": "Durch Kommas getrennt",
    "cancel": "Abbrechen",
    "submitFind": "Fund einreichen",
    "fetchErrorFallback": "Metadaten konnten nicht von der angegebenen URL abgerufen werden. Du kannst trotzdem manuell einreichen."
  },
  "it": {
    "heading": "Invia una scoperta",
    "urlLabel": "URL dell'annuncio",
    "urlPlaceholder": "https://bringatrailer.com/listing/...",
    "fetchPreview": "Carica anteprima",
    "urlHelp": "Incolla un link da Bring a Trailer, Cars & Bids, Copart, eBay, Craigslist, Facebook o qualsiasi sito.",
    "blockedTitle": "Questo sito ha bloccato il recupero automatico dei metadati.",
    "blockedBody": "Inserisci il titolo e i dettagli manualmente. Un amministratore potrà aggiungere l'immagine più tardi.",
    "titleLabel": "Titolo",
    "titlePlaceholder": "Titolo dell'annuncio",
    "whyInterestingLabel": "Perché è interessante?",
    "whyInterestingPlaceholder": "Racconta alla community perché vale la pena vedere questa scoperta...",
    "categoryLabel": "Categoria",
    "categoryAutoDetect": "Rilevamento automatico",
    "categoryVehicle": "Veicolo",
    "categoryEngine": "Motore",
    "categoryParts": "Ricambi",
    "tagsLabel": "Tag",
    "tagsPlaceholder": "es. cooper-s, restaurata, basso-chilometraggio",
    "tagsHelp": "Separati da virgole",
    "cancel": "Annulla",
    "submitFind": "Invia scoperta",
    "fetchErrorFallback": "Impossibile recuperare i metadati dall'URL fornito. Puoi comunque inviare manualmente."
  },
  "pt": {
    "heading": "Enviar um achado",
    "urlLabel": "URL do anúncio",
    "urlPlaceholder": "https://bringatrailer.com/listing/...",
    "fetchPreview": "Carregar pré-visualização",
    "urlHelp": "Cole um link do Bring a Trailer, Cars & Bids, Copart, eBay, Craigslist, Facebook ou qualquer site.",
    "blockedTitle": "Este site bloqueou a obtenção automática de metadados.",
    "blockedBody": "Preencha o título e os detalhes manualmente. Um administrador pode adicionar a imagem mais tarde.",
    "titleLabel": "Título",
    "titlePlaceholder": "Título do anúncio",
    "whyInterestingLabel": "Por que isto é interessante?",
    "whyInterestingPlaceholder": "Conte à comunidade por que vale a pena conferir este achado...",
    "categoryLabel": "Categoria",
    "categoryAutoDetect": "Detecção automática",
    "categoryVehicle": "Veículo",
    "categoryEngine": "Motor",
    "categoryParts": "Peças",
    "tagsLabel": "Etiquetas",
    "tagsPlaceholder": "ex. cooper-s, restaurado, baixa-quilometragem",
    "tagsHelp": "Separadas por vírgulas",
    "cancel": "Cancelar",
    "submitFind": "Enviar achado",
    "fetchErrorFallback": "Falha ao obter os metadados da URL fornecida. Você ainda pode enviar manualmente."
  },
  "ru": {
    "heading": "Отправить находку",
    "urlLabel": "URL объявления",
    "urlPlaceholder": "https://bringatrailer.com/listing/...",
    "fetchPreview": "Загрузить предпросмотр",
    "urlHelp": "Вставьте ссылку с Bring a Trailer, Cars & Bids, Copart, eBay, Craigslist, Facebook или любого сайта.",
    "blockedTitle": "Этот сайт заблокировал автоматическое получение метаданных.",
    "blockedBody": "Пожалуйста, заполните название и детали вручную. Администратор сможет добавить изображение позже.",
    "titleLabel": "Название",
    "titlePlaceholder": "Название объявления",
    "whyInterestingLabel": "Чем это интересно?",
    "whyInterestingPlaceholder": "Расскажите сообществу, почему на эту находку стоит обратить внимание...",
    "categoryLabel": "Категория",
    "categoryAutoDetect": "Автоопределение",
    "categoryVehicle": "Автомобиль",
    "categoryEngine": "Двигатель",
    "categoryParts": "Запчасти",
    "tagsLabel": "Теги",
    "tagsPlaceholder": "напр. cooper-s, восстановлен, малый-пробег",
    "tagsHelp": "Через запятую",
    "cancel": "Отмена",
    "submitFind": "Отправить находку",
    "fetchErrorFallback": "Не удалось получить метаданные с указанного URL. Вы по-прежнему можете отправить вручную."
  },
  "ja": {
    "heading": "見つけたものを投稿",
    "urlLabel": "出品URL",
    "urlPlaceholder": "https://bringatrailer.com/listing/...",
    "fetchPreview": "プレビューを取得",
    "urlHelp": "Bring a Trailer、Cars & Bids、Copart、eBay、Craigslist、Facebook など、任意のサイトのリンクを貼り付けてください。",
    "blockedTitle": "このサイトはメタデータの自動取得をブロックしました。",
    "blockedBody": "タイトルと詳細を手動で入力してください。画像は管理者が後で追加できます。",
    "titleLabel": "タイトル",
    "titlePlaceholder": "出品タイトル",
    "whyInterestingLabel": "なぜ興味深いのですか?",
    "whyInterestingPlaceholder": "この見つけたものがチェックする価値がある理由をコミュニティに伝えてください...",
    "categoryLabel": "カテゴリ",
    "categoryAutoDetect": "自動検出",
    "categoryVehicle": "車両",
    "categoryEngine": "エンジン",
    "categoryParts": "パーツ",
    "tagsLabel": "タグ",
    "tagsPlaceholder": "例: cooper-s, レストア済み, 低走行",
    "tagsHelp": "カンマ区切り",
    "cancel": "キャンセル",
    "submitFind": "見つけたものを投稿",
    "fetchErrorFallback": "指定されたURLからメタデータを取得できませんでした。手動で投稿することもできます。"
  },
  "zh": {
    "heading": "提交发现",
    "urlLabel": "刊登链接",
    "urlPlaceholder": "https://bringatrailer.com/listing/...",
    "fetchPreview": "获取预览",
    "urlHelp": "粘贴来自 Bring a Trailer、Cars & Bids、Copart、eBay、Craigslist、Facebook 或任何网站的链接。",
    "blockedTitle": "该网站阻止了自动获取元数据。",
    "blockedBody": "请手动填写标题和详情。管理员稍后可以添加图片。",
    "titleLabel": "标题",
    "titlePlaceholder": "刊登标题",
    "whyInterestingLabel": "为什么这个值得关注?",
    "whyInterestingPlaceholder": "告诉社区为什么这个发现值得一看……",
    "categoryLabel": "类别",
    "categoryAutoDetect": "自动检测",
    "categoryVehicle": "车辆",
    "categoryEngine": "发动机",
    "categoryParts": "零件",
    "tagsLabel": "标签",
    "tagsPlaceholder": "例如 cooper-s、已修复、低里程",
    "tagsHelp": "用逗号分隔",
    "cancel": "取消",
    "submitFind": "提交发现",
    "fetchErrorFallback": "无法从提供的链接获取元数据。您仍然可以手动提交。"
  },
  "ko": {
    "heading": "발견 제출",
    "urlLabel": "매물 URL",
    "urlPlaceholder": "https://bringatrailer.com/listing/...",
    "fetchPreview": "미리보기 가져오기",
    "urlHelp": "Bring a Trailer, Cars & Bids, Copart, eBay, Craigslist, Facebook 또는 모든 사이트의 링크를 붙여넣으세요.",
    "blockedTitle": "이 사이트는 메타데이터 자동 가져오기를 차단했습니다.",
    "blockedBody": "제목과 세부 정보를 직접 입력해 주세요. 관리자가 나중에 이미지를 추가할 수 있습니다.",
    "titleLabel": "제목",
    "titlePlaceholder": "매물 제목",
    "whyInterestingLabel": "왜 흥미로운가요?",
    "whyInterestingPlaceholder": "이 발견이 살펴볼 만한 이유를 커뮤니티에 알려주세요...",
    "categoryLabel": "카테고리",
    "categoryAutoDetect": "자동 감지",
    "categoryVehicle": "차량",
    "categoryEngine": "엔진",
    "categoryParts": "부품",
    "tagsLabel": "태그",
    "tagsPlaceholder": "예: cooper-s, 복원됨, 저주행",
    "tagsHelp": "쉼표로 구분",
    "cancel": "취소",
    "submitFind": "발견 제출",
    "fetchErrorFallback": "제공된 URL에서 메타데이터를 가져오지 못했습니다. 직접 제출할 수 있습니다."
  }
}
</i18n>
