<script setup lang="ts">
  import { options } from '../../../data/models/gearing';
  import type { GearConfig } from '../../types/gearing';

  const { t } = useI18n();

  const props = defineProps<{
    config: GearConfig;
    colorIndex: number;
    canDelete: boolean;
    isAuthenticated: boolean;
    isSaving: boolean;
  }>();

  const emit = defineEmits<{
    'update:config': [value: GearConfig];
    delete: [];
    save: [];
  }>();

  const CONFIG_COLORS = ['#5b8a8a', '#c17f59', '#7a9a6d', '#8b6d8b', '#6b7fa0'];

  const color = computed(() => CONFIG_COLORS[props.colorIndex] || CONFIG_COLORS[0]);

  const isEditing = ref(false);
  const editName = ref(props.config.name);

  // USelect requires string values - serialize arrays to JSON strings
  const gearRatioOptions = computed(() =>
    options.gearRatios.map((item) => ({
      label: item.label,
      value: JSON.stringify(item.value),
    }))
  );

  // Current gearset as a JSON string for USelect model-value
  const gearsetStringValue = computed(() => JSON.stringify(props.config.gearset));

  const diffOptions = computed(() =>
    options.diffs.map((item) => ({
      label: item.label,
      value: String(item.value),
    }))
  );

  const dropGearOptions = computed(() =>
    options.dropGears.map((item) => ({
      label: item.label,
      value: String(item.value),
    }))
  );

  function getAutoName(): string {
    const gearLabel =
      options.gearRatios.find((g) => JSON.stringify(g.value) === JSON.stringify(props.config.gearset))?.label ||
      'Custom';
    const shortGear = gearLabel.length > 30 ? gearLabel.substring(0, 30) + '...' : gearLabel;
    return `${shortGear} · ${props.config.finalDrive}:1 · ${props.config.dropGear}:1`;
  }

  function startEditing() {
    editName.value = props.config.name;
    isEditing.value = true;
  }

  function finishEditing() {
    isEditing.value = false;
    if (editName.value.trim()) {
      emit('update:config', { ...props.config, name: editName.value.trim() });
    }
  }

  function updateGearset(value: string) {
    const parsed = JSON.parse(value) as number[];
    const updated = { ...props.config, gearset: parsed };
    if (!props.config.savedId) updated.name = getAutoName();
    emit('update:config', updated);
  }

  function updateFinalDrive(value: string) {
    const updated = { ...props.config, finalDrive: parseFloat(value) };
    if (!props.config.savedId) updated.name = getAutoName();
    emit('update:config', updated);
  }

  function updateDropGear(value: string) {
    const updated = { ...props.config, dropGear: parseFloat(value) };
    if (!props.config.savedId) updated.name = getAutoName();
    emit('update:config', updated);
  }
</script>

<template>
  <div
    class="rounded-lg border p-4 flex flex-col md:flex-row md:items-center gap-4"
    :style="{ borderLeftWidth: '4px', borderLeftColor: color }"
  >
    <!-- Name -->
    <div class="flex items-center gap-2 min-w-0 md:w-48">
      <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: color }"></span>
      <template v-if="isEditing">
        <UInput
          v-model="editName"
          size="sm"
          class="flex-1"
          maxlength="100"
          @keyup.enter="finishEditing"
          @blur="finishEditing"
          autofocus
        />
      </template>
      <template v-else>
        <span
          class="text-sm font-medium truncate cursor-pointer hover:underline"
          :title="config.name"
          @click="startEditing"
        >
          {{ config.name }}
        </span>
      </template>
    </div>

    <!-- Dropdowns -->
    <div class="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
      <USelect
        :model-value="gearsetStringValue"
        :items="gearRatioOptions"
        value-key="value"
        size="sm"
        class="w-full"
        @update:model-value="updateGearset"
      />
      <USelect
        :model-value="String(config.finalDrive)"
        :items="diffOptions"
        value-key="value"
        size="sm"
        class="w-full"
        @update:model-value="updateFinalDrive"
      />
      <USelect
        :model-value="String(config.dropGear)"
        :items="dropGearOptions"
        value-key="value"
        size="sm"
        class="w-full"
        @update:model-value="updateDropGear"
      />
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2 shrink-0">
      <UButton
        v-if="isAuthenticated"
        :icon="config.savedId ? 'i-fa6-solid-bookmark' : 'i-fa6-regular-bookmark'"
        variant="ghost"
        size="sm"
        :loading="isSaving"
        :title="config.savedId ? t('saved') : t('save')"
        @click="emit('save')"
      />
      <UButton
        v-if="canDelete"
        icon="i-fa6-solid-xmark"
        variant="ghost"
        color="error"
        size="sm"
        :title="t('remove')"
        @click="emit('delete')"
      />
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "save": "Save configuration",
    "saved": "Configuration saved",
    "remove": "Remove configuration"
  },
  "es": {
    "save": "Guardar configuración",
    "saved": "Configuración guardada",
    "remove": "Eliminar configuración"
  },
  "fr": {
    "save": "Sauvegarder la configuration",
    "saved": "Configuration sauvegardée",
    "remove": "Supprimer la configuration"
  },
  "de": {
    "save": "Konfiguration speichern",
    "saved": "Konfiguration gespeichert",
    "remove": "Konfiguration entfernen"
  },
  "it": {
    "save": "Salva configurazione",
    "saved": "Configurazione salvata",
    "remove": "Rimuovi configurazione"
  },
  "pt": {
    "save": "Salvar configuração",
    "saved": "Configuração salva",
    "remove": "Remover configuração"
  },
  "ru": {
    "save": "Сохранить конфигурацию",
    "saved": "Конфигурация сохранена",
    "remove": "Удалить конфигурацию"
  },
  "ja": {
    "save": "設定を保存",
    "saved": "設定が保存されました",
    "remove": "設定を削除"
  },
  "zh": {
    "save": "保存配置",
    "saved": "配置已保存",
    "remove": "删除配置"
  },
  "ko": {
    "save": "구성 저장",
    "saved": "구성이 저장되었습니다",
    "remove": "구성 제거"
  }
}
</i18n>
