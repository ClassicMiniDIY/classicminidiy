<script setup lang="ts">
  /**
   * /admin/reference — the published reference datasets (needles, torque,
   * clearances, maintenance intervals). Each is edited on its own page; the
   * publish rules run in the publish-reference-data Edge Function
   * (classicminidiy-supabase). English-only, like every other /admin page.
   */
  useHead({ title: 'Reference Data — Admin' });

  interface DatasetRow {
    key: string;
    title: string;
    source: string;
    current_version: number | null;
    publish_enabled: boolean;
    live_schema_versions: number[] | null;
    published_at: string | null;
    note: string | null;
    bytes: number | null;
  }

  const { data, pending, error } = useAdminFetch<{ datasets: DatasetRow[] }>('/api/admin/reference');

  const kb = (bytes: number | null) => (bytes == null ? '—' : `${(bytes / 1024).toFixed(1)} KB`);
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');
</script>

<template>
  <AdminShell title="Reference Data" subtitle="Published datasets the site and the apps read">
    <div v-if="pending" class="flex justify-center py-12"><span class="loading loading-spinner loading-lg"></span></div>
    <div v-else-if="error" class="alert alert-error">
      <i class="fas fa-triangle-exclamation"></i>
      <span>Could not load the datasets.</span>
    </div>
    <div v-else class="overflow-x-auto">
      <table class="table table-zebra">
        <thead>
          <tr>
            <th>Dataset</th>
            <th>Version</th>
            <th>Published</th>
            <th>Note</th>
            <th>Size</th>
            <th>Publishing</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in data?.datasets ?? []" :key="d.key">
            <td class="min-w-0">
              <NuxtLink :to="`/admin/reference/${d.key}`" class="link link-primary font-medium">{{ d.title }}</NuxtLink>
              <div class="text-xs opacity-60 font-mono">{{ d.key }}</div>
            </td>
            <td>{{ d.current_version ?? '—' }}</td>
            <td class="whitespace-nowrap">{{ when(d.published_at) }}</td>
            <td class="max-w-xs truncate" :title="d.note ?? ''">{{ d.note ?? '—' }}</td>
            <td class="whitespace-nowrap">{{ kb(d.bytes) }}</td>
            <td>
              <span v-if="d.source === 'derived'" class="badge badge-ghost">derived</span>
              <span v-else-if="d.publish_enabled" class="badge badge-success">on</span>
              <span v-else class="badge badge-warning" title="Off until every app reads the data from Supabase"
                >off</span
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AdminShell>
</template>
