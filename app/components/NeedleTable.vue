<script lang="ts" setup>
  import type { Item, SuggestedNeedles } from '../../data/models/needles';

  const { t } = useI18n();
  const { data: needlesTables, status } = await useFetch<SuggestedNeedles[]>(() => '/api/needles/suggested');

  // Table columns configuration
  const tableColumns = computed<{ accessorKey: keyof Item; header: string }[]>(() => [
    {
      accessorKey: 'engineSize',
      header: t('table_headers.engine_size'),
    },
    {
      accessorKey: 'needleStd',
      header: t('table_headers.needle_std'),
    },
    {
      accessorKey: 'needleRich',
      header: t('table_headers.needle_rich'),
    },
    {
      accessorKey: 'needleLean',
      header: t('table_headers.needle_lean'),
    },
    {
      accessorKey: 'springType',
      header: t('table_headers.spring_type'),
    },
  ]);
</script>

<template>
  <div class="grid grid-cols-12 gap-6">
    <div v-for="(table, name) in needlesTables" :key="name" class="col-span-12 md:col-span-6">
      <div class="card bg-base-100 shadow-md border border-base-300">
        <div class="card-body p-0">
          <div class="card-title p-4 border-b border-base-300">
            <div class="flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <h2 class="font-semibold text-lg">{{ table.title }}</h2>
            </div>
          </div>

          <!-- Table -->
          <div class="overflow-x-auto p-4">
            <div v-if="status === 'pending'" class="flex justify-center items-center py-8">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
            <table v-else class="table w-full">
              <thead>
                <tr>
                  <th v-for="col in tableColumns" :key="col.accessorKey">{{ col.header }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in table.items" :key="i">
                  <td v-for="col in tableColumns" :key="col.accessorKey">
                    {{ row[col.accessorKey] }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "table_headers": {
      "engine_size": "Engine Size",
      "needle_std": "Needle Std",
      "needle_rich": "Needle Rich",
      "needle_lean": "Needle Lean",
      "spring_type": "Spring Type"
    }
  },
  "de": {
    "table_headers": {
      "engine_size": "Motorgröße",
      "needle_std": "Düse Standard",
      "needle_rich": "Düse Fett",
      "needle_lean": "Düse Mager",
      "spring_type": "Federtyp"
    }
  },
  "es": {
    "table_headers": {
      "engine_size": "Tamaño del Motor",
      "needle_std": "Aguja Estándar",
      "needle_rich": "Aguja Rica",
      "needle_lean": "Aguja Pobre",
      "spring_type": "Tipo de Resorte"
    }
  },
  "fr": {
    "table_headers": {
      "engine_size": "Taille de moteur",
      "needle_std": "Aiguille standard",
      "needle_rich": "Aiguille riche",
      "needle_lean": "Aiguille pauvre",
      "spring_type": "Type de ressort"
    }
  },
  "it": {
    "table_headers": {
      "engine_size": "Cilindrata",
      "needle_std": "Ago standard",
      "needle_rich": "Ago ricco",
      "needle_lean": "Ago magro",
      "spring_type": "Tipo molla"
    }
  },
  "pt": {
    "table_headers": {
      "engine_size": "Tamanho do Motor",
      "needle_std": "Agulha Padrão",
      "needle_rich": "Agulha Rica",
      "needle_lean": "Agulha Pobre",
      "spring_type": "Tipo de Mola"
    }
  },
  "ru": {
    "table_headers": {
      "engine_size": "Объем двигателя",
      "needle_std": "Стандартная игла",
      "needle_rich": "Богатая игла",
      "needle_lean": "Бедная игла",
      "spring_type": "Тип пружины"
    }
  },
  "ja": {
    "table_headers": {
      "engine_size": "エンジンサイズ",
      "needle_std": "ニードル標準",
      "needle_rich": "ニードルリッチ",
      "needle_lean": "ニードルリーン",
      "spring_type": "スプリングタイプ"
    }
  },
  "zh": {
    "table_headers": {
      "engine_size": "发动机排量",
      "needle_std": "标准针阀",
      "needle_rich": "浓混合气针阀",
      "needle_lean": "稀混合气针阀",
      "spring_type": "弹簧类型"
    }
  },
  "ko": {
    "table_headers": {
      "engine_size": "엔진 크기",
      "needle_std": "니들 표준",
      "needle_rich": "니들 리치",
      "needle_lean": "니들 린",
      "spring_type": "스프링 타입"
    }
  }
}
</i18n>
