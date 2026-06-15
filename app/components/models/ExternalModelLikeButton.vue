<script setup lang="ts">
  /**
   * Like/unlike an approved external listing. Direct PostgREST under RLS via the
   * authed Supabase client (a trigger maintains external_models.like_count).
   * Mirrors ModelLikeButton but targets the separate external_model_likes table
   * so external engagement never mixes with first-party model_likes. Optimistic
   * with rollback.
   */
  const props = defineProps<{ externalModelId: string; initialCount: number }>();

  const supabase = useSupabase();
  const { isAuthenticated, user } = useAuth();

  const count = ref(props.initialCount);
  const liked = ref(false);
  const busy = ref(false);

  onMounted(() => {
    watch(
      () => user.value?.id,
      async (userId) => {
        if (!userId) {
          liked.value = false;
          return;
        }
        const { count: c } = await supabase
          .from('external_model_likes')
          .select('id', { count: 'exact', head: true })
          .eq('external_model_id', props.externalModelId)
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
        await supabase
          .from('external_model_likes')
          .delete()
          .eq('external_model_id', props.externalModelId)
          .eq('user_id', user.value.id);
      } else {
        await supabase
          .from('external_model_likes')
          .insert({ external_model_id: props.externalModelId, user_id: user.value.id });
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
