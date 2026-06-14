<script setup lang="ts">
  import { HERO_TYPES } from '~~/data/models/generic';
  import { type ModelDetail, type ModelFileInfo, priceLabel, formatBytes } from '~~/data/models/model-library';

  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const slug = computed(() => String(route.params.slug));
  const { isAuthenticated, user } = useAuth();
  const supabase = useSupabase();
  const { verifyPurchase, downloadFile, downloadAll } = useModelCheckout();

  const { data, error } = await useFetch<ModelDetail>(() => `/api/models/${slug.value}`);
  if (error.value) {
    throw createError({ statusCode: error.value.statusCode || 404, statusMessage: 'Model not found', fatal: true });
  }
  const model = computed(() => data.value);

  const renderableFiles = computed(() => model.value?.files.filter((f) => f.isRenderable) ?? []);
  const isFree = computed(() => (model.value ? ['free', 'tips'].includes(model.value.pricingMode) : false));
  const price = computed(() => (model.value ? priceLabel(model.value) : ''));

  // Downloads go through an authed fetch (the session is in localStorage, so a
  // bare <a href> can't carry the token) → presigned URL → browser download.
  const downloadError = ref<string | null>(null);
  const downloading = ref<string | null>(null);
  async function onDownload(file: ModelFileInfo) {
    if (!model.value) return;
    downloadError.value = null;
    downloading.value = file.id;
    const msg = await downloadFile(model.value.id, file.id);
    if (msg) downloadError.value = msg;
    downloading.value = null;
  }

  // Group the file list by kind (model | source | document) — Print files first,
  // then Source & CAD, then Documents — so a multi-file model reads cleanly.
  const FILE_GROUP_ORDER = ['model', 'source', 'document'] as const;
  const fileGroups = computed(() => {
    const files = model.value?.files ?? [];
    const known = new Set<string>(FILE_GROUP_ORDER);
    const groups = FILE_GROUP_ORDER.map((kind) => ({ kind, files: files.filter((f) => f.kind === kind) }));
    const other = files.filter((f) => !known.has(f.kind));
    if (other.length) groups.push({ kind: 'other' as any, files: other });
    return groups.filter((g) => g.files.length > 0);
  });

  const downloadingAll = ref(false);
  async function onDownloadAll() {
    if (!model.value) return;
    downloadError.value = null;
    downloadingAll.value = true;
    const files = model.value.files.map((f) => ({ id: f.id, fileName: f.fileName }));
    const msg = await downloadAll(model.value.id, files, `${model.value.slug || 'model'}.zip`);
    if (msg) downloadError.value = msg;
    downloadingAll.value = false;
  }

  const isOwner = computed(() => !!user.value && model.value?.author?.id === user.value.id);
  const acceptsTips = computed(() => !!model.value && model.value.pricingMode !== 'free');

  // Whether the viewer may download. Free/tips and the owner are always allowed;
  // paid models need a purchase, confirmed by the has_model_entitlement RPC
  // (auto-authed via PostgREST). Seeded so free models show downloads on SSR.
  const entitled = ref(isFree.value);
  async function refreshEntitlement() {
    if (!model.value) return;
    if (isFree.value || isOwner.value) {
      entitled.value = true;
      return;
    }
    if (!isAuthenticated.value) {
      entitled.value = false;
      return;
    }
    const { data } = await supabase.rpc('has_model_entitlement', { p_model_id: model.value.id });
    entitled.value = !!data;
  }

  // Success-page handling: the Stripe redirect lands back here with
  // ?purchase=success&session_id=… — verify (webhook-lag fallback) then unlock.
  const purchaseNotice = ref<{ type: 'success' | 'info'; text: string } | null>(null);
  async function handlePurchaseReturn() {
    const q = route.query;
    if (q.purchase === 'success') {
      const sid = typeof q.session_id === 'string' ? q.session_id : '';
      if (sid && model.value) {
        const res = await verifyPurchase(model.value.id, sid);
        if (res.verified) {
          purchaseNotice.value = {
            type: 'success',
            text: res.kind === 'tip' ? t('notice.thankYouTip') : t('notice.purchaseComplete'),
          };
          await refreshEntitlement();
        } else {
          purchaseNotice.value = {
            type: 'info',
            text: t('notice.paymentPending'),
          };
        }
      } else {
        purchaseNotice.value = { type: 'success', text: t('notice.thankYouSupport') };
      }
      router.replace({ query: {} });
    } else if (q.purchase === 'cancelled') {
      purchaseNotice.value = { type: 'info', text: t('notice.checkoutCancelled') };
      router.replace({ query: {} });
    }
  }

  onMounted(async () => {
    await refreshEntitlement();
    await handlePurchaseReturn();
  });
  watch(isAuthenticated, () => refreshEntitlement());

  // Media area: a renderable file (3D) or a gallery image. Driven by a watcher so
  // it re-initializes if the page component is reused across /models/[slug]
  // navigations (the model data changes but setup runs only once).
  type Media = { kind: '3d'; file: ModelFileInfo } | { kind: 'image'; url: string; alt: string };
  const activeMedia = ref<Media | null>(null);
  function initMedia() {
    const m = model.value;
    if (!m) {
      activeMedia.value = null;
      return;
    }
    if (renderableFiles.value.length) activeMedia.value = { kind: '3d', file: renderableFiles.value[0]! };
    else if (m.images.length)
      activeMedia.value = { kind: 'image', url: m.images[0]!.url, alt: m.images[0]!.altText || m.title };
    else activeMedia.value = null;
  }
  watch(model, initMedia, { immediate: true });

  const fileExtIcon: Record<string, string> = {
    stl: 'fa-cube',
    '3mf': 'fa-cube',
    obj: 'fa-cube',
    step: 'fa-drafting-compass',
    stp: 'fa-drafting-compass',
    f3d: 'fa-drafting-compass',
    f3z: 'fa-drafting-compass',
    pdf: 'fa-file-pdf',
  };

  useHead(() => ({ title: `${model.value?.title ?? t('meta.defaultTitle')} | Classic Mini DIY` }));
  useSeoMeta({
    title: () => `${model.value?.title ?? t('meta.defaultTitle')} | Classic Mini DIY`,
    description: () => model.value?.summary || t('meta.defaultDescription'),
    ogTitle: () => model.value?.title,
    ogDescription: () => model.value?.summary || '',
    ogImage: () => model.value?.images?.[0]?.url || '',
    ogType: 'article',
  });
</script>

<template>
  <hero :navigation="true" :title="t('hero.title')" :heroType="HERO_TYPES.ARCHIVE" />
  <div class="container mx-auto px-4" v-if="model">
    <breadcrumb class="my-6" :page="model.title" :subpage="t('breadcrumb.subpage')" subpageHref="/models" />

    <!-- MakerWorld-style layout: media + content on the left, a sticky action
         panel on the right. On mobile the action panel sits right under the
         media (explicit grid row placement) so Download is never buried. -->
    <div class="grid grid-cols-12 gap-6 items-start">
      <!-- MEDIA (mobile: first; desktop: top-left) -->
      <div class="col-span-12 lg:col-span-8 lg:col-start-1 lg:row-start-1 space-y-3">
        <div v-if="activeMedia?.kind === '3d'">
          <ModelsModelViewer3D
            :key="activeMedia.file.id"
            :model-id="model.id"
            :file-id="activeMedia.file.id"
            :file-ext="activeMedia.file.fileExt"
            :file-name="activeMedia.file.fileName"
            :size-bytes="activeMedia.file.sizeBytes"
          />
        </div>
        <div
          v-else-if="activeMedia?.kind === 'image'"
          class="rounded-xl overflow-hidden border border-base-300 bg-base-200"
          style="aspect-ratio: 4 / 3"
        >
          <img :src="activeMedia.url" :alt="activeMedia.alt" class="w-full h-full object-contain" />
        </div>
        <div
          v-else
          class="rounded-xl border border-base-300 bg-base-200 flex items-center justify-center"
          style="aspect-ratio: 4 / 3"
        >
          <i class="fas fa-cube text-5xl opacity-20"></i>
        </div>

        <!-- Thumbnail strip -->
        <div v-if="renderableFiles.length + model.images.length > 1" class="flex flex-wrap gap-2">
          <button
            v-for="file in renderableFiles"
            :key="file.id"
            class="w-16 h-16 rounded-lg border-2 flex flex-col items-center justify-center text-xs gap-0.5"
            :class="
              activeMedia?.kind === '3d' && activeMedia.file.id === file.id
                ? 'border-primary bg-primary/10'
                : 'border-base-300 hover:border-primary/50'
            "
            @click="activeMedia = { kind: '3d', file }"
          >
            <i class="fas fa-cube"></i>
            <span class="uppercase opacity-60">{{ file.fileExt }}</span>
          </button>
          <button
            v-for="img in model.images"
            :key="img.id"
            class="w-16 h-16 rounded-lg border-2 overflow-hidden"
            :class="
              activeMedia?.kind === 'image' && activeMedia.url === img.url
                ? 'border-primary'
                : 'border-base-300 hover:border-primary/50'
            "
            @click="activeMedia = { kind: 'image', url: img.url, alt: img.altText || model.title }"
          >
            <img :src="img.url" :alt="img.altText || model.title" class="w-full h-full object-cover" loading="lazy" />
          </button>
        </div>
      </div>

      <!-- ACTION PANEL (mobile: right after media; desktop: right column, sticky,
           spanning both rows so it stays beside the content below) -->
      <div class="col-span-12 lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:row-span-2">
        <div class="lg:sticky lg:top-4 space-y-4">
          <!-- Title + summary -->
          <div>
            <h1 class="text-2xl font-bold leading-tight">{{ model.title }}</h1>
            <p v-if="model.summary" class="mt-1 text-sm opacity-70">{{ model.summary }}</p>
          </div>

          <!-- Author -->
          <div v-if="model.author" class="flex items-center gap-2">
            <img
              v-if="model.author.avatarUrl"
              :src="model.author.avatarUrl"
              class="w-8 h-8 rounded-full object-cover"
              :alt="model.author.displayName || t('author.fallback')"
            />
            <i v-else class="fas fa-circle-user text-2xl opacity-60"></i>
            <span class="text-sm"
              >{{ t('author.by') }} <strong>{{ model.author.displayName || model.author.username || t('author.anonymous') }}</strong></span
            >
          </div>

          <!-- Stats + report -->
          <div class="flex items-center gap-3 flex-wrap text-sm">
            <ModelsModelLikeButton :model-id="model.id" :initial-count="model.likeCount" />
            <span class="opacity-70"><i class="fas fa-comment mr-1"></i>{{ model.commentCount }}</span>
            <span class="opacity-70"><i class="fas fa-download mr-1"></i>{{ model.downloadCount }}</span>
            <span v-if="model.versionCount > 1" class="opacity-70">
              <i class="fas fa-code-branch mr-1"></i>v{{ model.version?.versionNumber }}
            </span>
            <ModelsModelReportModal :model-id="model.id" class="ml-auto" />
          </div>

          <!-- ACTION CARD: price + the hero Download / Buy CTA -->
          <div class="card bg-base-100 border border-base-300 shadow-md">
            <div class="card-body p-5 gap-4">
              <div class="flex items-start justify-between gap-2">
                <span class="text-3xl font-bold" :class="isFree ? 'text-success' : 'text-primary'">{{ price }}</span>
                <span v-if="isOwner" class="badge badge-neutral badge-sm shrink-0 whitespace-nowrap">{{ t('pricing.yourModel') }}</span>
                <span v-else-if="entitled && !isFree" class="badge badge-success badge-sm shrink-0 whitespace-nowrap">
                  <i class="fas fa-check mr-1"></i> {{ t('pricing.purchased') }}
                </span>
                <span v-else class="text-xs opacity-60 text-right">{{ t('pricing.buyersGetAllVersions') }}</span>
              </div>

              <div
                v-if="purchaseNotice"
                role="alert"
                class="alert alert-soft py-2 text-sm"
                :class="purchaseNotice.type === 'success' ? 'alert-success' : 'alert-info'"
              >
                <i class="fas" :class="purchaseNotice.type === 'success' ? 'fa-circle-check' : 'fa-circle-info'"></i>
                <span>{{ purchaseNotice.text }}</span>
              </div>

              <template v-if="entitled">
                <template v-if="isAuthenticated">
                  <!-- Single file: one big "Download <FORMAT>" button -->
                  <button
                    v-if="model.files.length === 1 && model.files[0]"
                    type="button"
                    class="btn btn-primary btn-lg btn-block gap-2"
                    :disabled="downloading === model.files[0].id"
                    @click="onDownload(model.files[0])"
                  >
                    <span v-if="downloading === model.files[0].id" class="loading loading-spinner loading-sm"></span>
                    <i v-else class="fas fa-download"></i>
                    {{ t('download.cta') }} {{ model.files[0].fileExt.toUpperCase() }}
                  </button>
                  <!-- Multiple files: one-click "Download all" zip + per-kind groups -->
                  <template v-else>
                    <button
                      type="button"
                      class="btn btn-primary btn-lg btn-block gap-2"
                      :disabled="downloadingAll || downloading !== null"
                      @click="onDownloadAll"
                    >
                      <span v-if="downloadingAll" class="loading loading-spinner loading-sm"></span>
                      <i v-else class="fas fa-file-zipper"></i>
                      {{ t('download.all') }}
                      <span class="text-sm font-normal opacity-70">· {{ model.files.length }}</span>
                    </button>

                    <div v-for="group in fileGroups" :key="group.kind" class="space-y-1.5">
                      <p class="text-xs font-semibold uppercase tracking-wide opacity-50">
                        {{ t(`download.group.${group.kind}`) }}
                      </p>
                      <button
                        v-for="file in group.files"
                        :key="file.id"
                        type="button"
                        class="btn btn-outline btn-block justify-between gap-2"
                        :disabled="downloading === file.id || downloadingAll"
                        @click="onDownload(file)"
                      >
                        <span class="flex items-center gap-2 min-w-0">
                          <i class="fas" :class="fileExtIcon[file.fileExt] || 'fa-file'"></i>
                          <span class="truncate">{{ file.fileName }}</span>
                        </span>
                        <span class="flex items-center gap-2 shrink-0 text-xs opacity-70">
                          {{ formatBytes(file.sizeBytes) }}
                          <span v-if="downloading === file.id" class="loading loading-spinner loading-xs"></span>
                          <i v-else class="fas fa-download"></i>
                        </span>
                      </button>
                    </div>
                  </template>
                  <div v-if="downloadError" role="alert" class="alert alert-error alert-soft py-2 text-sm">
                    <i class="fas fa-circle-exclamation"></i><span>{{ downloadError }}</span>
                  </div>
                </template>
                <!-- Free model, not signed in: route to login instead of a raw 401 -->
                <NuxtLink v-else to="/login" class="btn btn-primary btn-lg btn-block gap-2">
                  <i class="fas fa-right-to-bracket"></i> {{ t('download.signInCta') }}
                </NuxtLink>
              </template>

              <ModelsPriceBox v-else :model="model" />
            </div>
          </div>

          <!-- Safety -->
          <ModelsSafetyDisclaimer :safety-critical="model.safetyCritical" />

          <!-- License summary (MakerWorld-style: see the terms before downloading) -->
          <div class="card bg-base-100 border border-base-300 shadow-sm">
            <div class="card-body p-4 gap-3">
              <h3 class="text-xs font-semibold uppercase tracking-wide opacity-50">{{ t('license.heading') }}</h3>
              <ModelsLicenseBadge :license="model.license" />
              <p v-if="model.license.text" class="text-xs leading-relaxed opacity-70 whitespace-pre-line">
                {{ model.license.text }}
              </p>
              <NuxtLink
                v-if="model.license.isPaid"
                to="/legal/paid-file-license"
                class="text-xs link link-hover opacity-70"
              >
                <i class="fas fa-scale-balanced mr-1"></i> {{ t('license.paidTerms') }}
              </NuxtLink>
            </div>
          </div>

          <!-- Tips -->
          <ModelsTipPicker v-if="acceptsTips && !isOwner" :model-id="model.id" :currency="model.currency" />

          <!-- Tags -->
          <div v-if="model.tags.length" class="flex flex-wrap gap-1.5">
            <span v-for="tag in model.tags" :key="tag" class="badge badge-ghost badge-sm">#{{ tag }}</span>
          </div>
        </div>
      </div>

      <!-- CONTENT (below the media on the left column) -->
      <div class="col-span-12 lg:col-span-8 lg:col-start-1 lg:row-start-2 space-y-6">
        <!-- Description -->
        <div v-if="model.description" class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h2 class="card-title text-lg"><i class="fas fa-align-left text-primary mr-1"></i> {{ t('about.heading') }}</h2>
            <p class="whitespace-pre-line text-sm leading-relaxed">{{ model.description }}</p>
            <a
              v-if="model.sourceUrl"
              :href="model.sourceUrl"
              target="_blank"
              rel="noopener noreferrer nofollow"
              class="link link-primary text-sm mt-2"
            >
              <i class="fas fa-link mr-1"></i> {{ t('about.sourceLink') }}
            </a>
          </div>
        </div>

        <ModelsModelPrintSettings :settings="model.version?.printSettings ?? null" />
        <ModelsModelHardwareBom :items="model.version?.hardwareBom ?? []" />
        <ModelsModelAssembly :assembly="model.version?.assembly ?? null" />

        <!-- Changelog -->
        <div v-if="model.version?.changelog" class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h3 class="card-title text-lg">
              <i class="fas fa-code-branch text-primary mr-1"></i> {{ t('changelog.heading', { version: model.version.versionNumber }) }}
            </h3>
            <p class="whitespace-pre-line text-sm opacity-80">{{ model.version.changelog }}</p>
          </div>
        </div>

        <!-- Comments -->
        <ModelsModelComments :model-id="model.id" />
      </div>
    </div>

    <!-- Support -->
    <div class="md:w-10/12 md:mx-auto pb-10 pt-6">
      <patreon-card size="large" />
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "hero": { "title": "3D Model Library" },
    "breadcrumb": { "subpage": "3D Models" },
    "meta": {
      "defaultTitle": "3D Model",
      "defaultDescription": "A 3D-printable part for the Classic Mini."
    },
    "author": {
      "fallback": "Author",
      "by": "by",
      "anonymous": "Anonymous"
    },
    "pricing": {
      "yourModel": "Your model",
      "purchased": "Purchased",
      "buyersGetAllVersions": "buyers get every version"
    },
    "download": {
      "cta": "Download",
      "signInCta": "Sign in to download",
      "filesHeading": "Files ({count})",
      "all": "Download all",
      "group": { "model": "Print files", "source": "Source & CAD", "document": "Documents", "other": "Other files" }
    },
    "notice": {
      "purchaseComplete": "Purchase complete — your files are unlocked below.",
      "thankYouTip": "Thank you for the tip!",
      "paymentPending": "Payment received — we're finalizing it. If your files aren't unlocked, refresh in a moment.",
      "thankYouSupport": "Thanks for your support!",
      "checkoutCancelled": "Checkout cancelled."
    },
    "license": {
      "heading": "License",
      "viewTxt": "View LICENSE.txt",
      "paidTerms": "Paid File License terms"
    },
    "about": {
      "heading": "About this model",
      "sourceLink": "Source / original design"
    },
    "changelog": {
      "heading": "v{version} changelog"
    }
  },
  "es": {
    "hero": { "title": "Biblioteca de modelos 3D" },
    "breadcrumb": { "subpage": "Modelos 3D" },
    "meta": {
      "defaultTitle": "Modelo 3D",
      "defaultDescription": "Una pieza imprimible en 3D para el Classic Mini."
    },
    "author": {
      "fallback": "Autor",
      "by": "por",
      "anonymous": "Anónimo"
    },
    "pricing": {
      "yourModel": "Tu modelo",
      "purchased": "Comprado",
      "buyersGetAllVersions": "los compradores obtienen todas las versiones"
    },
    "download": {
      "cta": "Descargar",
      "signInCta": "Inicia sesión para descargar",
      "filesHeading": "Archivos ({count})",
      "all": "Descargar todo",
      "group": { "model": "Archivos de impresión", "source": "Fuente y CAD", "document": "Documentos", "other": "Otros archivos" }
    },
    "notice": {
      "purchaseComplete": "Compra completada — tus archivos están desbloqueados abajo.",
      "thankYouTip": "¡Gracias por la propina!",
      "paymentPending": "Pago recibido — lo estamos procesando. Si tus archivos no se desbloquean, actualiza en un momento.",
      "thankYouSupport": "¡Gracias por tu apoyo!",
      "checkoutCancelled": "Pago cancelado."
    },
    "license": {
      "heading": "Licencia",
      "viewTxt": "Ver LICENSE.txt",
      "paidTerms": "Términos de licencia de archivo de pago"
    },
    "about": {
      "heading": "Acerca de este modelo",
      "sourceLink": "Fuente / diseño original"
    },
    "changelog": {
      "heading": "Registro de cambios v{version}"
    }
  },
  "fr": {
    "hero": { "title": "Bibliothèque de modèles 3D" },
    "breadcrumb": { "subpage": "Modèles 3D" },
    "meta": {
      "defaultTitle": "Modèle 3D",
      "defaultDescription": "Une pièce imprimable en 3D pour la Classic Mini."
    },
    "author": {
      "fallback": "Auteur",
      "by": "par",
      "anonymous": "Anonyme"
    },
    "pricing": {
      "yourModel": "Votre modèle",
      "purchased": "Acheté",
      "buyersGetAllVersions": "les acheteurs obtiennent toutes les versions"
    },
    "download": {
      "cta": "Télécharger",
      "signInCta": "Connectez-vous pour télécharger",
      "filesHeading": "Fichiers ({count})",
      "all": "Tout télécharger",
      "group": { "model": "Fichiers d'impression", "source": "Source et CAO", "document": "Documents", "other": "Autres fichiers" }
    },
    "notice": {
      "purchaseComplete": "Achat effectué — vos fichiers sont déverrouillés ci-dessous.",
      "thankYouTip": "Merci pour le pourboire !",
      "paymentPending": "Paiement reçu — nous finalisons. Si vos fichiers ne sont pas déverrouillés, actualisez dans un instant.",
      "thankYouSupport": "Merci pour votre soutien !",
      "checkoutCancelled": "Paiement annulé."
    },
    "license": {
      "heading": "Licence",
      "viewTxt": "Voir LICENSE.txt",
      "paidTerms": "Conditions de licence fichier payant"
    },
    "about": {
      "heading": "À propos de ce modèle",
      "sourceLink": "Source / design original"
    },
    "changelog": {
      "heading": "Journal des modifications v{version}"
    }
  },
  "de": {
    "hero": { "title": "3D-Modellbibliothek" },
    "breadcrumb": { "subpage": "3D-Modelle" },
    "meta": {
      "defaultTitle": "3D-Modell",
      "defaultDescription": "Ein 3D-druckbares Teil für den Classic Mini."
    },
    "author": {
      "fallback": "Autor",
      "by": "von",
      "anonymous": "Anonym"
    },
    "pricing": {
      "yourModel": "Dein Modell",
      "purchased": "Gekauft",
      "buyersGetAllVersions": "Käufer erhalten alle Versionen"
    },
    "download": {
      "cta": "Herunterladen",
      "signInCta": "Zum Herunterladen anmelden",
      "filesHeading": "Dateien ({count})",
      "all": "Alle herunterladen",
      "group": { "model": "Druckdateien", "source": "Quelle & CAD", "document": "Dokumente", "other": "Weitere Dateien" }
    },
    "notice": {
      "purchaseComplete": "Kauf abgeschlossen — deine Dateien sind unten freigeschaltet.",
      "thankYouTip": "Danke für das Trinkgeld!",
      "paymentPending": "Zahlung eingegangen — wir schließen ab. Falls deine Dateien noch gesperrt sind, aktualisiere in einem Moment.",
      "thankYouSupport": "Danke für deine Unterstützung!",
      "checkoutCancelled": "Checkout abgebrochen."
    },
    "license": {
      "heading": "Lizenz",
      "viewTxt": "LICENSE.txt ansehen",
      "paidTerms": "Lizenzbedingungen für kostenpflichtige Dateien"
    },
    "about": {
      "heading": "Über dieses Modell",
      "sourceLink": "Quelle / Originaldesign"
    },
    "changelog": {
      "heading": "v{version} Änderungsprotokoll"
    }
  },
  "it": {
    "hero": { "title": "Libreria di modelli 3D" },
    "breadcrumb": { "subpage": "Modelli 3D" },
    "meta": {
      "defaultTitle": "Modello 3D",
      "defaultDescription": "Un pezzo stampabile in 3D per la Classic Mini."
    },
    "author": {
      "fallback": "Autore",
      "by": "di",
      "anonymous": "Anonimo"
    },
    "pricing": {
      "yourModel": "Il tuo modello",
      "purchased": "Acquistato",
      "buyersGetAllVersions": "gli acquirenti ricevono ogni versione"
    },
    "download": {
      "cta": "Scarica",
      "signInCta": "Accedi per scaricare",
      "filesHeading": "File ({count})",
      "all": "Scarica tutto",
      "group": { "model": "File di stampa", "source": "Sorgente e CAD", "document": "Documenti", "other": "Altri file" }
    },
    "notice": {
      "purchaseComplete": "Acquisto completato — i tuoi file sono sbloccati qui sotto.",
      "thankYouTip": "Grazie per la mancia!",
      "paymentPending": "Pagamento ricevuto — stiamo finalizzando. Se i file non si sbloccano, aggiorna tra un momento.",
      "thankYouSupport": "Grazie per il tuo supporto!",
      "checkoutCancelled": "Checkout annullato."
    },
    "license": {
      "heading": "Licenza",
      "viewTxt": "Visualizza LICENSE.txt",
      "paidTerms": "Termini della licenza file a pagamento"
    },
    "about": {
      "heading": "Informazioni su questo modello",
      "sourceLink": "Fonte / design originale"
    },
    "changelog": {
      "heading": "Changelog v{version}"
    }
  },
  "pt": {
    "hero": { "title": "Biblioteca de modelos 3D" },
    "breadcrumb": { "subpage": "Modelos 3D" },
    "meta": {
      "defaultTitle": "Modelo 3D",
      "defaultDescription": "Uma peça impressa em 3D para o Classic Mini."
    },
    "author": {
      "fallback": "Autor",
      "by": "por",
      "anonymous": "Anônimo"
    },
    "pricing": {
      "yourModel": "Seu modelo",
      "purchased": "Comprado",
      "buyersGetAllVersions": "compradores recebem todas as versões"
    },
    "download": {
      "cta": "Baixar",
      "signInCta": "Entre para baixar",
      "filesHeading": "Arquivos ({count})",
      "all": "Baixar tudo",
      "group": { "model": "Arquivos de impressão", "source": "Fonte e CAD", "document": "Documentos", "other": "Outros arquivos" }
    },
    "notice": {
      "purchaseComplete": "Compra concluída — seus arquivos estão desbloqueados abaixo.",
      "thankYouTip": "Obrigado pela gorjeta!",
      "paymentPending": "Pagamento recebido — estamos finalizando. Se seus arquivos não forem desbloqueados, atualize em um momento.",
      "thankYouSupport": "Obrigado pelo seu apoio!",
      "checkoutCancelled": "Checkout cancelado."
    },
    "license": {
      "heading": "Licença",
      "viewTxt": "Ver LICENSE.txt",
      "paidTerms": "Termos da licença de arquivo pago"
    },
    "about": {
      "heading": "Sobre este modelo",
      "sourceLink": "Fonte / design original"
    },
    "changelog": {
      "heading": "Changelog v{version}"
    }
  },
  "ru": {
    "hero": { "title": "Библиотека 3D-моделей" },
    "breadcrumb": { "subpage": "3D-модели" },
    "meta": {
      "defaultTitle": "3D-модель",
      "defaultDescription": "Деталь для печати на 3D-принтере для Classic Mini."
    },
    "author": {
      "fallback": "Автор",
      "by": "автор:",
      "anonymous": "Аноним"
    },
    "pricing": {
      "yourModel": "Ваша модель",
      "purchased": "Куплено",
      "buyersGetAllVersions": "покупатели получают все версии"
    },
    "download": {
      "cta": "Скачать",
      "signInCta": "Войдите, чтобы скачать",
      "filesHeading": "Файлы ({count})",
      "all": "Скачать всё",
      "group": { "model": "Файлы для печати", "source": "Исходники и CAD", "document": "Документы", "other": "Другие файлы" }
    },
    "notice": {
      "purchaseComplete": "Покупка завершена — ваши файлы разблокированы ниже.",
      "thankYouTip": "Спасибо за чаевые!",
      "paymentPending": "Платёж получен — мы завершаем обработку. Если файлы не разблокированы, обновите страницу через мгновение.",
      "thankYouSupport": "Спасибо за вашу поддержку!",
      "checkoutCancelled": "Оформление заказа отменено."
    },
    "license": {
      "heading": "Лицензия",
      "viewTxt": "Просмотреть LICENSE.txt",
      "paidTerms": "Условия лицензии на платный файл"
    },
    "about": {
      "heading": "Об этой модели",
      "sourceLink": "Источник / оригинальный дизайн"
    },
    "changelog": {
      "heading": "Журнал изменений v{version}"
    }
  },
  "ja": {
    "hero": { "title": "3Dモデルライブラリ" },
    "breadcrumb": { "subpage": "3Dモデル" },
    "meta": {
      "defaultTitle": "3Dモデル",
      "defaultDescription": "クラシックミニ用の3Dプリント可能なパーツ。"
    },
    "author": {
      "fallback": "作者",
      "by": "作成者：",
      "anonymous": "匿名"
    },
    "pricing": {
      "yourModel": "あなたのモデル",
      "purchased": "購入済み",
      "buyersGetAllVersions": "購入者はすべてのバージョンを取得できます"
    },
    "download": {
      "cta": "ダウンロード",
      "signInCta": "ダウンロードするにはサインイン",
      "filesHeading": "ファイル ({count})",
      "all": "すべてダウンロード",
      "group": { "model": "印刷ファイル", "source": "ソース・CAD", "document": "ドキュメント", "other": "その他のファイル" }
    },
    "notice": {
      "purchaseComplete": "購入完了 — ファイルは以下でダウンロードできます。",
      "thankYouTip": "チップをありがとうございます！",
      "paymentPending": "支払いを受け付けました。処理中です。ファイルがまだロックされている場合は、しばらくしてから更新してください。",
      "thankYouSupport": "ご支援ありがとうございます！",
      "checkoutCancelled": "チェックアウトがキャンセルされました。"
    },
    "license": {
      "heading": "ライセンス",
      "viewTxt": "LICENSE.txtを表示",
      "paidTerms": "有料ファイルライセンス条項"
    },
    "about": {
      "heading": "このモデルについて",
      "sourceLink": "ソース / オリジナルデザイン"
    },
    "changelog": {
      "heading": "v{version} 変更履歴"
    }
  },
  "zh": {
    "hero": { "title": "3D模型库" },
    "breadcrumb": { "subpage": "3D模型" },
    "meta": {
      "defaultTitle": "3D模型",
      "defaultDescription": "适用于经典迷你的3D打印零件。"
    },
    "author": {
      "fallback": "作者",
      "by": "作者：",
      "anonymous": "匿名"
    },
    "pricing": {
      "yourModel": "您的模型",
      "purchased": "已购买",
      "buyersGetAllVersions": "购买者可获得所有版本"
    },
    "download": {
      "cta": "下载",
      "signInCta": "登录以下载",
      "filesHeading": "文件 ({count})",
      "all": "全部下载",
      "group": { "model": "打印文件", "source": "源文件与CAD", "document": "文档", "other": "其他文件" }
    },
    "notice": {
      "purchaseComplete": "购买完成 — 您的文件已在下方解锁。",
      "thankYouTip": "感谢您的打赏！",
      "paymentPending": "已收到付款 — 我们正在处理中。如果文件尚未解锁，请稍后刷新。",
      "thankYouSupport": "感谢您的支持！",
      "checkoutCancelled": "结账已取消。"
    },
    "license": {
      "heading": "许可证",
      "viewTxt": "查看 LICENSE.txt",
      "paidTerms": "付费文件许可条款"
    },
    "about": {
      "heading": "关于此模型",
      "sourceLink": "来源 / 原始设计"
    },
    "changelog": {
      "heading": "v{version} 更新日志"
    }
  },
  "ko": {
    "hero": { "title": "3D 모델 라이브러리" },
    "breadcrumb": { "subpage": "3D 모델" },
    "meta": {
      "defaultTitle": "3D 모델",
      "defaultDescription": "클래식 미니용 3D 프린팅 부품."
    },
    "author": {
      "fallback": "작성자",
      "by": "작성:",
      "anonymous": "익명"
    },
    "pricing": {
      "yourModel": "내 모델",
      "purchased": "구매 완료",
      "buyersGetAllVersions": "구매자는 모든 버전을 받습니다"
    },
    "download": {
      "cta": "다운로드",
      "signInCta": "다운로드하려면 로그인",
      "filesHeading": "파일 ({count})",
      "all": "모두 다운로드",
      "group": { "model": "프린트 파일", "source": "소스 및 CAD", "document": "문서", "other": "기타 파일" }
    },
    "notice": {
      "purchaseComplete": "구매 완료 — 파일이 아래에서 잠금 해제되었습니다.",
      "thankYouTip": "팁 감사합니다!",
      "paymentPending": "결제가 접수되었습니다 — 처리 중입니다. 파일이 잠금 해제되지 않으면 잠시 후 새로 고침하세요.",
      "thankYouSupport": "지원해 주셔서 감사합니다!",
      "checkoutCancelled": "결제가 취소되었습니다."
    },
    "license": {
      "heading": "라이선스",
      "viewTxt": "LICENSE.txt 보기",
      "paidTerms": "유료 파일 라이선스 조항"
    },
    "about": {
      "heading": "이 모델에 대하여",
      "sourceLink": "출처 / 원본 디자인"
    },
    "changelog": {
      "heading": "v{version} 변경 로그"
    }
  }
}
</i18n>
