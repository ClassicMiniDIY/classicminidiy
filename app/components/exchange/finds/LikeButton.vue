<template>
  <button
    class="btn btn-ghost btn-sm gap-1"
    :title="isLiked ? t('unlike') : t('like')"
    :aria-label="isLiked ? t('unlikeFind') : t('likeFind')"
    @click.prevent="$emit('toggle')"
  >
    <i :class="[isLiked ? 'fas fa-heart text-error' : 'far fa-heart']"></i>
    <span class="text-sm">{{ likeCount }}</span>
  </button>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  defineProps<{
    findId: string;
    likeCount: number;
    isLiked: boolean;
  }>();

  defineEmits<{
    toggle: [];
  }>();
</script>

<i18n lang="json">
{
  "en": { "like": "Like", "unlike": "Unlike", "likeFind": "Like this find", "unlikeFind": "Unlike this find" },
  "es": { "like": "Me gusta", "unlike": "Ya no me gusta", "likeFind": "Me gusta este hallazgo", "unlikeFind": "Ya no me gusta este hallazgo" },
  "fr": { "like": "J'aime", "unlike": "Je n'aime plus", "likeFind": "J'aime cette trouvaille", "unlikeFind": "Je n'aime plus cette trouvaille" },
  "de": { "like": "Gefällt mir", "unlike": "Gefällt mir nicht mehr", "likeFind": "Diesen Fund liken", "unlikeFind": "Like für diesen Fund entfernen" },
  "it": { "like": "Mi piace", "unlike": "Non mi piace più", "likeFind": "Aggiungi mi piace a questa scoperta", "unlikeFind": "Rimuovi mi piace da questa scoperta" },
  "pt": { "like": "Curtir", "unlike": "Descurtir", "likeFind": "Curtir este achado", "unlikeFind": "Descurtir este achado" },
  "ru": { "like": "Нравится", "unlike": "Не нравится", "likeFind": "Нравится эта находка", "unlikeFind": "Убрать отметку «Нравится» с этой находки" },
  "ja": { "like": "いいね", "unlike": "いいねを取り消す", "likeFind": "この出品にいいね", "unlikeFind": "この出品のいいねを取り消す" },
  "zh": { "like": "点赞", "unlike": "取消点赞", "likeFind": "为这个发现点赞", "unlikeFind": "取消为这个发现点赞" },
  "ko": { "like": "좋아요", "unlike": "좋아요 취소", "likeFind": "이 발견에 좋아요", "unlikeFind": "이 발견 좋아요 취소" }
}
</i18n>
