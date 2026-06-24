<script setup lang="ts">
  import {
    ALIGNMENT_PARAMETERS,
    ALIGNMENT_PRESETS,
    ALIGNMENT_WHEEL_SIZES,
    ALIGNMENT_DEFAULT_WHEEL_SIZE,
    defaultAlignmentValues,
    getAlignmentPreset,
    mmToInchFraction,
    toeMmToDegrees,
    getCamberGuidance,
    type AlignmentValues,
    type AlignmentParamId,
    type AlignmentPresetId,
    type AlignmentAxle,
  } from '../../../data/models/alignment';
  import {
    useAlignmentConfigs,
    alignmentValuesToColumns,
    columnsToAlignmentValues,
    type SavedAlignmentConfig,
  } from '../../composables/useAlignmentConfigs';

  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const { track } = useAnalytics();
  const { capture } = usePostHog();
  const { saveConfig } = useAlignmentConfigs();

  const values = reactive<AlignmentValues>(defaultAlignmentValues());
  const wheelSize = ref<number>(ALIGNMENT_DEFAULT_WHEEL_SIZE);

  const frontParams = ALIGNMENT_PARAMETERS.filter((p) => p.axle === 'front');
  const rearParams = ALIGNMENT_PARAMETERS.filter((p) => p.axle === 'rear');

  const EPS = 0.01;
  const matchedPresetId = computed<AlignmentPresetId | null>(() => {
    const match = ALIGNMENT_PRESETS.find((p) =>
      (Object.keys(p.values) as (keyof AlignmentValues)[]).every((k) => Math.abs(p.values[k] - values[k]) < EPS)
    );
    return match ? match.id : null;
  });
  const activePreset = computed(() => (matchedPresetId.value ? getAlignmentPreset(matchedPresetId.value) : null));

  function applyPreset(id: AlignmentPresetId) {
    const preset = getAlignmentPreset(id);
    if (!preset) return;
    Object.assign(values, preset.values);
    track('alignment_preset_selected', { preset: id });
  }
  function resetStock() {
    applyPreset('stockRoad');
  }

  // ---- formatting / readouts ----
  const fmtDeg = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2).replace(/\.?0+$/, '')}°`;
  const toeDir = (mm: number) => (Math.abs(mm) < 0.05 ? t('parallel') : mm < 0 ? t('toe_out') : t('toe_in'));
  const toeFraction = (mm: number) => mmToInchFraction(mm);
  const toeDegTotal = (mm: number) => toeMmToDegrees(mm, wheelSize.value);

  // Wheel-size-aware camber guidance: the typical negative range for the selected rim, plus a
  // gentle nudge when the chosen camber is more negative than that range.
  function camberRangeText(axle: AlignmentAxle): string {
    const g = getCamberGuidance(wheelSize.value, axle);
    return `${fmtDeg(g.min)}…${fmtDeg(g.max)}`;
  }
  function isCamberAggressive(id: AlignmentParamId): boolean {
    const param = ALIGNMENT_PARAMETERS.find((p) => p.id === id)!;
    if (param.kind !== 'camber') return false;
    const g = getCamberGuidance(wheelSize.value, param.axle);
    return values[id] < g.min - 0.01;
  }

  function paramReadout(id: AlignmentParamId): string {
    const v = values[id];
    const param = ALIGNMENT_PARAMETERS.find((p) => p.id === id)!;
    if (param.kind === 'toe') {
      if (Math.abs(v) < 0.05) return t('parallel');
      const mmText = `${Math.abs(v).toFixed(2).replace(/\.?0+$/, '')} mm ${toeDir(v)}`;
      const fraction = toeFraction(v);
      return fraction === '0' ? mmText : `${mmText} · ${fraction}`;
    }
    return fmtDeg(v);
  }

  const warnings = computed<string[]>(() => {
    const w: string[] = [];
    if (values.rearToe < -EPS) w.push('rearToeOut');
    if (values.frontCaster > 5.5) w.push('casterHigh');
    if (values.rearCamber > 0.25) w.push('rearCamberPositive');
    if (values.frontCamber > 0.25) w.push('frontCamberPositive');
    return w;
  });

  // ---- save ----
  const showSaveForm = ref(false);
  const saveName = ref('');
  const saveNote = ref('');
  const savePublic = ref(false);
  const saving = ref(false);
  const saveError = ref('');
  const saveSuccess = ref(false);

  async function handleSave() {
    if (!saveName.value.trim()) {
      saveError.value = t('save.name_required');
      return;
    }
    saving.value = true;
    saveError.value = '';
    const journal = saveNote.value.trim()
      ? [
          {
            id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
            date: new Date().toISOString().slice(0, 10),
            body: saveNote.value.trim(),
          },
        ]
      : [];
    const result = await saveConfig({
      name: saveName.value.trim(),
      ...alignmentValuesToColumns(values),
      wheel_size: String(wheelSize.value),
      preset: matchedPresetId.value,
      journal,
      is_public: savePublic.value,
    });
    saving.value = false;
    if (result) {
      saveSuccess.value = true;
      showSaveForm.value = false;
      saveName.value = '';
      saveNote.value = '';
      savePublic.value = false;
      track('alignment_config_saved', { preset: matchedPresetId.value ?? 'custom' });
      setTimeout(() => (saveSuccess.value = false), 4000);
    } else {
      saveError.value = t('save.error');
    }
  }

  // ---- load ----
  const showLoadModal = ref(false);
  function onLoad(config: SavedAlignmentConfig) {
    Object.assign(values, columnsToAlignmentValues(config));
    if (config.wheel_size && ALIGNMENT_WHEEL_SIZES.includes(Number(config.wheel_size) as any)) {
      wheelSize.value = Number(config.wheel_size);
    }
    showLoadModal.value = false;
    track('alignment_config_loaded', { config_id: config.id });
  }

  // ---- analytics (debounced) ----
  let captureTimer: ReturnType<typeof setTimeout> | null = null;
  watch(
    () => ({ ...values }),
    () => {
      if (captureTimer) clearTimeout(captureTimer);
      captureTimer = setTimeout(() => {
        capture('calculator_used', { calculator: 'alignment', preset: matchedPresetId.value ?? 'custom' });
      }, 1000);
    },
    { deep: true }
  );
  onUnmounted(() => {
    if (captureTimer) clearTimeout(captureTimer);
  });
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Preset selector -->
    <section>
      <h3 class="fancy-font-bold text-lg mb-1">{{ t('presets_title') }}</h3>
      <p class="text-sm opacity-70 mb-3">{{ t('presets_subtitle') }}</p>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        <button
          v-for="preset in ALIGNMENT_PRESETS"
          :key="preset.id"
          class="btn btn-sm h-auto py-2 flex-col gap-1 normal-case"
          :class="matchedPresetId === preset.id ? 'btn-primary' : 'btn-outline'"
          @click="applyPreset(preset.id)"
        >
          <span class="font-semibold">{{ t(`presets.${preset.id}.name`) }}</span>
          <span class="badge badge-xs" :class="`confidence-${preset.confidence}`">
            {{ t(`confidence.${preset.confidence}`) }}
          </span>
        </button>
      </div>
    </section>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Controls -->
      <section class="flex flex-col gap-5">
        <!-- Wheel size -->
        <fieldset class="fieldset">
          <legend class="fieldset-legend flex items-center gap-2">
            <i class="fad fa-tire"></i>
            {{ t('wheel_size') }}
          </legend>
          <div class="join">
            <button
              v-for="size in ALIGNMENT_WHEEL_SIZES"
              :key="size"
              class="btn btn-sm join-item"
              :class="wheelSize === size ? 'btn-primary' : 'btn-outline'"
              @click="wheelSize = size"
            >
              {{ size }}"
            </button>
          </div>
          <p class="text-xs opacity-60 mt-1">{{ t('wheel_size_help') }}</p>
        </fieldset>

        <!-- Front group -->
        <div>
          <h4 class="fancy-font-bold text-base mb-2 flex items-center gap-2">
            <i class="fad fa-arrow-up"></i> {{ t('front_axle') }}
          </h4>
          <div class="flex flex-col gap-4">
            <div v-for="param in frontParams" :key="param.id" class="rounded-lg border border-base-300 p-3">
              <div class="flex items-center justify-between gap-2 mb-1">
                <label class="text-sm font-medium">{{ t(`params.${param.id}.label`) }}</label>
                <span class="text-sm font-bold tabular-nums">{{ paramReadout(param.id) }}</span>
              </div>
              <div class="flex items-center gap-3">
                <input
                  v-model.number="values[param.id]"
                  type="range"
                  class="range range-primary range-sm grow"
                  :min="param.min"
                  :max="param.max"
                  :step="param.step"
                />
                <input
                  v-model.number="values[param.id]"
                  type="number"
                  class="input input-bordered input-sm w-20"
                  :min="param.min"
                  :max="param.max"
                  :step="param.step"
                />
                <span class="text-xs opacity-60 w-6">{{ param.unit === 'deg' ? '°' : 'mm' }}</span>
              </div>
              <p class="text-xs opacity-60 mt-1">{{ t(`params.${param.id}.help`) }}</p>
              <p v-if="param.kind === 'toe'" class="text-xs opacity-50 mt-0.5">
                {{ t('approx_total_deg', { deg: toeDegTotal(values[param.id]).toFixed(2) }) }}
              </p>
              <p v-if="param.kind === 'camber'" class="text-xs opacity-50 mt-0.5">
                {{ t('camber_guidance', { size: wheelSize, range: camberRangeText(param.axle) }) }}
              </p>
              <p v-if="param.kind === 'camber' && isCamberAggressive(param.id)" class="text-xs text-warning mt-0.5">
                <i class="fas fa-triangle-exclamation"></i> {{ t('camber_aggressive', { size: wheelSize }) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Rear group -->
        <div>
          <h4 class="fancy-font-bold text-base mb-2 flex items-center gap-2">
            <i class="fad fa-arrow-down"></i> {{ t('rear_axle') }}
          </h4>
          <div class="flex flex-col gap-4">
            <div v-for="param in rearParams" :key="param.id" class="rounded-lg border border-base-300 p-3">
              <div class="flex items-center justify-between gap-2 mb-1">
                <label class="text-sm font-medium">{{ t(`params.${param.id}.label`) }}</label>
                <span class="text-sm font-bold tabular-nums">{{ paramReadout(param.id) }}</span>
              </div>
              <div class="flex items-center gap-3">
                <input
                  v-model.number="values[param.id]"
                  type="range"
                  class="range range-primary range-sm grow"
                  :min="param.min"
                  :max="param.max"
                  :step="param.step"
                />
                <input
                  v-model.number="values[param.id]"
                  type="number"
                  class="input input-bordered input-sm w-20"
                  :min="param.min"
                  :max="param.max"
                  :step="param.step"
                />
                <span class="text-xs opacity-60 w-6">{{ param.unit === 'deg' ? '°' : 'mm' }}</span>
              </div>
              <p class="text-xs opacity-60 mt-1">{{ t(`params.${param.id}.help`) }}</p>
              <p v-if="param.kind === 'toe'" class="text-xs opacity-50 mt-0.5">
                {{ t('approx_total_deg', { deg: toeDegTotal(values[param.id]).toFixed(2) }) }}
              </p>
              <p v-if="param.kind === 'camber'" class="text-xs opacity-50 mt-0.5">
                {{ t('camber_guidance', { size: wheelSize, range: camberRangeText(param.axle) }) }}
              </p>
              <p v-if="param.kind === 'camber' && isCamberAggressive(param.id)" class="text-xs text-warning mt-0.5">
                <i class="fas fa-triangle-exclamation"></i> {{ t('camber_aggressive', { size: wheelSize }) }}
              </p>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button class="btn btn-sm btn-ghost" @click="resetStock">
            <i class="fas fa-rotate-left"></i> {{ t('reset_to_stock') }}
          </button>
        </div>
      </section>

      <!-- Diagram + readouts -->
      <section class="flex flex-col gap-4">
        <CalculatorsAlignmentDiagram
          :front-camber="values.frontCamber"
          :front-caster="values.frontCaster"
          :front-toe="values.frontToe"
          :rear-camber="values.rearCamber"
          :rear-toe="values.rearToe"
        />

        <!-- Warnings -->
        <div v-if="warnings.length" class="flex flex-col gap-2">
          <div v-for="w in warnings" :key="w" class="alert alert-warning py-2 text-sm">
            <i class="fas fa-triangle-exclamation"></i>
            <span>{{ t(`warnings.${w}`) }}</span>
          </div>
        </div>

        <!-- Active preset info -->
        <div class="card bg-base-100 border border-base-300">
          <div class="card-body p-4">
            <div class="flex items-center justify-between gap-2">
              <h4 class="fancy-font-bold text-base">
                {{ activePreset ? t(`presets.${activePreset.id}.name`) : t('custom_setup') }}
              </h4>
              <span v-if="activePreset" class="badge badge-sm" :class="`confidence-${activePreset.confidence}`">
                {{ t('confidence_label') }}: {{ t(`confidence.${activePreset.confidence}`) }}
              </span>
            </div>
            <p class="text-sm opacity-80">
              {{ activePreset ? t(`presets.${activePreset.id}.rationale`) : t('custom_setup_desc') }}
            </p>
            <div v-if="activePreset?.sources?.length" class="text-xs opacity-60">
              <span class="font-semibold">{{ t('sources') }}:</span>
              <a
                v-for="(src, i) in activePreset.sources"
                :key="src"
                :href="src"
                target="_blank"
                rel="noopener noreferrer"
                class="link link-primary ml-1"
                >[{{ i + 1 }}]</a
              >
            </div>
          </div>
        </div>

        <!-- Save / Load -->
        <div class="card bg-base-100 border border-base-300">
          <div class="card-body p-4">
            <template v-if="isAuthenticated">
              <div class="flex flex-wrap gap-2">
                <button class="btn btn-sm btn-primary" @click="showSaveForm = !showSaveForm">
                  <i class="fas fa-bookmark"></i> {{ t('save.button') }}
                </button>
                <button class="btn btn-sm btn-outline" @click="showLoadModal = true">
                  <i class="fas fa-folder-open"></i> {{ t('load.button') }}
                </button>
                <NuxtLink to="/dashboard/alignment-configs" class="btn btn-sm btn-ghost">
                  <i class="fas fa-list"></i> {{ t('manage') }}
                </NuxtLink>
              </div>

              <div v-if="saveSuccess" class="alert alert-success py-2 text-sm mt-2">
                <i class="fas fa-circle-check"></i> <span>{{ t('save.success') }}</span>
              </div>

              <div v-if="showSaveForm" class="mt-3 flex flex-col gap-3">
                <fieldset class="fieldset">
                  <legend class="fieldset-legend">{{ t('save.name_label') }}</legend>
                  <input
                    v-model="saveName"
                    type="text"
                    maxlength="100"
                    class="input input-bordered w-full"
                    :placeholder="t('save.name_placeholder')"
                  />
                </fieldset>
                <fieldset class="fieldset">
                  <legend class="fieldset-legend">{{ t('save.note_label') }}</legend>
                  <textarea
                    v-model="saveNote"
                    rows="2"
                    class="textarea textarea-bordered w-full"
                    :placeholder="t('save.note_placeholder')"
                  ></textarea>
                </fieldset>
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input v-model="savePublic" type="checkbox" class="toggle toggle-primary toggle-sm" />
                  {{ t('save.make_public') }}
                </label>
                <p v-if="saveError" class="text-error text-sm">{{ saveError }}</p>
                <div class="flex gap-2">
                  <button class="btn btn-sm btn-primary" :disabled="saving" @click="handleSave">
                    <span v-if="saving" class="loading loading-spinner loading-xs"></span>
                    {{ t('save.confirm') }}
                  </button>
                  <button class="btn btn-sm btn-ghost" @click="showSaveForm = false">{{ t('save.cancel') }}</button>
                </div>
              </div>
            </template>
            <template v-else>
              <p class="text-sm opacity-70 mb-2">{{ t('save.sign_in_prompt') }}</p>
              <NuxtLink to="/login" class="btn btn-sm btn-primary w-fit">
                <i class="fas fa-right-to-bracket"></i> {{ t('save.sign_in') }}
              </NuxtLink>
            </template>
          </div>
        </div>
      </section>
    </div>

    <!-- Disclaimer -->
    <div class="alert alert-info py-3 text-sm">
      <i class="fas fa-circle-info"></i>
      <span>{{ t('disclaimer') }}</span>
    </div>

    <CalculatorsAlignmentSaveLoadModal v-model="showLoadModal" @load="onLoad" />
  </div>
</template>

<style scoped>
  .confidence-high {
    background: color-mix(in srgb, #4caf50 22%, transparent);
    color: #2e7d32;
    border: none;
  }
  .confidence-medium {
    background: color-mix(in srgb, var(--cm-fa-orange, #f3b140) 28%, transparent);
    color: #8a6d00;
    border: none;
  }
  .confidence-low {
    background: color-mix(in srgb, var(--cm-secondary, #ed7135) 22%, transparent);
    color: #b34a17;
    border: none;
  }
</style>

<i18n lang="json">
{
  "en": {
    "presets_title": "Start from a preset",
    "presets_subtitle": "Research-derived starting points from MED, Mini Spares, Calver, The Mini Forum and the factory manuals. Tweak from here.",
    "front_axle": "Front axle",
    "rear_axle": "Rear axle",
    "wheel_size": "Wheel size",
    "wheel_size_help": "Used for the toe degree readout and camber guidance — camber recommendations scale with rim size. Presets assume ~10\" wheels.",
    "reset_to_stock": "Reset to factory",
    "parallel": "parallel",
    "toe_in": "toe-in",
    "toe_out": "toe-out",
    "approx_total_deg": "≈ {deg}° total at the rim",
    "camber_guidance": "Typical {size}\" range: {range}",
    "camber_aggressive": "More negative than typical for {size}\" — watch inner-edge tyre wear",
    "custom_setup": "Custom setup",
    "custom_setup_desc": "You've adjusted away from the presets. Remember: front runs toe-out, rear runs toe-in, and caster stays positive. Match left and right within 0.5°.",
    "confidence_label": "Confidence",
    "sources": "Sources",
    "manage": "Manage saved",
    "params": {
      "frontCamber": {
        "label": "Front camber",
        "help": "Positive = top leans out, negative = top leans in. Stock is positive; performance runs negative. Needs adjustable/offset lower arms."
      },
      "frontCaster": {
        "label": "Front caster",
        "help": "Always positive. Set via adjustable tie-bars. Keep both sides within 0.5° and don't exceed ~5.5°."
      },
      "frontToe": {
        "label": "Front toe (total)",
        "help": "Negative = toe-out, positive = toe-in. Total across both wheels — set each side to half. Adjusted at the track-rod ends."
      },
      "rearCamber": {
        "label": "Rear camber",
        "help": "Negative = top leans in. Never run notable positive at the rear. Set via eccentric washers or adjustable brackets."
      },
      "rearToe": {
        "label": "Rear toe (total)",
        "help": "Positive = toe-in (mandatory for road stability). Negative (toe-out) is race-only. Set via shims or adjustable brackets."
      }
    },
    "presets": {
      "stockRoad": {
        "name": "Stock Road",
        "rationale": "Factory workshop-manual geometry. Note the front camber is positive (+2°) and the front runs slight toe-out — both are correct for the Mini, not typos. The rear runs 1/8\" toe-in for straight-line stability."
      },
      "fastRoad": {
        "name": "Fast Road",
        "rationale": "Sharper turn-in than stock while staying streetable and easy on tyres. Flips front camber negative to keep the loaded tyre flat through body roll, with a touch more caster for self-centring. Keeps mild front toe-out and lighter rear toe-in."
      },
      "trackDay": {
        "name": "Track Day",
        "rationale": "Maximum cornering grip on road or semi-slick tyres; accepts faster tyre wear. More negative front camber and more caster; rear set straight to let the back rotate on turn-in. The tyre sets the camber ceiling — verify on a rig."
      },
      "boostedRoad": {
        "name": "Boosted Road",
        "rationale": "Turbo or supercharged street car. The key change is front toe set parallel (zero) to cut torque steer and improve drive off the line, with healthy caster for stability under power and larger rear toe-in for traction."
      },
      "boostedTrack": {
        "name": "Boosted Track",
        "rationale": "High-power forced-induction circuit car — the most extrapolated preset, so treat it as a starting point only. Aggressive front camber and caster with only a small front toe-out so power still goes down, plus mild rear toe-in for stability under acceleration."
      }
    },
    "confidence": {
      "high": "High confidence",
      "medium": "Medium",
      "low": "Low / extrapolated"
    },
    "warnings": {
      "rearToeOut": "Rear toe-out can cause snap oversteer — only suitable for experienced drivers on a full-race rotation setup.",
      "casterHigh": "Caster above 5.5° is beyond the usual practical limit and adds heavy steering effort.",
      "rearCamberPositive": "Positive rear camber makes the back nervous — the rear should run neutral to mild negative.",
      "frontCamberPositive": "Positive front camber is the factory figure for skinny crossplies; most modern setups run negative for grip."
    },
    "save": {
      "button": "Save setup",
      "confirm": "Save",
      "cancel": "Cancel",
      "name_label": "Configuration name",
      "name_placeholder": "e.g. My 1275 fast road",
      "name_required": "Please enter a name",
      "note_label": "First journal note (optional)",
      "note_placeholder": "e.g. Baseline before track day — car understeers on turn-in",
      "make_public": "Make this configuration public",
      "success": "Configuration saved to your profile",
      "error": "Could not save configuration. Please try again.",
      "sign_in_prompt": "Sign in to save this setup to your profile and keep a driving journal over time.",
      "sign_in": "Sign in to save"
    },
    "load": {
      "button": "Load saved"
    },
    "disclaimer": "These are starting points, not gospel. Always verify on a proper alignment rig (eyeballed toe is frequently wrong by 1/8\" or more), match caster and camber side-to-side within 0.5°, and re-check after any ride-height change. Alignment only partially tames torque steer on a boosted Mini."
  },
  "es": {
    "presets_title": "Empieza desde un preajuste",
    "presets_subtitle": "Puntos de partida basados en investigación de MED, Mini Spares, Calver, The Mini Forum y los manuales de fábrica. Ajusta a partir de aquí.",
    "front_axle": "Eje delantero",
    "rear_axle": "Eje trasero",
    "wheel_size": "Tamaño de llanta",
    "wheel_size_help": "Se usa para la lectura de la convergencia en grados y la orientación de la caída — las recomendaciones de caída varían según el tamaño de la llanta. Los preajustes asumen llantas de ~10\".",
    "reset_to_stock": "Restablecer a fábrica",
    "parallel": "paralelo",
    "toe_in": "convergencia",
    "toe_out": "divergencia",
    "approx_total_deg": "≈ {deg}° total en la llanta",
    "camber_guidance": "Rango típico {size}\": {range}",
    "camber_aggressive": "Más negativo de lo típico para {size}\" — vigila el desgaste interior",
    "custom_setup": "Configuración personalizada",
    "custom_setup_desc": "Te has alejado de los preajustes. Recuerda: el delantero lleva divergencia, el trasero lleva convergencia y el avance se mantiene positivo. Iguala izquierda y derecha dentro de 0,5°.",
    "confidence_label": "Confianza",
    "sources": "Fuentes",
    "manage": "Gestionar guardados",
    "params": {
      "frontCamber": {
        "label": "Caída delantera",
        "help": "Positiva = la parte superior se inclina hacia afuera, negativa = la parte superior se inclina hacia adentro. De fábrica es positiva; las versiones de rendimiento llevan negativa. Requiere brazos inferiores ajustables/descentrados."
      },
      "frontCaster": {
        "label": "Avance delantero",
        "help": "Siempre positivo. Se ajusta mediante las barras de tracción ajustables. Mantén ambos lados dentro de 0,5° y no superes los ~5,5°."
      },
      "frontToe": {
        "label": "Convergencia delantera (total)",
        "help": "Negativa = divergencia, positiva = convergencia. Total entre ambas ruedas — ajusta cada lado a la mitad. Se regula en los extremos de las barras de dirección."
      },
      "rearCamber": {
        "label": "Caída trasera",
        "help": "Negativa = la parte superior se inclina hacia adentro. Nunca lleves caída positiva notable en el eje trasero. Se ajusta mediante arandelas excéntricas o soportes ajustables."
      },
      "rearToe": {
        "label": "Convergencia trasera (total)",
        "help": "Positiva = convergencia (obligatoria para la estabilidad en carretera). Negativa (divergencia) es solo para competición. Se ajusta mediante suplementos o soportes ajustables."
      }
    },
    "presets": {
      "stockRoad": {
        "name": "Carretera estándar",
        "rationale": "Geometría del manual de taller de fábrica. Fíjate en que la caída delantera es positiva (+2°) y el delantero lleva ligera divergencia — ambos son correctos para el Mini, no son errores. El trasero lleva 1/8\" de convergencia para la estabilidad en línea recta."
      },
      "fastRoad": {
        "name": "Carretera rápida",
        "rationale": "Entrada en curva más afilada que la estándar, pero apta para calle y suave con los neumáticos. Pasa la caída delantera a negativa para mantener plano el neumático cargado durante el balanceo de la carrocería, con algo más de avance para el autocentrado. Conserva una leve divergencia delantera y menos convergencia trasera."
      },
      "trackDay": {
        "name": "Día de circuito",
        "rationale": "Máximo agarre en curva con neumáticos de calle o semislick; acepta un desgaste más rápido de los neumáticos. Más caída delantera negativa y más avance; el trasero se ajusta recto para dejar que la parte trasera rote en la entrada. El neumático marca el límite de caída — verifícalo en un banco."
      },
      "boostedRoad": {
        "name": "Carretera sobrealimentada",
        "rationale": "Coche de calle turbo o sobrealimentado. El cambio clave es ajustar la convergencia delantera en paralelo (cero) para reducir el tiro de par y mejorar la salida desde parado, con un buen avance para la estabilidad bajo potencia y más convergencia trasera para la tracción."
      },
      "boostedTrack": {
        "name": "Circuito sobrealimentado",
        "rationale": "Coche de circuito de alta potencia con sobrealimentación — el preajuste más extrapolado, así que trátalo solo como punto de partida. Caída y avance delanteros agresivos con apenas una pequeña divergencia delantera para que la potencia siga llegando al suelo, más una leve convergencia trasera para la estabilidad bajo aceleración."
      }
    },
    "confidence": {
      "high": "Confianza alta",
      "medium": "Media",
      "low": "Baja / extrapolada"
    },
    "warnings": {
      "rearToeOut": "La divergencia trasera puede provocar sobreviraje brusco — solo apta para conductores experimentados en una configuración de rotación de pura competición.",
      "casterHigh": "Un avance superior a 5,5° está más allá del límite práctico habitual y aumenta mucho el esfuerzo de dirección.",
      "rearCamberPositive": "La caída trasera positiva vuelve nerviosa la parte trasera — el eje trasero debe llevar de neutra a ligeramente negativa.",
      "frontCamberPositive": "La caída delantera positiva es el valor de fábrica para los neumáticos diagonales estrechos; la mayoría de las configuraciones modernas llevan negativa para mejorar el agarre."
    },
    "save": {
      "button": "Guardar configuración",
      "confirm": "Guardar",
      "cancel": "Cancelar",
      "name_label": "Nombre de la configuración",
      "name_placeholder": "p. ej. Mi 1275 de carretera rápida",
      "name_required": "Introduce un nombre",
      "note_label": "Primera nota del diario (opcional)",
      "note_placeholder": "p. ej. Referencia antes del día de circuito — el coche subvira en la entrada",
      "make_public": "Hacer pública esta configuración",
      "success": "Configuración guardada en tu perfil",
      "error": "No se pudo guardar la configuración. Inténtalo de nuevo.",
      "sign_in_prompt": "Inicia sesión para guardar esta configuración en tu perfil y mantener un diario de conducción a lo largo del tiempo.",
      "sign_in": "Inicia sesión para guardar"
    },
    "load": {
      "button": "Cargar guardada"
    },
    "disclaimer": "Estos son puntos de partida, no dogmas. Verifica siempre en un banco de alineación adecuado (la convergencia medida a ojo suele estar mal por 1/8\" o más), iguala el avance y la caída entre ambos lados dentro de 0,5° y vuelve a comprobar tras cualquier cambio de altura de marcha. La alineación solo dompta parcialmente el tiro de par en un Mini sobrealimentado."
  },
  "fr": {
    "presets_title": "Partir d'un préréglage",
    "presets_subtitle": "Points de départ issus de recherches chez MED, Mini Spares, Calver, The Mini Forum et les manuels d'usine. Ajustez à partir de là.",
    "front_axle": "Train avant",
    "rear_axle": "Train arrière",
    "wheel_size": "Taille de roue",
    "wheel_size_help": "Utilisée pour l'affichage du parallélisme en degrés et les conseils de carrossage — les recommandations de carrossage évoluent selon la taille de jante. Les préréglages supposent des roues d'environ 10\".",
    "reset_to_stock": "Réinitialiser aux valeurs d'usine",
    "parallel": "parallèle",
    "toe_in": "pincement",
    "toe_out": "ouverture",
    "approx_total_deg": "≈ {deg}° au total à la jante",
    "camber_guidance": "Plage typique {size}\" : {range}",
    "camber_aggressive": "Plus négatif que la normale pour {size}\" — surveille l'usure intérieure",
    "custom_setup": "Réglage personnalisé",
    "custom_setup_desc": "Vous vous êtes écarté des préréglages. Rappelez-vous : l'avant est en ouverture, l'arrière en pincement, et la chasse reste positive. Faites correspondre gauche et droite à 0,5° près.",
    "confidence_label": "Confiance",
    "sources": "Sources",
    "manage": "Gérer les enregistrements",
    "params": {
      "frontCamber": {
        "label": "Carrossage avant",
        "help": "Positif = le haut penche vers l'extérieur, négatif = le haut penche vers l'intérieur. La valeur d'usine est positive ; les configurations sport sont négatives. Nécessite des bras inférieurs réglables/décalés."
      },
      "frontCaster": {
        "label": "Chasse avant",
        "help": "Toujours positive. Réglée via des barres de réaction réglables. Gardez les deux côtés à 0,5° près et ne dépassez pas ~5,5°."
      },
      "frontToe": {
        "label": "Parallélisme avant (total)",
        "help": "Négatif = ouverture, positif = pincement. Total sur les deux roues — réglez chaque côté à la moitié. Réglé au niveau des embouts de biellette de direction."
      },
      "rearCamber": {
        "label": "Carrossage arrière",
        "help": "Négatif = le haut penche vers l'intérieur. Ne jamais rouler avec un carrossage nettement positif à l'arrière. Réglé via des rondelles excentriques ou des supports réglables."
      },
      "rearToe": {
        "label": "Parallélisme arrière (total)",
        "help": "Positif = pincement (obligatoire pour la stabilité sur route). Négatif (ouverture) réservé à la compétition. Réglé via des cales ou des supports réglables."
      }
    },
    "presets": {
      "stockRoad": {
        "name": "Route d'origine",
        "rationale": "Géométrie du manuel d'atelier d'usine. Notez que le carrossage avant est positif (+2°) et que l'avant roule en légère ouverture — les deux sont corrects pour la Mini, ce ne sont pas des erreurs. L'arrière roule avec 1/8\" de pincement pour la stabilité en ligne droite."
      },
      "fastRoad": {
        "name": "Route sportive",
        "rationale": "Mise en virage plus incisive que d'origine tout en restant utilisable sur route et indulgent pour les pneus. Passe le carrossage avant en négatif pour garder le pneu chargé à plat dans le roulis, avec un peu plus de chasse pour le rappel. Conserve une légère ouverture à l'avant et un pincement plus léger à l'arrière."
      },
      "trackDay": {
        "name": "Journée circuit",
        "rationale": "Adhérence maximale en virage sur pneus route ou semi-slicks ; accepte une usure plus rapide des pneus. Carrossage avant plus négatif et plus de chasse ; arrière réglé droit pour laisser l'arrière pivoter en entrée de virage. Le pneu fixe le plafond de carrossage — vérifiez sur un banc."
      },
      "boostedRoad": {
        "name": "Route suralimentée",
        "rationale": "Voiture de route turbo ou compressée. Le changement clé est le parallélisme avant réglé parallèle (zéro) pour réduire l'effet de couple dans la direction et améliorer la motricité au départ, avec une bonne dose de chasse pour la stabilité en charge et un pincement arrière plus important pour la traction."
      },
      "boostedTrack": {
        "name": "Circuit suralimenté",
        "rationale": "Voiture de circuit suralimentée à forte puissance — le préréglage le plus extrapolé, à considérer donc uniquement comme un point de départ. Carrossage et chasse avant agressifs avec seulement une petite ouverture avant pour que la puissance passe au sol, plus un léger pincement arrière pour la stabilité à l'accélération."
      }
    },
    "confidence": {
      "high": "Confiance élevée",
      "medium": "Moyenne",
      "low": "Faible / extrapolée"
    },
    "warnings": {
      "rearToeOut": "Une ouverture à l'arrière peut provoquer un survirage brutal — réservée aux pilotes expérimentés sur une configuration de pivotement full-race.",
      "casterHigh": "Une chasse supérieure à 5,5° dépasse la limite pratique habituelle et alourdit fortement la direction.",
      "rearCamberPositive": "Un carrossage arrière positif rend l'arrière nerveux — l'arrière doit rouler de neutre à légèrement négatif.",
      "frontCamberPositive": "Le carrossage avant positif est la valeur d'usine pour les pneus diagonaux étroits ; la plupart des configurations modernes roulent en négatif pour l'adhérence."
    },
    "save": {
      "button": "Enregistrer le réglage",
      "confirm": "Enregistrer",
      "cancel": "Annuler",
      "name_label": "Nom de la configuration",
      "name_placeholder": "ex. Ma 1275 route sportive",
      "name_required": "Veuillez saisir un nom",
      "note_label": "Première note de journal (facultatif)",
      "note_placeholder": "ex. Référence avant la journée circuit — la voiture sous-vire en entrée de virage",
      "make_public": "Rendre cette configuration publique",
      "success": "Configuration enregistrée dans votre profil",
      "error": "Impossible d'enregistrer la configuration. Veuillez réessayer.",
      "sign_in_prompt": "Connectez-vous pour enregistrer ce réglage dans votre profil et tenir un journal de conduite dans le temps.",
      "sign_in": "Se connecter pour enregistrer"
    },
    "load": {
      "button": "Charger un enregistrement"
    },
    "disclaimer": "Ce sont des points de départ, pas des vérités absolues. Vérifiez toujours sur un banc de géométrie approprié (le parallélisme estimé à l'œil est souvent faux de 1/8\" ou plus), faites correspondre chasse et carrossage côté à côté à 0,5° près, et revérifiez après tout changement de hauteur de caisse. La géométrie ne maîtrise que partiellement l'effet de couple dans la direction sur une Mini suralimentée."
  },
  "de": {
    "presets_title": "Mit einer Voreinstellung beginnen",
    "presets_subtitle": "Recherchierte Ausgangswerte von MED, Mini Spares, Calver, The Mini Forum und den Werkstatthandbüchern. Von hier aus anpassen.",
    "front_axle": "Vorderachse",
    "rear_axle": "Hinterachse",
    "wheel_size": "Radgröße",
    "wheel_size_help": "Wird für die Spuranzeige in Grad und die Sturzempfehlung verwendet — Sturzempfehlungen skalieren mit der Felgengröße. Voreinstellungen gehen von ~10\"-Rädern aus.",
    "reset_to_stock": "Auf Werkseinstellung zurücksetzen",
    "parallel": "parallel",
    "toe_in": "Vorspur",
    "toe_out": "Nachspur",
    "approx_total_deg": "≈ {deg}° gesamt an der Felge",
    "camber_guidance": "Typischer {size}\"-Bereich: {range}",
    "camber_aggressive": "Negativer als üblich für {size}\" — auf inneren Reifenverschleiß achten",
    "custom_setup": "Individuelles Setup",
    "custom_setup_desc": "Du hast die Voreinstellungen verändert. Denk daran: vorne läuft Nachspur, hinten läuft Vorspur, und der Nachlauf bleibt positiv. Links und rechts auf 0,5° abgleichen.",
    "confidence_label": "Verlässlichkeit",
    "sources": "Quellen",
    "manage": "Gespeicherte verwalten",
    "params": {
      "frontCamber": {
        "label": "Sturz vorne",
        "help": "Positiv = oben neigt nach außen, negativ = oben neigt nach innen. Serie ist positiv; Performance läuft negativ. Erfordert verstellbare/versetzte untere Querlenker."
      },
      "frontCaster": {
        "label": "Nachlauf vorne",
        "help": "Immer positiv. Über verstellbare Zugstreben eingestellt. Beide Seiten auf 0,5° halten und ~5,5° nicht überschreiten."
      },
      "frontToe": {
        "label": "Spur vorne (gesamt)",
        "help": "Negativ = Nachspur, positiv = Vorspur. Gesamtwert über beide Räder — jede Seite auf die Hälfte einstellen. An den Spurstangenköpfen eingestellt."
      },
      "rearCamber": {
        "label": "Sturz hinten",
        "help": "Negativ = oben neigt nach innen. Hinten niemals nennenswert positiv fahren. Über exzentrische Scheiben oder verstellbare Halterungen eingestellt."
      },
      "rearToe": {
        "label": "Spur hinten (gesamt)",
        "help": "Positiv = Vorspur (zwingend erforderlich für Straßenstabilität). Negativ (Nachspur) ist nur für den Rennsport. Über Distanzscheiben oder verstellbare Halterungen eingestellt."
      }
    },
    "presets": {
      "stockRoad": {
        "name": "Serie Straße",
        "rationale": "Werksgeometrie aus dem Werkstatthandbuch. Beachte, dass der Sturz vorne positiv ist (+2°) und vorne leichte Nachspur läuft — beides ist beim Mini korrekt, keine Tippfehler. Hinten läuft 1/8\" Vorspur für Geradeauslaufstabilität."
      },
      "fastRoad": {
        "name": "Schnelle Straße",
        "rationale": "Schärferes Einlenken als Serie, dabei alltagstauglich und reifenschonend. Kippt den Sturz vorne ins Negative, damit der belastete Reifen bei Wankbewegungen flach bleibt, mit etwas mehr Nachlauf für die Selbstzentrierung. Behält milde Nachspur vorne und leichtere Vorspur hinten bei."
      },
      "trackDay": {
        "name": "Trackday",
        "rationale": "Maximaler Kurvengrip auf Straßen- oder Semislick-Reifen; nimmt schnelleren Reifenverschleiß in Kauf. Mehr negativer Sturz vorne und mehr Nachlauf; hinten auf parallel gestellt, damit das Heck beim Einlenken eindreht. Der Reifen gibt die Sturzobergrenze vor — auf dem Prüfstand verifizieren."
      },
      "boostedRoad": {
        "name": "Aufgeladen Straße",
        "rationale": "Turbo- oder kompressoraufgeladenes Straßenfahrzeug. Die wichtigste Änderung ist die Spur vorne auf parallel (null), um Antriebseinflüsse auf die Lenkung zu reduzieren und den Vortrieb von der Linie weg zu verbessern, mit ausreichend Nachlauf für Stabilität unter Last und größerer Vorspur hinten für Traktion."
      },
      "boostedTrack": {
        "name": "Aufgeladen Rennstrecke",
        "rationale": "Hochleistungs-Rennstreckenfahrzeug mit Aufladung — die am weitesten extrapolierte Voreinstellung, daher nur als Ausgangspunkt behandeln. Aggressiver Sturz und Nachlauf vorne mit nur geringer Nachspur vorne, damit die Leistung noch auf die Straße kommt, plus milde Vorspur hinten für Stabilität unter Beschleunigung."
      }
    },
    "confidence": {
      "high": "Hohe Verlässlichkeit",
      "medium": "Mittel",
      "low": "Niedrig / extrapoliert"
    },
    "warnings": {
      "rearToeOut": "Nachspur hinten kann zu plötzlichem Übersteuern führen — nur geeignet für erfahrene Fahrer mit einem reinen Renn-Setup auf Eindrehen.",
      "casterHigh": "Ein Nachlauf über 5,5° liegt jenseits der üblichen praktischen Grenze und erhöht die Lenkkräfte erheblich.",
      "rearCamberPositive": "Positiver Sturz hinten macht das Heck nervös — hinten sollte neutral bis leicht negativ laufen.",
      "frontCamberPositive": "Positiver Sturz vorne ist der Werkswert für schmale Diagonalreifen; die meisten modernen Setups laufen für den Grip negativ."
    },
    "save": {
      "button": "Setup speichern",
      "confirm": "Speichern",
      "cancel": "Abbrechen",
      "name_label": "Konfigurationsname",
      "name_placeholder": "z. B. Meine 1275 schnelle Straße",
      "name_required": "Bitte einen Namen eingeben",
      "note_label": "Erste Journalnotiz (optional)",
      "note_placeholder": "z. B. Basis vor dem Trackday — Auto untersteuert beim Einlenken",
      "make_public": "Diese Konfiguration öffentlich machen",
      "success": "Konfiguration in deinem Profil gespeichert",
      "error": "Konfiguration konnte nicht gespeichert werden. Bitte erneut versuchen.",
      "sign_in_prompt": "Melde dich an, um dieses Setup in deinem Profil zu speichern und mit der Zeit ein Fahrtenjournal zu führen.",
      "sign_in": "Zum Speichern anmelden"
    },
    "load": {
      "button": "Gespeicherte laden"
    },
    "disclaimer": "Dies sind Ausgangspunkte, kein Dogma. Verifiziere immer auf einem ordentlichen Achsvermessungsstand (per Augenmaß geschätzte Spur liegt häufig um 1/8\" oder mehr daneben), gleiche Nachlauf und Sturz seitenweise auf 0,5° ab und überprüfe nach jeder Änderung der Fahrzeughöhe erneut. Die Achsvermessung zähmt Antriebseinflüsse auf die Lenkung bei einem aufgeladenen Mini nur teilweise."
  },
  "it": {
    "presets_title": "Parti da un preset",
    "presets_subtitle": "Punti di partenza derivati da ricerche di MED, Mini Spares, Calver, The Mini Forum e dai manuali ufficiali. Affina da qui.",
    "front_axle": "Assale anteriore",
    "rear_axle": "Assale posteriore",
    "wheel_size": "Dimensione ruota",
    "wheel_size_help": "Usata per la lettura della convergenza in gradi e le indicazioni sulla campanatura — le raccomandazioni di campanatura variano con la dimensione del cerchio. I preset presuppongono ruote da ~10\".",
    "reset_to_stock": "Ripristina a valori di serie",
    "parallel": "parallelo",
    "toe_in": "convergenza",
    "toe_out": "divergenza",
    "approx_total_deg": "≈ {deg}° totali al cerchio",
    "camber_guidance": "Intervallo tipico {size}\": {range}",
    "camber_aggressive": "Più negativo del tipico per {size}\" — attenzione all'usura interna",
    "custom_setup": "Configurazione personalizzata",
    "custom_setup_desc": "Hai modificato i valori rispetto ai preset. Ricorda: l'anteriore lavora in divergenza, il posteriore in convergenza, e l'incidenza resta positiva. Allinea sinistra e destra entro 0,5°.",
    "confidence_label": "Affidabilità",
    "sources": "Fonti",
    "manage": "Gestisci salvati",
    "params": {
      "frontCamber": {
        "label": "Campanatura anteriore",
        "help": "Positiva = parte superiore inclinata verso l'esterno, negativa = parte superiore inclinata verso l'interno. Di serie è positiva; in assetto sportivo è negativa. Richiede bracci inferiori regolabili/con offset."
      },
      "frontCaster": {
        "label": "Incidenza anteriore",
        "help": "Sempre positiva. Si imposta con i tiranti regolabili. Mantieni i due lati entro 0,5° e non superare i ~5,5°."
      },
      "frontToe": {
        "label": "Convergenza anteriore (totale)",
        "help": "Negativa = divergenza, positiva = convergenza. Totale sulle due ruote — imposta ciascun lato alla metà. Si regola sui terminali della barra di sterzo."
      },
      "rearCamber": {
        "label": "Campanatura posteriore",
        "help": "Negativa = parte superiore inclinata verso l'interno. Non usare mai una campanatura positiva marcata al posteriore. Si imposta con rondelle eccentriche o staffe regolabili."
      },
      "rearToe": {
        "label": "Convergenza posteriore (totale)",
        "help": "Positiva = convergenza (obbligatoria per la stabilità su strada). Negativa (divergenza) è solo per le competizioni. Si imposta con spessori o staffe regolabili."
      }
    },
    "presets": {
      "stockRoad": {
        "name": "Strada di serie",
        "rationale": "Geometria del manuale d'officina di serie. Nota che la campanatura anteriore è positiva (+2°) e l'anteriore lavora in leggera divergenza — entrambi sono corretti per la Mini, non errori. Il posteriore lavora con 1/8\" di convergenza per la stabilità in rettilineo."
      },
      "fastRoad": {
        "name": "Strada sportiva",
        "rationale": "Inserimento in curva più reattivo rispetto a quello di serie, restando guidabile su strada e poco usurante per gli pneumatici. Rende la campanatura anteriore negativa per mantenere a contatto lo pneumatico carico durante il rollio, con un po' più di incidenza per l'autocentraggio. Mantiene una lieve divergenza anteriore e una convergenza posteriore più leggera."
      },
      "trackDay": {
        "name": "Giornata in pista",
        "rationale": "Massima aderenza in curva su pneumatici stradali o semi-slick; accetta un'usura più rapida degli pneumatici. Maggiore campanatura anteriore negativa e più incidenza; posteriore impostato dritto per far ruotare il retrotreno in inserimento. Lo pneumatico fissa il limite massimo di campanatura — verifica su un banco."
      },
      "boostedRoad": {
        "name": "Strada sovralimentata",
        "rationale": "Auto da strada turbo o sovralimentata. La modifica chiave è la convergenza anteriore impostata parallela (zero) per ridurre il torque steer e migliorare la trazione in partenza, con un'incidenza generosa per la stabilità sotto carico e una maggiore convergenza posteriore per la trazione."
      },
      "boostedTrack": {
        "name": "Pista sovralimentata",
        "rationale": "Auto da circuito a sovralimentazione e alta potenza — il preset più estrapolato, quindi consideralo solo come punto di partenza. Campanatura e incidenza anteriori aggressive con solo una leggera divergenza anteriore per far comunque scaricare la potenza, più una lieve convergenza posteriore per la stabilità in accelerazione."
      }
    },
    "confidence": {
      "high": "Affidabilità alta",
      "medium": "Media",
      "low": "Bassa / estrapolata"
    },
    "warnings": {
      "rearToeOut": "La divergenza posteriore può causare sovrasterzo improvviso — adatta solo a piloti esperti in un assetto da rotazione full-race.",
      "casterHigh": "Un'incidenza superiore a 5,5° supera il consueto limite pratico e aumenta notevolmente lo sforzo allo sterzo.",
      "rearCamberPositive": "Una campanatura posteriore positiva rende il retrotreno nervoso — il posteriore dovrebbe lavorare da neutro a lievemente negativo.",
      "frontCamberPositive": "La campanatura anteriore positiva è il valore di serie per gli stretti pneumatici crossply; la maggior parte degli assetti moderni usa valori negativi per l'aderenza."
    },
    "save": {
      "button": "Salva configurazione",
      "confirm": "Salva",
      "cancel": "Annulla",
      "name_label": "Nome configurazione",
      "name_placeholder": "es. La mia 1275 strada sportiva",
      "name_required": "Inserisci un nome",
      "note_label": "Prima nota del diario (facoltativa)",
      "note_placeholder": "es. Riferimento prima della giornata in pista — l'auto sottosterza in inserimento",
      "make_public": "Rendi pubblica questa configurazione",
      "success": "Configurazione salvata nel tuo profilo",
      "error": "Impossibile salvare la configurazione. Riprova.",
      "sign_in_prompt": "Accedi per salvare questa configurazione nel tuo profilo e tenere un diario di guida nel tempo.",
      "sign_in": "Accedi per salvare"
    },
    "load": {
      "button": "Carica salvati"
    },
    "disclaimer": "Questi sono punti di partenza, non verità assolute. Verifica sempre su un banco di allineamento adeguato (la convergenza valutata a occhio è spesso sbagliata di 1/8\" o più), allinea incidenza e campanatura tra i due lati entro 0,5° e ricontrolla dopo ogni modifica dell'altezza da terra. L'allineamento attenua solo in parte il torque steer su una Mini sovralimentata."
  },
  "pt": {
    "presets_title": "Comece a partir de uma predefinição",
    "presets_subtitle": "Pontos de partida derivados de pesquisa da MED, Mini Spares, Calver, The Mini Forum e dos manuais de fábrica. Ajuste a partir daqui.",
    "front_axle": "Eixo dianteiro",
    "rear_axle": "Eixo traseiro",
    "wheel_size": "Tamanho da roda",
    "wheel_size_help": "Usado para a leitura da convergência em graus e para a orientação da cambagem — as recomendações de cambagem variam conforme o tamanho do aro. As predefinições assumem rodas de ~10\".",
    "reset_to_stock": "Repor para fábrica",
    "parallel": "paralelo",
    "toe_in": "convergência",
    "toe_out": "divergência",
    "approx_total_deg": "≈ {deg}° total no aro",
    "camber_guidance": "Faixa típica {size}\": {range}",
    "camber_aggressive": "Mais negativo que o típico para {size}\" — atenção ao desgaste interno",
    "custom_setup": "Configuração personalizada",
    "custom_setup_desc": "Afastou-se das predefinições. Lembre-se: o dianteiro corre com divergência, o traseiro com convergência, e o cáster mantém-se positivo. Iguale o lado esquerdo e direito dentro de 0,5°.",
    "confidence_label": "Confiança",
    "sources": "Fontes",
    "manage": "Gerir guardadas",
    "params": {
      "frontCamber": {
        "label": "Cambagem dianteira",
        "help": "Positiva = topo inclina para fora, negativa = topo inclina para dentro. De fábrica é positiva; o uso desportivo corre negativa. Requer braços inferiores ajustáveis/com desvio."
      },
      "frontCaster": {
        "label": "Cáster dianteiro",
        "help": "Sempre positivo. Definido através de barras de ligação ajustáveis. Mantenha ambos os lados dentro de 0,5° e não exceda ~5,5°."
      },
      "frontToe": {
        "label": "Convergência dianteira (total)",
        "help": "Negativa = divergência, positiva = convergência. Total entre ambas as rodas — defina cada lado para metade. Ajustada nas extremidades das barras de direção."
      },
      "rearCamber": {
        "label": "Cambagem traseira",
        "help": "Negativa = topo inclina para dentro. Nunca corra com valor positivo notável na traseira. Definida através de anilhas excêntricas ou suportes ajustáveis."
      },
      "rearToe": {
        "label": "Convergência traseira (total)",
        "help": "Positiva = convergência (obrigatória para estabilidade em estrada). Negativa (divergência) é só para competição. Definida através de calços ou suportes ajustáveis."
      }
    },
    "presets": {
      "stockRoad": {
        "name": "Estrada de Série",
        "rationale": "Geometria do manual de oficina de fábrica. Repare que a cambagem dianteira é positiva (+2°) e o dianteiro corre com ligeira divergência — ambos estão corretos para o Mini, não são erros. A traseira corre com 1/8\" de convergência para estabilidade em linha reta."
      },
      "fastRoad": {
        "name": "Estrada Rápida",
        "rationale": "Entrada em curva mais incisiva do que a de série, mantendo-se utilizável na estrada e suave para os pneus. Inverte a cambagem dianteira para negativa de modo a manter o pneu carregado plano durante a inclinação da carroçaria, com um pouco mais de cáster para autocentragem. Mantém ligeira divergência dianteira e convergência traseira mais leve."
      },
      "trackDay": {
        "name": "Dia de Pista",
        "rationale": "Aderência máxima em curva com pneus de estrada ou semi-slick; aceita um desgaste mais rápido dos pneus. Mais cambagem dianteira negativa e mais cáster; a traseira definida a direito para deixar a parte de trás rodar na entrada da curva. O pneu define o limite máximo de cambagem — verifique numa bancada."
      },
      "boostedRoad": {
        "name": "Estrada Turbo",
        "rationale": "Carro de rua turbo ou sobrealimentado. A alteração-chave é a convergência dianteira definida paralela (zero) para reduzir o efeito de torque na direção e melhorar a tração na arrancada, com cáster saudável para estabilidade sob potência e maior convergência traseira para tração."
      },
      "boostedTrack": {
        "name": "Pista Turbo",
        "rationale": "Carro de circuito de indução forçada de alta potência — a predefinição mais extrapolada, por isso trate-a apenas como ponto de partida. Cambagem e cáster dianteiros agressivos com apenas uma pequena divergência dianteira para a potência ainda ir ao chão, mais ligeira convergência traseira para estabilidade sob aceleração."
      }
    },
    "confidence": {
      "high": "Confiança alta",
      "medium": "Média",
      "low": "Baixa / extrapolada"
    },
    "warnings": {
      "rearToeOut": "A divergência traseira pode causar sobreviragem brusca — só adequada para condutores experientes numa configuração de rotação de competição total.",
      "casterHigh": "Cáster acima de 5,5° está além do limite prático habitual e acrescenta um esforço de direção pesado.",
      "rearCamberPositive": "A cambagem traseira positiva torna a traseira nervosa — a traseira deve correr entre neutra e ligeiramente negativa.",
      "frontCamberPositive": "A cambagem dianteira positiva é o valor de fábrica para os pneus diagonais estreitos; a maioria das configurações modernas corre negativa para aderência."
    },
    "save": {
      "button": "Guardar configuração",
      "confirm": "Guardar",
      "cancel": "Cancelar",
      "name_label": "Nome da configuração",
      "name_placeholder": "ex. O meu 1275 de estrada rápida",
      "name_required": "Por favor, introduza um nome",
      "note_label": "Primeira nota do diário (opcional)",
      "note_placeholder": "ex. Referência antes do dia de pista — o carro subvira na entrada da curva",
      "make_public": "Tornar esta configuração pública",
      "success": "Configuração guardada no seu perfil",
      "error": "Não foi possível guardar a configuração. Por favor, tente novamente.",
      "sign_in_prompt": "Inicie sessão para guardar esta configuração no seu perfil e manter um diário de condução ao longo do tempo.",
      "sign_in": "Iniciar sessão para guardar"
    },
    "load": {
      "button": "Carregar guardada"
    },
    "disclaimer": "Estes são pontos de partida, não dogmas. Verifique sempre numa bancada de alinhamento adequada (a convergência avaliada a olho está frequentemente errada em 1/8\" ou mais), iguale o cáster e a cambagem de lado a lado dentro de 0,5°, e volte a verificar após qualquer alteração da altura de rodagem. O alinhamento só dompta parcialmente o efeito de torque na direção num Mini turbo."
  },
  "ru": {
    "presets_title": "Начните с пресета",
    "presets_subtitle": "Отправные точки, основанные на исследованиях MED, Mini Spares, Calver, The Mini Forum и заводских руководств. Дальше подстраивайте под себя.",
    "front_axle": "Передняя ось",
    "rear_axle": "Задняя ось",
    "wheel_size": "Размер колеса",
    "wheel_size_help": "Используется для отображения схождения в градусах и рекомендаций по развалу — рекомендации по развалу масштабируются с размером обода. Пресеты рассчитаны на колёса ~10\".",
    "reset_to_stock": "Сбросить к заводским",
    "parallel": "параллельно",
    "toe_in": "схождение",
    "toe_out": "расхождение",
    "approx_total_deg": "≈ {deg}° всего на ободе",
    "camber_guidance": "Типичный диапазон {size}\": {range}",
    "camber_aggressive": "Отрицательнее обычного для {size}\" — следите за износом внутренней кромки",
    "custom_setup": "Своя настройка",
    "custom_setup_desc": "Вы отклонились от пресетов. Помните: спереди задаётся расхождение, сзади — схождение, а кастер остаётся положительным. Согласуйте левую и правую стороны в пределах 0,5°.",
    "confidence_label": "Достоверность",
    "sources": "Источники",
    "manage": "Управление сохранёнными",
    "params": {
      "frontCamber": {
        "label": "Передний развал",
        "help": "Положительный = верх наклонён наружу, отрицательный = верх наклонён внутрь. Заводское значение положительное; для производительности задают отрицательное. Требуются регулируемые/смещённые нижние рычаги."
      },
      "frontCaster": {
        "label": "Передний кастер",
        "help": "Всегда положительный. Регулируется через регулируемые продольные тяги. Держите обе стороны в пределах 0,5° и не превышайте ~5.5°."
      },
      "frontToe": {
        "label": "Переднее схождение (всего)",
        "help": "Отрицательное = расхождение, положительное = схождение. Суммарно по обоим колёсам — задавайте по половине на каждую сторону. Регулируется на наконечниках рулевых тяг."
      },
      "rearCamber": {
        "label": "Задний развал",
        "help": "Отрицательный = верх наклонён внутрь. Никогда не задавайте заметный положительный развал сзади. Регулируется эксцентриковыми шайбами или регулируемыми кронштейнами."
      },
      "rearToe": {
        "label": "Заднее схождение (всего)",
        "help": "Положительное = схождение (обязательно для устойчивости на дороге). Отрицательное (расхождение) только для гонок. Регулируется прокладками или регулируемыми кронштейнами."
      }
    },
    "presets": {
      "stockRoad": {
        "name": "Сток дорога",
        "rationale": "Геометрия из заводского руководства. Обратите внимание: передний развал положительный (+2°), а спереди задано небольшое расхождение — для Mini это правильно, а не опечатки. Сзади задано схождение 1/8\" для устойчивости по прямой."
      },
      "fastRoad": {
        "name": "Спорт дорога",
        "rationale": "Более острый вход в поворот, чем у стока, при этом пригоден для улицы и щадит шины. Делает передний развал отрицательным, чтобы нагруженная шина оставалась плоской при кренах кузова, с чуть большим кастером для самовозврата руля. Сохраняет умеренное переднее расхождение и меньшее заднее схождение."
      },
      "trackDay": {
        "name": "Трек-день",
        "rationale": "Максимальное сцепление в поворотах на дорожных или полуслик-шинах; за это платите ускоренным износом шин. Больше отрицательного переднего развала и больше кастера; сзади задано прямо, чтобы корма доворачивалась при входе в поворот. Предел развала задаёт шина — проверяйте на стенде."
      },
      "boostedRoad": {
        "name": "Наддув дорога",
        "rationale": "Уличный автомобиль с турбонаддувом или компрессором. Ключевое изменение — переднее схождение выставлено параллельно (ноль), чтобы убрать рулевой увод от тяги и улучшить разгон со старта, со здоровым кастером для устойчивости под нагрузкой и большим задним схождением для сцепления."
      },
      "boostedTrack": {
        "name": "Наддув трек",
        "rationale": "Мощный трековый автомобиль с наддувом — самый экстраполированный пресет, поэтому относитесь к нему лишь как к отправной точке. Агрессивные передний развал и кастер с лишь небольшим передним расхождением, чтобы мощность всё же доходила до колёс, плюс умеренное заднее схождение для устойчивости при разгоне."
      }
    },
    "confidence": {
      "high": "Высокая достоверность",
      "medium": "Средняя",
      "low": "Низкая / экстраполировано"
    },
    "warnings": {
      "rearToeOut": "Заднее расхождение может вызвать резкую избыточную поворачиваемость — подходит только опытным водителям при чисто гоночной настройке на доворот.",
      "casterHigh": "Кастер выше 5.5° выходит за обычный практический предел и сильно утяжеляет руль.",
      "rearCamberPositive": "Положительный задний развал делает корму нервной — сзади развал должен быть нейтральным или слегка отрицательным.",
      "frontCamberPositive": "Положительный передний развал — заводское значение для узких диагональных шин; большинство современных настроек используют отрицательный развал ради сцепления."
    },
    "save": {
      "button": "Сохранить настройку",
      "confirm": "Сохранить",
      "cancel": "Отмена",
      "name_label": "Название конфигурации",
      "name_placeholder": "напр. Мой 1275 для спорт-дороги",
      "name_required": "Пожалуйста, введите название",
      "note_label": "Первая запись в журнале (необязательно)",
      "note_placeholder": "напр. Базовая настройка перед трек-днём — машина недостаточно поворачивает на входе",
      "make_public": "Сделать эту конфигурацию публичной",
      "success": "Конфигурация сохранена в вашем профиле",
      "error": "Не удалось сохранить конфигурацию. Пожалуйста, попробуйте снова.",
      "sign_in_prompt": "Войдите, чтобы сохранить эту настройку в свой профиль и со временем вести журнал поездок.",
      "sign_in": "Войти, чтобы сохранить"
    },
    "load": {
      "button": "Загрузить сохранённое"
    },
    "disclaimer": "Это отправные точки, а не истина в последней инстанции. Всегда проверяйте на нормальном стенде развал-схождения (схождение на глаз часто ошибочно на 1/8\" и более), согласуйте кастер и развал по сторонам в пределах 0,5° и перепроверяйте после любого изменения дорожного просвета. Регулировка лишь частично укрощает рулевой увод от тяги на Mini с наддувом."
  },
  "ja": {
    "presets_title": "プリセットから始める",
    "presets_subtitle": "MED、Mini Spares、Calver、The Mini Forum、そして純正マニュアルから導き出した出発点です。ここから微調整してください。",
    "front_axle": "フロントアクスル",
    "rear_axle": "リアアクスル",
    "wheel_size": "ホイールサイズ",
    "wheel_size_help": "トーの角度表示とキャンバーのガイダンスに使用します。キャンバーの推奨値はリムサイズに応じて変化します。プリセットは約10\"ホイールを想定しています。",
    "reset_to_stock": "純正値にリセット",
    "parallel": "平行",
    "toe_in": "トーイン",
    "toe_out": "トーアウト",
    "approx_total_deg": "≈ リムで合計 {deg}°",
    "camber_guidance": "{size}\" の標準範囲: {range}",
    "camber_aggressive": "{size}\" の標準より強い負キャンバー — 内側の偏摩耗に注意",
    "custom_setup": "カスタムセットアップ",
    "custom_setup_desc": "プリセットから調整を加えました。覚えておいてください：フロントはトーアウト、リアはトーイン、キャスターはプラスを維持します。左右を0.5°以内で揃えてください。",
    "confidence_label": "信頼度",
    "sources": "出典",
    "manage": "保存済みを管理",
    "params": {
      "frontCamber": {
        "label": "フロントキャンバー",
        "help": "プラス＝上側が外側に傾く、マイナス＝上側が内側に傾く。純正はプラス、パフォーマンス仕様はマイナス。調整式／オフセットのロワアームが必要です。"
      },
      "frontCaster": {
        "label": "フロントキャスター",
        "help": "常にプラス。調整式タイバーで設定します。左右を0.5°以内に揃え、約5.5°を超えないようにしてください。"
      },
      "frontToe": {
        "label": "フロントトー（合計）",
        "help": "マイナス＝トーアウト、プラス＝トーイン。両輪の合計値で、片側はその半分に設定します。タイロッドエンドで調整します。"
      },
      "rearCamber": {
        "label": "リアキャンバー",
        "help": "マイナス＝上側が内側に傾く。リアで目立つほどのプラスにしてはいけません。偏心ワッシャーまたは調整式ブラケットで設定します。"
      },
      "rearToe": {
        "label": "リアトー（合計）",
        "help": "プラス＝トーイン（路上での安定性に必須）。マイナス（トーアウト）はレース専用です。シムまたは調整式ブラケットで設定します。"
      }
    },
    "presets": {
      "stockRoad": {
        "name": "ノーマル公道",
        "rationale": "純正ワークショップマニュアルのジオメトリー。フロントキャンバーがプラス（+2°）で、フロントが軽いトーアウトであることに注目してください。どちらもMiniにとって正しい値で、誤記ではありません。リアは直進安定性のために1/8\"のトーインです。"
      },
      "fastRoad": {
        "name": "ファストロード",
        "rationale": "ノーマルより鋭いターンインを実現しつつ、街乗りに対応しタイヤにも優しい設定。フロントキャンバーをマイナスに反転させ、ロール時に荷重のかかったタイヤを路面にフラットに保ち、セルフセンタリングのためにキャスターをやや増やします。フロントは軽いトーアウト、リアは控えめなトーインを維持します。"
      },
      "trackDay": {
        "name": "トラックデー",
        "rationale": "公道用またはセミスリックタイヤでのコーナリンググリップを最大化。タイヤの摩耗が早まることを許容します。フロントキャンバーをよりマイナスに、キャスターをより多くし、リアはストレートに設定してターンインで後輪を回頭させます。タイヤがキャンバーの上限を決めます。測定機で確認してください。"
      },
      "boostedRoad": {
        "name": "過給公道",
        "rationale": "ターボまたはスーパーチャージャー付きのストリートカー。重要な変更点はフロントトーを平行（ゼロ）に設定してトルクステアを抑え、発進時の駆動力を改善することです。パワー下での安定性のために十分なキャスターを確保し、トラクションのためにリアトーインを大きめにします。"
      },
      "boostedTrack": {
        "name": "過給サーキット",
        "rationale": "ハイパワーの過給サーキットカー。最も外挿の度合いが大きいプリセットなので、あくまで出発点として扱ってください。アグレッシブなフロントキャンバーとキャスターに、パワーをしっかり路面に伝えるための小さなフロントトーアウトのみを組み合わせ、加速時の安定性のために控えめなリアトーインを加えます。"
      }
    },
    "confidence": {
      "high": "信頼度：高",
      "medium": "中",
      "low": "低／外挿"
    },
    "warnings": {
      "rearToeOut": "リアのトーアウトは急なオーバーステアを引き起こす可能性があります。フルレースの回頭セットアップに慣れた経験豊富なドライバーにのみ適しています。",
      "casterHigh": "5.5°を超えるキャスターは通常の実用的な限界を超えており、ステアリングが重くなります。",
      "rearCamberPositive": "リアのプラスキャンバーは後輪を神経質にします。リアはニュートラルから軽いマイナスにすべきです。",
      "frontCamberPositive": "フロントのプラスキャンバーは細身のクロスプライタイヤ向けの純正値です。現代の多くのセットアップではグリップのためにマイナスにします。"
    },
    "save": {
      "button": "セットアップを保存",
      "confirm": "保存",
      "cancel": "キャンセル",
      "name_label": "設定名",
      "name_placeholder": "例：私の1275ファストロード",
      "name_required": "名前を入力してください",
      "note_label": "最初のジャーナルメモ（任意）",
      "note_placeholder": "例：トラックデー前のベースライン — ターンインでアンダーステア",
      "make_public": "この設定を公開する",
      "success": "設定をプロフィールに保存しました",
      "error": "設定を保存できませんでした。もう一度お試しください。",
      "sign_in_prompt": "サインインすると、このセットアップをプロフィールに保存し、長期にわたるドライビングジャーナルを記録できます。",
      "sign_in": "サインインして保存"
    },
    "load": {
      "button": "保存済みを読み込む"
    },
    "disclaimer": "これらは出発点であり、絶対的なものではありません。必ず適切なアライメント測定機で確認し（目視によるトー測定は1/8\"以上ずれていることがよくあります）、キャスターとキャンバーを左右0.5°以内で揃え、車高を変更した後は再確認してください。過給したMiniでは、アライメントはトルクステアを部分的にしか抑えられません。"
  },
  "zh": {
    "presets_title": "从预设开始",
    "presets_subtitle": "源自 MED、Mini Spares、Calver、The Mini Forum 以及原厂手册研究得出的起始参数。可在此基础上微调。",
    "front_axle": "前桥",
    "rear_axle": "后桥",
    "wheel_size": "轮辋尺寸",
    "wheel_size_help": "用于前束角度读数和外倾角指导——外倾角推荐值会随轮辋尺寸变化。预设以 ~10\" 轮辋为基准。",
    "reset_to_stock": "恢复原厂设置",
    "parallel": "平行",
    "toe_in": "前束内束",
    "toe_out": "前束外束",
    "approx_total_deg": "≈ 轮辋处总计 {deg}°",
    "camber_guidance": "{size}\" 典型范围：{range}",
    "camber_aggressive": "比 {size}\" 的典型值更负——注意内侧轮胎磨损",
    "custom_setup": "自定义设置",
    "custom_setup_desc": "您已偏离预设进行调整。请记住：前轮采用外束，后轮采用内束，主销后倾角保持正值。左右两侧需在 0.5° 范围内匹配一致。",
    "confidence_label": "可信度",
    "sources": "来源",
    "manage": "管理已保存",
    "params": {
      "frontCamber": {
        "label": "前轮外倾角",
        "help": "正值=顶部外倾，负值=顶部内倾。原厂为正值；性能设置采用负值。需要可调式/偏置下摆臂。"
      },
      "frontCaster": {
        "label": "前轮主销后倾角",
        "help": "始终为正值。通过可调式拉杆设定。两侧保持在 0.5° 范围内，且不要超过 ~5.5°。"
      },
      "frontToe": {
        "label": "前轮前束（总计）",
        "help": "负值=外束，正值=内束。为两轮总计值——每侧设定为一半。在转向横拉杆端部进行调整。"
      },
      "rearCamber": {
        "label": "后轮外倾角",
        "help": "负值=顶部内倾。后轮切勿采用明显正值。通过偏心垫片或可调支架设定。"
      },
      "rearToe": {
        "label": "后轮前束（总计）",
        "help": "正值=内束（道路稳定性必需）。负值（外束）仅适用于赛道。通过垫片或可调支架设定。"
      }
    },
    "presets": {
      "stockRoad": {
        "name": "原厂街道",
        "rationale": "原厂维修手册几何参数。请注意前轮外倾角为正值（+2°），且前轮采用轻微外束——这两点对 Mini 而言都是正确的，并非笔误。后轮采用 1/8\" 内束以保证直线行驶稳定性。"
      },
      "fastRoad": {
        "name": "高性能街道",
        "rationale": "比原厂更敏锐的入弯响应，同时保持街道适用性且对轮胎友好。将前轮外倾角翻转为负值，使受载轮胎在车身侧倾时保持平整，并略微增加主销后倾角以增强回正力。保持轻微的前轮外束和较小的后轮内束。"
      },
      "trackDay": {
        "name": "赛道日",
        "rationale": "在公路或半热熔轮胎上获得最大过弯抓地力；可接受较快的轮胎磨损。更大的前轮负外倾角和更大的主销后倾角；后轮设为平直以便后部在入弯时转动。轮胎决定外倾角上限——务必在调校台上验证。"
      },
      "boostedRoad": {
        "name": "增压街道",
        "rationale": "涡轮增压或机械增压街车。关键变化是将前轮前束设为平行（零），以减少扭矩转向并改善起步动力，配合充足的主销后倾角以保证动力下的稳定性，并加大后轮内束以提升牵引力。"
      },
      "boostedTrack": {
        "name": "增压赛道",
        "rationale": "大功率强制进气赛道车——这是外推程度最高的预设，因此仅应作为起始点对待。激进的前轮外倾角和主销后倾角，仅配合少量前轮外束以便动力仍能落地，外加轻微的后轮内束以保证加速时的稳定性。"
      }
    },
    "confidence": {
      "high": "高可信度",
      "medium": "中等",
      "low": "低 / 外推"
    },
    "warnings": {
      "rearToeOut": "后轮外束可能导致突发性转向过度——仅适合经验丰富的驾驶者在全赛车转动设置下使用。",
      "casterHigh": "主销后倾角超过 5.5° 已超出常规实用极限，并会大幅增加转向力度。",
      "rearCamberPositive": "后轮正外倾角会使后部变得不安定——后轮应采用中性至轻微负值。",
      "frontCamberPositive": "前轮正外倾角是针对窄胎面斜交胎的原厂数值；大多数现代设置采用负值以获得抓地力。"
    },
    "save": {
      "button": "保存设置",
      "confirm": "保存",
      "cancel": "取消",
      "name_label": "配置名称",
      "name_placeholder": "例如：我的 1275 高性能街道",
      "name_required": "请输入名称",
      "note_label": "首条日志记录（可选）",
      "note_placeholder": "例如：赛道日前的基准设置——车辆入弯时转向不足",
      "make_public": "将此配置设为公开",
      "success": "配置已保存到您的个人资料",
      "error": "无法保存配置。请重试。",
      "sign_in_prompt": "登录以将此设置保存到您的个人资料，并随时间记录驾驶日志。",
      "sign_in": "登录以保存"
    },
    "load": {
      "button": "加载已保存"
    },
    "disclaimer": "这些只是起始参数，并非金科玉律。请始终在专业的四轮定位调校台上验证（目测的前束经常会有 1/8\" 甚至更大的偏差），将主销后倾角和外倾角左右两侧匹配在 0.5° 范围内，并在任何车身高度变更后重新检查。在增压 Mini 上，四轮定位只能部分抑制扭矩转向。"
  },
  "ko": {
    "presets_title": "프리셋에서 시작하기",
    "presets_subtitle": "MED, Mini Spares, Calver, The Mini Forum 및 공장 정비 매뉴얼에서 도출한 출발점입니다. 여기서부터 세부 조정하세요.",
    "front_axle": "앞 차축",
    "rear_axle": "뒤 차축",
    "wheel_size": "휠 사이즈",
    "wheel_size_help": "토 각도 표시와 캠버 가이드에 사용됩니다 — 캠버 권장값은 림 사이즈에 따라 달라집니다. 프리셋은 약 10\" 휠을 기준으로 합니다.",
    "reset_to_stock": "공장 사양으로 초기화",
    "parallel": "평행",
    "toe_in": "토인",
    "toe_out": "토아웃",
    "approx_total_deg": "≈ 림 기준 합계 {deg}°",
    "camber_guidance": "{size}\" 일반 범위: {range}",
    "camber_aggressive": "{size}\"의 일반값보다 큰 네거티브 — 안쪽 타이어 마모 주의",
    "custom_setup": "사용자 설정",
    "custom_setup_desc": "프리셋에서 벗어나 조정했습니다. 기억하세요: 앞은 토아웃, 뒤는 토인이며, 캐스터는 양(+)을 유지합니다. 좌우를 0.5° 이내로 맞추세요.",
    "confidence_label": "신뢰도",
    "sources": "출처",
    "manage": "저장 항목 관리",
    "params": {
      "frontCamber": {
        "label": "앞 캠버",
        "help": "양(+) = 윗부분이 바깥쪽으로 기울고, 음(-) = 윗부분이 안쪽으로 기웁니다. 순정은 양(+)이며, 성능 세팅은 음(-)으로 갑니다. 조절식/오프셋 로어 암이 필요합니다."
      },
      "frontCaster": {
        "label": "앞 캐스터",
        "help": "항상 양(+)입니다. 조절식 타이바로 설정합니다. 양쪽을 0.5° 이내로 맞추고 약 5.5°를 넘지 마세요."
      },
      "frontToe": {
        "label": "앞 토(합계)",
        "help": "음(-) = 토아웃, 양(+) = 토인. 양쪽 바퀴의 합계 — 각 측을 절반씩 설정하세요. 타이로드 엔드에서 조정합니다."
      },
      "rearCamber": {
        "label": "뒤 캠버",
        "help": "음(-) = 윗부분이 안쪽으로 기웁니다. 뒤쪽은 절대로 뚜렷한 양(+)으로 세팅하지 마세요. 편심 와셔나 조절식 브래킷으로 설정합니다."
      },
      "rearToe": {
        "label": "뒤 토(합계)",
        "help": "양(+) = 토인(도로 안정성을 위해 필수). 음(-)(토아웃)은 레이스 전용입니다. 심이나 조절식 브래킷으로 설정합니다."
      }
    },
    "presets": {
      "stockRoad": {
        "name": "순정 도로",
        "rationale": "공장 정비 매뉴얼 지오메트리입니다. 앞 캠버가 양(+2°)이고 앞이 약간의 토아웃으로 세팅된 점에 유의하세요 — 둘 다 오타가 아니라 Mini에 맞는 정상값입니다. 뒤는 직진 안정성을 위해 1/8\" 토인으로 세팅됩니다."
      },
      "fastRoad": {
        "name": "패스트 로드",
        "rationale": "도로 주행에 적합하고 타이어에 무리가 없으면서도 순정보다 날카로운 턴인을 제공합니다. 차체 롤 시 하중이 실린 타이어를 평평하게 유지하기 위해 앞 캠버를 음(-)으로 바꾸고, 셀프 센터링을 위해 캐스터를 약간 더 줍니다. 가벼운 앞 토아웃과 약한 뒤 토인을 유지합니다."
      },
      "trackDay": {
        "name": "트랙 데이",
        "rationale": "도로용 또는 세미슬릭 타이어에서 최대 코너링 그립을 냅니다; 더 빠른 타이어 마모를 감수합니다. 앞 캠버를 더 음(-)으로, 캐스터를 더 많이 주며; 턴인 시 뒤가 회전하도록 뒤는 일직선으로 세팅합니다. 캠버 한계는 타이어가 결정합니다 — 정비 장비로 확인하세요."
      },
      "boostedRoad": {
        "name": "부스트 도로",
        "rationale": "터보 또는 슈퍼차저 도로용 차량입니다. 핵심 변경점은 토크 스티어를 줄이고 출발 가속을 개선하기 위해 앞 토를 평행(0)으로 세팅하는 것이며, 출력 하에서의 안정성을 위한 충분한 캐스터와 접지력을 위한 더 큰 뒤 토인을 함께 적용합니다."
      },
      "boostedTrack": {
        "name": "부스트 트랙",
        "rationale": "고출력 강제 흡기 서킷 차량 — 가장 추정에 의존한 프리셋이므로 출발점으로만 취급하세요. 공격적인 앞 캠버와 캐스터에 출력 전달을 유지하도록 작은 앞 토아웃만 주고, 가속 시 안정성을 위해 약한 뒤 토인을 더합니다."
      }
    },
    "confidence": {
      "high": "높은 신뢰도",
      "medium": "보통",
      "low": "낮음 / 추정값"
    },
    "warnings": {
      "rearToeOut": "뒤 토아웃은 급격한 오버스티어를 유발할 수 있습니다 — 풀레이스 회전 세팅에서 숙련된 운전자에게만 적합합니다.",
      "casterHigh": "5.5°를 넘는 캐스터는 통상적인 실용 한계를 벗어나며 조향이 매우 무거워집니다.",
      "rearCamberPositive": "뒤 캠버가 양(+)이면 후미가 불안정해집니다 — 뒤는 중립에서 약한 음(-)으로 세팅해야 합니다.",
      "frontCamberPositive": "앞 캠버 양(+)은 가는 크로스플라이 타이어용 공장 수치입니다; 대부분의 현대적 세팅은 그립을 위해 음(-)으로 갑니다."
    },
    "save": {
      "button": "세팅 저장",
      "confirm": "저장",
      "cancel": "취소",
      "name_label": "구성 이름",
      "name_placeholder": "예: 내 1275 패스트 로드",
      "name_required": "이름을 입력하세요",
      "note_label": "첫 저널 메모(선택)",
      "note_placeholder": "예: 트랙 데이 전 기준값 — 턴인 시 언더스티어 발생",
      "make_public": "이 구성을 공개로 설정",
      "success": "구성이 프로필에 저장되었습니다",
      "error": "구성을 저장할 수 없습니다. 다시 시도하세요.",
      "sign_in_prompt": "로그인하면 이 세팅을 프로필에 저장하고 시간에 따라 주행 저널을 기록할 수 있습니다.",
      "sign_in": "로그인하여 저장"
    },
    "load": {
      "button": "저장 항목 불러오기"
    },
    "disclaimer": "이는 출발점일 뿐 절대적인 정답이 아닙니다. 항상 제대로 된 얼라인먼트 장비로 확인하고(눈대중 토는 1/8\" 이상 틀린 경우가 흔합니다), 캐스터와 캠버 좌우를 0.5° 이내로 맞추며, 차고 변경 후에는 다시 점검하세요. 얼라인먼트는 부스트 Mini의 토크 스티어를 부분적으로만 완화합니다."
  }
}
</i18n>
