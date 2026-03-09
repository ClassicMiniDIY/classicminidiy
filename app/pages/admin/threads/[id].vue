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
        <UBreadcrumb
          :items="[
            { label: 'Home', to: '/', icon: 'i-fa6-solid-house' },
            { label: 'Admin', to: '/admin' },
            { label: 'Chat Threads', to: '/admin/threads' },
            { label: 'Thread Details' },
          ]"
          :ui="{
            item: 'text-primary-600 dark:text-primary-400',
            link: 'text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300',
            linkActive: 'text-neutral-500 dark:text-neutral-400 font-medium',
            separator: 'text-neutral-400 dark:text-neutral-500',
            icon: 'text-primary-600 dark:text-primary-400',
          }"
        />

        <div class="flex items-center gap-4">
          <span class="text-sm opacity-70"> Welcome, {{ userProfile?.display_name || userProfile?.email }} </span>
          <UButton @click="handleLogout" variant="ghost" size="sm">
            <i class="fad fa-sign-out mr-2"></i>
            Logout
          </UButton>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="container mx-auto px-4 py-8">
      <!-- Loading State -->
      <div v-if="pending" class="flex items-center justify-center py-12">
        <span class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
      </div>

      <!-- Error State -->
      <UCard v-else-if="error">
        <UAlert color="error" icon="i-fa6-solid-triangle-exclamation" class="mb-4">
          <template #title>Error Loading Thread</template>
          <template #description>{{ error.message || 'Failed to load thread details' }}</template>
        </UAlert>
        <div class="flex justify-end">
          <UButton to="/admin/threads" color="primary">
            <i class="fad fa-arrow-left mr-2"></i>
            Back to Threads
          </UButton>
        </div>
      </UCard>

      <!-- Thread Details -->
      <div v-else-if="threadData" class="space-y-6">
        <!-- Back Button -->
        <div>
          <UButton to="/admin/threads" variant="ghost" size="sm">
            <i class="fad fa-arrow-left mr-2"></i>
            Back to Threads
          </UButton>
        </div>

        <!-- Thread Information -->
        <UCard class="bg-muted">
          <h2 class="text-2xl font-bold mb-4">Thread Information</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span class="opacity-70">Thread ID:</span>
              <code class="ml-2">{{ threadData.thread.thread_id }}</code>
            </div>
            <div>
              <span class="opacity-70">Status:</span>
              <UBadge :color="getStatusColor(threadData.thread.status)" class="ml-2">
                {{ threadData.thread.status || 'unknown' }}
              </UBadge>
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
            <pre class="bg-muted/50 p-3 rounded text-xs overflow-auto max-h-40">{{
              JSON.stringify(threadData.thread.metadata, null, 2)
            }}</pre>
          </div>
        </UCard>

        <!-- Chat Messages -->
        <UCard v-if="chatMessages.length > 0" class="bg-muted">
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
                <UBadge :color="getRoleBadgeColor(message.role)">{{ message.role }}</UBadge>
                <span v-if="message.name" class="text-xs opacity-70">{{ message.name }}</span>
                <span class="text-xs opacity-50 ml-auto">#{{ message.index }}</span>
              </div>

              <!-- Display formatted content -->
              <div class="prose prose-sm max-w-none mb-3">
                <div class="whitespace-pre-wrap">{{ message.displayContent }}</div>
              </div>

              <!-- Tool Calls -->
              <UAccordion
                v-if="message.toolCalls"
                :items="[{ label: 'Tool Calls', value: 'tool-calls', data: message.toolCalls }]"
                class="mt-3"
              >
                <template #body="{ item }">
                  <pre class="bg-black text-green-400 p-3 rounded text-xs overflow-auto">{{
                    JSON.stringify(item.data, null, 2)
                  }}</pre>
                </template>
              </UAccordion>

              <!-- Tool Results -->
              <UAccordion
                v-if="message.toolResults"
                :items="[{ label: 'Tool Results', value: 'tool-results', data: message.toolResults }]"
                class="mt-3"
              >
                <template #body="{ item }">
                  <pre class="bg-black text-green-400 p-3 rounded text-xs overflow-auto">{{
                    JSON.stringify(item.data, null, 2)
                  }}</pre>
                </template>
              </UAccordion>

              <!-- Raw Message JSON -->
              <UAccordion
                :items="[{ label: 'Raw Message Data', value: 'raw-data', data: message.rawContent }]"
                class="mt-3"
              >
                <template #body="{ item }">
                  <pre class="bg-black text-green-400 p-3 rounded text-xs overflow-auto">{{
                    JSON.stringify(item.data, null, 2)
                  }}</pre>
                </template>
              </UAccordion>
            </div>
          </div>
        </UCard>

        <!-- Thread State (Raw JSON) -->
        <UCard v-if="threadData.state" class="bg-muted">
          <h2 class="text-2xl font-bold mb-4">Thread State (Raw JSON)</h2>
          <pre class="bg-muted/50 p-3 rounded text-xs overflow-auto max-h-96">{{
            JSON.stringify(threadData.state, null, 2)
          }}</pre>
        </UCard>

        <!-- Thread History (Raw JSON) -->
        <UCard v-if="threadData.history && threadData.history.length > 0" class="bg-muted">
          <h2 class="text-2xl font-bold mb-4">Run History ({{ threadData.history.length }} runs)</h2>
          <div class="overflow-x-auto">
            <pre class="bg-muted/50 p-3 rounded text-xs max-h-96 overflow-auto">{{
              JSON.stringify(threadData.history, null, 2)
            }}</pre>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
