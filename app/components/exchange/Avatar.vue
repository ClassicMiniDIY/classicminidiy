<template>
  <div class="avatar" :class="{ placeholder: !avatarUrl }">
    <div class="rounded-full bg-neutral text-neutral-content flex items-center justify-center" :class="sizeClasses">
      <img v-if="avatarUrl" :src="avatarUrl" :alt="displayName || t('userAvatar')" class="rounded-full" loading="lazy" />
      <span v-else :class="textSizeClass">{{ initials }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  interface Props {
    avatarUrl?: string | null;
    displayName?: string | null;
    username?: string | null;
    // Only legitimate for own-user contexts (e.g. logged-in user's own avatar).
    // Never pass another user's email here — use `username` instead.
    email?: string | null;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  }

  const props = withDefaults(defineProps<Props>(), {
    size: 'md',
  });

  // Size mappings for avatar container
  const sizeClasses = computed(() => {
    const sizes = {
      xs: 'w-8 h-8',
      sm: 'w-10 h-10',
      md: 'w-16 h-16',
      lg: 'w-24 h-24',
      xl: 'w-32 h-32',
    };
    return sizes[props.size];
  });

  // Size mappings for text
  const textSizeClass = computed(() => {
    const sizes = {
      xs: 'text-xs',
      sm: 'text-sm',
      md: 'text-lg',
      lg: 'text-3xl',
      xl: 'text-4xl',
    };
    return sizes[props.size];
  });

  // Compute display name from props
  const displayName = computed(() => {
    if (props.displayName) return props.displayName;
    if (props.username) return props.username;
    if (props.email) return props.email.split('@')[0];
    return t('anonymous');
  });

  // Generate initials from display name
  const initials = computed(() => {
    const name = displayName.value || 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  });
</script>

<i18n lang="json">
{
  "en": { "userAvatar": "User avatar", "anonymous": "Anonymous" },
  "es": { "userAvatar": "Avatar de usuario", "anonymous": "Anónimo" },
  "fr": { "userAvatar": "Avatar de l'utilisateur", "anonymous": "Anonyme" },
  "de": { "userAvatar": "Benutzer-Avatar", "anonymous": "Anonym" },
  "it": { "userAvatar": "Avatar utente", "anonymous": "Anonimo" },
  "pt": { "userAvatar": "Avatar do usuário", "anonymous": "Anônimo" },
  "ru": { "userAvatar": "Аватар пользователя", "anonymous": "Аноним" },
  "ja": { "userAvatar": "ユーザーアバター", "anonymous": "匿名" },
  "zh": { "userAvatar": "用户头像", "anonymous": "匿名" },
  "ko": { "userAvatar": "사용자 아바타", "anonymous": "익명" }
}
</i18n>
