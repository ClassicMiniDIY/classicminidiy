<template>
  <div class="container py-8 max-w-4xl">
    <!-- Loading Draft State -->
    <div v-if="loadingDraft" class="text-center py-20">
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <p class="mt-4 text-base-content/70">{{ t('loadingDraft') }}</p>
    </div>

    <template v-else>
      <!-- Progress Indicator -->
      <ExchangeListingsWizardProgress :steps="visibleSteps" :current-step="visibleCurrentStep" />

      <!-- Step Title -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold mb-2">{{ t(`steps.${steps[currentStep].id}.title`) }}</h1>
        <p class="text-base-content/70">{{ t(`steps.${steps[currentStep].id}.description`) }}</p>
      </div>

      <!-- Step Content -->
      <div class="card bg-base-100 shadow-lg">
        <div class="card-body">
          <!-- Step 1: Category -->
          <ExchangeListingsWizardStepCategory
            v-if="currentStep === 0"
            v-model="formData.category"
            v-model:subcategory="formData.parts_subcategory"
            @next="nextStep"
          />

          <!-- Step 2: Pricing -->
          <ExchangeListingsWizardStepPricing
            v-else-if="currentStep === 1"
            v-model="formData.tier"
            :category="formData.category"
            :is-sustaining-member="isSustainingMember"
            :saving-draft="savingDraft"
            @next="nextStep"
            @back="prevStep"
            @save-draft="saveDraft"
          />

          <!-- Step 3: Required Info + Photos -->
          <ExchangeListingsWizardStepRequiredInfo
            v-else-if="currentStep === 2"
            v-model="formData"
            v-model:photos="photos"
            v-model:location="locationData"
            :category="formData.category"
            :tier="formData.tier"
            :errors="errors"
            :saving-draft="savingDraft"
            @next="validateAndNext"
            @back="prevStep"
            @save-draft="saveDraft"
          />

          <!-- Step 4: Extra Details -->
          <ExchangeListingsWizardStepExtraDetails
            v-else-if="currentStep === 3"
            v-model="formData"
            :category="formData.category"
            :saving-draft="savingDraft"
            @next="nextStep"
            @back="prevStep"
            @save-draft="saveDraft"
          />

          <!-- Step 5: Review -->
          <ExchangeListingsWizardStepReview
            v-else-if="currentStep === 4"
            :form-data="formData"
            :photos="photos"
            :location="locationData"
            :is-sustaining-member="isSustainingMember"
            @next="submitListing"
            @back="prevStep"
            @edit="goToStep"
            :submitting="submitting"
          />

          <!-- Step 6: Confirmation -->
          <ExchangeListingsWizardStepConfirmation
            v-else-if="currentStep === 5"
            :listing-id="createdListingId"
            :tier="formData.tier"
            :payment-url="paymentUrl"
            :submission-complete="submissionComplete"
            :comped="comped"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { CurrencyCode } from '~/composables/useCurrency';
  import type { Database } from '~~/types/database';
  import type { OptimizeResult } from '~/utils/imageOptimizer';

  const { t } = useI18n();

  type ListingCategory = Database['public']['Enums']['listing_category_enum'];
  type ListingTier = Database['public']['Enums']['listing_tier_enum'];
  type ListingCondition = Database['public']['Enums']['listing_condition_enum'];
  type RestorationStatus = Database['public']['Enums']['restoration_status_enum'];
  type EngineSeries = Database['public']['Enums']['engine_series_enum'];
  type PartCondition = Database['public']['Enums']['part_condition_enum'];
  type OemOrAftermarket = Database['public']['Enums']['oem_or_aftermarket_enum'];

  const route = useRoute();
  const router = useRouter();
  const toast = useToast();
  const supabase = useSupabase();
  const { createListing, updateListing, getPhotoUrl } = useListings();
  const { uploadPhotos } = useListingPhotos();
  const { createCheckoutSession } = usePayments();
  const { user, userProfile, isSustainingMember } = useAuth();
  const { SUPPORTED_CURRENCIES } = useCurrency();
  const { capture } = usePostHog();

  // Step timing for analytics
  const stepStartTime = ref(Date.now());
  const stepNames = ['category', 'pricing', 'required_info', 'extra_details', 'review', 'confirmation'] as const;

  // Check if editing an existing draft
  const draftId = computed(() => route.query.draft as string | undefined);
  const isEditingDraft = computed(() => !!draftId.value);
  const loadingDraft = ref(false);

  // Step definitions (titles/descriptions are translated via t(`steps.${id}.*`))
  const steps = [
    { id: 'category', label: 'Category' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'required', label: 'Details' },
    { id: 'extras', label: 'Extras' },
    { id: 'review', label: 'Review' },
    { id: 'confirm', label: 'Done' },
  ];

  const currentStep = ref(0);
  const submitting = ref(false);
  const savingDraft = ref(false);
  const createdListingId = ref<string | null>(null);
  const paymentUrl = ref<string | null>(null);
  const submissionComplete = ref(false);
  // True when the premium tier was granted free for a Sustaining Member (no Stripe).
  const comped = ref(false);
  const errors = ref<Record<string, string>>({});

  // Form data
  const formData = ref({
    // Category
    category: '' as ListingCategory | '',
    parts_subcategory: '',

    // Tier & Pricing
    tier: 'free' as ListingTier,
    price: null as number | null,
    currency: 'USD' as CurrencyCode,

    // Basic Info (all categories)
    title: '',
    description: '',

    // Vehicle-specific
    year: null as number | null,
    model: '',
    manufacturer: '',
    mileage: null as number | null,
    color: '',
    condition: '' as ListingCondition | '',

    // Heritage & Provenance (vehicle)
    vinNumber: '',
    chassisNumber: '',
    buildDate: '',
    originalColor: '',
    previousOwnersCount: null as number | null,
    restorationStatus: '' as RestorationStatus | '',
    lastRestorationDate: '',
    hasHeritageCert: false,
    heritageCertNumber: '',
    heritageCertDetails: '',
    matchingNumbers: null as boolean | null,
    hasServiceHistory: null as boolean | null,
    restorationDetails: '',

    // Engine & Mechanical (vehicle)
    engineNumber: '',
    engineSize: '',
    gearboxType: '',
    carbType: '',
    exhaustType: '',
    brakeType: '',

    // Exterior (vehicle)
    roofColor: '',
    hasStripes: false,
    stripeColor: '',
    wheelSize: '',
    wheelType: '',
    bumperType: '',
    windowType: '',
    hasSunroof: false,

    // Interior (vehicle)
    seatType: '',
    interiorColor: '',
    dashboardType: '',
    steeringWheelType: '',

    // Modifications (vehicle)
    factoryOptions: [] as string[],
    engineMods: '',
    suspensionMods: '',
    performanceUpgrades: '',
    otherModifications: '',
    rustCondition: '',
    undersideCondition: '',

    // Engine-specific (standalone engine listings)
    engineSeries: '' as EngineSeries | '',
    engineDisplacement: '',
    enginePlateDetails: '',

    // Parts-specific
    partNumber: '',
    partCondition: '' as PartCondition | '',
    fitsModels: [] as string[],
    oemOrAftermarket: '' as OemOrAftermarket | '',
    quantityAvailable: 1,
    shippingAvailable: false,
    shipsTo: '' as string,
  });

  // Location data
  const locationData = ref({
    city: '',
    state_province: '',
    country: '',
    postal_code: '',
    latitude: null as number | null,
    longitude: null as number | null,
    formatted_address: '',
  });

  // Photos organized by category
  const photos = ref<{
    body: OptimizeResult[];
    engine: OptimizeResult[];
    interior: OptimizeResult[];
    details: OptimizeResult[];
  }>({
    body: [],
    engine: [],
    interior: [],
    details: [],
  });

  // Load user preferences reactively (profile may load after component mounts)
  watch(
    () => userProfile.value?.preferred_currency,
    (newCurrency) => {
      if (newCurrency && !isEditingDraft.value) {
        formData.value.currency = newCurrency as CurrencyCode;
      }
    },
    { immediate: true }
  );

  // Load existing draft if editing
  const loadDraft = async () => {
    if (!draftId.value || !user.value) return;

    loadingDraft.value = true;

    try {
      const { data: listing, error } = await applyPhotoOrdering(
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
          is_primary
        )
      `
          )
          .eq('id', draftId.value)
          .eq('user_id', user.value.id)
          .eq('status', 'draft')
      ).single();

      if (error || !listing) {
        toast.add({
          title: t('toast.draftNotFound.title'),
          description: t('toast.draftNotFound.description'),
          color: 'error',
        });
        router.push('/exchange/listings/new');
        return;
      }

      // Populate form data from listing
      formData.value.category = listing.listing_category || '';
      formData.value.parts_subcategory = listing.parts_subcategory || '';
      formData.value.tier = listing.tier || 'free';
      formData.value.price = listing.price;
      formData.value.currency = (listing.currency as CurrencyCode) || 'USD';
      formData.value.title = listing.title || '';
      formData.value.description = listing.description || '';

      // Vehicle-specific
      formData.value.year = listing.year;
      formData.value.model = listing.model || '';
      formData.value.manufacturer = listing.manufacturer || '';
      formData.value.mileage = listing.mileage;
      formData.value.color = listing.color || '';
      formData.value.condition = listing.condition || '';

      // Heritage & Provenance
      formData.value.vinNumber = listing.vin_number || '';
      formData.value.chassisNumber = listing.chassis_number || '';
      formData.value.buildDate = listing.build_date || '';
      formData.value.originalColor = listing.original_color || '';
      formData.value.previousOwnersCount = listing.previous_owners_count;
      formData.value.restorationStatus = listing.restoration_status || '';
      formData.value.lastRestorationDate = listing.last_restoration_date || '';
      formData.value.hasHeritageCert = listing.has_heritage_cert || false;
      formData.value.heritageCertNumber = listing.heritage_cert_number || '';
      formData.value.heritageCertDetails = listing.heritage_cert_details || '';
      formData.value.matchingNumbers = listing.matching_numbers;
      formData.value.hasServiceHistory = listing.has_service_history;
      formData.value.restorationDetails = listing.restoration_details || '';

      // Engine & Mechanical
      formData.value.engineNumber = listing.engine_number || '';
      formData.value.engineSize = listing.engine_size || '';
      formData.value.gearboxType = listing.gearbox_type || '';
      formData.value.carbType = listing.carb_type || '';
      formData.value.exhaustType = listing.exhaust_type || '';
      formData.value.brakeType = listing.brake_type || '';

      // Exterior
      formData.value.roofColor = listing.roof_color || '';
      formData.value.hasStripes = listing.has_stripes || false;
      formData.value.stripeColor = listing.stripe_color || '';
      formData.value.wheelSize = listing.wheel_size || '';
      formData.value.wheelType = listing.wheel_type || '';
      formData.value.bumperType = listing.bumper_type || '';
      formData.value.windowType = listing.window_type || '';
      formData.value.hasSunroof = listing.has_sunroof || false;

      // Interior
      formData.value.seatType = listing.seat_type || '';
      formData.value.interiorColor = listing.interior_color || '';
      formData.value.dashboardType = listing.dashboard_type || '';
      formData.value.steeringWheelType = listing.steering_wheel_type || '';

      // Modifications
      formData.value.factoryOptions = listing.factory_options || [];
      formData.value.engineMods = listing.engine_mods || '';
      formData.value.suspensionMods = listing.suspension_mods || '';
      formData.value.performanceUpgrades = listing.performance_upgrades || '';
      formData.value.otherModifications = listing.other_modifications || '';
      formData.value.rustCondition = listing.rust_condition || '';
      formData.value.undersideCondition = listing.underside_condition || '';

      // Engine-specific (standalone engine listings)
      formData.value.engineSeries = listing.engine_series || '';
      formData.value.engineDisplacement = listing.engine_displacement || '';
      formData.value.enginePlateDetails = listing.engine_plate_details || '';

      // Parts-specific
      formData.value.partNumber = listing.part_number || '';
      formData.value.partCondition = listing.part_condition || '';
      formData.value.fitsModels = listing.fits_models || [];
      formData.value.oemOrAftermarket = listing.oem_or_aftermarket || '';
      formData.value.quantityAvailable = listing.quantity_available || 1;
      formData.value.shippingAvailable = listing.shipping_available || false;
      formData.value.shipsTo = listing.ships_to || '';

      // Location data
      locationData.value.city = listing.city || listing.location || '';
      locationData.value.state_province = listing.state_province || '';
      locationData.value.country = listing.country || '';
      locationData.value.postal_code = listing.postal_code || '';
      locationData.value.latitude = listing.latitude;
      locationData.value.longitude = listing.longitude;
      locationData.value.formatted_address = listing.formatted_address || '';

      // Load existing photos as references (we'll track which are already uploaded)
      if (listing.listing_photos && listing.listing_photos.length > 0) {
        // Group photos by category and create mock OptimizeResult objects
        for (const photo of listing.listing_photos) {
          const category = (photo.category || 'body') as keyof typeof photos.value;
          if (photos.value[category]) {
            // Create a placeholder that marks this as an existing photo
            photos.value[category].push({
              file: new File([], photo.storage_path), // Empty file with path as name
              preview: getPhotoUrl(photo.storage_path),
              originalSize: 0,
              optimizedSize: 0,
              isExisting: true, // Custom flag to track existing photos
              photoId: photo.id,
              storagePath: photo.storage_path,
            } as OptimizeResult & { isExisting: boolean; photoId: string; storagePath: string });
          }
        }
      }

      // Store the draft listing ID for updates
      createdListingId.value = listing.id;

      toast.add({
        title: t('toast.draftLoaded.title'),
        description: t('toast.draftLoaded.description'),
        color: 'info',
      });
    } catch (error) {
      console.error('Error loading draft:', error);
      toast.add({
        title: t('toast.error.title'),
        description: t('toast.error.loadDraft'),
        color: 'error',
      });
    } finally {
      loadingDraft.value = false;
    }
  };

  // Load draft on mount if draft ID is provided
  onMounted(() => {
    if (draftId.value) {
      loadDraft();
    } else {
      // Track listing creation started (only for new listings, not drafts)
      capture('listing_creation_started', {
        source_page: route.query.from?.toString() || 'direct',
      });
    }
  });

  // Check if Extras step should be skipped (engine category doesn't use it)
  const shouldSkipExtras = computed(() => formData.value.category === 'engine');

  // Visible steps for progress indicator (filters out Extras for engine)
  const visibleSteps = computed(() => {
    if (shouldSkipExtras.value) {
      return steps.filter((_, index) => index !== 3); // Remove Extras step
    }
    return steps;
  });

  // Current step index adjusted for the visible steps progress indicator
  const visibleCurrentStep = computed(() => {
    if (shouldSkipExtras.value && currentStep.value > 3) {
      return currentStep.value - 1; // Shift down by 1 since Extras is hidden
    }
    return currentStep.value;
  });

  // Navigation functions
  const nextStep = () => {
    if (currentStep.value < steps.length - 1) {
      // Track step completion with time spent
      const timeSpent = Math.floor((Date.now() - stepStartTime.value) / 1000);
      capture('wizard_step_completed', {
        step_number: currentStep.value,
        step_name: stepNames[currentStep.value],
        time_spent_seconds: timeSpent,
      });

      let nextStepIndex = currentStep.value + 1;
      // Skip Extras (step 3) for engine category
      if (nextStepIndex === 3 && shouldSkipExtras.value) {
        nextStepIndex = 4; // Jump to Review
      }
      currentStep.value = nextStepIndex;
      stepStartTime.value = Date.now(); // Reset timer for next step
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    if (currentStep.value > 0) {
      let prevStepIndex = currentStep.value - 1;
      // Skip Extras (step 3) for engine category when going back
      if (prevStepIndex === 3 && shouldSkipExtras.value) {
        prevStepIndex = 2; // Jump back to Required Info
      }
      currentStep.value = prevStepIndex;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToStep = (step: number) => {
    if (step >= 0 && step < steps.length - 1) {
      currentStep.value = step;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Validation for step 3
  const validateAndNext = () => {
    errors.value = {};

    // Common validations
    if (!formData.value.title?.trim()) {
      errors.value.title = t('validation.titleRequired');
    }
    if (!locationData.value.city?.trim()) {
      errors.value.city = t('validation.locationRequired');
    }
    if (!formData.value.description?.trim()) {
      errors.value.description = t('validation.descriptionRequired');
    }
    if (formData.value.price === null || formData.value.price === undefined || formData.value.price === '') {
      errors.value.price = t('validation.priceRequired');
    } else if (formData.value.price < 0) {
      errors.value.price = t('validation.priceNegative');
    }

    // Category-specific validations
    if (formData.value.category === 'vehicle') {
      if (!formData.value.year || formData.value.year < 1959 || formData.value.year > 2000) {
        errors.value.year = t('validation.yearRange');
      }
      if (!formData.value.model?.trim()) {
        errors.value.model = t('validation.modelRequired');
      }
      if (!formData.value.manufacturer?.trim()) {
        errors.value.manufacturer = t('validation.manufacturerRequired');
      }
      if (!formData.value.mileage && formData.value.mileage !== 0) {
        errors.value.mileage = t('validation.mileageRequired');
      }
      if (!formData.value.color?.trim()) {
        errors.value.color = t('validation.colorRequired');
      }
      if (!formData.value.condition) {
        errors.value.condition = t('validation.conditionRequired');
      }
    }

    if (formData.value.category === 'engine') {
      if (!formData.value.engineSeries) {
        errors.value.engineSeries = t('validation.engineSeriesRequired');
      }
      if (!formData.value.engineDisplacement) {
        errors.value.engineDisplacement = t('validation.engineDisplacementRequired');
      }
      if (!formData.value.enginePlateDetails?.trim()) {
        errors.value.enginePlateDetails = t('validation.enginePlateRequired');
      }
      if (!formData.value.condition) {
        errors.value.condition = t('validation.conditionRequired');
      }
    }

    if (formData.value.category === 'parts') {
      if (!formData.value.partCondition) {
        errors.value.partCondition = t('validation.partConditionRequired');
      }
    }

    // Check for at least one photo
    const totalPhotos = Object.values(photos.value).reduce((sum, arr) => sum + arr.length, 0);
    if (totalPhotos === 0) {
      errors.value.photos = t('validation.photoRequired');
    }

    if (Object.keys(errors.value).length > 0) {
      toast.add({
        title: t('toast.missingInfo.title'),
        description: t('toast.missingInfo.description'),
        color: 'error',
      });
      return;
    }

    nextStep();
  };

  // Save as draft
  const saveDraft = async () => {
    if (!user.value) return;

    savingDraft.value = true;

    try {
      const listingData = buildListingData('draft');
      let listingId: string;

      if (isEditingDraft.value && createdListingId.value) {
        // Update existing draft
        await updateListing(createdListingId.value, listingData);
        listingId = createdListingId.value;
      } else {
        // Create new draft
        const listing = await createListing(listingData);
        listingId = listing.id;
        createdListingId.value = listingId;
      }

      // Upload only new photos (not existing ones)
      for (const category of ['body', 'engine', 'interior', 'details'] as const) {
        const categoryPhotos = photos.value[category];
        const newPhotos = categoryPhotos.filter((p: any) => !p.isExisting);
        if (newPhotos.length > 0) {
          const files = newPhotos.map((p) => p.file);
          await uploadPhotos(files, listingId, category);
        }
      }

      // Track draft save
      capture('draft_saved', {
        listing_id: listingId,
        step_number: currentStep.value,
        fields_completed: Object.keys(formData.value).filter((k) => formData.value[k as keyof typeof formData.value])
          .length,
      });

      toast.add({
        title: t('toast.draftSaved.title'),
        description: t('toast.draftSaved.description'),
        color: 'success',
      });

      router.push('/dashboard/listings');
    } catch (error: any) {
      console.error('Error saving draft:', error);
      toast.add({
        title: t('toast.error.title'),
        description: error.message || t('toast.error.saveDraft'),
        color: 'error',
      });
    } finally {
      savingDraft.value = false;
    }
  };

  // Submit listing
  const trackListingSubmission = (listingId: string) => {
    const totalPhotos = Object.values(photos.value).reduce((sum, arr) => sum + arr.length, 0);
    const hasHeritageInfo = !!(
      formData.value.vinNumber ||
      formData.value.hasHeritageCert ||
      formData.value.originalColor
    );
    const hasModifications = !!(
      formData.value.engineMods ||
      formData.value.suspensionMods ||
      formData.value.performanceUpgrades ||
      formData.value.otherModifications
    );

    capture('listing_submitted', {
      listing_id: listingId,
      category: formData.value.category as 'vehicle' | 'engine' | 'parts',
      tier: formData.value.tier,
      photo_count: totalPhotos,
      has_heritage_info: hasHeritageInfo,
      has_modifications: hasModifications,
    });
  };

  const submitListing = async () => {
    if (!user.value) return;

    submitting.value = true;

    try {
      // Paid listings stay as draft until payment is verified
      // Free listings go to pending for admin review
      const initialStatus = formData.value.tier === 'paid' ? 'draft' : 'pending';
      const listingData = buildListingData(initialStatus);
      let listingId: string;

      if (isEditingDraft.value && createdListingId.value) {
        await updateListing(createdListingId.value, listingData);
        listingId = createdListingId.value;
      } else {
        const listing = await createListing(listingData);
        listingId = listing.id;
        createdListingId.value = listingId;
      }

      // Upload only new photos (not existing ones)
      for (const category of ['body', 'engine', 'interior', 'details'] as const) {
        const categoryPhotos = photos.value[category];
        const newPhotos = categoryPhotos.filter((p: any) => !p.isExisting);
        if (newPhotos.length > 0) {
          const files = newPhotos.map((p) => p.file);
          await uploadPhotos(files, listingId, category);
        }
      }

      // For paid tier: redirect to Stripe — unless the member was comped server-side.
      if (formData.value.tier === 'paid') {
        const siteUrl = useRuntimeConfig().public.siteUrl;
        const response = await createCheckoutSession({
          listingId: listingId,
          tier: 'paid',
          successUrl: `${siteUrl}/exchange/listings/payment/success?listing_id=${listingId}`,
          cancelUrl: `${siteUrl}/exchange/listings/payment/cancel?listing_id=${listingId}`,
        });

        trackListingSubmission(listingId);

        // Sustaining Member: premium was granted free (no Stripe URL). Skip the
        // redirect and advance straight to confirmation. The server is the source
        // of truth for the grant — we only branch the UX on the response here.
        if (response.comped || !response.url) {
          comped.value = true;
          submissionComplete.value = true;
          toast.add({
            title: t('toast.premiumApplied.title'),
            description: t('toast.premiumApplied.description'),
            color: 'success',
          });
          nextStep(); // Go to confirmation step
          return;
        }

        window.location.href = response.url;
        return;
      }

      // Free tier: send email and show confirmation step
      const userEmail = user.value?.email || userProfile.value?.email;
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        await $fetch('/api/exchange/listings/submit', {
          method: 'POST',
          body: {
            listingId: listingId,
            userEmail,
            listingTitle: formData.value.title,
          },
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      } catch (emailError) {
        // Don't fail the whole submission if email fails
        console.error('Failed to send submission email:', emailError);
      }

      trackListingSubmission(listingId);

      submissionComplete.value = true;
      nextStep(); // Go to confirmation step
    } catch (error: any) {
      console.error('Error submitting listing:', error);
      toast.add({
        title: t('toast.error.title'),
        description: error.message || t('toast.error.submitListing'),
        color: 'error',
      });
    } finally {
      submitting.value = false;
    }
  };

  // Coerce empty-string numeric values to null (v-model.number produces "" for blank inputs)
  const numOrNull = (v: unknown): number | null => (v === '' || v == null ? null : Number(v));

  // Build listing data object
  const buildListingData = (status: 'draft' | 'pending' | 'active') => {
    const data: any = {
      user_id: user.value!.id,
      status,
      tier: formData.value.tier,
      listing_category: formData.value.category,
      title: formData.value.title.trim(),
      description: formData.value.description.trim(),
      price: formData.value.price,
      currency: formData.value.currency,
      location: locationData.value.city,
      city: locationData.value.city,
      state_province: locationData.value.state_province,
      country: locationData.value.country,
      postal_code: locationData.value.postal_code,
      latitude: locationData.value.latitude,
      longitude: locationData.value.longitude,
      formatted_address: locationData.value.formatted_address || null,
    };

    if (formData.value.category === 'vehicle') {
      // Core required fields
      Object.assign(data, {
        year: formData.value.year,
        model: formData.value.model,
        manufacturer: formData.value.manufacturer || null,
        mileage: numOrNull(formData.value.mileage),
        color: formData.value.color || null,
        condition: formData.value.condition || null,
      });

      // Heritage fields - GROUP 1
      Object.assign(data, {
        vin_number: formData.value.vinNumber || null,
        chassis_number: formData.value.chassisNumber || null,
        build_date: formData.value.buildDate || null,
        original_color: formData.value.originalColor || null,
        previous_owners_count: numOrNull(formData.value.previousOwnersCount),
        restoration_status: formData.value.restorationStatus || null,
        last_restoration_date: formData.value.lastRestorationDate || null,
        has_heritage_cert: formData.value.hasHeritageCert || false,
        heritage_cert_number: formData.value.heritageCertNumber || null,
        heritage_cert_details: formData.value.heritageCertDetails || null,
        matching_numbers: formData.value.matchingNumbers ?? null,
        has_service_history: formData.value.hasServiceHistory ?? null,
        restoration_details: formData.value.restorationDetails || null,
      });

      // Engine & Mechanical - GROUP 2
      Object.assign(data, {
        engine_number: formData.value.engineNumber || null,
        engine_size: formData.value.engineSize || null,
        gearbox_type: formData.value.gearboxType || null,
        carb_type: formData.value.carbType || null,
        exhaust_type: formData.value.exhaustType || null,
        brake_type: formData.value.brakeType || null,
      });

      // Exterior - GROUP 3
      Object.assign(data, {
        roof_color: formData.value.roofColor || null,
        has_stripes: formData.value.hasStripes || false,
        stripe_color: formData.value.stripeColor || null,
        wheel_size: formData.value.wheelSize || null,
        wheel_type: formData.value.wheelType || null,
        bumper_type: formData.value.bumperType || null,
        window_type: formData.value.windowType || null,
        has_sunroof: formData.value.hasSunroof || false,
      });

      // Interior - GROUP 4
      Object.assign(data, {
        seat_type: formData.value.seatType || null,
        interior_color: formData.value.interiorColor || null,
        dashboard_type: formData.value.dashboardType || null,
        steering_wheel_type: formData.value.steeringWheelType || null,
      });

      // Modifications - GROUP 5
      // Note: Using spread operator to convert reactive array to plain array
      const factoryOpts = formData.value.factoryOptions?.length > 0 ? [...formData.value.factoryOptions] : null;
      Object.assign(data, {
        factory_options: factoryOpts,
        engine_mods: formData.value.engineMods || null,
        suspension_mods: formData.value.suspensionMods || null,
        performance_upgrades: formData.value.performanceUpgrades || null,
        other_modifications: formData.value.otherModifications || null,
        rust_condition: formData.value.rustCondition || null,
        underside_condition: formData.value.undersideCondition || null,
      });
    } else if (formData.value.category === 'engine') {
      Object.assign(data, {
        year: formData.value.year,
        model: `${formData.value.engineDisplacement} ${formData.value.engineSeries}`,
        engine_series: formData.value.engineSeries || null,
        engine_displacement: formData.value.engineDisplacement,
        engine_plate_details: formData.value.enginePlateDetails || null,
        condition: formData.value.condition || null,
      });
    } else if (formData.value.category === 'parts') {
      // Note: Using spread operator to convert reactive array to plain array
      const fitsModelsList = formData.value.fitsModels.length > 0 ? [...formData.value.fitsModels] : null;
      Object.assign(data, {
        model: formData.value.title, // Use title for model in parts
        parts_subcategory: formData.value.parts_subcategory || null,
        part_number: formData.value.partNumber || null,
        part_condition: formData.value.partCondition || null,
        fits_models: fitsModelsList,
        oem_or_aftermarket: formData.value.oemOrAftermarket || null,
        quantity_available: formData.value.quantityAvailable,
        shipping_available: formData.value.shippingAvailable,
        ships_to: formData.value.shipsTo || null,
      });
    }

    return data;
  };
</script>

<i18n lang="json">
{
  "en": {
    "loadingDraft": "Loading your draft...",
    "steps": {
      "category": { "title": "What are you selling?", "description": "Select the type of listing" },
      "pricing": { "title": "Choose Your Plan", "description": "Select listing tier and set your price" },
      "required": { "title": "Required Information", "description": "Add the essential details and photos" },
      "extras": { "title": "Extra Details", "description": "Optional information to make your listing stand out" },
      "review": { "title": "Review Your Listing", "description": "Make sure everything looks good" },
      "confirm": { "title": "Almost There!", "description": "Complete your listing" }
    },
    "validation": {
      "titleRequired": "Title is required",
      "locationRequired": "Location is required",
      "descriptionRequired": "Description is required",
      "priceRequired": "Price is required (or mark as free)",
      "priceNegative": "Price cannot be negative",
      "yearRange": "Year must be between 1959 and 2000",
      "modelRequired": "Model is required",
      "manufacturerRequired": "Manufacturer is required",
      "mileageRequired": "Mileage is required",
      "colorRequired": "Color is required",
      "conditionRequired": "Condition is required",
      "engineSeriesRequired": "Engine series is required",
      "engineDisplacementRequired": "Engine displacement is required",
      "enginePlateRequired": "Engine plate details are required",
      "partConditionRequired": "Part condition is required",
      "photoRequired": "At least one photo is required"
    },
    "toast": {
      "draftNotFound": { "title": "Draft Not Found", "description": "Could not load the draft listing" },
      "draftLoaded": { "title": "Draft Loaded", "description": "Continue editing your listing" },
      "draftSaved": { "title": "Draft Saved", "description": "Your listing has been saved as a draft" },
      "missingInfo": { "title": "Missing Information", "description": "Please fill in all required fields" },
      "premiumApplied": { "title": "Premium Applied", "description": "Premium is included with your Sustaining membership." },
      "error": { "title": "Error", "loadDraft": "Failed to load draft", "saveDraft": "Failed to save draft", "submitListing": "Failed to submit listing" }
    }
  },
  "es": {
    "loadingDraft": "Cargando tu borrador...",
    "steps": {
      "category": { "title": "¿Qué estás vendiendo?", "description": "Selecciona el tipo de anuncio" },
      "pricing": { "title": "Elige tu plan", "description": "Selecciona el nivel del anuncio y fija tu precio" },
      "required": { "title": "Información requerida", "description": "Añade los datos esenciales y las fotos" },
      "extras": { "title": "Detalles adicionales", "description": "Información opcional para destacar tu anuncio" },
      "review": { "title": "Revisa tu anuncio", "description": "Asegúrate de que todo esté correcto" },
      "confirm": { "title": "¡Casi listo!", "description": "Completa tu anuncio" }
    },
    "validation": {
      "titleRequired": "El título es obligatorio",
      "locationRequired": "La ubicación es obligatoria",
      "descriptionRequired": "La descripción es obligatoria",
      "priceRequired": "El precio es obligatorio (o márcalo como gratis)",
      "priceNegative": "El precio no puede ser negativo",
      "yearRange": "El año debe estar entre 1959 y 2000",
      "modelRequired": "El modelo es obligatorio",
      "manufacturerRequired": "El fabricante es obligatorio",
      "mileageRequired": "El kilometraje es obligatorio",
      "colorRequired": "El color es obligatorio",
      "conditionRequired": "El estado es obligatorio",
      "engineSeriesRequired": "La serie del motor es obligatoria",
      "engineDisplacementRequired": "La cilindrada del motor es obligatoria",
      "enginePlateRequired": "Los detalles de la placa del motor son obligatorios",
      "partConditionRequired": "El estado de la pieza es obligatorio",
      "photoRequired": "Se requiere al menos una foto"
    },
    "toast": {
      "draftNotFound": { "title": "Borrador no encontrado", "description": "No se pudo cargar el borrador del anuncio" },
      "draftLoaded": { "title": "Borrador cargado", "description": "Continúa editando tu anuncio" },
      "draftSaved": { "title": "Borrador guardado", "description": "Tu anuncio se ha guardado como borrador" },
      "missingInfo": { "title": "Información faltante", "description": "Por favor completa todos los campos obligatorios" },
      "premiumApplied": { "title": "Premium aplicado", "description": "Premium está incluido con tu membresía Sustaining." },
      "error": { "title": "Error", "loadDraft": "No se pudo cargar el borrador", "saveDraft": "No se pudo guardar el borrador", "submitListing": "No se pudo enviar el anuncio" }
    }
  },
  "fr": {
    "loadingDraft": "Chargement de votre brouillon...",
    "steps": {
      "category": { "title": "Que vendez-vous ?", "description": "Sélectionnez le type d'annonce" },
      "pricing": { "title": "Choisissez votre formule", "description": "Sélectionnez le niveau d'annonce et fixez votre prix" },
      "required": { "title": "Informations requises", "description": "Ajoutez les détails essentiels et les photos" },
      "extras": { "title": "Détails supplémentaires", "description": "Informations facultatives pour faire ressortir votre annonce" },
      "review": { "title": "Vérifiez votre annonce", "description": "Assurez-vous que tout est correct" },
      "confirm": { "title": "Presque terminé !", "description": "Finalisez votre annonce" }
    },
    "validation": {
      "titleRequired": "Le titre est requis",
      "locationRequired": "La localisation est requise",
      "descriptionRequired": "La description est requise",
      "priceRequired": "Le prix est requis (ou marquez comme gratuit)",
      "priceNegative": "Le prix ne peut pas être négatif",
      "yearRange": "L'année doit être comprise entre 1959 et 2000",
      "modelRequired": "Le modèle est requis",
      "manufacturerRequired": "Le fabricant est requis",
      "mileageRequired": "Le kilométrage est requis",
      "colorRequired": "La couleur est requise",
      "conditionRequired": "L'état est requis",
      "engineSeriesRequired": "La série du moteur est requise",
      "engineDisplacementRequired": "La cylindrée du moteur est requise",
      "enginePlateRequired": "Les détails de la plaque moteur sont requis",
      "partConditionRequired": "L'état de la pièce est requis",
      "photoRequired": "Au moins une photo est requise"
    },
    "toast": {
      "draftNotFound": { "title": "Brouillon introuvable", "description": "Impossible de charger le brouillon de l'annonce" },
      "draftLoaded": { "title": "Brouillon chargé", "description": "Continuez à modifier votre annonce" },
      "draftSaved": { "title": "Brouillon enregistré", "description": "Votre annonce a été enregistrée comme brouillon" },
      "missingInfo": { "title": "Informations manquantes", "description": "Veuillez remplir tous les champs requis" },
      "premiumApplied": { "title": "Premium appliqué", "description": "Premium est inclus avec votre adhésion Sustaining." },
      "error": { "title": "Erreur", "loadDraft": "Échec du chargement du brouillon", "saveDraft": "Échec de l'enregistrement du brouillon", "submitListing": "Échec de l'envoi de l'annonce" }
    }
  },
  "de": {
    "loadingDraft": "Entwurf wird geladen...",
    "steps": {
      "category": { "title": "Was verkaufen Sie?", "description": "Wählen Sie die Art der Anzeige" },
      "pricing": { "title": "Wählen Sie Ihren Plan", "description": "Wählen Sie die Anzeigenstufe und legen Sie Ihren Preis fest" },
      "required": { "title": "Erforderliche Informationen", "description": "Fügen Sie die wesentlichen Details und Fotos hinzu" },
      "extras": { "title": "Zusätzliche Details", "description": "Optionale Informationen, damit Ihre Anzeige auffällt" },
      "review": { "title": "Überprüfen Sie Ihre Anzeige", "description": "Stellen Sie sicher, dass alles korrekt ist" },
      "confirm": { "title": "Fast geschafft!", "description": "Schließen Sie Ihre Anzeige ab" }
    },
    "validation": {
      "titleRequired": "Titel ist erforderlich",
      "locationRequired": "Standort ist erforderlich",
      "descriptionRequired": "Beschreibung ist erforderlich",
      "priceRequired": "Preis ist erforderlich (oder als kostenlos markieren)",
      "priceNegative": "Preis darf nicht negativ sein",
      "yearRange": "Das Jahr muss zwischen 1959 und 2000 liegen",
      "modelRequired": "Modell ist erforderlich",
      "manufacturerRequired": "Hersteller ist erforderlich",
      "mileageRequired": "Kilometerstand ist erforderlich",
      "colorRequired": "Farbe ist erforderlich",
      "conditionRequired": "Zustand ist erforderlich",
      "engineSeriesRequired": "Motorenserie ist erforderlich",
      "engineDisplacementRequired": "Hubraum ist erforderlich",
      "enginePlateRequired": "Motorplattendetails sind erforderlich",
      "partConditionRequired": "Teilezustand ist erforderlich",
      "photoRequired": "Mindestens ein Foto ist erforderlich"
    },
    "toast": {
      "draftNotFound": { "title": "Entwurf nicht gefunden", "description": "Der Anzeigenentwurf konnte nicht geladen werden" },
      "draftLoaded": { "title": "Entwurf geladen", "description": "Bearbeiten Sie Ihre Anzeige weiter" },
      "draftSaved": { "title": "Entwurf gespeichert", "description": "Ihre Anzeige wurde als Entwurf gespeichert" },
      "missingInfo": { "title": "Fehlende Informationen", "description": "Bitte füllen Sie alle erforderlichen Felder aus" },
      "premiumApplied": { "title": "Premium angewendet", "description": "Premium ist in Ihrer Sustaining-Mitgliedschaft enthalten." },
      "error": { "title": "Fehler", "loadDraft": "Entwurf konnte nicht geladen werden", "saveDraft": "Entwurf konnte nicht gespeichert werden", "submitListing": "Anzeige konnte nicht gesendet werden" }
    }
  },
  "it": {
    "loadingDraft": "Caricamento della bozza...",
    "steps": {
      "category": { "title": "Cosa stai vendendo?", "description": "Seleziona il tipo di annuncio" },
      "pricing": { "title": "Scegli il tuo piano", "description": "Seleziona il livello dell'annuncio e imposta il prezzo" },
      "required": { "title": "Informazioni richieste", "description": "Aggiungi i dettagli essenziali e le foto" },
      "extras": { "title": "Dettagli aggiuntivi", "description": "Informazioni facoltative per far risaltare il tuo annuncio" },
      "review": { "title": "Rivedi il tuo annuncio", "description": "Assicurati che tutto sia corretto" },
      "confirm": { "title": "Ci siamo quasi!", "description": "Completa il tuo annuncio" }
    },
    "validation": {
      "titleRequired": "Il titolo è obbligatorio",
      "locationRequired": "La posizione è obbligatoria",
      "descriptionRequired": "La descrizione è obbligatoria",
      "priceRequired": "Il prezzo è obbligatorio (o contrassegnalo come gratuito)",
      "priceNegative": "Il prezzo non può essere negativo",
      "yearRange": "L'anno deve essere compreso tra 1959 e 2000",
      "modelRequired": "Il modello è obbligatorio",
      "manufacturerRequired": "Il produttore è obbligatorio",
      "mileageRequired": "Il chilometraggio è obbligatorio",
      "colorRequired": "Il colore è obbligatorio",
      "conditionRequired": "La condizione è obbligatoria",
      "engineSeriesRequired": "La serie del motore è obbligatoria",
      "engineDisplacementRequired": "La cilindrata del motore è obbligatoria",
      "enginePlateRequired": "I dettagli della targhetta del motore sono obbligatori",
      "partConditionRequired": "La condizione del pezzo è obbligatoria",
      "photoRequired": "È richiesta almeno una foto"
    },
    "toast": {
      "draftNotFound": { "title": "Bozza non trovata", "description": "Impossibile caricare la bozza dell'annuncio" },
      "draftLoaded": { "title": "Bozza caricata", "description": "Continua a modificare il tuo annuncio" },
      "draftSaved": { "title": "Bozza salvata", "description": "Il tuo annuncio è stato salvato come bozza" },
      "missingInfo": { "title": "Informazioni mancanti", "description": "Compila tutti i campi obbligatori" },
      "premiumApplied": { "title": "Premium applicato", "description": "Premium è incluso nella tua iscrizione Sustaining." },
      "error": { "title": "Errore", "loadDraft": "Impossibile caricare la bozza", "saveDraft": "Impossibile salvare la bozza", "submitListing": "Impossibile inviare l'annuncio" }
    }
  },
  "pt": {
    "loadingDraft": "Carregando seu rascunho...",
    "steps": {
      "category": { "title": "O que você está vendendo?", "description": "Selecione o tipo de anúncio" },
      "pricing": { "title": "Escolha seu plano", "description": "Selecione o nível do anúncio e defina seu preço" },
      "required": { "title": "Informações obrigatórias", "description": "Adicione os detalhes essenciais e as fotos" },
      "extras": { "title": "Detalhes adicionais", "description": "Informações opcionais para destacar seu anúncio" },
      "review": { "title": "Revise seu anúncio", "description": "Certifique-se de que está tudo correto" },
      "confirm": { "title": "Quase lá!", "description": "Conclua seu anúncio" }
    },
    "validation": {
      "titleRequired": "O título é obrigatório",
      "locationRequired": "A localização é obrigatória",
      "descriptionRequired": "A descrição é obrigatória",
      "priceRequired": "O preço é obrigatório (ou marque como grátis)",
      "priceNegative": "O preço não pode ser negativo",
      "yearRange": "O ano deve estar entre 1959 e 2000",
      "modelRequired": "O modelo é obrigatório",
      "manufacturerRequired": "O fabricante é obrigatório",
      "mileageRequired": "A quilometragem é obrigatória",
      "colorRequired": "A cor é obrigatória",
      "conditionRequired": "A condição é obrigatória",
      "engineSeriesRequired": "A série do motor é obrigatória",
      "engineDisplacementRequired": "A cilindrada do motor é obrigatória",
      "enginePlateRequired": "Os detalhes da placa do motor são obrigatórios",
      "partConditionRequired": "A condição da peça é obrigatória",
      "photoRequired": "É necessária pelo menos uma foto"
    },
    "toast": {
      "draftNotFound": { "title": "Rascunho não encontrado", "description": "Não foi possível carregar o rascunho do anúncio" },
      "draftLoaded": { "title": "Rascunho carregado", "description": "Continue editando seu anúncio" },
      "draftSaved": { "title": "Rascunho salvo", "description": "Seu anúncio foi salvo como rascunho" },
      "missingInfo": { "title": "Informações faltando", "description": "Por favor, preencha todos os campos obrigatórios" },
      "premiumApplied": { "title": "Premium aplicado", "description": "O Premium está incluído na sua assinatura Sustaining." },
      "error": { "title": "Erro", "loadDraft": "Falha ao carregar o rascunho", "saveDraft": "Falha ao salvar o rascunho", "submitListing": "Falha ao enviar o anúncio" }
    }
  },
  "ru": {
    "loadingDraft": "Загрузка вашего черновика...",
    "steps": {
      "category": { "title": "Что вы продаёте?", "description": "Выберите тип объявления" },
      "pricing": { "title": "Выберите план", "description": "Выберите уровень объявления и установите цену" },
      "required": { "title": "Обязательная информация", "description": "Добавьте основные сведения и фотографии" },
      "extras": { "title": "Дополнительные сведения", "description": "Необязательная информация, чтобы выделить ваше объявление" },
      "review": { "title": "Проверьте ваше объявление", "description": "Убедитесь, что всё в порядке" },
      "confirm": { "title": "Почти готово!", "description": "Завершите ваше объявление" }
    },
    "validation": {
      "titleRequired": "Требуется заголовок",
      "locationRequired": "Требуется местоположение",
      "descriptionRequired": "Требуется описание",
      "priceRequired": "Требуется цена (или отметьте как бесплатно)",
      "priceNegative": "Цена не может быть отрицательной",
      "yearRange": "Год должен быть от 1959 до 2000",
      "modelRequired": "Требуется модель",
      "manufacturerRequired": "Требуется производитель",
      "mileageRequired": "Требуется пробег",
      "colorRequired": "Требуется цвет",
      "conditionRequired": "Требуется состояние",
      "engineSeriesRequired": "Требуется серия двигателя",
      "engineDisplacementRequired": "Требуется объём двигателя",
      "enginePlateRequired": "Требуются данные таблички двигателя",
      "partConditionRequired": "Требуется состояние детали",
      "photoRequired": "Требуется хотя бы одна фотография"
    },
    "toast": {
      "draftNotFound": { "title": "Черновик не найден", "description": "Не удалось загрузить черновик объявления" },
      "draftLoaded": { "title": "Черновик загружен", "description": "Продолжайте редактировать ваше объявление" },
      "draftSaved": { "title": "Черновик сохранён", "description": "Ваше объявление сохранено как черновик" },
      "missingInfo": { "title": "Не хватает информации", "description": "Пожалуйста, заполните все обязательные поля" },
      "premiumApplied": { "title": "Premium применён", "description": "Premium включён в ваше членство Sustaining." },
      "error": { "title": "Ошибка", "loadDraft": "Не удалось загрузить черновик", "saveDraft": "Не удалось сохранить черновик", "submitListing": "Не удалось отправить объявление" }
    }
  },
  "ja": {
    "loadingDraft": "下書きを読み込んでいます...",
    "steps": {
      "category": { "title": "何を販売しますか？", "description": "出品の種類を選択してください" },
      "pricing": { "title": "プランを選択", "description": "出品レベルを選択し、価格を設定してください" },
      "required": { "title": "必須情報", "description": "重要な詳細と写真を追加してください" },
      "extras": { "title": "追加の詳細", "description": "出品を目立たせるための任意情報" },
      "review": { "title": "出品内容を確認", "description": "すべて問題ないか確認してください" },
      "confirm": { "title": "あと少しです！", "description": "出品を完了してください" }
    },
    "validation": {
      "titleRequired": "タイトルは必須です",
      "locationRequired": "場所は必須です",
      "descriptionRequired": "説明は必須です",
      "priceRequired": "価格は必須です（または無料に設定）",
      "priceNegative": "価格をマイナスにすることはできません",
      "yearRange": "年式は1959年から2000年の間である必要があります",
      "modelRequired": "モデルは必須です",
      "manufacturerRequired": "メーカーは必須です",
      "mileageRequired": "走行距離は必須です",
      "colorRequired": "色は必須です",
      "conditionRequired": "状態は必須です",
      "engineSeriesRequired": "エンジンシリーズは必須です",
      "engineDisplacementRequired": "排気量は必須です",
      "enginePlateRequired": "エンジンプレートの詳細は必須です",
      "partConditionRequired": "部品の状態は必須です",
      "photoRequired": "写真は1枚以上必須です"
    },
    "toast": {
      "draftNotFound": { "title": "下書きが見つかりません", "description": "下書きの出品を読み込めませんでした" },
      "draftLoaded": { "title": "下書きを読み込みました", "description": "出品の編集を続けてください" },
      "draftSaved": { "title": "下書きを保存しました", "description": "出品が下書きとして保存されました" },
      "missingInfo": { "title": "情報が不足しています", "description": "必須項目をすべて入力してください" },
      "premiumApplied": { "title": "プレミアムを適用しました", "description": "プレミアムはSustainingメンバーシップに含まれています。" },
      "error": { "title": "エラー", "loadDraft": "下書きの読み込みに失敗しました", "saveDraft": "下書きの保存に失敗しました", "submitListing": "出品の送信に失敗しました" }
    }
  },
  "zh": {
    "loadingDraft": "正在加载您的草稿...",
    "steps": {
      "category": { "title": "您要出售什么？", "description": "选择刊登类型" },
      "pricing": { "title": "选择您的方案", "description": "选择刊登级别并设置价格" },
      "required": { "title": "必填信息", "description": "添加基本详情和照片" },
      "extras": { "title": "额外详情", "description": "可选信息，让您的刊登更突出" },
      "review": { "title": "查看您的刊登", "description": "确保一切无误" },
      "confirm": { "title": "即将完成！", "description": "完成您的刊登" }
    },
    "validation": {
      "titleRequired": "标题为必填项",
      "locationRequired": "位置为必填项",
      "descriptionRequired": "描述为必填项",
      "priceRequired": "价格为必填项（或标记为免费）",
      "priceNegative": "价格不能为负数",
      "yearRange": "年份必须在1959年到2000年之间",
      "modelRequired": "型号为必填项",
      "manufacturerRequired": "制造商为必填项",
      "mileageRequired": "里程为必填项",
      "colorRequired": "颜色为必填项",
      "conditionRequired": "状况为必填项",
      "engineSeriesRequired": "发动机系列为必填项",
      "engineDisplacementRequired": "发动机排量为必填项",
      "enginePlateRequired": "发动机铭牌详情为必填项",
      "partConditionRequired": "零件状况为必填项",
      "photoRequired": "至少需要一张照片"
    },
    "toast": {
      "draftNotFound": { "title": "未找到草稿", "description": "无法加载草稿刊登" },
      "draftLoaded": { "title": "草稿已加载", "description": "继续编辑您的刊登" },
      "draftSaved": { "title": "草稿已保存", "description": "您的刊登已保存为草稿" },
      "missingInfo": { "title": "信息缺失", "description": "请填写所有必填字段" },
      "premiumApplied": { "title": "已应用高级版", "description": "高级版已包含在您的Sustaining会员资格中。" },
      "error": { "title": "错误", "loadDraft": "加载草稿失败", "saveDraft": "保存草稿失败", "submitListing": "提交刊登失败" }
    }
  },
  "ko": {
    "loadingDraft": "초안을 불러오는 중...",
    "steps": {
      "category": { "title": "무엇을 판매하시나요?", "description": "매물 유형을 선택하세요" },
      "pricing": { "title": "요금제를 선택하세요", "description": "매물 등급을 선택하고 가격을 설정하세요" },
      "required": { "title": "필수 정보", "description": "핵심 세부정보와 사진을 추가하세요" },
      "extras": { "title": "추가 세부정보", "description": "매물을 돋보이게 할 선택 정보" },
      "review": { "title": "매물 검토", "description": "모든 내용이 올바른지 확인하세요" },
      "confirm": { "title": "거의 다 됐어요!", "description": "매물을 완료하세요" }
    },
    "validation": {
      "titleRequired": "제목은 필수입니다",
      "locationRequired": "위치는 필수입니다",
      "descriptionRequired": "설명은 필수입니다",
      "priceRequired": "가격은 필수입니다 (또는 무료로 표시)",
      "priceNegative": "가격은 음수일 수 없습니다",
      "yearRange": "연식은 1959년에서 2000년 사이여야 합니다",
      "modelRequired": "모델은 필수입니다",
      "manufacturerRequired": "제조사는 필수입니다",
      "mileageRequired": "주행거리는 필수입니다",
      "colorRequired": "색상은 필수입니다",
      "conditionRequired": "상태는 필수입니다",
      "engineSeriesRequired": "엔진 시리즈는 필수입니다",
      "engineDisplacementRequired": "엔진 배기량은 필수입니다",
      "enginePlateRequired": "엔진 플레이트 세부정보는 필수입니다",
      "partConditionRequired": "부품 상태는 필수입니다",
      "photoRequired": "사진이 최소 한 장 필요합니다"
    },
    "toast": {
      "draftNotFound": { "title": "초안을 찾을 수 없음", "description": "초안 매물을 불러올 수 없습니다" },
      "draftLoaded": { "title": "초안 불러옴", "description": "매물 편집을 계속하세요" },
      "draftSaved": { "title": "초안 저장됨", "description": "매물이 초안으로 저장되었습니다" },
      "missingInfo": { "title": "정보 누락", "description": "모든 필수 항목을 입력해 주세요" },
      "premiumApplied": { "title": "프리미엄 적용됨", "description": "프리미엄은 Sustaining 멤버십에 포함되어 있습니다." },
      "error": { "title": "오류", "loadDraft": "초안 불러오기 실패", "saveDraft": "초안 저장 실패", "submitListing": "매물 제출 실패" }
    }
  }
}
</i18n>
