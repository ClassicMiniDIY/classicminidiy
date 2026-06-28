<template>
  <div class="container py-12">
    <!-- Header -->
    <div class="max-w-4xl mx-auto mb-16 text-center">
      <h1 class="text-5xl font-bold mb-6">{{ t('hero.title') }}</h1>
      <p class="text-xl text-base-content/70 leading-relaxed">
        {{ t('hero.subtitle') }}
      </p>
    </div>

    <!-- Buyer / Seller Toggle -->
    <div class="max-w-4xl mx-auto mb-12">
      <div class="flex justify-center gap-2 p-1 bg-base-200 rounded-box inline-flex mx-auto">
        <button @click="activeTab = 'buyers'" :class="['btn', activeTab === 'buyers' ? 'btn-primary' : 'btn-ghost']">
          <i class="fas fa-magnifying-glass"></i>
          {{ t('tabs.buyers') }}
        </button>
        <button @click="activeTab = 'sellers'" :class="['btn', activeTab === 'sellers' ? 'btn-primary' : 'btn-ghost']">
          <i class="fas fa-bullhorn"></i>
          {{ t('tabs.sellers') }}
        </button>
      </div>
    </div>

    <!-- For Buyers -->
    <div v-if="activeTab === 'buyers'" class="max-w-4xl mx-auto space-y-8">
      <h2 class="sr-only">{{ t('buyers.srTitle') }}</h2>
      <template v-for="(step, i) in tm('buyers.steps')" :key="i">
        <div v-if="i > 0" class="divider"></div>
        <div class="flex gap-6 items-start">
          <div class="flex-shrink-0">
            <div
              class="w-16 h-16 rounded-full bg-primary text-primary-content flex items-center justify-center text-2xl font-bold"
            >
              {{ i + 1 }}
            </div>
          </div>
          <div class="flex-1">
            <h3 class="text-2xl font-bold mb-3">{{ rt(step.title) }}</h3>
            <p class="text-base-content/70 text-lg mb-4">
              {{ rt(step.body) }}
            </p>
            <div class="card bg-base-100 shadow-sm">
              <div class="card-body">
                <p class="text-sm text-base-content/70">
                  <strong>{{ rt(step.tipLabel) }}</strong> {{ rt(step.tip) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div class="mt-12 text-center">
        <NuxtLink to="/exchange/listings" class="btn btn-primary btn-lg">
          <i class="fas fa-magnifying-glass"></i>
          {{ t('buyers.cta') }}
        </NuxtLink>
      </div>
    </div>

    <!-- For Sellers -->
    <div v-else class="max-w-4xl mx-auto space-y-8">
      <h2 class="sr-only">{{ t('sellers.srTitle') }}</h2>
      <template v-for="(step, i) in tm('sellers.steps')" :key="i">
        <div v-if="i > 0" class="divider"></div>
        <div class="flex gap-6 items-start">
          <div class="flex-shrink-0">
            <div
              class="w-16 h-16 rounded-full bg-secondary text-secondary-content flex items-center justify-center text-2xl font-bold"
            >
              {{ i + 1 }}
            </div>
          </div>
          <div class="flex-1">
            <h3 class="text-2xl font-bold mb-3">{{ rt(step.title) }}</h3>
            <p class="text-base-content/70 text-lg mb-4">
              {{ rt(step.body) }}
            </p>
            <div class="card bg-base-100 shadow-sm">
              <div class="card-body">
                <p class="text-sm text-base-content/70">
                  <strong>{{ rt(step.tipLabel) }}</strong> {{ rt(step.tip) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div class="mt-12 text-center">
        <NuxtLink to="/exchange/listings/new" class="btn btn-secondary btn-lg">
          <i class="fas fa-plus"></i>
          {{ t('sellers.cta') }}
        </NuxtLink>
      </div>
    </div>

    <!-- FAQ Section -->
    <div class="max-w-4xl mx-auto mt-20">
      <h2 class="text-3xl font-bold mb-8 text-center">{{ t('faq.title') }}</h2>
      <div class="space-y-4">
        <div v-for="(item, i) in tm('faq.items')" :key="i" class="collapse collapse-plus bg-base-100 shadow-sm">
          <input type="radio" name="faq-accordion" :aria-label="rt(item.question)" />
          <div class="collapse-title text-xl font-medium">{{ rt(item.question) }}</div>
          <div class="collapse-content">
            <p class="text-base-content/70">{{ rt(item.answer) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Still Have Questions -->
    <div class="max-w-2xl mx-auto mt-16 text-center bg-primary/5 rounded-box p-12">
      <h3 class="text-2xl font-bold mb-4">{{ t('questions.title') }}</h3>
      <p class="text-base-content/70 mb-6">
        {{ t('questions.body') }}
      </p>
      <NuxtLink to="/contact" class="btn btn-primary">
        <i class="fas fa-envelope"></i>
        {{ t('questions.button') }}
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
  const { t, tm, rt } = useI18n();
  const config = useRuntimeConfig();
  const activeTab = ref<'buyers' | 'sellers'>('buyers');

  // SEO metadata
  useSeoMeta({
    title: () => t('seo.title'),
    description: () => t('seo.description'),
    ogTitle: () => t('seo.title'),
    ogDescription: () => t('seo.ogDescription'),
    ogType: 'website',
    ogUrl: `${config.public.siteUrl}/exchange/how-it-works`,
    ogImage: '/og-image.jpg',
    twitterCard: 'summary_large_image',
    twitterTitle: () => t('seo.title'),
    twitterDescription: () => t('seo.ogDescription'),
  });

  // FAQPage schema for the FAQ section
  useSchemaOrg([
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: () => t('faq.items.0.question'),
          acceptedAnswer: { '@type': 'Answer', text: () => t('faq.items.0.answer') },
        },
        {
          '@type': 'Question',
          name: () => t('faq.items.1.question'),
          acceptedAnswer: { '@type': 'Answer', text: () => t('faq.items.1.answer') },
        },
        {
          '@type': 'Question',
          name: () => t('faq.items.2.question'),
          acceptedAnswer: { '@type': 'Answer', text: () => t('faq.items.2.answer') },
        },
        {
          '@type': 'Question',
          name: () => t('faq.items.3.question'),
          acceptedAnswer: { '@type': 'Answer', text: () => t('faq.items.3.answer') },
        },
        {
          '@type': 'Question',
          name: () => t('faq.items.4.question'),
          acceptedAnswer: { '@type': 'Answer', text: () => t('faq.items.4.answer') },
        },
        {
          '@type': 'Question',
          name: () => t('faq.items.5.question'),
          acceptedAnswer: { '@type': 'Answer', text: () => t('faq.items.5.answer') },
        },
        {
          '@type': 'Question',
          name: () => t('faq.items.6.question'),
          acceptedAnswer: { '@type': 'Answer', text: () => t('faq.items.6.answer') },
        },
      ],
    },
  ]);
</script>

<i18n lang="json">
{
  "en": {
    "hero": {
      "title": "How It Works",
      "subtitle": "A simple, straightforward platform for buying and selling Classic Minis"
    },
    "tabs": { "buyers": "For Buyers", "sellers": "For Sellers" },
    "buyers": {
      "srTitle": "Steps for Buyers",
      "cta": "Start Browsing Listings",
      "steps": [
        {
          "title": "Browse Listings",
          "body": "Explore our collection of Classic Minis from around the world. Use filters to narrow down by model, year, location, price range, and condition.",
          "tipLabel": "Pro tip:",
          "tip": "Add listings to your watchlist to track price changes and get notified when sellers respond to your messages."
        },
        {
          "title": "View Detailed Listings",
          "body": "Each listing includes comprehensive details: full specifications, modification history, multiple photo galleries (body, engine, interior, details), and seller notes about condition and history.",
          "tipLabel": "What to look for:",
          "tip": "Check the photos carefully, read the seller's condition notes, and note any modifications or non-original parts. Ask questions if anything is unclear."
        },
        {
          "title": "Contact the Seller",
          "body": "Use our built-in messaging system to ask questions, request additional photos, or arrange a viewing. All communication stays on the platform until you're ready to connect directly.",
          "tipLabel": "Safety first:",
          "tip": "Always inspect the car in person if possible, and consider bringing a knowledgeable friend or mechanic. Never send payment before seeing the vehicle."
        },
        {
          "title": "Complete the Deal",
          "body": "Once you've inspected the Mini and agreed on terms, finalize the purchase. The seller can mark the listing as sold, and you can leave feedback about your experience.",
          "tipLabel": "After the purchase:",
          "tip": "Join the community! Share your new Mini story, ask for advice, and connect with other enthusiasts."
        }
      ]
    },
    "sellers": {
      "srTitle": "Steps for Sellers",
      "cta": "Create Your Listing",
      "steps": [
        {
          "title": "Create Your Account",
          "body": "Sign up with your email address to get started. Set up your profile with your location and a display name. Your profile helps buyers understand who they're dealing with.",
          "tipLabel": "Profile tip:",
          "tip": "A complete profile with a profile picture builds trust with potential buyers."
        },
        {
          "title": "Prepare Your Listing",
          "body": "Take high-quality photos from all angles: body exterior, engine bay, interior, undercarriage, and any special details or issues. Write a detailed description including history, modifications, condition notes, and what makes your Mini special.",
          "tipLabel": "Photo tips:",
          "tip": "Clean your Mini before photographing. Good lighting and multiple angles help buyers understand the condition. Don't hide issues — transparency builds trust."
        },
        {
          "title": "Post Your Listing",
          "body": "Fill out the listing form with all the details: year, model, mileage, price, location, and condition. Upload your photos organized by category (body, engine, interior, details). Review and publish your listing.",
          "tipLabel": "Pricing tip:",
          "tip": "Research similar Minis to set a fair price. Consider your Mini's condition, modifications, and any included extras."
        },
        {
          "title": "Respond to Inquiries",
          "body": "When buyers message you with questions, respond promptly and honestly. Be prepared to provide additional photos, answer detailed questions, and arrange viewings for serious buyers.",
          "tipLabel": "Communication tip:",
          "tip": "Quick, honest responses help close deals faster. Be upfront about any issues and set clear expectations."
        },
        {
          "title": "Close the Sale",
          "body": "Once you've found the right buyer and agreed on terms, arrange a safe meeting place for the exchange. After the sale, mark your listing as sold to let other interested buyers know.",
          "tipLabel": "Safety first:",
          "tip": "Meet in public places for viewings. Accept secure payment methods, and transfer title properly according to your local regulations."
        }
      ]
    },
    "faq": {
      "title": "Frequently Asked Questions",
      "items": [
        {
          "question": "Is The Mini Exchange free to use?",
          "answer": "Yes! Creating an account, browsing listings, and posting your own listings is completely free. We're building this platform for the Mini community."
        },
        {
          "question": "How do payments work?",
          "answer": "The Mini Exchange is a marketplace platform — we don't process payments. Buyers and sellers arrange payment and transfer directly. We recommend secure payment methods like bank transfers or escrow services for high-value transactions."
        },
        {
          "question": "What if there's a dispute with a buyer or seller?",
          "answer": "While we provide the platform for connections, transactions happen directly between buyers and sellers. We encourage transparency, thorough communication, and in-person inspections. If you encounter fraudulent activity, please report it to us immediately."
        },
        {
          "question": "Can I edit my listing after posting?",
          "answer": "Absolutely! You can edit your listing details, add or remove photos, update the price, or mark it as sold at any time from your dashboard."
        },
        {
          "question": "Do you ship Classic Minis, or help with transport?",
          "answer": "We don't provide shipping services, but many buyers and sellers arrange transport through specialized classic car shipping companies. Buyers and sellers coordinate transport and costs directly."
        },
        {
          "question": "What types of Classic Minis can I list?",
          "answer": "All Classic Minis from 1959-2000 are welcome! This includes original Minis, Cooper S models, Clubman estates, Travellers, Pickups, Vans, limited editions, and project cars. If it's a Classic Mini, it belongs here."
        },
        {
          "question": "What parts and accessories can I list?",
          "answer": "We welcome all parts and accessories that are useful to Classic Mini owners — not just original or first-party Mini parts. Aftermarket upgrades, tuning tools, gauges, performance parts, and accessories commonly used on Classic Minis are all appropriate. For example, an Innovate wideband controller you used for carb tuning absolutely belongs here. The key is relevance: if a Mini owner would find it useful, list it! We just ask that listings stay relevant to the Classic Mini community and avoid completely unrelated general automotive items."
        }
      ]
    },
    "questions": {
      "title": "Still Have Questions?",
      "body": "We're here to help. Reach out if you need assistance or have suggestions for improving the platform.",
      "button": "Contact Us"
    },
    "seo": {
      "title": "How It Works - The Mini Exchange",
      "description": "Learn how to buy and sell on The Mini Exchange. A simple guide for listing your Classic Mini, parts, or engine.",
      "ogDescription": "A simple guide to buying and selling Classic Minis, parts, and engines on The Mini Exchange."
    }
  },
  "es": {
    "hero": {
      "title": "Cómo funciona",
      "subtitle": "Una plataforma sencilla y directa para comprar y vender Classic Minis"
    },
    "tabs": { "buyers": "Para compradores", "sellers": "Para vendedores" },
    "buyers": {
      "srTitle": "Pasos para compradores",
      "cta": "Empezar a explorar anuncios",
      "steps": [
        {
          "title": "Explora los anuncios",
          "body": "Descubre nuestra colección de Classic Minis de todo el mundo. Usa los filtros para acotar por modelo, año, ubicación, rango de precio y estado.",
          "tipLabel": "Consejo:",
          "tip": "Añade anuncios a tu lista de seguimiento para controlar los cambios de precio y recibir avisos cuando los vendedores respondan a tus mensajes."
        },
        {
          "title": "Consulta los anuncios detallados",
          "body": "Cada anuncio incluye información completa: especificaciones, historial de modificaciones, varias galerías de fotos (carrocería, motor, interior, detalles) y notas del vendedor sobre el estado y la historia.",
          "tipLabel": "Qué buscar:",
          "tip": "Revisa bien las fotos, lee las notas de estado del vendedor y fíjate en cualquier modificación o pieza no original. Pregunta si algo no queda claro."
        },
        {
          "title": "Contacta con el vendedor",
          "body": "Usa nuestro sistema de mensajería integrado para hacer preguntas, pedir más fotos o concertar una visita. Toda la comunicación se mantiene en la plataforma hasta que estés listo para conectar directamente.",
          "tipLabel": "La seguridad primero:",
          "tip": "Siempre que puedas, inspecciona el coche en persona y plantéate llevar a un amigo o mecánico con conocimientos. Nunca envíes el pago antes de ver el vehículo."
        },
        {
          "title": "Cierra el trato",
          "body": "Una vez que hayas inspeccionado el Mini y acordado las condiciones, finaliza la compra. El vendedor puede marcar el anuncio como vendido y tú puedes dejar tu valoración de la experiencia.",
          "tipLabel": "Después de la compra:",
          "tip": "¡Únete a la comunidad! Comparte la historia de tu nuevo Mini, pide consejo y conecta con otros aficionados."
        }
      ]
    },
    "sellers": {
      "srTitle": "Pasos para vendedores",
      "cta": "Crea tu anuncio",
      "steps": [
        {
          "title": "Crea tu cuenta",
          "body": "Regístrate con tu correo electrónico para empezar. Configura tu perfil con tu ubicación y un nombre visible. Tu perfil ayuda a los compradores a saber con quién tratan.",
          "tipLabel": "Consejo de perfil:",
          "tip": "Un perfil completo con foto genera confianza en los posibles compradores."
        },
        {
          "title": "Prepara tu anuncio",
          "body": "Haz fotos de calidad desde todos los ángulos: exterior de la carrocería, vano motor, interior, bajos y cualquier detalle o problema especial. Escribe una descripción detallada con la historia, las modificaciones, las notas de estado y lo que hace especial a tu Mini.",
          "tipLabel": "Consejos de fotos:",
          "tip": "Limpia tu Mini antes de fotografiarlo. Una buena iluminación y varios ángulos ayudan a los compradores a entender el estado. No ocultes los problemas: la transparencia genera confianza."
        },
        {
          "title": "Publica tu anuncio",
          "body": "Rellena el formulario del anuncio con todos los datos: año, modelo, kilometraje, precio, ubicación y estado. Sube tus fotos organizadas por categoría (carrocería, motor, interior, detalles). Revisa y publica tu anuncio.",
          "tipLabel": "Consejo de precio:",
          "tip": "Investiga Minis similares para fijar un precio justo. Ten en cuenta el estado de tu Mini, sus modificaciones y cualquier extra incluido."
        },
        {
          "title": "Responde a las consultas",
          "body": "Cuando los compradores te escriban con preguntas, responde con rapidez y honestidad. Prepárate para aportar más fotos, responder preguntas detalladas y concertar visitas con los compradores serios.",
          "tipLabel": "Consejo de comunicación:",
          "tip": "Las respuestas rápidas y honestas ayudan a cerrar tratos más rápido. Sé claro sobre cualquier problema y establece expectativas claras."
        },
        {
          "title": "Cierra la venta",
          "body": "Cuando hayas encontrado al comprador adecuado y acordado las condiciones, concierta un lugar de encuentro seguro para el intercambio. Tras la venta, marca tu anuncio como vendido para avisar a otros interesados.",
          "tipLabel": "La seguridad primero:",
          "tip": "Queda en lugares públicos para las visitas. Acepta métodos de pago seguros y transfiere la titularidad correctamente según la normativa local."
        }
      ]
    },
    "faq": {
      "title": "Preguntas frecuentes",
      "items": [
        {
          "question": "¿Es gratis usar The Mini Exchange?",
          "answer": "¡Sí! Crear una cuenta, explorar anuncios y publicar los tuyos es totalmente gratis. Estamos construyendo esta plataforma para la comunidad Mini."
        },
        {
          "question": "¿Cómo funcionan los pagos?",
          "answer": "The Mini Exchange es una plataforma de mercado: no procesamos pagos. Compradores y vendedores acuerdan el pago y la transferencia directamente. Recomendamos métodos de pago seguros como transferencias bancarias o servicios de depósito en garantía para transacciones de alto valor."
        },
        {
          "question": "¿Qué pasa si hay una disputa con un comprador o vendedor?",
          "answer": "Aunque proporcionamos la plataforma para conectar, las transacciones ocurren directamente entre compradores y vendedores. Fomentamos la transparencia, una comunicación exhaustiva y las inspecciones en persona. Si detectas actividad fraudulenta, denúnciala de inmediato."
        },
        {
          "question": "¿Puedo editar mi anuncio después de publicarlo?",
          "answer": "¡Por supuesto! Puedes editar los datos de tu anuncio, añadir o quitar fotos, actualizar el precio o marcarlo como vendido en cualquier momento desde tu panel."
        },
        {
          "question": "¿Enviáis Classic Minis o ayudáis con el transporte?",
          "answer": "No ofrecemos servicios de envío, pero muchos compradores y vendedores organizan el transporte a través de empresas especializadas en clásicos. Compradores y vendedores coordinan el transporte y los costes directamente."
        },
        {
          "question": "¿Qué tipos de Classic Minis puedo anunciar?",
          "answer": "¡Todos los Classic Minis de 1959 a 2000 son bienvenidos! Esto incluye Minis originales, modelos Cooper S, familiares Clubman, Travellers, Pickups, furgonetas, ediciones limitadas y coches de proyecto. Si es un Classic Mini, tiene su sitio aquí."
        },
        {
          "question": "¿Qué piezas y accesorios puedo anunciar?",
          "answer": "Aceptamos todas las piezas y accesorios útiles para los propietarios de Classic Mini, no solo las piezas originales o de primera marca. Mejoras de posventa, herramientas de puesta a punto, relojes, piezas de rendimiento y accesorios habituales en los Classic Mini son todos apropiados. Por ejemplo, un controlador wideband de Innovate que usaste para reglar el carburador encaja perfectamente. La clave es la relevancia: si a un propietario de Mini le resulta útil, ¡anúncialo! Solo pedimos que los anuncios sigan siendo relevantes para la comunidad Classic Mini y se eviten artículos de automoción general sin ninguna relación."
        }
      ]
    },
    "questions": {
      "title": "¿Todavía tienes dudas?",
      "body": "Estamos aquí para ayudar. Escríbenos si necesitas ayuda o tienes sugerencias para mejorar la plataforma.",
      "button": "Contáctanos"
    },
    "seo": {
      "title": "Cómo funciona - The Mini Exchange",
      "description": "Aprende a comprar y vender en The Mini Exchange. Una guía sencilla para anunciar tu Classic Mini, piezas o motor.",
      "ogDescription": "Una guía sencilla para comprar y vender Classic Minis, piezas y motores en The Mini Exchange."
    }
  },
  "fr": {
    "hero": {
      "title": "Comment ça marche",
      "subtitle": "Une plateforme simple et directe pour acheter et vendre des Classic Minis"
    },
    "tabs": { "buyers": "Pour les acheteurs", "sellers": "Pour les vendeurs" },
    "buyers": {
      "srTitle": "Étapes pour les acheteurs",
      "cta": "Commencer à parcourir les annonces",
      "steps": [
        {
          "title": "Parcourez les annonces",
          "body": "Explorez notre collection de Classic Minis du monde entier. Utilisez les filtres pour affiner par modèle, année, lieu, fourchette de prix et état.",
          "tipLabel": "Astuce :",
          "tip": "Ajoutez des annonces à votre liste de suivi pour suivre les variations de prix et être averti quand les vendeurs répondent à vos messages."
        },
        {
          "title": "Consultez les annonces détaillées",
          "body": "Chaque annonce comprend des détails complets : caractéristiques, historique des modifications, plusieurs galeries de photos (carrosserie, moteur, intérieur, détails) et les notes du vendeur sur l'état et l'historique.",
          "tipLabel": "À quoi faire attention :",
          "tip": "Examinez attentivement les photos, lisez les notes d'état du vendeur et repérez les modifications ou pièces non d'origine. Posez des questions si quelque chose n'est pas clair."
        },
        {
          "title": "Contactez le vendeur",
          "body": "Utilisez notre messagerie intégrée pour poser des questions, demander des photos supplémentaires ou organiser une visite. Toute la communication reste sur la plateforme jusqu'à ce que vous soyez prêt à vous contacter directement.",
          "tipLabel": "La sécurité avant tout :",
          "tip": "Inspectez toujours la voiture en personne si possible et envisagez d'emmener un ami ou un mécanicien averti. N'envoyez jamais de paiement avant d'avoir vu le véhicule."
        },
        {
          "title": "Finalisez la transaction",
          "body": "Une fois la Mini inspectée et les conditions convenues, finalisez l'achat. Le vendeur peut marquer l'annonce comme vendue et vous pouvez laisser un avis sur votre expérience.",
          "tipLabel": "Après l'achat :",
          "tip": "Rejoignez la communauté ! Partagez l'histoire de votre nouvelle Mini, demandez des conseils et échangez avec d'autres passionnés."
        }
      ]
    },
    "sellers": {
      "srTitle": "Étapes pour les vendeurs",
      "cta": "Créez votre annonce",
      "steps": [
        {
          "title": "Créez votre compte",
          "body": "Inscrivez-vous avec votre adresse e-mail pour commencer. Configurez votre profil avec votre localisation et un nom d'affichage. Votre profil aide les acheteurs à savoir à qui ils ont affaire.",
          "tipLabel": "Astuce profil :",
          "tip": "Un profil complet avec une photo inspire confiance aux acheteurs potentiels."
        },
        {
          "title": "Préparez votre annonce",
          "body": "Prenez des photos de qualité sous tous les angles : extérieur de la carrosserie, compartiment moteur, intérieur, dessous de caisse et tout détail ou défaut particulier. Rédigez une description détaillée incluant l'historique, les modifications, les notes d'état et ce qui rend votre Mini spéciale.",
          "tipLabel": "Astuces photos :",
          "tip": "Nettoyez votre Mini avant de la photographier. Un bon éclairage et plusieurs angles aident les acheteurs à comprendre l'état. Ne cachez pas les défauts — la transparence crée la confiance."
        },
        {
          "title": "Publiez votre annonce",
          "body": "Remplissez le formulaire d'annonce avec tous les détails : année, modèle, kilométrage, prix, lieu et état. Téléchargez vos photos organisées par catégorie (carrosserie, moteur, intérieur, détails). Vérifiez et publiez votre annonce.",
          "tipLabel": "Astuce prix :",
          "tip": "Renseignez-vous sur des Minis similaires pour fixer un prix juste. Tenez compte de l'état de votre Mini, de ses modifications et des éventuels extras inclus."
        },
        {
          "title": "Répondez aux demandes",
          "body": "Lorsque les acheteurs vous écrivent avec des questions, répondez rapidement et honnêtement. Soyez prêt à fournir des photos supplémentaires, à répondre à des questions détaillées et à organiser des visites pour les acheteurs sérieux.",
          "tipLabel": "Astuce communication :",
          "tip": "Des réponses rapides et honnêtes aident à conclure plus vite. Soyez transparent sur les défauts et fixez des attentes claires."
        },
        {
          "title": "Concluez la vente",
          "body": "Une fois le bon acheteur trouvé et les conditions convenues, organisez un lieu de rencontre sûr pour l'échange. Après la vente, marquez votre annonce comme vendue pour informer les autres acheteurs intéressés.",
          "tipLabel": "La sécurité avant tout :",
          "tip": "Rencontrez-vous dans des lieux publics pour les visites. Acceptez des moyens de paiement sûrs et transférez la carte grise correctement selon la réglementation locale."
        }
      ]
    },
    "faq": {
      "title": "Foire aux questions",
      "items": [
        {
          "question": "The Mini Exchange est-il gratuit ?",
          "answer": "Oui ! Créer un compte, parcourir les annonces et publier les vôtres est entièrement gratuit. Nous construisons cette plateforme pour la communauté Mini."
        },
        {
          "question": "Comment fonctionnent les paiements ?",
          "answer": "The Mini Exchange est une plateforme de petites annonces — nous ne traitons pas les paiements. Acheteurs et vendeurs organisent le paiement et le transfert directement. Nous recommandons des moyens de paiement sûrs comme les virements bancaires ou les services d'entiercement pour les transactions de grande valeur."
        },
        {
          "question": "Que faire en cas de litige avec un acheteur ou un vendeur ?",
          "answer": "Bien que nous fournissions la plateforme de mise en relation, les transactions se font directement entre acheteurs et vendeurs. Nous encourageons la transparence, une communication approfondie et les inspections en personne. Si vous constatez une activité frauduleuse, signalez-la-nous immédiatement."
        },
        {
          "question": "Puis-je modifier mon annonce après publication ?",
          "answer": "Absolument ! Vous pouvez modifier les détails de votre annonce, ajouter ou supprimer des photos, mettre à jour le prix ou la marquer comme vendue à tout moment depuis votre tableau de bord."
        },
        {
          "question": "Expédiez-vous les Classic Minis ou aidez-vous au transport ?",
          "answer": "Nous ne proposons pas de service d'expédition, mais de nombreux acheteurs et vendeurs organisent le transport via des entreprises spécialisées dans les voitures de collection. Acheteurs et vendeurs coordonnent le transport et les coûts directement."
        },
        {
          "question": "Quels types de Classic Minis puis-je publier ?",
          "answer": "Toutes les Classic Minis de 1959 à 2000 sont les bienvenues ! Cela inclut les Minis d'origine, les modèles Cooper S, les breaks Clubman, les Travellers, les Pickups, les fourgonnettes, les éditions limitées et les voitures à restaurer. Si c'est une Classic Mini, elle a sa place ici."
        },
        {
          "question": "Quelles pièces et accessoires puis-je publier ?",
          "answer": "Nous acceptons toutes les pièces et accessoires utiles aux propriétaires de Classic Mini — pas seulement les pièces d'origine ou de première monte. Les améliorations de seconde monte, les outils de réglage, les jauges, les pièces de performance et les accessoires couramment utilisés sur les Classic Minis sont tous appropriés. Par exemple, un contrôleur wideband Innovate utilisé pour le réglage du carburateur a tout à fait sa place ici. L'essentiel est la pertinence : si un propriétaire de Mini le trouve utile, publiez-le ! Nous demandons simplement que les annonces restent pertinentes pour la communauté Classic Mini et évitent les articles automobiles généraux totalement sans rapport."
        }
      ]
    },
    "questions": {
      "title": "Encore des questions ?",
      "body": "Nous sommes là pour vous aider. Contactez-nous si vous avez besoin d'aide ou des suggestions pour améliorer la plateforme.",
      "button": "Nous contacter"
    },
    "seo": {
      "title": "Comment ça marche - The Mini Exchange",
      "description": "Découvrez comment acheter et vendre sur The Mini Exchange. Un guide simple pour publier votre Classic Mini, vos pièces ou votre moteur.",
      "ogDescription": "Un guide simple pour acheter et vendre des Classic Minis, des pièces et des moteurs sur The Mini Exchange."
    }
  },
  "de": {
    "hero": {
      "title": "So funktioniert es",
      "subtitle": "Eine einfache, unkomplizierte Plattform zum Kauf und Verkauf von Classic Minis"
    },
    "tabs": { "buyers": "Für Käufer", "sellers": "Für Verkäufer" },
    "buyers": {
      "srTitle": "Schritte für Käufer",
      "cta": "Inserate durchstöbern",
      "steps": [
        {
          "title": "Inserate durchstöbern",
          "body": "Entdecke unsere Sammlung von Classic Minis aus aller Welt. Nutze Filter, um nach Modell, Baujahr, Standort, Preisspanne und Zustand einzugrenzen.",
          "tipLabel": "Profi-Tipp:",
          "tip": "Füge Inserate zu deiner Merkliste hinzu, um Preisänderungen zu verfolgen und benachrichtigt zu werden, wenn Verkäufer auf deine Nachrichten antworten."
        },
        {
          "title": "Detaillierte Inserate ansehen",
          "body": "Jedes Inserat enthält umfassende Details: vollständige Spezifikationen, Umbauhistorie, mehrere Fotogalerien (Karosserie, Motor, Innenraum, Details) und Verkäufernotizen zu Zustand und Historie.",
          "tipLabel": "Worauf du achten solltest:",
          "tip": "Sieh dir die Fotos genau an, lies die Zustandsnotizen des Verkäufers und achte auf Umbauten oder nicht originale Teile. Frag nach, wenn etwas unklar ist."
        },
        {
          "title": "Kontaktiere den Verkäufer",
          "body": "Nutze unser integriertes Nachrichtensystem, um Fragen zu stellen, weitere Fotos anzufordern oder eine Besichtigung zu vereinbaren. Die gesamte Kommunikation bleibt auf der Plattform, bis du bereit bist, dich direkt zu vernetzen.",
          "tipLabel": "Sicherheit zuerst:",
          "tip": "Besichtige das Auto nach Möglichkeit immer persönlich und nimm am besten einen sachkundigen Freund oder Mechaniker mit. Schicke niemals Geld, bevor du das Fahrzeug gesehen hast."
        },
        {
          "title": "Geschäft abschließen",
          "body": "Sobald du den Mini besichtigt und die Konditionen vereinbart hast, schließe den Kauf ab. Der Verkäufer kann das Inserat als verkauft markieren und du kannst eine Bewertung zu deiner Erfahrung hinterlassen.",
          "tipLabel": "Nach dem Kauf:",
          "tip": "Werde Teil der Community! Teile die Geschichte deines neuen Minis, bitte um Rat und vernetze dich mit anderen Enthusiasten."
        }
      ]
    },
    "sellers": {
      "srTitle": "Schritte für Verkäufer",
      "cta": "Inserat erstellen",
      "steps": [
        {
          "title": "Konto erstellen",
          "body": "Registriere dich mit deiner E-Mail-Adresse, um loszulegen. Richte dein Profil mit deinem Standort und einem Anzeigenamen ein. Dein Profil hilft Käufern zu verstehen, mit wem sie es zu tun haben.",
          "tipLabel": "Profil-Tipp:",
          "tip": "Ein vollständiges Profil mit Profilbild schafft Vertrauen bei potenziellen Käufern."
        },
        {
          "title": "Inserat vorbereiten",
          "body": "Mach hochwertige Fotos aus allen Blickwinkeln: Karosserie außen, Motorraum, Innenraum, Unterboden und besondere Details oder Mängel. Schreibe eine ausführliche Beschreibung mit Historie, Umbauten, Zustandsnotizen und dem, was deinen Mini besonders macht.",
          "tipLabel": "Foto-Tipps:",
          "tip": "Reinige deinen Mini vor dem Fotografieren. Gute Beleuchtung und mehrere Blickwinkel helfen Käufern, den Zustand zu verstehen. Verschweige keine Mängel — Transparenz schafft Vertrauen."
        },
        {
          "title": "Inserat veröffentlichen",
          "body": "Fülle das Inseratsformular mit allen Angaben aus: Baujahr, Modell, Laufleistung, Preis, Standort und Zustand. Lade deine Fotos nach Kategorie geordnet hoch (Karosserie, Motor, Innenraum, Details). Prüfe dein Inserat und veröffentliche es.",
          "tipLabel": "Preis-Tipp:",
          "tip": "Recherchiere ähnliche Minis, um einen fairen Preis festzulegen. Berücksichtige den Zustand deines Minis, seine Umbauten und alle enthaltenen Extras."
        },
        {
          "title": "Auf Anfragen antworten",
          "body": "Wenn Käufer dir Fragen schicken, antworte zügig und ehrlich. Sei bereit, weitere Fotos zu liefern, detaillierte Fragen zu beantworten und Besichtigungen mit ernsthaften Käufern zu vereinbaren.",
          "tipLabel": "Kommunikations-Tipp:",
          "tip": "Schnelle, ehrliche Antworten helfen, schneller abzuschließen. Sei offen über Mängel und setze klare Erwartungen."
        },
        {
          "title": "Verkauf abschließen",
          "body": "Sobald du den richtigen Käufer gefunden und die Konditionen vereinbart hast, vereinbare einen sicheren Treffpunkt für die Übergabe. Markiere dein Inserat nach dem Verkauf als verkauft, um andere Interessenten zu informieren.",
          "tipLabel": "Sicherheit zuerst:",
          "tip": "Triff dich für Besichtigungen an öffentlichen Orten. Akzeptiere sichere Zahlungsmethoden und übertrage die Zulassung ordnungsgemäß gemäß den örtlichen Vorschriften."
        }
      ]
    },
    "faq": {
      "title": "Häufig gestellte Fragen",
      "items": [
        {
          "question": "Ist The Mini Exchange kostenlos nutzbar?",
          "answer": "Ja! Ein Konto erstellen, Inserate durchstöbern und eigene Inserate veröffentlichen ist völlig kostenlos. Wir bauen diese Plattform für die Mini-Community."
        },
        {
          "question": "Wie funktionieren Zahlungen?",
          "answer": "The Mini Exchange ist eine Marktplatzplattform — wir wickeln keine Zahlungen ab. Käufer und Verkäufer regeln Zahlung und Übergabe direkt. Wir empfehlen sichere Zahlungsmethoden wie Banküberweisungen oder Treuhanddienste für hochwertige Transaktionen."
        },
        {
          "question": "Was passiert bei einer Streitigkeit mit einem Käufer oder Verkäufer?",
          "answer": "Wir stellen die Plattform für die Kontaktaufnahme bereit, doch die Transaktionen finden direkt zwischen Käufern und Verkäufern statt. Wir empfehlen Transparenz, gründliche Kommunikation und Besichtigungen vor Ort. Wenn du auf betrügerische Aktivitäten stößt, melde sie uns bitte sofort."
        },
        {
          "question": "Kann ich mein Inserat nach der Veröffentlichung bearbeiten?",
          "answer": "Auf jeden Fall! Du kannst die Details deines Inserats bearbeiten, Fotos hinzufügen oder entfernen, den Preis aktualisieren oder es jederzeit über dein Dashboard als verkauft markieren."
        },
        {
          "question": "Versendet ihr Classic Minis oder helft beim Transport?",
          "answer": "Wir bieten keine Versanddienste an, aber viele Käufer und Verkäufer organisieren den Transport über spezialisierte Oldtimer-Speditionen. Käufer und Verkäufer koordinieren Transport und Kosten direkt."
        },
        {
          "question": "Welche Arten von Classic Minis kann ich inserieren?",
          "answer": "Alle Classic Minis von 1959 bis 2000 sind willkommen! Dazu gehören originale Minis, Cooper-S-Modelle, Clubman-Kombis, Travellers, Pickups, Lieferwagen, Sondereditionen und Projektfahrzeuge. Wenn es ein Classic Mini ist, gehört er hierher."
        },
        {
          "question": "Welche Teile und Zubehör kann ich inserieren?",
          "answer": "Wir nehmen alle Teile und Zubehörteile an, die für Classic-Mini-Besitzer nützlich sind — nicht nur originale oder Erstausrüsterteile. Nachrüstverbesserungen, Abstimmwerkzeuge, Instrumente, Performance-Teile und bei Classic Minis übliches Zubehör sind alle passend. Zum Beispiel gehört ein Innovate-Breitband-Controller, den du zur Vergaserabstimmung verwendet hast, absolut hierher. Entscheidend ist die Relevanz: Wenn ein Mini-Besitzer es nützlich findet, inseriere es! Wir bitten nur darum, dass Inserate für die Classic-Mini-Community relevant bleiben und völlig themenfremde allgemeine Kfz-Artikel vermieden werden."
        }
      ]
    },
    "questions": {
      "title": "Noch Fragen?",
      "body": "Wir helfen gern. Melde dich, wenn du Unterstützung brauchst oder Vorschläge zur Verbesserung der Plattform hast.",
      "button": "Kontaktiere uns"
    },
    "seo": {
      "title": "So funktioniert es - The Mini Exchange",
      "description": "Erfahre, wie du bei The Mini Exchange kaufst und verkaufst. Eine einfache Anleitung zum Inserieren deines Classic Mini, deiner Teile oder deines Motors.",
      "ogDescription": "Eine einfache Anleitung zum Kauf und Verkauf von Classic Minis, Teilen und Motoren bei The Mini Exchange."
    }
  },
  "it": {
    "hero": {
      "title": "Come funziona",
      "subtitle": "Una piattaforma semplice e diretta per comprare e vendere Classic Mini"
    },
    "tabs": { "buyers": "Per chi compra", "sellers": "Per chi vende" },
    "buyers": {
      "srTitle": "Passaggi per chi compra",
      "cta": "Inizia a sfogliare gli annunci",
      "steps": [
        {
          "title": "Sfoglia gli annunci",
          "body": "Esplora la nostra collezione di Classic Mini da tutto il mondo. Usa i filtri per restringere per modello, anno, località, fascia di prezzo e condizioni.",
          "tipLabel": "Consiglio:",
          "tip": "Aggiungi gli annunci alla tua lista di osservati per monitorare le variazioni di prezzo ed essere avvisato quando i venditori rispondono ai tuoi messaggi."
        },
        {
          "title": "Visualizza gli annunci dettagliati",
          "body": "Ogni annuncio include dettagli completi: specifiche complete, storico delle modifiche, più gallerie di foto (carrozzeria, motore, interni, dettagli) e note del venditore su condizioni e storia.",
          "tipLabel": "Cosa controllare:",
          "tip": "Esamina con attenzione le foto, leggi le note sulle condizioni del venditore e nota eventuali modifiche o parti non originali. Fai domande se qualcosa non è chiaro."
        },
        {
          "title": "Contatta il venditore",
          "body": "Usa il nostro sistema di messaggistica integrato per fare domande, richiedere altre foto o organizzare una visione. Tutta la comunicazione resta sulla piattaforma finché non sei pronto a metterti in contatto direttamente.",
          "tipLabel": "Prima la sicurezza:",
          "tip": "Quando possibile, ispeziona sempre l'auto di persona e valuta di portare con te un amico o un meccanico esperto. Non inviare mai il pagamento prima di vedere il veicolo."
        },
        {
          "title": "Concludi l'affare",
          "body": "Dopo aver ispezionato la Mini e concordato le condizioni, finalizza l'acquisto. Il venditore può contrassegnare l'annuncio come venduto e tu puoi lasciare un giudizio sulla tua esperienza.",
          "tipLabel": "Dopo l'acquisto:",
          "tip": "Unisciti alla community! Condividi la storia della tua nuova Mini, chiedi consigli e connettiti con altri appassionati."
        }
      ]
    },
    "sellers": {
      "srTitle": "Passaggi per chi vende",
      "cta": "Crea il tuo annuncio",
      "steps": [
        {
          "title": "Crea il tuo account",
          "body": "Registrati con il tuo indirizzo email per iniziare. Configura il tuo profilo con la località e un nome visualizzato. Il tuo profilo aiuta gli acquirenti a capire con chi hanno a che fare.",
          "tipLabel": "Consiglio sul profilo:",
          "tip": "Un profilo completo con foto crea fiducia nei potenziali acquirenti."
        },
        {
          "title": "Prepara il tuo annuncio",
          "body": "Scatta foto di qualità da tutte le angolazioni: esterno della carrozzeria, vano motore, interni, sottoscocca ed eventuali dettagli o difetti particolari. Scrivi una descrizione dettagliata con storia, modifiche, note sulle condizioni e ciò che rende speciale la tua Mini.",
          "tipLabel": "Consigli sulle foto:",
          "tip": "Pulisci la tua Mini prima di fotografarla. Una buona illuminazione e più angolazioni aiutano gli acquirenti a capire le condizioni. Non nascondere i difetti: la trasparenza crea fiducia."
        },
        {
          "title": "Pubblica il tuo annuncio",
          "body": "Compila il modulo dell'annuncio con tutti i dettagli: anno, modello, chilometraggio, prezzo, località e condizioni. Carica le tue foto organizzate per categoria (carrozzeria, motore, interni, dettagli). Controlla e pubblica il tuo annuncio.",
          "tipLabel": "Consiglio sul prezzo:",
          "tip": "Informati su Mini simili per fissare un prezzo equo. Considera le condizioni della tua Mini, le modifiche ed eventuali extra inclusi."
        },
        {
          "title": "Rispondi alle richieste",
          "body": "Quando gli acquirenti ti scrivono con domande, rispondi prontamente e con onestà. Sii pronto a fornire altre foto, rispondere a domande dettagliate e organizzare visioni per gli acquirenti seri.",
          "tipLabel": "Consiglio sulla comunicazione:",
          "tip": "Risposte rapide e oneste aiutano a chiudere prima gli affari. Sii trasparente sui difetti e stabilisci aspettative chiare."
        },
        {
          "title": "Concludi la vendita",
          "body": "Quando hai trovato l'acquirente giusto e concordato le condizioni, organizza un luogo d'incontro sicuro per lo scambio. Dopo la vendita, contrassegna il tuo annuncio come venduto per avvisare gli altri acquirenti interessati.",
          "tipLabel": "Prima la sicurezza:",
          "tip": "Incontratevi in luoghi pubblici per le visioni. Accetta metodi di pagamento sicuri e trasferisci il libretto correttamente secondo le normative locali."
        }
      ]
    },
    "faq": {
      "title": "Domande frequenti",
      "items": [
        {
          "question": "The Mini Exchange è gratuito?",
          "answer": "Sì! Creare un account, sfogliare gli annunci e pubblicare i propri è completamente gratuito. Stiamo costruendo questa piattaforma per la community Mini."
        },
        {
          "question": "Come funzionano i pagamenti?",
          "answer": "The Mini Exchange è una piattaforma di annunci — non elaboriamo pagamenti. Acquirenti e venditori organizzano pagamento e trasferimento direttamente. Consigliamo metodi di pagamento sicuri come bonifici bancari o servizi di deposito a garanzia per le transazioni di alto valore."
        },
        {
          "question": "Cosa succede in caso di controversia con un acquirente o venditore?",
          "answer": "Pur fornendo la piattaforma per i contatti, le transazioni avvengono direttamente tra acquirenti e venditori. Incoraggiamo la trasparenza, una comunicazione approfondita e le ispezioni di persona. Se riscontri attività fraudolente, segnalacele immediatamente."
        },
        {
          "question": "Posso modificare il mio annuncio dopo la pubblicazione?",
          "answer": "Assolutamente! Puoi modificare i dettagli dell'annuncio, aggiungere o rimuovere foto, aggiornare il prezzo o contrassegnarlo come venduto in qualsiasi momento dalla tua dashboard."
        },
        {
          "question": "Spedite le Classic Mini o aiutate con il trasporto?",
          "answer": "Non forniamo servizi di spedizione, ma molti acquirenti e venditori organizzano il trasporto tramite aziende specializzate nelle auto d'epoca. Acquirenti e venditori coordinano trasporto e costi direttamente."
        },
        {
          "question": "Quali tipi di Classic Mini posso pubblicare?",
          "answer": "Tutte le Classic Mini dal 1959 al 2000 sono benvenute! Questo include Mini originali, modelli Cooper S, station wagon Clubman, Traveller, Pickup, furgoni, edizioni limitate e auto da restaurare. Se è una Classic Mini, il suo posto è qui."
        },
        {
          "question": "Quali ricambi e accessori posso pubblicare?",
          "answer": "Accettiamo tutti i ricambi e gli accessori utili ai proprietari di Classic Mini — non solo i pezzi originali o di primo equipaggiamento. Upgrade aftermarket, strumenti di messa a punto, strumentazione, parti per prestazioni e accessori comunemente usati sulle Classic Mini sono tutti appropriati. Per esempio, un controller wideband Innovate usato per la regolazione del carburatore ci sta benissimo. La chiave è la pertinenza: se un proprietario di Mini lo trova utile, pubblicalo! Chiediamo solo che gli annunci restino pertinenti alla community Classic Mini ed evitino articoli automobilistici generici completamente estranei."
        }
      ]
    },
    "questions": {
      "title": "Hai ancora domande?",
      "body": "Siamo qui per aiutarti. Contattaci se hai bisogno di assistenza o hai suggerimenti per migliorare la piattaforma.",
      "button": "Contattaci"
    },
    "seo": {
      "title": "Come funziona - The Mini Exchange",
      "description": "Scopri come comprare e vendere su The Mini Exchange. Una guida semplice per pubblicare la tua Classic Mini, i ricambi o il motore.",
      "ogDescription": "Una guida semplice per comprare e vendere Classic Mini, ricambi e motori su The Mini Exchange."
    }
  },
  "pt": {
    "hero": {
      "title": "Como funciona",
      "subtitle": "Uma plataforma simples e direta para comprar e vender Classic Minis"
    },
    "tabs": { "buyers": "Para compradores", "sellers": "Para vendedores" },
    "buyers": {
      "srTitle": "Passos para compradores",
      "cta": "Começar a explorar anúncios",
      "steps": [
        {
          "title": "Explore os anúncios",
          "body": "Conheça nossa coleção de Classic Minis de todo o mundo. Use os filtros para refinar por modelo, ano, localização, faixa de preço e estado.",
          "tipLabel": "Dica:",
          "tip": "Adicione anúncios à sua lista de observação para acompanhar mudanças de preço e ser avisado quando os vendedores responderem às suas mensagens."
        },
        {
          "title": "Veja os anúncios detalhados",
          "body": "Cada anúncio inclui detalhes completos: especificações completas, histórico de modificações, várias galerias de fotos (carroceria, motor, interior, detalhes) e notas do vendedor sobre estado e história.",
          "tipLabel": "O que observar:",
          "tip": "Verifique as fotos com cuidado, leia as notas de estado do vendedor e observe quaisquer modificações ou peças não originais. Faça perguntas se algo não estiver claro."
        },
        {
          "title": "Entre em contato com o vendedor",
          "body": "Use nosso sistema de mensagens integrado para tirar dúvidas, pedir mais fotos ou marcar uma visita. Toda a comunicação fica na plataforma até você estar pronto para se conectar diretamente.",
          "tipLabel": "Segurança em primeiro lugar:",
          "tip": "Sempre que possível, inspecione o carro pessoalmente e considere levar um amigo ou mecânico experiente. Nunca envie pagamento antes de ver o veículo."
        },
        {
          "title": "Conclua o negócio",
          "body": "Depois de inspecionar o Mini e acertar os termos, finalize a compra. O vendedor pode marcar o anúncio como vendido e você pode deixar uma avaliação sobre sua experiência.",
          "tipLabel": "Após a compra:",
          "tip": "Junte-se à comunidade! Compartilhe a história do seu novo Mini, peça conselhos e conecte-se com outros entusiastas."
        }
      ]
    },
    "sellers": {
      "srTitle": "Passos para vendedores",
      "cta": "Crie seu anúncio",
      "steps": [
        {
          "title": "Crie sua conta",
          "body": "Cadastre-se com seu e-mail para começar. Configure seu perfil com sua localização e um nome de exibição. Seu perfil ajuda os compradores a entender com quem estão lidando.",
          "tipLabel": "Dica de perfil:",
          "tip": "Um perfil completo com foto gera confiança nos compradores em potencial."
        },
        {
          "title": "Prepare seu anúncio",
          "body": "Tire fotos de qualidade de todos os ângulos: exterior da carroceria, compartimento do motor, interior, parte inferior e quaisquer detalhes ou problemas especiais. Escreva uma descrição detalhada incluindo histórico, modificações, notas de estado e o que torna seu Mini especial.",
          "tipLabel": "Dicas de fotos:",
          "tip": "Limpe seu Mini antes de fotografar. Boa iluminação e vários ângulos ajudam os compradores a entender o estado. Não esconda problemas — a transparência gera confiança."
        },
        {
          "title": "Publique seu anúncio",
          "body": "Preencha o formulário do anúncio com todos os detalhes: ano, modelo, quilometragem, preço, localização e estado. Envie suas fotos organizadas por categoria (carroceria, motor, interior, detalhes). Revise e publique seu anúncio.",
          "tipLabel": "Dica de preço:",
          "tip": "Pesquise Minis semelhantes para definir um preço justo. Considere o estado do seu Mini, as modificações e quaisquer extras incluídos."
        },
        {
          "title": "Responda às consultas",
          "body": "Quando os compradores enviarem perguntas, responda com rapidez e honestidade. Esteja preparado para fornecer mais fotos, responder perguntas detalhadas e marcar visitas para compradores sérios.",
          "tipLabel": "Dica de comunicação:",
          "tip": "Respostas rápidas e honestas ajudam a fechar negócios mais depressa. Seja transparente sobre quaisquer problemas e estabeleça expectativas claras."
        },
        {
          "title": "Feche a venda",
          "body": "Depois de encontrar o comprador certo e acertar os termos, combine um local de encontro seguro para a troca. Após a venda, marque seu anúncio como vendido para avisar outros compradores interessados.",
          "tipLabel": "Segurança em primeiro lugar:",
          "tip": "Encontrem-se em locais públicos para as visitas. Aceite métodos de pagamento seguros e transfira a documentação corretamente de acordo com as normas locais."
        }
      ]
    },
    "faq": {
      "title": "Perguntas frequentes",
      "items": [
        {
          "question": "O The Mini Exchange é gratuito?",
          "answer": "Sim! Criar uma conta, explorar anúncios e publicar os seus é totalmente gratuito. Estamos construindo esta plataforma para a comunidade Mini."
        },
        {
          "question": "Como funcionam os pagamentos?",
          "answer": "O The Mini Exchange é uma plataforma de anúncios — não processamos pagamentos. Compradores e vendedores combinam pagamento e transferência diretamente. Recomendamos métodos de pagamento seguros, como transferências bancárias ou serviços de custódia, para transações de alto valor."
        },
        {
          "question": "E se houver uma disputa com um comprador ou vendedor?",
          "answer": "Embora forneçamos a plataforma para conexões, as transações acontecem diretamente entre compradores e vendedores. Incentivamos a transparência, a comunicação completa e as inspeções presenciais. Se você encontrar atividade fraudulenta, denuncie a nós imediatamente."
        },
        {
          "question": "Posso editar meu anúncio depois de publicar?",
          "answer": "Com certeza! Você pode editar os detalhes do anúncio, adicionar ou remover fotos, atualizar o preço ou marcá-lo como vendido a qualquer momento no seu painel."
        },
        {
          "question": "Vocês enviam Classic Minis ou ajudam com o transporte?",
          "answer": "Não oferecemos serviços de envio, mas muitos compradores e vendedores organizam o transporte por meio de empresas especializadas em carros clássicos. Compradores e vendedores coordenam transporte e custos diretamente."
        },
        {
          "question": "Que tipos de Classic Minis posso anunciar?",
          "answer": "Todos os Classic Minis de 1959 a 2000 são bem-vindos! Isso inclui Minis originais, modelos Cooper S, peruas Clubman, Travellers, Pickups, vans, edições limitadas e carros de projeto. Se é um Classic Mini, o lugar dele é aqui."
        },
        {
          "question": "Que peças e acessórios posso anunciar?",
          "answer": "Aceitamos todas as peças e acessórios úteis aos donos de Classic Mini — não apenas peças originais ou de primeira linha. Upgrades de reposição, ferramentas de acerto, instrumentos, peças de desempenho e acessórios comumente usados em Classic Minis são todos apropriados. Por exemplo, um controlador wideband Innovate que você usou para acertar o carburador cabe perfeitamente aqui. O importante é a relevância: se um dono de Mini achar útil, anuncie! Pedimos apenas que os anúncios sejam relevantes para a comunidade Classic Mini e evitem itens automotivos gerais totalmente sem relação."
        }
      ]
    },
    "questions": {
      "title": "Ainda tem dúvidas?",
      "body": "Estamos aqui para ajudar. Fale conosco se precisar de ajuda ou tiver sugestões para melhorar a plataforma.",
      "button": "Fale conosco"
    },
    "seo": {
      "title": "Como funciona - The Mini Exchange",
      "description": "Saiba como comprar e vender no The Mini Exchange. Um guia simples para anunciar seu Classic Mini, peças ou motor.",
      "ogDescription": "Um guia simples para comprar e vender Classic Minis, peças e motores no The Mini Exchange."
    }
  },
  "ru": {
    "hero": {
      "title": "Как это работает",
      "subtitle": "Простая и понятная площадка для покупки и продажи Classic Mini"
    },
    "tabs": { "buyers": "Для покупателей", "sellers": "Для продавцов" },
    "buyers": {
      "srTitle": "Шаги для покупателей",
      "cta": "Начать просмотр объявлений",
      "steps": [
        {
          "title": "Просматривайте объявления",
          "body": "Изучайте нашу подборку Classic Mini со всего мира. Используйте фильтры, чтобы сузить выбор по модели, году, местоположению, диапазону цен и состоянию.",
          "tipLabel": "Совет:",
          "tip": "Добавляйте объявления в список отслеживания, чтобы следить за изменением цен и получать уведомления, когда продавцы отвечают на ваши сообщения."
        },
        {
          "title": "Изучайте подробные объявления",
          "body": "Каждое объявление содержит исчерпывающую информацию: полные характеристики, историю доработок, несколько фотогалерей (кузов, двигатель, салон, детали) и заметки продавца о состоянии и истории.",
          "tipLabel": "На что обратить внимание:",
          "tip": "Внимательно изучите фотографии, прочитайте заметки продавца о состоянии и отметьте любые доработки или неоригинальные детали. Задавайте вопросы, если что-то неясно."
        },
        {
          "title": "Свяжитесь с продавцом",
          "body": "Используйте встроенную систему сообщений, чтобы задать вопросы, запросить дополнительные фотографии или договориться об осмотре. Всё общение остаётся на площадке, пока вы не будете готовы связаться напрямую.",
          "tipLabel": "Безопасность прежде всего:",
          "tip": "По возможности всегда осматривайте машину лично и подумайте о том, чтобы взять с собой знающего друга или механика. Никогда не отправляйте оплату до осмотра автомобиля."
        },
        {
          "title": "Завершите сделку",
          "body": "Осмотрев Mini и согласовав условия, завершите покупку. Продавец может отметить объявление как проданное, а вы — оставить отзыв о своём опыте.",
          "tipLabel": "После покупки:",
          "tip": "Присоединяйтесь к сообществу! Поделитесь историей своего нового Mini, попросите совета и познакомьтесь с другими энтузиастами."
        }
      ]
    },
    "sellers": {
      "srTitle": "Шаги для продавцов",
      "cta": "Создать объявление",
      "steps": [
        {
          "title": "Создайте аккаунт",
          "body": "Зарегистрируйтесь по электронной почте, чтобы начать. Заполните профиль с указанием местоположения и отображаемого имени. Профиль помогает покупателям понять, с кем они имеют дело.",
          "tipLabel": "Совет по профилю:",
          "tip": "Полный профиль с фотографией вызывает доверие у потенциальных покупателей."
        },
        {
          "title": "Подготовьте объявление",
          "body": "Сделайте качественные фотографии со всех ракурсов: кузов снаружи, моторный отсек, салон, днище и любые особые детали или дефекты. Напишите подробное описание с историей, доработками, заметками о состоянии и тем, что делает ваш Mini особенным.",
          "tipLabel": "Советы по фото:",
          "tip": "Помойте Mini перед съёмкой. Хорошее освещение и несколько ракурсов помогают покупателям понять состояние. Не скрывайте дефекты — открытость вызывает доверие."
        },
        {
          "title": "Опубликуйте объявление",
          "body": "Заполните форму объявления всеми данными: год, модель, пробег, цена, местоположение и состояние. Загрузите фотографии, сгруппированные по категориям (кузов, двигатель, салон, детали). Проверьте и опубликуйте объявление.",
          "tipLabel": "Совет по цене:",
          "tip": "Изучите похожие Mini, чтобы назначить справедливую цену. Учитывайте состояние своего Mini, доработки и любые входящие в комплект дополнения."
        },
        {
          "title": "Отвечайте на запросы",
          "body": "Когда покупатели пишут вам с вопросами, отвечайте быстро и честно. Будьте готовы предоставить дополнительные фото, ответить на подробные вопросы и организовать осмотр для серьёзных покупателей.",
          "tipLabel": "Совет по общению:",
          "tip": "Быстрые и честные ответы помогают быстрее закрывать сделки. Честно сообщайте о дефектах и задавайте ясные ожидания."
        },
        {
          "title": "Завершите продажу",
          "body": "Найдя подходящего покупателя и согласовав условия, договоритесь о безопасном месте встречи для передачи. После продажи отметьте объявление как проданное, чтобы оповестить других заинтересованных покупателей.",
          "tipLabel": "Безопасность прежде всего:",
          "tip": "Для осмотров встречайтесь в общественных местах. Принимайте безопасные способы оплаты и оформляйте переоформление надлежащим образом в соответствии с местными правилами."
        }
      ]
    },
    "faq": {
      "title": "Часто задаваемые вопросы",
      "items": [
        {
          "question": "Пользоваться The Mini Exchange бесплатно?",
          "answer": "Да! Создание аккаунта, просмотр объявлений и публикация собственных объявлений полностью бесплатны. Мы создаём эту площадку для сообщества Mini."
        },
        {
          "question": "Как работают платежи?",
          "answer": "The Mini Exchange — это площадка-маркетплейс: мы не обрабатываем платежи. Покупатели и продавцы договариваются об оплате и передаче напрямую. Для дорогих сделок мы рекомендуем безопасные способы оплаты, например банковские переводы или эскроу-сервисы."
        },
        {
          "question": "Что делать при споре с покупателем или продавцом?",
          "answer": "Мы предоставляем площадку для контактов, но сделки происходят напрямую между покупателями и продавцами. Мы призываем к прозрачности, тщательному общению и личным осмотрам. Если вы столкнулись с мошеннической деятельностью, немедленно сообщите нам об этом."
        },
        {
          "question": "Можно ли редактировать объявление после публикации?",
          "answer": "Конечно! Вы можете в любое время изменить данные объявления, добавить или удалить фотографии, обновить цену или отметить его как проданное в своей панели управления."
        },
        {
          "question": "Доставляете ли вы Classic Mini или помогаете с перевозкой?",
          "answer": "Мы не предоставляем услуги доставки, но многие покупатели и продавцы организуют перевозку через специализированные компании по транспортировке классических автомобилей. Покупатели и продавцы согласовывают перевозку и расходы напрямую."
        },
        {
          "question": "Какие типы Classic Mini можно размещать?",
          "answer": "Приветствуются все Classic Mini с 1959 по 2000 год! Это включает оригинальные Mini, модели Cooper S, универсалы Clubman, Traveller, пикапы, фургоны, ограниченные серии и проектные автомобили. Если это Classic Mini, ему здесь самое место."
        },
        {
          "question": "Какие детали и аксессуары можно размещать?",
          "answer": "Мы принимаем все детали и аксессуары, полезные владельцам Classic Mini, — не только оригинальные или заводские детали Mini. Доработки сторонних производителей, инструменты для настройки, приборы, тюнинговые детали и аксессуары, широко используемые на Classic Mini, — всё это уместно. Например, широкополосный контроллер Innovate, который вы использовали для настройки карбюратора, безусловно, сюда подходит. Главное — это уместность: если владельцу Mini это будет полезно, размещайте! Мы лишь просим, чтобы объявления оставались актуальными для сообщества Classic Mini и избегали совершенно не связанных с темой общеавтомобильных товаров."
        }
      ]
    },
    "questions": {
      "title": "Остались вопросы?",
      "body": "Мы готовы помочь. Свяжитесь с нами, если вам нужна помощь или есть предложения по улучшению площадки.",
      "button": "Связаться с нами"
    },
    "seo": {
      "title": "Как это работает - The Mini Exchange",
      "description": "Узнайте, как покупать и продавать на The Mini Exchange. Простое руководство по размещению вашего Classic Mini, запчастей или двигателя.",
      "ogDescription": "Простое руководство по покупке и продаже Classic Mini, запчастей и двигателей на The Mini Exchange."
    }
  },
  "ja": {
    "hero": {
      "title": "ご利用の流れ",
      "subtitle": "Classic Mini を売買するためのシンプルで分かりやすいプラットフォーム"
    },
    "tabs": { "buyers": "購入する方へ", "sellers": "販売する方へ" },
    "buyers": {
      "srTitle": "購入の手順",
      "cta": "出品を見てみる",
      "steps": [
        {
          "title": "出品を探す",
          "body": "世界中の Classic Mini のコレクションを探せます。フィルターを使って、モデル、年式、地域、価格帯、状態で絞り込めます。",
          "tipLabel": "ワンポイント：",
          "tip": "出品をウォッチリストに追加すると、価格の変動を追跡でき、出品者がメッセージに返信した際に通知を受け取れます。"
        },
        {
          "title": "詳細な出品を見る",
          "body": "各出品には充実した情報が含まれます。詳細なスペック、改造履歴、複数の写真ギャラリー（ボディ、エンジン、内装、ディテール）、状態や履歴に関する出品者のメモなどです。",
          "tipLabel": "確認すべき点：",
          "tip": "写真をよく確認し、出品者の状態メモを読み、改造や非純正部品に注意しましょう。不明な点があれば質問してください。"
        },
        {
          "title": "出品者に連絡する",
          "body": "組み込みのメッセージ機能を使って質問したり、追加の写真を依頼したり、現車確認の日程を調整したりできます。直接やり取りする準備ができるまで、すべての連絡はプラットフォーム上に残ります。",
          "tipLabel": "安全第一：",
          "tip": "可能な限り必ず現車を直接確認し、詳しい友人や整備士に同行してもらうことを検討してください。車両を見る前に支払いを送ってはいけません。"
        },
        {
          "title": "取引を完了する",
          "body": "Mini を確認し条件に合意したら、購入を確定します。出品者は出品を売却済みにでき、あなたは取引の感想を残せます。",
          "tipLabel": "購入後は：",
          "tip": "コミュニティに参加しましょう！新しい Mini のストーリーを共有し、アドバイスを求め、他の愛好家とつながりましょう。"
        }
      ]
    },
    "sellers": {
      "srTitle": "販売の手順",
      "cta": "出品を作成する",
      "steps": [
        {
          "title": "アカウントを作成する",
          "body": "メールアドレスで登録して始めましょう。所在地と表示名でプロフィールを設定します。プロフィールは、買い手が誰と取引しているかを理解する助けになります。",
          "tipLabel": "プロフィールのコツ：",
          "tip": "プロフィール写真付きの充実したプロフィールは、見込み客の信頼を高めます。"
        },
        {
          "title": "出品を準備する",
          "body": "あらゆる角度から高品質な写真を撮りましょう。ボディの外観、エンジンルーム、内装、車体下部、特別なディテールや不具合などです。履歴、改造、状態メモ、そしてあなたの Mini を特別にしている点を含む詳細な説明を書きましょう。",
          "tipLabel": "写真のコツ：",
          "tip": "撮影前に Mini を清掃しましょう。良い照明と複数の角度は、買い手が状態を理解するのに役立ちます。不具合を隠さないこと——透明性が信頼を生みます。"
        },
        {
          "title": "出品を投稿する",
          "body": "出品フォームにすべての詳細を記入します。年式、モデル、走行距離、価格、所在地、状態などです。カテゴリ別（ボディ、エンジン、内装、ディテール）に整理した写真をアップロードします。内容を確認して出品を公開しましょう。",
          "tipLabel": "価格設定のコツ：",
          "tip": "適正価格を設定するために類似の Mini を調べましょう。あなたの Mini の状態、改造、付属する付属品を考慮してください。"
        },
        {
          "title": "問い合わせに対応する",
          "body": "買い手から質問のメッセージが届いたら、迅速かつ正直に対応しましょう。追加の写真の提供、詳細な質問への回答、本気の買い手との現車確認の調整に備えてください。",
          "tipLabel": "コミュニケーションのコツ：",
          "tip": "迅速で正直な返信は取引を早くまとめる助けになります。不具合については率直に伝え、明確な期待値を設定しましょう。"
        },
        {
          "title": "販売を成立させる",
          "body": "適切な買い手が見つかり条件に合意したら、受け渡しのための安全な待ち合わせ場所を手配しましょう。販売後は、他の関心のある買い手に知らせるため、出品を売却済みにしましょう。",
          "tipLabel": "安全第一：",
          "tip": "現車確認は公共の場所で行いましょう。安全な支払い方法を受け入れ、現地の規則に従って名義変更を適切に行ってください。"
        }
      ]
    },
    "faq": {
      "title": "よくある質問",
      "items": [
        {
          "question": "The Mini Exchange は無料で利用できますか？",
          "answer": "はい！アカウントの作成、出品の閲覧、自分の出品の投稿はすべて無料です。私たちは Mini コミュニティのためにこのプラットフォームを構築しています。"
        },
        {
          "question": "支払いはどのように行われますか？",
          "answer": "The Mini Exchange はマーケットプレイス・プラットフォームであり、支払いの処理は行いません。買い手と売り手が直接、支払いと受け渡しを取り決めます。高額の取引には、銀行振込やエスクローサービスなどの安全な支払い方法をおすすめします。"
        },
        {
          "question": "買い手や売り手との間でトラブルが起きたら？",
          "answer": "私たちは接点となるプラットフォームを提供していますが、取引は買い手と売り手の間で直接行われます。透明性、十分なやり取り、現車確認をおすすめします。不正行為に遭遇した場合は、直ちにご報告ください。"
        },
        {
          "question": "投稿後に出品を編集できますか？",
          "answer": "もちろんです！ダッシュボードからいつでも、出品の詳細を編集したり、写真を追加・削除したり、価格を更新したり、売却済みにしたりできます。"
        },
        {
          "question": "Classic Mini の配送や輸送の手配はしてもらえますか？",
          "answer": "配送サービスは提供していませんが、多くの買い手と売り手はクラシックカー専門の輸送会社を通じて輸送を手配しています。買い手と売り手が直接、輸送と費用を調整します。"
        },
        {
          "question": "どんな種類の Classic Mini を出品できますか？",
          "answer": "1959年から2000年までのすべての Classic Mini を歓迎します！オリジナルの Mini、Cooper S、Clubman エステート、Traveller、ピックアップ、バン、限定モデル、プロジェクトカーなどが含まれます。Classic Mini なら、ここがその居場所です。"
        },
        {
          "question": "どんな部品やアクセサリーを出品できますか？",
          "answer": "Classic Mini オーナーに役立つ部品やアクセサリーはすべて歓迎します——純正品や一次サプライヤーの Mini 部品に限りません。社外品のアップグレード、調整用ツール、メーター、パフォーマンス部品、Classic Mini でよく使われるアクセサリーはすべて適切です。たとえば、キャブ調整に使った Innovate のワイドバンドコントローラーは間違いなくここに合っています。重要なのは関連性です。Mini オーナーが役立つと思うものなら、出品してください！ただ、出品は Classic Mini コミュニティに関連するものに保ち、まったく関係のない一般的な自動車用品は避けてください。"
        }
      ]
    },
    "questions": {
      "title": "まだ質問がありますか？",
      "body": "私たちがお手伝いします。サポートが必要な場合や、プラットフォームの改善に関するご提案があれば、お気軽にご連絡ください。",
      "button": "お問い合わせ"
    },
    "seo": {
      "title": "ご利用の流れ - The Mini Exchange",
      "description": "The Mini Exchange での売買方法をご紹介します。Classic Mini、部品、エンジンを出品するためのシンプルなガイドです。",
      "ogDescription": "The Mini Exchange で Classic Mini や部品、エンジンを売買するためのシンプルなガイド。"
    }
  },
  "zh": {
    "hero": {
      "title": "运作方式",
      "subtitle": "一个简单直接的 Classic Mini 买卖平台"
    },
    "tabs": { "buyers": "买家专区", "sellers": "卖家专区" },
    "buyers": {
      "srTitle": "买家步骤",
      "cta": "开始浏览刊登",
      "steps": [
        {
          "title": "浏览刊登",
          "body": "探索我们来自世界各地的 Classic Mini 收藏。使用筛选条件按车型、年份、所在地、价格区间和车况缩小范围。",
          "tipLabel": "小贴士：",
          "tip": "将刊登加入关注列表，即可追踪价格变化，并在卖家回复你的消息时收到通知。"
        },
        {
          "title": "查看详细刊登",
          "body": "每条刊登都包含全面的信息：完整规格、改装历史、多个图片库（车身、发动机、内饰、细节），以及卖家关于车况和历史的说明。",
          "tipLabel": "需留意的方面：",
          "tip": "仔细查看照片，阅读卖家的车况说明，并留意任何改装或非原厂部件。如有不清楚的地方请提问。"
        },
        {
          "title": "联系卖家",
          "body": "使用我们内置的消息系统提问、索取更多照片或安排看车。在你准备好直接联系之前，所有沟通都会保留在平台上。",
          "tipLabel": "安全第一：",
          "tip": "尽可能始终亲自检查车辆，并考虑带上懂行的朋友或技师。在看到车辆之前，切勿付款。"
        },
        {
          "title": "完成交易",
          "body": "在你检查 Mini 并就条款达成一致后，完成购买。卖家可将刊登标记为已售出，你也可以对自己的体验留下评价。",
          "tipLabel": "购买之后：",
          "tip": "加入社区吧！分享你新 Mini 的故事，寻求建议，并与其他爱好者交流。"
        }
      ]
    },
    "sellers": {
      "srTitle": "卖家步骤",
      "cta": "创建你的刊登",
      "steps": [
        {
          "title": "创建账户",
          "body": "用你的电子邮箱注册即可开始。设置个人资料，填写所在地和显示名称。你的资料有助于买家了解他们在与谁打交道。",
          "tipLabel": "资料贴士：",
          "tip": "一份带头像的完整资料能增进潜在买家的信任。"
        },
        {
          "title": "准备你的刊登",
          "body": "从各个角度拍摄高质量照片：车身外观、发动机舱、内饰、底盘，以及任何特殊细节或问题。撰写详细描述，包括历史、改装、车况说明，以及你的 Mini 的特别之处。",
          "tipLabel": "拍照贴士：",
          "tip": "拍照前请清洁你的 Mini。良好的光线和多个角度能帮助买家了解车况。不要隐瞒问题——透明能建立信任。"
        },
        {
          "title": "发布你的刊登",
          "body": "在刊登表单中填写所有细节：年份、车型、里程、价格、所在地和车况。按类别（车身、发动机、内饰、细节）整理并上传照片。检查并发布你的刊登。",
          "tipLabel": "定价贴士：",
          "tip": "研究类似的 Mini 以制定公平的价格。考虑你 Mini 的车况、改装以及任何附带的额外配件。"
        },
        {
          "title": "回复咨询",
          "body": "当买家发来问题时，请及时且诚实地回复。准备好提供更多照片、回答详细问题，并为认真的买家安排看车。",
          "tipLabel": "沟通贴士：",
          "tip": "迅速、诚实的回复有助于更快达成交易。坦诚说明任何问题，并设定清晰的预期。"
        },
        {
          "title": "完成销售",
          "body": "在找到合适的买家并就条款达成一致后，安排一个安全的见面地点进行交接。销售完成后，将你的刊登标记为已售出，以告知其他感兴趣的买家。",
          "tipLabel": "安全第一：",
          "tip": "在公共场所见面看车。接受安全的付款方式，并按照当地法规妥善办理过户。"
        }
      ]
    },
    "faq": {
      "title": "常见问题",
      "items": [
        {
          "question": "使用 The Mini Exchange 收费吗？",
          "answer": "免费！创建账户、浏览刊登以及发布自己的刊登都完全免费。我们正在为 Mini 社区打造这个平台。"
        },
        {
          "question": "付款是如何进行的？",
          "answer": "The Mini Exchange 是一个市场平台——我们不处理付款。买卖双方直接安排付款和交接。对于高价值交易，我们建议使用银行转账或第三方托管服务等安全的付款方式。"
        },
        {
          "question": "如果与买家或卖家发生纠纷怎么办？",
          "answer": "虽然我们提供联系平台，但交易直接在买卖双方之间进行。我们鼓励透明、充分的沟通和当面检查。如果你遇到欺诈行为，请立即向我们举报。"
        },
        {
          "question": "发布后可以编辑我的刊登吗？",
          "answer": "当然可以！你可以随时在控制面板中编辑刊登详情、添加或删除照片、更新价格，或将其标记为已售出。"
        },
        {
          "question": "你们运送 Classic Mini 或协助运输吗？",
          "answer": "我们不提供运输服务，但许多买家和卖家会通过专门的经典车运输公司安排运输。买卖双方直接协调运输和费用。"
        },
        {
          "question": "我可以刊登哪些类型的 Classic Mini？",
          "answer": "欢迎所有 1959 至 2000 年的 Classic Mini！这包括原版 Mini、Cooper S 车型、Clubman 旅行版、Traveller、皮卡、厢式车、限量版以及待修复的项目车。只要是 Classic Mini，这里就是它的归属。"
        },
        {
          "question": "我可以刊登哪些零件和配件？",
          "answer": "我们欢迎所有对 Classic Mini 车主有用的零件和配件——不仅限于原厂或一线 Mini 零件。售后升级件、调校工具、仪表、性能件以及 Classic Mini 上常用的配件都很合适。例如，你用来调校化油器的 Innovate 宽频控制器绝对适合放在这里。关键在于相关性：只要 Mini 车主觉得有用，就刊登吧！我们只要求刊登与 Classic Mini 社区相关，避免完全无关的通用汽车用品。"
        }
      ]
    },
    "questions": {
      "title": "还有疑问吗？",
      "body": "我们随时为你提供帮助。如果你需要协助，或对改进平台有任何建议，请与我们联系。",
      "button": "联系我们"
    },
    "seo": {
      "title": "运作方式 - The Mini Exchange",
      "description": "了解如何在 The Mini Exchange 上买卖。一份刊登你的 Classic Mini、零件或发动机的简单指南。",
      "ogDescription": "一份在 The Mini Exchange 上买卖 Classic Mini、零件和发动机的简单指南。"
    }
  },
  "ko": {
    "hero": {
      "title": "이용 방법",
      "subtitle": "Classic Mini를 사고팔 수 있는 간단하고 직관적인 플랫폼"
    },
    "tabs": { "buyers": "구매자용", "sellers": "판매자용" },
    "buyers": {
      "srTitle": "구매자 단계",
      "cta": "매물 둘러보기 시작",
      "steps": [
        {
          "title": "매물 둘러보기",
          "body": "전 세계의 Classic Mini 컬렉션을 살펴보세요. 필터를 사용해 모델, 연식, 위치, 가격대, 상태로 범위를 좁힐 수 있습니다.",
          "tipLabel": "팁:",
          "tip": "매물을 관심 목록에 추가하면 가격 변동을 추적하고 판매자가 메시지에 답하면 알림을 받을 수 있습니다."
        },
        {
          "title": "상세 매물 보기",
          "body": "각 매물에는 상세한 정보가 담겨 있습니다. 전체 사양, 개조 이력, 여러 사진 갤러리(차체, 엔진, 실내, 디테일), 그리고 상태와 이력에 대한 판매자 메모가 포함됩니다.",
          "tipLabel": "확인할 점:",
          "tip": "사진을 꼼꼼히 확인하고 판매자의 상태 메모를 읽으며 개조나 비순정 부품이 있는지 살펴보세요. 불분명한 점이 있으면 질문하세요."
        },
        {
          "title": "판매자에게 연락하기",
          "body": "내장 메시지 시스템을 사용해 질문하거나, 추가 사진을 요청하거나, 실차 확인 일정을 잡으세요. 직접 연락할 준비가 될 때까지 모든 소통은 플랫폼 안에서 유지됩니다.",
          "tipLabel": "안전이 우선:",
          "tip": "가능하면 항상 직접 차량을 점검하고, 잘 아는 친구나 정비사를 데려가는 것을 고려하세요. 차량을 보기 전에는 절대 대금을 보내지 마세요."
        },
        {
          "title": "거래 완료하기",
          "body": "Mini를 점검하고 조건에 합의했다면 구매를 마무리하세요. 판매자는 매물을 판매 완료로 표시할 수 있고, 여러분은 경험에 대한 후기를 남길 수 있습니다.",
          "tipLabel": "구매 후에는:",
          "tip": "커뮤니티에 참여하세요! 새 Mini 이야기를 공유하고, 조언을 구하며, 다른 애호가들과 교류하세요."
        }
      ]
    },
    "sellers": {
      "srTitle": "판매자 단계",
      "cta": "매물 등록하기",
      "steps": [
        {
          "title": "계정 만들기",
          "body": "이메일 주소로 가입해 시작하세요. 위치와 표시 이름으로 프로필을 설정하세요. 프로필은 구매자가 누구와 거래하는지 이해하는 데 도움이 됩니다.",
          "tipLabel": "프로필 팁:",
          "tip": "프로필 사진이 있는 완성된 프로필은 잠재 구매자의 신뢰를 높입니다."
        },
        {
          "title": "매물 준비하기",
          "body": "모든 각도에서 고품질 사진을 촬영하세요. 차체 외관, 엔진룸, 실내, 하부, 그리고 특별한 디테일이나 문제점입니다. 이력, 개조, 상태 메모, 그리고 여러분의 Mini가 특별한 이유를 포함한 상세 설명을 작성하세요.",
          "tipLabel": "사진 팁:",
          "tip": "촬영 전에 Mini를 청소하세요. 좋은 조명과 여러 각도는 구매자가 상태를 이해하는 데 도움이 됩니다. 문제점을 숨기지 마세요——투명성이 신뢰를 만듭니다."
        },
        {
          "title": "매물 게시하기",
          "body": "매물 양식에 모든 세부 정보를 입력하세요. 연식, 모델, 주행거리, 가격, 위치, 상태입니다. 카테고리별(차체, 엔진, 실내, 디테일)로 정리한 사진을 업로드하세요. 검토 후 매물을 게시하세요.",
          "tipLabel": "가격 책정 팁:",
          "tip": "공정한 가격을 정하기 위해 비슷한 Mini를 조사하세요. Mini의 상태, 개조, 포함된 추가 구성품을 고려하세요."
        },
        {
          "title": "문의에 응답하기",
          "body": "구매자가 질문 메시지를 보내면 신속하고 정직하게 응답하세요. 추가 사진 제공, 상세한 질문에 대한 답변, 진지한 구매자를 위한 실차 확인 일정 조율에 대비하세요.",
          "tipLabel": "소통 팁:",
          "tip": "빠르고 정직한 응답은 거래를 더 빨리 성사시키는 데 도움이 됩니다. 모든 문제점을 솔직히 밝히고 명확한 기대치를 설정하세요."
        },
        {
          "title": "판매 마무리하기",
          "body": "적합한 구매자를 찾고 조건에 합의했다면 안전한 만남 장소를 정해 인도를 진행하세요. 판매 후에는 다른 관심 있는 구매자에게 알리기 위해 매물을 판매 완료로 표시하세요.",
          "tipLabel": "안전이 우선:",
          "tip": "실차 확인은 공공장소에서 만나세요. 안전한 결제 방법을 수락하고, 현지 규정에 따라 명의 이전을 적절히 진행하세요."
        }
      ]
    },
    "faq": {
      "title": "자주 묻는 질문",
      "items": [
        {
          "question": "The Mini Exchange는 무료로 이용할 수 있나요?",
          "answer": "네! 계정 생성, 매물 둘러보기, 자신의 매물 게시는 모두 완전히 무료입니다. 우리는 Mini 커뮤니티를 위해 이 플랫폼을 만들고 있습니다."
        },
        {
          "question": "결제는 어떻게 이루어지나요?",
          "answer": "The Mini Exchange는 마켓플레이스 플랫폼으로, 결제를 처리하지 않습니다. 구매자와 판매자가 직접 결제와 인도를 정합니다. 고액 거래의 경우 계좌 이체나 에스크로 서비스 같은 안전한 결제 방법을 권장합니다."
        },
        {
          "question": "구매자나 판매자와 분쟁이 생기면 어떻게 하나요?",
          "answer": "우리는 연결을 위한 플랫폼을 제공하지만, 거래는 구매자와 판매자 사이에서 직접 이루어집니다. 투명성, 충분한 소통, 직접 점검을 권장합니다. 사기 행위를 발견하면 즉시 신고해 주세요."
        },
        {
          "question": "게시 후에 매물을 수정할 수 있나요?",
          "answer": "물론입니다! 대시보드에서 언제든지 매물 정보를 수정하고, 사진을 추가 또는 삭제하고, 가격을 변경하거나, 판매 완료로 표시할 수 있습니다."
        },
        {
          "question": "Classic Mini를 배송하거나 운송을 도와주나요?",
          "answer": "배송 서비스는 제공하지 않지만, 많은 구매자와 판매자가 전문 클래식 카 운송 업체를 통해 운송을 준비합니다. 구매자와 판매자가 직접 운송과 비용을 조율합니다."
        },
        {
          "question": "어떤 종류의 Classic Mini를 등록할 수 있나요?",
          "answer": "1959년부터 2000년까지의 모든 Classic Mini를 환영합니다! 여기에는 오리지널 Mini, Cooper S 모델, Clubman 에스테이트, Traveller, 픽업, 밴, 한정판, 그리고 프로젝트 카가 포함됩니다. Classic Mini라면 이곳이 제자리입니다."
        },
        {
          "question": "어떤 부품과 액세서리를 등록할 수 있나요?",
          "answer": "Classic Mini 소유자에게 유용한 모든 부품과 액세서리를 환영합니다——순정이나 1차 공급사 Mini 부품에만 국한되지 않습니다. 애프터마켓 업그레이드, 튜닝 도구, 계기, 퍼포먼스 부품, Classic Mini에 흔히 사용되는 액세서리는 모두 적합합니다. 예를 들어, 카뷰레터 튜닝에 사용한 Innovate 와이드밴드 컨트롤러는 분명히 여기에 어울립니다. 핵심은 연관성입니다. Mini 소유자가 유용하다고 느낄 만한 것이라면 등록하세요! 다만 매물이 Classic Mini 커뮤니티와 관련성을 유지하고, 전혀 무관한 일반 자동차 용품은 피해 주시기를 요청드립니다."
        }
      ]
    },
    "questions": {
      "title": "아직 궁금한 점이 있으신가요?",
      "body": "저희가 도와드리겠습니다. 도움이 필요하거나 플랫폼 개선에 대한 제안이 있으면 연락 주세요.",
      "button": "문의하기"
    },
    "seo": {
      "title": "이용 방법 - The Mini Exchange",
      "description": "The Mini Exchange에서 사고파는 방법을 알아보세요. Classic Mini, 부품 또는 엔진을 등록하기 위한 간단한 가이드입니다.",
      "ogDescription": "The Mini Exchange에서 Classic Mini, 부품, 엔진을 사고파는 간단한 가이드."
    }
  }
}
</i18n>
