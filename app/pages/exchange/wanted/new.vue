<template>
  <div>
    <!-- Page Header -->
    <section class="bg-base-100 border-b border-base-300 py-12">
      <div class="container">
        <div class="flex items-center gap-3 mb-4">
          <NuxtLink to="/exchange/wanted" class="btn btn-ghost btn-sm gap-1">
            <i class="fas fa-arrow-left"></i>
            {{ t('back') }}
          </NuxtLink>
        </div>
        <h1 class="text-3xl font-bold">{{ t('heading') }}</h1>
        <p class="text-base-content/70 mt-2">{{ t('subtitle') }}</p>
      </div>
    </section>

    <!-- Form Section -->
    <section class="py-12">
      <div class="container max-w-2xl">
        <ExchangeWantedForm :submitting="submitting" @submit="handleSubmit" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  definePageMeta({
    middleware: 'exchange-auth',
  });

  useSeoMeta({
    title: () => t('seo.title'),
    robots: 'noindex, nofollow',
  });

  const router = useRouter();
  const { createWantedPost } = useWantedPosts();
  const { handleError } = useErrorHandler();

  const submitting = ref(false);

  const handleSubmit = async (data: {
    title: string;
    description: string;
    category: string;
    partsSubcategory: string;
    conditionPreference: string;
    budgetMin: number | null;
    budgetMax: number | null;
    currency: string;
    city: string;
    stateProvince: string;
    country: string;
  }) => {
    submitting.value = true;

    try {
      const post = await createWantedPost({
        title: data.title,
        description: data.description,
        category: data.category,
        partsSubcategory: data.partsSubcategory || null,
        conditionPreference: data.conditionPreference,
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        currency: data.currency,
        city: data.city || null,
        stateProvince: data.stateProvince || null,
        country: data.country || null,
      });

      if (post) {
        if (post.moderation_status === 'flagged') {
          await router.push('/dashboard/wanted');
        } else {
          await router.push(`/exchange/wanted/${post.id}`);
        }
      }
    } catch (error) {
      handleError(error, { toastTitle: t('errorTitle') });
    } finally {
      submitting.value = false;
    }
  };
</script>

<i18n lang="json">
{
  "en": { "seo": { "title": "Post a Wanted Ad — The Mini Exchange | Classic Mini DIY" }, "back": "Back to Wanted Posts", "heading": "Post a Wanted Ad", "subtitle": "Let the Classic Mini community know what you're looking for. Describe the vehicle, engine, or parts you need and sellers will find you.", "errorTitle": "Failed to create wanted post" },
  "es": { "seo": { "title": "Publicar un anuncio de búsqueda — The Mini Exchange | Classic Mini DIY" }, "back": "Volver a anuncios de búsqueda", "heading": "Publicar un anuncio de búsqueda", "subtitle": "Dile a la comunidad del Classic Mini lo que buscas. Describe el vehículo, motor o piezas que necesitas y los vendedores te encontrarán.", "errorTitle": "No se pudo crear el anuncio de búsqueda" },
  "fr": { "seo": { "title": "Publier une annonce de recherche — The Mini Exchange | Classic Mini DIY" }, "back": "Retour aux recherches", "heading": "Publier une annonce de recherche", "subtitle": "Dites à la communauté Classic Mini ce que vous cherchez. Décrivez le véhicule, le moteur ou les pièces dont vous avez besoin et les vendeurs vous trouveront.", "errorTitle": "Échec de la création de l'annonce" },
  "de": { "seo": { "title": "Suchanzeige aufgeben — The Mini Exchange | Classic Mini DIY" }, "back": "Zurück zu Suchanzeigen", "heading": "Suchanzeige aufgeben", "subtitle": "Sag der Classic-Mini-Community, was du suchst. Beschreibe das Fahrzeug, den Motor oder die Teile, die du brauchst, und Verkäufer finden dich.", "errorTitle": "Suchanzeige konnte nicht erstellt werden" },
  "it": { "seo": { "title": "Pubblica un annuncio di ricerca — The Mini Exchange | Classic Mini DIY" }, "back": "Torna agli annunci di ricerca", "heading": "Pubblica un annuncio di ricerca", "subtitle": "Fai sapere alla comunità Classic Mini cosa cerchi. Descrivi il veicolo, il motore o i ricambi che ti servono e i venditori ti troveranno.", "errorTitle": "Creazione dell'annuncio non riuscita" },
  "pt": { "seo": { "title": "Publicar um anúncio de procura — The Mini Exchange | Classic Mini DIY" }, "back": "Voltar aos anúncios de procura", "heading": "Publicar um anúncio de procura", "subtitle": "Diga à comunidade Classic Mini o que você procura. Descreva o veículo, motor ou peças de que precisa e os vendedores vão encontrá-lo.", "errorTitle": "Falha ao criar o anúncio de procura" },
  "ru": { "seo": { "title": "Разместить запрос — The Mini Exchange | Classic Mini DIY" }, "back": "Назад к запросам", "heading": "Разместить запрос", "subtitle": "Расскажите сообществу Classic Mini, что вы ищете. Опишите автомобиль, двигатель или детали — и продавцы вас найдут.", "errorTitle": "Не удалось создать запрос" },
  "ja": { "seo": { "title": "求む広告を投稿 — The Mini Exchange | Classic Mini DIY" }, "back": "求む広告に戻る", "heading": "求む広告を投稿", "subtitle": "探しているものをクラシックミニのコミュニティに知らせましょう。必要な車両・エンジン・部品を記載すると、出品者が見つけてくれます。", "errorTitle": "求む広告の作成に失敗しました" },
  "zh": { "seo": { "title": "发布求购信息 — The Mini Exchange | Classic Mini DIY" }, "back": "返回求购信息", "heading": "发布求购信息", "subtitle": "告诉经典 Mini 社区你在找什么。描述你需要的车辆、发动机或零件，卖家就会找到你。", "errorTitle": "创建求购信息失败" },
  "ko": { "seo": { "title": "구함 광고 등록 — The Mini Exchange | Classic Mini DIY" }, "back": "구함 목록으로 돌아가기", "heading": "구함 광고 등록", "subtitle": "찾고 있는 것을 클래식 미니 커뮤니티에 알리세요. 필요한 차량, 엔진, 부품을 설명하면 판매자가 찾아옵니다.", "errorTitle": "구함 광고 생성 실패" }
}
</i18n>
