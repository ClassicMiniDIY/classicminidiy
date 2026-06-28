<template>
  <div class="overflow-x-auto">
    <table class="table table-zebra w-full">
      <thead>
        <tr>
          <th class="cursor-pointer select-none hover:bg-base-300 transition-colors" @click="emit('sort', 'title')">
            <div class="flex items-center gap-1">
              {{ t('columns.title') }}
              <i v-if="sortBy === 'title'" class="fas fa-sort text-primary"></i>
            </div>
          </th>
          <th>{{ t('columns.category') }}</th>
          <th class="cursor-pointer select-none hover:bg-base-300 transition-colors" @click="emit('sort', 'budget')">
            <div class="flex items-center gap-1">
              {{ t('columns.budget') }}
              <i
                v-if="sortBy === 'budget' || sortBy === 'budget_high' || sortBy === 'budget_low'"
                class="fas fa-sort text-primary"
              ></i>
            </div>
          </th>
          <th>{{ t('columns.location') }}</th>
          <th>{{ t('columns.condition') }}</th>
          <th class="cursor-pointer select-none hover:bg-base-300 transition-colors" @click="emit('sort', 'date')">
            <div class="flex items-center gap-1">
              {{ t('columns.posted') }}
              <i
                v-if="sortBy === 'date' || sortBy === 'newest' || sortBy === 'oldest'"
                class="fas fa-sort text-primary"
              ></i>
            </div>
          </th>
          <th v-if="showUserColumn">{{ t('columns.user') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="post in posts" :key="post.id" class="hover:bg-base-300/50 transition-colors">
          <!-- Title -->
          <td>
            <NuxtLink
              :to="`/exchange/wanted/${post.id}`"
              class="font-medium hover:text-primary transition-colors line-clamp-1 max-w-xs"
            >
              {{ post.title }}
            </NuxtLink>
          </td>

          <!-- Category -->
          <td>
            <span class="badge badge-sm" :class="categoryBadgeClass(post.category)">
              {{ formatCategory(post.category) }}
            </span>
          </td>

          <!-- Budget -->
          <td>
            <span v-if="formatBudget(post.budget_min, post.budget_max, post.currency)" class="whitespace-nowrap">
              {{ formatBudget(post.budget_min, post.budget_max, post.currency) }}
            </span>
            <span v-else class="text-base-content/40">&mdash;</span>
          </td>

          <!-- Location -->
          <td>
            <span
              v-if="formatLocation(post.city, post.state_province, post.country)"
              class="flex items-center gap-1 whitespace-nowrap"
            >
              <template v-if="getCountryFlag(post.country)">{{ getCountryFlag(post.country) }}</template>
              {{ formatLocation(post.city, post.state_province, post.country) }}
            </span>
            <span v-else class="text-base-content/40">&mdash;</span>
          </td>

          <!-- Condition -->
          <td>
            <span v-if="post.condition_preference && post.condition_preference !== 'any'" class="capitalize">
              {{ post.condition_preference }}
            </span>
            <span v-else class="text-base-content/60">{{ t('any') }}</span>
          </td>

          <!-- Posted -->
          <td class="whitespace-nowrap text-base-content/70">
            <ClientOnly>{{ timeAgo(post.created_at) }}</ClientOnly>
          </td>

          <!-- User (optional column) -->
          <td v-if="showUserColumn">
            <div v-if="post.profiles" class="flex items-center gap-2">
              <ExchangeAvatar
                :avatar-url="post.profiles.avatar_url"
                :display-name="post.profiles.display_name"
                :username="post.profiles.username"
                size="xs"
              />
              <span class="text-sm font-medium truncate max-w-[120px]">
                {{ post.profiles.display_name || post.profiles.username || t('anonymous') }}
              </span>
            </div>
            <span v-else class="text-base-content/40">&mdash;</span>
          </td>
        </tr>

        <!-- Empty state -->
        <tr v-if="posts.length === 0">
          <td :colspan="showUserColumn ? 7 : 6" class="text-center py-8 text-base-content/50">
            <div class="flex flex-col items-center gap-2">
              <i class="fas fa-magnifying-glass text-2xl"></i>
              <p>{{ t('empty') }}</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
  import type { WantedPost } from '~/composables/useWantedPosts';
  import { getCountryFlag } from '~/utils/countryFlags';
  import { categoryBadgeClass, formatCategory, formatBudget, formatLocation, timeAgo } from '~/utils/wantedFormatters';

  const { t } = useI18n();

  const props = defineProps<{
    posts: WantedPost[];
    sortBy?: string;
    showUserColumn?: boolean;
  }>();

  const emit = defineEmits<{
    (e: 'sort', column: string): void;
  }>();
</script>

<i18n lang="json">
{
  "en": { "columns": { "title": "Title", "category": "Category", "budget": "Budget", "location": "Location", "condition": "Condition", "posted": "Posted", "user": "User" }, "any": "Any", "anonymous": "Anonymous", "empty": "No wanted posts found" },
  "es": { "columns": { "title": "Título", "category": "Categoría", "budget": "Presupuesto", "location": "Ubicación", "condition": "Estado", "posted": "Publicado", "user": "Usuario" }, "any": "Cualquiera", "anonymous": "Anónimo", "empty": "No se encontraron anuncios de búsqueda" },
  "fr": { "columns": { "title": "Titre", "category": "Catégorie", "budget": "Budget", "location": "Lieu", "condition": "État", "posted": "Publié", "user": "Utilisateur" }, "any": "Tout", "anonymous": "Anonyme", "empty": "Aucune annonce de recherche trouvée" },
  "de": { "columns": { "title": "Titel", "category": "Kategorie", "budget": "Budget", "location": "Ort", "condition": "Zustand", "posted": "Veröffentlicht", "user": "Nutzer" }, "any": "Beliebig", "anonymous": "Anonym", "empty": "Keine Gesuche gefunden" },
  "it": { "columns": { "title": "Titolo", "category": "Categoria", "budget": "Budget", "location": "Posizione", "condition": "Condizione", "posted": "Pubblicato", "user": "Utente" }, "any": "Qualsiasi", "anonymous": "Anonimo", "empty": "Nessun annuncio di ricerca trovato" },
  "pt": { "columns": { "title": "Título", "category": "Categoria", "budget": "Orçamento", "location": "Localização", "condition": "Condição", "posted": "Publicado", "user": "Usuário" }, "any": "Qualquer", "anonymous": "Anônimo", "empty": "Nenhum anúncio de procura encontrado" },
  "ru": { "columns": { "title": "Название", "category": "Категория", "budget": "Бюджет", "location": "Местоположение", "condition": "Состояние", "posted": "Опубликовано", "user": "Пользователь" }, "any": "Любое", "anonymous": "Аноним", "empty": "Объявления о поиске не найдены" },
  "ja": { "columns": { "title": "タイトル", "category": "カテゴリー", "budget": "予算", "location": "場所", "condition": "状態", "posted": "投稿日", "user": "ユーザー" }, "any": "指定なし", "anonymous": "匿名", "empty": "募集投稿が見つかりません" },
  "zh": { "columns": { "title": "标题", "category": "类别", "budget": "预算", "location": "位置", "condition": "状况", "posted": "发布时间", "user": "用户" }, "any": "任意", "anonymous": "匿名", "empty": "未找到求购信息" },
  "ko": { "columns": { "title": "제목", "category": "카테고리", "budget": "예산", "location": "위치", "condition": "상태", "posted": "게시일", "user": "사용자" }, "any": "모두", "anonymous": "익명", "empty": "구함 게시물을 찾을 수 없습니다" }
}
</i18n>
