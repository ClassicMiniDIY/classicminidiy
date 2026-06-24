<script setup lang="ts">
  import { mmToInchFraction } from '../../../data/models/alignment';
  import { useAlignmentConfigs, type SavedAlignmentConfig } from '../../composables/useAlignmentConfigs';

  const { t } = useI18n();

  const open = defineModel<boolean>({ required: true });
  const emit = defineEmits<{ load: [config: SavedAlignmentConfig] }>();

  const { configs, loading, fetchConfigs, deleteConfig } = useAlignmentConfigs();

  watch(open, (isOpen) => {
    if (isOpen) fetchConfigs();
  });

  function toeShort(mm: number) {
    if (Math.abs(mm) < 0.05) return t('parallel');
    return `${mmToInchFraction(mm)} ${mm < 0 ? t('out') : t('in')}`;
  }
  function summary(c: SavedAlignmentConfig) {
    return `${t('front')}: ${c.front_camber}° · ${toeShort(c.front_toe)}  ·  ${t('rear')}: ${c.rear_camber}° · ${toeShort(
      c.rear_toe
    )}`;
  }

  async function handleDelete(id: string) {
    await deleteConfig(id);
  }
</script>

<template>
  <div class="modal" :class="{ 'modal-open': open }">
    <div class="modal-box max-w-2xl">
      <h3 class="text-lg font-semibold"><i class="fad fa-folder-open mr-2"></i>{{ t('title') }}</h3>

      <div class="py-4">
        <div v-if="loading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>

        <div v-else-if="configs.length === 0" class="text-center py-8 opacity-60">
          <i class="fas fa-inbox text-4xl mb-3 block"></i>
          <p>{{ t('no_configs') }}</p>
        </div>

        <div v-else class="space-y-3 max-h-96 overflow-y-auto">
          <div
            v-for="config in configs"
            :key="config.id"
            class="flex items-center justify-between p-3 rounded-lg border border-base-300 hover:bg-base-200 transition-colors"
          >
            <div class="min-w-0 flex-1">
              <p class="font-medium truncate">{{ config.name }}</p>
              <p class="text-xs opacity-60 mt-1 truncate">{{ summary(config) }}</p>
            </div>
            <div class="flex items-center gap-2 ml-4 shrink-0">
              <button class="btn btn-sm btn-primary" @click="emit('load', config)">{{ t('load') }}</button>
              <button class="btn btn-sm btn-ghost text-error" :aria-label="t('delete')" @click="handleDelete(config.id)">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" @click="open = false">{{ t('close') }}</button>
      </div>
    </div>
    <div class="modal-backdrop" @click="open = false"></div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Load Saved Alignment",
    "no_configs": "No saved alignments yet. Save one from the calculator to see it here.",
    "load": "Load",
    "delete": "Delete configuration",
    "close": "Close",
    "front": "F",
    "rear": "R",
    "in": "in",
    "out": "out",
    "parallel": "parallel"
  },
  "es": {
    "title": "Cargar alineación guardada",
    "no_configs": "Aún no hay alineaciones guardadas. Guarda una desde la calculadora para verla aquí.",
    "load": "Cargar",
    "delete": "Eliminar configuración",
    "close": "Cerrar",
    "front": "D",
    "rear": "T",
    "in": "positiva",
    "out": "negativa",
    "parallel": "paralelo"
  },
  "fr": {
    "title": "Charger une géométrie enregistrée",
    "no_configs": "Aucune géométrie enregistrée pour l'instant. Enregistrez-en une depuis le calculateur pour la voir ici.",
    "load": "Charger",
    "delete": "Supprimer la configuration",
    "close": "Fermer",
    "front": "Av",
    "rear": "Ar",
    "in": "pincement",
    "out": "ouverture",
    "parallel": "parallèle"
  },
  "de": {
    "title": "Gespeicherte Achseinstellung laden",
    "no_configs": "Noch keine gespeicherten Achseinstellungen. Speichere eine aus dem Rechner, um sie hier zu sehen.",
    "load": "Laden",
    "delete": "Konfiguration löschen",
    "close": "Schließen",
    "front": "V",
    "rear": "H",
    "in": "innen",
    "out": "außen",
    "parallel": "parallel"
  },
  "it": {
    "title": "Carica allineamento salvato",
    "no_configs": "Nessun allineamento salvato. Salvane uno dal calcolatore per vederlo qui.",
    "load": "Carica",
    "delete": "Elimina configurazione",
    "close": "Chiudi",
    "front": "A",
    "rear": "P",
    "in": "in",
    "out": "out",
    "parallel": "parallelo"
  },
  "pt": {
    "title": "Carregar Alinhamento Guardado",
    "no_configs": "Ainda não há alinhamentos guardados. Guarde um a partir da calculadora para o ver aqui.",
    "load": "Carregar",
    "delete": "Eliminar configuração",
    "close": "Fechar",
    "front": "D",
    "rear": "T",
    "in": "dentro",
    "out": "fora",
    "parallel": "paralelo"
  },
  "ru": {
    "title": "Загрузить сохранённую настройку",
    "no_configs": "Сохранённых настроек пока нет. Сохраните одну из калькулятора, чтобы увидеть её здесь.",
    "load": "Загрузить",
    "delete": "Удалить конфигурацию",
    "close": "Закрыть",
    "front": "П",
    "rear": "З",
    "in": "внутрь",
    "out": "наружу",
    "parallel": "параллельно"
  },
  "ja": {
    "title": "保存済みアライメントを読み込む",
    "no_configs": "保存済みのアライメントはまだありません。計算機から保存するとここに表示されます。",
    "load": "読み込む",
    "delete": "設定を削除",
    "close": "閉じる",
    "front": "F",
    "rear": "R",
    "in": "イン",
    "out": "アウト",
    "parallel": "平行"
  },
  "zh": {
    "title": "加载已保存的四轮定位",
    "no_configs": "尚无已保存的四轮定位。在计算器中保存一个即可在此处查看。",
    "load": "加载",
    "delete": "删除配置",
    "close": "关闭",
    "front": "前",
    "rear": "后",
    "in": "内束",
    "out": "外束",
    "parallel": "平行"
  },
  "ko": {
    "title": "저장된 얼라인먼트 불러오기",
    "no_configs": "아직 저장된 얼라인먼트가 없습니다. 계산기에서 하나를 저장하면 여기에 표시됩니다.",
    "load": "불러오기",
    "delete": "구성 삭제",
    "close": "닫기",
    "front": "F",
    "rear": "R",
    "in": "인",
    "out": "아웃",
    "parallel": "평행"
  }
}
</i18n>
