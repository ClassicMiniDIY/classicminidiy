// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"disableIframePageLoading":true}}
/**
 * CommunityDiscussEmbed: the inline forum discussion for a knowledgebase page
 * (docs/plans/2026-10-05-community-discuss-links.md, "Comment embeds").
 */
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import CommunityDiscussEmbed from '~/app/components/CommunityDiscussEmbed.vue';

const FORUM = 'https://community.example.com';
const fetchMock = vi.fn();
const isDark = ref(false);

beforeEach(() => {
  // happy-dom reports each iframe it does not load (page loading is off above, so no network).
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('$fetch', fetchMock);
  vi.stubGlobal('useColorMode', () => ({ isDark }));
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { discourseUrl: FORUM } }));
  isDark.value = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

async function mountWith(topicId: unknown) {
  fetchMock.mockResolvedValue({ topicId });
  const wrapper = mount(CommunityDiscussEmbed, { props: { pageKey: 'technical-torque' }, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

/** Open the discussion and give the iframe a stand-in window (no page load in tests). */
async function openFrame(wrapper: Awaited<ReturnType<typeof mountWith>>) {
  await wrapper.get('[data-testid="community-discuss-show"]').trigger('click');
  const frame = wrapper.get('[data-testid="community-discuss-frame"]').element as HTMLIFrameElement;
  const frameWindow = {};
  Object.defineProperty(frame, 'contentWindow', { value: frameWindow, configurable: true });
  return { frame, frameWindow };
}

describe('CommunityDiscussEmbed', () => {
  it('asks the read-only topic route for this page', async () => {
    await mountWith(118);
    expect(fetchMock).toHaveBeenCalledWith('/api/community/discuss/topic', { query: { page: 'technical-torque' } });
  });

  it('a KV hit shows the section, and the iframe only after "Show the discussion"', async () => {
    const wrapper = await mountWith(118);
    expect(wrapper.find('[data-testid="community-discuss-embed"]').exists()).toBe(true);
    expect(wrapper.find('iframe').exists()).toBe(false);

    const { frame } = await openFrame(wrapper);
    const src = new URL(frame.getAttribute('src')!);
    expect(src.origin + src.pathname).toBe(`${FORUM}/embed/comments`);
    expect(src.searchParams.get('topic_id')).toBe('118');
    expect(src.searchParams.has('embed_url')).toBe(false);
    expect(frame.getAttribute('sandbox')).toBe(
      'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox'
    );
    expect(frame.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    wrapper.unmount();
  });

  it.each([null, 0, 'abc', undefined])('a miss (%s) renders nothing', async (topicId) => {
    const wrapper = await mountWith(topicId);
    expect(wrapper.find('[data-testid="community-discuss-embed"]').exists()).toBe(false);
    expect(wrapper.find('iframe').exists()).toBe(false);
  });

  it('a failed fetch renders nothing', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const wrapper = mount(CommunityDiscussEmbed, { props: { pageKey: 'technical-torque' } });
    await flushPromises();
    expect(wrapper.html()).not.toContain('iframe');
  });

  it('follows the theme with class_name', async () => {
    isDark.value = true;
    const wrapper = await mountWith(118);
    const { frame } = await openFrame(wrapper);
    expect(new URL(frame.getAttribute('src')!).searchParams.get('class_name')).toBe('cmdiy-embed-dark');
    wrapper.unmount();
  });

  it('resizes on a discourse-resize message from the forum origin and its own frame only', async () => {
    const wrapper = await mountWith(118);
    const { frame, frameWindow } = await openFrame(wrapper);
    const initial = frame.style.height;

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.example',
        data: { type: 'discourse-resize', height: 900 },
        source: frameWindow as any,
      })
    );
    await flushPromises();
    expect(frame.style.height).toBe(initial);

    window.dispatchEvent(
      new MessageEvent('message', { origin: FORUM, data: { type: 'discourse-resize', height: 900 }, source: {} as any })
    );
    await flushPromises();
    expect(frame.style.height).toBe(initial);

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: FORUM,
        data: { type: 'discourse-resize', height: 900 },
        source: frameWindow as any,
      })
    );
    await flushPromises();
    expect(frame.style.height).toBe('900px');
    wrapper.unmount();
  });
});
