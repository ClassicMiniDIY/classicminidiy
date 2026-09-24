// @vitest-environment happy-dom
/**
 * /dashboard/notifications (app/pages/dashboard/notifications.vue): the push
 * toggle is the all-devices preference; the line under it says when THIS
 * device receives nothing. Contract: .claude/rules/push-notifications.md.
 *
 * The i18n mock returns translation keys verbatim, so assertions match keys.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, computed, readonly } from 'vue';
import NotificationsPage from '~/app/pages/dashboard/notifications.vue';
import { pushDeviceStatus } from '~/app/utils/pushSubscription';

interface PushStubOptions {
  preferenceOn?: boolean;
  owned?: boolean;
  permission?: NotificationPermission | null;
  checkFails?: boolean;
  subscribeResult?: boolean;
  subscribeGrants?: NotificationPermission;
}

let prefs: ReturnType<typeof ref<any>>;
let updatePreferences: ReturnType<typeof vi.fn>;
let subscribe: ReturnType<typeof vi.fn>;
let unsubscribe: ReturnType<typeof vi.fn>;

function stubPage({
  preferenceOn = true,
  owned = false,
  permission = 'default',
  checkFails = false,
  subscribeResult = true,
  subscribeGrants = 'granted',
}: PushStubOptions = {}) {
  prefs = ref<any>(null);
  updatePreferences = vi.fn().mockResolvedValue(true);
  const loading = ref(true);

  vi.stubGlobal('useNotifications', () => ({
    preferences: prefs,
    loading,
    saving: ref(false),
    fetchPreferences: vi.fn(async () => {
      prefs.value = {
        email_new_messages: true,
        email_new_comments: true,
        email_comment_replies: true,
        email_listing_status: true,
        email_weekly_digest: false,
        email_saved_search_matches: true,
        push_new_messages: preferenceOn,
      };
      loading.value = false;
    }),
    togglePreference: vi.fn(),
    updatePreferences,
  }));

  const subscription = ref<object | null>(null);
  const checked = ref(false);
  const permissionRef = ref<NotificationPermission | null>(null);

  subscribe = vi.fn(async () => {
    permissionRef.value = subscribeGrants;
    if (subscribeResult) subscription.value = { endpoint: 'https://push.example.com/new' };
    return subscribeResult;
  });
  unsubscribe = vi.fn(async () => {
    subscription.value = null;
    return true;
  });

  vi.stubGlobal('usePushNotifications', () => ({
    isSupported: computed(() => true),
    subscription: readonly(subscription),
    checked: readonly(checked),
    permission: readonly(permissionRef),
    checkExistingSubscription: vi.fn(async () => {
      if (checkFails) return;
      permissionRef.value = permission;
      subscription.value = owned ? { endpoint: 'https://push.example.com/owned' } : null;
      checked.value = true;
    }),
    subscribe,
    unsubscribe,
  }));
  vi.stubGlobal('pushDeviceStatus', pushDeviceStatus);
}

async function mountPage() {
  const wrapper = mount(NotificationsPage, {
    global: {
      stubs: { NuxtLink: { name: 'NuxtLink', template: '<a :href="to"><slot /></a>', props: ['to'] } },
    },
  });
  await flushPromises();
  return wrapper;
}

const inactiveLine = '[data-testid="push-device-inactive"]';
const blockedLine = '[data-testid="push-device-blocked"]';
// The push toggle is the second checkbox in the Messages card.
const pushToggle = (w: Awaited<ReturnType<typeof mountPage>>) => w.findAll('input[type="checkbox"]')[1]!;

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('/dashboard/notifications device push status', () => {
  it('shows "not active on this device" when the preference is on and the device has no subscription', async () => {
    stubPage({ preferenceOn: true, owned: false });
    const wrapper = await mountPage();

    const line = wrapper.find(inactiveLine);
    expect(line.exists()).toBe(true);
    expect(line.text()).toContain('messages.pushNew.deviceInactive');
    expect(line.find('button').text()).toBe('messages.pushNew.enableDevice');
    expect(wrapper.find(blockedLine).exists()).toBe(false);
    // The toggle still shows the preference.
    expect((pushToggle(wrapper).element as HTMLInputElement).checked).toBe(true);
  });

  it('never subscribes on its own, even with permission already granted', async () => {
    stubPage({ preferenceOn: true, owned: false, permission: 'granted' });
    const wrapper = await mountPage();

    expect(wrapper.find(inactiveLine).exists()).toBe(true);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('subscribes only this device from the button, without writing the preference', async () => {
    stubPage({ preferenceOn: true, owned: false });
    const wrapper = await mountPage();

    await wrapper.find(`${inactiveLine} button`).trigger('click');
    await flushPromises();

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(updatePreferences).not.toHaveBeenCalled();
    expect(wrapper.find(inactiveLine).exists()).toBe(false);
  });

  it('switches to the blocked hint when the user blocks the prompt from the button', async () => {
    stubPage({ preferenceOn: true, owned: false, subscribeResult: false, subscribeGrants: 'denied' });
    const wrapper = await mountPage();

    await wrapper.find(`${inactiveLine} button`).trigger('click');
    await flushPromises();

    expect(wrapper.find(inactiveLine).exists()).toBe(false);
    expect(wrapper.find(blockedLine).exists()).toBe(true);
  });

  it('shows the blocked hint with no button when permission is denied', async () => {
    stubPage({ preferenceOn: true, owned: false, permission: 'denied' });
    const wrapper = await mountPage();

    const line = wrapper.find(blockedLine);
    expect(line.exists()).toBe(true);
    expect(line.text()).toContain('messages.pushNew.deviceBlocked');
    expect(line.find('button').exists()).toBe(false);
    expect(wrapper.find(inactiveLine).exists()).toBe(false);
  });

  it('shows nothing when this device has an owned subscription', async () => {
    stubPage({ preferenceOn: true, owned: true });
    const wrapper = await mountPage();

    expect(wrapper.find(inactiveLine).exists()).toBe(false);
    expect(wrapper.find(blockedLine).exists()).toBe(false);
  });

  it('shows nothing when the preference is off', async () => {
    stubPage({ preferenceOn: false, owned: false, permission: 'denied' });
    const wrapper = await mountPage();

    expect(wrapper.find(inactiveLine).exists()).toBe(false);
    expect(wrapper.find(blockedLine).exists()).toBe(false);
  });

  it('shows nothing when the device check failed', async () => {
    stubPage({ preferenceOn: true, owned: false, checkFails: true });
    const wrapper = await mountPage();

    expect(wrapper.find(inactiveLine).exists()).toBe(false);
    expect(wrapper.find(blockedLine).exists()).toBe(false);
  });

  it('toggle ON subscribes this device and then writes the preference', async () => {
    stubPage({ preferenceOn: false, owned: false });
    const wrapper = await mountPage();

    await pushToggle(wrapper).setValue(true);
    await flushPromises();

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(updatePreferences).toHaveBeenCalledWith({ push_new_messages: true });
    expect(wrapper.find(inactiveLine).exists()).toBe(false);
  });

  it('toggle ON reverts and writes nothing when subscribe fails', async () => {
    stubPage({ preferenceOn: false, owned: false, subscribeResult: false });
    const wrapper = await mountPage();

    await pushToggle(wrapper).setValue(true);
    await flushPromises();

    expect(prefs.value.push_new_messages).toBe(false);
    expect(updatePreferences).not.toHaveBeenCalled();
    expect(wrapper.find(inactiveLine).exists()).toBe(false);
  });

  it('toggle OFF unsubscribes this device and writes the preference', async () => {
    stubPage({ preferenceOn: true, owned: true });
    const wrapper = await mountPage();

    await pushToggle(wrapper).setValue(false);
    await flushPromises();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(updatePreferences).toHaveBeenCalledWith({ push_new_messages: false });
    expect(wrapper.find(inactiveLine).exists()).toBe(false);
  });
});
