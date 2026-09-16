<script lang="ts" setup>
  import { HERO_TYPES } from '../../data/models/generic';

  const { t } = useI18n();

  useHead({
    title: t('title'),
    meta: [
      {
        key: 'description',
        name: 'description',
        content: t('description'),
      },
      {
        key: 'keywords',
        name: 'keywords',
        content: 'privacy policy, Classic Mini DIY, data protection, YouTube API, terms of service, data collection',
      },
      {
        key: 'robots',
        content: 'noindex',
      },
    ],
    link: [
      {
        rel: 'canonical',
        href: 'https://www.classicminidiy.com/privacy',
      },
    ],
  });

  useSeoMeta({
    ogTitle: t('title'),
    ogDescription: t('description'),
    ogUrl: 'https://www.classicminidiy.com/privacy',
    ogType: 'website',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/root.png',
    twitterCard: 'summary_large_image',
    twitterTitle: 'Privacy Policy | Classic Mini DIY',
    twitterDescription:
      'Classic Mini DIY privacy policy regarding data collection, storage, and use of YouTube API Services.',
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/root.png',
  });

  // Add structured data for the privacy policy page
  const privacyJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Privacy Policy',
    description: 'Classic Mini DIY privacy policy regarding data collection, storage, and use of YouTube API Services.',
    publisher: {
      '@type': 'Organization',
      name: 'Classic Mini DIY',
      logo: {
        '@type': 'ImageObject',
        url: 'https://classicminidiy.s3.amazonaws.com/misc/logo.png',
      },
    },
    url: 'https://www.classicminidiy.com/privacy',
  };

  // Add JSON-LD structured data to head
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(privacyJsonLd),
      },
    ],
  });
</script>

<template>
  <hero
    :title="t('hero_title')"
    :subtitle="t('hero_subtitle')"
    :textSize="'3xl'"
    :special="true"
    :heroType="HERO_TYPES.HOME"
    :background="'/backdrop2'"
    :navigation="true"
  />
  <div class="container mx-auto px-4 py-8">
    <div class="grid grid-cols-12 gap-4">
      <div class="col-span-12">
        <PageIntro :eyebrow="t('eyebrow')" :title="t('heading')" class="mb-6" as="h2" />

        <ol class="list-decimal pl-5 pt-5">
          <li>
            <h3 class="text-xl font-medium mb-2">{{ t('acceptance_title') }}</h3>
            <p class="py-2 mb-4">
              {{ t('acceptance_content') }}
              <a
                class="link link-primary mr-3"
                href="https://www.youtube.com/t/terms"
                target="_blank"
                rel="noopener noreferrer"
                >{{ t('youtube_privacy_link') }}</a
              >.
            </p>
          </li>
          <li>
            <h3 class="text-xl font-medium mb-2">{{ t('accessibility_title') }}</h3>
            <p class="py-2 mb-4">
              {{ t('accessibility_content') }}
              <a
                class="link link-primary"
                href="http://www.google.com/policies/privacy"
                target="_blank"
                rel="noopener noreferrer"
                >{{ t('google_privacy_link') }}</a
              >.
            </p>
          </li>
          <li>
            <h3 class="text-xl font-medium mb-2">{{ t('youtube_api_title') }}</h3>
            <p class="py-2 mb-4">
              {{ t('youtube_api_content') }}
            </p>
          </li>
          <li>
            <h3 class="text-xl font-medium mb-2">{{ t('data_collection_title') }}</h3>
            <p class="py-2 mb-4">
              {{ t('data_collection_content') }}
            </p>
          </li>
          <li>
            <h3 class="text-xl font-medium mb-2">{{ t('data_processing_title') }}</h3>
            <p class="py-2 mb-4">
              {{ t('data_processing_content') }}
            </p>
          </li>
          <li>
            <h3 class="text-xl font-medium mb-2">{{ t('data_methods_title') }}</h3>
            <p class="py-2 mb-4">
              {{ t('data_methods_content') }}
            </p>
          </li>
          <li>
            <h3 class="text-xl font-medium mb-2">{{ t('ai_title') }}</h3>
            <p class="py-2 mb-2">{{ t('ai_sent') }}</p>
            <p class="py-2 mb-2">{{ t('ai_processor') }}</p>
            <p class="py-2 mb-2">{{ t('ai_retention') }}</p>
            <p class="py-2 mb-4">{{ t('ai_delete') }}</p>
          </li>
          <li>
            <h3 class="text-xl font-medium mb-2">{{ t('contact_title') }}</h3>
            <p class="py-2 mb-4">
              {{ t('contact_content') }}
              <a class="link link-primary" href="mailto:classicminidiy@gmail.com" target="_blank"
                >classicminidiy@gmail.com</a
              >.
            </p>
          </li>
        </ol>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Privacy Policy | Classic Mini DIY",
    "description": "Classic Mini DIY privacy policy regarding data collection, storage, and use of YouTube API Services. Learn how we protect your information.",
    "hero_title": "Privacy Policy",
    "hero_subtitle": "Classic Mini DIY",
    "heading": "Privacy Policy",
    "eyebrow": "LEGAL",
    "acceptance_title": "Acceptance of Terms",
    "acceptance_content": "By using our API client, you agree to be bound by the",
    "youtube_privacy_link": "Youtube Privacy Policy",
    "accessibility_title": "Accessibility",
    "accessibility_content": "This Privacy Policy is easily accessible to all users via",
    "google_privacy_link": "Google Privacy Policy",
    "youtube_api_title": "Use of YouTube API Services",
    "youtube_api_content": "Our API client uses YouTube API Services. By using our API client, you agree to the collection, storage, and usage of your data as described in this policy.",
    "data_collection_title": "Data Collection, Storage, and Use",
    "data_collection_content": "We collect data directly from your device to provide and improve our services. This includes information about your device, IP address, and public cookie information. We do not collect any additional personal data for our use. This data is stored securely and used to enhance the user experience and ensure the smooth operation of our API client. In addition no data is stored on our servers, and thus is deleted each time you close your browser.",
    "data_processing_title": "Data Processing and Sharing",
    "data_processing_content": "We process your data to provide our services. Your data may be shared with internal and external parties for the purpose of improving and maintaining our API client. We ensure all external parties comply with our strict data protection guidelines.",
    "data_methods_title": "Data Collection Methods",
    "data_methods_content": "Data is collected through various means such as direct input, cookies, and other tracking technologies. This helps us to understand user preferences and provide better service.",
    "ai_title": "AI assistant (DIY Mini Bot)",
    "ai_sent": "DIY Mini Bot answers questions on classicminidiy.com and in the Classic Mini DIY Toolbox apps. When you send a question, the text you typed, the previous messages in that conversation, and any calculator values or reference data you chose to include are sent to our server at classicminidiy.com. Nothing from your account or your device is sent unless you type it or it appears in a prefilled question you choose to send.",
    "ai_processor": "Our server passes your question to Anthropic (Claude) to generate the answer. Answers are generated by AI and can be wrong; check a workshop manual before you rely on one. We do not use your questions to train any model.",
    "ai_retention": "Signed-in users have a monthly question allowance. We keep a daily count of questions per account for six months. Sustaining Members can sync conversation history across devices; synced conversations are kept for 30 days from their last update and then deleted. Conversations that are not synced stay only on your device or in your browser.",
    "ai_delete": "You can delete a synced conversation, or all of them, from the chat history on the website or from Settings in the apps. You can report an answer from any reply.",
    "contact_title": "Contact Information",
    "contact_content": "Contact Information If you have any questions or concerns about this privacy policy, please contact us at"
  },
  "de": {
    "title": "Datenschutzrichtlinie | Classic Mini DIY",
    "description": "Classic Mini DIY Datenschutzrichtlinie bezüglich Datensammlung, Speicherung und Verwendung von YouTube API Services. Erfahren Sie, wie wir Ihre Informationen schützen.",
    "hero_title": "Datenschutzrichtlinie",
    "hero_subtitle": "Classic Mini DIY",
    "heading": "Datenschutzrichtlinie",
    "eyebrow": "RECHTLICHES",
    "acceptance_title": "Akzeptanz der Bedingungen",
    "acceptance_content": "Durch die Nutzung unseres API-Clients stimmen Sie zu, an die",
    "youtube_privacy_link": "YouTube Datenschutzrichtlinie",
    "accessibility_title": "Zugänglichkeit",
    "accessibility_content": "Diese Datenschutzrichtlinie ist für alle Benutzer leicht zugänglich über die",
    "google_privacy_link": "Google Datenschutzrichtlinie",
    "youtube_api_title": "Verwendung von YouTube API Services",
    "youtube_api_content": "Unser API-Client verwendet YouTube API Services. Durch die Nutzung unseres API-Clients stimmen Sie der Sammlung, Speicherung und Verwendung Ihrer Daten wie in dieser Richtlinie beschrieben zu.",
    "data_collection_title": "Datensammlung, Speicherung und Verwendung",
    "data_collection_content": "Wir sammeln Daten direkt von Ihrem Gerät, um unsere Services bereitzustellen und zu verbessern. Dies umfasst Informationen über Ihr Gerät, IP-Adresse und öffentliche Cookie-Informationen. Wir sammeln keine zusätzlichen persönlichen Daten für unsere Verwendung. Diese Daten werden sicher gespeichert und verwendet, um die Benutzererfahrung zu verbessern und den reibungslosen Betrieb unseres API-Clients zu gewährleisten. Zusätzlich werden keine Daten auf unseren Servern gespeichert und somit jedes Mal gelöscht, wenn Sie Ihren Browser schließen.",
    "data_processing_title": "Datenverarbeitung und Weitergabe",
    "data_processing_content": "Wir verarbeiten Ihre Daten, um unsere Services bereitzustellen. Ihre Daten können mit internen und externen Parteien zum Zweck der Verbesserung und Wartung unseres API-Clients geteilt werden. Wir stellen sicher, dass alle externen Parteien unseren strengen Datenschutzrichtlinien entsprechen.",
    "data_methods_title": "Datensammlung-Methoden",
    "data_methods_content": "Daten werden durch verschiedene Mittel wie direkte Eingabe, Cookies und andere Tracking-Technologien gesammelt. Dies hilft uns, Benutzerpräferenzen zu verstehen und bessere Services zu bieten.",
    "ai_title": "KI-Assistent (DIY Mini Bot)",
    "ai_sent": "DIY Mini Bot beantwortet Fragen auf classicminidiy.com und in den Classic Mini DIY Toolbox-Apps. Wenn Sie eine Frage senden, werden der eingegebene Text, die vorherigen Nachrichten dieser Unterhaltung und alle Rechnerwerte oder Referenzdaten, die Sie einschließen, an unseren Server auf classicminidiy.com gesendet. Nichts aus Ihrem Konto oder von Ihrem Gerät wird gesendet, es sei denn, Sie geben es ein oder es erscheint in einer vorausgefüllten Frage, die Sie senden.",
    "ai_processor": "Unser Server leitet Ihre Frage an Anthropic (Claude) weiter, um die Antwort zu erzeugen. Antworten werden von KI erzeugt und können falsch sein; prüfen Sie ein Werkstatthandbuch, bevor Sie sich darauf verlassen. Wir verwenden Ihre Fragen nicht zum Trainieren eines Modells.",
    "ai_retention": "Angemeldete Benutzer haben ein monatliches Fragenkontingent. Wir speichern eine tägliche Anzahl der Fragen pro Konto für sechs Monate. Sustaining Members können den Unterhaltungsverlauf geräteübergreifend synchronisieren; synchronisierte Unterhaltungen werden 30 Tage nach der letzten Aktualisierung gelöscht. Nicht synchronisierte Unterhaltungen bleiben nur auf Ihrem Gerät oder in Ihrem Browser.",
    "ai_delete": "Sie können eine synchronisierte Unterhaltung oder alle Unterhaltungen im Chatverlauf auf der Website oder in den Einstellungen der Apps löschen. Sie können jede Antwort melden.",
    "contact_title": "Kontaktinformationen",
    "contact_content": "Kontaktinformationen Wenn Sie Fragen oder Bedenken zu dieser Datenschutzrichtlinie haben, kontaktieren Sie uns bitte unter"
  },
  "es": {
    "title": "Política de Privacidad | Classic Mini DIY",
    "description": "Política de privacidad de Classic Mini DIY sobre recopilación, almacenamiento y uso de datos de YouTube API Services. Aprende cómo protegemos tu información.",
    "hero_title": "Política de Privacidad",
    "hero_subtitle": "Classic Mini DIY",
    "heading": "Política de Privacidad",
    "eyebrow": "LEGAL",
    "acceptance_title": "Aceptación de Términos",
    "acceptance_content": "Al usar nuestro cliente API, aceptas estar sujeto a la",
    "youtube_privacy_link": "Política de Privacidad de Youtube",
    "accessibility_title": "Accesibilidad",
    "accessibility_content": "Esta Política de Privacidad es fácilmente accesible para todos los usuarios a través de",
    "google_privacy_link": "Política de Privacidad de Google",
    "youtube_api_title": "Uso de YouTube API Services",
    "youtube_api_content": "Nuestro cliente API usa YouTube API Services. Al usar nuestro cliente API, aceptas la recopilación, almacenamiento y uso de tus datos como se describe en esta política.",
    "data_collection_title": "Recopilación, Almacenamiento y Uso de Datos",
    "data_collection_content": "Recopilamos datos directamente de tu dispositivo para proporcionar y mejorar nuestros servicios. Esto incluye información sobre tu dispositivo, dirección IP e información pública de cookies. No recopilamos ningún dato personal adicional para nuestro uso. Estos datos se almacenan de forma segura y se usan para mejorar la experiencia del usuario y asegurar el funcionamiento fluido de nuestro cliente API. Además, no se almacenan datos en nuestros servidores, y por lo tanto se eliminan cada vez que cierras tu navegador.",
    "data_processing_title": "Procesamiento y Compartición de Datos",
    "data_processing_content": "Procesamos tus datos para proporcionar nuestros servicios. Tus datos pueden ser compartidos con partes internas y externas con el propósito de mejorar y mantener nuestro cliente API. Aseguramos que todas las partes externas cumplan con nuestras estrictas pautas de protección de datos.",
    "data_methods_title": "Métodos de Recopilación de Datos",
    "data_methods_content": "Los datos se recopilan a través de varios medios como entrada directa, cookies y otras tecnologías de seguimiento. Esto nos ayuda a entender las preferencias del usuario y proporcionar un mejor servicio.",
    "ai_title": "Asistente de IA (DIY Mini Bot)",
    "ai_sent": "DIY Mini Bot responde preguntas en classicminidiy.com y en las aplicaciones Classic Mini DIY Toolbox. Cuando envía una pregunta, el texto que escribió, los mensajes anteriores de esa conversación y los valores de calculadora o datos de referencia que decida incluir se envían a nuestro servidor en classicminidiy.com. No se envía nada de su cuenta ni de su dispositivo a menos que lo escriba o aparezca en una pregunta prellenada que decida enviar.",
    "ai_processor": "Nuestro servidor pasa su pregunta a Anthropic (Claude) para generar la respuesta. Las respuestas las genera una IA y pueden ser incorrectas; consulte un manual de taller antes de confiar en ellas. No usamos sus preguntas para entrenar ningún modelo.",
    "ai_retention": "Los usuarios registrados tienen una cuota mensual de preguntas. Guardamos un recuento diario de preguntas por cuenta durante seis meses. Los Sustaining Members pueden sincronizar el historial de conversaciones entre dispositivos; las conversaciones sincronizadas se conservan 30 días desde su última actualización y luego se eliminan. Las conversaciones no sincronizadas permanecen solo en su dispositivo o navegador.",
    "ai_delete": "Puede eliminar una conversación sincronizada, o todas, desde el historial de chat del sitio web o desde Ajustes en las aplicaciones. Puede informar sobre cualquier respuesta.",
    "contact_title": "Información de Contacto",
    "contact_content": "Información de Contacto Si tienes alguna pregunta o preocupación sobre esta política de privacidad, por favor contáctanos en"
  },
  "fr": {
    "title": "Politique de confidentialité | Classic Mini DIY",
    "description": "Politique de confidentialité de Classic Mini DIY concernant la collecte, le stockage et l'utilisation des services API YouTube. Apprenez comment nous protégeons vos informations.",
    "hero_title": "Politique de confidentialité",
    "hero_subtitle": "Classic Mini DIY",
    "heading": "Politique de confidentialité",
    "eyebrow": "MENTIONS LÉGALES",
    "acceptance_title": "Acceptation des conditions",
    "acceptance_content": "En utilisant notre client API, vous acceptez d'être lié par la",
    "youtube_privacy_link": "Politique de confidentialité Youtube",
    "accessibility_title": "Accessibilité",
    "accessibility_content": "Cette politique de confidentialité est facilement accessible à tous les utilisateurs via",
    "google_privacy_link": "Politique de confidentialité Google",
    "youtube_api_title": "Utilisation des services API YouTube",
    "youtube_api_content": "Notre client API utilise les services API YouTube. En utilisant notre client API, vous acceptez la collecte, le stockage et l'utilisation de vos données comme décrit dans cette politique.",
    "data_collection_title": "Collecte, stockage et utilisation des données",
    "data_collection_content": "Nous collectons les données directement depuis votre appareil pour fournir et améliorer nos services. Cela inclut des informations sur votre appareil, adresse IP et informations publiques de cookies. Nous ne collectons aucune donnée personnelle supplémentaire pour notre usage. Ces données sont stockées de manière sécurisée et utilisées pour améliorer l'expérience utilisateur et assurer le fonctionnement fluide de notre client API. De plus, aucune donnée n'est stockée sur nos serveurs, et donc est supprimée chaque fois que vous fermez votre navigateur.",
    "data_processing_title": "Traitement et partage des données",
    "data_processing_content": "Nous traitons vos données pour fournir nos services. Vos données peuvent être partagées avec des parties internes et externes dans le but d'améliorer et maintenir notre client API. Nous nous assurons que toutes les parties externes respectent nos directives strictes de protection des données.",
    "data_methods_title": "Méthodes de collecte de données",
    "data_methods_content": "Les données sont collectées par divers moyens tels que la saisie directe, les cookies et autres technologies de suivi. Cela nous aide à comprendre les préférences des utilisateurs et à fournir un meilleur service.",
    "ai_title": "Assistant IA (DIY Mini Bot)",
    "ai_sent": "DIY Mini Bot répond aux questions sur classicminidiy.com et dans les applications Classic Mini DIY Toolbox. Lorsque vous envoyez une question, le texte saisi, les messages précédents de cette conversation et les valeurs de calculateur ou données de référence que vous choisissez d’inclure sont envoyés à notre serveur sur classicminidiy.com. Rien de votre compte ou de votre appareil n’est envoyé sauf si vous le saisissez ou s’il figure dans une question préremplie que vous choisissez d’envoyer.",
    "ai_processor": "Notre serveur transmet votre question à Anthropic (Claude) pour générer la réponse. Les réponses sont générées par une IA et peuvent être erronées ; vérifiez dans un manuel d’atelier avant de vous y fier. Nous n’utilisons pas vos questions pour entraîner un modèle.",
    "ai_retention": "Les utilisateurs connectés disposent d’un quota mensuel de questions. Nous conservons un décompte quotidien des questions par compte pendant six mois. Les Sustaining Members peuvent synchroniser l’historique des conversations entre appareils ; les conversations synchronisées sont conservées 30 jours après leur dernière mise à jour, puis supprimées. Les conversations non synchronisées restent uniquement sur votre appareil ou dans votre navigateur.",
    "ai_delete": "Vous pouvez supprimer une conversation synchronisée, ou toutes, depuis l’historique du chat sur le site ou depuis les Réglages des applications. Vous pouvez signaler n’importe quelle réponse.",
    "contact_title": "Informations de contact",
    "contact_content": "Si vous avez des questions ou préoccupations concernant cette politique de confidentialité, veuillez nous contacter à"
  },
  "it": {
    "title": "Politica sulla privacy | Classic Mini DIY",
    "description": "Politica sulla privacy di Classic Mini DIY riguardante la raccolta, memorizzazione e uso dei dati e dei servizi API di YouTube. Scopri come proteggiamo le tue informazioni.",
    "hero_title": "Politica sulla privacy",
    "hero_subtitle": "Classic Mini DIY",
    "heading": "Politica sulla privacy",
    "eyebrow": "LEGALE",
    "acceptance_title": "Accettazione dei termini",
    "acceptance_content": "Utilizzando il nostro client API, accetti di essere vincolato dalla",
    "youtube_privacy_link": "Politica sulla privacy di YouTube",
    "accessibility_title": "Accessibilità",
    "accessibility_content": "Questa politica sulla privacy è facilmente accessibile a tutti gli utenti tramite",
    "google_privacy_link": "Politica sulla privacy di Google",
    "youtube_api_title": "Utilizzo dei servizi API di YouTube",
    "youtube_api_content": "Il nostro client API utilizza i servizi API di YouTube. Utilizzando il nostro client API, accetti la raccolta, memorizzazione e utilizzo dei tuoi dati come descritto in questa politica.",
    "data_collection_title": "Raccolta, memorizzazione e utilizzo dei dati",
    "data_collection_content": "Raccogliamo i dati direttamente dal tuo dispositivo per fornire e migliorare i nostri servizi. Questo include informazioni sul tuo dispositivo, indirizzo IP e informazioni sui cookie pubblici. Non raccogliamo dati personali aggiuntivi per il nostro uso. Questi dati sono memorizzati in modo sicuro e utilizzati per migliorare l'esperienza utente e garantire il funzionamento fluido del nostro client API. Inoltre nessun dato viene memorizzato sui nostri server e quindi viene eliminato ogni volta che chiudi il browser.",
    "data_processing_title": "Elaborazione e condivisione dei dati",
    "data_processing_content": "Elaboriamo i tuoi dati per fornire i nostri servizi. I tuoi dati possono essere condivisi con parti interne ed esterne allo scopo di migliorare e mantenere il nostro client API. Assicuriamo che tutte le parti esterne rispettino le nostre rigorose linee guida per la protezione dei dati.",
    "data_methods_title": "Metodi di raccolta dati",
    "data_methods_content": "I dati vengono raccolti attraverso vari mezzi come input diretto, cookie e altre tecnologie di tracciamento. Questo ci aiuta a comprendere le preferenze degli utenti e fornire un servizio migliore.",
    "ai_title": "Assistente IA (DIY Mini Bot)",
    "ai_sent": "DIY Mini Bot risponde alle domande su classicminidiy.com e nelle app Classic Mini DIY Toolbox. Quando invii una domanda, il testo digitato, i messaggi precedenti di quella conversazione e i valori del calcolatore o i dati di riferimento che scegli di includere vengono inviati al nostro server su classicminidiy.com. Nulla del tuo account o del tuo dispositivo viene inviato a meno che tu non lo digiti o compaia in una domanda precompilata che scegli di inviare.",
    "ai_processor": "Il nostro server passa la tua domanda ad Anthropic (Claude) per generare la risposta. Le risposte sono generate da un’IA e possono essere sbagliate; controlla un manuale d’officina prima di affidarti a una risposta. Non usiamo le tue domande per addestrare alcun modello.",
    "ai_retention": "Gli utenti registrati hanno una quota mensile di domande. Conserviamo un conteggio giornaliero delle domande per account per sei mesi. I Sustaining Member possono sincronizzare la cronologia delle conversazioni tra dispositivi; le conversazioni sincronizzate sono conservate per 30 giorni dall’ultimo aggiornamento e poi eliminate. Le conversazioni non sincronizzate restano solo sul tuo dispositivo o nel tuo browser.",
    "ai_delete": "Puoi eliminare una conversazione sincronizzata, o tutte, dalla cronologia della chat sul sito o dalle Impostazioni nelle app. Puoi segnalare qualsiasi risposta.",
    "contact_title": "Informazioni di contatto",
    "contact_content": "Se hai domande o dubbi su questa politica sulla privacy, contattaci a"
  },
  "ja": {
    "title": "プライバシーポリシー | Classic Mini DIY",
    "description": "データ収集、保存、YouTube APIサービスの使用に関するClassic Mini DIYプライバシーポリシー。あなたの情報をどのように保護するかを学びます。",
    "hero_title": "プライバシーポリシー",
    "hero_subtitle": "Classic Mini DIY",
    "heading": "プライバシーポリシー",
    "eyebrow": "法的事項",
    "acceptance_title": "利用規約の承認",
    "acceptance_content": "私たちのAPIクライアントを使用することにより、あなたは拘束されることに同意します",
    "youtube_privacy_link": "YouTubeプライバシーポリシー",
    "accessibility_title": "アクセシビリティ",
    "accessibility_content": "このプライバシーポリシーは、すべてのユーザーが経由で簡単にアクセスできます",
    "google_privacy_link": "Googleプライバシーポリシー",
    "youtube_api_title": "YouTube APIサービスの使用",
    "youtube_api_content": "私たちのAPIクライアントはYouTube APIサービスを使用しています。私たちのAPIクライアントを使用することにより、このポリシーに記載されているようにデータの収集、保存、使用に同意します。",
    "data_collection_title": "データ収集、保存、使用",
    "data_collection_content": "私たちはサービスを提供し、改善するためにあなたのデバイスから直接データを収集します。これには、デバイス、IPアドレス、公開Cookie情報に関する情報が含まれます。私たちの使用のために追加の個人データは収集しません。このデータは安全に保存され、ユーザーエクスペリエンスを向上させ、APIクライアントの円滑な動作を確保するために使用されます。さらに、データはサーバーに保存されないため、ブラウザを閉じるたびに削除されます。",
    "data_processing_title": "データ処理と共有",
    "data_processing_content": "私たちはサービスを提供するためにあなたのデータを処理します。あなたのデータは、APIクライアントの改善と維持を目的として、内部および外部の関係者と共有される場合があります。すべての外部関係者が私たちの厳格なデータ保護ガイドラインに準拠することを確実にします。",
    "data_methods_title": "データ収集方法",
    "data_methods_content": "データは、直接入力、Cookie、その他のトラッキング技術などのさまざまな手段を通じて収集されます。これにより、ユーザーの好みを理解し、より良いサービスを提供することができます。",
    "ai_title": "AIアシスタント（DIY Mini Bot）",
    "ai_sent": "DIY Mini Botは、classicminidiy.comおよびClassic Mini DIY Toolboxアプリで質問に回答します。質問を送信すると、入力したテキスト、その会話の過去のメッセージ、および含めることを選択した計算機の値や参考データがclassicminidiy.comのサーバーに送信されます。入力した内容、または送信を選択した事前入力の質問に含まれる内容以外は、アカウントやデバイスから送信されません。",
    "ai_processor": "サーバーは回答を生成するために質問をAnthropic（Claude）に渡します。回答はAIが生成したもので、誤りを含む場合があります。回答に頼る前にワークショップマニュアルを確認してください。質問をモデルの学習に使用することはありません。",
    "ai_retention": "ログインユーザーには月間の質問回数の上限があります。アカウントごとの1日の質問数を6か月間保持します。Sustaining Memberは会話履歴をデバイス間で同期できます。同期された会話は最終更新から30日間保持され、その後削除されます。同期していない会話はデバイスまたはブラウザにのみ保存されます。",
    "ai_delete": "同期された会話は、ウェブサイトのチャット履歴またはアプリの設定から個別に、またはすべて削除できます。どの回答からでも報告できます。",
    "contact_title": "連絡先情報",
    "contact_content": "このプライバシーポリシーに関してご質問やご懸念がある場合は、以下までお問い合わせください"
  },
  "ko": {
    "title": "개인정보 보호정책 | Classic Mini DIY",
    "description": "데이터 수집, 저장 및 YouTube API 서비스 사용에 관한 Classic Mini DIY 개인정보 보호정책. 귀하의 정보를 어떻게 보호하는지 알아보세요.",
    "hero_title": "개인정보 보호정책",
    "hero_subtitle": "Classic Mini DIY",
    "heading": "개인정보 보호정책",
    "eyebrow": "법적 고지",
    "acceptance_title": "약관 동의",
    "acceptance_content": "저희 API 클라이언트를 사용함으로써, 귀하는 다음에 구속되는데 동의합니다",
    "youtube_privacy_link": "YouTube 개인정보 보호정책",
    "accessibility_title": "접근성",
    "accessibility_content": "이 개인정보 보호정책은 다음을 통해 모든 사용자가 쉽게 접근할 수 있습니다",
    "google_privacy_link": "Google 개인정보 보호정책",
    "youtube_api_title": "YouTube API 서비스 사용",
    "youtube_api_content": "저희 API 클라이언트는 YouTube API 서비스를 사용합니다. 저희 API 클라이언트를 사용함으로써, 귀하는 이 정책에 설명된 대로 귀하의 데이터의 수집, 저장 및 사용에 동의합니다.",
    "data_collection_title": "데이터 수집, 저장 및 사용",
    "data_collection_content": "저희는 서비스를 제공하고 개선하기 위해 귀하의 기기에서 직접 데이터를 수집합니다. 여기에는 귀하의 기기, IP 주소 및 공개 쿠키 정보에 대한 정보가 포함됩니다. 저희는 저희 사용을 위한 추가 개인 데이터를 수집하지 않습니다. 이 데이터는 안전하게 저장되며 사용자 경험을 향상시키고 API 클라이언트의 원활한 작동을 보장하는 데 사용됩니다. 또한 데이터는 저희 서버에 저장되지 않으므로 브라우저를 닫을 때마다 삭제됩니다.",
    "data_processing_title": "데이터 처리 및 공유",
    "data_processing_content": "저희는 서비스를 제공하기 위해 귀하의 데이터를 처리합니다. 귀하의 데이터는 API 클라이언트를 개선하고 유지하기 위한 목적으로 내부 및 외부 당사자와 공유될 수 있습니다. 모든 외부 당사자가 저희의 엄격한 데이터 보호 가이드라인을 준수하도록 보장합니다.",
    "data_methods_title": "데이터 수집 방법",
    "data_methods_content": "데이터는 직접 입력, 쿠키 및 기타 추적 기술과 같은 다양한 수단을 통해 수집됩니다. 이를 통해 사용자 선호도를 이해하고 더 나은 서비스를 제공할 수 있습니다.",
    "ai_title": "AI 어시스턴트(DIY Mini Bot)",
    "ai_sent": "DIY Mini Bot은 classicminidiy.com과 Classic Mini DIY Toolbox 앱에서 질문에 답합니다. 질문을 보내면 입력한 텍스트, 해당 대화의 이전 메시지, 그리고 포함하기로 선택한 계산기 값이나 참조 데이터가 classicminidiy.com 서버로 전송됩니다. 직접 입력하거나 보내기로 선택한 미리 채워진 질문에 포함된 내용 외에는 계정이나 기기에서 아무것도 전송되지 않습니다.",
    "ai_processor": "서버는 답변을 생성하기 위해 질문을 Anthropic(Claude)에 전달합니다. 답변은 AI가 생성하며 틀릴 수 있습니다. 답변에 의존하기 전에 정비 매뉴얼을 확인하세요. 질문을 모델 학습에 사용하지 않습니다.",
    "ai_retention": "로그인한 사용자에게는 월간 질문 한도가 있습니다. 계정별 일일 질문 수를 6개월 동안 보관합니다. Sustaining Member는 기기 간에 대화 기록을 동기화할 수 있으며, 동기화된 대화는 마지막 업데이트로부터 30일 동안 보관된 후 삭제됩니다. 동기화하지 않은 대화는 기기나 브라우저에만 남습니다.",
    "ai_delete": "웹사이트의 채팅 기록이나 앱의 설정에서 동기화된 대화를 하나씩 또는 전부 삭제할 수 있습니다. 어떤 답변이든 신고할 수 있습니다.",
    "contact_title": "연락처 정보",
    "contact_content": "이 개인정보 보호정책에 대해 질문이나 우려사항이 있으시면 다음으로 연락해 주세요"
  },
  "pt": {
    "title": "Política de Privacidade | Classic Mini DIY",
    "description": "Política de privacidade do Classic Mini DIY sobre coleta, armazenamento e uso de dados dos Serviços de API do YouTube. Saiba como protegemos suas informações.",
    "hero_title": "Política de Privacidade",
    "hero_subtitle": "Classic Mini DIY",
    "heading": "Política de Privacidade",
    "eyebrow": "LEGAL",
    "acceptance_title": "Aceitação dos Termos",
    "acceptance_content": "Ao usar nosso cliente API, você concorda em estar vinculado pela",
    "youtube_privacy_link": "Política de Privacidade do Youtube",
    "accessibility_title": "Acessibilidade",
    "accessibility_content": "Esta Política de Privacidade é facilmente acessível a todos os usuários via",
    "google_privacy_link": "Política de Privacidade do Google",
    "youtube_api_title": "Uso dos Serviços de API do YouTube",
    "youtube_api_content": "Nosso cliente API usa os Serviços de API do YouTube. Ao usar nosso cliente API, você concorda com a coleta, armazenamento e uso de seus dados conforme descrito nesta política.",
    "data_collection_title": "Coleta, Armazenamento e Uso de Dados",
    "data_collection_content": "Coletamos dados diretamente do seu dispositivo para fornecer e melhorar nossos serviços. Isso inclui informações sobre seu dispositivo, endereço IP e informações públicas de cookies. Não coletamos nenhum dado pessoal adicional para nosso uso. Estes dados são armazenados com segurança e usados para aprimorar a experiência do usuário e garantir o funcionamento suave do nosso cliente API. Além disso, nenhum dado é armazenado em nossos servidores, e assim é excluído cada vez que você fecha seu navegador.",
    "data_processing_title": "Processamento e Compartilhamento de Dados",
    "data_processing_content": "Processamos seus dados para fornecer nossos serviços. Seus dados podem ser compartilhados com partes internas e externas para o propósito de melhorar e manter nosso cliente API. Garantimos que todas as partes externas cumpram com nossas diretrizes rigorosas de proteção de dados.",
    "data_methods_title": "Métodos de Coleta de Dados",
    "data_methods_content": "Os dados são coletados por vários meios, como entrada direta, cookies e outras tecnologias de rastreamento. Isso nos ajuda a entender as preferências do usuário e fornecer melhor serviço.",
    "ai_title": "Assistente de IA (DIY Mini Bot)",
    "ai_sent": "O DIY Mini Bot responde a perguntas em classicminidiy.com e nos aplicativos Classic Mini DIY Toolbox. Quando você envia uma pergunta, o texto digitado, as mensagens anteriores dessa conversa e os valores de calculadora ou dados de referência que você escolher incluir são enviados ao nosso servidor em classicminidiy.com. Nada da sua conta ou do seu dispositivo é enviado, a menos que você o digite ou ele apareça em uma pergunta pré-preenchida que você escolha enviar.",
    "ai_processor": "Nosso servidor passa sua pergunta à Anthropic (Claude) para gerar a resposta. As respostas são geradas por IA e podem estar erradas; consulte um manual de oficina antes de confiar nelas. Não usamos suas perguntas para treinar nenhum modelo.",
    "ai_retention": "Usuários conectados têm uma cota mensal de perguntas. Mantemos uma contagem diária de perguntas por conta durante seis meses. Sustaining Members podem sincronizar o histórico de conversas entre dispositivos; conversas sincronizadas são mantidas por 30 dias desde a última atualização e depois excluídas. Conversas não sincronizadas ficam apenas no seu dispositivo ou navegador.",
    "ai_delete": "Você pode excluir uma conversa sincronizada, ou todas, no histórico de chat do site ou em Configurações nos aplicativos. Você pode denunciar qualquer resposta.",
    "contact_title": "Informações de Contato",
    "contact_content": "Informações de Contato Se você tiver alguma dúvida ou preocupação sobre esta política de privacidade, entre em contato conosco em"
  },
  "ru": {
    "title": "Политика конфиденциальности | Classic Mini DIY",
    "description": "Политика конфиденциальности Classic Mini DIY относительно сбора, хранения и использования данных YouTube API Services. Узнайте, как мы защищаем вашу информацию.",
    "hero_title": "Политика конфиденциальности",
    "hero_subtitle": "Classic Mini DIY",
    "heading": "Политика конфиденциальности",
    "eyebrow": "ПРАВОВАЯ ИНФОРМАЦИЯ",
    "acceptance_title": "Принятие условий",
    "acceptance_content": "Используя наш API клиент, вы соглашаетесь соблюдать",
    "youtube_privacy_link": "Политику конфиденциальности YouTube",
    "accessibility_title": "Доступность",
    "accessibility_content": "Эта политика конфиденциальности легко доступна всем пользователям через",
    "google_privacy_link": "Политику конфиденциальности Google",
    "youtube_api_title": "Использование YouTube API Services",
    "youtube_api_content": "Наш API клиент использует YouTube API Services. Используя наш API клиент, вы соглашаетесь на сбор, хранение и использование ваших данных, как описано в этой политике.",
    "data_collection_title": "Сбор, хранение и использование данных",
    "data_collection_content": "Мы собираем данные непосредственно с вашего устройства для предоставления и улучшения наших услуг. Это включает информацию о вашем устройстве, IP-адресе и публичной информации cookie. Мы не собираем дополнительные персональные данные для нашего использования. Эти данные хранятся безопасно и используются для улучшения пользовательского опыта и обеспечения бесперебойной работы нашего API клиента. Кроме того, никакие данные не хранятся на наших серверах, и таким образом удаляются каждый раз, когда вы закрываете браузер.",
    "data_processing_title": "Обработка и передача данных",
    "data_processing_content": "Мы обрабатываем ваши данные для предоставления наших услуг. Ваши данные могут передаваться внутренним и внешним сторонам с целью улучшения и поддержания нашего API клиента. Мы гарантируем, что все внешние стороны соответствуют нашим строгим руководящим принципам защиты данных.",
    "data_methods_title": "Методы сбора данных",
    "data_methods_content": "Данные собираются различными способами, такими как прямой ввод, cookies и другие технологии отслеживания. Это помогает нам понимать предпочтения пользователей и предоставлять лучший сервис.",
    "ai_title": "ИИ-ассистент (DIY Mini Bot)",
    "ai_sent": "DIY Mini Bot отвечает на вопросы на classicminidiy.com и в приложениях Classic Mini DIY Toolbox. Когда вы отправляете вопрос, введённый текст, предыдущие сообщения этого разговора и значения калькулятора или справочные данные, которые вы решили включить, отправляются на наш сервер classicminidiy.com. Ничего из вашего аккаунта или устройства не отправляется, если вы это не ввели или оно не содержится в предзаполненном вопросе, который вы решили отправить.",
    "ai_processor": "Наш сервер передаёт ваш вопрос в Anthropic (Claude) для формирования ответа. Ответы создаются ИИ и могут быть ошибочными; сверьтесь с руководством по ремонту, прежде чем полагаться на них. Мы не используем ваши вопросы для обучения моделей.",
    "ai_retention": "У вошедших пользователей есть месячный лимит вопросов. Мы храним ежедневный счётчик вопросов по аккаунту в течение шести месяцев. Sustaining Members могут синхронизировать историю разговоров между устройствами; синхронизированные разговоры хранятся 30 дней с момента последнего обновления, затем удаляются. Несинхронизированные разговоры остаются только на вашем устройстве или в браузере.",
    "ai_delete": "Вы можете удалить синхронизированный разговор или все разговоры в истории чата на сайте или в настройках приложений. Вы можете пожаловаться на любой ответ.",
    "contact_title": "Контактная информация",
    "contact_content": "Контактная информация Если у вас есть вопросы или замечания по поводу этой политики конфиденциальности, пожалуйста, свяжитесь с нами по адресу"
  },
  "zh": {
    "title": "隐私政策 | Classic Mini DIY",
    "description": "Classic Mini DIY关于数据收集、存储和YouTube API服务使用的隐私政策。了解我们如何保护您的信息。",
    "hero_title": "隐私政策",
    "hero_subtitle": "Classic Mini DIY",
    "heading": "隐私政策",
    "eyebrow": "法律",
    "acceptance_title": "条款接受",
    "acceptance_content": "通过使用我们的API客户端，您同意受",
    "youtube_privacy_link": "YouTube隐私政策",
    "accessibility_title": "可访问性",
    "accessibility_content": "所有用户均可通过以下方式轻松访问此隐私政策",
    "google_privacy_link": "Google隐私政策",
    "youtube_api_title": "YouTube API服务的使用",
    "youtube_api_content": "我们的API客户端使用YouTube API服务。通过使用我们的API客户端，您同意按照本政策所述收集、存储和使用您的数据。",
    "data_collection_title": "数据收集、存储和使用",
    "data_collection_content": "我们直接从您的设备收集数据以提供和改善我们的服务。这包括关于您的设备、IP地址和公共cookie信息。我们不会为了我们的使用而收集任何额外的个人数据。此数据安全存储并用于增强用户体验，确保我们API客户端的平稳运行。此外，我们的服务器上没有存储任何数据，因此每次关闭浏览器时数据都会被删除。",
    "data_processing_title": "数据处理和共享",
    "data_processing_content": "我们处理您的数据以提供我们的服务。您的数据可能会与内部和外部各方共享，以改善和维护我们的API客户端。我们确保所有外部各方遵守我们严格的数据保护准则。",
    "data_methods_title": "数据收集方法",
    "data_methods_content": "数据通过各种方式收集，如直接输入、cookies和其他跟踪技术。这有助于我们了解用户偏好并提供更好的服务。",
    "ai_title": "AI 助手（DIY Mini Bot）",
    "ai_sent": "DIY Mini Bot 在 classicminidiy.com 和 Classic Mini DIY Toolbox 应用中回答问题。当您发送问题时，您输入的文字、该对话中的先前消息，以及您选择包含的计算器数值或参考数据会发送到我们位于 classicminidiy.com 的服务器。除非您输入了相关内容，或它出现在您选择发送的预填问题中，否则不会发送您账户或设备中的任何内容。",
    "ai_processor": "我们的服务器将您的问题传递给 Anthropic（Claude）以生成答案。答案由 AI 生成，可能有误；在依赖答案之前请查阅维修手册。我们不会使用您的问题训练任何模型。",
    "ai_retention": "已登录用户有每月提问额度。我们按账户保存每日提问计数，保留六个月。Sustaining Member 可以跨设备同步对话历史；同步的对话自最后更新起保留 30 天，之后删除。未同步的对话仅保存在您的设备或浏览器中。",
    "ai_delete": "您可以在网站的聊天历史或应用的设置中删除某个同步对话或全部对话。您可以举报任何回答。",
    "contact_title": "联系信息",
    "contact_content": "如果您对此隐私政策有任何问题或疑虑，请联系我们"
  }
}
</i18n>
