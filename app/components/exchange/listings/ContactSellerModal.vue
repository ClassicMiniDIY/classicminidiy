<template>
  <dialog ref="modalRef" class="modal">
    <div class="modal-box">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" :aria-label="t('close')">✕</button>
      </form>

      <h3 class="text-lg font-bold mb-4">{{ t('title') }}</h3>

      <div v-if="!submitted">
        <p class="text-sm text-base-content/70 mb-6">
          {{ t('intro.before') }} <strong>{{ listingTitle }}</strong>
        </p>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Name Field -->
          <fieldset>
            <label class="label">
              <span class="label-text">{{ t('name.label') }} <span class="text-error">*</span></span>
            </label>
            <input
              v-model="form.name"
              type="text"
              :placeholder="t('name.placeholder')"
              class="input input-bordered w-full"
              :class="{ 'input-error': errors.name }"
              required
              maxlength="100"
              :aria-invalid="!!errors.name"
              :aria-describedby="errors.name ? 'contact-name-error' : undefined"
            />
            <label v-if="errors.name" class="label">
              <span id="contact-name-error" class="label-text-alt text-error">{{ errors.name }}</span>
            </label>
          </fieldset>

          <!-- Email Field -->
          <fieldset>
            <label class="label">
              <span class="label-text">{{ t('email.label') }} <span class="text-error">*</span></span>
            </label>
            <input
              v-model="form.email"
              type="email"
              :placeholder="t('email.placeholder')"
              class="input input-bordered w-full"
              :class="{ 'input-error': errors.email }"
              required
              :aria-invalid="!!errors.email"
              :aria-describedby="errors.email ? 'contact-email-error' : undefined"
            />
            <label v-if="errors.email" class="label">
              <span id="contact-email-error" class="label-text-alt text-error">{{ errors.email }}</span>
            </label>
            <label v-else class="label">
              <span class="label-text-alt">{{ t('email.help') }}</span>
            </label>
          </fieldset>

          <!-- Message Field -->
          <fieldset>
            <label class="label">
              <span class="label-text">{{ t('message.label') }} <span class="text-error">*</span></span>
            </label>
            <textarea
              v-model="form.message"
              :placeholder="t('message.placeholder')"
              class="textarea textarea-bordered w-full h-32"
              :class="{ 'textarea-error': errors.message }"
              required
              minlength="10"
              maxlength="2000"
              :aria-invalid="!!errors.message"
              :aria-describedby="errors.message ? 'contact-message-error' : undefined"
            ></textarea>
            <label class="label">
              <span v-if="errors.message" id="contact-message-error" class="label-text-alt text-error">{{
                errors.message
              }}</span>
              <span v-else class="label-text-alt">{{ t('message.counter', { count: form.message.length }) }}</span>
            </label>
          </fieldset>

          <!-- Honeypot field (hidden from users, catches bots) -->
          <input
            v-model="form.honeypot"
            type="text"
            name="website"
            tabindex="-1"
            autocomplete="off"
            style="position: absolute; left: -9999px"
            aria-hidden="true"
          />

          <!-- Error Message -->
          <div v-if="errorMessage" class="alert alert-error">
            <i class="fas fa-triangle-exclamation"></i>
            <span>{{ errorMessage }}</span>
          </div>

          <!-- Submit Button -->
          <div class="modal-action">
            <form method="dialog">
              <button type="button" class="btn btn-ghost">{{ t('cancel') }}</button>
            </form>
            <button type="submit" class="btn btn-primary" :disabled="loading">
              <i v-if="loading" class="fas fa-arrows-rotate animate-spin"></i>
              <i v-else class="fas fa-paper-plane"></i>
              {{ t('send') }}
            </button>
          </div>
        </form>
      </div>

      <!-- Success State -->
      <div v-else class="text-center py-8">
        <div class="flex justify-center mb-4">
          <div class="bg-success/20 rounded-full p-4">
            <i class="fas fa-circle-check text-6xl text-success"></i>
          </div>
        </div>
        <h4 class="text-xl font-bold mb-2">{{ t('success.title') }}</h4>
        <p class="text-base-content/70 mb-6">
          {{ t('success.body') }}
        </p>
        <form method="dialog">
          <button class="btn btn-primary">{{ t('close') }}</button>
        </form>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>{{ t('close') }}</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  interface Props {
    listingId: string;
    listingTitle: string;
  }

  const props = defineProps<Props>();

  const modalRef = ref<HTMLDialogElement | null>(null);
  const loading = ref(false);
  const submitted = ref(false);
  const errorMessage = ref('');

  const form = reactive({
    name: '',
    email: '',
    message: '',
    honeypot: '', // Hidden field to catch bots
  });

  const errors = reactive({
    name: '',
    email: '',
    message: '',
  });

  // Show modal
  const show = () => {
    modalRef.value?.showModal();
    // Reset state
    submitted.value = false;
    errorMessage.value = '';
    form.name = '';
    form.email = '';
    form.message = '';
    form.honeypot = '';
    errors.name = '';
    errors.email = '';
    errors.message = '';
  };

  // Hide modal
  const hide = () => {
    modalRef.value?.close();
  };

  // Validate form
  const validateForm = () => {
    let isValid = true;
    errors.name = '';
    errors.email = '';
    errors.message = '';

    if (!form.name.trim()) {
      errors.name = t('errors.nameRequired');
      isValid = false;
    } else if (form.name.length > 100) {
      errors.name = t('errors.nameTooLong');
      isValid = false;
    }

    if (!form.email.trim()) {
      errors.email = t('errors.emailRequired');
      isValid = false;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email)) {
        errors.email = t('errors.emailInvalid');
        isValid = false;
      }
    }

    if (!form.message.trim()) {
      errors.message = t('errors.messageRequired');
      isValid = false;
    } else if (form.message.length < 10) {
      errors.message = t('errors.messageTooShort');
      isValid = false;
    } else if (form.message.length > 2000) {
      errors.message = t('errors.messageTooLong');
      isValid = false;
    }

    return isValid;
  };

  // Submit form
  const handleSubmit = async () => {
    errorMessage.value = '';

    if (!validateForm()) {
      return;
    }

    loading.value = true;

    try {
      const response = await $fetch('/api/exchange/contact-seller', {
        method: 'POST',
        body: {
          listingId: props.listingId,
          name: form.name.trim(),
          email: form.email.trim(),
          message: form.message.trim(),
          honeypot: form.honeypot,
        },
      });

      if (response.success) {
        submitted.value = true;
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      errorMessage.value = error.data?.message || t('errors.sendFailed');
    } finally {
      loading.value = false;
    }
  };

  // Expose methods to parent component
  defineExpose({
    show,
    hide,
  });
</script>

<i18n lang="json">
{
  "en": {
    "title": "Contact Seller",
    "intro": { "before": "Send a message to the seller about" },
    "name": { "label": "Your Name", "placeholder": "Enter your name" },
    "email": { "label": "Your Email", "placeholder": "your.email@example.com", "help": "The seller will be able to reply to this email" },
    "message": { "label": "Message", "placeholder": "Hi, I'm interested in your listing...", "counter": "{count} / 2000 characters" },
    "send": "Send Message",
    "cancel": "Cancel",
    "close": "Close",
    "success": { "title": "Message Sent!", "body": "The seller will receive your message and can reply directly to your email address." },
    "errors": { "nameRequired": "Name is required", "nameTooLong": "Name is too long (max 100 characters)", "emailRequired": "Email is required", "emailInvalid": "Invalid email address", "messageRequired": "Message is required", "messageTooShort": "Message is too short (min 10 characters)", "messageTooLong": "Message is too long (max 2000 characters)", "sendFailed": "Failed to send message. Please try again." }
  },
  "es": {
    "title": "Contactar al vendedor",
    "intro": { "before": "Envía un mensaje al vendedor sobre" },
    "name": { "label": "Tu nombre", "placeholder": "Introduce tu nombre" },
    "email": { "label": "Tu correo electrónico", "placeholder": "tu.correo@ejemplo.com", "help": "El vendedor podrá responder a este correo electrónico" },
    "message": { "label": "Mensaje", "placeholder": "Hola, me interesa tu anuncio...", "counter": "{count} / 2000 caracteres" },
    "send": "Enviar mensaje",
    "cancel": "Cancelar",
    "close": "Cerrar",
    "success": { "title": "¡Mensaje enviado!", "body": "El vendedor recibirá tu mensaje y podrá responder directamente a tu dirección de correo electrónico." },
    "errors": { "nameRequired": "El nombre es obligatorio", "nameTooLong": "El nombre es demasiado largo (máx. 100 caracteres)", "emailRequired": "El correo electrónico es obligatorio", "emailInvalid": "Dirección de correo electrónico no válida", "messageRequired": "El mensaje es obligatorio", "messageTooShort": "El mensaje es demasiado corto (mín. 10 caracteres)", "messageTooLong": "El mensaje es demasiado largo (máx. 2000 caracteres)", "sendFailed": "No se pudo enviar el mensaje. Inténtalo de nuevo." }
  },
  "fr": {
    "title": "Contacter le vendeur",
    "intro": { "before": "Envoyez un message au vendeur à propos de" },
    "name": { "label": "Votre nom", "placeholder": "Saisissez votre nom" },
    "email": { "label": "Votre e-mail", "placeholder": "votre.email@exemple.com", "help": "Le vendeur pourra répondre à cet e-mail" },
    "message": { "label": "Message", "placeholder": "Bonjour, votre annonce m'intéresse...", "counter": "{count} / 2000 caractères" },
    "send": "Envoyer le message",
    "cancel": "Annuler",
    "close": "Fermer",
    "success": { "title": "Message envoyé !", "body": "Le vendeur recevra votre message et pourra répondre directement à votre adresse e-mail." },
    "errors": { "nameRequired": "Le nom est obligatoire", "nameTooLong": "Le nom est trop long (100 caractères max.)", "emailRequired": "L'e-mail est obligatoire", "emailInvalid": "Adresse e-mail invalide", "messageRequired": "Le message est obligatoire", "messageTooShort": "Le message est trop court (10 caractères min.)", "messageTooLong": "Le message est trop long (2000 caractères max.)", "sendFailed": "Échec de l'envoi du message. Veuillez réessayer." }
  },
  "de": {
    "title": "Verkäufer kontaktieren",
    "intro": { "before": "Senden Sie dem Verkäufer eine Nachricht zu" },
    "name": { "label": "Ihr Name", "placeholder": "Geben Sie Ihren Namen ein" },
    "email": { "label": "Ihre E-Mail", "placeholder": "ihre.email@beispiel.com", "help": "Der Verkäufer kann auf diese E-Mail antworten" },
    "message": { "label": "Nachricht", "placeholder": "Hallo, ich interessiere mich für Ihre Anzeige...", "counter": "{count} / 2000 Zeichen" },
    "send": "Nachricht senden",
    "cancel": "Abbrechen",
    "close": "Schließen",
    "success": { "title": "Nachricht gesendet!", "body": "Der Verkäufer erhält Ihre Nachricht und kann direkt an Ihre E-Mail-Adresse antworten." },
    "errors": { "nameRequired": "Name ist erforderlich", "nameTooLong": "Name ist zu lang (max. 100 Zeichen)", "emailRequired": "E-Mail ist erforderlich", "emailInvalid": "Ungültige E-Mail-Adresse", "messageRequired": "Nachricht ist erforderlich", "messageTooShort": "Nachricht ist zu kurz (min. 10 Zeichen)", "messageTooLong": "Nachricht ist zu lang (max. 2000 Zeichen)", "sendFailed": "Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es erneut." }
  },
  "it": {
    "title": "Contatta il venditore",
    "intro": { "before": "Invia un messaggio al venditore riguardo a" },
    "name": { "label": "Il tuo nome", "placeholder": "Inserisci il tuo nome" },
    "email": { "label": "La tua email", "placeholder": "tua.email@esempio.com", "help": "Il venditore potrà rispondere a questa email" },
    "message": { "label": "Messaggio", "placeholder": "Ciao, sono interessato al tuo annuncio...", "counter": "{count} / 2000 caratteri" },
    "send": "Invia messaggio",
    "cancel": "Annulla",
    "close": "Chiudi",
    "success": { "title": "Messaggio inviato!", "body": "Il venditore riceverà il tuo messaggio e potrà rispondere direttamente al tuo indirizzo email." },
    "errors": { "nameRequired": "Il nome è obbligatorio", "nameTooLong": "Il nome è troppo lungo (max 100 caratteri)", "emailRequired": "L'email è obbligatoria", "emailInvalid": "Indirizzo email non valido", "messageRequired": "Il messaggio è obbligatorio", "messageTooShort": "Il messaggio è troppo corto (min 10 caratteri)", "messageTooLong": "Il messaggio è troppo lungo (max 2000 caratteri)", "sendFailed": "Invio del messaggio non riuscito. Riprova." }
  },
  "pt": {
    "title": "Contactar o vendedor",
    "intro": { "before": "Envie uma mensagem ao vendedor sobre" },
    "name": { "label": "O seu nome", "placeholder": "Introduza o seu nome" },
    "email": { "label": "O seu email", "placeholder": "o.seu.email@exemplo.com", "help": "O vendedor poderá responder a este email" },
    "message": { "label": "Mensagem", "placeholder": "Olá, estou interessado no seu anúncio...", "counter": "{count} / 2000 caracteres" },
    "send": "Enviar mensagem",
    "cancel": "Cancelar",
    "close": "Fechar",
    "success": { "title": "Mensagem enviada!", "body": "O vendedor receberá a sua mensagem e poderá responder diretamente para o seu endereço de email." },
    "errors": { "nameRequired": "O nome é obrigatório", "nameTooLong": "O nome é demasiado longo (máx. 100 caracteres)", "emailRequired": "O email é obrigatório", "emailInvalid": "Endereço de email inválido", "messageRequired": "A mensagem é obrigatória", "messageTooShort": "A mensagem é demasiado curta (mín. 10 caracteres)", "messageTooLong": "A mensagem é demasiado longa (máx. 2000 caracteres)", "sendFailed": "Não foi possível enviar a mensagem. Tente novamente." }
  },
  "ru": {
    "title": "Связаться с продавцом",
    "intro": { "before": "Отправьте продавцу сообщение о" },
    "name": { "label": "Ваше имя", "placeholder": "Введите ваше имя" },
    "email": { "label": "Ваша эл. почта", "placeholder": "vasha.pochta@primer.com", "help": "Продавец сможет ответить на этот адрес электронной почты" },
    "message": { "label": "Сообщение", "placeholder": "Здравствуйте, меня интересует ваше объявление...", "counter": "{count} / 2000 символов" },
    "send": "Отправить сообщение",
    "cancel": "Отмена",
    "close": "Закрыть",
    "success": { "title": "Сообщение отправлено!", "body": "Продавец получит ваше сообщение и сможет ответить прямо на ваш адрес электронной почты." },
    "errors": { "nameRequired": "Укажите имя", "nameTooLong": "Имя слишком длинное (макс. 100 символов)", "emailRequired": "Укажите адрес электронной почты", "emailInvalid": "Неверный адрес электронной почты", "messageRequired": "Введите сообщение", "messageTooShort": "Сообщение слишком короткое (мин. 10 символов)", "messageTooLong": "Сообщение слишком длинное (макс. 2000 символов)", "sendFailed": "Не удалось отправить сообщение. Попробуйте ещё раз." }
  },
  "ja": {
    "title": "出品者に連絡",
    "intro": { "before": "次の出品について出品者にメッセージを送信:" },
    "name": { "label": "お名前", "placeholder": "お名前を入力してください" },
    "email": { "label": "メールアドレス", "placeholder": "your.email@example.com", "help": "出品者はこのメールアドレスに返信できます" },
    "message": { "label": "メッセージ", "placeholder": "こんにちは、あなたの出品に興味があります...", "counter": "{count} / 2000 文字" },
    "send": "メッセージを送信",
    "cancel": "キャンセル",
    "close": "閉じる",
    "success": { "title": "メッセージを送信しました！", "body": "出品者はあなたのメッセージを受け取り、あなたのメールアドレスに直接返信できます。" },
    "errors": { "nameRequired": "名前は必須です", "nameTooLong": "名前が長すぎます（最大100文字）", "emailRequired": "メールアドレスは必須です", "emailInvalid": "メールアドレスが無効です", "messageRequired": "メッセージは必須です", "messageTooShort": "メッセージが短すぎます（最小10文字）", "messageTooLong": "メッセージが長すぎます（最大2000文字）", "sendFailed": "メッセージを送信できませんでした。もう一度お試しください。" }
  },
  "zh": {
    "title": "联系卖家",
    "intro": { "before": "就以下商品向卖家发送消息：" },
    "name": { "label": "您的姓名", "placeholder": "请输入您的姓名" },
    "email": { "label": "您的邮箱", "placeholder": "your.email@example.com", "help": "卖家将能够回复此邮箱" },
    "message": { "label": "消息", "placeholder": "您好，我对您的刊登很感兴趣……", "counter": "{count} / 2000 个字符" },
    "send": "发送消息",
    "cancel": "取消",
    "close": "关闭",
    "success": { "title": "消息已发送！", "body": "卖家将收到您的消息，并可以直接回复到您的邮箱地址。" },
    "errors": { "nameRequired": "姓名为必填项", "nameTooLong": "姓名过长（最多 100 个字符）", "emailRequired": "邮箱为必填项", "emailInvalid": "邮箱地址无效", "messageRequired": "消息为必填项", "messageTooShort": "消息过短（至少 10 个字符）", "messageTooLong": "消息过长（最多 2000 个字符）", "sendFailed": "消息发送失败，请重试。" }
  },
  "ko": {
    "title": "판매자에게 문의",
    "intro": { "before": "다음 매물에 대해 판매자에게 메시지 보내기:" },
    "name": { "label": "이름", "placeholder": "이름을 입력하세요" },
    "email": { "label": "이메일", "placeholder": "your.email@example.com", "help": "판매자가 이 이메일로 답장할 수 있습니다" },
    "message": { "label": "메시지", "placeholder": "안녕하세요, 귀하의 매물에 관심이 있습니다...", "counter": "{count} / 2000자" },
    "send": "메시지 보내기",
    "cancel": "취소",
    "close": "닫기",
    "success": { "title": "메시지를 보냈습니다!", "body": "판매자가 귀하의 메시지를 받고 귀하의 이메일 주소로 직접 답장할 수 있습니다." },
    "errors": { "nameRequired": "이름은 필수입니다", "nameTooLong": "이름이 너무 깁니다 (최대 100자)", "emailRequired": "이메일은 필수입니다", "emailInvalid": "유효하지 않은 이메일 주소입니다", "messageRequired": "메시지는 필수입니다", "messageTooShort": "메시지가 너무 짧습니다 (최소 10자)", "messageTooLong": "메시지가 너무 깁니다 (최대 2000자)", "sendFailed": "메시지를 보내지 못했습니다. 다시 시도하세요." }
  }
}
</i18n>
