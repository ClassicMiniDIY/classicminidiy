<script setup lang="ts">
  import type { SavedGearConfig } from '../../composables/useGearConfigs';

  const { t } = useI18n();

  const props = defineProps<{
    open: boolean;
    configs: SavedGearConfig[];
    loading: boolean;
    slotsRemaining: number;
  }>();

  const emit = defineEmits<{
    'update:open': [value: boolean];
    load: [config: SavedGearConfig];
    delete: [id: string];
  }>();
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #header>
      <h3 class="text-lg font-semibold"><i class="fad fa-folder-open mr-2"></i>{{ t('title') }}</h3>
    </template>

    <div class="p-4">
      <div v-if="loading" class="flex justify-center py-8">
        <span class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
      </div>

      <div v-else-if="configs.length === 0" class="text-center py-8 opacity-60">
        <i class="fas fa-inbox text-4xl mb-3 block"></i>
        <p>{{ t('no_configs') }}</p>
      </div>

      <div v-else class="space-y-3 max-h-96 overflow-y-auto">
        <div
          v-for="config in configs"
          :key="config.id"
          class="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors"
        >
          <div class="min-w-0 flex-1">
            <p class="font-medium truncate">{{ config.name }}</p>
            <p class="text-xs opacity-60 mt-1">
              {{ config.gearset }} · {{ config.final_drive }}:1 · {{ config.drop_gear }}:1
            </p>
          </div>
          <div class="flex items-center gap-2 ml-4 shrink-0">
            <UButton size="sm" color="primary" :disabled="slotsRemaining <= 0" @click="emit('load', config)">
              {{ t('load') }}
            </UButton>
            <UButton
              size="sm"
              variant="ghost"
              color="error"
              icon="i-fa6-solid-trash"
              @click="emit('delete', config.id)"
            />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-between items-center w-full">
        <span class="text-sm opacity-60">
          {{ t('slots_remaining', { count: slotsRemaining }) }}
        </span>
        <UButton variant="ghost" @click="emit('update:open', false)">
          {{ t('close') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Load Saved Configuration",
    "no_configs": "No saved configurations yet. Save a configuration from the calculator to see it here.",
    "load": "Load",
    "close": "Close",
    "slots_remaining": "{count} comparison slots remaining"
  },
  "es": {
    "title": "Cargar Configuración Guardada",
    "no_configs": "Aún no hay configuraciones guardadas. Guarda una configuración desde la calculadora para verla aquí.",
    "load": "Cargar",
    "close": "Cerrar",
    "slots_remaining": "{count} espacios de comparación restantes"
  },
  "fr": {
    "title": "Charger une Configuration Sauvegardée",
    "no_configs": "Aucune configuration sauvegardée. Sauvegardez une configuration depuis le calculateur pour la voir ici.",
    "load": "Charger",
    "close": "Fermer",
    "slots_remaining": "{count} emplacements de comparaison restants"
  },
  "de": {
    "title": "Gespeicherte Konfiguration Laden",
    "no_configs": "Noch keine gespeicherten Konfigurationen. Speichern Sie eine Konfiguration vom Rechner, um sie hier zu sehen.",
    "load": "Laden",
    "close": "Schließen",
    "slots_remaining": "{count} Vergleichsplätze übrig"
  },
  "it": {
    "title": "Carica Configurazione Salvata",
    "no_configs": "Nessuna configurazione salvata. Salva una configurazione dalla calcolatrice per vederla qui.",
    "load": "Carica",
    "close": "Chiudi",
    "slots_remaining": "{count} slot di confronto rimanenti"
  },
  "pt": {
    "title": "Carregar Configuração Guardada",
    "no_configs": "Nenhuma configuração guardada ainda. Guarde uma configuração da calculadora para a ver aqui.",
    "load": "Carregar",
    "close": "Fechar",
    "slots_remaining": "{count} espaços de comparação restantes"
  },
  "ru": {
    "title": "Загрузить сохранённую конфигурацию",
    "no_configs": "Сохранённых конфигураций пока нет. Сохраните конфигурацию в калькуляторе, чтобы увидеть её здесь.",
    "load": "Загрузить",
    "close": "Закрыть",
    "slots_remaining": "Осталось {count} слотов для сравнения"
  },
  "ja": {
    "title": "保存済み設定を読み込む",
    "no_configs": "保存された設定はまだありません。計算ツールで設定を保存するとここに表示されます。",
    "load": "読み込む",
    "close": "閉じる",
    "slots_remaining": "比較スロットの残り: {count}"
  },
  "zh": {
    "title": "加载已保存的配置",
    "no_configs": "尚无已保存的配置。从计算器中保存一个配置即可在此显示。",
    "load": "加载",
    "close": "关闭",
    "slots_remaining": "剩余 {count} 个对比槽位"
  },
  "ko": {
    "title": "저장된 구성 불러오기",
    "no_configs": "저장된 구성이 없습니다. 계산기에서 구성을 저장하면 여기에 표시됩니다.",
    "load": "불러오기",
    "close": "닫기",
    "slots_remaining": "비교 슬롯 {count}개 남음"
  }
}
</i18n>
