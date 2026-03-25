<script lang="ts" setup>
  import { HERO_TYPES, BREADCRUMB_VERSIONS } from '../../../data/models/generic';

  const { t } = useI18n();
  const toast = useToast();
  const { isAuthenticated, user, userProfile, fetchUserProfile, waitForAuth } = useAuth();
  const { fetchProfile, updateProfile, uploadAvatar } = useProfile();

  const displayName = ref('');
  const bio = ref('');
  const location = ref('');
  const isPublic = ref(true);
  const showVehicles = ref(false);
  const socialLinks = ref<Record<string, string>>({
    instagram: '',
    youtube: '',
    facebook: '',
    website: '',
    tiktok: '',
    x: '',
    bluesky: '',
  });
  const avatarUrl = ref<string | null>(null);
  const avatarFile = ref<File | null>(null);

  const saving = ref(false);
  const profileLoading = ref(true);
  const profileLoaded = ref(false);
  const fetchError = ref(false);

  // Snapshot of original profile values to diff against on save
  const originalProfile = ref<{
    display_name: string | null;
    bio: string | null;
    location: string | null;
    avatar_url: string | null;
    is_public: boolean;
    show_vehicles: boolean;
    social_links: Record<string, string>;
  } | null>(null);

  // Helper to snapshot current form state for dirty-checking
  function snapshotCurrentState() {
    const cleanedLinks: Record<string, string> = {};
    for (const [key, val] of Object.entries(socialLinks.value)) {
      if (val?.trim()) cleanedLinks[key] = val.trim();
    }
    originalProfile.value = {
      display_name: displayName.value.trim() || null,
      bio: bio.value.trim() || null,
      location: location.value.trim() || null,
      avatar_url: avatarUrl.value,
      is_public: isPublic.value,
      show_vehicles: showVehicles.value,
      social_links: cleanedLinks,
    };
  }

  // Load profile data
  async function loadProfile() {
    await waitForAuth();
    if (!user.value) {
      profileLoading.value = false;
      return;
    }
    profileLoading.value = true;
    fetchError.value = false;
    profileLoaded.value = false;

    try {
      const profile = await fetchProfile();
      if (profile) {
        displayName.value = profile.display_name || '';
        bio.value = profile.bio || '';
        location.value = profile.location || '';
        isPublic.value = profile.is_public ?? true;
        showVehicles.value = profile.show_vehicles ?? false;
        avatarUrl.value = profile.avatar_url || null;
        if (profile.social_links && typeof profile.social_links === 'object') {
          const links = profile.social_links as Record<string, string>;
          for (const key of Object.keys(socialLinks.value)) {
            socialLinks.value[key] = links[key] || '';
          }
        }
      }
      snapshotCurrentState();
      profileLoaded.value = true;
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      fetchError.value = true;
    } finally {
      profileLoading.value = false;
    }
  }

  onMounted(loadProfile);

  function handleAvatarUpload(file: File) {
    avatarFile.value = file;
  }

  async function save() {
    saving.value = true;

    try {
      let newAvatarUrl = avatarUrl.value;

      // Upload avatar if changed
      if (avatarFile.value) {
        newAvatarUrl = await uploadAvatar(avatarFile.value);
        avatarFile.value = null;
      }

      // Clean social links — only include non-empty values
      const cleanedLinks: Record<string, string> = {};
      for (const [key, val] of Object.entries(socialLinks.value)) {
        if (val.trim()) cleanedLinks[key] = val.trim();
      }

      // Build updates — only include fields that differ from the original snapshot
      const orig = originalProfile.value;
      const currentDisplayName = displayName.value.trim() || null;
      const currentBio = bio.value.trim() || null;
      const currentLocation = location.value.trim() || null;

      const updates: Record<string, any> = {};

      if (!orig) {
        // No snapshot (first save or fetch failed) — send all fields
        updates.display_name = currentDisplayName;
        updates.bio = currentBio;
        updates.location = currentLocation;
        updates.avatar_url = newAvatarUrl;
        updates.is_public = isPublic.value;
        updates.show_vehicles = showVehicles.value;
        updates.social_links = cleanedLinks;
      } else {
        // Only send changed fields
        if (currentDisplayName !== orig.display_name) updates.display_name = currentDisplayName;
        if (currentBio !== orig.bio) updates.bio = currentBio;
        if (currentLocation !== orig.location) updates.location = currentLocation;
        if (newAvatarUrl !== orig.avatar_url) updates.avatar_url = newAvatarUrl;
        if (isPublic.value !== orig.is_public) updates.is_public = isPublic.value;
        if (showVehicles.value !== orig.show_vehicles) updates.show_vehicles = showVehicles.value;
        if (JSON.stringify(cleanedLinks) !== JSON.stringify(orig.social_links)) {
          updates.social_links = cleanedLinks;
        }
      }

      // Only call updateProfile if there are changes to save
      if (Object.keys(updates).length > 0) {
        await updateProfile(updates);
      }

      // Update the snapshot to reflect saved state
      snapshotCurrentState();
      avatarUrl.value = newAvatarUrl;

      if (user.value) {
        await fetchUserProfile(user.value.id);
      }

      toast.add({
        title: t('success_title'),
        description: t('success_description'),
        color: 'success',
        icon: 'i-fa6-solid-circle-check',
      });
    } catch (err: any) {
      toast.add({
        title: t('error_title'),
        description: err?.message || t('error_generic'),
        color: 'error',
        icon: 'i-fa6-solid-circle-xmark',
      });
    } finally {
      saving.value = false;
    }
  }

  const socialPlatforms = [
    { key: 'instagram', icon: 'fab fa-instagram', label: 'Instagram' },
    { key: 'youtube', icon: 'fab fa-youtube', label: 'YouTube' },
    { key: 'facebook', icon: 'fab fa-facebook', label: 'Facebook' },
    { key: 'website', icon: 'fas fa-globe', label: 'Website' },
    { key: 'tiktok', icon: 'fab fa-tiktok', label: 'TikTok' },
    { key: 'x', icon: 'fab fa-x-twitter', label: 'X' },
    { key: 'bluesky', icon: 'fab fa-bluesky', label: 'Bluesky' },
  ];

  useHead({
    title: t('title'),
    meta: [
      { name: 'description', content: t('description') },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  });
</script>

<template>
  <hero :navigation="true" :title="t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />

  <div class="container mx-auto px-4 py-6">
    <div class="mb-6">
      <breadcrumb :page="t('breadcrumb_title')" :version="BREADCRUMB_VERSIONS.PROFILE" />
    </div>

    <!-- Auth gate -->
    <div v-if="!isAuthenticated" class="max-w-lg mx-auto">
      <UCard>
        <div class="p-6 text-center">
          <div class="mb-4">
            <i class="fas fa-lock text-5xl opacity-40"></i>
          </div>
          <h2 class="text-xl font-bold mb-2">{{ t('auth.sign_in_title') }}</h2>
          <p class="text-base mb-6 opacity-70">{{ t('auth.sign_in_description') }}</p>
          <UButton to="/login" color="primary" class="w-full">
            {{ t('auth.sign_in_button') }}
          </UButton>
        </div>
      </UCard>
    </div>

    <!-- Loading -->
    <div v-else-if="profileLoading" class="flex justify-center py-12">
      <span class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
    </div>

    <!-- Fetch error -->
    <div v-else-if="fetchError" class="max-w-lg mx-auto">
      <UCard>
        <div class="p-6 text-center">
          <div class="mb-4">
            <i class="fas fa-triangle-exclamation text-5xl text-warning"></i>
          </div>
          <h2 class="text-xl font-bold mb-2">{{ t('fetch_error.title') }}</h2>
          <p class="text-base mb-6 opacity-70">{{ t('fetch_error.description') }}</p>
          <div class="flex gap-3 justify-center">
            <UButton to="/profile" variant="ghost" color="neutral">
              {{ t('fetch_error.back') }}
            </UButton>
            <UButton color="primary" @click="loadProfile">
              <i class="fas fa-arrow-rotate-right mr-1"></i>
              {{ t('fetch_error.retry') }}
            </UButton>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Authenticated content -->
    <div v-else class="max-w-5xl mx-auto space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left column: Avatar & Identity -->
        <div class="lg:col-span-1 space-y-6">
          <!-- Avatar & Name -->
          <UCard :ui="{ header: 'bg-muted p-4' }">
            <template #header>
              <div class="flex items-center">
                <i class="fad fa-user-pen mr-2"></i>
                <h2 class="text-lg font-semibold">{{ t('card_title') }}</h2>
              </div>
            </template>

            <div class="space-y-4">
              <div class="flex justify-center">
                <ProfileAvatarUpload
                  :current-url="avatarUrl ?? undefined"
                  :display-name="displayName"
                  :email="user?.email"
                  @upload="handleAvatarUpload"
                />
              </div>

              <UFormField :label="t('form.display_name.label')">
                <UInput
                  v-model="displayName"
                  type="text"
                  :placeholder="t('form.display_name.placeholder')"
                  class="w-full"
                  maxlength="50"
                  icon="i-fa6-solid-user"
                />
              </UFormField>

              <UFormField :label="t('form.location.label')">
                <ProfileLocationAutocomplete v-model="location" />
              </UFormField>
            </div>
          </UCard>

          <!-- Privacy Settings -->
          <UCard :ui="{ header: 'bg-muted p-4' }">
            <template #header>
              <div class="flex items-center">
                <i class="fad fa-shield-halved mr-2"></i>
                <h2 class="text-lg font-semibold">{{ t('privacy.title') }}</h2>
              </div>
            </template>

            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">{{ t('privacy.public_profile') }}</p>
                  <p class="text-sm opacity-60">{{ t('privacy.public_description') }}</p>
                </div>
                <USwitch v-model="isPublic" />
              </div>

              <div v-if="isPublic" class="flex items-center justify-between">
                <div>
                  <p class="font-medium">{{ t('privacy.show_vehicles') }}</p>
                  <p class="text-sm opacity-60">{{ t('privacy.vehicles_description') }}</p>
                </div>
                <USwitch v-model="showVehicles" />
              </div>
            </div>
          </UCard>
        </div>

        <!-- Right column: Bio, Social -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Bio -->
          <UCard :ui="{ header: 'bg-muted p-4' }">
            <template #header>
              <div class="flex items-center">
                <i class="fad fa-pen-to-square mr-2"></i>
                <h2 class="text-lg font-semibold">{{ t('form.bio.label') }}</h2>
              </div>
            </template>

            <UTextarea
              v-model="bio"
              :placeholder="t('form.bio.placeholder')"
              :rows="6"
              class="w-full"
              maxlength="500"
            />
          </UCard>

          <!-- Social Links -->
          <UCard :ui="{ header: 'bg-muted p-4' }">
            <template #header>
              <div class="flex items-center">
                <i class="fad fa-share-nodes mr-2"></i>
                <h2 class="text-lg font-semibold">{{ t('social.title') }}</h2>
              </div>
            </template>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField v-for="platform in socialPlatforms" :key="platform.key" :label="platform.label">
                <UInput
                  v-model="socialLinks[platform.key]"
                  type="text"
                  :placeholder="t('social.placeholder', { platform: platform.label })"
                  class="w-full"
                >
                  <template #leading>
                    <i :class="platform.icon" class="pl-1 opacity-60"></i>
                  </template>
                </UInput>
              </UFormField>
            </div>
          </UCard>
        </div>
      </div>

      <!-- Actions (full width below the grid) -->
      <div>
        <USeparator class="mb-4" />
        <p class="text-sm opacity-60 mb-4">
          <i class="fad fa-circle-info mr-1"></i>
          {{ t('shared_note') }}
        </p>
        <div class="flex gap-3">
          <UButton to="/profile" variant="ghost" color="neutral">
            {{ t('form.cancel') }}
          </UButton>
          <UButton color="primary" :loading="saving" :disabled="saving || profileLoading" @click="save">
            {{ t('form.save') }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Edit Profile - Classic Mini DIY",
    "description": "Edit your Classic Mini DIY profile.",
    "hero_title": "Classic Mini Archives",
    "breadcrumb_title": "Edit Profile",
    "card_title": "Edit Profile",
    "auth": {
      "sign_in_title": "Sign In to Edit Profile",
      "sign_in_description": "You need to be signed in to edit your profile. Create a free account to get started.",
      "sign_in_button": "Sign In to Continue"
    },
    "success_title": "Profile Updated",
    "success_description": "Your profile has been saved successfully.",
    "error_title": "Error",
    "error_generic": "Something went wrong. Please try again.",
    "error_load": "Profile could not be loaded. Please refresh the page before saving.",
    "fetch_error": {
      "title": "Unable to Load Profile",
      "description": "We couldn't load your profile data. This may be a temporary issue — please try again.",
      "retry": "Try Again",
      "back": "Back to Profile"
    },
    "form": {
      "display_name": {
        "label": "Display Name",
        "placeholder": "Enter your display name"
      },
      "location": {
        "label": "Location",
        "placeholder": "e.g. London, UK"
      },
      "bio": {
        "label": "Bio",
        "placeholder": "Tell the community a bit about yourself and your Mini"
      },
      "cancel": "Cancel",
      "save": "Save Profile"
    },
    "privacy": {
      "title": "Privacy",
      "public_profile": "Public Profile",
      "public_description": "Allow others to see your profile",
      "show_vehicles": "Show Vehicles",
      "vehicles_description": "Display your Minis on your public profile"
    },
    "social": {
      "title": "Social Links",
      "placeholder": "{platform} URL or handle"
    },
    "shared_note": "Your profile is shared across classicminidiy.com and theminiexchange.com."
  },
  "es": {
    "title": "Editar Perfil - Classic Mini DIY",
    "description": "Edita tu perfil de Classic Mini DIY.",
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_title": "Editar Perfil",
    "card_title": "Editar Perfil",
    "auth": {
      "sign_in_title": "Inicia Sesión para Editar el Perfil",
      "sign_in_description": "Debes iniciar sesión para editar tu perfil. Crea una cuenta gratuita para empezar.",
      "sign_in_button": "Iniciar Sesión para Continuar"
    },
    "success_title": "Perfil Actualizado",
    "success_description": "Tu perfil se ha guardado correctamente.",
    "error_title": "Error",
    "error_generic": "Algo salió mal. Inténtalo de nuevo.",
    "error_load": "No se pudo cargar el perfil. Actualiza la página antes de guardar.",
    "fetch_error": {
      "title": "No se pudo cargar el perfil",
      "description": "No pudimos cargar los datos de tu perfil. Puede ser un problema temporal, inténtalo de nuevo.",
      "retry": "Intentar de nuevo",
      "back": "Volver al perfil"
    },
    "form": {
      "display_name": {
        "label": "Nombre para Mostrar",
        "placeholder": "Introduce tu nombre para mostrar"
      },
      "location": {
        "label": "Ubicación",
        "placeholder": "ej. Madrid, España"
      },
      "bio": {
        "label": "Biografía",
        "placeholder": "Cuéntale a la comunidad un poco sobre ti y tu Mini"
      },
      "cancel": "Cancelar",
      "save": "Guardar Perfil"
    },
    "privacy": {
      "title": "Privacidad",
      "public_profile": "Perfil Público",
      "public_description": "Permitir que otros vean tu perfil",
      "show_vehicles": "Mostrar Vehículos",
      "vehicles_description": "Mostrar tus Minis en tu perfil público"
    },
    "social": {
      "title": "Redes Sociales",
      "placeholder": "URL o usuario de {platform}"
    },
    "shared_note": "Tu perfil se comparte entre classicminidiy.com y theminiexchange.com."
  },
  "fr": {
    "title": "Modifier le Profil - Classic Mini DIY",
    "description": "Modifiez votre profil Classic Mini DIY.",
    "hero_title": "Archives Classic Mini",
    "breadcrumb_title": "Modifier le Profil",
    "card_title": "Modifier le Profil",
    "auth": {
      "sign_in_title": "Connectez-vous pour Modifier le Profil",
      "sign_in_description": "Vous devez être connecté pour modifier votre profil. Créez un compte gratuit pour commencer.",
      "sign_in_button": "Se Connecter pour Continuer"
    },
    "success_title": "Profil Mis à Jour",
    "success_description": "Votre profil a été enregistré avec succès.",
    "error_title": "Erreur",
    "error_generic": "Une erreur est survenue. Veuillez réessayer.",
    "error_load": "Le profil n'a pas pu être chargé. Veuillez rafraîchir la page avant d'enregistrer.",
    "fetch_error": {
      "title": "Impossible de charger le profil",
      "description": "Nous n'avons pas pu charger vos données de profil. Cela peut être un problème temporaire — veuillez réessayer.",
      "retry": "Réessayer",
      "back": "Retour au profil"
    },
    "form": {
      "display_name": {
        "label": "Nom d'Affichage",
        "placeholder": "Entrez votre nom d'affichage"
      },
      "location": {
        "label": "Localisation",
        "placeholder": "ex. Paris, France"
      },
      "bio": {
        "label": "Biographie",
        "placeholder": "Présentez-vous à la communauté et parlez de votre Mini"
      },
      "cancel": "Annuler",
      "save": "Enregistrer le Profil"
    },
    "privacy": {
      "title": "Confidentialité",
      "public_profile": "Profil Public",
      "public_description": "Permettre aux autres de voir votre profil",
      "show_vehicles": "Afficher les Véhicules",
      "vehicles_description": "Afficher vos Minis sur votre profil public"
    },
    "social": {
      "title": "Liens Sociaux",
      "placeholder": "URL ou identifiant {platform}"
    },
    "shared_note": "Votre profil est partagé entre classicminidiy.com et theminiexchange.com."
  },
  "it": {
    "title": "Modifica Profilo - Classic Mini DIY",
    "description": "Modifica il tuo profilo Classic Mini DIY.",
    "hero_title": "Archivi Classic Mini",
    "breadcrumb_title": "Modifica Profilo",
    "card_title": "Modifica Profilo",
    "auth": {
      "sign_in_title": "Accedi per Modificare il Profilo",
      "sign_in_description": "Devi essere connesso per modificare il tuo profilo. Crea un account gratuito per iniziare.",
      "sign_in_button": "Accedi per Continuare"
    },
    "success_title": "Profilo Aggiornato",
    "success_description": "Il tuo profilo è stato salvato con successo.",
    "error_title": "Errore",
    "error_generic": "Qualcosa è andato storto. Riprova.",
    "error_load": "Impossibile caricare il profilo. Aggiorna la pagina prima di salvare.",
    "fetch_error": {
      "title": "Impossibile caricare il profilo",
      "description": "Non siamo riusciti a caricare i dati del tuo profilo. Potrebbe essere un problema temporaneo — riprova.",
      "retry": "Riprova",
      "back": "Torna al profilo"
    },
    "form": {
      "display_name": {
        "label": "Nome Visualizzato",
        "placeholder": "Inserisci il tuo nome visualizzato"
      },
      "location": {
        "label": "Posizione",
        "placeholder": "es. Roma, Italia"
      },
      "bio": {
        "label": "Biografia",
        "placeholder": "Racconta alla comunità qualcosa su di te e sulla tua Mini"
      },
      "cancel": "Annulla",
      "save": "Salva Profilo"
    },
    "privacy": {
      "title": "Privacy",
      "public_profile": "Profilo Pubblico",
      "public_description": "Consenti agli altri di vedere il tuo profilo",
      "show_vehicles": "Mostra Veicoli",
      "vehicles_description": "Mostra le tue Mini sul tuo profilo pubblico"
    },
    "social": {
      "title": "Link Social",
      "placeholder": "URL o nome utente {platform}"
    },
    "shared_note": "Il tuo profilo è condiviso tra classicminidiy.com e theminiexchange.com."
  },
  "de": {
    "title": "Profil Bearbeiten - Classic Mini DIY",
    "description": "Bearbeiten Sie Ihr Classic Mini DIY Profil.",
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "Profil Bearbeiten",
    "card_title": "Profil Bearbeiten",
    "auth": {
      "sign_in_title": "Anmelden zum Bearbeiten des Profils",
      "sign_in_description": "Sie müssen angemeldet sein, um Ihr Profil zu bearbeiten. Erstellen Sie ein kostenloses Konto, um zu beginnen.",
      "sign_in_button": "Anmelden und Fortfahren"
    },
    "success_title": "Profil Aktualisiert",
    "success_description": "Ihr Profil wurde erfolgreich gespeichert.",
    "error_title": "Fehler",
    "error_generic": "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
    "error_load": "Profil konnte nicht geladen werden. Bitte aktualisieren Sie die Seite vor dem Speichern.",
    "fetch_error": {
      "title": "Profil konnte nicht geladen werden",
      "description": "Wir konnten Ihre Profildaten nicht laden. Dies kann ein vorübergehendes Problem sein — bitte versuchen Sie es erneut.",
      "retry": "Erneut versuchen",
      "back": "Zurück zum Profil"
    },
    "form": {
      "display_name": {
        "label": "Anzeigename",
        "placeholder": "Geben Sie Ihren Anzeigenamen ein"
      },
      "location": {
        "label": "Standort",
        "placeholder": "z.B. Berlin, Deutschland"
      },
      "bio": {
        "label": "Biografie",
        "placeholder": "Erzählen Sie der Community etwas über sich und Ihren Mini"
      },
      "cancel": "Abbrechen",
      "save": "Profil Speichern"
    },
    "privacy": {
      "title": "Datenschutz",
      "public_profile": "Öffentliches Profil",
      "public_description": "Anderen erlauben, Ihr Profil zu sehen",
      "show_vehicles": "Fahrzeuge Anzeigen",
      "vehicles_description": "Zeigen Sie Ihre Minis auf Ihrem öffentlichen Profil"
    },
    "social": {
      "title": "Soziale Links",
      "placeholder": "{platform} URL oder Handle"
    },
    "shared_note": "Ihr Profil wird zwischen classicminidiy.com und theminiexchange.com geteilt."
  },
  "pt": {
    "title": "Editar Perfil - Classic Mini DIY",
    "description": "Edite seu perfil Classic Mini DIY.",
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb_title": "Editar Perfil",
    "card_title": "Editar Perfil",
    "auth": {
      "sign_in_title": "Entre para Editar o Perfil",
      "sign_in_description": "Você precisa estar conectado para editar seu perfil. Crie uma conta gratuita para começar.",
      "sign_in_button": "Entrar para Continuar"
    },
    "success_title": "Perfil Atualizado",
    "success_description": "Seu perfil foi salvo com sucesso.",
    "error_title": "Erro",
    "error_generic": "Algo deu errado. Tente novamente.",
    "error_load": "Não foi possível carregar o perfil. Atualize a página antes de salvar.",
    "fetch_error": {
      "title": "Não foi possível carregar o perfil",
      "description": "Não conseguimos carregar os dados do seu perfil. Pode ser um problema temporário — tente novamente.",
      "retry": "Tentar novamente",
      "back": "Voltar ao perfil"
    },
    "form": {
      "display_name": {
        "label": "Nome de Exibição",
        "placeholder": "Insira seu nome de exibição"
      },
      "location": {
        "label": "Localização",
        "placeholder": "ex. Lisboa, Portugal"
      },
      "bio": {
        "label": "Biografia",
        "placeholder": "Conte à comunidade um pouco sobre você e seu Mini"
      },
      "cancel": "Cancelar",
      "save": "Salvar Perfil"
    },
    "privacy": {
      "title": "Privacidade",
      "public_profile": "Perfil Público",
      "public_description": "Permitir que outros vejam seu perfil",
      "show_vehicles": "Mostrar Veículos",
      "vehicles_description": "Exibir seus Minis em seu perfil público"
    },
    "social": {
      "title": "Links Sociais",
      "placeholder": "URL ou usuário {platform}"
    },
    "shared_note": "Seu perfil é compartilhado entre classicminidiy.com e theminiexchange.com."
  },
  "ru": {
    "title": "Редактировать Профиль - Classic Mini DIY",
    "description": "Редактируйте свой профиль Classic Mini DIY.",
    "hero_title": "Архивы Classic Mini",
    "breadcrumb_title": "Редактировать Профиль",
    "card_title": "Редактировать Профиль",
    "auth": {
      "sign_in_title": "Войдите для Редактирования Профиля",
      "sign_in_description": "Вы должны быть авторизованы для редактирования профиля. Создайте бесплатную учётную запись для начала.",
      "sign_in_button": "Войти для Продолжения"
    },
    "success_title": "Профиль Обновлён",
    "success_description": "Ваш профиль успешно сохранён.",
    "error_title": "Ошибка",
    "error_generic": "Что-то пошло не так. Попробуйте ещё раз.",
    "error_load": "Не удалось загрузить профиль. Обновите страницу перед сохранением.",
    "fetch_error": {
      "title": "Не удалось загрузить профиль",
      "description": "Мы не смогли загрузить данные вашего профиля. Это может быть временная проблема — попробуйте ещё раз.",
      "retry": "Попробовать снова",
      "back": "Вернуться к профилю"
    },
    "form": {
      "display_name": {
        "label": "Отображаемое Имя",
        "placeholder": "Введите отображаемое имя"
      },
      "location": {
        "label": "Местоположение",
        "placeholder": "напр. Москва, Россия"
      },
      "bio": {
        "label": "О себе",
        "placeholder": "Расскажите сообществу о себе и своём Mini"
      },
      "cancel": "Отмена",
      "save": "Сохранить Профиль"
    },
    "privacy": {
      "title": "Конфиденциальность",
      "public_profile": "Публичный Профиль",
      "public_description": "Разрешить другим видеть ваш профиль",
      "show_vehicles": "Показать Автомобили",
      "vehicles_description": "Показывать ваши Mini в публичном профиле"
    },
    "social": {
      "title": "Социальные Сети",
      "placeholder": "URL или логин {platform}"
    },
    "shared_note": "Ваш профиль используется на classicminidiy.com и theminiexchange.com."
  },
  "ja": {
    "title": "プロフィール編集 - Classic Mini DIY",
    "description": "Classic Mini DIYのプロフィールを編集します。",
    "hero_title": "Classic Mini アーカイブ",
    "breadcrumb_title": "プロフィール編集",
    "card_title": "プロフィール編集",
    "auth": {
      "sign_in_title": "プロフィール編集にはログインが必要です",
      "sign_in_description": "プロフィールを編集するにはログインが必要です。無料アカウントを作成して始めましょう。",
      "sign_in_button": "ログインして続行"
    },
    "success_title": "プロフィール更新完了",
    "success_description": "プロフィールが正常に保存されました。",
    "error_title": "エラー",
    "error_generic": "問題が発生しました。もう一度お試しください。",
    "error_load": "プロフィールを読み込めませんでした。保存する前にページを更新してください。",
    "fetch_error": {
      "title": "プロフィールを読み込めませんでした",
      "description": "プロフィールデータを読み込めませんでした。一時的な問題の可能性があります。もう一度お試しください。",
      "retry": "もう一度試す",
      "back": "プロフィールに戻る"
    },
    "form": {
      "display_name": {
        "label": "表示名",
        "placeholder": "表示名を入力"
      },
      "location": {
        "label": "場所",
        "placeholder": "例：東京、日本"
      },
      "bio": {
        "label": "自己紹介",
        "placeholder": "あなたとあなたのMiniについてコミュニティに教えてください"
      },
      "cancel": "キャンセル",
      "save": "プロフィールを保存"
    },
    "privacy": {
      "title": "プライバシー",
      "public_profile": "公開プロフィール",
      "public_description": "他のユーザーにプロフィールを公開する",
      "show_vehicles": "車両を表示",
      "vehicles_description": "公開プロフィールにMiniを表示する"
    },
    "social": {
      "title": "ソーシャルリンク",
      "placeholder": "{platform}のURLまたはハンドル"
    },
    "shared_note": "あなたのプロフィールはclassicminidiy.comとtheminiexchange.comで共有されます。"
  },
  "zh": {
    "title": "编辑个人资料 - Classic Mini DIY",
    "description": "编辑您的Classic Mini DIY个人资料。",
    "hero_title": "Classic Mini 档案",
    "breadcrumb_title": "编辑个人资料",
    "card_title": "编辑个人资料",
    "auth": {
      "sign_in_title": "登录以编辑个人资料",
      "sign_in_description": "您需要登录才能编辑个人资料。创建一个免费账户开始使用。",
      "sign_in_button": "登录以继续"
    },
    "success_title": "个人资料已更新",
    "success_description": "您的个人资料已成功保存。",
    "error_title": "错误",
    "error_generic": "出现问题，请重试。",
    "error_load": "无法加载个人资料。请在保存前刷新页面。",
    "fetch_error": {
      "title": "无法加载个人资料",
      "description": "我们无法加载您的个人资料数据。这可能是一个临时问题——请重试。",
      "retry": "重试",
      "back": "返回个人资料"
    },
    "form": {
      "display_name": {
        "label": "显示名称",
        "placeholder": "输入您的显示名称"
      },
      "location": {
        "label": "位置",
        "placeholder": "例如：北京，中国"
      },
      "bio": {
        "label": "个人简介",
        "placeholder": "向社区介绍一下您和您的Mini"
      },
      "cancel": "取消",
      "save": "保存个人资料"
    },
    "privacy": {
      "title": "隐私",
      "public_profile": "公开资料",
      "public_description": "允许他人查看您的资料",
      "show_vehicles": "显示车辆",
      "vehicles_description": "在公开资料中展示您的Mini"
    },
    "social": {
      "title": "社交链接",
      "placeholder": "{platform} URL或用户名"
    },
    "shared_note": "您的个人资料在classicminidiy.com和theminiexchange.com之间共享。"
  },
  "ko": {
    "title": "프로필 편집 - Classic Mini DIY",
    "description": "Classic Mini DIY 프로필을 편집합니다.",
    "hero_title": "Classic Mini 아카이브",
    "breadcrumb_title": "프로필 편집",
    "card_title": "프로필 편집",
    "auth": {
      "sign_in_title": "프로필 편집을 위해 로그인하세요",
      "sign_in_description": "프로필을 편집하려면 로그인해야 합니다. 무료 계정을 만들어 시작하세요.",
      "sign_in_button": "로그인하여 계속"
    },
    "success_title": "프로필 업데이트 완료",
    "success_description": "프로필이 성공적으로 저장되었습니다.",
    "error_title": "오류",
    "error_generic": "문제가 발생했습니다. 다시 시도해주세요.",
    "error_load": "프로필을 불러올 수 없습니다. 저장하기 전에 페이지를 새로고침해주세요.",
    "fetch_error": {
      "title": "프로필을 불러올 수 없습니다",
      "description": "프로필 데이터를 불러오지 못했습니다. 일시적인 문제일 수 있습니다. 다시 시도해주세요.",
      "retry": "다시 시도",
      "back": "프로필로 돌아가기"
    },
    "form": {
      "display_name": {
        "label": "표시 이름",
        "placeholder": "표시 이름을 입력하세요"
      },
      "location": {
        "label": "위치",
        "placeholder": "예: 서울, 한국"
      },
      "bio": {
        "label": "소개",
        "placeholder": "커뮤니티에 당신과 당신의 Mini에 대해 알려주세요"
      },
      "cancel": "취소",
      "save": "프로필 저장"
    },
    "privacy": {
      "title": "개인정보",
      "public_profile": "공개 프로필",
      "public_description": "다른 사용자가 프로필을 볼 수 있도록 허용",
      "show_vehicles": "차량 표시",
      "vehicles_description": "공개 프로필에 Mini를 표시"
    },
    "social": {
      "title": "소셜 링크",
      "placeholder": "{platform} URL 또는 핸들"
    },
    "shared_note": "프로필은 classicminidiy.com과 theminiexchange.com에서 공유됩니다."
  }
}
</i18n>
