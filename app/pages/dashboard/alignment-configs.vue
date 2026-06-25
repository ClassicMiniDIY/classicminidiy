<script lang="ts" setup>
  import { mmToInchFraction } from '~~/data/models/alignment';
  import type { SavedAlignmentConfig } from '~/composables/useAlignmentConfigs';

  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const { track } = useAnalytics();
  const { configs, loading, fetchConfigs, updateConfig, deleteConfig, addJournalEntry, deleteJournalEntry } =
    useAlignmentConfigs();

  watch(
    isAuthenticated,
    (authed) => {
      if (authed) fetchConfigs();
    },
    { immediate: true }
  );

  // Per-config draft note + expanded state
  const newNotes = reactive<Record<string, string>>({});
  const expanded = reactive<Record<string, boolean>>({});

  function toeText(mm: number) {
    if (Math.abs(mm) < 0.05) return t('parallel');
    const dir = mm < 0 ? t('toe_out') : t('toe_in');
    const mmText = `${Math.abs(mm).toFixed(2).replace(/\.?0+$/, '')} mm ${dir}`;
    const fraction = mmToInchFraction(mm);
    return fraction === '0' ? mmText : `${mmText} (${fraction})`;
  }
  const degText = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2).replace(/\.?0+$/, '')}°`;

  async function togglePublic(config: SavedAlignmentConfig) {
    await updateConfig(config.id, { is_public: !config.is_public });
    track('alignment_config_visibility_toggled', { config_id: config.id, is_public: !config.is_public });
  }

  async function handleDelete(id: string) {
    await deleteConfig(id);
    track('alignment_config_deleted', { config_id: id });
  }

  async function handleAddNote(id: string) {
    const body = (newNotes[id] ?? '').trim();
    if (!body) return;
    const result = await addJournalEntry(id, body);
    if (result) {
      newNotes[id] = '';
      track('alignment_journal_entry_added', { config_id: id });
    }
  }

  async function handleDeleteNote(id: string, entryId: string) {
    await deleteJournalEntry(id, entryId);
  }
</script>

<template>
  <div class="card bg-base-100 shadow-sm border border-base-300">
    <div class="card-body">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <i class="fad fa-tire mr-2"></i>
          <h2 class="text-lg font-semibold">{{ t('title') }}</h2>
        </div>
        <NuxtLink to="/technical/alignment" class="btn btn-outline btn-sm">
          <i class="fas fa-calculator"></i>
          {{ t('open_calculator') }}
        </NuxtLink>
      </div>

      <div v-if="loading" class="flex justify-center py-8">
        <span class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
      </div>

      <div v-else-if="configs.length === 0" class="text-center py-8 opacity-60">
        <i class="fas fa-inbox text-4xl mb-3 block"></i>
        <p class="mb-4">{{ t('empty') }}</p>
        <NuxtLink to="/technical/alignment" class="btn btn-primary btn-soft">{{ t('go_to_calculator') }}</NuxtLink>
      </div>

      <div v-else class="space-y-4">
        <div v-for="config in configs" :key="config.id" class="rounded-lg border border-base-300 p-4">
          <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <p class="font-medium">{{ config.name }}</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-2 text-xs opacity-70">
                <span><b>{{ t('front') }} {{ t('camber') }}:</b> {{ degText(config.front_camber) }}</span>
                <span><b>{{ t('rear') }} {{ t('camber') }}:</b> {{ degText(config.rear_camber) }}</span>
                <span><b>{{ t('front') }} {{ t('caster') }}:</b> {{ degText(config.front_caster) }}</span>
                <span><b>{{ t('rear') }} {{ t('toe') }}:</b> {{ toeText(config.rear_toe) }}</span>
                <span><b>{{ t('front') }} {{ t('toe') }}:</b> {{ toeText(config.front_toe) }}</span>
                <span v-if="config.wheel_size"><b>{{ t('wheel') }}:</b> {{ config.wheel_size }}"</span>
              </div>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <div class="flex items-center gap-2">
                <label class="text-xs opacity-60">{{ t('public') }}</label>
                <input
                  type="checkbox"
                  class="toggle toggle-primary toggle-sm"
                  :checked="config.is_public"
                  :aria-label="t('public')"
                  @change="togglePublic(config)"
                />
              </div>
              <button class="btn btn-ghost btn-sm btn-square text-error" :title="t('delete')" :aria-label="t('delete')" @click="handleDelete(config.id)">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>

          <!-- Journal -->
          <div class="mt-3 border-t border-base-300 pt-3">
            <button
              class="btn btn-ghost btn-xs gap-2"
              :aria-expanded="!!expanded[config.id]"
              @click="expanded[config.id] = !expanded[config.id]"
            >
              <i class="fas" :class="expanded[config.id] ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
              {{ t('journal') }}
              <span class="badge badge-xs">{{ config.journal?.length || 0 }}</span>
            </button>

            <div v-if="expanded[config.id]" class="mt-2 space-y-3">
              <div class="flex gap-2">
                <input
                  v-model="newNotes[config.id]"
                  type="text"
                  class="input input-bordered input-sm grow"
                  :placeholder="t('note_placeholder')"
                  :aria-label="t('note_placeholder')"
                  @keyup.enter="handleAddNote(config.id)"
                />
                <button class="btn btn-sm btn-primary" @click="handleAddNote(config.id)">
                  <i class="fas fa-plus"></i> {{ t('add_note') }}
                </button>
              </div>

              <div v-if="!config.journal?.length" class="text-xs opacity-60">{{ t('no_notes') }}</div>
              <ul v-else class="space-y-2">
                <li
                  v-for="entry in config.journal"
                  :key="entry.id"
                  class="flex items-start justify-between gap-3 text-sm rounded bg-base-200 px-3 py-2"
                >
                  <div class="min-w-0">
                    <span class="text-xs opacity-60 mr-2">{{ entry.date }}</span>
                    <span>{{ entry.body }}</span>
                  </div>
                  <button
                    class="btn btn-ghost btn-xs btn-square text-error shrink-0"
                    :title="t('delete_note')"
                    :aria-label="t('delete_note')"
                    @click="handleDeleteNote(config.id, entry.id)"
                  >
                    <i class="fas fa-xmark"></i>
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Saved Alignments",
    "open_calculator": "Open Calculator",
    "empty": "No saved alignments yet. Use the alignment calculator to save your first setup.",
    "go_to_calculator": "Go to Alignment Calculator",
    "front": "Front",
    "rear": "Rear",
    "camber": "camber",
    "caster": "caster",
    "toe": "toe",
    "wheel": "Wheel",
    "toe_in": "toe-in",
    "toe_out": "toe-out",
    "parallel": "parallel",
    "public": "Public",
    "delete": "Delete configuration",
    "journal": "Driving journal",
    "note_placeholder": "Add a dated note — handling, tyre wear, track day...",
    "add_note": "Add",
    "no_notes": "No notes yet. Log how the car feels as you tune.",
    "delete_note": "Delete note"
  },
  "es": {
    "title": "Alineaciones guardadas",
    "open_calculator": "Abrir calculadora",
    "empty": "Aún no hay alineaciones guardadas. Usa la calculadora de alineación para guardar tu primera configuración.",
    "go_to_calculator": "Ir a la calculadora de alineación",
    "front": "Delantero",
    "rear": "Trasero",
    "camber": "caída",
    "caster": "avance",
    "toe": "convergencia",
    "wheel": "Rueda",
    "toe_in": "convergencia",
    "toe_out": "divergencia",
    "parallel": "paralelo",
    "public": "Pública",
    "delete": "Eliminar configuración",
    "journal": "Diario de conducción",
    "note_placeholder": "Añade una nota fechada — comportamiento, desgaste de neumáticos, día de circuito...",
    "add_note": "Añadir",
    "no_notes": "Aún no hay notas. Registra cómo se siente el coche mientras lo ajustas.",
    "delete_note": "Eliminar nota"
  },
  "fr": {
    "title": "Géométries enregistrées",
    "open_calculator": "Ouvrir le calculateur",
    "empty": "Aucune géométrie enregistrée pour l'instant. Utilisez le calculateur de géométrie pour enregistrer votre premier réglage.",
    "go_to_calculator": "Aller au calculateur de géométrie",
    "front": "Avant",
    "rear": "Arrière",
    "camber": "carrossage",
    "caster": "chasse",
    "toe": "parallélisme",
    "wheel": "Roue",
    "toe_in": "pincement",
    "toe_out": "ouverture",
    "parallel": "parallèle",
    "public": "Publique",
    "delete": "Supprimer la configuration",
    "journal": "Journal de conduite",
    "note_placeholder": "Ajoutez une note datée — comportement, usure des pneus, journée circuit...",
    "add_note": "Ajouter",
    "no_notes": "Aucune note pour l'instant. Consignez le ressenti de la voiture au fil de vos réglages.",
    "delete_note": "Supprimer la note"
  },
  "de": {
    "title": "Gespeicherte Achseinstellungen",
    "open_calculator": "Rechner öffnen",
    "empty": "Noch keine gespeicherten Achseinstellungen. Nutze den Achsvermessungsrechner, um dein erstes Setup zu speichern.",
    "go_to_calculator": "Zum Achsvermessungsrechner",
    "front": "Vorne",
    "rear": "Hinten",
    "camber": "Sturz",
    "caster": "Nachlauf",
    "toe": "Spur",
    "wheel": "Rad",
    "toe_in": "Vorspur",
    "toe_out": "Nachspur",
    "parallel": "parallel",
    "public": "Öffentlich",
    "delete": "Konfiguration löschen",
    "journal": "Fahrtenjournal",
    "note_placeholder": "Datierte Notiz hinzufügen — Fahrverhalten, Reifenverschleiß, Trackday...",
    "add_note": "Hinzufügen",
    "no_notes": "Noch keine Notizen. Halte fest, wie sich das Auto beim Abstimmen anfühlt.",
    "delete_note": "Notiz löschen"
  },
  "it": {
    "title": "Allineamenti salvati",
    "open_calculator": "Apri calcolatore",
    "empty": "Nessun allineamento salvato. Usa il calcolatore di allineamento per salvare la tua prima configurazione.",
    "go_to_calculator": "Vai al calcolatore di allineamento",
    "front": "Anteriore",
    "rear": "Posteriore",
    "camber": "campanatura",
    "caster": "incidenza",
    "toe": "convergenza",
    "wheel": "Ruota",
    "toe_in": "convergenza",
    "toe_out": "divergenza",
    "parallel": "parallelo",
    "public": "Pubblico",
    "delete": "Elimina configurazione",
    "journal": "Diario di guida",
    "note_placeholder": "Aggiungi una nota datata — comportamento, usura pneumatici, giornata in pista...",
    "add_note": "Aggiungi",
    "no_notes": "Nessuna nota. Annota come si comporta l'auto mentre la metti a punto.",
    "delete_note": "Elimina nota"
  },
  "pt": {
    "title": "Alinhamentos Guardados",
    "open_calculator": "Abrir Calculadora",
    "empty": "Ainda não há alinhamentos guardados. Use a calculadora de alinhamento para guardar a sua primeira configuração.",
    "go_to_calculator": "Ir para a Calculadora de Alinhamento",
    "front": "Dianteiro",
    "rear": "Traseiro",
    "camber": "cambagem",
    "caster": "cáster",
    "toe": "convergência",
    "wheel": "Roda",
    "toe_in": "convergência",
    "toe_out": "divergência",
    "parallel": "paralelo",
    "public": "Pública",
    "delete": "Eliminar configuração",
    "journal": "Diário de condução",
    "note_placeholder": "Adicione uma nota datada — comportamento, desgaste dos pneus, dia de pista...",
    "add_note": "Adicionar",
    "no_notes": "Ainda não há notas. Registe como o carro se comporta à medida que afina.",
    "delete_note": "Eliminar nota"
  },
  "ru": {
    "title": "Сохранённые настройки",
    "open_calculator": "Открыть калькулятор",
    "empty": "Сохранённых настроек пока нет. Используйте калькулятор развал-схождения, чтобы сохранить первую настройку.",
    "go_to_calculator": "Перейти к калькулятору развал-схождения",
    "front": "Перед",
    "rear": "Зад",
    "camber": "развал",
    "caster": "кастер",
    "toe": "схождение",
    "wheel": "Колесо",
    "toe_in": "схождение",
    "toe_out": "расхождение",
    "parallel": "параллельно",
    "public": "Публичная",
    "delete": "Удалить конфигурацию",
    "journal": "Журнал поездок",
    "note_placeholder": "Добавьте датированную запись — управляемость, износ шин, трек-день...",
    "add_note": "Добавить",
    "no_notes": "Записей пока нет. Фиксируйте ощущения от машины по мере настройки.",
    "delete_note": "Удалить запись"
  },
  "ja": {
    "title": "保存済みアライメント",
    "open_calculator": "計算機を開く",
    "empty": "保存済みのアライメントはまだありません。アライメント計算機を使って最初のセットアップを保存してください。",
    "go_to_calculator": "アライメント計算機へ",
    "front": "フロント",
    "rear": "リア",
    "camber": "キャンバー",
    "caster": "キャスター",
    "toe": "トー",
    "wheel": "ホイール",
    "toe_in": "トーイン",
    "toe_out": "トーアウト",
    "parallel": "平行",
    "public": "公開",
    "delete": "設定を削除",
    "journal": "ドライビングジャーナル",
    "note_placeholder": "日付付きのメモを追加 — ハンドリング、タイヤの摩耗、トラックデー...",
    "add_note": "追加",
    "no_notes": "メモはまだありません。チューニングしながら車の感触を記録しましょう。",
    "delete_note": "メモを削除"
  },
  "zh": {
    "title": "已保存的四轮定位",
    "open_calculator": "打开计算器",
    "empty": "尚无已保存的四轮定位。使用四轮定位计算器保存您的首个设置。",
    "go_to_calculator": "前往四轮定位计算器",
    "front": "前轮",
    "rear": "后轮",
    "camber": "外倾角",
    "caster": "主销后倾角",
    "toe": "前束",
    "wheel": "车轮",
    "toe_in": "前束内束",
    "toe_out": "前束外束",
    "parallel": "平行",
    "public": "公开",
    "delete": "删除配置",
    "journal": "驾驶日志",
    "note_placeholder": "添加带日期的记录——操控性、轮胎磨损、赛道日……",
    "add_note": "添加",
    "no_notes": "尚无记录。在调校过程中记录车辆的感受。",
    "delete_note": "删除记录"
  },
  "ko": {
    "title": "저장된 얼라인먼트",
    "open_calculator": "계산기 열기",
    "empty": "아직 저장된 얼라인먼트가 없습니다. 얼라인먼트 계산기를 사용해 첫 세팅을 저장하세요.",
    "go_to_calculator": "얼라인먼트 계산기로 이동",
    "front": "앞",
    "rear": "뒤",
    "camber": "캠버",
    "caster": "캐스터",
    "toe": "토",
    "wheel": "휠",
    "toe_in": "토인",
    "toe_out": "토아웃",
    "parallel": "평행",
    "public": "공개",
    "delete": "구성 삭제",
    "journal": "주행 저널",
    "note_placeholder": "날짜가 기록된 메모 추가 — 핸들링, 타이어 마모, 트랙 데이...",
    "add_note": "추가",
    "no_notes": "아직 메모가 없습니다. 튜닝하면서 차량의 느낌을 기록하세요.",
    "delete_note": "메모 삭제"
  }
}
</i18n>
