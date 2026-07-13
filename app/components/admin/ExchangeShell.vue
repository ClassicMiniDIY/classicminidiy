<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Breadcrumb Navigation (matches the other admin pages) -->
    <div class="mb-6">
      <Breadcrumb page="The Mini Exchange" :version="BREADCRUMB_VERSIONS.ADMIN" />
    </div>

    <div class="flex flex-col lg:flex-row gap-6 lg:gap-8">
      <!-- Section side menu. The TME admin relied on a drawer layout for this
           navigation; this repo renders pages without layouts (app.vue has no
           NuxtLayout), so the shell provides the container bounds + menu that
           every /admin/exchange page wraps itself in. Admin is English-only. -->
      <aside class="lg:w-64 flex-shrink-0">
        <nav aria-label="Exchange admin sections">
          <ul class="menu bg-base-100 rounded-box border border-base-300 shadow-sm w-full lg:sticky lg:top-24">
            <li class="menu-title text-xs uppercase tracking-wider">The Mini Exchange</li>
            <li>
              <NuxtLink to="/admin/exchange" exact-active-class="active">
                <i class="fas fa-chart-column w-4"></i>
                Overview
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/admin/exchange/moderation" active-class="active">
                <i class="fas fa-shield-halved w-4"></i>
                Moderation
                <span v-if="moderationCount > 0" class="badge badge-warning badge-sm">{{ moderationCount }}</span>
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/admin/exchange/listings" active-class="active">
                <i class="fas fa-tag w-4"></i>
                Listings
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/admin/exchange/messages" active-class="active">
                <i class="fas fa-comments w-4"></i>
                Messages
                <span v-if="messageQueueCount > 0" class="badge badge-error badge-sm">{{ messageQueueCount }}</span>
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/admin/exchange/finds" active-class="active">
                <i class="fas fa-globe w-4"></i>
                Finds
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/admin/exchange/wanted" active-class="active">
                <i class="fas fa-bullhorn w-4"></i>
                Wanted Posts
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/admin/exchange/promotions" active-class="active">
                <i class="fas fa-share-nodes w-4"></i>
                Social Posting
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/admin/exchange/announcements" active-class="active">
                <i class="fas fa-bullhorn w-4"></i>
                Announcements
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/admin/exchange/newsletter" active-class="active">
                <i class="fas fa-newspaper w-4"></i>
                Newsletter
              </NuxtLink>
            </li>

            <li class="menu-title text-xs uppercase tracking-wider mt-2">Site Admin</li>
            <li>
              <NuxtLink to="/admin">
                <i class="fas fa-house w-4"></i>
                Admin Home
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/admin/users">
                <i class="fas fa-users-gear w-4"></i>
                User Management
              </NuxtLink>
            </li>
          </ul>
        </nav>
      </aside>

      <!-- Page content -->
      <div class="flex-1 min-w-0">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { BREADCRUMB_VERSIONS } from '../../../data/models/generic';

  const route = useRoute();
  const supabase = useSupabase();
  const { getMessageQueueCount } = useAdmin();

  const messageQueueCount = ref(0);
  const moderationCount = ref(0);

  const loadMessageQueueCount = async () => {
    try {
      messageQueueCount.value = await getMessageQueueCount();
    } catch {
      // Sidebar badge is non-critical — fail silently.
    }
  };

  const loadModerationCount = async () => {
    try {
      const [listings, finds, wanted] = await Promise.all([
        supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('external_listings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase
          .from('wanted_posts')
          .select('id', { count: 'exact', head: true })
          .in('moderation_status', ['pending', 'flagged']),
      ]);
      moderationCount.value = (listings.count || 0) + (finds.count || 0) + (wanted.count || 0);
    } catch {
      // Sidebar badge is non-critical — fail silently.
    }
  };

  onMounted(() => {
    loadMessageQueueCount();
    loadModerationCount();
  });

  // Refresh badges when navigating between exchange admin sections.
  watch(
    () => route.path,
    () => {
      loadMessageQueueCount();
      loadModerationCount();
    }
  );
</script>
