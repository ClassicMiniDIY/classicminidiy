<script setup lang="ts">
  import {
    CLAIMED_TRANSACTIONS_DAYS,
    CLAIMED_TRANSACTIONS_LIMIT,
    claimedTransactionKey,
    type ClaimedTransactionRow,
    type ClaimedTransactionsResponse,
  } from '~~/shared/utils/claimedTransactions';

  /**
   * Claimed transactions (TXN_CLAIMED): a user verified a store purchase that
   * is bound to ANOTHER live account, so the app told them the purchase belongs
   * to someone else. Typical causes: a shared family device, or a purchase made
   * under an old account. Support decides who should own it; "Move to caller"
   * moves the subscriptions row to the account that verified it.
   *
   * Independent of the page load: it has its own route, loading and error
   * states, so a failed purchases load does not take it down.
   */
  const rows = ref<ClaimedTransactionRow[]>([]);
  const truncated = ref(false);
  const loading = ref(true);
  const errorMessage = ref('');

  /** The case waiting for confirmation in the modal, or null. */
  const pending = ref<ClaimedTransactionRow | null>(null);
  const moving = ref(false);
  const moveError = ref('');

  const toast = useToast();

  function errorText(error: any, fallback: string) {
    return error?.data?.statusMessage || error?.statusMessage || error?.message || fallback;
  }

  async function load() {
    loading.value = true;
    errorMessage.value = '';
    try {
      const res = await $adminFetch<ClaimedTransactionsResponse>('/api/admin/membership/claimed');
      rows.value = res?.results ?? [];
      truncated.value = !!res?.truncated;
    } catch (error: any) {
      rows.value = [];
      truncated.value = false;
      errorMessage.value = errorText(error, 'Failed to load claimed transactions');
    } finally {
      loading.value = false;
    }
  }

  onMounted(load);
  defineExpose({ load });

  function askMove(row: ClaimedTransactionRow) {
    moveError.value = '';
    pending.value = row;
  }

  function cancelMove() {
    if (moving.value) return;
    pending.value = null;
    moveError.value = '';
  }

  async function confirmMove() {
    const row = pending.value;
    if (!row || moving.value) return;
    moving.value = true;
    moveError.value = '';
    try {
      await $adminFetch('/api/admin/membership/reassign', {
        method: 'POST',
        body: {
          subscriptionId: row.subscription_id,
          toUserId: row.caller_user_id,
          expectedOwnerId: row.owner_user_id,
        },
      });
      pending.value = null;
      toast.add({
        title: 'Subscription moved',
        description: `The ${row.platform} subscription now belongs to ${accountLabel(row.caller_email, row.caller_user_id)}.`,
        color: 'success',
        icon: 'fas fa-check',
      });
      await load();
    } catch (error: any) {
      moveError.value = errorText(error, 'Could not move the subscription');
    } finally {
      moving.value = false;
    }
  }

  const PLATFORM_BADGES: Record<string, string> = {
    apple: 'badge-neutral',
    google: 'badge-success',
    stripe: 'badge-info',
    comp: 'badge-warning',
    ghost: 'badge-secondary',
    patreon: 'badge-accent',
    youtube: 'badge-neutral',
  };
  const platformBadge = (platform: string) => PLATFORM_BADGES[platform] ?? 'badge-ghost';

  /** Level name for a plan code. NULL is a pre-plans row, treated as base. */
  function planName(plan: string | null) {
    if (plan === 'pro') return 'Pro';
    if (plan === 'plus') return 'Plus';
    if (plan === 'base') return 'Member';
    return plan ? `${plan} (unknown)` : 'Member (unset)';
  }

  /** An email, or the user id when the account has none. */
  function accountLabel(email: string | null, userId: string) {
    return email || userId;
  }

  function fmtDate(value: string | null) {
    return value ? new Date(value).toLocaleDateString() : '—';
  }

  function fmtDateTime(value: string | null) {
    return value ? new Date(value).toLocaleString() : '—';
  }
</script>

<template>
  <section data-testid="claimed-transactions">
    <h2 class="text-lg font-semibold mb-2">
      Claimed transactions
      <span v-if="rows.length" class="badge badge-sm badge-warning ml-1" data-testid="claimed-count">
        {{ rows.length }}{{ truncated ? '+' : '' }}
      </span>
    </h2>
    <p class="text-sm opacity-70 mb-3">
      A user verified a store purchase that belongs to another account (<code>TXN_CLAIMED</code>), in the last
      {{ CLAIMED_TRANSACTIONS_DAYS }} days. Confirm with the customer who paid before you move it. A case leaves this
      list when the purchase belongs to the account that verified it.
    </p>

    <div v-if="loading" class="flex justify-center py-6">
      <i class="fas fa-spinner fa-spin text-2xl text-primary"></i>
    </div>

    <div v-else-if="errorMessage" role="alert" class="alert alert-error" data-testid="claimed-error">
      <i class="fas fa-triangle-exclamation"></i>
      <span>{{ errorMessage }}</span>
    </div>

    <div v-else-if="rows.length === 0" class="alert alert-success" data-testid="claimed-empty">
      <i class="fas fa-check"></i>
      <span>No open claimed transactions in the last {{ CLAIMED_TRANSACTIONS_DAYS }} days.</span>
    </div>

    <template v-else>
      <div class="overflow-x-auto">
        <table class="table table-sm table-zebra">
          <thead>
            <tr>
              <th>Verified by (caller)</th>
              <th>Owned by</th>
              <th>Platform</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Last attempt</th>
              <th class="text-center">Attempts</th>
              <th><span class="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="claimedTransactionKey(row)" data-testid="claimed-row">
              <td>
                <div class="text-sm max-w-[16rem] truncate" :title="accountLabel(row.caller_email, row.caller_user_id)">
                  {{ accountLabel(row.caller_email, row.caller_user_id) }}
                </div>
                <div v-if="row.caller_entitled_now" class="text-xs text-success">
                  <i class="fas fa-check mr-1"></i>Member through another channel
                </div>
              </td>
              <td>
                <div class="text-sm max-w-[16rem] truncate" :title="accountLabel(row.owner_email, row.owner_user_id)">
                  {{ accountLabel(row.owner_email, row.owner_user_id) }}
                </div>
              </td>
              <td>
                <span class="badge badge-sm" :class="platformBadge(row.platform)">{{ row.platform }}</span>
              </td>
              <td class="text-sm">{{ planName(row.plan) }}</td>
              <td class="text-sm">
                {{ row.status }}
                <div class="text-xs opacity-60">expires {{ fmtDate(row.expires_at) }}</div>
              </td>
              <td class="text-sm opacity-70 whitespace-nowrap">{{ fmtDateTime(row.last_attempt_at) }}</td>
              <td class="text-center">{{ row.attempts }}</td>
              <td>
                <button
                  type="button"
                  class="btn btn-xs btn-outline btn-warning whitespace-nowrap"
                  data-testid="claimed-move"
                  @click="askMove(row)"
                >
                  <i class="fas fa-right-left"></i>
                  Move to caller
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="truncated" class="text-xs opacity-60 mt-2" data-testid="claimed-truncated">
        Showing the newest {{ CLAIMED_TRANSACTIONS_LIMIT }} cases. Resolve these to see older ones.
      </p>
    </template>

    <div
      class="modal"
      :class="{ 'modal-open': !!pending }"
      role="dialog"
      aria-modal="true"
      aria-labelledby="claimed-move-title"
    >
      <div v-if="pending" class="modal-box" data-testid="claimed-modal">
        <h3 id="claimed-move-title" class="font-bold text-lg mb-3">Move this subscription?</h3>
        <p class="text-sm mb-2">
          Move the <strong>{{ pending.platform }}</strong> subscription ({{ planName(pending.plan) }},
          {{ pending.status }}):
        </p>
        <dl class="text-sm grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 mb-3">
          <dt class="opacity-70">From</dt>
          <dd class="min-w-0 break-all font-medium" data-testid="claimed-modal-from">
            {{ accountLabel(pending.owner_email, pending.owner_user_id) }}
          </dd>
          <dt class="opacity-70">To</dt>
          <dd class="min-w-0 break-all font-medium" data-testid="claimed-modal-to">
            {{ accountLabel(pending.caller_email, pending.caller_user_id) }}
          </dd>
        </dl>
        <div class="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-3 text-sm">
          <i class="fas fa-triangle-exclamation mr-1 text-warning"></i>
          The current owner loses the membership from this purchase unless another channel covers them. Discord and blog
          access are re-synced for both accounts.
        </div>
        <div v-if="moveError" role="alert" class="alert alert-error text-sm mb-3" data-testid="claimed-move-error">
          <i class="fas fa-triangle-exclamation"></i>
          <span>{{ moveError }}</span>
        </div>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" :disabled="moving" @click="cancelMove">Cancel</button>
          <button
            type="button"
            class="btn btn-warning"
            :disabled="moving"
            data-testid="claimed-confirm"
            @click="confirmMove"
          >
            <span v-if="moving" class="loading loading-spinner loading-sm"></span>
            <i v-else class="fas fa-right-left"></i>
            Move to caller
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="cancelMove"></div>
    </div>
  </section>
</template>
