<template>
  <AdminExchangeShell>
    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-2">Marketing Email</h1>
      <p class="text-base-content/70">
        Compose one-off CMDIY marketing emails — sent to newsletter subscribers, Shopify, Ghost, and Patreon supporters
      </p>
    </div>

    <!-- Active send progress -->
    <div v-if="activeSend" class="alert mb-6" :class="stalledSend ? 'alert-warning' : 'alert-info'">
      <span v-if="!stalledSend" class="loading loading-spinner loading-sm"></span>
      <i v-else class="fas fa-triangle-exclamation"></i>
      <span>
        <template v-if="stalledSend">
          Send of "{{ activeSend.subject }}" stalled at {{ activeSend.recipient_count }}/{{
            activeSend.total_recipients ?? '?'
          }}
          — resume to deliver the rest (no one gets it twice).
        </template>
        <template v-else>
          Sending "{{ activeSend.subject }}" — {{ activeSend.recipient_count }}/{{ activeSend.total_recipients ?? '?' }}
          delivered
        </template>
      </span>
      <button
        v-if="stalledSend"
        class="btn btn-sm btn-warning"
        :disabled="sending"
        @click="handleResume(activeSend.id)"
      >
        <span v-if="sending" class="loading loading-spinner loading-xs"></span>
        <i v-else class="fas fa-rotate-right"></i>
        Resume send
      </button>
    </div>

    <div class="grid lg:grid-cols-2 gap-6 mb-8 items-start">
      <!-- Composer -->
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex items-center justify-between mb-2">
            <h2 class="card-title">
              <i class="fas fa-pen-to-square text-xl"></i>
              {{ editingId ? 'Edit Draft' : 'New Email' }}
            </h2>
            <button v-if="editingId" class="btn btn-ghost btn-xs" @click="resetForm">
              <i class="fas fa-plus"></i>
              New
            </button>
          </div>

          <fieldset class="fieldset">
            <legend class="fieldset-legend">Subject</legend>
            <input
              v-model="form.subject"
              type="text"
              maxlength="200"
              placeholder="Big news from the garage…"
              class="input input-bordered w-full"
            />
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend">Preheader (optional)</legend>
            <input
              v-model="form.preheader"
              type="text"
              maxlength="200"
              placeholder="Short line shown after the subject in the inbox"
              class="input input-bordered w-full"
            />
          </fieldset>

          <div class="divider my-2">Content blocks</div>

          <draggable v-model="form.blocks" item-key="key" handle=".drag-handle" class="flex flex-col gap-3">
            <template #item="{ element: block, index }">
              <div class="border border-base-300 rounded-lg p-3 bg-base-200/40">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2 text-sm font-semibold text-base-content/70">
                    <i class="fas fa-grip-vertical drag-handle cursor-grab text-base-content/40"></i>
                    <i :class="blockIcon(block.type)"></i>
                    {{ blockLabel(block.type) }}
                  </div>
                  <button class="btn btn-ghost btn-xs text-error" @click="removeBlock(index)">
                    <i class="fas fa-xmark"></i>
                  </button>
                </div>

                <template v-if="block.type === 'heading'">
                  <input
                    v-model="block.text"
                    type="text"
                    maxlength="200"
                    placeholder="Section heading"
                    class="input input-bordered input-sm w-full"
                  />
                </template>

                <template v-else-if="block.type === 'text'">
                  <textarea
                    v-model="block.markdown"
                    rows="4"
                    maxlength="5000"
                    placeholder="Write your message…"
                    class="textarea textarea-bordered w-full text-sm"
                  ></textarea>
                  <p class="text-xs text-base-content/50 mt-1">
                    **bold** &nbsp; *italic* &nbsp; [link text](https://…) &nbsp; blank line = new paragraph
                  </p>
                </template>

                <template v-else-if="block.type === 'image'">
                  <div v-if="block.url" class="mb-2">
                    <img :src="block.url" alt="" class="max-h-40 rounded-lg border border-base-300 mx-auto" />
                  </div>
                  <div class="flex flex-col gap-2">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                      class="file-input file-input-bordered file-input-sm w-full"
                      :disabled="uploadingIndex === index"
                      @change="(e) => handleImageUpload(e, index)"
                    />
                    <div v-if="uploadingIndex === index" class="flex items-center gap-2 text-sm text-base-content/60">
                      <span class="loading loading-spinner loading-xs"></span>
                      Optimizing & uploading…
                    </div>
                    <input
                      v-model="block.alt"
                      type="text"
                      maxlength="200"
                      placeholder="Alt text (accessibility)"
                      class="input input-bordered input-sm w-full"
                    />
                    <input
                      v-model="block.href"
                      type="url"
                      placeholder="Optional link when clicked (https://…)"
                      class="input input-bordered input-sm w-full"
                    />
                  </div>
                </template>

                <template v-else-if="block.type === 'button'">
                  <div class="flex flex-col sm:flex-row gap-2">
                    <input
                      v-model="block.label"
                      type="text"
                      maxlength="80"
                      placeholder="Button label"
                      class="input input-bordered input-sm w-full sm:w-1/3"
                    />
                    <input
                      v-model="block.href"
                      type="url"
                      placeholder="https://classicminidiy.com/…"
                      class="input input-bordered input-sm w-full sm:flex-1"
                    />
                  </div>
                </template>

                <template v-else>
                  <div class="border-t border-base-300 my-2"></div>
                </template>
              </div>
            </template>
          </draggable>

          <div class="flex flex-wrap gap-2 mt-3">
            <button class="btn btn-outline btn-xs" @click="addBlock('heading')">
              <i class="fas fa-heading"></i> Heading
            </button>
            <button class="btn btn-outline btn-xs" @click="addBlock('text')">
              <i class="fas fa-align-left"></i> Text
            </button>
            <button class="btn btn-outline btn-xs" @click="addBlock('image')">
              <i class="fas fa-image"></i> Image
            </button>
            <button class="btn btn-outline btn-xs" @click="addBlock('button')">
              <i class="fas fa-arrow-pointer"></i> Button
            </button>
            <button class="btn btn-outline btn-xs" @click="addBlock('divider')">
              <i class="fas fa-minus"></i> Divider
            </button>
          </div>

          <div class="divider my-2"></div>

          <div class="flex flex-wrap gap-2 justify-end">
            <button class="btn btn-outline btn-sm" :disabled="!formValid || saving" @click="handleSaveDraft">
              <span v-if="saving" class="loading loading-spinner loading-xs"></span>
              <i v-else class="fas fa-floppy-disk"></i>
              Save Draft
            </button>
            <button class="btn btn-outline btn-sm" :disabled="!formValid || testSending" @click="openTestModal">
              <i class="fas fa-paper-plane"></i>
              Send Test
            </button>
            <button
              class="btn btn-primary btn-sm"
              :disabled="!formValid || sending || !!activeSend"
              @click="openSendModal"
            >
              <i class="fas fa-envelope"></i>
              Send…
            </button>
          </div>
        </div>
      </div>

      <!-- Preview + audience -->
      <div class="flex flex-col gap-6">
        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <h2 class="card-title mb-2">
              <i class="fas fa-eye text-xl"></i>
              Preview
              <span v-if="previewLoading" class="loading loading-spinner loading-xs"></span>
            </h2>
            <div v-if="previewHtml">
              <iframe
                ref="emailPreviewFrame"
                :srcdoc="previewHtml"
                class="w-full border border-base-300 rounded-lg"
                style="min-height: 500px"
                sandbox="allow-same-origin"
                @load="resizeIframe"
              ></iframe>
            </div>
            <div v-else class="text-center py-12 text-base-content/50">
              <i class="fas fa-envelope-open text-4xl mb-2 opacity-50"></i>
              <p>Add a subject and at least one block to preview</p>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <div class="flex items-center justify-between mb-2">
              <h2 class="card-title">
                <i class="fas fa-users text-xl"></i>
                Audience
              </h2>
              <button class="btn btn-ghost btn-sm" :disabled="audienceLoading" @click="fetchAudience">
                <span v-if="audienceLoading" class="loading loading-spinner loading-xs"></span>
                <i v-else class="fas fa-arrows-rotate"></i>
                Refresh
              </button>
            </div>
            <p class="text-xs text-base-content/50 mb-3">
              Live union of all marketing lists — takes ~30&ndash;60s to resolve
            </p>
            <div v-if="audience" class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div class="stat bg-base-200/50 rounded-lg p-3">
                <div class="text-xs text-base-content/60">Site opt-ins</div>
                <div class="text-xl font-bold">{{ audience.profile }}</div>
              </div>
              <div class="stat bg-base-200/50 rounded-lg p-3">
                <div class="text-xs text-base-content/60">Shopify</div>
                <div class="text-xl font-bold">{{ audience.shopify }}</div>
              </div>
              <div class="stat bg-base-200/50 rounded-lg p-3">
                <div class="text-xs text-base-content/60">Ghost</div>
                <div class="text-xl font-bold">{{ audience.ghost }}</div>
              </div>
              <div class="stat bg-base-200/50 rounded-lg p-3">
                <div class="text-xs text-base-content/60">Patreon</div>
                <div class="text-xl font-bold">{{ audience.patreon }}</div>
              </div>
              <div class="stat bg-base-200/50 rounded-lg p-3">
                <div class="text-xs text-base-content/60">Suppressed</div>
                <div class="text-xl font-bold text-error">-{{ audience.suppressed }}</div>
              </div>
              <div class="stat bg-primary/10 rounded-lg p-3">
                <div class="text-xs text-base-content/60">Total</div>
                <div class="text-xl font-bold text-primary">{{ audience.total }}</div>
              </div>
            </div>
            <div v-else class="text-center py-6 text-base-content/50 text-sm">
              <p>Refresh to resolve the current audience</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Drafts -->
    <div class="card bg-base-100 shadow mb-8">
      <div class="card-body">
        <h2 class="card-title mb-4">
          <i class="fas fa-file-lines text-xl"></i>
          Drafts
        </h2>
        <div v-if="emailsLoading" class="flex justify-center py-6">
          <span class="loading loading-spinner loading-md"></span>
        </div>
        <div v-else-if="drafts.length === 0" class="text-center py-6 text-base-content/50">
          <p>No drafts yet</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Blocks</th>
                <th>Updated</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="draft in drafts" :key="draft.id">
                <td class="font-medium">{{ draft.subject || '(untitled)' }}</td>
                <td>{{ draft.blocks?.length || 0 }}</td>
                <td>{{ formatDateTime(draft.updated_at) }}</td>
                <td class="text-right">
                  <button class="btn btn-ghost btn-xs" @click="loadDraft(draft)">
                    <i class="fas fa-pen"></i>
                    Edit
                  </button>
                  <button class="btn btn-ghost btn-xs text-error" @click="handleDeleteDraft(draft.id)">
                    <i class="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Send history -->
    <div class="card bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title mb-4">
          <i class="fas fa-clock text-xl"></i>
          Send History
        </h2>
        <div v-if="emailsLoading" class="flex justify-center py-6">
          <span class="loading loading-spinner loading-md"></span>
        </div>
        <div v-else-if="history.length === 0" class="text-center py-6 text-base-content/50">
          <p>No marketing emails have been sent yet</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Sent</th>
                <th>Subject</th>
                <th>Delivered</th>
                <th>Audience</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="record in history" :key="record.id">
                <td>{{ formatDateTime(record.sent_at || record.updated_at) }}</td>
                <td class="font-medium">{{ record.subject }}</td>
                <td>
                  {{ record.recipient_count
                  }}<span v-if="record.total_recipients"> / {{ record.total_recipients }}</span>
                </td>
                <td class="text-xs text-base-content/60">
                  <template v-if="record.audience_counts">
                    {{ record.audience_counts.profile }} site &bull; {{ record.audience_counts.shopify }} shopify &bull;
                    {{ record.audience_counts.ghost }} ghost &bull; {{ record.audience_counts.patreon }} patreon
                  </template>
                  <template v-else>—</template>
                </td>
                <td>
                  <span :class="statusBadgeClass(record.status)">{{ record.status }}</span>
                  <div v-if="record.error_message" class="text-xs text-error mt-0.5">{{ record.error_message }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Test modal -->
    <dialog ref="testModal" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Send Test Email</h3>
        <p class="text-base-content/70 mb-4">
          Sends the current composition with a <span class="badge badge-sm">[TEST]</span> subject prefix and a real
          unsubscribe link.
        </p>
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Email Address</legend>
          <input v-model="testEmail" type="email" placeholder="your@email.com" class="input input-bordered w-full" />
          <p class="text-xs text-base-content/50 mt-1">Leave blank to send to your account email</p>
        </fieldset>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="testModal?.close()">Cancel</button>
          <button class="btn btn-primary" :disabled="testSending" @click="handleSendTest">
            <span v-if="testSending" class="loading loading-spinner loading-sm"></span>
            <i v-else class="fas fa-paper-plane"></i>
            Send Test
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>

    <!-- Send confirmation modal -->
    <dialog ref="sendModal" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Send Marketing Email</h3>
        <div class="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-4">
          <p class="text-sm">
            <i class="fas fa-triangle-exclamation inline mr-1 text-warning"></i>
            "<strong>{{ form.subject }}</strong
            >" will be sent to <strong>{{ audience?.total ?? '?' }}</strong> recipients.
          </p>
          <p v-if="audience" class="text-xs text-base-content/50 mt-1 ml-6">
            {{ audience.profile }} site + {{ audience.shopify }} Shopify + {{ audience.ghost }} Ghost +
            {{ audience.patreon }} Patreon ({{ audience.suppressed }} suppressed)
          </p>
        </div>
        <div v-if="!audience" class="bg-info/10 border border-info/30 rounded-lg p-4 mb-4">
          <p class="text-sm">
            <i class="fas fa-circle-info inline mr-1 text-info"></i>
            Refresh the audience first so you know how many people this reaches.
          </p>
        </div>
        <p class="text-base-content/70 mb-4 text-sm">
          The draft is saved first, then the send runs server-side with live progress above. This cannot be undone.
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="sendModal?.close()">Cancel</button>
          <button class="btn btn-primary" :disabled="sending || !audience" @click="handleSend">
            <span v-if="sending" class="loading loading-spinner loading-sm"></span>
            <i v-else class="fas fa-envelope"></i>
            Send to {{ audience?.total ?? '?' }} recipients
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>
  </AdminExchangeShell>
</template>

<script setup lang="ts">
  import draggable from 'vuedraggable';
  import type { MarketingBlock, MarketingEmailRecord } from '~/composables/useMarketingEmail';

  definePageMeta({ layout: 'admin' });
  useHead({ title: 'Marketing Email - Admin - Classic Mini DIY' });
  useSeoMeta({ robots: 'noindex, nofollow' });

  const toast = useToast();
  const { capture } = usePostHog();
  const {
    emailsLoading,
    drafts,
    history,
    activeSend,
    previewHtml,
    previewLoading,
    audience,
    audienceLoading,
    saving,
    sending,
    testSending,
    fetchEmails,
    createDraft,
    updateDraft,
    deleteDraft,
    fetchPreview,
    fetchAudience,
    sendTest,
    sendMarketingEmail,
    pollWhileSending,
    isStalled,
  } = useMarketingEmail();

  // Stalled-send detection re-evaluates on a slow tick (isStalled compares
  // the lease against wall-clock time, which isn't reactive by itself).
  const stalledTick = ref(0);
  let stalledTimer: ReturnType<typeof setInterval> | null = null;
  const stalledSend = computed(() => {
    void stalledTick.value;
    return isStalled(activeSend.value) ? activeSend.value : null;
  });

  const handleResume = async (id: string) => {
    await sendMarketingEmail(id, { resume: true });
  };

  // Editor state. Blocks carry a local `key` for draggable identity — stripped
  // before anything is sent to the server.
  type EditorBlock = MarketingBlock & { key: string };
  const form = ref<{ subject: string; preheader: string; blocks: EditorBlock[] }>({
    subject: '',
    preheader: '',
    blocks: [],
  });
  const editingId = ref<string | null>(null);
  const uploadingIndex = ref<number | null>(null);
  const testEmail = ref('');
  const testModal = ref<HTMLDialogElement | null>(null);
  const sendModal = ref<HTMLDialogElement | null>(null);
  const emailPreviewFrame = ref<HTMLIFrameElement | null>(null);

  let keyCounter = 0;
  const nextKey = () => `blk-${++keyCounter}`;

  const blockLabel = (type: MarketingBlock['type']) =>
    ({ heading: 'Heading', text: 'Text', image: 'Image', button: 'Button', divider: 'Divider' })[type];
  const blockIcon = (type: MarketingBlock['type']) =>
    ({
      heading: 'fas fa-heading',
      text: 'fas fa-align-left',
      image: 'fas fa-image',
      button: 'fas fa-arrow-pointer',
      divider: 'fas fa-minus',
    })[type];

  const addBlock = (type: MarketingBlock['type']) => {
    const key = nextKey();
    const block: EditorBlock =
      type === 'heading'
        ? { type, text: '', key }
        : type === 'text'
          ? { type, markdown: '', key }
          : type === 'image'
            ? { type, url: '', alt: '', href: '', key }
            : type === 'button'
              ? { type, href: '', label: '', key }
              : { type: 'divider', key };
    form.value.blocks.push(block);
  };

  const removeBlock = (index: number) => {
    form.value.blocks.splice(index, 1);
  };

  /** Strip editor keys + empty optionals into the API payload shape. */
  const toPayload = () => ({
    subject: form.value.subject.trim(),
    preheader: form.value.preheader.trim() || undefined,
    blocks: form.value.blocks.map(({ key: _key, ...block }) => {
      if (block.type === 'image') {
        return { type: 'image', url: block.url, alt: block.alt || undefined, href: block.href || undefined };
      }
      return block;
    }) as MarketingBlock[],
  });

  const formValid = computed(() => {
    if (!form.value.subject.trim() || form.value.blocks.length === 0) return false;
    return form.value.blocks.every((b) => {
      if (b.type === 'heading') return !!b.text.trim();
      if (b.type === 'text') return !!b.markdown.trim();
      if (b.type === 'image') return !!b.url;
      if (b.type === 'button') return !!b.label.trim() && /^https?:\/\//.test(b.href);
      return true;
    });
  });

  const resetForm = () => {
    form.value = { subject: '', preheader: '', blocks: [] };
    editingId.value = null;
    previewHtml.value = '';
  };

  const loadDraft = (draft: MarketingEmailRecord) => {
    editingId.value = draft.id;
    form.value = {
      subject: draft.subject,
      preheader: draft.preheader || '',
      blocks: (draft.blocks || []).map((b) => ({ ...b, key: nextKey() }) as EditorBlock),
    };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Debounced live preview — server-rendered so what you see is exactly what
  // ships (same renderer as the send path).
  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  watch(
    form,
    () => {
      if (previewTimer) clearTimeout(previewTimer);
      previewTimer = setTimeout(() => {
        previewTimer = null;
        if (formValid.value) {
          fetchPreview(toPayload());
        } else {
          // Don't leave a stale preview up when the draft is no longer renderable.
          previewHtml.value = '';
        }
      }, 600);
    },
    { deep: true }
  );
  onBeforeUnmount(() => {
    if (previewTimer) clearTimeout(previewTimer);
  });

  const resizeIframe = () => {
    const iframe = emailPreviewFrame.value;
    if (iframe?.contentDocument?.body) {
      iframe.style.height = iframe.contentDocument.body.scrollHeight + 32 + 'px';
    }
  };

  const handleImageUpload = async (event: Event, index: number) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    uploadingIndex.value = index;
    try {
      // Client-side optimize (HEIC convert + resize to email-friendly width)
      // before the admin upload route's magic-byte check.
      const { file: optimized } = await optimizeImage(file, { maxWidthOrHeight: 1200, maxSizeMB: 1 });
      const fd = new FormData();
      fd.append('file', optimized, optimized.name);
      const result = await $adminFetch<{ url: string }>('/api/admin/marketing/upload-image', {
        method: 'POST',
        body: fd,
      });
      const block = form.value.blocks[index];
      if (block?.type === 'image') block.url = result.url;
    } catch (error: any) {
      toast.add({ title: 'Upload failed', description: error?.data?.message || error?.message, color: 'error' });
    } finally {
      uploadingIndex.value = null;
      input.value = '';
    }
  };

  const handleSaveDraft = async (): Promise<string | null> => {
    const payload = toPayload();
    if (editingId.value) {
      const row = await updateDraft(editingId.value, payload);
      return row ? row.id : null;
    }
    const row = await createDraft(payload);
    if (row) editingId.value = row.id;
    return row ? row.id : null;
  };

  const handleDeleteDraft = async (id: string) => {
    if (!confirm('Delete this draft?')) return;
    const ok = await deleteDraft(id);
    if (ok && editingId.value === id) resetForm();
  };

  const openTestModal = () => {
    testEmail.value = '';
    testModal.value?.showModal();
  };

  const handleSendTest = async () => {
    const ok = await sendTest(toPayload(), testEmail.value || undefined);
    if (ok) testModal.value?.close();
  };

  const openSendModal = () => {
    sendModal.value?.showModal();
  };

  const handleSend = async () => {
    // Persist the latest edits first — the edge fn sends what the ROW contains.
    const id = await handleSaveDraft();
    if (!id) return;
    sendModal.value?.close();
    const ok = await sendMarketingEmail(id);
    if (ok) {
      capture('admin_marketing_email_sent', {
        subject_length: form.value.subject.length,
        block_count: form.value.blocks.length,
        audience_total: audience.value?.total ?? null,
      });
      resetForm();
    }
  };

  const statusBadgeClass = (status: string): string => {
    switch (status) {
      case 'sending':
        return 'badge badge-info';
      case 'sent':
        return 'badge badge-success';
      case 'partial':
        return 'badge badge-warning';
      case 'failed':
        return 'badge badge-error';
      default:
        return 'badge';
    }
  };

  onMounted(async () => {
    // Allowlist guard: a non-allowlisted admin can reach this route (the
    // global middleware only checks is_admin) but every action would 403 —
    // bounce them back to the dashboard instead of showing a dead page.
    const { check: checkMarketingAccess } = useMarketingAccess();
    if (!(await checkMarketingAccess())) {
      toast.add({ title: 'Not available', description: 'Marketing email access is restricted', color: 'warning' });
      return navigateTo('/admin');
    }
    await fetchEmails();
    // Resume progress polling if a send is mid-flight (e.g. page reload).
    if (activeSend.value) pollWhileSending(activeSend.value.id);
    stalledTimer = setInterval(() => stalledTick.value++, 30_000);
  });

  onBeforeUnmount(() => {
    if (stalledTimer) clearInterval(stalledTimer);
  });
</script>
