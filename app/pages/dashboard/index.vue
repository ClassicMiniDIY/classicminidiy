<script lang="ts" setup>
  import { HERO_TYPES } from '../../../data/models/generic';

  const { t } = useI18n();
  const { isAuthenticated, user } = useAuth();
  const { configs, loading, fetchConfigs, updateConfig, deleteConfig } = useGearConfigs();

  // Fetch configs when authenticated
  watch(
    isAuthenticated,
    async (authed) => {
      if (authed) {
        await fetchConfigs();
      }
    },
    { immediate: true }
  );

  async function togglePublic(id: string, isPublic: boolean) {
    await updateConfig(id, { is_public: !isPublic });
  }

  async function handleDelete(id: string) {
    await deleteConfig(id);
  }

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

    <!-- Authenticated content -->
    <div v-else class="max-w-4xl mx-auto">
      <!-- Saved Gear Configurations -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <i class="fad fa-gears mr-2"></i>
              <h2 class="text-lg font-semibold">{{ t('gear_configs.title') }}</h2>
            </div>
            <UButton to="/technical/gearing" variant="outline" size="sm" icon="i-fa6-solid-calculator">
              {{ t('gear_configs.open_calculator') }}
            </UButton>
          </div>
        </template>

        <div v-if="loading" class="flex justify-center py-8">
          <span class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
        </div>

        <div v-else-if="configs.length === 0" class="text-center py-8 opacity-60">
          <i class="fas fa-inbox text-4xl mb-3 block"></i>
          <p class="mb-4">{{ t('gear_configs.empty') }}</p>
          <UButton to="/technical/gearing" color="primary" variant="soft">
            {{ t('gear_configs.go_to_calculator') }}
          </UButton>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="config in configs"
            :key="config.id"
            class="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border gap-4"
          >
            <div class="min-w-0 flex-1">
              <p class="font-medium truncate">{{ config.name }}</p>
              <p class="text-xs opacity-60 mt-1">
                {{ config.gearset }} · {{ config.final_drive }}:1 · {{ config.drop_gear }}:1
              </p>
              <p class="text-xs opacity-40 mt-1">
                {{ t('gear_configs.tire') }}: {{ config.tire }} · {{ t('gear_configs.rpm') }}: {{ config.max_rpm }}
              </p>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <div class="flex items-center gap-2">
                <label class="text-xs opacity-60">{{ t('gear_configs.public') }}</label>
                <USwitch
                  :model-value="config.is_public"
                  size="sm"
                  @update:model-value="togglePublic(config.id, config.is_public)"
                />
              </div>
              <UButton
                size="sm"
                variant="ghost"
                color="error"
                icon="i-fa6-solid-trash"
                :title="t('gear_configs.delete')"
                @click="handleDelete(config.id)"
              />
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Dashboard - Classic Mini DIY",
    "description": "Manage your saved gear configurations and account settings.",
    "hero_title": "Classic Mini Archives",
    "breadcrumb_title": "Dashboard",
    "auth": {
      "sign_in_title": "Sign In to View Dashboard",
      "sign_in_description": "You need to be signed in to access your dashboard. Create a free account to get started.",
      "sign_in_button": "Sign In to Continue"
    },
    "gear_configs": {
      "title": "Saved Gear Configurations",
      "open_calculator": "Open Calculator",
      "empty": "No saved configurations yet. Use the gearing calculator to save your first configuration.",
      "go_to_calculator": "Go to Gearing Calculator",
      "tire": "Tire",
      "rpm": "Max RPM",
      "public": "Public",
      "delete": "Delete configuration"
    }
  },
  "es": {
    "title": "Panel - Classic Mini DIY",
    "description": "Administra tus configuraciones de engranajes guardadas.",
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_title": "Panel",
    "auth": {
      "sign_in_title": "Inicia Sesión para Ver el Panel",
      "sign_in_description": "Debes iniciar sesión para acceder a tu panel. Crea una cuenta gratuita para empezar.",
      "sign_in_button": "Iniciar Sesión para Continuar"
    },
    "gear_configs": {
      "title": "Configuraciones de Engranajes Guardadas",
      "open_calculator": "Abrir Calculadora",
      "empty": "Aún no hay configuraciones guardadas. Usa la calculadora de engranajes para guardar tu primera configuración.",
      "go_to_calculator": "Ir a la Calculadora de Engranajes",
      "tire": "Neumático",
      "rpm": "RPM Máximo",
      "public": "Público",
      "delete": "Eliminar configuración"
    }
  },
  "fr": {
    "title": "Tableau de Bord - Classic Mini DIY",
    "description": "Gérez vos configurations d'engrenages sauvegardées.",
    "hero_title": "Archives Classic Mini",
    "breadcrumb_title": "Tableau de Bord",
    "auth": {
      "sign_in_title": "Connectez-vous pour Voir le Tableau de Bord",
      "sign_in_description": "Vous devez être connecté pour accéder à votre tableau de bord. Créez un compte gratuit pour commencer.",
      "sign_in_button": "Se Connecter pour Continuer"
    },
    "gear_configs": {
      "title": "Configurations d'Engrenages Sauvegardées",
      "open_calculator": "Ouvrir le Calculateur",
      "empty": "Aucune configuration sauvegardée. Utilisez le calculateur d'engrenages pour sauvegarder votre première configuration.",
      "go_to_calculator": "Aller au Calculateur d'Engrenages",
      "tire": "Pneu",
      "rpm": "RPM Max",
      "public": "Public",
      "delete": "Supprimer la configuration"
    }
  },
  "de": {
    "title": "Dashboard - Classic Mini DIY",
    "description": "Verwalten Sie Ihre gespeicherten Getriebe-Konfigurationen.",
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "Dashboard",
    "auth": {
      "sign_in_title": "Anmelden zum Dashboard",
      "sign_in_description": "Sie müssen angemeldet sein, um auf Ihr Dashboard zuzugreifen. Erstellen Sie ein kostenloses Konto.",
      "sign_in_button": "Anmelden und Fortfahren"
    },
    "gear_configs": {
      "title": "Gespeicherte Getriebe-Konfigurationen",
      "open_calculator": "Rechner öffnen",
      "empty": "Noch keine gespeicherten Konfigurationen. Verwenden Sie den Getrieberechner, um Ihre erste Konfiguration zu speichern.",
      "go_to_calculator": "Zum Getrieberechner",
      "tire": "Reifen",
      "rpm": "Max Drehzahl",
      "public": "Öffentlich",
      "delete": "Konfiguration löschen"
    }
  }
}
</i18n>
