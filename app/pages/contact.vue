<template>
  <div>
    <!-- Hero Section -->
    <Hero :title="t('hero_title')" :heroType="HERO_TYPES.CONTACT" textSize="text-4xl" class="pb-7" />

    <!-- Breadcrumb Navigation -->
    <div class="container mx-auto px-4 pt-10">
      <UBreadcrumb
        :items="[
          { label: t('breadcrumb_home'), to: '/', icon: 'i-fa6-solid-house' },
          { label: t('breadcrumb_contact') },
        ]"
        :ui="{
          item: 'text-primary-600 dark:text-primary-400',
          link: 'text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300',
          linkActive: 'text-neutral-500 dark:text-neutral-400 font-medium',
          separator: 'text-neutral-400 dark:text-neutral-500',
          icon: 'text-primary-600 dark:text-primary-400',
        }"
      />
    </div>

    <!-- Contact Cards Grid -->
    <div class="container mx-auto px-4 py-8">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
        <!-- General Inquiries Card -->
        <UCard>
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <i class="fad fa-comments text-2xl text-primary"></i>
            </div>
            <h2 class="font-semibold text-xl">{{ t('general_inquiries_title') }}</h2>
          </div>

          <p class="opacity-70 mb-6">
            {{ t('general_inquiries_description') }}
          </p>

          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <i class="fad fa-envelope text-primary"></i>
              <div>
                <p class="font-medium">Email</p>
                <a href="mailto:hello@classicminidiy.com" class="text-primary hover:underline">
                  hello@classicminidiy.com
                </a>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <i class="fad fa-comment-dots text-primary"></i>
              <div>
                <p class="font-medium">{{ t('ai_chat_label') }}</p>
                <p class="text-sm opacity-70">{{ t('ai_chat_description') }}</p>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <i class="fad fa-clock text-primary"></i>
              <div>
                <p class="font-medium">{{ t('response_time_label') }}</p>
                <p class="text-sm opacity-70">{{ t('response_time_description') }}</p>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Archive Submissions Card -->
        <UCard>
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
              <i class="fad fa-archive text-2xl text-success"></i>
            </div>
            <h2 class="font-semibold text-xl">{{ t('archive_submissions_title') }}</h2>
          </div>

          <p class="opacity-70 mb-6">
            {{ t('archive_submissions_description') }}
          </p>

          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <i class="fad fa-envelope text-success"></i>
              <div>
                <p class="font-medium">Email</p>
                <a href="mailto:archive@classicminidiy.com" class="text-success hover:underline">
                  archive@classicminidiy.com
                </a>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <i class="fad fa-upload text-success"></i>
              <div>
                <p class="font-medium">{{ t('what_to_include_label') }}</p>
                <p class="text-sm opacity-70">{{ t('what_to_include_description') }}</p>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <i class="fad fa-shield-check text-success"></i>
              <div>
                <p class="font-medium">{{ t('rights_attribution_label') }}</p>
                <p class="text-sm opacity-70">{{ t('rights_attribution_description') }}</p>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Technical Submissions Card -->
        <UCard>
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center">
              <i class="fad fa-wrench text-2xl text-info"></i>
            </div>
            <h2 class="font-semibold text-xl">{{ t('technical_submissions_title') }}</h2>
          </div>

          <p class="opacity-70 mb-6">
            {{ t('technical_submissions_description') }}
          </p>

          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <i class="fad fa-envelope text-info"></i>
              <div>
                <p class="font-medium">Email</p>
                <a href="mailto:technical@classicminidiy.com" class="text-info hover:underline">
                  technical@classicminidiy.com
                </a>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <i class="fad fa-list-check text-info"></i>
              <div>
                <p class="font-medium">{{ t('content_types_label') }}</p>
                <p class="text-sm opacity-70">{{ t('content_types_description') }}</p>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <i class="fad fa-user-check text-info"></i>
              <div>
                <p class="font-medium">{{ t('credit_label') }}</p>
                <p class="text-sm opacity-70">{{ t('credit_description') }}</p>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Bug Reports Card -->
        <UCard>
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 bg-error/10 rounded-lg flex items-center justify-center">
              <i class="fad fa-bug text-2xl text-error"></i>
            </div>
            <h2 class="font-semibold text-xl">{{ t('bug_reports_title') }}</h2>
          </div>

          <p class="opacity-70 mb-6">
            {{ t('bug_reports_description') }}
          </p>

          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <i class="fad fa-envelope text-error"></i>
              <div>
                <p class="font-medium">Email</p>
                <a href="mailto:bugs@classicminidiy.com" class="text-error hover:underline">
                  bugs@classicminidiy.com
                </a>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <i class="fad fa-list-ul text-error"></i>
              <div>
                <p class="font-medium">{{ t('include_details_label') }}</p>
                <p class="text-sm opacity-70">{{ t('include_details_description') }}</p>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <i class="fad fa-bolt text-error"></i>
              <div>
                <p class="font-medium">{{ t('priority_label') }}</p>
                <p class="text-sm opacity-70">{{ t('priority_description') }}</p>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Additional Contact Info -->
    <div class="container mx-auto px-4 py-8">
      <div class="mt-16 text-center">
        <UCard class="max-w-2xl mx-auto bg-muted">
          <h3 class="text-2xl font-bold mb-4">{{ t('other_ways_connect') }}</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="flex flex-col items-center justify-center text-center">
              <i class="fad fa-users text-primary text-4xl mb-3"></i>
              <div>
                <p class="font-medium">{{ t('community_forum_label') }}</p>
                <p class="text-sm opacity-70">{{ t('community_forum_description') }}</p>
              </div>
            </div>
            <div class="flex flex-col items-center justify-center text-center">
              <i class="fab fa-patreon text-error text-4xl mb-3"></i>
              <div>
                <p class="font-medium">{{ t('support_patreon_label') }}</p>
                <p class="text-sm opacity-70">{{ t('support_patreon_description') }}</p>
              </div>
            </div>
          </div>

          <div class="mt-6 text-center">
            <UButton to="https://www.patreon.com/classicminidiy" target="_blank" external color="primary" size="lg">
              <i class="fab fa-patreon mr-2"></i>
              {{ t('support_patreon_button') }}
            </UButton>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { HERO_TYPES } from '../../data/models/generic';

  const { t } = useI18n();

  // SEO and meta using proper Nuxt patterns
  useHead({
    title: t('title'),
    meta: [
      {
        name: 'description',
        content: t('description'),
      },
    ],
    link: [
      {
        rel: 'canonical',
        href: 'https://classicminidiy.com/contact',
      },
    ],
  });

  useSeoMeta({
    ogTitle: t('title'),
    ogDescription: t('description'),
    ogUrl: 'https://classicminidiy.com/contact',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: t('title'),
    twitterDescription: t('description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/png',
  });
</script>

<i18n lang="json">
{
  "en": {
    "title": "Contact Classic Mini DIY - Get Help & Submit Content",
    "description": "Contact Classic Mini DIY for general inquiries, archive submissions, technical contributions, or bug reports. Multiple ways to get in touch with our community.",
    "hero_title": "Get in Touch",
    "breadcrumb_home": "Home",
    "breadcrumb_contact": "Contact",
    "general_inquiries_title": "General Inquiries",
    "general_inquiries_description": "Questions about the site, Classic Mini ownership, or general help? We'd love to hear from you.",
    "email_label": "Email",
    "ai_chat_label": "AI Chat Assistant",
    "ai_chat_description": "Use the chat widget for quick questions",
    "response_time_label": "Response Time",
    "response_time_description": "Usually within 24-48 hours",
    "archive_submissions_title": "Archive Submissions",
    "archive_submissions_description": "Have historical documents, photos, or stories to share? Help preserve Classic Mini history.",
    "what_to_include_label": "What to Include",
    "what_to_include_description": "Photos, documents, stories, or historical info",
    "rights_attribution_label": "Rights & Attribution",
    "rights_attribution_description": "Please confirm you own or have permission to share",
    "technical_submissions_title": "Technical Submissions",
    "technical_submissions_description": "Share repair guides, technical specs, or maintenance tips with the community.",
    "content_types_label": "Content Types",
    "content_types_description": "Repair guides, specs, tips, part numbers",
    "credit_label": "Credit",
    "credit_description": "We'll credit you as the contributor",
    "bug_reports_title": "Bug Reports",
    "bug_reports_description": "Found a problem with the site? Help us fix it by reporting bugs and issues.",
    "include_details_label": "Include Details",
    "include_details_description": "Browser, device, steps to reproduce",
    "priority_label": "Priority",
    "priority_description": "Critical bugs fixed within 24 hours",
    "other_ways_connect": "Other Ways to Connect",
    "community_forum_label": "Community Forum",
    "community_forum_description": "Join discussions with other enthusiasts",
    "support_patreon_label": "Support on Patreon",
    "support_patreon_description": "Help keep the site running",
    "support_patreon_button": "Support on Patreon"
  },
  "es": {
    "title": "Contactar Classic Mini DIY - Obtener Ayuda y Enviar Contenido",
    "description": "Contacta Classic Mini DIY para consultas generales, envíos de archivo, contribuciones técnicas o reportes de errores. Múltiples formas de ponerse en contacto con nuestra comunidad.",
    "hero_title": "Ponte en Contacto",
    "breadcrumb_home": "Inicio",
    "breadcrumb_contact": "Contacto",
    "general_inquiries_title": "Consultas Generales",
    "general_inquiries_description": "¿Preguntas sobre el sitio, propiedad de Classic Mini o ayuda general? Nos encantaría saber de ti.",
    "email_label": "Correo",
    "ai_chat_label": "Asistente de Chat IA",
    "ai_chat_description": "Usa el widget de chat para preguntas rápidas",
    "response_time_label": "Tiempo de Respuesta",
    "response_time_description": "Usualmente dentro de 24-48 horas",
    "archive_submissions_title": "Envíos de Archivo",
    "archive_submissions_description": "¿Tienes documentos históricos, fotos o historias para compartir? Ayuda a preservar la historia del Classic Mini.",
    "what_to_include_label": "Qué Incluir",
    "what_to_include_description": "Fotos, documentos, historias o información histórica",
    "rights_attribution_label": "Derechos y Atribución",
    "rights_attribution_description": "Por favor confirma que posees o tienes permiso para compartir",
    "technical_submissions_title": "Envíos Técnicos",
    "technical_submissions_description": "Comparte guías de reparación, especificaciones técnicas o consejos de mantenimiento con la comunidad.",
    "content_types_label": "Tipos de Contenido",
    "content_types_description": "Guías de reparación, especificaciones, consejos, números de parte",
    "credit_label": "Crédito",
    "credit_description": "Te acreditaremos como el contribuidor",
    "bug_reports_title": "Reportes de Errores",
    "bug_reports_description": "¿Encontraste un problema con el sitio? Ayúdanos a solucionarlo reportando errores y problemas.",
    "include_details_label": "Incluir Detalles",
    "include_details_description": "Navegador, dispositivo, pasos para reproducir",
    "priority_label": "Prioridad",
    "priority_description": "Errores críticos solucionados dentro de 24 horas",
    "other_ways_connect": "Otras Formas de Conectar",
    "community_forum_label": "Foro de la Comunidad",
    "community_forum_description": "Únete a discusiones con otros entusiastas",
    "support_patreon_label": "Apoyar en Patreon",
    "support_patreon_description": "Ayuda a mantener el sitio funcionando",
    "support_patreon_button": "Apoyar en Patreon"
  },
  "fr": {
    "title": "Contacter Classic Mini DIY - Obtenir de l'Aide et Soumettre du Contenu",
    "description": "Contactez Classic Mini DIY pour des demandes générales, soumissions d'archives, contributions techniques ou rapports de bogues. Plusieurs façons de contacter notre communauté.",
    "hero_title": "Entrer en Contact",
    "breadcrumb_home": "Accueil",
    "breadcrumb_contact": "Contact",
    "general_inquiries_title": "Demandes Générales",
    "general_inquiries_description": "Des questions sur le site, la propriété de Classic Mini ou de l'aide générale ? Nous aimerions avoir de vos nouvelles.",
    "email_label": "Email",
    "ai_chat_label": "Assistant de Chat IA",
    "ai_chat_description": "Utilisez le widget de chat pour des questions rapides",
    "response_time_label": "Temps de Réponse",
    "response_time_description": "Généralement dans les 24-48 heures",
    "archive_submissions_title": "Soumissions d'Archives",
    "archive_submissions_description": "Avez-vous des documents historiques, photos ou histoires à partager ? Aidez à préserver l'histoire du Classic Mini.",
    "what_to_include_label": "Quoi Inclure",
    "what_to_include_description": "Photos, documents, histoires ou informations historiques",
    "rights_attribution_label": "Droits et Attribution",
    "rights_attribution_description": "Veuillez confirmer que vous possédez ou avez la permission de partager",
    "technical_submissions_title": "Soumissions Techniques",
    "technical_submissions_description": "Partagez des guides de réparation, spécifications techniques ou conseils de maintenance avec la communauté.",
    "content_types_label": "Types de Contenu",
    "content_types_description": "Guides de réparation, spécifications, conseils, numéros de pièces",
    "credit_label": "Crédit",
    "credit_description": "Nous vous créditerons comme contributeur",
    "bug_reports_title": "Rapports de Bogues",
    "bug_reports_description": "Trouvé un problème avec le site ? Aidez-nous à le corriger en signalant les bogues et problèmes.",
    "include_details_label": "Inclure les Détails",
    "include_details_description": "Navigateur, appareil, étapes pour reproduire",
    "priority_label": "Priorité",
    "priority_description": "Bogues critiques corrigés dans les 24 heures",
    "other_ways_connect": "Autres Façons de Se Connecter",
    "community_forum_label": "Forum Communautaire",
    "community_forum_description": "Rejoignez les discussions avec d'autres passionnés",
    "support_patreon_label": "Soutenir sur Patreon",
    "support_patreon_description": "Aidez à maintenir le site en fonctionnement",
    "support_patreon_button": "Soutenir sur Patreon"
  },
  "it": {
    "title": "Contattare Classic Mini DIY - Ottenere Aiuto e Inviare Contenuti",
    "description": "Contatta Classic Mini DIY per richieste generali, invii di archivio, contributi tecnici o segnalazioni di bug. Diversi modi per contattare la nostra comunità.",
    "hero_title": "Mettiti in Contatto",
    "breadcrumb_home": "Home",
    "breadcrumb_contact": "Contatto",
    "general_inquiries_title": "Richieste Generali",
    "general_inquiries_description": "Domande sul sito, proprietà di Classic Mini o aiuto generale? Ci piacerebbe sentirti.",
    "email_label": "Email",
    "ai_chat_label": "Assistente Chat IA",
    "ai_chat_description": "Usa il widget chat per domande veloci",
    "response_time_label": "Tempo di Risposta",
    "response_time_description": "Di solito entro 24-48 ore",
    "archive_submissions_title": "Invii di Archivio",
    "archive_submissions_description": "Hai documenti storici, foto o storie da condividere? Aiuta a preservare la storia del Classic Mini.",
    "what_to_include_label": "Cosa Includere",
    "what_to_include_description": "Foto, documenti, storie o informazioni storiche",
    "rights_attribution_label": "Diritti e Attribuzione",
    "rights_attribution_description": "Conferma di possedere o avere il permesso di condividere",
    "technical_submissions_title": "Invii Tecnici",
    "technical_submissions_description": "Condividi guide di riparazione, specifiche tecniche o consigli di manutenzione con la comunità.",
    "content_types_label": "Tipi di Contenuto",
    "content_types_description": "Guide di riparazione, specifiche, consigli, numeri di parte",
    "credit_label": "Credito",
    "credit_description": "Ti accrediteremo come contributore",
    "bug_reports_title": "Segnalazioni di Bug",
    "bug_reports_description": "Trovato un problema con il sito? Aiutaci a risolverlo segnalando bug e problemi.",
    "include_details_label": "Includi Dettagli",
    "include_details_description": "Browser, dispositivo, passaggi per riprodurre",
    "priority_label": "Priorità",
    "priority_description": "Bug critici risolti entro 24 ore",
    "other_ways_connect": "Altri Modi per Connettersi",
    "community_forum_label": "Forum della Comunità",
    "community_forum_description": "Unisciti alle discussioni con altri appassionati",
    "support_patreon_label": "Supporta su Patreon",
    "support_patreon_description": "Aiuta a mantenere il sito attivo",
    "support_patreon_button": "Supporta su Patreon"
  },
  "de": {
    "title": "Classic Mini DIY Kontaktieren - Hilfe Erhalten und Inhalte Einreichen",
    "description": "Kontaktieren Sie Classic Mini DIY für allgemeine Anfragen, Archiv-Einreichungen, technische Beiträge oder Fehlermeldungen. Mehrere Wege, unsere Community zu kontaktieren.",
    "hero_title": "Kontakt Aufnehmen",
    "breadcrumb_home": "Startseite",
    "breadcrumb_contact": "Kontakt",
    "general_inquiries_title": "Allgemeine Anfragen",
    "general_inquiries_description": "Fragen zur Website, Classic Mini Besitz oder allgemeine Hilfe? Wir würden gerne von Ihnen hören.",
    "email_label": "E-Mail",
    "ai_chat_label": "KI-Chat-Assistent",
    "ai_chat_description": "Nutzen Sie das Chat-Widget für schnelle Fragen",
    "response_time_label": "Antwortzeit",
    "response_time_description": "Normalerweise innerhalb von 24-48 Stunden",
    "archive_submissions_title": "Archiv-Einreichungen",
    "archive_submissions_description": "Haben Sie historische Dokumente, Fotos oder Geschichten zu teilen? Helfen Sie, die Geschichte des Classic Mini zu bewahren.",
    "what_to_include_label": "Was Einzuschließen",
    "what_to_include_description": "Fotos, Dokumente, Geschichten oder historische Informationen",
    "rights_attribution_label": "Rechte und Zuschreibung",
    "rights_attribution_description": "Bitte bestätigen Sie, dass Sie besitzen oder die Erlaubnis zum Teilen haben",
    "technical_submissions_title": "Technische Einreichungen",
    "technical_submissions_description": "Teilen Sie Reparaturanleitungen, technische Spezifikationen oder Wartungstipps mit der Community.",
    "content_types_label": "Inhaltstypen",
    "content_types_description": "Reparaturanleitungen, Spezifikationen, Tipps, Teilenummern",
    "credit_label": "Anerkennung",
    "credit_description": "Wir werden Sie als Beitragenden anerkennen",
    "bug_reports_title": "Fehlermeldungen",
    "bug_reports_description": "Ein Problem mit der Website gefunden? Helfen Sie uns, es zu beheben, indem Sie Fehler und Probleme melden.",
    "include_details_label": "Details Einschließen",
    "include_details_description": "Browser, Gerät, Schritte zur Reproduktion",
    "priority_label": "Priorität",
    "priority_description": "Kritische Fehler werden innerhalb von 24 Stunden behoben",
    "other_ways_connect": "Andere Wege zur Verbindung",
    "community_forum_label": "Community-Forum",
    "community_forum_description": "Nehmen Sie an Diskussionen mit anderen Enthusiasten teil",
    "support_patreon_label": "Auf Patreon Unterstützen",
    "support_patreon_description": "Helfen Sie, die Website am Laufen zu halten",
    "support_patreon_button": "Auf Patreon Unterstützen"
  },
  "pt": {
    "title": "Contatar Classic Mini DIY - Obter Ajuda e Enviar Conteúdo",
    "description": "Entre em contato com Classic Mini DIY para consultas gerais, envios de arquivo, contribuições técnicas ou relatórios de bugs. Várias maneiras de contatar nossa comunidade.",
    "hero_title": "Entre em Contato",
    "breadcrumb_home": "Início",
    "breadcrumb_contact": "Contato",
    "general_inquiries_title": "Consultas Gerais",
    "general_inquiries_description": "Dúvidas sobre o site, propriedade de Classic Mini ou ajuda geral? Adoraríamos ouvir de você.",
    "email_label": "Email",
    "ai_chat_label": "Assistente de Chat IA",
    "ai_chat_description": "Use o widget de chat para perguntas rápidas",
    "response_time_label": "Tempo de Resposta",
    "response_time_description": "Geralmente dentro de 24-48 horas",
    "archive_submissions_title": "Envios de Arquivo",
    "archive_submissions_description": "Tem documentos históricos, fotos ou histórias para compartilhar? Ajude a preservar a história do Classic Mini.",
    "what_to_include_label": "O Que Incluir",
    "what_to_include_description": "Fotos, documentos, histórias ou informações históricas",
    "rights_attribution_label": "Direitos e Atribuição",
    "rights_attribution_description": "Por favor confirme que você possui ou tem permissão para compartilhar",
    "technical_submissions_title": "Envios Técnicos",
    "technical_submissions_description": "Compartilhe guias de reparo, especificações técnicas ou dicas de manutenção com a comunidade.",
    "content_types_label": "Tipos de Conteúdo",
    "content_types_description": "Guias de reparo, especificações, dicas, números de peças",
    "credit_label": "Crédito",
    "credit_description": "Creditaremos você como contribuidor",
    "bug_reports_title": "Relatórios de Bugs",
    "bug_reports_description": "Encontrou um problema com o site? Nos ajude a corrigi-lo relatando bugs e problemas.",
    "include_details_label": "Incluir Detalhes",
    "include_details_description": "Navegador, dispositivo, passos para reproduzir",
    "priority_label": "Prioridade",
    "priority_description": "Bugs críticos corrigidos dentro de 24 horas",
    "other_ways_connect": "Outras Formas de Conectar",
    "community_forum_label": "Fórum da Comunidade",
    "community_forum_description": "Participe de discussões com outros entusiastas",
    "support_patreon_label": "Apoiar no Patreon",
    "support_patreon_description": "Ajude a manter o site funcionando",
    "support_patreon_button": "Apoiar no Patreon"
  },
  "ru": {
    "title": "Связаться с Classic Mini DIY - Получить Помощь и Отправить Контент",
    "description": "Свяжитесь с Classic Mini DIY для общих запросов, отправки архивов, технических материалов или сообщений об ошибках. Несколько способов связаться с нашим сообществом.",
    "hero_title": "Связаться с Нами",
    "breadcrumb_home": "Главная",
    "breadcrumb_contact": "Контакты",
    "general_inquiries_title": "Общие Запросы",
    "general_inquiries_description": "Вопросы о сайте, владении Classic Mini или общая помощь? Мы будем рады услышать от вас.",
    "email_label": "Электронная Почта",
    "ai_chat_label": "ИИ Чат-Помощник",
    "ai_chat_description": "Используйте виджет чата для быстрых вопросов",
    "response_time_label": "Время Ответа",
    "response_time_description": "Обычно в течение 24-48 часов",
    "archive_submissions_title": "Отправки в Архив",
    "archive_submissions_description": "Есть исторические документы, фотографии или истории для обмена? Помогите сохранить историю Classic Mini.",
    "what_to_include_label": "Что Включить",
    "what_to_include_description": "Фотографии, документы, истории или историческая информация",
    "rights_attribution_label": "Права и Атрибуция",
    "rights_attribution_description": "Пожалуйста, подтвердите, что вы владеете или имеете разрешение на обмен",
    "technical_submissions_title": "Технические Материалы",
    "technical_submissions_description": "Поделитесь руководствами по ремонту, техническими спецификациями или советами по обслуживанию с сообществом.",
    "content_types_label": "Типы Контента",
    "content_types_description": "Руководства по ремонту, спецификации, советы, номера деталей",
    "credit_label": "Признание",
    "credit_description": "Мы укажем вас как автора",
    "bug_reports_title": "Сообщения об Ошибках",
    "bug_reports_description": "Нашли проблему с сайтом? Помогите нам исправить её, сообщив об ошибках и проблемах.",
    "include_details_label": "Включить Детали",
    "include_details_description": "Браузер, устройство, шаги для воспроизведения",
    "priority_label": "Приоритет",
    "priority_description": "Критические ошибки исправляются в течение 24 часов",
    "other_ways_connect": "Другие Способы Связи",
    "community_forum_label": "Форум Сообщества",
    "community_forum_description": "Присоединяйтесь к обсуждениям с другими энтузиастами",
    "support_patreon_label": "Поддержать на Patreon",
    "support_patreon_description": "Помогите поддерживать работу сайта",
    "support_patreon_button": "Поддержать на Patreon"
  },
  "ja": {
    "title": "Classic Mini DIYにお問い合わせ - ヘルプの取得とコンテンツの投稿",
    "description": "一般的なお問い合わせ、アーカイブの投稿、技術的な投稿、バグレポートについてはClassic Mini DIYにお問い合わせください。コミュニティに連絡する複数の方法があります。",
    "hero_title": "お問い合わせ",
    "breadcrumb_home": "ホーム",
    "breadcrumb_contact": "お問い合わせ",
    "general_inquiries_title": "一般的なお問い合わせ",
    "general_inquiries_description": "サイト、Classic Miniの所有、または一般的なヘルプについてご質問がありますか？ぜひお聞かせください。",
    "email_label": "メール",
    "ai_chat_label": "AIチャットアシスタント",
    "ai_chat_description": "迅速な質問にはチャットウィジェットをご利用ください",
    "response_time_label": "応答時間",
    "response_time_description": "通常24-48時間以内",
    "archive_submissions_title": "アーカイブ投稿",
    "archive_submissions_description": "共有する歴史的文書、写真、または物語はありますか？Classic Miniの歴史を保存するのにご協力ください。",
    "what_to_include_label": "含めるもの",
    "what_to_include_description": "写真、文書、物語、または歴史的情報",
    "rights_attribution_label": "権利と帰属",
    "rights_attribution_description": "所有しているか、共有する許可があることを確認してください",
    "technical_submissions_title": "技術投稿",
    "technical_submissions_description": "修理ガイド、技術仕様、またはメンテナンスのヒントをコミュニティと共有してください。",
    "content_types_label": "コンテンツタイプ",
    "content_types_description": "修理ガイド、仕様、ヒント、部品番号",
    "credit_label": "クレジット",
    "credit_description": "貢献者としてクレジットいたします",
    "bug_reports_title": "バグレポート",
    "bug_reports_description": "サイトに問題を見つけましたか？バグや問題を報告して修正にご協力ください。",
    "include_details_label": "詳細を含める",
    "include_details_description": "ブラウザ、デバイス、再現手順",
    "priority_label": "優先度",
    "priority_description": "重要なバグは24時間以内に修正",
    "other_ways_connect": "その他の連絡方法",
    "community_forum_label": "コミュニティフォーラム",
    "community_forum_description": "他の愛好家との議論に参加",
    "support_patreon_label": "Patreonでサポート",
    "support_patreon_description": "サイトの運営維持にご協力ください",
    "support_patreon_button": "Patreonでサポート"
  },
  "zh": {
    "title": "联系Classic Mini DIY - 获取帮助和提交内容",
    "description": "就一般咨询、档案提交、技术贡献或错误报告联系Classic Mini DIY。多种方式联系我们的社区。",
    "hero_title": "联系我们",
    "breadcrumb_home": "首页",
    "breadcrumb_contact": "联系",
    "general_inquiries_title": "一般咨询",
    "general_inquiries_description": "对网站、Classic Mini拥有或一般帮助有疑问？我们很乐意听到您的声音。",
    "email_label": "邮箱",
    "ai_chat_label": "AI聊天助手",
    "ai_chat_description": "使用聊天小部件进行快速提问",
    "response_time_label": "响应时间",
    "response_time_description": "通常在24-48小时内",
    "archive_submissions_title": "档案提交",
    "archive_submissions_description": "有历史文档、照片或故事要分享？帮助保存Classic Mini的历史。",
    "what_to_include_label": "包含内容",
    "what_to_include_description": "照片、文档、故事或历史信息",
    "rights_attribution_label": "权利和归属",
    "rights_attribution_description": "请确认您拥有或有权限分享",
    "technical_submissions_title": "技术提交",
    "technical_submissions_description": "与社区分享维修指南、技术规格或维护技巧。",
    "content_types_label": "内容类型",
    "content_types_description": "维修指南、规格、技巧、零件号",
    "credit_label": "署名",
    "credit_description": "我们将署名您为贡献者",
    "bug_reports_title": "错误报告",
    "bug_reports_description": "发现网站问题？通过报告错误和问题帮助我们修复。",
    "include_details_label": "包含详细信息",
    "include_details_description": "浏览器、设备、重现步骤",
    "priority_label": "优先级",
    "priority_description": "关键错误在24小时内修复",
    "other_ways_connect": "其他联系方式",
    "community_forum_label": "社区论坛",
    "community_forum_description": "与其他爱好者参与讨论",
    "support_patreon_label": "在Patreon支持",
    "support_patreon_description": "帮助保持网站运行",
    "support_patreon_button": "在Patreon支持"
  },
  "ko": {
    "title": "Classic Mini DIY 연락하기 - 도움 받기 및 콘텐츠 제출",
    "description": "일반 문의, 아카이브 제출, 기술 기여 또는 버그 신고를 위해 Classic Mini DIY에 연락하세요. 커뮤니티에 연락하는 여러 방법이 있습니다.",
    "hero_title": "연락하기",
    "breadcrumb_home": "홈",
    "breadcrumb_contact": "연락처",
    "general_inquiries_title": "일반 문의",
    "general_inquiries_description": "사이트, Classic Mini 소유 또는 일반적인 도움에 대한 질문이 있으신가요? 연락 주시면 기쁘겠습니다.",
    "email_label": "이메일",
    "ai_chat_label": "AI 채팅 도우미",
    "ai_chat_description": "빠른 질문은 채팅 위젯을 사용하세요",
    "response_time_label": "응답 시간",
    "response_time_description": "보통 24-48시간 이내",
    "archive_submissions_title": "아카이브 제출",
    "archive_submissions_description": "공유할 역사적 문서, 사진 또는 이야기가 있으신가요? Classic Mini의 역사를 보존하는 데 도움을 주세요.",
    "what_to_include_label": "포함할 내용",
    "what_to_include_description": "사진, 문서, 이야기 또는 역사적 정보",
    "rights_attribution_label": "권리 및 출처",
    "rights_attribution_description": "소유하고 있거나 공유할 권한이 있음을 확인해 주세요",
    "technical_submissions_title": "기술 제출",
    "technical_submissions_description": "수리 가이드, 기술 사양 또는 유지보수 팁을 커뮤니티와 공유하세요.",
    "content_types_label": "콘텐츠 유형",
    "content_types_description": "수리 가이드, 사양, 팁, 부품 번호",
    "credit_label": "크레딧",
    "credit_description": "기여자로 크레딧을 드립니다",
    "bug_reports_title": "버그 신고",
    "bug_reports_description": "사이트에 문제를 발견하셨나요? 버그와 문제를 신고하여 수정에 도움을 주세요.",
    "include_details_label": "세부 사항 포함",
    "include_details_description": "브라우저, 기기, 재현 단계",
    "priority_label": "우선순위",
    "priority_description": "중요한 버그는 24시간 이내 수정",
    "other_ways_connect": "다른 연결 방법",
    "community_forum_label": "커뮤니티 포럼",
    "community_forum_description": "다른 애호가들과 토론에 참여하세요",
    "support_patreon_label": "Patreon에서 지원",
    "support_patreon_description": "사이트 운영 유지에 도움을 주세요",
    "support_patreon_button": "Patreon에서 지원"
  }
}
</i18n>
