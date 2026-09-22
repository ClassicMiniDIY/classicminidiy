// @vitest-environment happy-dom
/**
 * ContributeWizard validation timing and submission (app/components/ContributeWizard.vue).
 *
 * Regression: launching the wizard with a kind (the registry page's Contribute
 * button) opens straight on step 2, and every required-field error rendered at
 * once, as a list under the form, before the person had typed anything.
 * Errors now render under their own field, only after that field is left or
 * after Continue/Submit is pressed with problems remaining.
 *
 * The later cases walk each contribution kind through to submit, so the
 * payloads the approve route depends on stay pinned.
 *
 * The i18n mock returns keys verbatim, so assertions match keys.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { ref, useTemplateRef } from 'vue';

const isOpen = ref(false);
const context = ref<Record<string, any>>({});
const isAuthenticated = ref(true);
const closeWizard = vi.fn(() => {
  isOpen.value = false;
});
const submitContribution = vi.fn(async () => ({ id: 'sub-1' }));
const requestItem = vi.fn(async () => ({ id: 'req-1' }));
const toastAdd = vi.fn();
const authFetch = vi.fn(async () => ({}));

(global as any).useTemplateRef = useTemplateRef;
(global as any).useContributeWizard = () => ({ isOpen, context, closeWizard, openWizard: vi.fn() });
(global as any).useAuth = () => ({ isAuthenticated });
(global as any).useSubmissions = () => ({ submitContribution });
(global as any).useArchiveRequests = () => ({ requestItem });
(global as any).useToast = () => ({ add: toastAdd });
(global as any).useAuthFetch = authFetch;
(global as any).$fetch = vi.fn(async () => ({ variants: [] }));

const { default: ContributeWizard } = await import('~/app/components/ContributeWizard.vue');

/** Stand-in for the upload widget: a button that "picks" one file. */
const FileUploadStub = {
  name: 'ContributeFileUpload',
  emits: ['update:files'],
  setup(_: unknown, { emit }: { emit: (e: 'update:files', files: File[]) => void }) {
    return { pick: () => emit('update:files', [new globalThis.File(['x'], 'a.jpg', { type: 'image/jpeg' })]) };
  },
  template: `<button type="button" class="stub-add-file" @click="pick">add</button>`,
};

async function openWizard(ctx: Record<string, any>) {
  const wrapper = mount(ContributeWizard, {
    attachTo: document.body,
    global: { stubs: { teleport: true, transition: false, ContributeFileUpload: FileUploadStub } },
  });
  context.value = { origin: 'test', ...ctx };
  isOpen.value = true;
  await flushPromises();
  return wrapper;
}
type W = VueWrapper<any>;
const shown = (w: W) => w.findAll('[id^="contribute-error-"]').map((e) => e.text());
const button = (w: W, key: string) => w.findAll('button').find((b) => b.text().includes(key))!;
const press = async (w: W, key: string) => {
  await button(w, key).trigger('click');
  await flushPromises();
};
/** The control whose label text is exactly `key` (the i18n mock returns keys). */
const field = (w: W, key: string) => {
  const label = w
    .findAll('label')
    .find((l) => l.find('span').exists() && l.find('span').text().replace(' *', '') === key);
  if (!label) throw new Error(`no field labelled ${key}`);
  return label.find('input, select, textarea');
};

describe('ContributeWizard validation', () => {
  beforeEach(() => {
    isOpen.value = false;
    isAuthenticated.value = true;
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('opens on step 2 with no errors showing', async () => {
    const w = await openWizard({ kind: 'registry' });
    expect(w.text()).toContain('step_of');
    expect(field(w, 'fields.year').exists()).toBe(true);
    expect(shown(w)).toEqual([]);
    expect(w.find('ul[role="alert"]').exists()).toBe(false);
    w.unmount();
  });

  it('shows only the field that was left, under that field, and clears it when fixed', async () => {
    const w = await openWizard({ kind: 'registry' });
    const year = field(w, 'fields.year');
    await year.trigger('blur');
    expect(shown(w)).toEqual(['errors.year']);
    expect(year.attributes('aria-invalid')).toBe('true');
    expect(year.attributes('aria-describedby')).toBe('contribute-error-year');
    await year.setValue('1995');
    expect(shown(w)).toEqual([]);
    w.unmount();
  });

  it('reveals every remaining problem when Continue is pressed, and stays on step 2', async () => {
    const w = await openWizard({ kind: 'registry' });
    expect(button(w, 'continue').attributes('disabled')).toBeUndefined();
    await press(w, 'continue');
    expect(shown(w)).toEqual(['errors.year', 'errors.model']);
    expect(w.find('ul[role="alert"]').exists()).toBe(true);
    expect(document.activeElement?.getAttribute('aria-describedby')).toBe('contribute-error-year');
    w.unmount();
  });

  it('starts clean again after Back and a different tile', async () => {
    const w = await openWizard({ kind: 'registry' });
    await press(w, 'continue');
    expect(shown(w).length).toBe(2);
    await press(w, 'back');
    await w
      .findAll('.wizard-tile')
      .find((b) => b.text().includes('kinds.fix'))!
      .trigger('click');
    await press(w, 'continue');
    expect(shown(w)).toEqual([]);
    w.unmount();
  });
});

describe('ContributeWizard submission', () => {
  beforeEach(() => {
    isOpen.value = false;
    isAuthenticated.value = true;
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('submits a registry car with the payload keys the approve route reads', async () => {
    const w = await openWizard({ kind: 'registry' });
    await field(w, 'fields.year').setValue('1995');
    await field(w, 'fields.model').setValue('Rover Mini');
    await field(w, 'fields.trim').setValue('Kensington');
    await field(w, 'fields.body_number').setValue('SAX123');
    await press(w, 'continue');
    expect(w.text()).toContain('step3_question');
    expect(w.text()).toContain('Kensington');
    await press(w, 'submit');
    expect(submitContribution).toHaveBeenCalledWith(
      'new_item',
      'registry',
      null,
      expect.objectContaining({ year: 1995, model: 'Rover Mini', trim: 'Kensington', bodyNum: 'SAX123' })
    );
    expect(closeWizard).toHaveBeenCalled();
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'success' }));
  });

  it('requires a file for a document, then uploads it after the submission', async () => {
    const w = await openWizard({ kind: 'document' });
    await field(w, 'fields.title').setValue('Workshop manual');
    await press(w, 'continue');
    expect(shown(w)).toEqual(['errors.file']);
    await w.find('.stub-add-file').trigger('click');
    expect(shown(w)).toEqual([]);
    await press(w, 'continue');
    await press(w, 'submit');
    expect(submitContribution).toHaveBeenCalledWith(
      'new_item',
      'document',
      null,
      expect.objectContaining({ title: 'Workshop manual', type: 'manual' })
    );
    expect(authFetch).toHaveBeenCalledWith(
      '/api/archive/upload',
      expect.objectContaining({ query: { bucket: 'archive-documents', submissionId: 'sub-1' } })
    );
  });

  it('requires name, size and a photo for a new wheel', async () => {
    const w = await openWizard({ kind: 'wheel' });
    await press(w, 'continue');
    expect(shown(w)).toEqual(['errors.name', 'errors.size', 'errors.photo']);
    await field(w, 'fields.name').setValue('Minilite');
    await field(w, 'fields.size').setValue('10');
    await w.find('.stub-add-file').trigger('click');
    await press(w, 'continue');
    await press(w, 'submit');
    expect(submitContribution).toHaveBeenCalledWith(
      'new_item',
      'wheel',
      null,
      expect.objectContaining({ name: 'Minilite', size: '10' })
    );
  });

  it('sends a fix as an edit suggestion against the launch target', async () => {
    const w = await openWizard({ kind: 'fix', targetType: 'wheel', targetId: 'w-1', targetTitle: 'Minilite' });
    const reason = field(w, 'fields.reason');
    await reason.setValue('short');
    await reason.trigger('blur');
    expect(shown(w)).toEqual(['errors.reason']);
    await reason.setValue('The offset listed is wrong; it is ET-25.');
    await press(w, 'continue');
    await press(w, 'submit');
    expect(submitContribution).toHaveBeenCalledWith(
      'edit_suggestion',
      'wheel',
      'w-1',
      expect.objectContaining({ reason: 'The offset listed is wrong; it is ET-25.' })
    );
  });

  it('proposes a new variant only with classification, a first year in range and a source', async () => {
    const w = await openWizard({ kind: 'variant' });
    await press(w, 'continue');
    expect(shown(w)).toEqual([
      'variant.errors.name',
      'variant.errors.class',
      'variant.errors.class',
      'variant.errors.class',
      'variant.errors.year',
      'variant.errors.source',
    ]);
    await field(w, 'variant.fields.name').setValue('Mini Test');
    await field(w, 'variant.fields.marque').setValue('rover');
    await field(w, 'variant.fields.family').setValue('saloon');
    await field(w, 'variant.fields.body_style').setValue('saloon');
    await field(w, 'variant.fields.year_start').setValue('1995');
    await field(w, 'variant.fields.year_end').setValue('1990');
    await field(w, 'variant.fields.engine_cc').setValue('5000');
    await w.find('input[maxlength="300"]').setValue('Rover brochure 1995');
    expect(shown(w)).toEqual(['variant.errors.years_order', 'variant.errors.number']);
    await field(w, 'variant.fields.year_end').setValue('1996');
    await field(w, 'variant.fields.engine_cc').setValue('1275');
    await press(w, 'continue');
    await press(w, 'submit');
    expect(submitContribution).toHaveBeenCalledWith(
      'new_item',
      'variant',
      null,
      expect.objectContaining({
        variant: expect.objectContaining({ name: 'Mini Test', year_start: '1995', engine_cc: '1275' }),
        source: { type: 'brochure', title: 'Rover brochure 1995' },
      })
    );
  });

  it('corrects one spec on an existing variant, which must change the value', async () => {
    const w = await openWizard({
      kind: 'variant',
      targetId: 'v-1',
      targetTitle: 'Mini Thirty',
      currentValues: { power_bhp: '42' },
    });
    const value = w.find('input[inputmode="decimal"]');
    await value.trigger('blur');
    expect(shown(w)).toEqual(['variant.errors.value']);
    await value.setValue('44');
    await w.find('input[maxlength="300"]').setValue('Autocar road test');
    await press(w, 'continue');
    expect(w.text()).toContain('Mini Thirty');
    await press(w, 'submit');
    expect(submitContribution).toHaveBeenCalledWith(
      'edit_suggestion',
      'variant',
      'v-1',
      expect.objectContaining({ changes: { power_bhp: { from: '42', to: '44' } } })
    );
  });

  it('adds photos to an existing variant without a source', async () => {
    const w = await openWizard({
      kind: 'variant',
      targetId: 'v-1',
      targetTitle: 'Mini Thirty',
      variantFocus: 'photos',
    });
    await press(w, 'continue');
    expect(shown(w)).toEqual(['errors.photo']);
    await w.find('.stub-add-file').trigger('click');
    await press(w, 'continue');
    await press(w, 'submit');
    expect(submitContribution).toHaveBeenCalledWith(
      'edit_suggestion',
      'variant',
      'v-1',
      expect.objectContaining({ photo_kind: 'owner' })
    );
    expect(authFetch).toHaveBeenCalledWith(
      '/api/archive/upload',
      expect.objectContaining({ query: { bucket: 'archive-variants', submissionId: 'sub-1' } })
    );
  });

  it('request mode: shows the title error on Send, then sends the request', async () => {
    const w = await openWizard({ mode: 'request', requestTitle: '' });
    expect(shown(w)).toEqual([]);
    await press(w, 'send_request');
    expect(shown(w)).toEqual(['errors.request_title']);
    expect(requestItem).not.toHaveBeenCalled();
    await w.find('input[maxlength="160"]').setValue('Haynes manual 1275 GT');
    await press(w, 'send_request');
    expect(requestItem).toHaveBeenCalledWith(expect.objectContaining({ title: 'Haynes manual 1275 GT' }));
    expect(closeWizard).toHaveBeenCalled();
  });

  it('sends a signed-out person to login instead of submitting', async () => {
    isAuthenticated.value = false;
    const w = await openWizard({ kind: 'registry' });
    await field(w, 'fields.year').setValue('1995');
    await field(w, 'fields.model').setValue('Rover Mini');
    await press(w, 'continue');
    await press(w, 'submit');
    expect(submitContribution).not.toHaveBeenCalled();
    expect((global as any).navigateTo).toHaveBeenCalledWith(expect.objectContaining({ path: '/login' }));
  });

  it('keeps the wizard open and shows an error toast when the submission fails', async () => {
    submitContribution.mockRejectedValueOnce(new Error('queue down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const w = await openWizard({ kind: 'registry' });
    await field(w, 'fields.year').setValue('1995');
    await field(w, 'fields.model').setValue('Rover Mini');
    await press(w, 'continue');
    await press(w, 'submit');
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'error', description: 'queue down' }));
    expect(closeWizard).not.toHaveBeenCalled();
    spy.mockRestore();
    w.unmount();
  });
});
