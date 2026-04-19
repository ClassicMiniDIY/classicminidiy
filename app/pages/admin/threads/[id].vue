<script setup lang="ts">
  import { HERO_TYPES } from '../../../../data/models/generic';

  // SEO and meta
  useHead({
    title: 'Thread Details - Admin - Classic Mini DIY',
    meta: [
      {
        name: 'description',
        content: 'View detailed information about a LangGraph chat thread.',
      },
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  });

  // Define types
  interface MessageContent {
    type?: string;
    text?: string;
    [key: string]: unknown;
  }

  interface RawMessage {
    type?: string;
    role?: string;
    content?: string | MessageContent[] | { text: string };
    text?: string;
    timestamp?: string;
    created_at?: string;
    name?: string;
    tool_calls?: unknown;
    tool_result?: unknown;
    [key: string]: unknown;
  }

  interface ParsedMessage {
    index: number;
    role: string;
    displayContent: string;
    rawContent: RawMessage;
    timestamp: string | null;
    name: string | null;
    toolCalls: unknown;
    toolResults: unknown;
  }

  interface ThreadData {
    thread: {
      thread_id: string;
      status: string;
      created_at: string;
      updated_at: string;
      metadata?: Record<string, unknown>;
    };
    state?: {
      values?: {
        messages?: RawMessage[];
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
    history?: unknown[];
  }

  // Get user info from Supabase auth
  const { userProfile, signOut } = useAuth();

  // Get thread ID from route
  const route = useRoute();
  const threadId = route.params.id as string;

  // Fetch thread details
  const { data: threadData, pending, error } = await useAdminFetch<ThreadData>(`/api/admin/threads/${threadId}`);

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
    await navigateTo('/login');
  };

  // Get status badge color
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'idle':
        return 'success';
      case 'busy':
        return 'warning';
      case 'interrupted':
        return 'info';
      case 'error':
        return 'error';
      default:
        return 'neutral';
    }
  };

  // Extract chat messages from thread state
  const chatMessages = computed<ParsedMessage[]>(() => {
    if (!threadData.value?.state?.values?.messages) {
      return [];
    }

    const messages = threadData.value.state.values.messages;
    if (!Array.isArray(messages)) {
      return [];
    }

    return messages.map((msg: RawMessage, index: number): ParsedMessage => {
      // Extract content - for AI messages, get the actual text content
      let displayContent = '';
      const rawContent = msg;

      if (typeof msg.content === 'string') {
        displayContent = msg.content;
      } else if (Array.isArray(msg.content)) {
        // Handle content array (common in AI responses)
        displayContent = msg.content
          .map((item: MessageContent | string) => {
            if (typeof item === 'string') return item;
            if (item.type === 'text' && item.text) return item.text;
            if (item.text) return item.text;
            return JSON.stringify(item);
          })
          .join('\n');
      } else if (msg.content && typeof msg.content === 'object' && 'text' in msg.content) {
        displayContent = msg.content.text;
      } else if (msg.text) {
        displayContent = msg.text;
      } else {
        displayContent = JSON.stringify(msg.content || msg);
      }

      return {
        index: index + 1,
        role: msg.type || msg.role || 'unknown',
        displayContent,
        rawContent,
        timestamp: msg.timestamp || msg.created_at || null,
        name: msg.name || null,
        toolCalls: msg.tool_calls || null,
        toolResults: msg.tool_result || null,
      };
    });
  });

  // Get role badge styling
  const getRoleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'human':
      case 'user':
        return 'primary';
      case 'ai':
      case 'assistant':
        return 'secondary';
      case 'system':
        return 'info';
      case 'tool':
        return 'warning';
      default:
        return 'neutral';
    }
  };
</script>

<template>
  <div>
    <!-- Hero Section -->
    <Hero
      title="Thread Details"
      subtitle="View detailed information about a chat thread"
      :heroType="HERO_TYPES.TECH"
      textSize="text-4xl"
    />

    <!-- Breadcrumb Navigation -->
    <div class="container mx-auto px-4 pt-10">
      <div class="flex justify-between items-center">
        <div class="breadcrumbs text-sm">
          <ul>
            <li>
              <NuxtLink to="/" class="link link-primary">
                <i class="fas fa-house mr-1"></i>
                Home
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/admin" class="link link-primary">Admin</NuxtLink>
            </li>
            <li>
              <NuxtLink to="/admin/threads" class="link link-primary">Chat Threads</NuxtLink>
            </li>
            <li><span>Thread Details</span></li>
          </ul>
        </div>

        <div class="flex items-center gap-4">
          <span class="text-sm opacity-70"> Welcome, {{ userProfile?.display_name || userProfile?.email }} </span>
          <button type="button" class="btn btn-ghost btn-sm" @click="handleLogout">
            <i class="fad fa-sign-out mr-2"></i>
            Logout
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="container mx-auto px-4 py-8">
      <!-- Loading State -->
      <div v-if="pending" class="flex items-center justify-center py-12">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="card bg-base-100 shadow-md border border-base-300">
        <div class="card-body">
          <div role="alert" class="alert alert-error mb-4">
            <i class="fas fa-triangle-exclamation"></i>
            <div>
              <div class="font-semibold">Error Loading Thread</div>
              <div class="text-sm">{{ error.message || 'Failed to load thread details' }}</div>
            </div>
          </div>
          <div class="card-actions justify-end">
            <NuxtLink to="/admin/threads" class="btn btn-primary">
              <i class="fad fa-arrow-left mr-2"></i>
              Back to Threads
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Thread Details -->
      <div v-else-if="threadData" class="space-y-6">
        <!-- Back Button -->
        <div>
          <NuxtLink to="/admin/threads" class="btn btn-ghost btn-sm">
            <i class="fad fa-arrow-left mr-2"></i>
            Back to Threads
          </NuxtLink>
        </div>

        <!-- Thread Information -->
        <div class="card bg-base-200 shadow-md border border-base-300">
          <div class="card-body">
            <h2 class="text-2xl font-bold mb-4">Thread Information</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span class="opacity-70">Thread ID:</span>
                <code class="ml-2">{{ threadData.thread.thread_id }}</code>
              </div>
              <div>
                <span class="opacity-70">Status:</span>
                <span class="badge ml-2" :class="`badge-${getStatusColor(threadData.thread.status)}`">
                  {{ threadData.thread.status || 'unknown' }}
                </span>
              </div>
              <div>
                <span class="opacity-70">Created:</span>
                <span class="ml-2">{{ formatDate(threadData.thread.created_at) }}</span>
              </div>
              <div>
                <span class="opacity-70">Updated:</span>
                <span class="ml-2">{{ formatDate(threadData.thread.updated_at) }}</span>
              </div>
            </div>
            <div v-if="threadData.thread.metadata" class="mt-4">
              <span class="opacity-70 block mb-2">Metadata:</span>
              <pre class="bg-base-300/50 p-3 rounded text-xs overflow-auto max-h-40">{{
                JSON.stringify(threadData.thread.metadata, null, 2)
              }}</pre>
            </div>
          </div>
        </div>

        <!-- Chat Messages -->
        <div v-if="chatMessages.length > 0" class="card bg-base-200 shadow-md border border-base-300">
          <div class="card-body">
            <h2 class="text-2xl font-bold mb-4">Chat Messages ({{ chatMessages.length }})</h2>
            <div class="space-y-4 mt-4">
              <div
                v-for="message in chatMessages"
                :key="message.index"
                class="rounded-lg p-4 border-l-4"
                :class="{
                  'border-primary bg-primary/5':
                    message.role.toLowerCase().includes('human') || message.role.toLowerCase().includes('user'),
                  'border-secondary bg-secondary/5':
                    message.role.toLowerCase().includes('ai') || message.role.toLowerCase().includes('assistant'),
                  'border-info bg-info/5': message.role.toLowerCase().includes('system'),
                  'border-warning bg-warning/5': message.role.toLowerCase().includes('tool'),
                }"
              >
                <div class="flex items-center gap-2 mb-2">
                  <span class="badge" :class="`badge-${getRoleBadgeColor(message.role)}`">{{ message.role }}</span>
                  <span v-if="message.name" class="text-xs opacity-70">{{ message.name }}</span>
                  <span class="text-xs opacity-50 ml-auto">#{{ message.index }}</span>
                </div>

                <!-- Display formatted content -->
                <div class="prose prose-sm max-w-none mb-3">
                  <div class="whitespace-pre-wrap">{{ message.displayContent }}</div>
                </div>

                <!-- Tool Calls -->
                <div v-if="message.toolCalls" class="collapse collapse-arrow bg-base-100 border border-base-300 mt-3">
                  <input type="checkbox" />
                  <div class="collapse-title font-medium">Tool Calls</div>
                  <div class="collapse-content">
                    <pre class="bg-black text-green-400 p-3 rounded text-xs overflow-auto">{{
                      JSON.stringify(message.toolCalls, null, 2)
                    }}</pre>
                  </div>
                </div>

                <!-- Tool Results -->
                <div v-if="message.toolResults" class="collapse collapse-arrow bg-base-100 border border-base-300 mt-3">
                  <input type="checkbox" />
                  <div class="collapse-title font-medium">Tool Results</div>
                  <div class="collapse-content">
                    <pre class="bg-black text-green-400 p-3 rounded text-xs overflow-auto">{{
                      JSON.stringify(message.toolResults, null, 2)
                    }}</pre>
                  </div>
                </div>

                <!-- Raw Message JSON -->
                <div class="collapse collapse-arrow bg-base-100 border border-base-300 mt-3">
                  <input type="checkbox" />
                  <div class="collapse-title font-medium">Raw Message Data</div>
                  <div class="collapse-content">
                    <pre class="bg-black text-green-400 p-3 rounded text-xs overflow-auto">{{
                      JSON.stringify(message.rawContent, null, 2)
                    }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Thread State (Raw JSON) -->
        <div v-if="threadData.state" class="card bg-base-200 shadow-md border border-base-300">
          <div class="card-body">
            <h2 class="text-2xl font-bold mb-4">Thread State (Raw JSON)</h2>
            <pre class="bg-base-300/50 p-3 rounded text-xs overflow-auto max-h-96">{{
              JSON.stringify(threadData.state, null, 2)
            }}</pre>
          </div>
        </div>

        <!-- Thread History (Raw JSON) -->
        <div
          v-if="threadData.history && threadData.history.length > 0"
          class="card bg-base-200 shadow-md border border-base-300"
        >
          <div class="card-body">
            <h2 class="text-2xl font-bold mb-4">Run History ({{ threadData.history.length }} runs)</h2>
            <div class="overflow-x-auto">
              <pre class="bg-base-300/50 p-3 rounded text-xs max-h-96 overflow-auto">{{
                JSON.stringify(threadData.history, null, 2)
              }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
