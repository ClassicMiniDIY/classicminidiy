<script setup lang="ts">
  import type {
    AdminSubscriptionRow,
    AdminVerificationFailure,
    AdminVerificationHealth,
  } from '~/composables/useAdminMembership';

  useHead({
    title: 'Admin - Membership',
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  });

  const { listSubscriptions, listVerificationFailures, verificationHealth } = useAdminMembership();

  const subscriptions = ref<AdminSubscriptionRow[]>([]);
  const failures = ref<AdminVerificationFailure[]>([]);
  const health = ref<AdminVerificationHealth[]>([]);
  const loading = ref(true);
  const errorMessage = ref('');
  const search = ref('');
  const platformFilter = ref<string>('all');
  const entitledOnly = ref(false);

  async function load() {
    loading.value = true;
    errorMessage.value = '';
    try {
      const [subs, fails, rollup] = await Promise.all([
        listSubscriptions(),
        listVerificationFailures(),
        verificationHealth(7),
      ]);
      subscriptions.value = subs;
      failures.value = fails;
      health.value = rollup;
    } catch (error: any) {
      errorMessage.value = error?.message || 'Failed to load membership data';
    } finally {
      loading.value = false;
    }
  }

  onMounted(load);

  // -- Health strip ---------------------------------------------------------
  // Collapsed across days: the question this answers is "is a platform broken
  // right now", not "what happened on Tuesday".
  interface PlatformHealth {
    platform: string;
    verified: number;
    rejected: number;
    total: number;
    rejectRate: number;
  }

  const platformHealth = computed<PlatformHealth[]>(() => {
    const acc = new Map<string, PlatformHealth>();
    for (const row of health.value) {
      const entry = acc.get(row.platform) ?? {
        platform: row.platform,
        verified: 0,
        rejected: 0,
        total: 0,
        rejectRate: 0,
      };
      if (row.outcome === 'verified') entry.verified += row.attempts;
      else entry.rejected += row.attempts;
      entry.total += row.attempts;
      acc.set(row.platform, entry);
    }
    const out = [...acc.values()];
    for (const entry of out) {
      entry.rejectRate = entry.total > 0 ? entry.rejected / entry.total : 0;
    }
    // Worst first — a platform at 100% rejection is the headline.
    return out.sort((a, b) => b.rejectRate - a.rejectRate || b.total - a.total);
  });

  /** A platform refusing everything is an outage, not a run of bad requests. */
  const brokenPlatforms = computed(() => platformHealth.value.filter((p) => p.rejectRate === 1 && p.total > 0));

  /** Paid, refused, and holding no entitlement from any other channel. */
  const strandedCount = computed(() => failures.value.filter((f) => !f.entitled_now).length);

  // -- Purchases table ------------------------------------------------------
  const platforms = computed(() => [...new Set(subscriptions.value.map((s) => s.platform))].sort());

  const filteredSubscriptions = computed(() => {
    const q = search.value.trim().toLowerCase();
    return subscriptions.value.filter((row) => {
      if (platformFilter.value !== 'all' && row.platform !== platformFilter.value) return false;
      if (entitledOnly.value && !row.entitled) return false;
      if (!q) return true;
      return (
        (row.email ?? '').toLowerCase().includes(q) ||
        (row.username ?? '').toLowerCase().includes(q) ||
        (row.discord_username ?? '').toLowerCase().includes(q)
      );
    });
  });

  const entitledTotal = computed(() => subscriptions.value.filter((s) => s.entitled).length);

  const PLATFORM_BADGES: Record<string, string> = {
    apple: 'badge-neutral',
    google: 'badge-success',
    stripe: 'badge-info',
    comp: 'badge-warning',
    ghost: 'badge-secondary',
    patreon: 'badge-accent',
  };

  function platformBadge(platform: string) {
    return PLATFORM_BADGES[platform] ?? 'badge-ghost';
  }

  function fmtDate(value: string | null) {
    return value ? new Date(value).toLocaleDateString() : '—';
  }

  function fmtDateTime(value: string | null) {
    return value ? new Date(value).toLocaleString() : '—';
  }

  function pct(value: number) {
    return `${Math.round(value * 100)}%`;
  }
</script>

<template>
  <AdminShell title="Membership" subtitle="Every purchase across all channels, and every account failing to verify">
    <template #actions>
      <button type="button" class="btn btn-sm btn-outline" :disabled="loading" @click="load">
        <i class="fas fa-rotate" :class="{ 'fa-spin': loading }"></i>
        Refresh
      </button>
    </template>

    <p class="text-sm opacity-70 mb-4">
      <code>subscriptions</code> is the source of truth for the Sustaining Member entitlement; the failure feed comes
      from <code>subscription_verification_attempts</code>, which records every <code>verify-subscription</code> call.
      Row actions here reuse the existing comp RPCs &mdash; nothing on this page writes a purchase.
    </p>

    <div v-if="errorMessage" role="alert" class="alert alert-error mb-4">
      <i class="fas fa-triangle-exclamation"></i>
      <span>{{ errorMessage }}</span>
    </div>

    <!-- The alarm. A channel refusing 100% of attempts is exactly the shape of
         the 2026 Google Play outage, which ran for three months unseen. -->
    <div v-for="p in brokenPlatforms" :key="`broken-${p.platform}`" role="alert" class="alert alert-error mb-4">
      <i class="fas fa-triangle-exclamation"></i>
      <span>
        <strong>{{ p.platform }}</strong> has failed <strong>every</strong> verification attempt in the last 7 days ({{
          p.rejected
        }}
        of {{ p.total }}). Check the failing accounts below for the request shape before assuming a store outage.
      </span>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <i class="fas fa-spinner fa-spin text-3xl text-primary"></i>
    </div>

    <template v-else>
      <!-- Summary -->
      <div class="stats stats-vertical sm:stats-horizontal shadow mb-6 w-full">
        <div class="stat">
          <div class="stat-title">Paying members</div>
          <div class="stat-value text-2xl">{{ entitledTotal }}</div>
          <div class="stat-desc">{{ subscriptions.length }} subscription rows in total</div>
        </div>
        <div class="stat">
          <div class="stat-title">Failing to verify</div>
          <div class="stat-value text-2xl" :class="strandedCount > 0 ? 'text-error' : ''">
            {{ strandedCount }}
          </div>
          <div class="stat-desc">Refused and entitled by no other channel</div>
        </div>
        <div class="stat">
          <div class="stat-title">Attempts (7d)</div>
          <div class="stat-value text-2xl">{{ health.reduce((sum, h) => sum + h.attempts, 0) }}</div>
          <div class="stat-desc">Across every platform and outcome</div>
        </div>
      </div>

      <!-- Verification health -->
      <h2 class="text-lg font-semibold mb-2">Verification health &mdash; last 7 days</h2>
      <div v-if="platformHealth.length === 0" class="alert mb-6">
        <i class="fas fa-circle-info"></i>
        <span>
          No verification attempts recorded yet. Either nobody has purchased or restored in seven days, or the
          <code>verify-subscription</code> attempt log has not been deployed.
        </span>
      </div>
      <div v-else class="overflow-x-auto mb-6">
        <table class="table table-sm table-zebra">
          <thead>
            <tr>
              <th>Platform</th>
              <th class="text-right">Verified</th>
              <th class="text-right">Rejected</th>
              <th class="text-right">Reject rate</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in platformHealth" :key="p.platform">
              <td>
                <span class="badge badge-sm" :class="platformBadge(p.platform)">{{ p.platform }}</span>
              </td>
              <td class="text-right">{{ p.verified }}</td>
              <td class="text-right" :class="p.rejected > 0 ? 'text-error font-semibold' : ''">{{ p.rejected }}</td>
              <td class="text-right" :class="p.rejectRate > 0.5 ? 'text-error font-semibold' : ''">
                {{ pct(p.rejectRate) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Failing accounts -->
      <h2 class="text-lg font-semibold mb-2">
        Failing accounts
        <span v-if="failures.length" class="badge badge-sm badge-error ml-1">{{ failures.length }}</span>
      </h2>
      <div v-if="failures.length === 0" class="alert alert-success mb-6">
        <i class="fas fa-check"></i>
        <span>No account's most recent verification attempt failed in the last 30 days.</span>
      </div>
      <div v-else class="overflow-x-auto mb-6">
        <table class="table table-sm table-zebra">
          <thead>
            <tr>
              <th>Account</th>
              <th>Platform sent</th>
              <th>Error</th>
              <th>Keys the client sent</th>
              <th class="text-center">Attempts</th>
              <th>Last failure</th>
              <th class="text-center">Covered</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in failures" :key="`${row.user_id}-${row.last_failure_at}`">
              <td>
                <div class="text-sm">{{ row.email || 'unauthenticated' }}</div>
                <div v-if="row.user_agent" class="text-xs opacity-60 font-mono">{{ row.user_agent }}</div>
              </td>
              <td>
                <span v-if="row.platform" class="badge badge-sm" :class="platformBadge(row.platform)">
                  {{ row.platform }}
                </span>
                <!-- The single most diagnostic cell on the page: the client
                     never sent the key the function dispatches on. -->
                <span v-else class="badge badge-sm badge-error">none sent</span>
              </td>
              <td>
                <div class="text-sm font-mono">{{ row.error_code || row.http_status }}</div>
                <div v-if="row.detail" class="text-xs opacity-60">{{ row.detail }}</div>
              </td>
              <td>
                <code v-if="row.body_keys?.length" class="text-xs">{{ row.body_keys.join(', ') }}</code>
                <span v-else class="text-xs opacity-60 italic">—</span>
              </td>
              <td class="text-center">{{ row.attempts }}</td>
              <td class="text-sm opacity-70">{{ fmtDateTime(row.last_failure_at) }}</td>
              <td class="text-center">
                <i v-if="row.entitled_now" class="fas fa-check text-success" title="Entitled via another channel"></i>
                <i v-else class="fas fa-xmark text-error" title="Paid and holds no entitlement"></i>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- All purchases -->
      <h2 class="text-lg font-semibold mb-2">All purchases</h2>
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <button
          type="button"
          class="btn btn-xs"
          :class="platformFilter === 'all' ? 'btn-primary' : 'btn-ghost'"
          @click="platformFilter = 'all'"
        >
          All ({{ subscriptions.length }})
        </button>
        <button
          v-for="p in platforms"
          :key="p"
          type="button"
          class="btn btn-xs"
          :class="platformFilter === p ? 'btn-primary' : 'btn-ghost'"
          @click="platformFilter = p"
        >
          {{ p }} ({{ subscriptions.filter((s) => s.platform === p).length }})
        </button>
        <label class="label cursor-pointer gap-2 text-sm">
          <input v-model="entitledOnly" type="checkbox" class="checkbox checkbox-sm" />
          <span>Active only</span>
        </label>
        <label class="input input-sm input-bordered flex items-center gap-2 ml-auto">
          <i class="fas fa-magnifying-glass opacity-50"></i>
          <input v-model="search" type="search" class="grow" placeholder="Email, username, or Discord handle" />
        </label>
      </div>

      <div v-if="filteredSubscriptions.length === 0" class="text-center py-12 opacity-60">
        <i class="fas fa-receipt text-3xl mb-2"></i>
        <p>No purchases match.</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="table table-sm table-zebra">
          <thead>
            <tr>
              <th>Member</th>
              <th>Platform</th>
              <th>Status</th>
              <th class="text-center">Active</th>
              <th>Expires</th>
              <th>Last verified</th>
              <th>Discord</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredSubscriptions" :key="row.subscription_id">
              <td>
                <div class="text-sm">{{ row.email || '—' }}</div>
                <div v-if="row.username" class="text-xs opacity-60">@{{ row.username }}</div>
              </td>
              <td>
                <span class="badge badge-sm" :class="platformBadge(row.platform)">{{ row.platform }}</span>
                <div v-if="row.comp_note" class="text-xs opacity-60 mt-1">{{ row.comp_note }}</div>
              </td>
              <td class="text-sm">{{ row.status }}</td>
              <td class="text-center">
                <i v-if="row.entitled" class="fas fa-check text-success"></i>
                <i v-else class="fas fa-minus opacity-30"></i>
              </td>
              <td class="text-sm opacity-70">{{ fmtDate(row.expires_at) }}</td>
              <!-- Stale on a live subscription usually means the app stopped
                   being able to verify, which is what the feed above catches. -->
              <td class="text-sm opacity-70">{{ fmtDate(row.last_verified_at) }}</td>
              <td>
                <span v-if="row.discord_username" class="font-mono text-xs">@{{ row.discord_username }}</span>
                <span v-else-if="row.discord_link_status" class="text-xs opacity-60 italic">
                  {{ row.discord_link_status }}
                </span>
                <span v-else class="text-xs opacity-60 italic">not linked</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </AdminShell>
</template>
