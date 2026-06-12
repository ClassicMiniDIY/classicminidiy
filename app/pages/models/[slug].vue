<script setup lang="ts">
  import { HERO_TYPES } from '~~/data/models/generic';
  import { type ModelDetail, type ModelFileInfo, priceLabel, formatBytes } from '~~/data/models/model-library';

  const route = useRoute();
  const router = useRouter();
  const slug = computed(() => String(route.params.slug));
  const { isAuthenticated, user } = useAuth();
  const supabase = useSupabase();
  const { verifyPurchase } = useModelCheckout();

  const { data, error } = await useFetch<ModelDetail>(() => `/api/models/${slug.value}`);
  if (error.value) {
    throw createError({ statusCode: error.value.statusCode || 404, statusMessage: 'Model not found', fatal: true });
  }
  const model = computed(() => data.value);

  const renderableFiles = computed(() => model.value?.files.filter((f) => f.isRenderable) ?? []);
  const isFree = computed(() => (model.value ? ['free', 'tips'].includes(model.value.pricingMode) : false));
  const price = computed(() => (model.value ? priceLabel(model.value) : ''));
  const licenseTxtUrl = computed(() =>
    model.value?.version ? `/api/models/${model.value.id}/versions/${model.value.version.id}/license.txt` : null
  );

  function downloadUrl(fileId: string) {
    return `/api/models/${model.value?.id}/files/${fileId}/download`;
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
            text: res.kind === 'tip' ? 'Thank you for the tip!' : 'Purchase complete — your files are unlocked below.',
          };
          await refreshEntitlement();
        } else {
          purchaseNotice.value = {
            type: 'info',
            text: "Payment received — we're finalizing it. If your files aren't unlocked, refresh in a moment.",
          };
        }
      } else {
        purchaseNotice.value = { type: 'success', text: 'Thanks for your support!' };
      }
      router.replace({ query: {} });
    } else if (q.purchase === 'cancelled') {
      purchaseNotice.value = { type: 'info', text: 'Checkout cancelled.' };
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

  useHead(() => ({ title: `${model.value?.title ?? '3D Model'} | Classic Mini DIY` }));
  useSeoMeta({
    title: () => `${model.value?.title ?? '3D Model'} | Classic Mini DIY`,
    description: () => model.value?.summary || 'A 3D-printable part for the Classic Mini.',
    ogTitle: () => model.value?.title,
    ogDescription: () => model.value?.summary || '',
    ogImage: () => model.value?.images?.[0]?.url || '',
    ogType: 'article',
  });
</script>

<template>
  <hero :navigation="true" title="3D Model Library" :heroType="HERO_TYPES.ARCHIVE" />
  <div class="container mx-auto px-4" v-if="model">
    <breadcrumb class="my-6" :page="model.title" subpage="3D Models" subpageHref="/models" />

    <div class="grid grid-cols-12 gap-6">
      <!-- Media column -->
      <div class="col-span-12 lg:col-span-7 space-y-3">
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

      <!-- Info column -->
      <div class="col-span-12 lg:col-span-5 space-y-4">
        <div>
          <h1 class="text-3xl font-bold leading-tight">{{ model.title }}</h1>
          <p v-if="model.summary" class="mt-1 opacity-70">{{ model.summary }}</p>
        </div>

        <div v-if="model.author" class="flex items-center gap-2">
          <img
            v-if="model.author.avatarUrl"
            :src="model.author.avatarUrl"
            class="w-8 h-8 rounded-full object-cover"
            :alt="model.author.displayName || 'Author'"
          />
          <i v-else class="fas fa-circle-user text-2xl opacity-60"></i>
          <span class="text-sm"
            >by <strong>{{ model.author.displayName || model.author.username || 'Anonymous' }}</strong></span
          >
        </div>

        <!-- Stats + actions -->
        <div class="flex items-center gap-3 flex-wrap">
          <ModelsModelLikeButton :model-id="model.id" :initial-count="model.likeCount" />
          <span class="text-sm opacity-70"><i class="fas fa-comment mr-1"></i>{{ model.commentCount }}</span>
          <span class="text-sm opacity-70"><i class="fas fa-download mr-1"></i>{{ model.downloadCount }}</span>
          <span v-if="model.versionCount > 1" class="text-sm opacity-70">
            <i class="fas fa-code-branch mr-1"></i>v{{ model.version?.versionNumber }}
          </span>
          <ModelsModelReportModal :model-id="model.id" class="ml-auto" />
        </div>

        <ModelsSafetyDisclaimer :safety-critical="model.safetyCritical" />

        <!-- License -->
        <div class="space-y-2">
          <ModelsLicenseBadge :license="model.license" />
          <a
            v-if="licenseTxtUrl"
            :href="licenseTxtUrl"
            target="_blank"
            rel="noopener"
            class="text-xs link link-hover opacity-70 block"
          >
            <i class="fas fa-file-lines mr-1"></i> View LICENSE.txt
          </a>
          <NuxtLink
            v-if="model.license.isPaid"
            to="/legal/paid-file-license"
            class="text-xs link link-hover opacity-70 block"
          >
            <i class="fas fa-scale-balanced mr-1"></i> Paid File License terms
          </NuxtLink>
        </div>

        <!-- Pricing + download -->
        <div class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body p-4 gap-3">
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-2xl font-bold" :class="isFree ? 'text-success' : 'text-primary'">{{ price }}</span>
              <span v-if="isOwner" class="badge badge-neutral badge-sm">Your model</span>
              <span v-else-if="entitled && !isFree" class="badge badge-success badge-sm">
                <i class="fas fa-check mr-1"></i> Purchased
              </span>
              <span v-else class="text-xs opacity-60">buyers get every version</span>
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
              <a
                v-for="file in model.files"
                :key="file.id"
                :href="downloadUrl(file.id)"
                class="btn btn-sm justify-start gap-2"
                :class="file.isRenderable ? 'btn-primary' : 'btn-outline'"
              >
                <i class="fas" :class="fileExtIcon[file.fileExt] || 'fa-file'"></i>
                <span class="truncate flex-1 text-left">{{ file.fileName }}</span>
                <span class="text-xs opacity-70">{{ formatBytes(file.sizeBytes) }}</span>
              </a>
              <p v-if="!isAuthenticated" class="text-xs opacity-60">
                <i class="fas fa-circle-info mr-1"></i> You'll need to sign in to download.
              </p>
            </template>

            <ModelsPriceBox v-else :model="model" />
          </div>
        </div>

        <!-- Tips -->
        <ModelsTipPicker v-if="acceptsTips && !isOwner" :model-id="model.id" :currency="model.currency" />

        <!-- Tags -->
        <div v-if="model.tags.length" class="flex flex-wrap gap-1.5">
          <span v-for="tag in model.tags" :key="tag" class="badge badge-ghost badge-sm">#{{ tag }}</span>
        </div>
      </div>

      <!-- Description -->
      <div v-if="model.description" class="col-span-12 lg:col-span-7">
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h2 class="card-title text-lg"><i class="fas fa-align-left text-primary mr-1"></i> About this model</h2>
            <p class="whitespace-pre-line text-sm leading-relaxed">{{ model.description }}</p>
            <a
              v-if="model.sourceUrl"
              :href="model.sourceUrl"
              target="_blank"
              rel="noopener noreferrer nofollow"
              class="link link-primary text-sm mt-2"
            >
              <i class="fas fa-link mr-1"></i> Source / original design
            </a>
          </div>
        </div>
      </div>

      <!-- Spec sidebar -->
      <div class="col-span-12 lg:col-span-5 space-y-6">
        <ModelsModelPrintSettings :settings="model.version?.printSettings ?? null" />
      </div>

      <div class="col-span-12 lg:col-span-7 space-y-6">
        <ModelsModelHardwareBom :items="model.version?.hardwareBom ?? []" />
        <ModelsModelAssembly :assembly="model.version?.assembly ?? null" />
      </div>

      <!-- Changelog -->
      <div v-if="model.version?.changelog" class="col-span-12 lg:col-span-5">
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h3 class="card-title text-lg">
              <i class="fas fa-code-branch text-primary mr-1"></i> v{{ model.version.versionNumber }} changelog
            </h3>
            <p class="whitespace-pre-line text-sm opacity-80">{{ model.version.changelog }}</p>
          </div>
        </div>
      </div>

      <!-- Comments -->
      <div class="col-span-12 lg:col-span-8">
        <ModelsModelComments :model-id="model.id" />
      </div>

      <div class="col-span-12 md:col-span-10 md:col-start-2 pb-10 pt-4">
        <patreon-card size="large" />
      </div>
    </div>
  </div>
</template>
