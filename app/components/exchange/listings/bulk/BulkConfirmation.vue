<template>
  <div class="text-center py-8 space-y-6">
    <div class="inline-flex items-center justify-center w-20 h-20 bg-success/10 rounded-full">
      <i class="fas fa-circle-check text-4xl text-success"></i>
    </div>

    <div>
      <h2 class="text-2xl font-bold mb-2">{{ t('submitted.title', { count: listings.length }) }}</h2>
      <p class="text-base-content/70">
        {{ hasPremium ? t('submitted.subtitlePremium') : t('submitted.subtitleFree') }}
      </p>
    </div>

    <!-- What happens next -->
    <div class="card bg-base-200 text-left max-w-md mx-auto">
      <div class="card-body">
        <h3 class="font-bold mb-4">{{ t('next.heading') }}</h3>

        <div v-if="hasPremium" class="space-y-3">
          <div class="flex items-start gap-3">
            <div class="badge badge-primary badge-sm mt-1">1</div>
            <div>
              <p class="font-medium">{{ t('next.premium.step1Title') }}</p>
              <p class="text-sm text-base-content/70">{{ t('next.premium.step1Body') }}</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="badge badge-ghost badge-sm mt-1">2</div>
            <div>
              <p class="font-medium">{{ t('next.premium.step2Title') }}</p>
              <p class="text-sm text-base-content/70">{{ t('next.premium.step2Body') }}</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="badge badge-ghost badge-sm mt-1">3</div>
            <div>
              <p class="font-medium">{{ t('next.premium.step3Title') }}</p>
              <p class="text-sm text-base-content/70">{{ t('next.premium.step3Body') }}</p>
            </div>
          </div>
        </div>

        <div v-else class="space-y-3">
          <div class="flex items-start gap-3">
            <div class="badge badge-primary badge-sm mt-1">1</div>
            <div>
              <p class="font-medium">{{ t('next.free.step1Title') }}</p>
              <p class="text-sm text-base-content/70">{{ t('next.free.step1Body') }}</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="badge badge-ghost badge-sm mt-1">2</div>
            <div>
              <p class="font-medium">{{ t('next.free.step2Title') }}</p>
              <p class="text-sm text-base-content/70">{{ t('next.free.step2Body') }}</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="badge badge-ghost badge-sm mt-1">3</div>
            <div>
              <p class="font-medium">{{ t('next.free.step3Title') }}</p>
              <p class="text-sm text-base-content/70">{{ t('next.free.step3Body') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex flex-col sm:flex-row gap-4 justify-center pt-4">
      <a v-if="hasPremium && paymentUrl" :href="paymentUrl" class="btn btn-primary btn-lg">
        <i class="fas fa-credit-card"></i>
        {{ t('actions.payNow') }}
      </a>

      <NuxtLink to="/dashboard/listings" class="btn btn-outline">
        <i class="fas fa-table-cells-large"></i>
        {{ t('actions.viewListings') }}
      </NuxtLink>

      <a href="/exchange/listings/bulk" class="btn btn-ghost">
        <i class="fas fa-plus"></i>
        {{ t('actions.createMore') }}
      </a>
    </div>

    <p v-if="hasPremium" class="text-sm text-base-content/50 mt-4">
      {{ t('payLater') }}
    </p>
  </div>
</template>

<script setup lang="ts">
  import type { BulkListingItem } from '~/types/bulk';

  const { t } = useI18n();

  defineProps<{
    listings: BulkListingItem[];
    hasPremium: boolean;
    paymentUrl: string | null;
  }>();
</script>

<i18n lang="json">
{
  "en": {
    "submitted": {
      "title": "{count} Listings Submitted!",
      "subtitlePremium": "Complete your payment to activate premium features on your upgraded listings.",
      "subtitleFree": "Your listings are being reviewed by our team."
    },
    "next": {
      "heading": "What happens next?",
      "premium": {
        "step1Title": "Complete Payment",
        "step1Body": "Pay for your premium listings via Stripe",
        "step2Title": "Admin Review",
        "step2Body": "Our team reviews all listings for quality",
        "step3Title": "Go Live!",
        "step3Body": "Your listings become visible to buyers"
      },
      "free": {
        "step1Title": "Admin Review",
        "step1Body": "Our team reviews all listings (24-48 hours)",
        "step2Title": "Email Notification",
        "step2Body": "We'll email you when your listings are approved",
        "step3Title": "Go Live!",
        "step3Body": "Your listings become visible to all buyers"
      }
    },
    "actions": {
      "payNow": "Pay Now",
      "viewListings": "View My Listings",
      "createMore": "Create More"
    },
    "payLater": "You can complete payment later from your dashboard. Premium listings remain as drafts until payment is complete."
  },
  "es": {
    "submitted": {
      "title": "¡{count} anuncios enviados!",
      "subtitlePremium": "Completa tu pago para activar las funciones premium en tus anuncios mejorados.",
      "subtitleFree": "Nuestro equipo está revisando tus anuncios."
    },
    "next": {
      "heading": "¿Qué sigue?",
      "premium": {
        "step1Title": "Completar el pago",
        "step1Body": "Paga tus anuncios premium mediante Stripe",
        "step2Title": "Revisión del administrador",
        "step2Body": "Nuestro equipo revisa la calidad de todos los anuncios",
        "step3Title": "¡En línea!",
        "step3Body": "Tus anuncios se vuelven visibles para los compradores"
      },
      "free": {
        "step1Title": "Revisión del administrador",
        "step1Body": "Nuestro equipo revisa todos los anuncios (24-48 horas)",
        "step2Title": "Notificación por correo",
        "step2Body": "Te enviaremos un correo cuando se aprueben tus anuncios",
        "step3Title": "¡En línea!",
        "step3Body": "Tus anuncios se vuelven visibles para todos los compradores"
      }
    },
    "actions": {
      "payNow": "Pagar ahora",
      "viewListings": "Ver mis anuncios",
      "createMore": "Crear más"
    },
    "payLater": "Puedes completar el pago más tarde desde tu panel. Los anuncios premium permanecen como borradores hasta que se complete el pago."
  },
  "fr": {
    "submitted": {
      "title": "{count} annonces soumises !",
      "subtitlePremium": "Effectuez votre paiement pour activer les fonctionnalités premium sur vos annonces améliorées.",
      "subtitleFree": "Vos annonces sont en cours d'examen par notre équipe."
    },
    "next": {
      "heading": "Et ensuite ?",
      "premium": {
        "step1Title": "Effectuer le paiement",
        "step1Body": "Payez vos annonces premium via Stripe",
        "step2Title": "Examen par l'administrateur",
        "step2Body": "Notre équipe vérifie la qualité de toutes les annonces",
        "step3Title": "En ligne !",
        "step3Body": "Vos annonces deviennent visibles pour les acheteurs"
      },
      "free": {
        "step1Title": "Examen par l'administrateur",
        "step1Body": "Notre équipe vérifie toutes les annonces (24-48 heures)",
        "step2Title": "Notification par e-mail",
        "step2Body": "Nous vous enverrons un e-mail dès que vos annonces seront approuvées",
        "step3Title": "En ligne !",
        "step3Body": "Vos annonces deviennent visibles pour tous les acheteurs"
      }
    },
    "actions": {
      "payNow": "Payer maintenant",
      "viewListings": "Voir mes annonces",
      "createMore": "Créer plus"
    },
    "payLater": "Vous pouvez effectuer le paiement plus tard depuis votre tableau de bord. Les annonces premium restent en brouillon jusqu'à ce que le paiement soit terminé."
  },
  "de": {
    "submitted": {
      "title": "{count} Anzeigen eingereicht!",
      "subtitlePremium": "Schließen Sie Ihre Zahlung ab, um Premium-Funktionen für Ihre aufgewerteten Anzeigen zu aktivieren.",
      "subtitleFree": "Ihre Anzeigen werden von unserem Team geprüft."
    },
    "next": {
      "heading": "Wie geht es weiter?",
      "premium": {
        "step1Title": "Zahlung abschließen",
        "step1Body": "Bezahlen Sie Ihre Premium-Anzeigen über Stripe",
        "step2Title": "Admin-Prüfung",
        "step2Body": "Unser Team prüft alle Anzeigen auf Qualität",
        "step3Title": "Live gehen!",
        "step3Body": "Ihre Anzeigen werden für Käufer sichtbar"
      },
      "free": {
        "step1Title": "Admin-Prüfung",
        "step1Body": "Unser Team prüft alle Anzeigen (24-48 Stunden)",
        "step2Title": "E-Mail-Benachrichtigung",
        "step2Body": "Wir senden Ihnen eine E-Mail, sobald Ihre Anzeigen genehmigt sind",
        "step3Title": "Live gehen!",
        "step3Body": "Ihre Anzeigen werden für alle Käufer sichtbar"
      }
    },
    "actions": {
      "payNow": "Jetzt bezahlen",
      "viewListings": "Meine Anzeigen ansehen",
      "createMore": "Weitere erstellen"
    },
    "payLater": "Sie können die Zahlung später über Ihr Dashboard abschließen. Premium-Anzeigen bleiben Entwürfe, bis die Zahlung abgeschlossen ist."
  },
  "it": {
    "submitted": {
      "title": "{count} annunci inviati!",
      "subtitlePremium": "Completa il pagamento per attivare le funzioni premium sui tuoi annunci aggiornati.",
      "subtitleFree": "I tuoi annunci sono in fase di revisione da parte del nostro team."
    },
    "next": {
      "heading": "Cosa succede dopo?",
      "premium": {
        "step1Title": "Completa il pagamento",
        "step1Body": "Paga i tuoi annunci premium tramite Stripe",
        "step2Title": "Revisione dell'amministratore",
        "step2Body": "Il nostro team controlla la qualità di tutti gli annunci",
        "step3Title": "Online!",
        "step3Body": "I tuoi annunci diventano visibili agli acquirenti"
      },
      "free": {
        "step1Title": "Revisione dell'amministratore",
        "step1Body": "Il nostro team controlla tutti gli annunci (24-48 ore)",
        "step2Title": "Notifica via email",
        "step2Body": "Ti invieremo un'email quando i tuoi annunci saranno approvati",
        "step3Title": "Online!",
        "step3Body": "I tuoi annunci diventano visibili a tutti gli acquirenti"
      }
    },
    "actions": {
      "payNow": "Paga ora",
      "viewListings": "Visualizza i miei annunci",
      "createMore": "Crea altri"
    },
    "payLater": "Puoi completare il pagamento più tardi dalla tua dashboard. Gli annunci premium rimangono come bozze fino al completamento del pagamento."
  },
  "pt": {
    "submitted": {
      "title": "{count} anúncios enviados!",
      "subtitlePremium": "Conclua o pagamento para ativar os recursos premium nos seus anúncios atualizados.",
      "subtitleFree": "Seus anúncios estão sendo analisados pela nossa equipe."
    },
    "next": {
      "heading": "O que acontece a seguir?",
      "premium": {
        "step1Title": "Concluir o pagamento",
        "step1Body": "Pague seus anúncios premium via Stripe",
        "step2Title": "Análise do administrador",
        "step2Body": "Nossa equipe analisa a qualidade de todos os anúncios",
        "step3Title": "No ar!",
        "step3Body": "Seus anúncios ficam visíveis para os compradores"
      },
      "free": {
        "step1Title": "Análise do administrador",
        "step1Body": "Nossa equipe analisa todos os anúncios (24-48 horas)",
        "step2Title": "Notificação por e-mail",
        "step2Body": "Enviaremos um e-mail quando seus anúncios forem aprovados",
        "step3Title": "No ar!",
        "step3Body": "Seus anúncios ficam visíveis para todos os compradores"
      }
    },
    "actions": {
      "payNow": "Pagar agora",
      "viewListings": "Ver meus anúncios",
      "createMore": "Criar mais"
    },
    "payLater": "Você pode concluir o pagamento mais tarde no seu painel. Anúncios premium permanecem como rascunhos até que o pagamento seja concluído."
  },
  "ru": {
    "submitted": {
      "title": "Отправлено объявлений: {count}!",
      "subtitlePremium": "Завершите оплату, чтобы активировать премиум-функции для ваших улучшенных объявлений.",
      "subtitleFree": "Ваши объявления проверяются нашей командой."
    },
    "next": {
      "heading": "Что дальше?",
      "premium": {
        "step1Title": "Завершить оплату",
        "step1Body": "Оплатите премиум-объявления через Stripe",
        "step2Title": "Проверка администратором",
        "step2Body": "Наша команда проверяет качество всех объявлений",
        "step3Title": "Публикация!",
        "step3Body": "Ваши объявления становятся видны покупателям"
      },
      "free": {
        "step1Title": "Проверка администратором",
        "step1Body": "Наша команда проверяет все объявления (24-48 часов)",
        "step2Title": "Уведомление по электронной почте",
        "step2Body": "Мы отправим вам письмо, когда ваши объявления будут одобрены",
        "step3Title": "Публикация!",
        "step3Body": "Ваши объявления становятся видны всем покупателям"
      }
    },
    "actions": {
      "payNow": "Оплатить сейчас",
      "viewListings": "Мои объявления",
      "createMore": "Создать ещё"
    },
    "payLater": "Вы можете завершить оплату позже из своей панели. Премиум-объявления остаются черновиками до завершения оплаты."
  },
  "ja": {
    "submitted": {
      "title": "{count}件の出品を送信しました！",
      "subtitlePremium": "アップグレードした出品でプレミアム機能を有効にするには、お支払いを完了してください。",
      "subtitleFree": "出品はチームが審査中です。"
    },
    "next": {
      "heading": "次に何が起こりますか？",
      "premium": {
        "step1Title": "支払いを完了",
        "step1Body": "Stripe でプレミアム出品の支払いを行います",
        "step2Title": "管理者による審査",
        "step2Body": "チームがすべての出品の品質を確認します",
        "step3Title": "公開！",
        "step3Body": "出品が購入者に表示されます"
      },
      "free": {
        "step1Title": "管理者による審査",
        "step1Body": "チームがすべての出品を審査します（24～48時間）",
        "step2Title": "メール通知",
        "step2Body": "出品が承認されたらメールでお知らせします",
        "step3Title": "公開！",
        "step3Body": "出品がすべての購入者に表示されます"
      }
    },
    "actions": {
      "payNow": "今すぐ支払う",
      "viewListings": "自分の出品を見る",
      "createMore": "さらに作成"
    },
    "payLater": "お支払いは後でダッシュボードから完了できます。プレミアム出品は支払いが完了するまで下書きのままです。"
  },
  "zh": {
    "submitted": {
      "title": "已提交 {count} 个刊登！",
      "subtitlePremium": "完成付款以激活已升级刊登的高级功能。",
      "subtitleFree": "您的刊登正在由我们的团队审核。"
    },
    "next": {
      "heading": "接下来会发生什么？",
      "premium": {
        "step1Title": "完成付款",
        "step1Body": "通过 Stripe 为高级刊登付款",
        "step2Title": "管理员审核",
        "step2Body": "我们的团队会审核所有刊登的质量",
        "step3Title": "上线！",
        "step3Body": "您的刊登将对买家可见"
      },
      "free": {
        "step1Title": "管理员审核",
        "step1Body": "我们的团队会审核所有刊登（24-48 小时）",
        "step2Title": "电子邮件通知",
        "step2Body": "刊登获批后我们会通过电子邮件通知您",
        "step3Title": "上线！",
        "step3Body": "您的刊登将对所有买家可见"
      }
    },
    "actions": {
      "payNow": "立即付款",
      "viewListings": "查看我的刊登",
      "createMore": "创建更多"
    },
    "payLater": "您可以稍后从仪表板完成付款。高级刊登在付款完成前将保持为草稿。"
  },
  "ko": {
    "submitted": {
      "title": "{count}개의 매물이 제출되었습니다!",
      "subtitlePremium": "업그레이드된 매물의 프리미엄 기능을 활성화하려면 결제를 완료하세요.",
      "subtitleFree": "매물이 저희 팀의 검토를 받고 있습니다."
    },
    "next": {
      "heading": "다음 단계는?",
      "premium": {
        "step1Title": "결제 완료",
        "step1Body": "Stripe로 프리미엄 매물 비용을 결제하세요",
        "step2Title": "관리자 검토",
        "step2Body": "저희 팀이 모든 매물의 품질을 검토합니다",
        "step3Title": "게시!",
        "step3Body": "매물이 구매자에게 표시됩니다"
      },
      "free": {
        "step1Title": "관리자 검토",
        "step1Body": "저희 팀이 모든 매물을 검토합니다 (24~48시간)",
        "step2Title": "이메일 알림",
        "step2Body": "매물이 승인되면 이메일로 알려드립니다",
        "step3Title": "게시!",
        "step3Body": "매물이 모든 구매자에게 표시됩니다"
      }
    },
    "actions": {
      "payNow": "지금 결제",
      "viewListings": "내 매물 보기",
      "createMore": "더 만들기"
    },
    "payLater": "결제는 나중에 대시보드에서 완료할 수 있습니다. 프리미엄 매물은 결제가 완료될 때까지 초안으로 유지됩니다."
  }
}
</i18n>
