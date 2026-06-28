<template>
  <div>
    <!-- Page Header -->
    <section class="bg-base-100 border-b border-base-300 py-12">
      <div class="container">
        <div class="text-center">
          <h1 class="text-4xl font-bold mb-3">{{ t('header.title') }}</h1>
          <p class="text-base-content/70 mb-6 max-w-lg mx-auto">
            {{ t('header.subtitle') }}
          </p>
          <div class="flex justify-center gap-4">
            <a
              href="https://www.instagram.com/theminiexchange"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-ghost btn-sm"
              :aria-label="t('follow.instagram')"
            >
              <i class="fab fa-instagram"></i>
              Instagram
            </a>
            <a
              href="https://www.facebook.com/theminiexchange"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-ghost btn-sm"
              :aria-label="t('follow.facebook')"
            >
              <i class="fab fa-facebook"></i>
              Facebook
            </a>
            <a
              href="https://bsky.app/profile/theminiexchange.bsky.social"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-ghost btn-sm"
              :aria-label="t('follow.bluesky')"
            >
              <i class="fab fa-bluesky"></i>
              Bluesky
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- Main Content -->
    <section class="py-8">
      <div class="container">
        <!-- Results Header -->
        <div class="flex items-center justify-between mb-6">
          <p class="text-base-content/70">
            <span v-if="loading">{{ t('results.loading') }}</span>
            <span v-else-if="totalCount > 0">
              {{ t('results.count', { count: totalCount }, totalCount) }}
            </span>
            <span v-else>{{ t('results.none') }}</span>
          </p>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="i in 6" :key="i" class="skeleton h-80 w-full rounded-xl"></div>
        </div>

        <!-- Listings Grid -->
        <div v-else-if="listings.length > 0">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div v-for="listing in listings" :key="listing.id" class="relative">
              <!-- "Posted X ago" badge -->
              <div class="absolute top-3 left-3 z-10">
                <span class="badge badge-neutral badge-sm shadow">
                  <i class="fas fa-bullhorn mr-1"></i>
                  {{ formatPostedDate(listing.promoted_on_social_at) }}
                </span>
              </div>
              <ExchangeListingsListingCard :listing="listing" :show-seller-info="false" />
            </div>
          </div>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="flex justify-center mt-8">
            <div class="join">
              <button class="join-item btn btn-sm" :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">
                <i class="fas fa-chevron-left"></i>
              </button>
              <button
                v-for="page in visiblePages"
                :key="page"
                class="join-item btn btn-sm"
                :class="{ 'btn-active': page === currentPage }"
                @click="goToPage(page)"
              >
                {{ page }}
              </button>
              <button
                class="join-item btn btn-sm"
                :disabled="currentPage >= totalPages"
                @click="goToPage(currentPage + 1)"
              >
                <i class="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-16">
          <i class="fas fa-bullhorn text-6xl mx-auto mb-4 text-base-content/30"></i>
          <h3 class="text-xl font-semibold mb-2">{{ t('empty.title') }}</h3>
          <p class="text-base-content/70 mb-6">
            {{ t('empty.body') }}
          </p>
          <NuxtLink to="/exchange/listings" class="btn btn-primary">{{ t('empty.cta') }}</NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { ListingWithPhotos } from '~/composables/useListings';

  const { t } = useI18n();

  useSeoMeta({
    title: () => t('seo.title'),
    description: () => t('seo.description'),
    ogTitle: () => t('seo.title'),
    ogDescription: () => t('seo.description'),
  });

  const supabase = useSupabase();

  const PAGE_SIZE = 12;
  const listings = ref<ListingWithPhotos[]>([]);
  const loading = ref(true);
  const totalCount = ref(0);
  const currentPage = ref(1);

  const totalPages = computed(() => Math.ceil(totalCount.value / PAGE_SIZE));

  // Show at most 5 page buttons around the current page
  const visiblePages = computed(() => {
    const total = totalPages.value;
    const current = currentPage.value;
    const delta = 2;
    const pages: number[] = [];

    const start = Math.max(1, current - delta);
    const end = Math.min(total, current + delta);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  const formatPostedDate = (dateString: string | null): string => {
    if (!dateString) return t('posted.featured');
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('posted.today');
    if (diffDays === 1) return t('posted.yesterday');
    if (diffDays < 7) return t('posted.days', { n: diffDays });
    if (diffDays < 30) return t('posted.weeks', { n: Math.floor(diffDays / 7) });
    if (diffDays < 365) return t('posted.months', { n: Math.floor(diffDays / 30) });
    return t('posted.years', { n: Math.floor(diffDays / 365) });
  };

  const fetchSocialListings = async () => {
    loading.value = true;

    try {
      const start = (currentPage.value - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE - 1;

      const { data, error, count } = await applyPhotoOrdering(
        supabase
          .from('listings')
          .select(
            `
            id,
            title,
            slug,
            description,
            price,
            currency,
            year,
            model,
            manufacturer,
            location,
            city,
            state_province,
            country,
            status,
            tier,
            featured_until,
            final_price,
            listing_category,
            condition,
            promoted_on_social_at,
            listing_photos (
              id,
              storage_path,
              display_order,
              category,
              caption,
              is_primary
            )
          `,
            { count: 'exact' }
          )
          .eq('promoted_on_social', true)
          .eq('status', 'active')
          .not('status', 'in', '("example_free","example_paid")')
          .order('promoted_on_social_at', { ascending: false })
      ).range(start, end);

      if (error) throw error;

      listings.value = (data as ListingWithPhotos[]) || [];
      totalCount.value = count || 0;
    } catch (error) {
      console.error('Failed to fetch social listings:', error);
      listings.value = [];
      totalCount.value = 0;
    } finally {
      loading.value = false;
    }
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages.value) return;
    currentPage.value = page;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  watch(currentPage, () => {
    fetchSocialListings();
  });

  onMounted(() => {
    fetchSocialListings();
  });
</script>

<i18n lang="json">
{
  "en": {
    "header": {
      "title": "As Seen on Our Socials",
      "subtitle": "Browse the Classic Mini listings we've featured on our social media accounts."
    },
    "follow": {
      "instagram": "Follow us on Instagram",
      "facebook": "Follow us on Facebook",
      "bluesky": "Follow us on Bluesky"
    },
    "results": {
      "loading": "Loading...",
      "count": "{count} listing featured on socials | {count} listings featured on socials",
      "none": "No social posts yet"
    },
    "posted": {
      "featured": "Featured",
      "today": "Posted today",
      "yesterday": "Posted yesterday",
      "days": "Posted {n}d ago",
      "weeks": "Posted {n}w ago",
      "months": "Posted {n}mo ago",
      "years": "Posted {n}y ago"
    },
    "empty": {
      "title": "No Social Posts Yet",
      "body": "Check back soon — we regularly feature listings on our social accounts.",
      "cta": "Browse All Listings"
    },
    "seo": {
      "title": "As Seen on Our Socials | The Mini Exchange",
      "description": "Browse Classic Mini listings featured on our social media accounts."
    }
  },
  "es": {
    "header": {
      "title": "Visto en nuestras redes",
      "subtitle": "Explora los anuncios de Classic Mini que hemos destacado en nuestras redes sociales."
    },
    "follow": {
      "instagram": "Síguenos en Instagram",
      "facebook": "Síguenos en Facebook",
      "bluesky": "Síguenos en Bluesky"
    },
    "results": {
      "loading": "Cargando...",
      "count": "{count} anuncio destacado en redes | {count} anuncios destacados en redes",
      "none": "Aún no hay publicaciones en redes"
    },
    "posted": {
      "featured": "Destacado",
      "today": "Publicado hoy",
      "yesterday": "Publicado ayer",
      "days": "Publicado hace {n} d",
      "weeks": "Publicado hace {n} sem",
      "months": "Publicado hace {n} mes",
      "years": "Publicado hace {n} a"
    },
    "empty": {
      "title": "Aún no hay publicaciones en redes",
      "body": "Vuelve pronto: destacamos anuncios en nuestras redes con regularidad.",
      "cta": "Explorar todos los anuncios"
    },
    "seo": {
      "title": "Visto en nuestras redes | The Mini Exchange",
      "description": "Explora los anuncios de Classic Mini destacados en nuestras redes sociales."
    }
  },
  "fr": {
    "header": {
      "title": "Vu sur nos réseaux",
      "subtitle": "Parcourez les annonces Classic Mini mises en avant sur nos réseaux sociaux."
    },
    "follow": {
      "instagram": "Suivez-nous sur Instagram",
      "facebook": "Suivez-nous sur Facebook",
      "bluesky": "Suivez-nous sur Bluesky"
    },
    "results": {
      "loading": "Chargement...",
      "count": "{count} annonce mise en avant sur les réseaux | {count} annonces mises en avant sur les réseaux",
      "none": "Aucune publication sur les réseaux pour le moment"
    },
    "posted": {
      "featured": "À la une",
      "today": "Publié aujourd'hui",
      "yesterday": "Publié hier",
      "days": "Publié il y a {n} j",
      "weeks": "Publié il y a {n} sem",
      "months": "Publié il y a {n} mois",
      "years": "Publié il y a {n} an(s)"
    },
    "empty": {
      "title": "Aucune publication sur les réseaux pour le moment",
      "body": "Revenez bientôt : nous mettons régulièrement des annonces en avant sur nos réseaux.",
      "cta": "Parcourir toutes les annonces"
    },
    "seo": {
      "title": "Vu sur nos réseaux | The Mini Exchange",
      "description": "Parcourez les annonces Classic Mini mises en avant sur nos réseaux sociaux."
    }
  },
  "de": {
    "header": {
      "title": "Gesehen auf unseren Kanälen",
      "subtitle": "Stöbere durch die Classic-Mini-Inserate, die wir auf unseren Social-Media-Kanälen vorgestellt haben."
    },
    "follow": {
      "instagram": "Folge uns auf Instagram",
      "facebook": "Folge uns auf Facebook",
      "bluesky": "Folge uns auf Bluesky"
    },
    "results": {
      "loading": "Wird geladen...",
      "count": "{count} auf Social Media vorgestelltes Inserat | {count} auf Social Media vorgestellte Inserate",
      "none": "Noch keine Social-Media-Beiträge"
    },
    "posted": {
      "featured": "Vorgestellt",
      "today": "Heute gepostet",
      "yesterday": "Gestern gepostet",
      "days": "Vor {n} T gepostet",
      "weeks": "Vor {n} Wo gepostet",
      "months": "Vor {n} Mon gepostet",
      "years": "Vor {n} J gepostet"
    },
    "empty": {
      "title": "Noch keine Social-Media-Beiträge",
      "body": "Schau bald wieder vorbei — wir stellen regelmäßig Inserate auf unseren Kanälen vor.",
      "cta": "Alle Inserate durchsuchen"
    },
    "seo": {
      "title": "Gesehen auf unseren Kanälen | The Mini Exchange",
      "description": "Stöbere durch Classic-Mini-Inserate, die auf unseren Social-Media-Kanälen vorgestellt wurden."
    }
  },
  "it": {
    "header": {
      "title": "Visti sui nostri social",
      "subtitle": "Esplora gli annunci Classic Mini che abbiamo messo in evidenza sui nostri profili social."
    },
    "follow": {
      "instagram": "Seguici su Instagram",
      "facebook": "Seguici su Facebook",
      "bluesky": "Seguici su Bluesky"
    },
    "results": {
      "loading": "Caricamento...",
      "count": "{count} annuncio in evidenza sui social | {count} annunci in evidenza sui social",
      "none": "Ancora nessun post sui social"
    },
    "posted": {
      "featured": "In evidenza",
      "today": "Pubblicato oggi",
      "yesterday": "Pubblicato ieri",
      "days": "Pubblicato {n} g fa",
      "weeks": "Pubblicato {n} sett fa",
      "months": "Pubblicato {n} mes fa",
      "years": "Pubblicato {n} a fa"
    },
    "empty": {
      "title": "Ancora nessun post sui social",
      "body": "Torna presto: mettiamo regolarmente in evidenza gli annunci sui nostri social.",
      "cta": "Esplora tutti gli annunci"
    },
    "seo": {
      "title": "Visti sui nostri social | The Mini Exchange",
      "description": "Esplora gli annunci Classic Mini messi in evidenza sui nostri profili social."
    }
  },
  "pt": {
    "header": {
      "title": "Visto nas nossas redes",
      "subtitle": "Explore os anúncios de Classic Mini que destacámos nas nossas redes sociais."
    },
    "follow": {
      "instagram": "Siga-nos no Instagram",
      "facebook": "Siga-nos no Facebook",
      "bluesky": "Siga-nos no Bluesky"
    },
    "results": {
      "loading": "A carregar...",
      "count": "{count} anúncio destacado nas redes | {count} anúncios destacados nas redes",
      "none": "Ainda não há publicações nas redes"
    },
    "posted": {
      "featured": "Destacado",
      "today": "Publicado hoje",
      "yesterday": "Publicado ontem",
      "days": "Publicado há {n} d",
      "weeks": "Publicado há {n} sem",
      "months": "Publicado há {n} mês",
      "years": "Publicado há {n} a"
    },
    "empty": {
      "title": "Ainda não há publicações nas redes",
      "body": "Volte em breve — destacamos anúncios nas nossas redes com regularidade.",
      "cta": "Explorar todos os anúncios"
    },
    "seo": {
      "title": "Visto nas nossas redes | The Mini Exchange",
      "description": "Explore os anúncios de Classic Mini destacados nas nossas redes sociais."
    }
  },
  "ru": {
    "header": {
      "title": "В наших соцсетях",
      "subtitle": "Смотрите объявления о Classic Mini, которые мы публиковали в наших социальных сетях."
    },
    "follow": {
      "instagram": "Подпишитесь на нас в Instagram",
      "facebook": "Подпишитесь на нас в Facebook",
      "bluesky": "Подпишитесь на нас в Bluesky"
    },
    "results": {
      "loading": "Загрузка...",
      "count": "{count} объявление в соцсетях | {count} объявлений в соцсетях",
      "none": "Пока нет публикаций в соцсетях"
    },
    "posted": {
      "featured": "В подборке",
      "today": "Опубликовано сегодня",
      "yesterday": "Опубликовано вчера",
      "days": "Опубликовано {n} дн. назад",
      "weeks": "Опубликовано {n} нед. назад",
      "months": "Опубликовано {n} мес. назад",
      "years": "Опубликовано {n} г. назад"
    },
    "empty": {
      "title": "Пока нет публикаций в соцсетях",
      "body": "Загляните позже — мы регулярно публикуем объявления в наших соцсетях.",
      "cta": "Смотреть все объявления"
    },
    "seo": {
      "title": "В наших соцсетях | The Mini Exchange",
      "description": "Смотрите объявления о Classic Mini, опубликованные в наших социальных сетях."
    }
  },
  "ja": {
    "header": {
      "title": "SNSで紹介した出品",
      "subtitle": "SNSアカウントで紹介した Classic Mini の出品をご覧ください。"
    },
    "follow": {
      "instagram": "Instagram でフォローする",
      "facebook": "Facebook でフォローする",
      "bluesky": "Bluesky でフォローする"
    },
    "results": {
      "loading": "読み込み中...",
      "count": "SNSで紹介した出品 {count} 件",
      "none": "SNSの投稿はまだありません"
    },
    "posted": {
      "featured": "紹介済み",
      "today": "今日投稿",
      "yesterday": "昨日投稿",
      "days": "{n}日前に投稿",
      "weeks": "{n}週間前に投稿",
      "months": "{n}か月前に投稿",
      "years": "{n}年前に投稿"
    },
    "empty": {
      "title": "SNSの投稿はまだありません",
      "body": "またチェックしてください。SNSアカウントで定期的に出品を紹介しています。",
      "cta": "すべての出品を見る"
    },
    "seo": {
      "title": "SNSで紹介した出品 | The Mini Exchange",
      "description": "SNSアカウントで紹介した Classic Mini の出品をご覧ください。"
    }
  },
  "zh": {
    "header": {
      "title": "我们社交平台精选",
      "subtitle": "浏览我们在社交媒体账号上推荐过的 Classic Mini 商品。"
    },
    "follow": {
      "instagram": "在 Instagram 关注我们",
      "facebook": "在 Facebook 关注我们",
      "bluesky": "在 Bluesky 关注我们"
    },
    "results": {
      "loading": "加载中...",
      "count": "{count} 个社交平台精选商品",
      "none": "暂无社交平台帖子"
    },
    "posted": {
      "featured": "已精选",
      "today": "今天发布",
      "yesterday": "昨天发布",
      "days": "{n} 天前发布",
      "weeks": "{n} 周前发布",
      "months": "{n} 个月前发布",
      "years": "{n} 年前发布"
    },
    "empty": {
      "title": "暂无社交平台帖子",
      "body": "请稍后再来——我们会定期在社交账号上推荐商品。",
      "cta": "浏览全部商品"
    },
    "seo": {
      "title": "我们社交平台精选 | The Mini Exchange",
      "description": "浏览我们在社交媒体账号上推荐过的 Classic Mini 商品。"
    }
  },
  "ko": {
    "header": {
      "title": "SNS에 소개된 매물",
      "subtitle": "SNS 계정에서 소개한 Classic Mini 매물을 둘러보세요."
    },
    "follow": {
      "instagram": "Instagram에서 팔로우하기",
      "facebook": "Facebook에서 팔로우하기",
      "bluesky": "Bluesky에서 팔로우하기"
    },
    "results": {
      "loading": "불러오는 중...",
      "count": "SNS에 소개된 매물 {count}개",
      "none": "아직 SNS 게시물이 없습니다"
    },
    "posted": {
      "featured": "소개됨",
      "today": "오늘 게시",
      "yesterday": "어제 게시",
      "days": "{n}일 전 게시",
      "weeks": "{n}주 전 게시",
      "months": "{n}개월 전 게시",
      "years": "{n}년 전 게시"
    },
    "empty": {
      "title": "아직 SNS 게시물이 없습니다",
      "body": "곧 다시 확인해 주세요. SNS 계정에서 정기적으로 매물을 소개합니다.",
      "cta": "모든 매물 둘러보기"
    },
    "seo": {
      "title": "SNS에 소개된 매물 | The Mini Exchange",
      "description": "SNS 계정에서 소개한 Classic Mini 매물을 둘러보세요."
    }
  }
}
</i18n>
