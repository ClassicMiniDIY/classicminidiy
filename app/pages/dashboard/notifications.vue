<template>
  <div class="container mx-auto py-8">
    <div class="max-w-3xl mx-auto">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold mb-2">{{ t('header.title') }}</h1>
        <p class="text-base-content/70">{{ t('header.subtitle') }}</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="skeleton h-12 w-full mb-4"></div>
          <div class="skeleton h-12 w-full mb-4"></div>
          <div class="skeleton h-12 w-full mb-4"></div>
        </div>
      </div>

      <!-- Preferences Form -->
      <div v-else-if="preferences">
        <!-- Section 1: Messages -->
        <div class="card bg-base-100 shadow mb-6">
          <div class="card-body">
            <h2 class="card-title">{{ t('messages.title') }}</h2>

            <!-- Email notifications for new messages -->
            <div class="flex items-center justify-between py-4 border-b border-base-300">
              <div>
                <h3 class="font-semibold mb-1">{{ t('messages.emailNew.title') }}</h3>
                <p class="text-sm text-base-content/70">{{ t('messages.emailNew.description') }}</p>
              </div>
              <input
                type="checkbox"
                v-model="preferences.email_new_messages"
                @change="handleToggle('email_new_messages')"
                class="toggle toggle-primary"
                :disabled="saving"
              />
            </div>

            <!-- Push notifications for new messages -->
            <div class="flex items-center justify-between py-4">
              <div>
                <h3 class="font-semibold mb-1">{{ t('messages.pushNew.title') }}</h3>
                <p class="text-sm text-base-content/70">{{ t('messages.pushNew.description') }}</p>
                <p v-if="!isSupported" class="text-xs text-warning mt-1">
                  {{ t('messages.pushNew.unsupported') }}
                </p>
              </div>
              <input
                type="checkbox"
                v-model="preferences.push_new_messages"
                @change="handlePushToggle"
                class="toggle toggle-primary"
                :disabled="saving || !isSupported"
              />
            </div>
          </div>
        </div>

        <!-- Section 2: Listings -->
        <div class="card bg-base-100 shadow mb-6">
          <div class="card-body">
            <h2 class="card-title">{{ t('listings.title') }}</h2>

            <!-- Listing status updates -->
            <div class="flex items-center justify-between py-4 border-b border-base-300">
              <div>
                <h3 class="font-semibold mb-1">{{ t('listings.status.title') }}</h3>
                <p class="text-sm text-base-content/70">
                  {{ t('listings.status.description') }}
                </p>
              </div>
              <input
                type="checkbox"
                v-model="preferences.email_listing_status"
                @change="handleToggle('email_listing_status')"
                class="toggle toggle-primary"
                :disabled="saving"
              />
            </div>

            <!-- New comments -->
            <div class="flex items-center justify-between py-4 border-b border-base-300">
              <div>
                <h3 class="font-semibold mb-1">{{ t('listings.newComments.title') }}</h3>
                <p class="text-sm text-base-content/70">{{ t('listings.newComments.description') }}</p>
              </div>
              <input
                type="checkbox"
                v-model="preferences.email_new_comments"
                @change="handleToggle('email_new_comments')"
                class="toggle toggle-primary"
                :disabled="saving"
              />
            </div>

            <!-- Comment replies -->
            <div class="flex items-center justify-between py-4">
              <div>
                <h3 class="font-semibold mb-1">{{ t('listings.commentReplies.title') }}</h3>
                <p class="text-sm text-base-content/70">{{ t('listings.commentReplies.description') }}</p>
              </div>
              <input
                type="checkbox"
                v-model="preferences.email_comment_replies"
                @change="handleToggle('email_comment_replies')"
                class="toggle toggle-primary"
                :disabled="saving"
              />
            </div>
          </div>
        </div>

        <!-- Section 3: Saved Searches -->
        <div class="card bg-base-100 shadow mb-6">
          <div class="card-body">
            <h2 class="card-title">{{ t('savedSearches.title') }}</h2>

            <!-- New listing matches -->
            <div class="flex items-center justify-between py-4 border-b border-base-300">
              <div>
                <h3 class="font-semibold mb-1">{{ t('savedSearches.matches.title') }}</h3>
                <p class="text-sm text-base-content/70">
                  {{ t('savedSearches.matches.description') }}
                </p>
              </div>
              <input
                type="checkbox"
                v-model="preferences.email_saved_search_matches"
                @change="handleToggle('email_saved_search_matches')"
                class="toggle toggle-primary"
                :disabled="saving"
              />
            </div>

            <!-- Manage saved searches link -->
            <div class="pt-2">
              <NuxtLink to="/dashboard/saved-searches" class="btn btn-ghost btn-sm">{{ t('savedSearches.manageLink') }}</NuxtLink>
            </div>
          </div>
        </div>

        <!-- Section 4: Weekly Digest -->
        <div class="card bg-base-100 shadow mb-6">
          <div class="card-body">
            <h2 class="card-title">{{ t('digest.title') }}</h2>

            <!-- Weekly newsletter -->
            <div class="flex items-center justify-between py-4">
              <div>
                <h3 class="font-semibold mb-1">{{ t('digest.newsletter.title') }}</h3>
                <p class="text-sm text-base-content/70">
                  {{ t('digest.newsletter.description') }}
                </p>
              </div>
              <input
                type="checkbox"
                v-model="preferences.email_weekly_digest"
                @change="handleToggle('email_weekly_digest')"
                class="toggle toggle-primary"
                :disabled="saving"
              />
            </div>
          </div>
        </div>

        <!-- Info Box -->
        <div class="alert alert-info">
          <i class="fas fa-circle-info"></i>
          <span class="text-sm">
            {{ t('infoBox') }}
          </span>
        </div>
      </div>

      <!-- Error State -->
      <div v-else class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="alert alert-error">
            <i class="fas fa-circle-exclamation"></i>
            <span>{{ t('errorState') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  const { preferences, loading, saving, fetchPreferences, togglePreference, updatePreferences } = useNotifications();
  const { isSupported, subscribe, unsubscribe, checkExistingSubscription } = usePushNotifications();

  onMounted(async () => {
    await fetchPreferences();
    await checkExistingSubscription();
  });

  const handleToggle = async (key: keyof typeof preferences.value) => {
    await togglePreference(key);
  };

  const handlePushToggle = async () => {
    if (!preferences.value) return;

    if (preferences.value.push_new_messages) {
      // User just toggled ON — subscribe
      const success = await subscribe();
      if (!success) {
        // Permission denied or error — revert toggle
        preferences.value.push_new_messages = false;
        return;
      }
    } else {
      // User toggled OFF — unsubscribe
      await unsubscribe();
    }

    // Persist the preference to DB
    await updatePreferences({ push_new_messages: preferences.value.push_new_messages });
  };

  useSeoMeta({
    title: () => t('seoTitle'),
    robots: 'noindex, nofollow',
  });
</script>

<i18n lang="json">
{
  "en": {
    "seoTitle": "Notification Preferences - Classic Mini DIY",
    "header": { "title": "Notification Preferences", "subtitle": "Manage how you receive updates from The Mini Exchange" },
    "messages": {
      "title": "Messages",
      "emailNew": { "title": "Email notifications for new messages", "description": "Get notified when someone sends you a message" },
      "pushNew": { "title": "Push notifications for new messages", "description": "Receive browser push notifications for new messages", "unsupported": "Push notifications are not supported in this browser" }
    },
    "listings": {
      "title": "Listings",
      "status": { "title": "Listing status updates", "description": "Get notified about approval, rejection, or expiration of your listings" },
      "newComments": { "title": "New comments", "description": "Get notified when someone comments on your listing" },
      "commentReplies": { "title": "Comment replies", "description": "Get notified when someone replies to your comment" }
    },
    "savedSearches": {
      "title": "Saved Searches",
      "matches": { "title": "New listing matches", "description": "Get notified when a new listing matches one of your saved searches" },
      "manageLink": "Manage saved searches →"
    },
    "digest": {
      "title": "Weekly Digest",
      "newsletter": { "title": "Weekly newsletter", "description": "Receive a weekly email with new listings and marketplace highlights" }
    },
    "infoBox": "You can always unsubscribe from individual email types by using the links in those emails.",
    "errorState": "Failed to load notification preferences. Please try refreshing the page."
  },
  "es": {
    "seoTitle": "Preferencias de notificaciones - Classic Mini DIY",
    "header": { "title": "Preferencias de notificaciones", "subtitle": "Gestiona cómo recibes las novedades de The Mini Exchange" },
    "messages": {
      "title": "Mensajes",
      "emailNew": { "title": "Notificaciones por correo para nuevos mensajes", "description": "Recibe un aviso cuando alguien te envíe un mensaje" },
      "pushNew": { "title": "Notificaciones push para nuevos mensajes", "description": "Recibe notificaciones push del navegador para nuevos mensajes", "unsupported": "Las notificaciones push no son compatibles con este navegador" }
    },
    "listings": {
      "title": "Anuncios",
      "status": { "title": "Actualizaciones de estado del anuncio", "description": "Recibe avisos sobre aprobación, rechazo o caducidad de tus anuncios" },
      "newComments": { "title": "Nuevos comentarios", "description": "Recibe un aviso cuando alguien comente tu anuncio" },
      "commentReplies": { "title": "Respuestas a comentarios", "description": "Recibe un aviso cuando alguien responda a tu comentario" }
    },
    "savedSearches": {
      "title": "Búsquedas guardadas",
      "matches": { "title": "Nuevas coincidencias de anuncios", "description": "Recibe un aviso cuando un nuevo anuncio coincida con una de tus búsquedas guardadas" },
      "manageLink": "Gestionar búsquedas guardadas →"
    },
    "digest": {
      "title": "Resumen semanal",
      "newsletter": { "title": "Boletín semanal", "description": "Recibe un correo semanal con nuevos anuncios y novedades del mercado" }
    },
    "infoBox": "Siempre puedes darte de baja de tipos de correo concretos usando los enlaces de esos correos.",
    "errorState": "No se pudieron cargar las preferencias de notificaciones. Intenta actualizar la página."
  },
  "fr": {
    "seoTitle": "Préférences de notification - Classic Mini DIY",
    "header": { "title": "Préférences de notification", "subtitle": "Gérez la façon dont vous recevez les nouveautés de The Mini Exchange" },
    "messages": {
      "title": "Messages",
      "emailNew": { "title": "Notifications par e-mail pour les nouveaux messages", "description": "Soyez averti lorsque quelqu'un vous envoie un message" },
      "pushNew": { "title": "Notifications push pour les nouveaux messages", "description": "Recevez des notifications push du navigateur pour les nouveaux messages", "unsupported": "Les notifications push ne sont pas prises en charge par ce navigateur" }
    },
    "listings": {
      "title": "Annonces",
      "status": { "title": "Mises à jour du statut des annonces", "description": "Soyez averti de l'approbation, du rejet ou de l'expiration de vos annonces" },
      "newComments": { "title": "Nouveaux commentaires", "description": "Soyez averti lorsque quelqu'un commente votre annonce" },
      "commentReplies": { "title": "Réponses aux commentaires", "description": "Soyez averti lorsque quelqu'un répond à votre commentaire" }
    },
    "savedSearches": {
      "title": "Recherches enregistrées",
      "matches": { "title": "Nouvelles annonces correspondantes", "description": "Soyez averti lorsqu'une nouvelle annonce correspond à l'une de vos recherches enregistrées" },
      "manageLink": "Gérer les recherches enregistrées →"
    },
    "digest": {
      "title": "Résumé hebdomadaire",
      "newsletter": { "title": "Newsletter hebdomadaire", "description": "Recevez un e-mail hebdomadaire avec les nouvelles annonces et les temps forts du marché" }
    },
    "infoBox": "Vous pouvez toujours vous désabonner de types d'e-mails spécifiques via les liens contenus dans ces e-mails.",
    "errorState": "Échec du chargement des préférences de notification. Veuillez actualiser la page."
  },
  "de": {
    "seoTitle": "Benachrichtigungseinstellungen - Classic Mini DIY",
    "header": { "title": "Benachrichtigungseinstellungen", "subtitle": "Lege fest, wie du Neuigkeiten von The Mini Exchange erhältst" },
    "messages": {
      "title": "Nachrichten",
      "emailNew": { "title": "E-Mail-Benachrichtigungen für neue Nachrichten", "description": "Werde benachrichtigt, wenn dir jemand eine Nachricht sendet" },
      "pushNew": { "title": "Push-Benachrichtigungen für neue Nachrichten", "description": "Erhalte Browser-Push-Benachrichtigungen für neue Nachrichten", "unsupported": "Push-Benachrichtigungen werden in diesem Browser nicht unterstützt" }
    },
    "listings": {
      "title": "Anzeigen",
      "status": { "title": "Statusaktualisierungen der Anzeige", "description": "Werde über Freigabe, Ablehnung oder Ablauf deiner Anzeigen benachrichtigt" },
      "newComments": { "title": "Neue Kommentare", "description": "Werde benachrichtigt, wenn jemand deine Anzeige kommentiert" },
      "commentReplies": { "title": "Kommentarantworten", "description": "Werde benachrichtigt, wenn jemand auf deinen Kommentar antwortet" }
    },
    "savedSearches": {
      "title": "Gespeicherte Suchen",
      "matches": { "title": "Neue passende Anzeigen", "description": "Werde benachrichtigt, wenn eine neue Anzeige zu einer deiner gespeicherten Suchen passt" },
      "manageLink": "Gespeicherte Suchen verwalten →"
    },
    "digest": {
      "title": "Wochenübersicht",
      "newsletter": { "title": "Wöchentlicher Newsletter", "description": "Erhalte eine wöchentliche E-Mail mit neuen Anzeigen und Marktplatz-Highlights" }
    },
    "infoBox": "Du kannst dich jederzeit von einzelnen E-Mail-Typen abmelden, indem du die Links in diesen E-Mails verwendest.",
    "errorState": "Benachrichtigungseinstellungen konnten nicht geladen werden. Bitte lade die Seite neu."
  },
  "it": {
    "seoTitle": "Preferenze di notifica - Classic Mini DIY",
    "header": { "title": "Preferenze di notifica", "subtitle": "Gestisci come ricevi gli aggiornamenti da The Mini Exchange" },
    "messages": {
      "title": "Messaggi",
      "emailNew": { "title": "Notifiche email per nuovi messaggi", "description": "Ricevi un avviso quando qualcuno ti invia un messaggio" },
      "pushNew": { "title": "Notifiche push per nuovi messaggi", "description": "Ricevi notifiche push del browser per i nuovi messaggi", "unsupported": "Le notifiche push non sono supportate in questo browser" }
    },
    "listings": {
      "title": "Annunci",
      "status": { "title": "Aggiornamenti sullo stato dell'annuncio", "description": "Ricevi avvisi su approvazione, rifiuto o scadenza dei tuoi annunci" },
      "newComments": { "title": "Nuovi commenti", "description": "Ricevi un avviso quando qualcuno commenta il tuo annuncio" },
      "commentReplies": { "title": "Risposte ai commenti", "description": "Ricevi un avviso quando qualcuno risponde al tuo commento" }
    },
    "savedSearches": {
      "title": "Ricerche salvate",
      "matches": { "title": "Nuovi annunci corrispondenti", "description": "Ricevi un avviso quando un nuovo annuncio corrisponde a una delle tue ricerche salvate" },
      "manageLink": "Gestisci ricerche salvate →"
    },
    "digest": {
      "title": "Riepilogo settimanale",
      "newsletter": { "title": "Newsletter settimanale", "description": "Ricevi un'email settimanale con nuovi annunci e novità del mercato" }
    },
    "infoBox": "Puoi sempre annullare l'iscrizione a singoli tipi di email usando i link presenti in quelle email.",
    "errorState": "Impossibile caricare le preferenze di notifica. Prova ad aggiornare la pagina."
  },
  "pt": {
    "seoTitle": "Preferências de notificação - Classic Mini DIY",
    "header": { "title": "Preferências de notificação", "subtitle": "Gerencie como você recebe atualizações do The Mini Exchange" },
    "messages": {
      "title": "Mensagens",
      "emailNew": { "title": "Notificações por e-mail para novas mensagens", "description": "Seja avisado quando alguém te enviar uma mensagem" },
      "pushNew": { "title": "Notificações push para novas mensagens", "description": "Receba notificações push do navegador para novas mensagens", "unsupported": "As notificações push não são compatíveis com este navegador" }
    },
    "listings": {
      "title": "Anúncios",
      "status": { "title": "Atualizações de status do anúncio", "description": "Seja avisado sobre aprovação, rejeição ou expiração dos seus anúncios" },
      "newComments": { "title": "Novos comentários", "description": "Seja avisado quando alguém comentar no seu anúncio" },
      "commentReplies": { "title": "Respostas a comentários", "description": "Seja avisado quando alguém responder ao seu comentário" }
    },
    "savedSearches": {
      "title": "Buscas salvas",
      "matches": { "title": "Novas correspondências de anúncios", "description": "Seja avisado quando um novo anúncio corresponder a uma das suas buscas salvas" },
      "manageLink": "Gerenciar buscas salvas →"
    },
    "digest": {
      "title": "Resumo semanal",
      "newsletter": { "title": "Newsletter semanal", "description": "Receba um e-mail semanal com novos anúncios e destaques do mercado" }
    },
    "infoBox": "Você sempre pode cancelar a inscrição de tipos específicos de e-mail usando os links nesses e-mails.",
    "errorState": "Falha ao carregar as preferências de notificação. Tente atualizar a página."
  },
  "ru": {
    "seoTitle": "Настройки уведомлений - Classic Mini DIY",
    "header": { "title": "Настройки уведомлений", "subtitle": "Управляйте тем, как вы получаете обновления от The Mini Exchange" },
    "messages": {
      "title": "Сообщения",
      "emailNew": { "title": "Уведомления по эл. почте о новых сообщениях", "description": "Получайте уведомление, когда кто-то отправляет вам сообщение" },
      "pushNew": { "title": "Push-уведомления о новых сообщениях", "description": "Получайте push-уведомления браузера о новых сообщениях", "unsupported": "Push-уведомления не поддерживаются в этом браузере" }
    },
    "listings": {
      "title": "Объявления",
      "status": { "title": "Обновления статуса объявления", "description": "Получайте уведомления об одобрении, отклонении или истечении срока ваших объявлений" },
      "newComments": { "title": "Новые комментарии", "description": "Получайте уведомление, когда кто-то комментирует ваше объявление" },
      "commentReplies": { "title": "Ответы на комментарии", "description": "Получайте уведомление, когда кто-то отвечает на ваш комментарий" }
    },
    "savedSearches": {
      "title": "Сохранённые поиски",
      "matches": { "title": "Новые подходящие объявления", "description": "Получайте уведомление, когда новое объявление совпадает с одним из ваших сохранённых поисков" },
      "manageLink": "Управлять сохранёнными поисками →"
    },
    "digest": {
      "title": "Еженедельная сводка",
      "newsletter": { "title": "Еженедельная рассылка", "description": "Получайте еженедельное письмо с новыми объявлениями и главными событиями маркетплейса" }
    },
    "infoBox": "Вы всегда можете отписаться от отдельных типов писем, используя ссылки в этих письмах.",
    "errorState": "Не удалось загрузить настройки уведомлений. Попробуйте обновить страницу."
  },
  "ja": {
    "seoTitle": "通知設定 - Classic Mini DIY",
    "header": { "title": "通知設定", "subtitle": "The Mini Exchange からの更新を受け取る方法を管理します" },
    "messages": {
      "title": "メッセージ",
      "emailNew": { "title": "新着メッセージのメール通知", "description": "誰かがメッセージを送ったときに通知を受け取ります" },
      "pushNew": { "title": "新着メッセージのプッシュ通知", "description": "新着メッセージのブラウザプッシュ通知を受け取ります", "unsupported": "このブラウザではプッシュ通知はサポートされていません" }
    },
    "listings": {
      "title": "出品",
      "status": { "title": "出品ステータスの更新", "description": "出品の承認、却下、期限切れについて通知を受け取ります" },
      "newComments": { "title": "新着コメント", "description": "誰かがあなたの出品にコメントしたときに通知を受け取ります" },
      "commentReplies": { "title": "コメントへの返信", "description": "誰かがあなたのコメントに返信したときに通知を受け取ります" }
    },
    "savedSearches": {
      "title": "保存した検索",
      "matches": { "title": "新着の一致する出品", "description": "保存した検索のいずれかに一致する新着出品があったときに通知を受け取ります" },
      "manageLink": "保存した検索を管理 →"
    },
    "digest": {
      "title": "週間ダイジェスト",
      "newsletter": { "title": "週刊ニュースレター", "description": "新着出品とマーケットプレイスのハイライトをまとめた週刊メールを受け取ります" }
    },
    "infoBox": "各メールに記載されたリンクから、個別のメール種別の配信をいつでも停止できます。",
    "errorState": "通知設定を読み込めませんでした。ページを更新してみてください。"
  },
  "zh": {
    "seoTitle": "通知偏好 - Classic Mini DIY",
    "header": { "title": "通知偏好", "subtitle": "管理你接收 The Mini Exchange 更新的方式" },
    "messages": {
      "title": "消息",
      "emailNew": { "title": "新消息的邮件通知", "description": "当有人给你发送消息时收到通知" },
      "pushNew": { "title": "新消息的推送通知", "description": "接收新消息的浏览器推送通知", "unsupported": "此浏览器不支持推送通知" }
    },
    "listings": {
      "title": "刊登",
      "status": { "title": "刊登状态更新", "description": "在你的刊登被批准、拒绝或过期时收到通知" },
      "newComments": { "title": "新评论", "description": "当有人评论你的刊登时收到通知" },
      "commentReplies": { "title": "评论回复", "description": "当有人回复你的评论时收到通知" }
    },
    "savedSearches": {
      "title": "已保存的搜索",
      "matches": { "title": "新的匹配刊登", "description": "当新刊登匹配你的某个已保存搜索时收到通知" },
      "manageLink": "管理已保存的搜索 →"
    },
    "digest": {
      "title": "每周摘要",
      "newsletter": { "title": "每周通讯", "description": "每周收到一封包含新刊登和市场亮点的邮件" }
    },
    "infoBox": "你随时可以通过相应邮件中的链接退订单独的邮件类型。",
    "errorState": "无法加载通知偏好。请尝试刷新页面。"
  },
  "ko": {
    "seoTitle": "알림 설정 - Classic Mini DIY",
    "header": { "title": "알림 설정", "subtitle": "The Mini Exchange 업데이트를 받는 방법을 관리하세요" },
    "messages": {
      "title": "메시지",
      "emailNew": { "title": "새 메시지 이메일 알림", "description": "누군가 메시지를 보내면 알림을 받습니다" },
      "pushNew": { "title": "새 메시지 푸시 알림", "description": "새 메시지에 대한 브라우저 푸시 알림을 받습니다", "unsupported": "이 브라우저에서는 푸시 알림이 지원되지 않습니다" }
    },
    "listings": {
      "title": "매물",
      "status": { "title": "매물 상태 업데이트", "description": "매물의 승인, 거절 또는 만료에 대한 알림을 받습니다" },
      "newComments": { "title": "새 댓글", "description": "누군가 내 매물에 댓글을 달면 알림을 받습니다" },
      "commentReplies": { "title": "댓글 답글", "description": "누군가 내 댓글에 답글을 달면 알림을 받습니다" }
    },
    "savedSearches": {
      "title": "저장된 검색",
      "matches": { "title": "새로 일치하는 매물", "description": "저장된 검색 중 하나에 일치하는 새 매물이 있을 때 알림을 받습니다" },
      "manageLink": "저장된 검색 관리 →"
    },
    "digest": {
      "title": "주간 요약",
      "newsletter": { "title": "주간 뉴스레터", "description": "새 매물과 마켓플레이스 주요 소식을 담은 주간 이메일을 받습니다" }
    },
    "infoBox": "각 이메일에 포함된 링크를 사용하여 언제든지 개별 이메일 유형의 구독을 취소할 수 있습니다.",
    "errorState": "알림 설정을 불러오지 못했습니다. 페이지를 새로 고쳐 보세요."
  }
}
</i18n>
