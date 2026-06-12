<script setup lang="ts">
  /**
   * Report a model (keystone §11 PR 8 / §8 takedown intake). Authenticated insert
   * into model_reports under RLS (own reporter_id, resolution fields NULL).
   */
  const props = defineProps<{ modelId: string }>();

  const supabase = useSupabase();
  const { isAuthenticated, user } = useAuth();

  const open = ref(false);
  const reason = ref('copyright');
  const details = ref('');
  const submitting = ref(false);
  const done = ref(false);
  const error = ref('');

  const reasons = [
    { value: 'copyright', label: 'Copyright / IP infringement' },
    { value: 'safety', label: 'Safety concern' },
    { value: 'inappropriate', label: 'Inappropriate content' },
    { value: 'spam', label: 'Spam' },
    { value: 'other', label: 'Other' },
  ];

  function openModal() {
    if (!isAuthenticated.value) return navigateTo('/login');
    done.value = false;
    error.value = '';
    details.value = '';
    reason.value = 'copyright';
    open.value = true;
  }

  async function submit() {
    if (!details.value.trim()) {
      error.value = 'Please describe the issue.';
      return;
    }
    if (!user.value) return;
    submitting.value = true;
    error.value = '';
    try {
      const { error: e } = await supabase.from('model_reports').insert({
        model_id: props.modelId,
        reason: reason.value,
        details: details.value.trim().slice(0, 5000),
        reporter_id: user.value.id,
      });
      if (e) throw e;
      done.value = true;
    } catch (e: any) {
      error.value = e?.message || 'Could not submit the report.';
    } finally {
      submitting.value = false;
    }
  }
</script>

<template>
  <button type="button" class="btn btn-ghost btn-xs gap-1 opacity-70" @click="openModal">
    <i class="fas fa-flag"></i> Report
  </button>

  <dialog class="modal" :class="{ 'modal-open': open }">
    <div class="modal-box">
      <h3 class="font-bold text-lg"><i class="fas fa-flag text-warning mr-1"></i> Report this model</h3>

      <div v-if="done" class="py-6 text-center">
        <i class="fas fa-circle-check text-4xl text-success"></i>
        <p class="mt-2">Thanks — our moderators will review this.</p>
        <button class="btn btn-primary btn-sm mt-4" @click="open = false">Close</button>
      </div>

      <div v-else class="py-2 space-y-2">
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Reason</legend>
          <select v-model="reason" class="select w-full">
            <option v-for="r in reasons" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Details</legend>
          <textarea
            v-model="details"
            rows="4"
            maxlength="5000"
            class="textarea w-full"
            placeholder="What's the issue? Include links/evidence for copyright claims."
          ></textarea>
        </fieldset>
        <p v-if="error" class="text-error text-sm">{{ error }}</p>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="open = false">Cancel</button>
          <button type="button" class="btn btn-warning" :disabled="submitting" @click="submit">
            <span v-if="submitting" class="loading loading-spinner loading-sm"></span>
            Submit report
          </button>
        </div>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="open = false"><button>close</button></form>
  </dialog>
</template>
