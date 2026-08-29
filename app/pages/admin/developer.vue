<script setup lang="ts">
  /**
   * /admin/developer — the fleet view for the Developer API.
   *
   * The per-user modal on /admin/users answers "what about this person"; this
   * answers "who are my subscribers, and who is actually using it", which is
   * otherwise unanswerable without searching users one at a time.
   *
   * Read-only on purpose: every mutation (comp, revoke, issue, revoke key)
   * lives in the per-user modal, so there is exactly one place where those
   * happen and one audit story. Rows link through to that modal.
   *
   * Admin is internal tooling and is intentionally English-only (repo CLAUDE.md).
   */
  const { getOverview } = useAdminDeveloper();

  const loading = ref(true);
  const error = ref('');
  const data = ref<any>(null);

  onMounted(async () => {
    try {
      data.value = await getOverview();
    } catch (err: any) {
      error.value = err?.statusMessage || err?.message || 'Failed to load Developer API overview';
    } finally {
      loading.value = false;
    }
  });

  const fmt = (n: number) => n.toLocaleString('en-US');

  useHead({ title: 'Developer API - Admin', meta: [{ name: 'robots', content: 'noindex, nofollow' }] });
</script>

<template>
  <AdminShell title="Developer API" subtitle="Paid MCP access — subscribers, keys and usage">
    <div v-if="loading" class="flex justify-center py-16">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else-if="error" role="alert" class="alert alert-error">
      <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
      <span>{{ error }}</span>
    </div>

    <template v-else-if="data">
      <!-- Totals -->
      <div class="stats stats-vertical lg:stats-horizontal shadow mb-6 w-full">
        <div class="stat">
          <div class="stat-title">Subscribers</div>
          <div class="stat-value text-primary">{{ fmt(data.totals.subscribers) }}</div>
          <div class="stat-desc">{{ fmt(data.totals.paid) }} paid &middot; {{ fmt(data.totals.comped) }} comped</div>
        </div>
        <div class="stat">
          <div class="stat-title">Active API keys</div>
          <div class="stat-value">{{ fmt(data.totals.active_keys) }}</div>
          <div class="stat-desc">across all tiers, including free</div>
        </div>
        <div class="stat">
          <div class="stat-title">Calls (30 days)</div>
          <div class="stat-value">{{ fmt(data.totals.calls_30d) }}</div>
          <div class="stat-desc">exact counts from mcp_usage_daily</div>
        </div>
      </div>

      <!-- Subscribers -->
      <div class="card bg-base-100 shadow-sm border border-base-300 mb-6">
        <div class="card-body min-w-0">
          <h2 class="text-lg font-semibold">Subscribers</h2>
          <p v-if="!data.subscribers.length" class="text-sm opacity-60">
            No active Developer API subscriptions yet.
          </p>
          <div v-else class="max-w-full overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>User</th><th>Via</th><th>Expires</th>
                  <th class="text-right">Keys</th><th class="text-right">Calls (30d)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in data.subscribers" :key="s.user_id">
                  <td>
                    <NuxtLink :to="`/admin/users?q=${encodeURIComponent(s.name || s.user_id)}`" class="link">
                      {{ s.name || s.user_id.slice(0, 8) }}
                    </NuxtLink>
                    <span v-if="s.comp_note" class="block text-xs opacity-60">{{ s.comp_note }}</span>
                  </td>
                  <td>
                    <span class="badge badge-sm" :class="s.platform === 'comp' ? 'badge-ghost' : 'badge-primary'">
                      {{ s.platform }}
                    </span>
                    <span v-if="s.billing_interval" class="text-xs opacity-60 ml-1">{{ s.billing_interval }}ly</span>
                  </td>
                  <td class="text-xs opacity-70">{{ s.expires_at ? s.expires_at.slice(0, 10) : 'never' }}</td>
                  <td class="text-right">{{ s.active_keys }}</td>
                  <td class="text-right">{{ fmt(s.calls_30d) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Top users -->
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body min-w-0">
            <h2 class="text-lg font-semibold">Top users (30 days)</h2>
            <p v-if="!data.top_users.length" class="text-sm opacity-60">No calls recorded yet.</p>
            <div v-else class="max-w-full overflow-x-auto">
              <table class="table table-sm">
                <tbody>
                  <tr v-for="u in data.top_users" :key="u.user_id">
                    <td>{{ u.name || u.user_id.slice(0, 8) }}</td>
                    <td class="text-right">{{ fmt(u.calls) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Top tools -->
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body min-w-0">
            <h2 class="text-lg font-semibold">Tools by usage (30 days)</h2>
            <p v-if="!data.top_tools.length" class="text-sm opacity-60">No calls recorded yet.</p>
            <div v-else class="max-w-full overflow-x-auto">
              <table class="table table-sm">
                <tbody>
                  <tr v-for="t in data.top_tools" :key="t.tool">
                    <td><code>{{ t.tool }}</code></td>
                    <td class="text-right">{{ fmt(t.calls) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </template>
  </AdminShell>
</template>
