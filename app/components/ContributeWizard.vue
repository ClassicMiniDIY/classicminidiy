<script lang="ts" setup>
  /**
   * The one contribute wizard (design S8 / M9).
   *
   * Mounted once in app.vue and driven entirely by `useContributeWizard()`, so
   * every entry point — the Archive subnav, a Most Wanted "I have this", a wheel
   * card's "add yours", a tool page's "suggest a correction", omnisearch's
   * "Request it" — lands in the same three steps with the type already chosen.
   *
   * Colour contributions still live at /contribute/color: the design specifies
   * exactly four tiles, and colours have a swatch-vs-photo split that does not
   * fit the shared step 2. The archive colours page links there directly.
   */
  import type { ContributionKind } from '../composables/useContributeWizard';

  const { t } = useI18n();
  const { isOpen, context, closeWizard } = useContributeWizard();
  const { isAuthenticated } = useAuth();
  const { submitContribution } = useSubmissions();
  const { requestItem } = useArchiveRequests();
  const toast = useToast();
  const route = useRoute();
  const { track } = useAnalytics();

  const TILES: { kind: ContributionKind; icon: string }[] = [
    { kind: 'document', icon: 'fas fa-file-lines' },
    { kind: 'registry', icon: 'fas fa-clipboard-list' },
    { kind: 'wheel', icon: 'fas fa-ring' },
    { kind: 'fix', icon: 'fas fa-wrench' },
  ];

  const step = ref(1);
  const kind = ref<ContributionKind>('document');
  const submitting = ref(false);
  const files = ref<File[]>([]);

  /** Free-form per-type fields; validated per kind in `errors`. */
  const form = reactive<Record<string, string>>({
    title: '',
    docType: 'manual',
    author: '',
    year: '',
    description: '',
    model: '',
    trim: '',
    bodyType: 'Saloon',
    engineSize: '998',
    bodyNumber: '',
    engineNumber: '',
    color: '',
    location: '',
    name: '',
    size: '',
    width: '',
    offset: '',
    manufacturer: '',
    notes: '',
    fixArea: 'document',
    reason: '',
  });

  const requestTitle = ref('');
  const requestNotes = ref('');

  const isRequestMode = computed(() => context.value.mode === 'request');
  /** A gap-filler attaches photos to an entry that already exists. */
  const isGapFill = computed(() => Boolean(context.value.targetId && kind.value !== 'fix'));

  const totalSteps = 3;

  /**
   * Registry option lists, carried over verbatim from the inline
   * RegistrySubmission form this wizard replaces. Both are closed sets in the
   * archive — a free-text body type or displacement would fragment the registry
   * table, which groups on them.
   */
  const BODY_TYPES = ['Saloon', 'Pickup', 'Estate', 'Cabriolet', 'Clubman', 'Van', 'Hornet'] as const;
  const ENGINE_SIZES = ['850', '997', '998', '1100', '1275'] as const;

  /** Fields whose empty value is not '' — reset has to restore the default, not blank it. */
  const FIELD_DEFAULTS: Record<string, string> = {
    docType: 'manual',
    fixArea: 'document',
    bodyType: 'Saloon',
    engineSize: '998',
  };

  const resetForm = () => {
    step.value = 1;
    files.value = [];
    Object.keys(form).forEach((key) => {
      form[key] = FIELD_DEFAULTS[key] ?? '';
    });
  };

  watch(isOpen, (open) => {
    if (typeof document !== 'undefined') document.body.style.overflow = open ? 'hidden' : '';
    if (!open) return;

    resetForm();
    const ctx = context.value;
    requestTitle.value = ctx.requestTitle ?? '';
    requestNotes.value = '';

    if (ctx.kind) {
      kind.value = ctx.kind;
      // Type already chosen by the launch context — skip straight to details.
      if (!isRequestMode.value) step.value = 2;
    } else {
      kind.value = 'document';
    }

    if (ctx.targetTitle) {
      form.title = ctx.targetTitle;
      form.name = ctx.targetTitle;
    }
    if (ctx.targetType) form.fixArea = ctx.targetType;
  });

  onBeforeUnmount(() => {
    if (typeof document !== 'undefined') document.body.style.overflow = '';
  });

  const errors = computed<string[]>(() => {
    const problems: string[] = [];
    if (isRequestMode.value) {
      if (requestTitle.value.trim().length < 3) problems.push(t('errors.request_title'));
      return problems;
    }

    if (kind.value === 'document') {
      if (!form.title.trim()) problems.push(t('errors.title'));
      if (files.value.length === 0) problems.push(t('errors.file'));
    } else if (kind.value === 'registry') {
      if (!/^\d{4}$/.test(form.year.trim())) problems.push(t('errors.year'));
      if (!form.model.trim()) problems.push(t('errors.model'));
    } else if (kind.value === 'wheel') {
      if (isGapFill.value) {
        if (files.value.length === 0) problems.push(t('errors.photo'));
      } else {
        if (!form.name.trim()) problems.push(t('errors.name'));
        if (!form.size.trim()) problems.push(t('errors.size'));
        if (files.value.length === 0) problems.push(t('errors.photo'));
      }
    } else if (kind.value === 'fix') {
      if (form.reason.trim().length < 10) problems.push(t('errors.reason'));
    }
    return problems;
  });

  const canContinue = computed(() => (step.value === 1 ? true : errors.value.length === 0));

  const goNext = () => {
    if (step.value < totalSteps && canContinue.value) step.value += 1;
  };
  const goBack = () => {
    if (step.value > 1) step.value -= 1;
  };

  /** Maps the wizard's four tiles onto submission_queue target types. */
  const targetTypeForKind = (): 'document' | 'registry' | 'wheel' | 'color' => {
    if (kind.value === 'wheel') return 'wheel';
    if (kind.value === 'registry') return 'registry';
    if (kind.value === 'fix') return (form.fixArea as any) || 'document';
    return 'document';
  };

  const bucketForKind = (): 'archive-documents' | 'archive-wheels' | null => {
    if (kind.value === 'document') return 'archive-documents';
    if (kind.value === 'wheel') return 'archive-wheels';
    // Fixes and registry entries have no upload target today; evidence photos on
    // a fix would need a bucket of their own rather than borrowing one.
    return null;
  };

  const buildPayload = (): Record<string, any> => {
    const base: Record<string, any> = {
      // Stamped so approving the submission clears the Most Wanted row it filled.
      request_id: context.value.requestId ?? null,
      origin: context.value.origin ?? route.path,
    };

    if (kind.value === 'document') {
      return {
        ...base,
        title: form.title.trim(),
        type: form.docType,
        author: form.author.trim() || undefined,
        year: form.year.trim() ? Number(form.year.trim()) : undefined,
        description: form.description.trim() || undefined,
      };
    }
    if (kind.value === 'registry') {
      return {
        ...base,
        title: `${form.year.trim()} ${form.model.trim()}`.trim(),
        year: Number(form.year.trim()),
        model: form.model.trim(),
        // Key names must match what the approve route reads — see
        // insertApprovedItem()'s `registry` branch, which maps bodyNum →
        // body_number, engineNum → engine_number, and takes bodyType /
        // engineSize / trim straight through.
        trim: form.trim.trim() || undefined,
        bodyType: form.bodyType || undefined,
        engineSize: form.engineSize ? Number(form.engineSize) : undefined,
        bodyNum: form.bodyNumber.trim() || undefined,
        engineNum: form.engineNumber.trim() || undefined,
        color: form.color.trim() || undefined,
        location: form.location.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
    }
    if (kind.value === 'wheel') {
      return {
        ...base,
        title: form.name.trim() || context.value.targetTitle || t('kinds.wheel'),
        name: form.name.trim(),
        size: form.size.trim(),
        width: form.width.trim(),
        offset: form.offset.trim() || undefined,
        manufacturer: form.manufacturer.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
    }
    return {
      ...base,
      title: context.value.targetTitle
        ? t('fix_title_with_target', { target: context.value.targetTitle })
        : t('fix_title'),
      reason: form.reason.trim(),
      target_hint: context.value.targetTitle ?? null,
      source_url: context.value.origin ?? route.fullPath,
    };
  };

  const uploadFiles = async (submissionId: string) => {
    const bucket = bucketForKind();
    if (!bucket || files.value.length === 0) return;

    const formData = new FormData();
    files.value.forEach((file, index) => formData.append(`file${index}`, file));
    await useAuthFetch('/api/archive/upload', {
      method: 'POST',
      body: formData,
      query: { bucket, submissionId },
    });
  };

  const submit = async () => {
    if (submitting.value || errors.value.length > 0) return;

    if (!isAuthenticated.value) {
      closeWizard();
      await navigateTo({ path: '/login', query: { redirect: route.fullPath } });
      return;
    }

    submitting.value = true;
    try {
      if (isRequestMode.value) {
        const created = await requestItem({
          title: requestTitle.value.trim(),
          notes: requestNotes.value.trim() || null,
          targetType: context.value.targetType ?? null,
          targetId: context.value.targetId ?? null,
          source: context.value.origin === 'omnisearch' ? 'search_miss' : 'manual',
        });
        if (created) closeWizard();
        return;
      }

      const payload = buildPayload();
      const targetType = targetTypeForKind();

      // A fix or a gap-fill is an addition to something that already exists;
      // anything else creates a new entry. target_id may be null on a fix (a
      // tool page has no archive row) — the reviewer then applies it by hand.
      const isEdit = kind.value === 'fix' || isGapFill.value;
      const submission = await submitContribution(
        isEdit ? 'edit_suggestion' : 'new_item',
        targetType,
        isEdit ? (context.value.targetId ?? null) : null,
        payload
      );
      const submissionId = submission.id;

      await uploadFiles(submissionId);

      track('contribution_submitted', {
        kind: kind.value,
        is_gap_fill: isGapFill.value,
        from_request: Boolean(context.value.requestId),
      });

      toast.add({
        title: t('toast_title'),
        description: t('toast_body'),
        color: 'success',
        icon: 'fas fa-circle-check',
      });
      closeWizard();
    } catch (error: any) {
      console.error('Contribution failed:', error);
      toast.add({
        title: t('toast_error_title'),
        description: error?.message ?? t('toast_error_body'),
        color: 'error',
        icon: 'fas fa-circle-exclamation',
      });
    } finally {
      submitting.value = false;
    }
  };

  const summaryRows = computed(() => {
    const rows: { label: string; value: string }[] = [];
    const push = (label: string, value?: string) => {
      if (value && value.trim()) rows.push({ label, value: value.trim() });
    };

    if (kind.value === 'document') {
      push(t('fields.title'), form.title);
      push(t('fields.doc_type'), t(`doc_types.${form.docType}`));
      push(t('fields.author'), form.author);
      push(t('fields.year'), form.year);
    } else if (kind.value === 'registry') {
      push(t('fields.year'), form.year);
      push(t('fields.model'), form.model);
      push(t('fields.trim'), form.trim);
      push(t('fields.body_type'), form.bodyType ? t(`body_types.${form.bodyType.toLowerCase()}`) : '');
      push(t('fields.engine_size'), form.engineSize ? `${form.engineSize}cc` : '');
      push(t('fields.body_number'), form.bodyNumber);
      push(t('fields.engine_number'), form.engineNumber);
      push(t('fields.location'), form.location);
    } else if (kind.value === 'wheel') {
      push(t('fields.name'), form.name || context.value.targetTitle || '');
      push(t('fields.size'), form.size);
      push(t('fields.width'), form.width);
      push(t('fields.offset'), form.offset);
      push(t('fields.manufacturer'), form.manufacturer);
    } else {
      push(t('fields.target'), context.value.targetTitle ?? t('fix_no_target'));
      push(t('fields.reason'), form.reason);
    }

    if (files.value.length) push(t('fields.files'), t('files_count', { count: files.value.length }));
    return rows;
  });
</script>

<template>
  <Teleport to="body">
    <Transition name="wizard">
      <div v-if="isOpen" class="fixed inset-0 z-[90]" role="dialog" aria-modal="true" :aria-label="t('heading')">
        <div class="absolute inset-0 bg-black/50" aria-hidden="true" @click="closeWizard()"></div>

        <div
          class="wizard-panel absolute inset-0 flex flex-col bg-base-100 sm:inset-auto sm:left-1/2 sm:top-14 sm:h-auto sm:max-h-[calc(100vh-7rem)] sm:w-[680px] sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:rounded-box sm:shadow-2xl sm:overflow-hidden"
        >
          <!-- Header -->
          <div class="flex items-center gap-3 border-b border-base-300 px-5 py-4 sm:px-6">
            <h3 class="flex-1 text-lg font-bold sm:text-xl">
              {{ isRequestMode ? t('request_heading') : t('heading') }}
            </h3>
            <span v-if="!isRequestMode" class="text-[13px] font-semibold opacity-60">
              {{ t('step_of', { step, total: totalSteps }) }}
            </span>
            <button type="button" class="btn btn-ghost btn-sm btn-square" :aria-label="t('close')" @click="closeWizard()">
              <i class="fas fa-xmark" aria-hidden="true"></i>
            </button>
          </div>

          <!-- Segmented progress -->
          <div v-if="!isRequestMode" class="flex gap-1.5 px-5 pt-3.5 sm:px-6">
            <div
              v-for="index in totalSteps"
              :key="index"
              class="h-1 flex-1 rounded-full"
              :class="index <= step ? 'bg-primary' : 'bg-base-300'"
            ></div>
          </div>

          <div class="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <!-- Request-it short path -->
            <template v-if="isRequestMode">
              <p class="mb-4 text-sm opacity-75">{{ t('request_body') }}</p>
              <label class="form-control mb-3 block">
                <span class="mb-1 block text-sm font-semibold">{{ t('fields.request_title') }}</span>
                <input v-model="requestTitle" type="text" class="input input-bordered w-full" maxlength="160" />
              </label>
              <label class="form-control block">
                <span class="mb-1 block text-sm font-semibold">{{ t('fields.request_notes') }}</span>
                <textarea v-model="requestNotes" rows="3" class="textarea textarea-bordered w-full" maxlength="1000"></textarea>
              </label>
            </template>

            <!-- Step 1 — type -->
            <template v-else-if="step === 1">
              <p class="mb-3.5 text-[15px] font-semibold">{{ t('step1_question') }}</p>
              <div class="grid gap-3 sm:grid-cols-2">
                <button
                  v-for="tile in TILES"
                  :key="tile.kind"
                  type="button"
                  class="wizard-tile"
                  :class="{ 'is-selected': kind === tile.kind }"
                  @click="kind = tile.kind"
                >
                  <i :class="[tile.icon, 'mt-0.5 text-xl text-primary']" aria-hidden="true"></i>
                  <span class="min-w-0">
                    <span class="block text-[15px] font-bold">{{ t(`kinds.${tile.kind}`) }}</span>
                    <span class="mt-0.5 block text-[12.5px] leading-snug opacity-70">
                      {{ t(`kind_hints.${tile.kind}`) }}
                    </span>
                  </span>
                </button>
              </div>
            </template>

            <!-- Step 2 — files & details -->
            <template v-else-if="step === 2">
              <div
                v-if="context.targetTitle"
                class="mb-4 flex items-center gap-2 rounded-box bg-base-200 px-3.5 py-2.5 text-[13.5px]"
              >
                <i class="fas fa-code-merge text-primary" aria-hidden="true"></i>
                <span>{{ t('adding_to', { target: context.targetTitle }) }}</span>
              </div>

              <div v-if="kind === 'document'" class="grid gap-3 sm:grid-cols-2">
                <label class="form-control sm:col-span-2">
                  <span class="mb-1 block text-sm font-semibold">{{ t('fields.title') }} *</span>
                  <input v-model="form.title" type="text" class="input input-bordered w-full" />
                </label>
                <label class="form-control">
                  <span class="mb-1 block text-sm font-semibold">{{ t('fields.doc_type') }}</span>
                  <select v-model="form.docType" class="select select-bordered w-full">
                    <option value="manual">{{ t('doc_types.manual') }}</option>
                    <option value="advert">{{ t('doc_types.advert') }}</option>
                    <option value="catalogue">{{ t('doc_types.catalogue') }}</option>
                    <option value="tuning">{{ t('doc_types.tuning') }}</option>
                    <option value="electrical">{{ t('doc_types.electrical') }}</option>
                  </select>
                </label>
                <label class="form-control">
                  <span class="mb-1 block text-sm font-semibold">{{ t('fields.year') }}</span>
                  <input v-model="form.year" type="text" inputmode="numeric" class="input input-bordered w-full" />
                </label>
                <label class="form-control sm:col-span-2">
                  <span class="mb-1 block text-sm font-semibold">{{ t('fields.author') }}</span>
                  <input v-model="form.author" type="text" class="input input-bordered w-full" />
                </label>
                <label class="form-control sm:col-span-2">
                  <span class="mb-1 block text-sm font-semibold">{{ t('fields.description') }}</span>
                  <textarea v-model="form.description" rows="3" class="textarea textarea-bordered w-full"></textarea>
                </label>
              </div>

              <div v-else-if="kind === 'registry'" class="grid gap-3 sm:grid-cols-2">
                <label class="form-control">
                  <span class="mb-1 block text-sm font-semibold">{{ t('fields.year') }} *</span>
                  <input v-model="form.year" type="text" inputmode="numeric" class="input input-bordered w-full" />
                </label>
                <label class="form-control">
                  <span class="mb-1 block text-sm font-semibold">{{ t('fields.model') }} *</span>
                  <input v-model="form.model" type="text" class="input input-bordered w-full" />
                </label>
                <label class="form-control">
                  <span class="mb-1 block text-sm font-semibold">{{ t('fields.trim') }}</span>
                  <input v-model="form.trim" type="text" class="input input-bordered w-full" />
                </label>
                <label class="form-control">
                  <span class="mb-1 block text-sm font-semibold">{{ t('fields.body_type') }}</span>
                  <select v-model="form.bodyType" class="select select-bordered w-full">
                    <option v-for="option in BODY_TYPES" :key="option" :value="option">
                      {{ t(`body_types.${option.toLowerCase()}`) }}
                    </option>
                  </select>
                </label>
                <label class="form-control">
                  <span class="mb-1 block text-sm font-semibold">{{ t('fields.engine_size') }}</span>
                  <select v-model="form.engineSize" class="select select-bordered w-full">
                    <option v-for="option in ENGINE_SIZES" :key="option" :value="option">{{ option }}cc</option>
                  </select>
                </label>
                <label class="form-control">
                  <span class="mb-1 block text-sm font-semibold">{{ t('fields.body_number') }}</span>
                  <input v-model="form.bodyNumber" type="text" class="input input-bordered w-full" />
                </label>
                <label class="form-control">
                  <span class="mb-1 block text-sm font-semibold">{{ t('fields.engine_number') }}</span>
                  <input v-model="form.engineNumber" type="text" class="input input-bordered w-full" />
                </label>
                <label class="form-control">
                  <span class="mb-1 block text-sm font-semibold">{{ t('fields.color') }}</span>
                  <input v-model="form.color" type="text" class="input input-bordered w-full" />
                </label>
                <label class="form-control">
                  <span class="mb-1 block text-sm font-semibold">{{ t('fields.location') }}</span>
                  <input v-model="form.location" type="text" class="input input-bordered w-full" />
                </label>
                <label class="form-control sm:col-span-2">
                  <span class="mb-1 block text-sm font-semibold">{{ t('fields.notes') }}</span>
                  <textarea v-model="form.notes" rows="3" class="textarea textarea-bordered w-full"></textarea>
                </label>
              </div>

              <div v-else-if="kind === 'wheel'" class="grid gap-3 sm:grid-cols-2">
                <template v-if="!isGapFill">
                  <label class="form-control sm:col-span-2">
                    <span class="mb-1 block text-sm font-semibold">{{ t('fields.name') }} *</span>
                    <input v-model="form.name" type="text" class="input input-bordered w-full" />
                  </label>
                  <label class="form-control">
                    <span class="mb-1 block text-sm font-semibold">{{ t('fields.size') }} *</span>
                    <input v-model="form.size" type="text" class="input input-bordered w-full" placeholder="10" />
                  </label>
                  <label class="form-control">
                    <span class="mb-1 block text-sm font-semibold">{{ t('fields.width') }}</span>
                    <input v-model="form.width" type="text" class="input input-bordered w-full" placeholder="4.5" />
                  </label>
                  <label class="form-control">
                    <span class="mb-1 block text-sm font-semibold">{{ t('fields.offset') }}</span>
                    <input v-model="form.offset" type="text" class="input input-bordered w-full" placeholder="ET-25" />
                  </label>
                  <label class="form-control">
                    <span class="mb-1 block text-sm font-semibold">{{ t('fields.manufacturer') }}</span>
                    <input v-model="form.manufacturer" type="text" class="input input-bordered w-full" />
                  </label>
                </template>
                <label class="form-control sm:col-span-2">
                  <span class="mb-1 block text-sm font-semibold">{{ t('fields.notes') }}</span>
                  <textarea v-model="form.notes" rows="2" class="textarea textarea-bordered w-full"></textarea>
                </label>
              </div>

              <div v-else class="grid gap-3">
                <label v-if="!context.targetType" class="form-control">
                  <span class="mb-1 block text-sm font-semibold">{{ t('fields.fix_area') }}</span>
                  <select v-model="form.fixArea" class="select select-bordered w-full">
                    <option value="document">{{ t('areas.document') }}</option>
                    <option value="registry">{{ t('areas.registry') }}</option>
                    <option value="wheel">{{ t('areas.wheel') }}</option>
                    <option value="color">{{ t('areas.color') }}</option>
                  </select>
                </label>
                <label class="form-control">
                  <span class="mb-1 block text-sm font-semibold">{{ t('fields.reason') }} *</span>
                  <textarea
                    v-model="form.reason"
                    rows="5"
                    class="textarea textarea-bordered w-full"
                    :placeholder="t('reason_placeholder')"
                  ></textarea>
                </label>
              </div>

              <div v-if="bucketForKind()" class="mt-4">
                <ContributeFileUpload
                  :accept="kind === 'document' ? 'application/pdf,image/jpeg,image/png' : 'image/jpeg,image/png'"
                  :max-files="kind === 'document' ? 3 : 5"
                  :max-size-mb="kind === 'document' ? 10 : 3"
                  @update:files="files = $event"
                />
              </div>
            </template>

            <!-- Step 3 — review -->
            <template v-else>
              <p class="mb-3.5 text-[15px] font-semibold">{{ t('step3_question') }}</p>
              <dl class="overflow-hidden rounded-box border border-base-300">
                <div
                  v-for="row in summaryRows"
                  :key="row.label"
                  class="flex gap-4 border-b border-base-300 px-4 py-2.5 last:border-b-0"
                >
                  <dt class="w-32 shrink-0 text-[13px] font-semibold opacity-60">{{ row.label }}</dt>
                  <dd class="min-w-0 flex-1 text-sm break-words">{{ row.value }}</dd>
                </div>
              </dl>
              <p class="mt-4 text-[13px] opacity-70">{{ t('review_note') }}</p>
            </template>

            <ul v-if="errors.length && step > 1" class="mt-4 space-y-1">
              <li v-for="problem in errors" :key="problem" class="flex items-center gap-2 text-sm text-error">
                <i class="fas fa-circle-exclamation" aria-hidden="true"></i>{{ problem }}
              </li>
            </ul>
          </div>

          <!-- Footer -->
          <div class="flex items-center gap-3 border-t border-base-300 px-5 py-4 sm:px-6">
            <button v-if="!isRequestMode && step > 1" type="button" class="btn btn-ghost btn-sm" @click="goBack()">
              <i class="fas fa-arrow-left" aria-hidden="true"></i>{{ t('back') }}
            </button>
            <span v-if="!isRequestMode && step === 1" class="hidden text-[13px] opacity-60 sm:inline">
              {{ t('next_hint') }}
            </span>
            <div class="flex-1"></div>
            <button
              v-if="!isRequestMode && step < totalSteps"
              type="button"
              class="btn btn-secondary"
              :disabled="!canContinue"
              @click="goNext()"
            >
              {{ t('continue') }}<i class="fas fa-arrow-right" aria-hidden="true"></i>
            </button>
            <button
              v-else
              type="button"
              class="btn btn-secondary"
              :disabled="submitting || errors.length > 0"
              @click="submit()"
            >
              <span v-if="submitting" class="loading loading-spinner loading-xs"></span>
              {{ isRequestMode ? t('send_request') : t('submit') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .wizard-tile {
    display: flex;
    gap: 0.875rem;
    align-items: flex-start;
    padding: 1rem;
    text-align: left;
    border: 1px solid var(--color-base-300);
    border-radius: var(--radius-box, 0.75rem);
    background: transparent;
    cursor: pointer;
    transition: border-color 120ms ease, background-color 120ms ease;
  }
  .wizard-tile:hover {
    border-color: color-mix(in srgb, var(--color-primary) 50%, transparent);
  }
  .wizard-tile.is-selected {
    border: 2px solid var(--color-primary);
    padding: calc(1rem - 1px);
    background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  }

  .wizard-enter-active,
  .wizard-leave-active {
    transition: opacity 0.2s ease;
  }
  .wizard-enter-active .wizard-panel,
  .wizard-leave-active .wizard-panel {
    transition: transform 0.25s ease, opacity 0.25s ease;
  }
  .wizard-enter-from,
  .wizard-leave-to {
    opacity: 0;
  }
  .wizard-enter-from .wizard-panel,
  .wizard-leave-to .wizard-panel {
    opacity: 0;
    transform: translateY(10px);
  }
  @media (min-width: 640px) {
    .wizard-enter-from .wizard-panel,
    .wizard-leave-to .wizard-panel {
      transform: translate(-50%, 10px);
    }
  }
</style>

<i18n lang="json">
{
  "en": {
    "heading": "Contribute to the Archive",
    "request_heading": "Request it",
    "request_body": "We'll add this to Most Wanted so someone with it can fill the gap.",
    "close": "Close",
    "step_of": "Step {step} of {total}",
    "step1_question": "What are you adding?",
    "step3_question": "Check this over, then send it in.",
    "next_hint": "Next: files & details → review & submit",
    "adding_to": "Adding to \"{target}\"",
    "review_note": "A moderator reviews every submission. You'll see the outcome on your profile.",
    "back": "Back",
    "continue": "Continue",
    "submit": "Submit",
    "send_request": "Send request",
    "files_count": "{count} file(s)",
    "fix_title": "Correction",
    "fix_title_with_target": "Correction — {target}",
    "fix_no_target": "Not linked to an entry",
    "reason_placeholder": "What's wrong, and what should it say instead?",
    "toast_title": "Submitted — in review",
    "toast_body": "Track it on your profile.",
    "toast_error_title": "Could not submit",
    "toast_error_body": "Please try again in a moment.",
    "kinds": {
      "document": "Manual or document",
      "registry": "Registry entry",
      "wheel": "Wheel + fitment",
      "fix": "Fix or addition"
    },
    "kind_hints": {
      "document": "Scans, guides, spec sheets, diagrams.",
      "registry": "Your car, chassis plate, or engine number.",
      "wheel": "New wheel, or photos/specs for an existing one.",
      "fix": "Correct a value, fill a gap, improve an entry."
    },
    "doc_types": {
      "manual": "Manual",
      "advert": "Advert",
      "catalogue": "Catalogue",
      "tuning": "Tuning guide",
      "electrical": "Electrical diagram"
    },
    "areas": {
      "document": "A document",
      "registry": "A registry entry",
      "wheel": "A wheel",
      "color": "A paint colour"
    },
    "fields": {
      "title": "Title",
      "doc_type": "Type",
      "author": "Author or publisher",
      "year": "Year",
      "description": "Description",
      "model": "Model",
      "body_number": "Body number",
      "engine_number": "Engine number",
      "color": "Colour",
      "location": "Location",
      "notes": "Notes",
      "name": "Wheel name",
      "size": "Size (in)",
      "width": "Width (in)",
      "offset": "Offset",
      "manufacturer": "Manufacturer",
      "fix_area": "What is this about?",
      "reason": "What needs fixing?",
      "target": "Entry",
      "files": "Files",
      "request_title": "What are you looking for?",
      "request_notes": "Anything that would help someone find it",
      "trim": "Trim",
      "body_type": "Body type",
      "engine_size": "Engine size"
    },
    "errors": {
      "title": "Add a title.",
      "file": "Attach at least one file.",
      "photo": "Attach at least one photo.",
      "year": "Enter a four-digit year.",
      "model": "Add the model.",
      "name": "Add the wheel name.",
      "size": "Add the wheel size.",
      "reason": "Describe the fix in a little more detail.",
      "request_title": "Give the request a short title."
    },
    "body_types": {
      "saloon": "Saloon",
      "pickup": "Pickup",
      "estate": "Estate",
      "cabriolet": "Cabriolet",
      "clubman": "Clubman",
      "van": "Van",
      "hornet": "Hornet"
    }
  },
  "es": {
    "heading": "Contribuir al Archivo",
    "request_heading": "Pídelo",
    "request_body": "Lo añadiremos a Más buscados para que alguien pueda cubrir el hueco.",
    "close": "Cerrar",
    "step_of": "Paso {step} de {total}",
    "step1_question": "¿Qué vas a añadir?",
    "step3_question": "Revísalo y envíalo.",
    "next_hint": "Después: archivos y detalles → revisar y enviar",
    "adding_to": "Añadiendo a \"{target}\"",
    "review_note": "Un moderador revisa cada envío. Verás el resultado en tu perfil.",
    "back": "Atrás",
    "continue": "Continuar",
    "submit": "Enviar",
    "send_request": "Enviar petición",
    "files_count": "{count} archivo(s)",
    "fix_title": "Corrección",
    "fix_title_with_target": "Corrección — {target}",
    "fix_no_target": "No vinculado a una entrada",
    "reason_placeholder": "¿Qué está mal y qué debería decir?",
    "toast_title": "Enviado — en revisión",
    "toast_body": "Puedes seguirlo en tu perfil.",
    "toast_error_title": "No se pudo enviar",
    "toast_error_body": "Inténtalo de nuevo en un momento.",
    "kinds": {
      "document": "Manual o documento",
      "registry": "Entrada del registro",
      "wheel": "Rueda y montaje",
      "fix": "Corrección o añadido"
    },
    "kind_hints": {
      "document": "Escaneos, guías, fichas técnicas, diagramas.",
      "registry": "Tu coche, placa de chasis o número de motor.",
      "wheel": "Rueda nueva, o fotos/datos de una existente.",
      "fix": "Corrige un valor, cubre un hueco, mejora una entrada."
    },
    "doc_types": {
      "manual": "Manual",
      "advert": "Anuncio",
      "catalogue": "Catálogo",
      "tuning": "Guía de tuning",
      "electrical": "Diagrama eléctrico"
    },
    "areas": {
      "document": "Un documento",
      "registry": "Una entrada del registro",
      "wheel": "Una rueda",
      "color": "Un color de pintura"
    },
    "fields": {
      "title": "Título",
      "doc_type": "Tipo",
      "author": "Autor o editorial",
      "year": "Año",
      "description": "Descripción",
      "model": "Modelo",
      "body_number": "Número de carrocería",
      "engine_number": "Número de motor",
      "color": "Color",
      "location": "Ubicación",
      "notes": "Notas",
      "name": "Nombre de la rueda",
      "size": "Tamaño (pulg)",
      "width": "Ancho (pulg)",
      "offset": "Offset",
      "manufacturer": "Fabricante",
      "fix_area": "¿Sobre qué es esto?",
      "reason": "¿Qué hay que corregir?",
      "target": "Entrada",
      "files": "Archivos",
      "request_title": "¿Qué estás buscando?",
      "request_notes": "Cualquier detalle que ayude a encontrarlo",
      "trim": "Acabado",
      "body_type": "Carrocería",
      "engine_size": "Cilindrada"
    },
    "errors": {
      "title": "Añade un título.",
      "file": "Adjunta al menos un archivo.",
      "photo": "Adjunta al menos una foto.",
      "year": "Introduce un año de cuatro dígitos.",
      "model": "Añade el modelo.",
      "name": "Añade el nombre de la rueda.",
      "size": "Añade el tamaño de la rueda.",
      "reason": "Describe la corrección con algo más de detalle.",
      "request_title": "Dale un título corto a la petición."
    },
    "body_types": {
      "saloon": "Berlina",
      "pickup": "Pickup",
      "estate": "Familiar",
      "cabriolet": "Cabriolet",
      "clubman": "Clubman",
      "van": "Furgoneta",
      "hornet": "Hornet"
    }
  },
  "fr": {
    "heading": "Contribuer aux Archives",
    "request_heading": "Demandez-le",
    "request_body": "Nous l'ajouterons aux Plus demandés pour que quelqu'un puisse combler le manque.",
    "close": "Fermer",
    "step_of": "Étape {step} sur {total}",
    "step1_question": "Qu'ajoutez-vous ?",
    "step3_question": "Vérifiez, puis envoyez.",
    "next_hint": "Ensuite : fichiers et détails → vérifier et envoyer",
    "adding_to": "Ajout à « {target} »",
    "review_note": "Un modérateur examine chaque envoi. Vous verrez le résultat sur votre profil.",
    "back": "Retour",
    "continue": "Continuer",
    "submit": "Envoyer",
    "send_request": "Envoyer la demande",
    "files_count": "{count} fichier(s)",
    "fix_title": "Correction",
    "fix_title_with_target": "Correction — {target}",
    "fix_no_target": "Non lié à une entrée",
    "reason_placeholder": "Qu'est-ce qui est faux, et que faudrait-il indiquer ?",
    "toast_title": "Envoyé — en cours d'examen",
    "toast_body": "Suivez-le sur votre profil.",
    "toast_error_title": "Envoi impossible",
    "toast_error_body": "Réessayez dans un instant.",
    "kinds": {
      "document": "Manuel ou document",
      "registry": "Entrée de registre",
      "wheel": "Jante + montage",
      "fix": "Correction ou ajout"
    },
    "kind_hints": {
      "document": "Scans, guides, fiches techniques, schémas.",
      "registry": "Votre voiture, plaque de châssis ou numéro de moteur.",
      "wheel": "Nouvelle jante, ou photos/spécifications d'une existante.",
      "fix": "Corriger une valeur, combler un manque, améliorer une entrée."
    },
    "doc_types": {
      "manual": "Manuel",
      "advert": "Publicité",
      "catalogue": "Catalogue",
      "tuning": "Guide de préparation",
      "electrical": "Schéma électrique"
    },
    "areas": {
      "document": "Un document",
      "registry": "Une entrée de registre",
      "wheel": "Une jante",
      "color": "Une teinte de peinture"
    },
    "fields": {
      "title": "Titre",
      "doc_type": "Type",
      "author": "Auteur ou éditeur",
      "year": "Année",
      "description": "Description",
      "model": "Modèle",
      "body_number": "Numéro de caisse",
      "engine_number": "Numéro de moteur",
      "color": "Couleur",
      "location": "Lieu",
      "notes": "Notes",
      "name": "Nom de la jante",
      "size": "Taille (po)",
      "width": "Largeur (po)",
      "offset": "Déport",
      "manufacturer": "Fabricant",
      "fix_area": "De quoi s'agit-il ?",
      "reason": "Qu'y a-t-il à corriger ?",
      "target": "Entrée",
      "files": "Fichiers",
      "request_title": "Que cherchez-vous ?",
      "request_notes": "Tout ce qui aiderait à le retrouver",
      "trim": "Finition",
      "body_type": "Carrosserie",
      "engine_size": "Cylindrée"
    },
    "errors": {
      "title": "Ajoutez un titre.",
      "file": "Joignez au moins un fichier.",
      "photo": "Joignez au moins une photo.",
      "year": "Saisissez une année à quatre chiffres.",
      "model": "Ajoutez le modèle.",
      "name": "Ajoutez le nom de la jante.",
      "size": "Ajoutez la taille de la jante.",
      "reason": "Décrivez la correction un peu plus précisément.",
      "request_title": "Donnez un titre court à la demande."
    },
    "body_types": {
      "saloon": "Berline",
      "pickup": "Pickup",
      "estate": "Break",
      "cabriolet": "Cabriolet",
      "clubman": "Clubman",
      "van": "Fourgonnette",
      "hornet": "Hornet"
    }
  },
  "de": {
    "heading": "Zum Archiv beitragen",
    "request_heading": "Anfragen",
    "request_body": "Wir setzen es auf Meistgesucht, damit jemand die Lücke füllen kann.",
    "close": "Schließen",
    "step_of": "Schritt {step} von {total}",
    "step1_question": "Was fügst du hinzu?",
    "step3_question": "Prüfe es und schicke es ab.",
    "next_hint": "Danach: Dateien & Details → prüfen & absenden",
    "adding_to": "Wird zu „{target}“ hinzugefügt",
    "review_note": "Ein Moderator prüft jede Einreichung. Das Ergebnis siehst du in deinem Profil.",
    "back": "Zurück",
    "continue": "Weiter",
    "submit": "Absenden",
    "send_request": "Anfrage senden",
    "files_count": "{count} Datei(en)",
    "fix_title": "Korrektur",
    "fix_title_with_target": "Korrektur — {target}",
    "fix_no_target": "Nicht mit einem Eintrag verknüpft",
    "reason_placeholder": "Was ist falsch, und was sollte stattdessen dort stehen?",
    "toast_title": "Eingereicht — in Prüfung",
    "toast_body": "Verfolge es in deinem Profil.",
    "toast_error_title": "Konnte nicht gesendet werden",
    "toast_error_body": "Bitte versuche es gleich noch einmal.",
    "kinds": {
      "document": "Handbuch oder Dokument",
      "registry": "Registereintrag",
      "wheel": "Rad + Passung",
      "fix": "Korrektur oder Ergänzung"
    },
    "kind_hints": {
      "document": "Scans, Anleitungen, Datenblätter, Diagramme.",
      "registry": "Dein Auto, Fahrgestellschild oder Motornummer.",
      "wheel": "Neues Rad oder Fotos/Daten zu einem vorhandenen.",
      "fix": "Wert korrigieren, Lücke füllen, Eintrag verbessern."
    },
    "doc_types": {
      "manual": "Handbuch",
      "advert": "Werbung",
      "catalogue": "Katalog",
      "tuning": "Tuning-Anleitung",
      "electrical": "Schaltplan"
    },
    "areas": {
      "document": "Ein Dokument",
      "registry": "Ein Registereintrag",
      "wheel": "Ein Rad",
      "color": "Eine Lackfarbe"
    },
    "fields": {
      "title": "Titel",
      "doc_type": "Typ",
      "author": "Autor oder Verlag",
      "year": "Jahr",
      "description": "Beschreibung",
      "model": "Modell",
      "body_number": "Karosserienummer",
      "engine_number": "Motornummer",
      "color": "Farbe",
      "location": "Ort",
      "notes": "Notizen",
      "name": "Radname",
      "size": "Größe (Zoll)",
      "width": "Breite (Zoll)",
      "offset": "Einpresstiefe",
      "manufacturer": "Hersteller",
      "fix_area": "Worum geht es?",
      "reason": "Was muss korrigiert werden?",
      "target": "Eintrag",
      "files": "Dateien",
      "request_title": "Wonach suchst du?",
      "request_notes": "Alles, was beim Finden hilft",
      "trim": "Ausstattung",
      "body_type": "Karosserie",
      "engine_size": "Hubraum"
    },
    "errors": {
      "title": "Titel ergänzen.",
      "file": "Mindestens eine Datei anhängen.",
      "photo": "Mindestens ein Foto anhängen.",
      "year": "Vierstellige Jahreszahl eingeben.",
      "model": "Modell ergänzen.",
      "name": "Radname ergänzen.",
      "size": "Radgröße ergänzen.",
      "reason": "Beschreibe die Korrektur etwas ausführlicher.",
      "request_title": "Gib der Anfrage einen kurzen Titel."
    },
    "body_types": {
      "saloon": "Limousine",
      "pickup": "Pickup",
      "estate": "Kombi",
      "cabriolet": "Cabriolet",
      "clubman": "Clubman",
      "van": "Kastenwagen",
      "hornet": "Hornet"
    }
  },
  "it": {
    "heading": "Contribuisci all'Archivio",
    "request_heading": "Richiedilo",
    "request_body": "Lo aggiungeremo ai Più richiesti così qualcuno potrà colmare la lacuna.",
    "close": "Chiudi",
    "step_of": "Passo {step} di {total}",
    "step1_question": "Cosa stai aggiungendo?",
    "step3_question": "Controlla e invia.",
    "next_hint": "Poi: file e dettagli → controlla e invia",
    "adding_to": "Aggiunta a \"{target}\"",
    "review_note": "Un moderatore controlla ogni invio. Vedrai l'esito sul tuo profilo.",
    "back": "Indietro",
    "continue": "Continua",
    "submit": "Invia",
    "send_request": "Invia richiesta",
    "files_count": "{count} file",
    "fix_title": "Correzione",
    "fix_title_with_target": "Correzione — {target}",
    "fix_no_target": "Non collegata a una voce",
    "reason_placeholder": "Cosa c'è di sbagliato e cosa dovrebbe dire?",
    "toast_title": "Inviato — in revisione",
    "toast_body": "Seguilo dal tuo profilo.",
    "toast_error_title": "Invio non riuscito",
    "toast_error_body": "Riprova tra un momento.",
    "kinds": {
      "document": "Manuale o documento",
      "registry": "Voce del registro",
      "wheel": "Cerchio + montaggio",
      "fix": "Correzione o aggiunta"
    },
    "kind_hints": {
      "document": "Scansioni, guide, schede tecniche, schemi.",
      "registry": "La tua auto, targhetta telaio o numero motore.",
      "wheel": "Cerchio nuovo, o foto/dati di uno esistente.",
      "fix": "Correggi un valore, colma una lacuna, migliora una voce."
    },
    "doc_types": {
      "manual": "Manuale",
      "advert": "Pubblicità",
      "catalogue": "Catalogo",
      "tuning": "Guida di tuning",
      "electrical": "Schema elettrico"
    },
    "areas": {
      "document": "Un documento",
      "registry": "Una voce del registro",
      "wheel": "Un cerchio",
      "color": "Un colore di vernice"
    },
    "fields": {
      "title": "Titolo",
      "doc_type": "Tipo",
      "author": "Autore o editore",
      "year": "Anno",
      "description": "Descrizione",
      "model": "Modello",
      "body_number": "Numero scocca",
      "engine_number": "Numero motore",
      "color": "Colore",
      "location": "Località",
      "notes": "Note",
      "name": "Nome del cerchio",
      "size": "Misura (in)",
      "width": "Larghezza (in)",
      "offset": "Offset",
      "manufacturer": "Produttore",
      "fix_area": "Di cosa si tratta?",
      "reason": "Cosa va corretto?",
      "target": "Voce",
      "files": "File",
      "request_title": "Cosa stai cercando?",
      "request_notes": "Qualsiasi dettaglio utile a trovarlo",
      "trim": "Allestimento",
      "body_type": "Carrozzeria",
      "engine_size": "Cilindrata"
    },
    "errors": {
      "title": "Aggiungi un titolo.",
      "file": "Allega almeno un file.",
      "photo": "Allega almeno una foto.",
      "year": "Inserisci un anno a quattro cifre.",
      "model": "Aggiungi il modello.",
      "name": "Aggiungi il nome del cerchio.",
      "size": "Aggiungi la misura del cerchio.",
      "reason": "Descrivi la correzione con un po' più di dettaglio.",
      "request_title": "Dai un titolo breve alla richiesta."
    },
    "body_types": {
      "saloon": "Berlina",
      "pickup": "Pickup",
      "estate": "Familiare",
      "cabriolet": "Cabriolet",
      "clubman": "Clubman",
      "van": "Furgone",
      "hornet": "Hornet"
    }
  },
  "pt": {
    "heading": "Contribuir para o Arquivo",
    "request_heading": "Peça",
    "request_body": "Vamos adicionar aos Mais procurados para alguém preencher a lacuna.",
    "close": "Fechar",
    "step_of": "Passo {step} de {total}",
    "step1_question": "O que está a adicionar?",
    "step3_question": "Confira e envie.",
    "next_hint": "A seguir: ficheiros e detalhes → rever e enviar",
    "adding_to": "A adicionar a \"{target}\"",
    "review_note": "Um moderador revê cada envio. Verá o resultado no seu perfil.",
    "back": "Voltar",
    "continue": "Continuar",
    "submit": "Enviar",
    "send_request": "Enviar pedido",
    "files_count": "{count} ficheiro(s)",
    "fix_title": "Correção",
    "fix_title_with_target": "Correção — {target}",
    "fix_no_target": "Não ligado a uma entrada",
    "reason_placeholder": "O que está errado e o que deveria dizer?",
    "toast_title": "Enviado — em revisão",
    "toast_body": "Acompanhe no seu perfil.",
    "toast_error_title": "Não foi possível enviar",
    "toast_error_body": "Tente novamente daqui a pouco.",
    "kinds": {
      "document": "Manual ou documento",
      "registry": "Entrada de registo",
      "wheel": "Jante + montagem",
      "fix": "Correção ou adição"
    },
    "kind_hints": {
      "document": "Digitalizações, guias, fichas técnicas, esquemas.",
      "registry": "O seu carro, chapa do chassi ou número do motor.",
      "wheel": "Jante nova, ou fotos/dados de uma existente.",
      "fix": "Corrigir um valor, preencher uma lacuna, melhorar uma entrada."
    },
    "doc_types": {
      "manual": "Manual",
      "advert": "Anúncio",
      "catalogue": "Catálogo",
      "tuning": "Guia de afinação",
      "electrical": "Esquema elétrico"
    },
    "areas": {
      "document": "Um documento",
      "registry": "Uma entrada de registo",
      "wheel": "Uma jante",
      "color": "Uma cor de pintura"
    },
    "fields": {
      "title": "Título",
      "doc_type": "Tipo",
      "author": "Autor ou editora",
      "year": "Ano",
      "description": "Descrição",
      "model": "Modelo",
      "body_number": "Número de carroçaria",
      "engine_number": "Número do motor",
      "color": "Cor",
      "location": "Localização",
      "notes": "Notas",
      "name": "Nome da jante",
      "size": "Tamanho (pol)",
      "width": "Largura (pol)",
      "offset": "Offset",
      "manufacturer": "Fabricante",
      "fix_area": "Sobre o que é isto?",
      "reason": "O que precisa de correção?",
      "target": "Entrada",
      "files": "Ficheiros",
      "request_title": "O que procura?",
      "request_notes": "Qualquer detalhe que ajude a encontrar",
      "trim": "Acabamento",
      "body_type": "Carroçaria",
      "engine_size": "Cilindrada"
    },
    "errors": {
      "title": "Adicione um título.",
      "file": "Anexe pelo menos um ficheiro.",
      "photo": "Anexe pelo menos uma foto.",
      "year": "Introduza um ano de quatro dígitos.",
      "model": "Adicione o modelo.",
      "name": "Adicione o nome da jante.",
      "size": "Adicione o tamanho da jante.",
      "reason": "Descreva a correção com um pouco mais de detalhe.",
      "request_title": "Dê um título curto ao pedido."
    },
    "body_types": {
      "saloon": "Berlina",
      "pickup": "Pickup",
      "estate": "Carrinha",
      "cabriolet": "Cabriolet",
      "clubman": "Clubman",
      "van": "Van",
      "hornet": "Hornet"
    }
  },
  "ru": {
    "heading": "Внести вклад в архив",
    "request_heading": "Запросить",
    "request_body": "Добавим это в «Самое востребованное», чтобы кто-то закрыл пробел.",
    "close": "Закрыть",
    "step_of": "Шаг {step} из {total}",
    "step1_question": "Что вы добавляете?",
    "step3_question": "Проверьте и отправьте.",
    "next_hint": "Далее: файлы и детали → проверка и отправка",
    "adding_to": "Добавление к «{target}»",
    "review_note": "Модератор проверяет каждую заявку. Результат появится в вашем профиле.",
    "back": "Назад",
    "continue": "Далее",
    "submit": "Отправить",
    "send_request": "Отправить запрос",
    "files_count": "файлов: {count}",
    "fix_title": "Исправление",
    "fix_title_with_target": "Исправление — {target}",
    "fix_no_target": "Не привязано к записи",
    "reason_placeholder": "Что не так и как должно быть?",
    "toast_title": "Отправлено — на проверке",
    "toast_body": "Следите за статусом в профиле.",
    "toast_error_title": "Не удалось отправить",
    "toast_error_body": "Попробуйте ещё раз через минуту.",
    "kinds": {
      "document": "Руководство или документ",
      "registry": "Запись в реестре",
      "wheel": "Диск и параметры установки",
      "fix": "Исправление или дополнение"
    },
    "kind_hints": {
      "document": "Сканы, руководства, спецификации, схемы.",
      "registry": "Ваш автомобиль, шильдик кузова или номер двигателя.",
      "wheel": "Новый диск либо фото и данные для существующего.",
      "fix": "Исправить значение, закрыть пробел, улучшить запись."
    },
    "doc_types": {
      "manual": "Руководство",
      "advert": "Реклама",
      "catalogue": "Каталог",
      "tuning": "Руководство по тюнингу",
      "electrical": "Электросхема"
    },
    "areas": {
      "document": "Документ",
      "registry": "Запись реестра",
      "wheel": "Диск",
      "color": "Цвет краски"
    },
    "fields": {
      "title": "Название",
      "doc_type": "Тип",
      "author": "Автор или издатель",
      "year": "Год",
      "description": "Описание",
      "model": "Модель",
      "body_number": "Номер кузова",
      "engine_number": "Номер двигателя",
      "color": "Цвет",
      "location": "Местоположение",
      "notes": "Заметки",
      "name": "Название диска",
      "size": "Размер (дюймы)",
      "width": "Ширина (дюймы)",
      "offset": "Вылет",
      "manufacturer": "Производитель",
      "fix_area": "К чему это относится?",
      "reason": "Что нужно исправить?",
      "target": "Запись",
      "files": "Файлы",
      "request_title": "Что вы ищете?",
      "request_notes": "Всё, что поможет это найти",
      "trim": "Комплектация",
      "body_type": "Тип кузова",
      "engine_size": "Объём двигателя"
    },
    "errors": {
      "title": "Добавьте название.",
      "file": "Приложите хотя бы один файл.",
      "photo": "Приложите хотя бы одно фото.",
      "year": "Введите год из четырёх цифр.",
      "model": "Укажите модель.",
      "name": "Укажите название диска.",
      "size": "Укажите размер диска.",
      "reason": "Опишите исправление подробнее.",
      "request_title": "Дайте запросу короткое название."
    },
    "body_types": {
      "saloon": "Седан",
      "pickup": "Пикап",
      "estate": "Универсал",
      "cabriolet": "Кабриолет",
      "clubman": "Clubman",
      "van": "Фургон",
      "hornet": "Hornet"
    }
  },
  "ja": {
    "heading": "アーカイブに貢献する",
    "request_heading": "リクエストする",
    "request_body": "「リクエストの多い項目」に追加し、持っている人が埋められるようにします。",
    "close": "閉じる",
    "step_of": "ステップ {step} / {total}",
    "step1_question": "何を追加しますか？",
    "step3_question": "内容を確認して送信してください。",
    "next_hint": "次: ファイルと詳細 → 確認して送信",
    "adding_to": "「{target}」に追加します",
    "review_note": "すべての投稿をモデレーターが確認します。結果はプロフィールで確認できます。",
    "back": "戻る",
    "continue": "次へ",
    "submit": "送信",
    "send_request": "リクエストを送信",
    "files_count": "{count} 件のファイル",
    "fix_title": "修正",
    "fix_title_with_target": "修正 — {target}",
    "fix_no_target": "エントリーに未リンク",
    "reason_placeholder": "どこが誤りで、正しくは何ですか？",
    "toast_title": "送信しました — 審査中",
    "toast_body": "プロフィールで進捗を確認できます。",
    "toast_error_title": "送信できませんでした",
    "toast_error_body": "しばらくしてからもう一度お試しください。",
    "kinds": {
      "document": "マニュアルまたは資料",
      "registry": "レジストリ登録",
      "wheel": "ホイールとフィットメント",
      "fix": "修正または追記"
    },
    "kind_hints": {
      "document": "スキャン、ガイド、仕様書、図面。",
      "registry": "あなたの車、シャシープレート、エンジン番号。",
      "wheel": "新しいホイール、または既存のものの写真・仕様。",
      "fix": "値の訂正、不足の補完、内容の改善。"
    },
    "doc_types": {
      "manual": "マニュアル",
      "advert": "広告",
      "catalogue": "カタログ",
      "tuning": "チューニングガイド",
      "electrical": "配線図"
    },
    "areas": {
      "document": "資料",
      "registry": "レジストリ登録",
      "wheel": "ホイール",
      "color": "塗装色"
    },
    "fields": {
      "title": "タイトル",
      "doc_type": "種類",
      "author": "著者または発行元",
      "year": "年",
      "description": "説明",
      "model": "モデル",
      "body_number": "ボディ番号",
      "engine_number": "エンジン番号",
      "color": "色",
      "location": "所在地",
      "notes": "メモ",
      "name": "ホイール名",
      "size": "サイズ (インチ)",
      "width": "幅 (インチ)",
      "offset": "オフセット",
      "manufacturer": "メーカー",
      "fix_area": "どれに関するものですか？",
      "reason": "何を修正しますか？",
      "target": "エントリー",
      "files": "ファイル",
      "request_title": "何をお探しですか？",
      "request_notes": "見つける手がかりになること",
      "trim": "グレード",
      "body_type": "ボディタイプ",
      "engine_size": "排気量"
    },
    "errors": {
      "title": "タイトルを入力してください。",
      "file": "ファイルを1つ以上添付してください。",
      "photo": "写真を1枚以上添付してください。",
      "year": "4桁の年を入力してください。",
      "model": "モデルを入力してください。",
      "name": "ホイール名を入力してください。",
      "size": "ホイールサイズを入力してください。",
      "reason": "修正内容をもう少し詳しく記入してください。",
      "request_title": "リクエストに短いタイトルを付けてください。"
    },
    "body_types": {
      "saloon": "サルーン",
      "pickup": "ピックアップ",
      "estate": "エステート",
      "cabriolet": "カブリオレ",
      "clubman": "クラブマン",
      "van": "バン",
      "hornet": "ホーネット"
    }
  },
  "zh": {
    "heading": "为档案馆做出贡献",
    "request_heading": "请求收录",
    "request_body": "我们会把它加入“最想要”，让拥有它的人来补上。",
    "close": "关闭",
    "step_of": "第 {step} 步，共 {total} 步",
    "step1_question": "你要添加什么？",
    "step3_question": "确认无误后提交。",
    "next_hint": "接下来：文件与详情 → 确认并提交",
    "adding_to": "添加到“{target}”",
    "review_note": "每份提交都会经过审核，结果会显示在你的个人资料中。",
    "back": "返回",
    "continue": "继续",
    "submit": "提交",
    "send_request": "发送请求",
    "files_count": "{count} 个文件",
    "fix_title": "更正",
    "fix_title_with_target": "更正 — {target}",
    "fix_no_target": "未关联条目",
    "reason_placeholder": "哪里有误？应该是什么？",
    "toast_title": "已提交 — 审核中",
    "toast_body": "可在个人资料中查看进度。",
    "toast_error_title": "提交失败",
    "toast_error_body": "请稍后重试。",
    "kinds": {
      "document": "手册或文档",
      "registry": "注册条目",
      "wheel": "轮毂与安装数据",
      "fix": "更正或补充"
    },
    "kind_hints": {
      "document": "扫描件、指南、规格表、图纸。",
      "registry": "你的车、车架铭牌或发动机号。",
      "wheel": "新轮毂，或现有轮毂的照片/参数。",
      "fix": "更正数值、补上缺失、完善条目。"
    },
    "doc_types": {
      "manual": "手册",
      "advert": "广告",
      "catalogue": "目录",
      "tuning": "调校指南",
      "electrical": "电路图"
    },
    "areas": {
      "document": "一份文档",
      "registry": "一条注册条目",
      "wheel": "一款轮毂",
      "color": "一种车漆颜色"
    },
    "fields": {
      "title": "标题",
      "doc_type": "类型",
      "author": "作者或出版方",
      "year": "年份",
      "description": "描述",
      "model": "车型",
      "body_number": "车身号",
      "engine_number": "发动机号",
      "color": "颜色",
      "location": "所在地",
      "notes": "备注",
      "name": "轮毂名称",
      "size": "尺寸（英寸）",
      "width": "宽度（英寸）",
      "offset": "偏距",
      "manufacturer": "制造商",
      "fix_area": "这是关于什么的？",
      "reason": "需要更正什么？",
      "target": "条目",
      "files": "文件",
      "request_title": "你在找什么？",
      "request_notes": "任何有助于找到它的信息",
      "trim": "配置",
      "body_type": "车身型式",
      "engine_size": "排量"
    },
    "errors": {
      "title": "请填写标题。",
      "file": "请至少上传一个文件。",
      "photo": "请至少上传一张照片。",
      "year": "请输入四位年份。",
      "model": "请填写车型。",
      "name": "请填写轮毂名称。",
      "size": "请填写轮毂尺寸。",
      "reason": "请把更正内容再写详细一些。",
      "request_title": "给请求起一个简短标题。"
    },
    "body_types": {
      "saloon": "轿车",
      "pickup": "皮卡",
      "estate": "旅行车",
      "cabriolet": "敞篷",
      "clubman": "Clubman",
      "van": "厢式车",
      "hornet": "Hornet"
    }
  },
  "ko": {
    "heading": "아카이브에 기여하기",
    "request_heading": "요청하기",
    "request_body": "'가장 많이 요청됨'에 추가해 가진 분이 채울 수 있도록 합니다.",
    "close": "닫기",
    "step_of": "{total}단계 중 {step}단계",
    "step1_question": "무엇을 추가하시나요?",
    "step3_question": "확인 후 제출하세요.",
    "next_hint": "다음: 파일 및 세부정보 → 확인 후 제출",
    "adding_to": "\"{target}\"에 추가",
    "review_note": "모든 제출은 검토를 거칩니다. 결과는 프로필에서 확인할 수 있습니다.",
    "back": "뒤로",
    "continue": "계속",
    "submit": "제출",
    "send_request": "요청 보내기",
    "files_count": "파일 {count}개",
    "fix_title": "수정",
    "fix_title_with_target": "수정 — {target}",
    "fix_no_target": "항목과 연결되지 않음",
    "reason_placeholder": "무엇이 잘못되었고 어떻게 바뀌어야 하나요?",
    "toast_title": "제출됨 — 검토 중",
    "toast_body": "프로필에서 진행 상황을 확인하세요.",
    "toast_error_title": "제출하지 못했습니다",
    "toast_error_body": "잠시 후 다시 시도해 주세요.",
    "kinds": {
      "document": "매뉴얼 또는 문서",
      "registry": "레지스트리 항목",
      "wheel": "휠 + 장착 정보",
      "fix": "수정 또는 추가"
    },
    "kind_hints": {
      "document": "스캔본, 가이드, 사양서, 도면.",
      "registry": "내 차, 섀시 플레이트, 엔진 번호.",
      "wheel": "새 휠, 또는 기존 휠의 사진·사양.",
      "fix": "값을 고치고, 빈 곳을 채우고, 항목을 개선합니다."
    },
    "doc_types": {
      "manual": "매뉴얼",
      "advert": "광고",
      "catalogue": "카탈로그",
      "tuning": "튜닝 가이드",
      "electrical": "배선도"
    },
    "areas": {
      "document": "문서",
      "registry": "레지스트리 항목",
      "wheel": "휠",
      "color": "페인트 색상"
    },
    "fields": {
      "title": "제목",
      "doc_type": "종류",
      "author": "저자 또는 발행처",
      "year": "연도",
      "description": "설명",
      "model": "모델",
      "body_number": "바디 번호",
      "engine_number": "엔진 번호",
      "color": "색상",
      "location": "위치",
      "notes": "메모",
      "name": "휠 이름",
      "size": "사이즈(인치)",
      "width": "폭(인치)",
      "offset": "오프셋",
      "manufacturer": "제조사",
      "fix_area": "무엇에 대한 내용인가요?",
      "reason": "무엇을 고쳐야 하나요?",
      "target": "항목",
      "files": "파일",
      "request_title": "무엇을 찾고 계신가요?",
      "request_notes": "찾는 데 도움이 될 만한 정보",
      "trim": "트림",
      "body_type": "바디 타입",
      "engine_size": "배기량"
    },
    "errors": {
      "title": "제목을 입력하세요.",
      "file": "파일을 하나 이상 첨부하세요.",
      "photo": "사진을 한 장 이상 첨부하세요.",
      "year": "네 자리 연도를 입력하세요.",
      "model": "모델을 입력하세요.",
      "name": "휠 이름을 입력하세요.",
      "size": "휠 사이즈를 입력하세요.",
      "reason": "수정 내용을 조금 더 자세히 적어 주세요.",
      "request_title": "요청에 짧은 제목을 붙여 주세요."
    },
    "body_types": {
      "saloon": "설룬",
      "pickup": "픽업",
      "estate": "에스테이트",
      "cabriolet": "카브리올레",
      "clubman": "클럽맨",
      "van": "밴",
      "hornet": "호넷"
    }
  }
}
</i18n>
