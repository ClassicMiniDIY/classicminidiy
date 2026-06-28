<template>
  <div class="container py-12">
    <!-- Header -->
    <div class="max-w-4xl mx-auto mb-16 text-center">
      <h1 class="text-5xl font-bold mb-6">{{ t('hero.title') }}</h1>
      <p class="text-xl text-base-content/70 leading-relaxed">{{ t('hero.subtitle') }}</p>
    </div>

    <!-- Main Content -->
    <div class="max-w-4xl mx-auto space-y-16">
      <!-- What is RSS? -->
      <section>
        <div class="flex items-center gap-3 mb-6">
          <i class="fas fa-rss text-2xl text-primary"></i>
          <h2 class="text-3xl font-bold">{{ t('whatIsRss.title') }}</h2>
        </div>
        <div class="prose prose-lg max-w-none">
          <p>{{ t('whatIsRss.body') }}</p>
        </div>
      </section>

      <!-- Available Feeds -->
      <section>
        <div class="flex items-center gap-3 mb-8">
          <i class="fas fa-list text-2xl text-primary"></i>
          <h2 class="text-3xl font-bold">{{ t('available.title') }}</h2>
        </div>

        <div class="space-y-4">
          <!-- Everything Feed -->
          <div class="card bg-base-100 shadow-sm">
            <div class="card-body">
              <div class="flex items-start gap-4">
                <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                  <i class="fas fa-globe text-primary"></i>
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="card-title text-lg">{{ t('everything.title') }}</h3>
                  <p class="text-base-content/70 text-sm mt-1">{{ t('everything.description') }}</p>
                  <div class="flex flex-wrap gap-2 mt-3">
                    <a href="/exchange/feed.xml" class="btn btn-sm btn-primary gap-1.5">
                      <i class="fas fa-rss"></i>
                      RSS
                    </a>
                    <a href="/exchange/atom.xml" class="btn btn-sm btn-outline gap-1.5">
                      <i class="fas fa-rss"></i>
                      Atom
                    </a>
                    <a href="/exchange/feed.json" class="btn btn-sm btn-outline gap-1.5">
                      <i class="fas fa-code"></i>
                      JSON
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Divider: Marketplace Listings -->
          <div class="divider text-sm text-base-content/50">{{ t('dividers.marketplace') }}</div>

          <!-- Feed cards -->
          <template v-for="(feed, index) in feedCards" :key="feed.basePath">
            <!-- Community divider before first community feed -->
            <div
              v-if="feed.section === 'community' && index === firstCommunityIndex"
              class="divider text-sm text-base-content/50"
            >
              {{ t('dividers.community') }}
            </div>

            <div class="card bg-base-100 shadow-sm">
              <div class="card-body">
                <div class="flex items-start gap-4">
                  <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                    <i :class="[feed.icon, 'text-primary']"></i>
                  </div>
                  <div class="flex-1 min-w-0">
                    <h3 class="card-title text-lg">{{ feed.title }}</h3>
                    <p class="text-base-content/70 text-sm mt-1">{{ feed.description }}</p>
                    <div class="flex flex-wrap gap-2 mt-3">
                      <a :href="`${feed.basePath}.xml`" class="btn btn-sm btn-primary gap-1.5">
                        <i class="fas fa-rss"></i>
                        RSS
                      </a>
                      <a :href="`${feed.basePath}.atom`" class="btn btn-sm btn-outline gap-1.5">
                        <i class="fas fa-rss"></i>
                        Atom
                      </a>
                      <a :href="`${feed.basePath}.json`" class="btn btn-sm btn-outline gap-1.5">
                        <i class="fas fa-code"></i>
                        JSON
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </section>

      <!-- CTA -->
      <section class="bg-primary/5 rounded-box p-12 text-center">
        <i class="fas fa-rss text-4xl mb-4 text-primary"></i>
        <h2 class="text-2xl font-bold mb-3">{{ t('cta.title') }}</h2>
        <p class="text-base-content/70 max-w-lg mx-auto mb-6">{{ t('cta.body') }}</p>
        <NuxtLink to="/exchange/listings" class="btn btn-primary btn-lg">{{ t('cta.button') }}</NuxtLink>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();
  const config = useRuntimeConfig();

  useSeoMeta({
    title: () => t('seo.title'),
    description: () => t('seo.description'),
    ogTitle: () => t('seo.title'),
    ogDescription: () => t('seo.ogDescription'),
    ogType: 'website',
    ogUrl: `${config.public.siteUrl}/exchange/feeds`,
    ogImage: `${config.public.siteUrl}/og-image.jpg`,
  });

  const feedCards = computed(() => [
    {
      icon: 'fas fa-tag',
      title: t('cards.listings.title'),
      description: t('cards.listings.description'),
      basePath: '/exchange/feed/listings',
    },
    {
      icon: 'fas fa-car',
      title: t('cards.vehicles.title'),
      description: t('cards.vehicles.description'),
      basePath: '/exchange/feed/vehicles',
    },
    {
      icon: 'fas fa-gear',
      title: t('cards.engines.title'),
      description: t('cards.engines.description'),
      basePath: '/exchange/feed/engines',
    },
    {
      icon: 'fas fa-screwdriver-wrench',
      title: t('cards.parts.title'),
      description: t('cards.parts.description'),
      basePath: '/exchange/feed/parts',
    },
    {
      icon: 'fas fa-globe',
      title: t('cards.finds.title'),
      description: t('cards.finds.description'),
      basePath: '/exchange/feed/finds',
      section: 'community',
    },
    {
      icon: 'fas fa-bullhorn',
      title: t('cards.wanted.title'),
      description: t('cards.wanted.description'),
      basePath: '/exchange/feed/wanted',
      section: 'community',
    },
  ]);

  const firstCommunityIndex = computed(() => feedCards.value.findIndex((f) => f.section === 'community'));
</script>

<i18n lang="json">
{
  "en": {
    "hero": { "title": "RSS Feeds", "subtitle": "Subscribe to Classic Mini marketplace listings, Mini Finds, and Wanted posts in your favorite feed reader" },
    "whatIsRss": { "title": "What is RSS?", "body": "RSS (Really Simple Syndication) lets you follow updates from The Mini Exchange without having to check the site manually. Add any of the feeds below to an RSS reader like Feedly, NetNewsWire, Inoreader, or your reader of choice, and new listings will appear automatically." },
    "available": { "title": "Available Feeds" },
    "everything": { "title": "Everything", "description": "All marketplace listings, Mini Finds, and Wanted posts combined in one feed." },
    "dividers": { "marketplace": "Marketplace Listings", "community": "Community" },
    "cards": {
      "listings": { "title": "All Marketplace Listings", "description": "Every active listing from the marketplace — vehicles, engines, and parts." },
      "vehicles": { "title": "Vehicles", "description": "Classic Mini vehicles for sale — complete cars from projects to concours." },
      "engines": { "title": "Engines", "description": "Complete A-Series engines and engine assemblies for sale." },
      "parts": { "title": "Parts", "description": "Classic Mini parts and accessories — body, interior, suspension, electrical, and more." },
      "finds": { "title": "Mini Finds", "description": "Curated Classic Mini listings spotted across the web — Bring a Trailer, Cars & Bids, eBay, and more." },
      "wanted": { "title": "Wanted Posts", "description": "Classic Mini vehicles, engines, and parts that community members are looking for." }
    },
    "cta": { "title": "Never Miss a Listing", "body": "Copy any feed URL above and paste it into your preferred RSS reader. New listings will appear automatically as they're published.", "button": "Browse Listings" },
    "seo": { "title": "RSS Feeds | The Mini Exchange", "description": "Subscribe to Classic Mini marketplace listings, Mini Finds, and Wanted posts via RSS feeds. Follow vehicles, engines, parts, and community finds.", "ogDescription": "Subscribe to Classic Mini listings via RSS — vehicles, engines, parts, finds, and wanted posts." }
  },
  "es": {
    "hero": { "title": "Canales RSS", "subtitle": "Suscríbete a los anuncios del mercado Classic Mini, los Mini Finds y los anuncios de búsqueda en tu lector de feeds favorito" },
    "whatIsRss": { "title": "¿Qué es RSS?", "body": "RSS (Really Simple Syndication) te permite seguir las novedades de The Mini Exchange sin tener que consultar el sitio manualmente. Añade cualquiera de los canales de abajo a un lector RSS como Feedly, NetNewsWire, Inoreader o el lector que prefieras, y los nuevos anuncios aparecerán automáticamente." },
    "available": { "title": "Canales disponibles" },
    "everything": { "title": "Todo", "description": "Todos los anuncios del mercado, los Mini Finds y los anuncios de búsqueda combinados en un solo canal." },
    "dividers": { "marketplace": "Anuncios del mercado", "community": "Comunidad" },
    "cards": {
      "listings": { "title": "Todos los anuncios del mercado", "description": "Todos los anuncios activos del mercado: vehículos, motores y piezas." },
      "vehicles": { "title": "Vehículos", "description": "Vehículos Classic Mini en venta: coches completos, desde proyectos hasta concurso." },
      "engines": { "title": "Motores", "description": "Motores A-Series completos y conjuntos de motor en venta." },
      "parts": { "title": "Piezas", "description": "Piezas y accesorios para Classic Mini: carrocería, interior, suspensión, sistema eléctrico y más." },
      "finds": { "title": "Mini Finds", "description": "Anuncios de Classic Mini seleccionados de toda la web: Bring a Trailer, Cars & Bids, eBay y más." },
      "wanted": { "title": "Anuncios de búsqueda", "description": "Vehículos, motores y piezas Classic Mini que buscan los miembros de la comunidad." }
    },
    "cta": { "title": "No te pierdas ningún anuncio", "body": "Copia cualquier URL de canal de arriba y pégala en tu lector RSS preferido. Los nuevos anuncios aparecerán automáticamente a medida que se publiquen.", "button": "Explorar anuncios" },
    "seo": { "title": "Canales RSS | The Mini Exchange", "description": "Suscríbete a los anuncios del mercado Classic Mini, los Mini Finds y los anuncios de búsqueda mediante canales RSS. Sigue vehículos, motores, piezas y hallazgos de la comunidad.", "ogDescription": "Suscríbete a los anuncios Classic Mini por RSS: vehículos, motores, piezas, hallazgos y anuncios de búsqueda." }
  },
  "fr": {
    "hero": { "title": "Flux RSS", "subtitle": "Abonnez-vous aux annonces de la place de marché Classic Mini, aux Mini Finds et aux annonces de recherche dans votre lecteur de flux préféré" },
    "whatIsRss": { "title": "Qu'est-ce que le RSS ?", "body": "Le RSS (Really Simple Syndication) vous permet de suivre les nouveautés de The Mini Exchange sans avoir à consulter le site manuellement. Ajoutez n'importe lequel des flux ci-dessous à un lecteur RSS comme Feedly, NetNewsWire, Inoreader ou le lecteur de votre choix, et les nouvelles annonces apparaîtront automatiquement." },
    "available": { "title": "Flux disponibles" },
    "everything": { "title": "Tout", "description": "Toutes les annonces de la place de marché, les Mini Finds et les annonces de recherche réunis dans un seul flux." },
    "dividers": { "marketplace": "Annonces de la place de marché", "community": "Communauté" },
    "cards": {
      "listings": { "title": "Toutes les annonces", "description": "Toutes les annonces actives de la place de marché : véhicules, moteurs et pièces." },
      "vehicles": { "title": "Véhicules", "description": "Véhicules Classic Mini à vendre : voitures complètes, du projet au concours." },
      "engines": { "title": "Moteurs", "description": "Moteurs A-Series complets et ensembles moteur à vendre." },
      "parts": { "title": "Pièces", "description": "Pièces et accessoires Classic Mini : carrosserie, intérieur, suspension, électricité et plus encore." },
      "finds": { "title": "Mini Finds", "description": "Annonces Classic Mini sélectionnées sur le web : Bring a Trailer, Cars & Bids, eBay et plus encore." },
      "wanted": { "title": "Annonces de recherche", "description": "Véhicules, moteurs et pièces Classic Mini recherchés par les membres de la communauté." }
    },
    "cta": { "title": "Ne manquez aucune annonce", "body": "Copiez l'URL d'un flux ci-dessus et collez-la dans votre lecteur RSS préféré. Les nouvelles annonces apparaîtront automatiquement dès leur publication.", "button": "Parcourir les annonces" },
    "seo": { "title": "Flux RSS | The Mini Exchange", "description": "Abonnez-vous aux annonces de la place de marché Classic Mini, aux Mini Finds et aux annonces de recherche via les flux RSS. Suivez véhicules, moteurs, pièces et trouvailles de la communauté.", "ogDescription": "Abonnez-vous aux annonces Classic Mini par RSS : véhicules, moteurs, pièces, trouvailles et annonces de recherche." }
  },
  "de": {
    "hero": { "title": "RSS-Feeds", "subtitle": "Abonniere Classic-Mini-Marktinserate, Mini Finds und Gesuche in deinem bevorzugten Feed-Reader" },
    "whatIsRss": { "title": "Was ist RSS?", "body": "Mit RSS (Really Simple Syndication) kannst du Neuigkeiten von The Mini Exchange verfolgen, ohne die Seite manuell aufzurufen. Füge einen der unten stehenden Feeds zu einem RSS-Reader wie Feedly, NetNewsWire, Inoreader oder deinem Reader deiner Wahl hinzu, und neue Inserate erscheinen automatisch." },
    "available": { "title": "Verfügbare Feeds" },
    "everything": { "title": "Alles", "description": "Alle Marktinserate, Mini Finds und Gesuche in einem einzigen Feed." },
    "dividers": { "marketplace": "Marktinserate", "community": "Community" },
    "cards": {
      "listings": { "title": "Alle Marktinserate", "description": "Jedes aktive Inserat des Marktplatzes — Fahrzeuge, Motoren und Teile." },
      "vehicles": { "title": "Fahrzeuge", "description": "Classic-Mini-Fahrzeuge zum Verkauf — komplette Autos vom Projekt bis zum Concours." },
      "engines": { "title": "Motoren", "description": "Komplette A-Series-Motoren und Motorbaugruppen zum Verkauf." },
      "parts": { "title": "Teile", "description": "Classic-Mini-Teile und Zubehör — Karosserie, Innenraum, Fahrwerk, Elektrik und mehr." },
      "finds": { "title": "Mini Finds", "description": "Ausgewählte Classic-Mini-Inserate aus dem Web — Bring a Trailer, Cars & Bids, eBay und mehr." },
      "wanted": { "title": "Gesuche", "description": "Classic-Mini-Fahrzeuge, -Motoren und -Teile, die Community-Mitglieder suchen." }
    },
    "cta": { "title": "Kein Inserat mehr verpassen", "body": "Kopiere eine beliebige Feed-URL von oben und füge sie in deinen bevorzugten RSS-Reader ein. Neue Inserate erscheinen automatisch, sobald sie veröffentlicht werden.", "button": "Inserate durchsuchen" },
    "seo": { "title": "RSS-Feeds | The Mini Exchange", "description": "Abonniere Classic-Mini-Marktinserate, Mini Finds und Gesuche per RSS-Feed. Folge Fahrzeugen, Motoren, Teilen und Community-Funden.", "ogDescription": "Abonniere Classic-Mini-Inserate per RSS — Fahrzeuge, Motoren, Teile, Funde und Gesuche." }
  },
  "it": {
    "hero": { "title": "Feed RSS", "subtitle": "Iscriviti agli annunci del mercato Classic Mini, ai Mini Finds e agli annunci di ricerca nel tuo lettore di feed preferito" },
    "whatIsRss": { "title": "Cos'è l'RSS?", "body": "L'RSS (Really Simple Syndication) ti permette di seguire gli aggiornamenti di The Mini Exchange senza dover controllare il sito manualmente. Aggiungi uno qualsiasi dei feed qui sotto a un lettore RSS come Feedly, NetNewsWire, Inoreader o il lettore che preferisci, e i nuovi annunci appariranno automaticamente." },
    "available": { "title": "Feed disponibili" },
    "everything": { "title": "Tutto", "description": "Tutti gli annunci del mercato, i Mini Finds e gli annunci di ricerca riuniti in un unico feed." },
    "dividers": { "marketplace": "Annunci del mercato", "community": "Comunità" },
    "cards": {
      "listings": { "title": "Tutti gli annunci", "description": "Ogni annuncio attivo del mercato: veicoli, motori e ricambi." },
      "vehicles": { "title": "Veicoli", "description": "Veicoli Classic Mini in vendita: auto complete, dai progetti al concorso." },
      "engines": { "title": "Motori", "description": "Motori A-Series completi e gruppi motore in vendita." },
      "parts": { "title": "Ricambi", "description": "Ricambi e accessori Classic Mini: carrozzeria, interni, sospensioni, impianto elettrico e altro." },
      "finds": { "title": "Mini Finds", "description": "Annunci Classic Mini selezionati dal web: Bring a Trailer, Cars & Bids, eBay e altro." },
      "wanted": { "title": "Annunci di ricerca", "description": "Veicoli, motori e ricambi Classic Mini che i membri della comunità stanno cercando." }
    },
    "cta": { "title": "Non perderti nessun annuncio", "body": "Copia un qualsiasi URL di feed qui sopra e incollalo nel tuo lettore RSS preferito. I nuovi annunci appariranno automaticamente man mano che vengono pubblicati.", "button": "Esplora gli annunci" },
    "seo": { "title": "Feed RSS | The Mini Exchange", "description": "Iscriviti agli annunci del mercato Classic Mini, ai Mini Finds e agli annunci di ricerca tramite feed RSS. Segui veicoli, motori, ricambi e ritrovamenti della comunità.", "ogDescription": "Iscriviti agli annunci Classic Mini via RSS: veicoli, motori, ricambi, ritrovamenti e annunci di ricerca." }
  },
  "pt": {
    "hero": { "title": "Feeds RSS", "subtitle": "Inscreva-se nos anúncios do mercado Classic Mini, nos Mini Finds e nos anúncios de procura no seu leitor de feeds favorito" },
    "whatIsRss": { "title": "O que é RSS?", "body": "O RSS (Really Simple Syndication) permite acompanhar as novidades do The Mini Exchange sem precisar verificar o site manualmente. Adicione qualquer um dos feeds abaixo a um leitor RSS como Feedly, NetNewsWire, Inoreader ou o leitor da sua preferência, e os novos anúncios aparecerão automaticamente." },
    "available": { "title": "Feeds disponíveis" },
    "everything": { "title": "Tudo", "description": "Todos os anúncios do mercado, os Mini Finds e os anúncios de procura combinados em um único feed." },
    "dividers": { "marketplace": "Anúncios do mercado", "community": "Comunidade" },
    "cards": {
      "listings": { "title": "Todos os anúncios", "description": "Todos os anúncios ativos do mercado: veículos, motores e peças." },
      "vehicles": { "title": "Veículos", "description": "Veículos Classic Mini à venda: carros completos, de projetos a concurso." },
      "engines": { "title": "Motores", "description": "Motores A-Series completos e conjuntos de motor à venda." },
      "parts": { "title": "Peças", "description": "Peças e acessórios Classic Mini: carroceria, interior, suspensão, elétrica e mais." },
      "finds": { "title": "Mini Finds", "description": "Anúncios Classic Mini selecionados pela web: Bring a Trailer, Cars & Bids, eBay e mais." },
      "wanted": { "title": "Anúncios de procura", "description": "Veículos, motores e peças Classic Mini que os membros da comunidade estão procurando." }
    },
    "cta": { "title": "Nunca perca um anúncio", "body": "Copie qualquer URL de feed acima e cole no seu leitor RSS preferido. Os novos anúncios aparecerão automaticamente assim que forem publicados.", "button": "Explorar anúncios" },
    "seo": { "title": "Feeds RSS | The Mini Exchange", "description": "Inscreva-se nos anúncios do mercado Classic Mini, nos Mini Finds e nos anúncios de procura via feeds RSS. Acompanhe veículos, motores, peças e achados da comunidade.", "ogDescription": "Inscreva-se nos anúncios Classic Mini por RSS: veículos, motores, peças, achados e anúncios de procura." }
  },
  "ru": {
    "hero": { "title": "RSS-ленты", "subtitle": "Подпишитесь на объявления маркетплейса Classic Mini, находки Mini Finds и запросы «Куплю» в любимом RSS-ридере" },
    "whatIsRss": { "title": "Что такое RSS?", "body": "RSS (Really Simple Syndication) позволяет следить за обновлениями The Mini Exchange, не заходя на сайт вручную. Добавьте любую из лент ниже в RSS-ридер, например Feedly, NetNewsWire, Inoreader или любой другой на ваш выбор, и новые объявления будут появляться автоматически." },
    "available": { "title": "Доступные ленты" },
    "everything": { "title": "Всё", "description": "Все объявления маркетплейса, находки Mini Finds и запросы «Куплю» в одной ленте." },
    "dividers": { "marketplace": "Объявления маркетплейса", "community": "Сообщество" },
    "cards": {
      "listings": { "title": "Все объявления", "description": "Все активные объявления маркетплейса — автомобили, двигатели и запчасти." },
      "vehicles": { "title": "Автомобили", "description": "Автомобили Classic Mini на продажу — от проектов до состояния конкурса." },
      "engines": { "title": "Двигатели", "description": "Полные двигатели A-Series и моторные сборки на продажу." },
      "parts": { "title": "Запчасти", "description": "Запчасти и аксессуары Classic Mini — кузов, салон, подвеска, электрика и многое другое." },
      "finds": { "title": "Mini Finds", "description": "Отобранные объявления Classic Mini со всего интернета — Bring a Trailer, Cars & Bids, eBay и другие." },
      "wanted": { "title": "Запросы «Куплю»", "description": "Автомобили, двигатели и запчасти Classic Mini, которые ищут участники сообщества." }
    },
    "cta": { "title": "Не пропустите ни одного объявления", "body": "Скопируйте любой адрес ленты выше и вставьте его в свой RSS-ридер. Новые объявления будут появляться автоматически по мере публикации.", "button": "Смотреть объявления" },
    "seo": { "title": "RSS-ленты | The Mini Exchange", "description": "Подпишитесь на объявления маркетплейса Classic Mini, находки Mini Finds и запросы «Куплю» через RSS-ленты. Следите за автомобилями, двигателями, запчастями и находками сообщества.", "ogDescription": "Подпишитесь на объявления Classic Mini через RSS — автомобили, двигатели, запчасти, находки и запросы." }
  },
  "ja": {
    "hero": { "title": "RSS フィード", "subtitle": "Classic Mini マーケットプレイスの出品、Mini Finds、Wanted 投稿をお好みのフィードリーダーで購読できます" },
    "whatIsRss": { "title": "RSS とは？", "body": "RSS（Really Simple Syndication）を使うと、サイトを手動で確認しなくても The Mini Exchange の更新を追えます。下のいずれかのフィードを Feedly、NetNewsWire、Inoreader などお好みの RSS リーダーに追加すれば、新しい出品が自動的に表示されます。" },
    "available": { "title": "利用できるフィード" },
    "everything": { "title": "すべて", "description": "マーケットプレイスの全出品、Mini Finds、Wanted 投稿を 1 つのフィードにまとめています。" },
    "dividers": { "marketplace": "マーケットプレイスの出品", "community": "コミュニティ" },
    "cards": {
      "listings": { "title": "すべての出品", "description": "マーケットプレイスのすべての有効な出品 — 車両、エンジン、パーツ。" },
      "vehicles": { "title": "車両", "description": "販売中の Classic Mini 車両 — プロジェクト車からコンクール仕様まで。" },
      "engines": { "title": "エンジン", "description": "販売中の A シリーズ・コンプリートエンジンおよびエンジンアッセンブリ。" },
      "parts": { "title": "パーツ", "description": "Classic Mini のパーツとアクセサリー — ボディ、内装、サスペンション、電装など。" },
      "finds": { "title": "Mini Finds", "description": "Bring a Trailer、Cars & Bids、eBay などウェブ各所で見つけた Classic Mini の厳選出品。" },
      "wanted": { "title": "Wanted 投稿", "description": "コミュニティのメンバーが探している Classic Mini の車両、エンジン、パーツ。" }
    },
    "cta": { "title": "出品を見逃さない", "body": "上のフィード URL をコピーして、お好みの RSS リーダーに貼り付けてください。新しい出品は公開され次第、自動的に表示されます。", "button": "出品を見る" },
    "seo": { "title": "RSS フィード | The Mini Exchange", "description": "Classic Mini マーケットプレイスの出品、Mini Finds、Wanted 投稿を RSS フィードで購読。車両、エンジン、パーツ、コミュニティの発見をフォローできます。", "ogDescription": "Classic Mini の出品を RSS で購読 — 車両、エンジン、パーツ、発見、Wanted 投稿。" }
  },
  "zh": {
    "hero": { "title": "RSS 订阅", "subtitle": "在你喜爱的订阅阅读器中订阅 Classic Mini 市场商品、Mini Finds 和求购帖子" },
    "whatIsRss": { "title": "什么是 RSS？", "body": "RSS（Really Simple Syndication）让你无需手动查看网站即可关注 The Mini Exchange 的更新。将下面任意订阅源添加到 Feedly、NetNewsWire、Inoreader 或你喜欢的 RSS 阅读器，新商品就会自动显示。" },
    "available": { "title": "可用订阅源" },
    "everything": { "title": "全部", "description": "将所有市场商品、Mini Finds 和求购帖子合并到一个订阅源中。" },
    "dividers": { "marketplace": "市场商品", "community": "社区" },
    "cards": {
      "listings": { "title": "全部市场商品", "description": "市场上所有在售商品 — 车辆、发动机和零件。" },
      "vehicles": { "title": "车辆", "description": "在售的 Classic Mini 车辆 — 从项目车到顶级车况。" },
      "engines": { "title": "发动机", "description": "在售的 A 系列整机及发动机总成。" },
      "parts": { "title": "零件", "description": "Classic Mini 零件与配件 — 车身、内饰、悬挂、电气等。" },
      "finds": { "title": "Mini Finds", "description": "从网络各处精选的 Classic Mini 商品 — Bring a Trailer、Cars & Bids、eBay 等。" },
      "wanted": { "title": "求购帖子", "description": "社区成员正在寻找的 Classic Mini 车辆、发动机和零件。" }
    },
    "cta": { "title": "不错过任何商品", "body": "复制上面任意订阅源网址，粘贴到你常用的 RSS 阅读器中。新商品发布后会自动显示。", "button": "浏览商品" },
    "seo": { "title": "RSS 订阅 | The Mini Exchange", "description": "通过 RSS 订阅 Classic Mini 市场商品、Mini Finds 和求购帖子。关注车辆、发动机、零件和社区发现。", "ogDescription": "通过 RSS 订阅 Classic Mini 商品 — 车辆、发动机、零件、发现和求购帖子。" }
  },
  "ko": {
    "hero": { "title": "RSS 피드", "subtitle": "즐겨 쓰는 피드 리더에서 Classic Mini 마켓플레이스 매물, Mini Finds, 구함 게시물을 구독하세요" },
    "whatIsRss": { "title": "RSS란?", "body": "RSS(Really Simple Syndication)를 사용하면 사이트를 직접 확인하지 않아도 The Mini Exchange의 업데이트를 따라갈 수 있습니다. 아래 피드 중 하나를 Feedly, NetNewsWire, Inoreader 또는 원하는 RSS 리더에 추가하면 새 매물이 자동으로 표시됩니다." },
    "available": { "title": "사용 가능한 피드" },
    "everything": { "title": "전체", "description": "모든 마켓플레이스 매물, Mini Finds, 구함 게시물을 하나의 피드로 모았습니다." },
    "dividers": { "marketplace": "마켓플레이스 매물", "community": "커뮤니티" },
    "cards": {
      "listings": { "title": "모든 마켓플레이스 매물", "description": "마켓플레이스의 모든 활성 매물 — 차량, 엔진, 부품." },
      "vehicles": { "title": "차량", "description": "판매 중인 Classic Mini 차량 — 프로젝트 차부터 콩쿠르 수준까지." },
      "engines": { "title": "엔진", "description": "판매 중인 A 시리즈 완성 엔진 및 엔진 어셈블리." },
      "parts": { "title": "부품", "description": "Classic Mini 부품 및 액세서리 — 차체, 실내, 서스펜션, 전기 등." },
      "finds": { "title": "Mini Finds", "description": "웹 곳곳에서 발견한 엄선된 Classic Mini 매물 — Bring a Trailer, Cars & Bids, eBay 등." },
      "wanted": { "title": "구함 게시물", "description": "커뮤니티 회원들이 찾고 있는 Classic Mini 차량, 엔진, 부품." }
    },
    "cta": { "title": "매물을 놓치지 마세요", "body": "위의 피드 URL을 복사해 원하는 RSS 리더에 붙여넣으세요. 새 매물이 게시되는 대로 자동으로 표시됩니다.", "button": "매물 둘러보기" },
    "seo": { "title": "RSS 피드 | The Mini Exchange", "description": "RSS 피드로 Classic Mini 마켓플레이스 매물, Mini Finds, 구함 게시물을 구독하세요. 차량, 엔진, 부품, 커뮤니티 발견을 팔로우하세요.", "ogDescription": "RSS로 Classic Mini 매물을 구독하세요 — 차량, 엔진, 부품, 발견, 구함 게시물." }
  }
}
</i18n>
