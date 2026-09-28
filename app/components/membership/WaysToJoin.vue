<script lang="ts" setup>
  import { MEMBERSHIP_PLANS } from '~~/shared/utils/chatTiers';

  /**
   * "Ways to join" (classicminidiy-supabase docs/plans/2026-09-26-membership-clarity.md
   * §3 and §4.1). One membership, three places to buy it. This is the page that
   * support replies, the YouTube and Patreon level descriptions and the apps link
   * to, as /membership#ways-to-join; the anchor is on the section in the page.
   *
   * The ladder is the same on every channel: Member / Plus / Pro map to the plan
   * codes base / plus / pro, and Pro Supporter (YouTube and Patreon only) is
   * `pro` with a thank-you. Only the names are shown here, never the codes.
   */
  const { t } = useI18n();

  type Channel = 'web' | 'patreon' | 'youtube';
  type Level = 'base' | 'plus' | 'pro' | 'supporter';

  const channels: Channel[] = ['web', 'patreon', 'youtube'];
  const levels: Level[] = ['base', 'plus', 'pro', 'supporter'];

  const webPrice = (plan: 'base' | 'plus' | 'pro') => MEMBERSHIP_PLANS.find((p) => p.plan === plan)!.usd;

  // Monthly USD price per level on each channel (§3). The website / app prices
  // come from the shared plan list; Patreon and YouTube set their own on their
  // platforms, so they are restated here for display only. null = not offered.
  const PRICES: Record<Channel, Record<Level, number | null>> = {
    web: { base: webPrice('base'), plus: webPrice('plus'), pro: webPrice('pro'), supporter: null },
    patreon: { base: 2, plus: 5, pro: 10, supporter: 25 },
    youtube: { base: 1.99, plus: 4.99, pro: 9.99, supporter: 24.99 },
  };

  const coreBenefits = ['badge', 'discord', 'blog', 'early_access', 'listings', 'sync', 'bot'] as const;

  const fmtUsd = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);
</script>

<template>
  <div class="ways-to-join">
    <p class="eyebrow text-center"><i class="fas fa-route mr-1"></i>{{ t('eyebrow') }}</p>
    <h2 class="text-3xl font-bold text-center pt-2 pb-2">{{ t('title') }}</h2>
    <p class="text-lg font-semibold text-center pb-6" data-testid="ways-lead">{{ t('lead') }}</p>

    <!-- The table scrolls inside its own box at phone width (never the page);
         the row labels stay pinned on the left so each row stays readable. -->
    <div class="overflow-x-auto rounded-box border border-base-300 bg-base-100">
      <table class="table min-w-[40rem]">
        <caption class="sr-only">
          {{
            t('caption')
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col" class="row-label bg-base-200">
              <span class="sr-only">{{ t('rows.label') }}</span>
            </th>
            <th v-for="c in channels" :key="c" scope="col" class="font-bold text-base text-base-content bg-base-200">
              <i
                class="mr-1 text-primary"
                :class="{
                  'fas fa-globe': c === 'web',
                  'fab fa-patreon': c === 'patreon',
                  'fab fa-youtube': c === 'youtube',
                }"
              ></i
              >{{ t(`channels.${c}`) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <!-- Price per level -->
          <tr>
            <th scope="row" class="row-label align-top">{{ t('rows.price') }}</th>
            <td v-for="c in channels" :key="c" class="align-top" :data-channel="c">
              <ul class="space-y-1">
                <li v-for="l in levels" :key="l" class="flex justify-between gap-3">
                  <span>{{ t(`levels.${l}`) }}</span>
                  <span v-if="PRICES[c][l] !== null" class="font-semibold whitespace-nowrap"
                    >{{ fmtUsd(PRICES[c][l]!) }}{{ t('per_month') }}</span
                  >
                  <span v-else class="opacity-60">{{ t('not_offered') }}</span>
                </li>
              </ul>
            </td>
          </tr>

          <!-- Core benefits: identical everywhere, so listed once -->
          <tr>
            <th scope="row" class="row-label align-top">{{ t('rows.core') }}</th>
            <td :colspan="channels.length" class="align-top">
              <p class="text-sm opacity-70 mb-2">{{ t('core_note') }}</p>
              <ul class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                <li v-for="b in coreBenefits" :key="b">
                  <i class="fas fa-check text-success mr-2"></i>{{ t(`core.${b}`) }}
                </li>
              </ul>
              <p class="text-xs opacity-60 mt-2">{{ t('supporter_note') }}</p>
            </td>
          </tr>

          <!-- Channel extras -->
          <tr>
            <th scope="row" class="row-label align-top">{{ t('rows.extras') }}</th>
            <td v-for="c in channels" :key="c" class="align-top">{{ t(`extras.${c}`) }}</td>
          </tr>

          <!-- How the site account is linked -->
          <tr>
            <th scope="row" class="row-label align-top">{{ t('rows.link') }}</th>
            <td v-for="c in channels" :key="c" class="align-top" :data-link="c">
              <span v-if="c === 'youtube'" class="badge badge-ghost badge-sm">{{ t('link.youtube') }}</span>
              <template v-else>{{ t(`link.${c}`) }}</template>
            </td>
          </tr>

          <!-- Billing and cancellation -->
          <tr>
            <th scope="row" class="row-label align-top">{{ t('rows.billing') }}</th>
            <td v-for="c in channels" :key="c" class="align-top">{{ t(`billing.${c}`) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-6">
      <h3 class="font-bold text-lg mb-2">{{ t('rules_title') }}</h3>
      <ol class="list-decimal pl-6 space-y-1" data-testid="ways-rules">
        <li>{{ t('rules.one_platform') }}</li>
        <li>{{ t('rules.no_youtube_join') }}</li>
        <li>{{ t('rules.move') }}</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
  /* Pinned first column while the table scrolls sideways on a phone. */
  .row-label {
    position: sticky;
    left: 0;
    z-index: 1;
    background-color: var(--color-base-100);
    min-width: 8rem;
    max-width: 10rem;
  }
  thead .row-label {
    background-color: var(--color-base-200);
  }
</style>

<i18n lang="json">
{
  "en": {
    "eyebrow": "WAYS TO JOIN",
    "title": "Which option should I pick?",
    "lead": "One membership covers all your cars and devices.",
    "caption": "Ways to join, compared by platform",
    "channels": { "web": "Website / apps", "patreon": "Patreon", "youtube": "YouTube" },
    "rows": {
      "label": "Compare",
      "price": "Price per level",
      "core": "Core benefits",
      "extras": "Channel extras",
      "link": "How your site account is linked",
      "billing": "Where to manage billing and cancellation"
    },
    "levels": { "base": "Member", "plus": "Plus", "pro": "Pro", "supporter": "Pro Supporter" },
    "per_month": "/month",
    "not_offered": "Not offered",
    "core_note": "The same on every platform and at every level, once your site account is linked:",
    "core": {
      "badge": "The Sustaining Member badge",
      "discord": "Members-only Discord",
      "blog": "Members-only blog posts",
      "early_access": "Early access to videos",
      "listings": "Free premium listings on The Mini Exchange",
      "sync": "Maintenance sync in the apps",
      "bot": "The DIY Mini Bot allowance for your level"
    },
    "supporter_note": "Pro Supporter is everything in Pro, plus a thank-you.",
    "extras": {
      "web": "None. Most of your money reaches Classic Mini DIY.",
      "patreon": "Patreon posts. Merch at Pro Supporter.",
      "youtube": "YouTube badges and emoji, and members-only YouTube posts."
    },
    "link": {
      "web": "Automatic.",
      "patreon": "Automatic if your Patreon email matches your account. If not, use the claim email we send you.",
      "youtube": "Coming soon"
    },
    "billing": {
      "web": "The billing page if you joined on the website. The App Store or Google Play if you joined in an app.",
      "patreon": "Patreon.",
      "youtube": "YouTube."
    },
    "rules_title": "Three rules",
    "rules": {
      "one_platform": "Pick one platform, not several.",
      "no_youtube_join": "Website and app members do not need YouTube \"Join\" too.",
      "move": "To move platforms, join the new one before you cancel the old one."
    }
  },
  "es": {
    "eyebrow": "FORMAS DE UNIRTE",
    "title": "¿Qué opción elijo?",
    "lead": "Una membresía cubre todos tus coches y dispositivos.",
    "caption": "Formas de unirte, comparadas por plataforma",
    "channels": { "web": "Web / apps", "patreon": "Patreon", "youtube": "YouTube" },
    "rows": {
      "label": "Comparar",
      "price": "Precio por nivel",
      "core": "Ventajas principales",
      "extras": "Extras de cada plataforma",
      "link": "Cómo se vincula tu cuenta del sitio",
      "billing": "Dónde gestionar la facturación y la cancelación"
    },
    "levels": { "base": "Member", "plus": "Plus", "pro": "Pro", "supporter": "Pro Supporter" },
    "per_month": "/mes",
    "not_offered": "No disponible",
    "core_note": "Las mismas en todas las plataformas y en todos los niveles, una vez vinculada tu cuenta del sitio:",
    "core": {
      "badge": "La insignia de Socio Colaborador",
      "discord": "Discord exclusivo para socios",
      "blog": "Artículos del blog exclusivos para socios",
      "early_access": "Acceso anticipado a los vídeos",
      "listings": "Anuncios premium gratis en The Mini Exchange",
      "sync": "Sincronización del mantenimiento en las apps",
      "bot": "El límite del DIY Mini Bot de tu nivel"
    },
    "supporter_note": "Pro Supporter incluye todo lo de Pro, más un agradecimiento.",
    "extras": {
      "web": "Ninguno. La mayor parte de tu dinero llega a Classic Mini DIY.",
      "patreon": "Publicaciones en Patreon. Merchandising en Pro Supporter.",
      "youtube": "Insignias y emojis de YouTube, y publicaciones de YouTube exclusivas para socios."
    },
    "link": {
      "web": "Automático.",
      "patreon": "Automático si tu correo de Patreon coincide con tu cuenta. Si no, usa el correo de reclamación que te enviamos.",
      "youtube": "Próximamente"
    },
    "billing": {
      "web": "La página de facturación si te uniste en la web. La App Store o Google Play si te uniste en una app.",
      "patreon": "Patreon.",
      "youtube": "YouTube."
    },
    "rules_title": "Tres reglas",
    "rules": {
      "one_platform": "Elige una plataforma, no varias.",
      "no_youtube_join": "Los socios de la web y de las apps no necesitan también el botón \"Unirse\" de YouTube.",
      "move": "Para cambiar de plataforma, únete a la nueva antes de cancelar la anterior."
    }
  },
  "fr": {
    "eyebrow": "COMMENT ADHÉRER",
    "title": "Quelle option choisir ?",
    "lead": "Une seule adhésion couvre toutes vos voitures et tous vos appareils.",
    "caption": "Comment adhérer, comparé par plateforme",
    "channels": { "web": "Site / applis", "patreon": "Patreon", "youtube": "YouTube" },
    "rows": {
      "label": "Comparer",
      "price": "Prix par niveau",
      "core": "Avantages de base",
      "extras": "Extras de la plateforme",
      "link": "Comment votre compte du site est lié",
      "billing": "Où gérer la facturation et la résiliation"
    },
    "levels": { "base": "Member", "plus": "Plus", "pro": "Pro", "supporter": "Pro Supporter" },
    "per_month": "/mois",
    "not_offered": "Non proposé",
    "core_note": "Les mêmes sur toutes les plateformes et à tous les niveaux, une fois votre compte du site lié :",
    "core": {
      "badge": "Le badge Membre de soutien",
      "discord": "Discord réservé aux membres",
      "blog": "Articles de blog réservés aux membres",
      "early_access": "Accès anticipé aux vidéos",
      "listings": "Annonces premium gratuites sur The Mini Exchange",
      "sync": "Synchronisation de l'entretien dans les applis",
      "bot": "Le quota DIY Mini Bot de votre niveau"
    },
    "supporter_note": "Pro Supporter comprend tout Pro, plus un remerciement.",
    "extras": {
      "web": "Aucun. La plus grande partie de votre argent va à Classic Mini DIY.",
      "patreon": "Publications Patreon. Produits dérivés au niveau Pro Supporter.",
      "youtube": "Badges et emojis YouTube, et publications YouTube réservées aux membres."
    },
    "link": {
      "web": "Automatique.",
      "patreon": "Automatique si votre e-mail Patreon correspond à votre compte. Sinon, utilisez l'e-mail de réclamation que nous vous envoyons.",
      "youtube": "Bientôt disponible"
    },
    "billing": {
      "web": "La page de facturation si vous avez adhéré sur le site. L'App Store ou Google Play si vous avez adhéré dans une appli.",
      "patreon": "Patreon.",
      "youtube": "YouTube."
    },
    "rules_title": "Trois règles",
    "rules": {
      "one_platform": "Choisissez une seule plateforme, pas plusieurs.",
      "no_youtube_join": "Les membres du site et des applis n'ont pas besoin du bouton « Rejoindre » de YouTube en plus.",
      "move": "Pour changer de plateforme, adhérez à la nouvelle avant de résilier l'ancienne."
    }
  },
  "de": {
    "eyebrow": "WEGE ZUR MITGLIEDSCHAFT",
    "title": "Welche Option soll ich wählen?",
    "lead": "Eine Mitgliedschaft gilt für alle deine Autos und Geräte.",
    "caption": "Wege zur Mitgliedschaft, nach Plattform verglichen",
    "channels": { "web": "Website / Apps", "patreon": "Patreon", "youtube": "YouTube" },
    "rows": {
      "label": "Vergleich",
      "price": "Preis pro Stufe",
      "core": "Kernvorteile",
      "extras": "Extras der Plattform",
      "link": "Wie dein Website-Konto verknüpft wird",
      "billing": "Wo du Abrechnung und Kündigung verwaltest"
    },
    "levels": { "base": "Member", "plus": "Plus", "pro": "Pro", "supporter": "Pro Supporter" },
    "per_month": "/Monat",
    "not_offered": "Nicht angeboten",
    "core_note": "Auf jeder Plattform und in jeder Stufe gleich, sobald dein Website-Konto verknüpft ist:",
    "core": {
      "badge": "Das Fördermitglied-Abzeichen",
      "discord": "Discord nur für Mitglieder",
      "blog": "Blogbeiträge nur für Mitglieder",
      "early_access": "Früher Zugang zu Videos",
      "listings": "Kostenlose Premium-Anzeigen auf The Mini Exchange",
      "sync": "Wartungs-Synchronisierung in den Apps",
      "bot": "Das DIY-Mini-Bot-Kontingent deiner Stufe"
    },
    "supporter_note": "Pro Supporter enthält alles aus Pro, plus ein Dankeschön.",
    "extras": {
      "web": "Keine. Der größte Teil deines Geldes geht an Classic Mini DIY.",
      "patreon": "Patreon-Beiträge. Merch ab Pro Supporter.",
      "youtube": "YouTube-Abzeichen und -Emojis sowie YouTube-Beiträge nur für Mitglieder."
    },
    "link": {
      "web": "Automatisch.",
      "patreon": "Automatisch, wenn deine Patreon-E-Mail zu deinem Konto passt. Sonst nutze die Einlöse-E-Mail, die wir dir schicken.",
      "youtube": "Kommt bald"
    },
    "billing": {
      "web": "Die Abrechnungsseite, wenn du auf der Website beigetreten bist. Der App Store oder Google Play, wenn du in einer App beigetreten bist.",
      "patreon": "Patreon.",
      "youtube": "YouTube."
    },
    "rules_title": "Drei Regeln",
    "rules": {
      "one_platform": "Wähle eine Plattform, nicht mehrere.",
      "no_youtube_join": "Mitglieder über Website und Apps brauchen nicht zusätzlich YouTube \"Kanalmitglied werden\".",
      "move": "Um die Plattform zu wechseln, tritt der neuen bei, bevor du die alte kündigst."
    }
  },
  "it": {
    "eyebrow": "COME ISCRIVERSI",
    "title": "Quale opzione scelgo?",
    "lead": "Un'unica iscrizione copre tutte le tue auto e tutti i tuoi dispositivi.",
    "caption": "Come iscriversi, a confronto per piattaforma",
    "channels": { "web": "Sito / app", "patreon": "Patreon", "youtube": "YouTube" },
    "rows": {
      "label": "Confronto",
      "price": "Prezzo per livello",
      "core": "Vantaggi principali",
      "extras": "Extra della piattaforma",
      "link": "Come viene collegato il tuo account del sito",
      "billing": "Dove gestire fatturazione e disdetta"
    },
    "levels": { "base": "Member", "plus": "Plus", "pro": "Pro", "supporter": "Pro Supporter" },
    "per_month": "/mese",
    "not_offered": "Non disponibile",
    "core_note": "Uguali su ogni piattaforma e a ogni livello, una volta collegato il tuo account del sito:",
    "core": {
      "badge": "Il badge di Socio Sostenitore",
      "discord": "Discord riservato ai soci",
      "blog": "Articoli del blog riservati ai soci",
      "early_access": "Accesso anticipato ai video",
      "listings": "Annunci premium gratuiti su The Mini Exchange",
      "sync": "Sincronizzazione della manutenzione nelle app",
      "bot": "Il limite DIY Mini Bot del tuo livello"
    },
    "supporter_note": "Pro Supporter include tutto ciò che c'è in Pro, più un ringraziamento.",
    "extras": {
      "web": "Nessuno. La maggior parte del tuo denaro arriva a Classic Mini DIY.",
      "patreon": "Post su Patreon. Merchandising con Pro Supporter.",
      "youtube": "Badge ed emoji di YouTube, e post di YouTube riservati ai soci."
    },
    "link": {
      "web": "Automatico.",
      "patreon": "Automatico se la tua email di Patreon corrisponde al tuo account. Altrimenti, usa l'email di riscatto che ti inviamo.",
      "youtube": "In arrivo"
    },
    "billing": {
      "web": "La pagina di fatturazione se ti sei iscritto sul sito. L'App Store o Google Play se ti sei iscritto in un'app.",
      "patreon": "Patreon.",
      "youtube": "YouTube."
    },
    "rules_title": "Tre regole",
    "rules": {
      "one_platform": "Scegli una piattaforma, non più di una.",
      "no_youtube_join": "I soci del sito e delle app non hanno bisogno anche del pulsante \"Abbonati\" di YouTube.",
      "move": "Per cambiare piattaforma, iscriviti alla nuova prima di disdire la vecchia."
    }
  },
  "pt": {
    "eyebrow": "FORMAS DE ADERIR",
    "title": "Que opção devo escolher?",
    "lead": "Uma adesão cobre todos os seus carros e dispositivos.",
    "caption": "Formas de aderir, comparadas por plataforma",
    "channels": { "web": "Site / apps", "patreon": "Patreon", "youtube": "YouTube" },
    "rows": {
      "label": "Comparar",
      "price": "Preço por nível",
      "core": "Vantagens principais",
      "extras": "Extras da plataforma",
      "link": "Como a sua conta do site é associada",
      "billing": "Onde gerir a faturação e o cancelamento"
    },
    "levels": { "base": "Member", "plus": "Plus", "pro": "Pro", "supporter": "Pro Supporter" },
    "per_month": "/mês",
    "not_offered": "Não disponível",
    "core_note": "Iguais em todas as plataformas e em todos os níveis, depois de associar a sua conta do site:",
    "core": {
      "badge": "O distintivo de Membro Apoiador",
      "discord": "Discord exclusivo para membros",
      "blog": "Artigos do blogue exclusivos para membros",
      "early_access": "Acesso antecipado aos vídeos",
      "listings": "Anúncios premium gratuitos no The Mini Exchange",
      "sync": "Sincronização da manutenção nas apps",
      "bot": "O limite do DIY Mini Bot do seu nível"
    },
    "supporter_note": "Pro Supporter inclui tudo o que o Pro tem, mais um agradecimento.",
    "extras": {
      "web": "Nenhum. A maior parte do seu dinheiro chega à Classic Mini DIY.",
      "patreon": "Publicações no Patreon. Merchandising no Pro Supporter.",
      "youtube": "Distintivos e emojis do YouTube, e publicações do YouTube exclusivas para membros."
    },
    "link": {
      "web": "Automático.",
      "patreon": "Automático se o seu email do Patreon corresponder à sua conta. Caso contrário, use o email de reclamação que lhe enviamos.",
      "youtube": "Em breve"
    },
    "billing": {
      "web": "A página de faturação se aderiu no site. A App Store ou o Google Play se aderiu numa app.",
      "patreon": "Patreon.",
      "youtube": "YouTube."
    },
    "rules_title": "Três regras",
    "rules": {
      "one_platform": "Escolha uma plataforma, não várias.",
      "no_youtube_join": "Os membros do site e das apps não precisam também do botão \"Aderir\" do YouTube.",
      "move": "Para mudar de plataforma, adira à nova antes de cancelar a antiga."
    }
  },
  "ru": {
    "eyebrow": "КАК ВСТУПИТЬ",
    "title": "Какой вариант выбрать?",
    "lead": "Одно участие распространяется на все ваши автомобили и устройства.",
    "caption": "Способы вступить, сравнение по платформам",
    "channels": { "web": "Сайт / приложения", "patreon": "Patreon", "youtube": "YouTube" },
    "rows": {
      "label": "Сравнение",
      "price": "Цена по уровням",
      "core": "Основные преимущества",
      "extras": "Дополнения платформы",
      "link": "Как привязывается аккаунт сайта",
      "billing": "Где управлять оплатой и отменой"
    },
    "levels": { "base": "Member", "plus": "Plus", "pro": "Pro", "supporter": "Pro Supporter" },
    "per_month": "/мес.",
    "not_offered": "Не предлагается",
    "core_note": "Одинаковы на всех платформах и на всех уровнях, когда аккаунт сайта привязан:",
    "core": {
      "badge": "Значок постоянного участника",
      "discord": "Discord только для участников",
      "blog": "Записи блога только для участников",
      "early_access": "Ранний доступ к видео",
      "listings": "Бесплатные премиум-объявления на The Mini Exchange",
      "sync": "Синхронизация обслуживания в приложениях",
      "bot": "Лимит DIY Mini Bot для вашего уровня"
    },
    "supporter_note": "Pro Supporter — это всё, что есть в Pro, плюс благодарность.",
    "extras": {
      "web": "Нет. Большая часть ваших денег доходит до Classic Mini DIY.",
      "patreon": "Публикации на Patreon. Мерч на уровне Pro Supporter.",
      "youtube": "Значки и эмодзи YouTube, а также публикации на YouTube только для участников."
    },
    "link": {
      "web": "Автоматически.",
      "patreon": "Автоматически, если ваш email на Patreon совпадает с аккаунтом. Если нет, используйте письмо для привязки, которое мы отправим.",
      "youtube": "Скоро"
    },
    "billing": {
      "web": "Страница оплаты, если вы вступили на сайте. App Store или Google Play, если вы вступили в приложении.",
      "patreon": "Patreon.",
      "youtube": "YouTube."
    },
    "rules_title": "Три правила",
    "rules": {
      "one_platform": "Выберите одну платформу, а не несколько.",
      "no_youtube_join": "Участникам через сайт и приложения не нужно дополнительно нажимать \"Спонсировать\" на YouTube.",
      "move": "Чтобы сменить платформу, сначала вступите на новой, а потом отмените старую."
    }
  },
  "ja": {
    "eyebrow": "参加方法",
    "title": "どれを選べばいいですか?",
    "lead": "ひとつのメンバーシップで、あなたのすべての車とデバイスが対象になります。",
    "caption": "参加方法のプラットフォーム別比較",
    "channels": { "web": "ウェブサイト / アプリ", "patreon": "Patreon", "youtube": "YouTube" },
    "rows": {
      "label": "比較",
      "price": "レベル別の価格",
      "core": "基本特典",
      "extras": "プラットフォーム独自の特典",
      "link": "サイトのアカウントとの連携方法",
      "billing": "お支払いと解約の管理場所"
    },
    "levels": { "base": "Member", "plus": "Plus", "pro": "Pro", "supporter": "Pro Supporter" },
    "per_month": "/月",
    "not_offered": "提供なし",
    "core_note": "サイトのアカウントを連携すると、どのプラットフォームでもどのレベルでも同じです:",
    "core": {
      "badge": "サステイニングメンバーのバッジ",
      "discord": "メンバー限定 Discord",
      "blog": "メンバー限定のブログ記事",
      "early_access": "動画の先行公開",
      "listings": "The Mini Exchange のプレミアム出品無料",
      "sync": "アプリでのメンテナンス記録の同期",
      "bot": "レベルに応じた DIY Mini Bot の利用枠"
    },
    "supporter_note": "Pro Supporter は Pro のすべてに、感謝の気持ちを加えたものです。",
    "extras": {
      "web": "なし。お支払いの大部分が Classic Mini DIY に届きます。",
      "patreon": "Patreon の投稿。Pro Supporter ではグッズ付き。",
      "youtube": "YouTube のバッジと絵文字、メンバー限定の YouTube 投稿。"
    },
    "link": {
      "web": "自動。",
      "patreon": "Patreon のメールアドレスがアカウントと一致すれば自動です。一致しない場合は、お送りする連携用メールを使ってください。",
      "youtube": "近日対応"
    },
    "billing": {
      "web": "ウェブサイトで参加した場合はお支払いページ。アプリで参加した場合は App Store または Google Play。",
      "patreon": "Patreon。",
      "youtube": "YouTube。"
    },
    "rules_title": "3 つのルール",
    "rules": {
      "one_platform": "プラットフォームはひとつだけ選んでください。",
      "no_youtube_join": "ウェブサイトやアプリのメンバーは、YouTube の \"メンバーになる\" も行う必要はありません。",
      "move": "プラットフォームを移るときは、新しい方に参加してから古い方を解約してください。"
    }
  },
  "zh": {
    "eyebrow": "加入方式",
    "title": "我该选哪一种?",
    "lead": "一份会员资格涵盖你所有的车辆和设备。",
    "caption": "各平台加入方式对比",
    "channels": { "web": "网站 / 应用", "patreon": "Patreon", "youtube": "YouTube" },
    "rows": {
      "label": "对比",
      "price": "各等级价格",
      "core": "核心权益",
      "extras": "平台附加权益",
      "link": "网站账号如何关联",
      "billing": "在哪里管理账单和取消"
    },
    "levels": { "base": "Member", "plus": "Plus", "pro": "Pro", "supporter": "Pro Supporter" },
    "per_month": "/月",
    "not_offered": "不提供",
    "core_note": "关联网站账号后,在所有平台、所有等级都相同:",
    "core": {
      "badge": "持续支持会员徽章",
      "discord": "会员专属 Discord",
      "blog": "会员专属博客文章",
      "early_access": "视频抢先看",
      "listings": "The Mini Exchange 免费高级刊登",
      "sync": "应用内保养记录同步",
      "bot": "你所在等级的 DIY Mini Bot 额度"
    },
    "supporter_note": "Pro Supporter 包含 Pro 的全部内容,外加一份感谢。",
    "extras": {
      "web": "无。你付的大部分钱都会到达 Classic Mini DIY。",
      "patreon": "Patreon 帖子。Pro Supporter 附赠周边。",
      "youtube": "YouTube 徽章和表情,以及会员专属 YouTube 帖子。"
    },
    "link": {
      "web": "自动。",
      "patreon": "如果你的 Patreon 邮箱与账号一致则自动关联。否则,请使用我们发送的认领邮件。",
      "youtube": "即将推出"
    },
    "billing": {
      "web": "在网站加入的,使用账单页面。在应用中加入的,使用 App Store 或 Google Play。",
      "patreon": "Patreon。",
      "youtube": "YouTube。"
    },
    "rules_title": "三条规则",
    "rules": {
      "one_platform": "只选一个平台,不要选多个。",
      "no_youtube_join": "网站和应用会员无需再点 YouTube 的 \"加入\"。",
      "move": "要更换平台,请先加入新平台,再取消旧平台。"
    }
  },
  "ko": {
    "eyebrow": "가입 방법",
    "title": "어떤 방법을 선택해야 하나요?",
    "lead": "멤버십 하나로 모든 차량과 기기를 이용하실 수 있습니다.",
    "caption": "플랫폼별 가입 방법 비교",
    "channels": { "web": "웹사이트 / 앱", "patreon": "Patreon", "youtube": "YouTube" },
    "rows": {
      "label": "비교",
      "price": "레벨별 가격",
      "core": "기본 혜택",
      "extras": "플랫폼 추가 혜택",
      "link": "사이트 계정 연결 방법",
      "billing": "결제 및 해지 관리 위치"
    },
    "levels": { "base": "Member", "plus": "Plus", "pro": "Pro", "supporter": "Pro Supporter" },
    "per_month": "/월",
    "not_offered": "제공하지 않음",
    "core_note": "사이트 계정을 연결하면 모든 플랫폼, 모든 레벨에서 동일합니다:",
    "core": {
      "badge": "서포팅 멤버 배지",
      "discord": "멤버 전용 Discord",
      "blog": "멤버 전용 블로그 글",
      "early_access": "영상 미리 보기",
      "listings": "The Mini Exchange 프리미엄 매물 무료 등록",
      "sync": "앱에서 정비 기록 동기화",
      "bot": "레벨에 맞는 DIY Mini Bot 이용 한도"
    },
    "supporter_note": "Pro Supporter는 Pro의 모든 혜택에 감사의 마음을 더한 레벨입니다.",
    "extras": {
      "web": "없음. 결제 금액의 대부분이 Classic Mini DIY에 전달됩니다.",
      "patreon": "Patreon 게시물. Pro Supporter에는 굿즈 제공.",
      "youtube": "YouTube 배지와 이모티콘, 멤버 전용 YouTube 게시물."
    },
    "link": {
      "web": "자동.",
      "patreon": "Patreon 이메일이 계정과 일치하면 자동입니다. 일치하지 않으면 보내 드리는 연결 이메일을 이용해 주세요.",
      "youtube": "곧 제공"
    },
    "billing": {
      "web": "웹사이트에서 가입하셨다면 결제 페이지. 앱에서 가입하셨다면 App Store 또는 Google Play.",
      "patreon": "Patreon.",
      "youtube": "YouTube."
    },
    "rules_title": "세 가지 규칙",
    "rules": {
      "one_platform": "플랫폼은 여러 개가 아니라 하나만 선택해 주세요.",
      "no_youtube_join": "웹사이트 및 앱 멤버는 YouTube \"가입\"을 추가로 하실 필요가 없습니다.",
      "move": "플랫폼을 옮기시려면 새 플랫폼에 먼저 가입한 뒤 기존 플랫폼을 해지해 주세요."
    }
  }
}
</i18n>
