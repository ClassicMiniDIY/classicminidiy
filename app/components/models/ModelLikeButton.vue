<script setup lang="ts">
  /**
   * Like/unlike a published model (keystone §11 PR 8). Direct PostgREST under
   * RLS via the authed Supabase client (like/unlike own on published; a trigger
   * maintains models.like_count). Optimistic with rollback.
   */
  const props = defineProps<{ modelId: string; initialCount: number }>();

  const supabase = useSupabase();
  const { isAuthenticated, user } = useAuth();

  const count = ref(props.initialCount);
  const liked = ref(false);
  const busy = ref(false);

  // The session restores asynchronously from localStorage, so user.value can be
  // null at mount. Watch the id (client-only, via onMounted) so the liked state
  // is fetched as soon as the session lands.
  onMounted(() => {
    watch(
      () => user.value?.id,
      async (userId) => {
        if (!userId) {
          liked.value = false;
          return;
        }
        const { count: c } = await supabase
          .from('model_likes')
          .select('id', { count: 'exact', head: true })
          .eq('model_id', props.modelId)
          .eq('user_id', userId);
        liked.value = (c ?? 0) > 0;
      },
      { immediate: true }
    );
  });

  async function toggle() {
    if (!isAuthenticated.value) return navigateTo('/login');
    if (busy.value || !user.value) return;
    busy.value = true;
    const was = liked.value;
    liked.value = !was;
    count.value += was ? -1 : 1;
    try {
      if (was) {
        await supabase.from('model_likes').delete().eq('model_id', props.modelId).eq('user_id', user.value.id);
      } else {
        await supabase.from('model_likes').insert({ model_id: props.modelId, user_id: user.value.id });
      }
    } catch {
      liked.value = was;
      count.value += was ? 1 : -1;
    } finally {
      busy.value = false;
    }
  }
</script>

<template>
  <button
    type="button"
    class="btn btn-sm gap-1.5"
    :class="liked ? 'btn-error' : 'btn-ghost'"
    :disabled="busy"
    :aria-pressed="liked"
    @click="toggle"
  >
    <i :class="liked ? 'fas fa-heart' : 'far fa-heart'"></i>
    {{ count }}
  </button>
</template>
