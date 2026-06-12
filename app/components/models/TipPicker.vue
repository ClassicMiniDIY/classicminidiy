<script setup lang="ts">
  const props = defineProps<{ modelId: string; currency?: string }>();

  const { isAuthenticated } = useAuth();
  const { startCheckout } = useModelCheckout();

  const presets = [2, 5, 10];
  const custom = ref<number | null>(null);
  const loading = ref<number | 'custom' | null>(null);
  const error = ref<string | null>(null);

  function fmt(cents: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (props.currency || 'usd').toUpperCase(),
    }).format(cents / 100);
  }

  async function tip(dollars: number, key: number | 'custom') {
    error.value = null;
    if (!isAuthenticated.value) {
      await navigateTo('/login');
      return;
    }
    const cents = Math.round((Number(dollars) || 0) * 100);
    if (!Number.isFinite(cents) || cents < 100) {
      error.value = 'Minimum tip is $1.';
      return;
    }
    loading.value = key;
    const msg = await startCheckout(props.modelId, 'tip', cents);
    if (msg) {
      error.value = msg;
      loading.value = null;
    }
  }
</script>

<template>
  <div class="card bg-base-100 border border-base-300">
    <div class="card-body p-4 gap-3">
      <div class="flex items-center gap-2">
        <i class="fad fa-heart text-error"></i>
        <h3 class="font-semibold text-sm">Support the creator</h3>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="p in presets"
          :key="p"
          class="btn btn-sm btn-outline"
          :disabled="loading !== null"
          @click="tip(p, p)"
        >
          <span v-if="loading === p" class="loading loading-spinner loading-xs"></span>
          {{ fmt(p * 100) }}
        </button>
        <div class="join">
          <label class="input input-sm join-item">
            <span class="opacity-60">$</span>
            <input v-model.number="custom" type="number" min="1" step="1" placeholder="Other" class="w-16" />
          </label>
          <button
            class="btn btn-sm join-item btn-primary"
            :disabled="loading !== null || !custom"
            @click="tip(Number(custom), 'custom')"
          >
            <span v-if="loading === 'custom'" class="loading loading-spinner loading-xs"></span>
            <i v-else class="fas fa-heart"></i>
          </button>
        </div>
      </div>
      <div v-if="error" role="alert" class="alert alert-error alert-soft py-2 text-sm">
        <i class="fas fa-circle-exclamation"></i><span>{{ error }}</span>
      </div>
    </div>
  </div>
</template>
