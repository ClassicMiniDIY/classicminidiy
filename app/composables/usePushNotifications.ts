/**
 * Composable for managing web push notification subscriptions via VAPID protocol.
 *
 * Handles browser push subscription lifecycle: checking existing subscriptions,
 * requesting permission, subscribing/unsubscribing, and persisting subscription
 * data to the push_subscriptions table in Supabase.
 */
import { dropUnownedPushSubscription, isWebPushSupported, removePushSubscription } from '~/utils/pushSubscription';

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

  // Browser support detection - false on server, checks APIs on client
  const isSupported = computed(() => isWebPushSupported());

  /**
   * Check if the user already has an active push subscription
   * on the current browser/service worker registration.
   */
  async function checkExistingSubscription(): Promise<void> {
    if (!isSupported.value) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSub = await registration.pushManager.getSubscription();
      // A subscription left by a previous user of this browser is not "enabled"
      // for this one; drop it rather than show it as on.
      if (existingSub && user.value && (await dropUnownedPushSubscription(supabase, existingSub))) {
        subscription.value = null;
        return;
      }
      subscription.value = existingSub;
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
      // Request notification permission
      const permission = await Notification.requestPermission();

      if (permission === 'denied') {
        toast.add({
          title: 'Notifications Blocked',
          description: 'Enable notifications in your browser settings to receive push alerts.',
          color: 'warning',
        });
        return false;
      }

      if (permission !== 'granted') {
        return false;
      }

      // Subscribe to push via service worker
      const registration = await navigator.serviceWorker.ready;
      const pushSub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Extract subscription data for storage
      const subJson = pushSub.toJSON();

      // Save the subscription for the signed-in user. A browser keeps its
      // endpoint across sign-ins, so this RPC takes the row over from any
      // previous owner; a direct upsert on another user's endpoint fails RLS.
      const { error: claimError } = await supabase.rpc('claim_push_subscription', {
        p_endpoint: pushSub.endpoint,
        p_keys: subJson.keys as Record<string, string>,
        p_user_agent: navigator.userAgent,
      });

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
      } else {
        const { error: deleteError } = await supabase.from('push_subscriptions').delete().eq('user_id', user.value.id);
        if (deleteError) throw deleteError;
      }

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

    // Methods
    checkExistingSubscription,
    subscribe,
    unsubscribe,
  };
}
