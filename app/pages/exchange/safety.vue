<template>
  <div>
    <!-- Hero -->
    <section class="bg-base-100 border-b border-base-300 py-12">
      <div class="container">
        <div class="max-w-3xl">
          <div class="flex items-center gap-3 mb-4">
            <i class="fas fa-shield-halved text-3xl text-primary"></i>
            <h1 class="text-4xl font-bold">{{ t('hero.title') }}</h1>
          </div>
          <p class="text-lg text-base-content/70">{{ t('hero.subtitle') }}</p>
        </div>
      </div>
    </section>

    <!-- Content -->
    <section class="py-12">
      <div class="container">
        <div class="max-w-3xl space-y-12">
          <!-- Meeting In Person -->
          <div>
            <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
              <i class="fas fa-location-dot text-primary"></i>
              {{ t('meeting.title') }}
            </h2>
            <div class="space-y-3">
              <div v-for="(tip, i) in tm('inPersonTips')" :key="i" class="flex gap-3 items-start">
                <i class="fas fa-circle-check text-success shrink-0 mt-0.5"></i>
                <p class="text-base-content/80">{{ rt(tip) }}</p>
              </div>
            </div>
          </div>

          <!-- Payment Safety -->
          <div>
            <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
              <i class="fas fa-money-bills text-primary"></i>
              {{ t('payment.title') }}
            </h2>

            <div class="mb-6">
              <h3 class="font-semibold text-lg mb-3 text-success">{{ t('payment.recommendedHeading') }}</h3>
              <div class="grid sm:grid-cols-2 gap-3">
                <div v-for="(method, i) in tm('recommendedPayments')" :key="i" class="card bg-success/10 p-4">
                  <div class="font-medium text-success">{{ rt(method.name) }}</div>
                  <div class="text-sm text-base-content/70 mt-1">{{ rt(method.reason) }}</div>
                </div>
              </div>
            </div>

            <div>
              <h3 class="font-semibold text-lg mb-3 text-error">{{ t('payment.avoidHeading') }}</h3>
              <div class="grid sm:grid-cols-2 gap-3">
                <div v-for="(method, i) in tm('riskyPayments')" :key="i" class="card bg-error/10 p-4">
                  <div class="font-medium text-error">{{ rt(method.name) }}</div>
                  <div class="text-sm text-base-content/70 mt-1">{{ rt(method.reason) }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Buying a Classic Mini -->
          <div>
            <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
              <i class="fas fa-magnifying-glass text-primary"></i>
              {{ t('buying.title') }}
            </h2>
            <div class="space-y-3">
              <div v-for="(tip, i) in tm('buyingTips')" :key="i" class="flex gap-3 items-start">
                <i class="fas fa-circle-check text-info shrink-0 mt-0.5"></i>
                <p class="text-base-content/80">{{ rt(tip) }}</p>
              </div>
            </div>
          </div>

          <!-- Selling Tips -->
          <div>
            <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
              <i class="fas fa-tag text-primary"></i>
              {{ t('selling.title') }}
            </h2>
            <div class="space-y-3">
              <div v-for="(tip, i) in tm('sellingTips')" :key="i" class="flex gap-3 items-start">
                <i class="fas fa-circle-check text-info shrink-0 mt-0.5"></i>
                <p class="text-base-content/80">{{ rt(tip) }}</p>
              </div>
            </div>
          </div>

          <!-- Shipping Safety -->
          <div>
            <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
              <i class="fas fa-truck text-primary"></i>
              {{ t('shipping.title') }}
            </h2>
            <div class="space-y-3">
              <div v-for="(tip, i) in tm('shippingTips')" :key="i" class="flex gap-3 items-start">
                <i class="fas fa-circle-check text-warning shrink-0 mt-0.5"></i>
                <p class="text-base-content/80">{{ rt(tip) }}</p>
              </div>
            </div>
          </div>

          <!-- Red Flags -->
          <div>
            <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
              <i class="fas fa-triangle-exclamation text-error"></i>
              {{ t('redFlagsHeading') }}
            </h2>
            <div class="space-y-3">
              <div v-for="(flag, i) in tm('redFlags')" :key="i" class="flex gap-3 items-start">
                <i class="fas fa-circle-xmark text-error shrink-0 mt-0.5"></i>
                <p class="text-base-content/80">{{ rt(flag) }}</p>
              </div>
            </div>
          </div>

          <!-- Reporting -->
          <div class="card bg-base-200 shadow-sm">
            <div class="card-body">
              <h2 class="card-title flex items-center gap-2">
                <i class="fas fa-flag text-primary"></i>
                {{ t('report.title') }}
              </h2>
              <p class="text-base-content/70">{{ t('report.body') }}</p>
              <div class="card-actions mt-4">
                <NuxtLink to="/contact" class="btn btn-primary">
                  <i class="fas fa-envelope"></i>
                  {{ t('report.button') }}
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  const { t, tm, rt } = useI18n();

  useSeoMeta({
    title: () => t('seo.title'),
    description: () => t('seo.description'),
    ogTitle: () => t('seo.title'),
    ogDescription: () => t('seo.ogDescription'),
  });
</script>

<i18n lang="json">
{
  "en": {
    "hero": { "title": "Safety Guide", "subtitle": "Tips for buying and selling Classic Minis safely on The Mini Exchange." },
    "meeting": { "title": "Meeting In Person" },
    "payment": { "title": "Payment Safety", "recommendedHeading": "Recommended Payment Methods", "avoidHeading": "Payment Methods to Avoid" },
    "buying": { "title": "Buying Tips" },
    "selling": { "title": "Selling Tips" },
    "shipping": { "title": "Shipping Safety" },
    "redFlagsHeading": "Red Flags to Watch For",
    "report": { "title": "Report Suspicious Activity", "body": "If you encounter suspicious behaviour, scam attempts, or fraudulent listings, please report them immediately. You can report individual messages within conversations, or contact us directly.", "button": "Contact Us" },
    "inPersonTips": [
      "Meet in a well-lit, public place such as a car park, petrol station, or police station.",
      "Bring a friend or family member along for the viewing.",
      "Let someone know where you are going and when you expect to be back.",
      "Do the inspection during daylight hours so you can see the car properly.",
      "If buying a vehicle, ask to see the V5C (logbook) or title document and verify it matches the VIN/chassis number.",
      "Take your time — a legitimate seller will not rush you into a decision."
    ],
    "recommendedPayments": [
      { "name": "Bank Transfer", "reason": "Direct, traceable, and widely accepted. Verify the recipient details carefully before sending." },
      { "name": "PayPal Goods & Services", "reason": "Offers buyer protection for items not received or significantly not as described." },
      { "name": "Cash (In Person)", "reason": "For local pickups only. Count carefully and consider a counterfeit detection pen for large amounts." },
      { "name": "Escrow Services", "reason": "For high-value transactions, an escrow service holds payment until both parties are satisfied." }
    ],
    "riskyPayments": [
      { "name": "Wire Transfer (Western Union, MoneyGram)", "reason": "Almost impossible to recover once sent. A favourite method of scammers." },
      { "name": "Gift Cards or Cryptocurrency", "reason": "Untraceable and irreversible. No legitimate seller will insist on these." },
      { "name": "PayPal Friends & Family", "reason": "No buyer protection — treated as a gift, not a purchase." },
      { "name": "Cheques / Money Orders", "reason": "Can be forged. If you must accept one, wait for it to fully clear before releasing the item." }
    ],
    "buyingTips": [
      "Research the fair market value before making an offer. Check sold listings on The Mini Exchange for comparable prices.",
      "Ask for detailed photos of known Mini rust spots: subframes, A-panels, front floor pans, sills, and rear valance.",
      "Request the Heritage Certificate number and verify it if the seller claims the car is matching-numbers.",
      "For engines and major components, ask for the engine plate number and verify the series matches the claimed displacement.",
      "If the deal seems too good to be true, it probably is. A pristine 1275 Cooper S for under market value deserves extra scrutiny.",
      "Consider getting a pre-purchase inspection from a Classic Mini specialist before committing to a vehicle purchase.",
      "Check the seller's profile — how long have they been a member? Do they have completed sales?"
    ],
    "sellingTips": [
      "Take clear, well-lit photos from multiple angles. Buyers trust detailed, honest photography.",
      "Be upfront about any issues, rust, or modifications. Honesty builds trust and avoids disputes later.",
      "Respond to inquiries promptly — buyers often purchase from the first seller who replies.",
      "Set a fair asking price based on comparable sold listings. Overpricing leads to stale listings.",
      "Never share personal financial details (bank login, full card numbers) with buyers.",
      "For shipped items, always use tracked and insured shipping. Share the tracking number with the buyer."
    ],
    "shippingTips": [
      "Always use tracked and insured shipping for parts and engines.",
      "Take photos of the item packed and ready to ship as proof of condition at dispatch.",
      "For vehicles, use a reputable enclosed transport service and get a Bill of Lading.",
      "Agree on who pays shipping costs before finalising the deal.",
      "Share the tracking number in your Mini Exchange conversation for a clear record.",
      "Never ship an item before confirming payment has cleared."
    ],
    "redFlags": [
      "The seller refuses to meet in person or show the vehicle before payment.",
      "Pressure to pay immediately or \"someone else is about to buy it\" urgency tactics.",
      "Requests for unusual payment methods like gift cards, crypto, or wire transfers.",
      "The price is significantly below market value with no clear explanation.",
      "Poor-quality or stock photos that don't match the description.",
      "The seller avoids answering specific questions about the car's history or condition.",
      "Requests to move the conversation off The Mini Exchange to email, WhatsApp, or text.",
      "A newly created account with no profile information or listing history.",
      "The VIN/chassis number doesn't match the Heritage Certificate or V5C logbook."
    ],
    "seo": { "title": "Safety Guide - The Mini Exchange", "description": "Tips for safely buying and selling Classic Minis on The Mini Exchange. Learn about safe payment methods, meeting in person, and spotting red flags.", "ogDescription": "Stay safe when buying and selling Classic Minis online." }
  },
  "es": {
    "hero": { "title": "Guía de seguridad", "subtitle": "Consejos para comprar y vender Classic Minis de forma segura en The Mini Exchange." },
    "meeting": { "title": "Reunirse en persona" },
    "payment": { "title": "Seguridad en los pagos", "recommendedHeading": "Métodos de pago recomendados", "avoidHeading": "Métodos de pago a evitar" },
    "buying": { "title": "Consejos para comprar" },
    "selling": { "title": "Consejos para vender" },
    "shipping": { "title": "Seguridad en los envíos" },
    "redFlagsHeading": "Señales de alerta a tener en cuenta",
    "report": { "title": "Denuncia actividad sospechosa", "body": "Si detectas comportamientos sospechosos, intentos de estafa o anuncios fraudulentos, denúncialos de inmediato. Puedes denunciar mensajes concretos dentro de las conversaciones o contactarnos directamente.", "button": "Contáctanos" },
    "inPersonTips": [
      "Reúnete en un lugar público y bien iluminado, como un aparcamiento, una gasolinera o una comisaría.",
      "Lleva a un amigo o familiar a la visita.",
      "Avisa a alguien de adónde vas y a qué hora esperas volver.",
      "Haz la inspección a la luz del día para poder ver bien el coche.",
      "Si compras un vehículo, pide ver el permiso de circulación (V5C) o el título y verifica que coincide con el número de bastidor/VIN.",
      "Tómate tu tiempo: un vendedor legítimo no te meterá prisa para decidir."
    ],
    "recommendedPayments": [
      { "name": "Transferencia bancaria", "reason": "Directa, rastreable y ampliamente aceptada. Verifica con cuidado los datos del destinatario antes de enviar." },
      { "name": "PayPal Bienes y Servicios", "reason": "Ofrece protección al comprador para artículos no recibidos o muy distintos a lo descrito." },
      { "name": "Efectivo (en persona)", "reason": "Solo para recogidas locales. Cuenta con cuidado y plantéate un rotulador detector de billetes falsos para grandes cantidades." },
      { "name": "Servicios de depósito en garantía (escrow)", "reason": "Para transacciones de alto valor, un servicio de escrow retiene el pago hasta que ambas partes queden satisfechas." }
    ],
    "riskyPayments": [
      { "name": "Giro postal (Western Union, MoneyGram)", "reason": "Casi imposible de recuperar una vez enviado. El método favorito de los estafadores." },
      { "name": "Tarjetas de regalo o criptomonedas", "reason": "Irrastreables e irreversibles. Ningún vendedor legítimo insistirá en ellas." },
      { "name": "PayPal Amigos y Familia", "reason": "Sin protección al comprador: se trata como un regalo, no como una compra." },
      { "name": "Cheques / órdenes de pago", "reason": "Pueden falsificarse. Si debes aceptar uno, espera a que se haga efectivo del todo antes de entregar el artículo." }
    ],
    "buyingTips": [
      "Investiga el valor justo de mercado antes de hacer una oferta. Consulta los anuncios vendidos en The Mini Exchange para comparar precios.",
      "Pide fotos detalladas de los puntos de óxido típicos del Mini: subchasis, paneles A, suelos delanteros, faldones y panel trasero.",
      "Solicita el número del Certificado Heritage y verifícalo si el vendedor afirma que el coche conserva los números originales.",
      "Para motores y componentes importantes, pide el número de la placa del motor y comprueba que la serie coincide con la cilindrada indicada.",
      "Si la oferta parece demasiado buena para ser verdad, probablemente lo sea. Un 1275 Cooper S impecable por debajo del precio de mercado merece especial atención.",
      "Plantéate una inspección previa a la compra por un especialista en Classic Mini antes de comprometerte a comprar un vehículo.",
      "Revisa el perfil del vendedor: ¿cuánto tiempo lleva como miembro? ¿Tiene ventas completadas?"
    ],
    "sellingTips": [
      "Haz fotos nítidas y bien iluminadas desde varios ángulos. Los compradores confían en una fotografía detallada y honesta.",
      "Sé claro sobre cualquier problema, óxido o modificación. La honestidad genera confianza y evita disputas después.",
      "Responde a las consultas con rapidez: los compradores suelen comprar al primer vendedor que responde.",
      "Fija un precio justo basado en anuncios vendidos comparables. Un precio excesivo deja el anuncio estancado.",
      "Nunca compartas datos financieros personales (acceso bancario, números completos de tarjeta) con los compradores.",
      "Para artículos enviados, usa siempre un envío con seguimiento y seguro. Comparte el número de seguimiento con el comprador."
    ],
    "shippingTips": [
      "Usa siempre envíos con seguimiento y seguro para piezas y motores.",
      "Haz fotos del artículo embalado y listo para enviar como prueba de su estado en el momento del envío.",
      "Para vehículos, usa un servicio de transporte cerrado de confianza y obtén un conocimiento de embarque (Bill of Lading).",
      "Acordad quién paga los gastos de envío antes de cerrar el trato.",
      "Comparte el número de seguimiento en tu conversación de Mini Exchange para dejar constancia clara.",
      "Nunca envíes un artículo antes de confirmar que el pago se ha hecho efectivo."
    ],
    "redFlags": [
      "El vendedor se niega a reunirse en persona o a mostrar el vehículo antes del pago.",
      "Presión para pagar de inmediato o tácticas de urgencia del tipo «otra persona está a punto de comprarlo».",
      "Solicitudes de métodos de pago inusuales como tarjetas de regalo, cripto o giros postales.",
      "El precio está muy por debajo del valor de mercado sin una explicación clara.",
      "Fotos de mala calidad o de catálogo que no coinciden con la descripción.",
      "El vendedor evita responder a preguntas concretas sobre el historial o el estado del coche.",
      "Solicitudes de trasladar la conversación fuera de The Mini Exchange a correo, WhatsApp o SMS.",
      "Una cuenta recién creada sin información de perfil ni historial de anuncios.",
      "El número de bastidor/VIN no coincide con el Certificado Heritage o el permiso de circulación V5C."
    ],
    "seo": { "title": "Guía de seguridad - The Mini Exchange", "description": "Consejos para comprar y vender Classic Minis de forma segura en The Mini Exchange. Aprende sobre métodos de pago seguros, encuentros en persona y cómo detectar señales de alerta.", "ogDescription": "Mantente seguro al comprar y vender Classic Minis por internet." }
  },
  "fr": {
    "hero": { "title": "Guide de sécurité", "subtitle": "Conseils pour acheter et vendre des Classic Minis en toute sécurité sur The Mini Exchange." },
    "meeting": { "title": "Se rencontrer en personne" },
    "payment": { "title": "Sécurité des paiements", "recommendedHeading": "Moyens de paiement recommandés", "avoidHeading": "Moyens de paiement à éviter" },
    "buying": { "title": "Conseils d'achat" },
    "selling": { "title": "Conseils de vente" },
    "shipping": { "title": "Sécurité d'expédition" },
    "redFlagsHeading": "Signaux d'alerte à surveiller",
    "report": { "title": "Signaler une activité suspecte", "body": "Si vous constatez un comportement suspect, une tentative d'escroquerie ou une annonce frauduleuse, signalez-la immédiatement. Vous pouvez signaler des messages individuels dans les conversations ou nous contacter directement.", "button": "Nous contacter" },
    "inPersonTips": [
      "Rencontrez-vous dans un lieu public et bien éclairé, comme un parking, une station-service ou un commissariat.",
      "Faites-vous accompagner d'un ami ou d'un proche lors de la visite.",
      "Prévenez quelqu'un de l'endroit où vous allez et de l'heure prévue de votre retour.",
      "Faites l'inspection en journée afin de bien voir la voiture.",
      "Si vous achetez un véhicule, demandez à voir la carte grise (V5C) ou le titre et vérifiez qu'elle correspond au numéro de châssis/VIN.",
      "Prenez votre temps : un vendeur honnête ne vous poussera pas à décider dans la précipitation."
    ],
    "recommendedPayments": [
      { "name": "Virement bancaire", "reason": "Direct, traçable et largement accepté. Vérifiez soigneusement les coordonnées du destinataire avant d'envoyer." },
      { "name": "PayPal Biens et Services", "reason": "Offre une protection acheteur pour les articles non reçus ou nettement non conformes à la description." },
      { "name": "Espèces (en personne)", "reason": "Pour les retraits locaux uniquement. Comptez soigneusement et envisagez un stylo détecteur de faux billets pour les grosses sommes." },
      { "name": "Services d'entiercement (escrow)", "reason": "Pour les transactions de grande valeur, un service d'entiercement conserve le paiement jusqu'à satisfaction des deux parties." }
    ],
    "riskyPayments": [
      { "name": "Transfert d'argent (Western Union, MoneyGram)", "reason": "Quasi impossible à récupérer une fois envoyé. Le moyen préféré des escrocs." },
      { "name": "Cartes cadeaux ou cryptomonnaie", "reason": "Intraçables et irréversibles. Aucun vendeur honnête n'insistera pour les utiliser." },
      { "name": "PayPal Amis et Famille", "reason": "Aucune protection acheteur : traité comme un cadeau, pas un achat." },
      { "name": "Chèques / mandats", "reason": "Peuvent être falsifiés. Si vous devez en accepter un, attendez son encaissement complet avant de remettre l'article." }
    ],
    "buyingTips": [
      "Renseignez-vous sur la juste valeur marchande avant de faire une offre. Consultez les annonces vendues sur The Mini Exchange pour comparer les prix.",
      "Demandez des photos détaillées des zones de rouille connues du Mini : berceaux, panneaux A, planchers avant, bas de caisse et panneau arrière.",
      "Demandez le numéro du Certificat Heritage et vérifiez-le si le vendeur affirme que la voiture est d'origine (matching numbers).",
      "Pour les moteurs et composants majeurs, demandez le numéro de plaque moteur et vérifiez que la série correspond à la cylindrée annoncée.",
      "Si l'affaire semble trop belle pour être vraie, c'est probablement le cas. Une 1275 Cooper S impeccable sous le prix du marché mérite une attention particulière.",
      "Envisagez une inspection avant achat par un spécialiste Classic Mini avant de vous engager sur un véhicule.",
      "Vérifiez le profil du vendeur : depuis combien de temps est-il membre ? A-t-il des ventes réalisées ?"
    ],
    "sellingTips": [
      "Prenez des photos nettes et bien éclairées sous plusieurs angles. Les acheteurs font confiance à une photographie détaillée et honnête.",
      "Soyez transparent sur les défauts, la rouille ou les modifications. L'honnêteté crée la confiance et évite les litiges ultérieurs.",
      "Répondez rapidement aux demandes : les acheteurs achètent souvent au premier vendeur qui répond.",
      "Fixez un prix juste d'après les annonces vendues comparables. Un prix trop élevé fait stagner l'annonce.",
      "Ne partagez jamais d'informations financières personnelles (identifiants bancaires, numéros de carte complets) avec les acheteurs.",
      "Pour les articles expédiés, utilisez toujours un envoi suivi et assuré. Communiquez le numéro de suivi à l'acheteur."
    ],
    "shippingTips": [
      "Utilisez toujours un envoi suivi et assuré pour les pièces et les moteurs.",
      "Prenez des photos de l'article emballé et prêt à expédier comme preuve de son état au départ.",
      "Pour les véhicules, faites appel à un transporteur fermé réputé et obtenez un connaissement (Bill of Lading).",
      "Convenez de qui paie les frais d'expédition avant de finaliser la transaction.",
      "Communiquez le numéro de suivi dans votre conversation Mini Exchange pour garder une trace claire.",
      "N'expédiez jamais un article avant d'avoir confirmé que le paiement a été encaissé."
    ],
    "redFlags": [
      "Le vendeur refuse de vous rencontrer en personne ou de montrer le véhicule avant le paiement.",
      "Pression pour payer immédiatement ou tactiques d'urgence du type « quelqu'un d'autre est sur le point de l'acheter ».",
      "Demandes de moyens de paiement inhabituels comme des cartes cadeaux, de la crypto ou des transferts d'argent.",
      "Le prix est nettement inférieur à la valeur du marché sans explication claire.",
      "Photos de mauvaise qualité ou de catalogue qui ne correspondent pas à la description.",
      "Le vendeur évite de répondre à des questions précises sur l'historique ou l'état de la voiture.",
      "Demandes de déplacer la conversation hors de The Mini Exchange vers l'e-mail, WhatsApp ou les SMS.",
      "Un compte récemment créé sans informations de profil ni historique d'annonces.",
      "Le numéro de châssis/VIN ne correspond pas au Certificat Heritage ou à la carte grise V5C."
    ],
    "seo": { "title": "Guide de sécurité - The Mini Exchange", "description": "Conseils pour acheter et vendre des Classic Minis en toute sécurité sur The Mini Exchange. Découvrez les moyens de paiement sûrs, les rencontres en personne et comment repérer les signaux d'alerte.", "ogDescription": "Restez en sécurité lors de l'achat et de la vente de Classic Minis en ligne." }
  },
  "de": {
    "hero": { "title": "Sicherheitsleitfaden", "subtitle": "Tipps für den sicheren Kauf und Verkauf von Classic Minis auf The Mini Exchange." },
    "meeting": { "title": "Persönliches Treffen" },
    "payment": { "title": "Zahlungssicherheit", "recommendedHeading": "Empfohlene Zahlungsmethoden", "avoidHeading": "Zu vermeidende Zahlungsmethoden" },
    "buying": { "title": "Kauftipps" },
    "selling": { "title": "Verkaufstipps" },
    "shipping": { "title": "Versandsicherheit" },
    "redFlagsHeading": "Warnsignale, auf die du achten solltest",
    "report": { "title": "Verdächtige Aktivität melden", "body": "Wenn dir verdächtiges Verhalten, Betrugsversuche oder betrügerische Inserate auffallen, melde sie bitte sofort. Du kannst einzelne Nachrichten innerhalb von Unterhaltungen melden oder uns direkt kontaktieren.", "button": "Kontaktiere uns" },
    "inPersonTips": [
      "Triff dich an einem gut beleuchteten, öffentlichen Ort wie einem Parkplatz, einer Tankstelle oder einer Polizeiwache.",
      "Nimm zur Besichtigung einen Freund oder ein Familienmitglied mit.",
      "Sag jemandem, wohin du gehst und wann du zurück sein willst.",
      "Mach die Besichtigung bei Tageslicht, damit du das Auto richtig sehen kannst.",
      "Beim Fahrzeugkauf: Lass dir den Fahrzeugbrief (V5C) oder das Titeldokument zeigen und prüfe, ob es mit der Fahrgestellnummer/VIN übereinstimmt.",
      "Lass dir Zeit — ein seriöser Verkäufer drängt dich nicht zu einer Entscheidung."
    ],
    "recommendedPayments": [
      { "name": "Banküberweisung", "reason": "Direkt, nachvollziehbar und weit verbreitet. Prüfe die Empfängerdaten vor dem Senden sorgfältig." },
      { "name": "PayPal Waren & Dienstleistungen", "reason": "Bietet Käuferschutz für nicht erhaltene oder erheblich abweichende Artikel." },
      { "name": "Bargeld (persönlich)", "reason": "Nur für lokale Abholungen. Zähle sorgfältig und erwäge bei großen Beträgen einen Geldscheinprüfstift." },
      { "name": "Treuhanddienste (Escrow)", "reason": "Bei hochwertigen Transaktionen hält ein Treuhanddienst die Zahlung zurück, bis beide Parteien zufrieden sind." }
    ],
    "riskyPayments": [
      { "name": "Bargeldtransfer (Western Union, MoneyGram)", "reason": "Nach dem Senden kaum zurückzuholen. Eine bevorzugte Methode von Betrügern." },
      { "name": "Geschenkkarten oder Kryptowährung", "reason": "Nicht nachverfolgbar und unumkehrbar. Kein seriöser Verkäufer besteht darauf." },
      { "name": "PayPal Freunde & Familie", "reason": "Kein Käuferschutz — wird als Geschenk behandelt, nicht als Kauf." },
      { "name": "Schecks / Zahlungsanweisungen", "reason": "Können gefälscht werden. Wenn du einen annehmen musst, warte auf die vollständige Gutschrift, bevor du den Artikel herausgibst." }
    ],
    "buyingTips": [
      "Recherchiere den fairen Marktwert, bevor du ein Angebot machst. Sieh dir verkaufte Inserate auf The Mini Exchange zum Preisvergleich an.",
      "Bitte um detaillierte Fotos der bekannten Mini-Roststellen: Hilfsrahmen, A-Säulen-Bleche, vordere Bodenbleche, Schweller und hintere Schürze.",
      "Frage nach der Nummer des Heritage-Zertifikats und prüfe sie, wenn der Verkäufer behauptet, das Auto sei matching numbers.",
      "Bei Motoren und großen Komponenten: Frage nach der Motornummer und prüfe, ob die Serie zum angegebenen Hubraum passt.",
      "Wenn das Angebot zu gut klingt, um wahr zu sein, ist es das wahrscheinlich. Ein makelloser 1275 Cooper S unter Marktwert verdient besondere Aufmerksamkeit.",
      "Erwäge vor dem Kauf eines Fahrzeugs eine Ankaufsuntersuchung durch einen Classic-Mini-Spezialisten.",
      "Prüfe das Profil des Verkäufers — wie lange ist er schon Mitglied? Hat er abgeschlossene Verkäufe?"
    ],
    "sellingTips": [
      "Mach klare, gut beleuchtete Fotos aus mehreren Blickwinkeln. Käufer vertrauen detaillierter, ehrlicher Fotografie.",
      "Sei offen über Mängel, Rost oder Umbauten. Ehrlichkeit schafft Vertrauen und vermeidet spätere Streitigkeiten.",
      "Antworte zügig auf Anfragen — Käufer kaufen oft beim ersten Verkäufer, der antwortet.",
      "Setze einen fairen Preis auf Basis vergleichbarer verkaufter Inserate. Überteuerte Inserate bleiben liegen.",
      "Teile niemals persönliche Finanzdaten (Bank-Login, vollständige Kartennummern) mit Käufern.",
      "Bei versendeten Artikeln immer verfolgten und versicherten Versand nutzen. Teile dem Käufer die Sendungsnummer mit."
    ],
    "shippingTips": [
      "Nutze für Teile und Motoren immer verfolgten und versicherten Versand.",
      "Mach Fotos des verpackten, versandfertigen Artikels als Nachweis des Zustands beim Versand.",
      "Für Fahrzeuge einen seriösen geschlossenen Transportdienst nutzen und einen Frachtbrief (Bill of Lading) erhalten.",
      "Einigt euch vor Abschluss des Geschäfts darüber, wer die Versandkosten trägt.",
      "Teile die Sendungsnummer in deiner Mini-Exchange-Unterhaltung, um eine klare Dokumentation zu haben.",
      "Versende einen Artikel niemals, bevor die Zahlung bestätigt eingegangen ist."
    ],
    "redFlags": [
      "Der Verkäufer weigert sich, sich persönlich zu treffen oder das Fahrzeug vor der Zahlung zu zeigen.",
      "Druck, sofort zu zahlen, oder Dringlichkeitstaktiken wie „jemand anderes will es gleich kaufen“.",
      "Anfragen nach ungewöhnlichen Zahlungsmethoden wie Geschenkkarten, Krypto oder Bargeldtransfer.",
      "Der Preis liegt ohne klare Erklärung deutlich unter dem Marktwert.",
      "Schlechte oder Katalogfotos, die nicht zur Beschreibung passen.",
      "Der Verkäufer weicht konkreten Fragen zur Historie oder zum Zustand des Autos aus.",
      "Aufforderungen, die Unterhaltung außerhalb von The Mini Exchange per E-Mail, WhatsApp oder SMS fortzusetzen.",
      "Ein neu erstelltes Konto ohne Profilangaben oder Inseratshistorie.",
      "Die Fahrgestellnummer/VIN stimmt nicht mit dem Heritage-Zertifikat oder dem V5C-Fahrzeugbrief überein."
    ],
    "seo": { "title": "Sicherheitsleitfaden - The Mini Exchange", "description": "Tipps für den sicheren Kauf und Verkauf von Classic Minis auf The Mini Exchange. Erfahre mehr über sichere Zahlungsmethoden, persönliche Treffen und das Erkennen von Warnsignalen.", "ogDescription": "Bleib sicher beim Kauf und Verkauf von Classic Minis im Internet." }
  },
  "it": {
    "hero": { "title": "Guida alla sicurezza", "subtitle": "Consigli per comprare e vendere Classic Mini in sicurezza su The Mini Exchange." },
    "meeting": { "title": "Incontrarsi di persona" },
    "payment": { "title": "Sicurezza dei pagamenti", "recommendedHeading": "Metodi di pagamento consigliati", "avoidHeading": "Metodi di pagamento da evitare" },
    "buying": { "title": "Consigli per l'acquisto" },
    "selling": { "title": "Consigli per la vendita" },
    "shipping": { "title": "Sicurezza nelle spedizioni" },
    "redFlagsHeading": "Segnali d'allarme a cui prestare attenzione",
    "report": { "title": "Segnala attività sospette", "body": "Se noti comportamenti sospetti, tentativi di truffa o annunci fraudolenti, segnalali immediatamente. Puoi segnalare singoli messaggi all'interno delle conversazioni o contattarci direttamente.", "button": "Contattaci" },
    "inPersonTips": [
      "Incontratevi in un luogo pubblico e ben illuminato, come un parcheggio, una stazione di servizio o una stazione di polizia.",
      "Porta con te un amico o un familiare alla visione.",
      "Avvisa qualcuno di dove stai andando e a che ora prevedi di tornare.",
      "Fai l'ispezione durante le ore diurne per poter vedere bene l'auto.",
      "Se acquisti un veicolo, chiedi di vedere il libretto (V5C) o il documento di proprietà e verifica che corrisponda al numero di telaio/VIN.",
      "Prenditi il tuo tempo: un venditore serio non ti metterà fretta nel decidere."
    ],
    "recommendedPayments": [
      { "name": "Bonifico bancario", "reason": "Diretto, tracciabile e ampiamente accettato. Verifica con attenzione i dati del destinatario prima di inviare." },
      { "name": "PayPal Beni e Servizi", "reason": "Offre protezione all'acquirente per articoli non ricevuti o notevolmente diversi da quanto descritto." },
      { "name": "Contanti (di persona)", "reason": "Solo per ritiri locali. Conta con attenzione e valuta una penna rilevatore di banconote false per importi elevati." },
      { "name": "Servizi di deposito a garanzia (escrow)", "reason": "Per transazioni di alto valore, un servizio di escrow trattiene il pagamento finché entrambe le parti sono soddisfatte." }
    ],
    "riskyPayments": [
      { "name": "Trasferimento di denaro (Western Union, MoneyGram)", "reason": "Quasi impossibile da recuperare una volta inviato. Il metodo preferito dai truffatori." },
      { "name": "Carte regalo o criptovalute", "reason": "Non tracciabili e irreversibili. Nessun venditore serio insisterà per usarle." },
      { "name": "PayPal Amici e Famiglia", "reason": "Nessuna protezione per l'acquirente: trattato come un regalo, non un acquisto." },
      { "name": "Assegni / vaglia", "reason": "Possono essere falsificati. Se devi accettarne uno, attendi che sia completamente liquidato prima di consegnare l'articolo." }
    ],
    "buyingTips": [
      "Informati sul giusto valore di mercato prima di fare un'offerta. Controlla gli annunci venduti su The Mini Exchange per confrontare i prezzi.",
      "Chiedi foto dettagliate dei punti di ruggine tipici del Mini: telaietti, pannelli A, pianali anteriori, sottoporta e pannello posteriore.",
      "Richiedi il numero del Certificato Heritage e verificalo se il venditore afferma che l'auto è matching-numbers.",
      "Per motori e componenti importanti, chiedi il numero della targhetta motore e verifica che la serie corrisponda alla cilindrata dichiarata.",
      "Se l'affare sembra troppo bello per essere vero, probabilmente lo è. Una 1275 Cooper S immacolata sotto il prezzo di mercato merita attenzione particolare.",
      "Valuta un'ispezione pre-acquisto da parte di uno specialista Classic Mini prima di impegnarti nell'acquisto di un veicolo.",
      "Controlla il profilo del venditore: da quanto tempo è membro? Ha vendite completate?"
    ],
    "sellingTips": [
      "Scatta foto nitide e ben illuminate da più angolazioni. Gli acquirenti si fidano di una fotografia dettagliata e onesta.",
      "Sii trasparente su eventuali difetti, ruggine o modifiche. L'onestà crea fiducia ed evita contestazioni in seguito.",
      "Rispondi prontamente alle richieste: gli acquirenti spesso comprano dal primo venditore che risponde.",
      "Fissa un prezzo equo in base ad annunci venduti comparabili. Un prezzo troppo alto fa ristagnare l'annuncio.",
      "Non condividere mai dati finanziari personali (accesso bancario, numeri completi di carta) con gli acquirenti.",
      "Per gli articoli spediti, usa sempre una spedizione tracciata e assicurata. Comunica il numero di tracciamento all'acquirente."
    ],
    "shippingTips": [
      "Usa sempre spedizioni tracciate e assicurate per ricambi e motori.",
      "Scatta foto dell'articolo imballato e pronto per la spedizione come prova delle condizioni alla partenza.",
      "Per i veicoli, usa un servizio di trasporto chiuso affidabile e ottieni una polizza di carico (Bill of Lading).",
      "Accordatevi su chi paga le spese di spedizione prima di concludere l'affare.",
      "Condividi il numero di tracciamento nella tua conversazione Mini Exchange per avere una traccia chiara.",
      "Non spedire mai un articolo prima di aver confermato che il pagamento è andato a buon fine."
    ],
    "redFlags": [
      "Il venditore rifiuta di incontrarsi di persona o di mostrare il veicolo prima del pagamento.",
      "Pressioni a pagare subito o tattiche d'urgenza del tipo «qualcun altro sta per comprarlo».",
      "Richieste di metodi di pagamento insoliti come carte regalo, cripto o trasferimenti di denaro.",
      "Il prezzo è nettamente inferiore al valore di mercato senza una spiegazione chiara.",
      "Foto di scarsa qualità o di repertorio che non corrispondono alla descrizione.",
      "Il venditore evita di rispondere a domande precise sulla storia o sulle condizioni dell'auto.",
      "Richieste di spostare la conversazione fuori da The Mini Exchange su e-mail, WhatsApp o SMS.",
      "Un account creato di recente senza informazioni di profilo né storico di annunci.",
      "Il numero di telaio/VIN non corrisponde al Certificato Heritage o al libretto V5C."
    ],
    "seo": { "title": "Guida alla sicurezza - The Mini Exchange", "description": "Consigli per comprare e vendere Classic Mini in sicurezza su The Mini Exchange. Scopri i metodi di pagamento sicuri, gli incontri di persona e come riconoscere i segnali d'allarme.", "ogDescription": "Resta al sicuro quando compri e vendi Classic Mini online." }
  },
  "pt": {
    "hero": { "title": "Guia de segurança", "subtitle": "Dicas para comprar e vender Classic Minis com segurança no The Mini Exchange." },
    "meeting": { "title": "Encontrar-se pessoalmente" },
    "payment": { "title": "Segurança nos pagamentos", "recommendedHeading": "Métodos de pagamento recomendados", "avoidHeading": "Métodos de pagamento a evitar" },
    "buying": { "title": "Dicas de compra" },
    "selling": { "title": "Dicas de venda" },
    "shipping": { "title": "Segurança no envio" },
    "redFlagsHeading": "Sinais de alerta a observar",
    "report": { "title": "Denuncie atividade suspeita", "body": "Se encontrar comportamento suspeito, tentativas de golpe ou anúncios fraudulentos, denuncie imediatamente. Você pode denunciar mensagens individuais dentro das conversas ou entrar em contato conosco diretamente.", "button": "Fale conosco" },
    "inPersonTips": [
      "Encontre-se em um local público e bem iluminado, como um estacionamento, posto de combustível ou delegacia.",
      "Leve um amigo ou familiar para a visita.",
      "Avise alguém para onde você vai e a que horas pretende voltar.",
      "Faça a inspeção à luz do dia para conseguir ver bem o carro.",
      "Se comprar um veículo, peça para ver o documento (V5C/CRLV) ou título e verifique se corresponde ao número de chassi/VIN.",
      "Não tenha pressa — um vendedor legítimo não vai apressar a sua decisão."
    ],
    "recommendedPayments": [
      { "name": "Transferência bancária", "reason": "Direta, rastreável e amplamente aceita. Verifique os dados do destinatário com cuidado antes de enviar." },
      { "name": "PayPal Bens e Serviços", "reason": "Oferece proteção ao comprador para itens não recebidos ou muito diferentes do descrito." },
      { "name": "Dinheiro (pessoalmente)", "reason": "Apenas para retiradas locais. Conte com cuidado e considere uma caneta detectora de notas falsas para grandes quantias." },
      { "name": "Serviços de custódia (escrow)", "reason": "Para transações de alto valor, um serviço de escrow retém o pagamento até que ambas as partes estejam satisfeitas." }
    ],
    "riskyPayments": [
      { "name": "Transferência de dinheiro (Western Union, MoneyGram)", "reason": "Quase impossível de recuperar depois de enviada. O método favorito dos golpistas." },
      { "name": "Cartões-presente ou criptomoedas", "reason": "Irrastreáveis e irreversíveis. Nenhum vendedor legítimo insistirá nesses meios." },
      { "name": "PayPal Amigos e Família", "reason": "Sem proteção ao comprador — tratado como presente, não como compra." },
      { "name": "Cheques / ordens de pagamento", "reason": "Podem ser falsificados. Se precisar aceitar um, espere a compensação total antes de entregar o item." }
    ],
    "buyingTips": [
      "Pesquise o valor justo de mercado antes de fazer uma oferta. Confira anúncios vendidos no The Mini Exchange para comparar preços.",
      "Peça fotos detalhadas dos pontos de ferrugem conhecidos do Mini: subchassis, painéis A, assoalhos dianteiros, soleiras e painel traseiro.",
      "Solicite o número do Certificado Heritage e verifique-o se o vendedor afirmar que o carro é matching-numbers.",
      "Para motores e componentes principais, peça o número da placa do motor e verifique se a série corresponde à cilindrada informada.",
      "Se o negócio parece bom demais para ser verdade, provavelmente é. Um 1275 Cooper S impecável abaixo do preço de mercado merece atenção extra.",
      "Considere uma inspeção pré-compra por um especialista em Classic Mini antes de se comprometer com a compra de um veículo.",
      "Verifique o perfil do vendedor — há quanto tempo é membro? Tem vendas concluídas?"
    ],
    "sellingTips": [
      "Tire fotos nítidas e bem iluminadas de vários ângulos. Os compradores confiam em uma fotografia detalhada e honesta.",
      "Seja transparente sobre quaisquer problemas, ferrugem ou modificações. A honestidade gera confiança e evita disputas depois.",
      "Responda às perguntas com rapidez — os compradores muitas vezes compram do primeiro vendedor que responde.",
      "Defina um preço justo com base em anúncios vendidos comparáveis. Preços altos demais deixam o anúncio parado.",
      "Nunca compartilhe dados financeiros pessoais (acesso bancário, números completos de cartão) com os compradores.",
      "Para itens enviados, use sempre envio rastreado e segurado. Compartilhe o número de rastreamento com o comprador."
    ],
    "shippingTips": [
      "Use sempre envio rastreado e segurado para peças e motores.",
      "Tire fotos do item embalado e pronto para envio como prova das condições na expedição.",
      "Para veículos, use um serviço de transporte fechado confiável e obtenha um conhecimento de embarque (Bill of Lading).",
      "Combinem quem paga o frete antes de fechar o negócio.",
      "Compartilhe o número de rastreamento na sua conversa do Mini Exchange para manter um registro claro.",
      "Nunca envie um item antes de confirmar que o pagamento foi compensado."
    ],
    "redFlags": [
      "O vendedor se recusa a encontrar-se pessoalmente ou a mostrar o veículo antes do pagamento.",
      "Pressão para pagar imediatamente ou táticas de urgência do tipo «outra pessoa está prestes a comprar».",
      "Pedidos de métodos de pagamento incomuns como cartões-presente, cripto ou transferências de dinheiro.",
      "O preço está muito abaixo do valor de mercado sem uma explicação clara.",
      "Fotos de baixa qualidade ou de catálogo que não correspondem à descrição.",
      "O vendedor evita responder a perguntas específicas sobre o histórico ou o estado do carro.",
      "Pedidos para mover a conversa para fora do The Mini Exchange para e-mail, WhatsApp ou mensagem.",
      "Uma conta recém-criada sem informações de perfil nem histórico de anúncios.",
      "O número de chassi/VIN não corresponde ao Certificado Heritage ou ao documento V5C."
    ],
    "seo": { "title": "Guia de segurança - The Mini Exchange", "description": "Dicas para comprar e vender Classic Minis com segurança no The Mini Exchange. Saiba mais sobre métodos de pagamento seguros, encontros pessoais e como identificar sinais de alerta.", "ogDescription": "Mantenha-se seguro ao comprar e vender Classic Minis online." }
  },
  "ru": {
    "hero": { "title": "Руководство по безопасности", "subtitle": "Советы по безопасной покупке и продаже Classic Mini на The Mini Exchange." },
    "meeting": { "title": "Личная встреча" },
    "payment": { "title": "Безопасность платежей", "recommendedHeading": "Рекомендуемые способы оплаты", "avoidHeading": "Способы оплаты, которых стоит избегать" },
    "buying": { "title": "Советы покупателю" },
    "selling": { "title": "Советы продавцу" },
    "shipping": { "title": "Безопасность доставки" },
    "redFlagsHeading": "Тревожные признаки, на которые стоит обратить внимание",
    "report": { "title": "Сообщить о подозрительной активности", "body": "Если вы столкнулись с подозрительным поведением, попытками мошенничества или поддельными объявлениями, немедленно сообщите об этом. Вы можете пожаловаться на отдельные сообщения в переписке или связаться с нами напрямую.", "button": "Связаться с нами" },
    "inPersonTips": [
      "Встречайтесь в хорошо освещённом общественном месте — на парковке, заправке или у отделения полиции.",
      "Возьмите с собой на осмотр друга или родственника.",
      "Сообщите кому-нибудь, куда вы едете и когда планируете вернуться.",
      "Проводите осмотр в светлое время суток, чтобы хорошо рассмотреть машину.",
      "При покупке автомобиля попросите показать техпаспорт (V5C) или документ о праве собственности и убедитесь, что он совпадает с номером кузова/VIN.",
      "Не торопитесь — добросовестный продавец не будет подгонять вас с решением."
    ],
    "recommendedPayments": [
      { "name": "Банковский перевод", "reason": "Прямой, отслеживаемый и широко принимаемый. Перед отправкой тщательно проверьте реквизиты получателя." },
      { "name": "PayPal «Товары и услуги»", "reason": "Обеспечивает защиту покупателя для не полученных или существенно не соответствующих описанию товаров." },
      { "name": "Наличные (лично)", "reason": "Только для местных сделок. Считайте внимательно и при крупных суммах используйте детектор фальшивых купюр." },
      { "name": "Эскроу-сервисы", "reason": "Для дорогих сделок эскроу удерживает платёж, пока обе стороны не будут удовлетворены." }
    ],
    "riskyPayments": [
      { "name": "Денежные переводы (Western Union, MoneyGram)", "reason": "После отправки вернуть почти невозможно. Любимый способ мошенников." },
      { "name": "Подарочные карты или криптовалюта", "reason": "Не отслеживаются и необратимы. Ни один добросовестный продавец не настаивает на них." },
      { "name": "PayPal «Друзьям и близким»", "reason": "Без защиты покупателя — считается подарком, а не покупкой." },
      { "name": "Чеки / денежные ордера", "reason": "Могут быть поддельными. Если приходится принять, дождитесь полного зачисления, прежде чем отдавать товар." }
    ],
    "buyingTips": [
      "Изучите справедливую рыночную цену перед тем, как сделать предложение. Сравните цены по проданным объявлениям на The Mini Exchange.",
      "Попросите подробные фото известных мест коррозии Mini: подрамников, панелей A, передних полов, порогов и задней панели.",
      "Запросите номер сертификата Heritage и проверьте его, если продавец утверждает, что у машины оригинальные номера.",
      "Для двигателей и крупных узлов попросите номер на табличке двигателя и проверьте, соответствует ли серия заявленному объёму.",
      "Если сделка кажется слишком выгодной, чтобы быть правдой, скорее всего, так и есть. Безупречный 1275 Cooper S по цене ниже рыночной требует особого внимания.",
      "Перед покупкой автомобиля подумайте о предпродажной проверке у специалиста по Classic Mini.",
      "Проверьте профиль продавца — как давно он зарегистрирован? Есть ли у него завершённые продажи?"
    ],
    "sellingTips": [
      "Делайте чёткие, хорошо освещённые фото с разных ракурсов. Покупатели доверяют подробной и честной съёмке.",
      "Честно расскажите о любых проблемах, коррозии или доработках. Честность вызывает доверие и предотвращает споры в дальнейшем.",
      "Отвечайте на запросы быстро — покупатели часто берут у первого ответившего продавца.",
      "Установите справедливую цену на основе сопоставимых проданных объявлений. Завышенная цена приводит к «зависанию» объявления.",
      "Никогда не сообщайте покупателям личные финансовые данные (доступ к банку, полные номера карт).",
      "Для отправляемых товаров всегда используйте доставку с отслеживанием и страховкой. Сообщите покупателю трек-номер."
    ],
    "shippingTips": [
      "Для запчастей и двигателей всегда используйте доставку с отслеживанием и страховкой.",
      "Сфотографируйте упакованный и готовый к отправке товар как доказательство его состояния при отправке.",
      "Для автомобилей используйте надёжную закрытую транспортную службу и получите транспортную накладную (Bill of Lading).",
      "Договоритесь, кто оплачивает доставку, до завершения сделки.",
      "Сообщите трек-номер в переписке Mini Exchange, чтобы оставить чёткую запись.",
      "Никогда не отправляйте товар до подтверждения зачисления оплаты."
    ],
    "redFlags": [
      "Продавец отказывается встретиться лично или показать автомобиль до оплаты.",
      "Давление с требованием оплатить немедленно или приёмы срочности вроде «кто-то другой вот-вот купит».",
      "Просьбы об необычных способах оплаты — подарочных картах, крипте или денежных переводах.",
      "Цена значительно ниже рыночной без внятного объяснения.",
      "Некачественные или стоковые фото, не соответствующие описанию.",
      "Продавец уходит от конкретных вопросов об истории или состоянии машины.",
      "Просьбы перенести общение за пределы The Mini Exchange — в почту, WhatsApp или СМС.",
      "Недавно созданный аккаунт без информации в профиле и истории объявлений.",
      "Номер кузова/VIN не совпадает с сертификатом Heritage или техпаспортом V5C."
    ],
    "seo": { "title": "Руководство по безопасности - The Mini Exchange", "description": "Советы по безопасной покупке и продаже Classic Mini на The Mini Exchange. Узнайте о безопасных способах оплаты, личных встречах и распознавании тревожных признаков.", "ogDescription": "Будьте в безопасности при покупке и продаже Classic Mini онлайн." }
  },
  "ja": {
    "hero": { "title": "安全ガイド", "subtitle": "The Mini Exchange で Classic Mini を安全に売買するためのヒント。" },
    "meeting": { "title": "直接会うとき" },
    "payment": { "title": "支払いの安全", "recommendedHeading": "推奨される支払い方法", "avoidHeading": "避けるべき支払い方法" },
    "buying": { "title": "購入のヒント" },
    "selling": { "title": "販売のヒント" },
    "shipping": { "title": "配送の安全" },
    "redFlagsHeading": "注意すべき危険サイン",
    "report": { "title": "不審な行為を報告する", "body": "不審な行動、詐欺の試み、または虚偽の出品を見つけた場合は、すぐに報告してください。会話内の個々のメッセージを報告するか、直接お問い合わせいただけます。", "button": "お問い合わせ" },
    "inPersonTips": [
      "駐車場、ガソリンスタンド、警察署など、明るく人目のある公共の場所で会いましょう。",
      "下見には友人や家族に同行してもらいましょう。",
      "どこへ行き、いつ戻る予定かを誰かに伝えておきましょう。",
      "車をきちんと確認できるよう、日中の明るい時間に点検しましょう。",
      "車両を購入する場合は登録証（V5C）または所有権書類を見せてもらい、車台番号/VIN と一致するか確認しましょう。",
      "焦らず時間をかけましょう。まともな売り手が決断を急かすことはありません。"
    ],
    "recommendedPayments": [
      { "name": "銀行振込", "reason": "直接的で追跡可能、広く受け入れられています。送金前に受取人情報を慎重に確認しましょう。" },
      { "name": "PayPal（商品・サービス）", "reason": "商品が届かない場合や説明と大きく異なる場合に購入者保護が受けられます。" },
      { "name": "現金（手渡し）", "reason": "地元での引き取りのみ。慎重に数え、高額の場合は偽造紙幣検知ペンの利用を検討しましょう。" },
      { "name": "エスクローサービス", "reason": "高額取引では、両者が納得するまでエスクローが代金を預かります。" }
    ],
    "riskyPayments": [
      { "name": "送金サービス（Western Union、MoneyGram）", "reason": "送金後の回収はほぼ不可能。詐欺師が好む手口です。" },
      { "name": "ギフトカードや暗号資産", "reason": "追跡不能で取り消し不可。まともな売り手が要求することはありません。" },
      { "name": "PayPal（友人・家族）", "reason": "購入者保護なし。購入ではなく贈与として扱われます。" },
      { "name": "小切手／マネーオーダー", "reason": "偽造される恐れがあります。受け取らざるを得ない場合は、完全に決済されてから商品を渡しましょう。" }
    ],
    "buyingTips": [
      "オファーを出す前に適正な市場価格を調べましょう。The Mini Exchange の売却済み出品で相場を確認できます。",
      "サブフレーム、A パネル、フロントフロア、シル、リアバランスなど、Mini で錆びやすい箇所の詳細な写真を求めましょう。",
      "売り手がマッチングナンバーだと主張する場合は、Heritage 証明書の番号を求めて確認しましょう。",
      "エンジンや主要部品については、エンジンプレート番号を求め、シリーズが表示の排気量と一致するか確認しましょう。",
      "話がうますぎる場合は、たいてい裏があります。相場以下の極上 1275 Cooper S は特に注意が必要です。",
      "車両購入を決める前に、Classic Mini 専門家による購入前点検を検討しましょう。",
      "売り手のプロフィールを確認しましょう。会員歴はどれくらいか、取引成立の実績はあるか。"
    ],
    "sellingTips": [
      "複数の角度から、明るく鮮明な写真を撮りましょう。買い手は詳細で正直な写真を信頼します。",
      "不具合、錆、改造などは正直に伝えましょう。誠実さは信頼を生み、後のトラブルを防ぎます。",
      "問い合わせには素早く返信しましょう。買い手は最初に返信した売り手から購入することが多いです。",
      "売却済みの類似出品を参考に適正価格を設定しましょう。高すぎる価格は出品の停滞を招きます。",
      "銀行ログインやカード番号全桁など、個人の金融情報を買い手に決して教えないでください。",
      "発送品には必ず追跡・保険付きの配送を使い、追跡番号を買い手と共有しましょう。"
    ],
    "shippingTips": [
      "部品やエンジンには必ず追跡・保険付きの配送を使いましょう。",
      "発送時の状態の証拠として、梱包して発送準備が整った商品の写真を撮りましょう。",
      "車両には信頼できる密閉型輸送サービスを使い、船荷証券（Bill of Lading）を取得しましょう。",
      "取引を確定する前に、送料をどちらが負担するか合意しましょう。",
      "明確な記録のため、追跡番号を Mini Exchange の会話内で共有しましょう。",
      "支払いの入金が確認できるまで、決して商品を発送しないでください。"
    ],
    "redFlags": [
      "売り手が支払い前に直接会うことや車両を見せることを拒む。",
      "すぐ支払うよう迫る、または「他の人が今にも買おうとしている」といった切迫感をあおる手口。",
      "ギフトカード、暗号資産、送金サービスなど、通常と異なる支払い方法を要求する。",
      "明確な理由もなく価格が市場価値を大きく下回っている。",
      "説明と一致しない、低品質または既製の写真。",
      "車の来歴や状態に関する具体的な質問への回答を避ける。",
      "会話を The Mini Exchange の外（メール、WhatsApp、SMS）へ移そうとする。",
      "プロフィール情報も出品履歴もない、新規作成されたばかりのアカウント。",
      "車台番号/VIN が Heritage 証明書や V5C 登録証と一致しない。"
    ],
    "seo": { "title": "安全ガイド - The Mini Exchange", "description": "The Mini Exchange で Classic Mini を安全に売買するためのヒント。安全な支払い方法、対面での取引、危険サインの見分け方を解説します。", "ogDescription": "オンラインで Classic Mini を売買する際に安全を守りましょう。" }
  },
  "zh": {
    "hero": { "title": "安全指南", "subtitle": "在 The Mini Exchange 上安全买卖 Classic Mini 的实用建议。" },
    "meeting": { "title": "当面交易" },
    "payment": { "title": "支付安全", "recommendedHeading": "推荐的支付方式", "avoidHeading": "应避免的支付方式" },
    "buying": { "title": "购买建议" },
    "selling": { "title": "出售建议" },
    "shipping": { "title": "运输安全" },
    "redFlagsHeading": "需要警惕的危险信号",
    "report": { "title": "举报可疑活动", "body": "如果你遇到可疑行为、诈骗企图或虚假商品，请立即举报。你可以在对话中举报单条消息，或直接联系我们。", "button": "联系我们" },
    "inPersonTips": [
      "在光线充足的公共场所见面，例如停车场、加油站或警察局。",
      "看车时带上一位朋友或家人。",
      "告诉他人你要去哪里以及预计何时返回。",
      "在白天进行检查，以便看清车辆。",
      "购买车辆时，要求查看行驶证（V5C）或所有权文件，并核对其与车架号/VIN 是否一致。",
      "不要着急——正规卖家不会催你做决定。"
    ],
    "recommendedPayments": [
      { "name": "银行转账", "reason": "直接、可追踪且被广泛接受。转账前请仔细核对收款人信息。" },
      { "name": "PayPal 商品与服务", "reason": "对未收到或与描述严重不符的商品提供买家保护。" },
      { "name": "现金（当面）", "reason": "仅限本地自提。仔细清点，大额时可考虑使用验钞笔。" },
      { "name": "第三方托管服务", "reason": "对于高价值交易，托管服务会保留款项，直到双方都满意为止。" }
    ],
    "riskyPayments": [
      { "name": "汇款（Western Union、MoneyGram）", "reason": "一旦汇出几乎无法追回，是骗子最常用的手段。" },
      { "name": "礼品卡或加密货币", "reason": "无法追踪且不可逆。正规卖家不会坚持使用这些方式。" },
      { "name": "PayPal 亲友付款", "reason": "没有买家保护——会被视为赠与而非购买。" },
      { "name": "支票／汇票", "reason": "可能被伪造。如果必须接受，请等到完全到账后再交付商品。" }
    ],
    "buyingTips": [
      "出价前先了解公允的市场价值。可在 The Mini Exchange 上查看已售商品以比较价格。",
      "索取 Mini 已知锈点的详细照片：副车架、A 柱板、前地板、门槛和后裙板。",
      "如果卖家声称车辆为原厂编号一致（matching-numbers），请索取并核实 Heritage 证书编号。",
      "对于发动机和主要部件，索取发动机铭牌号，并核对系列是否与所称排量相符。",
      "如果交易好得令人难以置信，那多半有问题。一辆低于市价的完美 1275 Cooper S 值得格外审查。",
      "在决定购买车辆前，可考虑请 Classic Mini 专家进行购前检查。",
      "查看卖家资料——他成为会员多久了？是否有已完成的交易？"
    ],
    "sellingTips": [
      "从多个角度拍摄清晰、光线充足的照片。买家信任细致、诚实的照片。",
      "如实说明任何问题、锈蚀或改装。诚实能建立信任，避免日后纠纷。",
      "及时回复咨询——买家往往会向第一个回复的卖家购买。",
      "参考可比的已售商品设定合理售价。定价过高会让商品长期无人问津。",
      "切勿向买家透露个人财务信息（银行登录、完整卡号）。",
      "对于寄送的商品，务必使用可追踪并投保的运输，并将运单号告知买家。"
    ],
    "shippingTips": [
      "零件和发动机始终使用可追踪并投保的运输。",
      "拍摄已包装、准备发货的商品照片，作为发货时状态的证明。",
      "对于车辆，使用信誉良好的封闭式运输服务，并取得提单（Bill of Lading）。",
      "在敲定交易前先就运费由谁承担达成一致。",
      "在 Mini Exchange 对话中共享运单号，以便留下清晰记录。",
      "在确认款项到账前，切勿发货。"
    ],
    "redFlags": [
      "卖家拒绝当面交易或在付款前展示车辆。",
      "施压要求立即付款，或使用「别人马上就要买了」之类的紧迫话术。",
      "要求使用礼品卡、加密货币或汇款等异常的支付方式。",
      "价格明显低于市场价值却没有合理解释。",
      "照片质量差或为网络图片，与描述不符。",
      "卖家回避关于车辆历史或状况的具体问题。",
      "要求将对话转移到 The Mini Exchange 之外，如邮件、WhatsApp 或短信。",
      "新创建的账户，没有任何资料信息或商品历史。",
      "车架号/VIN 与 Heritage 证书或 V5C 行驶证不符。"
    ],
    "seo": { "title": "安全指南 - The Mini Exchange", "description": "在 The Mini Exchange 上安全买卖 Classic Mini 的实用建议。了解安全的支付方式、当面交易以及如何识别危险信号。", "ogDescription": "在网上买卖 Classic Mini 时保持安全。" }
  },
  "ko": {
    "hero": { "title": "안전 가이드", "subtitle": "The Mini Exchange에서 Classic Mini를 안전하게 사고팔기 위한 팁." },
    "meeting": { "title": "직접 만나기" },
    "payment": { "title": "결제 안전", "recommendedHeading": "권장 결제 수단", "avoidHeading": "피해야 할 결제 수단" },
    "buying": { "title": "구매 팁" },
    "selling": { "title": "판매 팁" },
    "shipping": { "title": "배송 안전" },
    "redFlagsHeading": "주의해야 할 위험 신호",
    "report": { "title": "의심스러운 활동 신고", "body": "의심스러운 행동, 사기 시도 또는 허위 매물을 발견하면 즉시 신고해 주세요. 대화 내 개별 메시지를 신고하거나 저희에게 직접 문의하실 수 있습니다.", "button": "문의하기" },
    "inPersonTips": [
      "주차장, 주유소, 경찰서처럼 밝고 사람이 많은 공공장소에서 만나세요.",
      "차를 보러 갈 때는 친구나 가족과 함께 가세요.",
      "어디로 가는지, 언제 돌아올 예정인지 누군가에게 알려두세요.",
      "차를 제대로 볼 수 있도록 낮 시간에 점검하세요.",
      "차량을 구매한다면 등록증(V5C)이나 소유권 서류를 보여달라고 요청하고, 차대번호/VIN과 일치하는지 확인하세요.",
      "서두르지 마세요. 정직한 판매자는 결정을 재촉하지 않습니다."
    ],
    "recommendedPayments": [
      { "name": "계좌 이체", "reason": "직접적이고 추적 가능하며 널리 사용됩니다. 보내기 전에 수취인 정보를 꼼꼼히 확인하세요." },
      { "name": "PayPal 상품 및 서비스", "reason": "물품 미수령 또는 설명과 크게 다른 경우 구매자 보호를 제공합니다." },
      { "name": "현금(직접)", "reason": "현지 수령에만 사용하세요. 신중히 세고, 큰 금액일 때는 위조지폐 감별 펜을 고려하세요." },
      { "name": "에스크로 서비스", "reason": "고액 거래에서는 양측이 만족할 때까지 에스크로가 대금을 보관합니다." }
    ],
    "riskyPayments": [
      { "name": "송금 서비스(Western Union, MoneyGram)", "reason": "보낸 뒤에는 회수가 거의 불가능합니다. 사기꾼이 선호하는 방법입니다." },
      { "name": "기프트 카드 또는 암호화폐", "reason": "추적 불가능하고 되돌릴 수 없습니다. 정직한 판매자는 이를 고집하지 않습니다." },
      { "name": "PayPal 친구 및 가족", "reason": "구매자 보호가 없습니다. 구매가 아닌 선물로 처리됩니다." },
      { "name": "수표 / 우편환", "reason": "위조될 수 있습니다. 부득이 받아야 한다면 완전히 결제된 뒤에 물품을 넘기세요." }
    ],
    "buyingTips": [
      "제안하기 전에 적정 시세를 조사하세요. The Mini Exchange의 판매 완료 매물에서 가격을 비교할 수 있습니다.",
      "서브프레임, A 패널, 앞 바닥, 사이드실, 뒤 밸런스 등 Mini의 알려진 부식 부위 사진을 자세히 요청하세요.",
      "판매자가 매칭 넘버라고 주장하면 Heritage 인증서 번호를 요청하고 확인하세요.",
      "엔진과 주요 부품의 경우 엔진 플레이트 번호를 요청하고, 시리즈가 표시된 배기량과 일치하는지 확인하세요.",
      "거래가 너무 좋아 보이면 대개 함정이 있습니다. 시세보다 싼 완벽한 1275 Cooper S는 특히 주의 깊게 살펴보세요.",
      "차량 구매를 결정하기 전에 Classic Mini 전문가의 구매 전 점검을 고려하세요.",
      "판매자 프로필을 확인하세요. 회원 가입 기간은 얼마나 되는지, 완료된 판매 내역이 있는지 살펴보세요."
    ],
    "sellingTips": [
      "여러 각도에서 선명하고 밝은 사진을 찍으세요. 구매자는 자세하고 정직한 사진을 신뢰합니다.",
      "결함, 부식, 개조 사항을 솔직하게 밝히세요. 정직함은 신뢰를 쌓고 나중의 분쟁을 막아줍니다.",
      "문의에 신속히 답하세요. 구매자는 종종 먼저 답한 판매자에게서 구매합니다.",
      "비슷한 판매 완료 매물을 참고해 합리적인 가격을 정하세요. 너무 비싸면 매물이 묵게 됩니다.",
      "은행 로그인, 전체 카드 번호 등 개인 금융 정보를 절대 구매자와 공유하지 마세요.",
      "배송 물품에는 항상 추적 및 보험이 포함된 배송을 사용하고, 운송장 번호를 구매자와 공유하세요."
    ],
    "shippingTips": [
      "부품과 엔진에는 항상 추적 및 보험이 포함된 배송을 사용하세요.",
      "발송 시 상태 증거로 포장되어 배송 준비가 된 물품의 사진을 찍으세요.",
      "차량의 경우 신뢰할 수 있는 밀폐형 운송 서비스를 이용하고 선하증권(Bill of Lading)을 받으세요.",
      "거래를 확정하기 전에 배송비를 누가 부담할지 합의하세요.",
      "명확한 기록을 위해 Mini Exchange 대화에서 운송장 번호를 공유하세요.",
      "결제가 완료된 것을 확인하기 전에는 절대 물품을 발송하지 마세요."
    ],
    "redFlags": [
      "판매자가 직접 만나기를 거부하거나 결제 전에 차량 보여주기를 거부합니다.",
      "즉시 결제하라는 압박, 또는 '다른 사람이 곧 사려 한다'는 식의 긴박감 조성 수법.",
      "기프트 카드, 암호화폐, 송금 등 비정상적인 결제 수단 요청.",
      "명확한 설명 없이 가격이 시세보다 크게 낮습니다.",
      "설명과 일치하지 않는 저화질 또는 인터넷 사진.",
      "판매자가 차량 이력이나 상태에 대한 구체적인 질문을 회피합니다.",
      "대화를 이메일, WhatsApp, 문자 등 The Mini Exchange 밖으로 옮기려는 요청.",
      "프로필 정보나 매물 이력이 전혀 없는 갓 만든 계정.",
      "차대번호/VIN이 Heritage 인증서나 V5C 등록증과 일치하지 않습니다."
    ],
    "seo": { "title": "안전 가이드 - The Mini Exchange", "description": "The Mini Exchange에서 Classic Mini를 안전하게 사고팔기 위한 팁. 안전한 결제 수단, 대면 거래, 위험 신호 식별 방법을 알아보세요.", "ogDescription": "온라인에서 Classic Mini를 사고팔 때 안전을 지키세요." }
  }
}
</i18n>
