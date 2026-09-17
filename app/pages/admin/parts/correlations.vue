<script setup lang="ts">
  /**
   * /admin/parts/correlations — decide what a retailer's own numbering means.
   *
   * Moss Motors publishes only its own catalogue numbers. `114-403` means nothing
   * outside their catalogue and will never match a factory number, so its records
   * arrive attached to nothing. This screen is where a human attaches them, and
   * approving is what puts a US buy link on a factory part's page.
   *
   * ONE CARD PER LISTING, UP TO THREE CANDIDATES. The scorer proposes the top
   * three factory parts, best first. The reviewer confirms the first, picks
   * another, rejects one, or says nothing here fits. That last answer closes the
   * listing so the scorer stops re-proposing it; the Closed tab reopens it.
   *
   * TWO SCORES, NEITHER IS AN ARGUMENT. The trigram figure says how alike the
   * names are, which is not how likely the match is right. The model figure is a
   * second-stage P(same part) from a Supabase edge function and it IS a
   * probability, so the queue sorts by it once it exists. Both are shown small.
   * The card still leads with the evidence — what each side said about locking,
   * venting, body style, earth polarity — because asked to place "FUEL CAP,
   * locking" this archive offers a locking VENTED cap and a locking NON-VENTED
   * one, and only the qualifiers tell them apart.
   *
   * English-only, like every other /admin page.
   */
  interface CorrelationRow {
    id: string;
    confidence: number;
    separation: number;
    status: string;
    autoApproved: boolean;
    rank: number | null;
    partNumber: string | null;
    partDescription: string | null;
    partSlug: string | null;
    similarity: number | null;
    qualifiersListed: string[];
    qualifiersCandidate: string[];
    qualifiersAgreed: number;
    runnerUpScore: number | null;
    modelConfidence: number | null;
    modelSeparation: number | null;
    modelVersion: string | null;
    modelLevels: { different: number; related: number; same: number } | null;
    modelQualifiers: Record<string, number>;
  }

  interface CorrelationGroup {
    recordId: string;
    listedAs: string | null;
    listedNumber: string | null;
    sourceUrl: string | null;
    sourceName: string | null;
    noneFit: number | null;
    candidates: CorrelationRow[];
  }

  type Tab = 'proposed' | 'approved' | 'rejected' | 'closed';
  const TABS: Tab[] = ['proposed', 'approved', 'rejected', 'closed'];
  const status = ref<Tab>('proposed');

  /**
   * `useAdminFetch`, never a bare `useFetch`. The Supabase session lives in
   * localStorage, so `requireAdminAuth` on the server can only see it if the
   * token is attached as a Bearer header — which is what this wrapper does, and
   * it skips SSR for the same reason. A bare useFetch here returned 401 on every
   * request and the page rendered nothing but its error alert.
   */
  const { data, pending, error, refresh } = await useAdminFetch<{
    groups: CorrelationGroup[];
    counts: Record<string, number | null>;
    status: string;
  }>('/api/admin/parts/correlations', {
    query: computed(() => ({ status: status.value, limit: 50 })),
  });

  const groups = computed(() => data.value?.groups ?? []);
  const counts = computed(() => data.value?.counts ?? {});

  /** Ids currently being written, so a card cannot be double-submitted. */
  const busy = ref<Set<string>>(new Set());
  const failed = ref<Record<string, string>>({});
  /** Cards whose alternatives are unfolded. */
  const expanded = ref<Set<string>>(new Set());
  /** Listings reopened this visit: they leave Closed now and return to Proposed on the next scorer pass. */
  const reopened = ref(0);

  function toggle(recordId: string): void {
    const next = new Set(expanded.value);
    if (next.has(recordId)) next.delete(recordId);
    else next.add(recordId);
    expanded.value = next;
  }

  async function withBusy(key: string, run: () => Promise<unknown>): Promise<void> {
    if (busy.value.has(key)) return;
    busy.value = new Set([...busy.value, key]);
    delete failed.value[key];
    try {
      await run();
      await refresh();
    } catch (e) {
      // Surfaced on the card, not in a toast. A failed decision that vanishes is
      // one the reviewer believes they made.
      const err = e as { data?: { statusMessage?: string }; statusMessage?: string; message?: string };
      failed.value = {
        ...failed.value,
        [key]: err?.data?.statusMessage || err?.statusMessage || err?.message || 'Could not save that decision',
      };
    } finally {
      const next = new Set(busy.value);
      next.delete(key);
      busy.value = next;
    }
  }

  function decide(group: CorrelationGroup, row: CorrelationRow, approve: boolean): Promise<void> {
    return withBusy(group.recordId, () =>
      $adminFetch('/api/admin/parts/review-correlation', { method: 'POST', body: { id: row.id, approve } })
    );
  }

  function noEquivalent(group: CorrelationGroup): Promise<void> {
    const first = group.candidates[0];
    if (!first) return Promise.resolve();
    return withBusy(group.recordId, () =>
      $adminFetch('/api/admin/parts/review-correlation', {
        method: 'POST',
        body: { id: first.id, approve: false, noEquivalent: true },
      })
    );
  }

  async function reopen(group: CorrelationGroup): Promise<void> {
    await withBusy(group.recordId, () =>
      $adminFetch('/api/admin/parts/reopen-correlation', { method: 'POST', body: { recordId: group.recordId } })
    );
    if (!failed.value[group.recordId]) reopened.value += 1;
  }

  /**
   * Qualifiers the two sides disagree on.
   *
   * The scorer already refuses to propose a conflicting pair, so this should
   * always be empty — it renders anyway, because "should always" is not a thing
   * to rely on when the cost is the wrong part.
   */
  function conflicts(row: CorrelationRow): string[] {
    const candidate = new Map(row.qualifiersCandidate.map((q) => [q.split(':')[0], q]));
    return row.qualifiersListed.filter((q) => {
      const other = candidate.get(q.split(':')[0]);
      return other !== undefined && other !== q;
    });
  }

  /** Qualifiers only one side stated. Not a conflict — silence is not disagreement. */
  function unmatched(row: CorrelationRow): string[] {
    const listed = new Set(row.qualifiersListed.map((q) => q.split(':')[0]));
    return row.qualifiersCandidate.filter((q) => !listed.has(q.split(':')[0]));
  }

  function label(qualifier: string): string {
    const [facet, value] = qualifier.split(':');
    return `${facet}: ${value}`;
  }

  function pct(p: number): string {
    return `${Math.round(p * 100)}%`;
  }

  /** The model's read of a candidate in one phrase, from its three-level distribution. */
  function verdict(row: CorrelationRow): { text: string; tone: string } | null {
    if (row.modelConfidence === null || !row.modelLevels) return null;
    const { different, related, same } = row.modelLevels;
    if (same >= 0.8) return { text: `likely the same part (${pct(same)})`, tone: 'badge-success' };
    if (different >= 0.8) return { text: `likely a different part (${pct(different)})`, tone: 'badge-error' };
    if (related >= 0.5) return { text: `related, needs a look (${pct(related)})`, tone: 'badge-warning' };
    return { text: `unsure — same ${pct(same)}, different ${pct(different)}`, tone: 'badge-ghost' };
  }

  useHead({ title: 'Part correlations - Admin' });
</script>

<template>
  <AdminShell title="Part correlations" subtitle="Retailer catalogue numbers proposed against factory part numbers">
    <div class="mx-auto w-full max-w-5xl">
      <div class="mb-6 alert">
        <i class="fas fa-circle-info" />
        <span>
          These are proposals, not facts. Nothing here appears anywhere public until it is approved. Approving writes
          the link that puts a retailer's buy link on a factory part's page.
        </span>
      </div>

      <div class="mb-4 flex flex-wrap items-center gap-2">
        <button
          v-for="tab in TABS"
          :key="tab"
          type="button"
          class="btn btn-sm"
          :class="status === tab ? 'btn-primary' : 'btn-outline'"
          :aria-pressed="status === tab"
          @click="status = tab"
        >
          {{ tab }}
          <span class="badge badge-sm">{{ counts[tab] === null ? '?' : (counts[tab] ?? '—') }}</span>
        </button>
        <span
          v-if="status === 'proposed' && typeof counts.unscored === 'number' && counts.unscored > 0"
          class="ml-auto text-xs text-base-content/60"
          title="Proposals the second-stage model has not scored yet. They sort after the scored ones."
        >
          {{ counts.unscored }} awaiting model score
        </span>
      </div>

      <div v-if="status === 'closed' && reopened > 0" class="mb-4 alert alert-success py-2">
        <i class="fas fa-rotate-left" />
        <span class="text-sm">
          Reopened {{ reopened }}. The scorer proposes again on its next pass, within a few minutes; the listing then
          shows under Proposed.
        </span>
      </div>

      <div v-if="pending" class="flex justify-center py-16"><span class="loading loading-spinner loading-lg" /></div>

      <div v-else-if="error" class="alert alert-error">
        <i class="fas fa-triangle-exclamation" />
        <span>The correlation queue could not be loaded.</span>
      </div>

      <p v-else-if="groups.length === 0" class="py-16 text-center text-base-content/60">
        <i class="fas fa-inbox mb-3 block text-3xl" />
        Nothing {{ status }}.
      </p>

      <div v-else class="space-y-4">
        <article v-for="group in groups" :key="group.recordId" class="card border border-base-300 bg-base-100">
          <div class="card-body gap-3">
            <!-- THE LISTING. One per card; every candidate below is compared to it. -->
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-xs uppercase tracking-wide text-base-content/50">
                  {{ group.sourceName || 'Retailer' }} lists
                </p>
                <p class="font-mono text-sm font-semibold">{{ group.listedNumber || '—' }}</p>
                <p class="text-sm text-base-content/80">{{ group.listedAs || '—' }}</p>
                <a
                  v-if="group.sourceUrl"
                  :href="group.sourceUrl"
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  class="link link-xs"
                >
                  Open the listing
                  <i class="fas fa-arrow-up-right-from-square ml-1 text-xs" />
                </a>
              </div>
              <span
                v-if="group.noneFit !== null && group.noneFit >= 0.5"
                class="badge badge-warning badge-sm"
                title="The model thinks the listed item is probably not any of these candidates"
              >
                probably none of these ({{ pct(group.noneFit) }})
              </span>
            </div>

            <!-- CLOSED: a human said nothing in the archive is this part. -->
            <div v-if="status === 'closed'" class="card-actions items-center justify-between">
              <p class="text-xs text-base-content/60">Closed: no factory equivalent. The scorer skips this listing.</p>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                :disabled="busy.has(group.recordId)"
                @click="reopen(group)"
              >
                Reopen
              </button>
            </div>

            <!-- THE CANDIDATES. Best first; the rest fold away until asked for. -->
            <template v-else>
              <div
                v-for="(row, i) in group.candidates"
                :key="row.id"
                v-show="i === 0 || expanded.has(group.recordId)"
                class="rounded-box border border-base-200 p-3"
                :class="i === 0 ? '' : 'bg-base-200/40'"
              >
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p class="text-xs uppercase tracking-wide text-base-content/50">
                      {{ i === 0 ? 'Best candidate' : `Alternative ${i}` }}
                      <span v-if="row.rank !== null" class="normal-case"> · trigram #{{ row.rank }}</span>
                    </p>
                    <p class="font-mono text-sm font-semibold">{{ row.partNumber || '—' }}</p>
                    <p class="text-sm text-base-content/80">{{ row.partDescription || '—' }}</p>
                    <NuxtLink v-if="row.partSlug" :to="`/archive/parts/${row.partSlug}`" class="link link-xs">
                      Open the part
                    </NuxtLink>
                  </div>
                  <span v-if="verdict(row)" class="badge badge-sm" :class="verdict(row)!.tone">
                    {{ verdict(row)!.text }}
                  </span>
                </div>

                <!--
                  THE EVIDENCE. A conflict should be impossible — the scorer refuses
                  to propose one — so if it ever renders, it is the most important
                  thing on the card and it says so loudly.
                -->
                <div v-if="conflicts(row).length" class="mt-2 alert alert-error py-2">
                  <i class="fas fa-triangle-exclamation" />
                  <span class="text-sm">
                    These disagree: {{ conflicts(row).map(label).join(', ') }}. Do not approve without checking.
                  </span>
                </div>

                <div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  <span v-if="row.qualifiersAgreed > 0" class="badge badge-success badge-sm">
                    {{ row.qualifiersAgreed }} agreed
                  </span>
                  <span v-for="q in row.qualifiersListed" :key="`l-${q}`" class="badge badge-outline badge-sm">
                    {{ label(q) }}
                    <span v-if="row.modelQualifiers[q.split(':')[0]] !== undefined" class="ml-1 opacity-70">
                      {{ pct(row.modelQualifiers[q.split(':')[0]]!) }}
                    </span>
                  </span>
                  <span
                    v-for="q in unmatched(row)"
                    :key="`c-${q}`"
                    class="badge badge-ghost badge-sm"
                    title="Only the archive states this — the retailer did not say"
                  >
                    {{ label(q) }}?
                  </span>
                </div>

                <!-- The numbers, small and in words, after the evidence. -->
                <p class="mt-2 text-xs text-base-content/60">
                  <template v-if="row.modelConfidence !== null">
                    Model {{ pct(row.modelConfidence) }} same
                    <span v-if="i === 0 && row.modelSeparation !== null">
                      ·
                      <span :class="row.modelSeparation < 0.1 ? 'font-semibold text-warning' : ''">
                        {{
                          row.modelSeparation < 0.1
                            ? 'near-tie with the next candidate'
                            : `ahead of the next by ${pct(row.modelSeparation)}`
                        }}
                      </span>
                    </span>
                    ·
                  </template>
                  <span v-else>Model: not yet scored · </span>
                  Trigram {{ row.confidence.toFixed(2) }}
                  <span v-if="row.similarity !== null"> (text {{ row.similarity.toFixed(2) }})</span>
                  <template v-if="row.modelConfidence === null && i === 0">
                    ·
                    <span :class="row.separation < 0.05 ? 'font-semibold text-warning' : ''">
                      {{
                        row.separation < 0.05
                          ? `near-tie with the next candidate (${(row.runnerUpScore ?? 0).toFixed(2)})`
                          : `beats the next candidate by ${row.separation.toFixed(2)}`
                      }}
                    </span>
                  </template>
                  <span v-if="row.autoApproved"> · approved by threshold, unreviewed</span>
                  <span v-if="row.modelVersion"> · {{ row.modelVersion }}</span>
                </p>

                <div v-if="row.status === 'proposed'" class="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    :disabled="busy.has(group.recordId)"
                    @click="decide(group, row, false)"
                  >
                    Reject this one
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary btn-xs"
                    :disabled="busy.has(group.recordId)"
                    @click="decide(group, row, true)"
                  >
                    <span v-if="busy.has(group.recordId)" class="loading loading-spinner loading-xs" />
                    Approve this one
                  </button>
                </div>
                <div v-else class="mt-2 flex justify-end">
                  <!-- Rejecting an approved correlation also clears the link it wrote. -->
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    :disabled="busy.has(group.recordId)"
                    @click="decide(group, row, row.status !== 'approved')"
                  >
                    {{ row.status === 'approved' ? 'Undo — reject this' : 'Approve after all' }}
                  </button>
                </div>
              </div>

              <p v-if="failed[group.recordId]" class="text-sm text-error">{{ failed[group.recordId] }}</p>

              <div class="card-actions items-center justify-between">
                <button
                  v-if="group.candidates.length > 1"
                  type="button"
                  class="btn btn-ghost btn-xs"
                  :aria-expanded="expanded.has(group.recordId)"
                  @click="toggle(group.recordId)"
                >
                  <i class="fas" :class="expanded.has(group.recordId) ? 'fa-chevron-up' : 'fa-chevron-down'" />
                  {{
                    expanded.has(group.recordId)
                      ? 'Hide alternatives'
                      : `${group.candidates.length - 1} more candidate${group.candidates.length > 2 ? 's' : ''}`
                  }}
                </button>
                <span v-else />
                <button
                  v-if="status === 'proposed'"
                  type="button"
                  class="btn btn-outline btn-xs"
                  :disabled="busy.has(group.recordId)"
                  title="Close this listing: nothing in the archive is this part. The scorer stops proposing it."
                  @click="noEquivalent(group)"
                >
                  None of these — no factory equivalent
                </button>
              </div>
            </template>
          </div>
        </article>
      </div>
    </div>
  </AdminShell>
</template>
