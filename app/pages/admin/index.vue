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
        <UBreadcrumb
          :items="[{ label: 'Home', to: '/', icon: 'i-fa6-solid-house' }, { label: 'Admin' }]"
          :ui="{
            item: 'text-primary-600 dark:text-primary-400',
            link: 'text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300',
            linkActive: 'text-neutral-500 dark:text-neutral-400 font-medium',
            separator: 'text-neutral-400 dark:text-neutral-500',
            icon: 'text-primary-600 dark:text-primary-400',
          }"
        />

        <div class="flex items-center gap-4">
          <span class="text-sm opacity-70"> Welcome, {{ userProfile?.display_name || userProfile?.email }} </span>
          <UButton @click="handleLogout" variant="ghost" size="sm">
            <i class="fad fa-sign-out mr-2"></i>
            Logout
          </UButton>
        </div>
      </div>
    </div>

    <!-- Admin Components Grid -->
    <div class="container mx-auto px-4 py-8">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        <!-- Moderation Queue Card -->
        <UCard class="hover:shadow-2xl transition-shadow">
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

          <div class="flex justify-end">
            <UButton to="/admin/queue" color="primary">
              <i class="fad fa-arrow-right mr-2"></i>
              Open Queue
            </UButton>
          </div>
        </UCard>

        <!-- Chat Threads Card -->
        <UCard class="hover:shadow-2xl transition-shadow">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center">
              <i class="fad fa-messages text-2xl text-info"></i>
            </div>
            <h2 class="text-xl font-bold">Chat Threads</h2>
          </div>

          <p class="opacity-70 mb-6">
            View and manage LangGraph chat threads from users interacting with the AI assistant.
          </p>

          <div class="flex justify-end">
            <UButton to="/admin/threads" color="info">
              <i class="fad fa-arrow-right mr-2"></i>
              View Threads
            </UButton>
          </div>
        </UCard>

        <!-- User Management Card -->
        <UCard class="hover:shadow-2xl transition-shadow">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
              <i class="fad fa-users-cog text-2xl text-warning"></i>
            </div>
            <h2 class="text-xl font-bold">User Management</h2>
          </div>

          <p class="opacity-70 mb-6">
            Manage users, trust levels, and permissions for the contributor system.
          </p>

          <div class="flex justify-end">
            <UButton to="/admin/users" color="warning">
              <i class="fad fa-arrow-right mr-2"></i>
              Manage Users
            </UButton>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
