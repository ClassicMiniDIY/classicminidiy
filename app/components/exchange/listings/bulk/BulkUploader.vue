<template>
  <div class="container py-8 max-w-5xl">
    <!-- Progress Steps -->
    <ul class="steps steps-horizontal w-full mb-8">
      <li class="step" :class="{ 'step-primary': currentStep >= 0 }">{{ t('steps.addListings') }}</li>
      <li class="step" :class="{ 'step-primary': currentStep >= 1 }">{{ t('steps.chooseTiers') }}</li>
      <li class="step" :class="{ 'step-primary': currentStep >= 2 }">{{ t('steps.review') }}</li>
      <li class="step" :class="{ 'step-primary': currentStep >= 3 }">{{ t('steps.done') }}</li>
    </ul>

    <!-- Step Title -->
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold mb-2">{{ steps[currentStep].title }}</h1>
      <p class="text-base-content/70">{{ steps[currentStep].description }}</p>
    </div>

    <!-- Step Content -->
    <div class="card bg-base-100 shadow-lg">
      <div class="card-body">
        <!-- Step 1: Add Listings -->
        <template v-if="currentStep === 0">
          <!-- Info Banner -->
          <div class="alert alert-info alert-soft mb-6">
            <i class="fas fa-circle-info"></i>
            <span>{{ t('infoBanner') }}</span>
          </div>

          <!-- Listing Rows -->
          <div class="space-y-3">
            <ExchangeListingsBulkListingRow
              v-for="(listing, index) in listings"
              :key="listing.id"
              v-model="listings[index]"
              :index="index"
              @remove="removeListing(index)"
            />
          </div>

          <!-- Add Listing Button -->
          <button type="button" class="btn btn-outline btn-primary btn-block mt-4" @click="addListing">
            <i class="fas fa-plus"></i>
            {{ t('addAnother') }}
          </button>

          <!-- Navigation -->
          <div class="flex justify-between pt-6 border-t border-base-300 mt-6">
            <NuxtLink to="/exchange/listings/new" class="btn btn-ghost">
              <i class="fas fa-arrow-left"></i>
              {{ t('singleListing') }}
            </NuxtLink>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="validListingsCount === 0"
              @click="goToTierSelection"
            >
              {{ t('continueToTiers') }}
              <i class="fas fa-arrow-right"></i>
            </button>
          </div>

          <!-- Validation Summary -->
          <div v-if="listings.length > 0" class="text-sm text-base-content/60 text-center mt-2">
            {{ t('listingsReady', { valid: validListingsCount, total: listings.length }) }}
          </div>
        </template>

        <!-- Step 2: Tier Selection -->
        <ExchangeListingsBulkTierSelection
          v-else-if="currentStep === 1"
          v-model="listings"
          @back="currentStep = 0"
          @next="currentStep = 2"
        />

        <!-- Step 3: Review & Submit -->
        <ExchangeListingsBulkReview
          v-else-if="currentStep === 2"
          :listings="listings"
          :submitting="submitting"
          :submission-progress="submissionProgress"
          @back="currentStep = 1"
          @submit="submitListings"
        />

        <!-- Step 4: Confirmation -->
        <ExchangeListingsBulkConfirmation
          v-else-if="currentStep === 3"
          :listings="listings"
          :has-premium="hasPremiumListings"
          :payment-url="paymentUrl"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { CurrencyCode } from '~/composables/useCurrency';
  import type { BulkListingItem } from '~/types/bulk';

  const { t } = useI18n();

  const toast = useToast();
  const { createListing } = useListings();
  const { uploadPhotos } = useListingPhotos();
  const { user, userProfile } = useAuth();
  const { capture } = usePostHog();
  const supabase = useSupabase();

  const steps = computed(() => [
    { title: t('stepTitles.add.title'), description: t('stepTitles.add.description') },
    { title: t('stepTitles.tiers.title'), description: t('stepTitles.tiers.description') },
    { title: t('stepTitles.review.title'), description: t('stepTitles.review.description') },
    { title: t('stepTitles.done.title'), description: t('stepTitles.done.description') },
  ]);

  const currentStep = ref(0);
  const submitting = ref(false);
  const submissionProgress = ref({ current: 0, total: 0 });
  const paymentUrl = ref<string | null>(null);

  // Initialize with user's preferred currency
  const defaultCurrency = computed<CurrencyCode>(() => {
    return (userProfile.value?.preferred_currency as CurrencyCode) || 'USD';
  });

  const createBlankListing = (): BulkListingItem => ({
    id: crypto.randomUUID(),
    title: '',
    price: null,
    currency: defaultCurrency.value,
    description: '',
    partCondition: '',
    partNumber: '',
    oemOrAftermarket: '',
    quantityAvailable: 1,
    fitsModels: [],
    parts_subcategory: '',
    shippingAvailable: false,
    shipsTo: '',
    tier: 'free',
    location: {
      city: '',
      state_province: '',
      country: '',
      postal_code: '',
      latitude: null,
      longitude: null,
      formatted_address: '',
    },
    photos: [],
    isValid: false,
    errors: {},
    isExpanded: true,
  });

  const listings = ref<BulkListingItem[]>([createBlankListing()]);

  // Sync currency when userProfile loads after component mount
  watch(() => userProfile.value?.preferred_currency, (newCurrency) => {
    if (newCurrency) {
      listings.value.forEach((l) => {
        // Only update untouched listings (no title yet, no price set)
        if (!l.title && l.price === null) l.currency = newCurrency as CurrencyCode;
      });
    }
  });

  const addListing = () => {
    // Collapse all existing
    listings.value.forEach((l) => (l.isExpanded = false));
    listings.value.push(createBlankListing());
  };

  const removeListing = (index: number) => {
    if (listings.value.length <= 1) {
      toast.add({ title: t('toast.cannotRemove.title'), description: t('toast.cannotRemove.description'), color: 'warning' });
      return;
    }
    listings.value.splice(index, 1);
  };

  const validateListing = (index: number) => {
    const listing = listings.value[index];
    const errors: Record<string, string> = {};

    if (!listing.title?.trim()) errors.title = t('errors.title');
    if (listing.price === null || listing.price === undefined || listing.price === ('') as any) {
      errors.price = t('errors.priceRequired');
    } else if (listing.price < 0) {
      errors.price = t('errors.priceNegative');
    }
    if (!listing.partCondition) errors.partCondition = t('errors.partCondition');
    if (!listing.description?.trim()) errors.description = t('errors.description');
    if (!listing.location.city?.trim()) errors.city = t('errors.city');
    if (listing.photos.length === 0) errors.photos = t('errors.photos');

    listing.errors = errors;
    listing.isValid = Object.keys(errors).length === 0;
  };

  const validListingsCount = computed(() => listings.value.filter((l) => l.isValid).length);

  const hasPremiumListings = computed(() => listings.value.some((l) => l.tier === 'paid'));

  const goToTierSelection = () => {
    // Validate all listings first
    listings.value.forEach((_, i) => validateListing(i));
    const invalidCount = listings.value.filter((l) => !l.isValid).length;

    if (invalidCount > 0) {
      toast.add({
        title: t('toast.fixErrors.title'),
        description: t('toast.fixErrors.description', { count: invalidCount }),
        color: 'error',
      });
      // Expand first invalid listing
      const firstInvalid = listings.value.find((l) => !l.isValid);
      if (firstInvalid) firstInvalid.isExpanded = true;
      return;
    }

    currentStep.value = 1;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitListings = async () => {
    if (!user.value) return;

    submitting.value = true;
    const total = listings.value.length;
    submissionProgress.value = { current: 0, total };

    try {
      for (let i = 0; i < listings.value.length; i++) {
        const listing = listings.value[i];
        submissionProgress.value.current = i + 1;

        // Determine status: free → pending, paid → draft (will activate after payment)
        const status = listing.tier === 'paid' ? 'draft' : 'pending';

        const listingData: any = {
          user_id: user.value.id,
          status,
          tier: listing.tier,
          listing_category: 'parts',
          title: listing.title.trim(),
          description: listing.description.trim(),
          price: listing.price,
          currency: listing.currency,
          model: listing.title.trim(),
          location: listing.location.city,
          city: listing.location.city,
          state_province: listing.location.state_province,
          country: listing.location.country,
          postal_code: listing.location.postal_code,
          latitude: listing.location.latitude,
          longitude: listing.location.longitude,
          formatted_address: listing.location.formatted_address || null,
          parts_subcategory: listing.parts_subcategory || null,
          part_number: listing.partNumber || null,
          part_condition: listing.partCondition || null,
          fits_models: listing.fitsModels.length > 0 ? [...listing.fitsModels] : null,
          oem_or_aftermarket: listing.oemOrAftermarket || null,
          quantity_available: listing.quantityAvailable,
          shipping_available: listing.shippingAvailable,
          ships_to: listing.shipsTo || null,
        };

        const created = await createListing(listingData);
        listing.createdListingId = created.id;

        // Upload photos
        if (listing.photos.length > 0) {
          const files = listing.photos.map((p) => p.file);
          await uploadPhotos(files, created.id, 'body');
        }
      }

      // Send submission emails for free listings (in parallel)
      const freeListings = listings.value.filter((l) => l.tier === 'free' && l.createdListingId);
      const userEmail = user.value?.email || userProfile.value?.email;

      const emailSession = await supabase.auth.getSession();
      const emailToken = emailSession.data.session?.access_token;
      await Promise.all(freeListings.map(async (listing) => {
        try {
          await $fetch('/api/exchange/listings/submit', {
            method: 'POST',
            body: {
              listingId: listing.createdListingId,
              userEmail,
              listingTitle: listing.title,
            },
            headers: emailToken ? { Authorization: `Bearer ${emailToken}` } : {},
          });
        } catch (emailError) {
          console.error('Failed to send submission email:', emailError);
        }
      }));

      // Handle premium listings payment
      const premiumListings = listings.value.filter((l) => l.tier === 'paid' && l.createdListingId);
      if (premiumListings.length > 0) {
        const listingIds = premiumListings.map((l) => l.createdListingId!);

        const authSession = await supabase.auth.getSession();
        const authToken = authSession.data.session?.access_token;
        const response = await $fetch<{ url?: string; comped?: boolean }>('/api/exchange/payments/checkout', {
          method: 'POST',
          body: {
            listingIds,
            tier: 'paid',
            successUrl: `${window.location.origin}/exchange/listings/payment/success?bulk=true`,
            cancelUrl: `${window.location.origin}/exchange/listings/payment/cancel?bulk=true`,
          },
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });

        // Sustaining Member comp: premium was granted free server-side (no Stripe
        // URL). Leave paymentUrl null so the confirmation step skips the "Pay Now"
        // affordance; otherwise surface the Stripe Checkout URL.
        paymentUrl.value = response.comped ? null : response.url ?? null;
      }

      // Track analytics
      capture('bulk_listings_submitted', {
        total_listings: listings.value.length,
        free_count: freeListings.length,
        premium_count: premiumListings.length,
      });

      // Go to confirmation
      currentStep.value = 3;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      console.error('Bulk submission error:', error);
      toast.add({
        title: t('toast.submissionError.title'),
        description: error.message || t('toast.submissionError.description'),
        color: 'error',
      });
    } finally {
      submitting.value = false;
    }
  };

  onMounted(() => {
    capture('bulk_upload_started', { source_page: 'direct' });
  });
</script>

<i18n lang="json">
{
  "en": {
    "steps": { "addListings": "Add Listings", "chooseTiers": "Choose Tiers", "review": "Review", "done": "Done" },
    "stepTitles": {
      "add": { "title": "Add Your Parts", "description": "Create multiple parts listings at once" },
      "tiers": { "title": "Choose Your Tiers", "description": "Select free or premium for each listing" },
      "review": { "title": "Review & Submit", "description": "Make sure everything looks good" },
      "done": { "title": "All Done!", "description": "Your listings have been submitted" }
    },
    "infoBanner": "Add multiple parts listings at once. Each listing needs a title, price, condition, description, location, and at least one photo.",
    "addAnother": "Add Another Listing",
    "singleListing": "Single Listing",
    "continueToTiers": "Continue to Tier Selection",
    "listingsReady": "{valid} of {total} listings ready",
    "errors": { "title": "Title is required", "priceRequired": "Price is required", "priceNegative": "Price cannot be negative", "partCondition": "Part condition is required", "description": "Description is required", "city": "Location is required", "photos": "At least one photo is required" },
    "toast": {
      "cannotRemove": { "title": "Cannot Remove", "description": "You need at least one listing" },
      "fixErrors": { "title": "Fix Errors", "description": "{count} listings have errors. Please fix them before continuing." },
      "submissionError": { "title": "Submission Error", "description": "Failed to submit listings. Some may have been created — check your dashboard." }
    }
  },
  "es": {
    "steps": { "addListings": "Agregar anuncios", "chooseTiers": "Elegir niveles", "review": "Revisar", "done": "Listo" },
    "stepTitles": {
      "add": { "title": "Agrega tus piezas", "description": "Crea varios anuncios de piezas a la vez" },
      "tiers": { "title": "Elige tus niveles", "description": "Selecciona gratis o premium para cada anuncio" },
      "review": { "title": "Revisar y enviar", "description": "Asegúrate de que todo esté correcto" },
      "done": { "title": "¡Todo listo!", "description": "Tus anuncios se han enviado" }
    },
    "infoBanner": "Agrega varios anuncios de piezas a la vez. Cada anuncio necesita un título, precio, condición, descripción, ubicación y al menos una foto.",
    "addAnother": "Agregar otro anuncio",
    "singleListing": "Anuncio individual",
    "continueToTiers": "Continuar a la selección de nivel",
    "listingsReady": "{valid} de {total} anuncios listos",
    "errors": { "title": "El título es obligatorio", "priceRequired": "El precio es obligatorio", "priceNegative": "El precio no puede ser negativo", "partCondition": "La condición de la pieza es obligatoria", "description": "La descripción es obligatoria", "city": "La ubicación es obligatoria", "photos": "Se requiere al menos una foto" },
    "toast": {
      "cannotRemove": { "title": "No se puede eliminar", "description": "Necesitas al menos un anuncio" },
      "fixErrors": { "title": "Corrige los errores", "description": "{count} anuncios tienen errores. Corrígelos antes de continuar." },
      "submissionError": { "title": "Error al enviar", "description": "No se pudieron enviar los anuncios. Algunos pueden haberse creado — revisa tu panel." }
    }
  },
  "fr": {
    "steps": { "addListings": "Ajouter des annonces", "chooseTiers": "Choisir les niveaux", "review": "Vérifier", "done": "Terminé" },
    "stepTitles": {
      "add": { "title": "Ajoutez vos pièces", "description": "Créez plusieurs annonces de pièces en une fois" },
      "tiers": { "title": "Choisissez vos niveaux", "description": "Sélectionnez gratuit ou premium pour chaque annonce" },
      "review": { "title": "Vérifier et soumettre", "description": "Assurez-vous que tout est correct" },
      "done": { "title": "Tout est terminé !", "description": "Vos annonces ont été soumises" }
    },
    "infoBanner": "Ajoutez plusieurs annonces de pièces en une fois. Chaque annonce nécessite un titre, un prix, un état, une description, une localisation et au moins une photo.",
    "addAnother": "Ajouter une autre annonce",
    "singleListing": "Annonce unique",
    "continueToTiers": "Continuer vers la sélection du niveau",
    "listingsReady": "{valid} sur {total} annonces prêtes",
    "errors": { "title": "Le titre est obligatoire", "priceRequired": "Le prix est obligatoire", "priceNegative": "Le prix ne peut pas être négatif", "partCondition": "L'état de la pièce est obligatoire", "description": "La description est obligatoire", "city": "La localisation est obligatoire", "photos": "Au moins une photo est requise" },
    "toast": {
      "cannotRemove": { "title": "Suppression impossible", "description": "Vous avez besoin d'au moins une annonce" },
      "fixErrors": { "title": "Corrigez les erreurs", "description": "{count} annonces comportent des erreurs. Veuillez les corriger avant de continuer." },
      "submissionError": { "title": "Erreur de soumission", "description": "Échec de la soumission des annonces. Certaines ont peut-être été créées — vérifiez votre tableau de bord." }
    }
  },
  "de": {
    "steps": { "addListings": "Anzeigen hinzufügen", "chooseTiers": "Stufen wählen", "review": "Prüfen", "done": "Fertig" },
    "stepTitles": {
      "add": { "title": "Fügen Sie Ihre Teile hinzu", "description": "Erstellen Sie mehrere Teile-Anzeigen auf einmal" },
      "tiers": { "title": "Wählen Sie Ihre Stufen", "description": "Wählen Sie für jede Anzeige kostenlos oder Premium" },
      "review": { "title": "Prüfen & Absenden", "description": "Stellen Sie sicher, dass alles korrekt ist" },
      "done": { "title": "Alles erledigt!", "description": "Ihre Anzeigen wurden eingereicht" }
    },
    "infoBanner": "Fügen Sie mehrere Teile-Anzeigen auf einmal hinzu. Jede Anzeige benötigt einen Titel, Preis, Zustand, Beschreibung, Standort und mindestens ein Foto.",
    "addAnother": "Weitere Anzeige hinzufügen",
    "singleListing": "Einzelanzeige",
    "continueToTiers": "Weiter zur Stufenauswahl",
    "listingsReady": "{valid} von {total} Anzeigen bereit",
    "errors": { "title": "Titel ist erforderlich", "priceRequired": "Preis ist erforderlich", "priceNegative": "Preis darf nicht negativ sein", "partCondition": "Teilezustand ist erforderlich", "description": "Beschreibung ist erforderlich", "city": "Standort ist erforderlich", "photos": "Mindestens ein Foto ist erforderlich" },
    "toast": {
      "cannotRemove": { "title": "Entfernen nicht möglich", "description": "Sie benötigen mindestens eine Anzeige" },
      "fixErrors": { "title": "Fehler beheben", "description": "{count} Anzeigen enthalten Fehler. Bitte beheben Sie sie, bevor Sie fortfahren." },
      "submissionError": { "title": "Übermittlungsfehler", "description": "Anzeigen konnten nicht übermittelt werden. Einige wurden möglicherweise erstellt — prüfen Sie Ihr Dashboard." }
    }
  },
  "it": {
    "steps": { "addListings": "Aggiungi annunci", "chooseTiers": "Scegli i livelli", "review": "Rivedi", "done": "Fatto" },
    "stepTitles": {
      "add": { "title": "Aggiungi i tuoi pezzi", "description": "Crea più annunci di pezzi in una volta" },
      "tiers": { "title": "Scegli i tuoi livelli", "description": "Seleziona gratis o premium per ogni annuncio" },
      "review": { "title": "Rivedi e invia", "description": "Assicurati che tutto sia corretto" },
      "done": { "title": "Tutto fatto!", "description": "I tuoi annunci sono stati inviati" }
    },
    "infoBanner": "Aggiungi più annunci di pezzi in una volta. Ogni annuncio richiede un titolo, prezzo, condizione, descrizione, posizione e almeno una foto.",
    "addAnother": "Aggiungi un altro annuncio",
    "singleListing": "Annuncio singolo",
    "continueToTiers": "Continua alla selezione del livello",
    "listingsReady": "{valid} di {total} annunci pronti",
    "errors": { "title": "Il titolo è obbligatorio", "priceRequired": "Il prezzo è obbligatorio", "priceNegative": "Il prezzo non può essere negativo", "partCondition": "La condizione del pezzo è obbligatoria", "description": "La descrizione è obbligatoria", "city": "La posizione è obbligatoria", "photos": "È richiesta almeno una foto" },
    "toast": {
      "cannotRemove": { "title": "Impossibile rimuovere", "description": "Hai bisogno di almeno un annuncio" },
      "fixErrors": { "title": "Correggi gli errori", "description": "{count} annunci contengono errori. Correggili prima di continuare." },
      "submissionError": { "title": "Errore di invio", "description": "Impossibile inviare gli annunci. Alcuni potrebbero essere stati creati — controlla la tua dashboard." }
    }
  },
  "pt": {
    "steps": { "addListings": "Adicionar anúncios", "chooseTiers": "Escolher níveis", "review": "Revisar", "done": "Concluído" },
    "stepTitles": {
      "add": { "title": "Adicione suas peças", "description": "Crie vários anúncios de peças de uma vez" },
      "tiers": { "title": "Escolha seus níveis", "description": "Selecione grátis ou premium para cada anúncio" },
      "review": { "title": "Revisar e enviar", "description": "Certifique-se de que está tudo certo" },
      "done": { "title": "Tudo pronto!", "description": "Seus anúncios foram enviados" }
    },
    "infoBanner": "Adicione vários anúncios de peças de uma vez. Cada anúncio precisa de um título, preço, condição, descrição, localização e pelo menos uma foto.",
    "addAnother": "Adicionar outro anúncio",
    "singleListing": "Anúncio individual",
    "continueToTiers": "Continuar para a seleção de nível",
    "listingsReady": "{valid} de {total} anúncios prontos",
    "errors": { "title": "O título é obrigatório", "priceRequired": "O preço é obrigatório", "priceNegative": "O preço não pode ser negativo", "partCondition": "A condição da peça é obrigatória", "description": "A descrição é obrigatória", "city": "A localização é obrigatória", "photos": "É necessária pelo menos uma foto" },
    "toast": {
      "cannotRemove": { "title": "Não é possível remover", "description": "Você precisa de pelo menos um anúncio" },
      "fixErrors": { "title": "Corrija os erros", "description": "{count} anúncios contêm erros. Corrija-os antes de continuar." },
      "submissionError": { "title": "Erro de envio", "description": "Falha ao enviar anúncios. Alguns podem ter sido criados — verifique seu painel." }
    }
  },
  "ru": {
    "steps": { "addListings": "Добавить объявления", "chooseTiers": "Выбрать уровни", "review": "Проверка", "done": "Готово" },
    "stepTitles": {
      "add": { "title": "Добавьте свои детали", "description": "Создайте несколько объявлений о деталях сразу" },
      "tiers": { "title": "Выберите уровни", "description": "Выберите бесплатный или премиум для каждого объявления" },
      "review": { "title": "Проверка и отправка", "description": "Убедитесь, что всё в порядке" },
      "done": { "title": "Всё готово!", "description": "Ваши объявления отправлены" }
    },
    "infoBanner": "Добавьте несколько объявлений о деталях сразу. Каждому объявлению нужны название, цена, состояние, описание, местоположение и хотя бы одна фотография.",
    "addAnother": "Добавить ещё объявление",
    "singleListing": "Одиночное объявление",
    "continueToTiers": "Перейти к выбору уровня",
    "listingsReady": "Готово объявлений: {valid} из {total}",
    "errors": { "title": "Название обязательно", "priceRequired": "Цена обязательна", "priceNegative": "Цена не может быть отрицательной", "partCondition": "Состояние детали обязательно", "description": "Описание обязательно", "city": "Местоположение обязательно", "photos": "Требуется хотя бы одна фотография" },
    "toast": {
      "cannotRemove": { "title": "Невозможно удалить", "description": "Нужно хотя бы одно объявление" },
      "fixErrors": { "title": "Исправьте ошибки", "description": "В {count} объявлениях есть ошибки. Исправьте их перед продолжением." },
      "submissionError": { "title": "Ошибка отправки", "description": "Не удалось отправить объявления. Некоторые могли быть созданы — проверьте свою панель." }
    }
  },
  "ja": {
    "steps": { "addListings": "出品を追加", "chooseTiers": "プランを選択", "review": "確認", "done": "完了" },
    "stepTitles": {
      "add": { "title": "部品を追加", "description": "複数の部品出品を一度に作成" },
      "tiers": { "title": "プランを選択", "description": "各出品に無料またはプレミアムを選択" },
      "review": { "title": "確認して送信", "description": "すべて問題ないか確認してください" },
      "done": { "title": "完了です！", "description": "出品が送信されました" }
    },
    "infoBanner": "複数の部品出品を一度に追加できます。各出品にはタイトル、価格、状態、説明、所在地、写真が少なくとも1枚必要です。",
    "addAnother": "別の出品を追加",
    "singleListing": "単一出品",
    "continueToTiers": "プラン選択に進む",
    "listingsReady": "{total}件中{valid}件の出品が準備完了",
    "errors": { "title": "タイトルは必須です", "priceRequired": "価格は必須です", "priceNegative": "価格を負の値にすることはできません", "partCondition": "部品の状態は必須です", "description": "説明は必須です", "city": "所在地は必須です", "photos": "写真が少なくとも1枚必要です" },
    "toast": {
      "cannotRemove": { "title": "削除できません", "description": "少なくとも1件の出品が必要です" },
      "fixErrors": { "title": "エラーを修正してください", "description": "{count}件の出品にエラーがあります。続行する前に修正してください。" },
      "submissionError": { "title": "送信エラー", "description": "出品の送信に失敗しました。一部は作成された可能性があります — ダッシュボードを確認してください。" }
    }
  },
  "zh": {
    "steps": { "addListings": "添加刊登", "chooseTiers": "选择级别", "review": "审核", "done": "完成" },
    "stepTitles": {
      "add": { "title": "添加您的零件", "description": "一次创建多个零件刊登" },
      "tiers": { "title": "选择您的级别", "description": "为每个刊登选择免费或高级" },
      "review": { "title": "审核并提交", "description": "确保一切无误" },
      "done": { "title": "全部完成！", "description": "您的刊登已提交" }
    },
    "infoBanner": "一次添加多个零件刊登。每个刊登需要标题、价格、状况、描述、位置以及至少一张照片。",
    "addAnother": "添加另一个刊登",
    "singleListing": "单个刊登",
    "continueToTiers": "继续选择级别",
    "listingsReady": "{total} 个刊登中已就绪 {valid} 个",
    "errors": { "title": "标题为必填项", "priceRequired": "价格为必填项", "priceNegative": "价格不能为负", "partCondition": "零件状况为必填项", "description": "描述为必填项", "city": "位置为必填项", "photos": "至少需要一张照片" },
    "toast": {
      "cannotRemove": { "title": "无法移除", "description": "您至少需要一个刊登" },
      "fixErrors": { "title": "修正错误", "description": "{count} 个刊登存在错误。请先修正再继续。" },
      "submissionError": { "title": "提交错误", "description": "提交刊登失败。部分可能已创建 — 请查看您的仪表板。" }
    }
  },
  "ko": {
    "steps": { "addListings": "매물 추가", "chooseTiers": "등급 선택", "review": "검토", "done": "완료" },
    "stepTitles": {
      "add": { "title": "부품 추가", "description": "여러 부품 매물을 한 번에 생성" },
      "tiers": { "title": "등급 선택", "description": "각 매물에 무료 또는 프리미엄 선택" },
      "review": { "title": "검토 및 제출", "description": "모든 내용이 올바른지 확인하세요" },
      "done": { "title": "모두 완료!", "description": "매물이 제출되었습니다" }
    },
    "infoBanner": "여러 부품 매물을 한 번에 추가하세요. 각 매물에는 제목, 가격, 상태, 설명, 위치 및 사진이 최소 한 장 필요합니다.",
    "addAnother": "다른 매물 추가",
    "singleListing": "단일 매물",
    "continueToTiers": "등급 선택으로 계속",
    "listingsReady": "{total}개 중 {valid}개 매물 준비됨",
    "errors": { "title": "제목은 필수입니다", "priceRequired": "가격은 필수입니다", "priceNegative": "가격은 음수일 수 없습니다", "partCondition": "부품 상태는 필수입니다", "description": "설명은 필수입니다", "city": "위치는 필수입니다", "photos": "사진이 최소 한 장 필요합니다" },
    "toast": {
      "cannotRemove": { "title": "제거할 수 없음", "description": "매물이 최소 한 개 필요합니다" },
      "fixErrors": { "title": "오류 수정", "description": "{count}개의 매물에 오류가 있습니다. 계속하기 전에 수정하세요." },
      "submissionError": { "title": "제출 오류", "description": "매물 제출에 실패했습니다. 일부는 생성되었을 수 있습니다 — 대시보드를 확인하세요." }
    }
  }
}
</i18n>
