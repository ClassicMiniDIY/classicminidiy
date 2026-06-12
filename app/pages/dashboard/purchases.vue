<script setup lang="ts">
  const supabase = useSupabase();
  const { user } = useAuth();

  interface PurchaseRow {
    id: string;
    kind: string;
    amount_cents: number;
    currency: string;
    status: string;
    created_at: string;
    refunded_at: string | null;
    model: { title: string; slug: string } | null;
  }

  const { data, pending } = await useAsyncData(
    'dashboard-purchases',
    async () => {
      if (!import.meta.client || !user.value) return [] as PurchaseRow[];
      // RLS returns rows where the caller is buyer OR seller; scope to buyer so
      // the Purchases tab never shows the seller's own sales.
      const { data, error } = await supabase
        .from('model_purchases')
        .select('id, kind, amount_cents, currency, status, created_at, refunded_at, models(title, slug)')
        .eq('buyer_id', user.value.id)
        .order('created_at', { ascending: false });
      if (error) return [] as PurchaseRow[];
      return (data ?? []).map((r: any) => ({
        id: r.id,
        kind: r.kind,
        amount_cents: r.amount_cents,
        currency: r.currency,
        status: r.status,
        created_at: r.created_at,
        refunded_at: r.refunded_at,
        model: r.models ? { title: r.models.title, slug: r.models.slug } : null,
      })) as PurchaseRow[];
    },
    { watch: [user] }
  );

  const purchases = computed(() => data.value ?? []);

  function fmt(cents: number, currency: string) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(cents / 100);
  }
  function fmtDate(s: string) {
    return new Date(s).toLocaleDateString();
  }

  const statusTone: Record<string, string> = {
    paid: 'badge-success',
    refunded: 'badge-neutral',
    disputed: 'badge-error',
  };
</script>

<template>
  <div class="card bg-base-100 border border-base-300 shadow-sm">
    <div class="card-body">
      <div class="flex items-center gap-2">
        <i class="fad fa-bag-shopping"></i>
        <h2 class="text-lg font-semibold">Purchases &amp; Tips</h2>
      </div>

      <div v-if="pending" class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>

      <div v-else-if="purchases.length === 0" class="text-center py-12">
        <i class="fas fa-bag-shopping text-5xl opacity-20"></i>
        <p class="mt-4 font-semibold">No purchases yet</p>
        <p class="opacity-60 mb-4">Models you buy or tip will show up here.</p>
        <NuxtLink to="/models" class="btn btn-primary btn-sm">
          <i class="fas fa-cube mr-1"></i> Browse the model library
        </NuxtLink>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Type</th>
              <th class="text-right">Amount</th>
              <th>Status</th>
              <th class="text-right">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in purchases" :key="p.id">
              <td>
                <NuxtLink v-if="p.model" :to="`/models/${p.model.slug}`" class="link link-hover font-medium">
                  {{ p.model.title }}
                </NuxtLink>
                <span v-else class="opacity-50">—</span>
              </td>
              <td>
                <span class="badge badge-sm" :class="p.kind === 'tip' ? 'badge-ghost' : 'badge-primary'">
                  {{ p.kind === 'tip' ? 'Tip' : 'Purchase' }}
                </span>
              </td>
              <td class="text-right whitespace-nowrap">{{ fmt(p.amount_cents, p.currency) }}</td>
              <td>
                <span class="badge badge-sm capitalize" :class="statusTone[p.status] || 'badge-ghost'">{{ p.status }}</span>
              </td>
              <td class="text-right whitespace-nowrap text-sm opacity-70">{{ fmtDate(p.created_at) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="text-xs opacity-50 mt-2">
          Open a purchased model to download its files — your purchase unlocks every version.
        </p>
      </div>
    </div>
  </div>
</template>
