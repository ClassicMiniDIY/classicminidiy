<template>
  <div class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow h-full">
    <div class="card-body p-4">
      <!-- Top row: Category badge + Status badge -->
      <div class="flex items-center justify-between gap-2">
        <span class="badge badge-sm" :class="categoryBadgeClass(post.category)">
          {{ formatCategory(post.category) }}
        </span>
        <span v-if="post.status !== 'active'" class="badge badge-sm" :class="statusBadgeClass">
          {{ formatStatus(post.status) }}
        </span>
      </div>

      <!-- Title -->
      <NuxtLink
        :to="`/exchange/wanted/${post.id}`"
        class="card-title text-base font-bold line-clamp-1 hover:text-primary transition-colors"
      >
        {{ post.title }}
      </NuxtLink>

      <!-- Description -->
      <p class="text-sm text-base-content/70 line-clamp-3">
        {{ post.description }}
      </p>

      <!-- Budget -->
      <div v-if="formattedBudget" class="flex items-center gap-1.5 text-sm font-semibold text-primary">
        <i class="fas fa-money-bill-wave shrink-0"></i>
        <span>{{ formattedBudget }}</span>
      </div>

      <!-- Location -->
      <div v-if="formattedLocation" class="flex items-center gap-1.5 text-sm text-base-content/60">
        <template v-if="countryFlag">{{ countryFlag }}</template>
        <i v-else class="fas fa-location-dot shrink-0"></i>
        <span class="truncate">{{ formattedLocation }}</span>
      </div>

      <!-- Condition preference -->
      <div v-if="post.condition_preference && post.condition_preference !== 'any'" class="flex items-center gap-1.5">
        <span class="badge badge-ghost badge-sm capitalize">
          {{ post.condition_preference }}
        </span>
      </div>

      <!-- Footer: Posted date + User info -->
      <div class="flex items-center justify-between gap-2 pt-3 mt-auto border-t border-base-300">
        <span class="text-xs text-base-content/50">
          {{ timeAgo(post.created_at) }}
        </span>
        <div v-if="post.profiles" class="flex items-center gap-1.5 min-w-0">
          <ExchangeAvatar
            :avatar-url="post.profiles.avatar_url"
            :display-name="post.profiles.display_name"
            :username="post.profiles.username"
            size="xs"
          />
          <span class="text-xs font-medium truncate">
            {{ post.profiles.display_name || post.profiles.username || t('anonymous') }}
          </span>
        </div>
      </div>

      <!-- Action buttons (owner management) -->
      <div v-if="showActions" class="flex items-center gap-2 pt-2 border-t border-base-300">
        <button
          v-if="post.status === 'active'"
          class="btn btn-sm btn-ghost flex-1 gap-1"
          @click.prevent="emit('fulfill', post.id)"
        >
          <i class="fas fa-circle-check text-success"></i>
          <span>{{ t('fulfilled') }}</span>
        </button>
        <button
          v-if="post.status === 'expired'"
          class="btn btn-sm btn-ghost flex-1 gap-1"
          @click.prevent="emit('renew', post.id)"
        >
          <i class="fas fa-arrows-rotate text-info"></i>
          <span>{{ t('renew') }}</span>
        </button>
        <button class="btn btn-sm btn-ghost flex-1 gap-1 text-error" @click.prevent="emit('delete', post.id)">
          <i class="fas fa-trash"></i>
          <span>{{ t('delete') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { WantedPost } from '~/composables/useWantedPosts';
  import { getCountryFlag } from '~/utils/countryFlags';
  import {
    categoryBadgeClass,
    formatCategory,
    formatWantedStatus as formatStatus,
    wantedStatusBadgeClass,
    formatBudget,
    formatLocation,
    timeAgo,
  } from '~/utils/wantedFormatters';

  const { t } = useI18n();

  const props = defineProps<{
    post: WantedPost;
    showActions?: boolean;
  }>();

  const emit = defineEmits<{
    (e: 'delete', id: string): void;
    (e: 'fulfill', id: string): void;
    (e: 'renew', id: string): void;
  }>();

  const statusBadgeClass = computed(() => wantedStatusBadgeClass(props.post.status));

  const formattedBudget = computed(() => {
    return formatBudget(props.post.budget_min, props.post.budget_max, props.post.currency);
  });

  const formattedLocation = computed(() => {
    return formatLocation(props.post.city, props.post.state_province, props.post.country);
  });

  const countryFlag = computed(() => getCountryFlag(props.post.country));
</script>

<i18n lang="json">
{
  "en": { "anonymous": "Anonymous", "fulfilled": "Fulfilled", "renew": "Renew", "delete": "Delete" },
  "es": { "anonymous": "Anónimo", "fulfilled": "Conseguido", "renew": "Renovar", "delete": "Eliminar" },
  "fr": { "anonymous": "Anonyme", "fulfilled": "Trouvé", "renew": "Renouveler", "delete": "Supprimer" },
  "de": { "anonymous": "Anonym", "fulfilled": "Gefunden", "renew": "Erneuern", "delete": "Löschen" },
  "it": { "anonymous": "Anonimo", "fulfilled": "Trovato", "renew": "Rinnova", "delete": "Elimina" },
  "pt": { "anonymous": "Anônimo", "fulfilled": "Encontrado", "renew": "Renovar", "delete": "Excluir" },
  "ru": { "anonymous": "Аноним", "fulfilled": "Найдено", "renew": "Продлить", "delete": "Удалить" },
  "ja": { "anonymous": "匿名", "fulfilled": "見つかった", "renew": "更新", "delete": "削除" },
  "zh": { "anonymous": "匿名", "fulfilled": "已找到", "renew": "续期", "delete": "删除" },
  "ko": { "anonymous": "익명", "fulfilled": "찾음", "renew": "갱신", "delete": "삭제" }
}
</i18n>
