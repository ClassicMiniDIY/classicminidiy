<script setup lang="ts">
  import { type ModelCard, priceLabel } from '~~/data/models/model-library';

  const props = defineProps<{ model: ModelCard }>();

  const { t } = useI18n();
  const price = computed(() => priceLabel(props.model));
  const isPaid = computed(() => ['fixed', 'pwyw'].includes(props.model.pricingMode));
</script>

<template>
  <NuxtLink
    :to="`/models/${model.slug}`"
    class="card bg-base-100 shadow-sm border border-base-300 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group"
  >
    <figure class="relative aspect-[4/3] bg-base-200 overflow-hidden">
      <img
        v-if="model.primaryImage"
        :src="model.primaryImage"
        :alt="model.title"
        loading="lazy"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      />
      <div v-else class="w-full h-full flex items-center justify-center text-base-content/30">
        <i class="fas fa-cube text-4xl"></i>
      </div>
      <span v-if="model.isFeatured" class="absolute top-2 left-2 badge badge-primary badge-sm gap-1">
        <i class="fas fa-star text-[0.6rem]"></i> {{ t('badge.featured') }}
      </span>
      <span
        v-if="model.safetyCritical"
        class="absolute top-2 right-2 badge badge-warning badge-sm gap-1"
        :title="t('badge.safetyCritical')"
      >
        <i class="fas fa-triangle-exclamation text-[0.6rem]"></i>
      </span>
      <span
        class="absolute bottom-2 right-2 badge badge-sm font-semibold"
        :class="isPaid ? 'badge-primary' : 'badge-neutral'"
      >
        {{ price }}
      </span>
    </figure>

    <div class="card-body p-4 gap-1">
      <h3 class="font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
        {{ model.title }}
      </h3>
      <p v-if="model.summary" class="text-sm opacity-70 line-clamp-2">{{ model.summary }}</p>

      <div class="flex items-center justify-between mt-2 text-xs opacity-70">
        <span v-if="model.author" class="flex items-center gap-1.5 min-w-0">
          <img
            v-if="model.author.avatarUrl"
            :src="model.author.avatarUrl"
            :alt="model.author.displayName || t('author.label')"
            class="w-5 h-5 rounded-full object-cover"
            loading="lazy"
          />
          <i v-else class="fas fa-circle-user text-base"></i>
          <span class="truncate">{{ model.author.displayName || model.author.username || t('author.anonymous') }}</span>
        </span>
        <span v-else></span>

        <span class="flex items-center gap-3 shrink-0">
          <span :title="t('stat.likes')"><i class="fas fa-heart"></i> {{ model.likeCount }}</span>
          <span :title="t('stat.downloads')"><i class="fas fa-download"></i> {{ model.downloadCount }}</span>
        </span>
      </div>
    </div>
  </NuxtLink>
</template>

<i18n lang="json">
{
  "en": {
    "badge": {
      "featured": "Featured",
      "safetyCritical": "Safety-critical part"
    },
    "author": {
      "label": "Author",
      "anonymous": "Anonymous"
    },
    "stat": {
      "likes": "Likes",
      "downloads": "Downloads"
    }
  },
  "es": {
    "badge": {
      "featured": "Destacado",
      "safetyCritical": "Pieza de seguridad crítica"
    },
    "author": {
      "label": "Autor",
      "anonymous": "Anónimo"
    },
    "stat": {
      "likes": "Me gusta",
      "downloads": "Descargas"
    }
  },
  "fr": {
    "badge": {
      "featured": "En vedette",
      "safetyCritical": "Pièce critique pour la sécurité"
    },
    "author": {
      "label": "Auteur",
      "anonymous": "Anonyme"
    },
    "stat": {
      "likes": "J'aime",
      "downloads": "Téléchargements"
    }
  },
  "de": {
    "badge": {
      "featured": "Empfohlen",
      "safetyCritical": "Sicherheitskritisches Bauteil"
    },
    "author": {
      "label": "Autor",
      "anonymous": "Anonym"
    },
    "stat": {
      "likes": "Gefällt mir",
      "downloads": "Downloads"
    }
  },
  "it": {
    "badge": {
      "featured": "In evidenza",
      "safetyCritical": "Componente critico per la sicurezza"
    },
    "author": {
      "label": "Autore",
      "anonymous": "Anonimo"
    },
    "stat": {
      "likes": "Mi piace",
      "downloads": "Download"
    }
  },
  "pt": {
    "badge": {
      "featured": "Destaque",
      "safetyCritical": "Peça de segurança crítica"
    },
    "author": {
      "label": "Autor",
      "anonymous": "Anônimo"
    },
    "stat": {
      "likes": "Curtidas",
      "downloads": "Downloads"
    }
  },
  "ru": {
    "badge": {
      "featured": "Рекомендуем",
      "safetyCritical": "Критически важная деталь безопасности"
    },
    "author": {
      "label": "Автор",
      "anonymous": "Аноним"
    },
    "stat": {
      "likes": "Нравится",
      "downloads": "Загрузки"
    }
  },
  "ja": {
    "badge": {
      "featured": "おすすめ",
      "safetyCritical": "安全上重要な部品"
    },
    "author": {
      "label": "作者",
      "anonymous": "匿名"
    },
    "stat": {
      "likes": "いいね",
      "downloads": "ダウンロード"
    }
  },
  "zh": {
    "badge": {
      "featured": "精选",
      "safetyCritical": "安全关键零件"
    },
    "author": {
      "label": "作者",
      "anonymous": "匿名"
    },
    "stat": {
      "likes": "点赞",
      "downloads": "下载"
    }
  },
  "ko": {
    "badge": {
      "featured": "추천",
      "safetyCritical": "안전 관련 부품"
    },
    "author": {
      "label": "작성자",
      "anonymous": "익명"
    },
    "stat": {
      "likes": "좋아요",
      "downloads": "다운로드"
    }
  }
}
</i18n>
