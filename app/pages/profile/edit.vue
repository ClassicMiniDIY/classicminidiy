<script lang="ts" setup>
  import { HERO_TYPES } from '../../../data/models/generic';

  const { t } = useI18n();
  const { isAuthenticated, user, userProfile, fetchUserProfile } = useAuth();
  const { fetchProfile, updateProfile, uploadAvatar, checkUsernameAvailability } = useProfile();

  const displayName = ref('');
  const bio = ref('');
  const location = ref('');
  const username = ref('');
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
  const saved = ref(false);
  const saveError = ref('');
  const profileLoading = ref(true);

  // Username availability
  const usernameAvailable = ref<boolean | null>(null);
  const usernameChecking = ref(false);
  let usernameDebounce: ReturnType<typeof setTimeout> | null = null;

  // Load full profile on mount
  onMounted(async () => {
    if (!user.value) {
      profileLoading.value = false;
      return;
    }
    try {
      const profile = await fetchProfile();
      if (profile) {
        displayName.value = profile.display_name || '';
        bio.value = profile.bio || '';
        location.value = profile.location || '';
        username.value = profile.username || '';
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
    } catch {
      // Profile fetch failed — form stays empty
    } finally {
      profileLoading.value = false;
    }
  });

  // Debounced username check
  watch(username, (val) => {
    usernameAvailable.value = null;
    if (usernameDebounce) clearTimeout(usernameDebounce);
    if (!val || val.length < 3) return;

    usernameDebounce = setTimeout(async () => {
      usernameChecking.value = true;
      try {
        usernameAvailable.value = await checkUsernameAvailability(val);
      } catch {
        usernameAvailable.value = null;
      } finally {
        usernameChecking.value = false;
      }
    }, 500);
  });

  function handleAvatarUpload(file: File) {
    avatarFile.value = file;
  }

  async function save() {
    saving.value = true;
    saved.value = false;
    saveError.value = '';

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

      await updateProfile({
        display_name: displayName.value.trim() || null,
        bio: bio.value.trim() || null,
        location: location.value.trim() || null,
        username: username.value.trim() || null,
        avatar_url: newAvatarUrl,
        is_public: isPublic.value,
        show_vehicles: showVehicles.value,
        social_links: cleanedLinks,
      });

      if (user.value) {
        await fetchUserProfile(user.value.id);
      }

      avatarUrl.value = newAvatarUrl;
      saved.value = true;
    } catch (err: any) {
      saveError.value = err?.message || t('error_generic');
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
      <breadcrumb :page="t('breadcrumb_title')" />
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

    <!-- Authenticated content -->
    <div v-else class="max-w-2xl mx-auto space-y-6">
      <!-- Success alert -->
      <UAlert v-if="saved" color="success" :title="t('success_title')" :description="t('success_description')" />

      <!-- Error alert -->
      <UAlert v-if="saveError" color="error" :title="t('error_title')" :description="saveError" />

      <form @submit.prevent="save" class="space-y-6">
        <!-- Avatar & Basic Info -->
        <UCard>
          <template #header>
            <div class="flex items-center bg-muted -m-4 p-4">
              <i class="fad fa-user-pen mr-2"></i>
              <h2 class="text-lg font-semibold">{{ t('card_title') }}</h2>
            </div>
          </template>

          <div class="p-4 space-y-4">
            <!-- Avatar -->
            <div class="flex justify-center">
              <ProfileAvatarUpload
                :current-url="avatarUrl ?? undefined"
                :display-name="displayName"
                :email="user?.email"
                @upload="handleAvatarUpload"
              />
            </div>

            <!-- Display Name -->
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

            <!-- Location -->
            <UFormField :label="t('form.location.label')">
              <UInput
                v-model="location"
                type="text"
                :placeholder="t('form.location.placeholder')"
                class="w-full"
                maxlength="100"
                icon="i-fa6-solid-location-dot"
              />
            </UFormField>

            <!-- Bio -->
            <UFormField :label="t('form.bio.label')">
              <UTextarea
                v-model="bio"
                :placeholder="t('form.bio.placeholder')"
                :rows="4"
                class="w-full"
                maxlength="500"
              />
            </UFormField>

            <!-- Username -->
            <UFormField :label="t('form.username.label')">
              <UInput
                v-model="username"
                type="text"
                :placeholder="t('form.username.placeholder')"
                class="w-full"
                maxlength="30"
              >
                <template #leading>
                  <span class="text-sm opacity-60 pl-1">@</span>
                </template>
              </UInput>
              <template #help>
                <span v-if="usernameChecking" class="text-xs opacity-50">
                  <i class="fas fa-spinner fa-spin mr-1"></i>{{ t('form.username.checking') }}
                </span>
                <span v-else-if="usernameAvailable === true" class="text-xs text-green-600">
                  <i class="fas fa-check mr-1"></i>{{ t('form.username.available') }}
                </span>
                <span v-else-if="usernameAvailable === false" class="text-xs text-red-500">
                  <i class="fas fa-xmark mr-1"></i>{{ t('form.username.taken') }}
                </span>
                <span v-else-if="username" class="text-xs opacity-50">
                  classicminidiy.com/users/{{ username }}
                </span>
              </template>
            </UFormField>
          </div>
        </UCard>

        <!-- Privacy Settings -->
        <UCard>
          <template #header>
            <div class="flex items-center bg-muted -m-4 p-4">
              <i class="fad fa-shield-halved mr-2"></i>
              <h2 class="text-lg font-semibold">{{ t('privacy.title') }}</h2>
            </div>
          </template>

          <div class="p-4 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{{ t('privacy.public_profile') }}</p>
                <p class="text-sm opacity-60">{{ t('privacy.public_description') }}</p>
              </div>
              <UToggle v-model="isPublic" />
            </div>

            <div v-if="isPublic" class="flex items-center justify-between">
              <div>
                <p class="font-medium">{{ t('privacy.show_vehicles') }}</p>
                <p class="text-sm opacity-60">{{ t('privacy.vehicles_description') }}</p>
              </div>
              <UToggle v-model="showVehicles" />
            </div>
          </div>
        </UCard>

        <!-- Social Links -->
        <UCard>
          <template #header>
            <div class="flex items-center bg-muted -m-4 p-4">
              <i class="fad fa-share-nodes mr-2"></i>
              <h2 class="text-lg font-semibold">{{ t('social.title') }}</h2>
            </div>
          </template>

          <div class="p-4 space-y-3">
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

        <!-- Actions -->
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
            <UButton type="submit" color="primary" :loading="saving" :disabled="saving">
              {{ t('form.save') }}
            </UButton>
          </div>
        </div>
      </form>
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
      "username": {
        "label": "Username",
        "placeholder": "your-username",
        "checking": "Checking availability...",
        "available": "Username is available",
        "taken": "Username is taken or invalid"
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
      "username": {
        "label": "Nombre de Usuario",
        "placeholder": "tu-usuario",
        "checking": "Comprobando disponibilidad...",
        "available": "Nombre de usuario disponible",
        "taken": "Nombre de usuario no disponible"
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
      "username": {
        "label": "Nom d'Utilisateur",
        "placeholder": "votre-pseudo",
        "checking": "Vérification...",
        "available": "Nom d'utilisateur disponible",
        "taken": "Nom d'utilisateur indisponible"
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
      "username": {
        "label": "Nome Utente",
        "placeholder": "tuo-nome-utente",
        "checking": "Verifica in corso...",
        "available": "Nome utente disponibile",
        "taken": "Nome utente non disponibile"
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
      "username": {
        "label": "Benutzername",
        "placeholder": "ihr-benutzername",
        "checking": "Verfügbarkeit wird geprüft...",
        "available": "Benutzername ist verfügbar",
        "taken": "Benutzername ist nicht verfügbar"
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
      "username": {
        "label": "Nome de Usuário",
        "placeholder": "seu-usuario",
        "checking": "Verificando disponibilidade...",
        "available": "Nome de usuário disponível",
        "taken": "Nome de usuário indisponível"
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
      "username": {
        "label": "Имя пользователя",
        "placeholder": "ваш-логин",
        "checking": "Проверка доступности...",
        "available": "Имя пользователя доступно",
        "taken": "Имя пользователя занято"
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
      "username": {
        "label": "ユーザー名",
        "placeholder": "your-username",
        "checking": "確認中...",
        "available": "利用可能です",
        "taken": "利用できません"
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
      "username": {
        "label": "用户名",
        "placeholder": "your-username",
        "checking": "检查中...",
        "available": "用户名可用",
        "taken": "用户名不可用"
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
      "username": {
        "label": "사용자 이름",
        "placeholder": "your-username",
        "checking": "확인 중...",
        "available": "사용 가능합니다",
        "taken": "사용할 수 없습니다"
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
