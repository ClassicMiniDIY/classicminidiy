<script setup lang="ts">
  import type { CurrencyCode } from '~/composables/useCurrency';

  definePageMeta({
    middleware: 'exchange-auth',
    layout: false,
  });

  const { t } = useI18n();
  useSeoMeta({
    title: () => t('seo.title'),
    robots: 'noindex, nofollow',
  });

  const { user, fetchUserProfile } = useAuth();
  const { uploadAvatar, completeOnboarding } = useProfile();
  const { SUPPORTED_CURRENCIES, setUserCurrency } = useCurrency();
  const supabase = useSupabase();
  const toast = useToast();
  const route = useRoute();

  // Only honor internal redirect targets; default back into the exchange.
  const redirectTarget = computed(() => {
    const r = route.query.redirect;
    if (typeof r === 'string' && r.startsWith('/') && !r.startsWith('//')) return r;
    return '/exchange';
  });

  // If onboarding is already complete, don't show the form — bounce to the target.
  onMounted(async () => {
    if (!user.value?.id) return;
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.value.id)
        .single();
      if (!error && profile?.onboarding_completed) {
        await navigateTo(redirectTarget.value);
      }
    } catch (error) {
      console.warn('Failed to check onboarding status:', error);
    }
  });

  // Form state
  const displayName = ref('');
  const bio = ref('');
  const preferredCurrency = ref<CurrencyCode>('USD');
  // Until the user explicitly picks a currency, it auto-follows the location country.
  const currencyTouchedByUser = ref(false);
  const uploadedFile = ref<File | null>(null);
  const avatarPreview = ref<string | null>(null);
  const fileInputRef = ref<HTMLInputElement | null>(null);
  const isSubmitting = ref(false);

  const locationData = ref({
    city: '',
    state_province: '',
    country: '',
    postal_code: '',
    latitude: null as number | null,
    longitude: null as number | null,
    formatted_address: '',
  });

  // Auto-derive preferred currency from the selected country until overridden.
  watch(
    () => locationData.value.country,
    (country) => {
      if (currencyTouchedByUser.value) return;
      const derived = currencyForCountry(country);
      if (derived) {
        preferredCurrency.value = derived;
      }
    }
  );

  const onCurrencyChange = () => {
    currencyTouchedByUser.value = true;
  };

  // Validation
  const displayNameError = ref('');
  const locationError = ref('');

  const validateForm = () => {
    let isValid = true;

    if (!displayName.value.trim()) {
      displayNameError.value = t('displayName.errors.required');
      isValid = false;
    } else if (displayName.value.length < 2) {
      displayNameError.value = t('displayName.errors.min');
      isValid = false;
    } else if (displayName.value.length > 50) {
      displayNameError.value = t('displayName.errors.max');
      isValid = false;
    } else {
      displayNameError.value = '';
    }

    if (!locationData.value.formatted_address.trim()) {
      locationError.value = t('location.error');
      isValid = false;
    } else {
      locationError.value = '';
    }

    return isValid;
  };

  const getEmailInitial = () => {
    if (!user.value?.email) return '?';
    return user.value.email.charAt(0).toUpperCase();
  };

  const triggerFileUpload = () => {
    fileInputRef.value?.click();
  };

  const handleAvatarSelect = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.add({ title: t('toast.invalidType.title'), description: t('toast.invalidType.body'), color: 'error' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.add({ title: t('toast.tooLarge.title'), description: t('toast.tooLarge.body'), color: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      avatarPreview.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);
    uploadedFile.value = file;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    isSubmitting.value = true;

    try {
      let avatarUrl = null;
      if (uploadedFile.value) {
        avatarUrl = await uploadAvatar(uploadedFile.value);
      }

      await completeOnboarding({
        display_name: displayName.value.trim(),
        location: locationData.value.formatted_address.trim(),
        bio: bio.value.trim() || undefined,
        avatar_url: avatarUrl || undefined,
        preferred_currency: preferredCurrency.value,
      });

      // Refresh shared auth profile so the nudge clears + the exchange unlocks.
      if (user.value?.id) {
        await fetchUserProfile(user.value.id);
      }

      // Sync viewer currency + localStorage. No userId — completeOnboarding
      // already persisted preferred_currency, so passing one would double-write.
      await setUserCurrency(preferredCurrency.value);

      toast.add({ title: t('toast.success.title'), description: t('toast.success.body'), color: 'success' });

      await navigateTo(redirectTarget.value);
    } catch (error: any) {
      toast.add({
        title: t('toast.fail.title'),
        description: error?.message || t('toast.fail.body'),
        color: 'error',
      });
    } finally {
      isSubmitting.value = false;
    }
  };
</script>

<template>
  <div class="min-h-screen bg-base-200 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-2xl w-full">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <!-- Header -->
          <div class="text-center mb-8">
            <h1 class="text-3xl font-bold mb-2">{{ t('header.title') }}</h1>
            <p class="opacity-70">{{ t('header.subtitle') }}</p>
          </div>

          <!-- Form -->
          <form @submit.prevent="handleSubmit" class="space-y-6">
            <!-- Avatar Selection -->
            <div>
              <label class="label">
                <span class="label-text font-medium">{{ t('avatar.label') }}</span>
                <span class="label-text-alt opacity-70">{{ t('avatar.hint') }}</span>
              </label>

              <div class="flex flex-col items-center gap-4">
                <div
                  class="relative cursor-pointer group"
                  role="button"
                  tabindex="0"
                  :aria-label="t('avatar.upload')"
                  @click="triggerFileUpload"
                  @keydown.enter.prevent="triggerFileUpload"
                  @keydown.space.prevent="triggerFileUpload"
                >
                  <div class="avatar">
                    <div class="w-32 h-32 rounded-full bg-neutral text-neutral-content">
                      <img
                        v-if="avatarPreview"
                        :src="avatarPreview"
                        :alt="t('avatar.label')"
                        class="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div v-else class="flex items-center justify-center h-full">
                        <span class="text-5xl font-semibold">{{ getEmailInitial() }}</span>
                      </div>
                    </div>
                  </div>

                  <div
                    class="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center"
                  >
                    <i class="fas fa-camera text-2xl text-white mb-1" aria-hidden="true"></i>
                    <span class="text-sm font-medium text-white">{{ t('avatar.upload') }}</span>
                  </div>
                </div>

                <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="handleAvatarSelect" />

                <div class="text-center">
                  <p class="text-sm opacity-70">
                    {{ avatarPreview ? t('avatar.selected') : t('avatar.none') }}
                  </p>
                  <p class="text-xs opacity-60 mt-1">{{ t('avatar.constraints') }}</p>
                </div>
              </div>
            </div>

            <div class="divider"></div>

            <!-- Display Name -->
            <fieldset>
              <legend class="fieldset-legend">
                <span class="label-text font-medium">
                  {{ t('displayName.label') }}
                  <span class="text-error">*</span>
                </span>
              </legend>
              <input
                v-model="displayName"
                type="text"
                :placeholder="t('displayName.placeholder')"
                class="input input-bordered w-full"
                :class="{ 'input-error': displayNameError }"
                maxlength="50"
                required
                @input="displayNameError = ''"
              />
              <label v-if="displayNameError" class="label">
                <span class="label-text-alt text-error">{{ displayNameError }}</span>
              </label>
              <label v-else class="label">
                <span class="label-text-alt opacity-70">{{ t('displayName.hint') }}</span>
              </label>
            </fieldset>

            <!-- Location -->
            <div>
              <div class="flex items-center gap-2 mb-2">
                <h3 class="fieldset-legend">
                  {{ t('location.label') }}
                  <span class="text-error">*</span>
                </h3>
              </div>
              <ExchangeListingsLocationAutocomplete v-model="locationData" />
              <label v-if="locationError" class="label">
                <span class="label-text-alt text-error">{{ locationError }}</span>
              </label>
              <label v-else class="label">
                <span class="label-text-alt opacity-70">
                  <i class="fas fa-circle-info"></i>
                  {{ t('location.hint') }}
                </span>
              </label>
            </div>

            <!-- Preferred Currency -->
            <fieldset>
              <legend class="fieldset-legend">
                <span class="label-text font-medium">{{ t('currency.label') }}</span>
              </legend>
              <select
                v-model="preferredCurrency"
                class="select select-bordered w-full"
                :aria-label="t('currency.label')"
                @change="onCurrencyChange"
              >
                <option v-for="currency in SUPPORTED_CURRENCIES" :key="currency.code" :value="currency.code">
                  {{ currency.symbol }} {{ currency.name }} ({{ currency.code }})
                </option>
              </select>
              <label class="label">
                <span class="label-text-alt opacity-70">{{ t('currency.hint') }}</span>
              </label>
            </fieldset>

            <!-- Bio (Optional) -->
            <fieldset>
              <legend class="fieldset-legend">
                <span class="label-text font-medium">{{ t('bio.label') }}</span>
                <span class="label-text-alt opacity-70">{{ t('bio.optional') }}</span>
              </legend>
              <textarea
                v-model="bio"
                class="textarea textarea-bordered w-full"
                :placeholder="t('bio.placeholder')"
                rows="4"
                maxlength="500"
              ></textarea>
              <label class="label">
                <span class="label-text-alt opacity-70">{{ t('bio.counter', { count: bio.length }) }}</span>
              </label>
            </fieldset>

            <div class="divider"></div>

            <!-- Submit Button -->
            <div class="card-actions justify-end">
              <button type="submit" class="btn btn-primary btn-lg w-full sm:w-auto" :disabled="isSubmitting">
                <span v-if="isSubmitting" class="loading loading-spinner"></span>
                <span v-else>{{ t('submit') }}</span>
              </button>
            </div>
          </form>

          <!-- Info Box -->
          <div class="alert mt-6">
            <i class="fas fa-circle-info"></i>
            <div>
              <p class="text-sm">{{ t('info') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "seo": { "title": "Welcome - The Mini Exchange" },
    "header": { "title": "Welcome to The Mini Exchange!", "subtitle": "Let's set up your profile to get started" },
    "avatar": { "label": "Profile Picture", "hint": "Click to upload", "upload": "Upload", "selected": "Photo selected!", "none": "No photo - your email initial will be shown", "constraints": "Max 5MB • JPG, PNG, or WebP" },
    "displayName": { "label": "Display Name", "placeholder": "How should we call you?", "hint": "This is how others will see your name", "errors": { "required": "Display name is required", "min": "Display name must be at least 2 characters", "max": "Display name must be less than 50 characters" } },
    "location": { "label": "Location", "error": "Location is required", "hint": "Only your country will be shown publicly on your profile" },
    "currency": { "label": "Preferred Currency", "hint": "Defaults to your country's currency. New listings will use this currency and prices will be shown converted for visitors using a different one." },
    "bio": { "label": "Bio", "optional": "Optional", "placeholder": "Tell us about yourself and your Classic Mini passion...", "counter": "{count}/500 characters" },
    "submit": "Complete Setup",
    "info": "You can always update your profile later in your account settings.",
    "toast": { "success": { "title": "Welcome to The Mini Exchange!", "body": "Your profile has been set up successfully." }, "fail": { "title": "Failed to complete setup", "body": "An error occurred" }, "invalidType": { "title": "Invalid file type", "body": "Please select an image file" }, "tooLarge": { "title": "File too large", "body": "Please select an image smaller than 5MB" } }
  },
  "es": {
    "seo": { "title": "Bienvenido - The Mini Exchange" },
    "header": { "title": "¡Bienvenido a The Mini Exchange!", "subtitle": "Configuremos tu perfil para empezar" },
    "avatar": { "label": "Foto de perfil", "hint": "Haz clic para subir", "upload": "Subir", "selected": "¡Foto seleccionada!", "none": "Sin foto: se mostrará la inicial de tu correo", "constraints": "Máx. 5MB • JPG, PNG o WebP" },
    "displayName": { "label": "Nombre visible", "placeholder": "¿Cómo quieres que te llamemos?", "hint": "Así es como otros verán tu nombre", "errors": { "required": "El nombre visible es obligatorio", "min": "El nombre visible debe tener al menos 2 caracteres", "max": "El nombre visible debe tener menos de 50 caracteres" } },
    "location": { "label": "Ubicación", "error": "La ubicación es obligatoria", "hint": "Solo tu país se mostrará públicamente en tu perfil" },
    "currency": { "label": "Moneda preferida", "hint": "Por defecto, la moneda de tu país. Los nuevos anuncios usarán esta moneda y los precios se mostrarán convertidos para visitantes que usen otra." },
    "bio": { "label": "Biografía", "optional": "Opcional", "placeholder": "Cuéntanos sobre ti y tu pasión por el Classic Mini...", "counter": "{count}/500 caracteres" },
    "submit": "Completar configuración",
    "info": "Siempre puedes actualizar tu perfil más tarde en los ajustes de tu cuenta.",
    "toast": { "success": { "title": "¡Bienvenido a The Mini Exchange!", "body": "Tu perfil se ha configurado correctamente." }, "fail": { "title": "No se pudo completar la configuración", "body": "Se produjo un error" }, "invalidType": { "title": "Tipo de archivo no válido", "body": "Selecciona un archivo de imagen" }, "tooLarge": { "title": "Archivo demasiado grande", "body": "Selecciona una imagen de menos de 5MB" } }
  },
  "fr": {
    "seo": { "title": "Bienvenue - The Mini Exchange" },
    "header": { "title": "Bienvenue sur The Mini Exchange !", "subtitle": "Configurons votre profil pour commencer" },
    "avatar": { "label": "Photo de profil", "hint": "Cliquez pour téléverser", "upload": "Téléverser", "selected": "Photo sélectionnée !", "none": "Pas de photo : l'initiale de votre e-mail sera affichée", "constraints": "Max 5 Mo • JPG, PNG ou WebP" },
    "displayName": { "label": "Nom affiché", "placeholder": "Comment devons-nous vous appeler ?", "hint": "C'est ainsi que les autres verront votre nom", "errors": { "required": "Le nom affiché est obligatoire", "min": "Le nom affiché doit comporter au moins 2 caractères", "max": "Le nom affiché doit comporter moins de 50 caractères" } },
    "location": { "label": "Localisation", "error": "La localisation est obligatoire", "hint": "Seul votre pays sera affiché publiquement sur votre profil" },
    "currency": { "label": "Devise préférée", "hint": "Par défaut, la devise de votre pays. Les nouvelles annonces utiliseront cette devise et les prix seront convertis pour les visiteurs qui en utilisent une autre." },
    "bio": { "label": "Bio", "optional": "Facultatif", "placeholder": "Parlez-nous de vous et de votre passion pour la Classic Mini...", "counter": "{count}/500 caractères" },
    "submit": "Terminer la configuration",
    "info": "Vous pourrez toujours mettre à jour votre profil plus tard dans les paramètres de votre compte.",
    "toast": { "success": { "title": "Bienvenue sur The Mini Exchange !", "body": "Votre profil a été configuré avec succès." }, "fail": { "title": "Échec de la configuration", "body": "Une erreur s'est produite" }, "invalidType": { "title": "Type de fichier non valide", "body": "Veuillez sélectionner un fichier image" }, "tooLarge": { "title": "Fichier trop volumineux", "body": "Veuillez sélectionner une image de moins de 5 Mo" } }
  },
  "de": {
    "seo": { "title": "Willkommen - The Mini Exchange" },
    "header": { "title": "Willkommen bei The Mini Exchange!", "subtitle": "Richten wir dein Profil ein, um loszulegen" },
    "avatar": { "label": "Profilbild", "hint": "Zum Hochladen klicken", "upload": "Hochladen", "selected": "Foto ausgewählt!", "none": "Kein Foto – die Initiale deiner E-Mail wird angezeigt", "constraints": "Max. 5 MB • JPG, PNG oder WebP" },
    "displayName": { "label": "Anzeigename", "placeholder": "Wie sollen wir dich nennen?", "hint": "So sehen andere deinen Namen", "errors": { "required": "Anzeigename ist erforderlich", "min": "Der Anzeigename muss mindestens 2 Zeichen lang sein", "max": "Der Anzeigename muss weniger als 50 Zeichen lang sein" } },
    "location": { "label": "Standort", "error": "Standort ist erforderlich", "hint": "Nur dein Land wird öffentlich in deinem Profil angezeigt" },
    "currency": { "label": "Bevorzugte Währung", "hint": "Standardmäßig die Währung deines Landes. Neue Inserate verwenden diese Währung; für Besucher mit anderer Währung werden die Preise umgerechnet angezeigt." },
    "bio": { "label": "Bio", "optional": "Optional", "placeholder": "Erzähl uns von dir und deiner Leidenschaft für den Classic Mini...", "counter": "{count}/500 Zeichen" },
    "submit": "Einrichtung abschließen",
    "info": "Du kannst dein Profil jederzeit später in deinen Kontoeinstellungen aktualisieren.",
    "toast": { "success": { "title": "Willkommen bei The Mini Exchange!", "body": "Dein Profil wurde erfolgreich eingerichtet." }, "fail": { "title": "Einrichtung fehlgeschlagen", "body": "Ein Fehler ist aufgetreten" }, "invalidType": { "title": "Ungültiger Dateityp", "body": "Bitte wähle eine Bilddatei" }, "tooLarge": { "title": "Datei zu groß", "body": "Bitte wähle ein Bild unter 5 MB" } }
  },
  "it": {
    "seo": { "title": "Benvenuto - The Mini Exchange" },
    "header": { "title": "Benvenuto su The Mini Exchange!", "subtitle": "Configuriamo il tuo profilo per iniziare" },
    "avatar": { "label": "Immagine del profilo", "hint": "Clicca per caricare", "upload": "Carica", "selected": "Foto selezionata!", "none": "Nessuna foto: verrà mostrata l'iniziale della tua email", "constraints": "Max 5MB • JPG, PNG o WebP" },
    "displayName": { "label": "Nome visualizzato", "placeholder": "Come dobbiamo chiamarti?", "hint": "Questo è il nome che gli altri vedranno", "errors": { "required": "Il nome visualizzato è obbligatorio", "min": "Il nome visualizzato deve contenere almeno 2 caratteri", "max": "Il nome visualizzato deve contenere meno di 50 caratteri" } },
    "location": { "label": "Posizione", "error": "La posizione è obbligatoria", "hint": "Solo il tuo paese sarà mostrato pubblicamente sul tuo profilo" },
    "currency": { "label": "Valuta preferita", "hint": "Predefinita sulla valuta del tuo paese. I nuovi annunci useranno questa valuta e i prezzi saranno mostrati convertiti per i visitatori che ne usano un'altra." },
    "bio": { "label": "Biografia", "optional": "Facoltativa", "placeholder": "Raccontaci di te e della tua passione per la Classic Mini...", "counter": "{count}/500 caratteri" },
    "submit": "Completa la configurazione",
    "info": "Puoi sempre aggiornare il tuo profilo più tardi nelle impostazioni dell'account.",
    "toast": { "success": { "title": "Benvenuto su The Mini Exchange!", "body": "Il tuo profilo è stato configurato correttamente." }, "fail": { "title": "Configurazione non riuscita", "body": "Si è verificato un errore" }, "invalidType": { "title": "Tipo di file non valido", "body": "Seleziona un file immagine" }, "tooLarge": { "title": "File troppo grande", "body": "Seleziona un'immagine inferiore a 5MB" } }
  },
  "pt": {
    "seo": { "title": "Bem-vindo - The Mini Exchange" },
    "header": { "title": "Bem-vindo ao The Mini Exchange!", "subtitle": "Vamos configurar o seu perfil para começar" },
    "avatar": { "label": "Foto de perfil", "hint": "Clique para enviar", "upload": "Enviar", "selected": "Foto selecionada!", "none": "Sem foto: a inicial do seu e-mail será exibida", "constraints": "Máx. 5MB • JPG, PNG ou WebP" },
    "displayName": { "label": "Nome de exibição", "placeholder": "Como devemos chamá-lo?", "hint": "É assim que os outros verão o seu nome", "errors": { "required": "O nome de exibição é obrigatório", "min": "O nome de exibição deve ter pelo menos 2 caracteres", "max": "O nome de exibição deve ter menos de 50 caracteres" } },
    "location": { "label": "Localização", "error": "A localização é obrigatória", "hint": "Apenas o seu país será exibido publicamente no seu perfil" },
    "currency": { "label": "Moeda preferida", "hint": "Padrão para a moeda do seu país. Os novos anúncios usarão esta moeda e os preços serão exibidos convertidos para visitantes que usam outra." },
    "bio": { "label": "Bio", "optional": "Opcional", "placeholder": "Conte-nos sobre você e a sua paixão pelo Classic Mini...", "counter": "{count}/500 caracteres" },
    "submit": "Concluir configuração",
    "info": "Você sempre pode atualizar o seu perfil depois nas configurações da conta.",
    "toast": { "success": { "title": "Bem-vindo ao The Mini Exchange!", "body": "O seu perfil foi configurado com sucesso." }, "fail": { "title": "Falha ao concluir a configuração", "body": "Ocorreu um erro" }, "invalidType": { "title": "Tipo de arquivo inválido", "body": "Selecione um arquivo de imagem" }, "tooLarge": { "title": "Arquivo muito grande", "body": "Selecione uma imagem com menos de 5MB" } }
  },
  "ru": {
    "seo": { "title": "Добро пожаловать - The Mini Exchange" },
    "header": { "title": "Добро пожаловать в The Mini Exchange!", "subtitle": "Давайте настроим ваш профиль, чтобы начать" },
    "avatar": { "label": "Фото профиля", "hint": "Нажмите, чтобы загрузить", "upload": "Загрузить", "selected": "Фото выбрано!", "none": "Без фото — будет показана первая буква вашего email", "constraints": "Макс. 5 МБ • JPG, PNG или WebP" },
    "displayName": { "label": "Отображаемое имя", "placeholder": "Как к вам обращаться?", "hint": "Так ваше имя увидят другие", "errors": { "required": "Укажите отображаемое имя", "min": "Имя должно содержать не менее 2 символов", "max": "Имя должно содержать менее 50 символов" } },
    "location": { "label": "Местоположение", "error": "Укажите местоположение", "hint": "В профиле публично показывается только ваша страна" },
    "currency": { "label": "Предпочитаемая валюта", "hint": "По умолчанию — валюта вашей страны. Новые объявления будут в этой валюте, а цены покажутся в пересчёте для посетителей с другой валютой." },
    "bio": { "label": "О себе", "optional": "Необязательно", "placeholder": "Расскажите о себе и о своей любви к Classic Mini...", "counter": "{count}/500 символов" },
    "submit": "Завершить настройку",
    "info": "Вы всегда можете обновить профиль позже в настройках аккаунта.",
    "toast": { "success": { "title": "Добро пожаловать в The Mini Exchange!", "body": "Ваш профиль успешно настроен." }, "fail": { "title": "Не удалось завершить настройку", "body": "Произошла ошибка" }, "invalidType": { "title": "Недопустимый тип файла", "body": "Выберите файл изображения" }, "tooLarge": { "title": "Файл слишком большой", "body": "Выберите изображение размером менее 5 МБ" } }
  },
  "ja": {
    "seo": { "title": "ようこそ - The Mini Exchange" },
    "header": { "title": "The Mini Exchange へようこそ！", "subtitle": "まずはプロフィールを設定しましょう" },
    "avatar": { "label": "プロフィール画像", "hint": "クリックしてアップロード", "upload": "アップロード", "selected": "写真を選択しました！", "none": "写真なし — メールアドレスの頭文字が表示されます", "constraints": "最大 5MB・JPG、PNG、WebP" },
    "displayName": { "label": "表示名", "placeholder": "何とお呼びすればよいですか？", "hint": "他のユーザーにはこの名前が表示されます", "errors": { "required": "表示名は必須です", "min": "表示名は 2 文字以上で入力してください", "max": "表示名は 50 文字未満で入力してください" } },
    "location": { "label": "所在地", "error": "所在地は必須です", "hint": "プロフィールに公開されるのは国のみです" },
    "currency": { "label": "希望通貨", "hint": "既定はお住まいの国の通貨です。新しい出品はこの通貨で行われ、異なる通貨の閲覧者には換算した価格が表示されます。" },
    "bio": { "label": "自己紹介", "optional": "任意", "placeholder": "あなた自身と Classic Mini への情熱について教えてください...", "counter": "{count}/500 文字" },
    "submit": "設定を完了する",
    "info": "プロフィールはいつでもアカウント設定から後で更新できます。",
    "toast": { "success": { "title": "The Mini Exchange へようこそ！", "body": "プロフィールの設定が完了しました。" }, "fail": { "title": "設定を完了できませんでした", "body": "エラーが発生しました" }, "invalidType": { "title": "無効なファイル形式", "body": "画像ファイルを選択してください" }, "tooLarge": { "title": "ファイルが大きすぎます", "body": "5MB 未満の画像を選択してください" } }
  },
  "zh": {
    "seo": { "title": "欢迎 - The Mini Exchange" },
    "header": { "title": "欢迎来到 The Mini Exchange！", "subtitle": "先来设置你的个人资料吧" },
    "avatar": { "label": "头像", "hint": "点击上传", "upload": "上传", "selected": "已选择照片！", "none": "没有照片 — 将显示你邮箱的首字母", "constraints": "最大 5MB • JPG、PNG 或 WebP" },
    "displayName": { "label": "显示名称", "placeholder": "我们该怎么称呼你？", "hint": "其他人会看到这个名称", "errors": { "required": "显示名称为必填项", "min": "显示名称至少需要 2 个字符", "max": "显示名称需少于 50 个字符" } },
    "location": { "label": "所在地", "error": "所在地为必填项", "hint": "你的个人资料中只会公开显示国家/地区" },
    "currency": { "label": "首选货币", "hint": "默认使用你所在国家/地区的货币。新发布的商品将使用此货币，并为使用其他货币的访客显示换算后的价格。" },
    "bio": { "label": "简介", "optional": "可选", "placeholder": "介绍一下你自己以及你对 Classic Mini 的热爱...", "counter": "{count}/500 字" },
    "submit": "完成设置",
    "info": "你随时可以稍后在账户设置中更新个人资料。",
    "toast": { "success": { "title": "欢迎来到 The Mini Exchange！", "body": "你的个人资料已设置成功。" }, "fail": { "title": "无法完成设置", "body": "发生了错误" }, "invalidType": { "title": "文件类型无效", "body": "请选择一个图片文件" }, "tooLarge": { "title": "文件过大", "body": "请选择小于 5MB 的图片" } }
  },
  "ko": {
    "seo": { "title": "환영합니다 - The Mini Exchange" },
    "header": { "title": "The Mini Exchange에 오신 것을 환영합니다!", "subtitle": "시작하려면 프로필을 설정하세요" },
    "avatar": { "label": "프로필 사진", "hint": "클릭하여 업로드", "upload": "업로드", "selected": "사진이 선택되었습니다!", "none": "사진 없음 — 이메일 첫 글자가 표시됩니다", "constraints": "최대 5MB • JPG, PNG 또는 WebP" },
    "displayName": { "label": "표시 이름", "placeholder": "어떻게 불러드릴까요?", "hint": "다른 사용자에게 이 이름이 표시됩니다", "errors": { "required": "표시 이름은 필수입니다", "min": "표시 이름은 2자 이상이어야 합니다", "max": "표시 이름은 50자 미만이어야 합니다" } },
    "location": { "label": "위치", "error": "위치는 필수입니다", "hint": "프로필에는 국가만 공개로 표시됩니다" },
    "currency": { "label": "선호 통화", "hint": "기본값은 거주 국가의 통화입니다. 새 매물은 이 통화로 등록되며, 다른 통화를 사용하는 방문자에게는 환산된 가격이 표시됩니다." },
    "bio": { "label": "소개", "optional": "선택 사항", "placeholder": "자신과 Classic Mini에 대한 애정을 들려주세요...", "counter": "{count}/500자" },
    "submit": "설정 완료",
    "info": "프로필은 언제든지 계정 설정에서 나중에 업데이트할 수 있습니다.",
    "toast": { "success": { "title": "The Mini Exchange에 오신 것을 환영합니다!", "body": "프로필이 성공적으로 설정되었습니다." }, "fail": { "title": "설정을 완료하지 못했습니다", "body": "오류가 발생했습니다" }, "invalidType": { "title": "잘못된 파일 형식", "body": "이미지 파일을 선택하세요" }, "tooLarge": { "title": "파일이 너무 큽니다", "body": "5MB 미만의 이미지를 선택하세요" } }
  }
}
</i18n>
