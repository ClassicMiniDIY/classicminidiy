<script lang="ts" setup>
  import { HERO_TYPES } from '../../../data/models/generic';

  const { t } = useI18n();
  const { isAuthenticated, userProfile, fetchUserProfile } = useAuth();
  const supabase = useSupabase();

  const displayName = ref('');
  const bio = ref('');
  const saving = ref(false);
  const saved = ref(false);

  // Pre-populate from profile
  watch(
    userProfile,
    (profile) => {
      if (profile) {
        displayName.value = profile.display_name || '';
      }
    },
    { immediate: true }
  );

  async function save() {
    saving.value = true;
    saved.value = false;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({
            display_name: displayName.value.trim() || null,
            bio: bio.value.trim() || null,
          })
          .eq('id', user.id);
        await fetchUserProfile(user.id);
        saved.value = true;
      }
    } finally {
      saving.value = false;
    }
  }

  useHead({
    title: t('title'),
    meta: [
      {
        name: 'description',
        content: t('description'),
      },
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
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

    <!-- Authenticated content -->
    <div v-else class="max-w-2xl mx-auto">
      <UCard>
        <template #header>
          <div class="flex items-center bg-muted -m-4 p-4">
            <i class="fad fa-user-pen mr-2"></i>
            <h2 class="text-lg font-semibold">{{ t('card_title') }}</h2>
          </div>
        </template>

        <div class="p-4">
          <!-- Success alert -->
          <UAlert v-if="saved" color="success" class="mb-6">
            <template #title>{{ t('success_title') }}</template>
            <template #description>{{ t('success_description') }}</template>
          </UAlert>

          <!-- Form -->
          <form @submit.prevent="save" class="space-y-4">
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

            <UFormField :label="t('form.bio.label')">
              <UTextarea
                v-model="bio"
                :placeholder="t('form.bio.placeholder')"
                :rows="4"
                class="w-full"
                maxlength="500"
              />
            </UFormField>

            <USeparator class="my-4" />

            <p class="text-sm opacity-60">
              <i class="fad fa-circle-info mr-1"></i>
              {{ t('shared_note') }}
            </p>

            <div class="flex gap-3 pt-2">
              <UButton to="/" variant="ghost" color="neutral">
                {{ t('form.cancel') }}
              </UButton>
              <UButton type="submit" color="primary" :loading="saving" :disabled="saving">
                {{ t('form.save') }}
              </UButton>
            </div>
          </form>
        </div>
      </UCard>
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
    "form": {
      "display_name": {
        "label": "Display Name",
        "placeholder": "Enter your display name"
      },
      "bio": {
        "label": "Bio",
        "placeholder": "Tell the community a bit about yourself and your Mini"
      },
      "cancel": "Cancel",
      "save": "Save Profile"
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
      "sign_in_title": "Inicia Sesi\u00f3n para Editar el Perfil",
      "sign_in_description": "Debes iniciar sesi\u00f3n para editar tu perfil. Crea una cuenta gratuita para empezar.",
      "sign_in_button": "Iniciar Sesi\u00f3n para Continuar"
    },
    "success_title": "Perfil Actualizado",
    "success_description": "Tu perfil se ha guardado correctamente.",
    "form": {
      "display_name": {
        "label": "Nombre para Mostrar",
        "placeholder": "Introduce tu nombre para mostrar"
      },
      "bio": {
        "label": "Biograf\u00eda",
        "placeholder": "Cu\u00e9ntale a la comunidad un poco sobre ti y tu Mini"
      },
      "cancel": "Cancelar",
      "save": "Guardar Perfil"
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
      "sign_in_description": "Vous devez \u00eatre connect\u00e9 pour modifier votre profil. Cr\u00e9ez un compte gratuit pour commencer.",
      "sign_in_button": "Se Connecter pour Continuer"
    },
    "success_title": "Profil Mis \u00e0 Jour",
    "success_description": "Votre profil a \u00e9t\u00e9 enregistr\u00e9 avec succ\u00e8s.",
    "form": {
      "display_name": {
        "label": "Nom d'Affichage",
        "placeholder": "Entrez votre nom d'affichage"
      },
      "bio": {
        "label": "Biographie",
        "placeholder": "Pr\u00e9sentez-vous \u00e0 la communaut\u00e9 et parlez de votre Mini"
      },
      "cancel": "Annuler",
      "save": "Enregistrer le Profil"
    },
    "shared_note": "Votre profil est partag\u00e9 entre classicminidiy.com et theminiexchange.com."
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
    "success_description": "Il tuo profilo \u00e8 stato salvato con successo.",
    "form": {
      "display_name": {
        "label": "Nome Visualizzato",
        "placeholder": "Inserisci il tuo nome visualizzato"
      },
      "bio": {
        "label": "Biografia",
        "placeholder": "Racconta alla comunit\u00e0 qualcosa su di te e sulla tua Mini"
      },
      "cancel": "Annulla",
      "save": "Salva Profilo"
    },
    "shared_note": "Il tuo profilo \u00e8 condiviso tra classicminidiy.com e theminiexchange.com."
  },
  "de": {
    "title": "Profil Bearbeiten - Classic Mini DIY",
    "description": "Bearbeiten Sie Ihr Classic Mini DIY Profil.",
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "Profil Bearbeiten",
    "card_title": "Profil Bearbeiten",
    "auth": {
      "sign_in_title": "Anmelden zum Bearbeiten des Profils",
      "sign_in_description": "Sie m\u00fcssen angemeldet sein, um Ihr Profil zu bearbeiten. Erstellen Sie ein kostenloses Konto, um zu beginnen.",
      "sign_in_button": "Anmelden und Fortfahren"
    },
    "success_title": "Profil Aktualisiert",
    "success_description": "Ihr Profil wurde erfolgreich gespeichert.",
    "form": {
      "display_name": {
        "label": "Anzeigename",
        "placeholder": "Geben Sie Ihren Anzeigenamen ein"
      },
      "bio": {
        "label": "Biografie",
        "placeholder": "Erz\u00e4hlen Sie der Community etwas \u00fcber sich und Ihren Mini"
      },
      "cancel": "Abbrechen",
      "save": "Profil Speichern"
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
      "sign_in_description": "Voc\u00ea precisa estar conectado para editar seu perfil. Crie uma conta gratuita para come\u00e7ar.",
      "sign_in_button": "Entrar para Continuar"
    },
    "success_title": "Perfil Atualizado",
    "success_description": "Seu perfil foi salvo com sucesso.",
    "form": {
      "display_name": {
        "label": "Nome de Exibi\u00e7\u00e3o",
        "placeholder": "Insira seu nome de exibi\u00e7\u00e3o"
      },
      "bio": {
        "label": "Biografia",
        "placeholder": "Conte \u00e0 comunidade um pouco sobre voc\u00ea e seu Mini"
      },
      "cancel": "Cancelar",
      "save": "Salvar Perfil"
    },
    "shared_note": "Seu perfil \u00e9 compartilhado entre classicminidiy.com e theminiexchange.com."
  },
  "ru": {
    "title": "\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u041f\u0440\u043e\u0444\u0438\u043b\u044c - Classic Mini DIY",
    "description": "\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u0443\u0439\u0442\u0435 \u0441\u0432\u043e\u0439 \u043f\u0440\u043e\u0444\u0438\u043b\u044c Classic Mini DIY.",
    "hero_title": "\u0410\u0440\u0445\u0438\u0432\u044b Classic Mini",
    "breadcrumb_title": "\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u041f\u0440\u043e\u0444\u0438\u043b\u044c",
    "card_title": "\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u041f\u0440\u043e\u0444\u0438\u043b\u044c",
    "auth": {
      "sign_in_title": "\u0412\u043e\u0439\u0434\u0438\u0442\u0435 \u0434\u043b\u044f \u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f \u041f\u0440\u043e\u0444\u0438\u043b\u044f",
      "sign_in_description": "\u0412\u044b \u0434\u043e\u043b\u0436\u043d\u044b \u0431\u044b\u0442\u044c \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u043e\u0432\u0430\u043d\u044b \u0434\u043b\u044f \u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f \u043f\u0440\u043e\u0444\u0438\u043b\u044f. \u0421\u043e\u0437\u0434\u0430\u0439\u0442\u0435 \u0431\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u0443\u044e \u0443\u0447\u0451\u0442\u043d\u0443\u044e \u0437\u0430\u043f\u0438\u0441\u044c \u0434\u043b\u044f \u043d\u0430\u0447\u0430\u043b\u0430.",
      "sign_in_button": "\u0412\u043e\u0439\u0442\u0438 \u0434\u043b\u044f \u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0435\u043d\u0438\u044f"
    },
    "success_title": "\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u041e\u0431\u043d\u043e\u0432\u043b\u0451\u043d",
    "success_description": "\u0412\u0430\u0448 \u043f\u0440\u043e\u0444\u0438\u043b\u044c \u0443\u0441\u043f\u0435\u0448\u043d\u043e \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d.",
    "form": {
      "display_name": {
        "label": "\u041e\u0442\u043e\u0431\u0440\u0430\u0436\u0430\u0435\u043c\u043e\u0435 \u0418\u043c\u044f",
        "placeholder": "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0430\u0435\u043c\u043e\u0435 \u0438\u043c\u044f"
      },
      "bio": {
        "label": "\u041e \u0441\u0435\u0431\u0435",
        "placeholder": "\u0420\u0430\u0441\u0441\u043a\u0430\u0436\u0438\u0442\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u0441\u0442\u0432\u0443 \u043e \u0441\u0435\u0431\u0435 \u0438 \u0441\u0432\u043e\u0451\u043c Mini"
      },
      "cancel": "\u041e\u0442\u043c\u0435\u043d\u0430",
      "save": "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u041f\u0440\u043e\u0444\u0438\u043b\u044c"
    },
    "shared_note": "\u0412\u0430\u0448 \u043f\u0440\u043e\u0444\u0438\u043b\u044c \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442\u0441\u044f \u043d\u0430 classicminidiy.com \u0438 theminiexchange.com."
  },
  "ja": {
    "title": "\u30d7\u30ed\u30d5\u30a3\u30fc\u30eb\u7de8\u96c6 - Classic Mini DIY",
    "description": "Classic Mini DIY\u306e\u30d7\u30ed\u30d5\u30a3\u30fc\u30eb\u3092\u7de8\u96c6\u3057\u307e\u3059\u3002",
    "hero_title": "Classic Mini \u30a2\u30fc\u30ab\u30a4\u30d6",
    "breadcrumb_title": "\u30d7\u30ed\u30d5\u30a3\u30fc\u30eb\u7de8\u96c6",
    "card_title": "\u30d7\u30ed\u30d5\u30a3\u30fc\u30eb\u7de8\u96c6",
    "auth": {
      "sign_in_title": "\u30d7\u30ed\u30d5\u30a3\u30fc\u30eb\u7de8\u96c6\u306b\u306f\u30ed\u30b0\u30a4\u30f3\u304c\u5fc5\u8981\u3067\u3059",
      "sign_in_description": "\u30d7\u30ed\u30d5\u30a3\u30fc\u30eb\u3092\u7de8\u96c6\u3059\u308b\u306b\u306f\u30ed\u30b0\u30a4\u30f3\u304c\u5fc5\u8981\u3067\u3059\u3002\u7121\u6599\u30a2\u30ab\u30a6\u30f3\u30c8\u3092\u4f5c\u6210\u3057\u3066\u59cb\u3081\u307e\u3057\u3087\u3046\u3002",
      "sign_in_button": "\u30ed\u30b0\u30a4\u30f3\u3057\u3066\u7d9a\u884c"
    },
    "success_title": "\u30d7\u30ed\u30d5\u30a3\u30fc\u30eb\u66f4\u65b0\u5b8c\u4e86",
    "success_description": "\u30d7\u30ed\u30d5\u30a3\u30fc\u30eb\u304c\u6b63\u5e38\u306b\u4fdd\u5b58\u3055\u308c\u307e\u3057\u305f\u3002",
    "form": {
      "display_name": {
        "label": "\u8868\u793a\u540d",
        "placeholder": "\u8868\u793a\u540d\u3092\u5165\u529b"
      },
      "bio": {
        "label": "\u81ea\u5df1\u7d39\u4ecb",
        "placeholder": "\u3042\u306a\u305f\u3068\u3042\u306a\u305f\u306eMini\u306b\u3064\u3044\u3066\u30b3\u30df\u30e5\u30cb\u30c6\u30a3\u306b\u6559\u3048\u3066\u304f\u3060\u3055\u3044"
      },
      "cancel": "\u30ad\u30e3\u30f3\u30bb\u30eb",
      "save": "\u30d7\u30ed\u30d5\u30a3\u30fc\u30eb\u3092\u4fdd\u5b58"
    },
    "shared_note": "\u3042\u306a\u305f\u306e\u30d7\u30ed\u30d5\u30a3\u30fc\u30eb\u306fclassicminidiy.com\u3068theminiexchange.com\u3067\u5171\u6709\u3055\u308c\u307e\u3059\u3002"
  },
  "zh": {
    "title": "\u7f16\u8f91\u4e2a\u4eba\u8d44\u6599 - Classic Mini DIY",
    "description": "\u7f16\u8f91\u60a8\u7684Classic Mini DIY\u4e2a\u4eba\u8d44\u6599\u3002",
    "hero_title": "Classic Mini \u6863\u6848",
    "breadcrumb_title": "\u7f16\u8f91\u4e2a\u4eba\u8d44\u6599",
    "card_title": "\u7f16\u8f91\u4e2a\u4eba\u8d44\u6599",
    "auth": {
      "sign_in_title": "\u767b\u5f55\u4ee5\u7f16\u8f91\u4e2a\u4eba\u8d44\u6599",
      "sign_in_description": "\u60a8\u9700\u8981\u767b\u5f55\u624d\u80fd\u7f16\u8f91\u4e2a\u4eba\u8d44\u6599\u3002\u521b\u5efa\u4e00\u4e2a\u514d\u8d39\u8d26\u6237\u5f00\u59cb\u4f7f\u7528\u3002",
      "sign_in_button": "\u767b\u5f55\u4ee5\u7ee7\u7eed"
    },
    "success_title": "\u4e2a\u4eba\u8d44\u6599\u5df2\u66f4\u65b0",
    "success_description": "\u60a8\u7684\u4e2a\u4eba\u8d44\u6599\u5df2\u6210\u529f\u4fdd\u5b58\u3002",
    "form": {
      "display_name": {
        "label": "\u663e\u793a\u540d\u79f0",
        "placeholder": "\u8f93\u5165\u60a8\u7684\u663e\u793a\u540d\u79f0"
      },
      "bio": {
        "label": "\u4e2a\u4eba\u7b80\u4ecb",
        "placeholder": "\u5411\u793e\u533a\u4ecb\u7ecd\u4e00\u4e0b\u60a8\u548c\u60a8\u7684Mini"
      },
      "cancel": "\u53d6\u6d88",
      "save": "\u4fdd\u5b58\u4e2a\u4eba\u8d44\u6599"
    },
    "shared_note": "\u60a8\u7684\u4e2a\u4eba\u8d44\u6599\u5728classicminidiy.com\u548ctheminiexchange.com\u4e4b\u95f4\u5171\u4eab\u3002"
  },
  "ko": {
    "title": "\ud504\ub85c\ud544 \ud3b8\uc9d1 - Classic Mini DIY",
    "description": "Classic Mini DIY \ud504\ub85c\ud544\uc744 \ud3b8\uc9d1\ud569\ub2c8\ub2e4.",
    "hero_title": "Classic Mini \uc544\uce74\uc774\ube0c",
    "breadcrumb_title": "\ud504\ub85c\ud544 \ud3b8\uc9d1",
    "card_title": "\ud504\ub85c\ud544 \ud3b8\uc9d1",
    "auth": {
      "sign_in_title": "\ud504\ub85c\ud544 \ud3b8\uc9d1\uc744 \uc704\ud574 \ub85c\uadf8\uc778\ud558\uc138\uc694",
      "sign_in_description": "\ud504\ub85c\ud544\uc744 \ud3b8\uc9d1\ud558\ub824\uba74 \ub85c\uadf8\uc778\ud574\uc57c \ud569\ub2c8\ub2e4. \ubb34\ub8cc \uacc4\uc815\uc744 \ub9cc\ub4e4\uc5b4 \uc2dc\uc791\ud558\uc138\uc694.",
      "sign_in_button": "\ub85c\uadf8\uc778\ud558\uc5ec \uacc4\uc18d"
    },
    "success_title": "\ud504\ub85c\ud544 \uc5c5\ub370\uc774\ud2b8 \uc644\ub8cc",
    "success_description": "\ud504\ub85c\ud544\uc774 \uc131\uacf5\uc801\uc73c\ub85c \uc800\uc7a5\ub418\uc5c8\uc2b5\ub2c8\ub2e4.",
    "form": {
      "display_name": {
        "label": "\ud45c\uc2dc \uc774\ub984",
        "placeholder": "\ud45c\uc2dc \uc774\ub984\uc744 \uc785\ub825\ud558\uc138\uc694"
      },
      "bio": {
        "label": "\uc18c\uac1c",
        "placeholder": "\ucee4\ubba4\ub2c8\ud2f0\uc5d0 \ub2f9\uc2e0\uacfc \ub2f9\uc2e0\uc758 Mini\uc5d0 \ub300\ud574 \uc54c\ub824\uc8fc\uc138\uc694"
      },
      "cancel": "\ucde8\uc18c",
      "save": "\ud504\ub85c\ud544 \uc800\uc7a5"
    },
    "shared_note": "\ud504\ub85c\ud544\uc740 classicminidiy.com\uacfc theminiexchange.com\uc5d0\uc11c \uacf5\uc720\ub429\ub2c8\ub2e4."
  }
}
</i18n>
