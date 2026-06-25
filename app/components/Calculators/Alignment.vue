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
  function resetFactory() {
    applyPreset('factory');
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
    if (values.frontCaster > 6.5) w.push('casterHigh');
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
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <button
          v-for="preset in ALIGNMENT_PRESETS"
          :key="preset.id"
          class="btn btn-sm h-auto py-2 flex-col gap-1 normal-case"
          :class="matchedPresetId === preset.id ? 'btn-primary' : 'btn-outline'"
          :aria-pressed="matchedPresetId === preset.id"
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
              :aria-pressed="wheelSize === size"
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
                <label class="text-sm font-medium" :for="`${param.id}-range`">{{ t(`params.${param.id}.label`) }}</label>
                <span class="text-sm font-bold tabular-nums">{{ paramReadout(param.id) }}</span>
              </div>
              <div class="flex items-center gap-3">
                <input
                  :id="`${param.id}-range`"
                  v-model.number="values[param.id]"
                  type="range"
                  class="range range-primary range-sm grow"
                  :min="param.min"
                  :max="param.max"
                  :step="param.step"
                  :aria-label="t(`params.${param.id}.label`)"
                />
                <input
                  v-model.number="values[param.id]"
                  type="number"
                  class="input input-bordered input-sm w-20"
                  :min="param.min"
                  :max="param.max"
                  :step="param.step"
                  :aria-label="t(`params.${param.id}.label`)"
                />
                <span class="text-xs opacity-60 w-6">{{ param.unit === 'deg' ? '°' : 'mm' }}</span>
              </div>
              <p class="text-xs opacity-60 mt-1">{{ t(`params.${param.id}.help`) }}</p>
              <p v-if="param.kind === 'toe'" class="text-xs opacity-60 mt-0.5">
                {{ t('approx_total_deg', { deg: toeDegTotal(values[param.id]).toFixed(2) }) }}
              </p>
              <p v-if="param.kind === 'camber'" class="text-xs opacity-60 mt-0.5">
                {{ t('camber_guidance', { size: wheelSize, range: camberRangeText(param.axle) }) }}
              </p>
              <p v-if="param.kind === 'camber' && isCamberAggressive(param.id)" class="text-xs camber-warn mt-0.5">
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
                <label class="text-sm font-medium" :for="`${param.id}-range`">{{ t(`params.${param.id}.label`) }}</label>
                <span class="text-sm font-bold tabular-nums">{{ paramReadout(param.id) }}</span>
              </div>
              <div class="flex items-center gap-3">
                <input
                  :id="`${param.id}-range`"
                  v-model.number="values[param.id]"
                  type="range"
                  class="range range-primary range-sm grow"
                  :min="param.min"
                  :max="param.max"
                  :step="param.step"
                  :aria-label="t(`params.${param.id}.label`)"
                />
                <input
                  v-model.number="values[param.id]"
                  type="number"
                  class="input input-bordered input-sm w-20"
                  :min="param.min"
                  :max="param.max"
                  :step="param.step"
                  :aria-label="t(`params.${param.id}.label`)"
                />
                <span class="text-xs opacity-60 w-6">{{ param.unit === 'deg' ? '°' : 'mm' }}</span>
              </div>
              <p class="text-xs opacity-60 mt-1">{{ t(`params.${param.id}.help`) }}</p>
              <p v-if="param.kind === 'toe'" class="text-xs opacity-60 mt-0.5">
                {{ t('approx_total_deg', { deg: toeDegTotal(values[param.id]).toFixed(2) }) }}
              </p>
              <p v-if="param.kind === 'camber'" class="text-xs opacity-60 mt-0.5">
                {{ t('camber_guidance', { size: wheelSize, range: camberRangeText(param.axle) }) }}
              </p>
              <p v-if="param.kind === 'camber' && isCamberAggressive(param.id)" class="text-xs camber-warn mt-0.5">
                <i class="fas fa-triangle-exclamation"></i> {{ t('camber_aggressive', { size: wheelSize }) }}
              </p>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button class="btn btn-sm btn-ghost" @click="resetFactory">
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
  /* Aggressive-camber nudge: a deep amber that clears WCAG AA on the white card
     (daisyUI's text-warning #f59e0b is only ~2:1 on white). Lighter amber in dark mode. */
  .camber-warn {
    color: #92400e;
  }
  [data-theme='cmdiy-dark'] .camber-warn {
    color: #fbbf24;
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
        "help": "Always positive. Naturally aspirated road cars run about 3°; forced-induction wants 5–6.5° for stability under boost. Set via adjustable tie-bars and match both sides within 0.5°."
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
      "factory": {
        "name": "Factory",
        "rationale": "The factory workshop-manual geometry. Front camber is positive (+2°) and the front toes out slightly — both correct for the Mini, not typos. The rear runs 1/8\" toe-in. A faithful baseline; most modern setups improve on it."
      },
      "stockRoad": {
        "name": "Stock Road",
        "rationale": "Factory geometry tidied up for modern radial tyres: the awkward positive front camber dialled back to a mild -0.5° for a bit more grip and even wear, everything else left near stock. The easy, comfortable daily-driver setup."
      },
      "performance": {
        "name": "Performance",
        "rationale": "A sharper street setup. More negative front camber keeps the loaded tyre flat through body roll, a touch more caster adds self-centring, and lighter rear toe-in frees the car up. Still road-friendly, with a little more tyre wear."
      },
      "track": {
        "name": "Track",
        "rationale": "Maximum cornering grip on road or semi-slick tyres, accepting faster tyre wear. More negative front camber and caster, with the rear set straight to let it rotate on turn-in. The tyre sets the camber ceiling — verify on a rig."
      },
      "boostedRoad": {
        "name": "Boosted Road",
        "rationale": "Turbo or supercharged street car. Front toe set parallel (zero) to cut torque steer and put the power down, with high caster (6°) for straight-line stability under boost and a larger rear toe-in for traction."
      },
      "boostedTrack": {
        "name": "Boosted Track",
        "rationale": "High-power forced-induction circuit car. Aggressive front camber with lots of caster (6.5°) for stability and camber gain, a small front toe-out so power still goes down, and mild rear toe-in. A starting point — verify on a rig and corner-weight it."
      }
    },
    "confidence": {
      "high": "High confidence",
      "medium": "Medium",
      "low": "Low / extrapolated"
    },
    "warnings": {
      "rearToeOut": "Rear toe-out can cause snap oversteer — only suitable for experienced drivers on a full-race rotation setup.",
      "casterHigh": "Very high caster means heavy low-speed steering. That is normal on a turbo or supercharged Mini (5–6.5°) but a lot for a naturally aspirated car.",
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
        "help": "Siempre positivo. Los coches de calle atmosféricos llevan unos 3°; la sobrealimentación pide 5–6.5° para estabilidad bajo presión. Ajústalo mediante barras de empuje regulables e iguala ambos lados con una diferencia máxima de 0.5°."
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
    "confidence": {
      "high": "Confianza alta",
      "medium": "Media",
      "low": "Baja / extrapolada"
    },
    "warnings": {
      "rearToeOut": "La divergencia trasera puede provocar sobreviraje brusco — solo apta para conductores experimentados en una configuración de rotación de pura competición.",
      "rearCamberPositive": "La caída trasera positiva vuelve nerviosa la parte trasera — el eje trasero debe llevar de neutra a ligeramente negativa.",
      "frontCamberPositive": "La caída delantera positiva es el valor de fábrica para los neumáticos diagonales estrechos; la mayoría de las configuraciones modernas llevan negativa para mejorar el agarre.",
      "casterHigh": "Un avance muy alto significa una dirección pesada a baja velocidad. Eso es normal en un Mini turbo o sobrealimentado (5–6.5°), pero es mucho para un coche atmosférico."
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
    "disclaimer": "Estos son puntos de partida, no dogmas. Verifica siempre en un banco de alineación adecuado (la convergencia medida a ojo suele estar mal por 1/8\" o más), iguala el avance y la caída entre ambos lados dentro de 0,5° y vuelve a comprobar tras cualquier cambio de altura de marcha. La alineación solo dompta parcialmente el tiro de par en un Mini sobrealimentado.",
    "presets": {
      "factory": {
        "name": "De fábrica",
        "rationale": "La geometría del manual de taller de fábrica. La caída delantera es positiva (+2°) y el tren delantero abre ligeramente en convergencia: ambos valores son correctos para el Mini, no erratas. El tren trasero lleva 1/8\" de convergencia. Una referencia fiel; la mayoría de los reglajes modernos la mejoran."
      },
      "stockRoad": {
        "name": "Calle de serie",
        "rationale": "Geometría de fábrica afinada para neumáticos radiales modernos: la incómoda caída delantera positiva se reduce a una suave -0.5° para algo más de agarre y un desgaste uniforme, dejando todo lo demás casi de serie. El reglaje fácil y cómodo para uso diario."
      },
      "performance": {
        "name": "Deportivo",
        "rationale": "Un reglaje de calle más afilado. Más caída negativa delantera mantiene el neumático cargado plano durante el balanceo de la carrocería, algo más de avance añade autocentrado, y una convergencia trasera más ligera suelta el coche. Sigue siendo apto para carretera, con algo más de desgaste de neumáticos."
      },
      "track": {
        "name": "Circuito",
        "rationale": "Máximo agarre en curva con neumáticos de carretera o semislick, asumiendo un desgaste más rápido. Más caída negativa delantera y más avance, con el tren trasero recto para que rote al entrar en curva. El neumático fija el techo de caída: verifícalo en banco."
      },
      "boostedRoad": {
        "name": "Calle sobrealim.",
        "rationale": "Coche de calle turbo o sobrealimentado. Convergencia delantera ajustada en paralelo (cero) para reducir el tiro de par y transmitir la potencia, con avance alto (6°) para estabilidad en línea recta bajo sobrealimentación y una mayor convergencia trasera para tracción."
      },
      "boostedTrack": {
        "name": "Circuito sobrealim.",
        "rationale": "Coche de circuito sobrealimentado de alta potencia. Caída delantera agresiva con mucho avance (6.5°) para estabilidad y ganancia de caída, una ligera apertura delantera para que la potencia siga transmitiéndose, y suave convergencia trasera. Un punto de partida: verifícalo en banco y equilibra los pesos por rueda."
      }
    }
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
        "help": "Toujours positive. Les voitures de route atmosphériques tournent autour de 3° ; la suralimentation demande 5–6,5° pour la stabilité sous suralimentation. À régler via des barres de poussée réglables et à équilibrer entre les deux côtés à 0,5° près."
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
    "confidence": {
      "high": "Confiance élevée",
      "medium": "Moyenne",
      "low": "Faible / extrapolée"
    },
    "warnings": {
      "rearToeOut": "Une ouverture à l'arrière peut provoquer un survirage brutal — réservée aux pilotes expérimentés sur une configuration de pivotement full-race.",
      "rearCamberPositive": "Un carrossage arrière positif rend l'arrière nerveux — l'arrière doit rouler de neutre à légèrement négatif.",
      "frontCamberPositive": "Le carrossage avant positif est la valeur d'usine pour les pneus diagonaux étroits ; la plupart des configurations modernes roulent en négatif pour l'adhérence.",
      "casterHigh": "Une chasse très élevée rend la direction lourde à basse vitesse. C'est normal sur une Mini turbo ou compressée (5–6,5°) mais beaucoup pour une voiture atmosphérique."
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
    "disclaimer": "Ce sont des points de départ, pas des vérités absolues. Vérifiez toujours sur un banc de géométrie approprié (le parallélisme estimé à l'œil est souvent faux de 1/8\" ou plus), faites correspondre chasse et carrossage côté à côté à 0,5° près, et revérifiez après tout changement de hauteur de caisse. La géométrie ne maîtrise que partiellement l'effet de couple dans la direction sur une Mini suralimentée.",
    "presets": {
      "factory": {
        "name": "Origine",
        "rationale": "La géométrie d'origine du manuel d'atelier. Le carrossage avant est positif (+2°) et l'avant présente un léger parallélisme ouvert — les deux sont corrects pour la Mini, ce ne sont pas des erreurs. L'arrière tourne avec un parallélisme fermé de 1/8\". Une base fidèle ; la plupart des réglages modernes l'améliorent."
      },
      "stockRoad": {
        "name": "Route d'origine",
        "rationale": "Géométrie d'origine remise au goût des pneus radiaux modernes : le carrossage avant positif peu commode ramené à un léger -0,5° pour un peu plus d'adhérence et une usure régulière, tout le reste laissé proche de l'origine. Le réglage facile et confortable pour un usage quotidien."
      },
      "performance": {
        "name": "Sport",
        "rationale": "Un réglage routier plus incisif. Davantage de carrossage avant négatif garde le pneu chargé à plat dans le roulis de caisse, un peu plus de chasse renforce le rappel au centre, et un parallélisme arrière allégé libère la voiture. Reste utilisable sur route, avec une usure des pneus un peu plus marquée."
      },
      "track": {
        "name": "Circuit",
        "rationale": "Adhérence maximale en virage sur pneus route ou semi-slicks, au prix d'une usure plus rapide. Plus de carrossage avant négatif et de chasse, avec l'arrière réglé droit pour le laisser pivoter à l'inscription en virage. Le pneu fixe la limite de carrossage — à vérifier sur banc."
      },
      "boostedRoad": {
        "name": "Route suralim.",
        "rationale": "Voiture de route turbo ou compressée. Parallélisme avant réglé parallèle (zéro) pour réduire l'effet de couple dans la direction et faire passer la puissance, avec une chasse élevée (6°) pour la stabilité en ligne droite sous suralimentation et un parallélisme arrière fermé plus marqué pour la motricité."
      },
      "boostedTrack": {
        "name": "Circuit suralim.",
        "rationale": "Voiture de circuit suralimentée à forte puissance. Carrossage avant agressif avec beaucoup de chasse (6,5°) pour la stabilité et le gain de carrossage, un léger parallélisme avant ouvert pour que la puissance passe toujours, et un parallélisme arrière fermé modéré. Un point de départ — à vérifier sur banc et à équilibrer aux masses par roue."
      }
    }
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
        "help": "Immer positiv. Saugmotor-Straßenfahrzeuge laufen etwa 3°; Aufladung verlangt 5–6,5° für Stabilität unter Ladedruck. Über verstellbare Zugstreben einstellen und beide Seiten innerhalb von 0,5° abgleichen."
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
    "confidence": {
      "high": "Hohe Verlässlichkeit",
      "medium": "Mittel",
      "low": "Niedrig / extrapoliert"
    },
    "warnings": {
      "rearToeOut": "Nachspur hinten kann zu plötzlichem Übersteuern führen — nur geeignet für erfahrene Fahrer mit einem reinen Renn-Setup auf Eindrehen.",
      "rearCamberPositive": "Positiver Sturz hinten macht das Heck nervös — hinten sollte neutral bis leicht negativ laufen.",
      "frontCamberPositive": "Positiver Sturz vorne ist der Werkswert für schmale Diagonalreifen; die meisten modernen Setups laufen für den Grip negativ.",
      "casterHigh": "Sehr hoher Nachlauf bedeutet schwergängige Lenkung bei niedrigen Geschwindigkeiten. Das ist bei einem Turbo- oder Kompressor-Mini normal (5–6,5°), aber viel für ein Saugmotor-Fahrzeug."
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
    "disclaimer": "Dies sind Ausgangspunkte, kein Dogma. Verifiziere immer auf einem ordentlichen Achsvermessungsstand (per Augenmaß geschätzte Spur liegt häufig um 1/8\" oder mehr daneben), gleiche Nachlauf und Sturz seitenweise auf 0,5° ab und überprüfe nach jeder Änderung der Fahrzeughöhe erneut. Die Achsvermessung zähmt Antriebseinflüsse auf die Lenkung bei einem aufgeladenen Mini nur teilweise.",
    "presets": {
      "factory": {
        "name": "Werkseinstellung",
        "rationale": "Die Geometrie nach Werkstatthandbuch. Der vordere Sturz ist positiv (+2°) und die Vorderachse hat leichte Vorspur (toe-out) — beides beim Mini korrekt, keine Tippfehler. Hinten läuft 1/8\" Nachspur (toe-in). Eine getreue Ausgangsbasis; die meisten modernen Setups verbessern sie."
      },
      "stockRoad": {
        "name": "Serie Straße",
        "rationale": "Werksgeometrie aufgeräumt für moderne Radialreifen: der unglückliche positive vordere Sturz auf milde -0,5° zurückgenommen für etwas mehr Grip und gleichmäßigeren Verschleiß, alles andere nah an Serie belassen. Das einfache, komfortable Setup für den Alltag."
      },
      "performance": {
        "name": "Performance",
        "rationale": "Ein schärferes Straßen-Setup. Mehr negativer vorderer Sturz hält den belasteten Reifen bei Karosserieneigung flach, etwas mehr Nachlauf verbessert die Rückstellung, und leichtere hintere Nachspur macht das Auto agiler. Weiterhin straßentauglich, mit etwas mehr Reifenverschleiß."
      },
      "track": {
        "name": "Rennstrecke",
        "rationale": "Maximaler Kurvengrip auf Straßen- oder Semislick-Reifen, bei schnellerem Reifenverschleiß. Mehr negativer vorderer Sturz und Nachlauf, hinten auf neutral gestellt, damit das Auto beim Einlenken eindreht. Der Reifen setzt die Sturz-Obergrenze — auf dem Prüfstand verifizieren."
      },
      "boostedRoad": {
        "name": "Aufgeladen Straße",
        "rationale": "Turbo- oder Kompressor-Straßenfahrzeug. Vorderachse auf parallel (null) gestellt, um Antriebseinflüsse auf die Lenkung zu reduzieren und die Leistung umzusetzen, mit hohem Nachlauf (6°) für Geradeauslaufstabilität unter Ladedruck und größerer hinterer Nachspur für Traktion."
      },
      "boostedTrack": {
        "name": "Aufgeladen Rennstrecke",
        "rationale": "Leistungsstarkes aufgeladenes Rennstreckenfahrzeug. Aggressiver vorderer Sturz mit viel Nachlauf (6,5°) für Stabilität und Sturzzunahme, leichte vordere Vorspur (toe-out), damit die Leistung dennoch umgesetzt wird, und milde hintere Nachspur. Ein Ausgangspunkt — auf dem Prüfstand verifizieren und Radlasten einstellen."
      }
    }
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
        "help": "Sempre positiva. Le vetture stradali aspirate hanno circa 3°; quelle sovralimentate richiedono 5–6,5° per la stabilità sotto sovralimentazione. Si regola tramite tie-bar registrabili e va abbinata su entrambi i lati entro 0,5°."
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
    "confidence": {
      "high": "Affidabilità alta",
      "medium": "Media",
      "low": "Bassa / estrapolata"
    },
    "warnings": {
      "rearToeOut": "La divergenza posteriore può causare sovrasterzo improvviso — adatta solo a piloti esperti in un assetto da rotazione full-race.",
      "rearCamberPositive": "Una campanatura posteriore positiva rende il retrotreno nervoso — il posteriore dovrebbe lavorare da neutro a lievemente negativo.",
      "frontCamberPositive": "La campanatura anteriore positiva è il valore di serie per gli stretti pneumatici crossply; la maggior parte degli assetti moderni usa valori negativi per l'aderenza.",
      "casterHigh": "Un'incidenza molto elevata comporta uno sterzo pesante a bassa velocità. È normale su una Mini turbo o con compressore volumetrico (5–6,5°) ma è molto per una vettura aspirata."
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
    "disclaimer": "Questi sono punti di partenza, non verità assolute. Verifica sempre su un banco di allineamento adeguato (la convergenza valutata a occhio è spesso sbagliata di 1/8\" o più), allinea incidenza e campanatura tra i due lati entro 0,5° e ricontrolla dopo ogni modifica dell'altezza da terra. L'allineamento attenua solo in parte il torque steer su una Mini sovralimentata.",
    "presets": {
      "factory": {
        "name": "Originale",
        "rationale": "La geometria del manuale d'officina originale. Il campanatura anteriore è positiva (+2°) e l'anteriore ha una leggera convergenza negativa (toe-out) — entrambi corretti per la Mini, non errori. Il posteriore ha 1/8\" di convergenza positiva (toe-in). Una base fedele all'originale; la maggior parte degli assetti moderni la migliora."
      },
      "stockRoad": {
        "name": "Strada Standard",
        "rationale": "Geometria originale rivista per i moderni pneumatici radiali: la scomoda campanatura anteriore positiva ridotta a un lieve -0,5° per un po' più di aderenza e un'usura più uniforme, tutto il resto lasciato vicino all'originale. L'assetto facile e confortevole per l'uso quotidiano."
      },
      "performance": {
        "name": "Sportivo",
        "rationale": "Un assetto stradale più incisivo. Una campanatura anteriore più negativa mantiene piatto lo pneumatico sotto carico durante il rollio, un po' più di incidenza aumenta l'autoallineamento, e una convergenza posteriore più leggera rende la vettura più libera. Ancora adatto alla strada, con un'usura degli pneumatici leggermente maggiore."
      },
      "track": {
        "name": "Pista",
        "rationale": "Massima aderenza in curva su pneumatici stradali o semi-slick, accettando un'usura più rapida degli pneumatici. Campanatura e incidenza anteriori più negative, con il posteriore impostato dritto per favorire la rotazione in inserimento. Lo pneumatico determina il limite di campanatura — verificare al banco."
      },
      "boostedRoad": {
        "name": "Strada Sovralimentata",
        "rationale": "Vettura stradale turbo o con compressore volumetrico. Convergenza anteriore impostata parallela (zero) per ridurre il torque steer e scaricare a terra la potenza, con incidenza elevata (6°) per la stabilità in rettilineo sotto sovralimentazione e una maggiore convergenza positiva al posteriore per la trazione."
      },
      "boostedTrack": {
        "name": "Pista Sovralimentata",
        "rationale": "Vettura da circuito ad alta potenza sovralimentata. Campanatura anteriore aggressiva con molta incidenza (6,5°) per stabilità e recupero di campanatura, una leggera convergenza negativa all'anteriore così la potenza arriva comunque a terra, e una lieve convergenza positiva al posteriore. Un punto di partenza — verificare al banco e bilanciare i pesi alle ruote."
      }
    }
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
        "help": "Sempre positivo. Os carros de estrada atmosféricos têm cerca de 3°; a sobrealimentação pede 5–6.5° para estabilidade sob pressão de admissão. Ajuste através das barras tensoras reguláveis e iguale ambos os lados a menos de 0.5°."
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
    "confidence": {
      "high": "Confiança alta",
      "medium": "Média",
      "low": "Baixa / extrapolada"
    },
    "warnings": {
      "rearToeOut": "A divergência traseira pode causar sobreviragem brusca — só adequada para condutores experientes numa configuração de rotação de competição total.",
      "rearCamberPositive": "A cambagem traseira positiva torna a traseira nervosa — a traseira deve correr entre neutra e ligeiramente negativa.",
      "frontCamberPositive": "A cambagem dianteira positiva é o valor de fábrica para os pneus diagonais estreitos; a maioria das configurações modernas corre negativa para aderência.",
      "casterHigh": "Um avance muito elevado significa uma direção pesada a baixa velocidade. Isso é normal num Mini turbo ou sobrealimentado (5–6.5°), mas é muito para um carro atmosférico."
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
    "disclaimer": "Estes são pontos de partida, não dogmas. Verifique sempre numa bancada de alinhamento adequada (a convergência avaliada a olho está frequentemente errada em 1/8\" ou mais), iguale o cáster e a cambagem de lado a lado dentro de 0,5°, e volte a verificar após qualquer alteração da altura de rodagem. O alinhamento só dompta parcialmente o efeito de torque na direção num Mini turbo.",
    "presets": {
      "factory": {
        "name": "Fábrica",
        "rationale": "A geometria do manual de oficina de fábrica. A caída dianteira é positiva (+2°) e a dianteira tem uma ligeira convergência negativa (toe-out) — ambas corretas para o Mini, não são erros. A traseira tem 1/8\" de convergência positiva (toe-in). Uma base fiel; a maioria das configurações modernas melhora-a."
      },
      "stockRoad": {
        "name": "Estrada Original",
        "rationale": "Geometria de fábrica acertada para pneus radiais modernos: a desajeitada caída dianteira positiva reduzida para uns suaves -0.5° para um pouco mais de aderência e desgaste uniforme, deixando todo o resto próximo do original. A configuração fácil e confortável para uso diário."
      },
      "performance": {
        "name": "Desportivo",
        "rationale": "Uma configuração de estrada mais incisiva. Mais caída dianteira negativa mantém o pneu carregado plano durante o rolamento da carroçaria, um pouco mais de avance acrescenta auto-centragem, e uma convergência positiva traseira mais ligeira solta o carro. Ainda adequado para a estrada, com um pouco mais de desgaste dos pneus."
      },
      "track": {
        "name": "Pista",
        "rationale": "Aderência máxima em curva com pneus de estrada ou semi-slick, aceitando um desgaste mais rápido dos pneus. Mais caída dianteira negativa e avance, com a traseira ajustada a direito para deixá-la rodar na entrada da curva. O pneu define o limite da caída — verifique num alinhador."
      },
      "boostedRoad": {
        "name": "Estrada Turbo",
        "rationale": "Carro de estrada turbo ou sobrealimentado. Convergência dianteira ajustada paralela (zero) para reduzir o torque steer e transmitir a potência ao solo, com avance elevado (6°) para estabilidade em linha reta sob pressão de admissão e uma maior convergência positiva traseira para tração."
      },
      "boostedTrack": {
        "name": "Pista Turbo",
        "rationale": "Carro de circuito de sobrealimentação de alta potência. Caída dianteira agressiva com bastante avance (6.5°) para estabilidade e ganho de caída, uma pequena convergência negativa dianteira (toe-out) para a potência continuar a chegar ao solo, e uma convergência positiva traseira suave. Um ponto de partida — verifique num alinhador e faça o corner-weight."
      }
    }
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
        "help": "Всегда положительный. Атмосферные дорожные автомобили работают примерно на 3°; для наддувных нужно 5–6.5° для устойчивости под наддувом. Настраивается регулируемыми тягами; разница между сторонами не более 0.5°."
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
    "confidence": {
      "high": "Высокая достоверность",
      "medium": "Средняя",
      "low": "Низкая / экстраполировано"
    },
    "warnings": {
      "rearToeOut": "Заднее расхождение может вызвать резкую избыточную поворачиваемость — подходит только опытным водителям при чисто гоночной настройке на доворот.",
      "rearCamberPositive": "Положительный задний развал делает корму нервной — сзади развал должен быть нейтральным или слегка отрицательным.",
      "frontCamberPositive": "Положительный передний развал — заводское значение для узких диагональных шин; большинство современных настроек используют отрицательный развал ради сцепления.",
      "casterHigh": "Очень высокий кастор означает тяжёлый руль на малых скоростях. Это нормально для Mini с турбонаддувом или нагнетателем (5–6.5°), но многовато для атмосферного автомобиля."
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
    "disclaimer": "Это отправные точки, а не истина в последней инстанции. Всегда проверяйте на нормальном стенде развал-схождения (схождение на глаз часто ошибочно на 1/8\" и более), согласуйте кастер и развал по сторонам в пределах 0,5° и перепроверяйте после любого изменения дорожного просвета. Регулировка лишь частично укрощает рулевой увод от тяги на Mini с наддувом.",
    "presets": {
      "factory": {
        "name": "Заводская",
        "rationale": "Геометрия из заводского руководства по ремонту. Передний развал положительный (+2°), а спереди небольшая расходимость колёс — для Mini это правильно, а не опечатки. Сзади заданы 1/8\" схождения. Достоверная отправная точка; большинство современных настроек её улучшают."
      },
      "stockRoad": {
        "name": "Сток дорога",
        "rationale": "Заводская геометрия, приведённая в порядок под современные радиальные шины: неудобный положительный передний развал уменьшен до мягких -0.5° для чуть большего сцепления и равномерного износа, остальное оставлено близко к стоку. Простая, комфортная настройка для повседневной езды."
      },
      "performance": {
        "name": "Спорт",
        "rationale": "Более острая дорожная настройка. Больше отрицательного переднего развала держит нагруженную шину плоской при кренах кузова, чуть больше кастора добавляет самоцентрирование, а уменьшенное заднее схождение раскрепощает автомобиль. Всё ещё пригодно для дорог, но с чуть большим износом шин."
      },
      "track": {
        "name": "Трек",
        "rationale": "Максимальное сцепление в поворотах на дорожных или полуслик-шинах ценой ускоренного износа. Больше отрицательного переднего развала и кастора, а зад выставлен прямо, чтобы машина поворачивала на входе. Шина задаёт предел развала — проверьте на стенде."
      },
      "boostedRoad": {
        "name": "Над. дорога",
        "rationale": "Дорожный автомобиль с турбонаддувом или нагнетателем. Переднее схождение выставлено параллельно (ноль), чтобы убрать рывки руля под тягой и реализовать мощность, с высоким кастором (6°) для прямолинейной устойчивости под наддувом и увеличенным задним схождением для тяги."
      },
      "boostedTrack": {
        "name": "Над. трек",
        "rationale": "Мощный кольцевой автомобиль с наддувом. Агрессивный передний развал с большим кастором (6.5°) для устойчивости и прироста развала, небольшая передняя расходимость, чтобы мощность всё же реализовывалась, и мягкое заднее схождение. Это отправная точка — проверьте на стенде и сделайте развесовку по колёсам."
      }
    }
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
        "help": "常にポジティブ。自然吸気のロードカーはおよそ3°、過給車は過給時の安定性のために5–6.5°が望ましいです。調整式タイバーで設定し、左右を0.5°以内で合わせてください。"
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
    "confidence": {
      "high": "信頼度：高",
      "medium": "中",
      "low": "低／外挿"
    },
    "warnings": {
      "rearToeOut": "リアのトーアウトは急なオーバーステアを引き起こす可能性があります。フルレースの回頭セットアップに慣れた経験豊富なドライバーにのみ適しています。",
      "rearCamberPositive": "リアのプラスキャンバーは後輪を神経質にします。リアはニュートラルから軽いマイナスにすべきです。",
      "frontCamberPositive": "フロントのプラスキャンバーは細身のクロスプライタイヤ向けの純正値です。現代の多くのセットアップではグリップのためにマイナスにします。",
      "casterHigh": "非常に高いキャスターは、低速時のステアリングを重くします。ターボやスーパーチャージャー付きのMiniでは正常な範囲（5–6.5°）ですが、自然吸気車には大きすぎます。"
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
    "disclaimer": "これらは出発点であり、絶対的なものではありません。必ず適切なアライメント測定機で確認し（目視によるトー測定は1/8\"以上ずれていることがよくあります）、キャスターとキャンバーを左右0.5°以内で揃え、車高を変更した後は再確認してください。過給したMiniでは、アライメントはトルクステアを部分的にしか抑えられません。",
    "presets": {
      "factory": {
        "name": "ファクトリー",
        "rationale": "工場マニュアル準拠のジオメトリ。フロントのキャンバーはポジティブ（+2°）で、フロントはわずかにトーアウト――どちらもMiniにとっては正しい設定で、誤記ではありません。リアは1/8\"のトーインです。忠実なベースラインですが、最近のセットアップの多くはこれを改善しています。"
      },
      "stockRoad": {
        "name": "ストックロード",
        "rationale": "現代のラジアルタイヤ向けに整えた工場ジオメトリ。扱いにくいポジティブなフロントキャンバーを、グリップとタイヤの均一な摩耗のために控えめな-0.5°へ戻し、それ以外はほぼ標準のまま。気軽で快適な日常使い向けセットアップです。"
      },
      "performance": {
        "name": "パフォーマンス",
        "rationale": "よりシャープなストリート向けセットアップ。フロントのネガティブキャンバーを増やしてロール時も荷重のかかったタイヤを路面に対してフラットに保ち、キャスターを少し増やしてセルフセンタリングを高め、リアのトーインを軽くしてクルマの動きを軽快にします。ストリートでも扱いやすく、タイヤ摩耗はやや増えます。"
      },
      "track": {
        "name": "トラック",
        "rationale": "ロードまたはセミスリックタイヤでのコーナリンググリップを最大化し、タイヤ摩耗の速さは許容します。フロントのネガティブキャンバーとキャスターを増やし、リアはストレートにしてターンイン時の回頭性を引き出します。キャンバーの上限はタイヤが決めるので、アライメント測定機で確認してください。"
      },
      "boostedRoad": {
        "name": "過給ロード",
        "rationale": "ターボまたはスーパーチャージャー付きのストリートカー。フロントトーをパラレル（ゼロ）にしてトルクステアを抑えパワーを路面に伝え、高めのキャスター（6°）で過給時の直進安定性を確保し、リアは大きめのトーインでトラクションを得ます。"
      },
      "boostedTrack": {
        "name": "過給トラック",
        "rationale": "ハイパワーな過給サーキットカー。アグレッシブなフロントキャンバーに多めのキャスター（6.5°）を組み合わせて安定性とキャンバーゲインを得て、フロントは小さめのトーアウトでパワーを路面に伝え、リアは控えめのトーインにします。あくまで出発点――アライメント測定機で確認し、コーナーウェイトを取ってください。"
      }
    }
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
        "help": "始终为正值。自然进气的道路车约为 3°；强制进气则需要 5–6.5° 以在增压下保持稳定。通过可调拉杆设定，并使两侧偏差控制在 0.5° 以内。"
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
    "confidence": {
      "high": "高可信度",
      "medium": "中等",
      "low": "低 / 外推"
    },
    "warnings": {
      "rearToeOut": "后轮外束可能导致突发性转向过度——仅适合经验丰富的驾驶者在全赛车转动设置下使用。",
      "rearCamberPositive": "后轮正外倾角会使后部变得不安定——后轮应采用中性至轻微负值。",
      "frontCamberPositive": "前轮正外倾角是针对窄胎面斜交胎的原厂数值；大多数现代设置采用负值以获得抓地力。",
      "casterHigh": "极大的后倾角意味着低速转向沉重。这在涡轮增压或机械增压的 Mini 上属正常（5–6.5°），但对自然进气车型而言偏大。"
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
    "disclaimer": "这些只是起始参数，并非金科玉律。请始终在专业的四轮定位调校台上验证（目测的前束经常会有 1/8\" 甚至更大的偏差），将主销后倾角和外倾角左右两侧匹配在 0.5° 范围内，并在任何车身高度变更后重新检查。在增压 Mini 上，四轮定位只能部分抑制扭矩转向。",
    "presets": {
      "factory": {
        "name": "原厂",
        "rationale": "原厂维修手册定义的几何参数。前轮外倾为正值（+2°），前轮略带前张（外八），这两项对 Mini 而言都是正确的，并非笔误。后轮采用 1/8\" 前束（内八）。这是忠于原厂的基准设定，多数现代设定都在此基础上加以改进。"
      },
      "stockRoad": {
        "name": "街道原厂",
        "rationale": "为现代子午线轮胎优化过的原厂几何：将别扭的前轮正外倾回调到温和的 -0.5°，以获得更多抓地力并使磨损更均匀，其余基本保持原厂状态。轻松舒适、适合日常代步的设定。"
      },
      "performance": {
        "name": "运动",
        "rationale": "更犀利的街道设定。更大的前轮负外倾让承载侧轮胎在车身侧倾中保持贴地，略增的后倾角提升回正性，更轻的后轮前束让车尾更灵活。仍适合道路使用，但轮胎磨损会稍快。"
      },
      "track": {
        "name": "赛道",
        "rationale": "在道路胎或半热熔胎上追求极致过弯抓地力，代价是轮胎磨损更快。更大的前轮负外倾与后倾角，后轮设为零前束（直行），以便转向时车尾能顺势转动。轮胎决定了外倾角的上限，请在四轮定位仪上核对。"
      },
      "boostedRoad": {
        "name": "增压街道",
        "rationale": "涡轮增压或机械增压的街车。前轮前束设为平行（零），以减少扭矩转向并更好地输出动力，配合较大的后倾角（6°）在增压下保持直线稳定性，后轮采用更大的前束以增强牵引力。"
      },
      "boostedTrack": {
        "name": "增压赛道",
        "rationale": "大马力强制进气的赛道车。激进的前轮外倾配合大量后倾角（6.5°）以获得稳定性与外倾增益，前轮略带前张（外八）以保证动力仍能输出，后轮采用温和前束。这只是一个起点，请在四轮定位仪上核对并做四轮称重配重。"
      }
    }
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
        "help": "항상 양의 값입니다. 자연흡기 도로용 차량은 약 3°로, 과급 차량은 부스트 상황의 안정성을 위해 5–6.5°를 원합니다. 조절식 타이바로 설정하고 양쪽을 0.5° 이내로 맞추세요."
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
    "confidence": {
      "high": "높은 신뢰도",
      "medium": "보통",
      "low": "낮음 / 추정값"
    },
    "warnings": {
      "rearToeOut": "뒤 토아웃은 급격한 오버스티어를 유발할 수 있습니다 — 풀레이스 회전 세팅에서 숙련된 운전자에게만 적합합니다.",
      "rearCamberPositive": "뒤 캠버가 양(+)이면 후미가 불안정해집니다 — 뒤는 중립에서 약한 음(-)으로 세팅해야 합니다.",
      "frontCamberPositive": "앞 캠버 양(+)은 가는 크로스플라이 타이어용 공장 수치입니다; 대부분의 현대적 세팅은 그립을 위해 음(-)으로 갑니다.",
      "casterHigh": "매우 높은 캐스터는 저속에서 조향을 무겁게 만듭니다. 터보나 슈퍼차저 Mini(5–6.5°)에서는 정상이지만 자연흡기 차량에는 과한 값입니다."
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
    "disclaimer": "이는 출발점일 뿐 절대적인 정답이 아닙니다. 항상 제대로 된 얼라인먼트 장비로 확인하고(눈대중 토는 1/8\" 이상 틀린 경우가 흔합니다), 캐스터와 캠버 좌우를 0.5° 이내로 맞추며, 차고 변경 후에는 다시 점검하세요. 얼라인먼트는 부스트 Mini의 토크 스티어를 부분적으로만 완화합니다.",
    "presets": {
      "factory": {
        "name": "공장 사양",
        "rationale": "공장 정비 매뉴얼 기준 지오메트리입니다. 전륜 캠버는 양의 값(+2°)이고 전륜은 약간 토아웃으로 설정되는데, 둘 다 Mini에서는 정상이며 오타가 아닙니다. 후륜은 1/8\" 토인으로 설정됩니다. 충실한 기준점이지만 대부분의 현대식 세팅은 이를 개선합니다."
      },
      "stockRoad": {
        "name": "기본 도로",
        "rationale": "현대식 레이디얼 타이어에 맞춰 정리한 공장 지오메트리입니다. 어색한 양의 전륜 캠버를 완만한 -0.5°로 되돌려 접지력과 균일한 마모를 약간 개선하고, 나머지는 거의 기본값에 가깝게 둡니다. 편안하고 무난한 일상 주행용 세팅입니다."
      },
      "performance": {
        "name": "퍼포먼스",
        "rationale": "보다 날카로운 도로용 세팅입니다. 더 많은 음의 전륜 캠버가 차체 롤 중에도 하중이 걸린 타이어를 평평하게 유지하고, 약간 더 큰 캐스터가 셀프 센터링을 더하며, 가벼운 후륜 토인이 차의 거동을 자유롭게 합니다. 타이어 마모가 조금 더 늘지만 여전히 도로 주행에 적합합니다."
      },
      "track": {
        "name": "트랙",
        "rationale": "도로용 또는 세미슬릭 타이어에서 최대 코너링 접지력을 얻되 더 빠른 타이어 마모를 감수하는 세팅입니다. 더 많은 음의 전륜 캠버와 캐스터를 적용하고, 후륜은 직진으로 설정해 턴인 시 차체가 회전하도록 합니다. 캠버 한계는 타이어가 결정하므로 정렬기에서 검증하세요."
      },
      "boostedRoad": {
        "name": "부스트 도로",
        "rationale": "터보 또는 슈퍼차저를 장착한 도로용 차량입니다. 전륜 토를 평행(0)으로 설정해 토크 스티어를 줄이고 출력을 노면에 전달하며, 부스트 상황에서의 직진 안정성을 위해 높은 캐스터(6°)를, 접지력을 위해 더 큰 후륜 토인을 적용합니다."
      },
      "boostedTrack": {
        "name": "부스트 트랙",
        "rationale": "고출력 과급 서킷용 차량입니다. 공격적인 전륜 캠버에 안정성과 캠버 게인을 위한 충분한 캐스터(6.5°), 출력이 여전히 노면에 전달되도록 약간의 전륜 토아웃, 그리고 완만한 후륜 토인을 적용합니다. 출발점일 뿐이니 정렬기에서 검증하고 코너 웨이트를 잡으세요."
      }
    }
  }
}
</i18n>
