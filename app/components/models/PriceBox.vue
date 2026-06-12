<script setup lang="ts">
  import type { ModelDetail } from '~~/data/models/model-library';

  const props = defineProps<{
    model: Pick<ModelDetail, 'id' | 'pricingMode' | 'priceCents' | 'suggestedPriceCents' | 'minPriceCents' | 'currency'>;
  }>();

  const { isAuthenticated } = useAuth();
  const { startCheckout } = useModelCheckout();

  const minCents = computed(() => props.model.minPriceCents ?? 100);
  // PWYW dollar amount, seeded from the suggested price (or the floor).
  const amount = ref<number>((props.model.suggestedPriceCents ?? props.model.minPriceCents ?? 100) / 100);

  const loading = ref(false);
  const error = ref<string | null>(null);

  function fmt(cents: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (props.model.currency || 'usd').toUpperCase(),
    }).format(cents / 100);
  }

  async function buy() {
    error.value = null;
    if (!isAuthenticated.value) {
      await navigateTo('/login');
      return;
    }
    let cents: number | undefined;
    if (props.model.pricingMode === 'pwyw') {
      cents = Math.round((Number(amount.value) || 0) * 100);
      if (!Number.isFinite(cents) || cents < minCents.value) {
        error.value = `Minimum is ${fmt(minCents.value)}.`;
        return;
      }
    }
    loading.value = true;
    // On success startCheckout redirects to Stripe; we only continue on failure.
    const msg = await startCheckout(props.model.id, 'purchase', cents);
    if (msg) {
      error.value = msg;
      loading.value = false;
    }
  }
</script>

<template>
  <div class="space-y-2">
    <fieldset v-if="model.pricingMode === 'pwyw'" class="fieldset">
      <legend class="fieldset-legend">Name your price</legend>
      <label class="input w-full">
        <span class="opacity-60">$</span>
        <input v-model.number="amount" type="number" :min="minCents / 100" step="1" class="grow" />
      </label>
      <p class="label">Minimum {{ fmt(minCents) }} · buyers get every version</p>
    </fieldset>

    <button class="btn btn-primary w-full" :disabled="loading" @click="buy">
      <span v-if="loading" class="loading loading-spinner loading-sm"></span>
      <i v-else class="fas fa-cart-shopping mr-1"></i>
      <template v-if="model.pricingMode === 'fixed'">Buy · {{ fmt(model.priceCents ?? 0) }}</template>
      <template v-else>Buy now</template>
    </button>

    <div v-if="error" role="alert" class="alert alert-error alert-soft py-2 text-sm">
      <i class="fas fa-circle-exclamation"></i><span>{{ error }}</span>
    </div>
    <p class="text-xs opacity-60">
      <i class="fas fa-lock mr-1"></i> Secure checkout via Stripe. Files unlock instantly.
    </p>
  </div>
</template>
