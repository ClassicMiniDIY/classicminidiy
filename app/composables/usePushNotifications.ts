/**
 * Composable for managing web push notification subscriptions via VAPID protocol.
 *
 * Handles browser push subscription lifecycle: checking existing subscriptions,
 * requesting permission, subscribing/unsubscribing, and persisting subscription
 * data to the push_subscriptions table in Supabase.
 */
import {
  claimPushSubscription,
  dropUnownedPushSubscription,
  getBrowserPushSubscription,
  isWebPushSupported,
  removePushSubscription,
} from '~/utils/pushSubscription';

/**
 * Decode a base64url-encoded VAPID public key into the Uint8Array that
 * PushManager.subscribe() requires for `applicationServerKey`. Passing the raw
 * string works in Chrome but throws in Firefox/Safari, so always decode.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const config = useRuntimeConfig();
  const supabase = useSupabase();
  const { user } = useAuth();
  const toast = useToast();
  const { handleError } = useErrorHandler();

  // Reactive state
  const subscription = ref<PushSubscription | null>(null);
  // True once checkExistingSubscription() has read this device without an
  // error. Until then `subscription === null` means "unknown", not "none".
  const checked = ref(false);
  // Notification.permission as last read; null when it cannot be read.
  const permission = ref<NotificationPermission | null>(null);

  function readPermission(): void {
    permission.value = typeof Notification === 'undefined' ? null : Notification.permission;
  }

  // Browser support detection - false on server, checks APIs on client
  const isSupported = computed(() => isWebPushSupported());

  /**
   * Check if the user already has an active push subscription
   * on the current browser/service worker registration.
   */
  async function checkExistingSubscription(): Promise<void> {
    if (!isSupported.value) return;

    try {
      readPermission();
      // getRegistration(), not serviceWorker.ready: `ready` never resolves
      // when no service worker is registered, and the page would wait forever.
      const existingSub = await getBrowserPushSubscription();
      // A subscription left by a previous user of this browser is not "enabled"
      // for this one; drop it rather than show it as on.
      if (existingSub && user.value && (await dropUnownedPushSubscription(supabase, existingSub))) {
        subscription.value = null;
      } else {
        subscription.value = existingSub;
      }
      checked.value = true;
    } catch (e) {
      handleError(e, { toastTitle: 'Failed to check push subscription', showToast: false });
    }
  }

  /**
   * Request notification permission, subscribe to push notifications,
   * and store the subscription in the database.
   *
   * @returns true if subscription was successful, false otherwise
   */
  async function subscribe(): Promise<boolean> {
    if (!isSupported.value) {
      toast.add({
        title: 'Not Supported',
        description: 'Push notifications are not supported in this browser.',
        color: 'warning',
      });
      return false;
    }

    if (!user.value) {
      toast.add({
        title: 'Authentication Required',
        description: 'Please sign in to enable push notifications.',
        color: 'warning',
      });
      return false;
    }

    const vapidKey = (config.public.vapidPublicKey as string) || '';
    if (!vapidKey) {
      toast.add({
        title: 'Not Configured',
        description: 'Push notifications are not configured for this site.',
        color: 'warning',
      });
      return false;
    }

    try {
      // `serviceWorker.ready` never resolves without a registration, and the
      // caller's busy state would then never clear. Check first, and before
      // the permission prompt: without a worker, push cannot work here.
      if (!(await navigator.serviceWorker.getRegistration())) {
        toast.add({
          title: 'Not Available',
          description: 'Push notifications are not available on this device right now.',
          color: 'warning',
        });
        return false;
      }

      // Request notification permission
      const result = await Notification.requestPermission();
      permission.value = result;

      if (result === 'denied') {
        toast.add({
          title: 'Notifications Blocked',
          description: 'Enable notifications in your browser settings to receive push alerts.',
          color: 'warning',
        });
        return false;
      }

      if (result !== 'granted') {
        return false;
      }

      // Subscribe to push via service worker
      const registration = await navigator.serviceWorker.ready;
      const pushSub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Save it for the signed-in user, taking the endpoint over from a
      // previous user of this browser if there is one.
      const { error: claimError } = await claimPushSubscription(supabase, pushSub);
      if (claimError) throw claimError;

      subscription.value = pushSub;

      toast.add({
        title: 'Notifications Enabled',
        description: 'You will now receive push notifications.',
        color: 'success',
      });

      return true;
    } catch (e) {
      handleError(e, { toastTitle: 'Failed to enable push notifications' });
      return false;
    }
  }

  /**
   * Unsubscribe from push notifications and remove the subscription
   * from the database.
   *
   * @returns true if unsubscription was successful, false otherwise
   */
  async function unsubscribe(): Promise<boolean> {
    if (!user.value) return false;

    try {
      if (subscription.value) {
        // Remove this device's row by endpoint and unsubscribe it at the push
        // service. Shared with the sign-out cleanup in useAuth.
        const { deleteError, unsubscribeError } = await removePushSubscription(supabase, subscription.value);
        // Either step alone stops delivery (no row to send to, or a dead
        // endpoint), so the local state must not keep saying "enabled".
        if (!deleteError || !unsubscribeError) subscription.value = null;
        if (deleteError) throw deleteError;
        if (unsubscribeError) throw unsubscribeError;
      }
      // No subscription on this device: nothing to remove here. Never fall
      // back to deleting by user_id, which would turn push off on every other
      // device the user has.

      subscription.value = null;

      toast.add({
        title: 'Notifications Disabled',
        description: 'You will no longer receive push notifications.',
        color: 'info',
      });

      return true;
    } catch (e) {
      handleError(e, { toastTitle: 'Failed to disable push notifications' });
      return false;
    }
  }

  return {
    // State
    isSupported,
    subscription: readonly(subscription),
    checked: readonly(checked),
    permission: readonly(permission),

    // Methods
    checkExistingSubscription,
    refreshPermission: readPermission,
    subscribe,
    unsubscribe,
  };
}
