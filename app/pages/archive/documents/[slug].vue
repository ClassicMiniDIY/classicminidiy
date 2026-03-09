<script setup lang="ts">
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const route = useRoute();
  const slug = route.params.slug as string;

  const showSuggestEdit = ref(false);
  const copied = ref(false);

  // Fetch document from Supabase
  const { getDocumentBySlug, getRelatedDocuments, listCollections } = useArchiveDocuments();
  const {
    data: doc,
    status,
    error,
  } = await useAsyncData(`archive-document-${slug}`, async () => {
    const result = await getDocumentBySlug(slug);
    return result || null;
  });

  // Fetch all collections for the suggest-edit dropdown
  const { data: collections } = await useAsyncData('archive-document-collections', () => listCollections(), {
    default: () => [],
  });

  // Build collection options for the suggest edit modal
  const collectionOptions = computed(() => [
    { value: null, label: t('field.collection_none') },
    ...(collections.value || []).map((c) => ({ value: c.id, label: c.title })),
    { value: '__new__', label: t('field.collection_suggest_new') },
  ]);

  // Fetch related documents if this doc belongs to a collection
  const { data: relatedDocs } = await useAsyncData(
    `archive-document-related-${slug}`,
    async () => {
      if (!doc.value?.collection) return [];
      return getRelatedDocuments(doc.value.collection.id, doc.value.id);
    },
    { watch: [doc] }
  );

  // Type config for badge display
  const typeConfig: Record<string, { icon: string; label: string; color: string }> = {
    manual: { icon: 'fas fa-book', label: t('type.manual'), color: 'primary' },
    advert: { icon: 'fas fa-rectangle-ad', label: t('type.advert'), color: 'secondary' },
    catalogue: { icon: 'fas fa-book-open', label: t('type.catalogue'), color: 'info' },
    tuning: { icon: 'fas fa-gauge-high', label: t('type.tuning'), color: 'warning' },
    electrical: { icon: 'fas fa-bolt', label: t('type.electrical'), color: 'error' },
  };

  // Language display map
  const languageNames: Record<string, string> = {
    en: 'English',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    es: 'Spanish',
    pt: 'Portuguese',
    nl: 'Dutch',
    sv: 'Swedish',
    da: 'Danish',
    no: 'Norwegian',
    ja: 'Japanese',
  };

  // Derive file type from download URL
  const fileType = computed(() => doc.value?.download?.split('.')?.pop()?.toUpperCase() || null);

  // Derive vehicle year range string
  const vehicleYears = computed(() => {
    if (!doc.value) return null;
    const start = doc.value.vehicleYearStart;
    const end = doc.value.vehicleYearEnd;
    if (start && end) return `${start} - ${end}`;
    if (start) return `${start}+`;
    if (end) return `- ${end}`;
    return null;
  });

  // Derive applicable models string
  const modelsDisplay = computed(() => {
    if (!doc.value?.applicableModels?.length) return null;
    return doc.value.applicableModels.join(', ');
  });

  // Build stats grid (only show stats with data)
  const stats = computed(() => {
    if (!doc.value) return [];
    const items: Array<{ key: string; icon: string; label: string; value: string | null }> = [
      { key: 'code', icon: 'fas fa-hashtag', label: t('stat.code'), value: doc.value.code || null },
      { key: 'publisher', icon: 'fas fa-building', label: t('stat.publisher'), value: doc.value.publisher },
      { key: 'edition', icon: 'fas fa-bookmark', label: t('stat.edition'), value: doc.value.edition },
      {
        key: 'pages',
        icon: 'fas fa-file-lines',
        label: t('stat.pages'),
        value: doc.value.pageCount ? String(doc.value.pageCount) : null,
      },
      {
        key: 'language',
        icon: 'fas fa-language',
        label: t('stat.language'),
        value: languageNames[doc.value.language] || doc.value.language || null,
      },
      { key: 'vehicle_years', icon: 'fas fa-calendar-days', label: t('stat.vehicle_years'), value: vehicleYears.value },
      { key: 'models', icon: 'fas fa-car', label: t('stat.models'), value: modelsDisplay.value },
      { key: 'file_type', icon: 'fas fa-file', label: t('stat.file_type'), value: fileType.value },
    ];
    return items;
  });

  // Copy link to clipboard
  async function copyUrl() {
    const url = `https://classicminidiy.com/archive/documents/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      copied.value = true;
      setTimeout(() => (copied.value = false), 2000);
    } catch {
      copied.value = false;
    }
  }

  // Share via Web Share API
  async function shareDocument() {
    if (!doc.value) return;
    try {
      await navigator.share({
        title: doc.value.title,
        text: doc.value.description || t('seo.description_fallback', { title: doc.value.title }),
        url: `https://classicminidiy.com/archive/documents/${slug}`,
      });
    } catch {
      // User cancelled or API not available — fall back to copy
      copyUrl();
    }
  }

  // Image error handler
  const handleImageError = (event: Event) => {
    const imgElement = event.target as HTMLImageElement;
    if (imgElement) {
      imgElement.src = 'https://classicminidiy.s3.amazonaws.com/misc/placeholder.png';
      imgElement.classList.add('opacity-50');
    }
  };

  // Structured data (JSON-LD) — must be defined before useHead which references it
  const jsonLd = computed(() => ({
    '@context': 'https://schema.org',
    '@type': 'DigitalDocument',
    name: doc.value?.title,
    description: doc.value?.description,
    url: `https://classicminidiy.com/archive/documents/${slug}`,
    image: doc.value?.image,
    encodingFormat: fileType.value?.toLowerCase(),
    numberOfPages: doc.value?.pageCount || undefined,
    inLanguage: doc.value?.language || undefined,
    datePublished: doc.value?.year ? `${doc.value.year}` : undefined,
    author: {
      '@type': 'Person',
      name: doc.value?.author || t('structured_data.author_fallback'),
    },
    publisher: {
      '@type': 'Organization',
      name: t('structured_data.publisher_name'),
      logo: {
        '@type': 'ImageObject',
        url: 'https://classicminidiy.s3.amazonaws.com/misc/logo.png',
      },
    },
    isPartOf: {
      '@type': 'CollectionPage',
      name: t('structured_data.collection_name'),
      url: 'https://classicminidiy.com/archive/documents',
    },
  }));

  // SEO — use callback form for reactivity on client-side navigation
  useHead(() => ({
    title: `${doc.value?.title || ''} ${t('seo.title_suffix')}`,
    meta: [
      {
        key: 'description',
        name: 'description',
        content: doc.value?.description || t('seo.description_fallback', { title: doc.value?.title }),
      },
      {
        key: 'keywords',
        name: 'keywords',
        content: t('seo.keywords_template', {
          title: doc.value?.title,
          fileType: fileType.value || 'resource',
          type: doc.value?.type || 'document',
        }),
      },
    ],
    link: [
      {
        rel: 'canonical',
        href: `https://classicminidiy.com/archive/documents/${slug}`,
      },
    ],
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(jsonLd.value),
      },
    ],
  }));

  useSeoMeta(() => ({
    ogTitle: `${doc.value?.title || ''} ${t('seo.og_title_suffix')}`,
    ogDescription: doc.value?.description || t('seo.description_fallback', { title: doc.value?.title }),
    ogUrl: `https://classicminidiy.com/archive/documents/${slug}`,
    ogImage: doc.value?.image,
    ogType: 'article' as const,
    author: doc.value?.author,
    twitterCard: 'summary_large_image' as const,
    twitterTitle: `${doc.value?.title || ''} ${t('seo.og_title_suffix')}`,
    twitterDescription: doc.value?.description || t('seo.description_fallback', { title: doc.value?.title }),
    twitterImage: doc.value?.image,
  }));
</script>

<template>
  <div class="min-h-screen bg-muted">
    <!-- Hero Section -->
    <div class="bg-primary text-primary-content py-8">
      <div class="container mx-auto px-4">
        <div class="flex items-center gap-2 mb-4">
          <i class="fas fa-file-lines text-3xl"></i>
          <h1 class="text-3xl font-bold">{{ t('hero_title') }}</h1>
        </div>
        <div class="text-sm">
          <ul class="flex items-center gap-2">
            <li>
              <NuxtLink to="/" class="hover:underline">{{ t('breadcrumb_home') }}</NuxtLink>
              <span class="mx-2">/</span>
            </li>
            <li>
              <NuxtLink to="/archive/documents" class="hover:underline">{{ t('breadcrumb_documents') }}</NuxtLink>
              <span class="mx-2">/</span>
            </li>
            <li v-if="doc">{{ doc.title }}</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="container mx-auto px-4 py-8">
      <!-- Loading State -->
      <div v-if="status === 'pending'" class="flex justify-center p-8">
        <span class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
      </div>

      <!-- Error State -->
      <UAlert v-else-if="error" color="error" class="max-w-2xl mx-auto" icon="i-fa6-solid-circle-exclamation">
        <template #title>{{ t('loading_error') }}</template>
      </UAlert>

      <!-- Not Found State -->
      <div v-else-if="!doc" class="text-center py-16">
        <i class="fas fa-file-circle-question text-6xl opacity-30 mb-4"></i>
        <h2 class="text-2xl font-bold mb-2">{{ t('not_found_title') }}</h2>
        <p class="opacity-70 mb-6">{{ t('not_found_text') }}</p>
        <UButton to="/archive/documents" color="primary">
          <i class="fas fa-arrow-left mr-2"></i>
          {{ t('back_to_documents') }}
        </UButton>
      </div>

      <!-- Document Content -->
      <template v-else>
        <UCard class="mb-8">
          <!-- Header: Info Left + Thumbnail Right -->
          <div class="flex flex-col md:flex-row gap-6 items-center">
            <!-- Document Info -->
            <div class="flex-1 text-center md:text-left">
              <UBadge
                v-if="doc.type && typeConfig[doc.type]"
                size="lg"
                :color="typeConfig[doc.type].color as any"
                class="mb-4"
              >
                <i :class="[typeConfig[doc.type].icon, 'mr-1']"></i>
                {{ typeConfig[doc.type].label }}
              </UBadge>

              <h2 class="text-3xl font-bold mb-2">{{ doc.title }}</h2>

              <p v-if="doc.author || doc.year" class="text-lg opacity-70 mb-4">
                <span v-if="doc.author">{{ doc.author }}</span>
                <span v-if="doc.author && doc.year"> &bull; </span>
                <span v-if="doc.year">{{ doc.year }}</span>
              </p>

              <h3 v-if="doc.code" class="text-5xl font-bold text-primary">{{ doc.code }}</h3>
            </div>

            <!-- Thumbnail -->
            <div class="w-full md:w-1/3 lg:w-1/4">
              <figure class="relative aspect-4/3 rounded-xl overflow-hidden shadow-lg">
                <img
                  v-if="doc.image"
                  :src="doc.image"
                  :alt="t('alt.preview_image', { title: doc.title })"
                  class="w-full h-full object-cover"
                  loading="lazy"
                  @error="handleImageError"
                />
                <div
                  v-else
                  class="w-full h-full bg-linear-to-br from-muted to-muted/50 flex items-center justify-center"
                >
                  <i class="fas fa-file-lines text-6xl opacity-30"></i>
                </div>
              </figure>
            </div>
          </div>

          <!-- Details Section -->
          <USeparator :label="t('section.details')" class="my-6" />
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div v-for="stat in stats" :key="stat.key" class="bg-muted rounded-lg p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm opacity-70">{{ stat.label }}</span>
                <i :class="[stat.icon, 'text-xl text-primary']"></i>
              </div>
              <div class="text-lg font-semibold truncate" :class="{ 'text-error': !stat.value }">
                {{ stat.value || t('stat.missing') }}
              </div>
            </div>
          </div>

          <!-- Description Section -->
          <USeparator :label="t('section.description')" class="my-6" />
          <div class="prose max-w-none">
            <p>{{ doc.description || t('no_description') }}</p>
          </div>

          <!-- Suggest Collection Callout (when doc has no collection) -->
          <template v-if="!doc.collection && isAuthenticated">
            <USeparator :label="t('section.suggest_collection')" class="my-6" />
            <UAlert color="info" variant="soft">
              <template #icon>
                <i class="fad fa-folder-plus"></i>
              </template>
              <template #title>{{ t('suggest_collection.prompt_title') }}</template>
              <template #description>{{ t('suggest_collection.prompt_description') }}</template>
              <template #actions>
                <UButton size="sm" color="info" variant="outline" @click="showSuggestEdit = true">
                  <i class="fad fa-folder-plus mr-2"></i>
                  {{ t('suggest_collection.cta') }}
                </UButton>
              </template>
            </UAlert>
          </template>

          <!-- Collection Section (conditional) -->
          <template v-if="doc.collection">
            <USeparator :label="t('section.collection')" class="my-6" />
            <div class="mb-4">
              <p class="text-lg">
                {{ t('collection.part_of') }}
                <NuxtLink
                  :to="`/archive/documents/collection/${doc.collection.slug}`"
                  class="font-semibold text-primary hover:underline"
                >
                  {{ doc.collection.title }}
                </NuxtLink>
              </p>
            </div>
            <div
              v-if="relatedDocs && relatedDocs.length > 0"
              class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <archive-document-card v-for="related in relatedDocs.slice(0, 4)" :key="related.id" :item="related" />
            </div>
          </template>

          <!-- Actions Section -->
          <USeparator :label="t('section.actions')" class="my-6" />
          <div class="flex flex-wrap gap-4 justify-center">
            <UButton v-if="doc.download" color="primary" :to="doc.download" target="_blank">
              <i class="fas fa-download mr-2"></i>
              {{ t('action.download') }}
            </UButton>

            <ClientOnly>
              <UButton :color="copied ? 'success' : 'neutral'" @click="copyUrl()">
                <i :class="[copied ? 'fas fa-check' : 'fas fa-link', 'mr-2']"></i>
                {{ copied ? t('action.copied') : t('action.copy_link') }}
              </UButton>

              <UButton color="neutral" @click="shareDocument()">
                <i class="fas fa-share-nodes mr-2"></i>
                {{ t('action.share') }}
              </UButton>
            </ClientOnly>

            <UButton v-if="isAuthenticated" variant="outline" @click="showSuggestEdit = true">
              <i class="fad fa-pen-to-square mr-2"></i>
              {{ t('action.suggest_edit') }}
            </UButton>
          </div>
        </UCard>

        <!-- Patreon Support -->
        <UCard>
          <patreon-card size="large" />
        </UCard>
      </template>
    </div>

    <!-- Suggest Edit Modal -->
    <SuggestEditModal
      v-if="doc"
      v-model="showSuggestEdit"
      target-type="document"
      :target-id="doc.id"
      :current-data="{
        title: doc.title,
        code: doc.code,
        description: doc.description,
        author: doc.author,
        year: doc.year,
        publisher: doc.publisher,
        edition: doc.edition,
        page_count: doc.pageCount,
        language: doc.language,
        vehicle_year_start: doc.vehicleYearStart,
        vehicle_year_end: doc.vehicleYearEnd,
        collection_id: doc.collection?.id ?? null,
      }"
      :editable-fields="[
        { key: 'title', label: t('field.title'), type: 'text' },
        { key: 'code', label: t('field.code'), type: 'text' },
        { key: 'description', label: t('field.description'), type: 'textarea' },
        { key: 'author', label: t('field.author'), type: 'text' },
        { key: 'year', label: t('field.year'), type: 'number' },
        { key: 'publisher', label: t('field.publisher'), type: 'text' },
        { key: 'edition', label: t('field.edition'), type: 'text' },
        { key: 'page_count', label: t('field.page_count'), type: 'number' },
        { key: 'language', label: t('field.language'), type: 'text' },
        { key: 'vehicle_year_start', label: t('field.vehicle_year_start'), type: 'number' },
        { key: 'vehicle_year_end', label: t('field.vehicle_year_end'), type: 'number' },
        {
          key: 'collection_id',
          label: t('field.collection'),
          type: 'select',
          options: collectionOptions,
          conditionalFields: {
            __new__: [
              { key: '_new_collection_title', label: t('field.new_collection_title') },
              { key: '_new_collection_description', label: t('field.new_collection_description'), type: 'textarea' },
            ],
          },
        },
      ]"
    />
  </div>
</template>

<style scoped>
  figure {
    transition: transform 0.3s ease;
  }

  figure:hover {
    transform: translateY(-4px);
  }
</style>

<i18n lang="json">
{
  "en": {
    "hero_title": "Classic Mini Archives",
    "breadcrumb_home": "Home",
    "breadcrumb_documents": "Documents",
    "type": {
      "manual": "Manual",
      "advert": "Advert",
      "catalogue": "Catalogue",
      "tuning": "Tuning",
      "electrical": "Electrical"
    },
    "stat": {
      "code": "Code",
      "publisher": "Publisher",
      "edition": "Edition",
      "pages": "Pages",
      "language": "Language",
      "vehicle_years": "Vehicle Years",
      "models": "Models",
      "file_type": "File Type",
      "missing": "Missing"
    },
    "section": {
      "details": "Details",
      "description": "Description",
      "collection": "In This Collection",
      "suggest_collection": "Collection",
      "actions": "Actions"
    },
    "collection": {
      "part_of": "Part of",
      "view_all": "View All"
    },
    "suggest_collection": {
      "prompt_title": "Know which collection this belongs to?",
      "prompt_description": "Help organize the archive by suggesting a collection for this document.",
      "cta": "Suggest Collection"
    },
    "action": {
      "download": "Download",
      "copy_link": "Copy Link",
      "copied": "Copied!",
      "share": "Share",
      "suggest_edit": "Suggest Edit"
    },
    "field": {
      "title": "Title",
      "code": "Code",
      "description": "Description",
      "author": "Author",
      "year": "Year",
      "publisher": "Publisher",
      "edition": "Edition",
      "page_count": "Page Count",
      "language": "Language",
      "vehicle_year_start": "Vehicle Year Start",
      "vehicle_year_end": "Vehicle Year End",
      "collection": "Collection",
      "collection_none": "No Collection",
      "collection_suggest_new": "Suggest New Collection...",
      "new_collection_title": "Proposed Collection Title",
      "new_collection_description": "Proposed Collection Description"
    },
    "alt": {
      "preview_image": "{title} preview image",
      "no_image": "No image available"
    },
    "no_description": "No description available.",
    "loading_error": "Error loading content. Please try again later.",
    "not_found_title": "Document Not Found",
    "not_found_text": "The document you are looking for could not be found.",
    "back_to_documents": "Back to Documents",
    "seo": {
      "title_suffix": "- Classic Mini Archive - Classic Mini DIY",
      "description_fallback": "Archive resource for {title} in the Classic Mini DIY collection.",
      "keywords_template": "Classic Mini, {title}, archive, Mini Cooper, {fileType}, {type}",
      "og_title_suffix": "- Classic Mini Archive"
    },
    "structured_data": {
      "author_fallback": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "collection_name": "Classic Mini Archives"
    }
  },
  "es": {
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_home": "Inicio",
    "breadcrumb_documents": "Documentos",
    "type": {
      "manual": "Manual",
      "advert": "Anuncio",
      "catalogue": "Catálogo",
      "tuning": "Preparación",
      "electrical": "Eléctrico"
    },
    "stat": {
      "code": "Código",
      "publisher": "Editorial",
      "edition": "Edición",
      "pages": "Páginas",
      "language": "Idioma",
      "vehicle_years": "Años del vehículo",
      "models": "Modelos",
      "file_type": "Tipo de archivo",
      "missing": "Faltante"
    },
    "section": {
      "details": "Detalles",
      "description": "Descripción",
      "collection": "En esta colección",
      "suggest_collection": "Colección",
      "actions": "Acciones"
    },
    "collection": {
      "part_of": "Parte de",
      "view_all": "Ver todo"
    },
    "suggest_collection": {
      "prompt_title": "¿Sabes a qué colección pertenece?",
      "prompt_description": "Ayuda a organizar el archivo sugiriendo una colección para este documento.",
      "cta": "Sugerir colección"
    },
    "action": {
      "download": "Descargar",
      "copy_link": "Copiar enlace",
      "copied": "¡Copiado!",
      "share": "Compartir",
      "suggest_edit": "Sugerir edición"
    },
    "field": {
      "title": "Título",
      "code": "Código",
      "description": "Descripción",
      "author": "Autor",
      "year": "Año",
      "publisher": "Editorial",
      "edition": "Edición",
      "page_count": "Número de páginas",
      "language": "Idioma",
      "vehicle_year_start": "Año inicio vehículo",
      "vehicle_year_end": "Año fin vehículo",
      "collection": "Colección",
      "collection_none": "Sin colección",
      "collection_suggest_new": "Sugerir nueva colección...",
      "new_collection_title": "Título de colección propuesto",
      "new_collection_description": "Descripción de colección propuesta"
    },
    "alt": {
      "preview_image": "Imagen de vista previa de {title}",
      "no_image": "No hay imagen disponible"
    },
    "no_description": "No hay descripción disponible.",
    "loading_error": "Error al cargar el contenido. Por favor, inténtalo de nuevo más tarde.",
    "not_found_title": "Documento no encontrado",
    "not_found_text": "El documento que buscas no se ha podido encontrar.",
    "back_to_documents": "Volver a documentos",
    "seo": {
      "title_suffix": "- Archivo Classic Mini - Classic Mini DIY",
      "description_fallback": "Recurso de archivo para {title} en la colección Classic Mini DIY.",
      "keywords_template": "Classic Mini, {title}, archivo, Mini Cooper, {fileType}, {type}",
      "og_title_suffix": "- Archivo Classic Mini"
    },
    "structured_data": {
      "author_fallback": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "collection_name": "Archivos Classic Mini"
    }
  },
  "fr": {
    "hero_title": "Archives Classic Mini",
    "breadcrumb_home": "Accueil",
    "breadcrumb_documents": "Documents",
    "type": {
      "manual": "Manuel",
      "advert": "Publicité",
      "catalogue": "Catalogue",
      "tuning": "Préparation",
      "electrical": "Électrique"
    },
    "stat": {
      "code": "Code",
      "publisher": "Éditeur",
      "edition": "Édition",
      "pages": "Pages",
      "language": "Langue",
      "vehicle_years": "Années du véhicule",
      "models": "Modèles",
      "file_type": "Type de fichier",
      "missing": "Manquant"
    },
    "section": {
      "details": "Détails",
      "description": "Description",
      "collection": "Dans cette collection",
      "suggest_collection": "Collection",
      "actions": "Actions"
    },
    "collection": {
      "part_of": "Fait partie de",
      "view_all": "Voir tout"
    },
    "suggest_collection": {
      "prompt_title": "Savez-vous à quelle collection cela appartient ?",
      "prompt_description": "Aidez à organiser les archives en suggérant une collection pour ce document.",
      "cta": "Suggérer une collection"
    },
    "action": {
      "download": "Télécharger",
      "copy_link": "Copier le lien",
      "copied": "Copié !",
      "share": "Partager",
      "suggest_edit": "Suggérer une modification"
    },
    "field": {
      "title": "Titre",
      "code": "Code",
      "description": "Description",
      "author": "Auteur",
      "year": "Année",
      "publisher": "Éditeur",
      "edition": "Édition",
      "page_count": "Nombre de pages",
      "language": "Langue",
      "vehicle_year_start": "Année début véhicule",
      "vehicle_year_end": "Année fin véhicule",
      "collection": "Collection",
      "collection_none": "Aucune collection",
      "collection_suggest_new": "Suggérer une nouvelle collection...",
      "new_collection_title": "Titre de collection proposé",
      "new_collection_description": "Description de collection proposée"
    },
    "alt": {
      "preview_image": "Image d'aperçu de {title}",
      "no_image": "Aucune image disponible"
    },
    "no_description": "Aucune description disponible.",
    "loading_error": "Erreur lors du chargement du contenu. Veuillez réessayer plus tard.",
    "not_found_title": "Document introuvable",
    "not_found_text": "Le document que vous recherchez est introuvable.",
    "back_to_documents": "Retour aux documents",
    "seo": {
      "title_suffix": "- Archive Classic Mini - Classic Mini DIY",
      "description_fallback": "Ressource d'archive pour {title} dans la collection Classic Mini DIY.",
      "keywords_template": "Classic Mini, {title}, archive, Mini Cooper, {fileType}, {type}",
      "og_title_suffix": "- Archive Classic Mini"
    },
    "structured_data": {
      "author_fallback": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "collection_name": "Archives Classic Mini"
    }
  },
  "it": {
    "hero_title": "Archivi Classic Mini",
    "breadcrumb_home": "Home",
    "breadcrumb_documents": "Documenti",
    "type": {
      "manual": "Manuale",
      "advert": "Annuncio",
      "catalogue": "Catalogo",
      "tuning": "Preparazione",
      "electrical": "Elettrico"
    },
    "stat": {
      "code": "Codice",
      "publisher": "Editore",
      "edition": "Edizione",
      "pages": "Pagine",
      "language": "Lingua",
      "vehicle_years": "Anni del veicolo",
      "models": "Modelli",
      "file_type": "Tipo di file",
      "missing": "Mancante"
    },
    "section": {
      "details": "Dettagli",
      "description": "Descrizione",
      "collection": "In questa collezione",
      "suggest_collection": "Collezione",
      "actions": "Azioni"
    },
    "collection": {
      "part_of": "Parte di",
      "view_all": "Vedi tutto"
    },
    "suggest_collection": {
      "prompt_title": "Sai a quale collezione appartiene?",
      "prompt_description": "Aiuta a organizzare l'archivio suggerendo una collezione per questo documento.",
      "cta": "Suggerisci collezione"
    },
    "action": {
      "download": "Scarica",
      "copy_link": "Copia link",
      "copied": "Copiato!",
      "share": "Condividi",
      "suggest_edit": "Suggerisci modifica"
    },
    "field": {
      "title": "Titolo",
      "code": "Codice",
      "description": "Descrizione",
      "author": "Autore",
      "year": "Anno",
      "publisher": "Editore",
      "edition": "Edizione",
      "page_count": "Numero di pagine",
      "language": "Lingua",
      "vehicle_year_start": "Anno inizio veicolo",
      "vehicle_year_end": "Anno fine veicolo",
      "collection": "Collezione",
      "collection_none": "Nessuna collezione",
      "collection_suggest_new": "Suggerisci nuova collezione...",
      "new_collection_title": "Titolo raccolta proposto",
      "new_collection_description": "Descrizione raccolta proposta"
    },
    "alt": {
      "preview_image": "Immagine di anteprima di {title}",
      "no_image": "Nessuna immagine disponibile"
    },
    "no_description": "Nessuna descrizione disponibile.",
    "loading_error": "Errore nel caricamento del contenuto. Riprova più tardi.",
    "not_found_title": "Documento non trovato",
    "not_found_text": "Il documento che stai cercando non è stato trovato.",
    "back_to_documents": "Torna ai documenti",
    "seo": {
      "title_suffix": "- Archivio Classic Mini - Classic Mini DIY",
      "description_fallback": "Risorsa di archivio per {title} nella collezione Classic Mini DIY.",
      "keywords_template": "Classic Mini, {title}, archivio, Mini Cooper, {fileType}, {type}",
      "og_title_suffix": "- Archivio Classic Mini"
    },
    "structured_data": {
      "author_fallback": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "collection_name": "Archivi Classic Mini"
    }
  },
  "de": {
    "hero_title": "Classic Mini Archive",
    "breadcrumb_home": "Startseite",
    "breadcrumb_documents": "Dokumente",
    "type": {
      "manual": "Handbuch",
      "advert": "Anzeige",
      "catalogue": "Katalog",
      "tuning": "Tuning",
      "electrical": "Elektrik"
    },
    "stat": {
      "code": "Code",
      "publisher": "Verlag",
      "edition": "Ausgabe",
      "pages": "Seiten",
      "language": "Sprache",
      "vehicle_years": "Fahrzeugjahre",
      "models": "Modelle",
      "file_type": "Dateityp",
      "missing": "Fehlend"
    },
    "section": {
      "details": "Details",
      "description": "Beschreibung",
      "collection": "In dieser Sammlung",
      "suggest_collection": "Sammlung",
      "actions": "Aktionen"
    },
    "collection": {
      "part_of": "Teil von",
      "view_all": "Alle anzeigen"
    },
    "suggest_collection": {
      "prompt_title": "Wissen Sie, zu welcher Sammlung dies gehört?",
      "prompt_description": "Helfen Sie beim Organisieren des Archivs, indem Sie eine Sammlung für dieses Dokument vorschlagen.",
      "cta": "Sammlung vorschlagen"
    },
    "action": {
      "download": "Herunterladen",
      "copy_link": "Link kopieren",
      "copied": "Kopiert!",
      "share": "Teilen",
      "suggest_edit": "Bearbeitung vorschlagen"
    },
    "field": {
      "title": "Titel",
      "code": "Code",
      "description": "Beschreibung",
      "author": "Autor",
      "year": "Jahr",
      "publisher": "Verlag",
      "edition": "Ausgabe",
      "page_count": "Seitenzahl",
      "language": "Sprache",
      "vehicle_year_start": "Fahrzeugjahr Beginn",
      "vehicle_year_end": "Fahrzeugjahr Ende",
      "collection": "Sammlung",
      "collection_none": "Keine Sammlung",
      "collection_suggest_new": "Neue Sammlung vorschlagen...",
      "new_collection_title": "Vorgeschlagener Sammlungstitel",
      "new_collection_description": "Vorgeschlagene Sammlungsbeschreibung"
    },
    "alt": {
      "preview_image": "Vorschaubild von {title}",
      "no_image": "Kein Bild verfügbar"
    },
    "no_description": "Keine Beschreibung verfügbar.",
    "loading_error": "Fehler beim Laden des Inhalts. Bitte versuchen Sie es später erneut.",
    "not_found_title": "Dokument nicht gefunden",
    "not_found_text": "Das gesuchte Dokument konnte nicht gefunden werden.",
    "back_to_documents": "Zurück zu Dokumenten",
    "seo": {
      "title_suffix": "- Classic Mini Archiv - Classic Mini DIY",
      "description_fallback": "Archiv-Ressource für {title} in der Classic Mini DIY Sammlung.",
      "keywords_template": "Classic Mini, {title}, Archiv, Mini Cooper, {fileType}, {type}",
      "og_title_suffix": "- Classic Mini Archiv"
    },
    "structured_data": {
      "author_fallback": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "collection_name": "Classic Mini Archive"
    }
  },
  "pt": {
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb_home": "Início",
    "breadcrumb_documents": "Documentos",
    "type": {
      "manual": "Manual",
      "advert": "Anúncio",
      "catalogue": "Catálogo",
      "tuning": "Preparação",
      "electrical": "Elétrico"
    },
    "stat": {
      "code": "Código",
      "publisher": "Editora",
      "edition": "Edição",
      "pages": "Páginas",
      "language": "Idioma",
      "vehicle_years": "Anos do veículo",
      "models": "Modelos",
      "file_type": "Tipo de arquivo",
      "missing": "Ausente"
    },
    "section": {
      "details": "Detalhes",
      "description": "Descrição",
      "collection": "Nesta coleção",
      "suggest_collection": "Coleção",
      "actions": "Ações"
    },
    "collection": {
      "part_of": "Parte de",
      "view_all": "Ver tudo"
    },
    "suggest_collection": {
      "prompt_title": "Sabe a que coleção pertence?",
      "prompt_description": "Ajude a organizar o arquivo sugerindo uma coleção para este documento.",
      "cta": "Sugerir coleção"
    },
    "action": {
      "download": "Baixar",
      "copy_link": "Copiar link",
      "copied": "Copiado!",
      "share": "Compartilhar",
      "suggest_edit": "Sugerir edição"
    },
    "field": {
      "title": "Título",
      "code": "Código",
      "description": "Descrição",
      "author": "Autor",
      "year": "Ano",
      "publisher": "Editora",
      "edition": "Edição",
      "page_count": "Número de páginas",
      "language": "Idioma",
      "vehicle_year_start": "Ano início veículo",
      "vehicle_year_end": "Ano fim veículo",
      "collection": "Coleção",
      "collection_none": "Sem coleção",
      "collection_suggest_new": "Sugerir nova coleção...",
      "new_collection_title": "Título de coleção proposto",
      "new_collection_description": "Descrição de coleção proposta"
    },
    "alt": {
      "preview_image": "Imagem de visualização de {title}",
      "no_image": "Nenhuma imagem disponível"
    },
    "no_description": "Nenhuma descrição disponível.",
    "loading_error": "Erro ao carregar o conteúdo. Tente novamente mais tarde.",
    "not_found_title": "Documento não encontrado",
    "not_found_text": "O documento que você procura não foi encontrado.",
    "back_to_documents": "Voltar aos documentos",
    "seo": {
      "title_suffix": "- Arquivo Classic Mini - Classic Mini DIY",
      "description_fallback": "Recurso de arquivo para {title} na coleção Classic Mini DIY.",
      "keywords_template": "Classic Mini, {title}, arquivo, Mini Cooper, {fileType}, {type}",
      "og_title_suffix": "- Arquivo Classic Mini"
    },
    "structured_data": {
      "author_fallback": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "collection_name": "Arquivos Classic Mini"
    }
  },
  "ru": {
    "hero_title": "Архивы Classic Mini",
    "breadcrumb_home": "Главная",
    "breadcrumb_documents": "Документы",
    "type": {
      "manual": "Руководство",
      "advert": "Реклама",
      "catalogue": "Каталог",
      "tuning": "Тюнинг",
      "electrical": "Электрика"
    },
    "stat": {
      "code": "Код",
      "publisher": "Издатель",
      "edition": "Издание",
      "pages": "Страницы",
      "language": "Язык",
      "vehicle_years": "Годы выпуска",
      "models": "Модели",
      "file_type": "Тип файла",
      "missing": "Отсутствует"
    },
    "section": {
      "details": "Детали",
      "description": "Описание",
      "collection": "В этой коллекции",
      "suggest_collection": "Коллекция",
      "actions": "Действия"
    },
    "collection": {
      "part_of": "Часть",
      "view_all": "Показать все"
    },
    "suggest_collection": {
      "prompt_title": "Знаете, к какой коллекции это относится?",
      "prompt_description": "Помогите упорядочить архив, предложив коллекцию для этого документа.",
      "cta": "Предложить коллекцию"
    },
    "action": {
      "download": "Скачать",
      "copy_link": "Копировать ссылку",
      "copied": "Скопировано!",
      "share": "Поделиться",
      "suggest_edit": "Предложить правку"
    },
    "field": {
      "title": "Название",
      "code": "Код",
      "description": "Описание",
      "author": "Автор",
      "year": "Год",
      "publisher": "Издатель",
      "edition": "Издание",
      "page_count": "Количество страниц",
      "language": "Язык",
      "vehicle_year_start": "Год начала выпуска",
      "vehicle_year_end": "Год окончания выпуска",
      "collection": "Коллекция",
      "collection_none": "Без коллекции",
      "collection_suggest_new": "Предложить новую коллекцию...",
      "new_collection_title": "Предлагаемое название коллекции",
      "new_collection_description": "Предлагаемое описание коллекции"
    },
    "alt": {
      "preview_image": "Превью изображение {title}",
      "no_image": "Изображение недоступно"
    },
    "no_description": "Описание недоступно.",
    "loading_error": "Ошибка загрузки контента. Пожалуйста, попробуйте позже.",
    "not_found_title": "Документ не найден",
    "not_found_text": "Документ, который вы ищете, не найден.",
    "back_to_documents": "Назад к документам",
    "seo": {
      "title_suffix": "- Архив Classic Mini - Classic Mini DIY",
      "description_fallback": "Архивный ресурс для {title} в коллекции Classic Mini DIY.",
      "keywords_template": "Classic Mini, {title}, архив, Mini Cooper, {fileType}, {type}",
      "og_title_suffix": "- Архив Classic Mini"
    },
    "structured_data": {
      "author_fallback": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "collection_name": "Архивы Classic Mini"
    }
  },
  "ja": {
    "hero_title": "Classic Mini アーカイブ",
    "breadcrumb_home": "ホーム",
    "breadcrumb_documents": "ドキュメント",
    "type": {
      "manual": "マニュアル",
      "advert": "広告",
      "catalogue": "カタログ",
      "tuning": "チューニング",
      "electrical": "電装"
    },
    "stat": {
      "code": "コード",
      "publisher": "出版社",
      "edition": "版",
      "pages": "ページ数",
      "language": "言語",
      "vehicle_years": "車両年式",
      "models": "モデル",
      "file_type": "ファイル形式",
      "missing": "不明"
    },
    "section": {
      "details": "詳細",
      "description": "説明",
      "collection": "このコレクション内",
      "suggest_collection": "コレクション",
      "actions": "アクション"
    },
    "collection": {
      "part_of": "所属コレクション：",
      "view_all": "すべて表示"
    },
    "suggest_collection": {
      "prompt_title": "このドキュメントがどのコレクションに属するかご存じですか？",
      "prompt_description": "このドキュメントのコレクションを提案して、アーカイブの整理にご協力ください。",
      "cta": "コレクションを提案"
    },
    "action": {
      "download": "ダウンロード",
      "copy_link": "リンクをコピー",
      "copied": "コピーしました！",
      "share": "共有",
      "suggest_edit": "編集を提案"
    },
    "field": {
      "title": "タイトル",
      "code": "コード",
      "description": "説明",
      "author": "著者",
      "year": "年",
      "publisher": "出版社",
      "edition": "版",
      "page_count": "ページ数",
      "language": "言語",
      "vehicle_year_start": "車両年式開始",
      "vehicle_year_end": "車両年式終了",
      "collection": "コレクション",
      "collection_none": "コレクションなし",
      "collection_suggest_new": "新しいコレクションを提案...",
      "new_collection_title": "提案するコレクションタイトル",
      "new_collection_description": "提案するコレクションの説明"
    },
    "alt": {
      "preview_image": "{title}のプレビュー画像",
      "no_image": "画像がありません"
    },
    "no_description": "説明がありません。",
    "loading_error": "コンテンツの読み込みエラーです。後でもう一度お試しください。",
    "not_found_title": "ドキュメントが見つかりません",
    "not_found_text": "お探しのドキュメントは見つかりませんでした。",
    "back_to_documents": "ドキュメント一覧に戻る",
    "seo": {
      "title_suffix": "- Classic Mini アーカイブ - Classic Mini DIY",
      "description_fallback": "Classic Mini DIYコレクションの{title}のアーカイブリソース。",
      "keywords_template": "Classic Mini, {title}, アーカイブ, Mini Cooper, {fileType}, {type}",
      "og_title_suffix": "- Classic Mini アーカイブ"
    },
    "structured_data": {
      "author_fallback": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "collection_name": "Classic Mini アーカイブ"
    }
  },
  "zh": {
    "hero_title": "Classic Mini 档案",
    "breadcrumb_home": "首页",
    "breadcrumb_documents": "文档",
    "type": {
      "manual": "手册",
      "advert": "广告",
      "catalogue": "目录",
      "tuning": "调校",
      "electrical": "电气"
    },
    "stat": {
      "code": "编号",
      "publisher": "出版商",
      "edition": "版本",
      "pages": "页数",
      "language": "语言",
      "vehicle_years": "车辆年份",
      "models": "型号",
      "file_type": "文件类型",
      "missing": "缺失"
    },
    "section": {
      "details": "详情",
      "description": "描述",
      "collection": "此合集中",
      "suggest_collection": "合集",
      "actions": "操作"
    },
    "collection": {
      "part_of": "属于",
      "view_all": "查看全部"
    },
    "suggest_collection": {
      "prompt_title": "知道这个文档属于哪个合集吗？",
      "prompt_description": "通过为此文档建议合集来帮助整理档案。",
      "cta": "建议合集"
    },
    "action": {
      "download": "下载",
      "copy_link": "复制链接",
      "copied": "已复制！",
      "share": "分享",
      "suggest_edit": "建议编辑"
    },
    "field": {
      "title": "标题",
      "code": "编号",
      "description": "描述",
      "author": "作者",
      "year": "年份",
      "publisher": "出版商",
      "edition": "版本",
      "page_count": "页数",
      "language": "语言",
      "vehicle_year_start": "车辆年份起始",
      "vehicle_year_end": "车辆年份结束",
      "collection": "合集",
      "collection_none": "无合集",
      "collection_suggest_new": "建议新合集...",
      "new_collection_title": "建议合集标题",
      "new_collection_description": "建议合集描述"
    },
    "alt": {
      "preview_image": "{title} 预览图片",
      "no_image": "无可用图片"
    },
    "no_description": "无可用描述。",
    "loading_error": "加载内容时出错。请稍后重试。",
    "not_found_title": "未找到文档",
    "not_found_text": "找不到您要查找的文档。",
    "back_to_documents": "返回文档列表",
    "seo": {
      "title_suffix": "- Classic Mini 档案 - Classic Mini DIY",
      "description_fallback": "Classic Mini DIY 收藏中 {title} 的档案资源。",
      "keywords_template": "Classic Mini, {title}, 档案, Mini Cooper, {fileType}, {type}",
      "og_title_suffix": "- Classic Mini 档案"
    },
    "structured_data": {
      "author_fallback": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "collection_name": "Classic Mini 档案"
    }
  },
  "ko": {
    "hero_title": "Classic Mini 아카이브",
    "breadcrumb_home": "홈",
    "breadcrumb_documents": "문서",
    "type": {
      "manual": "매뉴얼",
      "advert": "광고",
      "catalogue": "카탈로그",
      "tuning": "튜닝",
      "electrical": "전장"
    },
    "stat": {
      "code": "코드",
      "publisher": "출판사",
      "edition": "판",
      "pages": "페이지",
      "language": "언어",
      "vehicle_years": "차량 연식",
      "models": "모델",
      "file_type": "파일 형식",
      "missing": "없음"
    },
    "section": {
      "details": "상세정보",
      "description": "설명",
      "collection": "이 컬렉션의 문서",
      "suggest_collection": "컬렉션",
      "actions": "작업"
    },
    "collection": {
      "part_of": "소속 컬렉션:",
      "view_all": "전체 보기"
    },
    "suggest_collection": {
      "prompt_title": "이 문서가 어느 컬렉션에 속하는지 아십니까?",
      "prompt_description": "이 문서의 컬렉션을 제안하여 아카이브 정리를 도와주세요.",
      "cta": "컬렉션 제안"
    },
    "action": {
      "download": "다운로드",
      "copy_link": "링크 복사",
      "copied": "복사됨!",
      "share": "공유",
      "suggest_edit": "편집 제안"
    },
    "field": {
      "title": "제목",
      "code": "코드",
      "description": "설명",
      "author": "저자",
      "year": "연도",
      "publisher": "출판사",
      "edition": "판",
      "page_count": "페이지 수",
      "language": "언어",
      "vehicle_year_start": "차량 연식 시작",
      "vehicle_year_end": "차량 연식 종료",
      "collection": "컬렉션",
      "collection_none": "컬렉션 없음",
      "collection_suggest_new": "새 컬렉션 제안...",
      "new_collection_title": "제안된 컬렉션 제목",
      "new_collection_description": "제안된 컬렉션 설명"
    },
    "alt": {
      "preview_image": "{title} 미리보기 이미지",
      "no_image": "사용 가능한 이미지가 없습니다"
    },
    "no_description": "사용 가능한 설명이 없습니다.",
    "loading_error": "콘텐츠 로딩 중 오류가 발생했습니다. 나중에 다시 시도해 주세요.",
    "not_found_title": "문서를 찾을 수 없습니다",
    "not_found_text": "찾고 있는 문서를 찾을 수 없습니다.",
    "back_to_documents": "문서 목록으로 돌아가기",
    "seo": {
      "title_suffix": "- Classic Mini 아카이브 - Classic Mini DIY",
      "description_fallback": "Classic Mini DIY 컬렉션의 {title} 아카이브 리소스.",
      "keywords_template": "Classic Mini, {title}, 아카이브, Mini Cooper, {fileType}, {type}",
      "og_title_suffix": "- Classic Mini 아카이브"
    },
    "structured_data": {
      "author_fallback": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "collection_name": "Classic Mini 아카이브"
    }
  }
}
</i18n>
