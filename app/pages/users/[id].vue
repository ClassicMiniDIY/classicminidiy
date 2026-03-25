<script lang="ts" setup>
  import { HERO_TYPES, BREADCRUMB_VERSIONS } from '../../../data/models/generic';
  import type { PublicProfile, Vehicle } from '~/composables/useProfile';

  const { t } = useI18n();
  const route = useRoute();
  const { getPublicProfile, getPublicProfileVehicles } = useProfile();
  const { fetchPublicConfigs } = useGearConfigs();

  const identifier = route.params.id as string;

  const profile = ref<PublicProfile | null>(null);
  const vehicles = ref<Vehicle[]>([]);
  const publicConfigs = ref<any[]>([]);
  const loading = ref(true);
  const notFound = ref(false);
  const isPrivate = ref(false);

  onMounted(async () => {
    try {
      const result = await getPublicProfile(identifier);

      if (!result) {
        notFound.value = true;
        return;
      }

      if ('private' in result) {
        isPrivate.value = true;
        return;
      }

      profile.value = result.profile;

      // Fetch gear configs and vehicles in parallel
      const [configs, vehiclesData] = await Promise.all([
        fetchPublicConfigs(result.profile.id),
        result.profile.show_vehicles
          ? getPublicProfileVehicles(result.profile.id)
          : Promise.resolve([] as Vehicle[]),
      ]);

      publicConfigs.value = configs;
      vehicles.value = vehiclesData;
    } catch (error) {
      console.error('Failed to load public profile:', error);
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
  const initials = computed(() => displayName.value.charAt(0).toUpperCase());
  const hasSocialLinks = computed(() => {
    if (!profile.value?.social_links) return false;
    return Object.values(profile.value.social_links).some((v) => !!v);
  });
  useHead({
    title: computed(() => `${displayName.value} - Classic Mini DIY`),
    meta: [
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
      <breadcrumb :page="t('breadcrumb_title')" :version="BREADCRUMB_VERSIONS.PROFILE" />
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

    <!-- Private profile -->
    <div v-else-if="isPrivate" class="max-w-lg mx-auto text-center py-12">
      <i class="fas fa-lock text-5xl opacity-40 mb-4 block"></i>
      <h2 class="text-xl font-bold mb-2">{{ t('private.title') }}</h2>
      <p class="opacity-70 mb-6">{{ t('private.description') }}</p>
      <UButton to="/" color="primary">{{ t('not_found.go_home') }}</UButton>
    </div>

    <!-- Profile content -->
    <div v-else class="max-w-4xl mx-auto space-y-6">
      <!-- Profile Card -->
      <UCard>
        <div class="p-2">
          <div class="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div v-if="profile?.avatar_url" class="w-20 h-20 rounded-full overflow-hidden shrink-0">
              <img :src="profile.avatar_url" :alt="displayName" class="w-full h-full object-cover" />
            </div>
            <div
              v-else
              class="w-20 h-20 rounded-full bg-primary text-primary-content flex items-center justify-center text-3xl font-bold shrink-0"
            >
              {{ initials }}
            </div>

            <div class="flex-1 text-center sm:text-left min-w-0">
              <div class="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <h2 class="text-xl font-bold">{{ displayName }}</h2>
                <ProfileSustainingBadge v-if="profile?.is_sustaining_member" size="sm" />
              </div>

              <p v-if="profile?.location" class="text-sm opacity-60 mt-1">
                <i class="fas fa-location-dot mr-1"></i>{{ profile.location }}
              </p>

              <p v-if="profile?.bio" class="mt-2 opacity-80">{{ profile.bio }}</p>

              <p v-if="memberSince" class="text-xs opacity-50 mt-2">
                <i class="fad fa-calendar mr-1"></i>{{ t('member_since', { date: memberSince }) }}
              </p>

              <!-- Social Links -->
              <div v-if="hasSocialLinks" class="mt-3">
                <ProfileSocialLinks :links="profile!.social_links" size="sm" />
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Vehicles -->
      <UCard v-if="profile?.show_vehicles && vehicles.length > 0">
        <template #header>
          <div class="flex items-center">
            <i class="fad fa-car mr-2"></i>
            <h3 class="text-lg font-semibold">{{ t('vehicles.title') }}</h3>
          </div>
        </template>
        <ProfileVehicleShowcase :vehicles="vehicles" />
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
    "private": {
      "title": "Private Profile",
      "description": "This user's profile is set to private."
    },
    "vehicles": {
      "title": "Their Minis"
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
    "private": {
      "title": "Perfil Privado",
      "description": "El perfil de este usuario es privado."
    },
    "vehicles": {
      "title": "Sus Minis"
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
    "private": {
      "title": "Profil Privé",
      "description": "Le profil de cet utilisateur est défini comme privé."
    },
    "vehicles": {
      "title": "Ses Minis"
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
    "private": {
      "title": "Privates Profil",
      "description": "Dieses Benutzerprofil ist auf privat gesetzt."
    },
    "vehicles": {
      "title": "Ihre Minis"
    },
    "gear_configs": {
      "title": "Getriebe-Konfigurationen",
      "empty": "Keine öffentlichen Konfigurationen geteilt.",
      "tire": "Reifen",
      "rpm": "Max Drehzahl"
    }
  },
  "it": {
    "hero_title": "Archivi Classic Mini",
    "breadcrumb_title": "Profilo Utente",
    "anonymous": "Appassionato di Mini",
    "member_since": "Membro dal {date}",
    "not_found": {
      "title": "Utente Non Trovato",
      "description": "Il profilo utente che cerchi non esiste o è stato rimosso.",
      "go_home": "Vai alla Home"
    },
    "private": {
      "title": "Profilo Privato",
      "description": "Il profilo di questo utente è impostato come privato."
    },
    "vehicles": {
      "title": "Le Sue Mini"
    },
    "gear_configs": {
      "title": "Configurazioni Ingranaggi",
      "empty": "Nessuna configurazione pubblica condivisa.",
      "tire": "Pneumatico",
      "rpm": "RPM Max"
    }
  },
  "pt": {
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb_title": "Perfil do Usuário",
    "anonymous": "Entusiasta do Mini",
    "member_since": "Membro desde {date}",
    "not_found": {
      "title": "Usuário Não Encontrado",
      "description": "O perfil que você procura não existe ou foi removido.",
      "go_home": "Ir para Início"
    },
    "private": {
      "title": "Perfil Privado",
      "description": "O perfil deste usuário é privado."
    },
    "vehicles": {
      "title": "Seus Minis"
    },
    "gear_configs": {
      "title": "Configurações de Engrenagens",
      "empty": "Nenhuma configuração pública compartilhada.",
      "tire": "Pneu",
      "rpm": "RPM Máx"
    }
  },
  "ru": {
    "hero_title": "Архивы Classic Mini",
    "breadcrumb_title": "Профиль Пользователя",
    "anonymous": "Энтузиаст Mini",
    "member_since": "Участник с {date}",
    "not_found": {
      "title": "Пользователь Не Найден",
      "description": "Профиль пользователя не существует или был удалён.",
      "go_home": "На Главную"
    },
    "private": {
      "title": "Закрытый Профиль",
      "description": "Профиль этого пользователя является закрытым."
    },
    "vehicles": {
      "title": "Автомобили"
    },
    "gear_configs": {
      "title": "Конфигурации Передач",
      "empty": "Нет публичных конфигураций.",
      "tire": "Шина",
      "rpm": "Макс. об/мин"
    }
  },
  "ja": {
    "hero_title": "Classic Mini アーカイブ",
    "breadcrumb_title": "ユーザープロフィール",
    "anonymous": "Miniエンスージアスト",
    "member_since": "{date}から参加",
    "not_found": {
      "title": "ユーザーが見つかりません",
      "description": "お探しのユーザープロフィールは存在しないか、削除されました。",
      "go_home": "ホームへ"
    },
    "private": {
      "title": "非公開プロフィール",
      "description": "このユーザーのプロフィールは非公開です。"
    },
    "vehicles": {
      "title": "所有車両"
    },
    "gear_configs": {
      "title": "ギア設定",
      "empty": "公開設定はありません。",
      "tire": "タイヤ",
      "rpm": "最大RPM"
    }
  },
  "zh": {
    "hero_title": "Classic Mini 档案",
    "breadcrumb_title": "用户资料",
    "anonymous": "Mini爱好者",
    "member_since": "{date}加入",
    "not_found": {
      "title": "未找到用户",
      "description": "您查找的用户资料不存在或已被删除。",
      "go_home": "返回首页"
    },
    "private": {
      "title": "私密资料",
      "description": "此用户的资料已设为私密。"
    },
    "vehicles": {
      "title": "TA的Mini"
    },
    "gear_configs": {
      "title": "齿轮配置",
      "empty": "暂无公开配置。",
      "tire": "轮胎",
      "rpm": "最大转速"
    }
  },
  "ko": {
    "hero_title": "Classic Mini 아카이브",
    "breadcrumb_title": "사용자 프로필",
    "anonymous": "Mini 애호가",
    "member_since": "{date}부터 회원",
    "not_found": {
      "title": "사용자를 찾을 수 없습니다",
      "description": "찾으시는 사용자 프로필이 존재하지 않거나 삭제되었습니다.",
      "go_home": "홈으로"
    },
    "private": {
      "title": "비공개 프로필",
      "description": "이 사용자의 프로필은 비공개입니다."
    },
    "vehicles": {
      "title": "보유 차량"
    },
    "gear_configs": {
      "title": "기어 구성",
      "empty": "공개된 구성이 없습니다.",
      "tire": "타이어",
      "rpm": "최대 RPM"
    }
  }
}
</i18n>
