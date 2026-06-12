<script setup lang="ts">
  const { t } = useI18n();
  const supabase = useSupabase();
  const { user } = useAuth();

  interface PurchaseRow {
    id: string;
    kind: string;
    amount_cents: number;
    currency: string;
    status: string;
    created_at: string;
    refunded_at: string | null;
    model: { title: string; slug: string } | null;
  }

  const { data, pending } = await useAsyncData(
    'dashboard-purchases',
    async () => {
      if (!import.meta.client || !user.value) return [] as PurchaseRow[];
      // RLS returns rows where the caller is buyer OR seller; scope to buyer so
      // the Purchases tab never shows the seller's own sales.
      const { data, error } = await supabase
        .from('model_purchases')
        .select('id, kind, amount_cents, currency, status, created_at, refunded_at, models(title, slug)')
        .eq('buyer_id', user.value.id)
        .order('created_at', { ascending: false });
      if (error) return [] as PurchaseRow[];
      return (data ?? []).map((r: any) => ({
        id: r.id,
        kind: r.kind,
        amount_cents: r.amount_cents,
        currency: r.currency,
        status: r.status,
        created_at: r.created_at,
        refunded_at: r.refunded_at,
        model: r.models ? { title: r.models.title, slug: r.models.slug } : null,
      })) as PurchaseRow[];
    },
    { watch: [user] }
  );

  const purchases = computed(() => data.value ?? []);

  function fmt(cents: number, currency: string) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(cents / 100);
  }
  function fmtDate(s: string) {
    return new Date(s).toLocaleDateString();
  }

  const statusTone: Record<string, string> = {
    paid: 'badge-success',
    refunded: 'badge-neutral',
    disputed: 'badge-error',
  };
</script>

<template>
  <div class="card bg-base-100 border border-base-300 shadow-sm">
    <div class="card-body">
      <div class="flex items-center gap-2">
        <i class="fad fa-bag-shopping"></i>
        <h2 class="text-lg font-semibold">{{ t('heading') }}</h2>
      </div>

      <div v-if="pending" class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>

      <div v-else-if="purchases.length === 0" class="text-center py-12">
        <i class="fas fa-bag-shopping text-5xl opacity-20"></i>
        <p class="mt-4 font-semibold">{{ t('emptyTitle') }}</p>
        <p class="opacity-60 mb-4">{{ t('emptySubtitle') }}</p>
        <NuxtLink to="/models" class="btn btn-primary btn-sm">
          <i class="fas fa-cube mr-1"></i> {{ t('browseBtn') }}
        </NuxtLink>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>{{ t('colModel') }}</th>
              <th>{{ t('colType') }}</th>
              <th class="text-right">{{ t('colAmount') }}</th>
              <th>{{ t('colStatus') }}</th>
              <th class="text-right">{{ t('colDate') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in purchases" :key="p.id">
              <td>
                <NuxtLink v-if="p.model" :to="`/models/${p.model.slug}`" class="link link-hover font-medium">
                  {{ p.model.title }}
                </NuxtLink>
                <span v-else class="opacity-50">—</span>
              </td>
              <td>
                <span class="badge badge-sm" :class="p.kind === 'tip' ? 'badge-ghost' : 'badge-primary'">
                  {{ p.kind === 'tip' ? t('kindTip') : t('kindPurchase') }}
                </span>
              </td>
              <td class="text-right whitespace-nowrap">{{ fmt(p.amount_cents, p.currency) }}</td>
              <td>
                <span class="badge badge-sm" :class="statusTone[p.status] || 'badge-ghost'">{{ t(`status.${p.status}`, p.status) }}</span>
              </td>
              <td class="text-right whitespace-nowrap text-sm opacity-70">{{ fmtDate(p.created_at) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="text-xs opacity-50 mt-2">{{ t('downloadNote') }}</p>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "heading": "Purchases & Tips",
    "emptyTitle": "No purchases yet",
    "emptySubtitle": "Models you buy or tip will show up here.",
    "browseBtn": "Browse the model library",
    "colModel": "Model",
    "colType": "Type",
    "colAmount": "Amount",
    "colStatus": "Status",
    "colDate": "Date",
    "kindTip": "Tip",
    "kindPurchase": "Purchase",
    "status": {
      "paid": "Paid",
      "refunded": "Refunded",
      "disputed": "Disputed"
    },
    "downloadNote": "Open a purchased model to download its files — your purchase unlocks every version."
  },
  "es": {
    "heading": "Compras y propinas",
    "emptyTitle": "Aún no hay compras",
    "emptySubtitle": "Los modelos que compres o a los que des propina aparecerán aquí.",
    "browseBtn": "Explorar la biblioteca de modelos",
    "colModel": "Modelo",
    "colType": "Tipo",
    "colAmount": "Importe",
    "colStatus": "Estado",
    "colDate": "Fecha",
    "kindTip": "Propina",
    "kindPurchase": "Compra",
    "status": {
      "paid": "Pagado",
      "refunded": "Reembolsado",
      "disputed": "En disputa"
    },
    "downloadNote": "Abre un modelo comprado para descargar sus archivos — tu compra desbloquea todas las versiones."
  },
  "fr": {
    "heading": "Achats et pourboires",
    "emptyTitle": "Aucun achat pour l'instant",
    "emptySubtitle": "Les modèles que vous achetez ou auxquels vous donnez un pourboire apparaîtront ici.",
    "browseBtn": "Parcourir la bibliothèque de modèles",
    "colModel": "Modèle",
    "colType": "Type",
    "colAmount": "Montant",
    "colStatus": "Statut",
    "colDate": "Date",
    "kindTip": "Pourboire",
    "kindPurchase": "Achat",
    "status": {
      "paid": "Payé",
      "refunded": "Remboursé",
      "disputed": "En litige"
    },
    "downloadNote": "Ouvrez un modèle acheté pour télécharger ses fichiers — votre achat débloque toutes les versions."
  },
  "de": {
    "heading": "Käufe & Trinkgelder",
    "emptyTitle": "Noch keine Käufe",
    "emptySubtitle": "Modelle, die du kaufst oder mit einem Trinkgeld unterstützt, erscheinen hier.",
    "browseBtn": "Modellbibliothek durchsuchen",
    "colModel": "Modell",
    "colType": "Typ",
    "colAmount": "Betrag",
    "colStatus": "Status",
    "colDate": "Datum",
    "kindTip": "Trinkgeld",
    "kindPurchase": "Kauf",
    "status": {
      "paid": "Bezahlt",
      "refunded": "Erstattet",
      "disputed": "Strittig"
    },
    "downloadNote": "Öffne ein gekauftes Modell, um die Dateien herunterzuladen — dein Kauf schaltet alle Versionen frei."
  },
  "it": {
    "heading": "Acquisti e mance",
    "emptyTitle": "Nessun acquisto ancora",
    "emptySubtitle": "I modelli che acquisti o a cui lasci una mancia appariranno qui.",
    "browseBtn": "Sfoglia la libreria dei modelli",
    "colModel": "Modello",
    "colType": "Tipo",
    "colAmount": "Importo",
    "colStatus": "Stato",
    "colDate": "Data",
    "kindTip": "Mancia",
    "kindPurchase": "Acquisto",
    "status": {
      "paid": "Pagato",
      "refunded": "Rimborsato",
      "disputed": "In disputa"
    },
    "downloadNote": "Apri un modello acquistato per scaricare i file — il tuo acquisto sblocca tutte le versioni."
  },
  "pt": {
    "heading": "Compras e gorjetas",
    "emptyTitle": "Nenhuma compra ainda",
    "emptySubtitle": "Os modelos que você comprar ou dar gorjeta aparecerão aqui.",
    "browseBtn": "Explorar a biblioteca de modelos",
    "colModel": "Modelo",
    "colType": "Tipo",
    "colAmount": "Valor",
    "colStatus": "Status",
    "colDate": "Data",
    "kindTip": "Gorjeta",
    "kindPurchase": "Compra",
    "status": {
      "paid": "Pago",
      "refunded": "Reembolsado",
      "disputed": "Em disputa"
    },
    "downloadNote": "Abra um modelo comprado para baixar seus arquivos — sua compra desbloqueia todas as versões."
  },
  "ru": {
    "heading": "Покупки и чаевые",
    "emptyTitle": "Пока нет покупок",
    "emptySubtitle": "Купленные модели и модели, которым вы оставили чаевые, появятся здесь.",
    "browseBtn": "Просмотреть библиотеку моделей",
    "colModel": "Модель",
    "colType": "Тип",
    "colAmount": "Сумма",
    "colStatus": "Статус",
    "colDate": "Дата",
    "kindTip": "Чаевые",
    "kindPurchase": "Покупка",
    "status": {
      "paid": "Оплачено",
      "refunded": "Возвращено",
      "disputed": "Оспорено"
    },
    "downloadNote": "Откройте купленную модель, чтобы скачать файлы — ваша покупка открывает доступ ко всем версиям."
  },
  "ja": {
    "heading": "購入とチップ",
    "emptyTitle": "まだ購入がありません",
    "emptySubtitle": "購入またはチップを送ったモデルがここに表示されます。",
    "browseBtn": "モデルライブラリを閲覧",
    "colModel": "モデル",
    "colType": "種類",
    "colAmount": "金額",
    "colStatus": "ステータス",
    "colDate": "日付",
    "kindTip": "チップ",
    "kindPurchase": "購入",
    "status": {
      "paid": "支払済",
      "refunded": "返金済",
      "disputed": "紛争中"
    },
    "downloadNote": "購入済みのモデルを開いてファイルをダウンロードしてください — 購入するとすべてのバージョンにアクセスできます。"
  },
  "zh": {
    "heading": "购买与小费",
    "emptyTitle": "暂无购买记录",
    "emptySubtitle": "您购买或打赏小费的模型将显示在这里。",
    "browseBtn": "浏览模型库",
    "colModel": "模型",
    "colType": "类型",
    "colAmount": "金额",
    "colStatus": "状态",
    "colDate": "日期",
    "kindTip": "小费",
    "kindPurchase": "购买",
    "status": {
      "paid": "已付款",
      "refunded": "已退款",
      "disputed": "争议中"
    },
    "downloadNote": "打开已购买的模型下载文件——您的购买解锁所有版本。"
  },
  "ko": {
    "heading": "구매 및 팁",
    "emptyTitle": "아직 구매 내역이 없습니다",
    "emptySubtitle": "구매하거나 팁을 준 모델이 여기에 표시됩니다.",
    "browseBtn": "모델 라이브러리 둘러보기",
    "colModel": "모델",
    "colType": "유형",
    "colAmount": "금액",
    "colStatus": "상태",
    "colDate": "날짜",
    "kindTip": "팁",
    "kindPurchase": "구매",
    "status": {
      "paid": "결제됨",
      "refunded": "환불됨",
      "disputed": "분쟁 중"
    },
    "downloadNote": "구매한 모델을 열어 파일을 다운로드하세요 — 구매하면 모든 버전을 이용할 수 있습니다."
  }
}
</i18n>
