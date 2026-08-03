<script lang="ts" setup>
  /**
   * Row 2 — the contextual section bar (design S4 / S6 / M5).
   *
   * Only on section LANDING pages, never on detail pages (those get breadcrumbs
   * instead). Olive-tinted, 48px, with an all-caps section label, the section's
   * links, and its one primary action pinned right.
   *
   * The action is desktop-only here on purpose: on mobile the design moves it to
   * a full-width CTA in the page body (M5 puts "Request a Tool" in the list
   * footer, M7 makes Contribute a 46px block button), so pages render that
   * themselves rather than squeezing it into a scrolling chip row.
   */
  interface SubnavLink {
    key: string;
    label: string;
    to: string;
  }

  const props = defineProps<{
    /** All-caps section label, e.g. ARCHIVE. */
    label: string;
    links: readonly SubnavLink[];
    /** Which link reads as current. Falls back to route-prefix matching. */
    activeKey?: string;
    actionLabel?: string;
    /** FontAwesome 6 class form. */
    actionIcon?: string;
    /** Omit to emit `action` instead of navigating (e.g. to open the wizard). */
    actionTo?: string;
  }>();

  const emit = defineEmits<{ action: [] }>();

  const route = useRoute();

  const isCurrent = (link: SubnavLink) => {
    if (props.activeKey) return props.activeKey === link.key;
    const path = link.to.split('?')[0] ?? link.to;
    return route.path === path || route.path.startsWith(path + '/');
  };

  const scroller = ref<HTMLElement | null>(null);

  /**
   * Bring the current section into view on a narrow screen.
   *
   * The bar scrolls horizontally once there are more sections than fit, so a
   * visitor on the last one (Weights) would otherwise see the bar starting at
   * Registry with no visible sign of where they are — which is the whole reason
   * the active state exists.
   */
  onMounted(() => {
    const current = scroller.value?.querySelector<HTMLElement>('.subnav-link.is-current');
    if (!current || !scroller.value) return;
    if (scroller.value.scrollWidth <= scroller.value.clientWidth) return;

    // Not scrollIntoView(): that also scrolls the PAGE, yanking the visitor past
    // the hero on load.
    scroller.value.scrollLeft = Math.max(
      0,
      current.offsetLeft - scroller.value.clientWidth / 2 + current.offsetWidth / 2
    );
  });
</script>

<template>
  <div class="section-subnav border-b border-base-300">
    <div ref="scroller" class="mx-auto flex h-12 max-w-[1400px] items-center gap-1 overflow-x-auto px-4 lg:px-6">
      <span class="mr-3 shrink-0 text-xs font-bold uppercase tracking-[0.08em] text-accent">{{ label }}</span>

      <NuxtLink
        v-for="link in links"
        :key="link.key"
        :to="link.to"
        class="subnav-link"
        :class="{ 'is-current': isCurrent(link) }"
      >
        {{ link.label }}
      </NuxtLink>

      <div class="flex-1"></div>

      <NuxtLink
        v-if="actionLabel && actionTo"
        :to="actionTo"
        class="btn btn-secondary btn-sm hidden shrink-0 sm:inline-flex"
      >
        <i v-if="actionIcon" :class="actionIcon" aria-hidden="true"></i>
        {{ actionLabel }}
      </NuxtLink>
      <button
        v-else-if="actionLabel"
        type="button"
        class="btn btn-secondary btn-sm hidden shrink-0 sm:inline-flex"
        @click="emit('action')"
      >
        <i v-if="actionIcon" :class="actionIcon" aria-hidden="true"></i>
        {{ actionLabel }}
      </button>
    </div>
  </div>
</template>

<style scoped>
  .section-subnav {
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  }

  .subnav-link {
    display: inline-flex;
    align-items: center;
    height: 32px;
    flex: none;
    padding: 0 0.75rem;
    border-radius: var(--radius-field, 0.5rem);
    font-size: 14px;
    font-weight: 600;
    color: var(--color-base-content);
    white-space: nowrap;
    text-decoration: none;
  }
  .subnav-link:hover {
    background: color-mix(in srgb, var(--color-base-100) 60%, transparent);
  }
  .subnav-link.is-current {
    background: var(--color-base-100);
    color: var(--color-accent);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
  }
</style>
