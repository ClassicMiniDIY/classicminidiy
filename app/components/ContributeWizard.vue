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
  import {
    BODY_LABELS,
    FAMILY_LABELS,
    MARK_RANGES,
    MARK_NUMBERS,
    MARKET_LABELS,
    MARQUE_LABELS,
    VARIANT_BODIES,
    VARIANT_EDITABLE_COLUMNS,
    VARIANT_FAMILIES,
    VARIANT_MARKETS,
    VARIANT_MARQUES,
    VARIANT_NUMERIC_COLUMNS,
    VARIANT_PHOTO_KINDS,
    VARIANT_SOURCE_TYPES,
    variantNumberProblem,
  } from '~~/data/models/variants';

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
    { kind: 'variant', icon: 'fas fa-car-side' },
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

  // ---- Model variants (design R3) --------------------------------------------
  /** Fields of a NEW variant. Keys are the model_variants column names the approve route reads. */
  const NEW_VARIANT_FIELDS = [
    'name',
    'marque',
    'family',
    'body_style',
    'mark',
    'market',
    'year_start',
    'year_end',
    'engine_cc',
    'power_bhp',
    'torque_lbft',
    'carburettor',
    'final_drive',
    'wheels',
    'tyres',
    'kerb_weight_kg',
    'top_speed_mph',
    'notes',
  ] as const;
  const blankVariant = () =>
    Object.fromEntries(NEW_VARIANT_FIELDS.map((k) => [k, k === 'market' ? 'uk' : ''])) as Record<string, string>;
  const vform = reactive<Record<string, string>>(blankVariant());
  const variantColours = ref('');
  /** Spec-fix target: an editable column, 'colours', or 'photos'. */
  const variantField = ref<string>('power_bhp');
  const variantValue = ref('');
  const source = reactive({ type: 'brochure', title: '', url: '' });
  const photoMeta = reactive({ kind: 'owner', caption: '', credit: '' });

  const isVariantEdit = computed(() => kind.value === 'variant' && Boolean(targetId.value));
  const variantMode = computed<'new' | 'spec' | 'photos'>(() =>
    !isVariantEdit.value ? 'new' : variantField.value === 'photos' ? 'photos' : 'spec'
  );
  const currentValue = computed(() => context.value.currentValues?.[variantField.value] ?? '');
  const VARIANT_EDIT_OPTIONS = ['photos', 'colours', ...VARIANT_EDITABLE_COLUMNS] as const;
  const isNumericField = (key: string) => VARIANT_NUMERIC_COLUMNS.has(key) || key === 'mark';
  /** Blank, or a number inside the column's database range (VARIANT_RANGES). */
  const numberOk = (key: string, value: string) => {
    const raw = value.trim();
    if (raw === '') return true;
    const n = Number(raw.replace(',', '.'));
    return Number.isFinite(n) && variantNumberProblem(key, n) === null;
  };

  const requestTitle = ref('');
  const requestNotes = ref('');

  const isRequestMode = computed(() => context.value.mode === 'request');
  /**
   * The launch target belongs to the tile it was launched with. Going Back and
   * picking another tile must not carry a wheel's id into a variant edit (or
   * the reverse): the approval would target the wrong table and fail.
   */
  const targetId = computed(() =>
    !context.value.kind || kind.value === context.value.kind ? (context.value.targetId ?? null) : null
  );
  /** A gap-filler attaches photos to an entry that already exists. */
  const isGapFill = computed(() => Boolean(targetId.value && kind.value !== 'fix'));

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
    Object.assign(vform, blankVariant());
    variantColours.value = '';
    variantField.value = 'power_bhp';
    variantValue.value = '';
    Object.assign(source, { type: 'brochure', title: '', url: '' });
    Object.assign(photoMeta, { kind: 'owner', caption: '', credit: '' });
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
    if (ctx.targetType && ctx.targetType !== 'variant') form.fixArea = ctx.targetType;
    if (ctx.kind === 'variant') {
      if (ctx.variantFocus) variantField.value = ctx.variantFocus;
      if (!ctx.targetId) {
        // New variant: currentValues is a prefill (e.g. the mark of the group tile).
        for (const [key, value] of Object.entries(ctx.currentValues ?? {})) if (key in vform) vform[key] = value;
      } else {
        // The watcher below only fires on a CHANGE of field; seed the first one here.
        variantValue.value = currentValue.value;
      }
    }
  });

  // Picking a different field starts the correction from that field's current value.
  watch(variantField, () => {
    variantValue.value = currentValue.value;
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
    } else if (kind.value === 'variant') {
      if (variantMode.value === 'photos') {
        if (files.value.length === 0) problems.push(t('errors.photo'));
      } else {
        if (variantMode.value === 'new') {
          if (!vform.name?.trim()) problems.push(t('variant.errors.name'));
          if (!vform.marque || !vform.family || !vform.body_style) problems.push(t('variant.errors.class'));
          if (!/^(19[5-9]\d|2000)$/.test(vform.year_start?.trim() ?? '')) problems.push(t('variant.errors.year'));
          if (NEW_VARIANT_FIELDS.some((k) => isNumericField(k) && !numberOk(k, vform[k] ?? '')))
            problems.push(t('variant.errors.number'));
          const ys = Number(vform.year_start);
          const ye = Number(vform.year_end);
          if (vform.year_end?.trim() && ye < ys) problems.push(t('variant.errors.years_order'));
        } else {
          const next = variantValue.value.trim();
          if (!next || next === currentValue.value.trim()) problems.push(t('variant.errors.value'));
          else if (isNumericField(variantField.value) && !numberOk(variantField.value, next))
            problems.push(t('variant.errors.number'));
          else if (variantField.value === 'name' && next.length > 160) problems.push(t('variant.errors.name'));
        }
        if (source.title.trim().length < 3) problems.push(t('variant.errors.source'));
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
  const targetTypeForKind = (): 'document' | 'registry' | 'wheel' | 'color' | 'variant' => {
    if (kind.value === 'wheel') return 'wheel';
    if (kind.value === 'variant') return 'variant';
    if (kind.value === 'registry') return 'registry';
    if (kind.value === 'fix') return (form.fixArea as any) || 'document';
    return 'document';
  };

  const bucketForKind = (): 'archive-documents' | 'archive-wheels' | 'archive-variants' | null => {
    if (kind.value === 'document') return 'archive-documents';
    if (kind.value === 'wheel') return 'archive-wheels';
    // A spec fix carries a citation, not files; a new variant or a photo addition can carry photos.
    if (kind.value === 'variant') return variantMode.value === 'spec' ? null : 'archive-variants';
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
    if (kind.value === 'variant') {
      const cite = {
        type: source.type,
        title: source.title.trim(),
        ...(source.url.trim() ? { url: source.url.trim() } : {}),
      };
      if (variantMode.value === 'photos') {
        return {
          ...base,
          title: t('variant.photos_title', { target: context.value.targetTitle ?? '' }),
          photo_kind: photoMeta.kind,
          photo_caption: photoMeta.caption.trim() || undefined,
          photo_credit: photoMeta.credit.trim() || undefined,
        };
      }
      if (variantMode.value === 'spec') {
        return {
          ...base,
          title: t('fix_title_with_target', { target: context.value.targetTitle ?? '' }),
          // Keys are raw column names (or 'colours'); the approve route allowlists them.
          changes: { [variantField.value]: { from: currentValue.value || null, to: variantValue.value.trim() } },
          source: cite,
        };
      }
      const variant: Record<string, string> = {};
      for (const key of NEW_VARIANT_FIELDS) if (vform[key]?.trim()) variant[key] = vform[key].trim();
      return {
        ...base,
        title: (vform.name ?? '').trim(),
        variant,
        colours: variantColours.value,
        source: cite,
        photo_kind: 'owner',
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
        isEdit ? targetId.value : null,
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
    } else if (kind.value === 'variant') {
      if (variantMode.value === 'new') {
        for (const key of NEW_VARIANT_FIELDS) push(t(`variant.fields.${key}`), vform[key]);
        push(t('variant.fields.colours'), variantColours.value);
      } else {
        push(t('fields.target'), context.value.targetTitle ?? '');
        if (variantMode.value === 'spec') {
          push(t('variant.update_what'), t(`variant.fields.${variantField.value}`));
          push(t('variant.current'), currentValue.value || t('variant.not_recorded'));
          push(t('variant.your_value'), variantValue.value);
        } else {
          push(t('variant.photo_kind'), t(`variant.photo_kinds.${photoMeta.kind}`));
          push(t('variant.photo_credit'), photoMeta.credit);
        }
      }
      if (variantMode.value !== 'photos') push(t('variant.source'), source.title);
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
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-square"
              :aria-label="t('close')"
              @click="closeWizard()"
            >
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
                <textarea
                  v-model="requestNotes"
                  rows="3"
                  class="textarea textarea-bordered w-full"
                  maxlength="1000"
                ></textarea>
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

              <div v-else-if="kind === 'variant'" class="grid gap-3">
                <!-- Existing variant: what is being changed -->
                <template v-if="isVariantEdit">
                  <label class="form-control">
                    <span class="mb-1 block text-sm font-semibold">{{ t('variant.update_what') }}</span>
                    <select v-model="variantField" class="select select-bordered w-full">
                      <option v-for="option in VARIANT_EDIT_OPTIONS" :key="option" :value="option">
                        {{ t(`variant.fields.${option}`) }}
                      </option>
                    </select>
                  </label>
                  <div v-if="variantMode === 'spec'" class="grid gap-3 sm:grid-cols-2">
                    <div class="rounded-field border border-base-300 bg-base-200 px-3.5 py-3">
                      <p class="mb-0.5 text-[11px] font-bold tracking-wide opacity-60">{{ t('variant.current') }}</p>
                      <p class="text-[15px] break-words">{{ currentValue || t('variant.not_recorded') }}</p>
                    </div>
                    <label class="form-control">
                      <span class="mb-1 block text-[11px] font-bold tracking-wide text-primary">{{
                        t('variant.your_value')
                      }}</span>
                      <textarea
                        v-if="variantField === 'colours' || variantField === 'description' || variantField === 'notes'"
                        v-model="variantValue"
                        rows="3"
                        class="textarea textarea-bordered w-full"
                        :placeholder="variantField === 'colours' ? t('variant.colours_hint') : ''"
                      ></textarea>
                      <input
                        v-else
                        v-model="variantValue"
                        type="text"
                        :inputmode="isNumericField(variantField) ? 'decimal' : 'text'"
                        class="input input-bordered w-full"
                      />
                    </label>
                  </div>
                  <div v-else class="grid gap-3 sm:grid-cols-2">
                    <label class="form-control">
                      <span class="mb-1 block text-sm font-semibold">{{ t('variant.photo_kind') }}</span>
                      <select v-model="photoMeta.kind" class="select select-bordered w-full">
                        <option v-for="k in VARIANT_PHOTO_KINDS" :key="k" :value="k">
                          {{ t(`variant.photo_kinds.${k}`) }}
                        </option>
                      </select>
                    </label>
                    <label class="form-control">
                      <span class="mb-1 block text-sm font-semibold">{{ t('variant.photo_credit') }}</span>
                      <input
                        v-model="photoMeta.credit"
                        type="text"
                        maxlength="120"
                        class="input input-bordered w-full"
                      />
                    </label>
                    <label class="form-control sm:col-span-2">
                      <span class="mb-1 block text-sm font-semibold">{{ t('variant.photo_caption') }}</span>
                      <input
                        v-model="photoMeta.caption"
                        type="text"
                        maxlength="200"
                        class="input input-bordered w-full"
                      />
                    </label>
                  </div>
                </template>

                <!-- New variant -->
                <div v-else class="grid gap-3 sm:grid-cols-2">
                  <label class="form-control sm:col-span-2">
                    <span class="mb-1 block text-sm font-semibold">{{ t('variant.fields.name') }} *</span>
                    <input v-model="vform.name" type="text" maxlength="160" class="input input-bordered w-full" />
                  </label>
                  <label class="form-control">
                    <span class="mb-1 block text-sm font-semibold">{{ t('variant.fields.marque') }} *</span>
                    <select v-model="vform.marque" class="select select-bordered w-full">
                      <option value="" disabled>—</option>
                      <option v-for="m in VARIANT_MARQUES" :key="m" :value="m">{{ MARQUE_LABELS[m] }}</option>
                    </select>
                  </label>
                  <label class="form-control">
                    <span class="mb-1 block text-sm font-semibold">{{ t('variant.fields.family') }} *</span>
                    <select v-model="vform.family" class="select select-bordered w-full">
                      <option value="" disabled>—</option>
                      <option v-for="f in VARIANT_FAMILIES" :key="f" :value="f">{{ FAMILY_LABELS[f] }}</option>
                    </select>
                  </label>
                  <label class="form-control">
                    <span class="mb-1 block text-sm font-semibold">{{ t('variant.fields.body_style') }} *</span>
                    <select v-model="vform.body_style" class="select select-bordered w-full">
                      <option value="" disabled>—</option>
                      <option v-for="b in VARIANT_BODIES" :key="b" :value="b">{{ BODY_LABELS[b] }}</option>
                    </select>
                  </label>
                  <label class="form-control">
                    <span class="mb-1 block text-sm font-semibold">{{ t('variant.fields.mark') }}</span>
                    <select v-model="vform.mark" class="select select-bordered w-full">
                      <option value="">{{ t('variant.overseas') }}</option>
                      <option v-for="n in MARK_NUMBERS" :key="n" :value="String(n)">
                        Mk {{ MARK_RANGES[n]!.roman }} · {{ MARK_RANGES[n]!.start }}–{{ MARK_RANGES[n]!.end }}
                      </option>
                    </select>
                  </label>
                  <label class="form-control">
                    <span class="mb-1 block text-sm font-semibold">{{ t('variant.fields.market') }}</span>
                    <select v-model="vform.market" class="select select-bordered w-full">
                      <option v-for="m in VARIANT_MARKETS" :key="m" :value="m">{{ MARKET_LABELS[m] }}</option>
                    </select>
                  </label>
                  <label v-for="key in ['year_start', 'year_end']" :key="key" class="form-control">
                    <span class="mb-1 block text-sm font-semibold"
                      >{{ t(`variant.fields.${key}`) }}{{ key === 'year_start' ? ' *' : '' }}</span
                    >
                    <input
                      v-model="vform[key]"
                      type="text"
                      inputmode="numeric"
                      maxlength="4"
                      class="input input-bordered w-full"
                    />
                  </label>
                  <label
                    v-for="key in [
                      'engine_cc',
                      'power_bhp',
                      'torque_lbft',
                      'carburettor',
                      'final_drive',
                      'kerb_weight_kg',
                      'top_speed_mph',
                      'wheels',
                      'tyres',
                    ]"
                    :key="key"
                    class="form-control"
                  >
                    <span class="mb-1 block text-sm font-semibold">{{ t(`variant.fields.${key}`) }}</span>
                    <input
                      v-model="vform[key]"
                      type="text"
                      :inputmode="isNumericField(key) ? 'decimal' : 'text'"
                      class="input input-bordered w-full"
                    />
                  </label>
                  <label class="form-control sm:col-span-2">
                    <span class="mb-1 block text-sm font-semibold">{{ t('variant.fields.colours') }}</span>
                    <textarea
                      v-model="variantColours"
                      rows="2"
                      class="textarea textarea-bordered w-full"
                      :placeholder="t('variant.colours_hint')"
                    ></textarea>
                  </label>
                  <label class="form-control sm:col-span-2">
                    <span class="mb-1 block text-sm font-semibold">{{ t('variant.fields.notes') }}</span>
                    <textarea v-model="vform.notes" rows="2" class="textarea textarea-bordered w-full"></textarea>
                  </label>
                </div>

                <!-- Source: required on every spec change and every new variant -->
                <div v-if="variantMode !== 'photos'">
                  <p class="mb-1.5 text-sm font-semibold">
                    {{ t('variant.source') }} <span class="text-error">*</span>
                    <span class="font-normal opacity-60">— {{ t('variant.source_required') }}</span>
                  </p>
                  <div class="grid gap-3 sm:grid-cols-[180px_1fr]">
                    <select
                      v-model="source.type"
                      class="select select-bordered w-full"
                      :aria-label="t('variant.source_type')"
                    >
                      <option v-for="s in VARIANT_SOURCE_TYPES" :key="s" :value="s">
                        {{ t(`variant.source_types.${s}`) }}
                      </option>
                    </select>
                    <input
                      v-model="source.title"
                      type="text"
                      maxlength="300"
                      class="input input-bordered w-full"
                      :placeholder="t('variant.source_title_hint')"
                      :aria-label="t('variant.source_title')"
                    />
                    <input
                      v-model="source.url"
                      type="url"
                      maxlength="500"
                      class="input input-bordered w-full sm:col-span-2"
                      :placeholder="t('variant.source_url_hint')"
                      :aria-label="t('variant.source_url')"
                    />
                  </div>
                </div>
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
                  :max-size-mb="kind === 'document' ? 10 : kind === 'variant' ? 5 : 3"
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
    transition:
      border-color 120ms ease,
      background-color 120ms ease;
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
    transition:
      transform 0.25s ease,
      opacity 0.25s ease;
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
      "variant": "Model variant",
      "fix": "Fix or addition"
    },
    "kind_hints": {
      "document": "Scans, guides, spec sheets, diagrams.",
      "registry": "Your car, chassis plate, or engine number.",
      "wheel": "New wheel, or photos/specs for an existing one.",
      "variant": "A Mini model or trim: specs, colours, photos.",
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
    },
    "variant": {
      "fields": {
        "photos": "Photos",
        "colours": "Factory colours",
        "name": "Name",
        "marque": "Marque",
        "family": "Family",
        "body_style": "Body style",
        "mark": "Mark",
        "market": "Home market",
        "year_start": "First year",
        "year_end": "Last year",
        "edition_size": "Edition size",
        "production_total": "Units built",
        "description": "Description",
        "notes": "Notes",
        "engine_cc": "Engine (cc)",
        "engine_code": "Engine code",
        "bore_mm": "Bore (mm)",
        "stroke_mm": "Stroke (mm)",
        "compression_ratio": "Compression ratio (:1)",
        "power_bhp": "Power (bhp)",
        "power_rpm": "Power at (rpm)",
        "torque_lbft": "Torque (lb-ft)",
        "torque_rpm": "Torque at (rpm)",
        "carburettor": "Carburation",
        "gearbox": "Gearbox",
        "final_drive": "Final drive (:1)",
        "brakes_front": "Front brakes",
        "brakes_rear": "Rear brakes",
        "wheels": "Wheels",
        "tyres": "Tyres",
        "kerb_weight_kg": "Kerb weight (kg)",
        "top_speed_mph": "Top speed (mph)",
        "length_mm": "Length (mm)",
        "width_mm": "Width (mm)",
        "height_mm": "Height (mm)",
        "wheelbase_mm": "Wheelbase (mm)"
      },
      "update_what": "What are you updating?",
      "current": "CURRENT",
      "your_value": "YOUR CORRECTION",
      "not_recorded": "Not recorded",
      "source": "Source",
      "source_required": "required for every spec edit",
      "source_type": "Source type",
      "source_title": "Citation",
      "source_url": "Link",
      "source_title_hint": "e.g. BMC Service Sheet A/12, 1965, p.4",
      "source_url_hint": "Link to the source (optional)",
      "source_types": {
        "book": "Book",
        "brochure": "Brochure",
        "period_document": "Period document",
        "link": "Web link",
        "other": "Other"
      },
      "photo_kind": "Photo type",
      "photo_caption": "Caption",
      "photo_credit": "Credit (who took it, or where it is from)",
      "photo_kinds": {
        "brochure": "Brochure",
        "factory": "Factory",
        "period": "Period",
        "owner": "Owner",
        "interior": "Interior",
        "engine": "Engine bay",
        "badge": "Badge"
      },
      "colours_hint": "Comma-separated, e.g. Tartan Red, Almond Green",
      "overseas": "Overseas / not in the UK sequence",
      "photos_title": "Photos — {target}",
      "errors": {
        "name": "Add the variant name.",
        "class": "Choose the marque, family and body style.",
        "year": "Enter the first year (1959–2000).",
        "number": "That number is outside what the archive accepts for this field (e.g. years 1959–2000, engine 500–2000 cc, compression 5–15, whole numbers where counted).",
        "value": "Enter a new value that differs from the current one.",
        "source": "Cite a source (at least a few characters).",
        "years_order": "The last year cannot be before the first year."
      }
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
      "variant": "Variante de modelo",
      "fix": "Corrección o añadido"
    },
    "kind_hints": {
      "document": "Escaneos, guías, fichas técnicas, diagramas.",
      "registry": "Tu coche, placa de chasis o número de motor.",
      "wheel": "Rueda nueva, o fotos/datos de una existente.",
      "variant": "Un modelo o acabado de Mini: datos, colores, fotos.",
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
    },
    "variant": {
      "fields": {
        "photos": "Fotos",
        "colours": "Colores de fábrica",
        "name": "Nombre",
        "marque": "Marca",
        "family": "Familia",
        "body_style": "Carrocería",
        "mark": "Mark",
        "market": "Mercado de origen",
        "year_start": "Primer año",
        "year_end": "Último año",
        "edition_size": "Tirada",
        "production_total": "Unidades fabricadas",
        "description": "Descripción",
        "notes": "Notas",
        "engine_cc": "Motor (cc)",
        "engine_code": "Código de motor",
        "bore_mm": "Diámetro (mm)",
        "stroke_mm": "Carrera (mm)",
        "compression_ratio": "Relación de compresión (:1)",
        "power_bhp": "Potencia (bhp)",
        "power_rpm": "Potencia a (rpm)",
        "torque_lbft": "Par (lb-ft)",
        "torque_rpm": "Par a (rpm)",
        "carburettor": "Carburación",
        "gearbox": "Caja de cambios",
        "final_drive": "Relación final (:1)",
        "brakes_front": "Frenos delanteros",
        "brakes_rear": "Frenos traseros",
        "wheels": "Llantas",
        "tyres": "Neumáticos",
        "kerb_weight_kg": "Peso en vacío (kg)",
        "top_speed_mph": "Velocidad máxima (mph)",
        "length_mm": "Longitud (mm)",
        "width_mm": "Anchura (mm)",
        "height_mm": "Altura (mm)",
        "wheelbase_mm": "Batalla (mm)"
      },
      "update_what": "¿Qué quieres actualizar?",
      "current": "ACTUAL",
      "your_value": "TU CORRECCIÓN",
      "not_recorded": "Sin registrar",
      "source": "Fuente",
      "source_required": "obligatoria en cada corrección de datos",
      "source_type": "Tipo de fuente",
      "source_title": "Referencia",
      "source_url": "Enlace",
      "source_title_hint": "p. ej. BMC Service Sheet A/12, 1965, p. 4",
      "source_url_hint": "Enlace a la fuente (opcional)",
      "source_types": {
        "book": "Libro",
        "brochure": "Folleto",
        "period_document": "Documento de época",
        "link": "Enlace web",
        "other": "Otro"
      },
      "photo_kind": "Tipo de foto",
      "photo_caption": "Pie de foto",
      "photo_credit": "Crédito (autor u origen)",
      "photo_kinds": {
        "brochure": "Folleto",
        "factory": "Fábrica",
        "period": "Época",
        "owner": "Propietario",
        "interior": "Interior",
        "engine": "Vano motor",
        "badge": "Emblema"
      },
      "colours_hint": "Separados por comas, p. ej. Tartan Red, Almond Green",
      "overseas": "Extranjero / fuera de la secuencia británica",
      "photos_title": "Fotos — {target}",
      "errors": {
        "name": "Añade el nombre de la variante.",
        "class": "Elige marca, familia y carrocería.",
        "year": "Indica el primer año (1959–2000).",
        "number": "Ese número está fuera de lo que el archivo acepta para este campo (p. ej. años 1959–2000, motor 500–2000 cc, compresión 5–15, números enteros donde se cuentan).",
        "value": "Introduce un valor nuevo distinto del actual.",
        "source": "Cita una fuente (al menos unos caracteres).",
        "years_order": "El último año no puede ser anterior al primero."
      }
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
      "variant": "Variante de modèle",
      "fix": "Correction ou ajout"
    },
    "kind_hints": {
      "document": "Scans, guides, fiches techniques, schémas.",
      "registry": "Votre voiture, plaque de châssis ou numéro de moteur.",
      "wheel": "Nouvelle jante, ou photos/spécifications d'une existante.",
      "variant": "Un modèle ou une finition de Mini : données, couleurs, photos.",
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
    },
    "variant": {
      "fields": {
        "photos": "Photos",
        "colours": "Couleurs d'usine",
        "name": "Nom",
        "marque": "Marque",
        "family": "Famille",
        "body_style": "Carrosserie",
        "mark": "Mark",
        "market": "Marché d'origine",
        "year_start": "Première année",
        "year_end": "Dernière année",
        "edition_size": "Taille de la série",
        "production_total": "Exemplaires produits",
        "description": "Description",
        "notes": "Notes",
        "engine_cc": "Moteur (cc)",
        "engine_code": "Code moteur",
        "bore_mm": "Alésage (mm)",
        "stroke_mm": "Course (mm)",
        "compression_ratio": "Taux de compression (:1)",
        "power_bhp": "Puissance (bhp)",
        "power_rpm": "Puissance à (rpm)",
        "torque_lbft": "Couple (lb-ft)",
        "torque_rpm": "Couple à (rpm)",
        "carburettor": "Alimentation",
        "gearbox": "Boîte de vitesses",
        "final_drive": "Rapport de pont (:1)",
        "brakes_front": "Freins avant",
        "brakes_rear": "Freins arrière",
        "wheels": "Jantes",
        "tyres": "Pneus",
        "kerb_weight_kg": "Poids à vide (kg)",
        "top_speed_mph": "Vitesse maxi (mph)",
        "length_mm": "Longueur (mm)",
        "width_mm": "Largeur (mm)",
        "height_mm": "Hauteur (mm)",
        "wheelbase_mm": "Empattement (mm)"
      },
      "update_what": "Que mettez-vous à jour ?",
      "current": "ACTUEL",
      "your_value": "VOTRE CORRECTION",
      "not_recorded": "Non renseigné",
      "source": "Source",
      "source_required": "obligatoire pour chaque correction",
      "source_type": "Type de source",
      "source_title": "Référence",
      "source_url": "Lien",
      "source_title_hint": "ex. BMC Service Sheet A/12, 1965, p. 4",
      "source_url_hint": "Lien vers la source (facultatif)",
      "source_types": {
        "book": "Livre",
        "brochure": "Brochure",
        "period_document": "Document d'époque",
        "link": "Lien web",
        "other": "Autre"
      },
      "photo_kind": "Type de photo",
      "photo_caption": "Légende",
      "photo_credit": "Crédit (auteur ou provenance)",
      "photo_kinds": {
        "brochure": "Brochure",
        "factory": "Usine",
        "period": "Époque",
        "owner": "Propriétaire",
        "interior": "Intérieur",
        "engine": "Compartiment moteur",
        "badge": "Badge"
      },
      "colours_hint": "Séparées par des virgules, ex. Tartan Red, Almond Green",
      "overseas": "Export / hors séquence britannique",
      "photos_title": "Photos — {target}",
      "errors": {
        "name": "Ajoutez le nom de la variante.",
        "class": "Choisissez la marque, la famille et la carrosserie.",
        "year": "Indiquez la première année (1959–2000).",
        "number": "Ce nombre est hors des limites acceptées pour ce champ (ex. années 1959–2000, moteur 500–2000 cc, compression 5–15, nombres entiers pour les quantités).",
        "value": "Saisissez une nouvelle valeur différente de l'actuelle.",
        "source": "Citez une source (quelques caractères au moins).",
        "years_order": "La dernière année ne peut pas précéder la première."
      }
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
      "variant": "Modellvariante",
      "fix": "Korrektur oder Ergänzung"
    },
    "kind_hints": {
      "document": "Scans, Anleitungen, Datenblätter, Diagramme.",
      "registry": "Dein Auto, Fahrgestellschild oder Motornummer.",
      "wheel": "Neues Rad oder Fotos/Daten zu einem vorhandenen.",
      "variant": "Ein Mini-Modell oder eine Ausstattung: Daten, Farben, Fotos.",
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
    },
    "variant": {
      "fields": {
        "photos": "Fotos",
        "colours": "Werksfarben",
        "name": "Name",
        "marque": "Marke",
        "family": "Baureihe",
        "body_style": "Karosserie",
        "mark": "Mark",
        "market": "Heimatmarkt",
        "year_start": "Erstes Jahr",
        "year_end": "Letztes Jahr",
        "edition_size": "Auflage",
        "production_total": "Stückzahl",
        "description": "Beschreibung",
        "notes": "Notizen",
        "engine_cc": "Motor (cc)",
        "engine_code": "Motorcode",
        "bore_mm": "Bohrung (mm)",
        "stroke_mm": "Hub (mm)",
        "compression_ratio": "Verdichtung (:1)",
        "power_bhp": "Leistung (bhp)",
        "power_rpm": "Leistung bei (rpm)",
        "torque_lbft": "Drehmoment (lb-ft)",
        "torque_rpm": "Drehmoment bei (rpm)",
        "carburettor": "Gemischaufbereitung",
        "gearbox": "Getriebe",
        "final_drive": "Achsübersetzung (:1)",
        "brakes_front": "Bremsen vorn",
        "brakes_rear": "Bremsen hinten",
        "wheels": "Räder",
        "tyres": "Reifen",
        "kerb_weight_kg": "Leergewicht (kg)",
        "top_speed_mph": "Höchstgeschwindigkeit (mph)",
        "length_mm": "Länge (mm)",
        "width_mm": "Breite (mm)",
        "height_mm": "Höhe (mm)",
        "wheelbase_mm": "Radstand (mm)"
      },
      "update_what": "Was möchten Sie aktualisieren?",
      "current": "AKTUELL",
      "your_value": "IHRE KORREKTUR",
      "not_recorded": "Nicht erfasst",
      "source": "Quelle",
      "source_required": "bei jeder Datenkorrektur Pflicht",
      "source_type": "Quellentyp",
      "source_title": "Quellenangabe",
      "source_url": "Link",
      "source_title_hint": "z. B. BMC Service Sheet A/12, 1965, S. 4",
      "source_url_hint": "Link zur Quelle (optional)",
      "source_types": {
        "book": "Buch",
        "brochure": "Prospekt",
        "period_document": "Zeitgenössisches Dokument",
        "link": "Weblink",
        "other": "Sonstiges"
      },
      "photo_kind": "Fototyp",
      "photo_caption": "Bildunterschrift",
      "photo_credit": "Urheber (wer hat es aufgenommen, woher stammt es)",
      "photo_kinds": {
        "brochure": "Prospekt",
        "factory": "Werk",
        "period": "Zeitgenössisch",
        "owner": "Besitzer",
        "interior": "Innenraum",
        "engine": "Motorraum",
        "badge": "Emblem"
      },
      "colours_hint": "Durch Kommas getrennt, z. B. Tartan Red, Almond Green",
      "overseas": "Übersee / außerhalb der britischen Reihe",
      "photos_title": "Fotos — {target}",
      "errors": {
        "name": "Geben Sie den Namen der Variante ein.",
        "class": "Wählen Sie Marke, Baureihe und Karosserie.",
        "year": "Geben Sie das erste Jahr ein (1959–2000).",
        "number": "Diese Zahl liegt außerhalb dessen, was das Archiv für dieses Feld annimmt (z. B. Jahre 1959–2000, Motor 500–2000 cc, Verdichtung 5–15, ganze Zahlen bei Stückzahlen).",
        "value": "Geben Sie einen neuen, abweichenden Wert ein.",
        "source": "Geben Sie eine Quelle an (mindestens einige Zeichen).",
        "years_order": "Das letzte Jahr darf nicht vor dem ersten liegen."
      }
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
      "variant": "Variante di modello",
      "fix": "Correzione o aggiunta"
    },
    "kind_hints": {
      "document": "Scansioni, guide, schede tecniche, schemi.",
      "registry": "La tua auto, targhetta telaio o numero motore.",
      "wheel": "Cerchio nuovo, o foto/dati di uno esistente.",
      "variant": "Un modello o allestimento Mini: dati, colori, foto.",
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
    },
    "variant": {
      "fields": {
        "photos": "Foto",
        "colours": "Colori di fabbrica",
        "name": "Nome",
        "marque": "Marca",
        "family": "Famiglia",
        "body_style": "Carrozzeria",
        "mark": "Mark",
        "market": "Mercato di origine",
        "year_start": "Primo anno",
        "year_end": "Ultimo anno",
        "edition_size": "Tiratura",
        "production_total": "Esemplari prodotti",
        "description": "Descrizione",
        "notes": "Note",
        "engine_cc": "Motore (cc)",
        "engine_code": "Codice motore",
        "bore_mm": "Alesaggio (mm)",
        "stroke_mm": "Corsa (mm)",
        "compression_ratio": "Rapporto di compressione (:1)",
        "power_bhp": "Potenza (bhp)",
        "power_rpm": "Potenza a (rpm)",
        "torque_lbft": "Coppia (lb-ft)",
        "torque_rpm": "Coppia a (rpm)",
        "carburettor": "Alimentazione",
        "gearbox": "Cambio",
        "final_drive": "Rapporto al ponte (:1)",
        "brakes_front": "Freni anteriori",
        "brakes_rear": "Freni posteriori",
        "wheels": "Cerchi",
        "tyres": "Pneumatici",
        "kerb_weight_kg": "Peso a vuoto (kg)",
        "top_speed_mph": "Velocità massima (mph)",
        "length_mm": "Lunghezza (mm)",
        "width_mm": "Larghezza (mm)",
        "height_mm": "Altezza (mm)",
        "wheelbase_mm": "Passo (mm)"
      },
      "update_what": "Cosa stai aggiornando?",
      "current": "ATTUALE",
      "your_value": "LA TUA CORREZIONE",
      "not_recorded": "Non registrato",
      "source": "Fonte",
      "source_required": "obbligatoria per ogni correzione",
      "source_type": "Tipo di fonte",
      "source_title": "Riferimento",
      "source_url": "Link",
      "source_title_hint": "es. BMC Service Sheet A/12, 1965, p. 4",
      "source_url_hint": "Link alla fonte (facoltativo)",
      "source_types": {
        "book": "Libro",
        "brochure": "Depliant",
        "period_document": "Documento d'epoca",
        "link": "Link web",
        "other": "Altro"
      },
      "photo_kind": "Tipo di foto",
      "photo_caption": "Didascalia",
      "photo_credit": "Crediti (autore o provenienza)",
      "photo_kinds": {
        "brochure": "Depliant",
        "factory": "Fabbrica",
        "period": "Epoca",
        "owner": "Proprietario",
        "interior": "Interni",
        "engine": "Vano motore",
        "badge": "Stemma"
      },
      "colours_hint": "Separati da virgole, es. Tartan Red, Almond Green",
      "overseas": "Estero / fuori dalla sequenza britannica",
      "photos_title": "Foto — {target}",
      "errors": {
        "name": "Aggiungi il nome della variante.",
        "class": "Scegli marca, famiglia e carrozzeria.",
        "year": "Inserisci il primo anno (1959–2000).",
        "number": "Quel numero è fuori dai limiti accettati per questo campo (es. anni 1959–2000, motore 500–2000 cc, compressione 5–15, numeri interi per le quantità).",
        "value": "Inserisci un nuovo valore diverso dall'attuale.",
        "source": "Cita una fonte (almeno qualche carattere).",
        "years_order": "L'ultimo anno non può precedere il primo."
      }
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
      "variant": "Variante de modelo",
      "fix": "Correção ou adição"
    },
    "kind_hints": {
      "document": "Digitalizações, guias, fichas técnicas, esquemas.",
      "registry": "O seu carro, chapa do chassi ou número do motor.",
      "wheel": "Jante nova, ou fotos/dados de uma existente.",
      "variant": "Um modelo ou versão Mini: dados, cores, fotos.",
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
    },
    "variant": {
      "fields": {
        "photos": "Fotos",
        "colours": "Cores de fábrica",
        "name": "Nome",
        "marque": "Marca",
        "family": "Família",
        "body_style": "Carroçaria",
        "mark": "Mark",
        "market": "Mercado de origem",
        "year_start": "Primeiro ano",
        "year_end": "Último ano",
        "edition_size": "Tiragem",
        "production_total": "Unidades produzidas",
        "description": "Descrição",
        "notes": "Notas",
        "engine_cc": "Motor (cc)",
        "engine_code": "Código do motor",
        "bore_mm": "Diâmetro (mm)",
        "stroke_mm": "Curso (mm)",
        "compression_ratio": "Taxa de compressão (:1)",
        "power_bhp": "Potência (bhp)",
        "power_rpm": "Potência a (rpm)",
        "torque_lbft": "Binário (lb-ft)",
        "torque_rpm": "Binário a (rpm)",
        "carburettor": "Carburação",
        "gearbox": "Caixa de velocidades",
        "final_drive": "Relação final (:1)",
        "brakes_front": "Travões dianteiros",
        "brakes_rear": "Travões traseiros",
        "wheels": "Jantes",
        "tyres": "Pneus",
        "kerb_weight_kg": "Peso em ordem de marcha (kg)",
        "top_speed_mph": "Velocidade máxima (mph)",
        "length_mm": "Comprimento (mm)",
        "width_mm": "Largura (mm)",
        "height_mm": "Altura (mm)",
        "wheelbase_mm": "Distância entre eixos (mm)"
      },
      "update_what": "O que está a atualizar?",
      "current": "ATUAL",
      "your_value": "A SUA CORREÇÃO",
      "not_recorded": "Não registado",
      "source": "Fonte",
      "source_required": "obrigatória em cada correção",
      "source_type": "Tipo de fonte",
      "source_title": "Referência",
      "source_url": "Ligação",
      "source_title_hint": "ex. BMC Service Sheet A/12, 1965, p. 4",
      "source_url_hint": "Ligação para a fonte (opcional)",
      "source_types": {
        "book": "Livro",
        "brochure": "Folheto",
        "period_document": "Documento de época",
        "link": "Ligação web",
        "other": "Outro"
      },
      "photo_kind": "Tipo de foto",
      "photo_caption": "Legenda",
      "photo_credit": "Crédito (autor ou origem)",
      "photo_kinds": {
        "brochure": "Folheto",
        "factory": "Fábrica",
        "period": "Época",
        "owner": "Proprietário",
        "interior": "Interior",
        "engine": "Compartimento do motor",
        "badge": "Emblema"
      },
      "colours_hint": "Separadas por vírgulas, ex. Tartan Red, Almond Green",
      "overseas": "Estrangeiro / fora da sequência britânica",
      "photos_title": "Fotos — {target}",
      "errors": {
        "name": "Adicione o nome da variante.",
        "class": "Escolha a marca, a família e a carroçaria.",
        "year": "Indique o primeiro ano (1959–2000).",
        "number": "Esse número está fora do que o arquivo aceita para este campo (ex. anos 1959–2000, motor 500–2000 cc, compressão 5–15, números inteiros nas contagens).",
        "value": "Introduza um valor novo, diferente do atual.",
        "source": "Cite uma fonte (pelo menos alguns caracteres).",
        "years_order": "O último ano não pode ser anterior ao primeiro."
      }
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
      "variant": "Модификация",
      "fix": "Исправление или дополнение"
    },
    "kind_hints": {
      "document": "Сканы, руководства, спецификации, схемы.",
      "registry": "Ваш автомобиль, шильдик кузова или номер двигателя.",
      "wheel": "Новый диск либо фото и данные для существующего.",
      "variant": "Модель или комплектация Mini: характеристики, цвета, фото.",
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
    },
    "variant": {
      "fields": {
        "photos": "Фото",
        "colours": "Заводские цвета",
        "name": "Название",
        "marque": "Марка",
        "family": "Семейство",
        "body_style": "Кузов",
        "mark": "Mark",
        "market": "Домашний рынок",
        "year_start": "Первый год",
        "year_end": "Последний год",
        "edition_size": "Тираж серии",
        "production_total": "Выпущено",
        "description": "Описание",
        "notes": "Примечания",
        "engine_cc": "Двигатель (cc)",
        "engine_code": "Код двигателя",
        "bore_mm": "Диаметр цилиндра (mm)",
        "stroke_mm": "Ход поршня (mm)",
        "compression_ratio": "Степень сжатия (:1)",
        "power_bhp": "Мощность (bhp)",
        "power_rpm": "Мощность при (rpm)",
        "torque_lbft": "Крутящий момент (lb-ft)",
        "torque_rpm": "Момент при (rpm)",
        "carburettor": "Питание",
        "gearbox": "Коробка передач",
        "final_drive": "Главная передача (:1)",
        "brakes_front": "Передние тормоза",
        "brakes_rear": "Задние тормоза",
        "wheels": "Колёса",
        "tyres": "Шины",
        "kerb_weight_kg": "Снаряжённая масса (kg)",
        "top_speed_mph": "Максимальная скорость (mph)",
        "length_mm": "Длина (mm)",
        "width_mm": "Ширина (mm)",
        "height_mm": "Высота (mm)",
        "wheelbase_mm": "Колёсная база (mm)"
      },
      "update_what": "Что вы обновляете?",
      "current": "СЕЙЧАС",
      "your_value": "ВАШЕ ИСПРАВЛЕНИЕ",
      "not_recorded": "Не указано",
      "source": "Источник",
      "source_required": "обязателен для каждой правки",
      "source_type": "Тип источника",
      "source_title": "Ссылка на источник",
      "source_url": "URL",
      "source_title_hint": "напр. BMC Service Sheet A/12, 1965, с. 4",
      "source_url_hint": "Ссылка на источник (необязательно)",
      "source_types": {
        "book": "Книга",
        "brochure": "Брошюра",
        "period_document": "Документ эпохи",
        "link": "Веб-ссылка",
        "other": "Другое"
      },
      "photo_kind": "Тип фото",
      "photo_caption": "Подпись",
      "photo_credit": "Автор (кто снял или откуда)",
      "photo_kinds": {
        "brochure": "Брошюра",
        "factory": "Заводское",
        "period": "Эпохи",
        "owner": "Владельца",
        "interior": "Салон",
        "engine": "Моторный отсек",
        "badge": "Эмблема"
      },
      "colours_hint": "Через запятую, напр. Tartan Red, Almond Green",
      "overseas": "Зарубежные / вне британской серии",
      "photos_title": "Фото — {target}",
      "errors": {
        "name": "Укажите название модификации.",
        "class": "Выберите марку, семейство и кузов.",
        "year": "Укажите первый год (1959–2000).",
        "number": "Это число вне допустимого диапазона для поля (напр. годы 1959–2000, двигатель 500–2000 см³, сжатие 5–15, целые числа для количеств).",
        "value": "Введите новое значение, отличное от текущего.",
        "source": "Укажите источник (хотя бы несколько символов).",
        "years_order": "Последний год не может быть раньше первого."
      }
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
      "variant": "モデルバリエーション",
      "fix": "修正または追記"
    },
    "kind_hints": {
      "document": "スキャン、ガイド、仕様書、図面。",
      "registry": "あなたの車、シャシープレート、エンジン番号。",
      "wheel": "新しいホイール、または既存のものの写真・仕様。",
      "variant": "Miniのモデルやグレード：スペック、カラー、写真。",
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
    },
    "variant": {
      "fields": {
        "photos": "写真",
        "colours": "工場カラー",
        "name": "名称",
        "marque": "メーカー",
        "family": "ファミリー",
        "body_style": "ボディ",
        "mark": "Mark",
        "market": "本国市場",
        "year_start": "初年",
        "year_end": "最終年",
        "edition_size": "限定台数",
        "production_total": "生産台数",
        "description": "説明",
        "notes": "メモ",
        "engine_cc": "エンジン (cc)",
        "engine_code": "エンジンコード",
        "bore_mm": "ボア (mm)",
        "stroke_mm": "ストローク (mm)",
        "compression_ratio": "圧縮比 (:1)",
        "power_bhp": "出力 (bhp)",
        "power_rpm": "出力回転数 (rpm)",
        "torque_lbft": "トルク (lb-ft)",
        "torque_rpm": "トルク回転数 (rpm)",
        "carburettor": "燃料供給",
        "gearbox": "ギアボックス",
        "final_drive": "ファイナルギア比 (:1)",
        "brakes_front": "フロントブレーキ",
        "brakes_rear": "リアブレーキ",
        "wheels": "ホイール",
        "tyres": "タイヤ",
        "kerb_weight_kg": "車両重量 (kg)",
        "top_speed_mph": "最高速度 (mph)",
        "length_mm": "全長 (mm)",
        "width_mm": "全幅 (mm)",
        "height_mm": "全高 (mm)",
        "wheelbase_mm": "ホイールベース (mm)"
      },
      "update_what": "何を更新しますか？",
      "current": "現在",
      "your_value": "修正内容",
      "not_recorded": "未記録",
      "source": "出典",
      "source_required": "スペック修正には必須",
      "source_type": "出典の種類",
      "source_title": "引用",
      "source_url": "リンク",
      "source_title_hint": "例：BMC Service Sheet A/12、1965年、4ページ",
      "source_url_hint": "出典へのリンク（任意）",
      "source_types": {
        "book": "書籍",
        "brochure": "カタログ",
        "period_document": "当時の資料",
        "link": "ウェブリンク",
        "other": "その他"
      },
      "photo_kind": "写真の種類",
      "photo_caption": "キャプション",
      "photo_credit": "クレジット（撮影者または出所）",
      "photo_kinds": {
        "brochure": "カタログ",
        "factory": "工場",
        "period": "当時",
        "owner": "オーナー",
        "interior": "内装",
        "engine": "エンジンルーム",
        "badge": "エンブレム"
      },
      "colours_hint": "カンマ区切り 例：Tartan Red, Almond Green",
      "overseas": "海外／英国の系列外",
      "photos_title": "写真 — {target}",
      "errors": {
        "name": "バリエーション名を入力してください。",
        "class": "メーカー、ファミリー、ボディを選択してください。",
        "year": "初年を入力してください（1959〜2000）。",
        "number": "この欄で受け付ける範囲外の数値です（例：年1959〜2000、排気量500〜2000cc、圧縮比5〜15、台数は整数）。",
        "value": "現在と異なる新しい値を入力してください。",
        "source": "出典を記入してください（数文字以上）。",
        "years_order": "最終年は初年より前にできません。"
      }
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
      "variant": "车型变体",
      "fix": "更正或补充"
    },
    "kind_hints": {
      "document": "扫描件、指南、规格表、图纸。",
      "registry": "你的车、车架铭牌或发动机号。",
      "wheel": "新轮毂，或现有轮毂的照片/参数。",
      "variant": "某款Mini车型或配置：参数、颜色、照片。",
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
    },
    "variant": {
      "fields": {
        "photos": "照片",
        "colours": "原厂颜色",
        "name": "名称",
        "marque": "品牌",
        "family": "系列",
        "body_style": "车身",
        "mark": "Mark",
        "market": "本土市场",
        "year_start": "首年",
        "year_end": "末年",
        "edition_size": "限量数量",
        "production_total": "生产数量",
        "description": "描述",
        "notes": "备注",
        "engine_cc": "发动机 (cc)",
        "engine_code": "发动机代码",
        "bore_mm": "缸径 (mm)",
        "stroke_mm": "行程 (mm)",
        "compression_ratio": "压缩比 (:1)",
        "power_bhp": "功率 (bhp)",
        "power_rpm": "功率转速 (rpm)",
        "torque_lbft": "扭矩 (lb-ft)",
        "torque_rpm": "扭矩转速 (rpm)",
        "carburettor": "供油方式",
        "gearbox": "变速箱",
        "final_drive": "主减速比 (:1)",
        "brakes_front": "前制动器",
        "brakes_rear": "后制动器",
        "wheels": "车轮",
        "tyres": "轮胎",
        "kerb_weight_kg": "整备质量 (kg)",
        "top_speed_mph": "最高时速 (mph)",
        "length_mm": "长度 (mm)",
        "width_mm": "宽度 (mm)",
        "height_mm": "高度 (mm)",
        "wheelbase_mm": "轴距 (mm)"
      },
      "update_what": "您要更新什么？",
      "current": "当前",
      "your_value": "您的修正",
      "not_recorded": "未记录",
      "source": "来源",
      "source_required": "每次参数修改都必须提供",
      "source_type": "来源类型",
      "source_title": "引用",
      "source_url": "链接",
      "source_title_hint": "例如 BMC Service Sheet A/12，1965年，第4页",
      "source_url_hint": "来源链接（可选）",
      "source_types": {
        "book": "书籍",
        "brochure": "宣传册",
        "period_document": "当年文献",
        "link": "网页链接",
        "other": "其他"
      },
      "photo_kind": "照片类型",
      "photo_caption": "说明",
      "photo_credit": "署名（拍摄者或出处）",
      "photo_kinds": {
        "brochure": "宣传册",
        "factory": "原厂",
        "period": "当年",
        "owner": "车主",
        "interior": "内饰",
        "engine": "发动机舱",
        "badge": "车标"
      },
      "colours_hint": "用逗号分隔，例如 Tartan Red, Almond Green",
      "overseas": "海外 / 不在英国序列中",
      "photos_title": "照片 — {target}",
      "errors": {
        "name": "请填写变体名称。",
        "class": "请选择品牌、系列和车身。",
        "year": "请填写首年（1959–2000）。",
        "number": "该数字超出此字段允许的范围（例如年份1959–2000、排量500–2000 cc、压缩比5–15、数量须为整数）。",
        "value": "请输入与当前值不同的新值。",
        "source": "请注明来源（至少几个字符）。",
        "years_order": "末年不能早于首年。"
      }
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
      "variant": "모델 변형",
      "fix": "수정 또는 추가"
    },
    "kind_hints": {
      "document": "스캔본, 가이드, 사양서, 도면.",
      "registry": "내 차, 섀시 플레이트, 엔진 번호.",
      "wheel": "새 휠, 또는 기존 휠의 사진·사양.",
      "variant": "Mini 모델 또는 트림: 제원, 색상, 사진.",
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
    },
    "variant": {
      "fields": {
        "photos": "사진",
        "colours": "공장 색상",
        "name": "이름",
        "marque": "브랜드",
        "family": "계열",
        "body_style": "차체",
        "mark": "Mark",
        "market": "본국 시장",
        "year_start": "첫 연도",
        "year_end": "마지막 연도",
        "edition_size": "한정 수량",
        "production_total": "생산 대수",
        "description": "설명",
        "notes": "메모",
        "engine_cc": "엔진 (cc)",
        "engine_code": "엔진 코드",
        "bore_mm": "보어 (mm)",
        "stroke_mm": "스트로크 (mm)",
        "compression_ratio": "압축비 (:1)",
        "power_bhp": "출력 (bhp)",
        "power_rpm": "출력 회전수 (rpm)",
        "torque_lbft": "토크 (lb-ft)",
        "torque_rpm": "토크 회전수 (rpm)",
        "carburettor": "연료 공급",
        "gearbox": "변속기",
        "final_drive": "종감속비 (:1)",
        "brakes_front": "앞 브레이크",
        "brakes_rear": "뒤 브레이크",
        "wheels": "휠",
        "tyres": "타이어",
        "kerb_weight_kg": "공차 중량 (kg)",
        "top_speed_mph": "최고 속도 (mph)",
        "length_mm": "전장 (mm)",
        "width_mm": "전폭 (mm)",
        "height_mm": "전고 (mm)",
        "wheelbase_mm": "휠베이스 (mm)"
      },
      "update_what": "무엇을 업데이트하시나요?",
      "current": "현재",
      "your_value": "수정 값",
      "not_recorded": "기록 없음",
      "source": "출처",
      "source_required": "모든 제원 수정에 필수",
      "source_type": "출처 유형",
      "source_title": "인용",
      "source_url": "링크",
      "source_title_hint": "예: BMC Service Sheet A/12, 1965, 4쪽",
      "source_url_hint": "출처 링크(선택)",
      "source_types": {
        "book": "책",
        "brochure": "카탈로그",
        "period_document": "당시 문서",
        "link": "웹 링크",
        "other": "기타"
      },
      "photo_kind": "사진 유형",
      "photo_caption": "캡션",
      "photo_credit": "크레딧(촬영자 또는 출처)",
      "photo_kinds": {
        "brochure": "카탈로그",
        "factory": "공장",
        "period": "당시",
        "owner": "오너",
        "interior": "실내",
        "engine": "엔진룸",
        "badge": "엠블럼"
      },
      "colours_hint": "쉼표로 구분, 예: Tartan Red, Almond Green",
      "overseas": "해외 / 영국 계열 외",
      "photos_title": "사진 — {target}",
      "errors": {
        "name": "변형 이름을 입력하세요.",
        "class": "브랜드, 계열, 차체를 선택하세요.",
        "year": "첫 연도를 입력하세요(1959–2000).",
        "number": "이 필드에서 허용하는 범위를 벗어난 숫자입니다(예: 연도 1959–2000, 배기량 500–2000cc, 압축비 5–15, 수량은 정수).",
        "value": "현재 값과 다른 새 값을 입력하세요.",
        "source": "출처를 입력하세요(몇 글자 이상).",
        "years_order": "마지막 연도는 첫 연도보다 앞설 수 없습니다."
      }
    }
  }
}
</i18n>
