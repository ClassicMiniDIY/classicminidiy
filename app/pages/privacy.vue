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
            <p class="py-2 mb-4">
              {{ t('account_data_content') }}
            </p>
          </li>
          <li>
            <h3 class="text-xl font-medium mb-2">{{ t('analytics_title') }}</h3>
            <p class="py-2 mb-4">
              {{ t('analytics_content') }}
            </p>
            <p class="py-2 mb-4">
              {{ t('analytics_optout_content') }}
              <a class="link link-primary" href="mailto:bugs@classicminidiy.com">bugs@classicminidiy.com</a>.
            </p>
          </li>
          <li>
            <h3 class="text-xl font-medium mb-2">{{ t('deletion_title') }}</h3>
            <p class="py-2 mb-4">
              {{ t('deletion_content') }}
              <NuxtLink class="link link-primary" to="/account/delete">{{ t('deletion_link') }}</NuxtLink
              >.
              {{ t('deletion_retention') }}
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
    "data_collection_content": "We collect data directly from your device to provide and improve our services. This includes information about your device, IP address, and public cookie information. This data is used to enhance the user experience and ensure the smooth operation of our API client.",
    "account_data_content": "If you create an account, we store the data you give us and the data you create: your profile (name, avatar, location, bio), your sign-in identity (email address and sign-in provider), marketplace listings, messages and watchlist on The Mini Exchange, your garage vehicles and maintenance records from the Classic Mini DIY Toolbox apps, saved calculator setups, AI chat history, and your membership status. One account is shared across classicminidiy.com, The Mini Exchange and the Toolbox apps. This data is stored in Supabase, hosted in the United States, and is kept until you delete your account.",
    "analytics_title": "Usage Analytics in the Mobile Apps",
    "analytics_content": "The Classic Mini DIY Toolbox apps for iOS and Android collect usage analytics so we can see which tools people use and where the apps fail. This includes the screens and tools you open, subscription and sign-in events (for example that a purchase or sign-in happened, never the payment details), the app version, and your device model and operating system version. These events are tied to your account ID only while you are signed in; otherwise they are anonymous. The data is processed by PostHog, Inc. in the United States.",
    "analytics_optout_content": "You can turn analytics off at any time in the app under Settings, then Privacy. To have the analytics already collected about your account removed, email",
    "deletion_title": "Deleting Your Account",
    "deletion_content": "You can delete your account yourself, from the website or from the apps, at",
    "deletion_link": "classicminidiy.com/account/delete",
    "deletion_retention": "Deletion is immediate and cannot be undone. Records of sold marketplace listings and of payments are kept for up to 7 years for accounting and dispute handling, with the link to your account removed. Approved archive contributions stay published without your name. Deleting your account does not cancel a membership billed by the App Store, Google Play or Stripe; cancel that first in the store you paid through.",
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
    "data_collection_content": "Wir sammeln Daten direkt von Ihrem Gerät, um unsere Services bereitzustellen und zu verbessern. Dies umfasst Informationen über Ihr Gerät, IP-Adresse und öffentliche Cookie-Informationen. Diese Daten werden verwendet, um die Benutzererfahrung zu verbessern und den reibungslosen Betrieb unseres API-Clients zu gewährleisten.",
    "account_data_content": "Wenn Sie ein Konto erstellen, speichern wir die Daten, die Sie uns geben und die Sie erstellen: Ihr Profil (Name, Avatar, Ort, Bio), Ihre Anmeldeidentität (E-Mail-Adresse und Anmeldeanbieter), Marktplatz-Anzeigen, Nachrichten und Merkliste auf The Mini Exchange, Ihre Garagen-Fahrzeuge und Wartungseinträge aus den Classic Mini DIY Toolbox-Apps, gespeicherte Rechner-Einstellungen, KI-Chatverlauf und Ihren Mitgliedsstatus. Ein Konto gilt für classicminidiy.com, The Mini Exchange und die Toolbox-Apps. Diese Daten werden in Supabase in den USA gespeichert und bleiben erhalten, bis Sie Ihr Konto löschen.",
    "analytics_title": "Nutzungsanalysen in den Mobil-Apps",
    "analytics_content": "Die Classic Mini DIY Toolbox-Apps für iOS und Android erfassen Nutzungsanalysen, damit wir sehen, welche Werkzeuge genutzt werden und wo die Apps fehlschlagen. Dazu gehören die geöffneten Bildschirme und Werkzeuge, Abo- und Anmeldeereignisse (z. B. dass ein Kauf oder eine Anmeldung stattgefunden hat, nie die Zahlungsdaten), die App-Version sowie Gerätemodell und Betriebssystemversion. Diese Ereignisse sind nur mit Ihrer Konto-ID verknüpft, solange Sie angemeldet sind; sonst sind sie anonym. Die Daten werden von PostHog, Inc. in den USA verarbeitet.",
    "analytics_optout_content": "Sie können Analysen jederzeit in der App unter Einstellungen, dann Datenschutz, abschalten. Um bereits erfasste Analysen zu Ihrem Konto löschen zu lassen, schreiben Sie an",
    "deletion_title": "Löschen Ihres Kontos",
    "deletion_content": "Sie können Ihr Konto selbst löschen, über die Website oder die Apps, unter",
    "deletion_link": "classicminidiy.com/account/delete",
    "deletion_retention": "Die Löschung erfolgt sofort und kann nicht rückgängig gemacht werden. Datensätze zu verkauften Marktplatz-Anzeigen und zu Zahlungen werden bis zu 7 Jahre für Buchhaltung und Streitfälle aufbewahrt, ohne Verknüpfung zu Ihrem Konto. Genehmigte Archivbeiträge bleiben ohne Ihren Namen veröffentlicht. Das Löschen des Kontos kündigt keine Mitgliedschaft, die über den App Store, Google Play oder Stripe abgerechnet wird; kündigen Sie diese zuerst in dem Store, über den Sie bezahlt haben.",
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
    "data_collection_content": "Recopilamos datos directamente de tu dispositivo para proporcionar y mejorar nuestros servicios. Esto incluye información sobre tu dispositivo, dirección IP e información pública de cookies. Estos datos se usan para mejorar la experiencia del usuario y asegurar el funcionamiento fluido de nuestro cliente API.",
    "account_data_content": "Si creas una cuenta, almacenamos los datos que nos das y los que creas: tu perfil (nombre, avatar, ubicación, biografía), tu identidad de inicio de sesión (correo electrónico y proveedor de acceso), anuncios, mensajes y lista de seguimiento del mercado en The Mini Exchange, tus vehículos del garaje y registros de mantenimiento de las apps Classic Mini DIY Toolbox, configuraciones guardadas de calculadoras, historial del chat de IA y tu estado de membresía. Una sola cuenta se comparte entre classicminidiy.com, The Mini Exchange y las apps Toolbox. Estos datos se almacenan en Supabase, alojado en Estados Unidos, y se conservan hasta que elimines tu cuenta.",
    "analytics_title": "Analíticas de uso en las apps móviles",
    "analytics_content": "Las apps Classic Mini DIY Toolbox para iOS y Android recopilan analíticas de uso para que podamos ver qué herramientas usa la gente y dónde fallan las apps. Esto incluye las pantallas y herramientas que abres, eventos de suscripción e inicio de sesión (por ejemplo, que ocurrió una compra o un inicio de sesión, nunca los datos de pago), la versión de la app, y el modelo de tu dispositivo y la versión del sistema operativo. Estos eventos se vinculan a tu ID de cuenta solo mientras tienes la sesión iniciada; de lo contrario son anónimos. Los datos los procesa PostHog, Inc. en Estados Unidos.",
    "analytics_optout_content": "Puedes desactivar las analíticas en cualquier momento en la app, en Ajustes y luego Privacidad. Para que se eliminen las analíticas ya recopiladas sobre tu cuenta, escribe a",
    "deletion_title": "Eliminar tu cuenta",
    "deletion_content": "Puedes eliminar tu cuenta tú mismo, desde el sitio web o desde las apps, en",
    "deletion_link": "classicminidiy.com/account/delete",
    "deletion_retention": "La eliminación es inmediata y no se puede deshacer. Los registros de anuncios vendidos y de pagos se conservan hasta 7 años para contabilidad y gestión de disputas, sin el vínculo a tu cuenta. Las contribuciones al archivo aprobadas siguen publicadas sin tu nombre. Eliminar tu cuenta no cancela una membresía facturada por App Store, Google Play o Stripe; cancélala primero en la tienda a través de la que pagaste.",
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
    "data_collection_content": "Nous collectons les données directement depuis votre appareil pour fournir et améliorer nos services. Cela inclut des informations sur votre appareil, adresse IP et informations publiques de cookies. Ces données servent à améliorer l'expérience utilisateur et à assurer le bon fonctionnement de notre client API.",
    "account_data_content": "Si vous créez un compte, nous stockons les données que vous nous fournissez et celles que vous créez : votre profil (nom, avatar, localisation, bio), votre identité de connexion (adresse e-mail et fournisseur de connexion), les annonces, messages et liste de suivi sur The Mini Exchange, vos véhicules de garage et carnets d'entretien des applications Classic Mini DIY Toolbox, les réglages de calculateurs enregistrés, l'historique du chat IA et votre statut d'adhésion. Un seul compte est partagé entre classicminidiy.com, The Mini Exchange et les applications Toolbox. Ces données sont stockées chez Supabase, hébergé aux États-Unis, et conservées jusqu'à la suppression de votre compte.",
    "analytics_title": "Analyse d'utilisation dans les applications mobiles",
    "analytics_content": "Les applications Classic Mini DIY Toolbox pour iOS et Android collectent des données d'analyse d'utilisation afin que nous sachions quels outils sont utilisés et où les applications échouent. Cela inclut les écrans et outils ouverts, les événements d'abonnement et de connexion (par exemple qu'un achat ou une connexion a eu lieu, jamais les détails de paiement), la version de l'application, ainsi que le modèle de votre appareil et la version du système. Ces événements sont liés à votre identifiant de compte uniquement lorsque vous êtes connecté ; sinon ils sont anonymes. Les données sont traitées par PostHog, Inc. aux États-Unis.",
    "analytics_optout_content": "Vous pouvez désactiver l'analyse à tout moment dans l'application, sous Réglages puis Confidentialité. Pour faire supprimer les données d'analyse déjà collectées sur votre compte, écrivez à",
    "deletion_title": "Supprimer votre compte",
    "deletion_content": "Vous pouvez supprimer votre compte vous-même, depuis le site web ou les applications, à l'adresse",
    "deletion_link": "classicminidiy.com/account/delete",
    "deletion_retention": "La suppression est immédiate et irréversible. Les enregistrements des annonces vendues et des paiements sont conservés jusqu'à 7 ans pour la comptabilité et le traitement des litiges, sans lien avec votre compte. Les contributions aux archives approuvées restent publiées sans votre nom. Supprimer votre compte ne résilie pas une adhésion facturée par l'App Store, Google Play ou Stripe ; résiliez-la d'abord dans la boutique via laquelle vous avez payé.",
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
    "data_collection_content": "Raccogliamo i dati direttamente dal tuo dispositivo per fornire e migliorare i nostri servizi. Questo include informazioni sul tuo dispositivo, indirizzo IP e informazioni sui cookie pubblici. Questi dati sono usati per migliorare l'esperienza utente e garantire il funzionamento fluido del nostro client API.",
    "account_data_content": "Se crei un account, conserviamo i dati che ci fornisci e quelli che crei: il tuo profilo (nome, avatar, località, bio), la tua identità di accesso (indirizzo email e provider di accesso), annunci, messaggi e lista dei preferiti su The Mini Exchange, i veicoli del garage e i registri di manutenzione delle app Classic Mini DIY Toolbox, le configurazioni salvate dei calcolatori, la cronologia della chat IA e lo stato del tuo abbonamento. Un solo account è condiviso tra classicminidiy.com, The Mini Exchange e le app Toolbox. Questi dati sono conservati su Supabase, ospitato negli Stati Uniti, fino a quando non elimini l'account.",
    "analytics_title": "Analisi di utilizzo nelle app mobili",
    "analytics_content": "Le app Classic Mini DIY Toolbox per iOS e Android raccolgono analisi di utilizzo per capire quali strumenti vengono usati e dove le app falliscono. Questo include le schermate e gli strumenti che apri, eventi di abbonamento e accesso (ad esempio che un acquisto o un accesso è avvenuto, mai i dati di pagamento), la versione dell'app, il modello del dispositivo e la versione del sistema operativo. Questi eventi sono collegati al tuo ID account solo mentre sei connesso; altrimenti sono anonimi. I dati sono trattati da PostHog, Inc. negli Stati Uniti.",
    "analytics_optout_content": "Puoi disattivare le analisi in qualsiasi momento nell'app, in Impostazioni e poi Privacy. Per far rimuovere le analisi già raccolte sul tuo account, scrivi a",
    "deletion_title": "Eliminare il tuo account",
    "deletion_content": "Puoi eliminare il tuo account da solo, dal sito web o dalle app, su",
    "deletion_link": "classicminidiy.com/account/delete",
    "deletion_retention": "L'eliminazione è immediata e non può essere annullata. Le registrazioni degli annunci venduti e dei pagamenti sono conservate fino a 7 anni per contabilità e gestione delle controversie, senza collegamento al tuo account. I contributi all'archivio approvati restano pubblicati senza il tuo nome. Eliminare l'account non annulla un abbonamento fatturato da App Store, Google Play o Stripe; annullalo prima nello store attraverso cui hai pagato.",
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
    "data_collection_content": "私たちはサービスを提供し、改善するためにあなたのデバイスから直接データを収集します。これには、デバイス、IPアドレス、公開Cookie情報に関する情報が含まれます。このデータは、ユーザーエクスペリエンスを向上させ、APIクライアントの円滑な動作を確保するために使用されます。",
    "account_data_content": "アカウントを作成すると、ご提供いただいたデータと作成されたデータを保存します。プロフィール（名前、アバター、所在地、自己紹介）、ログインID（メールアドレスとログインプロバイダー）、The Mini Exchangeの出品・メッセージ・ウォッチリスト、Classic Mini DIY Toolboxアプリのガレージ車両とメンテナンス記録、保存した計算機の設定、AIチャット履歴、メンバーシップの状態です。1つのアカウントをclassicminidiy.com、The Mini Exchange、Toolboxアプリで共有します。これらのデータは米国でホストされるSupabaseに保存され、アカウントを削除するまで保持されます。",
    "analytics_title": "モバイルアプリの利用分析",
    "analytics_content": "iOSおよびAndroid向けClassic Mini DIY Toolboxアプリは、どのツールが使われ、どこでアプリが失敗するかを把握するために利用分析データを収集します。これには、開いた画面とツール、サブスクリプションとログインのイベント（購入やログインが行われたという事実のみで、支払い情報は含みません）、アプリのバージョン、デバイスのモデルとOSのバージョンが含まれます。これらのイベントは、ログイン中のみアカウントIDに紐付けられ、それ以外は匿名です。データは米国のPostHog, Inc.によって処理されます。",
    "analytics_optout_content": "分析はアプリの「設定」→「プライバシー」でいつでもオフにできます。すでに収集されたアカウントの分析データの削除をご希望の場合は、次のアドレスまでメールしてください：",
    "deletion_title": "アカウントの削除",
    "deletion_content": "アカウントはウェブサイトまたはアプリから、次のページでご自身で削除できます：",
    "deletion_link": "classicminidiy.com/account/delete",
    "deletion_retention": "削除は即時で、元に戻せません。売却済み出品と支払いの記録は、会計と紛争対応のためアカウントとの紐付けを外した上で最長7年間保持されます。承認済みのアーカイブ投稿は氏名なしで公開され続けます。アカウントを削除しても、App Store、Google Play、Stripeで請求されるメンバーシップは解約されません。先にお支払いのストアで解約してください。",
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
    "data_collection_content": "저희는 서비스를 제공하고 개선하기 위해 귀하의 기기에서 직접 데이터를 수집합니다. 여기에는 귀하의 기기, IP 주소 및 공개 쿠키 정보에 대한 정보가 포함됩니다. 이 데이터는 사용자 경험을 향상시키고 API 클라이언트의 원활한 작동을 보장하는 데 사용됩니다.",
    "account_data_content": "계정을 만들면 귀하가 제공한 데이터와 생성한 데이터를 저장합니다: 프로필(이름, 아바타, 위치, 소개), 로그인 ID(이메일 주소 및 로그인 제공자), The Mini Exchange의 매물·메시지·관심 목록, Classic Mini DIY Toolbox 앱의 차고 차량과 정비 기록, 저장된 계산기 설정, AI 채팅 기록, 멤버십 상태입니다. 하나의 계정을 classicminidiy.com, The Mini Exchange, Toolbox 앱에서 공유합니다. 이 데이터는 미국에 호스팅된 Supabase에 저장되며 계정을 삭제할 때까지 보관됩니다.",
    "analytics_title": "모바일 앱의 사용 분석",
    "analytics_content": "iOS 및 Android용 Classic Mini DIY Toolbox 앱은 어떤 도구가 사용되고 앱이 어디에서 실패하는지 파악하기 위해 사용 분석 데이터를 수집합니다. 여기에는 연 화면과 도구, 구독 및 로그인 이벤트(구매나 로그인이 발생했다는 사실만 포함되며 결제 정보는 포함되지 않음), 앱 버전, 기기 모델과 운영체제 버전이 포함됩니다. 이러한 이벤트는 로그인한 동안에만 계정 ID에 연결되며, 그 외에는 익명입니다. 데이터는 미국의 PostHog, Inc.에서 처리합니다.",
    "analytics_optout_content": "앱의 설정 → 개인정보에서 언제든지 분석을 끌 수 있습니다. 이미 수집된 계정 분석 데이터의 삭제를 원하시면 다음 주소로 이메일을 보내주세요:",
    "deletion_title": "계정 삭제",
    "deletion_content": "웹사이트 또는 앱에서 다음 페이지를 통해 직접 계정을 삭제할 수 있습니다:",
    "deletion_link": "classicminidiy.com/account/delete",
    "deletion_retention": "삭제는 즉시 이루어지며 되돌릴 수 없습니다. 판매된 매물과 결제 기록은 계정과의 연결을 제거한 상태로 회계 및 분쟁 처리를 위해 최대 7년간 보관됩니다. 승인된 아카이브 기여는 이름 없이 계속 게시됩니다. 계정을 삭제해도 App Store, Google Play 또는 Stripe에서 청구되는 멤버십은 해지되지 않으므로 결제한 스토어에서 먼저 해지하세요.",
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
    "data_collection_content": "Coletamos dados diretamente do seu dispositivo para fornecer e melhorar nossos serviços. Isso inclui informações sobre seu dispositivo, endereço IP e informações públicas de cookies. Estes dados são usados para aprimorar a experiência do usuário e garantir o funcionamento suave do nosso cliente API.",
    "account_data_content": "Se você criar uma conta, armazenamos os dados que você nos fornece e os que você cria: seu perfil (nome, avatar, localização, bio), sua identidade de login (endereço de e-mail e provedor de login), anúncios, mensagens e lista de acompanhamento no The Mini Exchange, seus veículos da garagem e registros de manutenção dos apps Classic Mini DIY Toolbox, configurações de calculadoras salvas, histórico do chat de IA e seu status de assinatura. Uma única conta é compartilhada entre classicminidiy.com, The Mini Exchange e os apps Toolbox. Esses dados são armazenados no Supabase, hospedado nos Estados Unidos, e mantidos até que você exclua sua conta.",
    "analytics_title": "Análises de uso nos apps móveis",
    "analytics_content": "Os apps Classic Mini DIY Toolbox para iOS e Android coletam análises de uso para que possamos ver quais ferramentas as pessoas usam e onde os apps falham. Isso inclui as telas e ferramentas que você abre, eventos de assinatura e login (por exemplo, que uma compra ou login ocorreu, nunca os dados de pagamento), a versão do app, e o modelo do seu dispositivo e a versão do sistema operacional. Esses eventos são vinculados ao ID da sua conta apenas enquanto você está conectado; caso contrário, são anônimos. Os dados são processados pela PostHog, Inc. nos Estados Unidos.",
    "analytics_optout_content": "Você pode desativar as análises a qualquer momento no app, em Configurações e depois Privacidade. Para que as análises já coletadas sobre sua conta sejam removidas, escreva para",
    "deletion_title": "Excluindo sua conta",
    "deletion_content": "Você pode excluir sua conta por conta própria, pelo site ou pelos apps, em",
    "deletion_link": "classicminidiy.com/account/delete",
    "deletion_retention": "A exclusão é imediata e não pode ser desfeita. Registros de anúncios vendidos e de pagamentos são mantidos por até 7 anos para contabilidade e disputas, sem o vínculo com sua conta. Contribuições ao arquivo aprovadas continuam publicadas sem o seu nome. Excluir sua conta não cancela uma assinatura cobrada pela App Store, Google Play ou Stripe; cancele-a primeiro na loja pela qual você pagou.",
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
    "data_collection_content": "Мы собираем данные непосредственно с вашего устройства для предоставления и улучшения наших услуг. Это включает информацию о вашем устройстве, IP-адресе и публичной информации cookie. Эти данные используются для улучшения пользовательского опыта и обеспечения бесперебойной работы нашего API-клиента.",
    "account_data_content": "Если вы создаёте аккаунт, мы храним данные, которые вы нам предоставляете и создаёте: ваш профиль (имя, аватар, местоположение, описание), учётные данные для входа (адрес электронной почты и провайдер входа), объявления, сообщения и список отслеживания на The Mini Exchange, автомобили в гараже и записи об обслуживании из приложений Classic Mini DIY Toolbox, сохранённые настройки калькуляторов, историю ИИ-чата и статус членства. Один аккаунт используется на classicminidiy.com, The Mini Exchange и в приложениях Toolbox. Эти данные хранятся в Supabase, размещённом в США, до удаления вашего аккаунта.",
    "analytics_title": "Аналитика использования в мобильных приложениях",
    "analytics_content": "Приложения Classic Mini DIY Toolbox для iOS и Android собирают аналитику использования, чтобы мы видели, какие инструменты используются и где приложения дают сбой. Это включает открываемые экраны и инструменты, события подписки и входа (например, факт покупки или входа, но никогда платёжные данные), версию приложения, модель устройства и версию операционной системы. Эти события связываются с ID вашего аккаунта только пока вы вошли в систему; в остальных случаях они анонимны. Данные обрабатывает PostHog, Inc. в США.",
    "analytics_optout_content": "Вы можете отключить аналитику в любое время в приложении в разделе «Настройки» → «Конфиденциальность». Чтобы удалить уже собранную аналитику по вашему аккаунту, напишите на",
    "deletion_title": "Удаление аккаунта",
    "deletion_content": "Вы можете удалить аккаунт самостоятельно, с сайта или из приложений, по адресу",
    "deletion_link": "classicminidiy.com/account/delete",
    "deletion_retention": "Удаление происходит немедленно и не может быть отменено. Записи о проданных объявлениях и о платежах хранятся до 7 лет для бухгалтерии и разрешения споров без связи с вашим аккаунтом. Одобренные вклады в архив остаются опубликованными без вашего имени. Удаление аккаунта не отменяет членство, оплачиваемое через App Store, Google Play или Stripe; сначала отмените его в том магазине, через который вы платили.",
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
    "data_collection_content": "我们直接从您的设备收集数据以提供和改善我们的服务。这包括关于您的设备、IP地址和公共cookie信息。此数据用于增强用户体验，确保我们API客户端的平稳运行。",
    "account_data_content": "如果您创建账户，我们会存储您提供和创建的数据：您的个人资料（姓名、头像、位置、简介）、登录身份（电子邮件地址和登录提供商）、The Mini Exchange上的商品、消息和关注列表、Classic Mini DIY Toolbox应用中的车库车辆和保养记录、已保存的计算器设置、AI聊天记录以及您的会员状态。一个账户通用于classicminidiy.com、The Mini Exchange和Toolbox应用。这些数据存储在托管于美国的Supabase中，并保留至您删除账户为止。",
    "analytics_title": "移动应用中的使用分析",
    "analytics_content": "iOS和Android版Classic Mini DIY Toolbox应用会收集使用分析数据，以便我们了解人们使用哪些工具以及应用在哪里出错。这包括您打开的屏幕和工具、订阅和登录事件（例如发生了购买或登录，绝不包含付款详情）、应用版本，以及您的设备型号和操作系统版本。这些事件仅在您登录时与您的账户ID关联；否则为匿名。数据由美国的PostHog, Inc.处理。",
    "analytics_optout_content": "您可以随时在应用的“设置”→“隐私”中关闭分析。如需删除已收集的与您账户相关的分析数据，请发送邮件至",
    "deletion_title": "删除您的账户",
    "deletion_content": "您可以通过网站或应用自行删除账户，网址为",
    "deletion_link": "classicminidiy.com/account/delete",
    "deletion_retention": "删除是即时的且无法撤销。已售商品和付款记录出于会计和争议处理需要最长保留7年，并移除与您账户的关联。已审核的档案贡献将继续发布，但不显示您的姓名。删除账户不会取消由App Store、Google Play或Stripe扣费的会员资格；请先在您付款所用的商店中取消。",
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
