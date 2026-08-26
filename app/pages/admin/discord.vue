<script setup lang="ts">
  import {
    DISCORD_CLASSIFICATION_BADGES,
    DISCORD_CLASSIFICATION_LABELS,
    DISCORD_CLASSIFICATION_ORDER,
    type DiscordAuditRun,
    type DiscordClassification,
    type DiscordRosterRow,
  } from '~/composables/useAdminDiscord';

  useHead({
    title: 'Admin - Discord Roster',
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  });

  const { listRoster, latestRun } = useAdminDiscord();

  const rows = ref<DiscordRosterRow[]>([]);
  const run = ref<DiscordAuditRun | null>(null);
  const loading = ref(true);
  const errorMessage = ref('');
  const search = ref('');
  const activeFilter = ref<DiscordClassification | 'all'>('all');

  async function load() {
    loading.value = true;
    errorMessage.value = '';
    try {
      const [roster, lastRun] = await Promise.all([listRoster(), latestRun()]);
      rows.value = roster;
      run.value = lastRun;
    } catch (error: any) {
      errorMessage.value = error?.message || 'Failed to load the Discord roster';
    } finally {
      loading.value = false;
    }
  }

  onMounted(load);

  const counts = computed(() => {
    const out: Record<string, number> = {};
    for (const row of rows.value) out[row.classification] = (out[row.classification] ?? 0) + 1;
    return out;
  });

  /** Only the classifications actually present, in worst-first order. */
  const presentClassifications = computed(() => DISCORD_CLASSIFICATION_ORDER.filter((c) => (counts.value[c] ?? 0) > 0));

  const filtered = computed(() => {
    const q = search.value.trim().toLowerCase();
    return rows.value.filter((row) => {
      if (activeFilter.value !== 'all' && row.classification !== activeFilter.value) return false;
      if (!q) return true;
      return (
        row.username.toLowerCase().includes(q) ||
        (row.global_name ?? '').toLowerCase().includes(q) ||
        (row.nick ?? '').toLowerCase().includes(q) ||
        (row.email ?? '').toLowerCase().includes(q) ||
        row.discord_user_id.includes(q)
      );
    });
  });

  /** Rows that represent access someone shouldn't have. */
  const needsAttention = computed(
    () => (counts.value.role_without_entitlement ?? 0) + (counts.value.unlinked_with_role ?? 0)
  );

  const lastRunLabel = computed(() => {
    if (!run.value?.started_at) return null;
    return new Date(run.value.started_at).toLocaleString();
  });

  /** An audit that hasn't landed in over 48h means the cron is wedged. */
  const runIsStale = computed(() => {
    if (!run.value?.started_at) return false;
    return Date.now() - new Date(run.value.started_at).getTime() > 48 * 60 * 60 * 1000;
  });

  function badgeFor(c: DiscordClassification) {
    return DISCORD_CLASSIFICATION_BADGES[c] ?? 'badge-ghost';
  }
  function labelFor(c: DiscordClassification) {
    return DISCORD_CLASSIFICATION_LABELS[c] ?? c;
  }
</script>

<template>
  <AdminShell title="Discord Roster" subtitle="Who is in the members-only Discord, reconciled against paid membership">
    <template #actions>
      <button type="button" class="btn btn-sm btn-outline" :disabled="loading" @click="load">
        <i class="fas fa-rotate" :class="{ 'fa-spin': loading }"></i>
        Refresh
      </button>
    </template>

    <p class="text-sm opacity-70 mb-4">
      Who is actually in the members-only Discord, reconciled against paid membership. This page is
      <strong>observe-only</strong> &mdash; nothing here removes a role or kicks anyone.
    </p>

    <div v-if="errorMessage" role="alert" class="alert alert-error mb-4">
      <i class="fas fa-triangle-exclamation"></i>
      <span>{{ errorMessage }}</span>
    </div>

    <!-- Audit freshness. Everything on this page is only as current as the last run. -->
    <div v-if="!loading && !run" role="alert" class="alert alert-warning mb-4">
      <i class="fas fa-circle-info"></i>
      <span>
        The Discord audit has never run, so the roster is empty. Check that the
        <code>discord-audit</code> cron is scheduled and the bot has the Server Members Intent enabled.
      </span>
    </div>
    <div v-else-if="run && !run.complete" role="alert" class="alert alert-warning mb-4">
      <i class="fas fa-triangle-exclamation"></i>
      <span>
        The last audit did not complete{{ run.last_error ? `: ${run.last_error}` : '' }}. The roster below may be
        partial &mdash; departures were deliberately not recorded.
      </span>
    </div>
    <div v-else-if="runIsStale" role="alert" class="alert alert-warning mb-4">
      <i class="fas fa-clock"></i>
      <span>Last successful audit was {{ lastRunLabel }} &mdash; over 48 hours ago. The cron may be wedged.</span>
    </div>

    <!-- Summary -->
    <div v-if="!loading" class="stats stats-vertical sm:stats-horizontal shadow mb-4 w-full">
      <div class="stat">
        <div class="stat-title">In the server</div>
        <div class="stat-value text-2xl">{{ rows.filter((r) => r.in_guild).length }}</div>
        <div v-if="lastRunLabel" class="stat-desc">Last checked {{ lastRunLabel }}</div>
      </div>
      <div class="stat">
        <div class="stat-title">Needs attention</div>
        <div class="stat-value text-2xl" :class="needsAttention > 0 ? 'text-error' : ''">
          {{ needsAttention }}
        </div>
        <div class="stat-desc">Holding the paid role without paying</div>
      </div>
      <div class="stat">
        <div class="stat-title">Not linked</div>
        <div class="stat-value text-2xl">{{ counts.unlinked ?? 0 }}</div>
        <div class="stat-desc">Mostly members who never claimed &mdash; not freeloaders</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <button
        type="button"
        class="btn btn-xs"
        :class="activeFilter === 'all' ? 'btn-primary' : 'btn-ghost'"
        @click="activeFilter = 'all'"
      >
        All ({{ rows.length }})
      </button>
      <button
        v-for="c in presentClassifications"
        :key="c"
        type="button"
        class="btn btn-xs"
        :class="activeFilter === c ? 'btn-primary' : 'btn-ghost'"
        @click="activeFilter = c"
      >
        {{ labelFor(c) }} ({{ counts[c] }})
      </button>
      <label class="input input-sm input-bordered flex items-center gap-2 ml-auto">
        <i class="fas fa-magnifying-glass opacity-50"></i>
        <input v-model="search" type="search" class="grow" placeholder="Handle, name, or email" />
      </label>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <i class="fas fa-spinner fa-spin text-3xl text-primary"></i>
    </div>

    <div v-else-if="filtered.length === 0" class="text-center py-12 opacity-60">
      <i class="fab fa-discord text-3xl mb-2"></i>
      <p>No members match.</p>
    </div>

    <div v-else class="overflow-x-auto">
      <table class="table table-sm table-zebra">
        <thead>
          <tr>
            <th>Discord</th>
            <th>Status</th>
            <th>Account</th>
            <th class="text-center">Role</th>
            <th class="text-center">Paying</th>
            <th>Joined server</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in filtered" :key="row.discord_user_id">
            <td>
              <div class="font-mono text-sm">@{{ row.username }}</div>
              <div v-if="row.global_name || row.nick" class="text-xs opacity-60">
                {{ row.nick || row.global_name }}
              </div>
              <div v-if="!row.in_guild" class="text-xs opacity-60 italic">not in server</div>
            </td>
            <td>
              <span class="badge badge-sm" :class="badgeFor(row.classification)">
                {{ labelFor(row.classification) }}
              </span>
            </td>
            <td>
              <span v-if="row.email" class="text-sm">{{ row.email }}</span>
              <span v-else class="text-xs opacity-60 italic">
                {{ row.user_id ? 'no email' : 'no linked account' }}
              </span>
              <div v-if="row.link_status && row.link_status !== 'active'" class="text-xs opacity-60">
                link: {{ row.link_status }}
              </div>
            </td>
            <td class="text-center">
              <i v-if="row.has_paid_role" class="fas fa-check text-success"></i>
              <i v-else class="fas fa-minus opacity-30"></i>
            </td>
            <td class="text-center">
              <i v-if="row.is_entitled" class="fas fa-check text-success"></i>
              <i v-else class="fas fa-minus opacity-30"></i>
            </td>
            <td class="text-sm opacity-70">
              {{ row.guild_joined_at ? new Date(row.guild_joined_at).toLocaleDateString() : '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AdminShell>
</template>
