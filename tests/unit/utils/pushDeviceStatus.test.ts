import { describe, it, expect } from 'vitest';
import { pushDeviceStatus, type PushDeviceStatusInput } from '~/app/utils/pushSubscription';

// pushDeviceStatus decides whether /dashboard/notifications tells the user that
// THIS device receives no push although the all-devices preference is on.
// Contract: .claude/rules/push-notifications.md.

const base: PushDeviceStatusInput = {
  mounted: true,
  supported: true,
  checked: true,
  busy: false,
  preferenceOn: true,
  subscribed: false,
  permission: 'default',
};

describe('pushDeviceStatus', () => {
  it('reports inactive when the preference is on and this device has no subscription', () => {
    expect(pushDeviceStatus(base)).toBe('inactive');
    expect(pushDeviceStatus({ ...base, permission: 'granted' })).toBe('inactive');
    expect(pushDeviceStatus({ ...base, permission: null })).toBe('inactive');
  });

  it('reports blocked when the browser denies notification permission', () => {
    expect(pushDeviceStatus({ ...base, permission: 'denied' })).toBe('blocked');
  });

  it('is hidden when this device has an owned subscription', () => {
    expect(pushDeviceStatus({ ...base, subscribed: true })).toBe('hidden');
    expect(pushDeviceStatus({ ...base, subscribed: true, permission: 'denied' })).toBe('hidden');
  });

  it('is hidden when the preference is off', () => {
    expect(pushDeviceStatus({ ...base, preferenceOn: false })).toBe('hidden');
    expect(pushDeviceStatus({ ...base, preferenceOn: false, permission: 'denied' })).toBe('hidden');
  });

  it.each([
    ['not mounted (SSR and first client render)', { mounted: false }],
    ['not supported', { supported: false }],
    ['check pending or failed', { checked: false }],
    ['subscribe or unsubscribe in progress', { busy: true }],
  ] as const)('is hidden when %s, never a guess', (_label, override) => {
    expect(pushDeviceStatus({ ...base, ...override })).toBe('hidden');
    expect(pushDeviceStatus({ ...base, ...override, permission: 'denied' })).toBe('hidden');
  });
});
