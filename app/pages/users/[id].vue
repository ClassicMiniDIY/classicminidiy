<script lang="ts" setup>
  import { HERO_TYPES } from '../../../data/models/generic';

  const { t } = useI18n();
  const route = useRoute();
  const supabase = useSupabase();
  const { fetchPublicConfigs } = useGearConfigs();

  const userId = route.params.id as string;

  const profile = ref<{
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    created_at: string | null;
  } | null>(null);

  const publicConfigs = ref<any[]>([]);
  const loading = ref(true);
  const notFound = ref(false);

  // Fetch profile and public configs
  onMounted(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, bio, created_at')
        .eq('id', userId)
        .single();

      if (error || !data) {
        notFound.value = true;
        return;
      }

      profile.value = data;
      publicConfigs.value = await fetchPublicConfigs(userId);
    } catch {
      notFound.value = true;
    } finally {
      loading.value = false;
    }
  });

  const displayName = computed(() => profile.value?.display_name || t('anonymous'));
  const memberSince = computed(() => {
    if (!profile.value?.created_at) return '';
    return new Date(profile.value.created_at).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
    });
  });
  const initials = computed(() => {
    const name = displayName.value;
    return name.charAt(0).toUpperCase();
  });

  useHead({
    title: computed(() => `${displayName.value} - Classic Mini DIY`),
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  });
</script>

<template>
  <hero :navigation="true" :title="t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />

  <div class="container mx-auto px-4 py-6">
    <div class="mb-6">
      <breadcrumb :page="t('breadcrumb_title')" />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <span class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
    </div>

    <!-- Not found -->
    <div v-else-if="notFound" class="max-w-lg mx-auto text-center py-12">
      <i class="fas fa-user-slash text-5xl opacity-40 mb-4 block"></i>
      <h2 class="text-xl font-bold mb-2">{{ t('not_found.title') }}</h2>
      <p class="opacity-70 mb-6">{{ t('not_found.description') }}</p>
      <UButton to="/" color="primary">{{ t('not_found.go_home') }}</UButton>
    </div>

    <!-- Profile content -->
    <div v-else class="max-w-4xl mx-auto space-y-6">
      <!-- Profile Card -->
      <UCard>
        <div class="flex items-center gap-4 p-2">
          <div v-if="profile?.avatar_url" class="w-16 h-16 rounded-full overflow-hidden shrink-0">
            <img :src="profile.avatar_url" :alt="displayName" class="w-full h-full object-cover" />
          </div>
          <div
            v-else
            class="w-16 h-16 rounded-full bg-primary text-primary-content flex items-center justify-center text-2xl font-bold shrink-0"
          >
            {{ initials }}
          </div>
          <div class="min-w-0">
            <h2 class="text-xl font-bold truncate">{{ displayName }}</h2>
            <p v-if="profile?.bio" class="text-sm opacity-70 mt-1">{{ profile.bio }}</p>
            <p v-if="memberSince" class="text-xs opacity-50 mt-1">
              <i class="fad fa-calendar mr-1"></i>{{ t('member_since', { date: memberSince }) }}
            </p>
          </div>
        </div>
      </UCard>

      <!-- Public Gear Configurations -->
      <UCard>
        <template #header>
          <div class="flex items-center">
            <i class="fad fa-gears mr-2"></i>
            <h3 class="text-lg font-semibold">{{ t('gear_configs.title') }}</h3>
          </div>
        </template>

        <div v-if="publicConfigs.length === 0" class="text-center py-8 opacity-60">
          <i class="fas fa-inbox text-4xl mb-3 block"></i>
          <p>{{ t('gear_configs.empty') }}</p>
        </div>

        <div v-else class="space-y-3">
          <div v-for="config in publicConfigs" :key="config.id" class="p-4 rounded-lg border">
            <p class="font-medium">{{ config.name }}</p>
            <p class="text-xs opacity-60 mt-1">
              {{ config.gearset }} · {{ config.final_drive }}:1 · {{ config.drop_gear }}:1
            </p>
            <p class="text-xs opacity-40 mt-1">
              {{ t('gear_configs.tire') }}: {{ config.tire }} · {{ t('gear_configs.rpm') }}: {{ config.max_rpm }}
            </p>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "hero_title": "Classic Mini Archives",
    "breadcrumb_title": "User Profile",
    "anonymous": "Mini Enthusiast",
    "member_since": "Member since {date}",
    "not_found": {
      "title": "User Not Found",
      "description": "The user profile you're looking for doesn't exist or has been removed.",
      "go_home": "Go Home"
    },
    "gear_configs": {
      "title": "Gear Configurations",
      "empty": "No public configurations shared.",
      "tire": "Tire",
      "rpm": "Max RPM"
    }
  },
  "es": {
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_title": "Perfil de Usuario",
    "anonymous": "Entusiasta del Mini",
    "member_since": "Miembro desde {date}",
    "not_found": {
      "title": "Usuario No Encontrado",
      "description": "El perfil de usuario que buscas no existe o ha sido eliminado.",
      "go_home": "Ir al Inicio"
    },
    "gear_configs": {
      "title": "Configuraciones de Engranajes",
      "empty": "No hay configuraciones públicas compartidas.",
      "tire": "Neumático",
      "rpm": "RPM Máximo"
    }
  },
  "fr": {
    "hero_title": "Archives Classic Mini",
    "breadcrumb_title": "Profil Utilisateur",
    "anonymous": "Passionné de Mini",
    "member_since": "Membre depuis {date}",
    "not_found": {
      "title": "Utilisateur Non Trouvé",
      "description": "Le profil utilisateur que vous recherchez n'existe pas ou a été supprimé.",
      "go_home": "Retour à l'Accueil"
    },
    "gear_configs": {
      "title": "Configurations d'Engrenages",
      "empty": "Aucune configuration publique partagée.",
      "tire": "Pneu",
      "rpm": "RPM Max"
    }
  },
  "de": {
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "Benutzerprofil",
    "anonymous": "Mini-Enthusiast",
    "member_since": "Mitglied seit {date}",
    "not_found": {
      "title": "Benutzer Nicht Gefunden",
      "description": "Das gesuchte Benutzerprofil existiert nicht oder wurde entfernt.",
      "go_home": "Zur Startseite"
    },
    "gear_configs": {
      "title": "Getriebe-Konfigurationen",
      "empty": "Keine öffentlichen Konfigurationen geteilt.",
      "tire": "Reifen",
      "rpm": "Max Drehzahl"
    }
  }
}
</i18n>
