<script lang="ts" setup>
  // Account section: settings.vue renders the sign-in card in its place when
  // there is no session. Moved from /profile/edit, which links here.
  definePageMeta({ settingsAuth: true });

  const { t } = useI18n();
</script>

<template>
  <div class="space-y-6" data-testid="settings-security">
    <h2 class="text-xl font-semibold">{{ t('heading') }}</h2>

    <!-- Passkey changes are written immediately by Supabase Auth; nothing on
         this page has a Save step. -->
    <ProfilePasskeyManager />

    <!-- Danger zone. The deletion itself lives on /account/delete, which stays
         public at that path because it is the URL on the Google Play Data
         Safety form; this is only the way in. -->
    <div class="card border border-error/40 bg-base-100">
      <div class="card-body">
        <div class="flex items-center">
          <i class="fad fa-triangle-exclamation mr-2 text-error" aria-hidden="true"></i>
          <h3 class="text-lg font-semibold">{{ t('danger.title') }}</h3>
        </div>
        <p class="text-sm opacity-70">{{ t('danger.body') }}</p>
        <div class="card-actions mt-2">
          <NuxtLink to="/account/delete" class="btn btn-outline btn-error btn-sm">
            <i class="fas fa-user-xmark"></i>
            {{ t('danger.cta') }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "heading": "Account & security",
    "danger": {
      "title": "Danger zone",
      "body": "Deleting your account removes your profile, messages, garage and saved data from classicminidiy.com, The Mini Exchange and the Toolbox apps. Records of sold listings and payments are kept without your name.",
      "cta": "Delete account"
    }
  },
  "es": {
    "heading": "Cuenta y seguridad",
    "danger": {
      "title": "Zona de peligro",
      "body": "Eliminar tu cuenta borra tu perfil, mensajes, garaje y datos guardados de classicminidiy.com, The Mini Exchange y las apps Toolbox. Los registros de anuncios vendidos y pagos se conservan sin tu nombre.",
      "cta": "Eliminar cuenta"
    }
  },
  "fr": {
    "heading": "Compte et sécurité",
    "danger": {
      "title": "Zone de danger",
      "body": "Supprimer votre compte efface votre profil, vos messages, votre garage et vos données enregistrées de classicminidiy.com, The Mini Exchange et des applis Toolbox. Les enregistrements des annonces vendues et des paiements sont conservés sans votre nom.",
      "cta": "Supprimer le compte"
    }
  },
  "de": {
    "heading": "Konto und Sicherheit",
    "danger": {
      "title": "Gefahrenzone",
      "body": "Das Löschen Ihres Kontos entfernt Profil, Nachrichten, Garage und gespeicherte Daten aus classicminidiy.com, The Mini Exchange und den Toolbox-Apps. Datensätze zu verkauften Anzeigen und Zahlungen bleiben ohne Ihren Namen erhalten.",
      "cta": "Konto löschen"
    }
  },
  "it": {
    "heading": "Account e sicurezza",
    "danger": {
      "title": "Zona pericolosa",
      "body": "Eliminare l'account rimuove profilo, messaggi, garage e dati salvati da classicminidiy.com, The Mini Exchange e dalle app Toolbox. Le registrazioni degli annunci venduti e dei pagamenti restano senza il tuo nome.",
      "cta": "Elimina account"
    }
  },
  "pt": {
    "heading": "Conta e segurança",
    "danger": {
      "title": "Zona de perigo",
      "body": "Excluir sua conta remove seu perfil, mensagens, garagem e dados salvos do classicminidiy.com, The Mini Exchange e dos apps Toolbox. Registros de anúncios vendidos e pagamentos são mantidos sem o seu nome.",
      "cta": "Excluir conta"
    }
  },
  "ru": {
    "heading": "Аккаунт и безопасность",
    "danger": {
      "title": "Опасная зона",
      "body": "Удаление аккаунта стирает ваш профиль, сообщения, гараж и сохранённые данные из classicminidiy.com, The Mini Exchange и приложений Toolbox. Записи о проданных объявлениях и платежах сохраняются без вашего имени.",
      "cta": "Удалить аккаунт"
    }
  },
  "ja": {
    "heading": "アカウントとセキュリティ",
    "danger": {
      "title": "危険な操作",
      "body": "アカウントを削除すると、classicminidiy.com、The Mini Exchange、Toolbox アプリからプロフィール、メッセージ、ガレージ、保存データが削除されます。売却済み出品と支払いの記録は氏名なしで保持されます。",
      "cta": "アカウントを削除"
    }
  },
  "zh": {
    "heading": "账户与安全",
    "danger": {
      "title": "危险区域",
      "body": "删除账户会从 classicminidiy.com、The Mini Exchange 和 Toolbox 应用中移除您的个人资料、消息、车库和已保存的数据。已售商品和付款记录将在不显示您姓名的情况下保留。",
      "cta": "删除账户"
    }
  },
  "ko": {
    "heading": "계정 및 보안",
    "danger": {
      "title": "위험 구역",
      "body": "계정을 삭제하면 classicminidiy.com, The Mini Exchange, Toolbox 앱에서 프로필, 메시지, 차고, 저장된 데이터가 제거됩니다. 판매된 매물과 결제 기록은 이름 없이 보관됩니다.",
      "cta": "계정 삭제"
    }
  }
}
</i18n>
