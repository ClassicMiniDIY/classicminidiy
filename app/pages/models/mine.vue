<script setup lang="ts">
  import { HERO_TYPES } from '~~/data/models/generic';

  const { isAuthenticated } = useAuth();
  const supabase = useSupabase();

  const { data, pending, refresh } = await useAsyncData('models-mine', async () => {
    if (!import.meta.client) return { models: [] as any[] };
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) return { models: [] as any[] };
    return await $fetch<{ models: any[] }>('/api/models/mine', { headers: { Authorization: `Bearer ${token}` } });
  });

  const models = computed(() => data.value?.models ?? []);

  const statusTone: Record<string, string> = {
    draft: 'badge-ghost',
    pending: 'badge-warning',
    published: 'badge-success',
    rejected: 'badge-error',
    flagged: 'badge-warning',
    archived: 'badge-neutral',
    removed: 'badge-error',
  };

  useHead({ title: 'My Models | Classic Mini DIY' });
</script>

<template>
  <hero :navigation="true" title="My Models" :heroType="HERO_TYPES.ARCHIVE" />
  <div class="container mx-auto px-4">
    <div class="flex items-center justify-between my-6">
      <breadcrumb page="My Models" subpage="3D Models" subpageHref="/models" />
      <NuxtLink to="/models/upload" class="btn btn-primary btn-sm"
        ><i class="fas fa-plus mr-1"></i> Upload a model</NuxtLink
      >
    </div>

    <div v-if="!isAuthenticated" class="card bg-base-100 border border-base-300 shadow-sm my-10">
      <div class="card-body items-center text-center">
        <i class="fas fa-right-to-bracket text-4xl text-primary"></i>
        <h2 class="card-title">Sign in to see your models</h2>
        <NuxtLink to="/login" class="btn btn-primary">Sign in</NuxtLink>
      </div>
    </div>

    <div v-else-if="pending" class="flex justify-center py-16">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else-if="models.length === 0" class="text-center py-16">
      <i class="fas fa-cube text-5xl opacity-20"></i>
      <p class="mt-4 text-lg font-semibold">No models yet</p>
      <p class="opacity-60 mb-4">Share your first Classic Mini print.</p>
      <NuxtLink to="/models/upload" class="btn btn-primary"><i class="fas fa-plus mr-1"></i> Upload a model</NuxtLink>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
      <div v-for="m in models" :key="m.id" class="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
        <figure class="aspect-[4/3] bg-base-200">
          <img
            v-if="m.primaryImage"
            :src="m.primaryImage"
            :alt="m.title"
            class="w-full h-full object-cover"
            loading="lazy"
          />
          <div v-else class="w-full h-full flex items-center justify-center text-base-content/30">
            <i class="fas fa-cube text-4xl"></i>
          </div>
        </figure>
        <div class="card-body p-4 gap-2">
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-semibold leading-tight line-clamp-2">{{ m.title }}</h3>
            <span class="badge badge-sm shrink-0 capitalize" :class="statusTone[m.status] || 'badge-ghost'">{{
              m.status
            }}</span>
          </div>
          <p class="text-xs opacity-60">
            v{{ m.versionCount }} · <i class="fas fa-download"></i> {{ m.downloadCount }} · <i class="fas fa-heart"></i>
            {{ m.likeCount }}
          </p>
          <div class="flex gap-2 mt-1">
            <NuxtLink v-if="m.status === 'published'" :to="`/models/${m.slug}`" class="btn btn-ghost btn-xs"
              ><i class="fas fa-eye mr-1"></i> View</NuxtLink
            >
            <span v-else class="text-xs opacity-50 self-center">{{
              m.status === 'pending' ? 'Awaiting review' : 'Draft'
            }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
