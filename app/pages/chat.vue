<template>
  <div class="container mx-auto px-4 py-8 max-w-6xl">
    <!-- Page Header -->
    <div class="mb-1">
      <h1 class="text-3xl font-bold text-base-content mb-2">{{ t('main_heading') }}</h1>
      <p class="text-base-content/70">
        {{ t('description_text') }}
      </p>
    </div>

    <!-- Chat Interface -->
    <div class="h-[calc(100vh-200px)] min-h-[600px]">
      <ChatWindow />
    </div>
  </div>
</template>

<script setup lang="ts">
  import ChatWindow from '~/components/Chat/ChatWindow.vue';

  const { t } = useI18n();

  // SEO - useHead for title, description, keywords, canonical
  useHead({
    title: t('title'),
    meta: [
      {
        name: 'description',
        content: t('description'),
      },
      {
        name: 'keywords',
        content: t('keywords'),
      },
    ],
    link: [
      {
        rel: 'canonical',
        href: 'https://classicminidiy.com/chat',
      },
      {
        rel: 'preconnect',
        href: 'https://classicminidiy.s3.amazonaws.com',
      },
    ],
  });

  // Open Graph and Twitter meta
  useSeoMeta({
    ogTitle: t('og_title'),
    ogDescription: t('og_description'),
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/chat.png',
    ogUrl: 'https://classicminidiy.com/chat',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: t('twitter_title'),
    twitterDescription: t('twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/chat.png',
  });

  // WebApplication structured data for AI assistant
  const chatJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'CMDIY Assistant',
    applicationCategory: 'UtilityApplication',
    operatingSystem: 'Web Browser',
    description: t('description'),
    url: 'https://classicminidiy.com/chat',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    provider: {
      '@type': 'Organization',
      name: 'Classic Mini DIY',
      url: 'https://classicminidiy.com',
    },
  };

  // Add JSON-LD structured data to head
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(chatJsonLd),
      },
    ],
  });
</script>

<i18n lang="json">
{
  "en": {
    "title": "CMDIY Assistant - Classic Mini DIY",
    "description": "Chat with our AI assistant for Classic Mini technical help, chassis decoding, parts information, and restoration guidance.",
    "keywords": "classic mini AI assistant, mini cooper help, chassis decoder, classic mini chat, restoration guidance, parts information, technical support",
    "og_title": "CMDIY Assistant - Classic Mini DIY",
    "og_description": "Get instant help with your Classic Mini projects from our AI assistant.",
    "twitter_title": "CMDIY Assistant - Classic Mini DIY",
    "twitter_description": "Get instant help with your Classic Mini projects from our AI assistant.",
    "main_heading": "CMDIY Assistant",
    "description_text": "Your Classic Mini DIY assistant - ask technical questions, find parts information, and get guidance on restoration projects. Or just chat with me about your Classic Mini!"
  },
  "es": {
    "title": "Asistente CMDIY - Classic Mini DIY",
    "description": "Chatea con nuestro asistente de IA para ayuda técnica con Classic Mini, decodificación de chasis, información de piezas y guía de restauración.",
    "keywords": "asistente IA classic mini, ayuda mini cooper, decodificador chasis, chat classic mini, guía restauración, información piezas",
    "og_title": "Asistente CMDIY - Classic Mini DIY",
    "og_description": "Obtén ayuda instantánea con tus proyectos de Classic Mini de nuestro asistente de IA.",
    "twitter_title": "Asistente CMDIY - Classic Mini DIY",
    "twitter_description": "Obtén ayuda instantánea con tus proyectos de Classic Mini de nuestro asistente de IA.",
    "main_heading": "Asistente CMDIY",
    "description_text": "Tu asistente Classic Mini DIY - haz preguntas técnicas, encuentra información de piezas y obtén guía en proyectos de restauración. ¡O simplemente chatea conmigo sobre tu Classic Mini!"
  },
  "fr": {
    "title": "Assistant CMDIY - Classic Mini DIY",
    "description": "Discutez avec notre assistant IA pour l'aide technique Classic Mini, le décodage de châssis, les informations sur les pièces et les conseils de restauration.",
    "keywords": "assistant IA classic mini, aide mini cooper, décodeur châssis, chat classic mini, guide restauration, informations pièces",
    "og_title": "Assistant CMDIY - Classic Mini DIY",
    "og_description": "Obtenez une aide instantanée pour vos projets Classic Mini grâce à notre assistant IA.",
    "twitter_title": "Assistant CMDIY - Classic Mini DIY",
    "twitter_description": "Obtenez une aide instantanée pour vos projets Classic Mini grâce à notre assistant IA.",
    "main_heading": "Assistant CMDIY",
    "description_text": "Votre assistant Classic Mini DIY - posez des questions techniques, trouvez des informations sur les pièces et obtenez des conseils sur les projets de restauration. Ou discutez simplement avec moi de votre Classic Mini !"
  },
  "it": {
    "title": "Assistente CMDIY - Classic Mini DIY",
    "description": "Chatta con il nostro assistente AI per aiuto tecnico Classic Mini, decodifica telaio, informazioni sui pezzi e guida al restauro.",
    "keywords": "assistente AI classic mini, aiuto mini cooper, decodificatore telaio, chat classic mini, guida restauro, informazioni pezzi",
    "og_title": "Assistente CMDIY - Classic Mini DIY",
    "og_description": "Ottieni aiuto istantaneo per i tuoi progetti Classic Mini dal nostro assistente AI.",
    "twitter_title": "Assistente CMDIY - Classic Mini DIY",
    "twitter_description": "Ottieni aiuto istantaneo per i tuoi progetti Classic Mini dal nostro assistente AI.",
    "main_heading": "Assistente CMDIY",
    "description_text": "Il tuo assistente Classic Mini DIY - fai domande tecniche, trova informazioni sui pezzi e ottieni guida sui progetti di restauro. O semplicemente chiacchiera con me della tua Classic Mini!"
  },
  "de": {
    "title": "CMDIY Assistent - Classic Mini DIY",
    "description": "Chatten Sie mit unserem KI-Assistenten für Classic Mini technische Hilfe, Fahrgestell-Dekodierung, Teileinformationen und Restaurierungsberatung.",
    "keywords": "KI-Assistent classic mini, mini cooper hilfe, fahrgestell decoder, classic mini chat, restaurierungsberatung, teileinformationen",
    "og_title": "CMDIY Assistent - Classic Mini DIY",
    "og_description": "Erhalten Sie sofortige Hilfe für Ihre Classic Mini Projekte von unserem KI-Assistenten.",
    "twitter_title": "CMDIY Assistent - Classic Mini DIY",
    "twitter_description": "Erhalten Sie sofortige Hilfe für Ihre Classic Mini Projekte von unserem KI-Assistenten.",
    "main_heading": "CMDIY Assistent",
    "description_text": "Ihr Classic Mini DIY Assistent - stellen Sie technische Fragen, finden Sie Teileinformationen und erhalten Sie Beratung zu Restaurierungsprojekten. Oder chatten Sie einfach mit mir über Ihren Classic Mini!"
  },
  "pt": {
    "title": "Assistente CMDIY - Classic Mini DIY",
    "description": "Converse com nosso assistente de IA para ajuda técnica Classic Mini, decodificação de chassi, informações de peças e orientação de restauração.",
    "keywords": "assistente IA classic mini, ajuda mini cooper, decodificador chassi, chat classic mini, orientação restauração, informações peças",
    "og_title": "Assistente CMDIY - Classic Mini DIY",
    "og_description": "Obtenha ajuda instantânea com seus projetos Classic Mini do nosso assistente de IA.",
    "twitter_title": "Assistente CMDIY - Classic Mini DIY",
    "twitter_description": "Obtenha ajuda instantânea com seus projetos Classic Mini do nosso assistente de IA.",
    "main_heading": "Assistente CMDIY",
    "description_text": "Seu assistente Classic Mini DIY - faça perguntas técnicas, encontre informações de peças e obtenha orientação em projetos de restauração. Ou apenas converse comigo sobre seu Classic Mini!"
  },
  "ru": {
    "title": "Помощник CMDIY - Classic Mini DIY",
    "description": "Общайтесь с нашим ИИ-помощником для технической помощи Classic Mini, декодирования шасси, информации о деталях и руководства по реставрации.",
    "keywords": "ИИ помощник classic mini, помощь mini cooper, декодер шасси, чат classic mini, руководство реставрации, информация о деталях",
    "og_title": "Помощник CMDIY - Classic Mini DIY",
    "og_description": "Получите мгновенную помощь с вашими проектами Classic Mini от нашего ИИ-помощника.",
    "twitter_title": "Помощник CMDIY - Classic Mini DIY",
    "twitter_description": "Получите мгновенную помощь с вашими проектами Classic Mini от нашего ИИ-помощника.",
    "main_heading": "Помощник CMDIY",
    "description_text": "Ваш помощник Classic Mini DIY - задавайте технические вопросы, находите информацию о деталях и получайте руководство по проектам реставрации. Или просто поговорите со мной о вашем Classic Mini!"
  },
  "ja": {
    "title": "CMDIYアシスタント - Classic Mini DIY",
    "description": "Classic Miniの技術的ヘルプ、シャーシデコード、パーツ情報、レストレーションガイダンスについて、AIアシスタントとチャットしてください。",
    "keywords": "AIアシスタント クラシックミニ, ミニクーパーヘルプ, シャーシデコーダー, クラシックミニチャット, レストレーションガイド, パーツ情報",
    "og_title": "CMDIYアシスタント - Classic Mini DIY",
    "og_description": "AIアシスタントからClassic Miniプロジェクトの即座のヘルプを得てください。",
    "twitter_title": "CMDIYアシスタント - Classic Mini DIY",
    "twitter_description": "AIアシスタントからClassic Miniプロジェクトの即座のヘルプを得てください。",
    "main_heading": "CMDIYアシスタント",
    "description_text": "あなたのClassic Mini DIYアシスタント - 技術的な質問をし、パーツ情報を見つけ、レストレーションプロジェクトのガイダンスを得てください。または、あなたのClassic Miniについて私とチャットしてください！"
  },
  "zh": {
    "title": "CMDIY助手 - Classic Mini DIY",
    "description": "与我们的AI助手聊天，获取Classic Mini技术帮助、底盘解码、零件信息和修复指导。",
    "keywords": "AI助手经典迷你, 迷你库珀帮助, 底盘解码器, 经典迷你聊天, 修复指导, 零件信息",
    "og_title": "CMDIY助手 - Classic Mini DIY",
    "og_description": "从我们的AI助手那里获得Classic Mini项目的即时帮助。",
    "twitter_title": "CMDIY助手 - Classic Mini DIY",
    "twitter_description": "从我们的AI助手那里获得Classic Mini项目的即时帮助。",
    "main_heading": "CMDIY助手",
    "description_text": "您的Classic Mini DIY助手 - 询问技术问题，查找零件信息，并获得修复项目的指导。或者只是和我聊聊您的Classic Mini！"
  },
  "ko": {
    "title": "CMDIY 어시스턴트 - Classic Mini DIY",
    "description": "Classic Mini 기술 도움, 섀시 디코딩, 부품 정보 및 복원 가이드를 위해 AI 어시스턴트와 채팅하세요.",
    "keywords": "AI 어시스턴트 클래식 미니, 미니 쿠퍼 도움, 섀시 디코더, 클래식 미니 채팅, 복원 가이드, 부품 정보",
    "og_title": "CMDIY 어시스턴트 - Classic Mini DIY",
    "og_description": "AI 어시스턴트로부터 Classic Mini 프로젝트에 대한 즉각적인 도움을 받으세요.",
    "twitter_title": "CMDIY 어시스턴트 - Classic Mini DIY",
    "twitter_description": "AI 어시스턴트로부터 Classic Mini 프로젝트에 대한 즉각적인 도움을 받으세요.",
    "main_heading": "CMDIY 어시스턴트",
    "description_text": "귀하의 Classic Mini DIY 어시스턴트 - 기술적 질문을 하고, 부품 정보를 찾고, 복원 프로젝트에 대한 가이드를 받으세요. 또는 귀하의 Classic Mini에 대해 저와 채팅하세요!"
  }
}
</i18n>
