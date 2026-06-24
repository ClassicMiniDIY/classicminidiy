<template>
  <div>
    <!-- Page Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-2">Site Announcement</h1>
      <p class="text-base-content/70">Configure the announcement banner displayed on the home page</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="skeleton h-96 w-full rounded-lg"></div>

    <!-- Announcement Form -->
    <div v-else class="card bg-base-100 shadow-sm">
      <div class="card-body">
        <!-- Enable Toggle -->
        <fieldset class="fieldset">
          <label class="fieldset-legend">Banner Status</label>
          <label class="label cursor-pointer justify-start gap-4">
            <input type="checkbox" v-model="form.is_enabled" class="toggle toggle-primary" />
            <span>{{ form.is_enabled ? 'Enabled - Banner is visible' : 'Disabled - Banner is hidden' }}</span>
          </label>
        </fieldset>

        <!-- Type Selector -->
        <fieldset class="fieldset">
          <label class="fieldset-legend">Banner Type</label>
          <select v-model="form.type" class="select select-bordered w-full">
            <option value="info">Info (Blue)</option>
            <option value="success">Success (Green)</option>
            <option value="warning">Warning (Yellow)</option>
            <option value="error">Error (Red)</option>
          </select>
        </fieldset>

        <!-- Title (Optional) -->
        <fieldset class="fieldset">
          <label class="fieldset-legend">Title (Optional)</label>
          <input
            v-model="form.title"
            type="text"
            class="input input-bordered w-full"
            placeholder="e.g., Scheduled Maintenance"
            maxlength="100"
          />
          <p class="text-xs text-base-content/60 mt-1">Leave blank to show only description</p>
        </fieldset>

        <!-- Description (Optional) -->
        <fieldset class="fieldset">
          <label class="fieldset-legend">Description (Optional)</label>
          <textarea
            v-model="form.description"
            class="textarea textarea-bordered w-full"
            rows="3"
            placeholder="e.g., The site will be down for maintenance on Saturday from 2-4 PM EST."
            maxlength="500"
          ></textarea>
          <p class="text-xs text-base-content/60 mt-1">Leave blank to show only title</p>
        </fieldset>

        <!-- Preview -->
        <div v-if="form.title || form.description" class="mt-6">
          <label class="text-sm font-medium mb-2 block">Preview</label>
          <div class="announcement-banner rounded-lg" :style="previewBannerStyle">
            <div class="flex items-center gap-3">
              <i :class="[previewIconClass, 'shrink-0']" :style="previewIconStyle"></i>
              <div class="flex flex-col gap-0.5">
                <span v-if="form.title" class="font-semibold">{{ form.title }}</span>
                <span v-if="form.description" :class="{ 'text-sm opacity-80': form.title }">
                  {{ form.description }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Validation Warning -->
        <div v-if="form.is_enabled && !form.title && !form.description" class="alert alert-warning mt-4">
          <i class="fas fa-triangle-exclamation"></i>
          <span>Add a title or description to display the banner</span>
        </div>

        <!-- Actions -->
        <div class="card-actions justify-end mt-6">
          <button class="btn btn-primary" :disabled="saving" @click="saveAnnouncement">
            <i v-if="saving" class="fas fa-arrows-rotate animate-spin"></i>
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>

        <!-- Last Updated -->
        <div v-if="lastUpdated" class="text-xs text-base-content/50 mt-4">
          Last updated: {{ formatDateTime(lastUpdated) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  definePageMeta({
    layout: 'admin',
  });

  useHead({
    title: 'Site Announcement - Admin - The Mini Exchange',
  });

  const { getAnnouncement, updateAnnouncement } = useAnnouncement();
  const toast = useToast();
  const { capture: captureRaw } = usePostHog();

  const loading = ref(true);
  const saving = ref(false);
  const lastUpdated = ref<string | null>(null);

  const form = ref({
    title: '',
    description: '',
    type: 'info' as 'error' | 'warning' | 'info' | 'success',
    is_enabled: false,
  });

  const formType = computed(() => form.value.type);
  const { bannerStyle: previewBannerStyle, iconStyle: previewIconStyle } = useAnnouncementStyles(formType);

  const previewIconClass = computed((): string => {
    const iconMap: Record<string, string> = {
      error: 'fas fa-circle-xmark',
      warning: 'fas fa-triangle-exclamation',
      info: 'fas fa-circle-info',
      success: 'fas fa-circle-check',
    };
    return iconMap[form.value.type] || 'fas fa-circle-info';
  });

  const loadAnnouncement = async () => {
    try {
      const data = await getAnnouncement();
      if (data) {
        form.value = {
          title: data.title || '',
          description: data.description || '',
          type: data.type,
          is_enabled: data.is_enabled,
        };
        lastUpdated.value = data.updated_at;
      }
    } catch (error: any) {
      console.error('Failed to load announcement:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to load announcement settings',
        color: 'error',
      });
    } finally {
      loading.value = false;
    }
  };

  const saveAnnouncement = async () => {
    saving.value = true;

    try {
      // updateAnnouncement returns the updated record, no need for second fetch
      const updatedAnnouncement = await updateAnnouncement({
        title: form.value.title || null,
        description: form.value.description || null,
        type: form.value.type,
        is_enabled: form.value.is_enabled,
      });

      // Use returned data directly
      if (updatedAnnouncement) {
        lastUpdated.value = updatedAnnouncement.updated_at;
      }

      toast.add({
        title: 'Success',
        description: 'Announcement settings saved',
        color: 'success',
      });

      captureRaw('admin_announcement_updated', {
        type: form.value.type,
        is_enabled: form.value.is_enabled,
        has_title: !!form.value.title,
        has_description: !!form.value.description,
      });
    } catch (error: any) {
      console.error('Failed to save announcement:', error);
      toast.add({
        title: 'Error',
        description: error.message || 'Failed to save announcement',
        color: 'error',
      });
    } finally {
      saving.value = false;
    }
  };

  onMounted(() => {
    loadAnnouncement();
  });
</script>
