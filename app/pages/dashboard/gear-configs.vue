<script lang="ts" setup>
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const { track } = useAnalytics();
  const { configs, loading, fetchConfigs, updateConfig, deleteConfig } = useGearConfigs();

  watch(
    isAuthenticated,
    (authed) => {
      if (authed) fetchConfigs();
    },
    { immediate: true }
  );

  async function togglePublic(id: string, isPublic: boolean) {
    await updateConfig(id, { is_public: !isPublic });
    track('gear_config_visibility_toggled', { config_id: id, is_public: !isPublic });
  }

  async function handleDelete(id: string) {
    await deleteConfig(id);
    track('gear_config_deleted', { config_id: id });
  }
</script>

<template>
  <div class="card bg-base-100 shadow-sm border border-base-300">
    <div class="card-body">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <i class="fad fa-gears mr-2"></i>
          <h2 class="text-lg font-semibold">{{ t('gear_configs.title') }}</h2>
        </div>
        <NuxtLink to="/technical/gearing" class="btn btn-outline btn-sm">
          <i class="fas fa-calculator"></i>
          {{ t('gear_configs.open_calculator') }}
        </NuxtLink>
      </div>

      <div v-if="loading" class="flex justify-center py-8">
        <span class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
      </div>

      <div v-else-if="configs.length === 0" class="text-center py-8 opacity-60">
        <i class="fas fa-inbox text-4xl mb-3 block"></i>
        <p class="mb-4">{{ t('gear_configs.empty') }}</p>
        <NuxtLink to="/technical/gearing" class="btn btn-primary btn-soft">
          {{ t('gear_configs.go_to_calculator') }}
        </NuxtLink>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="config in configs"
          :key="config.id"
          class="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border border-base-300 gap-4"
        >
          <div class="min-w-0 flex-1">
            <p class="font-medium truncate">{{ config.name }}</p>
            <p class="text-xs opacity-60 mt-1">
              {{ config.gearset }} · {{ config.final_drive }}:1 · {{ config.drop_gear }}:1
            </p>
            <p class="text-xs opacity-40 mt-1">
              {{ t('gear_configs.tire') }}: {{ config.tire }} · {{ t('gear_configs.rpm') }}: {{ config.max_rpm }}
            </p>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <div class="flex items-center gap-2">
              <label class="text-xs opacity-60">{{ t('gear_configs.public') }}</label>
              <input
                type="checkbox"
                class="toggle toggle-primary toggle-sm"
                :checked="config.is_public"
                @change="togglePublic(config.id, config.is_public)"
              />
            </div>
            <button
              class="btn btn-ghost btn-sm btn-square text-error"
              :title="t('gear_configs.delete')"
              @click="handleDelete(config.id)"
            >
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "gear_configs": {
      "title": "Saved Gear Configurations",
      "open_calculator": "Open Calculator",
      "empty": "No saved configurations yet. Use the gearing calculator to save your first configuration.",
      "go_to_calculator": "Go to Gearing Calculator",
      "tire": "Tire",
      "rpm": "Max RPM",
      "public": "Public",
      "delete": "Delete configuration"
    }
  },
  "es": {
    "gear_configs": {
      "title": "Configuraciones de Engranajes Guardadas",
      "open_calculator": "Abrir Calculadora",
      "empty": "Aún no hay configuraciones guardadas. Usa la calculadora de engranajes para guardar tu primera configuración.",
      "go_to_calculator": "Ir a la Calculadora de Engranajes",
      "tire": "Neumático",
      "rpm": "RPM Máximo",
      "public": "Público",
      "delete": "Eliminar configuración"
    }
  },
  "fr": {
    "gear_configs": {
      "title": "Configurations d'Engrenages Sauvegardées",
      "open_calculator": "Ouvrir le Calculateur",
      "empty": "Aucune configuration sauvegardée. Utilisez le calculateur d'engrenages pour sauvegarder votre première configuration.",
      "go_to_calculator": "Aller au Calculateur d'Engrenages",
      "tire": "Pneu",
      "rpm": "RPM Max",
      "public": "Public",
      "delete": "Supprimer la configuration"
    }
  },
  "de": {
    "gear_configs": {
      "title": "Gespeicherte Getriebe-Konfigurationen",
      "open_calculator": "Rechner öffnen",
      "empty": "Noch keine gespeicherten Konfigurationen. Verwenden Sie den Getrieberechner, um Ihre erste Konfiguration zu speichern.",
      "go_to_calculator": "Zum Getrieberechner",
      "tire": "Reifen",
      "rpm": "Max Drehzahl",
      "public": "Öffentlich",
      "delete": "Konfiguration löschen"
    }
  },
  "it": {
    "gear_configs": {
      "title": "Configurazioni Ingranaggi Salvate",
      "open_calculator": "Apri Calcolatore",
      "empty": "Nessuna configurazione salvata. Usa il calcolatore degli ingranaggi per salvare la tua prima configurazione.",
      "go_to_calculator": "Vai al Calcolatore Ingranaggi",
      "tire": "Pneumatico",
      "rpm": "RPM Max",
      "public": "Pubblico",
      "delete": "Elimina configurazione"
    }
  },
  "pt": {
    "gear_configs": {
      "title": "Configurações de Engrenagens Salvas",
      "open_calculator": "Abrir Calculadora",
      "empty": "Nenhuma configuração salva. Use a calculadora de engrenagens para salvar sua primeira configuração.",
      "go_to_calculator": "Ir para a Calculadora de Engrenagens",
      "tire": "Pneu",
      "rpm": "RPM Máx",
      "public": "Público",
      "delete": "Excluir configuração"
    }
  },
  "ru": {
    "gear_configs": {
      "title": "Сохранённые конфигурации передач",
      "open_calculator": "Открыть калькулятор",
      "empty": "Нет сохранённых конфигураций. Используйте калькулятор передач для сохранения первой конфигурации.",
      "go_to_calculator": "Перейти к калькулятору передач",
      "tire": "Шина",
      "rpm": "Макс. об/мин",
      "public": "Публичный",
      "delete": "Удалить конфигурацию"
    }
  },
  "ja": {
    "gear_configs": {
      "title": "保存済みギア設定",
      "open_calculator": "計算機を開く",
      "empty": "保存済み設定がまだありません。ギア計算機を使用して最初の設定を保存しましょう。",
      "go_to_calculator": "ギア計算機へ",
      "tire": "タイヤ",
      "rpm": "最大RPM",
      "public": "公開",
      "delete": "設定を削除"
    }
  },
  "zh": {
    "gear_configs": {
      "title": "已保存的齿轮配置",
      "open_calculator": "打开计算器",
      "empty": "还没有保存的配置。使用齿轮计算器保存您的第一个配置。",
      "go_to_calculator": "前往齿轮计算器",
      "tire": "轮胎",
      "rpm": "最大转速",
      "public": "公开",
      "delete": "删除配置"
    }
  },
  "ko": {
    "gear_configs": {
      "title": "저장된 기어 구성",
      "open_calculator": "계산기 열기",
      "empty": "저장된 구성이 아직 없습니다. 기어 계산기를 사용하여 첫 번째 구성을 저장하세요.",
      "go_to_calculator": "기어 계산기로 이동",
      "tire": "타이어",
      "rpm": "최대 RPM",
      "public": "공개",
      "delete": "구성 삭제"
    }
  }
}
</i18n>
