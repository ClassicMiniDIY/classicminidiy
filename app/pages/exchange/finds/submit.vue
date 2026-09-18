<template>
  <div>
    <!-- Page Header: same shell as /exchange/wanted/new -->
    <section class="bg-base-100 border-b border-base-300 py-12">
      <div class="container">
        <div class="flex items-center gap-3 mb-4">
          <NuxtLink to="/exchange/finds" class="btn btn-ghost btn-sm gap-1">
            <i class="fas fa-arrow-left"></i>
            {{ t('back') }}
          </NuxtLink>
        </div>
        <h1 class="text-3xl font-bold">{{ t('heading') }}</h1>
        <p class="text-base-content/70 mt-2 max-w-2xl">{{ t('subtitle') }}</p>
      </div>
    </section>

    <!-- Form Section -->
    <section class="py-12">
      <div class="container max-w-2xl">
        <ExchangeFindsFindSubmitForm />
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
</script>

<i18n lang="json">
{
  "en": {
    "seo": { "title": "Submit a Find — The Mini Exchange | Classic Mini DIY" },
    "back": "Back to Finds",
    "heading": "Submit a Find",
    "subtitle": "Spotted a Classic Mini for sale somewhere on the web? Paste the link and we will pull in the title, photo and details for the community to see."
  },
  "es": {
    "seo": { "title": "Enviar un hallazgo — The Mini Exchange | Classic Mini DIY" },
    "back": "Volver a hallazgos",
    "heading": "Enviar un hallazgo",
    "subtitle": "¿Has visto un Classic Mini en venta en algún sitio de la web? Pega el enlace y recuperaremos el título, la foto y los detalles para que la comunidad los vea."
  },
  "fr": {
    "seo": { "title": "Proposer une trouvaille — The Mini Exchange | Classic Mini DIY" },
    "back": "Retour aux trouvailles",
    "heading": "Proposer une trouvaille",
    "subtitle": "Vous avez repéré une Classic Mini à vendre quelque part sur le web ? Collez le lien et nous récupérerons le titre, la photo et les détails pour la communauté."
  },
  "de": {
    "seo": { "title": "Einen Fund einreichen — The Mini Exchange | Classic Mini DIY" },
    "back": "Zurück zu den Funden",
    "heading": "Einen Fund einreichen",
    "subtitle": "Irgendwo im Netz einen Classic Mini zum Verkauf entdeckt? Füge den Link ein und wir holen Titel, Foto und Details für die Community."
  },
  "it": {
    "seo": { "title": "Segnala una scoperta — The Mini Exchange | Classic Mini DIY" },
    "back": "Torna alle scoperte",
    "heading": "Segnala una scoperta",
    "subtitle": "Hai visto una Classic Mini in vendita da qualche parte sul web? Incolla il link e recupereremo titolo, foto e dettagli per la community."
  },
  "pt": {
    "seo": { "title": "Enviar um achado — The Mini Exchange | Classic Mini DIY" },
    "back": "Voltar aos achados",
    "heading": "Enviar um achado",
    "subtitle": "Viu um Classic Mini à venda algures na web? Cole o link e vamos buscar o título, a foto e os detalhes para a comunidade."
  },
  "ru": {
    "seo": { "title": "Предложить находку — The Mini Exchange | Classic Mini DIY" },
    "back": "Назад к находкам",
    "heading": "Предложить находку",
    "subtitle": "Увидели Classic Mini на продажу где-то в сети? Вставьте ссылку, и мы подтянем название, фото и детали для сообщества."
  },
  "ja": {
    "seo": { "title": "発見を投稿 — The Mini Exchange | Classic Mini DIY" },
    "back": "ファインド一覧へ戻る",
    "heading": "発見を投稿",
    "subtitle": "ウェブ上で売りに出ているクラシックミニを見つけましたか？リンクを貼るだけで、タイトル・写真・詳細を取り込んでコミュニティに共有します。"
  },
  "zh": {
    "seo": { "title": "提交发现 — The Mini Exchange | Classic Mini DIY" },
    "back": "返回发现",
    "heading": "提交发现",
    "subtitle": "在网上看到有 Classic Mini 出售？粘贴链接，我们会抓取标题、照片和详情供社区查看。"
  },
  "ko": {
    "seo": { "title": "발견 제보 — The Mini Exchange | Classic Mini DIY" },
    "back": "파인드로 돌아가기",
    "heading": "발견 제보",
    "subtitle": "웹 어딘가에서 판매 중인 Classic Mini를 보셨나요? 링크를 붙여넣으면 제목, 사진, 세부 정보를 가져와 커뮤니티에 공유합니다."
  }
}
</i18n>
