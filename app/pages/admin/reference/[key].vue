<script setup lang="ts">
  /**
   * /admin/reference/:key — edit one reference dataset as JSON.
   *
   * Draft → Validate → Diff → Publish. The textarea's text is sent AS IS: the
   * published bytes are hashed by every client, so this page never
   * JSON.stringify()s a parsed value (that would silently reformat the whole
   * payload). Every rule runs in publish-reference-data; this page only shows
   * its answers. History lists every version; "Load into draft" on an old one
   * is a revert, which publishes the old text as a NEW version.
   * English-only, like every other /admin page.
   */
  import { diffReferencePayload, type ReferenceDiffLine } from '~/utils/referenceDiff';

  const route = useRoute();
  const key = String(route.params.key);
  // A malformed key can never name a dataset: a real 404, SSR included. A
  // well-formed unknown key 404s from the API after hydration (the data needs
  // the admin's Bearer token, which SSR never has).
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(key)) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown dataset', fatal: true });
  }
  useHead({ title: `${key} — Reference Data — Admin` });

  interface VersionRow {
    version: number;
    schema_version: number;
    sha256: string;
    bytes: number;
    published_at: string;
    published_by: string | null;
    note: string;
    payload?: string;
  }
  interface DatasetResponse {
    dataset: { key: string; title: string; source: string; current_version: number | null; publish_enabled: boolean };
    schemaVersion: number;
    current: (VersionRow & { payload: string }) | null;
  }
  interface RuleError {
    dataset: string;
    rule: string;
    path: string;
    message: string;
  }

  const { data, pending, error, refresh } = useAdminFetch<DatasetResponse>(`/api/admin/reference/${key}`);
  const history = useAdminFetch<{ versions: VersionRow[] }>(`/api/admin/reference/${key}/history`);

  const draft = ref('');
  const note = ref('');
  const busy = ref(false);
  const errors = ref<RuleError[]>([]);
  const warnings = ref<RuleError[]>([]);
  const validated = ref<null | boolean>(null);
  const message = ref<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  watch(
    () => data.value?.current?.payload,
    (payload) => {
      if (payload !== undefined && draft.value === '') draft.value = payload;
    },
    { immediate: true },
  );

  const dirty = computed(() => data.value?.current != null && draft.value !== data.value.current.payload);

  const diff = computed<ReferenceDiffLine[] | null>(() => {
    if (!data.value?.current) return null;
    try {
      return diffReferencePayload(JSON.parse(data.value.current.payload), JSON.parse(draft.value));
    } catch {
      return null; // not valid JSON yet; Validate says why
    }
  });

  watch(draft, () => {
    validated.value = null;
  });

  const request = () => ({
    note: note.value,
    items: [{ dataset: key, base_version: data.value?.dataset.current_version ?? null, payload: draft.value }],
  });

  const errorText = (e: any) => e?.data?.error || e?.data?.statusMessage || e?.statusMessage || 'Request failed';

  async function validate() {
    busy.value = true;
    message.value = null;
    try {
      const res = await $adminFetch<{ ok: boolean; results: { errors: RuleError[]; warnings: RuleError[] }[] }>(
        '/api/admin/reference/validate',
        { method: 'POST', body: request() },
      );
      errors.value = res.results.flatMap((r) => r.errors);
      warnings.value = res.results.flatMap((r) => r.warnings);
      validated.value = res.ok;
    } catch (e) {
      message.value = { type: 'error', text: errorText(e) };
    } finally {
      busy.value = false;
    }
  }

  async function publish() {
    busy.value = true;
    message.value = null;
    try {
      const res = await $adminFetch<{ results: { version: number; changed: boolean }[] }>(
        '/api/admin/reference/publish',
        { method: 'POST', body: request() },
      );
      const r = res.results[0];
      message.value = r?.changed
        ? { type: 'success', text: `Published version ${r.version}. The site shows it within about 10 minutes.` }
        : { type: 'info', text: 'Nothing changed: the draft equals the current version.' };
      draft.value = '';
      note.value = '';
      await Promise.all([refresh(), history.refresh()]);
    } catch (e: any) {
      const body = e?.data ?? {};
      if (body.code === 'invalid') {
        errors.value = body.errors ?? [];
        warnings.value = body.warnings ?? [];
        validated.value = false;
      }
      message.value = {
        type: 'error',
        text:
          body.code === 'publish_disabled'
            ? 'Publishing is off for this dataset until every app reads it from Supabase.'
            : body.code === 'stale_base' || body.code === 'dependency_moved'
              ? 'Someone published in the meantime. Reload, check the diff, and publish again.'
              : errorText(e),
      };
    } finally {
      busy.value = false;
    }
  }

  async function loadVersion(v: VersionRow) {
    busy.value = true;
    try {
      const res = await $adminFetch<{ version: VersionRow & { payload: string } }>(
        `/api/admin/reference/${key}/${v.version}?schema=${v.schema_version}`,
      );
      draft.value = res.version.payload;
      note.value = `Revert to version ${v.version}`;
      message.value = { type: 'info', text: `Loaded version ${v.version} into the draft. Publishing it creates a new version.` };
    } catch (e) {
      message.value = { type: 'error', text: errorText(e) };
    } finally {
      busy.value = false;
    }
  }

  function resetDraft() {
    if (data.value?.current) draft.value = data.value.current.payload;
  }

  const when = (iso: string) => new Date(iso).toLocaleString();
</script>

<template>
  <AdminShell :title="data?.dataset.title ?? key" subtitle="Edit, validate and publish reference data">
    <div class="mb-4">
      <NuxtLink to="/admin/reference" class="link text-sm"><i class="fas fa-arrow-left mr-1"></i>All datasets</NuxtLink>
    </div>

    <div v-if="pending" class="flex justify-center py-12"><span class="loading loading-spinner loading-lg"></span></div>
    <div v-else-if="error" class="alert alert-error">
      <i class="fas fa-triangle-exclamation"></i>
      <span>Could not load this dataset.</span>
    </div>
    <template v-else-if="data">
      <div class="flex flex-wrap gap-2 items-center mb-3 text-sm">
        <span class="badge badge-neutral">version {{ data.dataset.current_version ?? '—' }}</span>
        <span class="badge badge-ghost">schema {{ data.schemaVersion }}</span>
        <span v-if="data.dataset.source === 'derived'" class="badge badge-ghost">derived: built from other tables</span>
        <span v-else-if="!data.dataset.publish_enabled" class="badge badge-warning">publishing off</span>
        <span v-if="dirty" class="badge badge-info">unsaved draft</span>
      </div>

      <div v-if="message" class="alert mb-4" :class="`alert-${message.type}`">
        <span class="min-w-0 break-words">{{ message.text }}</span>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div class="xl:col-span-2 min-w-0">
          <textarea
            v-model="draft"
            class="textarea textarea-bordered w-full font-mono text-xs leading-5 h-[60vh]"
            spellcheck="false"
            autocomplete="off"
            aria-label="Dataset JSON"
          ></textarea>
          <div class="flex flex-wrap gap-2 mt-3 items-end">
            <button class="btn btn-sm" :disabled="busy || !draft" @click="validate">
              <i class="fas fa-check-double"></i>Validate
            </button>
            <button class="btn btn-sm btn-ghost" :disabled="busy || !dirty" @click="resetDraft">
              <i class="fas fa-rotate-left"></i>Reset draft
            </button>
            <label class="form-control grow min-w-0">
              <span class="label-text text-xs">Change note (required)</span>
              <input v-model="note" type="text" maxlength="500" class="input input-sm input-bordered w-full" />
            </label>
            <button
              class="btn btn-sm btn-primary"
              :disabled="busy || !dirty || !note.trim() || validated !== true || data.dataset.source === 'derived'"
              :title="validated !== true ? 'Validate first' : ''"
              @click="publish"
            >
              <i class="fas fa-upload"></i>Publish
            </button>
          </div>
        </div>

        <div class="space-y-4 min-w-0">
          <div class="card bg-base-200">
            <div class="card-body p-4">
              <h3 class="font-semibold">Validation</h3>
              <p v-if="validated === null" class="text-sm opacity-70">Not validated since the last edit.</p>
              <p v-else-if="validated" class="text-sm text-success"><i class="fas fa-circle-check mr-1"></i>Every rule passes.</p>
              <ul v-if="errors.length" class="text-sm space-y-1">
                <li v-for="(e, i) in errors" :key="`e${i}`" class="text-error break-words">
                  <span class="font-mono">{{ e.path || '(root)' }}</span> — {{ e.message }}
                  <span class="opacity-60">({{ e.rule }})</span>
                </li>
              </ul>
              <ul v-if="warnings.length" class="text-sm space-y-1 mt-2">
                <li v-for="(w, i) in warnings" :key="`w${i}`" class="text-warning break-words">
                  <span class="font-mono">{{ w.path || '(root)' }}</span> — {{ w.message }}
                </li>
              </ul>
            </div>
          </div>

          <div class="card bg-base-200">
            <div class="card-body p-4">
              <h3 class="font-semibold">Changes against version {{ data.dataset.current_version ?? '—' }}</h3>
              <p v-if="diff === null" class="text-sm opacity-70">The draft is not valid JSON yet.</p>
              <p v-else-if="diff.length === 0" class="text-sm opacity-70">No changes.</p>
              <ul v-else class="text-sm space-y-1 max-h-64 overflow-y-auto">
                <li v-for="(d, i) in diff" :key="i" class="break-words">
                  <span
                    class="badge badge-xs mr-1"
                    :class="{ 'badge-success': d.kind === 'added', 'badge-error': d.kind === 'removed', 'badge-info': d.kind === 'changed' }"
                    >{{ d.kind }}</span
                  >
                  <span class="font-mono">{{ d.path }}</span>
                </li>
              </ul>
            </div>
          </div>

          <div class="card bg-base-200">
            <div class="card-body p-4">
              <h3 class="font-semibold">History</h3>
              <ul class="text-sm space-y-2 max-h-64 overflow-y-auto">
                <li v-for="v in history.data.value?.versions ?? []" :key="`${v.version}-${v.schema_version}`" class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-medium">v{{ v.version }}</span>
                    <span class="opacity-60 text-xs">{{ when(v.published_at) }}</span>
                    <button class="btn btn-ghost btn-xs ml-auto" :disabled="busy" @click="loadVersion(v)">Load into draft</button>
                  </div>
                  <div class="opacity-70 break-words">{{ v.note }}</div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </template>
  </AdminShell>
</template>
