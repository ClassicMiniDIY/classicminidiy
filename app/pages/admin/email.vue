<script setup lang="ts">
  import type { EmailDomainHealth, EmailHealthReport, EmailSeverity } from '~/composables/useAdminEmailHealth';

  /**
   * /admin/email — mail DNS posture for the three domains we receive on.
   *
   * Replaces the account-summary table that came with the Forward Email
   * subscription being retired. Design doc:
   * docs/plans/2026-09-03-forward-email-retirement.md
   *
   * Read-only. Routing changes are made in the Cloudflare dashboard; this page
   * is how you confirm they landed, which also makes it the verification tool
   * for the cutover rather than something built after it.
   *
   * Admin is internal tooling and is intentionally English-only (repo CLAUDE.md).
   */
  const { getHealth } = useAdminEmailHealth();

  const loading = ref(true);
  const refreshing = ref(false);
  const error = ref('');
  const report = ref<EmailHealthReport | null>(null);

  const load = async () => {
    error.value = '';
    try {
      report.value = await getHealth();
    } catch (err: any) {
      error.value = err?.statusMessage || err?.message || 'Failed to check mail DNS';
    }
  };

  onMounted(async () => {
    await load();
    loading.value = false;
  });

  const refresh = async () => {
    refreshing.value = true;
    await load();
    refreshing.value = false;
  };

  const BADGE: Record<EmailSeverity, string> = {
    ok: 'badge-success',
    warn: 'badge-warning',
    fail: 'badge-error',
    unknown: 'badge-ghost',
  };

  const ICON: Record<EmailSeverity, string> = {
    ok: 'fas fa-circle-check',
    warn: 'fas fa-triangle-exclamation',
    fail: 'fas fa-circle-xmark',
    unknown: 'fas fa-circle-question',
  };

  const TEXT: Record<EmailSeverity, string> = {
    ok: 'text-success',
    warn: 'text-warning',
    fail: 'text-error',
    unknown: 'text-base-content/40',
  };

  const LABEL: Record<EmailSeverity, string> = {
    ok: 'Healthy',
    warn: 'Needs attention',
    fail: 'Broken',
    unknown: 'Unknown',
  };

  /** Broken first — the page should open on whatever is actually wrong. */
  const RANK: Record<EmailSeverity, number> = { fail: 0, warn: 1, unknown: 2, ok: 3 };
  const sorted = computed<EmailDomainHealth[]>(() =>
    [...(report.value?.domains ?? [])].sort((a, b) => RANK[a.worst] - RANK[b.worst])
  );

  const migrated = computed(() => sorted.value.filter((d) => d.mxProvider === 'cloudflare').length);
  const total = computed(() => sorted.value.length);
  const allMigrated = computed(() => total.value > 0 && migrated.value === total.value);

  const checkedAt = computed(() =>
    report.value ? new Date(report.value.checkedAt).toLocaleString('en-US', { timeZoneName: 'short' }) : ''
  );

  useHead({ title: 'Mail DNS - Admin', meta: [{ name: 'robots', content: 'noindex, nofollow' }] });
</script>

<template>
  <AdminShell title="Mail DNS" subtitle="Inbound routing and sender authentication for the domains we receive on">
    <div v-if="loading" class="flex justify-center py-16">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else-if="error" role="alert" class="alert alert-error">
      <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
      <span>{{ error }}</span>
      <button class="btn btn-sm" @click="refresh">Retry</button>
    </div>

    <template v-else-if="report">
      <!-- Cutover progress. The whole page exists to move this counter. -->
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div
          role="status"
          class="alert"
          :class="allMigrated ? 'alert-success' : 'alert-info'"
          data-testid="cutover-status"
        >
          <i :class="allMigrated ? 'fas fa-circle-check' : 'fas fa-circle-info'" aria-hidden="true"></i>
          <span>
            <strong>{{ migrated }} of {{ total }}</strong> domains on Cloudflare Email Routing.
            <template v-if="!allMigrated">
              The rest still resolve to Forward Email — see
              <code class="text-xs">docs/plans/2026-09-03-forward-email-retirement.md</code>.
            </template>
            <template v-else> Forward Email can be cancelled after a 7-day soak. </template>
          </span>
        </div>

        <button class="btn btn-sm btn-outline" :disabled="refreshing" @click="refresh">
          <span v-if="refreshing" class="loading loading-spinner loading-xs"></span>
          <i v-else class="fas fa-rotate" aria-hidden="true"></i>
          Re-check
        </button>
      </div>

      <div class="grid gap-6">
        <div v-for="d in sorted" :key="d.domain" class="card bg-base-100 shadow">
          <div class="card-body">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="card-title font-mono text-lg">
                  {{ d.domain }}
                  <span class="badge badge-sm" :class="BADGE[d.worst]">{{ LABEL[d.worst] }}</span>
                </h2>
                <p class="text-base-content/60 text-sm">
                  {{ d.sends ? 'Sends and receives' : 'Receive-only' }}
                  <template v-if="d.mxHosts.length">
                    &middot; MX <span class="font-mono">{{ d.mxHosts.join(', ') }}</span>
                  </template>
                </p>
              </div>
            </div>

            <!-- Wide content scrolls inside its own container, never the page. -->
            <div class="mt-2 overflow-x-auto">
              <table class="table-zebra table table-sm">
                <thead>
                  <tr>
                    <th class="w-8"><span class="sr-only">Status</span></th>
                    <th class="w-48">Check</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in d.checks" :key="c.id">
                    <td>
                      <i :class="[ICON[c.severity], TEXT[c.severity]]" :aria-label="c.severity"></i>
                    </td>
                    <td class="whitespace-nowrap font-medium">{{ c.label }}</td>
                    <td class="text-base-content/80 font-mono text-xs break-all">{{ c.detail }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <p class="text-base-content/50 mt-6 text-xs">
        Checked {{ checkedAt }} over DNS-over-HTTPS against cloudflare-dns.com. DKIM is not verified: SES publishes it
        at per-identity selector tokens that this repo does not store, so it is reported as unknown rather than assumed
        good.
      </p>
    </template>
  </AdminShell>
</template>
