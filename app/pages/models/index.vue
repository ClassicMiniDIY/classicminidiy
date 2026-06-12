<script setup lang="ts">
  import { HERO_TYPES } from '~~/data/models/generic';
  import type { ModelCard as ModelCardType } from '~~/data/models/model-library';

  const route = useRoute();
  const router = useRouter();

  // Filters (seeded from the URL so a shared link reproduces the view).
  const q = ref(typeof route.query.q === 'string' ? route.query.q : '');
  const category = ref(typeof route.query.category === 'string' ? route.query.category : '');
  const pricing = ref(typeof route.query.pricing === 'string' ? route.query.pricing : '');
  const sort = ref(typeof route.query.sort === 'string' ? route.query.sort : 'newest');
  const page = ref(Number(route.query.page) || 1);

  // Debounced search term feeds the request (avoids a fetch per keystroke).
  const debouncedQ = ref(q.value);
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  watch(q, (val) => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      debouncedQ.value = val;
      page.value = 1;
    }, 350);
  });

  // Reset to page 1 whenever a filter changes.
  watch([category, pricing, sort], () => {
    page.value = 1;
  });

  const { data: categoriesData } = await useFetch('/api/models/categories');
  const categories = computed(() => categoriesData.value?.categories ?? []);

  const { data, status } = await useFetch('/api/models', {
    query: { q: debouncedQ, category, pricing, sort, page },
  });

  const models = computed<ModelCardType[]>(() => data.value?.models ?? []);
  const total = computed(() => data.value?.total ?? 0);
  const hasMore = computed(() => data.value?.hasMore ?? false);

  // Keep the URL in sync so the view is shareable / back-button friendly.
  watch([debouncedQ, category, pricing, sort, page], () => {
    router.replace({
      query: {
        ...(debouncedQ.value ? { q: debouncedQ.value } : {}),
        ...(category.value ? { category: category.value } : {}),
        ...(pricing.value ? { pricing: pricing.value } : {}),
        ...(sort.value !== 'newest' ? { sort: sort.value } : {}),
        ...(page.value > 1 ? { page: String(page.value) } : {}),
      },
    });
  });

  const pricingOptions = [
    { value: '', label: 'All pricing' },
    { value: 'free', label: 'Free' },
    { value: 'tips', label: 'Free + tips' },
    { value: 'pwyw', label: 'Pay what you want' },
    { value: 'fixed', label: 'Paid' },
  ];
  const sortOptions = [
    { value: 'newest', label: 'Newest' },
    { value: 'popular', label: 'Most downloaded' },
    { value: 'likes', label: 'Most liked' },
    { value: 'featured', label: 'Featured' },
  ];

  function clearFilters() {
    q.value = '';
    debouncedQ.value = '';
    category.value = '';
    pricing.value = '';
    sort.value = 'newest';
    page.value = 1;
  }

  // Categories store icons in Iconify form (e.g. "i-fa6-solid-couch"); the rest
  // of the site renders Font Awesome via class names, so convert.
  function faIcon(iconify?: string | null): string {
    if (!iconify) return 'fas fa-cube';
    const m = iconify.match(/^i-fa6-(solid|regular|brands)-(.+)$/);
    if (!m) return iconify.startsWith('fa-') ? `fas ${iconify}` : `fas fa-${iconify}`;
    const style = m[1] === 'solid' ? 'fas' : m[1] === 'regular' ? 'far' : 'fab';
    return `${style} fa-${m[2]}`;
  }

  useHead({ title: '3D Model Library | Classic Mini DIY' });
  useSeoMeta({
    description:
      'Browse and download 3D-printable parts for the Classic Mini — interior trim, brackets, gauge pods, tools and jigs, with full print settings.',
    ogTitle: '3D Model Library | Classic Mini DIY',
    ogDescription: 'Mini-specific 3D-printable parts with print settings, hardware lists, and assembly guides.',
    ogType: 'website',
  });
</script>

<template>
  <hero :navigation="true" title="3D Model Library" :heroType="HERO_TYPES.ARCHIVE" />
  <div class="container mx-auto px-4">
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12">
        <breadcrumb class="my-6" page="3D Models" />
        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div class="flex-1">
            <PageIntro
              eyebrow="MAKE"
              title="3D Model Library"
              description="Mini-specific 3D-printable parts — interior trim, brackets, gauge pods, tools and jigs — with full print settings, hardware lists, and assembly guides. Contributed by the community."
              as="h2"
            />
          </div>
          <div class="flex gap-2 shrink-0">
            <NuxtLink to="/models/upload" class="btn btn-primary"
              ><i class="fas fa-plus mr-1"></i> Share a model</NuxtLink
            >
            <NuxtLink to="/models/mine" class="btn btn-ghost"><i class="fas fa-folder mr-1"></i> My models</NuxtLink>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="col-span-12">
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body p-4 gap-4">
            <div class="flex flex-col md:flex-row gap-3">
              <label class="input w-full md:flex-1">
                <i class="fas fa-magnifying-glass opacity-50"></i>
                <input v-model="q" type="search" placeholder="Search models…" aria-label="Search models" />
              </label>
              <select v-model="pricing" class="select w-full md:w-auto" aria-label="Filter by pricing">
                <option v-for="opt in pricingOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <select v-model="sort" class="select w-full md:w-auto" aria-label="Sort">
                <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>

            <div v-if="categories.length" class="flex flex-wrap gap-2">
              <button class="btn btn-sm" :class="category === '' ? 'btn-primary' : 'btn-ghost'" @click="category = ''">
                All
              </button>
              <button
                v-for="cat in categories"
                :key="cat.slug"
                class="btn btn-sm gap-1"
                :class="category === cat.slug ? 'btn-primary' : 'btn-ghost'"
                @click="category = cat.slug"
              >
                <i :class="faIcon(cat.icon)"></i>
                {{ cat.name }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Results -->
      <div class="col-span-12">
        <div class="flex items-center justify-between mb-4 text-sm opacity-70">
          <span>{{ total }} model{{ total === 1 ? '' : 's' }}</span>
          <button
            v-if="q || category || pricing || sort !== 'newest'"
            class="btn btn-ghost btn-xs"
            @click="clearFilters"
          >
            <i class="fas fa-xmark mr-1"></i> Clear filters
          </button>
        </div>

        <div v-if="status === 'pending'" class="flex justify-center py-16">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>

        <div v-else-if="models.length === 0" class="text-center py-16">
          <i class="fas fa-cube text-5xl opacity-20"></i>
          <p class="mt-4 text-lg font-semibold">No models found</p>
          <p class="opacity-60">Try a different search or clear your filters.</p>
        </div>

        <div v-else class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <ModelsModelCard v-for="model in models" :key="model.id" :model="model" />
        </div>

        <!-- Pagination -->
        <div v-if="models.length && (page > 1 || hasMore)" class="flex justify-center mt-8">
          <div class="join">
            <button class="join-item btn" :disabled="page <= 1" @click="page--">
              <i class="fas fa-chevron-left"></i>
            </button>
            <button class="join-item btn btn-disabled">Page {{ page }}</button>
            <button class="join-item btn" :disabled="!hasMore" @click="page++">
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="col-span-12 md:col-span-10 md:col-start-2 pb-10 pt-4">
        <patreon-card size="large" />
      </div>

      <div class="col-span-12">
        <div class="divider mb-0"></div>
      </div>
    </div>
  </div>
</template>
