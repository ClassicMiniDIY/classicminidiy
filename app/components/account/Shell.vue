<template>
  <!-- Routed section nav shared by /dashboard and /settings. It is the
       <AdminShell> nav pattern without the admin chrome: a sticky grouped menu at
       `lg` and up, one dropdown labelled with the current section below `lg`
       (twelve stacked entries would push the content off the first screen).

       The shell holds no auth logic and no strings of its own. The page decides
       which groups a visitor sees (behind its own mount gate) and passes the
       labels already translated. -->
  <div class="flex flex-col gap-6 lg:flex-row lg:gap-8">
    <div class="lg:hidden">
      <div class="dropdown w-full">
        <button
          type="button"
          tabindex="0"
          class="btn btn-outline w-full justify-between"
          :aria-label="navLabel"
          data-testid="account-shell-menu-button"
        >
          <span class="flex min-w-0 items-center gap-2">
            <i :class="[currentEntry?.icon || 'fas fa-bars', 'w-4']" aria-hidden="true"></i>
            <span class="truncate">{{ currentEntry?.label || navLabel }}</span>
          </span>
          <i class="fas fa-chevron-down" aria-hidden="true"></i>
        </button>
        <ul
          tabindex="0"
          class="dropdown-content menu z-10 mt-1 w-full rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
        >
          <template v-for="group in groups" :key="`m-${group.label}`">
            <li class="menu-title text-xs uppercase tracking-wider">{{ group.label }}</li>
            <li v-for="entry in group.entries" :key="`m-${entry.to}`">
              <NuxtLink
                :to="entry.to"
                :class="{ active: isActive(entry) }"
                :aria-current="isActive(entry) ? 'page' : undefined"
                @click="closeMenu"
              >
                <i :class="[entry.icon, 'w-4']" aria-hidden="true"></i>
                {{ entry.label }}
              </NuxtLink>
            </li>
          </template>
        </ul>
      </div>
    </div>

    <aside class="hidden lg:block lg:w-64 lg:flex-shrink-0">
      <nav :aria-label="navLabel" data-testid="account-shell-nav">
        <ul class="menu w-full rounded-box border border-base-300 bg-base-100 shadow-sm lg:sticky lg:top-24">
          <template v-for="group in groups" :key="group.label">
            <li class="menu-title text-xs uppercase tracking-wider">{{ group.label }}</li>
            <li v-for="entry in group.entries" :key="entry.to">
              <NuxtLink
                :to="entry.to"
                :class="{ active: isActive(entry) }"
                :aria-current="isActive(entry) ? 'page' : undefined"
              >
                <i :class="[entry.icon, 'w-4']" aria-hidden="true"></i>
                {{ entry.label }}
              </NuxtLink>
            </li>
          </template>
        </ul>
        <slot name="nav-footer" />
      </nav>
    </aside>

    <div class="min-w-0 flex-1">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
  export interface AccountNavEntry {
    to: string;
    label: string;
    /** Full Font Awesome class list, e.g. `fas fa-key`. */
    icon: string;
    /** Highlight only on an exact path match. */
    exact?: boolean;
  }

  export interface AccountNavGroup {
    label: string;
    entries: AccountNavEntry[];
  }

  const props = defineProps<{
    groups: AccountNavGroup[];
    /** Accessible name for the nav, and the dropdown label when no entry matches. */
    navLabel: string;
  }>();

  const route = useRoute();

  const matches = (entry: AccountNavEntry, path: string) =>
    entry.exact ? path === entry.to : path === entry.to || path.startsWith(`${entry.to}/`);

  /** The deepest entry whose path matches the current route. */
  const currentEntry = computed(() => {
    let best: AccountNavEntry | undefined;
    for (const group of props.groups) {
      for (const entry of group.entries) {
        if (matches(entry, route.path) && (!best || entry.to.length > best.to.length)) best = entry;
      }
    }
    return best;
  });

  const isActive = (entry: AccountNavEntry) => currentEntry.value?.to === entry.to;

  // A daisyUI focus dropdown stays open while focus is inside it, and a client
  // navigation leaves focus on the clicked link. Blur so the menu closes.
  const closeMenu = () => {
    if (import.meta.client && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };
</script>
