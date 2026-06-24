<script setup lang="ts">
  import { HERO_TYPES } from '../../../data/models/generic';

  // SEO and meta
  useHead({
    title: 'Admin Dashboard - Classic Mini DIY',
    meta: [
      {
        name: 'description',
        content: 'Admin dashboard for managing Classic Mini DIY submissions and content.',
      },
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  });

  // Get user info from Supabase auth
  const { userProfile, signOut } = useAuth();

  // Marketplace admin is only surfaced when the Exchange section is enabled
  const exchangeEnabled = useRuntimeConfig().public.exchangeEnabled;

  // Fetch pending count — uses useAdminFetch to inject auth header and skip SSR
  const { data: totalPendingCount } = await useAdminFetch<{ count: number }>('/api/admin/queue/count');

  // Logout handler
  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
    await navigateTo('/login');
  };
</script>
<template>
  <div>
    <!-- Hero Section -->
    <Hero
      title="Admin Dashboard"
      subtitle="Manage submissions and content for Classic Mini DIY"
      :heroType="HERO_TYPES.TECH"
      textSize="text-4xl"
    />

    <!-- Breadcrumb Navigation -->
    <div class="container mx-auto px-4 pt-10">
      <div class="flex justify-between items-center">
        <div class="breadcrumbs text-sm">
          <ul>
            <li>
              <NuxtLink to="/" class="link link-primary">
                <i class="fas fa-house mr-1"></i>
                Home
              </NuxtLink>
            </li>
            <li><span>Admin</span></li>
          </ul>
        </div>

        <div class="flex items-center gap-4">
          <span class="text-sm opacity-70"> Welcome, {{ userProfile?.display_name || userProfile?.email }} </span>
          <button type="button" class="btn btn-ghost btn-sm" @click="handleLogout">
            <i class="fad fa-sign-out mr-2"></i>
            Logout
          </button>
        </div>
      </div>
    </div>

    <!-- Admin Components Grid -->
    <div class="container mx-auto px-4 py-8">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        <!-- Moderation Queue Card -->
        <div class="card bg-base-100 shadow-md border border-base-300 hover:shadow-2xl transition-shadow">
          <div class="card-body">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <i class="fad fa-inbox text-2xl text-primary"></i>
              </div>
              <div>
                <h2 class="text-xl font-bold">Moderation Queue</h2>
                <span v-if="totalPendingCount?.count" class="badge badge-primary badge-sm">
                  {{ totalPendingCount.count }} pending
                </span>
              </div>
            </div>

            <p class="opacity-70 mb-6">
              Review all community submissions — documents, registry, colors, wheels, and edit suggestions.
            </p>

            <div class="card-actions justify-end">
              <NuxtLink to="/admin/queue" class="btn btn-primary">
                <i class="fad fa-arrow-right mr-2"></i>
                Open Queue
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- 3D Models Card -->
        <div class="card bg-base-100 shadow-md border border-base-300 hover:shadow-2xl transition-shadow">
          <div class="card-body">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                <i class="fad fa-cube text-2xl text-secondary"></i>
              </div>
              <h2 class="text-xl font-bold">3D Models</h2>
            </div>

            <p class="opacity-70 mb-6">
              Review the model library queue, handle reports and takedowns, manage sellers, and track sales.
            </p>

            <div class="card-actions justify-end">
              <NuxtLink to="/admin/models" class="btn btn-secondary">
                <i class="fad fa-arrow-right mr-2"></i>
                Open Models
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Chat Threads Card -->
        <div class="card bg-base-100 shadow-md border border-base-300 hover:shadow-2xl transition-shadow">
          <div class="card-body">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center">
                <i class="fad fa-messages text-2xl text-info"></i>
              </div>
              <h2 class="text-xl font-bold">Chat Threads</h2>
            </div>

            <p class="opacity-70 mb-6">
              View and manage LangGraph chat threads from users interacting with the AI assistant.
            </p>

            <div class="card-actions justify-end">
              <NuxtLink to="/admin/threads" class="btn btn-info">
                <i class="fad fa-arrow-right mr-2"></i>
                View Threads
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- User Management Card -->
        <div class="card bg-base-100 shadow-md border border-base-300 hover:shadow-2xl transition-shadow">
          <div class="card-body">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                <i class="fad fa-users-cog text-2xl text-warning"></i>
              </div>
              <h2 class="text-xl font-bold">User Management</h2>
            </div>

            <p class="opacity-70 mb-6">Manage users, trust levels, and permissions for the contributor system.</p>

            <div class="card-actions justify-end">
              <NuxtLink to="/admin/users" class="btn btn-warning">
                <i class="fad fa-arrow-right mr-2"></i>
                Manage Users
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- The Mini Exchange Card -->
        <div
          v-if="exchangeEnabled"
          class="card bg-base-100 shadow-md border border-base-300 hover:shadow-2xl transition-shadow"
        >
          <div class="card-body">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <i class="fad fa-store text-2xl text-accent"></i>
              </div>
              <h2 class="text-xl font-bold">The Mini Exchange</h2>
            </div>

            <p class="opacity-70 mb-6">
              Marketplace admin — listings, wanted posts, finds, message moderation, promotions, newsletter, and the
              site announcement banner.
            </p>

            <div class="card-actions justify-end">
              <NuxtLink to="/admin/exchange" class="btn btn-accent">
                <i class="fad fa-arrow-right mr-2"></i>
                Open Exchange
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
