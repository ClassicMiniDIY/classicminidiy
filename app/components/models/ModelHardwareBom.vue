<script setup lang="ts">
  import type { HardwareItem } from '~~/data/models/model-library';

  const { t } = useI18n();
  const props = defineProps<{ items: HardwareItem[] }>();
  const hasItems = computed(() => Array.isArray(props.items) && props.items.length > 0);
</script>

<template>
  <div v-if="hasItems" class="card bg-base-100 shadow-sm border border-base-300">
    <div class="card-body">
      <h3 class="card-title text-lg">
        <i class="fas fa-screwdriver-wrench text-primary mr-1"></i> {{ t('title') }}
      </h3>
      <div class="overflow-x-auto">
        <table class="table table-sm w-full">
          <thead>
            <tr class="border-b border-base-300">
              <th class="text-left">{{ t('colItem') }}</th>
              <th class="text-center w-16">{{ t('colQty') }}</th>
              <th class="text-left">{{ t('colNotes') }}</th>
              <th class="w-10"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, i) in items" :key="i" class="border-b border-base-300 last:border-0">
              <td class="font-medium">
                {{ item.item }}
                <span v-if="item.optional" class="badge badge-ghost badge-xs ml-1">{{ t('optional') }}</span>
              </td>
              <td class="text-center">{{ item.quantity }}</td>
              <td class="text-sm opacity-80">{{ item.notes || '—' }}</td>
              <td>
                <a
                  v-if="item.purchaseUrl"
                  :href="item.purchaseUrl"
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  class="btn btn-ghost btn-xs"
                  :title="t('whereToBuy')"
                >
                  <i class="fas fa-cart-shopping"></i>
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Hardware / bill of materials",
    "colItem": "Item",
    "colQty": "Qty",
    "colNotes": "Notes",
    "optional": "optional",
    "whereToBuy": "Where to buy"
  },
  "es": {
    "title": "Hardware / lista de materiales",
    "colItem": "Artículo",
    "colQty": "Cant.",
    "colNotes": "Notas",
    "optional": "opcional",
    "whereToBuy": "Dónde comprar"
  },
  "fr": {
    "title": "Matériel / nomenclature",
    "colItem": "Article",
    "colQty": "Qté",
    "colNotes": "Notes",
    "optional": "optionnel",
    "whereToBuy": "Où acheter"
  },
  "de": {
    "title": "Hardware / Stückliste",
    "colItem": "Artikel",
    "colQty": "Menge",
    "colNotes": "Hinweise",
    "optional": "optional",
    "whereToBuy": "Bezugsquelle"
  },
  "it": {
    "title": "Componentistica / distinta materiali",
    "colItem": "Articolo",
    "colQty": "Qtà",
    "colNotes": "Note",
    "optional": "opzionale",
    "whereToBuy": "Dove acquistare"
  },
  "pt": {
    "title": "Hardware / lista de materiais",
    "colItem": "Item",
    "colQty": "Qtd.",
    "colNotes": "Notas",
    "optional": "opcional",
    "whereToBuy": "Onde comprar"
  },
  "ru": {
    "title": "Комплектующие / перечень материалов",
    "colItem": "Деталь",
    "colQty": "Кол-во",
    "colNotes": "Примечания",
    "optional": "опционально",
    "whereToBuy": "Где купить"
  },
  "ja": {
    "title": "ハードウェア / 部品表",
    "colItem": "品目",
    "colQty": "数量",
    "colNotes": "備考",
    "optional": "任意",
    "whereToBuy": "購入先"
  },
  "zh": {
    "title": "硬件 / 物料清单",
    "colItem": "零件",
    "colQty": "数量",
    "colNotes": "备注",
    "optional": "可选",
    "whereToBuy": "购买链接"
  },
  "ko": {
    "title": "하드웨어 / 부품 목록",
    "colItem": "품목",
    "colQty": "수량",
    "colNotes": "비고",
    "optional": "선택",
    "whereToBuy": "구매처"
  }
}
</i18n>
