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
        href: 'https://classicminidiy.com/privacy',
      },
    ],
  });

  useSeoMeta({
    ogTitle: t('title'),
    ogDescription: t('description'),
    ogUrl: 'https://classicminidiy.com/privacy',
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
    url: 'https://classicminidiy.com/privacy',
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
        <h1 class="text-3xl font-medium">{{ t('heading') }}</h1>

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
    "contact_title": "Contact Information",
    "contact_content": "Contact Information If you have any questions or concerns about this privacy policy, please contact us at"
  },
  "de": {
    "title": "Datenschutzrichtlinie | Classic Mini DIY",
    "description": "Classic Mini DIY Datenschutzrichtlinie bezüglich Datensammlung, Speicherung und Verwendung von YouTube API Services. Erfahren Sie, wie wir Ihre Informationen schützen.",
    "hero_title": "Datenschutzrichtlinie",
    "hero_subtitle": "Classic Mini DIY",
    "heading": "Datenschutzrichtlinie",
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
    "contact_title": "Kontaktinformationen",
    "contact_content": "Kontaktinformationen Wenn Sie Fragen oder Bedenken zu dieser Datenschutzrichtlinie haben, kontaktieren Sie uns bitte unter"
  },
  "es": {
    "title": "Política de Privacidad | Classic Mini DIY",
    "description": "Política de privacidad de Classic Mini DIY sobre recopilación, almacenamiento y uso de datos de YouTube API Services. Aprende cómo protegemos tu información.",
    "hero_title": "Política de Privacidad",
    "hero_subtitle": "Classic Mini DIY",
    "heading": "Política de Privacidad",
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
    "contact_title": "Información de Contacto",
    "contact_content": "Información de Contacto Si tienes alguna pregunta o preocupación sobre esta política de privacidad, por favor contáctanos en"
  },
  "fr": {
    "title": "Politique de confidentialité | Classic Mini DIY",
    "description": "Politique de confidentialité de Classic Mini DIY concernant la collecte, le stockage et l'utilisation des services API YouTube. Apprenez comment nous protégeons vos informations.",
    "hero_title": "Politique de confidentialité",
    "hero_subtitle": "Classic Mini DIY",
    "heading": "Politique de confidentialité",
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
    "contact_title": "Informations de contact",
    "contact_content": "Si vous avez des questions ou préoccupations concernant cette politique de confidentialité, veuillez nous contacter à"
  },
  "it": {
    "title": "Politica sulla privacy | Classic Mini DIY",
    "description": "Politica sulla privacy di Classic Mini DIY riguardante la raccolta, memorizzazione e uso dei dati e dei servizi API di YouTube. Scopri come proteggiamo le tue informazioni.",
    "hero_title": "Politica sulla privacy",
    "hero_subtitle": "Classic Mini DIY",
    "heading": "Politica sulla privacy",
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
    "contact_title": "Informazioni di contatto",
    "contact_content": "Se hai domande o dubbi su questa politica sulla privacy, contattaci a"
  },
  "ja": {
    "title": "プライバシーポリシー | Classic Mini DIY",
    "description": "データ収集、保存、YouTube APIサービスの使用に関するClassic Mini DIYプライバシーポリシー。あなたの情報をどのように保護するかを学びます。",
    "hero_title": "プライバシーポリシー",
    "hero_subtitle": "Classic Mini DIY",
    "heading": "プライバシーポリシー",
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
    "contact_title": "連絡先情報",
    "contact_content": "このプライバシーポリシーに関してご質問やご懸念がある場合は、以下までお問い合わせください"
  },
  "ko": {
    "title": "개인정보 보호정책 | Classic Mini DIY",
    "description": "데이터 수집, 저장 및 YouTube API 서비스 사용에 관한 Classic Mini DIY 개인정보 보호정책. 귀하의 정보를 어떻게 보호하는지 알아보세요.",
    "hero_title": "개인정보 보호정책",
    "hero_subtitle": "Classic Mini DIY",
    "heading": "개인정보 보호정책",
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
    "contact_title": "연락처 정보",
    "contact_content": "이 개인정보 보호정책에 대해 질문이나 우려사항이 있으시면 다음으로 연락해 주세요"
  },
  "pt": {
    "title": "Política de Privacidade | Classic Mini DIY",
    "description": "Política de privacidade do Classic Mini DIY sobre coleta, armazenamento e uso de dados dos Serviços de API do YouTube. Saiba como protegemos suas informações.",
    "hero_title": "Política de Privacidade",
    "hero_subtitle": "Classic Mini DIY",
    "heading": "Política de Privacidade",
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
    "contact_title": "Informações de Contato",
    "contact_content": "Informações de Contato Se você tiver alguma dúvida ou preocupação sobre esta política de privacidade, entre em contato conosco em"
  },
  "ru": {
    "title": "Политика конфиденциальности | Classic Mini DIY",
    "description": "Политика конфиденциальности Classic Mini DIY относительно сбора, хранения и использования данных YouTube API Services. Узнайте, как мы защищаем вашу информацию.",
    "hero_title": "Политика конфиденциальности",
    "hero_subtitle": "Classic Mini DIY",
    "heading": "Политика конфиденциальности",
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
    "contact_title": "Контактная информация",
    "contact_content": "Контактная информация Если у вас есть вопросы или замечания по поводу этой политики конфиденциальности, пожалуйста, свяжитесь с нами по адресу"
  },
  "zh": {
    "title": "隐私政策 | Classic Mini DIY",
    "description": "Classic Mini DIY关于数据收集、存储和YouTube API服务使用的隐私政策。了解我们如何保护您的信息。",
    "hero_title": "隐私政策",
    "hero_subtitle": "Classic Mini DIY",
    "heading": "隐私政策",
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
    "contact_title": "联系信息",
    "contact_content": "如果您对此隐私政策有任何问题或疑虑，请联系我们"
  }
}
</i18n>
