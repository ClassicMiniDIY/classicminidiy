<template>
  <div v-if="announcement" role="alert" class="announcement-banner" :style="bannerStyle">
    <div class="container flex items-center gap-3">
      <i :class="[iconClass, 'text-base shrink-0']" :style="iconStyle" />
      <div class="flex flex-col gap-0.5">
        <span v-if="announcement.title" class="font-semibold">{{ announcement.title }}</span>
        <span v-if="announcement.description" :class="{ 'text-sm opacity-80': announcement.title }">
          {{ announcement.description }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { SiteAnnouncement } from '~/composables/useAnnouncement';

  const { getActiveAnnouncement } = useAnnouncement();

  // Fetch on server to prevent CLS (Cumulative Layout Shift)
  const { data: announcement } = await useAsyncData<SiteAnnouncement | null>('active-announcement', () =>
    getActiveAnnouncement()
  );

  const announcementType = computed(() => announcement.value?.type || 'info');
  const { bannerStyle, iconStyle } = useAnnouncementStyles(announcementType);

  const iconClass = computed((): string => {
    const iconMap: Record<string, string> = {
      error: 'fas fa-circle-xmark',
      warning: 'fas fa-triangle-exclamation',
      info: 'fas fa-circle-info',
      success: 'fas fa-circle-check',
    };
    return iconMap[announcement.value?.type || 'info'] || 'fas fa-circle-info';
  });
</script>
