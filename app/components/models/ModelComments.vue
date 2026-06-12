<script setup lang="ts">
  /**
   * Comment thread (keystone §11 PR 8). Reads approved comments from the server
   * route; posting/replying is a direct RLS insert via the authed Supabase client
   * (a trigger sets moderation_status from the author's trust — `new` users land
   * in `pending` and only see their own until approved). One level of threading.
   */
  import { DateTime } from 'luxon';

  const props = defineProps<{ modelId: string }>();

  const supabase = useSupabase();
  const { isAuthenticated, user } = useAuth();

  const { data, refresh, pending } = await useFetch(() => `/api/models/${props.modelId}/comments`);
  const comments = computed(() => data.value?.comments ?? []);
  const total = computed(() => data.value?.total ?? 0);

  const draft = ref('');
  const replyTo = ref<string | null>(null);
  const replyDraft = ref('');
  const posting = ref(false);
  const error = ref('');
  const pendingNote = ref(false);

  function rel(iso: string) {
    return DateTime.fromISO(iso).toRelative() || '';
  }

  async function post(content: string, parentId: string | null) {
    if (!isAuthenticated.value) return navigateTo('/login');
    const text = content.trim();
    if (!text || !user.value) return;
    posting.value = true;
    error.value = '';
    try {
      const { data: row, error: e } = await supabase
        .from('model_comments')
        .insert({ model_id: props.modelId, user_id: user.value.id, content: text.slice(0, 2000), parent_id: parentId })
        .select('id, moderation_status')
        .single();
      if (e) throw e;
      draft.value = '';
      replyDraft.value = '';
      replyTo.value = null;
      if (row?.moderation_status === 'approved') await refresh();
      else pendingNote.value = true;
    } catch (e: any) {
      error.value = e?.message || 'Could not post your comment.';
    } finally {
      posting.value = false;
    }
  }
</script>

<template>
  <div class="card bg-base-100 shadow-sm border border-base-300">
    <div class="card-body">
      <h2 class="card-title text-lg"><i class="fas fa-comments text-primary mr-1"></i> Comments ({{ total }})</h2>

      <!-- New comment -->
      <div v-if="isAuthenticated" class="mb-2">
        <textarea
          v-model="draft"
          rows="2"
          maxlength="2000"
          class="textarea textarea-bordered w-full"
          placeholder="Share tips, ask a question…"
        ></textarea>
        <div class="flex justify-between items-center mt-1">
          <span v-if="pendingNote" class="text-xs opacity-60"
            ><i class="fas fa-clock mr-1"></i> Your comment is awaiting moderation.</span
          >
          <span v-else></span>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="posting || !draft.trim()"
            @click="post(draft, null)"
          >
            <span v-if="posting" class="loading loading-spinner loading-xs"></span> Post
          </button>
        </div>
      </div>
      <p v-else class="text-sm opacity-70 mb-2">
        <NuxtLink to="/login" class="link link-primary">Sign in</NuxtLink> to join the conversation.
      </p>
      <p v-if="error" class="text-error text-sm">{{ error }}</p>

      <div v-if="pending" class="py-6 text-center"><span class="loading loading-spinner text-primary"></span></div>
      <p v-else-if="comments.length === 0" class="text-sm opacity-60 py-2">No comments yet — be the first.</p>

      <ul v-else class="space-y-4">
        <li v-for="c in comments" :key="c.id">
          <div class="flex gap-3">
            <img
              v-if="c.author?.avatarUrl"
              :src="c.author.avatarUrl"
              class="w-8 h-8 rounded-full object-cover shrink-0"
              :alt="c.author.displayName || ''"
            />
            <i v-else class="fas fa-circle-user text-2xl opacity-60 shrink-0"></i>
            <div class="flex-1 min-w-0">
              <p class="text-sm">
                <strong>{{ c.author?.displayName || c.author?.username || 'Anonymous' }}</strong>
                <span class="opacity-50 text-xs ml-1"
                  >{{ rel(c.createdAt) }}<span v-if="c.editedAt"> · edited</span></span
                >
              </p>
              <p class="text-sm whitespace-pre-line">{{ c.content }}</p>
              <button
                v-if="isAuthenticated"
                type="button"
                class="btn btn-ghost btn-xs mt-1"
                @click="replyTo = replyTo === c.id ? null : c.id"
              >
                <i class="fas fa-reply mr-1"></i> Reply
              </button>

              <!-- Reply form -->
              <div v-if="replyTo === c.id" class="mt-2">
                <textarea
                  v-model="replyDraft"
                  rows="2"
                  maxlength="2000"
                  class="textarea textarea-bordered textarea-sm w-full"
                  placeholder="Write a reply…"
                ></textarea>
                <div class="flex justify-end gap-2 mt-1">
                  <button type="button" class="btn btn-ghost btn-xs" @click="replyTo = null">Cancel</button>
                  <button
                    type="button"
                    class="btn btn-primary btn-xs"
                    :disabled="posting || !replyDraft.trim()"
                    @click="post(replyDraft, c.id)"
                  >
                    Reply
                  </button>
                </div>
              </div>

              <!-- Replies -->
              <ul v-if="c.replies?.length" class="mt-3 space-y-3 pl-4 border-l border-base-300">
                <li v-for="r in c.replies" :key="r.id" class="flex gap-3">
                  <img
                    v-if="r.author?.avatarUrl"
                    :src="r.author.avatarUrl"
                    class="w-7 h-7 rounded-full object-cover shrink-0"
                    :alt="r.author.displayName || ''"
                  />
                  <i v-else class="fas fa-circle-user text-xl opacity-60 shrink-0"></i>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm">
                      <strong>{{ r.author?.displayName || r.author?.username || 'Anonymous' }}</strong>
                      <span class="opacity-50 text-xs ml-1">{{ rel(r.createdAt) }}</span>
                    </p>
                    <p class="text-sm whitespace-pre-line">{{ r.content }}</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
