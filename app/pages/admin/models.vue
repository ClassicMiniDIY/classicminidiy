<script setup lang="ts">
  import { HERO_TYPES } from '~~/data/models/generic';

  const supabase = useSupabase();

  type Tab = 'queue' | 'library' | 'reports' | 'sellers' | 'sales' | 'external';
  const tab = ref<Tab>('queue');

  const busy = ref<string | null>(null);
  const toast = ref<{ type: 'success' | 'error'; text: string } | null>(null);
  function flash(type: 'success' | 'error', text: string) {
    toast.value = { type, text };
    setTimeout(() => {
      if (toast.value?.text === text) toast.value = null;
    }, 4000);
  }

  function fmt(cents: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
  }
  function fmtDate(s: string) {
    return new Date(s).toLocaleDateString();
  }
  function fmtBytes(b: number) {
    if (!b) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    let v = b;
    let i = 0;
    while (v >= 1024 && i < u.length - 1) {
      v /= 1024;
      i++;
    }
    return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
  }
  function imgUrl(path: string) {
    return supabase.storage.from('model-images').getPublicUrl(path).data.publicUrl;
  }
  function fileDl(modelId: string, fileId: string) {
    return `/api/models/${modelId}/files/${fileId}/download?disposition=attachment`;
  }

  const trustTone: Record<string, string> = {
    new: 'badge-ghost',
    contributor: 'badge-info',
    trusted: 'badge-success',
    moderator: 'badge-primary',
    admin: 'badge-primary',
  };

  // ===================== QUEUE =====================
  const queue = ref<any[]>([]);
  const queueLoading = ref(false);
  async function loadQueue() {
    queueLoading.value = true;
    const { data: versions } = await supabase
      .from('model_versions')
      .select(
        'id, version_number, label, changelog, created_at, status, models(id, title, slug, status, owner_id, pricing_mode, price_cents, suggested_price_cents, min_price_cents, currency, safety_critical, license_code, summary)'
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    const rows = (versions ?? []) as any[];
    const versionIds = rows.map((r) => r.id);
    const modelIds = rows.map((r) => r.models?.id).filter(Boolean);
    const ownerIds = [...new Set(rows.map((r) => r.models?.owner_id).filter(Boolean))];
    const [filesRes, imagesRes, profRes] = await Promise.all([
      versionIds.length
        ? supabase
            .from('model_files')
            .select('id, version_id, file_name, file_ext, size_bytes, upload_status')
            .in('version_id', versionIds)
        : Promise.resolve({ data: [] as any[] }),
      modelIds.length
        ? supabase
            .from('model_images')
            .select('model_id, storage_path, alt_text, is_primary, sort_order')
            .in('model_id', modelIds)
        : Promise.resolve({ data: [] as any[] }),
      ownerIds.length
        ? supabase.from('profiles').select('id, username, display_name, trust_level').in('id', ownerIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const files = (filesRes.data ?? []) as any[];
    const images = (imagesRes.data ?? []) as any[];
    const profiles = Object.fromEntries(((profRes.data ?? []) as any[]).map((p) => [p.id, p]));
    queue.value = rows.map((r) => ({
      ...r,
      model: r.models,
      owner: profiles[r.models?.owner_id] || null,
      files: files.filter((f) => f.version_id === r.id),
      images: images
        .filter((i) => i.model_id === r.models?.id)
        .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.sort_order - b.sort_order),
    }));
    queueLoading.value = false;
  }

  async function approve(v: any) {
    busy.value = v.id;
    const { error } = await supabase.rpc('approve_model_version', { p_version_id: v.id });
    busy.value = null;
    if (error) return flash('error', error.message);
    flash('success', `Approved "${v.model?.title}"`);
    await loadQueue();
  }

  const rejectTarget = ref<any | null>(null);
  const rejectReason = ref('');
  async function confirmReject() {
    const v = rejectTarget.value;
    if (!v || rejectReason.value.trim().length < 3) return;
    busy.value = v.id;
    const { error } = await supabase.rpc('reject_model_version', {
      p_version_id: v.id,
      p_reason: rejectReason.value.trim(),
    });
    busy.value = null;
    rejectTarget.value = null;
    rejectReason.value = '';
    if (error) return flash('error', error.message);
    flash('success', `Rejected "${v.model?.title}"`);
    await loadQueue();
  }

  // ===================== REPORTS =====================
  const reports = ref<any[]>([]);
  const reportsLoading = ref(false);
  async function loadReports() {
    reportsLoading.value = true;
    const { data } = await supabase
      .from('model_reports')
      .select(
        'id, reason, details, status, resolution_action, reporter_email, reporter_id, created_at, models(id, title, slug, status, owner_id)'
      )
      .in('status', ['open', 'reviewing'])
      .order('created_at', { ascending: true });
    reports.value = ((data ?? []) as any[]).map((r) => ({ ...r, model: r.models }));
    reportsLoading.value = false;
  }

  const resolveTarget = ref<any | null>(null);
  const resolveAction = ref<'none' | 'takedown' | 'warning' | 'edit_required'>('none');
  const resolveStatus = ref<'resolved' | 'dismissed'>('resolved');
  const resolveNotes = ref('');
  async function confirmResolve() {
    const rep = resolveTarget.value;
    if (!rep) return;
    busy.value = rep.id;
    try {
      await $adminFetch('/api/admin/models/resolve-report', {
        method: 'POST',
        body: {
          reportId: rep.id,
          action: resolveAction.value,
          status: resolveStatus.value,
          notes: resolveNotes.value || undefined,
        },
      });
      flash('success', resolveAction.value === 'takedown' ? 'Model taken down' : 'Report resolved');
      resolveTarget.value = null;
      resolveNotes.value = '';
      resolveAction.value = 'none';
      resolveStatus.value = 'resolved';
      await loadReports();
    } catch (e: any) {
      flash('error', e?.data?.statusMessage || e?.statusMessage || 'Failed to resolve');
    }
    busy.value = null;
  }

  const reasonTone: Record<string, string> = {
    copyright: 'badge-error',
    safety: 'badge-warning',
    inappropriate: 'badge-warning',
    spam: 'badge-ghost',
    other: 'badge-ghost',
  };

  // ===================== SELLERS =====================
  const sellers = ref<any[]>([]);
  const sellersLoading = ref(false);
  async function loadSellers() {
    sellersLoading.value = true;
    const { data } = await supabase
      .from('seller_accounts')
      .select(
        'user_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, selling_disabled, country, created_at'
      )
      .order('created_at', { ascending: false });
    const rows = (data ?? []) as any[];
    const ids = rows.map((r) => r.user_id);
    const [profRes, strikeRes] = await Promise.all([
      ids.length
        ? supabase.from('profiles').select('id, username, display_name, trust_level').in('id', ids)
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from('model_reports')
        .select('resolution_action, reason, models(owner_id)')
        .eq('reason', 'copyright')
        .eq('resolution_action', 'takedown'),
    ]);
    const profiles = Object.fromEntries(((profRes.data ?? []) as any[]).map((p) => [p.id, p]));
    const strikes: Record<string, number> = {};
    for (const r of (strikeRes.data ?? []) as any[]) {
      const oid = r.models?.owner_id;
      if (oid) strikes[oid] = (strikes[oid] || 0) + 1;
    }
    sellers.value = rows.map((r) => ({
      ...r,
      profile: profiles[r.user_id] || null,
      strikes: strikes[r.user_id] || 0,
    }));
    sellersLoading.value = false;
  }

  async function toggleSeller(s: any) {
    busy.value = s.user_id;
    try {
      await $adminFetch('/api/admin/models/toggle-seller', {
        method: 'POST',
        body: { userId: s.user_id, sellingDisabled: !s.selling_disabled },
      });
      s.selling_disabled = !s.selling_disabled;
      flash('success', s.selling_disabled ? 'Selling disabled' : 'Selling enabled');
    } catch (e: any) {
      flash('error', e?.data?.statusMessage || 'Failed to update seller');
    }
    busy.value = null;
  }

  // ===================== SALES =====================
  const sales = ref<any[]>([]);
  const salesLoading = ref(false);
  async function loadSales() {
    salesLoading.value = true;
    const { data } = await supabase
      .from('model_purchases')
      .select('id, kind, amount_cents, application_fee_cents, currency, status, created_at, models(title, slug)')
      .order('created_at', { ascending: false })
      .limit(100);
    sales.value = ((data ?? []) as any[]).map((r) => ({ ...r, model: r.models }));
    salesLoading.value = false;
  }
  const salesTotals = computed(() =>
    sales.value.reduce(
      (a, r) => ({
        gross: a.gross + (r.status === 'paid' ? r.amount_cents : 0),
        fees: a.fees + (r.status === 'paid' ? r.application_fee_cents : 0),
        count: a.count + 1,
        refunded: a.refunded + (r.status === 'refunded' ? 1 : 0),
        disputed: a.disputed + (r.status === 'disputed' ? 1 : 0),
      }),
      { gross: 0, fees: 0, count: 0, refunded: 0, disputed: 0 }
    )
  );
  const statusTone: Record<string, string> = {
    paid: 'badge-success',
    refunded: 'badge-neutral',
    disputed: 'badge-error',
  };

  // ===================== ALL MODELS (library) =====================
  const modelStatusTone: Record<string, string> = {
    draft: 'badge-ghost',
    pending: 'badge-warning',
    published: 'badge-success',
    rejected: 'badge-error',
    flagged: 'badge-warning',
    archived: 'badge-neutral',
    removed: 'badge-error',
  };
  const LIBRARY_PAGE_SIZE = 20;
  const library = ref<any[]>([]);
  const libraryLoading = ref(false);
  const libraryPage = ref(1);
  const libraryTotal = ref(0);
  const libraryStatus = ref('all');
  const librarySearch = ref('');
  const libraryPages = computed(() => Math.max(1, Math.ceil(libraryTotal.value / LIBRARY_PAGE_SIZE)));

  async function loadLibrary() {
    libraryLoading.value = true;
    const from = (libraryPage.value - 1) * LIBRARY_PAGE_SIZE;
    let q = supabase
      .from('models')
      .select(
        'id, title, slug, status, pricing_mode, owner_id, current_version_id, download_count, like_count, purchase_count, created_at',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, from + LIBRARY_PAGE_SIZE - 1);
    if (libraryStatus.value !== 'all') q = q.eq('status', libraryStatus.value);
    if (librarySearch.value.trim()) q = q.ilike('title', `%${librarySearch.value.trim()}%`);
    const { data, count } = await q;
    const rows = (data ?? []) as any[];
    libraryTotal.value = count ?? 0;
    const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter(Boolean))];
    const profiles: Record<string, any> = {};
    if (ownerIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, username, display_name').in('id', ownerIds);
      for (const p of (profs ?? []) as any[]) profiles[p.id] = p;
    }
    library.value = rows.map((r) => ({ ...r, owner: profiles[r.owner_id] || null }));
    libraryLoading.value = false;
  }

  function goLibraryPage(p: number) {
    libraryPage.value = Math.min(Math.max(1, p), libraryPages.value);
    loadLibrary();
  }
  watch(libraryStatus, () => {
    libraryPage.value = 1;
    if (loaded.library) loadLibrary();
  });
  let librarySearchTimer: ReturnType<typeof setTimeout> | null = null;
  watch(librarySearch, () => {
    if (librarySearchTimer) clearTimeout(librarySearchTimer);
    librarySearchTimer = setTimeout(() => {
      libraryPage.value = 1;
      if (loaded.library) loadLibrary();
    }, 350);
  });

  async function setStatus(m: any, status: 'published' | 'archived' | 'removed') {
    busy.value = m.id;
    try {
      await $adminFetch('/api/admin/models/set-status', { method: 'POST', body: { modelId: m.id, status } });
      m.status = status;
      flash(
        'success',
        status === 'published' ? 'Model shown' : status === 'archived' ? 'Model hidden' : 'Model removed'
      );
    } catch (e: any) {
      flash('error', e?.data?.statusMessage || e?.statusMessage || 'Failed to update model');
    }
    busy.value = null;
  }
  const confirmRemove = ref<any | null>(null);
  async function doRemove() {
    const m = confirmRemove.value;
    if (!m) return;
    await setStatus(m, 'removed');
    confirmRemove.value = null;
  }

  // ===================== EXTERNAL LISTINGS =====================
  const external = ref<any[]>([]);
  const externalLoading = ref(false);
  const externalError = ref<string | null>(null);
  // Pending count for the tab badge — fetched eagerly (see onMounted below) so it
  // shows on any tab, not just after the External tab's full list has loaded.
  const externalCount = ref(0);

  async function refreshExternalCount() {
    const { count } = await supabase
      .from('external_models')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    externalCount.value = count ?? 0;
  }

  async function loadExternal() {
    externalLoading.value = true;
    externalError.value = null;
    const { data, error } = await supabase
      .from('external_models')
      .select(
        'id, slug, title, summary, source_site, source_url, source_author_name, source_author_url, source_license, category_slug, submitted_by, created_at'
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) externalError.value = error.message;
    const rows = (data ?? []) as any[];
    // Join the CMDIY member who submitted the link (distinct from the original
    // designer in `source_author_name`).
    const submitterIds = [...new Set(rows.map((r) => r.submitted_by).filter(Boolean))];
    const profiles: Record<string, any> = {};
    if (submitterIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username, display_name, trust_level')
        .in('id', submitterIds);
      for (const p of (profs ?? []) as any[]) profiles[p.id] = p;
    }
    external.value = rows.map((r) => ({ ...r, submitter: profiles[r.submitted_by] || null }));
    externalCount.value = external.value.length;
    externalLoading.value = false;
  }

  const externalBusy = ref<string | null>(null);

  async function approveExternal(row: any) {
    externalBusy.value = row.id;
    externalError.value = null;
    const { error } = await supabase.rpc('moderate_external_model', {
      p_id: row.id,
      p_status: 'approved',
    });
    externalBusy.value = null;
    if (error) {
      externalError.value = error.message;
      return;
    }
    flash('success', `Approved "${row.title}"`);
    external.value = external.value.filter((r) => r.id !== row.id);
    externalCount.value = external.value.length;
  }

  // Reject flow: a proper reason modal (the reason is stored on the listing,
  // shown to the submitter in their dashboard, and emailed to them).
  const externalRejectTarget = ref<any | null>(null);
  const externalRejectReason = ref('');
  function openRejectExternal(row: any) {
    externalRejectTarget.value = row;
    externalRejectReason.value = '';
  }
  async function confirmRejectExternal() {
    const row = externalRejectTarget.value;
    if (!row || externalRejectReason.value.trim().length < 3) return;
    externalBusy.value = row.id;
    externalError.value = null;
    const { error } = await supabase.rpc('moderate_external_model', {
      p_id: row.id,
      p_status: 'rejected',
      p_notes: externalRejectReason.value.trim(),
    });
    externalBusy.value = null;
    if (error) {
      externalError.value = error.message;
      return;
    }
    flash('success', `Rejected "${row.title}"`);
    external.value = external.value.filter((r) => r.id !== row.id);
    externalCount.value = external.value.length;
    externalRejectTarget.value = null;
    externalRejectReason.value = '';
  }

  // ----- lazy per-tab load -----
  const loaded = reactive<Record<Tab, boolean>>({
    queue: false,
    library: false,
    reports: false,
    sellers: false,
    sales: false,
    external: false,
  });
  async function ensureLoaded(t: Tab) {
    if (loaded[t]) return;
    loaded[t] = true;
    if (t === 'queue') await loadQueue();
    else if (t === 'library') await loadLibrary();
    else if (t === 'reports') await loadReports();
    else if (t === 'sellers') await loadSellers();
    else if (t === 'sales') await loadSales();
    else if (t === 'external') await loadExternal();
  }
  watch(tab, (t) => ensureLoaded(t), { immediate: true });

  // Seed the External badge count on mount so it shows regardless of the active
  // tab (the full list still loads lazily when the tab is opened).
  onMounted(refreshExternalCount);

  useHead({
    title: '3D Models Admin | Admin - Classic Mini DIY',
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  });
</script>

<template>
  <div>
    <Hero
      title="3D Models Admin"
      subtitle="Moderate the model library, reports, sellers, and sales"
      :heroType="HERO_TYPES.TECH"
      textSize="text-4xl"
    />

    <div class="container mx-auto px-4 py-8">
      <div class="breadcrumbs text-sm mb-4">
        <ul>
          <li>
            <NuxtLink to="/admin" class="link link-primary"><i class="fas fa-gauge mr-1"></i> Admin</NuxtLink>
          </li>
          <li><span>3D Models</span></li>
        </ul>
      </div>

      <!-- Tabs -->
      <div role="tablist" class="tabs tabs-border mb-6">
        <button role="tab" class="tab gap-2" :class="{ 'tab-active': tab === 'queue' }" @click="tab = 'queue'">
          <i class="fas fa-inbox"></i> Queue
          <span v-if="loaded.queue && queue.length" class="badge badge-warning badge-sm">{{ queue.length }}</span>
        </button>
        <button role="tab" class="tab gap-2" :class="{ 'tab-active': tab === 'library' }" @click="tab = 'library'">
          <i class="fas fa-cubes"></i> All models
        </button>
        <button role="tab" class="tab gap-2" :class="{ 'tab-active': tab === 'reports' }" @click="tab = 'reports'">
          <i class="fas fa-flag"></i> Reports
          <span v-if="loaded.reports && reports.length" class="badge badge-error badge-sm">{{ reports.length }}</span>
        </button>
        <button role="tab" class="tab gap-2" :class="{ 'tab-active': tab === 'sellers' }" @click="tab = 'sellers'">
          <i class="fas fa-store"></i> Sellers
        </button>
        <button role="tab" class="tab gap-2" :class="{ 'tab-active': tab === 'sales' }" @click="tab = 'sales'">
          <i class="fas fa-chart-line"></i> Sales
        </button>
        <button role="tab" class="tab gap-2" :class="{ 'tab-active': tab === 'external' }" @click="tab = 'external'">
          <i class="fas fa-link"></i> External
          <span v-if="externalCount" class="badge badge-warning badge-sm">{{ externalCount }}</span>
        </button>
      </div>

      <!-- ================= QUEUE ================= -->
      <div v-show="tab === 'queue'">
        <div v-if="queueLoading" class="flex justify-center py-16">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
        <div v-else-if="queue.length === 0" class="text-center py-16 opacity-60">
          <i class="fas fa-circle-check text-5xl text-success mb-3 block"></i>
          <p class="font-semibold">Queue is clear</p>
          <p class="text-sm">No pending model versions to review.</p>
        </div>
        <div v-else class="space-y-4">
          <div v-for="v in queue" :key="v.id" class="card bg-base-100 border border-base-300 shadow-sm">
            <div class="card-body gap-3">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h3 class="font-semibold text-lg">{{ v.model?.title }}</h3>
                    <span class="badge badge-sm">v{{ v.version_number }}</span>
                    <span v-if="v.model?.safety_critical" class="badge badge-warning badge-sm gap-1">
                      <i class="fas fa-triangle-exclamation"></i> Safety-critical
                    </span>
                    <span class="badge badge-ghost badge-sm capitalize">{{ v.model?.pricing_mode }}</span>
                  </div>
                  <p class="text-xs opacity-60 mt-1">
                    Submitted {{ fmtDate(v.created_at) }} · License {{ v.model?.license_code }}
                  </p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-sm opacity-70">
                    {{ v.owner?.display_name || v.owner?.username || 'Unknown' }}
                  </span>
                  <span
                    v-if="v.owner"
                    class="badge badge-sm capitalize"
                    :class="trustTone[v.owner.trust_level] || 'badge-ghost'"
                  >
                    {{ v.owner.trust_level }}
                  </span>
                </div>
              </div>

              <p v-if="v.model?.summary" class="text-sm opacity-80">{{ v.model.summary }}</p>
              <p v-if="v.changelog" class="text-sm"><span class="opacity-50">Changelog:</span> {{ v.changelog }}</p>

              <!-- Images -->
              <div v-if="v.images.length" class="flex gap-2 flex-wrap">
                <img
                  v-for="(img, i) in v.images"
                  :key="i"
                  :src="imgUrl(img.storage_path)"
                  :alt="img.alt_text || v.model?.title"
                  class="w-24 h-24 object-cover rounded-lg border border-base-300"
                  loading="lazy"
                />
              </div>

              <!-- Files -->
              <div class="flex flex-wrap gap-2">
                <a
                  v-for="f in v.files"
                  :key="f.id"
                  :href="fileDl(v.model.id, f.id)"
                  class="btn btn-xs btn-outline gap-1"
                  :class="{ 'btn-disabled opacity-50': f.upload_status !== 'uploaded' }"
                >
                  <i class="fas fa-download"></i>
                  {{ f.file_name }}
                  <span class="opacity-60">· {{ f.file_ext }} · {{ fmtBytes(f.size_bytes) }}</span>
                </a>
                <span v-if="!v.files.length" class="text-xs text-error">No files uploaded</span>
              </div>

              <div class="card-actions justify-end pt-2 border-t border-base-300">
                <button class="btn btn-sm btn-error btn-outline" :disabled="busy === v.id" @click="rejectTarget = v">
                  <i class="fas fa-xmark mr-1"></i> Reject
                </button>
                <button class="btn btn-sm btn-success" :disabled="busy === v.id" @click="approve(v)">
                  <span v-if="busy === v.id" class="loading loading-spinner loading-xs"></span>
                  <i v-else class="fas fa-check mr-1"></i> Approve &amp; publish
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ================= ALL MODELS (library) ================= -->
      <div v-show="tab === 'library'">
        <div class="flex flex-wrap items-center gap-3 mb-4">
          <label class="input input-sm">
            <i class="fas fa-magnifying-glass opacity-50"></i>
            <input v-model="librarySearch" type="search" placeholder="Search title…" aria-label="Search models" />
          </label>
          <select v-model="libraryStatus" class="select select-sm w-auto" aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="archived">Archived (hidden)</option>
            <option value="pending">Pending</option>
            <option value="draft">Draft</option>
            <option value="rejected">Rejected</option>
            <option value="flagged">Flagged</option>
            <option value="removed">Removed</option>
          </select>
          <span class="text-sm opacity-60 ml-auto">{{ libraryTotal }} total</span>
        </div>

        <div v-if="libraryLoading" class="flex justify-center py-16">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
        <div v-else-if="library.length === 0" class="text-center py-16 opacity-60">
          <i class="fas fa-cube text-5xl mb-3 block"></i>
          <p class="font-semibold">No models match</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Owner</th>
                <th>Pricing</th>
                <th>Status</th>
                <th class="text-right">DL / ♥</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in library" :key="m.id" :class="{ 'opacity-50': m.status === 'removed' }">
                <td>
                  <div class="font-medium">{{ m.title }}</div>
                  <NuxtLink
                    v-if="m.status === 'published'"
                    :to="`/models/${m.slug}`"
                    target="_blank"
                    class="text-xs link link-hover opacity-60"
                  >
                    /models/{{ m.slug }}
                  </NuxtLink>
                  <div v-else class="text-xs opacity-40 font-mono">{{ m.slug }}</div>
                </td>
                <td class="text-sm whitespace-nowrap">
                  {{ m.owner?.display_name || m.owner?.username || m.owner_id.slice(0, 8) }}
                </td>
                <td>
                  <span class="badge badge-ghost badge-sm capitalize">{{ m.pricing_mode }}</span>
                </td>
                <td>
                  <span class="badge badge-sm capitalize" :class="modelStatusTone[m.status] || 'badge-ghost'">{{
                    m.status
                  }}</span>
                </td>
                <td class="text-right text-xs opacity-70 whitespace-nowrap">
                  {{ m.download_count }} / {{ m.like_count }}
                </td>
                <td class="text-right">
                  <div class="flex justify-end items-center gap-1.5">
                    <button
                      v-if="m.status === 'published'"
                      class="btn btn-xs btn-outline"
                      :disabled="busy === m.id"
                      title="Hide from the library (keeps buyer access)"
                      @click="setStatus(m, 'archived')"
                    >
                      <i class="fas fa-eye-slash"></i> Hide
                    </button>
                    <button
                      v-if="['archived', 'removed', 'flagged'].includes(m.status) && m.current_version_id"
                      class="btn btn-xs btn-success btn-outline"
                      :disabled="busy === m.id"
                      title="Re-publish to the library"
                      @click="setStatus(m, 'published')"
                    >
                      <i class="fas fa-eye"></i> Show
                    </button>
                    <button
                      v-if="m.status !== 'removed'"
                      class="btn btn-xs btn-error btn-outline"
                      :disabled="busy === m.id"
                      title="Remove (takedown — revokes all access, including buyers)"
                      @click="confirmRemove = m"
                    >
                      <i class="fas fa-trash"></i> Remove
                    </button>
                    <span v-if="busy === m.id" class="loading loading-spinner loading-xs"></span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="libraryPages > 1" class="flex justify-center mt-6">
            <div class="join">
              <button class="join-item btn btn-sm" :disabled="libraryPage <= 1" @click="goLibraryPage(libraryPage - 1)">
                <i class="fas fa-chevron-left"></i>
              </button>
              <button class="join-item btn btn-sm btn-disabled">Page {{ libraryPage }} / {{ libraryPages }}</button>
              <button
                class="join-item btn btn-sm"
                :disabled="libraryPage >= libraryPages"
                @click="goLibraryPage(libraryPage + 1)"
              >
                <i class="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ================= REPORTS ================= -->
      <div v-show="tab === 'reports'">
        <div v-if="reportsLoading" class="flex justify-center py-16">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
        <div v-else-if="reports.length === 0" class="text-center py-16 opacity-60">
          <i class="fas fa-circle-check text-5xl text-success mb-3 block"></i>
          <p class="font-semibold">No open reports</p>
        </div>
        <div v-else class="space-y-4">
          <div v-for="r in reports" :key="r.id" class="card bg-base-100 border border-base-300 shadow-sm">
            <div class="card-body gap-2">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="badge badge-sm capitalize" :class="reasonTone[r.reason] || 'badge-ghost'">{{
                    r.reason
                  }}</span>
                  <NuxtLink
                    v-if="r.model"
                    :to="`/models/${r.model.slug}`"
                    target="_blank"
                    class="font-semibold link link-hover"
                  >
                    {{ r.model.title }}
                  </NuxtLink>
                  <span v-if="r.model" class="badge badge-ghost badge-sm capitalize">{{ r.model.status }}</span>
                </div>
                <span class="text-xs opacity-50">{{ fmtDate(r.created_at) }}</span>
              </div>
              <p class="text-sm whitespace-pre-line">{{ r.details }}</p>
              <p class="text-xs opacity-50">
                Reporter: {{ r.reporter_email || (r.reporter_id ? 'registered user' : 'anonymous') }}
              </p>
              <div class="card-actions justify-end pt-2 border-t border-base-300">
                <button class="btn btn-sm btn-outline" @click="resolveTarget = r">
                  <i class="fas fa-gavel mr-1"></i> Resolve
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ================= SELLERS ================= -->
      <div v-show="tab === 'sellers'">
        <div v-if="sellersLoading" class="flex justify-center py-16">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
        <div v-else-if="sellers.length === 0" class="text-center py-16 opacity-60">
          <i class="fas fa-store-slash text-5xl mb-3 block"></i>
          <p class="font-semibold">No sellers onboarded yet</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Seller</th>
                <th>Trust</th>
                <th>Charges</th>
                <th>Payouts</th>
                <th class="text-center">Copyright strikes</th>
                <th class="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in sellers" :key="s.user_id" :class="{ 'opacity-50': s.selling_disabled }">
                <td>
                  <div class="font-medium">
                    {{ s.profile?.display_name || s.profile?.username || s.user_id.slice(0, 8) }}
                  </div>
                  <div class="text-xs opacity-50 font-mono">{{ s.stripe_account_id }}</div>
                </td>
                <td>
                  <span class="badge badge-sm capitalize" :class="trustTone[s.profile?.trust_level] || 'badge-ghost'">
                    {{ s.profile?.trust_level || '—' }}
                  </span>
                </td>
                <td>
                  <i
                    :class="
                      s.charges_enabled ? 'fas fa-circle-check text-success' : 'fas fa-circle-xmark text-error/60'
                    "
                  ></i>
                </td>
                <td>
                  <i
                    :class="
                      s.payouts_enabled ? 'fas fa-circle-check text-success' : 'fas fa-circle-xmark text-error/60'
                    "
                  ></i>
                </td>
                <td class="text-center">
                  <span
                    :class="s.strikes >= 3 ? 'text-error font-bold' : s.strikes > 0 ? 'text-warning' : 'opacity-40'"
                  >
                    {{ s.strikes }}
                  </span>
                </td>
                <td class="text-right">
                  <button
                    class="btn btn-xs"
                    :class="s.selling_disabled ? 'btn-success btn-outline' : 'btn-error btn-outline'"
                    :disabled="busy === s.user_id"
                    @click="toggleSeller(s)"
                  >
                    <span v-if="busy === s.user_id" class="loading loading-spinner loading-xs"></span>
                    <template v-else>{{ s.selling_disabled ? 'Re-enable' : 'Disable selling' }}</template>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ================= SALES ================= -->
      <div v-show="tab === 'sales'">
        <div v-if="salesLoading" class="flex justify-center py-16">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
        <template v-else>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div class="stat bg-base-100 border border-base-300 rounded-lg p-4">
              <div class="stat-title text-xs">Gross (recent 100)</div>
              <div class="stat-value text-2xl">{{ fmt(salesTotals.gross) }}</div>
            </div>
            <div class="stat bg-base-100 border border-base-300 rounded-lg p-4">
              <div class="stat-title text-xs">Platform commission</div>
              <div class="stat-value text-2xl text-primary">{{ fmt(salesTotals.fees) }}</div>
            </div>
            <div class="stat bg-base-100 border border-base-300 rounded-lg p-4">
              <div class="stat-title text-xs">Refunded</div>
              <div class="stat-value text-2xl">{{ salesTotals.refunded }}</div>
            </div>
            <div class="stat bg-base-100 border border-base-300 rounded-lg p-4">
              <div class="stat-title text-xs">Disputed</div>
              <div class="stat-value text-2xl" :class="salesTotals.disputed ? 'text-error' : ''">
                {{ salesTotals.disputed }}
              </div>
            </div>
          </div>

          <div v-if="sales.length === 0" class="text-center py-12 opacity-60">
            <i class="fas fa-chart-line text-5xl mb-3 block"></i>
            <p class="font-semibold">No sales yet</p>
          </div>
          <div v-else class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Type</th>
                  <th class="text-right">Amount</th>
                  <th class="text-right">Fee</th>
                  <th>Status</th>
                  <th class="text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in sales" :key="p.id">
                  <td>
                    <NuxtLink v-if="p.model" :to="`/models/${p.model.slug}`" target="_blank" class="link link-hover">
                      {{ p.model.title }}
                    </NuxtLink>
                    <span v-else class="opacity-50">—</span>
                  </td>
                  <td>
                    <span class="badge badge-xs" :class="p.kind === 'tip' ? 'badge-ghost' : 'badge-primary'">
                      {{ p.kind === 'tip' ? 'Tip' : 'Sale' }}
                    </span>
                  </td>
                  <td class="text-right whitespace-nowrap">{{ fmt(p.amount_cents) }}</td>
                  <td class="text-right whitespace-nowrap opacity-70">{{ fmt(p.application_fee_cents) }}</td>
                  <td>
                    <span class="badge badge-xs capitalize" :class="statusTone[p.status] || 'badge-ghost'">{{
                      p.status
                    }}</span>
                  </td>
                  <td class="text-right whitespace-nowrap text-xs opacity-60">{{ fmtDate(p.created_at) }}</td>
                </tr>
              </tbody>
            </table>
            <p class="text-xs opacity-50 mt-2">Showing the 100 most recent transactions.</p>
          </div>
        </template>
      </div>
      <!-- ================= EXTERNAL LISTINGS ================= -->
      <div v-show="tab === 'external'">
        <div v-if="externalError" role="alert" class="alert alert-error mb-4">
          <i class="fas fa-circle-exclamation"></i>
          <span>{{ externalError }}</span>
        </div>

        <div v-if="externalLoading" class="flex justify-center py-16">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
        <div v-else-if="external.length === 0" class="text-center py-16 opacity-60">
          <i class="fas fa-circle-check text-5xl text-success mb-3 block"></i>
          <p class="font-semibold">External queue is clear</p>
          <p class="text-sm">No pending external model links to review.</p>
        </div>
        <div v-else class="space-y-4">
          <div v-for="row in external" :key="row.id" class="card bg-base-100 border border-base-300 shadow-sm">
            <div class="card-body gap-3">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h3 class="font-semibold text-lg">{{ row.title }}</h3>
                    <ModelsSourceBadge :site="row.source_site" />
                    <span v-if="row.category_slug" class="badge badge-ghost badge-sm">{{ row.category_slug }}</span>
                  </div>
                  <p class="text-xs opacity-60 mt-1">Submitted {{ fmtDate(row.created_at) }}</p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <div class="text-right">
                    <p class="text-xs opacity-50 leading-tight">Submitted by</p>
                    <p class="text-sm font-medium leading-tight">
                      {{ row.submitter?.display_name || row.submitter?.username || 'Unknown' }}
                    </p>
                  </div>
                  <span
                    v-if="row.submitter"
                    class="badge badge-sm capitalize"
                    :class="trustTone[row.submitter.trust_level] || 'badge-ghost'"
                  >
                    {{ row.submitter.trust_level }}
                  </span>
                </div>
              </div>

              <p v-if="row.summary" class="text-sm opacity-80">{{ row.summary }}</p>

              <div class="flex flex-wrap items-center gap-3 text-sm">
                <a
                  :href="row.source_url"
                  target="_blank"
                  rel="nofollow noopener"
                  class="link link-primary flex items-center gap-1 text-xs"
                >
                  <i class="fas fa-arrow-up-right-from-square"></i>
                  Open source
                </a>
                <span v-if="row.source_license" class="badge badge-neutral badge-sm">
                  {{ row.source_license }}
                </span>
                <span v-if="row.source_author_name" class="text-xs opacity-60">
                  Designer:
                  <a
                    v-if="row.source_author_url"
                    :href="row.source_author_url"
                    target="_blank"
                    rel="nofollow noopener"
                    class="link link-hover"
                    >{{ row.source_author_name }}</a
                  >
                  <template v-else>{{ row.source_author_name }}</template>
                </span>
              </div>

              <div class="card-actions justify-end pt-2 border-t border-base-300">
                <button
                  class="btn btn-sm btn-error btn-outline"
                  :disabled="externalBusy === row.id"
                  @click="openRejectExternal(row)"
                >
                  <span v-if="externalBusy === row.id" class="loading loading-spinner loading-xs"></span>
                  <i v-else class="fas fa-xmark mr-1"></i> Reject
                </button>
                <button
                  class="btn btn-sm btn-success"
                  :disabled="externalBusy === row.id"
                  @click="approveExternal(row)"
                >
                  <span v-if="externalBusy === row.id" class="loading loading-spinner loading-xs"></span>
                  <i v-else class="fas fa-check mr-1"></i> Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Reject modal -->
    <dialog class="modal" :class="{ 'modal-open': !!rejectTarget }">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Reject "{{ rejectTarget?.model?.title }}"</h3>
        <p class="text-sm opacity-70 py-2">The contributor sees this reason. Be specific and actionable.</p>
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Reason</legend>
          <textarea
            v-model="rejectReason"
            class="textarea w-full"
            rows="3"
            placeholder="e.g. The STL is non-manifold and won't slice — please re-export and resubmit."
          ></textarea>
        </fieldset>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="rejectTarget = null">Cancel</button>
          <button
            type="button"
            class="btn btn-error"
            :disabled="rejectReason.trim().length < 3 || busy === rejectTarget?.id"
            @click="confirmReject"
          >
            <span v-if="busy === rejectTarget?.id" class="loading loading-spinner loading-sm"></span>
            Reject version
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="rejectTarget = null"><button>close</button></form>
    </dialog>

    <!-- Resolve report modal -->
    <dialog class="modal" :class="{ 'modal-open': !!resolveTarget }">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Resolve report</h3>
        <p class="text-sm opacity-70 py-1">{{ resolveTarget?.model?.title }} — {{ resolveTarget?.reason }}</p>
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Outcome</legend>
          <select v-model="resolveStatus" class="select w-full">
            <option value="resolved">Resolved (action taken)</option>
            <option value="dismissed">Dismissed (no violation)</option>
          </select>
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Action</legend>
          <select v-model="resolveAction" class="select w-full">
            <option value="none">None</option>
            <option value="warning">Warning to creator</option>
            <option value="edit_required">Edit required</option>
            <option value="takedown">Takedown (unpublish model)</option>
          </select>
          <p v-if="resolveAction === 'takedown'" class="label text-error">
            This unpublishes the model immediately and revokes all downloads.
          </p>
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Internal notes (optional)</legend>
          <textarea v-model="resolveNotes" class="textarea w-full" rows="2"></textarea>
        </fieldset>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="resolveTarget = null">Cancel</button>
          <button
            type="button"
            class="btn"
            :class="resolveAction === 'takedown' ? 'btn-error' : 'btn-primary'"
            :disabled="busy === resolveTarget?.id"
            @click="confirmResolve"
          >
            <span v-if="busy === resolveTarget?.id" class="loading loading-spinner loading-sm"></span>
            Confirm
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="resolveTarget = null"><button>close</button></form>
    </dialog>

    <!-- Remove (takedown) confirmation -->
    <dialog class="modal" :class="{ 'modal-open': !!confirmRemove }">
      <div class="modal-box">
        <h3 class="font-bold text-lg"><i class="fas fa-trash text-error mr-1"></i> Remove model?</h3>
        <p class="py-3 text-sm">
          Remove <strong>{{ confirmRemove?.title }}</strong
          >? This takes it down — it stops being distributed to everyone, including buyers who previously purchased it.
          You can re-show it later (the S3 files are retained).
        </p>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="confirmRemove = null">Cancel</button>
          <button type="button" class="btn btn-error" :disabled="busy === confirmRemove?.id" @click="doRemove">
            <span v-if="busy === confirmRemove?.id" class="loading loading-spinner loading-sm"></span>
            <i v-else class="fas fa-trash mr-1"></i> Remove
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="confirmRemove = null"><button>close</button></form>
    </dialog>

    <!-- Reject external listing modal -->
    <dialog class="modal" :class="{ 'modal-open': !!externalRejectTarget }">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Reject "{{ externalRejectTarget?.title }}"</h3>
        <p class="text-sm opacity-70 py-2">
          The submitter is emailed this reason and sees it on their dashboard. Be specific — e.g. the page couldn't be
          read, it isn't a Classic Mini part, or it links to a profile instead of a model.
        </p>
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Reason</legend>
          <textarea
            v-model="externalRejectReason"
            class="textarea w-full"
            rows="3"
            placeholder="e.g. We couldn't read model details from this GrabCAD link — please submit a Thingiverse, Printables, or MakerWorld link instead."
          ></textarea>
        </fieldset>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="externalRejectTarget = null">Cancel</button>
          <button
            type="button"
            class="btn btn-error"
            :disabled="externalRejectReason.trim().length < 3 || externalBusy === externalRejectTarget?.id"
            @click="confirmRejectExternal"
          >
            <span v-if="externalBusy === externalRejectTarget?.id" class="loading loading-spinner loading-sm"></span>
            Reject listing
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="externalRejectTarget = null"><button>close</button></form>
    </dialog>

    <!-- Toast -->
    <div v-if="toast" class="toast toast-end z-50">
      <div class="alert" :class="toast.type === 'success' ? 'alert-success' : 'alert-error'">
        <i class="fas" :class="toast.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'"></i>
        <span>{{ toast.text }}</span>
      </div>
    </div>
  </div>
</template>
