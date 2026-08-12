<template>
  <div class="text-center py-8">
    <!-- Loading State -->
    <div v-if="!submissionComplete" class="space-y-4">
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <p class="text-lg">{{ t('submitting') }}</p>
    </div>

    <!-- Success State -->
    <div v-else class="space-y-6">
      <div class="inline-flex items-center justify-center w-20 h-20 bg-success/10 rounded-full">
        <i class="fas fa-circle-check text-5xl text-success"></i>
      </div>

      <div>
        <h2 class="text-2xl font-bold mb-2">{{ t('submitted') }}</h2>
        <p class="text-base-content/70">
          {{ comped ? t('subtitle.comped') : tier === 'paid' ? t('subtitle.paid') : t('subtitle.free') }}
        </p>
      </div>

      <!-- Next Steps -->
      <div class="card bg-base-200 text-left max-w-md mx-auto">
        <div class="card-body">
          <h3 class="font-bold mb-4">{{ t('nextSteps.heading') }}</h3>

          <!-- Comped Premium (Sustaining Member).
               Step order is deliberate: the premium grant is immediate, but the
               listing still goes through moderation like every other one, so
               review comes BEFORE going live. This block used to promise "Live
               Now / visible to all buyers", which was wrong on both counts and
               is what made sellers think an approved-and-live listing had
               vanished the next day. -->
          <div v-if="comped" class="space-y-3">
            <div class="flex items-start gap-3">
              <div class="badge badge-primary badge-sm mt-1">1</div>
              <div>
                <p class="font-medium">{{ t('comped.premiumApplied.title') }}</p>
                <p class="text-sm text-base-content/70">{{ t('comped.premiumApplied.desc') }}</p>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <div class="badge badge-primary badge-sm mt-1">2</div>
              <div>
                <p class="font-medium">{{ t('comped.review.title') }}</p>
                <p class="text-sm text-base-content/70">{{ t('comped.review.desc') }}</p>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <div class="badge badge-ghost badge-sm mt-1">3</div>
              <div>
                <p class="font-medium">{{ t('comped.featured.title') }}</p>
                <p class="text-sm text-base-content/70">{{ t('comped.featured.desc') }}</p>
              </div>
            </div>
          </div>

          <div v-else-if="tier === 'paid'" class="space-y-3">
            <div class="flex items-start gap-3">
              <div class="badge badge-primary badge-sm mt-1">1</div>
              <div>
                <p class="font-medium">{{ t('paid.payment.title') }}</p>
                <p class="text-sm text-base-content/70">{{ t('paid.payment.desc') }}</p>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <div class="badge badge-ghost badge-sm mt-1">2</div>
              <div>
                <p class="font-medium">{{ t('paid.review.title') }}</p>
                <p class="text-sm text-base-content/70">{{ t('paid.review.desc') }}</p>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <div class="badge badge-ghost badge-sm mt-1">3</div>
              <div>
                <p class="font-medium">{{ t('paid.live.title') }}</p>
                <p class="text-sm text-base-content/70">{{ t('paid.live.desc') }}</p>
              </div>
            </div>
          </div>

          <div v-else class="space-y-3">
            <div class="flex items-start gap-3">
              <div class="badge badge-primary badge-sm mt-1">1</div>
              <div>
                <p class="font-medium">{{ t('free.review.title') }}</p>
                <p class="text-sm text-base-content/70">{{ t('free.review.desc') }}</p>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <div class="badge badge-ghost badge-sm mt-1">2</div>
              <div>
                <p class="font-medium">{{ t('free.email.title') }}</p>
                <p class="text-sm text-base-content/70">{{ t('free.email.desc') }}</p>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <div class="badge badge-ghost badge-sm mt-1">3</div>
              <div>
                <p class="font-medium">{{ t('free.live.title') }}</p>
                <p class="text-sm text-base-content/70">{{ t('free.live.desc') }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-col sm:flex-row gap-4 justify-center pt-4">
        <a v-if="tier === 'paid' && paymentUrl && !comped" :href="paymentUrl" class="btn btn-primary btn-lg">
          <i class="fas fa-credit-card"></i>
          {{ t('payNow') }}
        </a>

        <NuxtLink to="/dashboard/listings" class="btn btn-outline">
          <i class="fas fa-table-cells-large"></i>
          {{ t('viewMyListings') }}
        </NuxtLink>

        <a href="/exchange/listings/new" class="btn btn-ghost">
          <i class="fas fa-plus"></i>
          {{ t('createAnother') }}
        </a>
      </div>

      <!-- Skip Payment Notice (for paid tier — not shown for comped members) -->
      <p v-if="tier === 'paid' && !comped" class="text-sm text-base-content/50 mt-4">
        {{ t('skipPaymentNotice') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  defineProps<{
    listingId: string | null;
    tier: 'free' | 'paid';
    paymentUrl: string | null;
    submissionComplete: boolean;
    comped?: boolean;
  }>();
</script>

<i18n lang="json">
{
  "en": {
    "submitting": "Submitting your listing...",
    "submitted": "Listing Submitted!",
    "subtitle": {
      "comped": "Premium included with your Sustaining membership — your listing is now in review.",
      "paid": "Complete your payment to activate your Premium features.",
      "free": "Your listing is being reviewed."
    },
    "nextSteps": { "heading": "What happens next?" },
    "comped": {
      "premiumApplied": { "title": "Premium Applied", "desc": "Included with your Sustaining membership" },
      "review": { "title": "Admin Review", "desc": "Our team reviews all listings for quality (24-48 hours)" },
      "featured": { "title": "Featured for 30 Days", "desc": "Once approved: priority search placement and homepage carousel exposure" }
    },
    "paid": {
      "payment": { "title": "Complete Payment", "desc": "Click below to securely pay via Stripe" },
      "review": { "title": "Admin Review", "desc": "Our team reviews all listings for quality" },
      "live": { "title": "Go Live!", "desc": "Your listing goes live with featured placement" }
    },
    "free": {
      "review": { "title": "Admin Review", "desc": "Our team reviews all listings for quality (24-48 hours)" },
      "email": { "title": "Email Notification", "desc": "We'll email you when your listing is approved" },
      "live": { "title": "Go Live!", "desc": "Your listing becomes visible to all buyers" }
    },
    "payNow": "Pay $10 Now",
    "viewMyListings": "View My Listings",
    "createAnother": "Create Another",
    "skipPaymentNotice": "You can complete payment later from your dashboard. Your listing will remain as a draft until payment is complete."
  },
  "es": {
    "submitting": "Enviando tu anuncio...",
    "submitted": "¡Anuncio enviado!",
    "subtitle": {
      "comped": "Premium incluido con tu membresía Sustaining: tu anuncio está en revisión.",
      "paid": "Completa tu pago para activar tus funciones Premium.",
      "free": "Tu anuncio está en revisión."
    },
    "nextSteps": { "heading": "¿Qué sucede ahora?" },
    "comped": {
      "premiumApplied": { "title": "Premium aplicado", "desc": "Incluido con tu membresía Sustaining" },
      "review": { "title": "Revisión del administrador", "desc": "Nuestro equipo revisa todos los anuncios por calidad (24-48 horas)" },
      "featured": { "title": "Destacado durante 30 días", "desc": "Una vez aprobado: posición prioritaria en búsquedas y aparición en el carrusel de la página de inicio" }
    },
    "paid": {
      "payment": { "title": "Completar el pago", "desc": "Haz clic abajo para pagar de forma segura con Stripe" },
      "review": { "title": "Revisión del administrador", "desc": "Nuestro equipo revisa todos los anuncios por calidad" },
      "live": { "title": "¡Sale en vivo!", "desc": "Tu anuncio se publica con posición destacada" }
    },
    "free": {
      "review": { "title": "Revisión del administrador", "desc": "Nuestro equipo revisa todos los anuncios por calidad (24-48 horas)" },
      "email": { "title": "Notificación por correo", "desc": "Te enviaremos un correo cuando se apruebe tu anuncio" },
      "live": { "title": "¡Sale en vivo!", "desc": "Tu anuncio se vuelve visible para todos los compradores" }
    },
    "payNow": "Pagar $10 ahora",
    "viewMyListings": "Ver mis anuncios",
    "createAnother": "Crear otro",
    "skipPaymentNotice": "Puedes completar el pago más tarde desde tu panel. Tu anuncio permanecerá como borrador hasta que se complete el pago."
  },
  "fr": {
    "submitting": "Envoi de votre annonce...",
    "submitted": "Annonce envoyée !",
    "subtitle": {
      "comped": "Premium inclus avec votre abonnement Sustaining — votre annonce est en cours d'examen.",
      "paid": "Finalisez votre paiement pour activer vos fonctionnalités Premium.",
      "free": "Votre annonce est en cours d'examen."
    },
    "nextSteps": { "heading": "Que se passe-t-il ensuite ?" },
    "comped": {
      "premiumApplied": { "title": "Premium appliqué", "desc": "Inclus avec votre abonnement Sustaining" },
      "review": { "title": "Examen par l'administrateur", "desc": "Notre équipe examine la qualité de toutes les annonces (24-48 heures)" },
      "featured": { "title": "Mis en avant pendant 30 jours", "desc": "Après approbation : placement prioritaire dans la recherche et exposition dans le carrousel de la page d'accueil" }
    },
    "paid": {
      "payment": { "title": "Finaliser le paiement", "desc": "Cliquez ci-dessous pour payer en toute sécurité via Stripe" },
      "review": { "title": "Examen par l'administrateur", "desc": "Notre équipe examine la qualité de toutes les annonces" },
      "live": { "title": "Mise en ligne !", "desc": "Votre annonce est mise en ligne avec un placement en vedette" }
    },
    "free": {
      "review": { "title": "Examen par l'administrateur", "desc": "Notre équipe examine la qualité de toutes les annonces (24-48 heures)" },
      "email": { "title": "Notification par e-mail", "desc": "Nous vous enverrons un e-mail lorsque votre annonce sera approuvée" },
      "live": { "title": "Mise en ligne !", "desc": "Votre annonce devient visible par tous les acheteurs" }
    },
    "payNow": "Payer 10 $ maintenant",
    "viewMyListings": "Voir mes annonces",
    "createAnother": "En créer une autre",
    "skipPaymentNotice": "Vous pouvez finaliser le paiement plus tard depuis votre tableau de bord. Votre annonce restera un brouillon jusqu'à ce que le paiement soit effectué."
  },
  "de": {
    "submitting": "Anzeige wird übermittelt...",
    "submitted": "Anzeige übermittelt!",
    "subtitle": {
      "comped": "Premium ist in deiner Sustaining-Mitgliedschaft enthalten — deine Anzeige wird jetzt überprüft.",
      "paid": "Schließe deine Zahlung ab, um deine Premium-Funktionen zu aktivieren.",
      "free": "Deine Anzeige wird überprüft."
    },
    "nextSteps": { "heading": "Was passiert als Nächstes?" },
    "comped": {
      "premiumApplied": { "title": "Premium angewendet", "desc": "In deiner Sustaining-Mitgliedschaft enthalten" },
      "review": { "title": "Admin-Prüfung", "desc": "Unser Team prüft alle Anzeigen auf Qualität (24-48 Stunden)" },
      "featured": { "title": "30 Tage hervorgehoben", "desc": "Nach der Genehmigung: vorrangige Platzierung in der Suche und Anzeige im Karussell der Startseite" }
    },
    "paid": {
      "payment": { "title": "Zahlung abschließen", "desc": "Klicke unten, um sicher über Stripe zu bezahlen" },
      "review": { "title": "Admin-Prüfung", "desc": "Unser Team prüft alle Anzeigen auf Qualität" },
      "live": { "title": "Geht live!", "desc": "Deine Anzeige geht mit hervorgehobener Platzierung live" }
    },
    "free": {
      "review": { "title": "Admin-Prüfung", "desc": "Unser Team prüft alle Anzeigen auf Qualität (24-48 Stunden)" },
      "email": { "title": "E-Mail-Benachrichtigung", "desc": "Wir senden dir eine E-Mail, sobald deine Anzeige genehmigt ist" },
      "live": { "title": "Geht live!", "desc": "Deine Anzeige wird für alle Käufer sichtbar" }
    },
    "payNow": "Jetzt 10 $ zahlen",
    "viewMyListings": "Meine Anzeigen ansehen",
    "createAnother": "Weitere erstellen",
    "skipPaymentNotice": "Du kannst die Zahlung später über dein Dashboard abschließen. Deine Anzeige bleibt ein Entwurf, bis die Zahlung abgeschlossen ist."
  },
  "it": {
    "submitting": "Invio del tuo annuncio...",
    "submitted": "Annuncio inviato!",
    "subtitle": {
      "comped": "Premium incluso con il tuo abbonamento Sustaining: il tuo annuncio è in fase di revisione.",
      "paid": "Completa il pagamento per attivare le funzionalità Premium.",
      "free": "Il tuo annuncio è in fase di revisione."
    },
    "nextSteps": { "heading": "Cosa succede ora?" },
    "comped": {
      "premiumApplied": { "title": "Premium applicato", "desc": "Incluso con il tuo abbonamento Sustaining" },
      "review": { "title": "Revisione dell'amministratore", "desc": "Il nostro team controlla la qualità di tutti gli annunci (24-48 ore)" },
      "featured": { "title": "In evidenza per 30 giorni", "desc": "Una volta approvato: posizionamento prioritario nelle ricerche ed esposizione nel carosello della home page" }
    },
    "paid": {
      "payment": { "title": "Completa il pagamento", "desc": "Clicca qui sotto per pagare in sicurezza tramite Stripe" },
      "review": { "title": "Revisione dell'amministratore", "desc": "Il nostro team controlla la qualità di tutti gli annunci" },
      "live": { "title": "Va online!", "desc": "Il tuo annuncio va online con posizionamento in evidenza" }
    },
    "free": {
      "review": { "title": "Revisione dell'amministratore", "desc": "Il nostro team controlla la qualità di tutti gli annunci (24-48 ore)" },
      "email": { "title": "Notifica via email", "desc": "Ti invieremo un'email quando il tuo annuncio sarà approvato" },
      "live": { "title": "Va online!", "desc": "Il tuo annuncio diventa visibile a tutti gli acquirenti" }
    },
    "payNow": "Paga 10 $ ora",
    "viewMyListings": "Vedi i miei annunci",
    "createAnother": "Crea un altro",
    "skipPaymentNotice": "Puoi completare il pagamento più tardi dalla tua dashboard. Il tuo annuncio rimarrà una bozza finché il pagamento non sarà completato."
  },
  "pt": {
    "submitting": "Enviando seu anúncio...",
    "submitted": "Anúncio enviado!",
    "subtitle": {
      "comped": "Premium incluído na sua assinatura Sustaining — seu anúncio está em análise.",
      "paid": "Conclua seu pagamento para ativar seus recursos Premium.",
      "free": "Seu anúncio está em análise."
    },
    "nextSteps": { "heading": "O que acontece a seguir?" },
    "comped": {
      "premiumApplied": { "title": "Premium aplicado", "desc": "Incluído na sua assinatura Sustaining" },
      "review": { "title": "Revisão do administrador", "desc": "Nossa equipe revisa a qualidade de todos os anúncios (24-48 horas)" },
      "featured": { "title": "Destaque por 30 dias", "desc": "Após a aprovação: posição prioritária na busca e exposição no carrossel da página inicial" }
    },
    "paid": {
      "payment": { "title": "Concluir pagamento", "desc": "Clique abaixo para pagar com segurança via Stripe" },
      "review": { "title": "Revisão do administrador", "desc": "Nossa equipe revisa a qualidade de todos os anúncios" },
      "live": { "title": "Vai ao ar!", "desc": "Seu anúncio vai ao ar com posição de destaque" }
    },
    "free": {
      "review": { "title": "Revisão do administrador", "desc": "Nossa equipe revisa a qualidade de todos os anúncios (24-48 horas)" },
      "email": { "title": "Notificação por e-mail", "desc": "Enviaremos um e-mail quando seu anúncio for aprovado" },
      "live": { "title": "Vai ao ar!", "desc": "Seu anúncio fica visível para todos os compradores" }
    },
    "payNow": "Pagar US$ 10 agora",
    "viewMyListings": "Ver meus anúncios",
    "createAnother": "Criar outro",
    "skipPaymentNotice": "Você pode concluir o pagamento depois pelo seu painel. Seu anúncio permanecerá como rascunho até que o pagamento seja concluído."
  },
  "ru": {
    "submitting": "Отправка вашего объявления...",
    "submitted": "Объявление отправлено!",
    "subtitle": {
      "comped": "Premium включён в вашу подписку Sustaining — ваше объявление находится на проверке.",
      "paid": "Завершите оплату, чтобы активировать функции Premium.",
      "free": "Ваше объявление находится на проверке."
    },
    "nextSteps": { "heading": "Что дальше?" },
    "comped": {
      "premiumApplied": { "title": "Premium применён", "desc": "Включён в вашу подписку Sustaining" },
      "review": { "title": "Проверка администратором", "desc": "Наша команда проверяет качество всех объявлений (24-48 часов)" },
      "featured": { "title": "Выделение на 30 дней", "desc": "После одобрения: приоритетное место в поиске и показ в карусели на главной странице" }
    },
    "paid": {
      "payment": { "title": "Завершить оплату", "desc": "Нажмите ниже, чтобы безопасно оплатить через Stripe" },
      "review": { "title": "Проверка администратором", "desc": "Наша команда проверяет качество всех объявлений" },
      "live": { "title": "Публикуется!", "desc": "Ваше объявление публикуется с приоритетным размещением" }
    },
    "free": {
      "review": { "title": "Проверка администратором", "desc": "Наша команда проверяет качество всех объявлений (24-48 часов)" },
      "email": { "title": "Уведомление по электронной почте", "desc": "Мы отправим вам письмо, когда объявление будет одобрено" },
      "live": { "title": "Публикуется!", "desc": "Ваше объявление становится видимым всем покупателям" }
    },
    "payNow": "Оплатить 10 $ сейчас",
    "viewMyListings": "Мои объявления",
    "createAnother": "Создать ещё",
    "skipPaymentNotice": "Вы можете завершить оплату позже в личном кабинете. Объявление останется черновиком, пока оплата не будет завершена."
  },
  "ja": {
    "submitting": "出品を送信しています...",
    "submitted": "出品が送信されました！",
    "subtitle": {
      "comped": "Premium は Sustaining メンバーシップに含まれています — 出品は審査中です。",
      "paid": "Premium 機能を有効にするには支払いを完了してください。",
      "free": "出品は審査中です。"
    },
    "nextSteps": { "heading": "次に何が起こりますか？" },
    "comped": {
      "premiumApplied": { "title": "Premium 適用済み", "desc": "Sustaining メンバーシップに含まれます" },
      "review": { "title": "管理者による審査", "desc": "当チームがすべての出品の品質を確認します（24〜48時間）" },
      "featured": { "title": "30 日間の注目掲載", "desc": "承認後：検索での優先表示とホームページのカルーセルへの露出" }
    },
    "paid": {
      "payment": { "title": "支払いを完了", "desc": "下のボタンから Stripe で安全に支払えます" },
      "review": { "title": "管理者による審査", "desc": "当チームがすべての出品の品質を確認します" },
      "live": { "title": "公開されます！", "desc": "出品は注目掲載付きで公開されます" }
    },
    "free": {
      "review": { "title": "管理者による審査", "desc": "当チームがすべての出品の品質を確認します（24〜48時間）" },
      "email": { "title": "メール通知", "desc": "出品が承認されたらメールでお知らせします" },
      "live": { "title": "公開されます！", "desc": "出品はすべての購入者に表示されます" }
    },
    "payNow": "今すぐ $10 を支払う",
    "viewMyListings": "自分の出品を見る",
    "createAnother": "別の出品を作成",
    "skipPaymentNotice": "支払いは後でダッシュボードから完了できます。支払いが完了するまで、出品は下書きのまま保持されます。"
  },
  "zh": {
    "submitting": "正在提交您的刊登...",
    "submitted": "刊登已提交！",
    "subtitle": {
      "comped": "Premium 已包含在您的 Sustaining 会籍中——您的刊登正在审核中。",
      "paid": "完成付款以激活您的 Premium 功能。",
      "free": "您的刊登正在审核中。"
    },
    "nextSteps": { "heading": "接下来会发生什么？" },
    "comped": {
      "premiumApplied": { "title": "已应用 Premium", "desc": "已包含在您的 Sustaining 会籍中" },
      "review": { "title": "管理员审核", "desc": "我们的团队会审核所有刊登的质量（24-48 小时）" },
      "featured": { "title": "精选展示 30 天", "desc": "审核通过后：搜索优先展示以及首页轮播曝光" }
    },
    "paid": {
      "payment": { "title": "完成付款", "desc": "点击下方通过 Stripe 安全付款" },
      "review": { "title": "管理员审核", "desc": "我们的团队会审核所有刊登的质量" },
      "live": { "title": "上线！", "desc": "您的刊登将以精选位置上线" }
    },
    "free": {
      "review": { "title": "管理员审核", "desc": "我们的团队会审核所有刊登的质量（24-48 小时）" },
      "email": { "title": "电子邮件通知", "desc": "您的刊登获批后我们会通过电子邮件通知您" },
      "live": { "title": "上线！", "desc": "您的刊登将对所有买家可见" }
    },
    "payNow": "立即支付 $10",
    "viewMyListings": "查看我的刊登",
    "createAnother": "再创建一个",
    "skipPaymentNotice": "您可以稍后在控制台完成付款。在付款完成之前，您的刊登将保持为草稿。"
  },
  "ko": {
    "submitting": "등록을 제출하는 중...",
    "submitted": "등록이 제출되었습니다!",
    "subtitle": {
      "comped": "Premium은 Sustaining 멤버십에 포함되어 있습니다 — 등록을 검토하고 있습니다.",
      "paid": "Premium 기능을 활성화하려면 결제를 완료하세요.",
      "free": "등록을 검토하고 있습니다."
    },
    "nextSteps": { "heading": "다음은 무엇인가요?" },
    "comped": {
      "premiumApplied": { "title": "Premium 적용됨", "desc": "Sustaining 멤버십에 포함됨" },
      "review": { "title": "관리자 검토", "desc": "저희 팀이 모든 등록의 품질을 검토합니다 (24-48시간)" },
      "featured": { "title": "30일간 추천 노출", "desc": "승인 후: 검색 우선 노출 및 홈페이지 캐러셀 노출" }
    },
    "paid": {
      "payment": { "title": "결제 완료", "desc": "아래를 클릭하여 Stripe로 안전하게 결제하세요" },
      "review": { "title": "관리자 검토", "desc": "저희 팀이 모든 등록의 품질을 검토합니다" },
      "live": { "title": "공개됩니다!", "desc": "등록이 추천 위치로 공개됩니다" }
    },
    "free": {
      "review": { "title": "관리자 검토", "desc": "저희 팀이 모든 등록의 품질을 검토합니다 (24-48시간)" },
      "email": { "title": "이메일 알림", "desc": "등록이 승인되면 이메일로 알려드립니다" },
      "live": { "title": "공개됩니다!", "desc": "등록이 모든 구매자에게 표시됩니다" }
    },
    "payNow": "지금 $10 결제",
    "viewMyListings": "내 등록 보기",
    "createAnother": "새로 만들기",
    "skipPaymentNotice": "결제는 나중에 대시보드에서 완료할 수 있습니다. 결제가 완료될 때까지 등록은 초안으로 유지됩니다."
  }
}
</i18n>
