<script setup lang="ts">
  const supabase = useSupabase();
  const route = useRoute();
  const { user, userProfile } = useAuth();
  const { startSellerOnboarding } = useModelCheckout();

  type Seller = {
    stripe_account_id: string;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    details_submitted: boolean;
    selling_disabled: boolean;
  } | null;

  interface SalesRow {
    model_id: string;
    model_title: string;
    sale_count: number;
    tip_count: number;
    gross_cents: number;
    fee_cents: number;
    net_cents: number;
  }

  const seller = ref<Seller>(null);
  const summary = ref<SalesRow[]>([]);
  const loading = ref(true);
  const onboarding = ref(false);
  const onboardError = ref<string | null>(null);

  const trustLevel = computed(() => userProfile.value?.trust_level ?? 'new');
  const trustOk = computed(() => ['contributor', 'trusted', 'moderator', 'admin'].includes(trustLevel.value));
  const canSell = computed(() => !!seller.value?.charges_enabled && !seller.value?.selling_disabled);
  const needsOnboarding = computed(() => !canSell.value && !seller.value?.selling_disabled);
  const justOnboarded = computed(() => route.query.onboarded === '1');

  async function load() {
    if (!import.meta.client || !user.value) {
      loading.value = false;
      return;
    }
    loading.value = true;
    const { data: s } = await supabase
      .from('seller_accounts')
      .select('stripe_account_id, charges_enabled, payouts_enabled, details_submitted, selling_disabled')
      .eq('user_id', user.value.id)
      .maybeSingle();
    seller.value = (s as Seller) ?? null;
    if (seller.value?.charges_enabled) {
      const { data: sum } = await supabase.rpc('get_model_sales_summary');
      summary.value = (sum as SalesRow[]) ?? [];
    }
    loading.value = false;
  }

  async function onboard() {
    onboardError.value = null;
    onboarding.value = true;
    const msg = await startSellerOnboarding();
    // On success the browser redirects to Stripe; we only land here on error.
    if (msg) {
      onboardError.value = msg;
      onboarding.value = false;
    }
  }

  function fmt(cents: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
  }

  const totals = computed(() =>
    summary.value.reduce(
      (a, r) => ({
        gross: a.gross + r.gross_cents,
        fee: a.fee + r.fee_cents,
        net: a.net + r.net_cents,
        sales: a.sales + r.sale_count,
        tips: a.tips + r.tip_count,
      }),
      { gross: 0, fee: 0, net: 0, sales: 0, tips: 0 }
    )
  );

  watch(user, load, { immediate: true });
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-2">
      <i class="fad fa-store"></i>
      <h2 class="text-lg font-semibold">Selling</h2>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <template v-else>
      <!-- Admin kill switch -->
      <div v-if="seller?.selling_disabled" role="alert" class="alert alert-error alert-soft">
        <i class="fas fa-ban"></i>
        <span>Selling is disabled for your account. Contact support if you believe this is a mistake.</span>
      </div>

      <!-- Webhook-lag confirmation right after returning from Stripe -->
      <div v-else-if="justOnboarded && !canSell" role="alert" class="alert alert-info alert-soft">
        <i class="fas fa-circle-info"></i>
        <span>Thanks! We're confirming your Stripe details — this can take a moment. Refresh this page shortly.</span>
      </div>

      <!-- Onboarding pitch -->
      <div v-else-if="needsOnboarding" class="card bg-base-100 border border-base-300 shadow-sm">
        <div class="card-body gap-4">
          <h3 class="card-title">Sell your 3D models</h3>
          <p class="text-sm opacity-80">
            Charge a fixed price, let buyers pay what they want, or just accept tips. Payments run through your own
            Stripe account — you're the merchant of record and get paid directly. Classic Mini DIY keeps a 15%
            commission per sale.
          </p>
          <ul class="text-sm space-y-1">
            <li><i class="fas fa-check text-success mr-2"></i> You keep 85% of every sale</li>
            <li><i class="fas fa-check text-success mr-2"></i> Buyers get every version, past and future</li>
            <li><i class="fas fa-check text-success mr-2"></i> Payouts, refunds, and taxes handled in Stripe</li>
          </ul>

          <div v-if="!trustOk" role="alert" class="alert alert-warning alert-soft text-sm">
            <i class="fas fa-lock"></i>
            <span>
              Selling unlocks at <strong>contributor</strong> trust. Share a model or contribute to the archive to get
              there — your current level is <strong>{{ trustLevel }}</strong>.
            </span>
          </div>

          <div v-if="onboardError" role="alert" class="alert alert-error alert-soft text-sm">
            <i class="fas fa-circle-exclamation"></i><span>{{ onboardError }}</span>
          </div>

          <div>
            <button class="btn btn-primary" :disabled="!trustOk || onboarding" @click="onboard">
              <span v-if="onboarding" class="loading loading-spinner loading-sm"></span>
              <i v-else class="fab fa-stripe-s mr-1"></i>
              {{ seller ? 'Continue Stripe onboarding' : 'Start selling with Stripe' }}
            </button>
          </div>
          <p class="text-xs opacity-50">You'll be redirected to Stripe to set up payouts, then back here.</p>
        </div>
      </div>

      <!-- Sales console -->
      <template v-else>
        <div class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body gap-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <i class="fas fa-circle-check text-success"></i>
                <span class="font-semibold">You're set up to sell</span>
                <span v-if="!seller?.payouts_enabled" class="badge badge-warning badge-sm">Payouts pending</span>
              </div>
              <a
                href="https://dashboard.stripe.com"
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-outline btn-sm"
              >
                <i class="fab fa-stripe-s mr-1"></i> Manage payouts on Stripe
              </a>
            </div>
            <p class="text-xs opacity-60">
              Refunds and disputes are handled from your Stripe dashboard. The platform commission is not automatically
              refunded on a refund.
            </p>
          </div>
        </div>

        <div class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body">
            <h3 class="font-semibold mb-2">Sales summary</h3>
            <div v-if="summary.length === 0" class="text-center py-8 opacity-60">
              <i class="fas fa-chart-simple text-3xl mb-2 block"></i>
              <p>No sales yet. Price a model to get started.</p>
            </div>
            <div v-else class="overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th class="text-right">Sales</th>
                    <th class="text-right">Tips</th>
                    <th class="text-right">Gross</th>
                    <th class="text-right">Fees</th>
                    <th class="text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in summary" :key="r.model_id">
                    <td class="font-medium">{{ r.model_title }}</td>
                    <td class="text-right">{{ r.sale_count }}</td>
                    <td class="text-right">{{ r.tip_count }}</td>
                    <td class="text-right">{{ fmt(r.gross_cents) }}</td>
                    <td class="text-right opacity-70">−{{ fmt(r.fee_cents) }}</td>
                    <td class="text-right font-semibold">{{ fmt(r.net_cents) }}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="font-semibold">
                    <td>Total</td>
                    <td class="text-right">{{ totals.sales }}</td>
                    <td class="text-right">{{ totals.tips }}</td>
                    <td class="text-right">{{ fmt(totals.gross) }}</td>
                    <td class="text-right">−{{ fmt(totals.fee) }}</td>
                    <td class="text-right">{{ fmt(totals.net) }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
