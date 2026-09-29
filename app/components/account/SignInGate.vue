<template>
  <!-- Resolving the session. The server renders this branch too (auth is only
       knowable after mount), so SSR and the first client render agree and
       hydration has nothing to repair. -->
  <div v-if="required && !authReady" class="card border border-base-300 bg-base-100 shadow-sm">
    <div class="card-body items-center py-12 text-center">
      <i class="fas fa-spinner fa-spin text-3xl text-primary" aria-hidden="true"></i>
    </div>
  </div>

  <div
    v-else-if="required && !isSignedIn"
    class="card mx-auto max-w-lg border border-base-300 bg-base-100 shadow-sm"
    data-testid="account-sign-in-gate"
  >
    <div class="card-body p-6 text-center">
      <div class="mb-4">
        <i class="fas fa-lock text-5xl opacity-40" aria-hidden="true"></i>
      </div>
      <h2 class="mb-2 text-xl font-bold">{{ title }}</h2>
      <p class="mb-6 text-base opacity-70">{{ description }}</p>
      <NuxtLink :to="loginHref" class="btn btn-primary btn-block">
        {{ buttonLabel }}
      </NuxtLink>
    </div>
  </div>

  <slot v-else />
</template>

<script setup lang="ts">
  /**
   * Three-state account gate shared by /dashboard and /settings: a spinner while
   * the session resolves, a sign-in card when there is none, otherwise the slot.
   * Three states rather than two, so a signed-in user never flashes the sign-in
   * card. Auth state comes from `useMountedAuth()`, which folds in a mount
   * check; see the hydration rule in CLAUDE.md.
   *
   * `required: false` renders the slot for everyone (a public /settings section).
   */
  withDefaults(
    defineProps<{
      title: string;
      description: string;
      buttonLabel: string;
      required?: boolean;
    }>(),
    { required: true }
  );

  const route = useRoute();
  const { authReady, isSignedIn } = useMountedAuth();

  // Back to where the visitor was after sign-in (login sanitizes the value).
  const loginHref = computed(() => `/login?redirect=${encodeURIComponent(route.fullPath)}`);
</script>
