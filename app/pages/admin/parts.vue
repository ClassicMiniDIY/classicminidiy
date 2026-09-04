<script setup lang="ts">
  /**
   * /admin/parts — the per-source licence kill switch.
   *
   * Mitigation 4 of the part-number database design
   * (docs/plans/2026-09-04-parts-number-database.md). Setting a source to
   * `declined` removes every row it contributed from the public archive, without
   * deleting anything, and stops its crawl. Reversible: restoring the previous
   * status brings the same rows back with no re-ingest.
   *
   * English-only, like every other /admin page.
   */
  interface SourceCounts {
    parts: number;
    diagrams: number;
    callouts: number;
    applicability: number;
    supersessions: number;
    kitContents: number;
    sourceRecords: number;
    publicRows: number;
  }

  interface PartSource {
    id: string;
    slug: string;
    name: string;
    domain: string;
    kind: string;
    licenceStatus: 'none' | 'requested' | 'granted' | 'declined';
    termsUrl: string | null;
    precedence: number;
    lastReviewedAt: string | null;
    licenceNote: string | null;
    licenceChangedAt: string | null;
    contactEmail: string | null;
    crawlEnabled: boolean;
    maxRequestsPerRun: number | null;
    maxRequestsPerDay: number | null;
    minRequestIntervalMs: number | null;
    maxChangeRatio: number | null;
    counts: SourceCounts;
  }

  const STATUSES = ['none', 'requested', 'granted', 'declined'] as const;
  type Status = (typeof STATUSES)[number];

  const STATUS_TONE: Record<Status, string> = {
    none: 'badge-ghost',
    requested: 'badge-info',
    granted: 'badge-success',
    declined: 'badge-error',
  };

  const STATUS_HELP: Record<Status, string> = {
    none: 'No licence discussion has happened. Rows are public.',
    requested: 'We have asked for a licence and are waiting. Rows are public.',
    granted: 'The source has agreed to our use. Rows are public.',
    declined: 'The source objected. Every row is hidden and the crawl is off.',
  };

  const { data, pending, error, refresh } = useAdminFetch<{ sources: PartSource[] }>('/api/admin/parts/sources');
  const sources = computed(() => data.value?.sources ?? []);

  const busy = ref<string | null>(null);
  const toast = ref<{ type: 'success' | 'error'; text: string } | null>(null);
  function flash(type: 'success' | 'error', text: string) {
    toast.value = { type, text };
    setTimeout(() => {
      if (toast.value?.text === text) toast.value = null;
    }, 5000);
  }

  const numberFormat = new Intl.NumberFormat('en-US');
  function fmt(n: number | null | undefined) {
    return numberFormat.format(n ?? 0);
  }
  function fmtDate(value: string | null) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /**
   * The pending change. A decline is confirmed against its own blast radius, so
   * the dialog holds the source it applies to rather than reading a shared ref.
   */
  const pendingChange = ref<{ source: PartSource; status: Status } | null>(null);
  const reason = ref('');
  const reasonError = computed(() => {
    const trimmed = reason.value.trim();
    if (trimmed.length === 0) return 'A reason is required.';
    if (trimmed.length < 4) return 'Give a slightly longer reason.';
    if (trimmed.length > 500) return 'Keep the reason under 500 characters.';
    return null;
  });

  function openChange(source: PartSource, status: Status) {
    if (status === source.licenceStatus) return;
    reason.value = '';
    pendingChange.value = { source, status };
  }

  function cancelChange() {
    pendingChange.value = null;
    reason.value = '';
  }

  async function applyChange() {
    const change = pendingChange.value;
    if (!change || reasonError.value) return;
    busy.value = change.source.id;
    try {
      await $adminFetch('/api/admin/parts/set-licence', {
        method: 'POST',
        body: { sourceId: change.source.id, status: change.status, reason: reason.value.trim() },
      });
      flash(
        'success',
        change.status === 'declined'
          ? `${change.source.name} declined — ${fmt(change.source.counts.publicRows)} rows hidden and its crawl stopped.`
          : `${change.source.name} set to ${change.status}.`
      );
      cancelChange();
      await refresh();
    } catch (e: any) {
      flash('error', e?.data?.statusMessage || e?.statusMessage || 'Could not change the licence status.');
    } finally {
      busy.value = null;
    }
  }
</script>

<template>
  <AdminShell title="Parts Sources" subtitle="Licence status and crawl budget for every part-number source">
    <div v-if="toast" class="mb-4">
      <div role="status" :class="['alert', toast.type === 'success' ? 'alert-success' : 'alert-error']">
        <i :class="toast.type === 'success' ? 'fas fa-circle-check' : 'fas fa-triangle-exclamation'" />
        <span class="min-w-0 break-words">{{ toast.text }}</span>
      </div>
    </div>

    <div class="mb-6 rounded-box border border-base-300 bg-base-200 p-4">
      <h2 class="mb-1 flex items-center gap-2 text-sm font-semibold">
        <i class="fas fa-circle-info text-info" />
        What declining a source does
      </h2>
      <p class="text-sm text-base-content/70">
        Declining hides every part, diagram, callout and applicability row that source contributed, across the archive,
        the chat tools and the mobile apps at once. It also stops that source being crawled. Nothing is deleted, so
        restoring the previous status brings the same rows back with no re-import.
      </p>
    </div>

    <div v-if="pending" class="flex justify-center py-16">
      <span class="loading loading-spinner loading-lg" />
    </div>

    <div v-else-if="error" class="alert alert-error">
      <i class="fas fa-triangle-exclamation" />
      <span>Could not load part sources.</span>
      <button class="btn btn-sm" @click="refresh()">Retry</button>
    </div>

    <div v-else-if="sources.length === 0" class="py-16 text-center text-base-content/60">
      <i class="fas fa-database mb-3 block text-3xl" />
      <p>No part sources are registered yet.</p>
    </div>

    <div v-else class="space-y-4">
      <div v-for="source in sources" :key="source.id" class="card border border-base-300 bg-base-100">
        <div class="card-body gap-4 p-4 sm:p-6">
          <!-- Identity -->
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="truncate text-lg font-semibold">{{ source.name }}</h3>
                <span :class="['badge badge-sm', STATUS_TONE[source.licenceStatus]]">{{ source.licenceStatus }}</span>
                <span class="badge badge-sm badge-outline">{{ source.kind }}</span>
                <span v-if="source.crawlEnabled" class="badge badge-sm badge-warning">
                  <i class="fas fa-spider mr-1" />crawling
                </span>
                <span v-else class="badge badge-sm badge-ghost">crawl off</span>
              </div>
              <p class="mt-1 truncate text-sm text-base-content/60">
                {{ source.domain }}
                <span class="mx-1">·</span>
                precedence {{ source.precedence }}
                <span class="mx-1">·</span>
                reviewed {{ fmtDate(source.lastReviewedAt) }}
              </p>
            </div>
            <a
              v-if="source.termsUrl"
              :href="source.termsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-ghost btn-sm shrink-0"
            >
              <i class="fas fa-scale-balanced" />
              Terms
            </a>
          </div>

          <!-- Blast radius: what a decline would hide -->
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <div
              v-for="stat in [
                { label: 'Parts', value: source.counts.parts },
                { label: 'Diagrams', value: source.counts.diagrams },
                { label: 'Callouts', value: source.counts.callouts },
                { label: 'Applicability', value: source.counts.applicability },
                { label: 'Supersessions', value: source.counts.supersessions },
                { label: 'Kit contents', value: source.counts.kitContents },
              ]"
              :key="stat.label"
              class="rounded-box bg-base-200 px-3 py-2"
            >
              <div class="text-xs text-base-content/60">{{ stat.label }}</div>
              <div class="font-mono text-lg font-semibold">{{ fmt(stat.value) }}</div>
            </div>
          </div>

          <p class="text-sm text-base-content/70">
            <i class="fas fa-eye-slash mr-1" />
            Declining would hide
            <strong>{{ fmt(source.counts.publicRows) }}</strong>
            public rows.
          </p>

          <!-- Crawl budget -->
          <div class="flex flex-wrap gap-x-6 gap-y-1 text-xs text-base-content/60">
            <span>Budget: {{ fmt(source.maxRequestsPerRun) }} req/run</span>
            <span>{{ fmt(source.maxRequestsPerDay) }} req/day</span>
            <span>{{ fmt(source.minRequestIntervalMs) }} ms apart</span>
            <span>abort over {{ Math.round((source.maxChangeRatio ?? 0) * 100) }}% change</span>
          </div>

          <div v-if="source.licenceNote" class="rounded-box bg-base-200 px-3 py-2 text-sm">
            <span class="font-semibold">Last licence note:</span>
            <span class="break-words">{{ source.licenceNote }}</span>
            <span class="text-base-content/50"> ({{ fmtDate(source.licenceChangedAt) }})</span>
          </div>

          <!-- Status control -->
          <div class="flex flex-wrap items-center gap-2 border-t border-base-300 pt-3">
            <span class="text-sm font-semibold">Licence status:</span>
            <button
              v-for="status in STATUSES"
              :key="status"
              type="button"
              class="btn btn-sm"
              :class="[
                status === source.licenceStatus ? 'btn-active' : 'btn-outline',
                status === 'declined' ? 'btn-error' : '',
              ]"
              :disabled="busy === source.id || status === source.licenceStatus"
              :title="STATUS_HELP[status]"
              @click="openChange(source, status)"
            >
              <i v-if="status === 'declined'" class="fas fa-ban" />
              {{ status }}
            </button>
            <span v-if="busy === source.id" class="loading loading-spinner loading-sm" />
          </div>
        </div>
      </div>
    </div>

    <!-- Confirmation. Stated in rows, not in adjectives. -->
    <div v-if="pendingChange" class="modal modal-open">
      <div class="modal-box max-w-lg">
        <h3 class="mb-2 flex items-center gap-2 text-lg font-bold">
          <i
            :class="pendingChange.status === 'declined' ? 'fas fa-ban text-error' : 'fas fa-pen-to-square text-primary'"
          />
          {{ pendingChange.status === 'declined' ? 'Decline' : 'Change' }} {{ pendingChange.source.name }}
        </h3>

        <p class="mb-3 text-sm text-base-content/70">
          {{ pendingChange.source.licenceStatus }} → <strong>{{ pendingChange.status }}</strong>
        </p>

        <div v-if="pendingChange.status === 'declined'" class="alert alert-warning mb-3">
          <i class="fas fa-eye-slash" />
          <span class="min-w-0">
            This hides {{ fmt(pendingChange.source.counts.publicRows) }} public rows and stops the crawl. Nothing is
            deleted — you can restore it later.
          </span>
        </div>
        <p v-else class="mb-3 text-sm text-base-content/70">{{ STATUS_HELP[pendingChange.status] }}</p>

        <label class="form-control w-full">
          <span class="label-text mb-1">Reason (recorded against the source and in the audit log)</span>
          <textarea
            v-model="reason"
            class="textarea textarea-bordered w-full"
            rows="3"
            maxlength="500"
            placeholder="e.g. Takedown request received by email 2026-09-04"
          />
        </label>
        <p v-if="reasonError" class="mt-1 text-sm text-error">{{ reasonError }}</p>

        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="cancelChange">Cancel</button>
          <button
            type="button"
            class="btn"
            :class="pendingChange.status === 'declined' ? 'btn-error' : 'btn-primary'"
            :disabled="!!reasonError || busy === pendingChange.source.id"
            @click="applyChange"
          >
            <span v-if="busy === pendingChange.source.id" class="loading loading-spinner loading-sm" />
            {{ pendingChange.status === 'declined' ? 'Decline and hide' : 'Apply' }}
          </button>
        </div>
      </div>
      <div class="modal-backdrop bg-black/40" @click="cancelChange" />
    </div>
  </AdminShell>
</template>
