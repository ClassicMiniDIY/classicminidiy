<script setup lang="ts">
  import {
    MEMBER_LOOKUP_LIMIT,
    MEMBER_LOOKUP_MIN_QUERY,
    memberLookupKind,
    normaliseMemberLookupQuery,
    type MemberLookupMatch,
    type MemberLookupResponse,
    type MemberLookupRow,
  } from '~~/shared/utils/memberLookup';

  /**
   * Support lookup (membership clarity §8): find one person across every
   * channel by any email they use, a Discord username, a store or Stripe
   * reference, or a user id. Never by name — names differ across platforms.
   *
   * Each subscriptions row is listed with its OWN platform, plan, status and
   * expiry. A member's effective plan is the highest across those rows, and the
   * platform they manage billing on is chosen separately, so reading them as one
   * pair ("Stripe · Pro") is how "why does this person have Pro" gets answered
   * wrong.
   */
  const DEBOUNCE_MS = 350;

  const query = ref('');
  const results = ref<MemberLookupRow[]>([]);
  const truncated = ref(false);
  const loading = ref(false);
  const errorMessage = ref('');
  /** The query the shown results belong to; null before the first search. */
  const searched = ref<string | null>(null);

  const queryReady = computed(() => normaliseMemberLookupQuery(query.value) !== null);

  let timer: ReturnType<typeof setTimeout> | null = null;
  // Only the newest request may write the results: a slow answer to "tere"
  // must not overwrite a fast answer to "teresa".
  let seq = 0;

  async function run(q: string) {
    const mine = ++seq;
    loading.value = true;
    errorMessage.value = '';
    try {
      const res = await $adminFetch<MemberLookupResponse>('/api/admin/membership/find', { query: { q } });
      if (mine !== seq) return;
      results.value = res?.results ?? [];
      truncated.value = !!res?.truncated;
      searched.value = q;
    } catch (error: any) {
      if (mine !== seq) return;
      results.value = [];
      truncated.value = false;
      searched.value = q;
      errorMessage.value = error?.data?.statusMessage || error?.statusMessage || error?.message || 'Search failed';
    } finally {
      if (mine === seq) loading.value = false;
    }
  }

  watch(query, (value) => {
    if (timer) clearTimeout(timer);
    const q = normaliseMemberLookupQuery(value);
    if (q === null) {
      // Too short to send: clear, and drop any request still in flight.
      seq++;
      loading.value = false;
      results.value = [];
      truncated.value = false;
      errorMessage.value = '';
      searched.value = null;
      return;
    }
    timer = setTimeout(() => run(q), DEBOUNCE_MS);
  });

  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer);
  });

  const MATCH_LABELS: Record<MemberLookupMatch, string> = {
    account_email: 'account email',
    pending_email: 'claim email',
    discord_username: 'Discord username',
    ghost_email: 'Ghost email',
    external_ref: 'external ref',
    stripe_customer_id: 'Stripe customer',
    user_id: 'user id',
  };
  const matchLabel = (m: string) => MATCH_LABELS[m as MemberLookupMatch] ?? m;

  const KIND_LABELS = { account: 'Account', unclaimed: 'Unclaimed payer', deleted: 'Deleted account' } as const;
  const KIND_BADGES = { account: 'badge-primary', unclaimed: 'badge-warning', deleted: 'badge-ghost' } as const;

  const PLATFORM_BADGES: Record<string, string> = {
    apple: 'badge-neutral',
    google: 'badge-success',
    stripe: 'badge-info',
    comp: 'badge-warning',
    ghost: 'badge-secondary',
    patreon: 'badge-accent',
  };
  const platformBadge = (platform: string) => PLATFORM_BADGES[platform] ?? 'badge-ghost';

  /** Level name for a plan code. NULL is a pre-plans row, treated as base. */
  function planName(plan: string | null) {
    if (plan === 'pro') return 'Pro';
    if (plan === 'plus') return 'Plus';
    if (plan === 'base') return 'Member';
    return plan ? `${plan} (unknown)` : 'Member (unset)';
  }

  function fmtDate(value: string | null) {
    return value ? new Date(value).toLocaleDateString() : '—';
  }

  function isPast(value: string | null) {
    return !!value && new Date(value).getTime() < Date.now();
  }

  // One email can back two unclaimed rows (a Patreon and a Ghost stage), so the
  // email is not a key. Kind + provider/platform + external_ref; index last.
  function rowKey(row: MemberLookupRow, i: number) {
    const kind = memberLookupKind(row);
    if (row.user_id) return `${kind}:${row.user_id}`;
    const sub = row.subscriptions[0];
    const claim = row.pending_claims[0];
    const source = sub?.platform ?? claim?.provider;
    const ref = sub?.external_ref ?? claim?.external_ref;
    return source && ref ? `${kind}:${source}:${ref}` : `${kind}:${i}`;
  }
</script>

<template>
  <section class="card bg-base-100 border border-base-300 shadow-sm" data-testid="member-lookup">
    <div class="card-body p-4 sm:p-5 gap-3">
      <h2 class="text-lg font-semibold"><i class="fas fa-address-card mr-2 text-primary"></i>Find a member</h2>
      <p class="text-sm opacity-70">
        Search by any email the person uses (account, Patreon or Ghost), a Discord username, a store or Stripe
        reference, or a user id. Names are not searched: they differ across platforms.
      </p>
      <label class="input input-bordered flex items-center gap-2 w-full">
        <i class="fas fa-magnifying-glass opacity-50"></i>
        <input
          v-model="query"
          type="search"
          class="grow min-w-0"
          placeholder="Email, Discord username, reference or user id"
          aria-label="Find a member"
          autocomplete="off"
          spellcheck="false"
        />
        <span v-if="loading" class="loading loading-spinner loading-sm" aria-label="Searching"></span>
      </label>

      <p v-if="!queryReady" class="text-xs opacity-60" data-testid="lookup-hint">
        Type at least {{ MEMBER_LOOKUP_MIN_QUERY }} characters.
      </p>

      <div v-else-if="errorMessage" role="alert" class="alert alert-error" data-testid="lookup-error">
        <i class="fas fa-triangle-exclamation"></i>
        <span class="min-w-0 break-words">{{ errorMessage }}</span>
      </div>

      <p
        v-else-if="!loading && searched !== null && results.length === 0"
        class="text-sm opacity-70"
        data-testid="lookup-empty"
      >
        <i class="fas fa-circle-info mr-1"></i>No member matches “{{ searched }}”.
      </p>

      <template v-else-if="results.length">
        <p v-if="truncated" class="alert alert-warning text-sm" data-testid="lookup-truncated">
          <i class="fas fa-filter"></i>
          <span>More members matched than the {{ MEMBER_LOOKUP_LIMIT }} shown. Refine your search.</span>
        </p>

        <ul class="space-y-3" :class="{ 'opacity-60': loading }">
          <li
            v-for="(row, i) in results"
            :key="rowKey(row, i)"
            class="rounded-box border border-base-300 p-3 sm:p-4 min-w-0"
            data-testid="lookup-result"
          >
            <!-- Who -->
            <div class="flex flex-wrap items-start gap-2 min-w-0">
              <span class="badge badge-sm shrink-0" :class="KIND_BADGES[memberLookupKind(row)]">
                {{ KIND_LABELS[memberLookupKind(row)] }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="font-semibold break-all" data-testid="lookup-email">
                  <template v-if="memberLookupKind(row) === 'deleted'">Deleted account</template>
                  <template v-else>{{ row.email || '—' }}</template>
                </p>
                <p v-if="row.display_name" class="text-sm opacity-70 break-words">{{ row.display_name }}</p>
                <p v-if="row.user_id" class="text-xs opacity-60 font-mono break-all">{{ row.user_id }}</p>
              </div>
            </div>
            <p v-if="row.matched_on.length" class="text-xs opacity-60 mt-1">
              Matched on: {{ row.matched_on.map(matchLabel).join(', ') }}
            </p>

            <!-- Subscriptions: one line per row, never merged -->
            <h3 class="text-sm font-semibold mt-3 mb-1">Subscriptions</h3>
            <p v-if="row.subscriptions.length === 0" class="text-xs opacity-60 italic">No subscription rows.</p>
            <div v-else class="overflow-x-auto">
              <table class="table table-xs" data-testid="lookup-subscriptions">
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Expires</th>
                    <th>Product</th>
                    <th>External ref</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(sub, j) in row.subscriptions" :key="j" data-testid="lookup-subscription">
                    <td>
                      <span class="badge badge-sm" :class="platformBadge(sub.platform)">{{ sub.platform }}</span>
                    </td>
                    <td class="whitespace-nowrap">{{ planName(sub.plan) }}</td>
                    <td>{{ sub.status }}</td>
                    <td class="whitespace-nowrap" :class="{ 'text-error': isPast(sub.expires_at) }">
                      {{ sub.expires_at ? fmtDate(sub.expires_at) : 'No expiry' }}
                    </td>
                    <td class="font-mono">{{ sub.product_id }}</td>
                    <td class="font-mono break-all max-w-[16rem]">{{ sub.external_ref || '—' }}</td>
                    <td class="whitespace-nowrap opacity-70">{{ fmtDate(sub.updated_at) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pending external claims -->
            <template v-if="row.pending_claims.length">
              <h3 class="text-sm font-semibold mt-3 mb-1">Pending claims</h3>
              <div class="overflow-x-auto">
                <table class="table table-xs" data-testid="lookup-claims">
                  <thead>
                    <tr>
                      <th>Provider</th>
                      <th>Email</th>
                      <th>Plan</th>
                      <th>Status</th>
                      <th>Claim sent</th>
                      <th>External ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(claim, j) in row.pending_claims" :key="j">
                      <td>
                        <span class="badge badge-sm" :class="platformBadge(claim.provider)">{{ claim.provider }}</span>
                      </td>
                      <td class="break-all max-w-[16rem]">{{ claim.email || '—' }}</td>
                      <td class="whitespace-nowrap">{{ planName(claim.plan) }}</td>
                      <td>{{ claim.status }}</td>
                      <td class="whitespace-nowrap">{{ fmtDate(claim.claim_issued_at) }}</td>
                      <td class="font-mono break-all max-w-[16rem]">{{ claim.external_ref || '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>

            <!-- Discord -->
            <p class="text-sm mt-3" data-testid="lookup-discord">
              <i class="fab fa-discord mr-1 text-primary"></i>
              <template v-if="row.discord">
                <span class="font-semibold">{{ row.discord.status || 'unknown' }}</span>
                <span v-if="row.discord.discord_username" class="font-mono text-xs ml-2 break-all"
                  >@{{ row.discord.discord_username }}</span
                >
                <span v-if="row.discord.discord_user_id" class="font-mono text-xs opacity-60 ml-2 break-all">{{
                  row.discord.discord_user_id
                }}</span>
              </template>
              <span v-else class="opacity-60 italic">Discord not linked</span>
            </p>
          </li>
        </ul>
      </template>
    </div>
  </section>
</template>
