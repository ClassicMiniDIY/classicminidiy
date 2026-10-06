<script lang="ts" setup>
  import { CHAT_QUOTAS, MEMBERSHIP_PLANS } from '~~/shared/utils/chatTiers';

  /**
   * The member-management card: plan and level, Discord status, the members-only
   * blog, and the platform-aware manage affordance (Stripe portal, App Store /
   * Google Play, comp, blog, Patreon, YouTube, fallback).
   *
   * Rendered by /settings/membership for an active member only. /membership is
   * the public sales and checkout page and points members here.
   */
  const { t } = useI18n();
  const config = useRuntimeConfig();
  const supabase = useSupabase();
  const { track } = useAnalytics();
  const { user } = useAuth();

  const blogUrl = computed(() => (config.public.blogUrl as string) || '');

  // Same allowance contract as /membership: the count comes from the shared
  // quota table, so this card never quotes a number the chat does not enforce.
  const planQuestionsByPlan = Object.fromEntries(
    MEMBERSHIP_PLANS.map((p) => [p.plan, CHAT_QUOTAS[p.tier].perMonth ?? 0])
  ) as Record<string, number>;
  const planLabel = (plan: string | null | undefined) =>
    plan === 'plus' || plan === 'pro' ? t(`plans.${plan}.name`) : t('plans.base.name');
  const planQuestions = (plan: string | null | undefined) =>
    planQuestionsByPlan[plan ?? 'base'] ?? planQuestionsByPlan.base ?? 0;

  // Existing web members self-manage through the Stripe Customer Portal (no-code
  // login link, NUXT_PUBLIC_STRIPE_PORTAL_URL). Pre-fill the member's email so
  // they skip a step. Members who subscribed in the iOS/Android apps manage
  // through the App Store / Google Play instead.
  const portalHref = computed(() => {
    const base = (config.public.stripePortalUrl as string) || '';
    if (!base) return '';
    const email = user.value?.email;
    return email ? `${base}?prefilled_email=${encodeURIComponent(email)}` : base;
  });

  // Live Discord connection status for members. Reads the user's own
  // discord_links row via the SELECT-own RLS policy (keystone §6.2). null = no
  // link yet; otherwise 'pending' | 'active' | 'revoked' | 'failed'.
  const discordStatus = ref<string | null>(null);
  async function loadDiscordStatus() {
    if (!user.value) return;
    try {
      const { data, error } = await supabase
        .from('discord_links')
        .select('status')
        .eq('user_id', user.value.id)
        .maybeSingle();
      if (error) {
        // PostgREST errors don't throw — surface them explicitly (RLS/db issues).
        console.error('Error loading Discord status:', error);
        discordStatus.value = null;
        return;
      }
      discordStatus.value = data?.status ?? null;
    } catch (err) {
      console.error('Error loading Discord status:', err);
      discordStatus.value = null;
    }
  }

  // The channel this member manages billing on (apple/google/stripe/comp/
  // ghost/patreon/youtube), via get_my_membership(): a purchase is preferred over comp,
  // then the highest plan, then the newest row. Drives the management UI so
  // non-Stripe members aren't shown the Stripe portal link. null while loading
  // or if the RPC isn't deployed yet — in which case we hide the Stripe link
  // (the safe default for comp/Apple/Google members).
  const membershipPlatform = ref<string | null>(null);
  // The HIGHEST plan (base | plus | pro) across all of the member's entitling
  // rows, comp included. It need not come from the same row as
  // membershipPlatform, so never render the two as a pair ("Stripe · Pro").
  // null until loaded or for rows written before plans existed, which the
  // server treats as base.
  const membershipPlan = ref<string | null>(null);
  // True once get_my_membership() has answered. The headline shows the level
  // only after that, so a Pro member never sees "· Member" flash first.
  const membershipLoaded = ref(false);
  async function loadMembershipPlatform() {
    // A reload (for example after switching account) must not show the
    // previous answer while it runs, nor keep it if this one fails.
    membershipLoaded.value = false;
    membershipPlatform.value = null;
    membershipPlan.value = null;
    if (!user.value) return;
    try {
      const { data, error } = await supabase.rpc('get_my_membership').single();
      if (error) {
        console.error('Error loading membership platform:', error);
        return;
      }
      membershipPlatform.value = data?.platform ?? null;
      membershipPlan.value = data?.plan ?? null;
      membershipLoaded.value = true;
    } catch (err) {
      console.error('Error loading membership platform:', err);
    }
  }

  // Change level, Stripe members only. The Customer Portal lists at most one
  // price per billing interval per product, so it can never offer Plus or Pro.
  // The change-membership-plan edge function swaps the price on the member's
  // own Stripe subscription; the webhook then writes the new plan (design:
  // classicminidiy-supabase docs/plans/2026-10-06-membership-change-level.md).
  const formatPrice = (usd: number) => `$${usd.toFixed(2)}`;

  // The Stripe sub's OWN level and price (change-membership-plan, action
  // 'status'). get_my_membership().plan is the highest level across every
  // channel, so a comp Pro member who also pays Stripe Member would see the
  // wrong level marked. null = not loaded or the call failed: the picker stays
  // hidden, so the web can ship before the edge function.
  interface ChangeStatus {
    plan: string | null;
    interval: 'month' | 'year' | null;
    monthlyCents: number | null;
    onCurrentPrice: boolean;
    blocked: string | null;
  }
  const changeStatus = ref<ChangeStatus | null>(null);
  const currentPlan = computed(() => changeStatus.value?.plan ?? membershipPlan.value ?? 'base');

  async function accessToken(): Promise<string | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  // Keeps the previous answer while it reloads (after a change), so the done
  // message inside the block does not flicker or vanish if the reload fails.
  async function loadChangeStatus() {
    try {
      const token = await accessToken();
      if (!token) return;
      changeStatus.value = await $fetch<ChangeStatus>('/api/membership/change-plan', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: { action: 'status' },
      });
    } catch (error) {
      console.error('Error loading membership level status:', error);
    }
  }
  watch(
    () => (membershipLoaded.value && membershipPlatform.value === 'stripe' ? user.value?.id : null),
    (userId) => {
      // A new account (or a non-Stripe answer) never shows the previous status.
      changeStatus.value = null;
      if (userId) loadChangeStatus();
    },
    { immediate: true }
  );

  // A level is selectable unless it is the current level on today's price.
  // A legacy (Substack-era) price keeps its own level selectable: choosing it
  // moves the member to today's price for that level.
  const isCurrentOption = (plan: string) => plan === currentPlan.value && changeStatus.value?.onCurrentPrice !== false;

  const pendingPlan = ref<string | null>(null);
  const pendingOption = computed(() => MEMBERSHIP_PLANS.find((p) => p.plan === pendingPlan.value) ?? null);
  // Which rule the confirm step states. Compared by price, not by level order,
  // so a legacy $8/mo Plus member moving to $4.99 Plus reads as a move down.
  const pendingRuleKey = computed(() => {
    if (changeStatus.value?.interval === 'year') return 'member.change.confirm_yearly';
    const current = changeStatus.value?.monthlyCents;
    const target = pendingOption.value ? Math.round(pendingOption.value.usd * 100) : null;
    return current != null && target != null && target < current
      ? 'member.change.confirm_down'
      : 'member.change.confirm_up';
  });
  type ChangeState = 'idle' | 'working' | 'done' | 'already' | 'payment' | 'error';
  const changeState = ref<ChangeState>('idle');
  const changeErrorKey = ref('member.change.error');
  const changedTo = ref<string | null>(null);
  const invoiceUrl = ref<string | null>(null);

  function askChange(plan: string) {
    pendingPlan.value = plan;
    changeState.value = 'idle';
    invoiceUrl.value = null;
  }
  function cancelChange() {
    pendingPlan.value = null;
  }

  // The webhook writes the new plan a few seconds after Stripe applies the
  // change. Refresh the headline in the background until it moves (about 15
  // seconds); it shows the highest level across channels, so it may never
  // match, and nothing waits on it.
  async function refreshHeadlineSoon() {
    const before = membershipPlan.value;
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const { data, error } = await supabase.rpc('get_my_membership').single();
      if (!error && data?.plan && data.plan !== before) {
        membershipPlan.value = data.plan;
        return;
      }
    }
  }

  const SUPPORT_CODES = [
    'OWNER_MISMATCH',
    'MULTIPLE_SUBSCRIPTIONS',
    'UNEXPECTED_ITEMS',
    'HAS_SCHEDULE',
    'NO_STRIPE_MEMBERSHIP',
  ];
  function errorKeyFor(code: string | null | undefined): string {
    if (code === 'CANCEL_SCHEDULED') return 'member.change.error_cancel_scheduled';
    if (code === 'NOT_ACTIVE') return 'member.change.error_not_active';
    if (code === 'PAYMENT_METHOD_UNSUPPORTED') return 'member.change.error_payment_method';
    if (code === 'PLAN_UNAVAILABLE') return 'member.change.error_unavailable';
    if (code && SUPPORT_CODES.includes(code)) return 'member.change.error_support';
    return 'member.change.error';
  }
  const blockedKey = computed(() => (changeStatus.value?.blocked ? errorKeyFor(changeStatus.value.blocked) : null));

  async function confirmChange() {
    const plan = pendingPlan.value;
    if (!plan || changeState.value === 'working') return;
    changeState.value = 'working';
    track('membership_plan_change_started', { source: 'web', from: currentPlan.value, to: plan });
    try {
      const token = await accessToken();
      if (!token) throw new Error('No session');
      const res = await $fetch<{ changed?: boolean }>('/api/membership/change-plan', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: { plan },
      });
      pendingPlan.value = null;
      changedTo.value = plan;
      if (res?.changed === false) {
        changeState.value = 'already';
        return;
      }
      changeState.value = 'done';
      track('membership_plan_changed', { source: 'web', to: plan });
      await loadChangeStatus();
      void refreshHeadlineSoon();
    } catch (error: any) {
      // h3 puts createError's data under the body's own `data` key.
      const data = error?.data?.data ?? error?.data ?? {};
      if (data.code === 'PAYMENT_REQUIRED') {
        pendingPlan.value = null;
        invoiceUrl.value = typeof data.invoiceUrl === 'string' ? data.invoiceUrl : null;
        changeState.value = 'payment';
        return;
      }
      console.error('Membership level change failed:', error);
      changeErrorKey.value = errorKeyFor(data.code);
      changeState.value = 'error';
    }
  }

  const discordStatusKey = computed(() => {
    switch (discordStatus.value) {
      case 'active':
        return 'connected';
      case 'pending':
        return 'pending';
      case 'revoked':
        return 'revoked';
      case 'failed':
        return 'failed';
      default:
        return 'not_connected';
    }
  });
  const discordStatusLabel = computed(() => t(`member.discord_status.${discordStatusKey.value}`));
  const discordGuidance = computed(() => t(`member.discord_guidance.${discordStatusKey.value}`));
  const discordBadgeClass = computed(() => {
    switch (discordStatus.value) {
      case 'active':
        return 'badge-success';
      case 'pending':
        return 'badge-warning';
      case 'revoked':
      case 'failed':
        return 'badge-error';
      default:
        return 'badge-ghost';
    }
  });

  // The parent renders this card only for an active member. Load once per
  // signed-in user, so switching account reloads rather than keeping the old
  // answer.
  watch(
    () => user.value?.id,
    (userId) => {
      if (userId) {
        loadDiscordStatus();
        loadMembershipPlatform();
      }
    },
    { immediate: true }
  );
</script>

<template>
  <section class="card border border-primary/40 bg-base-100 shadow-md" data-testid="membership-manage-card">
    <div class="card-body">
      <div class="flex flex-wrap items-center gap-3">
        <ProfileSustainingBadge size="md" />
        <h2 class="text-2xl font-bold" data-testid="member-title">
          {{ membershipLoaded ? t('member.title', { level: planLabel(membershipPlan) }) : t('member.title_pending') }}
        </h2>
      </div>
      <p class="opacity-70">{{ t('member.subtitle') }}</p>
      <!-- Gated like the headline: before get_my_membership() answers the
           plan is unknown, and on an RPC error neither line guesses. -->
      <p v-if="membershipLoaded" class="text-sm mt-1" data-testid="member-plan-line">
        <i class="fas fa-comments mr-2 text-primary"></i
        >{{
          t('member.plan_line', {
            plan: planLabel(membershipPlan),
            count: planQuestions(membershipPlan ?? 'base'),
          })
        }}
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <!-- Discord connection status (live via discord_links SELECT-own
             RLS policy, keystone §6.2) -->
        <div class="rounded-box border border-base-300 p-4">
          <p class="font-semibold">
            <i class="fab fa-discord mr-2 text-primary"></i>{{ t('member.discord_title') }}
            <span class="badge badge-sm ml-1" :class="discordBadgeClass">{{ discordStatusLabel }}</span>
          </p>
          <p class="text-sm opacity-70 mt-1">{{ discordGuidance }}</p>
          <!-- No self-serve re-issue endpoint exists yet (backend
               follow-up); until then, support re-sends invites manually. -->
          <p
            v-if="discordStatusKey === 'pending' || discordStatusKey === 'not_connected'"
            class="text-xs opacity-60 mt-2"
          >
            {{ t('member.discord_lost_email') }}
            <NuxtLink to="/contact" class="link link-primary">{{ t('member.discord_contact_cta') }}</NuxtLink>
          </p>
        </div>
        <!-- Members-only blog posts -->
        <div class="rounded-box border border-base-300 p-4">
          <p class="font-semibold"><i class="fas fa-book-open mr-2 text-primary"></i>{{ t('member.blog_title') }}</p>
          <p class="text-sm opacity-70 mt-1">{{ t('member.blog_desc') }}</p>
          <a
            v-if="blogUrl"
            :href="blogUrl"
            target="_blank"
            rel="noopener"
            class="link link-primary text-sm font-semibold mt-2 inline-block"
          >
            {{ t('member.blog_cta') }} <i class="fas fa-arrow-up-right-from-square ml-1 text-xs"></i>
          </a>
        </div>
      </div>

      <!-- Management action is per-channel: only Stripe members have a
           billing portal; comp/Apple/Google members must not see it. -->
      <template v-if="membershipPlatform === 'stripe'">
        <div v-if="portalHref" class="card-actions mt-4">
          <a
            :href="portalHref"
            target="_blank"
            rel="noopener"
            class="btn btn-outline btn-primary"
            @click="track('membership_portal_opened', { source: 'web' })"
          >
            <i class="fas fa-gear"></i>
            {{ t('member.manage') }}
          </a>
        </div>
        <p class="text-xs opacity-60 mt-2">{{ t('member.manage_note_stripe') }}</p>

        <div v-if="changeStatus" class="rounded-box border border-base-300 p-4 mt-4" data-testid="change-level">
          <p class="font-semibold">
            <i class="fas fa-arrows-up-down mr-2 text-primary" aria-hidden="true"></i>{{ t('member.change.title') }}
          </p>
          <p v-if="blockedKey" class="text-sm opacity-70 mt-1" data-testid="change-level-blocked">
            {{ t(blockedKey) }}
          </p>
          <template v-else>
            <p class="text-sm opacity-70 mt-1">{{ t('member.change.intro') }}</p>
            <div class="flex flex-wrap gap-2 mt-3">
              <button
                v-for="option in MEMBERSHIP_PLANS"
                :key="option.plan"
                type="button"
                class="btn btn-sm"
                :class="option.plan === currentPlan ? 'btn-primary' : 'btn-outline'"
                :disabled="isCurrentOption(option.plan) || changeState === 'working'"
                :aria-pressed="pendingPlan === option.plan"
                :data-testid="`change-level-${option.plan}`"
                @click="askChange(option.plan)"
              >
                {{ t('member.change.option', { plan: planLabel(option.plan), price: formatPrice(option.usd) }) }}
                <span v-if="option.plan === currentPlan" class="badge badge-sm">{{
                  changeStatus.onCurrentPrice ? t('member.change.current') : t('member.change.older_price')
                }}</span>
              </button>
            </div>

            <div v-if="pendingOption" role="alert" class="alert mt-3 items-start" data-testid="change-level-confirm">
              <div class="flex flex-col gap-2">
                <p class="font-semibold">
                  {{
                    t('member.change.confirm', {
                      plan: planLabel(pendingOption.plan),
                      price: formatPrice(pendingOption.usd),
                      count: planQuestions(pendingOption.plan),
                    })
                  }}
                </p>
                <p class="text-sm opacity-80">{{ t(pendingRuleKey) }}</p>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    :disabled="changeState === 'working'"
                    data-testid="change-level-confirm-button"
                    @click="confirmChange"
                  >
                    <span v-if="changeState === 'working'" class="loading loading-spinner loading-xs"></span>
                    {{ changeState === 'working' ? t('member.change.working') : t('member.change.confirm_cta') }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm"
                    :disabled="changeState === 'working'"
                    @click="cancelChange"
                  >
                    {{ t('member.change.cancel') }}
                  </button>
                </div>
              </div>
            </div>
          </template>

          <p
            v-if="changeState === 'done'"
            class="text-sm text-success mt-3"
            role="status"
            data-testid="change-level-done"
          >
            <i class="fas fa-circle-check mr-1" aria-hidden="true"></i
            >{{ t('member.change.done', { plan: planLabel(changedTo) }) }}
          </p>
          <p
            v-else-if="changeState === 'already'"
            class="text-sm mt-3"
            role="status"
            data-testid="change-level-already"
          >
            {{ t('member.change.already', { plan: planLabel(changedTo) }) }}
          </p>
          <div
            v-else-if="changeState === 'payment'"
            role="alert"
            class="alert alert-warning mt-3"
            data-testid="change-level-payment"
          >
            <div class="flex flex-col gap-2">
              <p class="text-sm">{{ t('member.change.payment_needed') }}</p>
              <a
                v-if="invoiceUrl"
                :href="invoiceUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-sm btn-warning w-fit"
              >
                {{ t('member.change.payment_cta') }}
                <i class="fas fa-arrow-up-right-from-square text-xs" aria-hidden="true"></i>
              </a>
              <p v-else class="text-sm">
                {{ t('member.change.payment_no_link') }}
                <a v-if="portalHref" :href="portalHref" target="_blank" rel="noopener" class="link">{{
                  t('member.manage')
                }}</a>
              </p>
            </div>
          </div>
          <p
            v-else-if="changeState === 'error'"
            class="text-sm text-error mt-3"
            role="alert"
            data-testid="change-level-error"
          >
            <i class="fas fa-triangle-exclamation mr-1" aria-hidden="true"></i>{{ t(changeErrorKey) }}
          </p>
        </div>
      </template>
      <p v-else-if="membershipPlatform === 'comp'" class="text-sm opacity-70 mt-4">
        <i class="fas fa-gift mr-2 text-primary"></i>{{ t('member.comp_note') }}
      </p>
      <p v-else-if="membershipPlatform === 'apple' || membershipPlatform === 'google'" class="text-sm opacity-70 mt-4">
        <i class="fas fa-mobile-screen mr-2 text-primary"></i>{{ t('member.manage_note_store') }}
        {{ t('member.change_plan_store') }}
      </p>
      <p v-else-if="membershipPlatform === 'ghost'" class="text-sm opacity-70 mt-4">
        <i class="fas fa-book-open mr-2 text-primary"></i>{{ t('member.manage_note_ghost') }}
      </p>
      <p v-else-if="membershipPlatform === 'patreon'" class="text-sm opacity-70 mt-4">
        <i class="fab fa-patreon mr-2 text-primary"></i>
        <a
          href="https://www.patreon.com/settings/memberships"
          target="_blank"
          rel="noopener"
          class="link link-primary"
          >{{ t('member.manage_note_patreon') }}</a
        >
      </p>
      <p v-else-if="membershipPlatform === 'youtube'" class="text-sm opacity-70 mt-4">
        <i class="fab fa-youtube mr-2 text-primary"></i>
        <a href="https://www.youtube.com/paid_memberships" target="_blank" rel="noopener" class="link link-primary">{{
          t('member.manage_note_youtube')
        }}</a>
      </p>
      <!-- Unknown/null platform on an active member: never render an
           empty manage area (parity with TME). -->
      <p v-else class="text-sm opacity-70 mt-4">
        <i class="fas fa-circle-check mr-2 text-success"></i>{{ t('member.active_fallback') }}
      </p>
    </div>
  </section>
</template>

<i18n lang="json">
{
  "en": {
    "member": {
      "title": "You're a Sustaining Member · {level}",
      "title_pending": "You're a Sustaining Member",
      "subtitle": "Thanks for keeping the Classic Mini community running. Here's what your membership unlocks.",
      "discord_title": "Members-only Discord",
      "discord_status": {
        "connected": "Connected",
        "pending": "Invite sent",
        "revoked": "Revoked",
        "failed": "Needs attention",
        "not_connected": "Not connected"
      },
      "discord_guidance": {
        "connected": "You're in the members-only Discord — see you there!",
        "pending": "Your private invite was emailed to you — check your inbox (and spam) to finish joining.",
        "not_connected": "We email your private Discord invite once your membership is active. It can take a few minutes — watch your inbox (and spam).",
        "revoked": "Your Discord access was removed. Reactivate your membership to rejoin.",
        "failed": "We hit a snag issuing your Discord invite. Reach out via the contact page and we'll sort it out."
      },
      "blog_title": "Members-only blog posts",
      "blog_desc": "Complimentary access to subscriber content on the Classic Mini DIY blog.",
      "blog_cta": "Open the blog",
      "discord_lost_email": "Lost the invite email?",
      "discord_contact_cta": "Contact us and we'll resend it.",
      "manage": "Manage membership",
      "manage_note_stripe": "Manage or cancel your membership any time on the billing page.",
      "comp_note": "Your membership is complimentary — enjoy all the benefits, on us. There's nothing to manage.",
      "manage_note_store": "Manage or cancel your subscription in the App Store or Google Play, wherever you subscribed.",
      "manage_note_ghost": "Manage billing and cancellation from your Classic Mini DIY blog account.",
      "manage_note_patreon": "Manage your pledge on Patreon.",
      "manage_note_youtube": "Manage your membership on YouTube.",
      "active_fallback": "Your membership is active.",
      "plan_line": "Your plan: {plan} — {count} DIY Mini Bot questions a month.",
      "change": {
        "title": "Change level",
        "intro": "Move to another level at any time.",
        "option": "{plan} · {price}/month",
        "current": "Current",
        "confirm": "Move to {plan} ({price} a month, {count} DIY Mini Bot questions a month)?",
        "confirm_up": "You are charged the difference for the rest of this billing period.",
        "confirm_down": "The unused part of your current level becomes a credit toward your next payments.",
        "confirm_cta": "Confirm",
        "cancel": "Cancel",
        "working": "Changing…",
        "done": "Done. Your level is now {plan}.",
        "payment_needed": "The payment for this change did not go through. Pay it soon (the change expires within a day), or the change is dropped and nothing is charged.",
        "payment_cta": "Open the payment page",
        "error": "We could not change your level. Try again, or contact us.",
        "error_cancel_scheduled": "Your membership is set to end. Resume it on the billing page first, then change the level.",
        "error_not_active": "There is a problem with your payment. Fix it on the billing page first.",
        "confirm_yearly": "You move from yearly to monthly payments, starting today. The unused part of your yearly payment counts toward the new price; if it does not cover it, you pay the difference.",
        "older_price": "Older price",
        "already": "You are already on {plan}.",
        "payment_no_link": "Update your payment method on the billing page, then try again.",
        "error_support": "This membership cannot be changed here. Contact us and we will change it for you.",
        "error_unavailable": "This level is not available yet.",
        "error_payment_method": "Changing level needs a card. Update your payment method on the billing page first."
      },
      "change_plan_store": "Switch plans from your App Store or Google Play subscription settings."
    },
    "plans": {
      "base": {
        "name": "Member"
      },
      "plus": {
        "name": "Plus"
      },
      "pro": {
        "name": "Pro"
      }
    }
  },
  "es": {
    "member": {
      "title": "Eres Socio Colaborador · {level}",
      "title_pending": "Eres Socio Colaborador",
      "subtitle": "Gracias por mantener viva la comunidad del Classic Mini. Esto es lo que desbloquea tu membresía.",
      "discord_title": "Discord exclusivo para socios",
      "discord_status": {
        "connected": "Conectado",
        "pending": "Invitación enviada",
        "revoked": "Revocado",
        "failed": "Requiere atención",
        "not_connected": "Sin conectar"
      },
      "discord_guidance": {
        "connected": "Ya estás en el Discord exclusivo: ¡nos vemos allí!",
        "pending": "Te hemos enviado tu invitación privada por correo: revisa tu bandeja de entrada (y el spam) para terminar de entrar.",
        "not_connected": "Te enviamos tu invitación privada de Discord por correo en cuanto tu membresía esté activa. Puede tardar unos minutos: vigila tu bandeja de entrada (y el spam).",
        "revoked": "Se ha retirado tu acceso a Discord. Reactiva tu membresía para volver a entrar.",
        "failed": "Hemos tenido un problema al emitir tu invitación de Discord. Escríbenos desde la página de contacto y lo solucionamos."
      },
      "blog_title": "Artículos del blog exclusivos para socios",
      "blog_desc": "Acceso gratuito al contenido para suscriptores del blog de Classic Mini DIY.",
      "blog_cta": "Abrir el blog",
      "discord_lost_email": "¿Has perdido el correo de invitación?",
      "discord_contact_cta": "Contáctanos y te lo reenviamos.",
      "manage": "Gestionar membresía",
      "manage_note_stripe": "Gestiona o cancela tu membresía cuando quieras en la página de facturación.",
      "comp_note": "Tu membresía es de cortesía: disfruta de todas las ventajas, invita la casa. No hay nada que gestionar.",
      "manage_note_store": "Gestiona o cancela tu suscripción en la App Store o en Google Play, según dónde te suscribieras.",
      "manage_note_ghost": "Gestiona la facturación y la cancelación desde tu cuenta del blog de Classic Mini DIY.",
      "manage_note_patreon": "Gestiona tu aportación en Patreon.",
      "manage_note_youtube": "Gestiona tu membresía en YouTube.",
      "active_fallback": "Tu membresía está activa.",
      "plan_line": "Tu plan: {plan} — {count} preguntas al DIY Mini Bot al mes.",
      "change": {
        "title": "Cambiar de nivel",
        "intro": "Cambia a otro nivel cuando quieras.",
        "option": "{plan} · {price}/mes",
        "current": "Actual",
        "confirm": "¿Cambiar a {plan} ({price} al mes, {count} preguntas al DIY Mini Bot al mes)?",
        "confirm_up": "Se te cobra la diferencia por lo que queda de este periodo de facturación.",
        "confirm_down": "La parte no usada de tu nivel actual queda como saldo a favor para tus próximos pagos.",
        "confirm_cta": "Confirmar",
        "cancel": "Cancelar",
        "working": "Cambiando…",
        "done": "Hecho. Tu nivel ahora es {plan}.",
        "payment_needed": "El pago de este cambio no se ha completado. Págalo pronto (el cambio caduca en menos de un día) o se descarta, sin ningún cobro.",
        "payment_cta": "Abrir la página de pago",
        "error": "No hemos podido cambiar tu nivel. Inténtalo de nuevo o contáctanos.",
        "error_cancel_scheduled": "Tu membresía está programada para terminar. Reactívala primero en la página de facturación y luego cambia el nivel.",
        "error_not_active": "Hay un problema con tu pago. Resuélvelo primero en la página de facturación.",
        "confirm_yearly": "Pasas de pago anual a pago mensual a partir de hoy. La parte no usada de tu pago anual cuenta para el nuevo precio; si no lo cubre, pagas la diferencia.",
        "older_price": "Precio anterior",
        "already": "Ya tienes el nivel {plan}.",
        "payment_no_link": "Actualiza tu método de pago en la página de facturación y vuelve a intentarlo.",
        "error_support": "Esta membresía no se puede cambiar aquí. Contáctanos y la cambiamos por ti.",
        "error_unavailable": "Este nivel aún no está disponible.",
        "error_payment_method": "Para cambiar de nivel necesitas una tarjeta. Actualiza primero tu método de pago en la página de facturación."
      },
      "change_plan_store": "Cambia de plan desde los ajustes de suscripción del App Store o Google Play."
    },
    "plans": {
      "base": {
        "name": "Member"
      },
      "plus": {
        "name": "Plus"
      },
      "pro": {
        "name": "Pro"
      }
    }
  },
  "fr": {
    "member": {
      "title": "Vous êtes membre de soutien · {level}",
      "title_pending": "Vous êtes membre de soutien",
      "subtitle": "Merci de faire vivre la communauté Classic Mini. Voici ce que votre adhésion débloque.",
      "discord_title": "Discord réservé aux membres",
      "discord_status": {
        "connected": "Connecté",
        "pending": "Invitation envoyée",
        "revoked": "Révoqué",
        "failed": "À vérifier",
        "not_connected": "Non connecté"
      },
      "discord_guidance": {
        "connected": "Vous êtes dans le Discord réservé aux membres — à tout de suite !",
        "pending": "Votre invitation privée vous a été envoyée par e-mail — vérifiez votre boîte de réception (et vos spams) pour finaliser.",
        "not_connected": "Nous vous envoyons votre invitation Discord privée par e-mail dès que votre adhésion est active. Cela peut prendre quelques minutes — surveillez votre boîte de réception (et vos spams).",
        "revoked": "Votre accès Discord a été retiré. Réactivez votre adhésion pour revenir.",
        "failed": "Nous avons rencontré un problème en émettant votre invitation Discord. Écrivez-nous via la page de contact et nous réglerons ça."
      },
      "blog_title": "Articles de blog réservés aux membres",
      "blog_desc": "Accès offert au contenu réservé aux abonnés du blog Classic Mini DIY.",
      "blog_cta": "Ouvrir le blog",
      "discord_lost_email": "Vous avez perdu l'e-mail d'invitation ?",
      "discord_contact_cta": "Contactez-nous, nous le renverrons.",
      "manage": "Gérer l'adhésion",
      "manage_note_stripe": "Gérez ou annulez votre adhésion à tout moment sur la page de facturation.",
      "comp_note": "Votre adhésion est offerte — profitez de tous les avantages, c'est cadeau. Il n'y a rien à gérer.",
      "manage_note_store": "Gérez ou annulez votre abonnement dans l'App Store ou sur Google Play, selon l'endroit où vous vous êtes abonné.",
      "manage_note_ghost": "Gérez la facturation et la résiliation depuis votre compte du blog Classic Mini DIY.",
      "manage_note_patreon": "Gérez votre contribution sur Patreon.",
      "manage_note_youtube": "Gérez votre abonnement sur YouTube.",
      "active_fallback": "Votre adhésion est active.",
      "plan_line": "Votre formule : {plan} — {count} questions au DIY Mini Bot par mois.",
      "change": {
        "title": "Changer de niveau",
        "intro": "Passez à un autre niveau à tout moment.",
        "option": "{plan} · {price}/mois",
        "current": "Actuel",
        "confirm": "Passer à {plan} ({price} par mois, {count} questions au DIY Mini Bot par mois) ?",
        "confirm_up": "La différence pour le reste de cette période de facturation vous est facturée.",
        "confirm_down": "La partie non utilisée de votre niveau actuel devient un crédit sur vos prochains paiements.",
        "confirm_cta": "Confirmer",
        "cancel": "Annuler",
        "working": "Modification…",
        "done": "C'est fait. Votre niveau est maintenant {plan}.",
        "payment_needed": "Le paiement de ce changement n'a pas abouti. Payez-le rapidement (le changement expire en moins d'un jour), sinon il est annulé et rien n'est facturé.",
        "payment_cta": "Ouvrir la page de paiement",
        "error": "Nous n'avons pas pu changer votre niveau. Réessayez ou contactez-nous.",
        "error_cancel_scheduled": "Votre adhésion doit se terminer. Réactivez-la d'abord sur la page de facturation, puis changez de niveau.",
        "error_not_active": "Il y a un problème avec votre paiement. Réglez-le d'abord sur la page de facturation.",
        "confirm_yearly": "Vous passez d'un paiement annuel à un paiement mensuel à partir d'aujourd'hui. La partie non utilisée de votre paiement annuel compte pour le nouveau prix ; si elle ne le couvre pas, vous payez la différence.",
        "older_price": "Ancien prix",
        "already": "Vous êtes déjà au niveau {plan}.",
        "payment_no_link": "Mettez à jour votre moyen de paiement sur la page de facturation, puis réessayez.",
        "error_support": "Cette adhésion ne peut pas être modifiée ici. Contactez-nous et nous la modifierons pour vous.",
        "error_unavailable": "Ce niveau n'est pas encore disponible.",
        "error_payment_method": "Changer de niveau nécessite une carte. Mettez d'abord à jour votre moyen de paiement sur la page de facturation."
      },
      "change_plan_store": "Changez de formule depuis les réglages d'abonnement de l'App Store ou de Google Play."
    },
    "plans": {
      "base": {
        "name": "Member"
      },
      "plus": {
        "name": "Plus"
      },
      "pro": {
        "name": "Pro"
      }
    }
  },
  "de": {
    "member": {
      "title": "Du bist Fördermitglied · {level}",
      "title_pending": "Du bist Fördermitglied",
      "subtitle": "Danke, dass du die Classic-Mini-Community am Laufen hältst. Das schaltet deine Mitgliedschaft frei.",
      "discord_title": "Discord nur für Mitglieder",
      "discord_status": {
        "connected": "Verbunden",
        "pending": "Einladung gesendet",
        "revoked": "Entzogen",
        "failed": "Erfordert Aufmerksamkeit",
        "not_connected": "Nicht verbunden"
      },
      "discord_guidance": {
        "connected": "Du bist im Discord nur für Mitglieder – bis gleich!",
        "pending": "Deine private Einladung ist per E-Mail unterwegs – sieh in deinem Postfach (und im Spam) nach, um beizutreten.",
        "not_connected": "Wir senden dir deine private Discord-Einladung per E-Mail, sobald deine Mitgliedschaft aktiv ist. Das kann ein paar Minuten dauern – behalte dein Postfach (und den Spam) im Auge.",
        "revoked": "Dein Discord-Zugang wurde entfernt. Reaktiviere deine Mitgliedschaft, um wieder beizutreten.",
        "failed": "Beim Ausstellen deiner Discord-Einladung gab es ein Problem. Melde dich über die Kontaktseite und wir klären das."
      },
      "blog_title": "Blogbeiträge nur für Mitglieder",
      "blog_desc": "Kostenloser Zugang zu den Abonnenteninhalten im Classic-Mini-DIY-Blog.",
      "blog_cta": "Blog öffnen",
      "discord_lost_email": "Einladungs-E-Mail verloren?",
      "discord_contact_cta": "Kontaktiere uns, wir senden sie erneut.",
      "manage": "Mitgliedschaft verwalten",
      "manage_note_stripe": "Verwalte oder kündige deine Mitgliedschaft jederzeit auf der Abrechnungsseite.",
      "comp_note": "Deine Mitgliedschaft ist ein Geschenk – genieße alle Vorteile, geht aufs Haus. Es gibt nichts zu verwalten.",
      "manage_note_store": "Verwalte oder kündige dein Abo im App Store oder bei Google Play – dort, wo du es abgeschlossen hast.",
      "manage_note_ghost": "Verwalte Abrechnung und Kündigung in deinem Konto beim Classic Mini DIY Blog.",
      "manage_note_patreon": "Verwalte deinen Beitrag auf Patreon.",
      "manage_note_youtube": "Verwalte deine Mitgliedschaft auf YouTube.",
      "active_fallback": "Deine Mitgliedschaft ist aktiv.",
      "plan_line": "Dein Plan: {plan} — {count} DIY-Mini-Bot-Fragen pro Monat.",
      "change": {
        "title": "Stufe ändern",
        "intro": "Wechsle jederzeit zu einer anderen Stufe.",
        "option": "{plan} · {price}/Monat",
        "current": "Aktuell",
        "confirm": "Zu {plan} wechseln ({price} pro Monat, {count} Fragen an den DIY Mini Bot pro Monat)?",
        "confirm_up": "Dir wird die Differenz für den Rest dieses Abrechnungszeitraums berechnet.",
        "confirm_down": "Der ungenutzte Teil deiner aktuellen Stufe wird als Guthaben mit deinen nächsten Zahlungen verrechnet.",
        "confirm_cta": "Bestätigen",
        "cancel": "Abbrechen",
        "working": "Wird geändert…",
        "done": "Erledigt. Deine Stufe ist jetzt {plan}.",
        "payment_needed": "Die Zahlung für diese Änderung ist nicht durchgegangen. Bezahle sie bald (die Änderung verfällt innerhalb eines Tages), sonst verfällt sie und es wird nichts berechnet.",
        "payment_cta": "Zahlungsseite öffnen",
        "error": "Wir konnten deine Stufe nicht ändern. Versuche es erneut oder kontaktiere uns.",
        "error_cancel_scheduled": "Deine Mitgliedschaft endet bald. Setze sie zuerst auf der Abrechnungsseite fort und ändere dann die Stufe.",
        "error_not_active": "Es gibt ein Problem mit deiner Zahlung. Behebe es zuerst auf der Abrechnungsseite.",
        "confirm_yearly": "Du wechselst ab heute von jährlicher zu monatlicher Zahlung. Der ungenutzte Teil deiner Jahreszahlung wird auf den neuen Preis angerechnet; reicht er nicht, zahlst du die Differenz.",
        "older_price": "Alter Preis",
        "already": "Du hast bereits die Stufe {plan}.",
        "payment_no_link": "Aktualisiere deine Zahlungsmethode auf der Abrechnungsseite und versuche es dann erneut.",
        "error_support": "Diese Mitgliedschaft kann hier nicht geändert werden. Kontaktiere uns, und wir ändern sie für dich.",
        "error_unavailable": "Diese Stufe ist noch nicht verfügbar.",
        "error_payment_method": "Für einen Stufenwechsel brauchst du eine Karte. Aktualisiere zuerst deine Zahlungsmethode auf der Abrechnungsseite."
      },
      "change_plan_store": "Den Plan wechselst du in den Abo-Einstellungen des App Store oder von Google Play."
    },
    "plans": {
      "base": {
        "name": "Member"
      },
      "plus": {
        "name": "Plus"
      },
      "pro": {
        "name": "Pro"
      }
    }
  },
  "it": {
    "member": {
      "title": "Sei un Socio Sostenitore · {level}",
      "title_pending": "Sei un Socio Sostenitore",
      "subtitle": "Grazie per tenere viva la community del Classic Mini. Ecco cosa sblocca la tua iscrizione.",
      "discord_title": "Discord riservato ai soci",
      "discord_status": {
        "connected": "Collegato",
        "pending": "Invito inviato",
        "revoked": "Revocato",
        "failed": "Richiede attenzione",
        "not_connected": "Non collegato"
      },
      "discord_guidance": {
        "connected": "Sei nel Discord riservato ai soci: ci vediamo lì!",
        "pending": "Ti abbiamo inviato per email il tuo invito privato: controlla la posta in arrivo (e lo spam) per completare l'ingresso.",
        "not_connected": "Ti inviamo per email l'invito privato a Discord non appena la tua iscrizione è attiva. Possono volerci alcuni minuti: tieni d'occhio la posta in arrivo (e lo spam).",
        "revoked": "Il tuo accesso a Discord è stato rimosso. Riattiva l'iscrizione per rientrare.",
        "failed": "Abbiamo avuto un problema nell'emettere il tuo invito a Discord. Scrivici dalla pagina dei contatti e sistemiamo tutto."
      },
      "blog_title": "Articoli del blog riservati ai soci",
      "blog_desc": "Accesso gratuito ai contenuti riservati agli abbonati del blog Classic Mini DIY.",
      "blog_cta": "Apri il blog",
      "discord_lost_email": "Hai perso l'email di invito?",
      "discord_contact_cta": "Contattaci e te la rinviamo.",
      "manage": "Gestisci l'iscrizione",
      "manage_note_stripe": "Gestisci o disdici la tua iscrizione quando vuoi dalla pagina di fatturazione.",
      "comp_note": "La tua iscrizione è offerta da noi: goditi tutti i vantaggi, offre la casa. Non c'è nulla da gestire.",
      "manage_note_store": "Gestisci o disdici l'abbonamento nell'App Store o su Google Play, dove ti sei iscritto.",
      "manage_note_ghost": "Gestisci fatturazione e disdetta dal tuo account del blog Classic Mini DIY.",
      "manage_note_patreon": "Gestisci il tuo contributo su Patreon.",
      "manage_note_youtube": "Gestisci il tuo abbonamento su YouTube.",
      "active_fallback": "La tua iscrizione è attiva.",
      "plan_line": "Il tuo piano: {plan} — {count} domande al DIY Mini Bot al mese.",
      "change": {
        "title": "Cambia livello",
        "intro": "Passa a un altro livello quando vuoi.",
        "option": "{plan} · {price}/mese",
        "current": "Attuale",
        "confirm": "Passare a {plan} ({price} al mese, {count} domande al DIY Mini Bot al mese)?",
        "confirm_up": "Ti viene addebitata la differenza per il resto di questo periodo di fatturazione.",
        "confirm_down": "La parte non usata del tuo livello attuale diventa un credito sui prossimi pagamenti.",
        "confirm_cta": "Conferma",
        "cancel": "Annulla",
        "working": "Modifica in corso…",
        "done": "Fatto. Il tuo livello ora è {plan}.",
        "payment_needed": "Il pagamento per questa modifica non è andato a buon fine. Pagalo presto (la modifica scade entro un giorno), altrimenti viene annullata e non viene addebitato nulla.",
        "payment_cta": "Apri la pagina di pagamento",
        "error": "Non siamo riusciti a cambiare il tuo livello. Riprova o contattaci.",
        "error_cancel_scheduled": "La tua iscrizione sta per terminare. Riattivala prima nella pagina di fatturazione, poi cambia livello.",
        "error_not_active": "C'è un problema con il tuo pagamento. Risolvilo prima nella pagina di fatturazione.",
        "confirm_yearly": "Passi dal pagamento annuale a quello mensile a partire da oggi. La parte non usata del pagamento annuale conta per il nuovo prezzo; se non basta, paghi la differenza.",
        "older_price": "Prezzo precedente",
        "already": "Hai già il livello {plan}.",
        "payment_no_link": "Aggiorna il metodo di pagamento nella pagina di fatturazione, poi riprova.",
        "error_support": "Questa iscrizione non si può cambiare qui. Contattaci e la cambiamo noi per te.",
        "error_unavailable": "Questo livello non è ancora disponibile.",
        "error_payment_method": "Per cambiare livello serve una carta. Aggiorna prima il metodo di pagamento nella pagina di fatturazione."
      },
      "change_plan_store": "Cambia piano dalle impostazioni abbonamento dell'App Store o di Google Play."
    },
    "plans": {
      "base": {
        "name": "Member"
      },
      "plus": {
        "name": "Plus"
      },
      "pro": {
        "name": "Pro"
      }
    }
  },
  "pt": {
    "member": {
      "title": "É Membro Apoiador · {level}",
      "title_pending": "É Membro Apoiador",
      "subtitle": "Obrigado por manter a comunidade do Classic Mini a andar. Eis o que a sua adesão desbloqueia.",
      "discord_title": "Discord exclusivo para membros",
      "discord_status": {
        "connected": "Ligado",
        "pending": "Convite enviado",
        "revoked": "Revogado",
        "failed": "Precisa de atenção",
        "not_connected": "Não ligado"
      },
      "discord_guidance": {
        "connected": "Já está no Discord exclusivo para membros — até já!",
        "pending": "Enviámos o seu convite privado por email — veja a caixa de entrada (e o spam) para concluir a entrada.",
        "not_connected": "Enviamos o seu convite privado do Discord por email assim que a adesão estiver ativa. Pode demorar alguns minutos — fique atento à caixa de entrada (e ao spam).",
        "revoked": "O seu acesso ao Discord foi removido. Reative a adesão para voltar a entrar.",
        "failed": "Tivemos um problema ao emitir o seu convite do Discord. Contacte-nos pela página de contacto e resolvemos."
      },
      "blog_title": "Artigos do blogue exclusivos para membros",
      "blog_desc": "Acesso gratuito aos conteúdos para subscritores do blogue Classic Mini DIY.",
      "blog_cta": "Abrir o blogue",
      "discord_lost_email": "Perdeu o email do convite?",
      "discord_contact_cta": "Contacte-nos e reenviamos.",
      "manage": "Gerir adesão",
      "manage_note_stripe": "Faça a gestão ou cancele a sua adesão a qualquer momento na página de faturação.",
      "comp_note": "A sua adesão é oferecida — aproveite todas as vantagens, é por nossa conta. Não há nada a gerir.",
      "manage_note_store": "Faça a gestão ou cancele a subscrição na App Store ou no Google Play, onde a tiver feito.",
      "manage_note_ghost": "Faça a gestão da faturação e do cancelamento na sua conta do blogue Classic Mini DIY.",
      "manage_note_patreon": "Faça a gestão do seu contributo no Patreon.",
      "manage_note_youtube": "Faça a gestão da sua subscrição no YouTube.",
      "active_fallback": "A sua adesão está ativa.",
      "plan_line": "Seu plano: {plan} — {count} perguntas ao DIY Mini Bot por mês.",
      "change": {
        "title": "Mudar de nível",
        "intro": "Mude para outro nível quando quiser.",
        "option": "{plan} · {price}/mês",
        "current": "Atual",
        "confirm": "Mudar para {plan} ({price} por mês, {count} perguntas ao DIY Mini Bot por mês)?",
        "confirm_up": "Você paga a diferença pelo restante deste período de cobrança.",
        "confirm_down": "A parte não usada do seu nível atual vira crédito para os próximos pagamentos.",
        "confirm_cta": "Confirmar",
        "cancel": "Cancelar",
        "working": "Alterando…",
        "done": "Pronto. Seu nível agora é {plan}.",
        "payment_needed": "O pagamento desta mudança não foi concluído. Pague logo (a mudança expira em menos de um dia) ou ela é descartada, sem nenhuma cobrança.",
        "payment_cta": "Abrir a página de pagamento",
        "error": "Não conseguimos mudar seu nível. Tente de novo ou fale conosco.",
        "error_cancel_scheduled": "Sua assinatura está programada para terminar. Reative-a primeiro na página de cobrança e depois mude o nível.",
        "error_not_active": "Há um problema com seu pagamento. Resolva primeiro na página de cobrança.",
        "confirm_yearly": "Você passa do pagamento anual para o mensal a partir de hoje. A parte não usada do pagamento anual conta para o novo preço; se não cobrir, você paga a diferença.",
        "older_price": "Preço antigo",
        "already": "Você já está no nível {plan}.",
        "payment_no_link": "Atualize seu método de pagamento na página de cobrança e tente de novo.",
        "error_support": "Esta assinatura não pode ser mudada aqui. Fale conosco e mudamos para você.",
        "error_unavailable": "Este nível ainda não está disponível.",
        "error_payment_method": "Para mudar de nível é preciso um cartão. Atualize primeiro seu método de pagamento na página de cobrança."
      },
      "change_plan_store": "Troque de plano nas configurações de assinatura da App Store ou do Google Play."
    },
    "plans": {
      "base": {
        "name": "Member"
      },
      "plus": {
        "name": "Plus"
      },
      "pro": {
        "name": "Pro"
      }
    }
  },
  "ru": {
    "member": {
      "title": "Вы постоянный участник · {level}",
      "title_pending": "Вы постоянный участник",
      "subtitle": "Спасибо, что поддерживаете сообщество Classic Mini. Вот что открывает ваше участие.",
      "discord_title": "Discord только для участников",
      "discord_status": {
        "connected": "Подключено",
        "pending": "Приглашение отправлено",
        "revoked": "Отозвано",
        "failed": "Требует внимания",
        "not_connected": "Не подключено"
      },
      "discord_guidance": {
        "connected": "Вы в Discord для участников — до встречи там!",
        "pending": "Мы отправили ваше личное приглашение на почту — проверьте входящие (и спам), чтобы завершить вход.",
        "not_connected": "Мы отправим личное приглашение в Discord на почту, как только ваше участие станет активным. Это может занять несколько минут — следите за входящими (и спамом).",
        "revoked": "Доступ к Discord был отозван. Возобновите участие, чтобы вернуться.",
        "failed": "При выпуске приглашения в Discord возникла проблема. Напишите нам через страницу контактов, и мы всё решим."
      },
      "blog_title": "Записи блога только для участников",
      "blog_desc": "Бесплатный доступ к материалам для подписчиков блога Classic Mini DIY.",
      "blog_cta": "Открыть блог",
      "discord_lost_email": "Потеряли письмо с приглашением?",
      "discord_contact_cta": "Свяжитесь с нами, и мы отправим его снова.",
      "manage": "Управление участием",
      "manage_note_stripe": "Управляйте участием или отмените его в любой момент на странице оплаты.",
      "comp_note": "Ваше участие бесплатное — пользуйтесь всеми привилегиями за наш счёт. Управлять нечем.",
      "manage_note_store": "Управляйте подпиской или отмените её в App Store или Google Play — там, где вы её оформили.",
      "manage_note_ghost": "Управляйте оплатой и отменой в своём аккаунте блога Classic Mini DIY.",
      "manage_note_patreon": "Управляйте своим взносом на Patreon.",
      "manage_note_youtube": "Управляйте спонсорством на YouTube.",
      "active_fallback": "Ваше участие активно.",
      "plan_line": "Ваш план: {plan} — {count} вопросов DIY Mini Bot в месяц.",
      "change": {
        "title": "Сменить уровень",
        "intro": "Переходите на другой уровень в любое время.",
        "option": "{plan} · {price}/мес.",
        "current": "Текущий",
        "confirm": "Перейти на {plan} ({price} в месяц, {count} вопросов DIY Mini Bot в месяц)?",
        "confirm_up": "С вас списывается разница за остаток текущего расчётного периода.",
        "confirm_down": "Неиспользованная часть текущего уровня станет кредитом в счёт следующих платежей.",
        "confirm_cta": "Подтвердить",
        "cancel": "Отмена",
        "working": "Меняем…",
        "done": "Готово. Ваш уровень теперь {plan}.",
        "payment_needed": "Оплата этого изменения не прошла. Оплатите её поскорее (изменение истекает в течение суток), иначе оно отменится и ничего не будет списано.",
        "payment_cta": "Открыть страницу оплаты",
        "error": "Не удалось сменить уровень. Попробуйте ещё раз или свяжитесь с нами.",
        "error_cancel_scheduled": "Ваше членство скоро закончится. Сначала возобновите его на странице оплаты, затем смените уровень.",
        "error_not_active": "С вашим платежом проблема. Сначала исправьте её на странице оплаты.",
        "confirm_yearly": "С сегодняшнего дня вы переходите с ежегодной оплаты на ежемесячную. Неиспользованная часть годового платежа засчитывается в новую цену; если её не хватает, вы доплачиваете разницу.",
        "older_price": "Старая цена",
        "already": "У вас уже уровень {plan}.",
        "payment_no_link": "Обновите способ оплаты на странице оплаты и попробуйте снова.",
        "error_support": "Это членство нельзя изменить здесь. Свяжитесь с нами, и мы изменим его за вас.",
        "error_unavailable": "Этот уровень пока недоступен.",
        "error_payment_method": "Для смены уровня нужна карта. Сначала обновите способ оплаты на странице оплаты."
      },
      "change_plan_store": "Сменить план можно в настройках подписки App Store или Google Play."
    },
    "plans": {
      "base": {
        "name": "Member"
      },
      "plus": {
        "name": "Plus"
      },
      "pro": {
        "name": "Pro"
      }
    }
  },
  "ja": {
    "member": {
      "title": "あなたはサステイニングメンバーです · {level}",
      "title_pending": "あなたはサステイニングメンバーです",
      "subtitle": "Classic Mini コミュニティを支えていただきありがとうございます。メンバーシップで使える特典はこちらです。",
      "discord_title": "メンバー限定 Discord",
      "discord_status": {
        "connected": "連携済み",
        "pending": "招待を送信しました",
        "revoked": "取り消し済み",
        "failed": "確認が必要です",
        "not_connected": "未連携"
      },
      "discord_guidance": {
        "connected": "メンバー限定 Discord に参加済みです。それではまた中で!",
        "pending": "プライベートな招待をメールでお送りしました。受信トレイ (と迷惑メール) をご確認のうえ、参加を完了してください。",
        "not_connected": "メンバーシップが有効になり次第、プライベートな Discord 招待をメールでお送りします。数分かかる場合があります。受信トレイ (と迷惑メール) をご確認ください。",
        "revoked": "Discord へのアクセスが解除されました。再参加するにはメンバーシップを再開してください。",
        "failed": "Discord の招待の発行で問題が発生しました。お問い合わせページからご連絡ください。こちらで対応します。"
      },
      "blog_title": "メンバー限定のブログ記事",
      "blog_desc": "Classic Mini DIY ブログの購読者向けコンテンツを無料でご利用いただけます。",
      "blog_cta": "ブログを開く",
      "discord_lost_email": "招待メールが見つかりませんか?",
      "discord_contact_cta": "お問い合わせいただければ再送します。",
      "manage": "メンバーシップの管理",
      "manage_note_stripe": "お支払いページからいつでもメンバーシップの管理・解約ができます。",
      "comp_note": "あなたのメンバーシップは無償提供です。すべての特典をどうぞご利用ください。管理する項目はありません。",
      "manage_note_store": "登録した場所に応じて、App Store または Google Play でサブスクリプションの管理・解約ができます。",
      "manage_note_ghost": "お支払いと解約は Classic Mini DIY ブログのアカウントから管理できます。",
      "manage_note_patreon": "Patreon で支援内容を管理できます。",
      "manage_note_youtube": "YouTube でメンバーシップを管理できます。",
      "active_fallback": "メンバーシップは有効です。",
      "plan_line": "現在のプラン: {plan} — DIY Mini Bot への質問 月{count}件。",
      "change": {
        "title": "レベルを変更",
        "intro": "いつでも別のレベルに変更できます。",
        "option": "{plan} · {price}/月",
        "current": "現在",
        "confirm": "{plan}（月額{price}、DIY Mini Botへの質問は月{count}件）に変更しますか？",
        "confirm_up": "今回の請求期間の残り分の差額が請求されます。",
        "confirm_down": "現在のレベルの未使用分は、次回以降のお支払いに充てるクレジットになります。",
        "confirm_cta": "確定",
        "cancel": "キャンセル",
        "working": "変更中…",
        "done": "完了しました。現在のレベルは{plan}です。",
        "payment_needed": "この変更のお支払いが完了していません。お早めにお支払いください（変更は1日以内に期限切れになります）。期限を過ぎると変更は取り消され、請求は発生しません。",
        "payment_cta": "支払いページを開く",
        "error": "レベルを変更できませんでした。もう一度お試しいただくか、お問い合わせください。",
        "error_cancel_scheduled": "メンバーシップは終了予定になっています。先に請求ページで再開してから、レベルを変更してください。",
        "error_not_active": "お支払いに問題があります。先に請求ページで解決してください。",
        "confirm_yearly": "本日から年払いが月払いに変わります。年払いの未使用分は新しい料金に充てられます。足りない場合は差額をお支払いいただきます。",
        "older_price": "以前の料金",
        "already": "すでに{plan}です。",
        "payment_no_link": "請求ページでお支払い方法を更新してから、もう一度お試しください。",
        "error_support": "このメンバーシップはここでは変更できません。お問い合わせいただければ、こちらで変更します。",
        "error_unavailable": "このレベルはまだご利用いただけません。",
        "error_payment_method": "レベルの変更にはカードが必要です。先に請求ページでお支払い方法を更新してください。"
      },
      "change_plan_store": "プランの変更は App Store または Google Play のサブスクリプション設定から行えます。"
    },
    "plans": {
      "base": {
        "name": "Member"
      },
      "plus": {
        "name": "Plus"
      },
      "pro": {
        "name": "Pro"
      }
    }
  },
  "zh": {
    "member": {
      "title": "你是持续支持会员 · {level}",
      "title_pending": "你是持续支持会员",
      "subtitle": "感谢你让 Classic Mini 社群持续运转。以下是你的会员资格所解锁的内容。",
      "discord_title": "会员专属 Discord",
      "discord_status": {
        "connected": "已连接",
        "pending": "邀请已发送",
        "revoked": "已撤销",
        "failed": "需要处理",
        "not_connected": "未连接"
      },
      "discord_guidance": {
        "connected": "你已在会员专属 Discord 中——里面见!",
        "pending": "你的专属邀请已通过邮件发出——请查收收件箱(以及垃圾邮件)以完成加入。",
        "not_connected": "会员资格生效后,我们会通过邮件发送你的专属 Discord 邀请。可能需要几分钟——请留意收件箱(以及垃圾邮件)。",
        "revoked": "你的 Discord 访问权限已被移除。重新启用会员资格即可再次加入。",
        "failed": "发放你的 Discord 邀请时出了点问题。请通过联系页面告诉我们,我们会帮你处理。"
      },
      "blog_title": "会员专属博客文章",
      "blog_desc": "免费阅读 Classic Mini DIY 博客的订阅者内容。",
      "blog_cta": "打开博客",
      "discord_lost_email": "找不到邀请邮件?",
      "discord_contact_cta": "联系我们,我们会重新发送。",
      "manage": "管理会员资格",
      "manage_note_stripe": "你可以随时在账单页面管理或取消会员资格。",
      "comp_note": "你的会员资格由我们赠送——尽情享用全部权益,无需任何操作。",
      "manage_note_store": "请在你订阅所在的 App Store 或 Google Play 中管理或取消订阅。",
      "manage_note_ghost": "在你的 Classic Mini DIY 博客账号中管理账单和取消。",
      "manage_note_patreon": "在 Patreon 上管理你的支持。",
      "manage_note_youtube": "在 YouTube 上管理你的会员。",
      "active_fallback": "你的会员资格已生效。",
      "plan_line": "您的方案：{plan} — 每月 {count} 个 DIY Mini Bot 问题。",
      "change": {
        "title": "更改等级",
        "intro": "您可以随时更换等级。",
        "option": "{plan} · {price}/月",
        "current": "当前",
        "confirm": "改为 {plan}（每月 {price}，每月 {count} 个 DIY Mini Bot 问题）？",
        "confirm_up": "将向您收取本计费周期剩余时间的差价。",
        "confirm_down": "当前等级未使用的部分将作为余额，抵扣您之后的付款。",
        "confirm_cta": "确认",
        "cancel": "取消",
        "working": "正在更改…",
        "done": "已完成。您的等级现在是 {plan}。",
        "payment_needed": "此次更改的付款未完成。请尽快付款（更改会在一天内失效），否则更改将被取消，且不会收取任何费用。",
        "payment_cta": "打开付款页面",
        "error": "无法更改您的等级。请重试或联系我们。",
        "error_cancel_scheduled": "您的会员资格即将结束。请先在账单页面恢复，然后再更改等级。",
        "error_not_active": "您的付款有问题。请先在账单页面解决。",
        "confirm_yearly": "从今天起，您将由按年付款改为按月付款。年付款中未使用的部分将抵扣新价格；如果不足，您需支付差额。",
        "older_price": "旧价格",
        "already": "您已经是 {plan}。",
        "payment_no_link": "请在账单页面更新付款方式，然后重试。",
        "error_support": "无法在此更改此会员资格。请联系我们，我们会为您更改。",
        "error_unavailable": "此等级暂不可用。",
        "error_payment_method": "更改等级需要使用银行卡。请先在账单页面更新付款方式。"
      },
      "change_plan_store": "可在 App Store 或 Google Play 的订阅设置中更换方案。"
    },
    "plans": {
      "base": {
        "name": "Member"
      },
      "plus": {
        "name": "Plus"
      },
      "pro": {
        "name": "Pro"
      }
    }
  },
  "ko": {
    "member": {
      "title": "서포팅 멤버이십니다 · {level}",
      "title_pending": "서포팅 멤버이십니다",
      "subtitle": "Classic Mini 커뮤니티를 지켜 주셔서 감사합니다. 멤버십으로 이용하실 수 있는 혜택입니다.",
      "discord_title": "멤버 전용 Discord",
      "discord_status": {
        "connected": "연결됨",
        "pending": "초대 발송됨",
        "revoked": "해제됨",
        "failed": "확인 필요",
        "not_connected": "연결 안 됨"
      },
      "discord_guidance": {
        "connected": "멤버 전용 Discord에 참여 중이십니다. 안에서 뵙겠습니다!",
        "pending": "비공개 초대를 이메일로 보내 드렸습니다. 받은편지함(및 스팸함)을 확인하고 참여를 마무리해 주세요.",
        "not_connected": "멤버십이 활성화되면 비공개 Discord 초대를 이메일로 보내 드립니다. 몇 분 정도 걸릴 수 있으니 받은편지함(및 스팸함)을 확인해 주세요.",
        "revoked": "Discord 접근 권한이 해제되었습니다. 다시 참여하시려면 멤버십을 재개해 주세요.",
        "failed": "Discord 초대를 발급하는 중 문제가 있었습니다. 문의 페이지로 연락 주시면 처리해 드리겠습니다."
      },
      "blog_title": "멤버 전용 블로그 글",
      "blog_desc": "Classic Mini DIY 블로그의 구독자 전용 콘텐츠를 무료로 이용하실 수 있습니다.",
      "blog_cta": "블로그 열기",
      "discord_lost_email": "초대 이메일을 못 찾으셨나요?",
      "discord_contact_cta": "문의해 주시면 다시 보내 드리겠습니다.",
      "manage": "멤버십 관리",
      "manage_note_stripe": "결제 페이지에서 언제든 멤버십을 관리하거나 해지하실 수 있습니다.",
      "comp_note": "회원님의 멤버십은 무료로 제공됩니다. 모든 혜택을 마음껏 누리세요. 따로 관리하실 것은 없습니다.",
      "manage_note_store": "구독하신 곳에 따라 App Store 또는 Google Play에서 구독을 관리하거나 해지하실 수 있습니다.",
      "manage_note_ghost": "결제와 해지는 Classic Mini DIY 블로그 계정에서 관리하실 수 있습니다.",
      "manage_note_patreon": "Patreon에서 후원을 관리하실 수 있습니다.",
      "manage_note_youtube": "YouTube에서 멤버십을 관리하실 수 있습니다.",
      "active_fallback": "멤버십이 활성화되어 있습니다.",
      "plan_line": "내 플랜: {plan} — 월 DIY Mini Bot 질문 {count}개.",
      "change": {
        "title": "등급 변경",
        "intro": "언제든지 다른 등급으로 바꿀 수 있습니다.",
        "option": "{plan} · {price}/월",
        "current": "현재",
        "confirm": "{plan}(월 {price}, 월 {count}개의 DIY Mini Bot 질문)(으)로 바꿀까요?",
        "confirm_up": "이번 결제 기간의 남은 기간에 대한 차액이 청구됩니다.",
        "confirm_down": "현재 등급에서 사용하지 않은 부분은 다음 결제에 쓰이는 크레딧이 됩니다.",
        "confirm_cta": "확인",
        "cancel": "취소",
        "working": "변경 중…",
        "done": "완료되었습니다. 이제 등급은 {plan}입니다.",
        "payment_needed": "이 변경에 대한 결제가 완료되지 않았습니다. 빨리 결제해 주세요(변경은 하루 안에 만료됩니다). 만료되면 변경이 취소되며 아무것도 청구되지 않습니다.",
        "payment_cta": "결제 페이지 열기",
        "error": "등급을 변경하지 못했습니다. 다시 시도하거나 문의해 주세요.",
        "error_cancel_scheduled": "멤버십이 종료될 예정입니다. 먼저 결제 페이지에서 재개한 다음 등급을 변경해 주세요.",
        "error_not_active": "결제에 문제가 있습니다. 먼저 결제 페이지에서 해결해 주세요.",
        "confirm_yearly": "오늘부터 연간 결제가 월간 결제로 바뀝니다. 연간 결제에서 사용하지 않은 부분은 새 가격에 반영되며, 부족하면 차액을 결제합니다.",
        "older_price": "이전 가격",
        "already": "이미 {plan} 등급입니다.",
        "payment_no_link": "결제 페이지에서 결제 수단을 업데이트한 다음 다시 시도해 주세요.",
        "error_support": "이 멤버십은 여기에서 변경할 수 없습니다. 문의해 주시면 대신 변경해 드립니다.",
        "error_unavailable": "이 등급은 아직 이용할 수 없습니다.",
        "error_payment_method": "등급을 변경하려면 카드가 필요합니다. 먼저 결제 페이지에서 결제 수단을 업데이트해 주세요."
      },
      "change_plan_store": "플랜 변경은 App Store 또는 Google Play 구독 설정에서 할 수 있습니다."
    },
    "plans": {
      "base": {
        "name": "Member"
      },
      "plus": {
        "name": "Plus"
      },
      "pro": {
        "name": "Pro"
      }
    }
  }
}
</i18n>
