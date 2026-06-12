/**
 * Upload-wizard state machine (keystone §11 PR 7). Orchestrates the stateful
 * flow our graph model requires:
 *   1. create the DRAFT model + version 1 early (POST /api/models) so files have
 *      a version_id to attach to;
 *   2. files → presigned POST straight to S3, then finalize (PR5 routes);
 *   3. images → server route → Supabase Storage `model-images`;
 *   4. PATCH the model (content/safety_ack) and version (print/BOM/assembly);
 *   5. submit_model_version via the submit route.
 *
 * The session token lives in localStorage (not a cookie), so every API call
 * carries an explicit Authorization: Bearer header.
 */
import {
  type PrintSettings,
  type HardwareItem,
  type AssemblyInstructions,
  type PricingMode,
  MODEL_FILE_EXTS,
  MODEL_VIEWER_MAX_BYTES,
} from '~~/data/models/model-library';

export interface WizardFile {
  fileId: string;
  name: string;
  ext: string;
  sizeBytes: number;
  isRenderable: boolean;
  status: 'pending' | 'uploading' | 'verifying' | 'uploaded' | 'error';
  progress: number;
  error?: string;
}

export interface WizardImage {
  id: string;
  url: string;
  isPrimary: boolean;
  status: 'uploading' | 'uploaded' | 'error';
  error?: string;
}

const FILE_MAX_BYTES = 209_715_200; // 200 MiB (mirrors model_files cap)
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 20;
const MAX_IMAGES = 12;

export function useModelUpload() {
  const supabase = useSupabase();

  const step = ref(1);
  const totalSteps = 6;
  const saving = ref(false);
  const error = ref<string | null>(null);

  // Created draft (set after step 1).
  const modelId = ref<string | null>(null);
  const slug = ref<string | null>(null);
  const versionId = ref<string | null>(null);
  // Editing an existing model (resume draft / new version / content edit).
  const isEditing = ref(false);
  const contentOnly = ref(false);
  const modelStatus = ref<string | null>(null);
  const versionNumber = ref<number | null>(null);

  // Step 1 — basics + pricing
  const title = ref('');
  const summary = ref('');
  const description = ref('');
  const categorySlug = ref('');
  const tags = ref<string[]>([]);
  const licenseCode = ref('');
  const pricingMode = ref<PricingMode>('free');
  const priceCents = ref<number | null>(null);
  const minPriceCents = ref<number | null>(null);
  const suggestedPriceCents = ref<number | null>(null);
  const sourceUrl = ref('');
  const safetyCritical = ref(false);

  // Steps 2–3
  const files = ref<WizardFile[]>([]);
  const images = ref<WizardImage[]>([]);

  // Steps 4–5
  const printSettings = ref<PrintSettings>({
    recommendedMaterial: 'PLA',
    layerHeight: 0.2,
    infillPercent: 20,
    supportsRequired: false,
  });
  const hardwareBom = ref<HardwareItem[]>([]);
  const assembly = ref<AssemblyInstructions>({ difficulty: 'easy', toolsRequired: [], steps: [] });

  // Step 6
  const safetyAck = ref(false);

  const isPaid = computed(() => pricingMode.value === 'fixed' || pricingMode.value === 'pwyw');

  const canProceedStep1 = computed(() => title.value.trim().length >= 3 && !!categorySlug.value && !!licenseCode.value);
  const hasRenderableOrImage = computed(() => files.value.some((f) => f.isRenderable) || images.value.length > 0);
  const canProceedStep2 = computed(() => files.value.some((f) => f.status === 'uploaded'));
  const canSubmit = computed(
    () => canProceedStep1.value && canProceedStep2.value && hasRenderableOrImage.value && safetyAck.value
  );

  async function authHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function extOf(name: string): string {
    return (name.split('.').pop() || '').toLowerCase();
  }

  /** Create the draft model + version (step 1 → next), or PATCH if it exists. */
  async function ensureDraft(): Promise<boolean> {
    error.value = null;
    const payload = {
      title: title.value.trim(),
      summary: summary.value.trim() || null,
      description: description.value || null,
      categorySlug: categorySlug.value,
      tags: tags.value,
      licenseCode: licenseCode.value,
      pricingMode: pricingMode.value,
      priceCents: priceCents.value,
      minPriceCents: minPriceCents.value,
      suggestedPriceCents: suggestedPriceCents.value,
      sourceUrl: sourceUrl.value.trim() || null,
      safetyCritical: safetyCritical.value,
    };
    try {
      const headers = await authHeaders();
      if (!modelId.value) {
        const res = await $fetch<{ modelId: string; slug: string; versionId: string }>('/api/models', {
          method: 'POST',
          headers,
          body: payload,
        });
        modelId.value = res.modelId;
        slug.value = res.slug;
        versionId.value = res.versionId;
      } else {
        // `as string` opts out of typed-route inference (the path has both a GET
        // and a PATCH handler, which the inference can't disambiguate).
        await $fetch(`/api/models/${modelId.value}` as string, { method: 'PATCH', headers, body: payload });
      }
      return true;
    } catch (e: any) {
      error.value = e?.data?.statusMessage || e?.statusMessage || 'Could not save the model';
      return false;
    }
  }

  async function addFiles(fileList: File[]) {
    error.value = null;
    if (!versionId.value) {
      error.value = 'Save the basics first.';
      return;
    }
    for (const file of fileList) {
      if (files.value.length >= MAX_FILES) {
        error.value = `A version may have at most ${MAX_FILES} files`;
        break;
      }
      const ext = extOf(file.name);
      if (!(MODEL_FILE_EXTS as readonly string[]).includes(ext)) {
        error.value = `Unsupported file type: .${ext}`;
        continue;
      }
      if (file.size < 1 || file.size > FILE_MAX_BYTES) {
        error.value = `${file.name} is too large (200 MB max)`;
        continue;
      }
      const entry = reactive<WizardFile>({
        fileId: '',
        name: file.name,
        ext,
        sizeBytes: file.size,
        isRenderable: ['stl', '3mf', 'obj'].includes(ext),
        status: 'pending',
        progress: 0,
      });
      files.value.push(entry);
      await uploadOneFile(entry, file);
    }
  }

  async function uploadOneFile(entry: WizardFile, file: File) {
    try {
      const headers = await authHeaders();
      entry.status = 'uploading';
      const presign = await $fetch<{ fileId: string; upload: { url: string; fields: Record<string, string> } }>(
        '/api/models/uploads/presign',
        {
          method: 'POST',
          headers,
          body: { versionId: versionId.value, fileName: file.name, ext: entry.ext, sizeBytes: file.size },
        }
      );
      entry.fileId = presign.fileId;
      await postToS3(presign.upload, file, (p) => (entry.progress = p));
      entry.status = 'verifying';
      const fin = await $fetch<{ uploadStatus: string }>('/api/models/uploads/finalize', {
        method: 'POST',
        headers,
        body: { fileId: presign.fileId },
      });
      entry.status = fin.uploadStatus === 'uploaded' ? 'uploaded' : 'error';
      entry.progress = 100;
    } catch (e: any) {
      entry.status = 'error';
      entry.error = e?.data?.statusMessage || e?.statusMessage || 'Upload failed';
    }
  }

  function postToS3(
    post: { url: string; fields: Record<string, string> },
    file: File,
    onProgress: (p: number) => void
  ) {
    return new Promise<void>((resolve, reject) => {
      const form = new FormData();
      Object.entries(post.fields).forEach(([k, v]) => form.append(k, v));
      form.append('file', file);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', post.url);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 ${xhr.status}`)));
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(form);
    });
  }

  async function removeFile(fileId: string) {
    const idx = files.value.findIndex((f) => f.fileId === fileId);
    if (idx === -1) return;
    files.value.splice(idx, 1);
    // Best-effort row delete via RLS (owner while draft); S3 object is GC'd nightly.
    if (fileId) await supabase.from('model_files').delete().eq('id', fileId);
  }

  async function addImages(fileList: File[]) {
    error.value = null;
    if (!modelId.value) {
      error.value = 'Save the basics first.';
      return;
    }
    for (const file of fileList) {
      if (images.value.length >= MAX_IMAGES) {
        error.value = `A model may have at most ${MAX_IMAGES} images`;
        break;
      }
      if (file.size > IMAGE_MAX_BYTES) {
        error.value = `${file.name} is too large (10 MB max)`;
        continue;
      }
      const entry = reactive<WizardImage>({
        id: '',
        url: URL.createObjectURL(file),
        isPrimary: false,
        status: 'uploading',
      });
      images.value.push(entry);
      try {
        const headers = await authHeaders();
        const form = new FormData();
        form.append('file', file);
        const res = await $fetch<{ id: string; url: string; isPrimary: boolean }>(
          `/api/models/${modelId.value}/images`,
          { method: 'POST', headers, body: form }
        );
        URL.revokeObjectURL(entry.url);
        entry.id = res.id;
        entry.url = res.url;
        entry.isPrimary = res.isPrimary;
        entry.status = 'uploaded';
      } catch (e: any) {
        entry.status = 'error';
        entry.error = e?.data?.statusMessage || e?.statusMessage || 'Image upload failed';
      }
    }
  }

  async function removeImage(id: string) {
    const idx = images.value.findIndex((i) => i.id === id || i.url.startsWith('blob:'));
    if (idx === -1) return;
    const img = images.value[idx]!;
    images.value.splice(idx, 1);
    if (img.id && modelId.value) {
      const headers = await authHeaders();
      await $fetch(`/api/models/${modelId.value}/images/${img.id}`, { method: 'DELETE', headers }).catch(() => {});
    }
  }

  /** Persist the version JSONB (print settings / BOM / assembly). */
  async function saveVersionMeta(): Promise<boolean> {
    if (!modelId.value || !versionId.value) return false;
    try {
      const headers = await authHeaders();
      await $fetch(`/api/models/${modelId.value}/versions/${versionId.value}`, {
        method: 'PATCH',
        headers,
        body: {
          printSettings: printSettings.value,
          hardwareBom: hardwareBom.value,
          assembly: assembly.value,
        },
      });
      return true;
    } catch (e: any) {
      error.value = e?.data?.statusMessage || e?.statusMessage || 'Could not save print settings';
      return false;
    }
  }

  /** Final step: persist everything + submit for review. */
  async function submit(): Promise<{ status: string; slug: string } | null> {
    if (!modelId.value || !versionId.value) return null;
    saving.value = true;
    error.value = null;
    try {
      const headers = await authHeaders();
      await $fetch(`/api/models/${modelId.value}` as string, {
        method: 'PATCH',
        headers,
        body: { safetyAck: safetyAck.value },
      });
      await saveVersionMeta();
      const res = await $fetch<{ versionStatus: string }>(
        `/api/models/${modelId.value}/versions/${versionId.value}/submit`,
        { method: 'POST', headers }
      );
      return { status: res.versionStatus, slug: slug.value || '' };
    } catch (e: any) {
      error.value = e?.data?.statusMessage || e?.statusMessage || 'Could not submit for review';
      return null;
    } finally {
      saving.value = false;
    }
  }

  function next() {
    if (step.value < totalSteps) step.value++;
  }
  function prev() {
    if (step.value > 1) step.value--;
  }

  /**
   * Load an existing model into the wizard (resume a draft, add a new version,
   * or edit a published model's content). Sets `isEditing`; sets `contentOnly`
   * when the model is published with no open draft version (content edits only).
   */
  async function loadExisting(id: string): Promise<boolean> {
    error.value = null;
    try {
      const headers = await authHeaders();
      const res = await $fetch<any>(`/api/models/${id}/edit`, { headers });
      const m = res.model;
      modelId.value = m.id;
      slug.value = m.slug;
      modelStatus.value = m.status || null;
      title.value = m.title || '';
      summary.value = m.summary || '';
      description.value = m.description || '';
      categorySlug.value = m.categorySlug || '';
      tags.value = m.tags || [];
      licenseCode.value = m.licenseCode || '';
      pricingMode.value = (m.pricingMode || 'free') as PricingMode;
      priceCents.value = m.priceCents ?? null;
      minPriceCents.value = m.minPriceCents ?? null;
      suggestedPriceCents.value = m.suggestedPriceCents ?? null;
      sourceUrl.value = m.sourceUrl || '';
      safetyCritical.value = !!m.safetyCritical;

      if (res.version) {
        versionId.value = res.version.id;
        versionNumber.value = res.version.versionNumber ?? null;
        if (res.version.printSettings) printSettings.value = res.version.printSettings;
        if (Array.isArray(res.version.hardwareBom)) hardwareBom.value = res.version.hardwareBom;
        if (res.version.assembly) assembly.value = res.version.assembly;
        files.value = (res.files || []).map((f: any) =>
          reactive<WizardFile>({
            fileId: f.fileId,
            name: f.name,
            ext: f.ext,
            sizeBytes: f.sizeBytes,
            isRenderable: f.isRenderable,
            status: 'uploaded',
            progress: 100,
          })
        );
      } else {
        // Published model with no open draft — only the content is editable.
        contentOnly.value = true;
      }
      images.value = (res.images || []).map((img: any) =>
        reactive<WizardImage>({ id: img.id, url: img.url, isPrimary: img.isPrimary, status: 'uploaded' })
      );
      isEditing.value = true;
      return true;
    } catch (e: any) {
      error.value = e?.data?.statusMessage || e?.statusMessage || 'Could not load this model';
      return false;
    }
  }

  return {
    step,
    totalSteps,
    saving,
    error,
    modelId,
    slug,
    versionId,
    isEditing,
    contentOnly,
    modelStatus,
    versionNumber,
    // fields
    title,
    summary,
    description,
    categorySlug,
    tags,
    licenseCode,
    pricingMode,
    priceCents,
    minPriceCents,
    suggestedPriceCents,
    sourceUrl,
    safetyCritical,
    files,
    images,
    printSettings,
    hardwareBom,
    assembly,
    safetyAck,
    // derived
    isPaid,
    canProceedStep1,
    canProceedStep2,
    hasRenderableOrImage,
    canSubmit,
    // actions
    ensureDraft,
    addFiles,
    removeFile,
    addImages,
    removeImage,
    saveVersionMeta,
    submit,
    loadExisting,
    next,
    prev,
    // constants
    MAX_FILES,
    MAX_IMAGES,
    FILE_MAX_BYTES,
    MODEL_VIEWER_MAX_BYTES,
  };
}
