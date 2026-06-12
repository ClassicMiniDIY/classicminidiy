<script setup lang="ts">
  import { HERO_TYPES } from '~~/data/models/generic';

  const { isAuthenticated } = useAuth();
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
  const minDollars = dollars(w.minPriceCents);
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

  const pricingChoices = [
    { value: 'free', label: 'Free' },
    { value: 'tips', label: 'Free + tips' },
    { value: 'pwyw', label: 'Pay what you want' },
    { value: 'fixed', label: 'Fixed price' },
  ] as const;

  useHead({ title: 'Upload a model | Classic Mini DIY' });
  definePageMeta({ key: 'models-upload' });
</script>

<template>
  <hero :navigation="true" title="Share a 3D Model" :heroType="HERO_TYPES.ARCHIVE" />
  <div class="container mx-auto px-4 max-w-3xl pb-16">
    <breadcrumb class="my-6" page="Upload" subpage="3D Models" subpageHref="/models" />

    <!-- Not signed in -->
    <div v-if="!isAuthenticated" class="card bg-base-100 border border-base-300 shadow-sm my-10">
      <div class="card-body items-center text-center gap-3">
        <i class="fas fa-right-to-bracket text-4xl text-primary"></i>
        <h2 class="card-title">Sign in to share a model</h2>
        <p class="opacity-70">You need an account to contribute models to the library.</p>
        <NuxtLink to="/login" class="btn btn-primary"><i class="fas fa-right-to-bracket mr-1"></i> Sign in</NuxtLink>
      </div>
    </div>

    <!-- Success -->
    <div v-else-if="submitted" class="card bg-base-100 border border-base-300 shadow-sm my-10">
      <div class="card-body items-center text-center gap-3">
        <i class="fas fa-circle-check text-5xl text-success"></i>
        <h2 class="card-title">{{ submitted.status === 'published' ? 'Published!' : 'Submitted for review' }}</h2>
        <p class="opacity-70">
          {{
            submitted.status === 'published'
              ? 'Your model is live — taking you there…'
              : 'Thanks! Our moderators will review it shortly. You can track it under My Models.'
          }}
        </p>
        <div class="flex gap-2">
          <NuxtLink to="/models/mine" class="btn btn-primary">My Models</NuxtLink>
          <NuxtLink
            v-if="submitted.slug && submitted.status === 'published'"
            :to="`/models/${submitted.slug}`"
            class="btn btn-ghost"
            >View</NuxtLink
          >
        </div>
      </div>
    </div>

    <template v-else>
      <!-- Steps indicator -->
      <ul class="steps steps-horizontal w-full mb-6 text-xs">
        <li class="step" :class="{ 'step-primary': w.step.value >= 1 }">Basics</li>
        <li class="step" :class="{ 'step-primary': w.step.value >= 2 }">Files</li>
        <li class="step" :class="{ 'step-primary': w.step.value >= 3 }">Images</li>
        <li class="step" :class="{ 'step-primary': w.step.value >= 4 }">Print</li>
        <li class="step" :class="{ 'step-primary': w.step.value >= 5 }">Assembly</li>
        <li class="step" :class="{ 'step-primary': w.step.value >= 6 }">Review</li>
      </ul>

      <div v-if="w.error.value" class="alert alert-error mb-4">
        <i class="fas fa-circle-exclamation"></i> <span>{{ w.error.value }}</span>
      </div>

      <div class="card bg-base-100 border border-base-300 shadow-sm">
        <div class="card-body gap-2">
          <!-- STEP 1: BASICS -->
          <div v-show="w.step.value === 1" class="space-y-2">
            <h2 class="card-title mb-2">The basics</h2>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">Title</legend>
              <input
                v-model="w.title.value"
                type="text"
                maxlength="120"
                class="input w-full"
                placeholder="e.g. Smiths gauge pod (52 mm)"
              />
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">Summary</legend>
              <input
                v-model="w.summary.value"
                type="text"
                maxlength="280"
                class="input w-full"
                placeholder="One-line description"
              />
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">Description</legend>
              <textarea
                v-model="w.description.value"
                rows="4"
                maxlength="20000"
                class="textarea w-full"
                placeholder="What it is, how it prints, what it fits…"
              ></textarea>
            </fieldset>

            <div class="grid sm:grid-cols-2 gap-x-4">
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Category</legend>
                <select v-model="w.categorySlug.value" class="select w-full">
                  <option value="" disabled>Choose a category</option>
                  <option v-for="c in categories" :key="c.slug" :value="c.slug">{{ c.name }}</option>
                </select>
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Source URL</legend>
                <input
                  v-model="w.sourceUrl.value"
                  type="url"
                  class="input w-full"
                  placeholder="Original design (optional)"
                />
              </fieldset>
            </div>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">Tags</legend>
              <input
                v-model="tagInput"
                type="text"
                class="input w-full"
                placeholder="Comma-separated, press Enter"
                @keydown.enter.prevent="commitTags"
                @blur="commitTags"
              />
              <div v-if="w.tags.value.length" class="flex flex-wrap gap-1.5 mt-2">
                <span v-for="(t, i) in w.tags.value" :key="t" class="badge badge-neutral gap-1">
                  {{ t }}
                  <button type="button" @click="w.tags.value.splice(i, 1)">
                    <i class="fas fa-xmark text-[0.6rem]"></i>
                  </button>
                </span>
              </div>
            </fieldset>

            <div class="divider text-sm">Pricing &amp; license</div>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">Pricing</legend>
              <div class="join">
                <button
                  v-for="p in pricingChoices"
                  :key="p.value"
                  type="button"
                  class="btn join-item btn-sm"
                  :class="w.pricingMode.value === p.value ? 'btn-primary' : 'btn-outline'"
                  @click="w.pricingMode.value = p.value"
                >
                  {{ p.label }}
                </button>
              </div>
            </fieldset>

            <div v-if="w.pricingMode.value === 'fixed'" class="grid grid-cols-2 gap-x-4">
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Price (USD)</legend>
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
                <legend class="fieldset-legend">Minimum (USD)</legend>
                <input v-model="minDollars" type="number" min="1" step="0.50" class="input w-full" placeholder="1.00" />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Suggested (USD)</legend>
                <input
                  v-model="suggestedDollars"
                  type="number"
                  min="1"
                  step="0.50"
                  class="input w-full"
                  placeholder="5.00"
                />
              </fieldset>
            </div>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">License</legend>
              <select v-model="w.licenseCode.value" class="select w-full">
                <option value="" disabled>Choose a license</option>
                <option v-for="l in licenseOptions" :key="l.code" :value="l.code">{{ l.name }}</option>
              </select>
            </fieldset>

            <label class="flex items-start gap-3 cursor-pointer mt-2">
              <input v-model="w.safetyCritical.value" type="checkbox" class="checkbox checkbox-warning mt-0.5" />
              <span class="text-sm">This is a safety-critical part (structural, braking, steering, fuel)</span>
            </label>
          </div>

          <!-- STEP 2: FILES -->
          <div v-show="w.step.value === 2" class="space-y-3">
            <h2 class="card-title">Model files</h2>
            <p class="text-sm opacity-70">
              STL, 3MF, OBJ, STEP, F3D and more — up to 200 MB each, {{ w.MAX_FILES }} files.
            </p>
            <div
              class="border-2 border-dashed border-base-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary transition-colors"
              @click="fileInput?.click()"
              @drop.prevent="onDropFiles"
              @dragover.prevent
            >
              <i class="fas fa-cloud-arrow-up text-3xl opacity-50"></i>
              <p class="mt-2 text-sm">Drag files here or click to browse</p>
              <input ref="fileInput" type="file" multiple class="hidden" @change="onFilePick" />
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
                        uploading: 'Uploading…',
                        verifying: 'Verifying…',
                        uploaded: 'Uploaded',
                        error: f.error || 'Failed',
                        pending: 'Queued',
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
            <h2 class="card-title">Images</h2>
            <p class="text-sm opacity-70">
              Photos or renders — JPG/PNG/WebP, 10 MB max, up to {{ w.MAX_IMAGES }}. The first is the cover.
            </p>
            <div
              class="border-2 border-dashed border-base-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary transition-colors"
              @click="imageInput?.click()"
              @drop.prevent="onDropImages"
              @dragover.prevent
            >
              <i class="fas fa-image text-3xl opacity-50"></i>
              <p class="mt-2 text-sm">Drag images here or click to browse</p>
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
                <span v-if="img.isPrimary" class="absolute top-1 left-1 badge badge-primary badge-xs">Cover</span>
                <span
                  v-if="img.status === 'error'"
                  class="absolute inset-0 flex items-center justify-center bg-error/70 text-xs text-white"
                  >Failed</span
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
            <h2 class="card-title mb-2">Print settings</h2>
            <div class="grid sm:grid-cols-2 gap-x-4">
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Recommended material</legend>
                <input v-model="w.printSettings.value.recommendedMaterial" class="input w-full" placeholder="PLA" />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Layer height (mm)</legend>
                <input
                  v-model.number="w.printSettings.value.layerHeight"
                  type="number"
                  step="0.04"
                  class="input w-full"
                />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Infill (%)</legend>
                <input v-model.number="w.printSettings.value.infillPercent" type="number" class="input w-full" />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Walls</legend>
                <input v-model.number="w.printSettings.value.wallCount" type="number" class="input w-full" />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Nozzle (mm)</legend>
                <input
                  v-model.number="w.printSettings.value.nozzleSize"
                  type="number"
                  step="0.1"
                  class="input w-full"
                />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Est. time (hours)</legend>
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
              <span class="text-sm">Supports required</span>
            </label>
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Notes</legend>
              <textarea
                v-model="w.printSettings.value.notes"
                rows="2"
                class="textarea w-full"
                placeholder="Orientation tips, post-processing…"
              ></textarea>
            </fieldset>
          </div>

          <!-- STEP 5: HARDWARE + ASSEMBLY -->
          <div v-show="w.step.value === 5" class="space-y-5">
            <div>
              <div class="flex items-center justify-between">
                <h2 class="card-title">Hardware</h2>
                <button type="button" class="btn btn-ghost btn-sm" @click="addHardware">
                  <i class="fas fa-plus mr-1"></i> Add item
                </button>
              </div>
              <div v-for="(h, i) in w.hardwareBom.value" :key="i" class="flex gap-2 mt-2 items-center">
                <input v-model="h.item" class="input input-sm flex-1" placeholder="M3×10 bolt" />
                <input v-model.number="h.quantity" type="number" min="1" class="input input-sm w-20" />
                <button type="button" class="btn btn-ghost btn-sm btn-square" @click="w.hardwareBom.value.splice(i, 1)">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            <div>
              <h2 class="card-title">Assembly</h2>
              <div class="grid sm:grid-cols-2 gap-x-4 mt-2">
                <fieldset class="fieldset">
                  <legend class="fieldset-legend">Difficulty</legend>
                  <select v-model="w.assembly.value.difficulty" class="select select-sm w-full">
                    <option value="easy">Easy</option>
                    <option value="moderate">Moderate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </fieldset>
                <fieldset class="fieldset">
                  <legend class="fieldset-legend">Est. time (min)</legend>
                  <input
                    v-model.number="w.assembly.value.estimatedTimeMinutes"
                    type="number"
                    class="input input-sm w-full"
                  />
                </fieldset>
              </div>
              <fieldset class="fieldset mt-1">
                <legend class="fieldset-legend">Tools</legend>
                <input
                  v-model="toolInput"
                  class="input input-sm w-full"
                  placeholder="Add a tool, press Enter"
                  @keydown.enter.prevent="commitTool"
                />
                <div v-if="w.assembly.value.toolsRequired?.length" class="flex flex-wrap gap-1.5 mt-2">
                  <span v-for="(t, i) in w.assembly.value.toolsRequired" :key="t" class="badge badge-ghost gap-1">
                    {{ t }}
                    <button type="button" @click="w.assembly.value.toolsRequired!.splice(i, 1)">
                      <i class="fas fa-xmark text-[0.6rem]"></i>
                    </button>
                  </span>
                </div>
              </fieldset>
              <div class="flex items-center justify-between mt-3">
                <span class="fieldset-legend">Steps</span>
                <button type="button" class="btn btn-ghost btn-sm" @click="addStep">
                  <i class="fas fa-plus mr-1"></i> Add step
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
            <h2 class="card-title">Review &amp; submit</h2>
            <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt class="opacity-60">Title</dt>
              <dd>{{ w.title.value }}</dd>
              <dt class="opacity-60">Category</dt>
              <dd>{{ categories.find((c: any) => c.slug === w.categorySlug.value)?.name }}</dd>
              <dt class="opacity-60">License</dt>
              <dd>{{ w.licenseCode.value }}</dd>
              <dt class="opacity-60">Pricing</dt>
              <dd class="capitalize">{{ w.pricingMode.value }}</dd>
              <dt class="opacity-60">Files</dt>
              <dd>{{ w.files.value.filter((f) => f.status === 'uploaded').length }} uploaded</dd>
              <dt class="opacity-60">Images</dt>
              <dd>{{ w.images.value.length }}</dd>
            </dl>
            <ModelsSafetyDisclaimer :safety-critical="w.safetyCritical.value" />
            <label class="flex items-start gap-3 cursor-pointer">
              <input v-model="w.safetyAck.value" type="checkbox" class="checkbox checkbox-primary mt-0.5" />
              <span class="text-sm"
                >I confirm these files are mine to share, are provided as-is, and are not certified for road use.</span
              >
            </label>
          </div>

          <!-- NAV -->
          <div class="flex justify-between items-center pt-4 mt-2 border-t border-base-300">
            <button
              type="button"
              class="btn btn-ghost"
              :disabled="w.step.value === 1 || w.saving.value"
              @click="w.prev"
            >
              <i class="fas fa-arrow-left mr-1"></i> Back
            </button>
            <button
              v-if="w.step.value < 6"
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
              Next <i class="fas fa-arrow-right ml-1"></i>
            </button>
            <button
              v-else
              type="button"
              class="btn btn-primary"
              :disabled="!w.canSubmit.value || w.saving.value"
              @click="onSubmit"
            >
              <span v-if="w.saving.value" class="loading loading-spinner loading-sm"></span>
              <i v-else class="fas fa-paper-plane mr-1"></i> Submit
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
