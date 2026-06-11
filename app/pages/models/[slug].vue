<script setup lang="ts">
  import { HERO_TYPES } from '~~/data/models/generic';
  import { type ModelDetail, type ModelFileInfo, priceLabel, formatBytes } from '~~/data/models/model-library';

  definePageMeta({ middleware: 'models-enabled' });

  const route = useRoute();
  const slug = computed(() => String(route.params.slug));
  const { isAuthenticated } = useAuth();

  const { data, error } = await useFetch<ModelDetail>(() => `/api/models/${slug.value}`);
  if (error.value) {
    throw createError({ statusCode: error.value.statusCode || 404, statusMessage: 'Model not found', fatal: true });
  }
  const model = computed(() => data.value!);

  const renderableFiles = computed(() => model.value.files.filter((f) => f.isRenderable));
  const isFree = computed(() => ['free', 'tips'].includes(model.value.pricingMode));
  const price = computed(() => priceLabel(model.value));
  const licenseTxtUrl = computed(() =>
    model.value.version ? `/api/models/${model.value.id}/versions/${model.value.version.id}/license.txt` : null
  );

  function downloadUrl(fileId: string) {
    return `/api/models/${model.value.id}/files/${fileId}/download`;
  }

  // Media area: a renderable file (3D) or a gallery image.
  type Media = { kind: '3d'; file: ModelFileInfo } | { kind: 'image'; url: string; alt: string };
  const activeMedia = ref<Media | null>(null);
  function initMedia() {
    if (renderableFiles.value.length) activeMedia.value = { kind: '3d', file: renderableFiles.value[0]! };
    else if (model.value.images.length)
      activeMedia.value = {
        kind: 'image',
        url: model.value.images[0]!.url,
        alt: model.value.images[0]!.altText || model.value.title,
      };
  }
  initMedia();

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

        <!-- Stats -->
        <div class="flex items-center gap-4 text-sm opacity-70">
          <span><i class="fas fa-heart mr-1"></i>{{ model.likeCount }}</span>
          <span><i class="fas fa-comment mr-1"></i>{{ model.commentCount }}</span>
          <span><i class="fas fa-download mr-1"></i>{{ model.downloadCount }}</span>
          <span v-if="model.versionCount > 1"
            ><i class="fas fa-code-branch mr-1"></i>v{{ model.version?.versionNumber }}</span
          >
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
            class="text-xs link link-hover opacity-70"
          >
            <i class="fas fa-file-lines mr-1"></i> View LICENSE.txt
          </a>
        </div>

        <!-- Pricing + download -->
        <div class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body p-4 gap-3">
            <div class="flex items-baseline justify-between">
              <span class="text-2xl font-bold" :class="isFree ? 'text-success' : 'text-primary'">{{ price }}</span>
              <span class="text-xs opacity-60">buyers get every version</span>
            </div>

            <template v-if="isFree">
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

            <template v-else>
              <button class="btn btn-primary btn-sm" disabled title="Checkout arrives with the payments release">
                <i class="fas fa-cart-shopping mr-1"></i> Purchase
              </button>
              <p class="text-xs opacity-60"><i class="fas fa-lock mr-1"></i> Files unlock after purchase.</p>
            </template>
          </div>
        </div>

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

      <div class="col-span-12 md:col-span-10 md:col-start-2 pb-10 pt-4">
        <patreon-card size="large" />
      </div>
    </div>
  </div>
</template>
