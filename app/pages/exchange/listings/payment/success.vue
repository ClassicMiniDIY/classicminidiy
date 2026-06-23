<template>
  <div class="container mx-auto px-4 py-12">
    <div class="max-w-2xl mx-auto">
      <!-- Success State -->
      <div v-if="!loading && listing" class="text-center">
        <div class="mb-6">
          <div class="inline-flex items-center justify-center w-20 h-20 bg-success/10 rounded-full mb-4">
            <i class="fas fa-circle-check text-5xl text-success"></i>
          </div>
          <h1 class="text-3xl font-bold mb-2">{{ t('success.title') }}</h1>
          <p class="text-base-content/70 text-lg">{{ t('success.subtitle') }}</p>
        </div>

        <!-- Listing Preview Card -->
        <div class="card bg-base-100 shadow-lg mb-6">
          <div class="card-body">
            <div class="flex items-start gap-4">
              <div class="avatar">
                <div class="w-24 h-24 rounded-lg">
                  <img
                    v-if="photoUrl"
                    :src="photoUrl"
                    :alt="listing.title"
                    class="object-contain"
                    style="object-fit: contain"
                    loading="lazy"
                  />
                  <div v-else class="bg-base-200 w-full h-full flex items-center justify-center">
                    <i class="fas fa-image text-3xl text-base-content/30"></i>
                  </div>
                </div>
              </div>

              <div class="flex-1 text-left">
                <div class="flex items-center gap-2 mb-2">
                  <h2 class="text-xl font-semibold">{{ listing.title }}</h2>
                  <ExchangeListingsFeaturedBadge :tier="listing.tier" :featured-until="listing.featured_until" />
                </div>
                <p class="text-base-content/70 mb-2">{{ listing.year }} {{ listing.model }}</p>
                <div class="text-2xl font-bold text-primary">${{ listing.price?.toLocaleString() }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tier Benefits -->
        <div class="alert alert-info mb-6">
          <i class="fas fa-circle-info text-xl"></i>
          <div class="text-left">
            <h3 class="font-semibold mb-1">{{ t('benefits.heading', { tier: tierName }) }}</h3>
            <ul class="text-sm space-y-1">
              <li v-for="benefit in tierBenefits" :key="benefit">• {{ benefit }}</li>
            </ul>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-4 justify-center">
          <NuxtLink :to="`/exchange/listings/${listing.slug}`" class="btn btn-primary">
            <i class="fas fa-eye"></i>
            {{ t('actions.view') }}
          </NuxtLink>
          <NuxtLink to="/dashboard/listings" class="btn btn-outline">
            <i class="fas fa-table-cells-large"></i>
            {{ t('actions.dashboard') }}
          </NuxtLink>
        </div>
      </div>

      <!-- Loading State -->
      <div v-else-if="loading" class="text-center py-12">
        <span class="loading loading-spinner loading-lg text-primary"></span>
        <p class="mt-4 text-base-content/70">{{ t('processing') }}</p>
      </div>

      <!-- Error State -->
      <div v-else class="text-center">
        <div class="inline-flex items-center justify-center w-20 h-20 bg-error/10 rounded-full mb-4">
          <i class="fas fa-circle-xmark text-5xl text-error"></i>
        </div>
        <h1 class="text-3xl font-bold mb-2">{{ t('error.title') }}</h1>
        <p class="text-base-content/70 mb-6">{{ t('error.body') }}</p>
        <NuxtLink to="/dashboard/listings" class="btn btn-primary">{{ t('actions.dashboard') }}</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { ListingWithPhotos } from '~/composables/useListings';

  const { t } = useI18n();

  definePageMeta({
    middleware: 'exchange-auth',
  });

  useSeoMeta({
    title: () => t('seo.title'),
    robots: 'noindex, nofollow',
  });

  const route = useRoute();
  const { getListingById, getPrimaryPhoto } = useListings();
  const { capture } = usePostHog();
  const { getTierPricing, verifyPayment } = usePayments();

  const loading = ref(true);
  const listing = ref<ListingWithPhotos | null>(null);

  const listingId = computed(() => route.query.listing_id as string);
  const sessionId = computed(() => route.query.session_id as string);

  const photoUrl = computed(() => {
    if (!listing.value) return null;
    return getPrimaryPhoto(listing.value);
  });

  const tierName = computed(() => {
    if (!listing.value) return '';
    if (listing.value.tier === 'paid') return t('tier.premium');
    return listing.value.tier.charAt(0).toUpperCase() + listing.value.tier.slice(1);
  });

  const tierBenefits = computed<string[]>(() => {
    if (!listing.value) return [];
    if (listing.value.tier === 'paid') {
      return [
        t('benefits.paid.photos'),
        t('benefits.paid.featured'),
        t('benefits.paid.priority'),
        t('benefits.paid.carousel'),
        t('benefits.paid.badge'),
      ];
    }
    if (listing.value.tier === 'free') {
      return [t('benefits.free.photos'), t('benefits.free.details'), t('benefits.free.active')];
    }
    return [];
  });

  // Verify payment (server-authoritative — marks the listing paid only if Stripe
  // confirms the session) then load the now-activated listing.
  const verifyAndLoad = async () => {
    if (!listingId.value) {
      loading.value = false;
      return;
    }
    try {
      if (sessionId.value) {
        await verifyPayment(sessionId.value);
      }
      listing.value = await getListingById(listingId.value);
    } catch (error) {
      console.error('Failed to verify payment or load listing:', error);
    } finally {
      loading.value = false;
    }
  };

  onMounted(() => {
    verifyAndLoad();

    if (listingId.value) {
      const tier = getTierPricing('paid');
      capture('checkout_completed', {
        listing_id: listingId.value,
        tier: 'paid',
        amount_cents: tier.price,
        currency: 'usd',
      });
    }
  });
</script>

<i18n lang="json">
{
  "en": { "seo": { "title": "Payment Successful — The Mini Exchange | Classic Mini DIY" }, "success": { "title": "Payment Successful!", "subtitle": "Your listing has been upgraded and is now live on The Mini Exchange." }, "tier": { "premium": "Premium" }, "benefits": { "heading": "Your {tier} Tier Benefits:", "paid": { "photos": "Up to 20 photos", "featured": "Featured placement for 30 days", "priority": "Priority in search results", "carousel": "Homepage carousel exposure", "badge": "Featured badge on your listing" }, "free": { "photos": "Up to 5 photos", "details": "Full listing details", "active": "Active until sold or cancelled" } }, "actions": { "view": "View Your Listing", "dashboard": "Go to Dashboard" }, "processing": "Processing your payment...", "error": { "title": "Something Went Wrong", "body": "We couldn't find your listing. Please check your dashboard or contact support." } },
  "es": { "seo": { "title": "Pago realizado — The Mini Exchange | Classic Mini DIY" }, "success": { "title": "¡Pago realizado!", "subtitle": "Tu anuncio se ha mejorado y ya está publicado en The Mini Exchange." }, "tier": { "premium": "Premium" }, "benefits": { "heading": "Beneficios de tu nivel {tier}:", "paid": { "photos": "Hasta 20 fotos", "featured": "Colocación destacada durante 30 días", "priority": "Prioridad en los resultados de búsqueda", "carousel": "Exposición en el carrusel de inicio", "badge": "Insignia destacada en tu anuncio" }, "free": { "photos": "Hasta 5 fotos", "details": "Detalles completos del anuncio", "active": "Activo hasta vender o cancelar" } }, "actions": { "view": "Ver tu anuncio", "dashboard": "Ir al panel" }, "processing": "Procesando tu pago...", "error": { "title": "Algo salió mal", "body": "No encontramos tu anuncio. Revisa tu panel o contacta con soporte." } },
  "fr": { "seo": { "title": "Paiement réussi — The Mini Exchange | Classic Mini DIY" }, "success": { "title": "Paiement réussi !", "subtitle": "Votre annonce a été améliorée et est maintenant en ligne sur The Mini Exchange." }, "tier": { "premium": "Premium" }, "benefits": { "heading": "Avantages de votre formule {tier} :", "paid": { "photos": "Jusqu'à 20 photos", "featured": "Mise en avant pendant 30 jours", "priority": "Priorité dans les résultats de recherche", "carousel": "Exposition dans le carrousel d'accueil", "badge": "Badge en vedette sur votre annonce" }, "free": { "photos": "Jusqu'à 5 photos", "details": "Détails complets de l'annonce", "active": "Active jusqu'à la vente ou l'annulation" } }, "actions": { "view": "Voir votre annonce", "dashboard": "Aller au tableau de bord" }, "processing": "Traitement de votre paiement...", "error": { "title": "Une erreur s'est produite", "body": "Nous n'avons pas trouvé votre annonce. Vérifiez votre tableau de bord ou contactez le support." } },
  "de": { "seo": { "title": "Zahlung erfolgreich — The Mini Exchange | Classic Mini DIY" }, "success": { "title": "Zahlung erfolgreich!", "subtitle": "Deine Anzeige wurde hochgestuft und ist jetzt auf The Mini Exchange live." }, "tier": { "premium": "Premium" }, "benefits": { "heading": "Vorteile deiner {tier}-Stufe:", "paid": { "photos": "Bis zu 20 Fotos", "featured": "Hervorgehobene Platzierung für 30 Tage", "priority": "Priorität in den Suchergebnissen", "carousel": "Präsenz im Startseiten-Karussell", "badge": "Hervorgehoben-Abzeichen auf deiner Anzeige" }, "free": { "photos": "Bis zu 5 Fotos", "details": "Vollständige Anzeigendetails", "active": "Aktiv bis verkauft oder storniert" } }, "actions": { "view": "Anzeige ansehen", "dashboard": "Zum Dashboard" }, "processing": "Deine Zahlung wird verarbeitet...", "error": { "title": "Etwas ist schiefgelaufen", "body": "Wir konnten deine Anzeige nicht finden. Prüfe dein Dashboard oder kontaktiere den Support." } },
  "it": { "seo": { "title": "Pagamento riuscito — The Mini Exchange | Classic Mini DIY" }, "success": { "title": "Pagamento riuscito!", "subtitle": "Il tuo annuncio è stato potenziato ed è ora online su The Mini Exchange." }, "tier": { "premium": "Premium" }, "benefits": { "heading": "Vantaggi del tuo livello {tier}:", "paid": { "photos": "Fino a 20 foto", "featured": "Posizionamento in evidenza per 30 giorni", "priority": "Priorità nei risultati di ricerca", "carousel": "Visibilità nel carosello della home", "badge": "Badge in evidenza sul tuo annuncio" }, "free": { "photos": "Fino a 5 foto", "details": "Dettagli completi dell'annuncio", "active": "Attivo fino alla vendita o cancellazione" } }, "actions": { "view": "Vedi il tuo annuncio", "dashboard": "Vai alla dashboard" }, "processing": "Elaborazione del pagamento...", "error": { "title": "Qualcosa è andato storto", "body": "Non abbiamo trovato il tuo annuncio. Controlla la dashboard o contatta l'assistenza." } },
  "pt": { "seo": { "title": "Pagamento concluído — The Mini Exchange | Classic Mini DIY" }, "success": { "title": "Pagamento concluído!", "subtitle": "Seu anúncio foi atualizado e já está no ar na The Mini Exchange." }, "tier": { "premium": "Premium" }, "benefits": { "heading": "Benefícios do seu nível {tier}:", "paid": { "photos": "Até 20 fotos", "featured": "Posição em destaque por 30 dias", "priority": "Prioridade nos resultados de busca", "carousel": "Exposição no carrossel da página inicial", "badge": "Selo de destaque no seu anúncio" }, "free": { "photos": "Até 5 fotos", "details": "Detalhes completos do anúncio", "active": "Ativo até ser vendido ou cancelado" } }, "actions": { "view": "Ver seu anúncio", "dashboard": "Ir para o painel" }, "processing": "Processando seu pagamento...", "error": { "title": "Algo deu errado", "body": "Não encontramos seu anúncio. Verifique o painel ou contate o suporte." } },
  "ru": { "seo": { "title": "Оплата прошла — The Mini Exchange | Classic Mini DIY" }, "success": { "title": "Оплата прошла успешно!", "subtitle": "Ваше объявление повышено и теперь опубликовано на The Mini Exchange." }, "tier": { "premium": "Премиум" }, "benefits": { "heading": "Преимущества уровня {tier}:", "paid": { "photos": "До 20 фотографий", "featured": "Рекомендуемое размещение на 30 дней", "priority": "Приоритет в результатах поиска", "carousel": "Показ в карусели на главной", "badge": "Значок «рекомендуемое» на объявлении" }, "free": { "photos": "До 5 фотографий", "details": "Полные данные объявления", "active": "Активно до продажи или отмены" } }, "actions": { "view": "Посмотреть объявление", "dashboard": "В панель управления" }, "processing": "Обработка оплаты...", "error": { "title": "Что-то пошло не так", "body": "Мы не нашли ваше объявление. Проверьте панель управления или обратитесь в поддержку." } },
  "ja": { "seo": { "title": "支払い完了 — The Mini Exchange | Classic Mini DIY" }, "success": { "title": "支払いが完了しました!", "subtitle": "出品がアップグレードされ、The Mini Exchange に公開されました。" }, "tier": { "premium": "プレミアム" }, "benefits": { "heading": "{tier} プランの特典:", "paid": { "photos": "最大20枚の写真", "featured": "30日間の優先掲載", "priority": "検索結果での優先表示", "carousel": "トップページのカルーセル掲載", "badge": "出品への注目バッジ" }, "free": { "photos": "最大5枚の写真", "details": "出品の詳細すべて", "active": "売却またはキャンセルまで有効" } }, "actions": { "view": "出品を見る", "dashboard": "ダッシュボードへ" }, "processing": "支払いを処理しています..." , "error": { "title": "問題が発生しました", "body": "出品が見つかりませんでした。ダッシュボードを確認するかサポートにお問い合わせください。" } },
  "zh": { "seo": { "title": "支付成功 — The Mini Exchange | Classic Mini DIY" }, "success": { "title": "支付成功!", "subtitle": "您的刊登已升级，现已在 The Mini Exchange 上线。" }, "tier": { "premium": "高级" }, "benefits": { "heading": "您的 {tier} 等级权益:", "paid": { "photos": "最多 20 张照片", "featured": "30 天精选展示", "priority": "搜索结果优先", "carousel": "首页轮播展示", "badge": "刊登精选徽章" }, "free": { "photos": "最多 5 张照片", "details": "完整刊登详情", "active": "在售出或取消前有效" } }, "actions": { "view": "查看您的刊登", "dashboard": "前往仪表板" }, "processing": "正在处理您的付款...", "error": { "title": "出了点问题", "body": "未找到您的刊登。请检查仪表板或联系支持。" } },
  "ko": { "seo": { "title": "결제 완료 — The Mini Exchange | Classic Mini DIY" }, "success": { "title": "결제 완료!", "subtitle": "매물이 업그레이드되어 The Mini Exchange에 게시되었습니다." }, "tier": { "premium": "프리미엄" }, "benefits": { "heading": "{tier} 등급 혜택:", "paid": { "photos": "사진 최대 20장", "featured": "30일간 추천 노출", "priority": "검색 결과 우선 노출", "carousel": "홈페이지 캐러셀 노출", "badge": "매물 추천 배지" }, "free": { "photos": "사진 최대 5장", "details": "전체 매물 상세정보", "active": "판매 또는 취소 시까지 활성" } }, "actions": { "view": "내 매물 보기", "dashboard": "대시보드로 이동" }, "processing": "결제를 처리하는 중...", "error": { "title": "문제가 발생했습니다", "body": "매물을 찾을 수 없습니다. 대시보드를 확인하거나 지원팀에 문의하세요." } }
}
</i18n>
