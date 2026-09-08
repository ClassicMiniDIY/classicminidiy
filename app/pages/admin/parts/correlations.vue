<script setup lang="ts">
  /**
   * /admin/parts/correlations — decide what a retailer's own numbering means.
   *
   * Moss Motors publishes only its own catalogue numbers. `114-403` means nothing
   * outside their catalogue and will never match a factory number, so its records
   * arrive attached to nothing. This screen is where a human attaches them, and
   * approving is what puts a US buy link on a factory part's page.
   *
   * THE SCORE IS A SORT ORDER, NOT AN ARGUMENT. A string-similarity number of
   * 0.95 means the names are 95% alike, not that the match is 95% likely to be
   * right, and the two come apart exactly where it matters. Asked to place "FUEL
   * CAP, locking" this archive offers a locking VENTED cap and a locking
   * NON-VENTED one; the descriptions are near-identical and only one is correct.
   * So the row leads with the evidence — what each side said about locking,
   * venting, body style, earth polarity — and shows the score as a small figure
   * beside it. A reviewer asked to trust a number cannot catch that case.
   *
   * HARDEST FIRST. The queue sorts by SEPARATION ascending: a proposal whose
   * runner-up scored almost as well is the one most likely to be wrong, and it
   * should be seen while the reviewer is still paying attention rather than
   * buried under fifty easy ones.
   *
   * English-only, like every other /admin page.
   */
  interface CorrelationRow {
    id: string;
    confidence: number;
    separation: number;
    status: string;
    autoApproved: boolean;
    listedAs: string | null;
    listedNumber: string | null;
    sourceUrl: string | null;
    sourceName: string | null;
    partNumber: string | null;
    partDescription: string | null;
    partSlug: string | null;
    similarity: number | null;
    qualifiersListed: string[];
    qualifiersCandidate: string[];
    qualifiersAgreed: number;
    runnerUpScore: number | null;
  }

  const status = ref<'proposed' | 'approved' | 'rejected'>('proposed');

  const { data, pending, error, refresh } = await useFetch<{
    rows: CorrelationRow[];
    counts: Record<string, number | null>;
    status: string;
  }>('/api/admin/parts/correlations', {
    query: computed(() => ({ status: status.value, limit: 50 })),
  });

  const rows = computed(() => data.value?.rows ?? []);
  const counts = computed(() => data.value?.counts ?? {});

  /** Ids currently being written, so a row cannot be double-submitted. */
  const busy = ref<Set<string>>(new Set());
  const failed = ref<Record<string, string>>({});

  async function decide(row: CorrelationRow, approve: boolean): Promise<void> {
    if (busy.value.has(row.id)) return;
    busy.value = new Set([...busy.value, row.id]);
    delete failed.value[row.id];
    try {
      await $fetch('/api/admin/parts/review-correlation', {
        method: 'POST',
        body: { id: row.id, approve },
      });
      await refresh();
    } catch (e) {
      // Surfaced on the row, not in a toast. A failed decision that vanishes is
      // one the reviewer believes they made.
      failed.value = { ...failed.value, [row.id]: (e as Error)?.message ?? 'Could not save that decision' };
    } finally {
      const next = new Set(busy.value);
      next.delete(row.id);
      busy.value = next;
    }
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

      <div class="mb-4 flex flex-wrap gap-2">
        <button
          v-for="tab in ['proposed', 'approved', 'rejected'] as const"
          :key="tab"
          type="button"
          class="btn btn-sm"
          :class="status === tab ? 'btn-primary' : 'btn-outline'"
          :aria-pressed="status === tab"
          @click="status = tab"
        >
          {{ tab }}
          <span class="badge badge-sm">{{ counts[tab] === null ? '?' : counts[tab] }}</span>
        </button>
      </div>

      <div v-if="pending" class="flex justify-center py-16"><span class="loading loading-spinner loading-lg" /></div>

      <div v-else-if="error" class="alert alert-error">
        <i class="fas fa-triangle-exclamation" />
        <span>The correlation queue could not be loaded.</span>
      </div>

      <p v-else-if="rows.length === 0" class="py-16 text-center text-base-content/60">
        <i class="fas fa-inbox mb-3 block text-3xl" />
        Nothing {{ status }}.
      </p>

      <div v-else class="space-y-4">
        <article v-for="row in rows" :key="row.id" class="card border border-base-300 bg-base-100">
          <div class="card-body gap-3">
            <!--
              THE TWO SIDES, SIDE BY SIDE, as text. This is the comparison the
              reviewer is actually making; everything else on the card supports it.
            -->
            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <p class="text-xs uppercase tracking-wide text-base-content/50">
                  {{ row.sourceName || 'Retailer' }} lists
                </p>
                <p class="font-mono text-sm font-semibold">{{ row.listedNumber || '—' }}</p>
                <p class="text-sm text-base-content/80">{{ row.listedAs || '—' }}</p>
                <a
                  v-if="row.sourceUrl"
                  :href="row.sourceUrl"
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  class="link link-xs"
                >
                  Open the listing
                  <i class="fas fa-arrow-up-right-from-square ml-1 text-xs" />
                </a>
              </div>
              <div>
                <p class="text-xs uppercase tracking-wide text-base-content/50">Proposed factory part</p>
                <p class="font-mono text-sm font-semibold">{{ row.partNumber || '—' }}</p>
                <p class="text-sm text-base-content/80">{{ row.partDescription || '—' }}</p>
                <NuxtLink v-if="row.partSlug" :to="`/archive/parts/${row.partSlug}`" class="link link-xs">
                  Open the part
                </NuxtLink>
              </div>
            </div>

            <!--
              THE EVIDENCE. A conflict should be impossible — the scorer refuses to
              propose one — so if it ever renders, it is the most important thing
              on the card and it says so loudly.
            -->
            <div v-if="conflicts(row).length" class="alert alert-error py-2">
              <i class="fas fa-triangle-exclamation" />
              <span class="text-sm">
                These disagree: {{ conflicts(row).map(label).join(', ') }}. Do not approve without checking.
              </span>
            </div>

            <div class="flex flex-wrap items-center gap-1.5 text-xs">
              <span v-if="row.qualifiersAgreed > 0" class="badge badge-success badge-sm">
                {{ row.qualifiersAgreed }} agreed
              </span>
              <span v-for="q in row.qualifiersListed" :key="`l-${q}`" class="badge badge-outline badge-sm">
                {{ label(q) }}
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

            <!--
              Separation matters more than the score, so it is said in words. A
              near-tie means the scorer had no real basis for choosing.
            -->
            <p class="text-xs text-base-content/60">
              Score {{ row.confidence.toFixed(2) }}
              <span v-if="row.similarity !== null"> · text {{ row.similarity.toFixed(2) }}</span>
              ·
              <span :class="row.separation < 0.05 ? 'font-semibold text-warning' : ''">
                {{
                  row.separation < 0.05
                    ? `near-tie with the next candidate (${(row.runnerUpScore ?? 0).toFixed(2)})`
                    : `beats the next candidate by ${row.separation.toFixed(2)}`
                }}
              </span>
              <span v-if="row.autoApproved"> · approved by threshold, unreviewed</span>
            </p>

            <p v-if="failed[row.id]" class="text-sm text-error">{{ failed[row.id] }}</p>

            <div v-if="row.status === 'proposed'" class="card-actions justify-end">
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                :disabled="busy.has(row.id)"
                @click="decide(row, false)"
              >
                Reject
              </button>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                :disabled="busy.has(row.id)"
                @click="decide(row, true)"
              >
                <span v-if="busy.has(row.id)" class="loading loading-spinner loading-xs" />
                Approve
              </button>
            </div>
            <div v-else class="card-actions justify-end">
              <!-- Rejecting an approved correlation also clears the link it wrote. -->
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                :disabled="busy.has(row.id)"
                @click="decide(row, row.status !== 'approved')"
              >
                {{ row.status === 'approved' ? 'Undo — reject this' : 'Approve after all' }}
              </button>
            </div>
          </div>
        </article>
      </div>
    </div>
  </AdminShell>
</template>
