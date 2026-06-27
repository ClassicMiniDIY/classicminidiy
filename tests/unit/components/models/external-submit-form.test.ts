// @vitest-environment happy-dom
/**
 * ExternalModelSubmitForm (app/components/models/ExternalModelSubmitForm.vue).
 *
 * Regression for Brian's report (June 2026): pasting the URL of a model that
 * is already in the library and clicking "Fetch details" silently did nothing.
 * Root cause — /api/models/external/fetch returns the FULL preview object with
 * `alreadyListed` set, but the template gated the "already listed" alert on
 * `alreadyListed && !preview`, while step 2 was gated on `preview && !alreadyListed`.
 * With both refs set, neither branch rendered. These tests pin the fix: the
 * alert renders whenever `alreadyListed` is set (preview present or not), and
 * step 2 stays hidden in that case.
 *
 * The i18n mock returns translation keys verbatim, so assertions match keys.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, computed, defineComponent, h, Suspense } from 'vue';
import ExternalModelSubmitForm from '~/app/components/models/ExternalModelSubmitForm.vue';

/** A preview object with just enough shape for the template to render step 2. */
function makePreview(overrides: Record<string, any> = {}) {
  return {
    sourceSite: 'printables',
    sourceUrl: 'https://www.printables.com/model/123-brake-duct',
    externalId: '123',
    title: 'Brake Duct',
    description: 'A printable brake cooling duct',
    summary: null,
    authorName: 'Brian',
    authorUrl: 'https://www.printables.com/@brian',
    license: 'CC-BY',
    remixesAllowed: true,
    commercialUseAllowed: false,
    tags: ['brake', 'cooling'],
    printSettings: null,
    images: [{ url: 'https://img.test/1.jpg', isPrimary: true }],
    alreadyListed: null,
    ...overrides,
  };
}

/** Build the composable stub the component consumes via useExternalModelSubmit(). */
function makeFormStub(overrides: Record<string, any> = {}) {
  const stub = {
    url: ref(''),
    isValidUrl: computed(() => true),
    detectedSite: ref(null),
    fetching: ref(false),
    preview: ref<any>(null),
    fetchError: ref<string | null>(null),
    alreadyListed: ref<{ slug: string } | null>(null),
    fetchPreview: vi.fn(),
    title: ref(''),
    description: ref(''),
    categorySlug: ref(''),
    tags: ref<string[]>([]),
    submitting: ref(false),
    submitError: ref<string | null>(null),
    submittedSlug: ref<string | null>(null),
    submit: vi.fn(),
    reset: vi.fn(),
  };
  Object.assign(stub, overrides);
  return stub;
}

const mountStubs = {
  ModelsSourceBadge: { name: 'ModelsSourceBadge', template: '<span class="mock-source-badge" />', props: ['site', 'size'] },
  NuxtLink: { name: 'NuxtLink', template: '<a :href="to"><slot /></a>', props: ['to'] },
};

// The component uses top-level `await useFetch()`, so it has async setup and
// only resolves inside a Suspense boundary. Wrap it so html() is populated
// after flushPromises.
const SuspenseWrapper = defineComponent({
  render() {
    return h(Suspense, null, { default: () => h(ExternalModelSubmitForm), fallback: () => h('div') });
  },
});

async function mountForm(form: ReturnType<typeof makeFormStub>) {
  vi.stubGlobal('useExternalModelSubmit', () => form);
  vi.stubGlobal('useFetch', vi.fn().mockResolvedValue({ data: ref({ categories: [{ slug: 'cooling', name: 'Cooling' }] }) }));
  const wrapper = mount(SuspenseWrapper, { global: { stubs: mountStubs } });
  await flushPromises();
  return wrapper;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('ExternalModelSubmitForm — already-listed feedback', () => {
  it('renders the "already in the library" alert when a preview comes back already listed', async () => {
    // Mirrors the real fetch response: full preview AND alreadyListed both set.
    const form = makeFormStub({
      preview: ref(makePreview({ alreadyListed: { slug: 'brake-duct' } })),
      alreadyListed: ref({ slug: 'brake-duct' }),
    });
    const wrapper = await mountForm(form);

    const html = wrapper.html();
    // The user now gets an explicit message (title + body) — not a silent exit.
    expect(html).toContain('step1.alreadyListedTitle');
    expect(html).toContain('step1.alreadyListedBody');
    // ...with a link to the existing listing.
    expect(wrapper.find('a[href="/models/external/brake-duct"]').exists()).toBe(true);
  });

  it('does not render step 2 (the edit/submit form) when the model is already listed', async () => {
    const form = makeFormStub({
      preview: ref(makePreview({ alreadyListed: { slug: 'brake-duct' } })),
      alreadyListed: ref({ slug: 'brake-duct' }),
    });
    const wrapper = await mountForm(form);

    // Step 2 heading / submit button must stay hidden — there is nothing to submit.
    expect(wrapper.html()).not.toContain('step2.heading');
    expect(wrapper.html()).not.toContain('step2.submitBtn');
  });
});

describe('ExternalModelSubmitForm — normal preview path', () => {
  it('renders step 2 with the submit button when a fresh (not-listed) preview loads', async () => {
    const form = makeFormStub({ preview: ref(makePreview()) });
    const wrapper = await mountForm(form);

    expect(wrapper.html()).toContain('step2.heading');
    expect(wrapper.html()).toContain('step2.submitBtn');
    // No already-listed alert on the happy path.
    expect(wrapper.html()).not.toContain('step1.alreadyListedTitle');
  });

  it('shows the success state once a slug is submitted, hiding both steps', async () => {
    const form = makeFormStub({
      preview: ref(makePreview()),
      submittedSlug: ref('brake-duct'),
    });
    const wrapper = await mountForm(form);

    expect(wrapper.html()).toContain('success.title');
    expect(wrapper.html()).not.toContain('step1.heading');
    expect(wrapper.html()).not.toContain('step2.heading');
  });
});
