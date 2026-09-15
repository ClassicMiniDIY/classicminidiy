/**
 * SearchAnswerPanel — the bot's answer beside the results on /search.
 *
 * The stream is stubbed at `useChatAnswer`, so what is under test is the
 * shell: one send on mount, the rails from the transcript, and the handoff —
 * "Continue in chat" must LOAD history before recording (recording into an
 * unloaded list overwrites every other conversation) and must not carry a
 * `?message=`, or /chat would send the question a second time.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, shallowRef, computed } from 'vue';

const routerPush = vi.fn();
(global as any).useRouter = vi.fn(() => ({ push: routerPush }));
(global as any).useRoute = vi.fn(() => ({ path: '/search', query: {} }));

const history = { load: vi.fn(), record: vi.fn(), deriveTitle: vi.fn((text: string) => text) };
(global as any).useChatHistory = vi.fn(() => history);

const stream = {
  messages: shallowRef<any[]>([]),
  status: ref('ready'),
  error: ref<Error | undefined>(undefined),
  isLoading: ref(false),
  sendMessage: vi.fn(),
  stop: vi.fn(),
  quotaError: ref<any>(null),
  videos: computed(() => [] as any[]),
  usefulLinks: computed(() => [] as any[]),
};
vi.mock('~/composables/useChatAnswer', () => ({
  newThreadId: () => 'thread-1',
  useChatAnswer: () => stream,
}));

const stubs = {
  AssistantMessage: {
    name: 'AssistantMessage',
    template: '<div class="mock-answer" />',
    props: ['message', 'isLoading', 'threadId'],
  },
  VideoResults: { name: 'VideoResults', template: '<div class="mock-videos" />', props: ['videos', 'variant'] },
  UsefulLinks: { name: 'UsefulLinks', template: '<div class="mock-links" />', props: ['links'] },
};

const AnswerPanel = (await import('~~/app/components/search/AnswerPanel.vue')).default;

const assistant = { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'Bleed the rear first.' }] };

beforeEach(() => {
  vi.clearAllMocks();
  history.deriveTitle.mockImplementation((text: string) => text);
  stream.messages.value = [];
  stream.isLoading.value = false;
  stream.error.value = undefined;
  stream.quotaError.value = null;
});

describe('SearchAnswerPanel', () => {
  it('sends the query once on mount', async () => {
    mount(AnswerPanel, { props: { query: 'how do i bleed the brakes' }, global: { stubs } });
    await flushPromises();
    expect(stream.sendMessage).toHaveBeenCalledTimes(1);
    expect(stream.sendMessage).toHaveBeenCalledWith({ text: 'how do i bleed the brakes' });
  });

  it('shows the footer only once an answer has completed', async () => {
    const wrapper = mount(AnswerPanel, { props: { query: 'q' }, global: { stubs } });
    stream.isLoading.value = true;
    await flushPromises();
    expect(wrapper.find('footer').exists()).toBe(false);

    stream.messages.value = [{ id: 'u', role: 'user', parts: [] }, assistant];
    stream.isLoading.value = false;
    await flushPromises();
    expect(wrapper.find('footer').exists()).toBe(true);
    expect(wrapper.find('.mock-answer').exists()).toBe(true);
  });

  it('continues in chat by recording the thread after loading history, with no ?message=', async () => {
    const wrapper = mount(AnswerPanel, { props: { query: 'q' }, global: { stubs } });
    stream.isLoading.value = true;
    await flushPromises();
    stream.messages.value = [{ id: 'u', role: 'user', parts: [] }, assistant];
    stream.isLoading.value = false;
    await flushPromises();

    await wrapper.find('footer .btn-primary').trigger('click');

    expect(history.load).toHaveBeenCalled();
    expect(history.load.mock.invocationCallOrder[0]).toBeLessThan(history.record.mock.invocationCallOrder[0]!);
    expect(history.record).toHaveBeenCalledWith('thread-1', { title: 'q', messages: stream.messages.value });
    expect(history.deriveTitle).toHaveBeenCalledWith('q');
    expect(routerPush).toHaveBeenCalledWith({ path: '/chat', query: { source: 'search-panel' } });
    const pushed = routerPush.mock.calls[0]![0];
    expect(pushed.query).not.toHaveProperty('message');
  });

  it('closes and hands the route verdict up rather than rendering a wall', async () => {
    const wrapper = mount(AnswerPanel, { props: { query: 'q' }, global: { stubs } });
    await flushPromises();
    const verdict = { tier: 'anonymous', used: 15, limit: 15, upgradeUrl: '/login' };
    stream.quotaError.value = verdict;
    await flushPromises();
    expect(wrapper.emitted('quota')).toEqual([[verdict]]);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('stops an in-flight stream on unmount, and does not count it as completed', async () => {
    const wrapper = mount(AnswerPanel, { props: { query: 'q' }, global: { stubs } });
    stream.isLoading.value = true;
    await flushPromises();
    stream.messages.value = [{ id: 'u', role: 'user', parts: [] }, assistant];
    wrapper.unmount();
    expect(stream.stop).toHaveBeenCalledTimes(1);
    // The abort resolves the stream after the unmount; the closing flag holds.
    stream.isLoading.value = false;
    await flushPromises();
    expect(wrapper.find('footer').exists()).toBe(false);
  });

  it('shows the generic error with a retry that starts a fresh thread', async () => {
    const wrapper = mount(AnswerPanel, { props: { query: 'q' }, global: { stubs } });
    await flushPromises();
    stream.error.value = new Error('boom');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    stream.sendMessage.mockClear();
    await wrapper.find('[role="alert"] button').trigger('click');
    expect(stream.sendMessage).toHaveBeenCalledWith({ text: 'q' });
    expect(stream.messages.value).toEqual([]);
  });

  it('stops an in-flight stream when closed, and a stop is never a completion', async () => {
    const wrapper = mount(AnswerPanel, { props: { query: 'q' }, global: { stubs } });
    stream.isLoading.value = true;
    await flushPromises();
    stream.messages.value = [{ id: 'u', role: 'user', parts: [] }, assistant];
    await wrapper.find('header button').trigger('click');
    expect(stream.stop).toHaveBeenCalled();
    expect(wrapper.emitted('close')).toEqual([[false]]);
    stream.isLoading.value = false;
    await flushPromises();
    expect(wrapper.find('footer').exists()).toBe(false);
  });

  it('records a derived title, not the raw query', async () => {
    history.deriveTitle.mockReturnValue('derived');
    const wrapper = mount(AnswerPanel, { props: { query: 'q' }, global: { stubs } });
    stream.isLoading.value = true;
    await flushPromises();
    stream.messages.value = [{ id: 'u', role: 'user', parts: [] }, assistant];
    stream.isLoading.value = false;
    await flushPromises();
    await wrapper.find('footer .btn-primary').trigger('click');
    expect(history.deriveTitle).toHaveBeenCalledWith('q');
    expect(history.record).toHaveBeenCalledWith('thread-1', expect.objectContaining({ title: 'derived' }));
  });
});
