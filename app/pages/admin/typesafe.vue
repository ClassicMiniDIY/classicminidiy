<script setup lang="ts">
  /**
   * /admin/typesafe — the TypeSafe programme on one page.
   *
   * One card per graduation decision. Each states what it measures, shows the
   * number with its sample size, grades it against a bar, and puts the switch
   * beside it. The bars are starting points from the readout design doc in the
   * private repo; they are constants here on purpose, so changing one is a
   * reviewed commit and not a click. Nothing on this page flips itself.
   */
  useHead({
    title: 'Admin - TypeSafe',
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  });

  interface ModeRow {
    surface: 'chat' | 'models' | 'search' | 'queue' | 'mcp';
    key: string;
    row: string | null;
    env: string;
    effective: string;
    updatedAt: string | null;
  }
  interface CostRow {
    caller: string;
    source: string;
    calls: number;
    input_tokens: number;
    usd: number;
    avg_ms: number;
    p95_ms: number;
  }
  interface TierRow {
    tier: string;
    runs: number;
    with_tool: number;
    avg_confidence: number | null;
    hint_tool_used: number;
  }
  interface Readout {
    days: number;
    modes: ModeRow[];
    screenMode: string;
    savedSearchMode: string;
    readout: {
      cost: CostRow[];
      chat: { runs: number; classified: number; by_tier: TierRow[]; classifier_status: Record<string, number> };
      search: {
        shadow: {
          total?: number;
          answered?: number;
          timeout?: number;
          error?: number;
          agree_kind?: number;
          agree_lead?: number;
          avg_ms?: number | null;
        };
        by_regex_kind: { regex_kind: string; n: number; agree_kind: number; agree_lead: number }[];
        misses: Record<string, number>;
        recent_typos: { query: string; corrected: string | null; p: number | null }[];
      };
      screen: {
        screened: number;
        held: number;
        cleared: number;
        cleared_then_rejected: number;
        held_then_approved: number;
        held_then_rejected: number;
        still_pending: number;
        wanted: Record<string, number>;
      };
      parts: {
        by_status: Record<string, number>;
        model_scored: number;
        unscored_proposed: number;
        human_reviewed: number;
        precision: { threshold: number; at_or_above: number; approved: number }[];
        bands: { records?: number; lt30?: number; b30_60?: number; b60_85?: number; ge85?: number; closable?: number };
        model_closed: number;
        model_closes_reopened: number;
        sources: {
          id: string;
          name: string;
          slug: string;
          auto_approve_source: string;
          auto_approve_confidence: number;
          auto_approve_margin: number;
          auto_close_confidence: number;
          auto_close_none_fit: number;
          open_records: number;
          proposed: number;
          auto_approved: number;
          auto_closed: number;
        }[];
      };
      mcp: { tool: string; calls: number; picked: number; avg_p: number | null; avg_ms: number | null }[];
      queue: { hinted: number; with_top: number; pending_hinted: number; attached: number };
      saved_search: { per_day: { day: string; n: number }[]; semantic_calls: number };
    };
  }

  // -- The bars -------------------------------------------------------------
  // From docs/plans/2026-09-18-typesafe-readout.md in the private repo.
  const BARS = {
    chat: { minRuns: 100, maxTimeoutShare: 0.2, maxSpecToolRate: 0.6, minConfidence: 0.7 },
    screen: { minScreened: 30, maxHeldApprovedShare: 0.2 },
    search: { minAnswered: 300, maxTimeoutShare: 0.3, leadAgreeLow: 0.5, leadAgreeHigh: 0.85 },
    parts: { minReviewed: 50, minPrecision: 0.95 },
    mcp: { minAvgP: 0.6 },
  } as const;

  // One card at a time. The two-column grid hid table columns; a tab strip
  // gives each card the full width. The choice is a per-viewer convenience.
  const TABS = [
    { key: 'chat', label: 'Chat classifier', icon: 'fas fa-comments' },
    { key: 'screen', label: 'Message screen', icon: 'fas fa-shield-halved' },
    { key: 'search', label: 'Search', icon: 'fas fa-magnifying-glass' },
    { key: 'parts', label: 'Part correlations', icon: 'fas fa-link' },
    { key: 'mcp', label: 'MCP pick', icon: 'fas fa-crosshairs' },
    { key: 'queue', label: 'Queue + models', icon: 'fas fa-clone' },
    { key: 'saved', label: 'Saved searches', icon: 'fas fa-bell' },
  ] as const;
  type TabKey = (typeof TABS)[number]['key'];
  const TAB_STORAGE = 'admin-typesafe-tab';
  const tab = ref<TabKey>('chat');
  onMounted(() => {
    try {
      const saved = localStorage.getItem(TAB_STORAGE);
      if (saved && TABS.some((t) => t.key === saved)) tab.value = saved as TabKey;
    } catch {
      // storage unavailable: the default tab is fine
    }
  });
  watch(tab, (v: TabKey) => {
    try {
      localStorage.setItem(TAB_STORAGE, v);
    } catch {
      // swallowed on purpose
    }
  });

  const days = ref<7 | 30 | 90>(7);
  const data = ref<Readout | null>(null);
  const loading = ref(true);
  const errorMessage = ref('');
  const busyKey = ref('');
  const notice = ref('');

  async function load() {
    loading.value = true;
    errorMessage.value = '';
    try {
      data.value = await $adminFetch<Readout>(`/api/admin/typesafe/readout?days=${days.value}`);
    } catch (error: any) {
      errorMessage.value = error?.data?.message || error?.message || 'Failed to load the readout';
    } finally {
      loading.value = false;
    }
  }
  onMounted(load);
  watch(days, load);

  async function setMode(key: string, value: string | null) {
    busyKey.value = key;
    notice.value = '';
    try {
      await $adminFetch('/api/admin/typesafe/mode', { method: 'POST', body: { key, value } });
      notice.value = `${key} → ${value ?? 'env fallback'}. Other Worker isolates follow within a minute.`;
      await load();
    } catch (error: any) {
      errorMessage.value = error?.data?.message || error?.message || 'Failed to set the mode';
    } finally {
      busyKey.value = '';
    }
  }

  type SourceRow = Readout['readout']['parts']['sources'][number];
  const gateEdits = reactive<Record<string, { source: string; confidence: string; floor: string }>>({});
  function gateEdit(s: SourceRow) {
    if (!gateEdits[s.id]) {
      gateEdits[s.id] = {
        source: s.auto_approve_source,
        confidence: String(s.auto_approve_confidence),
        floor: String(s.auto_close_confidence),
      };
    }
    return gateEdits[s.id]!;
  }
  function gateDirty(s: SourceRow) {
    const e = gateEdit(s);
    return (
      e.source !== s.auto_approve_source ||
      Number(e.confidence) !== Number(s.auto_approve_confidence) ||
      Number(e.floor) !== Number(s.auto_close_confidence)
    );
  }
  async function saveGate(s: SourceRow) {
    const edit = gateEdit(s);
    busyKey.value = `gate:${s.id}`;
    notice.value = '';
    try {
      const res = await $adminFetch<{ result: { auto_approved_now: number; auto_closed_now: number } }>(
        '/api/admin/typesafe/part-gate',
        {
          method: 'POST',
          body: {
            sourceId: s.id,
            source: edit.source,
            confidence: Number(edit.confidence),
            closeConfidence: Number(edit.floor),
          },
        }
      );
      notice.value =
        `${s.name}: gate reads ${edit.source} at ${Number(edit.confidence).toFixed(3)}, floor ${Number(edit.floor).toFixed(2)}. ` +
        `Swept now: ${res.result.auto_approved_now} approved, ${res.result.auto_closed_now} closed.`;
      delete gateEdits[s.id];
      await load();
    } catch (error: any) {
      errorMessage.value = error?.data?.message || error?.message || 'Failed to set the gate';
    } finally {
      busyKey.value = '';
    }
  }

  // -- Derived numbers and grades ------------------------------------------
  type Grade = { state: 'no-data' | 'below' | 'ready' | 'info'; text: string };

  function pct(n: number, d: number): string {
    return d > 0 ? `${Math.round((n / d) * 100)}%` : '—';
  }
  function share(n: number, d: number): number {
    return d > 0 ? n / d : 0;
  }

  const mode = (surface: ModeRow['surface']) => data.value?.modes.find((m) => m.surface === surface);

  const totalCost = computed(() => {
    const rows = data.value?.readout.cost ?? [];
    return {
      calls: rows.reduce((a, r) => a + Number(r.calls), 0),
      usd: rows.reduce((a, r) => a + Number(r.usd), 0),
      tokens: rows.reduce((a, r) => a + Number(r.input_tokens), 0),
    };
  });

  const chatGrade = computed<Grade>(() => {
    const c = data.value?.readout.chat;
    if (!c) return { state: 'no-data', text: '' };
    const status = c.classifier_status ?? {};
    const total = Object.values(status).reduce((a, b) => a + Number(b), 0);
    const timeouts = Number(status.timeout ?? 0) + Number(status.error ?? 0);
    const spec = c.by_tier.find((t) => t.tier === 'specification');
    if (c.classified < BARS.chat.minRuns) {
      return { state: 'no-data', text: `${c.classified} of ${BARS.chat.minRuns} classified runs.` };
    }
    if (share(timeouts, total) > BARS.chat.maxTimeoutShare) {
      return {
        state: 'below',
        text: `${pct(timeouts, total)} of runs missed the 900 ms ceiling; the hint would rarely arrive. Fix that before switching.`,
      };
    }
    if (!spec) return { state: 'below', text: 'No specification-tier runs yet; that is the tier the hint is for.' };
    const toolRate = share(spec.with_tool, spec.runs);
    const conf = Number(spec.avg_confidence ?? 0);
    if (toolRate > BARS.chat.maxSpecToolRate) {
      return {
        state: 'info',
        text: `Sonnet already calls a tool on ${pct(spec.with_tool, spec.runs)} of spec questions; the hint has little to fix. Shadow is fine.`,
      };
    }
    if (conf < BARS.chat.minConfidence) {
      return {
        state: 'below',
        text: `Classifier confidence on spec is ${conf.toFixed(2)}; under 0.70 the hint would mislabel.`,
      };
    }
    return {
      state: 'ready',
      text: `Spec questions get a tool ${pct(spec.with_tool, spec.runs)} of the time at confidence ${conf.toFixed(2)}. Switch to hint and reread this card in a week.`,
    };
  });

  const screenGrade = computed<Grade>(() => {
    const s = data.value?.readout.screen;
    if (!s) return { state: 'no-data', text: '' };
    if (s.screened < BARS.screen.minScreened) {
      return {
        state: 'no-data',
        text: `${s.screened} of ${BARS.screen.minScreened} probationary messages screened. Shadow costs nothing; wait.`,
      };
    }
    if (s.cleared_then_rejected > 0) {
      return {
        state: 'below',
        text: `${s.cleared_then_rejected} message(s) the screen cleared were rejected by a human. In hold mode those would have reached the reader.`,
      };
    }
    if (share(s.held_then_approved, s.held) > BARS.screen.maxHeldApprovedShare) {
      return {
        state: 'below',
        text: `${pct(s.held_then_approved, s.held)} of holds were approved by a human: too many readers would wait for nothing.`,
      };
    }
    return { state: 'ready', text: 'No cleared-then-rejected, few false holds. Hold mode is safe.' };
  });

  const searchGrade = computed<Grade>(() => {
    const s = data.value?.readout.search.shadow;
    if (!s || !s.total) return { state: 'no-data', text: 'No shadow reads yet.' };
    const answered = Number(s.answered ?? 0);
    const total = Number(s.total ?? 0);
    if (answered < BARS.search.minAnswered) {
      return { state: 'no-data', text: `${answered} of ${BARS.search.minAnswered} answered reads.` };
    }
    const timeoutShare = share(Number(s.timeout ?? 0), total);
    if (timeoutShare > BARS.search.maxTimeoutShare) {
      return {
        state: 'below',
        text: `${pct(Number(s.timeout ?? 0), total)} of reads miss 250 ms; a reorder would slow search or rarely apply.`,
      };
    }
    const lead = share(Number(s.agree_lead ?? 0), answered);
    if (lead < BARS.search.leadAgreeLow) {
      return {
        state: 'below',
        text: `Lead-surface agreement is ${pct(Number(s.agree_lead ?? 0), answered)}: the model or the regex is noise. Read by kind below.`,
      };
    }
    if (lead > BARS.search.leadAgreeHigh) {
      return {
        state: 'info',
        text: `Agreement is ${pct(Number(s.agree_lead ?? 0), answered)}: a reorder would change little. Keep the regex.`,
      };
    }
    return {
      state: 'ready',
      text: `Agreement ${pct(Number(s.agree_lead ?? 0), answered)} with timeouts under the bar: worth writing phase 4b.`,
    };
  });

  const partsGrade = computed<Grade>(() => {
    const p = data.value?.readout.parts;
    if (!p) return { state: 'no-data', text: '' };
    if (p.human_reviewed < BARS.parts.minReviewed) {
      return {
        state: 'no-data',
        text: `${p.human_reviewed} of ${BARS.parts.minReviewed} model-scored rows reviewed by hand. Review a batch in Part Correlations first; precision has nothing to grade until then.`,
      };
    }
    const ok = p.precision.filter((r) => r.at_or_above > 0 && r.approved / r.at_or_above >= BARS.parts.minPrecision);
    if (!ok.length)
      return { state: 'below', text: 'No candidate threshold reaches 95% precision on the reviewed rows.' };
    const best = ok.reduce((a, b) => (a.threshold < b.threshold ? a : b));
    return {
      state: 'ready',
      text: `Precision ≥ 95% from ${best.threshold.toFixed(2)} (${best.approved}/${best.at_or_above}). Move one source to model at that threshold and check ten auto-approvals by hand.`,
    };
  });

  const tabGrade = computed<Partial<Record<TabKey, Grade>>>(() => ({
    chat: chatGrade.value,
    screen: screenGrade.value,
    search: searchGrade.value,
    parts: partsGrade.value,
  }));

  function gradeClass(g: Grade) {
    return { 'no-data': 'badge-ghost', below: 'badge-warning', ready: 'badge-success', info: 'badge-info' }[g.state];
  }
  function gradeLabel(g: Grade) {
    return { 'no-data': 'Not enough data', below: 'Below the bar', ready: 'Ready', info: 'Nothing to gain' }[g.state];
  }

  const savedSwitchDay = '2026-09-18';
  const savedBefore = computed(() =>
    (data.value?.readout.saved_search.per_day ?? [])
      .filter((d) => d.day < savedSwitchDay)
      .reduce((a, d) => a + Number(d.n), 0)
  );
  const savedAfter = computed(() =>
    (data.value?.readout.saved_search.per_day ?? [])
      .filter((d) => d.day >= savedSwitchDay)
      .reduce((a, d) => a + Number(d.n), 0)
  );

  function fmtDate(iso: string | null) {
    return iso ? new Date(iso).toLocaleString() : '—';
  }
</script>

<template>
  <AdminShell
    title="TypeSafe"
    subtitle="What each judgment surface is doing, what the number means, and the switch beside it"
  >
    <template #actions>
      <div class="join">
        <button
          v-for="d in [7, 30, 90] as const"
          :key="d"
          type="button"
          class="btn btn-sm join-item"
          :class="days === d ? 'btn-primary' : 'btn-outline'"
          @click="days = d"
        >
          {{ d }}d
        </button>
      </div>
      <button type="button" class="btn btn-sm btn-outline" :disabled="loading" @click="load">
        <i class="fas fa-rotate" :class="{ 'fa-spin': loading }"></i>
        Refresh
      </button>
    </template>

    <p class="text-sm opacity-70 mb-4">
      Every phase shipped in shadow or off, with one number that decides whether to graduate it. This page shows that
      number against its bar and puts the switch next to it. A switch is a <code>platform_settings</code> row (the
      Worker env is the fallback when no row exists), takes effect within a minute, and is logged to the admin audit
      table. <strong>Nothing here flips itself.</strong>
    </p>

    <div v-if="errorMessage" role="alert" class="alert alert-error mb-4">
      <i class="fas fa-triangle-exclamation"></i>
      <span>{{ errorMessage }}</span>
    </div>
    <div v-if="notice" role="status" class="alert alert-success alert-soft mb-4">
      <i class="fas fa-check"></i>
      <span>{{ notice }}</span>
    </div>

    <div v-if="loading && !data" class="flex justify-center py-16">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <template v-else-if="data">
      <!-- Cost strip -->
      <section class="card bg-base-100 border border-base-300 shadow-sm mb-6">
        <div class="card-body">
          <h2 class="card-title text-lg">
            <i class="fas fa-coins text-warning"></i>
            Cost and latency, last {{ data.days }} days
          </h2>
          <p class="text-sm opacity-70">
            Nothing to decide. This is the check that no surface has run away: a caller over $1 a day is a bug, not a
            bill. Tokens × $0.042 per million.
          </p>
          <div class="stats stats-vertical sm:stats-horizontal bg-base-200 my-2">
            <div class="stat">
              <div class="stat-title">Calls</div>
              <div class="stat-value text-2xl">{{ totalCost.calls.toLocaleString() }}</div>
            </div>
            <div class="stat">
              <div class="stat-title">Input tokens</div>
              <div class="stat-value text-2xl">{{ totalCost.tokens.toLocaleString() }}</div>
            </div>
            <div class="stat">
              <div class="stat-title">Spend</div>
              <div class="stat-value text-2xl">${{ totalCost.usd.toFixed(4) }}</div>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Caller</th>
                  <th>Where</th>
                  <th class="text-right">Calls</th>
                  <th class="text-right">Tokens</th>
                  <th class="text-right">USD</th>
                  <th class="text-right">avg ms</th>
                  <th class="text-right">p95 ms</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in data.readout.cost" :key="`${r.caller}-${r.source}`">
                  <td>
                    <code>{{ r.caller }}</code>
                  </td>
                  <td>{{ r.source }}</td>
                  <td class="text-right">{{ Number(r.calls).toLocaleString() }}</td>
                  <td class="text-right">{{ Number(r.input_tokens).toLocaleString() }}</td>
                  <td class="text-right">{{ Number(r.usd).toFixed(4) }}</td>
                  <td class="text-right">{{ r.avg_ms }}</td>
                  <td class="text-right">{{ r.p95_ms }}</td>
                </tr>
                <tr v-if="!data.readout.cost.length">
                  <td colspan="7" class="opacity-60">
                    No metered calls in this window yet. The mirror started on 2026-09-18.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div role="tablist" class="tabs tabs-lift mb-4 overflow-x-auto flex-nowrap">
        <button
          v-for="t in TABS"
          :key="t.key"
          role="tab"
          type="button"
          class="tab whitespace-nowrap gap-2"
          :class="{ 'tab-active': tab === t.key }"
          :aria-selected="tab === t.key"
          @click="tab = t.key"
        >
          <i :class="t.icon"></i>
          {{ t.label }}
          <span v-if="tabGrade[t.key]" class="badge badge-xs" :class="gradeClass(tabGrade[t.key]!)"></span>
        </button>
      </div>

      <div class="flex flex-col gap-6">
        <!-- Chat classifier -->
        <section v-show="tab === 'chat'" class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <h2 class="card-title text-lg"><i class="fas fa-comments text-primary"></i> Chat classifier</h2>
              <span class="badge" :class="gradeClass(chatGrade)">{{ gradeLabel(chatGrade) }}</span>
            </div>
            <p class="text-sm opacity-70">
              <strong>Measures:</strong> for each chat run, the tier the classifier chose beside the tools Sonnet then
              called with no hint in front of it. The hint exists because the rebuild audit found 11 tool calls on 155
              answerable questions; the number to move is the tool-call rate on the <em>specification</em> tier.
            </p>
            <p class="text-sm"><strong>Verdict:</strong> {{ chatGrade.text || 'No classified runs yet.' }}</p>
            <div class="overflow-x-auto">
              <table class="table table-xs">
                <thead>
                  <tr>
                    <th>Tier</th>
                    <th class="text-right">Runs</th>
                    <th class="text-right">Used a tool</th>
                    <th class="text-right">Used the hinted tool</th>
                    <th class="text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="t in data.readout.chat.by_tier" :key="t.tier">
                    <td>{{ t.tier }}</td>
                    <td class="text-right">{{ t.runs }}</td>
                    <td class="text-right">{{ pct(t.with_tool, t.runs) }}</td>
                    <td class="text-right">{{ pct(t.hint_tool_used, t.runs) }}</td>
                    <td class="text-right">
                      {{ t.avg_confidence == null ? '—' : Number(t.avg_confidence).toFixed(2) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="text-xs opacity-60">
              Classifier outcomes:
              <span v-for="(n, k) in data.readout.chat.classifier_status" :key="k" class="mr-2">{{ k }} {{ n }}</span>
              <span v-if="!Object.keys(data.readout.chat.classifier_status).length">none in window</span>
            </p>
            <AdminTypesafeModeSwitch
              :row="mode('chat')"
              :options="['off', 'shadow', 'hint']"
              :busy="busyKey"
              :ready="chatGrade.state === 'ready'"
              @set="setMode"
            />
          </div>
        </section>

        <!-- Message screen -->
        <section v-show="tab === 'screen'" class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <h2 class="card-title text-lg">
                <i class="fas fa-shield-halved text-secondary"></i> Marketplace message screen
              </h2>
              <span class="badge" :class="gradeClass(screenGrade)">{{ gradeLabel(screenGrade) }}</span>
            </div>
            <p class="text-sm opacity-70">
              <strong>Measures:</strong> every probationary cold message the screen scored, what it would have done
              (hold / clear), and what a human then did in the moderation queue. The miss that matters is
              <em>cleared then rejected</em>: in hold mode that message reaches the reader. <em>Held then approved</em>
              is the false positive: a reader waits for a human for nothing.
            </p>
            <p class="text-sm"><strong>Verdict:</strong> {{ screenGrade.text }}</p>
            <div class="stats stats-vertical sm:stats-horizontal bg-base-200 text-sm">
              <div class="stat py-2">
                <div class="stat-title">Screened</div>
                <div class="stat-value text-xl">{{ data.readout.screen.screened }}</div>
                <div class="stat-desc">
                  {{ data.readout.screen.held }} hold · {{ data.readout.screen.cleared }} clear
                </div>
              </div>
              <div class="stat py-2">
                <div class="stat-title">Cleared → rejected</div>
                <div class="stat-value text-xl" :class="data.readout.screen.cleared_then_rejected ? 'text-error' : ''">
                  {{ data.readout.screen.cleared_then_rejected }}
                </div>
                <div class="stat-desc">the miss</div>
              </div>
              <div class="stat py-2">
                <div class="stat-title">Held → approved</div>
                <div class="stat-value text-xl">{{ data.readout.screen.held_then_approved }}</div>
                <div class="stat-desc">false positive · {{ data.readout.screen.held_then_rejected }} confirmed bad</div>
              </div>
            </div>
            <p class="text-xs opacity-60">
              Wanted posts and seller inquiries (web screen):
              <span v-for="(n, k) in data.readout.screen.wanted" :key="k" class="mr-2">{{ k }} {{ n }}</span>
              <span v-if="!Object.keys(data.readout.screen.wanted).length">none in window</span>
            </p>
            <AdminTypesafeModeSwitch
              :row="{
                surface: 'screen',
                key: 'message_screen_mode',
                row: data.screenMode,
                env: 'off',
                effective: data.screenMode,
                updatedAt: null,
              }"
              :options="['off', 'shadow', 'hold']"
              :busy="busyKey"
              :ready="screenGrade.state === 'ready'"
              :no-fallback="true"
              @set="setMode"
            />
          </div>
        </section>

        <!-- Search -->
        <section v-show="tab === 'search'" class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <h2 class="card-title text-lg">
                <i class="fas fa-magnifying-glass text-accent"></i> Search intent shadow and miss triage
              </h2>
              <span class="badge" :class="gradeClass(searchGrade)">{{ gradeLabel(searchGrade) }}</span>
            </div>
            <p class="text-sm opacity-70">
              <strong>Measures:</strong> for lookup and question searches, whether the model's query kind and lead
              surface agree with the regex, and how often it answered inside 250 ms. The decision is whether to write
              phase 4b (a reorder). Agreement between 50% and 85% with timeouts under 30% is the case for it; over 85%
              there is nothing to gain; under 50% one side is noise.
            </p>
            <p class="text-sm"><strong>Verdict:</strong> {{ searchGrade.text }}</p>
            <div class="stats stats-vertical sm:stats-horizontal bg-base-200 text-sm">
              <div class="stat py-2">
                <div class="stat-title">Reads</div>
                <div class="stat-value text-xl">{{ data.readout.search.shadow.total ?? 0 }}</div>
                <div class="stat-desc">
                  {{ data.readout.search.shadow.answered ?? 0 }} answered ·
                  {{ data.readout.search.shadow.timeout ?? 0 }} timeout ·
                  {{ data.readout.search.shadow.error ?? 0 }} error
                </div>
              </div>
              <div class="stat py-2">
                <div class="stat-title">Agree on kind</div>
                <div class="stat-value text-xl">
                  {{
                    pct(
                      Number(data.readout.search.shadow.agree_kind ?? 0),
                      Number(data.readout.search.shadow.answered ?? 0)
                    )
                  }}
                </div>
              </div>
              <div class="stat py-2">
                <div class="stat-title">Agree on lead surface</div>
                <div class="stat-value text-xl">
                  {{
                    pct(
                      Number(data.readout.search.shadow.agree_lead ?? 0),
                      Number(data.readout.search.shadow.answered ?? 0)
                    )
                  }}
                </div>
                <div class="stat-desc">avg {{ data.readout.search.shadow.avg_ms ?? '—' }} ms when answered</div>
              </div>
            </div>
            <div v-if="data.readout.search.by_regex_kind.length" class="text-xs opacity-70">
              By regex kind:
              <span v-for="k in data.readout.search.by_regex_kind" :key="k.regex_kind" class="mr-3">
                {{ k.regex_kind }} {{ k.n }} (kind {{ pct(k.agree_kind, k.n) }}, lead {{ pct(k.agree_lead, k.n) }})
              </span>
            </div>
            <AdminTypesafeModeSwitch
              :row="mode('search')"
              :options="['off', 'shadow']"
              :busy="busyKey"
              :ready="false"
              @set="setMode"
            />
            <div class="divider my-1"></div>
            <p class="text-sm opacity-70">
              <strong>Miss triage</strong> labels every zero-result search. No decision: it says how much of the Most
              Wanted list was never content. A growing <em>synonym</em> count is a list of words to add to the tool
              catalogue's <code>searchTerms</code>.
            </p>
            <p class="text-sm">
              <span v-for="(n, k) in data.readout.search.misses" :key="k" class="badge badge-ghost mr-1"
                >{{ k }} {{ n }}</span
              >
            </p>
            <ul v-if="data.readout.search.recent_typos.length" class="text-xs opacity-70 list-disc pl-5">
              <li v-for="t in data.readout.search.recent_typos" :key="t.query">
                <code>{{ t.query }}</code> → {{ t.corrected ?? 'no candidate' }} ({{
                  t.p == null ? '—' : Number(t.p).toFixed(2)
                }})
              </li>
            </ul>
          </div>
        </section>

        <!-- Parts -->
        <section v-show="tab === 'parts'" class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <h2 class="card-title text-lg"><i class="fas fa-link text-info"></i> Part correlations</h2>
              <span class="badge" :class="gradeClass(partsGrade)">{{ gradeLabel(partsGrade) }}</span>
            </div>
            <p class="text-sm opacity-70">
              <strong>Measures:</strong> on rows you reviewed by hand in
              <NuxtLink to="/admin/parts/correlations" class="link">Part Correlations</NuxtLink>, the precision the
              model would have had at each threshold: of the rows it scored at or above 0.7 (0.8, 0.9), how many you
              approved. The gate refuses 1.000 by design, so the first step below "review everything" is the threshold
              this card names, on one source, then ten auto-approvals checked by hand.
            </p>
            <p class="text-sm opacity-70">
              <strong>Two dials per source.</strong> The <em>gate</em> links a listing when the model's best candidate
              is at or above the threshold (and beats the runner-up by the margin). The <em>floor</em> closes a listing
              as "no factory equivalent" when its best candidate is under the floor and the model also says none fit (≥
              0.70). Everything between the two is your queue. A floor close links nothing and is undone by Reopen on
              the correlations page; the count of those undos is the floor's error rate.
            </p>
            <div class="stats stats-vertical sm:stats-horizontal bg-base-200 text-sm">
              <div class="stat py-2">
                <div class="stat-title">Open records by best score</div>
                <div class="stat-value text-base">
                  &lt;0.30: {{ data.readout.parts.bands.lt30 ?? 0 }} · 0.30–0.60:
                  {{ data.readout.parts.bands.b30_60 ?? 0 }} · 0.60–0.85: {{ data.readout.parts.bands.b60_85 ?? 0 }} ·
                  ≥0.85: {{ data.readout.parts.bands.ge85 ?? 0 }}
                </div>
                <div class="stat-desc">
                  {{ data.readout.parts.bands.closable ?? 0 }} under 0.30 with "none fit" ≥ 0.70 (closable)
                </div>
              </div>
              <div class="stat py-2">
                <div class="stat-title">Closed by the floor</div>
                <div class="stat-value text-xl">{{ data.readout.parts.model_closed }}</div>
                <div class="stat-desc" :class="data.readout.parts.model_closes_reopened ? 'text-warning' : ''">
                  {{ data.readout.parts.model_closes_reopened }} reopened by a human
                </div>
              </div>
            </div>
            <p class="text-sm"><strong>Verdict:</strong> {{ partsGrade.text }}</p>
            <div class="stats stats-vertical sm:stats-horizontal bg-base-200 text-sm">
              <div class="stat py-2">
                <div class="stat-title">Backlog</div>
                <div class="stat-value text-xl">{{ data.readout.parts.by_status.proposed ?? 0 }}</div>
                <div class="stat-desc">
                  {{ data.readout.parts.model_scored }} scored · {{ data.readout.parts.unscored_proposed }} waiting on
                  the cron
                </div>
              </div>
              <div class="stat py-2">
                <div class="stat-title">Reviewed by hand</div>
                <div class="stat-value text-xl">{{ data.readout.parts.human_reviewed }}</div>
                <div class="stat-desc">
                  {{ data.readout.parts.by_status.approved ?? 0 }} approved ·
                  {{ data.readout.parts.by_status.rejected ?? 0 }} rejected
                </div>
              </div>
            </div>
            <div v-if="data.readout.parts.precision.length" class="overflow-x-auto">
              <table class="table table-xs">
                <thead>
                  <tr>
                    <th>Threshold</th>
                    <th class="text-right">Rows at or above</th>
                    <th class="text-right">Approved</th>
                    <th class="text-right">Precision</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in data.readout.parts.precision" :key="p.threshold">
                    <td>{{ Number(p.threshold).toFixed(2) }}</td>
                    <td class="text-right">{{ p.at_or_above }}</td>
                    <td class="text-right">{{ p.approved }}</td>
                    <td class="text-right">{{ pct(p.approved, p.at_or_above) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="overflow-x-auto">
              <table class="table table-xs">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Gate reads</th>
                    <th>Approve at</th>
                    <th>Close under</th>
                    <th class="text-right">Open</th>
                    <th class="text-right">Auto-approved</th>
                    <th class="text-right">Auto-closed</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="s in data.readout.parts.sources" :key="s.id">
                    <td>{{ s.name }}</td>
                    <td>
                      <select v-model="gateEdit(s).source" class="select select-xs">
                        <option value="trigram">trigram</option>
                        <option value="model">model</option>
                      </select>
                    </td>
                    <td>
                      <input
                        v-model="gateEdit(s).confidence"
                        type="number"
                        min="0.5"
                        max="1"
                        step="0.005"
                        class="input input-xs w-24"
                      />
                    </td>
                    <td>
                      <input
                        v-model="gateEdit(s).floor"
                        type="number"
                        min="0"
                        max="0.95"
                        step="0.05"
                        class="input input-xs w-20"
                        title="0 = off"
                      />
                    </td>
                    <td class="text-right">{{ s.open_records }}</td>
                    <td class="text-right">{{ s.auto_approved }}</td>
                    <td class="text-right">{{ s.auto_closed }}</td>
                    <td class="text-right">
                      <button
                        type="button"
                        class="btn btn-xs btn-outline"
                        :disabled="busyKey === `gate:${s.id}` || !gateDirty(s)"
                        @click="saveGate(s)"
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- MCP pick -->
        <section v-show="tab === 'mcp'" class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body">
            <h2 class="card-title text-lg"><i class="fas fa-crosshairs text-success"></i> MCP near-miss pick</h2>
            <p class="text-sm opacity-70">
              <strong>Measures:</strong> per table tool, how many near-miss lists got a pick, the average confidence and
              latency. A pick is a hint beside the list and cannot break an answer, so this is a cost-and-latency
              decision only. Turn it off for a tool whose average confidence sits under 0.60: the model is guessing.
            </p>
            <div class="overflow-x-auto">
              <table class="table table-xs">
                <thead>
                  <tr>
                    <th>Tool</th>
                    <th class="text-right">Lists</th>
                    <th class="text-right">Picked</th>
                    <th class="text-right">avg p</th>
                    <th class="text-right">avg ms</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="m in data.readout.mcp" :key="m.tool">
                    <td>
                      <code>{{ m.tool }}</code>
                    </td>
                    <td class="text-right">{{ m.calls }}</td>
                    <td class="text-right">{{ pct(m.picked, m.calls) }}</td>
                    <td class="text-right" :class="Number(m.avg_p ?? 1) < BARS.mcp.minAvgP ? 'text-warning' : ''">
                      {{ m.avg_p == null ? '—' : Number(m.avg_p).toFixed(2) }}
                    </td>
                    <td class="text-right">{{ m.avg_ms ?? '—' }}</td>
                  </tr>
                  <tr v-if="!data.readout.mcp.length">
                    <td colspan="5" class="opacity-60">No near-miss lists with two or more rows in this window.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <AdminTypesafeModeSwitch
              :row="mode('mcp')"
              :options="['off', 'on']"
              :busy="busyKey"
              :ready="false"
              @set="setMode"
            />
          </div>
        </section>

        <!-- Queue hint + models -->
        <section v-show="tab === 'queue'" class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body">
            <h2 class="card-title text-lg">
              <i class="fas fa-clone text-warning"></i> Queue duplicate hint and model safety read
            </h2>
            <p class="text-sm opacity-70">
              <strong>Measures:</strong> submissions hinted, hinted with a top candidate, and approvals where you
              clicked "attach" to the hinted row. <em>attached / with top</em> is the hit rate. Volume is tiny; this is
              a log.
            </p>
            <div class="stats stats-vertical sm:stats-horizontal bg-base-200 text-sm">
              <div class="stat py-2">
                <div class="stat-title">Hinted</div>
                <div class="stat-value text-xl">{{ data.readout.queue.hinted }}</div>
                <div class="stat-desc">{{ data.readout.queue.pending_hinted }} still pending</div>
              </div>
              <div class="stat py-2">
                <div class="stat-title">With a top candidate</div>
                <div class="stat-value text-xl">{{ data.readout.queue.with_top }}</div>
              </div>
              <div class="stat py-2">
                <div class="stat-title">Attached</div>
                <div class="stat-value text-xl">{{ data.readout.queue.attached }}</div>
                <div class="stat-desc">
                  hit rate {{ pct(data.readout.queue.attached, data.readout.queue.with_top) }}
                </div>
              </div>
            </div>
            <AdminTypesafeModeSwitch
              :row="mode('queue')"
              :options="['off', 'on']"
              :busy="busyKey"
              :ready="false"
              @set="setMode"
            />
            <div class="divider my-1"></div>
            <p class="text-sm opacity-70">
              <strong>Model safety read</strong> adds the strong disclaimer to a 3D model when the model's
              P(safety-critical) is at or above 0.70, beside the seller's own flag. It only ever adds caution; check the
              badge on <NuxtLink to="/admin/models" class="link">3D Models</NuxtLink> for what it flagged.
            </p>
            <AdminTypesafeModeSwitch
              :row="mode('models')"
              :options="['off', 'on']"
              :busy="busyKey"
              :ready="false"
              @set="setMode"
            />
          </div>
        </section>

        <!-- Saved search -->
        <section v-show="tab === 'saved'" class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body">
            <h2 class="card-title text-lg"><i class="fas fa-bell text-primary"></i> Saved-search semantic fallback</h2>
            <p class="text-sm opacity-70">
              <strong>Measures:</strong> alerts enqueued per day for 28 days, before and after the switch ({{
                savedSwitchDay
              }}), and the semantic calls made. More alerts after the switch is the model adding matches the substring
              rule missed; the check is that they are wanted. Open two or three from <code>notification_queue</code> and
              read the listing against the saved text. Complaints (a saved "Cooper S" getting badge listings) mean the
              0.7 threshold is too low.
            </p>
            <div class="stats stats-vertical sm:stats-horizontal bg-base-200 text-sm">
              <div class="stat py-2">
                <div class="stat-title">Alerts before the switch</div>
                <div class="stat-value text-xl">{{ savedBefore }}</div>
              </div>
              <div class="stat py-2">
                <div class="stat-title">Alerts after</div>
                <div class="stat-value text-xl">{{ savedAfter }}</div>
              </div>
              <div class="stat py-2">
                <div class="stat-title">Semantic calls, {{ data.days }}d</div>
                <div class="stat-value text-xl">{{ data.readout.saved_search.semantic_calls }}</div>
              </div>
            </div>
            <div v-if="data.readout.saved_search.per_day.length" class="flex items-end gap-1 h-16">
              <div
                v-for="d in data.readout.saved_search.per_day"
                :key="d.day"
                class="flex-1 rounded-t"
                :class="d.day >= savedSwitchDay ? 'bg-primary' : 'bg-base-300'"
                :style="{
                  height: `${Math.max(6, (Number(d.n) / Math.max(1, ...data.readout.saved_search.per_day.map((x) => Number(x.n)))) * 100)}%`,
                }"
                :title="`${d.day}: ${d.n}`"
              ></div>
            </div>
            <AdminTypesafeModeSwitch
              :row="{
                surface: 'saved',
                key: 'saved_search_semantic_mode',
                row: data.savedSearchMode,
                env: 'off',
                effective: data.savedSearchMode,
                updatedAt: null,
              }"
              :options="['off', 'on']"
              :busy="busyKey"
              :ready="false"
              :no-fallback="true"
              @set="setMode"
            />
          </div>
        </section>
      </div>
    </template>
  </AdminShell>
</template>
