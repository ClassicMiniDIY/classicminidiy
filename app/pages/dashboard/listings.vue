<template>
  <div>
    <!-- Page Header -->
    <section class="bg-base-100 border-b border-base-300 py-12">
      <div class="container">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 class="text-3xl font-bold">{{ t('header.title') }}</h1>
            <p class="text-base-content/70 mt-2">{{ t('header.subtitle') }}</p>
          </div>
          <div class="flex gap-2">
            <NuxtLink to="/exchange/listings/bulk" class="btn btn-outline btn-primary">
              <i class="fas fa-square-plus"></i>
              {{ t('header.bulkUpload') }}
            </NuxtLink>
            <NuxtLink to="/exchange/listings/new" class="btn btn-primary">
              <i class="fas fa-plus"></i>
              {{ t('header.newListing') }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- Listings Content -->
    <section class="py-12">
      <div class="container">
        <!-- Tabs for different listing states -->
        <div role="tablist" class="tabs tabs-box mb-8">
          <button
            v-for="tab in tabs"
            :key="tab.label"
            role="tab"
            class="tab"
            :class="{ 'tab-active': activeTab === tab.label }"
            @click="activeTab = tab.label"
          >
            <i :class="tab.icon" class="mr-2"></i>
            {{ t(`tabs.${tab.label}`) }}
          </button>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="i in 6" :key="i" class="skeleton h-80 w-full"></div>
        </div>

        <!-- Listings Grid -->
        <div v-else-if="filteredListings.length > 0" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="listing in filteredListings" :key="listing.id">
            <ExchangeListingsListingCard
              :listing="listing"
              :show-status-badge="true"
              :show-seller-info="false"
              :show-quick-actions="true"
              :show-analytics="listing.status === 'active'"
              :marking-sold="markingSoldId === listing.id"
              :deleting="deletingId === listing.id"
              :relisting="relistingId === listing.id"
              @mark-sold="handleMarkSold"
              @delete="handleDelete"
              @relist="openRelistModal"
            />
            <!-- Tracking button for sold listings with shipping -->
            <button
              v-if="listing.status === 'sold' && listing.shipping_available"
              class="btn btn-sm btn-outline w-full mt-2 gap-2"
              @click="openTrackingModal(listing)"
            >
              <i class="fas fa-truck"></i>
              {{ listing.tracking_number ? t('tracking.updateBtn') : t('tracking.addBtn') }}
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-16">
          <i class="fas fa-inbox text-6xl mx-auto mb-4 text-base-content/30 block"></i>
          <h3 class="text-xl font-semibold mb-2">{{ t('empty.title', { tab: t(`tabs.${activeTab}`) }) }}</h3>
          <p class="text-base-content/70 mb-6">
            <span v-if="activeTab === 'Active'">{{ t('empty.active') }}</span>
            <span v-else-if="activeTab === 'Pending'">{{ t('empty.pending') }}</span>
            <span v-else>{{ t('empty.other', { tab: t(`tabs.${activeTab}`).toLowerCase() }) }}</span>
          </p>
          <NuxtLink v-if="activeTab === 'Active'" to="/exchange/listings/new" class="btn btn-primary">{{
            t('empty.createFirst')
          }}</NuxtLink>
        </div>
      </div>
    </section>

    <!-- Mark as Sold Modal (enhanced with final price + buyer selection) -->
    <ExchangeListingsMarkSoldModal
      ref="markSoldModalRef"
      :listing="pendingListing"
      :saving="!!markingSoldId"
      @confirmed="confirmMarkSoldEnhanced"
    />
    <ExchangeConfirmDialog
      ref="deleteDialogRef"
      :title="t('deleteDialog.title')"
      :message="t('deleteDialog.message')"
      :confirm-text="t('deleteDialog.confirm')"
      confirm-color="error"
      @confirm="confirmDelete"
    />

    <!-- Tracking Number Modal -->
    <dialog ref="trackingModalRef" class="modal">
      <div class="modal-box">
        <h3 class="text-lg font-bold mb-4">{{ t('tracking.title') }}</h3>

        <div class="space-y-4">
          <!-- Tracking Number Input -->
          <fieldset class="fieldset">
            <legend class="fieldset-legend">{{ t('tracking.numberLabel') }}</legend>
            <input
              v-model="trackingNumber"
              type="text"
              class="input w-full"
              :placeholder="t('tracking.numberPlaceholder')"
              @input="onTrackingNumberChange"
            />
          </fieldset>

          <!-- Auto-detected Carrier -->
          <div v-if="detectedCarrier" class="flex items-center gap-2 text-sm text-success">
            <i class="fas fa-circle-check"></i>
            {{ t('tracking.detected') }} <strong>{{ detectedCarrier.name }}</strong>
          </div>

          <!-- Manual Carrier Selection -->
          <fieldset class="fieldset">
            <legend class="fieldset-legend">{{ t('tracking.carrierLabel') }}</legend>
            <select v-model="trackingCarrier" class="select w-full">
              <option value="">{{ t('tracking.carrierPlaceholder') }}</option>
              <option v-for="carrier in allCarriers" :key="carrier.id" :value="carrier.id">
                {{ carrier.name }}
              </option>
            </select>
          </fieldset>

          <!-- Tracking Link Preview -->
          <div v-if="trackingNumber && trackingCarrier" class="text-sm">
            <a
              :href="previewTrackingUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="link link-primary flex items-center gap-1"
            >
              <i class="fas fa-arrow-up-right-from-square"></i>
              {{ t('tracking.previewLink') }}
            </a>
          </div>
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" @click="closeTrackingModal">{{ t('cancel') }}</button>
          <button class="btn btn-primary" :disabled="!trackingNumber || savingTracking" @click="saveTracking">
            <span v-if="savingTracking" class="loading loading-spinner loading-xs"></span>
            {{ t('tracking.saveBtn') }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <!-- Relist Modal -->
    <dialog ref="relistModalRef" class="modal">
      <div class="modal-box">
        <h3 class="text-lg font-bold mb-4">{{ t('relistModal.title') }}</h3>

        <p class="text-base-content/70 mb-4">
          {{ t('relistModal.confirmPrefix') }} <strong>{{ pendingListing?.title }}</strong
          >{{ t('relistModal.confirmSuffix') }}
        </p>

        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('relistModal.priceLabel') }}</legend>
          <input
            v-model.number="relistPrice"
            type="number"
            class="input w-full"
            min="0"
            step="1"
            :placeholder="t('relistModal.pricePlaceholder')"
          />
          <p class="text-xs text-base-content/50 mt-1">{{ t('relistModal.priceHint') }}</p>
        </fieldset>

        <div class="modal-action">
          <button class="btn btn-ghost" @click="closeRelistModal">{{ t('cancel') }}</button>
          <button class="btn btn-primary" @click="confirmRelist">
            <i class="fas fa-arrows-rotate"></i>
            {{ t('relistModal.relistBtn') }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
  import type { ListingWithPhotos } from '~/composables/useListings';
  import { detectCarrier, getTrackingUrl, getAllCarriers } from '~/utils/shippingCarriers';

  const { t } = useI18n();

  // SEO metadata - noindex for user-specific pages
  useSeoMeta({
    title: () => t('seo.title'),
    robots: 'noindex, nofollow',
  });

  const { user } = useAuth();
  const supabase = useSupabase();
  const toast = useToast();
  const { capture } = usePostHog();

  const activeTab = ref('Active');
  const listings = ref<ListingWithPhotos[]>([]);
  const loading = ref(true);
  const markingSoldId = ref<string | null>(null);
  const deletingId = ref<string | null>(null);
  const relistingId = ref<string | null>(null);
  const relistModalRef = ref<HTMLDialogElement | null>(null);
  const relistPrice = ref<number | null>(null);
  const pendingListing = ref<ListingWithPhotos | null>(null);
  const markSoldModalRef = ref<{ show: () => void; close: () => void } | null>(null);
  const deleteDialogRef = ref<{ show: () => void; hide: () => void } | null>(null);

  // Tracking modal state
  const trackingModalRef = ref<HTMLDialogElement | null>(null);
  const trackingListing = ref<ListingWithPhotos | null>(null);
  const trackingNumber = ref('');
  const trackingCarrier = ref('');
  const savingTracking = ref(false);
  const allCarriers = getAllCarriers();

  const detectedCarrier = computed(() => {
    if (!trackingNumber.value) return null;
    return detectCarrier(trackingNumber.value);
  });

  const previewTrackingUrl = computed(() => {
    if (!trackingNumber.value || !trackingCarrier.value) return '';
    return getTrackingUrl(trackingCarrier.value, trackingNumber.value);
  });

  const onTrackingNumberChange = () => {
    const detected = detectCarrier(trackingNumber.value);
    if (detected) {
      trackingCarrier.value = detected.id;
    }
  };

  const openTrackingModal = (listing: ListingWithPhotos) => {
    trackingListing.value = listing;
    trackingNumber.value = listing.tracking_number || '';
    trackingCarrier.value = listing.tracking_carrier || '';
    trackingModalRef.value?.showModal();
  };

  const closeTrackingModal = () => {
    trackingModalRef.value?.close();
    trackingListing.value = null;
    trackingNumber.value = '';
    trackingCarrier.value = '';
  };

  const saveTracking = async () => {
    if (!trackingListing.value || !trackingNumber.value) return;

    savingTracking.value = true;
    try {
      const { error } = await supabase
        .from('listings')
        .update({
          tracking_number: trackingNumber.value.trim(),
          tracking_carrier: trackingCarrier.value || null,
        })
        .eq('id', trackingListing.value.id)
        .eq('user_id', user.value?.id);

      if (error) throw error;

      // Update local state
      const index = listings.value.findIndex((l) => l.id === trackingListing.value!.id);
      if (index !== -1) {
        listings.value[index].tracking_number = trackingNumber.value.trim();
        listings.value[index].tracking_carrier = trackingCarrier.value || null;
      }

      toast.add({
        title: t('toast.trackingUpdated.title'),
        description: t('toast.trackingUpdated.description'),
        color: 'success',
      });

      closeTrackingModal();
    } catch (error) {
      console.error('Failed to save tracking:', error);
      toast.add({
        title: t('toast.error'),
        description: t('toast.trackingError'),
        color: 'error',
      });
    } finally {
      savingTracking.value = false;
    }
  };

  const openRelistModal = (listing: ListingWithPhotos) => {
    pendingListing.value = listing;
    relistPrice.value = listing.price;
    relistModalRef.value?.showModal();
  };

  const closeRelistModal = () => {
    relistModalRef.value?.close();
    pendingListing.value = null;
    relistPrice.value = null;
  };

  const confirmRelist = async () => {
    if (!pendingListing.value) return;

    const listing = pendingListing.value;
    relistingId.value = listing.id;
    closeRelistModal();

    try {
      const { relistListing } = useListings();
      const priceChanged = relistPrice.value !== null && relistPrice.value !== listing.price;
      const updatedListing = await relistListing(
        listing.id,
        listing.status,
        listing.tier,
        priceChanged ? relistPrice.value! : undefined
      );

      // Replace local state with the returned listing from the database
      const index = listings.value.findIndex((l) => l.id === listing.id);
      if (index !== -1) {
        listings.value[index] = { ...listings.value[index], ...updatedListing };
      }

      toast.add({
        title: t('toast.relisted.title'),
        description: t('toast.relisted.description'),
        color: 'success',
      });
    } catch (error) {
      console.error('Failed to relist listing:', error);
      toast.add({
        title: t('toast.error'),
        description: t('toast.relistError'),
        color: 'error',
      });
    } finally {
      relistingId.value = null;
      pendingListing.value = null;
    }
  };

  const tabs = [
    {
      label: 'Active',
      icon: 'fas fa-circle-check',
    },
    {
      label: 'Pending',
      icon: 'fas fa-clock',
    },
    {
      label: 'Drafts',
      icon: 'fas fa-pen-to-square',
    },
    {
      label: 'Sold',
      icon: 'fas fa-dollar-sign',
    },
    {
      label: 'Expired',
      icon: 'fas fa-triangle-exclamation',
    },
    {
      label: 'Cancelled',
      icon: 'fas fa-circle-xmark',
    },
  ];

  // Filter listings based on active tab
  const filteredListings = computed(() => {
    const statusMap: Record<string, string> = {
      Active: 'active',
      Pending: 'pending',
      Drafts: 'draft',
      Sold: 'sold',
      Expired: 'expired',
      Cancelled: 'cancelled',
    };

    const status = statusMap[activeTab.value];
    return listings.value.filter((l) => l.status === status);
  });

  // Load user's listings
  const loadUserListings = async () => {
    if (!user.value) return;

    loading.value = true;
    try {
      const { data } = await applyPhotoOrdering(
        supabase
          .from('listings')
          .select(
            `
        *,
        listing_photos (
          id,
          storage_path,
          display_order,
          category,
          caption,
          is_primary
        ),
        profiles!listings_user_id_fkey (
          id,
          display_name,
          username,
          location,
          avatar_url
        )
      `
          )
          .eq('user_id', user.value.id)
          .order('created_at', { ascending: false })
      );

      listings.value = data || [];
    } catch (error) {
      console.error('Failed to load user listings:', error);
    } finally {
      loading.value = false;
    }
  };

  // Handle marking a listing as sold - show enhanced modal
  const handleMarkSold = (listing: ListingWithPhotos) => {
    pendingListing.value = listing;
    markSoldModalRef.value?.show();
  };

  // Confirm mark as sold (enhanced with final price + watcher notifications)
  const confirmMarkSoldEnhanced = async (data: {
    finalPrice: number | null;
    soldToUserId: string | null;
    notifyWatchers: boolean;
  }) => {
    if (!pendingListing.value) return;

    const listing = pendingListing.value;
    markingSoldId.value = listing.id;
    try {
      const soldDate = new Date().toISOString();
      const updateData: Record<string, any> = {
        status: 'sold',
        sold_date: soldDate,
      };

      if (data.finalPrice != null) {
        updateData.final_price = data.finalPrice;
      }

      const { error } = await supabase
        .from('listings')
        .update(updateData)
        .eq('id', listing.id)
        .eq('user_id', user.value?.id);

      if (error) throw error;

      // Update local state
      const index = listings.value.findIndex((l) => l.id === listing.id);
      if (index !== -1) {
        listings.value[index].status = 'sold';
        listings.value[index].sold_date = soldDate;
        if (data.finalPrice != null) {
          listings.value[index].final_price = data.finalPrice;
        }
      }

      // Track listing marked as sold
      const daysActive = Math.floor((Date.now() - new Date(listing.created_at).getTime()) / (1000 * 60 * 60 * 24));
      capture('listing_marked_sold', {
        listing_id: listing.id,
        days_active: daysActive,
        final_price: data.finalPrice,
        had_buyer_selected: !!data.soldToUserId,
      });

      // Fire-and-forget: notify watchers
      if (data.notifyWatchers) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (accessToken) {
          $fetch('/api/exchange/notifications/watchlist-sold', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: {
              listingId: listing.id,
              finalPrice: data.finalPrice,
            },
          }).catch((err) => console.error('Failed to notify watchers:', err));
        }
      }

      markSoldModalRef.value?.close();

      toast.add({
        title: t('toast.soldMarked.title'),
        description: data.notifyWatchers
          ? t('toast.soldMarked.descriptionNotify')
          : t('toast.soldMarked.description'),
        color: 'success',
      });
    } catch (error) {
      console.error('Failed to mark listing as sold:', error);
      toast.add({
        title: t('toast.error'),
        description: t('toast.soldError'),
        color: 'error',
      });
    } finally {
      markingSoldId.value = null;
      pendingListing.value = null;
    }
  };

  // Handle deleting a listing - show dialog
  const handleDelete = (listing: ListingWithPhotos) => {
    pendingListing.value = listing;
    deleteDialogRef.value?.show();
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!pendingListing.value) return;

    const listing = pendingListing.value;
    deletingId.value = listing.id;
    try {
      const { error } = await supabase.from('listings').delete().eq('id', listing.id).eq('user_id', user.value?.id);

      if (error) throw error;

      // Remove from local state
      listings.value = listings.value.filter((l) => l.id !== listing.id);

      // Track listing deletion
      capture('listing_deleted', {
        listing_id: listing.id,
      });

      toast.add({
        title: t('toast.deleted.title'),
        description: t('toast.deleted.description'),
        color: 'success',
      });
    } catch (error) {
      console.error('Failed to delete listing:', error);
      toast.add({
        title: t('toast.error'),
        description: t('toast.deleteError'),
        color: 'error',
      });
    } finally {
      deletingId.value = null;
      pendingListing.value = null;
    }
  };

  // Track dashboard view after listings finish loading
  watch(loading, (isLoading, wasLoading) => {
    if (wasLoading && !isLoading) {
      capture('dashboard_viewed', {
        active_count: listings.value.filter((l) => l.status === 'active').length,
        draft_count: listings.value.filter((l) => l.status === 'draft').length,
        sold_count: listings.value.filter((l) => l.status === 'sold').length,
      });
    }
  });

  // Refetch when navigating back to this page (e.g. returning from edit)
  const route = useRoute();
  watch(
    () => route.fullPath,
    (newPath) => {
      if (newPath === '/dashboard/listings') {
        loadUserListings();
      }
    }
  );

  onMounted(() => {
    loadUserListings();
  });
</script>

<i18n lang="json">
{
  "en": {
    "seo": { "title": "My Listings - The Mini Exchange" },
    "cancel": "Cancel",
    "header": {
      "title": "My Listings",
      "subtitle": "Manage your Classic Mini listings",
      "bulkUpload": "Bulk Upload",
      "newListing": "New Listing"
    },
    "tabs": { "Active": "Active", "Pending": "Pending", "Drafts": "Drafts", "Sold": "Sold", "Expired": "Expired", "Cancelled": "Cancelled" },
    "empty": {
      "title": "No {tab} Listings",
      "active": "Get started by posting your first Classic Mini listing",
      "pending": "You don't have any listings awaiting approval",
      "other": "You don't have any {tab} listings yet",
      "createFirst": "Create Your First Listing"
    },
    "tracking": {
      "title": "Shipping Tracking",
      "addBtn": "Add Tracking",
      "updateBtn": "Update Tracking",
      "numberLabel": "Tracking Number",
      "numberPlaceholder": "Enter tracking number",
      "detected": "Detected carrier:",
      "carrierLabel": "Carrier",
      "carrierPlaceholder": "Select carrier (or auto-detect)",
      "previewLink": "Preview tracking link",
      "saveBtn": "Save Tracking"
    },
    "deleteDialog": {
      "title": "Delete Listing",
      "message": "Are you sure you want to delete this listing? This action cannot be undone.",
      "confirm": "Delete"
    },
    "relistModal": {
      "title": "Relist Listing",
      "confirmPrefix": "Relist",
      "confirmSuffix": "? It will be made active again immediately.",
      "priceLabel": "Price",
      "pricePlaceholder": "Enter price",
      "priceHint": "Update the price or leave as-is",
      "relistBtn": "Relist"
    },
    "toast": {
      "error": "Error",
      "trackingUpdated": { "title": "Tracking Updated", "description": "Tracking information has been saved." },
      "trackingError": "Failed to save tracking information. Please try again.",
      "relisted": { "title": "Listing Relisted", "description": "Your listing is now active again." },
      "relistError": "Failed to relist listing. Please try again.",
      "soldMarked": {
        "title": "Listing Marked as Sold",
        "description": "Your listing has been moved to the Sold tab.",
        "descriptionNotify": "Your listing has been moved to the Sold tab. Watchers will be notified."
      },
      "soldError": "Failed to mark listing as sold. Please try again.",
      "deleted": { "title": "Listing Deleted", "description": "Your listing has been permanently deleted." },
      "deleteError": "Failed to delete listing. Please try again."
    }
  },
  "es": {
    "seo": { "title": "Mis anuncios - The Mini Exchange" },
    "cancel": "Cancelar",
    "header": {
      "title": "Mis anuncios",
      "subtitle": "Gestiona tus anuncios de Classic Mini",
      "bulkUpload": "Carga masiva",
      "newListing": "Nuevo anuncio"
    },
    "tabs": { "Active": "Activos", "Pending": "Pendientes", "Drafts": "Borradores", "Sold": "Vendidos", "Expired": "Caducados", "Cancelled": "Cancelados" },
    "empty": {
      "title": "No hay anuncios en {tab}",
      "active": "Empieza publicando tu primer anuncio de Classic Mini",
      "pending": "No tienes anuncios pendientes de aprobación",
      "other": "Aún no tienes anuncios en {tab}",
      "createFirst": "Crea tu primer anuncio"
    },
    "tracking": {
      "title": "Seguimiento de envío",
      "addBtn": "Añadir seguimiento",
      "updateBtn": "Actualizar seguimiento",
      "numberLabel": "Número de seguimiento",
      "numberPlaceholder": "Introduce el número de seguimiento",
      "detected": "Transportista detectado:",
      "carrierLabel": "Transportista",
      "carrierPlaceholder": "Selecciona transportista (o detección automática)",
      "previewLink": "Vista previa del enlace de seguimiento",
      "saveBtn": "Guardar seguimiento"
    },
    "deleteDialog": {
      "title": "Eliminar anuncio",
      "message": "¿Seguro que quieres eliminar este anuncio? Esta acción no se puede deshacer.",
      "confirm": "Eliminar"
    },
    "relistModal": {
      "title": "Volver a publicar anuncio",
      "confirmPrefix": "¿Volver a publicar",
      "confirmSuffix": "? Se activará de nuevo inmediatamente.",
      "priceLabel": "Precio",
      "pricePlaceholder": "Introduce el precio",
      "priceHint": "Actualiza el precio o déjalo igual",
      "relistBtn": "Volver a publicar"
    },
    "toast": {
      "error": "Error",
      "trackingUpdated": { "title": "Seguimiento actualizado", "description": "La información de seguimiento se ha guardado." },
      "trackingError": "No se pudo guardar la información de seguimiento. Inténtalo de nuevo.",
      "relisted": { "title": "Anuncio republicado", "description": "Tu anuncio vuelve a estar activo." },
      "relistError": "No se pudo volver a publicar el anuncio. Inténtalo de nuevo.",
      "soldMarked": {
        "title": "Anuncio marcado como vendido",
        "description": "Tu anuncio se ha movido a la pestaña Vendidos.",
        "descriptionNotify": "Tu anuncio se ha movido a la pestaña Vendidos. Se notificará a los seguidores."
      },
      "soldError": "No se pudo marcar el anuncio como vendido. Inténtalo de nuevo.",
      "deleted": { "title": "Anuncio eliminado", "description": "Tu anuncio se ha eliminado permanentemente." },
      "deleteError": "No se pudo eliminar el anuncio. Inténtalo de nuevo."
    }
  },
  "fr": {
    "seo": { "title": "Mes annonces - The Mini Exchange" },
    "cancel": "Annuler",
    "header": {
      "title": "Mes annonces",
      "subtitle": "Gérez vos annonces Classic Mini",
      "bulkUpload": "Import groupé",
      "newListing": "Nouvelle annonce"
    },
    "tabs": { "Active": "Actives", "Pending": "En attente", "Drafts": "Brouillons", "Sold": "Vendues", "Expired": "Expirées", "Cancelled": "Annulées" },
    "empty": {
      "title": "Aucune annonce {tab}",
      "active": "Commencez par publier votre première annonce Classic Mini",
      "pending": "Vous n'avez aucune annonce en attente d'approbation",
      "other": "Vous n'avez encore aucune annonce {tab}",
      "createFirst": "Créez votre première annonce"
    },
    "tracking": {
      "title": "Suivi de livraison",
      "addBtn": "Ajouter un suivi",
      "updateBtn": "Mettre à jour le suivi",
      "numberLabel": "Numéro de suivi",
      "numberPlaceholder": "Saisissez le numéro de suivi",
      "detected": "Transporteur détecté :",
      "carrierLabel": "Transporteur",
      "carrierPlaceholder": "Sélectionnez un transporteur (ou détection automatique)",
      "previewLink": "Aperçu du lien de suivi",
      "saveBtn": "Enregistrer le suivi"
    },
    "deleteDialog": {
      "title": "Supprimer l'annonce",
      "message": "Êtes-vous sûr de vouloir supprimer cette annonce ? Cette action est irréversible.",
      "confirm": "Supprimer"
    },
    "relistModal": {
      "title": "Republier l'annonce",
      "confirmPrefix": "Republier",
      "confirmSuffix": " ? Elle redeviendra active immédiatement.",
      "priceLabel": "Prix",
      "pricePlaceholder": "Saisissez le prix",
      "priceHint": "Mettez à jour le prix ou laissez-le tel quel",
      "relistBtn": "Republier"
    },
    "toast": {
      "error": "Erreur",
      "trackingUpdated": { "title": "Suivi mis à jour", "description": "Les informations de suivi ont été enregistrées." },
      "trackingError": "Échec de l'enregistrement des informations de suivi. Veuillez réessayer.",
      "relisted": { "title": "Annonce republiée", "description": "Votre annonce est de nouveau active." },
      "relistError": "Échec de la republication de l'annonce. Veuillez réessayer.",
      "soldMarked": {
        "title": "Annonce marquée comme vendue",
        "description": "Votre annonce a été déplacée vers l'onglet Vendues.",
        "descriptionNotify": "Votre annonce a été déplacée vers l'onglet Vendues. Les abonnés seront notifiés."
      },
      "soldError": "Échec du marquage de l'annonce comme vendue. Veuillez réessayer.",
      "deleted": { "title": "Annonce supprimée", "description": "Votre annonce a été définitivement supprimée." },
      "deleteError": "Échec de la suppression de l'annonce. Veuillez réessayer."
    }
  },
  "de": {
    "seo": { "title": "Meine Anzeigen - The Mini Exchange" },
    "cancel": "Abbrechen",
    "header": {
      "title": "Meine Anzeigen",
      "subtitle": "Verwalte deine Classic-Mini-Anzeigen",
      "bulkUpload": "Massen-Upload",
      "newListing": "Neue Anzeige"
    },
    "tabs": { "Active": "Aktiv", "Pending": "Ausstehend", "Drafts": "Entwürfe", "Sold": "Verkauft", "Expired": "Abgelaufen", "Cancelled": "Storniert" },
    "empty": {
      "title": "Keine Anzeigen in {tab}",
      "active": "Leg los und veröffentliche deine erste Classic-Mini-Anzeige",
      "pending": "Du hast keine Anzeigen, die auf Genehmigung warten",
      "other": "Du hast noch keine Anzeigen in {tab}",
      "createFirst": "Erstelle deine erste Anzeige"
    },
    "tracking": {
      "title": "Sendungsverfolgung",
      "addBtn": "Tracking hinzufügen",
      "updateBtn": "Tracking aktualisieren",
      "numberLabel": "Sendungsnummer",
      "numberPlaceholder": "Sendungsnummer eingeben",
      "detected": "Erkannter Versanddienst:",
      "carrierLabel": "Versanddienst",
      "carrierPlaceholder": "Versanddienst auswählen (oder automatisch erkennen)",
      "previewLink": "Tracking-Link-Vorschau",
      "saveBtn": "Tracking speichern"
    },
    "deleteDialog": {
      "title": "Anzeige löschen",
      "message": "Möchtest du diese Anzeige wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
      "confirm": "Löschen"
    },
    "relistModal": {
      "title": "Anzeige erneut einstellen",
      "confirmPrefix": "Erneut einstellen:",
      "confirmSuffix": "? Sie wird sofort wieder aktiviert.",
      "priceLabel": "Preis",
      "pricePlaceholder": "Preis eingeben",
      "priceHint": "Aktualisiere den Preis oder lass ihn unverändert",
      "relistBtn": "Erneut einstellen"
    },
    "toast": {
      "error": "Fehler",
      "trackingUpdated": { "title": "Tracking aktualisiert", "description": "Die Tracking-Informationen wurden gespeichert." },
      "trackingError": "Tracking-Informationen konnten nicht gespeichert werden. Bitte versuche es erneut.",
      "relisted": { "title": "Anzeige erneut eingestellt", "description": "Deine Anzeige ist jetzt wieder aktiv." },
      "relistError": "Anzeige konnte nicht erneut eingestellt werden. Bitte versuche es erneut.",
      "soldMarked": {
        "title": "Anzeige als verkauft markiert",
        "description": "Deine Anzeige wurde in den Tab Verkauft verschoben.",
        "descriptionNotify": "Deine Anzeige wurde in den Tab Verkauft verschoben. Beobachter werden benachrichtigt."
      },
      "soldError": "Anzeige konnte nicht als verkauft markiert werden. Bitte versuche es erneut.",
      "deleted": { "title": "Anzeige gelöscht", "description": "Deine Anzeige wurde dauerhaft gelöscht." },
      "deleteError": "Anzeige konnte nicht gelöscht werden. Bitte versuche es erneut."
    }
  },
  "it": {
    "seo": { "title": "I miei annunci - The Mini Exchange" },
    "cancel": "Annulla",
    "header": {
      "title": "I miei annunci",
      "subtitle": "Gestisci i tuoi annunci Classic Mini",
      "bulkUpload": "Caricamento in blocco",
      "newListing": "Nuovo annuncio"
    },
    "tabs": { "Active": "Attivi", "Pending": "In attesa", "Drafts": "Bozze", "Sold": "Venduti", "Expired": "Scaduti", "Cancelled": "Annullati" },
    "empty": {
      "title": "Nessun annuncio in {tab}",
      "active": "Inizia pubblicando il tuo primo annuncio Classic Mini",
      "pending": "Non hai annunci in attesa di approvazione",
      "other": "Non hai ancora annunci in {tab}",
      "createFirst": "Crea il tuo primo annuncio"
    },
    "tracking": {
      "title": "Tracciamento spedizione",
      "addBtn": "Aggiungi tracciamento",
      "updateBtn": "Aggiorna tracciamento",
      "numberLabel": "Numero di tracciamento",
      "numberPlaceholder": "Inserisci il numero di tracciamento",
      "detected": "Corriere rilevato:",
      "carrierLabel": "Corriere",
      "carrierPlaceholder": "Seleziona il corriere (o rilevamento automatico)",
      "previewLink": "Anteprima del link di tracciamento",
      "saveBtn": "Salva tracciamento"
    },
    "deleteDialog": {
      "title": "Elimina annuncio",
      "message": "Sei sicuro di voler eliminare questo annuncio? Questa azione non può essere annullata.",
      "confirm": "Elimina"
    },
    "relistModal": {
      "title": "Ripubblica annuncio",
      "confirmPrefix": "Ripubblicare",
      "confirmSuffix": "? Tornerà attivo immediatamente.",
      "priceLabel": "Prezzo",
      "pricePlaceholder": "Inserisci il prezzo",
      "priceHint": "Aggiorna il prezzo o lascialo invariato",
      "relistBtn": "Ripubblica"
    },
    "toast": {
      "error": "Errore",
      "trackingUpdated": { "title": "Tracciamento aggiornato", "description": "Le informazioni di tracciamento sono state salvate." },
      "trackingError": "Impossibile salvare le informazioni di tracciamento. Riprova.",
      "relisted": { "title": "Annuncio ripubblicato", "description": "Il tuo annuncio è di nuovo attivo." },
      "relistError": "Impossibile ripubblicare l'annuncio. Riprova.",
      "soldMarked": {
        "title": "Annuncio segnato come venduto",
        "description": "Il tuo annuncio è stato spostato nella scheda Venduti.",
        "descriptionNotify": "Il tuo annuncio è stato spostato nella scheda Venduti. Gli osservatori saranno avvisati."
      },
      "soldError": "Impossibile segnare l'annuncio come venduto. Riprova.",
      "deleted": { "title": "Annuncio eliminato", "description": "Il tuo annuncio è stato eliminato definitivamente." },
      "deleteError": "Impossibile eliminare l'annuncio. Riprova."
    }
  },
  "pt": {
    "seo": { "title": "Meus anúncios - The Mini Exchange" },
    "cancel": "Cancelar",
    "header": {
      "title": "Meus anúncios",
      "subtitle": "Gerencie seus anúncios de Classic Mini",
      "bulkUpload": "Envio em massa",
      "newListing": "Novo anúncio"
    },
    "tabs": { "Active": "Ativos", "Pending": "Pendentes", "Drafts": "Rascunhos", "Sold": "Vendidos", "Expired": "Expirados", "Cancelled": "Cancelados" },
    "empty": {
      "title": "Nenhum anúncio em {tab}",
      "active": "Comece publicando seu primeiro anúncio de Classic Mini",
      "pending": "Você não tem anúncios aguardando aprovação",
      "other": "Você ainda não tem anúncios em {tab}",
      "createFirst": "Crie seu primeiro anúncio"
    },
    "tracking": {
      "title": "Rastreamento de envio",
      "addBtn": "Adicionar rastreamento",
      "updateBtn": "Atualizar rastreamento",
      "numberLabel": "Número de rastreamento",
      "numberPlaceholder": "Insira o número de rastreamento",
      "detected": "Transportadora detectada:",
      "carrierLabel": "Transportadora",
      "carrierPlaceholder": "Selecione a transportadora (ou detecção automática)",
      "previewLink": "Visualizar link de rastreamento",
      "saveBtn": "Salvar rastreamento"
    },
    "deleteDialog": {
      "title": "Excluir anúncio",
      "message": "Tem certeza de que deseja excluir este anúncio? Esta ação não pode ser desfeita.",
      "confirm": "Excluir"
    },
    "relistModal": {
      "title": "Republicar anúncio",
      "confirmPrefix": "Republicar",
      "confirmSuffix": "? Ele ficará ativo novamente imediatamente.",
      "priceLabel": "Preço",
      "pricePlaceholder": "Insira o preço",
      "priceHint": "Atualize o preço ou mantenha como está",
      "relistBtn": "Republicar"
    },
    "toast": {
      "error": "Erro",
      "trackingUpdated": { "title": "Rastreamento atualizado", "description": "As informações de rastreamento foram salvas." },
      "trackingError": "Falha ao salvar as informações de rastreamento. Tente novamente.",
      "relisted": { "title": "Anúncio republicado", "description": "Seu anúncio está ativo novamente." },
      "relistError": "Falha ao republicar o anúncio. Tente novamente.",
      "soldMarked": {
        "title": "Anúncio marcado como vendido",
        "description": "Seu anúncio foi movido para a aba Vendidos.",
        "descriptionNotify": "Seu anúncio foi movido para a aba Vendidos. Os observadores serão notificados."
      },
      "soldError": "Falha ao marcar o anúncio como vendido. Tente novamente.",
      "deleted": { "title": "Anúncio excluído", "description": "Seu anúncio foi excluído permanentemente." },
      "deleteError": "Falha ao excluir o anúncio. Tente novamente."
    }
  },
  "ru": {
    "seo": { "title": "Мои объявления - The Mini Exchange" },
    "cancel": "Отмена",
    "header": {
      "title": "Мои объявления",
      "subtitle": "Управляйте своими объявлениями Classic Mini",
      "bulkUpload": "Массовая загрузка",
      "newListing": "Новое объявление"
    },
    "tabs": { "Active": "Активные", "Pending": "На рассмотрении", "Drafts": "Черновики", "Sold": "Проданные", "Expired": "Истёкшие", "Cancelled": "Отменённые" },
    "empty": {
      "title": "Нет объявлений в разделе «{tab}»",
      "active": "Начните с публикации вашего первого объявления Classic Mini",
      "pending": "У вас нет объявлений, ожидающих одобрения",
      "other": "У вас пока нет объявлений в разделе «{tab}»",
      "createFirst": "Создайте своё первое объявление"
    },
    "tracking": {
      "title": "Отслеживание доставки",
      "addBtn": "Добавить отслеживание",
      "updateBtn": "Обновить отслеживание",
      "numberLabel": "Трек-номер",
      "numberPlaceholder": "Введите трек-номер",
      "detected": "Обнаружен перевозчик:",
      "carrierLabel": "Перевозчик",
      "carrierPlaceholder": "Выберите перевозчика (или автоопределение)",
      "previewLink": "Предпросмотр ссылки отслеживания",
      "saveBtn": "Сохранить отслеживание"
    },
    "deleteDialog": {
      "title": "Удалить объявление",
      "message": "Вы уверены, что хотите удалить это объявление? Это действие нельзя отменить.",
      "confirm": "Удалить"
    },
    "relistModal": {
      "title": "Опубликовать объявление снова",
      "confirmPrefix": "Опубликовать снова",
      "confirmSuffix": "? Оно сразу же станет активным.",
      "priceLabel": "Цена",
      "pricePlaceholder": "Введите цену",
      "priceHint": "Обновите цену или оставьте как есть",
      "relistBtn": "Опубликовать снова"
    },
    "toast": {
      "error": "Ошибка",
      "trackingUpdated": { "title": "Отслеживание обновлено", "description": "Информация об отслеживании сохранена." },
      "trackingError": "Не удалось сохранить информацию об отслеживании. Попробуйте ещё раз.",
      "relisted": { "title": "Объявление опубликовано снова", "description": "Ваше объявление снова активно." },
      "relistError": "Не удалось опубликовать объявление снова. Попробуйте ещё раз.",
      "soldMarked": {
        "title": "Объявление отмечено как проданное",
        "description": "Ваше объявление перемещено во вкладку «Проданные».",
        "descriptionNotify": "Ваше объявление перемещено во вкладку «Проданные». Наблюдатели будут уведомлены."
      },
      "soldError": "Не удалось отметить объявление как проданное. Попробуйте ещё раз.",
      "deleted": { "title": "Объявление удалено", "description": "Ваше объявление удалено навсегда." },
      "deleteError": "Не удалось удалить объявление. Попробуйте ещё раз."
    }
  },
  "ja": {
    "seo": { "title": "マイ出品 - The Mini Exchange" },
    "cancel": "キャンセル",
    "header": {
      "title": "マイ出品",
      "subtitle": "あなたのClassic Mini出品を管理",
      "bulkUpload": "一括アップロード",
      "newListing": "新規出品"
    },
    "tabs": { "Active": "公開中", "Pending": "承認待ち", "Drafts": "下書き", "Sold": "売却済み", "Expired": "期限切れ", "Cancelled": "キャンセル済み" },
    "empty": {
      "title": "{tab}の出品はありません",
      "active": "最初のClassic Mini出品を投稿して始めましょう",
      "pending": "承認待ちの出品はありません",
      "other": "まだ{tab}の出品はありません",
      "createFirst": "最初の出品を作成"
    },
    "tracking": {
      "title": "配送追跡",
      "addBtn": "追跡を追加",
      "updateBtn": "追跡を更新",
      "numberLabel": "追跡番号",
      "numberPlaceholder": "追跡番号を入力",
      "detected": "検出された配送業者：",
      "carrierLabel": "配送業者",
      "carrierPlaceholder": "配送業者を選択（または自動検出）",
      "previewLink": "追跡リンクをプレビュー",
      "saveBtn": "追跡を保存"
    },
    "deleteDialog": {
      "title": "出品を削除",
      "message": "この出品を削除してもよろしいですか？この操作は元に戻せません。",
      "confirm": "削除"
    },
    "relistModal": {
      "title": "出品を再出品",
      "confirmPrefix": "再出品しますか：",
      "confirmSuffix": "？すぐに再び公開されます。",
      "priceLabel": "価格",
      "pricePlaceholder": "価格を入力",
      "priceHint": "価格を更新するか、そのままにしてください",
      "relistBtn": "再出品"
    },
    "toast": {
      "error": "エラー",
      "trackingUpdated": { "title": "追跡を更新しました", "description": "追跡情報が保存されました。" },
      "trackingError": "追跡情報を保存できませんでした。もう一度お試しください。",
      "relisted": { "title": "出品を再出品しました", "description": "あなたの出品は再び公開されています。" },
      "relistError": "出品を再出品できませんでした。もう一度お試しください。",
      "soldMarked": {
        "title": "出品を売却済みにしました",
        "description": "あなたの出品は売却済みタブに移動しました。",
        "descriptionNotify": "あなたの出品は売却済みタブに移動しました。ウォッチャーに通知されます。"
      },
      "soldError": "出品を売却済みにできませんでした。もう一度お試しください。",
      "deleted": { "title": "出品を削除しました", "description": "あなたの出品は完全に削除されました。" },
      "deleteError": "出品を削除できませんでした。もう一度お試しください。"
    }
  },
  "zh": {
    "seo": { "title": "我的刊登 - The Mini Exchange" },
    "cancel": "取消",
    "header": {
      "title": "我的刊登",
      "subtitle": "管理你的经典Mini刊登",
      "bulkUpload": "批量上传",
      "newListing": "新建刊登"
    },
    "tabs": { "Active": "进行中", "Pending": "待审核", "Drafts": "草稿", "Sold": "已售", "Expired": "已过期", "Cancelled": "已取消" },
    "empty": {
      "title": "没有{tab}的刊登",
      "active": "发布你的第一个经典Mini刊登来开始吧",
      "pending": "你没有等待审核的刊登",
      "other": "你还没有{tab}的刊登",
      "createFirst": "创建你的第一个刊登"
    },
    "tracking": {
      "title": "物流追踪",
      "addBtn": "添加追踪",
      "updateBtn": "更新追踪",
      "numberLabel": "追踪单号",
      "numberPlaceholder": "输入追踪单号",
      "detected": "检测到的承运商：",
      "carrierLabel": "承运商",
      "carrierPlaceholder": "选择承运商（或自动检测）",
      "previewLink": "预览追踪链接",
      "saveBtn": "保存追踪"
    },
    "deleteDialog": {
      "title": "删除刊登",
      "message": "确定要删除此刊登吗？此操作无法撤销。",
      "confirm": "删除"
    },
    "relistModal": {
      "title": "重新刊登",
      "confirmPrefix": "重新刊登",
      "confirmSuffix": "？它将立即重新生效。",
      "priceLabel": "价格",
      "pricePlaceholder": "输入价格",
      "priceHint": "更新价格或保持不变",
      "relistBtn": "重新刊登"
    },
    "toast": {
      "error": "错误",
      "trackingUpdated": { "title": "追踪已更新", "description": "追踪信息已保存。" },
      "trackingError": "保存追踪信息失败。请重试。",
      "relisted": { "title": "刊登已重新发布", "description": "你的刊登现已重新生效。" },
      "relistError": "重新刊登失败。请重试。",
      "soldMarked": {
        "title": "刊登已标记为已售",
        "description": "你的刊登已移至已售标签。",
        "descriptionNotify": "你的刊登已移至已售标签。将通知关注者。"
      },
      "soldError": "标记刊登为已售失败。请重试。",
      "deleted": { "title": "刊登已删除", "description": "你的刊登已被永久删除。" },
      "deleteError": "删除刊登失败。请重试。"
    }
  },
  "ko": {
    "seo": { "title": "내 매물 - The Mini Exchange" },
    "cancel": "취소",
    "header": {
      "title": "내 매물",
      "subtitle": "당신의 클래식 미니 매물을 관리하세요",
      "bulkUpload": "일괄 업로드",
      "newListing": "새 매물"
    },
    "tabs": { "Active": "활성", "Pending": "대기 중", "Drafts": "초안", "Sold": "판매됨", "Expired": "만료됨", "Cancelled": "취소됨" },
    "empty": {
      "title": "{tab} 매물이 없습니다",
      "active": "첫 클래식 미니 매물을 등록하여 시작하세요",
      "pending": "승인 대기 중인 매물이 없습니다",
      "other": "아직 {tab} 매물이 없습니다",
      "createFirst": "첫 매물 만들기"
    },
    "tracking": {
      "title": "배송 추적",
      "addBtn": "추적 추가",
      "updateBtn": "추적 업데이트",
      "numberLabel": "추적 번호",
      "numberPlaceholder": "추적 번호 입력",
      "detected": "감지된 배송업체:",
      "carrierLabel": "배송업체",
      "carrierPlaceholder": "배송업체 선택 (또는 자동 감지)",
      "previewLink": "추적 링크 미리보기",
      "saveBtn": "추적 저장"
    },
    "deleteDialog": {
      "title": "매물 삭제",
      "message": "이 매물을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
      "confirm": "삭제"
    },
    "relistModal": {
      "title": "매물 다시 등록",
      "confirmPrefix": "다시 등록하시겠습니까:",
      "confirmSuffix": "? 즉시 다시 활성화됩니다.",
      "priceLabel": "가격",
      "pricePlaceholder": "가격 입력",
      "priceHint": "가격을 업데이트하거나 그대로 두세요",
      "relistBtn": "다시 등록"
    },
    "toast": {
      "error": "오류",
      "trackingUpdated": { "title": "추적 업데이트됨", "description": "추적 정보가 저장되었습니다." },
      "trackingError": "추적 정보를 저장하지 못했습니다. 다시 시도하세요.",
      "relisted": { "title": "매물 다시 등록됨", "description": "매물이 다시 활성화되었습니다." },
      "relistError": "매물을 다시 등록하지 못했습니다. 다시 시도하세요.",
      "soldMarked": {
        "title": "매물이 판매됨으로 표시됨",
        "description": "매물이 판매됨 탭으로 이동되었습니다.",
        "descriptionNotify": "매물이 판매됨 탭으로 이동되었습니다. 관심 등록자에게 알림이 전송됩니다."
      },
      "soldError": "매물을 판매됨으로 표시하지 못했습니다. 다시 시도하세요.",
      "deleted": { "title": "매물 삭제됨", "description": "매물이 영구적으로 삭제되었습니다." },
      "deleteError": "매물을 삭제하지 못했습니다. 다시 시도하세요."
    }
  }
}
</i18n>
