<template>
  <div>
    <!-- Loading State -->
    <div v-if="loading" class="py-12">
      <div class="container">
        <!-- Breadcrumb skeleton -->
        <div class="skeleton h-4 w-48 mb-6"></div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Main content skeleton -->
          <div class="lg:col-span-2 space-y-6">
            <div class="skeleton h-10 w-3/4"></div>
            <div class="flex gap-2">
              <div class="skeleton h-6 w-20"></div>
              <div class="skeleton h-6 w-24"></div>
            </div>
            <div class="skeleton h-48 w-full"></div>
            <div class="skeleton h-24 w-full"></div>
          </div>

          <!-- Sidebar skeleton -->
          <div class="space-y-4">
            <div class="skeleton h-48 w-full"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Post Content -->
    <div v-else-if="currentPost" class="py-8">
      <div class="container">
        <!-- Breadcrumb -->
        <div class="breadcrumbs text-sm mb-6">
          <ul>
            <li><NuxtLink to="/exchange/wanted">{{ t('breadcrumb.wanted') }}</NuxtLink></li>
            <li>{{ currentPost.title }}</li>
          </ul>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Main Content (2 cols) -->
          <div class="lg:col-span-2 space-y-6">
            <!-- Header -->
            <div>
              <div class="flex flex-wrap items-start gap-3 mb-2">
                <h1 class="text-3xl sm:text-4xl font-bold flex-1">{{ currentPost.title }}</h1>
                <!-- Status badge for non-active posts -->
                <span v-if="currentPost.status !== 'active'" class="badge badge-lg" :class="statusBadgeClass">
                  {{ formatWantedStatus(currentPost.status) }}
                </span>
              </div>

              <!-- Category + Condition badges -->
              <div class="flex flex-wrap items-center gap-2">
                <span class="badge" :class="categoryBadgeClass(currentPost.category)">
                  {{ formatCategory(currentPost.category) }}
                </span>
                <span v-if="currentPost.parts_subcategory" class="badge badge-outline badge-sm">
                  {{ formatPartsSubcategory(currentPost.parts_subcategory) }}
                </span>
                <span
                  v-if="currentPost.condition_preference && currentPost.condition_preference !== 'any'"
                  class="badge badge-ghost"
                >
                  {{ formatConditionPreference(currentPost.condition_preference) }}
                </span>
              </div>
            </div>

            <!-- Posted By Section -->
            <div class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
              <NuxtLink v-if="currentPost.profiles" :to="`/users/${currentPost.user_id}`" class="avatar shrink-0">
                <div class="w-12 h-12 rounded-full bg-base-300">
                  <img
                    v-if="currentPost.profiles.avatar_url"
                    :src="currentPost.profiles.avatar_url"
                    :alt="currentPost.profiles.display_name || t('user')"
                    loading="lazy"
                  />
                  <div
                    v-else
                    class="flex items-center justify-center h-full text-lg font-semibold text-base-content/70"
                  >
                    {{ getInitials(currentPost.profiles.display_name || currentPost.profiles.username || t('anonymous')) }}
                  </div>
                </div>
              </NuxtLink>
              <div class="flex-1 min-w-0">
                <NuxtLink
                  v-if="currentPost.profiles"
                  :to="`/users/${currentPost.user_id}`"
                  class="font-medium hover:text-primary transition-colors"
                >
                  {{ currentPost.profiles.display_name || currentPost.profiles.username || t('anonymous') }}
                </NuxtLink>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-base-content/60">
                  <span>{{ t('postedAgo', { time: timeAgo(currentPost.created_at) }) }}</span>
                  <span class="flex items-center gap-1">
                    <i class="fas fa-clock"></i>
                    {{ t('expiresOn', { date: formatDate(currentPost.expires_at) }) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Description -->
            <div>
              <h2 class="text-2xl font-semibold mb-3">{{ t('section.description') }}</h2>
              <p class="text-base-content/80 whitespace-pre-wrap">{{ currentPost.description }}</p>
            </div>

            <!-- Budget -->
            <div v-if="formattedBudget">
              <h2 class="text-2xl font-semibold mb-3">{{ t('section.budget') }}</h2>
              <div class="flex items-center gap-2 text-xl font-bold text-primary">
                <i class="fas fa-money-bill-wave text-2xl"></i>
                {{ formattedBudget }}
              </div>
            </div>

            <!-- Location -->
            <div v-if="formattedLocation">
              <h2 class="text-2xl font-semibold mb-3">{{ t('section.location') }}</h2>
              <div class="flex items-center gap-2 text-base-content/80">
                <template v-if="countryFlag">
                  <span class="text-lg">{{ countryFlag }}</span>
                </template>
                <i v-else class="fas fa-location-dot text-xl text-base-content/50"></i>
                <span>{{ formattedLocation }}</span>
              </div>
            </div>

            <!-- Dates -->
            <div class="grid sm:grid-cols-2 gap-4">
              <div class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                <i class="fas fa-calendar text-2xl text-base-content/60"></i>
                <div>
                  <div class="text-sm text-base-content/60">{{ t('label.posted') }}</div>
                  <div class="font-medium">{{ formatDate(currentPost.created_at) }}</div>
                </div>
              </div>
              <div class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                <i class="fas fa-clock text-2xl text-base-content/60"></i>
                <div>
                  <div class="text-sm text-base-content/60">{{ t('label.expires') }}</div>
                  <div class="font-medium" :class="isExpired ? 'text-error' : ''">
                    {{ formatDate(currentPost.expires_at) }}
                    <span v-if="isExpired" class="text-xs">{{ t('expiredSuffix') }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Sidebar (1 col) -->
          <div class="lg:col-span-1">
            <div class="lg:sticky lg:top-20">
              <div class="card bg-base-100 shadow-sm">
                <div class="card-body">
                  <!-- Budget summary at top of sidebar -->
                  <div v-if="formattedBudget" class="mb-4 pb-4 border-b border-base-300">
                    <div class="text-sm text-base-content/60 mb-1">{{ t('section.budget') }}</div>
                    <div class="text-2xl font-bold text-primary">{{ formattedBudget }}</div>
                  </div>

                  <!-- Quick info -->
                  <div class="space-y-2 mb-6 text-sm">
                    <div class="flex items-center gap-2">
                      <i :class="categoryIcon" class="text-base-content/50 shrink-0"></i>
                      <span>{{ formatCategory(currentPost.category) }}</span>
                    </div>
                    <div v-if="currentPost.condition_preference !== 'any'" class="flex items-center gap-2">
                      <i class="far fa-star text-base-content/50 shrink-0"></i>
                      <span>{{ formatConditionPreference(currentPost.condition_preference) }}</span>
                    </div>
                    <div v-if="formattedLocation" class="flex items-center gap-2">
                      <template v-if="countryFlag">
                        <span class="shrink-0">{{ countryFlag }}</span>
                      </template>
                      <i v-else class="fas fa-location-dot text-base-content/50 shrink-0"></i>
                      <span class="truncate">{{ formattedLocation }}</span>
                    </div>
                  </div>

                  <!-- Action Buttons -->
                  <div class="space-y-3">
                    <!-- Visitor Actions: "I Have This" button -->
                    <template v-if="!isOwner">
                      <button class="btn btn-primary btn-block" :disabled="contactLoading" @click="handleContact">
                        <span v-if="contactLoading" class="loading loading-spinner loading-sm"></span>
                        <i v-else class="fas fa-envelope text-xl"></i>
                        {{ t('action.iHaveThis') }}
                      </button>
                      <p class="text-xs text-base-content/50 text-center">
                        {{ t('action.iHaveThisHint') }}
                      </p>
                    </template>

                    <!-- Owner Actions -->
                    <template v-if="isOwner">
                      <!-- Edit -->
                      <NuxtLink
                        v-if="currentPost.status !== 'fulfilled'"
                        :to="`/exchange/wanted/${currentPost.id}/edit`"
                        class="btn btn-primary btn-block"
                      >
                        <i class="fas fa-pen-to-square text-xl"></i>
                        {{ t('action.editPost') }}
                      </NuxtLink>

                      <!-- Mark Fulfilled -->
                      <button
                        v-if="currentPost.status === 'active'"
                        class="btn btn-outline btn-success btn-block"
                        :disabled="fulfilling"
                        @click="handleMarkFulfilled"
                      >
                        <span v-if="fulfilling" class="loading loading-spinner loading-sm"></span>
                        <i v-else class="fas fa-circle-check text-xl"></i>
                        {{ t('action.markFulfilled') }}
                      </button>

                      <!-- Renew (if expired) -->
                      <button
                        v-if="currentPost.status === 'expired'"
                        class="btn btn-outline btn-info btn-block"
                        :disabled="renewing"
                        @click="handleRenew"
                      >
                        <span v-if="renewing" class="loading loading-spinner loading-sm"></span>
                        <i v-else class="fas fa-arrows-rotate text-xl"></i>
                        {{ t('action.renewPost') }}
                      </button>

                      <!-- Delete -->
                      <button class="btn btn-outline btn-error btn-block" @click="handleDeleteClick">
                        <i class="fas fa-trash text-xl"></i>
                        {{ t('action.deletePost') }}
                      </button>

                      <!-- Dashboard link -->
                      <NuxtLink to="/dashboard/wanted" class="btn btn-ghost btn-block">
                        <i class="fas fa-arrow-left text-xl"></i>
                        {{ t('action.backToMyPosts') }}
                      </NuxtLink>
                    </template>
                  </div>

                  <!-- Posted / Updated Date -->
                  <div class="mt-6 pt-6 border-t border-base-300 text-sm text-base-content/60 flex items-center gap-2">
                    <i class="fas fa-calendar shrink-0"></i>
                    <span>
                      {{ t('postedDate', { date: formatDate(currentPost.created_at) }) }}
                      <template v-if="currentPost.updated_at !== currentPost.created_at">
                        {{ t('updatedDate', { date: formatDate(currentPost.updated_at) }) }}
                      </template>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Not Found State -->
    <div v-else class="py-20">
      <div class="container">
        <div class="text-center">
          <i class="fas fa-triangle-exclamation text-6xl mx-auto mb-4 text-base-content/30"></i>
          <h1 class="text-3xl font-bold mb-2">{{ t('notFound.title') }}</h1>
          <p class="text-base-content/70 mb-6">{{ t('notFound.body') }}</p>
          <NuxtLink to="/exchange/wanted" class="btn btn-primary btn-lg">{{ t('notFound.browse') }}</NuxtLink>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <dialog ref="deleteDialogRef" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg">{{ t('deleteDialog.title') }}</h3>
        <p class="py-4">{{ t('deleteDialog.body') }}</p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="deleteDialogRef?.close()">{{ t('deleteDialog.cancel') }}</button>
          <button class="btn btn-error" @click="confirmDelete">{{ t('deleteDialog.confirm') }}</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>{{ t('deleteDialog.close') }}</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
  import { getCountryFlag } from '~/utils/countryFlags';
  import {
    categoryBadgeClass,
    formatCategory,
    formatWantedStatus,
    wantedStatusBadgeClass,
    formatBudget,
    formatLocation,
    timeAgo,
  } from '~/utils/wantedFormatters';

  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { currentPost, loading, fetchWantedPost, deleteWantedPost, markFulfilled, renewWantedPost } = useWantedPosts();
  const { startConversation } = useMessages();
  const { capture } = usePostHog();

  const postId = route.params.id as string;

  // UI state
  const contactLoading = ref(false);
  const fulfilling = ref(false);
  const renewing = ref(false);
  const deleteDialogRef = ref<HTMLDialogElement | null>(null);

  // Whether current user owns this post
  const isOwner = computed(() => {
    return user.value?.id === currentPost.value?.user_id;
  });

  // Whether the post has expired
  const isExpired = computed(() => {
    if (!currentPost.value) return false;
    return new Date(currentPost.value.expires_at) < new Date();
  });

  // Category icon (Font Awesome 6 classes)
  const categoryIcon = computed(() => {
    switch (currentPost.value?.category) {
      case 'vehicle':
        return 'fas fa-truck';
      case 'engine':
        return 'fas fa-gear';
      case 'parts':
        return 'fas fa-screwdriver-wrench';
      default:
        return 'fas fa-tag';
    }
  });

  // Status badge styling
  const statusBadgeClass = computed(() => wantedStatusBadgeClass(currentPost.value?.status ?? ''));

  // Country flag emoji
  const countryFlag = computed(() => {
    return currentPost.value?.country ? getCountryFlag(currentPost.value.country) : '';
  });

  // Formatted budget display
  const formattedBudget = computed(() => {
    if (!currentPost.value) return null;
    return formatBudget(currentPost.value.budget_min, currentPost.value.budget_max, currentPost.value.currency);
  });

  // Formatted location display
  const formattedLocation = computed(() => {
    if (!currentPost.value) return null;
    return formatLocation(currentPost.value.city, currentPost.value.state_province, currentPost.value.country);
  });

  // --- Helper functions ---

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatPartsSubcategory(subcategory: string): string {
    return subcategory
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  function formatConditionPreference(condition: string): string {
    const labels: Record<string, string> = {
      any: 'Any Condition',
      new: 'New',
      used: 'Used',
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      project: 'Project',
      rebuilt: 'Rebuilt',
      running: 'Running',
      not_running: 'Not Running',
    };
    return labels[condition] || condition.charAt(0).toUpperCase() + condition.slice(1).replace(/_/g, ' ');
  }

  // --- Actions ---

  /**
   * Handle "I Have This" button click.
   * Requires auth - redirects to login (via ?login=required) if not authenticated.
   * Starts a conversation with the post owner.
   */
  async function handleContact() {
    if (!currentPost.value) return;

    // Check auth
    if (!user.value) {
      router.push({ query: { ...route.query, login: 'required' } });
      return;
    }

    contactLoading.value = true;

    try {
      // Track analytics
      capture('wanted_post_contact_clicked', {
        wanted_post_id: currentPost.value.id,
        poster_id: currentPost.value.user_id,
      });

      const conversationId = await startConversation({
        wantedPostId: currentPost.value.id,
        recipientId: currentPost.value.user_id,
      });

      if (conversationId) {
        navigateTo(`/exchange/messages/${conversationId}`);
      }
    } catch (error) {
      toast.add({
        title: t('toast.errorTitle'),
        description: t('toast.contactError'),
        color: 'error',
      });
    } finally {
      contactLoading.value = false;
    }
  }

  /**
   * Mark the wanted post as fulfilled.
   */
  async function handleMarkFulfilled() {
    if (!currentPost.value) return;

    fulfilling.value = true;
    try {
      await markFulfilled(currentPost.value.id);
    } finally {
      fulfilling.value = false;
    }
  }

  /**
   * Renew an expired wanted post.
   */
  async function handleRenew() {
    if (!currentPost.value) return;

    renewing.value = true;
    try {
      await renewWantedPost(currentPost.value.id);
    } finally {
      renewing.value = false;
    }
  }

  /**
   * Show the delete confirmation dialog.
   */
  function handleDeleteClick() {
    deleteDialogRef.value?.showModal();
  }

  /**
   * Confirm and execute deletion, then navigate to dashboard.
   */
  async function confirmDelete() {
    if (!currentPost.value) return;

    const success = await deleteWantedPost(currentPost.value.id);
    if (success) {
      navigateTo('/dashboard/wanted');
    }
  }

  // --- Data Fetching ---

  // Fetch post data (SSR-compatible for SEO)
  const { data: fetchedPost } = await useAsyncData(`wanted-post-${postId}`, () => fetchWantedPost(postId));

  // If useAsyncData resolved, set the loading state accordingly
  if (fetchedPost.value) {
    loading.value = false;
  } else {
    loading.value = false;
  }

  // --- SEO ---

  const config = useRuntimeConfig();
  const siteUrl = config.public.siteUrl || 'https://www.classicminidiy.com';
  const canonicalUrl = `${siteUrl}/exchange/wanted/${postId}`;

  const ogDescription = computed(() => {
    if (!currentPost.value) return '';
    const desc = currentPost.value.description;
    if (desc.length <= 160) return desc;
    const truncated = desc.substring(0, 160);
    const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated) + '...';
  });

  useSeoMeta({
    title: () =>
      currentPost.value ? t('seo.titleWithName', { name: currentPost.value.title }) : t('seo.titleDefault'),
    description: () => ogDescription.value,
    ogTitle: () => currentPost.value?.title || t('seo.ogTitleDefault'),
    ogDescription: () => ogDescription.value,
    ogType: 'website',
    ogUrl: canonicalUrl,
    ogSiteName: 'Classic Mini DIY',
  });

  useHead({
    link: [{ rel: 'canonical', href: canonicalUrl }],
  });

  // --- Analytics ---

  // Track page view when post loads (client-side only)
  const hasTrackedView = ref(false);

  watch(
    () => currentPost.value,
    (post) => {
      if (post && !hasTrackedView.value && import.meta.client) {
        hasTrackedView.value = true;
        capture('wanted_post_viewed', {
          wanted_post_id: post.id,
          category: post.category,
        });
      }
    },
    { immediate: true }
  );
</script>

<i18n lang="json">
{
  "en": {
    "breadcrumb": { "wanted": "Wanted Posts" },
    "user": "User",
    "anonymous": "Anonymous",
    "postedAgo": "Posted {time}",
    "expiresOn": "Expires {date}",
    "section": { "description": "Description", "budget": "Budget", "location": "Location" },
    "label": { "posted": "Posted", "expires": "Expires" },
    "expiredSuffix": "(Expired)",
    "action": {
      "iHaveThis": "I Have This",
      "iHaveThisHint": "Send a message to let them know you have what they are looking for",
      "editPost": "Edit Post",
      "markFulfilled": "Mark as Fulfilled",
      "renewPost": "Renew Post",
      "deletePost": "Delete Post",
      "backToMyPosts": "Back to My Wanted Posts"
    },
    "postedDate": "Posted {date}",
    "updatedDate": "· Updated {date}",
    "notFound": {
      "title": "Wanted Post Not Found",
      "body": "This wanted post doesn't exist or has been removed.",
      "browse": "Browse Wanted Posts"
    },
    "deleteDialog": {
      "title": "Delete Wanted Post",
      "body": "Are you sure you want to delete this wanted post? This action cannot be undone.",
      "cancel": "Cancel",
      "confirm": "Delete",
      "close": "close"
    },
    "toast": { "errorTitle": "Error", "contactError": "Failed to start conversation. Please try again." },
    "seo": {
      "titleWithName": "{name} - Wanted - Classic Mini DIY",
      "titleDefault": "Wanted Post - Classic Mini DIY",
      "ogTitleDefault": "Wanted Post"
    }
  },
  "es": {
    "breadcrumb": { "wanted": "Anuncios de búsqueda" },
    "user": "Usuario",
    "anonymous": "Anónimo",
    "postedAgo": "Publicado {time}",
    "expiresOn": "Expira {date}",
    "section": { "description": "Descripción", "budget": "Presupuesto", "location": "Ubicación" },
    "label": { "posted": "Publicado", "expires": "Expira" },
    "expiredSuffix": "(Expirado)",
    "action": {
      "iHaveThis": "Yo tengo esto",
      "iHaveThisHint": "Envía un mensaje para avisarles de que tienes lo que buscan",
      "editPost": "Editar anuncio",
      "markFulfilled": "Marcar como completado",
      "renewPost": "Renovar anuncio",
      "deletePost": "Eliminar anuncio",
      "backToMyPosts": "Volver a mis anuncios de búsqueda"
    },
    "postedDate": "Publicado {date}",
    "updatedDate": "· Actualizado {date}",
    "notFound": {
      "title": "Anuncio de búsqueda no encontrado",
      "body": "Este anuncio de búsqueda no existe o ha sido eliminado.",
      "browse": "Explorar anuncios de búsqueda"
    },
    "deleteDialog": {
      "title": "Eliminar anuncio de búsqueda",
      "body": "¿Seguro que quieres eliminar este anuncio de búsqueda? Esta acción no se puede deshacer.",
      "cancel": "Cancelar",
      "confirm": "Eliminar",
      "close": "cerrar"
    },
    "toast": { "errorTitle": "Error", "contactError": "No se pudo iniciar la conversación. Inténtalo de nuevo." },
    "seo": {
      "titleWithName": "{name} - Buscado - Classic Mini DIY",
      "titleDefault": "Anuncio de búsqueda - Classic Mini DIY",
      "ogTitleDefault": "Anuncio de búsqueda"
    }
  },
  "fr": {
    "breadcrumb": { "wanted": "Annonces de recherche" },
    "user": "Utilisateur",
    "anonymous": "Anonyme",
    "postedAgo": "Publié {time}",
    "expiresOn": "Expire le {date}",
    "section": { "description": "Description", "budget": "Budget", "location": "Lieu" },
    "label": { "posted": "Publié", "expires": "Expire" },
    "expiredSuffix": "(Expiré)",
    "action": {
      "iHaveThis": "Je l'ai",
      "iHaveThisHint": "Envoyez un message pour leur faire savoir que vous avez ce qu'ils cherchent",
      "editPost": "Modifier l'annonce",
      "markFulfilled": "Marquer comme satisfait",
      "renewPost": "Renouveler l'annonce",
      "deletePost": "Supprimer l'annonce",
      "backToMyPosts": "Retour à mes annonces de recherche"
    },
    "postedDate": "Publié {date}",
    "updatedDate": "· Mis à jour {date}",
    "notFound": {
      "title": "Annonce de recherche introuvable",
      "body": "Cette annonce de recherche n'existe pas ou a été supprimée.",
      "browse": "Parcourir les annonces de recherche"
    },
    "deleteDialog": {
      "title": "Supprimer l'annonce de recherche",
      "body": "Êtes-vous sûr de vouloir supprimer cette annonce de recherche ? Cette action est irréversible.",
      "cancel": "Annuler",
      "confirm": "Supprimer",
      "close": "fermer"
    },
    "toast": { "errorTitle": "Erreur", "contactError": "Impossible de démarrer la conversation. Veuillez réessayer." },
    "seo": {
      "titleWithName": "{name} - Recherché - Classic Mini DIY",
      "titleDefault": "Annonce de recherche - Classic Mini DIY",
      "ogTitleDefault": "Annonce de recherche"
    }
  },
  "de": {
    "breadcrumb": { "wanted": "Gesucht-Anzeigen" },
    "user": "Benutzer",
    "anonymous": "Anonym",
    "postedAgo": "Veröffentlicht {time}",
    "expiresOn": "Läuft ab am {date}",
    "section": { "description": "Beschreibung", "budget": "Budget", "location": "Standort" },
    "label": { "posted": "Veröffentlicht", "expires": "Läuft ab" },
    "expiredSuffix": "(Abgelaufen)",
    "action": {
      "iHaveThis": "Ich habe das",
      "iHaveThisHint": "Senden Sie eine Nachricht, um mitzuteilen, dass Sie das Gesuchte haben",
      "editPost": "Anzeige bearbeiten",
      "markFulfilled": "Als erfüllt markieren",
      "renewPost": "Anzeige erneuern",
      "deletePost": "Anzeige löschen",
      "backToMyPosts": "Zurück zu meinen Gesucht-Anzeigen"
    },
    "postedDate": "Veröffentlicht {date}",
    "updatedDate": "· Aktualisiert {date}",
    "notFound": {
      "title": "Gesucht-Anzeige nicht gefunden",
      "body": "Diese Gesucht-Anzeige existiert nicht oder wurde entfernt.",
      "browse": "Gesucht-Anzeigen durchsuchen"
    },
    "deleteDialog": {
      "title": "Gesucht-Anzeige löschen",
      "body": "Möchten Sie diese Gesucht-Anzeige wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
      "cancel": "Abbrechen",
      "confirm": "Löschen",
      "close": "schließen"
    },
    "toast": { "errorTitle": "Fehler", "contactError": "Konversation konnte nicht gestartet werden. Bitte versuchen Sie es erneut." },
    "seo": {
      "titleWithName": "{name} - Gesucht - Classic Mini DIY",
      "titleDefault": "Gesucht-Anzeige - Classic Mini DIY",
      "ogTitleDefault": "Gesucht-Anzeige"
    }
  },
  "it": {
    "breadcrumb": { "wanted": "Annunci di ricerca" },
    "user": "Utente",
    "anonymous": "Anonimo",
    "postedAgo": "Pubblicato {time}",
    "expiresOn": "Scade il {date}",
    "section": { "description": "Descrizione", "budget": "Budget", "location": "Posizione" },
    "label": { "posted": "Pubblicato", "expires": "Scade" },
    "expiredSuffix": "(Scaduto)",
    "action": {
      "iHaveThis": "Ce l'ho io",
      "iHaveThisHint": "Invia un messaggio per far sapere che hai ciò che cercano",
      "editPost": "Modifica annuncio",
      "markFulfilled": "Segna come soddisfatto",
      "renewPost": "Rinnova annuncio",
      "deletePost": "Elimina annuncio",
      "backToMyPosts": "Torna ai miei annunci di ricerca"
    },
    "postedDate": "Pubblicato {date}",
    "updatedDate": "· Aggiornato {date}",
    "notFound": {
      "title": "Annuncio di ricerca non trovato",
      "body": "Questo annuncio di ricerca non esiste o è stato rimosso.",
      "browse": "Sfoglia gli annunci di ricerca"
    },
    "deleteDialog": {
      "title": "Elimina annuncio di ricerca",
      "body": "Sei sicuro di voler eliminare questo annuncio di ricerca? Questa azione non può essere annullata.",
      "cancel": "Annulla",
      "confirm": "Elimina",
      "close": "chiudi"
    },
    "toast": { "errorTitle": "Errore", "contactError": "Impossibile avviare la conversazione. Riprova." },
    "seo": {
      "titleWithName": "{name} - Cercato - Classic Mini DIY",
      "titleDefault": "Annuncio di ricerca - Classic Mini DIY",
      "ogTitleDefault": "Annuncio di ricerca"
    }
  },
  "pt": {
    "breadcrumb": { "wanted": "Anúncios de procura" },
    "user": "Utilizador",
    "anonymous": "Anônimo",
    "postedAgo": "Publicado {time}",
    "expiresOn": "Expira em {date}",
    "section": { "description": "Descrição", "budget": "Orçamento", "location": "Localização" },
    "label": { "posted": "Publicado", "expires": "Expira" },
    "expiredSuffix": "(Expirado)",
    "action": {
      "iHaveThis": "Eu tenho isto",
      "iHaveThisHint": "Envie uma mensagem para avisar que tem o que eles procuram",
      "editPost": "Editar anúncio",
      "markFulfilled": "Marcar como atendido",
      "renewPost": "Renovar anúncio",
      "deletePost": "Excluir anúncio",
      "backToMyPosts": "Voltar aos meus anúncios de procura"
    },
    "postedDate": "Publicado {date}",
    "updatedDate": "· Atualizado {date}",
    "notFound": {
      "title": "Anúncio de procura não encontrado",
      "body": "Este anúncio de procura não existe ou foi removido.",
      "browse": "Explorar anúncios de procura"
    },
    "deleteDialog": {
      "title": "Excluir anúncio de procura",
      "body": "Tem certeza de que deseja excluir este anúncio de procura? Esta ação não pode ser desfeita.",
      "cancel": "Cancelar",
      "confirm": "Excluir",
      "close": "fechar"
    },
    "toast": { "errorTitle": "Erro", "contactError": "Falha ao iniciar a conversa. Tente novamente." },
    "seo": {
      "titleWithName": "{name} - Procurado - Classic Mini DIY",
      "titleDefault": "Anúncio de procura - Classic Mini DIY",
      "ogTitleDefault": "Anúncio de procura"
    }
  },
  "ru": {
    "breadcrumb": { "wanted": "Объявления о поиске" },
    "user": "Пользователь",
    "anonymous": "Аноним",
    "postedAgo": "Опубликовано {time}",
    "expiresOn": "Истекает {date}",
    "section": { "description": "Описание", "budget": "Бюджет", "location": "Местоположение" },
    "label": { "posted": "Опубликовано", "expires": "Истекает" },
    "expiredSuffix": "(Истекло)",
    "action": {
      "iHaveThis": "У меня это есть",
      "iHaveThisHint": "Отправьте сообщение, чтобы сообщить, что у вас есть то, что они ищут",
      "editPost": "Редактировать объявление",
      "markFulfilled": "Отметить как выполненное",
      "renewPost": "Продлить объявление",
      "deletePost": "Удалить объявление",
      "backToMyPosts": "Назад к моим объявлениям о поиске"
    },
    "postedDate": "Опубликовано {date}",
    "updatedDate": "· Обновлено {date}",
    "notFound": {
      "title": "Объявление о поиске не найдено",
      "body": "Это объявление о поиске не существует или было удалено.",
      "browse": "Просмотреть объявления о поиске"
    },
    "deleteDialog": {
      "title": "Удалить объявление о поиске",
      "body": "Вы уверены, что хотите удалить это объявление о поиске? Это действие нельзя отменить.",
      "cancel": "Отмена",
      "confirm": "Удалить",
      "close": "закрыть"
    },
    "toast": { "errorTitle": "Ошибка", "contactError": "Не удалось начать разговор. Пожалуйста, попробуйте снова." },
    "seo": {
      "titleWithName": "{name} - Поиск - Classic Mini DIY",
      "titleDefault": "Объявление о поиске - Classic Mini DIY",
      "ogTitleDefault": "Объявление о поиске"
    }
  },
  "ja": {
    "breadcrumb": { "wanted": "募集投稿" },
    "user": "ユーザー",
    "anonymous": "匿名",
    "postedAgo": "{time}に投稿",
    "expiresOn": "{date}に期限切れ",
    "section": { "description": "説明", "budget": "予算", "location": "場所" },
    "label": { "posted": "投稿日", "expires": "期限" },
    "expiredSuffix": "(期限切れ)",
    "action": {
      "iHaveThis": "これを持っています",
      "iHaveThisHint": "探しているものをお持ちであることをメッセージで知らせましょう",
      "editPost": "投稿を編集",
      "markFulfilled": "達成済みにする",
      "renewPost": "投稿を更新",
      "deletePost": "投稿を削除",
      "backToMyPosts": "募集投稿一覧に戻る"
    },
    "postedDate": "{date}に投稿",
    "updatedDate": "· {date}に更新",
    "notFound": {
      "title": "募集投稿が見つかりません",
      "body": "この募集投稿は存在しないか、削除されました。",
      "browse": "募集投稿を見る"
    },
    "deleteDialog": {
      "title": "募集投稿を削除",
      "body": "この募集投稿を削除してもよろしいですか？この操作は元に戻せません。",
      "cancel": "キャンセル",
      "confirm": "削除",
      "close": "閉じる"
    },
    "toast": { "errorTitle": "エラー", "contactError": "会話を開始できませんでした。もう一度お試しください。" },
    "seo": {
      "titleWithName": "{name} - 募集 - Classic Mini DIY",
      "titleDefault": "募集投稿 - Classic Mini DIY",
      "ogTitleDefault": "募集投稿"
    }
  },
  "zh": {
    "breadcrumb": { "wanted": "求购信息" },
    "user": "用户",
    "anonymous": "匿名",
    "postedAgo": "发布于 {time}",
    "expiresOn": "{date} 到期",
    "section": { "description": "描述", "budget": "预算", "location": "位置" },
    "label": { "posted": "发布于", "expires": "到期" },
    "expiredSuffix": "(已过期)",
    "action": {
      "iHaveThis": "我有这个",
      "iHaveThisHint": "发送消息告诉他们你有他们想要的东西",
      "editPost": "编辑信息",
      "markFulfilled": "标记为已完成",
      "renewPost": "续期信息",
      "deletePost": "删除信息",
      "backToMyPosts": "返回我的求购信息"
    },
    "postedDate": "发布于 {date}",
    "updatedDate": "· 更新于 {date}",
    "notFound": {
      "title": "未找到求购信息",
      "body": "此求购信息不存在或已被删除。",
      "browse": "浏览求购信息"
    },
    "deleteDialog": {
      "title": "删除求购信息",
      "body": "确定要删除此求购信息吗？此操作无法撤销。",
      "cancel": "取消",
      "confirm": "删除",
      "close": "关闭"
    },
    "toast": { "errorTitle": "错误", "contactError": "无法开始对话。请重试。" },
    "seo": {
      "titleWithName": "{name} - 求购 - Classic Mini DIY",
      "titleDefault": "求购信息 - Classic Mini DIY",
      "ogTitleDefault": "求购信息"
    }
  },
  "ko": {
    "breadcrumb": { "wanted": "구함 게시물" },
    "user": "사용자",
    "anonymous": "익명",
    "postedAgo": "{time}에 게시됨",
    "expiresOn": "{date}에 만료",
    "section": { "description": "설명", "budget": "예산", "location": "위치" },
    "label": { "posted": "게시일", "expires": "만료" },
    "expiredSuffix": "(만료됨)",
    "action": {
      "iHaveThis": "제가 가지고 있어요",
      "iHaveThisHint": "찾고 있는 물건을 가지고 있다고 메시지를 보내세요",
      "editPost": "게시물 수정",
      "markFulfilled": "완료로 표시",
      "renewPost": "게시물 갱신",
      "deletePost": "게시물 삭제",
      "backToMyPosts": "내 구함 게시물로 돌아가기"
    },
    "postedDate": "{date}에 게시됨",
    "updatedDate": "· {date}에 업데이트됨",
    "notFound": {
      "title": "구함 게시물을 찾을 수 없습니다",
      "body": "이 구함 게시물은 존재하지 않거나 삭제되었습니다.",
      "browse": "구함 게시물 둘러보기"
    },
    "deleteDialog": {
      "title": "구함 게시물 삭제",
      "body": "이 구함 게시물을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
      "cancel": "취소",
      "confirm": "삭제",
      "close": "닫기"
    },
    "toast": { "errorTitle": "오류", "contactError": "대화를 시작하지 못했습니다. 다시 시도해 주세요." },
    "seo": {
      "titleWithName": "{name} - 구함 - Classic Mini DIY",
      "titleDefault": "구함 게시물 - Classic Mini DIY",
      "ogTitleDefault": "구함 게시물"
    }
  }
}
</i18n>
