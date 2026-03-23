<script lang="ts" setup>
  import { HERO_TYPES } from '../../../data/models/generic';
  import type { PublicProfile, Vehicle } from '~/composables/useProfile';

  const { t } = useI18n();
  const { isAuthenticated, user, userProfile } = useAuth();
  const { fetchProfile, getPublicProfileVehicles } = useProfile();
  const { fetchPublicConfigs } = useGearConfigs();

  const profile = ref<any>(null);
  const vehicles = ref<Vehicle[]>([]);
  const publicConfigs = ref<any[]>([]);
  const loading = ref(true);
  const showShareModal = ref(false);

  onMounted(async () => {
    if (!user.value) {
      loading.value = false;
      return;
    }
    try {
      const [profileData, configs] = await Promise.all([fetchProfile(), fetchPublicConfigs(user.value.id)]);
      profile.value = profileData;
      publicConfigs.value = configs;

      if (profileData?.show_vehicles) {
        vehicles.value = await getPublicProfileVehicles(user.value.id);
      }
    } catch {
      // Failed to load
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
  const shareUrl = computed(() => {
    const base = 'https://classicminidiy.com/users/';
    return profile.value?.username ? `${base}${profile.value.username}` : `${base}${user.value?.id}`;
  });
  const hasSocialLinks = computed(() => {
    if (!profile.value?.social_links) return false;
    return Object.values(profile.value.social_links).some((v) => !!v);
  });

  function copyShareUrl() {
    navigator.clipboard.writeText(shareUrl.value);
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
            <i class="fas fa-user text-5xl opacity-40"></i>
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
    <div v-else-if="loading" class="flex justify-center py-12">
      <span class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
    </div>

    <!-- Profile content -->
    <div v-else class="max-w-4xl mx-auto space-y-6">
      <!-- Profile Header Card -->
      <UCard>
        <div class="p-2">
          <div class="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <!-- Avatar -->
            <div v-if="profile?.avatar_url" class="w-20 h-20 rounded-full overflow-hidden shrink-0">
              <img :src="profile.avatar_url" :alt="displayName" class="w-full h-full object-cover" />
            </div>
            <div
              v-else
              class="w-20 h-20 rounded-full bg-primary text-primary-content flex items-center justify-center text-3xl font-bold shrink-0"
            >
              {{ initials }}
            </div>

            <!-- Info -->
            <div class="flex-1 text-center sm:text-left min-w-0">
              <div class="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <h2 class="text-xl font-bold">{{ displayName }}</h2>
                <span v-if="profile?.username" class="text-sm opacity-60">@{{ profile.username }}</span>
                <ProfileSustainingBadge v-if="userProfile?.is_sustaining_member" size="sm" />
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
                <ProfileSocialLinks :links="profile.social_links" size="sm" />
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap gap-2 mt-4 pt-4 border-t">
            <UButton to="/profile/edit" variant="outline" color="primary" icon="i-fa6-solid-pen">
              {{ t('edit_profile') }}
            </UButton>
            <UButton variant="ghost" color="neutral" icon="i-fa6-solid-share-nodes" @click="showShareModal = true">
              {{ t('share_profile') }}
            </UButton>
          </div>
        </div>
      </UCard>

      <!-- Share Modal -->
      <UModal v-model:open="showShareModal">
        <template #content>
          <div class="p-6">
            <h3 class="text-lg font-semibold mb-4">{{ t('share_modal.title') }}</h3>
            <div class="flex gap-2">
              <UInput :model-value="shareUrl" readonly class="flex-1" />
              <UButton color="primary" @click="copyShareUrl">
                {{ t('share_modal.copy') }}
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Vehicles -->
      <UCard v-if="profile?.show_vehicles">
        <template #header>
          <div class="flex items-center">
            <i class="fad fa-car mr-2"></i>
            <h3 class="text-lg font-semibold">{{ t('vehicles.title') }}</h3>
          </div>
        </template>
        <ProfileVehicleShowcase :vehicles="vehicles" />
      </UCard>

      <!-- Gear Configurations -->
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
    "title": "My Profile - Classic Mini DIY",
    "description": "View your Classic Mini DIY profile.",
    "hero_title": "Classic Mini Archives",
    "breadcrumb_title": "My Profile",
    "anonymous": "Mini Enthusiast",
    "member_since": "Member since {date}",
    "edit_profile": "Edit Profile",
    "share_profile": "Share Profile",
    "auth": {
      "sign_in_title": "Sign In to View Profile",
      "sign_in_description": "You need to be signed in to view your profile.",
      "sign_in_button": "Sign In to Continue"
    },
    "share_modal": {
      "title": "Share Your Profile",
      "copy": "Copy"
    },
    "vehicles": {
      "title": "My Minis"
    },
    "gear_configs": {
      "title": "Gear Configurations",
      "empty": "No public configurations shared yet.",
      "tire": "Tire",
      "rpm": "Max RPM"
    }
  },
  "es": {
    "title": "Mi Perfil - Classic Mini DIY",
    "description": "Ve tu perfil de Classic Mini DIY.",
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_title": "Mi Perfil",
    "anonymous": "Entusiasta del Mini",
    "member_since": "Miembro desde {date}",
    "edit_profile": "Editar Perfil",
    "share_profile": "Compartir Perfil",
    "auth": {
      "sign_in_title": "Inicia Sesión para Ver el Perfil",
      "sign_in_description": "Debes iniciar sesión para ver tu perfil.",
      "sign_in_button": "Iniciar Sesión"
    },
    "share_modal": {
      "title": "Comparte Tu Perfil",
      "copy": "Copiar"
    },
    "vehicles": {
      "title": "Mis Minis"
    },
    "gear_configs": {
      "title": "Configuraciones de Engranajes",
      "empty": "Aún no hay configuraciones públicas.",
      "tire": "Neumático",
      "rpm": "RPM Máximo"
    }
  },
  "fr": {
    "title": "Mon Profil - Classic Mini DIY",
    "description": "Voir votre profil Classic Mini DIY.",
    "hero_title": "Archives Classic Mini",
    "breadcrumb_title": "Mon Profil",
    "anonymous": "Passionné de Mini",
    "member_since": "Membre depuis {date}",
    "edit_profile": "Modifier le Profil",
    "share_profile": "Partager le Profil",
    "auth": {
      "sign_in_title": "Connectez-vous pour Voir le Profil",
      "sign_in_description": "Vous devez être connecté pour voir votre profil.",
      "sign_in_button": "Se Connecter"
    },
    "share_modal": {
      "title": "Partagez Votre Profil",
      "copy": "Copier"
    },
    "vehicles": {
      "title": "Mes Minis"
    },
    "gear_configs": {
      "title": "Configurations d'Engrenages",
      "empty": "Aucune configuration publique partagée.",
      "tire": "Pneu",
      "rpm": "RPM Max"
    }
  },
  "de": {
    "title": "Mein Profil - Classic Mini DIY",
    "description": "Sehen Sie Ihr Classic Mini DIY Profil.",
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "Mein Profil",
    "anonymous": "Mini-Enthusiast",
    "member_since": "Mitglied seit {date}",
    "edit_profile": "Profil Bearbeiten",
    "share_profile": "Profil Teilen",
    "auth": {
      "sign_in_title": "Anmelden um Profil zu Sehen",
      "sign_in_description": "Sie müssen angemeldet sein, um Ihr Profil zu sehen.",
      "sign_in_button": "Anmelden"
    },
    "share_modal": {
      "title": "Profil Teilen",
      "copy": "Kopieren"
    },
    "vehicles": {
      "title": "Meine Minis"
    },
    "gear_configs": {
      "title": "Getriebe-Konfigurationen",
      "empty": "Keine öffentlichen Konfigurationen geteilt.",
      "tire": "Reifen",
      "rpm": "Max Drehzahl"
    }
  },
  "it": {
    "title": "Il Mio Profilo - Classic Mini DIY",
    "description": "Visualizza il tuo profilo Classic Mini DIY.",
    "hero_title": "Archivi Classic Mini",
    "breadcrumb_title": "Il Mio Profilo",
    "anonymous": "Appassionato di Mini",
    "member_since": "Membro dal {date}",
    "edit_profile": "Modifica Profilo",
    "share_profile": "Condividi Profilo",
    "auth": {
      "sign_in_title": "Accedi per Vedere il Profilo",
      "sign_in_description": "Devi essere connesso per vedere il tuo profilo.",
      "sign_in_button": "Accedi"
    },
    "share_modal": {
      "title": "Condividi il Tuo Profilo",
      "copy": "Copia"
    },
    "vehicles": {
      "title": "Le Mie Mini"
    },
    "gear_configs": {
      "title": "Configurazioni Ingranaggi",
      "empty": "Nessuna configurazione pubblica condivisa.",
      "tire": "Pneumatico",
      "rpm": "RPM Max"
    }
  },
  "pt": {
    "title": "Meu Perfil - Classic Mini DIY",
    "description": "Veja seu perfil Classic Mini DIY.",
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb_title": "Meu Perfil",
    "anonymous": "Entusiasta do Mini",
    "member_since": "Membro desde {date}",
    "edit_profile": "Editar Perfil",
    "share_profile": "Compartilhar Perfil",
    "auth": {
      "sign_in_title": "Entre para Ver o Perfil",
      "sign_in_description": "Você precisa estar conectado para ver seu perfil.",
      "sign_in_button": "Entrar"
    },
    "share_modal": {
      "title": "Compartilhe Seu Perfil",
      "copy": "Copiar"
    },
    "vehicles": {
      "title": "Meus Minis"
    },
    "gear_configs": {
      "title": "Configurações de Engrenagens",
      "empty": "Nenhuma configuração pública compartilhada.",
      "tire": "Pneu",
      "rpm": "RPM Máx"
    }
  },
  "ru": {
    "title": "Мой Профиль - Classic Mini DIY",
    "description": "Просмотрите свой профиль Classic Mini DIY.",
    "hero_title": "Архивы Classic Mini",
    "breadcrumb_title": "Мой Профиль",
    "anonymous": "Энтузиаст Mini",
    "member_since": "Участник с {date}",
    "edit_profile": "Редактировать Профиль",
    "share_profile": "Поделиться Профилем",
    "auth": {
      "sign_in_title": "Войдите для Просмотра Профиля",
      "sign_in_description": "Вы должны быть авторизованы для просмотра профиля.",
      "sign_in_button": "Войти"
    },
    "share_modal": {
      "title": "Поделиться Профилем",
      "copy": "Копировать"
    },
    "vehicles": {
      "title": "Мои Mini"
    },
    "gear_configs": {
      "title": "Конфигурации Передач",
      "empty": "Нет публичных конфигураций.",
      "tire": "Шина",
      "rpm": "Макс. об/мин"
    }
  },
  "ja": {
    "title": "マイプロフィール - Classic Mini DIY",
    "description": "Classic Mini DIYプロフィールを表示します。",
    "hero_title": "Classic Mini アーカイブ",
    "breadcrumb_title": "マイプロフィール",
    "anonymous": "Miniエンスージアスト",
    "member_since": "{date}から参加",
    "edit_profile": "プロフィール編集",
    "share_profile": "プロフィール共有",
    "auth": {
      "sign_in_title": "プロフィール表示にはログインが必要です",
      "sign_in_description": "プロフィールを表示するにはログインが必要です。",
      "sign_in_button": "ログイン"
    },
    "share_modal": {
      "title": "プロフィールを共有",
      "copy": "コピー"
    },
    "vehicles": {
      "title": "マイMini"
    },
    "gear_configs": {
      "title": "ギア設定",
      "empty": "公開設定はまだありません。",
      "tire": "タイヤ",
      "rpm": "最大RPM"
    }
  },
  "zh": {
    "title": "我的资料 - Classic Mini DIY",
    "description": "查看您的Classic Mini DIY个人资料。",
    "hero_title": "Classic Mini 档案",
    "breadcrumb_title": "我的资料",
    "anonymous": "Mini爱好者",
    "member_since": "{date}加入",
    "edit_profile": "编辑资料",
    "share_profile": "分享资料",
    "auth": {
      "sign_in_title": "登录以查看资料",
      "sign_in_description": "您需要登录才能查看您的资料。",
      "sign_in_button": "登录"
    },
    "share_modal": {
      "title": "分享您的资料",
      "copy": "复制"
    },
    "vehicles": {
      "title": "我的Mini"
    },
    "gear_configs": {
      "title": "齿轮配置",
      "empty": "暂无公开配置。",
      "tire": "轮胎",
      "rpm": "最大转速"
    }
  },
  "ko": {
    "title": "내 프로필 - Classic Mini DIY",
    "description": "Classic Mini DIY 프로필을 봅니다.",
    "hero_title": "Classic Mini 아카이브",
    "breadcrumb_title": "내 프로필",
    "anonymous": "Mini 애호가",
    "member_since": "{date}부터 회원",
    "edit_profile": "프로필 편집",
    "share_profile": "프로필 공유",
    "auth": {
      "sign_in_title": "프로필 보기를 위해 로그인하세요",
      "sign_in_description": "프로필을 보려면 로그인해야 합니다.",
      "sign_in_button": "로그인"
    },
    "share_modal": {
      "title": "프로필 공유",
      "copy": "복사"
    },
    "vehicles": {
      "title": "나의 Mini"
    },
    "gear_configs": {
      "title": "기어 구성",
      "empty": "아직 공개된 구성이 없습니다.",
      "tire": "타이어",
      "rpm": "최대 RPM"
    }
  }
}
</i18n>
