<script setup lang="ts">
  /**
   * /admin/variants — manage the Model Variants archive.
   *
   * Three jobs, one tab each:
   *   * Variants: edit any field an admin may change (including reclassifying
   *     marque / family / mark / market), show or hide a variant with a reason,
   *     moderate its photos (hide, show, make primary) and replace its colours.
   *   * Registry links: set or clear which variant each registry car is, with
   *     the shared matcher's suggestions. An admin decision is `reviewed`.
   *   * Colour links: link a factory colour name to the colours archive once,
   *     for every variant that lists it.
   *
   * Every write goes through /api/admin/variants/** (service role, allowlisted,
   * audited). English-only, like every other /admin page.
   */
  import {
    BODY_LABELS,
    FAMILY_LABELS,
    MARK_NUMBERS,
    MARK_RANGES,
    MARKET_LABELS,
    MARQUE_LABELS,
    VARIANT_BODIES,
    VARIANT_EDITABLE_COLUMNS,
    VARIANT_FAMILIES,
    VARIANT_FUEL_SYSTEMS,
    VARIANT_MARKETS,
    VARIANT_MARQUES,
    VARIANT_NUMERIC_COLUMNS,
    FUEL_SYSTEM_LABELS,
  } from '~~/data/models/variants';

  useHead({ title: 'Model Variants — Admin' });

  type Tab = 'variants' | 'registry' | 'colours';
  const tab = ref<Tab>('variants');

  const toast = ref<{ type: 'success' | 'error'; text: string } | null>(null);
  function flash(type: 'success' | 'error', text: string) {
    toast.value = { type, text };
    setTimeout(() => {
      if (toast.value?.text === text) toast.value = null;
    }, 5000);
  }
  const errorText = (e: any, fallback: string) => e?.data?.statusMessage || e?.statusMessage || fallback;
  /** A saved change whose audit row failed still reports it. */
  const report = (res: { warning?: string | null }, ok: string) =>
    res?.warning ? flash('error', res.warning) : flash('success', ok);

  // ---- Variants tab -----------------------------------------------------------
  interface VariantRow {
    id: string;
    slug: string;
    name: string;
    marque: string;
    family: string;
    bodyStyle: string;
    mark: number | null;
    market: string;
    yearStart: number | null;
    yearEnd: number | null;
    isLimitedEdition: boolean;
    status: string;
    photos: number;
    hiddenPhotos: number;
    colours: number;
    coloursLinked: number;
    registered: number | null;
  }
  const {
    data: listData,
    pending: listPending,
    error: listError,
    refresh: refreshList,
  } = useAdminFetch<{ variants: VariantRow[] }>('/api/admin/variants');
  const search = ref('');
  const statusFilter = ref<'all' | 'approved' | 'rejected' | 'pending'>('all');
  const rows = computed(() => {
    const q = search.value.trim().toLowerCase();
    return (listData.value?.variants ?? []).filter(
      (v) =>
        (statusFilter.value === 'all' || v.status === statusFilter.value) &&
        (!q || v.name.toLowerCase().includes(q) || v.slug.includes(q))
    );
  });
  const years = (a: number | null, b: number | null) => [a, b].filter(Boolean).join('–') || '—';

  // Edit dialog
  const editing = ref<{ id: string } | null>(null);
  const detail = ref<any>(null);
  const form = reactive<Record<string, any>>({});
  const original = ref<Record<string, any>>({});
  const coloursText = ref('');
  const statusReason = ref('');
  const saving = ref(false);

  const SELECT_FIELDS: { key: string; label: string; options: { value: string | number | null; label: string }[] }[] = [
    { key: 'marque', label: 'Marque', options: VARIANT_MARQUES.map((m) => ({ value: m, label: MARQUE_LABELS[m] })) },
    { key: 'family', label: 'Family', options: VARIANT_FAMILIES.map((f) => ({ value: f, label: FAMILY_LABELS[f] })) },
    { key: 'body_style', label: 'Body', options: VARIANT_BODIES.map((b) => ({ value: b, label: BODY_LABELS[b] })) },
    {
      key: 'mark',
      label: 'Mark',
      options: [
        { value: null, label: 'None (overseas / outside UK sequence)' },
        ...MARK_NUMBERS.map((n) => ({ value: n, label: `Mk ${MARK_RANGES[n]!.roman}` })),
      ],
    },
    {
      key: 'market',
      label: 'Home market',
      options: VARIANT_MARKETS.map((m) => ({ value: m, label: MARKET_LABELS[m] })),
    },
    {
      key: 'fuel_system',
      label: 'Fuel system',
      options: [
        { value: null, label: '—' },
        ...VARIANT_FUEL_SYSTEMS.map((f) => ({ value: f, label: FUEL_SYSTEM_LABELS[f] })),
      ],
    },
    {
      key: 'power_standard',
      label: 'Power standard',
      options: [
        { value: null, label: '—' },
        { value: 'SAE', label: 'SAE' },
        { value: 'DIN', label: 'DIN' },
      ],
    },
  ];
  const TEXTAREA_FIELDS = new Set(['description', 'notes']);
  const EDIT_FIELDS = [...VARIANT_EDITABLE_COLUMNS, 'engine_note'] as string[];

  async function openEdit(row: VariantRow) {
    editing.value = { id: row.id };
    detail.value = null;
    statusReason.value = '';
    try {
      const res = await $adminFetch<any>(`/api/admin/variants/${row.id}`);
      detail.value = res;
      const v = res.variant;
      const snapshot: Record<string, any> = {};
      for (const key of [...EDIT_FIELDS, ...SELECT_FIELDS.map((f) => f.key), 'is_limited_edition']) {
        snapshot[key] = v[key] ?? null;
      }
      snapshot.distinguishing = (v.distinguishing ?? []).join('\n');
      Object.keys(form).forEach((k) => delete form[k]);
      Object.assign(form, snapshot);
      original.value = { ...snapshot };
      coloursText.value = res.colours.map((c: any) => c.color_name).join(', ');
    } catch (e) {
      flash('error', errorText(e, 'Could not load the variant.'));
      editing.value = null;
    }
  }
  const closeEdit = () => {
    editing.value = null;
    detail.value = null;
  };

  const changedFields = computed(() => {
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(form)) {
      const before = original.value[key];
      const norm = (x: any) => (x === '' || x === undefined ? null : x);
      if (String(norm(value)) !== String(norm(before))) out[key] = value === '' ? null : value;
    }
    return out;
  });

  async function saveVariant() {
    if (!editing.value || !Object.keys(changedFields.value).length) return;
    saving.value = true;
    try {
      const res = await $adminFetch<{ warning?: string }>(`/api/admin/variants/${editing.value.id}`, {
        method: 'PUT',
        body: { changes: changedFields.value },
      });
      report(res, 'Variant saved.');
      original.value = { ...form };
      await refreshList();
    } catch (e) {
      flash('error', errorText(e, 'Could not save the variant.'));
    } finally {
      saving.value = false;
    }
  }

  async function setStatus(status: 'approved' | 'rejected') {
    if (!editing.value) return;
    saving.value = true;
    try {
      const res = await $adminFetch<{ warning?: string }>(`/api/admin/variants/${editing.value.id}/status`, {
        method: 'POST',
        body: { status, reason: statusReason.value },
      });
      report(res, status === 'approved' ? 'Variant is public.' : 'Variant hidden from the public archive.');
      detail.value.variant.status = status;
      statusReason.value = '';
      await refreshList();
    } catch (e) {
      flash('error', errorText(e, 'Could not change the status.'));
    } finally {
      saving.value = false;
    }
  }

  async function saveColours() {
    if (!editing.value) return;
    saving.value = true;
    try {
      const res = await $adminFetch<{ warning?: string; count: number }>(
        `/api/admin/variants/${editing.value.id}/colours`,
        { method: 'PUT', body: { colours: coloursText.value } }
      );
      report(res, `Colours saved (${res.count}).`);
      await openEdit({ id: editing.value.id } as VariantRow);
      await refreshList();
    } catch (e) {
      flash('error', errorText(e, 'Could not save the colours.'));
    } finally {
      saving.value = false;
    }
  }

  async function photoAction(photo: any, action: 'hide' | 'show' | 'primary') {
    saving.value = true;
    try {
      const res = await $adminFetch<{ warning?: string }>(`/api/admin/variants/photos/${photo.id}`, {
        method: 'POST',
        body: { action },
      });
      report(res, action === 'primary' ? 'Primary photo set.' : action === 'hide' ? 'Photo hidden.' : 'Photo shown.');
      if (editing.value) await openEdit({ id: editing.value.id } as VariantRow);
      await refreshList();
    } catch (e) {
      flash('error', errorText(e, 'Could not update the photo.'));
    } finally {
      saving.value = false;
    }
  }

  // ---- Registry tab -------------------------------------------------------------
  interface RegistryCar {
    id: string;
    year: number | null;
    model: string | null;
    trim: string | null;
    engineSize: number | null;
    bodyType: string | null;
    variantId: string | null;
    variantMatch: 'auto' | 'reviewed' | 'owner' | null;
    variantName: string | null;
    variantSlug: string | null;
    confident: boolean;
    suggestions: { id: string; name: string; slug: string }[];
  }
  const {
    data: regData,
    pending: regPending,
    error: regError,
    refresh: refreshReg,
  } = useAdminFetch<{
    cars: RegistryCar[];
    variants: { id: string; name: string; yearStart: number | null; yearEnd: number | null }[];
  }>('/api/admin/variants/registry', { immediate: false });
  const regFilter = ref<'all' | 'unlinked' | 'auto' | 'reviewed' | 'owner'>('unlinked');
  const regCars = computed(() =>
    (regData.value?.cars ?? []).filter((c) =>
      regFilter.value === 'all'
        ? true
        : regFilter.value === 'unlinked'
          ? !c.variantId
          : c.variantMatch === regFilter.value
    )
  );
  const regCounts = computed(() => {
    const cars = regData.value?.cars ?? [];
    return {
      all: cars.length,
      unlinked: cars.filter((c) => !c.variantId).length,
      auto: cars.filter((c) => c.variantMatch === 'auto').length,
      reviewed: cars.filter((c) => c.variantMatch === 'reviewed').length,
      owner: cars.filter((c) => c.variantMatch === 'owner').length,
    };
  });
  const picks = reactive<Record<string, string>>({});
  const busyCar = ref<string | null>(null);
  async function linkCar(car: RegistryCar, variantId: string | null) {
    busyCar.value = car.id;
    try {
      const res = await $adminFetch<{ warning?: string }>('/api/admin/variants/registry', {
        method: 'POST',
        body: { entryId: car.id, variantId },
      });
      report(res, variantId ? 'Car linked.' : 'Link cleared.');
      await refreshReg();
    } catch (e) {
      flash('error', errorText(e, 'Could not update the link.'));
    } finally {
      busyCar.value = null;
    }
  }

  // ---- Colour links tab -----------------------------------------------------------
  interface ColourName {
    name: string;
    total: number;
    linked: number;
    colorIds: string[];
    variants: { slug: string; name: string }[];
  }
  const {
    data: colData,
    pending: colPending,
    error: colError,
    refresh: refreshCol,
  } = useAdminFetch<{ names: ColourName[]; colours: { id: string; name: string; code: string | null }[] }>(
    '/api/admin/variants/colour-links',
    { immediate: false }
  );
  const colSearch = ref('');
  const colUnlinkedOnly = ref(true);
  const colNames = computed(() => {
    const q = colSearch.value.trim().toLowerCase();
    return (colData.value?.names ?? []).filter(
      (n) => (!colUnlinkedOnly.value || n.linked < n.total) && (!q || n.name.toLowerCase().includes(q))
    );
  });
  const colourLabel = (id: string) => {
    const c = colData.value?.colours.find((x) => x.id === id);
    return c ? `${c.name}${c.code ? ` (${c.code})` : ''}` : id;
  };
  const colPicks = reactive<Record<string, string>>({});
  const busyColour = ref<string | null>(null);
  async function linkColour(name: ColourName, colorId: string | null) {
    busyColour.value = name.name;
    try {
      const res = await $adminFetch<{ warning?: string; rows: number }>('/api/admin/variants/colour-links', {
        method: 'POST',
        body: { colorName: name.name, colorId },
      });
      report(res, colorId ? `Linked on ${res.rows} variant(s).` : `Unlinked on ${res.rows} variant(s).`);
      await refreshCol();
    } catch (e) {
      flash('error', errorText(e, 'Could not update the colour link.'));
    } finally {
      busyColour.value = null;
    }
  }

  // Load the other tabs on first visit only.
  watch(tab, (t) => {
    if (t === 'registry' && !regData.value) void refreshReg();
    if (t === 'colours' && !colData.value) void refreshCol();
  });

  const MATCH_TONE: Record<string, string> = { auto: 'badge-info', reviewed: 'badge-success', owner: 'badge-primary' };
</script>

<template>
  <AdminShell title="Model Variants" subtitle="The variants archive, its photos and colours, and registry links">
    <div v-if="toast" class="mb-4">
      <div role="status" :class="['alert', toast.type === 'success' ? 'alert-success' : 'alert-error']">
        <i :class="toast.type === 'success' ? 'fas fa-circle-check' : 'fas fa-triangle-exclamation'" />
        <span class="min-w-0 break-words">{{ toast.text }}</span>
      </div>
    </div>

    <div role="tablist" class="tabs tabs-box mb-4 w-fit">
      <button role="tab" class="tab" :class="{ 'tab-active': tab === 'variants' }" @click="tab = 'variants'">
        <i class="fas fa-car-side mr-2" aria-hidden="true"></i>Variants
      </button>
      <button role="tab" class="tab" :class="{ 'tab-active': tab === 'registry' }" @click="tab = 'registry'">
        <i class="fas fa-clipboard-list mr-2" aria-hidden="true"></i>Registry links
      </button>
      <button role="tab" class="tab" :class="{ 'tab-active': tab === 'colours' }" @click="tab = 'colours'">
        <i class="fas fa-palette mr-2" aria-hidden="true"></i>Colour links
      </button>
    </div>

    <!-- Variants -->
    <section v-if="tab === 'variants'">
      <div class="flex flex-wrap gap-2 mb-3">
        <input
          v-model="search"
          type="search"
          placeholder="Search name or slug"
          class="input input-bordered input-sm w-64"
        />
        <select v-model="statusFilter" class="select select-bordered select-sm w-auto">
          <option value="all">All statuses</option>
          <option value="approved">Public</option>
          <option value="rejected">Hidden</option>
          <option value="pending">Pending</option>
        </select>
        <span class="text-sm opacity-70 self-center">{{ rows.length }} variants</span>
      </div>
      <div v-if="listError" class="alert alert-error">Could not load variants.</div>
      <div v-else-if="listPending && !listData" class="loading loading-spinner"></div>
      <div v-else class="overflow-x-auto">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Years</th>
              <th>Marque</th>
              <th>Mark</th>
              <th>Status</th>
              <th>Photos</th>
              <th>Colours linked</th>
              <th>Registered</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in rows" :key="v.id">
              <td class="max-w-[22rem]">
                <NuxtLink
                  :to="`/archive/variants/${v.slug}`"
                  target="_blank"
                  class="link link-hover font-medium block truncate"
                >
                  {{ v.name }}
                </NuxtLink>
                <span class="text-xs opacity-60 block truncate">{{ v.slug }}</span>
              </td>
              <td class="whitespace-nowrap">{{ years(v.yearStart, v.yearEnd) }}</td>
              <td>{{ MARQUE_LABELS[v.marque as keyof typeof MARQUE_LABELS] ?? v.marque }}</td>
              <td>{{ v.mark ? `Mk ${MARK_RANGES[v.mark]?.roman}` : '—' }}</td>
              <td>
                <span
                  class="badge badge-sm"
                  :class="
                    v.status === 'approved'
                      ? 'badge-success'
                      : v.status === 'rejected'
                        ? 'badge-error'
                        : 'badge-warning'
                  "
                  >{{ v.status === 'approved' ? 'Public' : v.status === 'rejected' ? 'Hidden' : v.status }}</span
                >
              </td>
              <td>
                {{ v.photos }}<span v-if="v.hiddenPhotos" class="opacity-60"> (+{{ v.hiddenPhotos }} hidden)</span>
              </td>
              <td>{{ v.coloursLinked }} / {{ v.colours }}</td>
              <td>{{ v.registered ?? 'unknown' }}</td>
              <td><button type="button" class="btn btn-xs" @click="openEdit(v)">Manage</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Registry links -->
    <section v-else-if="tab === 'registry'">
      <div class="flex flex-wrap gap-2 mb-3">
        <button
          v-for="f in ['unlinked', 'auto', 'reviewed', 'owner', 'all'] as const"
          :key="f"
          type="button"
          class="btn btn-sm"
          :class="regFilter === f ? 'btn-primary' : 'btn-ghost'"
          @click="regFilter = f"
        >
          {{ f === 'auto' ? 'Matched automatically' : f[0]!.toUpperCase() + f.slice(1) }}
          <span class="badge badge-sm">{{ regCounts[f] }}</span>
        </button>
      </div>
      <p class="text-sm opacity-70 mb-3">
        Setting a link here records it as <strong>reviewed</strong>. Automatic links were made by the matcher only when
        it was confident; owner links were chosen by the car's submitter.
      </p>
      <div v-if="regError" class="alert alert-error">Could not load registry cars.</div>
      <div v-else-if="regPending && !regData" class="loading loading-spinner"></div>
      <div v-else class="overflow-x-auto">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Car</th>
              <th>Linked to</th>
              <th>Suggestions</th>
              <th>Choose</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="car in regCars" :key="car.id">
              <td class="max-w-[18rem]">
                <span class="font-medium block truncate">{{ car.year ?? '—' }} {{ car.model }}</span>
                <span class="text-xs opacity-60 block truncate"
                  >{{ car.trim || '—' }} · {{ car.bodyType || '—' }} · {{ car.engineSize ?? '—' }} cc</span
                >
              </td>
              <td class="max-w-[16rem]">
                <template v-if="car.variantId">
                  <NuxtLink
                    v-if="car.variantSlug"
                    :to="`/archive/variants/${car.variantSlug}`"
                    target="_blank"
                    class="link link-hover block truncate"
                    >{{ car.variantName }}</NuxtLink
                  >
                  <span v-else class="text-xs opacity-60">hidden variant</span>
                  <span class="badge badge-xs mt-1" :class="MATCH_TONE[car.variantMatch ?? ''] ?? ''">{{
                    car.variantMatch
                  }}</span>
                </template>
                <span v-else class="opacity-60">Not linked</span>
              </td>
              <td>
                <div class="flex flex-col gap-1 items-start">
                  <button
                    v-for="s in car.suggestions"
                    :key="s.id"
                    type="button"
                    class="btn btn-xs btn-outline max-w-[16rem]"
                    :disabled="busyCar === car.id || s.id === car.variantId"
                    @click="linkCar(car, s.id)"
                  >
                    <span class="truncate">{{ s.name }}</span>
                  </button>
                  <span v-if="!car.suggestions.length" class="text-xs opacity-60">No suggestion</span>
                </div>
              </td>
              <td>
                <div class="flex gap-1 items-center">
                  <select v-model="picks[car.id]" class="select select-bordered select-xs w-56">
                    <option value="">Any variant…</option>
                    <option v-for="v in regData?.variants ?? []" :key="v.id" :value="v.id">
                      {{ v.name }} {{ years(v.yearStart, v.yearEnd) }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="btn btn-xs btn-primary"
                    :disabled="!picks[car.id] || busyCar === car.id"
                    @click="linkCar(car, picks[car.id]!)"
                  >
                    Link
                  </button>
                  <button
                    v-if="car.variantId"
                    type="button"
                    class="btn btn-xs btn-ghost text-error"
                    :disabled="busyCar === car.id"
                    @click="linkCar(car, null)"
                  >
                    Clear
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!regCars.length">
              <td colspan="4" class="text-center opacity-60 py-6">Nothing in this view.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Colour links -->
    <section v-else>
      <div class="flex flex-wrap gap-3 mb-3 items-center">
        <input
          v-model="colSearch"
          type="search"
          placeholder="Search colour names"
          class="input input-bordered input-sm w-64"
        />
        <label class="label cursor-pointer gap-2">
          <input v-model="colUnlinkedOnly" type="checkbox" class="checkbox checkbox-sm" />
          <span class="label-text">Unlinked only</span>
        </label>
        <span class="text-sm opacity-70">{{ colNames.length }} names</span>
      </div>
      <p class="text-sm opacity-70 mb-3">
        Linking a name here links it on every variant that lists it (case-insensitive). The variant page then links the
        colour chip to that colour, and the colour page lists the variant.
      </p>
      <div v-if="colError" class="alert alert-error">Could not load colour names.</div>
      <div v-else-if="colPending && !colData" class="loading loading-spinner"></div>
      <div v-else class="overflow-x-auto">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Name as printed</th>
              <th>Rows linked</th>
              <th>Variants</th>
              <th>Link to colour</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="n in colNames" :key="n.name">
              <td class="max-w-[14rem]">
                <span class="font-medium block truncate">{{ n.name }}</span>
                <span v-if="n.colorIds.length" class="text-xs opacity-60 block truncate">{{
                  n.colorIds.map(colourLabel).join(', ')
                }}</span>
              </td>
              <td>{{ n.linked }} / {{ n.total }}</td>
              <td class="max-w-[16rem]">
                <span class="text-xs opacity-70 block truncate">{{ n.variants.map((v) => v.name).join(' · ') }}</span>
              </td>
              <td>
                <div class="flex gap-1 items-center">
                  <select v-model="colPicks[n.name]" class="select select-bordered select-xs w-56">
                    <option value="">Choose a colour…</option>
                    <option v-for="c in colData?.colours ?? []" :key="c.id" :value="c.id">
                      {{ c.name }}{{ c.code ? ` (${c.code})` : '' }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="btn btn-xs btn-primary"
                    :disabled="!colPicks[n.name] || busyColour === n.name"
                    @click="linkColour(n, colPicks[n.name]!)"
                  >
                    Link
                  </button>
                  <button
                    v-if="n.linked"
                    type="button"
                    class="btn btn-xs btn-ghost text-error"
                    :disabled="busyColour === n.name"
                    @click="linkColour(n, null)"
                  >
                    Unlink
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!colNames.length">
              <td colspan="4" class="text-center opacity-60 py-6">Nothing in this view.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Manage dialog -->
    <dialog class="modal" :class="{ 'modal-open': editing }">
      <div class="modal-box max-w-4xl w-[calc(100vw-2rem)]">
        <div v-if="!detail" class="py-10 text-center"><span class="loading loading-spinner"></span></div>
        <template v-else>
          <div class="flex items-start gap-3 mb-4">
            <div class="min-w-0 flex-1">
              <h3 class="text-lg font-bold break-words">{{ detail.variant.name }}</h3>
              <p class="text-xs opacity-60 break-all">{{ detail.variant.slug }}</p>
            </div>
            <button type="button" class="btn btn-sm btn-ghost btn-square" aria-label="Close" @click="closeEdit">
              <i class="fas fa-xmark" aria-hidden="true"></i>
            </button>
          </div>

          <!-- Visibility -->
          <div class="rounded-box border border-base-300 p-3 mb-4 flex flex-wrap items-center gap-2">
            <span class="font-semibold text-sm">Visibility:</span>
            <span class="badge" :class="detail.variant.status === 'approved' ? 'badge-success' : 'badge-error'">{{
              detail.variant.status === 'approved' ? 'Public' : 'Hidden'
            }}</span>
            <input
              v-model="statusReason"
              type="text"
              maxlength="500"
              placeholder="Reason (required)"
              class="input input-bordered input-sm flex-1 min-w-48"
            />
            <button
              v-if="detail.variant.status === 'approved'"
              type="button"
              class="btn btn-sm btn-error btn-outline"
              :disabled="saving || statusReason.trim().length < 4"
              @click="setStatus('rejected')"
            >
              Hide variant
            </button>
            <button
              v-else
              type="button"
              class="btn btn-sm btn-success"
              :disabled="saving || statusReason.trim().length < 4"
              @click="setStatus('approved')"
            >
              Make public
            </button>
          </div>

          <!-- Fields -->
          <h4 class="font-semibold mb-2">Details</h4>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            <label v-for="f in SELECT_FIELDS" :key="f.key" class="form-control">
              <span class="text-xs font-semibold opacity-70">{{ f.label }}</span>
              <select v-model="form[f.key]" class="select select-bordered select-sm w-full">
                <option v-for="o in f.options" :key="String(o.value)" :value="o.value">{{ o.label }}</option>
              </select>
            </label>
            <label class="label cursor-pointer gap-2 self-end">
              <input v-model="form.is_limited_edition" type="checkbox" class="checkbox checkbox-sm" />
              <span class="label-text">Limited edition</span>
            </label>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            <label
              v-for="key in EDIT_FIELDS.filter((k) => !TEXTAREA_FIELDS.has(k))"
              :key="key"
              class="form-control"
              :class="{ 'sm:col-span-3': key === 'name' }"
            >
              <span class="text-xs font-semibold opacity-70">{{ key.replace(/_/g, ' ') }}</span>
              <input
                v-model="form[key]"
                type="text"
                :inputmode="VARIANT_NUMERIC_COLUMNS.has(key) ? 'decimal' : 'text'"
                class="input input-bordered input-sm w-full"
              />
            </label>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <label v-for="key in ['description', 'notes']" :key="key" class="form-control sm:col-span-3">
              <span class="text-xs font-semibold opacity-70">{{ key }}</span>
              <textarea v-model="form[key]" rows="2" class="textarea textarea-bordered w-full"></textarea>
            </label>
            <label class="form-control sm:col-span-3">
              <span class="text-xs font-semibold opacity-70">Also sold as / distinguishing (one per line)</span>
              <textarea v-model="form.distinguishing" rows="2" class="textarea textarea-bordered w-full"></textarea>
            </label>
          </div>
          <div class="flex items-center gap-2 mb-6">
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="saving || !Object.keys(changedFields).length"
              @click="saveVariant"
            >
              Save {{ Object.keys(changedFields).length || '' }} change(s)
            </button>
            <span class="text-xs opacity-60">Sources and slug are not editable here.</span>
          </div>

          <!-- Photos -->
          <h4 class="font-semibold mb-2">Photos</h4>
          <div v-if="!detail.photos.length" class="text-sm opacity-60 mb-6">No photos.</div>
          <div v-else class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div
              v-for="p in detail.photos"
              :key="p.id"
              class="rounded-box border border-base-300 overflow-hidden"
              :class="{ 'opacity-50': p.status !== 'approved' }"
            >
              <img
                :src="p.url"
                :alt="p.caption || detail.variant.name"
                class="w-full aspect-[4/3] object-cover"
                loading="lazy"
              />
              <div class="p-2 text-xs flex flex-col gap-1">
                <span class="min-w-0 break-words opacity-70">{{ p.credit || '—' }}</span>
                <div class="flex flex-wrap gap-1">
                  <span v-if="p.is_primary" class="badge badge-xs badge-primary">Primary</span>
                  <span v-if="p.status !== 'approved'" class="badge badge-xs badge-error">Hidden</span>
                </div>
                <div class="flex flex-wrap gap-1">
                  <button
                    v-if="p.status === 'approved' && !p.is_primary"
                    type="button"
                    class="btn btn-xs"
                    :disabled="saving"
                    @click="photoAction(p, 'primary')"
                  >
                    Make primary
                  </button>
                  <button
                    v-if="p.status === 'approved'"
                    type="button"
                    class="btn btn-xs btn-ghost text-error"
                    :disabled="saving"
                    @click="photoAction(p, 'hide')"
                  >
                    Hide
                  </button>
                  <button
                    v-else
                    type="button"
                    class="btn btn-xs btn-ghost"
                    :disabled="saving"
                    @click="photoAction(p, 'show')"
                  >
                    Show
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Colours -->
          <h4 class="font-semibold mb-2">Factory colours</h4>
          <div class="flex flex-wrap gap-1 mb-2">
            <span
              v-for="c in detail.colours"
              :key="c.color_name"
              class="badge badge-sm"
              :class="c.color_id ? 'badge-primary badge-soft' : 'badge-outline'"
              :title="c.colors ? `Linked to ${c.colors.name}` : 'Not linked'"
              >{{ c.color_name }}</span
            >
          </div>
          <textarea v-model="coloursText" rows="3" class="textarea textarea-bordered w-full mb-2"></textarea>
          <button type="button" class="btn btn-sm" :disabled="saving" @click="saveColours">Replace colour list</button>
        </template>
      </div>
      <div class="modal-backdrop" @click="closeEdit"></div>
    </dialog>
  </AdminShell>
</template>
