/**
 * Composable for managing web push notification subscriptions via VAPID protocol.
 *
 * Handles browser push subscription lifecycle: checking existing subscriptions,
 * requesting permission, subscribing/unsubscribing, and persisting subscription
 * data to the push_subscriptions table in Supabase.
 */
export function usePushNotifications() {
  const config = useRuntimeConfig();
  const supabase = useSupabase();
  const { user } = useAuth();
  const toast = useToast();
  const { handleError } = useErrorHandler();

  // Reactive state
  const subscription = ref<PushSubscription | null>(null);

  // Browser support detection - false on server, checks APIs on client
  const isSupported = computed(() => {
    if (import.meta.server) return false;
    return 'serviceWorker' in navigator && 'PushManager' in window;
  });

  /**
   * Check if the user already has an active push subscription
   * on the current browser/service worker registration.
   */
  async function checkExistingSubscription(): Promise<void> {
    if (!isSupported.value) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSub = await registration.pushManager.getSubscription();
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
        applicationServerKey: config.public.vapidPublicKey as string,
      });

      // Extract subscription data for storage
      const subJson = pushSub.toJSON();

      // Upsert subscription into database
      const { error: upsertError } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.value.id,
          endpoint: pushSub.endpoint,
          keys: subJson.keys as Record<string, string>,
          user_agent: navigator.userAgent,
        },
        { onConflict: 'endpoint' }
      );

      if (upsertError) throw upsertError;

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
      // Unsubscribe from push if we have an active subscription
      if (subscription.value) {
        await subscription.value.unsubscribe();
      }

      // Remove this specific device's subscription from the database
      const endpoint = subscription.value?.endpoint;
      const { error: deleteError } = endpoint
        ? await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
        : await supabase.from('push_subscriptions').delete().eq('user_id', user.value.id);

      if (deleteError) throw deleteError;

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
