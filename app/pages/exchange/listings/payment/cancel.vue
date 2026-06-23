<template>
  <div class="container mx-auto px-4 py-12">
    <div class="max-w-2xl mx-auto text-center">
      <div class="mb-6">
        <div class="inline-flex items-center justify-center w-20 h-20 bg-warning/10 rounded-full mb-4">
          <i class="fas fa-triangle-exclamation text-5xl text-warning"></i>
        </div>
        <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
        <p class="text-base-content/70 text-lg mb-6">{{ t('subtitle') }}</p>
      </div>

      <div class="card bg-base-100 shadow-lg mb-6">
        <div class="card-body">
          <h2 class="card-title mb-4">{{ t('next.heading') }}</h2>
          <div class="text-left space-y-3">
            <p class="flex items-start gap-2">
              <i class="fas fa-check text-success shrink-0 mt-0.5"></i>
              <span>{{ t('next.draft') }}</span>
            </p>
            <p class="flex items-start gap-2">
              <i class="fas fa-check text-success shrink-0 mt-0.5"></i>
              <span>{{ t('next.editAnytime') }}</span>
            </p>
            <p class="flex items-start gap-2">
              <i class="fas fa-check text-success shrink-0 mt-0.5"></i>
              <span>{{ t('next.publishFree') }}</span>
            </p>
          </div>
        </div>
      </div>

      <div class="flex gap-4 justify-center flex-wrap">
        <NuxtLink v-if="listingId" :to="`/exchange/listings/${listingId}/edit`" class="btn btn-primary">
          <i class="fas fa-pencil"></i>
          {{ t('actions.edit') }}
        </NuxtLink>
        <NuxtLink to="/dashboard/listings" class="btn btn-outline">
          <i class="fas fa-table-cells-large"></i>
          {{ t('actions.dashboard') }}
        </NuxtLink>
        <NuxtLink to="/exchange/listings/new" class="btn btn-ghost">
          <i class="fas fa-plus"></i>
          {{ t('actions.create') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  definePageMeta({
    middleware: 'exchange-auth',
  });

  useSeoMeta({
    title: () => t('seo.title'),
    robots: 'noindex, nofollow',
  });

  const route = useRoute();
  const { capture } = usePostHog();

  const listingId = computed(() => route.query.listing_id as string);

  onMounted(() => {
    if (listingId.value) {
      capture('checkout_cancelled', { listing_id: listingId.value, tier: 'paid' });
    }
  });
</script>

<i18n lang="json">
{
  "en": { "seo": { "title": "Payment Cancelled — The Mini Exchange | Classic Mini DIY" }, "title": "Payment Cancelled", "subtitle": "Your payment was cancelled. Your listing has been saved as a draft.", "next": { "heading": "What happens next?", "draft": "Your listing has been saved and is waiting in your drafts", "editAnytime": "You can edit and complete the payment anytime from your dashboard", "publishFree": "Or publish as a free listing (up to 5 photos, no featured placement)" }, "actions": { "edit": "Edit Listing", "dashboard": "Go to Dashboard", "create": "Create New Listing" } },
  "es": { "seo": { "title": "Pago cancelado — The Mini Exchange | Classic Mini DIY" }, "title": "Pago cancelado", "subtitle": "Tu pago fue cancelado. Tu anuncio se ha guardado como borrador.", "next": { "heading": "¿Qué sigue?", "draft": "Tu anuncio se ha guardado y está en tus borradores", "editAnytime": "Puedes editar y completar el pago en cualquier momento desde tu panel", "publishFree": "O publícalo como anuncio gratuito (hasta 5 fotos, sin posición destacada)" }, "actions": { "edit": "Editar anuncio", "dashboard": "Ir al panel", "create": "Crear anuncio" } },
  "fr": { "seo": { "title": "Paiement annulé — The Mini Exchange | Classic Mini DIY" }, "title": "Paiement annulé", "subtitle": "Votre paiement a été annulé. Votre annonce a été enregistrée comme brouillon.", "next": { "heading": "Et maintenant ?", "draft": "Votre annonce a été enregistrée et attend dans vos brouillons", "editAnytime": "Vous pouvez la modifier et finaliser le paiement à tout moment depuis votre tableau de bord", "publishFree": "Ou publiez-la en annonce gratuite (jusqu'à 5 photos, sans mise en avant)" }, "actions": { "edit": "Modifier l'annonce", "dashboard": "Aller au tableau de bord", "create": "Créer une annonce" } },
  "de": { "seo": { "title": "Zahlung abgebrochen — The Mini Exchange | Classic Mini DIY" }, "title": "Zahlung abgebrochen", "subtitle": "Deine Zahlung wurde abgebrochen. Deine Anzeige wurde als Entwurf gespeichert.", "next": { "heading": "Wie geht es weiter?", "draft": "Deine Anzeige wurde gespeichert und liegt in deinen Entwürfen", "editAnytime": "Du kannst sie jederzeit über dein Dashboard bearbeiten und die Zahlung abschließen", "publishFree": "Oder als kostenlose Anzeige veröffentlichen (bis zu 5 Fotos, ohne Hervorhebung)" }, "actions": { "edit": "Anzeige bearbeiten", "dashboard": "Zum Dashboard", "create": "Anzeige erstellen" } },
  "it": { "seo": { "title": "Pagamento annullato — The Mini Exchange | Classic Mini DIY" }, "title": "Pagamento annullato", "subtitle": "Il tuo pagamento è stato annullato. Il tuo annuncio è stato salvato come bozza.", "next": { "heading": "Cosa succede ora?", "draft": "Il tuo annuncio è stato salvato ed è tra le bozze", "editAnytime": "Puoi modificarlo e completare il pagamento in qualsiasi momento dalla dashboard", "publishFree": "Oppure pubblicalo come annuncio gratuito (fino a 5 foto, senza posizione in evidenza)" }, "actions": { "edit": "Modifica annuncio", "dashboard": "Vai alla dashboard", "create": "Crea annuncio" } },
  "pt": { "seo": { "title": "Pagamento cancelado — The Mini Exchange | Classic Mini DIY" }, "title": "Pagamento cancelado", "subtitle": "Seu pagamento foi cancelado. Seu anúncio foi salvo como rascunho.", "next": { "heading": "O que acontece agora?", "draft": "Seu anúncio foi salvo e está nos rascunhos", "editAnytime": "Você pode editar e concluir o pagamento a qualquer momento pelo painel", "publishFree": "Ou publique como anúncio gratuito (até 5 fotos, sem destaque)" }, "actions": { "edit": "Editar anúncio", "dashboard": "Ir para o painel", "create": "Criar anúncio" } },
  "ru": { "seo": { "title": "Оплата отменена — The Mini Exchange | Classic Mini DIY" }, "title": "Оплата отменена", "subtitle": "Оплата отменена. Ваше объявление сохранено как черновик.", "next": { "heading": "Что дальше?", "draft": "Объявление сохранено и ждёт в черновиках", "editAnytime": "Вы можете отредактировать его и завершить оплату в любое время из панели управления", "publishFree": "Или опубликуйте как бесплатное объявление (до 5 фото, без рекомендуемого размещения)" }, "actions": { "edit": "Редактировать объявление", "dashboard": "В панель управления", "create": "Создать объявление" } },
  "ja": { "seo": { "title": "支払いキャンセル — The Mini Exchange | Classic Mini DIY" }, "title": "支払いがキャンセルされました", "subtitle": "支払いがキャンセルされました。出品は下書きとして保存されています。", "next": { "heading": "次のステップ", "draft": "出品は保存され、下書きにあります", "editAnytime": "ダッシュボードからいつでも編集して支払いを完了できます", "publishFree": "または無料出品として公開できます（写真5枚まで、優先掲載なし）" }, "actions": { "edit": "出品を編集", "dashboard": "ダッシュボードへ", "create": "出品を作成" } },
  "zh": { "seo": { "title": "支付已取消 — The Mini Exchange | Classic Mini DIY" }, "title": "支付已取消", "subtitle": "您的支付已取消。您的刊登已保存为草稿。", "next": { "heading": "接下来呢？", "draft": "您的刊登已保存，正在草稿中等待", "editAnytime": "您可以随时在仪表板中编辑并完成支付", "publishFree": "或作为免费刊登发布（最多 5 张照片，无精选展示）" }, "actions": { "edit": "编辑刊登", "dashboard": "前往仪表板", "create": "创建刊登" } },
  "ko": { "seo": { "title": "결제 취소 — The Mini Exchange | Classic Mini DIY" }, "title": "결제가 취소되었습니다", "subtitle": "결제가 취소되었습니다. 매물이 임시저장되었습니다.", "next": { "heading": "다음 단계", "draft": "매물이 저장되어 임시저장함에 있습니다", "editAnytime": "대시보드에서 언제든지 편집하고 결제를 완료할 수 있습니다", "publishFree": "또는 무료 매물로 게시할 수 있습니다 (사진 최대 5장, 추천 노출 없음)" }, "actions": { "edit": "매물 편집", "dashboard": "대시보드로 이동", "create": "매물 등록" } }
}
</i18n>
