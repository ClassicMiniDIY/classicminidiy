<script setup lang="ts">
  import { HERO_TYPES } from '~~/data/models/generic';
  import { MODEL_FILE_EXTS } from '~~/data/models/model-library';

  // Restrict the native file picker to supported model formats (derived from the
  // canonical list). addFiles() still re-validates for drag-drop / "All files".
  const FILE_ACCEPT = MODEL_FILE_EXTS.map((e) => `.${e}`).join(',');
  const SUPPORTED_FORMATS = MODEL_FILE_EXTS.map((e) => e.toUpperCase()).join(' · ');

  const { t } = useI18n();
  const { isAuthenticated, user } = useAuth();
  const supabase = useSupabase();

  // Paid pricing requires a connected Stripe seller (trust ≥ contributor +
  // charges_enabled). seller_can_sell is the same gate submit/checkout enforce —
  // so we disable the paid options up front rather than failing at submit.
  const canSell = ref(false);
  async function refreshCanSell() {
    if (!user.value) {
      canSell.value = false;
      return;
    }
    const { data } = await supabase.rpc('seller_can_sell', { p_user_id: user.value.id });
    canSell.value = !!data;
  }
  onMounted(refreshCanSell);
  watch(user, refreshCanSell);
  const router = useRouter();

  const w = useModelUpload();

  const { data: categoriesData } = await useFetch('/api/models/categories');
  const categories = computed(() => categoriesData.value?.categories ?? []);
  const { data: licensesData } = await useFetch('/api/models/licenses');
  const licenseOptions = computed(() =>
    (licensesData.value?.licenses ?? []).filter((l: any) => (w.isPaid.value ? l.is_paid_license : !l.is_paid_license))
  );
  // Keep the selected license valid for the chosen pricing mode.
  watch(
    () => w.pricingMode.value,
    () => {
      if (!licenseOptions.value.some((l: any) => l.code === w.licenseCode.value)) {
        w.licenseCode.value = licenseOptions.value[0]?.code || '';
      }
    }
  );

  // Dollar <-> cents proxies for the price inputs.
  function dollars(centsRef: typeof w.priceCents) {
    return computed({
      get: () => (centsRef.value == null ? '' : (centsRef.value / 100).toFixed(2)),
      set: (v: string) => {
        const n = parseFloat(v);
        centsRef.value = Number.isFinite(n) ? Math.round(n * 100) : null;
      },
    });
  }
  const priceDollars = dollars(w.priceCents);
  const suggestedDollars = dollars(w.suggestedPriceCents);

  const tagInput = ref('');
  function commitTags() {
    const parts = tagInput.value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    for (const p of parts) if (w.tags.value.length < 10 && !w.tags.value.includes(p)) w.tags.value.push(p);
    tagInput.value = '';
  }

  const fileInput = ref<HTMLInputElement | null>(null);
  const imageInput = ref<HTMLInputElement | null>(null);
  function onFilePick(e: Event) {
    const f = (e.target as HTMLInputElement).files;
    if (f) w.addFiles(Array.from(f));
    (e.target as HTMLInputElement).value = '';
  }
  function onImagePick(e: Event) {
    const f = (e.target as HTMLInputElement).files;
    if (f) w.addImages(Array.from(f));
    (e.target as HTMLInputElement).value = '';
  }
  function onDropFiles(e: DragEvent) {
    if (e.dataTransfer?.files?.length) w.addFiles(Array.from(e.dataTransfer.files));
  }
  function onDropImages(e: DragEvent) {
    if (e.dataTransfer?.files?.length) w.addImages(Array.from(e.dataTransfer.files));
  }

  function addHardware() {
    w.hardwareBom.value.push({ item: '', quantity: 1, optional: false });
  }
  function addStep() {
    if (!w.assembly.value.steps) w.assembly.value.steps = [];
    w.assembly.value.steps.push('');
  }

  const toolInput = ref('');
  function commitTool() {
    const t = toolInput.value.trim();
    if (t) {
      if (!w.assembly.value.toolsRequired) w.assembly.value.toolsRequired = [];
      w.assembly.value.toolsRequired.push(t);
      toolInput.value = '';
    }
  }

  function fmtBytes(n: number) {
    return n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  async function onNext() {
    if (w.step.value === 1) {
      const ok = await w.ensureDraft();
      if (ok) w.next();
      return;
    }
    if (w.step.value === 4 || w.step.value === 5) await w.saveVersionMeta();
    w.next();
  }

  const submitted = ref<{ status: string; slug: string } | null>(null);
  async function onSubmit() {
    const res = await w.submit();
    if (res) {
      submitted.value = res;
      if (res.status === 'published' && res.slug) {
        setTimeout(() => router.push(`/models/${res.slug}`), 1500);
      }
    }
  }

  const pricingChoices = computed(() => [
    { value: 'free', label: t('step1.pricingFree'), paid: false },
    // Tips, pwyw, and fixed all move money through the seller's Stripe account,
    // so all three are gated behind seller onboarding — only Free is ungated.
    { value: 'tips', label: t('step1.pricingTips'), paid: true },
    { value: 'pwyw', label: t('step1.pricingPwyw'), paid: true },
    { value: 'fixed', label: t('step1.pricingFixed'), paid: true },
  ]);

  // Resume/edit: ?model=<id> loads an existing model client-side (needs the
  // session token, which lives in localStorage).
  const route = useRoute();

  // Pre-wizard mode chooser: upload your own model vs. link one found online.
  // Editing/resuming (?model=) skips straight to the wizard.
  const { track } = useAnalytics();
  const shareChoice = ref<'own' | 'external' | ''>('');
  const shareMode = ref<'choose' | 'own'>(
    typeof route.query.model === 'string' && route.query.model ? 'own' : 'choose'
  );
  function onShareContinue() {
    if (!shareChoice.value) return;
    track('model_share_path_chosen', { path: shareChoice.value });
    if (shareChoice.value === 'external') return navigateTo('/models/submit-external');
    shareMode.value = 'own';
  }

  const loadingExisting = ref(false);
  onMounted(async () => {
    const id = route.query.model;
    if (typeof id === 'string' && id) {
      loadingExisting.value = true;
      await w.loadExisting(id);
      loadingExisting.value = false;
    }
  });

  // A new draft version on an already-published model (vs resuming a first draft).
  const isNewVersion = computed(
    () => w.isEditing.value && w.modelStatus.value === 'published' && (w.versionNumber.value ?? 1) > 1
  );

  // Content-only edit (published model, no open draft): just save the basics.
  async function onSaveContent() {
    const ok = await w.ensureDraft();
    if (ok) submitted.value = { status: 'saved', slug: w.slug.value || '' };
  }

  useHead(() => ({
    title: w.isEditing.value ? t('meta.titleEdit') : t('meta.titleUpload'),
  }));
  definePageMeta({ key: 'models-upload' });
</script>

<template>
  <hero
    :navigation="true"
    :title="w.isEditing.value ? t('hero.edit') : t('hero.upload')"
    :heroType="HERO_TYPES.ARCHIVE"
  />
  <div class="container mx-auto px-4 max-w-3xl pb-16">
    <breadcrumb
      class="my-6"
      :page="w.isEditing.value ? t('breadcrumb.edit') : t('breadcrumb.upload')"
      subpage="3D Models"
      subpageHref="/models"
    />

    <!-- Not signed in -->
    <div v-if="!isAuthenticated" class="card bg-base-100 border border-base-300 shadow-sm my-10">
      <div class="card-body items-center text-center gap-3">
        <i class="fas fa-right-to-bracket text-4xl text-primary"></i>
        <h2 class="card-title">{{ t('auth.signInTitle') }}</h2>
        <p class="opacity-70">{{ t('auth.signInBody') }}</p>
        <NuxtLink to="/login" class="btn btn-primary"><i class="fas fa-right-to-bracket mr-1"></i> {{ t('auth.signInBtn') }}</NuxtLink>
      </div>
    </div>

    <!-- Loading an existing model -->
    <div v-else-if="loadingExisting" class="flex justify-center py-20">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Success -->
    <div v-else-if="submitted" class="card bg-base-100 border border-base-300 shadow-sm my-10">
      <div class="card-body items-center text-center gap-3">
        <i class="fas fa-circle-check text-5xl text-success"></i>
        <h2 class="card-title">
          {{
            submitted.status === 'saved'
              ? t('success.savedTitle')
              : submitted.status === 'published'
                ? t('success.publishedTitle')
                : t('success.pendingTitle')
          }}
        </h2>
        <p class="opacity-70">
          {{
            submitted.status === 'saved'
              ? t('success.savedBody')
              : submitted.status === 'published'
                ? t('success.publishedBody')
                : t('success.pendingBody')
          }}
        </p>
        <div class="flex gap-2">
          <NuxtLink to="/dashboard/models" class="btn btn-primary">{{ t('success.myModels') }}</NuxtLink>
          <NuxtLink
            v-if="submitted.slug && submitted.status === 'published'"
            :to="`/models/${submitted.slug}`"
            class="btn btn-ghost"
            >{{ t('success.view') }}</NuxtLink
          >
        </div>
      </div>
    </div>

    <!-- MODE CHOOSER: upload your own model vs. link one found online -->
    <template v-else-if="shareMode === 'choose' && !w.isEditing.value">
      <div class="my-6">
        <div class="text-center mb-6">
          <h2 class="text-2xl font-bold">{{ t('choose.heading') }}</h2>
          <p class="opacity-70 mt-1">{{ t('choose.subheading') }}</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            class="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer border-2"
            :class="shareChoice === 'own' ? 'border-primary' : 'border-transparent'"
            @click="shareChoice = 'own'"
            @dblclick="onShareContinue"
          >
            <div class="card-body items-center text-center py-8 gap-2">
              <span class="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-2">
                <i class="fas fa-cloud-arrow-up text-3xl"></i>
              </span>
              <h3 class="card-title">{{ t('choose.ownTitle') }}</h3>
              <p class="text-base-content/70 text-sm">{{ t('choose.ownDesc') }}</p>
            </div>
          </button>

          <button
            type="button"
            class="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer border-2"
            :class="shareChoice === 'external' ? 'border-primary' : 'border-transparent'"
            @click="shareChoice = 'external'"
            @dblclick="onShareContinue"
          >
            <div class="card-body items-center text-center py-8 gap-2">
              <span class="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-2">
                <i class="fas fa-arrow-up-right-from-square text-3xl"></i>
              </span>
              <h3 class="card-title">{{ t('choose.externalTitle') }}</h3>
              <p class="text-base-content/70 text-sm">{{ t('choose.externalDesc') }}</p>
            </div>
          </button>
        </div>

        <div class="flex justify-end mt-6">
          <button type="button" class="btn btn-primary" :disabled="!shareChoice" @click="onShareContinue">
            {{ t('choose.continue') }} <i class="fas fa-arrow-right ml-1"></i>
          </button>
        </div>
      </div>
    </template>

    <template v-else>
      <!-- Steps indicator -->
      <ul v-if="!w.contentOnly.value" class="steps steps-horizontal w-full mb-6 text-xs">
        <li class="step" :class="{ 'step-primary': w.step.value >= 1 }">{{ t('steps.basics') }}</li>
        <li class="step" :class="{ 'step-primary': w.step.value >= 2 }">{{ t('steps.files') }}</li>
        <li class="step" :class="{ 'step-primary': w.step.value >= 3 }">{{ t('steps.images') }}</li>
        <li class="step" :class="{ 'step-primary': w.step.value >= 4 }">{{ t('steps.print') }}</li>
        <li class="step" :class="{ 'step-primary': w.step.value >= 5 }">{{ t('steps.assembly') }}</li>
        <li class="step" :class="{ 'step-primary': w.step.value >= 6 }">{{ t('steps.review') }}</li>
      </ul>

      <div v-if="w.error.value" class="alert alert-error mb-4">
        <i class="fas fa-circle-exclamation"></i> <span>{{ w.error.value }}</span>
      </div>

      <!-- Contextual guidance for the edit / new-version flows -->
      <div v-if="w.contentOnly.value" class="alert alert-info alert-soft mb-4 items-start">
        <i class="fas fa-circle-info mt-0.5"></i>
        <span class="text-sm">{{ t('context.contentOnly') }}</span>
      </div>
      <div v-else-if="isNewVersion" class="alert alert-info alert-soft mb-4 items-start">
        <i class="fas fa-code-branch mt-0.5"></i>
        <span class="text-sm">{{ t('context.newVersion', { version: w.versionNumber.value }) }}</span>
      </div>

      <div class="card bg-base-100 border border-base-300 shadow-sm">
        <div class="card-body gap-2">
          <!-- STEP 1: BASICS -->
          <div v-show="w.step.value === 1" class="space-y-2">
            <h2 class="card-title mb-2">{{ t('step1.heading') }}</h2>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('step1.titleLabel') }}</legend>
              <input
                v-model="w.title.value"
                type="text"
                maxlength="120"
                class="input w-full"
                :placeholder="t('step1.titlePlaceholder')"
              />
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('step1.summaryLabel') }}</legend>
              <input
                v-model="w.summary.value"
                type="text"
                maxlength="280"
                class="input w-full"
                :placeholder="t('step1.summaryPlaceholder')"
              />
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('step1.descriptionLabel') }}</legend>
              <textarea
                v-model="w.description.value"
                rows="4"
                maxlength="20000"
                class="textarea w-full"
                :placeholder="t('step1.descriptionPlaceholder')"
              ></textarea>
            </fieldset>

            <div class="grid sm:grid-cols-2 gap-x-4">
              <fieldset class="fieldset">
                <legend class="fieldset-legend">{{ t('step1.categoryLabel') }}</legend>
                <select v-model="w.categorySlug.value" class="select w-full">
                  <option value="" disabled>{{ t('step1.categoryPlaceholder') }}</option>
                  <option v-for="c in categories" :key="c.slug" :value="c.slug">{{ c.name }}</option>
                </select>
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">{{ t('step1.sourceUrlLabel') }}</legend>
                <input
                  v-model="w.sourceUrl.value"
                  type="url"
                  class="input w-full"
                  :placeholder="t('step1.sourceUrlPlaceholder')"
                />
              </fieldset>
            </div>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('step1.tagsLabel') }}</legend>
              <input
                v-model="tagInput"
                type="text"
                class="input w-full"
                :placeholder="t('step1.tagsPlaceholder')"
                @keydown.enter.prevent="commitTags"
                @blur="commitTags"
              />
              <div v-if="w.tags.value.length" class="flex flex-wrap gap-1.5 mt-2">
                <span v-for="(tag, i) in w.tags.value" :key="tag" class="badge badge-neutral gap-1">
                  {{ tag }}
                  <button type="button" @click="w.tags.value.splice(i, 1)">
                    <i class="fas fa-xmark text-[0.6rem]"></i>
                  </button>
                </span>
              </div>
            </fieldset>

            <div class="divider text-sm">{{ t('step1.pricingDivider') }}</div>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('step1.pricingLabel') }}</legend>
              <div class="join">
                <button
                  v-for="p in pricingChoices"
                  :key="p.value"
                  type="button"
                  class="btn join-item btn-sm"
                  :class="w.pricingMode.value === p.value ? 'btn-primary' : 'btn-outline'"
                  :disabled="p.paid && !canSell"
                  @click="w.pricingMode.value = p.value"
                >
                  {{ p.label }}
                </button>
              </div>
              <p v-if="!canSell" class="label">
                <i class="fas fa-circle-info mr-1"></i> {{ t('step1.sellGate') }}
                <NuxtLink to="/dashboard/selling" class="link link-primary ml-1">{{ t('step1.sellGateCta') }}</NuxtLink>
              </p>
            </fieldset>

            <div v-if="w.pricingMode.value === 'fixed'" class="grid grid-cols-2 gap-x-4">
              <fieldset class="fieldset">
                <legend class="fieldset-legend">{{ t('step1.priceUsd') }}</legend>
                <input
                  v-model="priceDollars"
                  type="number"
                  min="1"
                  step="0.50"
                  class="input w-full"
                  placeholder="9.99"
                />
              </fieldset>
            </div>
            <div v-else-if="w.pricingMode.value === 'pwyw'" class="grid grid-cols-2 gap-x-4">
              <fieldset class="fieldset">
                <legend class="fieldset-legend">{{ t('step1.suggestedUsd') }}</legend>
                <input
                  v-model="suggestedDollars"
                  type="number"
                  min="1"
                  step="0.50"
                  class="input w-full"
                  placeholder="5.00"
                />
                <p class="label">{{ t('step1.pwywHint') }}</p>
              </fieldset>
            </div>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('step1.licenseLabel') }}</legend>
              <select v-model="w.licenseCode.value" class="select w-full">
                <option value="" disabled>{{ t('step1.licensePlaceholder') }}</option>
                <option v-for="l in licenseOptions" :key="l.code" :value="l.code">{{ l.name }}</option>
              </select>
              <p class="label">
                <NuxtLink
                  v-if="w.isPaid.value"
                  to="/legal/paid-file-license"
                  target="_blank"
                  class="link link-primary"
                >
                  {{ t('step1.licensePaidLink') }}
                </NuxtLink>
                <a v-else href="https://creativecommons.org/licenses/" target="_blank" rel="noopener" class="link link-primary">
                  {{ t('step1.licenseCcLink') }}
                </a>
              </p>
            </fieldset>

            <label class="flex items-start gap-3 cursor-pointer mt-2">
              <input v-model="w.safetyCritical.value" type="checkbox" class="checkbox checkbox-warning mt-0.5" />
              <span class="text-sm">{{ t('step1.safetyCritical') }}</span>
            </label>
          </div>

          <!-- STEP 2: FILES -->
          <div v-show="w.step.value === 2" class="space-y-3">
            <h2 class="card-title">{{ t('step2.heading') }}</h2>
            <p class="text-sm opacity-70">
              {{ t('step2.hint', { maxFiles: w.MAX_FILES }) }}
            </p>
            <div
              class="border-2 border-dashed border-base-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary transition-colors"
              @click="fileInput?.click()"
              @drop.prevent="onDropFiles"
              @dragover.prevent
            >
              <i class="fas fa-cloud-arrow-up text-3xl opacity-50"></i>
              <p class="mt-2 text-sm">{{ t('step2.dropzone') }}</p>
              <p class="mt-1 text-xs opacity-50">{{ SUPPORTED_FORMATS }}</p>
              <input ref="fileInput" type="file" :accept="FILE_ACCEPT" multiple class="hidden" @change="onFilePick" />
            </div>
            <ul v-if="w.files.value.length" class="space-y-2">
              <li
                v-for="f in w.files.value"
                :key="f.name + f.sizeBytes"
                class="flex items-center gap-3 p-2 rounded-lg bg-base-200"
              >
                <i class="fas" :class="f.isRenderable ? 'fa-cube text-primary' : 'fa-file'"></i>
                <div class="flex-1 min-w-0">
                  <p class="text-sm truncate">
                    {{ f.name }} <span class="opacity-50">· {{ fmtBytes(f.sizeBytes) }}</span>
                  </p>
                  <progress
                    v-if="f.status === 'uploading'"
                    class="progress progress-primary h-1.5 w-full"
                    :value="f.progress"
                    max="100"
                  ></progress>
                  <p
                    v-else
                    class="text-xs"
                    :class="{
                      'text-success': f.status === 'uploaded',
                      'text-error': f.status === 'error',
                      'opacity-60': f.status === 'verifying' || f.status === 'pending',
                    }"
                  >
                    {{
                      {
                        uploading: t('fileStatus.uploading'),
                        verifying: t('fileStatus.verifying'),
                        uploaded: t('fileStatus.uploaded'),
                        error: f.error || t('fileStatus.failed'),
                        pending: t('fileStatus.pending'),
                      }[f.status]
                    }}
                  </p>
                </div>
                <button type="button" class="btn btn-ghost btn-xs btn-square" @click="w.removeFile(f.fileId)">
                  <i class="fas fa-trash"></i>
                </button>
              </li>
            </ul>
          </div>

          <!-- STEP 3: IMAGES -->
          <div v-show="w.step.value === 3" class="space-y-3">
            <h2 class="card-title">{{ t('step3.heading') }}</h2>
            <p class="text-sm opacity-70">
              {{ t('step3.hint', { maxImages: w.MAX_IMAGES }) }}
            </p>
            <div
              class="border-2 border-dashed border-base-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary transition-colors"
              @click="imageInput?.click()"
              @drop.prevent="onDropImages"
              @dragover.prevent
            >
              <i class="fas fa-image text-3xl opacity-50"></i>
              <p class="mt-2 text-sm">{{ t('step3.dropzone') }}</p>
              <input ref="imageInput" type="file" accept="image/*" multiple class="hidden" @change="onImagePick" />
            </div>
            <div v-if="w.images.value.length" class="grid grid-cols-3 sm:grid-cols-4 gap-3">
              <div
                v-for="img in w.images.value"
                :key="img.url"
                class="relative aspect-square rounded-lg overflow-hidden border border-base-300 group"
              >
                <img
                  :src="img.url"
                  class="w-full h-full object-cover"
                  :class="{ 'opacity-50': img.status === 'uploading' }"
                />
                <span v-if="img.isPrimary" class="absolute top-1 left-1 badge badge-primary badge-xs">{{ t('step3.coverBadge') }}</span>
                <span
                  v-if="img.status === 'error'"
                  class="absolute inset-0 flex items-center justify-center bg-error/70 text-xs text-white"
                  >{{ t('step3.imageFailed') }}</span
                >
                <button
                  type="button"
                  class="absolute top-1 right-1 btn btn-error btn-xs btn-circle opacity-0 group-hover:opacity-100"
                  @click="w.removeImage(img.id || img.url)"
                >
                  <i class="fas fa-xmark"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- STEP 4: PRINT SETTINGS -->
          <div v-show="w.step.value === 4" class="space-y-2">
            <h2 class="card-title mb-2">{{ t('step4.heading') }}</h2>
            <div class="grid sm:grid-cols-2 gap-x-4">
              <fieldset class="fieldset">
                <legend class="fieldset-legend">{{ t('step4.material') }}</legend>
                <input v-model="w.printSettings.value.recommendedMaterial" class="input w-full" placeholder="PLA" />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">{{ t('step4.layerHeight') }}</legend>
                <input
                  v-model.number="w.printSettings.value.layerHeight"
                  type="number"
                  step="0.04"
                  class="input w-full"
                />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">{{ t('step4.infill') }}</legend>
                <input v-model.number="w.printSettings.value.infillPercent" type="number" class="input w-full" />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">{{ t('step4.walls') }}</legend>
                <input v-model.number="w.printSettings.value.wallCount" type="number" class="input w-full" />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">{{ t('step4.nozzle') }}</legend>
                <input
                  v-model.number="w.printSettings.value.nozzleSize"
                  type="number"
                  step="0.1"
                  class="input w-full"
                />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">{{ t('step4.estTime') }}</legend>
                <input
                  v-model.number="w.printSettings.value.estimatedTimeHours"
                  type="number"
                  step="0.5"
                  class="input w-full"
                />
              </fieldset>
            </div>
            <label class="flex items-center gap-3 cursor-pointer">
              <input v-model="w.printSettings.value.supportsRequired" type="checkbox" class="checkbox" />
              <span class="text-sm">{{ t('step4.supportsRequired') }}</span>
            </label>
            <fieldset class="fieldset">
              <legend class="fieldset-legend">{{ t('step4.notesLabel') }}</legend>
              <textarea
                v-model="w.printSettings.value.notes"
                rows="2"
                class="textarea w-full"
                :placeholder="t('step4.notesPlaceholder')"
              ></textarea>
            </fieldset>
          </div>

          <!-- STEP 5: HARDWARE + ASSEMBLY -->
          <div v-show="w.step.value === 5" class="space-y-5">
            <div>
              <div class="flex items-center justify-between">
                <h2 class="card-title">{{ t('step5.hardwareHeading') }}</h2>
                <button type="button" class="btn btn-ghost btn-sm" @click="addHardware">
                  <i class="fas fa-plus mr-1"></i> {{ t('step5.addItem') }}
                </button>
              </div>
              <div v-for="(h, i) in w.hardwareBom.value" :key="i" class="flex gap-2 mt-2 items-center">
                <input v-model="h.item" class="input input-sm flex-1" :placeholder="t('step5.hardwarePlaceholder')" />
                <input v-model.number="h.quantity" type="number" min="1" class="input input-sm w-20" />
                <button type="button" class="btn btn-ghost btn-sm btn-square" @click="w.hardwareBom.value.splice(i, 1)">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            <div>
              <h2 class="card-title">{{ t('step5.assemblyHeading') }}</h2>
              <div class="grid sm:grid-cols-2 gap-x-4 mt-2">
                <fieldset class="fieldset">
                  <legend class="fieldset-legend">{{ t('step5.difficulty') }}</legend>
                  <select v-model="w.assembly.value.difficulty" class="select select-sm w-full">
                    <option value="easy">{{ t('step5.difficultyEasy') }}</option>
                    <option value="moderate">{{ t('step5.difficultyModerate') }}</option>
                    <option value="advanced">{{ t('step5.difficultyAdvanced') }}</option>
                  </select>
                </fieldset>
                <fieldset class="fieldset">
                  <legend class="fieldset-legend">{{ t('step5.estTimeMin') }}</legend>
                  <input
                    v-model.number="w.assembly.value.estimatedTimeMinutes"
                    type="number"
                    class="input input-sm w-full"
                  />
                </fieldset>
              </div>
              <fieldset class="fieldset mt-1">
                <legend class="fieldset-legend">{{ t('step5.toolsLabel') }}</legend>
                <input
                  v-model="toolInput"
                  class="input input-sm w-full"
                  :placeholder="t('step5.toolsPlaceholder')"
                  @keydown.enter.prevent="commitTool"
                />
                <div v-if="w.assembly.value.toolsRequired?.length" class="flex flex-wrap gap-1.5 mt-2">
                  <span v-for="(tool, i) in w.assembly.value.toolsRequired" :key="tool" class="badge badge-ghost gap-1">
                    {{ tool }}
                    <button type="button" @click="w.assembly.value.toolsRequired!.splice(i, 1)">
                      <i class="fas fa-xmark text-[0.6rem]"></i>
                    </button>
                  </span>
                </div>
              </fieldset>
              <div class="flex items-center justify-between mt-3">
                <span class="fieldset-legend">{{ t('step5.stepsLabel') }}</span>
                <button type="button" class="btn btn-ghost btn-sm" @click="addStep">
                  <i class="fas fa-plus mr-1"></i> {{ t('step5.addStep') }}
                </button>
              </div>
              <div v-for="(s, i) in w.assembly.value.steps || []" :key="i" class="flex gap-2 mt-2 items-start">
                <span class="badge badge-primary badge-sm mt-2">{{ i + 1 }}</span>
                <textarea v-model="w.assembly.value.steps![i]" rows="1" class="textarea textarea-sm flex-1"></textarea>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm btn-square"
                  @click="w.assembly.value.steps!.splice(i, 1)"
                >
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- STEP 6: REVIEW -->
          <div v-show="w.step.value === 6" class="space-y-4">
            <h2 class="card-title">{{ t('step6.heading') }}</h2>
            <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt class="opacity-60">{{ t('step6.labelTitle') }}</dt>
              <dd>{{ w.title.value }}</dd>
              <dt class="opacity-60">{{ t('step6.labelCategory') }}</dt>
              <dd>{{ categories.find((c: any) => c.slug === w.categorySlug.value)?.name }}</dd>
              <dt class="opacity-60">{{ t('step6.labelLicense') }}</dt>
              <dd>{{ w.licenseCode.value }}</dd>
              <dt class="opacity-60">{{ t('step6.labelPricing') }}</dt>
              <dd class="capitalize">{{ w.pricingMode.value }}</dd>
              <dt class="opacity-60">{{ t('step6.labelFiles') }}</dt>
              <dd>{{ t('step6.filesUploaded', { count: w.files.value.filter((f) => f.status === 'uploaded').length }) }}</dd>
              <dt class="opacity-60">{{ t('step6.labelImages') }}</dt>
              <dd>{{ w.images.value.length }}</dd>
            </dl>
            <ModelsSafetyDisclaimer :safety-critical="w.safetyCritical.value" />
            <label class="flex items-start gap-3 cursor-pointer">
              <input v-model="w.safetyAck.value" type="checkbox" class="checkbox checkbox-primary mt-0.5" />
              <span class="text-sm">{{ t('step6.safetyAck') }}</span>
            </label>
            <p class="text-xs opacity-60">
              {{ t('step6.termsPrefix') }}
              <NuxtLink to="/legal/model-terms" target="_blank" class="link link-primary">{{ t('step6.termsLink') }}</NuxtLink>.
            </p>
          </div>

          <!-- NAV -->
          <div class="flex justify-between items-center pt-4 mt-2 border-t border-base-300">
            <!-- Content-only edit (published model): just save the basics -->
            <template v-if="w.contentOnly.value">
              <NuxtLink to="/dashboard/models" class="btn btn-ghost">{{ t('nav.cancel') }}</NuxtLink>
              <button
                type="button"
                class="btn btn-primary"
                :disabled="!w.canProceedStep1.value || w.saving.value"
                @click="onSaveContent"
              >
                <span v-if="w.saving.value" class="loading loading-spinner loading-sm"></span>
                <i v-else class="fas fa-floppy-disk mr-1"></i> {{ t('nav.saveChanges') }}
              </button>
            </template>

            <button
              v-if="!w.contentOnly.value"
              type="button"
              class="btn btn-ghost"
              :disabled="w.step.value === 1 || w.saving.value"
              @click="w.prev"
            >
              <i class="fas fa-arrow-left mr-1"></i> {{ t('nav.back') }}
            </button>
            <button
              v-if="!w.contentOnly.value && w.step.value < 6"
              type="button"
              class="btn btn-primary"
              :disabled="
                (w.step.value === 1 && !w.canProceedStep1.value) ||
                (w.step.value === 2 && !w.canProceedStep2.value) ||
                w.saving.value
              "
              @click="onNext"
            >
              <span v-if="w.saving.value" class="loading loading-spinner loading-sm"></span>
              {{ t('nav.next') }} <i class="fas fa-arrow-right ml-1"></i>
            </button>
            <button
              v-if="!w.contentOnly.value && w.step.value >= 6"
              type="button"
              class="btn btn-primary"
              :disabled="!w.canSubmit.value || w.saving.value"
              @click="onSubmit"
            >
              <span v-if="w.saving.value" class="loading loading-spinner loading-sm"></span>
              <i v-else class="fas fa-paper-plane mr-1"></i> {{ t('nav.submit') }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "meta": {
      "titleEdit": "Edit model | Classic Mini DIY",
      "titleUpload": "Upload a model | Classic Mini DIY"
    },
    "hero": {
      "edit": "Edit a 3D Model",
      "upload": "Share a 3D Model"
    },
    "breadcrumb": {
      "edit": "Edit",
      "upload": "Upload"
    },
    "auth": {
      "signInTitle": "Sign in to share a model",
      "signInBody": "You need an account to contribute models to the library.",
      "signInBtn": "Sign in"
    },
    "success": {
      "savedTitle": "Changes saved",
      "publishedTitle": "Published!",
      "pendingTitle": "Submitted for review",
      "savedBody": "Your model details have been updated.",
      "publishedBody": "Your model is live — taking you there…",
      "pendingBody": "Thanks! Our moderators will review it shortly. You can track it under My Models.",
      "myModels": "My Models",
      "view": "View"
    },
    "steps": {
      "basics": "Basics",
      "files": "Files",
      "images": "Images",
      "print": "Print",
      "assembly": "Assembly",
      "review": "Review"
    },
    "context": {
      "contentOnly": "You're editing the currently published version. These details update live for everyone. The model files can't be changed here — to publish different files, start a new version from My Models instead.",
      "newVersion": "You're creating version {version}. Your previous versions stay available — buyers and anyone who's downloaded the model keep access to every version, past and future."
    },
    "step1": {
      "heading": "The basics",
      "titleLabel": "Title",
      "titlePlaceholder": "e.g. Smiths gauge pod (52 mm)",
      "summaryLabel": "Summary",
      "summaryPlaceholder": "One-line description",
      "descriptionLabel": "Description",
      "descriptionPlaceholder": "What it is, how it prints, what it fits…",
      "categoryLabel": "Category",
      "categoryPlaceholder": "Choose a category",
      "sourceUrlLabel": "Source URL",
      "sourceUrlPlaceholder": "Original design (optional)",
      "tagsLabel": "Tags",
      "tagsPlaceholder": "Comma-separated, press Enter",
      "pricingDivider": "Pricing & license",
      "pricingLabel": "Pricing",
      "pricingFree": "Free",
      "pricingTips": "Free + tips",
      "pricingPwyw": "Pay what you want",
      "pricingFixed": "Fixed price",
      "sellGate": "Selling needs a connected Stripe account.",
      "sellGateCta": "Set up selling",
      "pwywHint": "Buyers pay what they want — you only set a suggested amount.",
      "priceUsd": "Price (USD)",
      "minimumUsd": "Minimum (USD)",
      "suggestedUsd": "Suggested (USD)",
      "licenseLabel": "License",
      "licensePlaceholder": "Choose a license",
      "licensePaidLink": "Read the Paid File License terms",
      "licenseCcLink": "About Creative Commons licenses",
      "safetyCritical": "This is a safety-critical part (structural, braking, steering, fuel)"
    },
    "step2": {
      "heading": "Model files",
      "hint": "STL, 3MF, OBJ, STEP, F3D and more — up to 200 MB each, {maxFiles} files.",
      "dropzone": "Drag files here or click to browse"
    },
    "fileStatus": {
      "uploading": "Uploading…",
      "verifying": "Verifying…",
      "uploaded": "Uploaded",
      "failed": "Failed",
      "pending": "Queued"
    },
    "step3": {
      "heading": "Images",
      "hint": "Photos or renders — JPG/PNG/WebP, 10 MB max, up to {maxImages}. The first is the cover.",
      "dropzone": "Drag images here or click to browse",
      "coverBadge": "Cover",
      "imageFailed": "Failed"
    },
    "step4": {
      "heading": "Print settings",
      "material": "Recommended material",
      "layerHeight": "Layer height (mm)",
      "infill": "Infill (%)",
      "walls": "Walls",
      "nozzle": "Nozzle (mm)",
      "estTime": "Est. time (hours)",
      "supportsRequired": "Supports required",
      "notesLabel": "Notes",
      "notesPlaceholder": "Orientation tips, post-processing…"
    },
    "step5": {
      "hardwareHeading": "Hardware",
      "addItem": "Add item",
      "hardwarePlaceholder": "M3×10 bolt",
      "assemblyHeading": "Assembly",
      "difficulty": "Difficulty",
      "difficultyEasy": "Easy",
      "difficultyModerate": "Moderate",
      "difficultyAdvanced": "Advanced",
      "estTimeMin": "Est. time (min)",
      "toolsLabel": "Tools",
      "toolsPlaceholder": "Add a tool, press Enter",
      "stepsLabel": "Steps",
      "addStep": "Add step"
    },
    "step6": {
      "heading": "Review & submit",
      "labelTitle": "Title",
      "labelCategory": "Category",
      "labelLicense": "License",
      "labelPricing": "Pricing",
      "labelFiles": "Files",
      "filesUploaded": "{count} uploaded",
      "labelImages": "Images",
      "safetyAck": "I confirm these files are mine to share, are provided as-is, and are not certified for road use.",
      "termsPrefix": "By submitting you agree to the",
      "termsLink": "Model Library Terms & Safety"
    },
    "nav": {
      "cancel": "Cancel",
      "saveChanges": "Save changes",
      "back": "Back",
      "next": "Next",
      "submit": "Submit"
    },
    "choose": {
      "heading": "What would you like to share?",
      "subheading": "Two ways to add to the library — pick one to get started.",
      "ownTitle": "Submit your own model",
      "ownDesc": "Upload your STL/3MF files with print settings, photos, and assembly notes — hosted here for the community.",
      "externalTitle": "Share something you found online",
      "externalDesc": "Found a great Mini model on another site? Link it and we'll pull in the details, sending people to the source to download.",
      "continue": "Continue"
    }
  },
  "es": {
    "meta": {
      "titleEdit": "Editar modelo | Classic Mini DIY",
      "titleUpload": "Subir un modelo | Classic Mini DIY"
    },
    "hero": {
      "edit": "Editar un modelo 3D",
      "upload": "Compartir un modelo 3D"
    },
    "breadcrumb": {
      "edit": "Editar",
      "upload": "Subir"
    },
    "auth": {
      "signInTitle": "Inicia sesión para compartir un modelo",
      "signInBody": "Necesitas una cuenta para contribuir modelos a la biblioteca.",
      "signInBtn": "Iniciar sesión"
    },
    "success": {
      "savedTitle": "Cambios guardados",
      "publishedTitle": "¡Publicado!",
      "pendingTitle": "Enviado para revisión",
      "savedBody": "Los detalles de tu modelo han sido actualizados.",
      "publishedBody": "Tu modelo está en vivo — redirigiéndote…",
      "pendingBody": "¡Gracias! Nuestros moderadores lo revisarán en breve. Puedes seguirlo en Mis modelos.",
      "myModels": "Mis modelos",
      "view": "Ver"
    },
    "steps": {
      "basics": "Básico",
      "files": "Archivos",
      "images": "Imágenes",
      "print": "Impresión",
      "assembly": "Ensamblaje",
      "review": "Revisión"
    },
    "context": {
      "contentOnly": "Estás editando la versión publicada actualmente. Estos detalles se actualizan en vivo para todos. Los archivos del modelo no pueden cambiarse aquí — para publicar archivos diferentes, inicia una nueva versión desde Mis modelos.",
      "newVersion": "Estás creando la versión {version}. Las versiones anteriores siguen disponibles — los compradores y quienes hayan descargado el modelo mantienen acceso a todas las versiones, pasadas y futuras."
    },
    "step1": {
      "heading": "Lo básico",
      "titleLabel": "Título",
      "titlePlaceholder": "ej. Soporte para manómetro Smiths (52 mm)",
      "summaryLabel": "Resumen",
      "summaryPlaceholder": "Descripción en una línea",
      "descriptionLabel": "Descripción",
      "descriptionPlaceholder": "Qué es, cómo se imprime, para qué sirve…",
      "categoryLabel": "Categoría",
      "categoryPlaceholder": "Elige una categoría",
      "sourceUrlLabel": "URL de origen",
      "sourceUrlPlaceholder": "Diseño original (opcional)",
      "tagsLabel": "Etiquetas",
      "tagsPlaceholder": "Separadas por comas, presiona Intro",
      "pricingDivider": "Precio y licencia",
      "pricingLabel": "Precio",
      "pricingFree": "Gratis",
      "pricingTips": "Gratis + propinas",
      "pricingPwyw": "Paga lo que quieras",
      "pricingFixed": "Precio fijo",
      "sellGate": "Vender requiere una cuenta de Stripe conectada.",
      "sellGateCta": "Configurar ventas",
      "pwywHint": "Los compradores pagan lo que quieran — solo defines un precio sugerido.",
      "priceUsd": "Precio (USD)",
      "minimumUsd": "Mínimo (USD)",
      "suggestedUsd": "Sugerido (USD)",
      "licenseLabel": "Licencia",
      "licensePlaceholder": "Elige una licencia",
      "licensePaidLink": "Lee los términos de la licencia de archivo de pago",
      "licenseCcLink": "Acerca de las licencias Creative Commons",
      "safetyCritical": "Esta es una pieza crítica para la seguridad (estructural, frenos, dirección, combustible)"
    },
    "step2": {
      "heading": "Archivos del modelo",
      "hint": "STL, 3MF, OBJ, STEP, F3D y más — hasta 200 MB cada uno, {maxFiles} archivos.",
      "dropzone": "Arrastra archivos aquí o haz clic para explorar"
    },
    "fileStatus": {
      "uploading": "Subiendo…",
      "verifying": "Verificando…",
      "uploaded": "Subido",
      "failed": "Error",
      "pending": "En cola"
    },
    "step3": {
      "heading": "Imágenes",
      "hint": "Fotos o renders — JPG/PNG/WebP, máx. 10 MB, hasta {maxImages}. La primera es la portada.",
      "dropzone": "Arrastra imágenes aquí o haz clic para explorar",
      "coverBadge": "Portada",
      "imageFailed": "Error"
    },
    "step4": {
      "heading": "Configuración de impresión",
      "material": "Material recomendado",
      "layerHeight": "Altura de capa (mm)",
      "infill": "Relleno (%)",
      "walls": "Paredes",
      "nozzle": "Boquilla (mm)",
      "estTime": "Tiempo est. (horas)",
      "supportsRequired": "Se requieren soportes",
      "notesLabel": "Notas",
      "notesPlaceholder": "Consejos de orientación, postprocesado…"
    },
    "step5": {
      "hardwareHeading": "Tornillería y hardware",
      "addItem": "Agregar elemento",
      "hardwarePlaceholder": "Tornillo M3×10",
      "assemblyHeading": "Ensamblaje",
      "difficulty": "Dificultad",
      "difficultyEasy": "Fácil",
      "difficultyModerate": "Moderado",
      "difficultyAdvanced": "Avanzado",
      "estTimeMin": "Tiempo est. (min)",
      "toolsLabel": "Herramientas",
      "toolsPlaceholder": "Agrega una herramienta, presiona Intro",
      "stepsLabel": "Pasos",
      "addStep": "Agregar paso"
    },
    "step6": {
      "heading": "Revisar y enviar",
      "labelTitle": "Título",
      "labelCategory": "Categoría",
      "labelLicense": "Licencia",
      "labelPricing": "Precio",
      "labelFiles": "Archivos",
      "filesUploaded": "{count} subidos",
      "labelImages": "Imágenes",
      "safetyAck": "Confirmo que estos archivos son míos para compartir, se proporcionan tal cual y no están certificados para uso en carretera.",
      "termsPrefix": "Al enviar, aceptas los",
      "termsLink": "Términos y seguridad de la biblioteca de modelos"
    },
    "nav": {
      "cancel": "Cancelar",
      "saveChanges": "Guardar cambios",
      "back": "Atrás",
      "next": "Siguiente",
      "submit": "Enviar"
    },
    "choose": {
      "heading": "¿Qué te gustaría compartir?",
      "subheading": "Dos formas de aportar a la biblioteca — elige una para empezar.",
      "ownTitle": "Sube tu propio modelo",
      "ownDesc": "Sube tus archivos STL/3MF con ajustes de impresión, fotos y notas de montaje — alojados aquí para la comunidad.",
      "externalTitle": "Comparte algo que encontraste en línea",
      "externalDesc": "¿Encontraste un buen modelo de Mini en otro sitio? Enlázalo y traeremos los detalles, enviando a la gente a la fuente para descargar.",
      "continue": "Continuar"
    }
  },
  "fr": {
    "meta": {
      "titleEdit": "Modifier le modèle | Classic Mini DIY",
      "titleUpload": "Téléverser un modèle | Classic Mini DIY"
    },
    "hero": {
      "edit": "Modifier un modèle 3D",
      "upload": "Partager un modèle 3D"
    },
    "breadcrumb": {
      "edit": "Modifier",
      "upload": "Téléverser"
    },
    "auth": {
      "signInTitle": "Connectez-vous pour partager un modèle",
      "signInBody": "Vous avez besoin d'un compte pour contribuer des modèles à la bibliothèque.",
      "signInBtn": "Se connecter"
    },
    "success": {
      "savedTitle": "Modifications enregistrées",
      "publishedTitle": "Publié !",
      "pendingTitle": "Soumis pour révision",
      "savedBody": "Les détails de votre modèle ont été mis à jour.",
      "publishedBody": "Votre modèle est en ligne — redirection en cours…",
      "pendingBody": "Merci ! Nos modérateurs l'examineront sous peu. Vous pouvez le suivre dans Mes modèles.",
      "myModels": "Mes modèles",
      "view": "Voir"
    },
    "steps": {
      "basics": "Bases",
      "files": "Fichiers",
      "images": "Images",
      "print": "Impression",
      "assembly": "Assemblage",
      "review": "Révision"
    },
    "context": {
      "contentOnly": "Vous modifiez la version actuellement publiée. Ces détails sont mis à jour en direct pour tout le monde. Les fichiers du modèle ne peuvent pas être modifiés ici — pour publier des fichiers différents, démarrez une nouvelle version depuis Mes modèles.",
      "newVersion": "Vous créez la version {version}. Vos versions précédentes restent disponibles — les acheteurs et toute personne ayant téléchargé le modèle conservent l'accès à toutes les versions, passées et futures."
    },
    "step1": {
      "heading": "Les bases",
      "titleLabel": "Titre",
      "titlePlaceholder": "ex. Support de manomètre Smiths (52 mm)",
      "summaryLabel": "Résumé",
      "summaryPlaceholder": "Description en une ligne",
      "descriptionLabel": "Description",
      "descriptionPlaceholder": "Ce que c'est, comment ça s'imprime, ce que ça monte…",
      "categoryLabel": "Catégorie",
      "categoryPlaceholder": "Choisir une catégorie",
      "sourceUrlLabel": "URL source",
      "sourceUrlPlaceholder": "Conception originale (optionnel)",
      "tagsLabel": "Étiquettes",
      "tagsPlaceholder": "Séparées par des virgules, appuyez sur Entrée",
      "pricingDivider": "Prix et licence",
      "pricingLabel": "Tarification",
      "pricingFree": "Gratuit",
      "pricingTips": "Gratuit + pourboires",
      "pricingPwyw": "Prix libre",
      "pricingFixed": "Prix fixe",
      "sellGate": "La vente nécessite un compte Stripe connecté.",
      "sellGateCta": "Configurer la vente",
      "pwywHint": "Les acheteurs paient ce qu'ils veulent — vous ne définissez qu'un prix suggéré.",
      "priceUsd": "Prix (USD)",
      "minimumUsd": "Minimum (USD)",
      "suggestedUsd": "Suggéré (USD)",
      "licenseLabel": "Licence",
      "licensePlaceholder": "Choisir une licence",
      "licensePaidLink": "Lire les conditions de la licence de fichier payant",
      "licenseCcLink": "À propos des licences Creative Commons",
      "safetyCritical": "C'est une pièce critique pour la sécurité (structurelle, freinage, direction, carburant)"
    },
    "step2": {
      "heading": "Fichiers du modèle",
      "hint": "STL, 3MF, OBJ, STEP, F3D et plus — jusqu'à 200 Mo chacun, {maxFiles} fichiers.",
      "dropzone": "Glissez des fichiers ici ou cliquez pour parcourir"
    },
    "fileStatus": {
      "uploading": "Téléversement…",
      "verifying": "Vérification…",
      "uploaded": "Téléversé",
      "failed": "Échec",
      "pending": "En attente"
    },
    "step3": {
      "heading": "Images",
      "hint": "Photos ou rendus — JPG/PNG/WebP, 10 Mo max, jusqu'à {maxImages}. La première est la couverture.",
      "dropzone": "Glissez des images ici ou cliquez pour parcourir",
      "coverBadge": "Couverture",
      "imageFailed": "Échec"
    },
    "step4": {
      "heading": "Paramètres d'impression",
      "material": "Matériau recommandé",
      "layerHeight": "Hauteur de couche (mm)",
      "infill": "Remplissage (%)",
      "walls": "Parois",
      "nozzle": "Buse (mm)",
      "estTime": "Durée est. (heures)",
      "supportsRequired": "Supports requis",
      "notesLabel": "Notes",
      "notesPlaceholder": "Conseils d'orientation, post-traitement…"
    },
    "step5": {
      "hardwareHeading": "Quincaillerie",
      "addItem": "Ajouter un élément",
      "hardwarePlaceholder": "Vis M3×10",
      "assemblyHeading": "Assemblage",
      "difficulty": "Difficulté",
      "difficultyEasy": "Facile",
      "difficultyModerate": "Modéré",
      "difficultyAdvanced": "Avancé",
      "estTimeMin": "Durée est. (min)",
      "toolsLabel": "Outils",
      "toolsPlaceholder": "Ajouter un outil, appuyez sur Entrée",
      "stepsLabel": "Étapes",
      "addStep": "Ajouter une étape"
    },
    "step6": {
      "heading": "Réviser et soumettre",
      "labelTitle": "Titre",
      "labelCategory": "Catégorie",
      "labelLicense": "Licence",
      "labelPricing": "Tarification",
      "labelFiles": "Fichiers",
      "filesUploaded": "{count} téléversés",
      "labelImages": "Images",
      "safetyAck": "Je confirme que ces fichiers m'appartiennent, sont fournis tels quels et ne sont pas certifiés pour un usage routier.",
      "termsPrefix": "En soumettant, vous acceptez les",
      "termsLink": "Conditions et sécurité de la bibliothèque de modèles"
    },
    "nav": {
      "cancel": "Annuler",
      "saveChanges": "Enregistrer les modifications",
      "back": "Retour",
      "next": "Suivant",
      "submit": "Soumettre"
    },
    "choose": {
      "heading": "Que souhaitez-vous partager ?",
      "subheading": "Deux façons d'enrichir la bibliothèque — choisissez-en une pour commencer.",
      "ownTitle": "Publier votre propre modèle",
      "ownDesc": "Téléversez vos fichiers STL/3MF avec réglages d'impression, photos et notes d'assemblage — hébergés ici pour la communauté.",
      "externalTitle": "Partager quelque chose trouvé en ligne",
      "externalDesc": "Vous avez trouvé un bon modèle de Mini sur un autre site ? Liez-le et nous récupérerons les détails, en renvoyant les gens vers la source pour télécharger.",
      "continue": "Continuer"
    }
  },
  "de": {
    "meta": {
      "titleEdit": "Modell bearbeiten | Classic Mini DIY",
      "titleUpload": "Modell hochladen | Classic Mini DIY"
    },
    "hero": {
      "edit": "3D-Modell bearbeiten",
      "upload": "3D-Modell teilen"
    },
    "breadcrumb": {
      "edit": "Bearbeiten",
      "upload": "Hochladen"
    },
    "auth": {
      "signInTitle": "Anmelden um ein Modell zu teilen",
      "signInBody": "Du benötigst ein Konto, um Modelle zur Bibliothek beizutragen.",
      "signInBtn": "Anmelden"
    },
    "success": {
      "savedTitle": "Änderungen gespeichert",
      "publishedTitle": "Veröffentlicht!",
      "pendingTitle": "Zur Überprüfung eingereicht",
      "savedBody": "Deine Modelldetails wurden aktualisiert.",
      "publishedBody": "Dein Modell ist live — du wirst weitergeleitet…",
      "pendingBody": "Danke! Unsere Moderatoren werden es in Kürze prüfen. Du kannst es unter Meine Modelle verfolgen.",
      "myModels": "Meine Modelle",
      "view": "Ansehen"
    },
    "steps": {
      "basics": "Grundlagen",
      "files": "Dateien",
      "images": "Bilder",
      "print": "Druck",
      "assembly": "Montage",
      "review": "Überprüfung"
    },
    "context": {
      "contentOnly": "Du bearbeitest die aktuell veröffentlichte Version. Diese Details werden für alle sofort aktualisiert. Die Modelldateien können hier nicht geändert werden — um andere Dateien zu veröffentlichen, starte eine neue Version unter Meine Modelle.",
      "newVersion": "Du erstellst Version {version}. Deine früheren Versionen bleiben verfügbar — Käufer und alle, die das Modell heruntergeladen haben, behalten Zugriff auf alle Versionen, vergangene und zukünftige."
    },
    "step1": {
      "heading": "Die Grundlagen",
      "titleLabel": "Titel",
      "titlePlaceholder": "z. B. Smiths-Uhrenhalter (52 mm)",
      "summaryLabel": "Zusammenfassung",
      "summaryPlaceholder": "Einzeilige Beschreibung",
      "descriptionLabel": "Beschreibung",
      "descriptionPlaceholder": "Was es ist, wie es druckt, wofür es passt…",
      "categoryLabel": "Kategorie",
      "categoryPlaceholder": "Kategorie wählen",
      "sourceUrlLabel": "Quell-URL",
      "sourceUrlPlaceholder": "Ursprüngliches Design (optional)",
      "tagsLabel": "Tags",
      "tagsPlaceholder": "Kommagetrennt, Enter drücken",
      "pricingDivider": "Preis & Lizenz",
      "pricingLabel": "Preis",
      "pricingFree": "Kostenlos",
      "pricingTips": "Kostenlos + Trinkgeld",
      "pricingPwyw": "Zahle was du willst",
      "pricingFixed": "Festpreis",
      "sellGate": "Verkaufen erfordert ein verbundenes Stripe-Konto.",
      "sellGateCta": "Verkauf einrichten",
      "pwywHint": "Käufer zahlen, was sie möchten — du legst nur einen Vorschlagspreis fest.",
      "priceUsd": "Preis (USD)",
      "minimumUsd": "Mindestpreis (USD)",
      "suggestedUsd": "Empfohlener Preis (USD)",
      "licenseLabel": "Lizenz",
      "licensePlaceholder": "Lizenz wählen",
      "licensePaidLink": "Bedingungen der kostenpflichtigen Dateilizenz lesen",
      "licenseCcLink": "Über Creative-Commons-Lizenzen",
      "safetyCritical": "Dies ist ein sicherheitskritisches Bauteil (Struktur, Bremsen, Lenkung, Kraftstoff)"
    },
    "step2": {
      "heading": "Modelldateien",
      "hint": "STL, 3MF, OBJ, STEP, F3D und mehr — bis zu 200 MB pro Datei, {maxFiles} Dateien.",
      "dropzone": "Dateien hierher ziehen oder klicken zum Durchsuchen"
    },
    "fileStatus": {
      "uploading": "Wird hochgeladen…",
      "verifying": "Wird überprüft…",
      "uploaded": "Hochgeladen",
      "failed": "Fehlgeschlagen",
      "pending": "In der Warteschlange"
    },
    "step3": {
      "heading": "Bilder",
      "hint": "Fotos oder Renderings — JPG/PNG/WebP, max. 10 MB, bis zu {maxImages}. Das erste ist das Titelbild.",
      "dropzone": "Bilder hierher ziehen oder klicken zum Durchsuchen",
      "coverBadge": "Titelbild",
      "imageFailed": "Fehlgeschlagen"
    },
    "step4": {
      "heading": "Druckeinstellungen",
      "material": "Empfohlenes Material",
      "layerHeight": "Schichthöhe (mm)",
      "infill": "Füllung (%)",
      "walls": "Wände",
      "nozzle": "Düse (mm)",
      "estTime": "Gesch. Zeit (Std.)",
      "supportsRequired": "Stützstrukturen erforderlich",
      "notesLabel": "Hinweise",
      "notesPlaceholder": "Ausrichtungstipps, Nachbearbeitung…"
    },
    "step5": {
      "hardwareHeading": "Schrauben & Hardware",
      "addItem": "Element hinzufügen",
      "hardwarePlaceholder": "M3×10-Schraube",
      "assemblyHeading": "Montage",
      "difficulty": "Schwierigkeit",
      "difficultyEasy": "Einfach",
      "difficultyModerate": "Mittel",
      "difficultyAdvanced": "Fortgeschritten",
      "estTimeMin": "Gesch. Zeit (Min.)",
      "toolsLabel": "Werkzeuge",
      "toolsPlaceholder": "Werkzeug hinzufügen, Enter drücken",
      "stepsLabel": "Schritte",
      "addStep": "Schritt hinzufügen"
    },
    "step6": {
      "heading": "Überprüfen & einreichen",
      "labelTitle": "Titel",
      "labelCategory": "Kategorie",
      "labelLicense": "Lizenz",
      "labelPricing": "Preis",
      "labelFiles": "Dateien",
      "filesUploaded": "{count} hochgeladen",
      "labelImages": "Bilder",
      "safetyAck": "Ich bestätige, dass diese Dateien mir gehören, wie besehen bereitgestellt werden und nicht für den Straßenverkehr zertifiziert sind.",
      "termsPrefix": "Mit dem Einreichen stimmst du den",
      "termsLink": "Bibliotheksbedingungen & Sicherheitshinweisen"
    },
    "nav": {
      "cancel": "Abbrechen",
      "saveChanges": "Änderungen speichern",
      "back": "Zurück",
      "next": "Weiter",
      "submit": "Einreichen"
    },
    "choose": {
      "heading": "Was möchtest du teilen?",
      "subheading": "Zwei Wege, zur Bibliothek beizutragen — wähle einen, um zu starten.",
      "ownTitle": "Eigenes Modell hochladen",
      "ownDesc": "Lade deine STL/3MF-Dateien mit Druckeinstellungen, Fotos und Montagehinweisen hoch — hier für die Community gehostet.",
      "externalTitle": "Etwas teilen, das du online gefunden hast",
      "externalDesc": "Ein tolles Mini-Modell auf einer anderen Seite gefunden? Verknüpfe es und wir holen die Details und schicken die Leute zum Herunterladen zur Quelle.",
      "continue": "Weiter"
    }
  },
  "it": {
    "meta": {
      "titleEdit": "Modifica modello | Classic Mini DIY",
      "titleUpload": "Carica un modello | Classic Mini DIY"
    },
    "hero": {
      "edit": "Modifica un modello 3D",
      "upload": "Condividi un modello 3D"
    },
    "breadcrumb": {
      "edit": "Modifica",
      "upload": "Carica"
    },
    "auth": {
      "signInTitle": "Accedi per condividere un modello",
      "signInBody": "Hai bisogno di un account per contribuire modelli alla libreria.",
      "signInBtn": "Accedi"
    },
    "success": {
      "savedTitle": "Modifiche salvate",
      "publishedTitle": "Pubblicato!",
      "pendingTitle": "Inviato per revisione",
      "savedBody": "I dettagli del tuo modello sono stati aggiornati.",
      "publishedBody": "Il tuo modello è online — ti stiamo reindirizzando…",
      "pendingBody": "Grazie! I nostri moderatori lo esamineranno a breve. Puoi seguirlo in I miei modelli.",
      "myModels": "I miei modelli",
      "view": "Visualizza"
    },
    "steps": {
      "basics": "Basi",
      "files": "File",
      "images": "Immagini",
      "print": "Stampa",
      "assembly": "Assemblaggio",
      "review": "Revisione"
    },
    "context": {
      "contentOnly": "Stai modificando la versione attualmente pubblicata. Questi dettagli si aggiornano in tempo reale per tutti. I file del modello non possono essere modificati qui — per pubblicare file diversi, avvia una nuova versione da I miei modelli.",
      "newVersion": "Stai creando la versione {version}. Le versioni precedenti rimangono disponibili — gli acquirenti e chiunque abbia scaricato il modello mantengono l'accesso a tutte le versioni, passate e future."
    },
    "step1": {
      "heading": "Le basi",
      "titleLabel": "Titolo",
      "titlePlaceholder": "es. Supporto manometro Smiths (52 mm)",
      "summaryLabel": "Riepilogo",
      "summaryPlaceholder": "Descrizione in una riga",
      "descriptionLabel": "Descrizione",
      "descriptionPlaceholder": "Cos'è, come si stampa, dove si monta…",
      "categoryLabel": "Categoria",
      "categoryPlaceholder": "Scegli una categoria",
      "sourceUrlLabel": "URL sorgente",
      "sourceUrlPlaceholder": "Progetto originale (opzionale)",
      "tagsLabel": "Tag",
      "tagsPlaceholder": "Separati da virgole, premi Invio",
      "pricingDivider": "Prezzo e licenza",
      "pricingLabel": "Prezzo",
      "pricingFree": "Gratuito",
      "pricingTips": "Gratuito + mance",
      "pricingPwyw": "Paga quanto vuoi",
      "pricingFixed": "Prezzo fisso",
      "sellGate": "Vendere richiede un account Stripe collegato.",
      "sellGateCta": "Configura la vendita",
      "pwywHint": "Gli acquirenti pagano quanto vogliono — imposti solo un prezzo suggerito.",
      "priceUsd": "Prezzo (USD)",
      "minimumUsd": "Minimo (USD)",
      "suggestedUsd": "Suggerito (USD)",
      "licenseLabel": "Licenza",
      "licensePlaceholder": "Scegli una licenza",
      "licensePaidLink": "Leggi i termini della licenza per file a pagamento",
      "licenseCcLink": "Informazioni sulle licenze Creative Commons",
      "safetyCritical": "Questo è un componente critico per la sicurezza (strutturale, freni, sterzo, carburante)"
    },
    "step2": {
      "heading": "File del modello",
      "hint": "STL, 3MF, OBJ, STEP, F3D e altro — fino a 200 MB ciascuno, {maxFiles} file.",
      "dropzone": "Trascina i file qui o clicca per sfogliare"
    },
    "fileStatus": {
      "uploading": "Caricamento…",
      "verifying": "Verifica…",
      "uploaded": "Caricato",
      "failed": "Errore",
      "pending": "In coda"
    },
    "step3": {
      "heading": "Immagini",
      "hint": "Foto o render — JPG/PNG/WebP, max 10 MB, fino a {maxImages}. La prima è la copertina.",
      "dropzone": "Trascina le immagini qui o clicca per sfogliare",
      "coverBadge": "Copertina",
      "imageFailed": "Errore"
    },
    "step4": {
      "heading": "Impostazioni di stampa",
      "material": "Materiale consigliato",
      "layerHeight": "Altezza layer (mm)",
      "infill": "Riempimento (%)",
      "walls": "Pareti",
      "nozzle": "Ugello (mm)",
      "estTime": "Tempo stimato (ore)",
      "supportsRequired": "Supporti necessari",
      "notesLabel": "Note",
      "notesPlaceholder": "Suggerimenti di orientamento, post-elaborazione…"
    },
    "step5": {
      "hardwareHeading": "Bulloneria e hardware",
      "addItem": "Aggiungi elemento",
      "hardwarePlaceholder": "Vite M3×10",
      "assemblyHeading": "Assemblaggio",
      "difficulty": "Difficoltà",
      "difficultyEasy": "Facile",
      "difficultyModerate": "Moderato",
      "difficultyAdvanced": "Avanzato",
      "estTimeMin": "Tempo stimato (min)",
      "toolsLabel": "Strumenti",
      "toolsPlaceholder": "Aggiungi uno strumento, premi Invio",
      "stepsLabel": "Passaggi",
      "addStep": "Aggiungi passaggio"
    },
    "step6": {
      "heading": "Revisione e invio",
      "labelTitle": "Titolo",
      "labelCategory": "Categoria",
      "labelLicense": "Licenza",
      "labelPricing": "Prezzo",
      "labelFiles": "File",
      "filesUploaded": "{count} caricati",
      "labelImages": "Immagini",
      "safetyAck": "Confermo che questi file sono miei, vengono forniti così come sono e non sono certificati per l'uso su strada.",
      "termsPrefix": "Inviando accetti i",
      "termsLink": "Termini e sicurezza della libreria di modelli"
    },
    "nav": {
      "cancel": "Annulla",
      "saveChanges": "Salva modifiche",
      "back": "Indietro",
      "next": "Avanti",
      "submit": "Invia"
    },
    "choose": {
      "heading": "Cosa vuoi condividere?",
      "subheading": "Due modi per contribuire alla libreria — scegline uno per iniziare.",
      "ownTitle": "Carica il tuo modello",
      "ownDesc": "Carica i tuoi file STL/3MF con impostazioni di stampa, foto e note di montaggio — ospitati qui per la community.",
      "externalTitle": "Condividi qualcosa trovato online",
      "externalDesc": "Hai trovato un bel modello di Mini su un altro sito? Collegalo e recupereremo i dettagli, indirizzando le persone alla fonte per scaricare.",
      "continue": "Continua"
    }
  },
  "pt": {
    "meta": {
      "titleEdit": "Editar modelo | Classic Mini DIY",
      "titleUpload": "Carregar um modelo | Classic Mini DIY"
    },
    "hero": {
      "edit": "Editar um modelo 3D",
      "upload": "Partilhar um modelo 3D"
    },
    "breadcrumb": {
      "edit": "Editar",
      "upload": "Carregar"
    },
    "auth": {
      "signInTitle": "Inicia sessão para partilhar um modelo",
      "signInBody": "Precisas de uma conta para contribuir com modelos para a biblioteca.",
      "signInBtn": "Iniciar sessão"
    },
    "success": {
      "savedTitle": "Alterações guardadas",
      "publishedTitle": "Publicado!",
      "pendingTitle": "Submetido para revisão",
      "savedBody": "Os detalhes do teu modelo foram atualizados.",
      "publishedBody": "O teu modelo está online — a redirecionar-te…",
      "pendingBody": "Obrigado! Os nossos moderadores irão revê-lo em breve. Podes acompanhar em Os meus modelos.",
      "myModels": "Os meus modelos",
      "view": "Ver"
    },
    "steps": {
      "basics": "Básico",
      "files": "Ficheiros",
      "images": "Imagens",
      "print": "Impressão",
      "assembly": "Montagem",
      "review": "Revisão"
    },
    "context": {
      "contentOnly": "Estás a editar a versão atualmente publicada. Estes detalhes são atualizados em tempo real para todos. Os ficheiros do modelo não podem ser alterados aqui — para publicar ficheiros diferentes, inicia uma nova versão em Os meus modelos.",
      "newVersion": "Estás a criar a versão {version}. As tuas versões anteriores continuam disponíveis — os compradores e quem descarregou o modelo mantêm acesso a todas as versões, passadas e futuras."
    },
    "step1": {
      "heading": "O básico",
      "titleLabel": "Título",
      "titlePlaceholder": "ex. Suporte de manómetro Smiths (52 mm)",
      "summaryLabel": "Resumo",
      "summaryPlaceholder": "Descrição numa linha",
      "descriptionLabel": "Descrição",
      "descriptionPlaceholder": "O que é, como imprime, onde encaixa…",
      "categoryLabel": "Categoria",
      "categoryPlaceholder": "Escolher uma categoria",
      "sourceUrlLabel": "URL de origem",
      "sourceUrlPlaceholder": "Design original (opcional)",
      "tagsLabel": "Etiquetas",
      "tagsPlaceholder": "Separadas por vírgulas, pressiona Enter",
      "pricingDivider": "Preço e licença",
      "pricingLabel": "Preço",
      "pricingFree": "Grátis",
      "pricingTips": "Grátis + gorjetas",
      "pricingPwyw": "Paga o que quiseres",
      "pricingFixed": "Preço fixo",
      "sellGate": "Vender exige uma conta Stripe conectada.",
      "sellGateCta": "Configurar vendas",
      "pwywHint": "Os compradores pagam o que quiserem — você só define um preço sugerido.",
      "priceUsd": "Preço (USD)",
      "minimumUsd": "Mínimo (USD)",
      "suggestedUsd": "Sugerido (USD)",
      "licenseLabel": "Licença",
      "licensePlaceholder": "Escolher uma licença",
      "licensePaidLink": "Ler os termos da licença de ficheiro pago",
      "licenseCcLink": "Sobre as licenças Creative Commons",
      "safetyCritical": "Esta é uma peça crítica para a segurança (estrutural, travões, direção, combustível)"
    },
    "step2": {
      "heading": "Ficheiros do modelo",
      "hint": "STL, 3MF, OBJ, STEP, F3D e mais — até 200 MB cada, {maxFiles} ficheiros.",
      "dropzone": "Arrasta ficheiros aqui ou clica para procurar"
    },
    "fileStatus": {
      "uploading": "A carregar…",
      "verifying": "A verificar…",
      "uploaded": "Carregado",
      "failed": "Falhou",
      "pending": "Na fila"
    },
    "step3": {
      "heading": "Imagens",
      "hint": "Fotos ou renders — JPG/PNG/WebP, máx. 10 MB, até {maxImages}. A primeira é a capa.",
      "dropzone": "Arrasta imagens aqui ou clica para procurar",
      "coverBadge": "Capa",
      "imageFailed": "Falhou"
    },
    "step4": {
      "heading": "Configurações de impressão",
      "material": "Material recomendado",
      "layerHeight": "Altura de camada (mm)",
      "infill": "Preenchimento (%)",
      "walls": "Paredes",
      "nozzle": "Bocal (mm)",
      "estTime": "Tempo est. (horas)",
      "supportsRequired": "Suportes necessários",
      "notesLabel": "Notas",
      "notesPlaceholder": "Dicas de orientação, pós-processamento…"
    },
    "step5": {
      "hardwareHeading": "Hardware e parafusos",
      "addItem": "Adicionar elemento",
      "hardwarePlaceholder": "Parafuso M3×10",
      "assemblyHeading": "Montagem",
      "difficulty": "Dificuldade",
      "difficultyEasy": "Fácil",
      "difficultyModerate": "Moderado",
      "difficultyAdvanced": "Avançado",
      "estTimeMin": "Tempo est. (min)",
      "toolsLabel": "Ferramentas",
      "toolsPlaceholder": "Adicionar uma ferramenta, pressiona Enter",
      "stepsLabel": "Passos",
      "addStep": "Adicionar passo"
    },
    "step6": {
      "heading": "Rever e submeter",
      "labelTitle": "Título",
      "labelCategory": "Categoria",
      "labelLicense": "Licença",
      "labelPricing": "Preço",
      "labelFiles": "Ficheiros",
      "filesUploaded": "{count} carregados",
      "labelImages": "Imagens",
      "safetyAck": "Confirmo que estes ficheiros são meus para partilhar, são fornecidos tal como estão e não estão certificados para uso na estrada.",
      "termsPrefix": "Ao submeter, concordas com os",
      "termsLink": "Termos e segurança da biblioteca de modelos"
    },
    "nav": {
      "cancel": "Cancelar",
      "saveChanges": "Guardar alterações",
      "back": "Voltar",
      "next": "Seguinte",
      "submit": "Submeter"
    },
    "choose": {
      "heading": "O que gostaria de partilhar?",
      "subheading": "Duas formas de contribuir para a biblioteca — escolha uma para começar.",
      "ownTitle": "Envie o seu próprio modelo",
      "ownDesc": "Carregue os seus ficheiros STL/3MF com configurações de impressão, fotos e notas de montagem — alojados aqui para a comunidade.",
      "externalTitle": "Partilhe algo que encontrou online",
      "externalDesc": "Encontrou um bom modelo de Mini noutro site? Vincule-o e traremos os detalhes, enviando as pessoas para a fonte para descarregar.",
      "continue": "Continuar"
    }
  },
  "ru": {
    "meta": {
      "titleEdit": "Редактировать модель | Classic Mini DIY",
      "titleUpload": "Загрузить модель | Classic Mini DIY"
    },
    "hero": {
      "edit": "Редактировать 3D-модель",
      "upload": "Поделиться 3D-моделью"
    },
    "breadcrumb": {
      "edit": "Редактировать",
      "upload": "Загрузить"
    },
    "auth": {
      "signInTitle": "Войдите, чтобы поделиться моделью",
      "signInBody": "Для добавления моделей в библиотеку необходим аккаунт.",
      "signInBtn": "Войти"
    },
    "success": {
      "savedTitle": "Изменения сохранены",
      "publishedTitle": "Опубликовано!",
      "pendingTitle": "Отправлено на проверку",
      "savedBody": "Данные вашей модели обновлены.",
      "publishedBody": "Ваша модель опубликована — переходим туда…",
      "pendingBody": "Спасибо! Наши модераторы скоро её проверят. Следите в разделе Мои модели.",
      "myModels": "Мои модели",
      "view": "Просмотр"
    },
    "steps": {
      "basics": "Основное",
      "files": "Файлы",
      "images": "Изображения",
      "print": "Печать",
      "assembly": "Сборка",
      "review": "Проверка"
    },
    "context": {
      "contentOnly": "Вы редактируете текущую опубликованную версию. Эти данные обновляются сразу для всех. Файлы модели здесь изменить нельзя — чтобы опубликовать другие файлы, создайте новую версию в разделе Мои модели.",
      "newVersion": "Вы создаёте версию {version}. Предыдущие версии остаются доступными — покупатели и все, кто скачал модель, сохраняют доступ ко всем версиям: прошлым и будущим."
    },
    "step1": {
      "heading": "Основная информация",
      "titleLabel": "Название",
      "titlePlaceholder": "напр. Держатель приборов Smiths (52 мм)",
      "summaryLabel": "Краткое описание",
      "summaryPlaceholder": "Описание в одну строку",
      "descriptionLabel": "Описание",
      "descriptionPlaceholder": "Что это такое, как печатается, куда устанавливается…",
      "categoryLabel": "Категория",
      "categoryPlaceholder": "Выберите категорию",
      "sourceUrlLabel": "URL источника",
      "sourceUrlPlaceholder": "Исходный дизайн (необязательно)",
      "tagsLabel": "Теги",
      "tagsPlaceholder": "Через запятую, нажмите Enter",
      "pricingDivider": "Цена и лицензия",
      "pricingLabel": "Цена",
      "pricingFree": "Бесплатно",
      "pricingTips": "Бесплатно + чаевые",
      "pricingPwyw": "Плати сколько хочешь",
      "pricingFixed": "Фиксированная цена",
      "sellGate": "Для продажи нужен подключённый аккаунт Stripe.",
      "sellGateCta": "Настроить продажи",
      "pwywHint": "Покупатели платят сколько хотят — вы задаёте только рекомендуемую цену.",
      "priceUsd": "Цена (USD)",
      "minimumUsd": "Минимум (USD)",
      "suggestedUsd": "Рекомендуемая (USD)",
      "licenseLabel": "Лицензия",
      "licensePlaceholder": "Выберите лицензию",
      "licensePaidLink": "Прочитать условия платной лицензии на файл",
      "licenseCcLink": "О лицензиях Creative Commons",
      "safetyCritical": "Это критически важная для безопасности деталь (структурная, тормозная, рулевая, топливная)"
    },
    "step2": {
      "heading": "Файлы модели",
      "hint": "STL, 3MF, OBJ, STEP, F3D и другие — до 200 МБ каждый, {maxFiles} файлов.",
      "dropzone": "Перетащите файлы сюда или нажмите для выбора"
    },
    "fileStatus": {
      "uploading": "Загрузка…",
      "verifying": "Проверка…",
      "uploaded": "Загружен",
      "failed": "Ошибка",
      "pending": "В очереди"
    },
    "step3": {
      "heading": "Изображения",
      "hint": "Фото или рендеры — JPG/PNG/WebP, макс. 10 МБ, до {maxImages}. Первое — обложка.",
      "dropzone": "Перетащите изображения сюда или нажмите для выбора",
      "coverBadge": "Обложка",
      "imageFailed": "Ошибка"
    },
    "step4": {
      "heading": "Параметры печати",
      "material": "Рекомендуемый материал",
      "layerHeight": "Высота слоя (мм)",
      "infill": "Заполнение (%)",
      "walls": "Стенки",
      "nozzle": "Сопло (мм)",
      "estTime": "Ориент. время (ч)",
      "supportsRequired": "Требуются поддержки",
      "notesLabel": "Примечания",
      "notesPlaceholder": "Советы по ориентации, постобработке…"
    },
    "step5": {
      "hardwareHeading": "Крепёж и комплектующие",
      "addItem": "Добавить элемент",
      "hardwarePlaceholder": "Болт M3×10",
      "assemblyHeading": "Сборка",
      "difficulty": "Сложность",
      "difficultyEasy": "Лёгкая",
      "difficultyModerate": "Средняя",
      "difficultyAdvanced": "Сложная",
      "estTimeMin": "Ориент. время (мин)",
      "toolsLabel": "Инструменты",
      "toolsPlaceholder": "Добавьте инструмент, нажмите Enter",
      "stepsLabel": "Шаги",
      "addStep": "Добавить шаг"
    },
    "step6": {
      "heading": "Проверка и отправка",
      "labelTitle": "Название",
      "labelCategory": "Категория",
      "labelLicense": "Лицензия",
      "labelPricing": "Цена",
      "labelFiles": "Файлы",
      "filesUploaded": "{count} загружено",
      "labelImages": "Изображения",
      "safetyAck": "Подтверждаю, что эти файлы принадлежат мне, предоставляются как есть и не сертифицированы для использования на дороге.",
      "termsPrefix": "Отправляя, вы соглашаетесь с",
      "termsLink": "Условиями и правилами безопасности библиотеки моделей"
    },
    "nav": {
      "cancel": "Отмена",
      "saveChanges": "Сохранить изменения",
      "back": "Назад",
      "next": "Далее",
      "submit": "Отправить"
    },
    "choose": {
      "heading": "Чем вы хотите поделиться?",
      "subheading": "Два способа пополнить библиотеку — выберите один, чтобы начать.",
      "ownTitle": "Загрузить свою модель",
      "ownDesc": "Загрузите файлы STL/3MF с настройками печати, фото и инструкциями по сборке — размещается здесь для сообщества.",
      "externalTitle": "Поделиться найденным в сети",
      "externalDesc": "Нашли отличную модель Mini на другом сайте? Добавьте ссылку — мы подтянем детали и направим людей к источнику для скачивания.",
      "continue": "Продолжить"
    }
  },
  "ja": {
    "meta": {
      "titleEdit": "モデルを編集 | Classic Mini DIY",
      "titleUpload": "モデルをアップロード | Classic Mini DIY"
    },
    "hero": {
      "edit": "3Dモデルを編集",
      "upload": "3Dモデルをシェア"
    },
    "breadcrumb": {
      "edit": "編集",
      "upload": "アップロード"
    },
    "auth": {
      "signInTitle": "モデルをシェアするにはログインが必要です",
      "signInBody": "ライブラリにモデルを投稿するにはアカウントが必要です。",
      "signInBtn": "ログイン"
    },
    "success": {
      "savedTitle": "変更を保存しました",
      "publishedTitle": "公開しました！",
      "pendingTitle": "レビューのために送信しました",
      "savedBody": "モデルの詳細が更新されました。",
      "publishedBody": "モデルが公開されました — ページに移動します…",
      "pendingBody": "ありがとうございます！モデレーターがまもなく確認します。マイモデルで進捗を確認できます。",
      "myModels": "マイモデル",
      "view": "表示"
    },
    "steps": {
      "basics": "基本情報",
      "files": "ファイル",
      "images": "画像",
      "print": "印刷設定",
      "assembly": "組み立て",
      "review": "確認"
    },
    "context": {
      "contentOnly": "現在公開中のバージョンを編集しています。これらの詳細は全員にリアルタイムで反映されます。モデルファイルはここでは変更できません — 別のファイルを公開するには、マイモデルから新しいバージョンを作成してください。",
      "newVersion": "バージョン {version} を作成しています。以前のバージョンは引き続き利用可能です — 購入者やモデルをダウンロードした方は、過去・未来のすべてのバージョンにアクセスし続けられます。"
    },
    "step1": {
      "heading": "基本情報",
      "titleLabel": "タイトル",
      "titlePlaceholder": "例：Smiths ゲージポッド（52 mm）",
      "summaryLabel": "概要",
      "summaryPlaceholder": "一行で説明",
      "descriptionLabel": "説明",
      "descriptionPlaceholder": "内容、印刷方法、適合車種など…",
      "categoryLabel": "カテゴリー",
      "categoryPlaceholder": "カテゴリーを選択",
      "sourceUrlLabel": "ソースURL",
      "sourceUrlPlaceholder": "オリジナルデザイン（任意）",
      "tagsLabel": "タグ",
      "tagsPlaceholder": "カンマ区切り、Enterで確定",
      "pricingDivider": "価格・ライセンス",
      "pricingLabel": "価格設定",
      "pricingFree": "無料",
      "pricingTips": "無料 + チップ",
      "pricingPwyw": "お好きな価格で",
      "pricingFixed": "固定価格",
      "sellGate": "販売にはStripeアカウントの連携が必要です。",
      "sellGateCta": "販売を設定",
      "pwywHint": "購入者は好きな金額を支払えます — あなたは推奨価格のみ設定します。",
      "priceUsd": "価格（USD）",
      "minimumUsd": "最低価格（USD）",
      "suggestedUsd": "推奨価格（USD）",
      "licenseLabel": "ライセンス",
      "licensePlaceholder": "ライセンスを選択",
      "licensePaidLink": "有料ファイルライセンス条件を読む",
      "licenseCcLink": "クリエイティブ・コモンズ・ライセンスについて",
      "safetyCritical": "これは安全上重要な部品です（構造、ブレーキ、ステアリング、燃料系）"
    },
    "step2": {
      "heading": "モデルファイル",
      "hint": "STL、3MF、OBJ、STEP、F3D など — 各最大 200 MB、{maxFiles} ファイルまで。",
      "dropzone": "ファイルをここにドラッグするか、クリックして選択"
    },
    "fileStatus": {
      "uploading": "アップロード中…",
      "verifying": "確認中…",
      "uploaded": "アップロード済み",
      "failed": "失敗",
      "pending": "待機中"
    },
    "step3": {
      "heading": "画像",
      "hint": "写真またはレンダリング — JPG/PNG/WebP、最大 10 MB、{maxImages} 枚まで。最初の画像がカバーになります。",
      "dropzone": "画像をここにドラッグするか、クリックして選択",
      "coverBadge": "カバー",
      "imageFailed": "失敗"
    },
    "step4": {
      "heading": "印刷設定",
      "material": "推奨素材",
      "layerHeight": "レイヤー高さ（mm）",
      "infill": "充填率（%）",
      "walls": "壁の数",
      "nozzle": "ノズル径（mm）",
      "estTime": "推定時間（時間）",
      "supportsRequired": "サポート材が必要",
      "notesLabel": "メモ",
      "notesPlaceholder": "向き・後処理のヒントなど…"
    },
    "step5": {
      "hardwareHeading": "ハードウェア",
      "addItem": "アイテムを追加",
      "hardwarePlaceholder": "M3×10 ボルト",
      "assemblyHeading": "組み立て",
      "difficulty": "難易度",
      "difficultyEasy": "簡単",
      "difficultyModerate": "普通",
      "difficultyAdvanced": "上級",
      "estTimeMin": "推定時間（分）",
      "toolsLabel": "工具",
      "toolsPlaceholder": "工具を追加し、Enterで確定",
      "stepsLabel": "手順",
      "addStep": "手順を追加"
    },
    "step6": {
      "heading": "確認して送信",
      "labelTitle": "タイトル",
      "labelCategory": "カテゴリー",
      "labelLicense": "ライセンス",
      "labelPricing": "価格",
      "labelFiles": "ファイル",
      "filesUploaded": "{count} 件アップロード済み",
      "labelImages": "画像",
      "safetyAck": "これらのファイルは自分のものであり、現状のまま提供され、公道使用の認証はないことを確認します。",
      "termsPrefix": "送信することで、",
      "termsLink": "モデルライブラリ利用規約・安全方針"
    },
    "nav": {
      "cancel": "キャンセル",
      "saveChanges": "変更を保存",
      "back": "戻る",
      "next": "次へ",
      "submit": "送信"
    },
    "choose": {
      "heading": "何を共有しますか？",
      "subheading": "ライブラリに追加する2つの方法 — 1つ選んで始めましょう。",
      "ownTitle": "自分のモデルを投稿",
      "ownDesc": "STL/3MFファイルを印刷設定・写真・組み立てメモと一緒にアップロード — コミュニティのためにここでホストします。",
      "externalTitle": "オンラインで見つけたものを共有",
      "externalDesc": "他のサイトで良いMiniモデルを見つけましたか？リンクすれば詳細を取り込み、ダウンロードは元のサイトへご案内します。",
      "continue": "続ける"
    }
  },
  "zh": {
    "meta": {
      "titleEdit": "编辑模型 | Classic Mini DIY",
      "titleUpload": "上传模型 | Classic Mini DIY"
    },
    "hero": {
      "edit": "编辑 3D 模型",
      "upload": "分享 3D 模型"
    },
    "breadcrumb": {
      "edit": "编辑",
      "upload": "上传"
    },
    "auth": {
      "signInTitle": "登录以分享模型",
      "signInBody": "您需要一个账号才能向库中贡献模型。",
      "signInBtn": "登录"
    },
    "success": {
      "savedTitle": "更改已保存",
      "publishedTitle": "已发布！",
      "pendingTitle": "已提交审核",
      "savedBody": "您的模型详情已更新。",
      "publishedBody": "您的模型已上线 — 正在跳转…",
      "pendingBody": "感谢！我们的审核员将很快审核它。您可以在我的模型中跟踪进度。",
      "myModels": "我的模型",
      "view": "查看"
    },
    "steps": {
      "basics": "基本信息",
      "files": "文件",
      "images": "图片",
      "print": "打印",
      "assembly": "组装",
      "review": "审核"
    },
    "context": {
      "contentOnly": "您正在编辑当前已发布的版本。这些详情将立即对所有人生效。模型文件在此无法更改 — 如需发布不同文件，请从我的模型中创建新版本。",
      "newVersion": "您正在创建第 {version} 版。您之前的版本将继续可用 — 购买者及已下载该模型的用户将保留对所有版本（过去和未来）的访问权限。"
    },
    "step1": {
      "heading": "基本信息",
      "titleLabel": "标题",
      "titlePlaceholder": "例：Smiths 仪表支架（52 mm）",
      "summaryLabel": "摘要",
      "summaryPlaceholder": "一句话描述",
      "descriptionLabel": "描述",
      "descriptionPlaceholder": "是什么、如何打印、适配什么…",
      "categoryLabel": "分类",
      "categoryPlaceholder": "选择分类",
      "sourceUrlLabel": "来源链接",
      "sourceUrlPlaceholder": "原始设计（可选）",
      "tagsLabel": "标签",
      "tagsPlaceholder": "用逗号分隔，按回车确认",
      "pricingDivider": "定价与许可证",
      "pricingLabel": "定价",
      "pricingFree": "免费",
      "pricingTips": "免费 + 打赏",
      "pricingPwyw": "随意付费",
      "pricingFixed": "固定价格",
      "sellGate": "销售需要关联 Stripe 账户。",
      "sellGateCta": "设置销售",
      "pwywHint": "买家自行决定支付金额 — 您只需设置一个建议价格。",
      "priceUsd": "价格（USD）",
      "minimumUsd": "最低价（USD）",
      "suggestedUsd": "建议价（USD）",
      "licenseLabel": "许可证",
      "licensePlaceholder": "选择许可证",
      "licensePaidLink": "阅读付费文件许可证条款",
      "licenseCcLink": "关于知识共享许可证",
      "safetyCritical": "这是安全关键部件（结构、制动、转向、燃油）"
    },
    "step2": {
      "heading": "模型文件",
      "hint": "STL、3MF、OBJ、STEP、F3D 等 — 每个最大 200 MB，最多 {maxFiles} 个文件。",
      "dropzone": "将文件拖到此处或点击浏览"
    },
    "fileStatus": {
      "uploading": "上传中…",
      "verifying": "验证中…",
      "uploaded": "已上传",
      "failed": "失败",
      "pending": "排队中"
    },
    "step3": {
      "heading": "图片",
      "hint": "照片或渲染图 — JPG/PNG/WebP，最大 10 MB，最多 {maxImages} 张。第一张为封面。",
      "dropzone": "将图片拖到此处或点击浏览",
      "coverBadge": "封面",
      "imageFailed": "失败"
    },
    "step4": {
      "heading": "打印设置",
      "material": "推荐材料",
      "layerHeight": "层高（mm）",
      "infill": "填充率（%）",
      "walls": "壁厚（层数）",
      "nozzle": "喷嘴（mm）",
      "estTime": "预计时间（小时）",
      "supportsRequired": "需要支撑结构",
      "notesLabel": "备注",
      "notesPlaceholder": "摆放方向、后处理提示…"
    },
    "step5": {
      "hardwareHeading": "五金零件",
      "addItem": "添加项目",
      "hardwarePlaceholder": "M3×10 螺栓",
      "assemblyHeading": "组装",
      "difficulty": "难度",
      "difficultyEasy": "简单",
      "difficultyModerate": "中等",
      "difficultyAdvanced": "进阶",
      "estTimeMin": "预计时间（分钟）",
      "toolsLabel": "工具",
      "toolsPlaceholder": "添加工具，按回车确认",
      "stepsLabel": "步骤",
      "addStep": "添加步骤"
    },
    "step6": {
      "heading": "审核并提交",
      "labelTitle": "标题",
      "labelCategory": "分类",
      "labelLicense": "许可证",
      "labelPricing": "定价",
      "labelFiles": "文件",
      "filesUploaded": "已上传 {count} 个",
      "labelImages": "图片",
      "safetyAck": "我确认这些文件归我所有，按原样提供，且未经认证用于道路使用。",
      "termsPrefix": "提交即代表您同意",
      "termsLink": "模型库条款与安全规范"
    },
    "nav": {
      "cancel": "取消",
      "saveChanges": "保存更改",
      "back": "上一步",
      "next": "下一步",
      "submit": "提交"
    },
    "choose": {
      "heading": "您想分享什么？",
      "subheading": "两种方式为模型库做贡献 — 选择一种开始。",
      "ownTitle": "上传您自己的模型",
      "ownDesc": "上传您的 STL/3MF 文件，附带打印设置、照片和组装说明 — 托管在此供社区使用。",
      "externalTitle": "分享您在网上找到的",
      "externalDesc": "在其他网站找到了不错的 Mini 模型？链接它，我们会拉取详情，并将人们引导至原网站下载。",
      "continue": "继续"
    }
  },
  "ko": {
    "meta": {
      "titleEdit": "모델 편집 | Classic Mini DIY",
      "titleUpload": "모델 업로드 | Classic Mini DIY"
    },
    "hero": {
      "edit": "3D 모델 편집",
      "upload": "3D 모델 공유"
    },
    "breadcrumb": {
      "edit": "편집",
      "upload": "업로드"
    },
    "auth": {
      "signInTitle": "모델을 공유하려면 로그인하세요",
      "signInBody": "라이브러리에 모델을 기여하려면 계정이 필요합니다.",
      "signInBtn": "로그인"
    },
    "success": {
      "savedTitle": "변경 사항 저장됨",
      "publishedTitle": "게시되었습니다!",
      "pendingTitle": "검토를 위해 제출됨",
      "savedBody": "모델 세부 정보가 업데이트되었습니다.",
      "publishedBody": "모델이 공개되었습니다 — 이동 중…",
      "pendingBody": "감사합니다! 모더레이터가 곧 검토할 것입니다. 내 모델에서 진행 상황을 확인할 수 있습니다.",
      "myModels": "내 모델",
      "view": "보기"
    },
    "steps": {
      "basics": "기본 정보",
      "files": "파일",
      "images": "이미지",
      "print": "출력 설정",
      "assembly": "조립",
      "review": "검토"
    },
    "context": {
      "contentOnly": "현재 게시된 버전을 편집 중입니다. 이 세부 정보는 모든 사람에게 실시간으로 반영됩니다. 모델 파일은 여기에서 변경할 수 없습니다 — 다른 파일을 게시하려면 내 모델에서 새 버전을 시작하세요.",
      "newVersion": "버전 {version}을 생성 중입니다. 이전 버전은 계속 사용 가능합니다 — 구매자와 모델을 다운로드한 모든 사람은 과거와 미래의 모든 버전에 계속 액세스할 수 있습니다."
    },
    "step1": {
      "heading": "기본 정보",
      "titleLabel": "제목",
      "titlePlaceholder": "예: Smiths 게이지 포드 (52 mm)",
      "summaryLabel": "요약",
      "summaryPlaceholder": "한 줄 설명",
      "descriptionLabel": "설명",
      "descriptionPlaceholder": "무엇인지, 어떻게 출력하는지, 무엇에 맞는지…",
      "categoryLabel": "카테고리",
      "categoryPlaceholder": "카테고리 선택",
      "sourceUrlLabel": "소스 URL",
      "sourceUrlPlaceholder": "원본 디자인 (선택 사항)",
      "tagsLabel": "태그",
      "tagsPlaceholder": "쉼표로 구분, Enter 키로 확인",
      "pricingDivider": "가격 및 라이선스",
      "pricingLabel": "가격 정책",
      "pricingFree": "무료",
      "pricingTips": "무료 + 팁",
      "pricingPwyw": "원하는 만큼 지불",
      "pricingFixed": "고정 가격",
      "sellGate": "판매하려면 Stripe 계정 연결이 필요합니다.",
      "sellGateCta": "판매 설정",
      "pwywHint": "구매자가 원하는 만큼 지불합니다 — 제안 가격만 설정하면 됩니다.",
      "priceUsd": "가격 (USD)",
      "minimumUsd": "최소 가격 (USD)",
      "suggestedUsd": "제안 가격 (USD)",
      "licenseLabel": "라이선스",
      "licensePlaceholder": "라이선스 선택",
      "licensePaidLink": "유료 파일 라이선스 약관 읽기",
      "licenseCcLink": "크리에이티브 커먼즈 라이선스 정보",
      "safetyCritical": "이것은 안전 필수 부품입니다 (구조, 제동, 조향, 연료)"
    },
    "step2": {
      "heading": "모델 파일",
      "hint": "STL, 3MF, OBJ, STEP, F3D 등 — 각 최대 200 MB, {maxFiles}개 파일.",
      "dropzone": "파일을 여기로 드래그하거나 클릭하여 탐색"
    },
    "fileStatus": {
      "uploading": "업로드 중…",
      "verifying": "확인 중…",
      "uploaded": "업로드됨",
      "failed": "실패",
      "pending": "대기 중"
    },
    "step3": {
      "heading": "이미지",
      "hint": "사진 또는 렌더링 — JPG/PNG/WebP, 최대 10 MB, 최대 {maxImages}장. 첫 번째가 표지입니다.",
      "dropzone": "이미지를 여기로 드래그하거나 클릭하여 탐색",
      "coverBadge": "표지",
      "imageFailed": "실패"
    },
    "step4": {
      "heading": "출력 설정",
      "material": "권장 재료",
      "layerHeight": "레이어 높이 (mm)",
      "infill": "채움률 (%)",
      "walls": "벽 개수",
      "nozzle": "노즐 (mm)",
      "estTime": "예상 시간 (시간)",
      "supportsRequired": "서포트 필요",
      "notesLabel": "메모",
      "notesPlaceholder": "방향 팁, 후처리…"
    },
    "step5": {
      "hardwareHeading": "하드웨어",
      "addItem": "항목 추가",
      "hardwarePlaceholder": "M3×10 볼트",
      "assemblyHeading": "조립",
      "difficulty": "난이도",
      "difficultyEasy": "쉬움",
      "difficultyModerate": "보통",
      "difficultyAdvanced": "고급",
      "estTimeMin": "예상 시간 (분)",
      "toolsLabel": "도구",
      "toolsPlaceholder": "도구 추가, Enter 키로 확인",
      "stepsLabel": "단계",
      "addStep": "단계 추가"
    },
    "step6": {
      "heading": "검토 및 제출",
      "labelTitle": "제목",
      "labelCategory": "카테고리",
      "labelLicense": "라이선스",
      "labelPricing": "가격",
      "labelFiles": "파일",
      "filesUploaded": "{count}개 업로드됨",
      "labelImages": "이미지",
      "safetyAck": "이 파일들이 제 것임을 확인하며, 현 상태로 제공되고 도로 사용에 인증되지 않았음을 확인합니다.",
      "termsPrefix": "제출하면",
      "termsLink": "모델 라이브러리 약관 및 안전"
    },
    "nav": {
      "cancel": "취소",
      "saveChanges": "변경 사항 저장",
      "back": "이전",
      "next": "다음",
      "submit": "제출"
    },
    "choose": {
      "heading": "무엇을 공유하시겠어요?",
      "subheading": "라이브러리에 기여하는 두 가지 방법 — 하나를 선택해 시작하세요.",
      "ownTitle": "내 모델 올리기",
      "ownDesc": "STL/3MF 파일을 출력 설정, 사진, 조립 노트와 함께 업로드 — 커뮤니티를 위해 여기에 호스팅됩니다.",
      "externalTitle": "온라인에서 찾은 것 공유하기",
      "externalDesc": "다른 사이트에서 좋은 Mini 모델을 찾으셨나요? 링크하면 세부정보를 가져오고, 다운로드는 원본 사이트로 안내합니다.",
      "continue": "계속"
    }
  }
}
</i18n>
