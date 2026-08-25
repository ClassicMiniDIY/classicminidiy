<script setup lang="ts">
  import { formOptions } from '../../../data/models/compression';
  import type { MathStep, MathConstant } from '../../types/mathBreakdown';

  const { t } = useI18n();
  const reactiveFormOptions = ref(formOptions);

  // All Form Inputs
  const pistonDish = ref<number>(6.5);
  const headVolume = ref<number>(25.5);
  const deckHeight = ref<number>(20);
  const bore = ref<number>(7.06);
  const stroke = ref<number>(8.128);
  const gasket = ref<number>(3.4);
  const decomp = ref<number>(0);
  const customGasket = ref<number>(0.1);
  const showHelpModal = ref(false);

  const pi = Math.PI;
  const boreRadius = computed(() => bore.value / 2);
  const deck = computed(() => deckHeight.value * 0.0254);
  const deckVolume = computed(() => boreRadius.value * boreRadius.value * (deck.value / 10) * pi);
  const ringland = computed(() => bore.value * 0.047619); // Correct for 18cc Accrallite 73.5mm pistons
  const gasketVolume = computed(() => (gasket.value === 0 ? customGasket.value : gasket.value));

  const vc = computed(
    () => pistonDish.value + gasketVolume.value + headVolume.value + deckVolume.value + ringland.value + decomp.value
  );

  // Swept volume of one cylinder. Named so the math breakdown can quote it as
  // its own step; the expression is unchanged from when it was inlined into
  // both ratio and capacity, so the floating-point results are identical.
  const sweptVolume = computed(() => stroke.value * (boreRadius.value * boreRadius.value) * pi);

  const ratio = computed(() => {
    const preRoundratio = (sweptVolume.value + vc.value) / vc.value;
    return Math.round((preRoundratio + Number.EPSILON) * 100) / 100;
  });

  const capacity = computed(() => {
    const preRoundcap = sweptVolume.value * 4;
    return Math.round((preRoundcap + Number.EPSILON) * 100) / 100;
  });

  // ---- Verifiable math breakdown --------------------------------------
  // Built from the SAME computed values the result cards render, so redoing
  // the arithmetic by hand lands on the numbers on screen. Never recompute the
  // results here — a second implementation would drift and the panel would
  // then be actively misleading rather than merely stale.
  function fmt(value: number, digits = 4): string {
    if (!Number.isFinite(value)) return '---';
    return Number.isInteger(value) ? String(value) : String(parseFloat(value.toFixed(digits)));
  }

  const mathSteps = computed<MathStep[]>(() => [
    {
      label: t('math.bore_radius'),
      formula: 'bore ÷ 2',
      substitution: `${fmt(bore.value)} ÷ 2`,
      result: `${fmt(boreRadius.value)} cm`,
    },
    {
      label: t('math.deck_height'),
      formula: 'deck height in thou × 0.0254',
      substitution: `${fmt(deckHeight.value)} × 0.0254`,
      result: `${fmt(deck.value)} cm`,
      note: t('math.note_thou'),
    },
    {
      label: t('math.deck_volume'),
      formula: 'bore radius² × (deck height ÷ 10) × π',
      substitution: `${fmt(boreRadius.value)}² × (${fmt(deck.value)} ÷ 10) × 3.14159`,
      result: `${fmt(deckVolume.value)} cc`,
    },
    {
      label: t('math.ringland'),
      formula: 'bore × 0.047619',
      substitution: `${fmt(bore.value)} × 0.047619`,
      result: `${fmt(ringland.value)} cc`,
      note: t('math.note_ringland'),
    },
    {
      label: t('math.gasket_volume'),
      formula: gasket.value === 0 ? t('math.gasket_custom_formula') : t('math.gasket_selected_formula'),
      substitution: `${fmt(gasketVolume.value)} cc`,
      result: `${fmt(gasketVolume.value)} cc`,
    },
    {
      label: t('math.chamber_volume'),
      formula: 'piston dish + gasket + head volume + deck volume + ringland + decompression plate',
      substitution: `${fmt(pistonDish.value)} + ${fmt(gasketVolume.value)} + ${fmt(headVolume.value)} + ${fmt(deckVolume.value)} + ${fmt(ringland.value)} + ${fmt(decomp.value)}`,
      result: `${fmt(vc.value)} cc`,
    },
    {
      label: t('math.swept_volume'),
      formula: 'stroke × bore radius² × π',
      substitution: `${fmt(stroke.value)} × ${fmt(boreRadius.value)}² × 3.14159`,
      result: `${fmt(sweptVolume.value)} cc`,
    },
    {
      label: t('math.ratio'),
      formula: '(swept volume + chamber volume) ÷ chamber volume',
      substitution: `(${fmt(sweptVolume.value)} + ${fmt(vc.value)}) ÷ ${fmt(vc.value)}`,
      result: `${ratio.value}:1`,
      note: t('math.note_two_decimals'),
    },
    {
      label: t('math.capacity'),
      formula: 'swept volume × 4 cylinders',
      substitution: `${fmt(sweptVolume.value)} × 4`,
      result: `${capacity.value} cc`,
      note: t('math.note_two_decimals'),
    },
  ]);

  const mathConstants = computed<MathConstant[]>(() => [
    { label: t('math.const_pi'), value: '3.14159' },
    { label: t('math.const_thou'), value: '0.0254 cm' },
    { label: t('math.const_cylinders'), value: '4' },
  ]);

  const MATH_SOURCE_FILE = 'app/components/Calculators/Compression.vue';
  const MATH_SOURCE_URL = `https://github.com/ClassicMiniDIY/classicminidiy/blob/main/${MATH_SOURCE_FILE}`;

  const { capture } = usePostHog();
  const { track } = useAnalytics();
  let captureTimer: ReturnType<typeof setTimeout> | null = null;
  // Debounced field-change tracking (signal only — no values)
  let fieldChangeTimer: ReturnType<typeof setTimeout> | null = null;
  function trackFieldChange(field: string) {
    if (fieldChangeTimer) clearTimeout(fieldChangeTimer);
    fieldChangeTimer = setTimeout(() => {
      track('compression_input_changed', { field });
    }, 600);
  }

  watch([ratio, capacity], () => {
    if (captureTimer) clearTimeout(captureTimer);
    captureTimer = setTimeout(() => {
      capture('calculator_used', {
        calculator: 'compression',
        compression_ratio: ratio.value,
        capacity_cc: capacity.value,
      });
    }, 1000);
  });

  onUnmounted(() => {
    if (captureTimer) clearTimeout(captureTimer);
    if (fieldChangeTimer) clearTimeout(fieldChangeTimer);
  });
</script>

<template>
  <div class="grid grid-cols-1 gap-6">
    <div class="col-span-1">
      <button
        class="btn btn-primary mb-5"
        @click="
          showHelpModal = true;
          track('help_opened', { tool: 'compression' });
        "
      >
        <i class="fad fa-question-circle mr-2"></i>
        {{ t('help_button') }}
      </button>

      <!-- Help Modal -->
      <div class="modal" :class="{ 'modal-open': showHelpModal }">
        <div class="modal-box max-w-3xl">
          <h2 class="text-lg font-semibold">{{ t('help_modal.title') }}</h2>
          <div class="aspect-video w-full mt-4">
            <iframe
              class="w-full h-full"
              allowfullscreen
              src="https://www.youtube.com/embed/GxlgkbrfK2Y"
              :title="t('youtube_player_title')"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            ></iframe>
          </div>
          <div class="mt-4">
            <h3 class="text-xl font-bold">{{ t('help_modal.friend_title') }}</h3>
            <p class="text-sm opacity-70">
              <a href="https://www.youtube.com/watch?v=GxlgkbrfK2Y" class="text-primary hover:underline">@hreirl</a>
              {{ t('help_modal.friend_description') }}
            </p>
            <p class="mt-2">
              {{ t('help_modal.friend_text') }}
            </p>
          </div>
          <div class="modal-action">
            <button class="btn btn-primary" @click="showHelpModal = false">
              {{ t('help_modal.close_button') }}
            </button>
          </div>
        </div>
        <div class="modal-backdrop" @click="showHelpModal = false"></div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Piston Size Select -->
      <fieldset class="fieldset">
        <legend class="fieldset-legend flex items-center gap-2">
          <i class="fad fa-engine"></i>
          {{ t('form_labels.piston_size') }}
        </legend>
        <select v-model="bore" class="select select-bordered w-full" @change="trackFieldChange('piston_size')">
          <option v-for="opt in reactiveFormOptions.pistonOptions" :key="opt.label" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </fieldset>

      <!-- Crankshaft Select -->
      <fieldset class="fieldset">
        <legend class="fieldset-legend flex items-center gap-2">
          <i class="fad fa-arrows-rotate fa-spin"></i>
          {{ t('form_labels.crankshaft') }}
        </legend>
        <select v-model="stroke" class="select select-bordered w-full" @change="trackFieldChange('crankshaft')">
          <option v-for="opt in reactiveFormOptions.crankshaftOptions" :key="opt.label" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </fieldset>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Head Gasket Select -->
      <div>
        <fieldset class="fieldset">
          <legend class="fieldset-legend flex items-center gap-2">
            <i class="fad fa-head-side-gear"></i>
            {{ t('form_labels.head_gasket') }}
          </legend>
          <select
            v-model.number="gasket"
            class="select select-bordered w-full"
            @change="trackFieldChange('head_gasket')"
          >
            <option v-for="opt in reactiveFormOptions.headGasketOptions" :key="opt.label" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </fieldset>
        <div v-if="gasket === 0" class="mt-2">
          <fieldset class="fieldset">
            <legend class="fieldset-legend flex items-center gap-2">
              <i class="fad fa-ruler"></i>
              {{ t('form_labels.custom_gasket_size') }}
            </legend>
            <input
              type="number"
              min="0.1"
              max="10"
              step="0.1"
              v-model.number="customGasket"
              class="input input-bordered w-full"
              @change="trackFieldChange('custom_gasket')"
            />
          </fieldset>
        </div>
      </div>

      <!-- Decompression Plate Select -->
      <fieldset class="fieldset">
        <legend class="fieldset-legend flex items-center gap-2">
          <i class="fad fa-arrow-down-to-line"></i>
          {{ t('form_labels.decompression_plate') }}
        </legend>
        <select
          v-model="decomp"
          class="select select-bordered w-full"
          @change="trackFieldChange('decompression_plate')"
        >
          <option v-for="opt in reactiveFormOptions.decompPlateOptions" :key="opt.label" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </fieldset>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- Piston Dish Size -->
      <fieldset class="fieldset">
        <legend class="fieldset-legend flex items-center gap-2">
          <i class="fad fa-circle-half fa-rotate-270"></i>
          {{ t('form_labels.piston_dish_size') }}
        </legend>
        <input
          v-model.number="pistonDish"
          type="number"
          min="0"
          max="20"
          step="0.1"
          class="input input-bordered w-full"
          @change="trackFieldChange('piston_dish')"
        />
      </fieldset>

      <!-- Cylinder Head Chamber Volume -->
      <fieldset class="fieldset">
        <legend class="fieldset-legend flex items-center gap-2">
          <i class="fad fa-arrows-to-dot"></i>
          {{ t('form_labels.cylinder_head_chamber_volume') }}
        </legend>
        <input
          v-model.number="headVolume"
          type="number"
          min="15"
          max="35"
          step="0.1"
          class="input input-bordered w-full"
          @change="trackFieldChange('head_volume')"
        />
      </fieldset>

      <!-- Piston Deck Height -->
      <fieldset class="fieldset">
        <legend class="fieldset-legend flex items-center gap-2">
          <i class="fad fa-arrow-up-to-line"></i>
          {{ t('form_labels.piston_deck_height') }}
        </legend>
        <input
          v-model.number="deckHeight"
          type="number"
          min="0"
          max="80"
          step="1"
          class="input input-bordered w-full"
          @change="trackFieldChange('deck_height')"
        />
      </fieldset>
    </div>

    <!-- Results Section -->
    <div class="mt-8">
      <h2 class="text-2xl font-bold mb-4">{{ t('results.title') }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6" aria-live="polite">
        <div class="rounded-lg bg-secondary shadow-sm p-6 text-center text-white">
          <h3 class="text-lg opacity-70">
            <i class="fa-jelly-duo fa-regular fa-compress fa-beat"></i>
            {{ t('results.compression_ratio') }}
          </h3>
          <p class="text-3xl font-bold">{{ ratio || '?' }}</p>
        </div>
        <div class="rounded-lg bg-primary shadow-sm p-6 text-center text-white">
          <h3 class="text-lg opacity-70">
            <i class="fa-duotone fa-solid fa-fill"></i>
            {{ t('results.engine_capacity') }}
          </h3>
          <p class="text-3xl font-bold">{{ capacity || '?' }}</p>
        </div>
      </div>
    </div>

    <!-- Verifiable math -->
    <div class="mt-6">
      <CalculatorsMathBreakdown
        calculator="compression"
        :steps="mathSteps"
        :constants="mathConstants"
        :source-url="MATH_SOURCE_URL"
        :source-file="MATH_SOURCE_FILE"
      />
    </div>

    <!-- Disclaimer -->
    <div class="text-center mt-4">
      <div class="max-w-3xl mx-auto">
        <p class="mb-2">
          <span v-html="t('disclaimer.text', { strong_start: '<strong>', strong_end: '</strong>' })"></span>
        </p>
        <p>
          {{ t('disclaimer.alternate_source') }}
          <a
            href="https://www.calverst.com/technical-info/compression-ratio-%E2%80%93-working-it-out/"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary hover:underline"
          >
            {{ t('disclaimer.calver_link') }}</a
          >,
          <a
            href="https://www.jepistons.com/blog/how-to-calculate-engine-compression-ratio-and-displacement"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary hover:underline"
          >
            {{ t('disclaimer.je_pistons_link') }}
          </a>
        </p>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "help_button": "How do I measure these values?",
    "help_modal": {
      "title": "Measuring your chambers and deck",
      "friend_title": "Our Friend Paul Hickey",
      "friend_description": "on Youtube",
      "friend_text": "If you need any assistance measuring these values for the calculator, check out the video above by Paul Hickey at HRE IRL. Where he covers the entire measurement process on the Classic Mini.",
      "close_button": "Close"
    },
    "form_labels": {
      "piston_size": "Piston Size",
      "crankshaft": "Crankshaft",
      "head_gasket": "Head Gasket",
      "custom_gasket_size": "Custom Gasket Size (cc)",
      "decompression_plate": "Decompression Plate",
      "piston_dish_size": "Piston Dish Size (cc)",
      "cylinder_head_chamber_volume": "Cylinder Head Chamber Volume (cc)",
      "piston_deck_height": "Piston Deck Height (thou)"
    },
    "results": {
      "title": "Results:",
      "compression_ratio": "Compression Ratio",
      "engine_capacity": "Engine Capacity"
    },
    "disclaimer": {
      "text": "Please note the above figures are {strong_start}approximate values{strong_end}. Before purchasing parts and building your engine we recommend {strong_start}doublechecking{strong_end} your calculations multiple times using more than one source.",
      "alternate_source": "Alternate Source:",
      "calver_link": "Calver Compression Ratio",
      "je_pistons_link": "JE Pistons Compression Ratio"
    },
    "youtube_player_title": "YouTube video player",
    "math": {
      "bore_radius": "Bore radius",
      "deck_height": "Deck height in centimetres",
      "deck_volume": "Deck volume",
      "ringland": "Ringland volume",
      "gasket_volume": "Head gasket volume",
      "gasket_selected_formula": "the gasket you selected",
      "gasket_custom_formula": "the custom gasket volume you entered",
      "chamber_volume": "Total combustion chamber volume",
      "swept_volume": "Swept volume of one cylinder",
      "ratio": "Compression ratio",
      "capacity": "Engine capacity",
      "note_thou": "Deck height is entered in thousandths of an inch; one thou is 0.0254 cm.",
      "note_ringland": "A fixed allowance calibrated for 18cc Accralite 73.5 mm pistons.",
      "note_two_decimals": "Rounded to two decimal places, the same as the calculator.",
      "const_pi": "Pi",
      "const_thou": "One thousandth of an inch",
      "const_cylinders": "Cylinders in an A-series engine"
    }
  },
  "es": {
    "help_button": "¿Cómo mido estos valores?",
    "help_modal": {
      "title": "Midiendo tus cámaras y cubierta",
      "friend_title": "Nuestro Amigo Paul Hickey",
      "friend_description": "en Youtube",
      "friend_text": "Si necesitas ayuda para medir estos valores para la calculadora, revisa el video de arriba por Paul Hickey en HRE IRL. Donde cubre todo el proceso de medición en el Classic Mini.",
      "close_button": "Cerrar"
    },
    "form_labels": {
      "piston_size": "Tamaño del Pistón",
      "crankshaft": "Cigüeñal",
      "head_gasket": "Junta de Culata",
      "custom_gasket_size": "Tamaño de Junta Personalizada (cc)",
      "decompression_plate": "Placa de Descompresión",
      "piston_dish_size": "Tamaño del Plato del Pistón (cc)",
      "cylinder_head_chamber_volume": "Volumen de la Cámara de la Culata (cc)",
      "piston_deck_height": "Altura del Pistón sobre la Cubierta (thou)"
    },
    "results": {
      "title": "Resultados:",
      "compression_ratio": "Relación de Compresión",
      "engine_capacity": "Capacidad del Motor"
    },
    "disclaimer": {
      "text": "Ten en cuenta que las cifras anteriores son {strong_start}valores aproximados{strong_end}. Antes de comprar piezas y construir tu motor, recomendamos {strong_start}verificar{strong_end} tus cálculos múltiples veces usando más de una fuente.",
      "alternate_source": "Fuente Alternativa:",
      "calver_link": "Relación de Compresión Calver",
      "je_pistons_link": "Relación de Compresión JE Pistons"
    },
    "youtube_player_title": "Reproductor de video de YouTube",
    "math": {
      "bore_radius": "Radio del cilindro",
      "deck_height": "Altura de plataforma en centímetros",
      "deck_volume": "Volumen de plataforma",
      "ringland": "Volumen del portasegmentos",
      "gasket_volume": "Volumen de la junta de culata",
      "gasket_selected_formula": "la junta que seleccionaste",
      "gasket_custom_formula": "el volumen de junta personalizado que introdujiste",
      "chamber_volume": "Volumen total de la cámara de combustión",
      "swept_volume": "Cilindrada barrida de un cilindro",
      "ratio": "Relación de compresión",
      "capacity": "Cilindrada del motor",
      "note_thou": "La altura de plataforma se introduce en milésimas de pulgada; una milésima son 0,0254 cm.",
      "note_ringland": "Una asignación fija calibrada para pistones Accralite de 18cc y 73,5 mm.",
      "note_two_decimals": "Redondeado a dos decimales, igual que la calculadora.",
      "const_pi": "Pi",
      "const_thou": "Una milésima de pulgada",
      "const_cylinders": "Cilindros en un motor serie A"
    }
  },
  "fr": {
    "help_button": "Comment mesurer ces valeurs ?",
    "help_modal": {
      "title": "Mesurer vos chambres et votre pont",
      "friend_title": "Notre ami Paul Hickey",
      "friend_description": "sur Youtube",
      "friend_text": "Si vous avez besoin d'aide pour mesurer ces valeurs pour la calculatrice, consultez la vidéo ci-dessus de Paul Hickey chez HRE IRL. Il y couvre tout le processus de mesure sur la Classic Mini.",
      "close_button": "Fermer"
    },
    "form_labels": {
      "piston_size": "Taille du piston",
      "crankshaft": "Vilebrequin",
      "head_gasket": "Joint de culasse",
      "custom_gasket_size": "Taille de joint personnalisé (cc)",
      "decompression_plate": "Plaque de décompression",
      "piston_dish_size": "Taille de cuvette du piston (cc)",
      "cylinder_head_chamber_volume": "Volume de chambre de culasse (cc)",
      "piston_deck_height": "Hauteur de pont du piston (millièmes)"
    },
    "results": {
      "title": "Résultats :",
      "compression_ratio": "Taux de compression",
      "engine_capacity": "Cylindrée du moteur"
    },
    "disclaimer": {
      "text": "Veuillez noter que les chiffres ci-dessus sont des {strong_start}valeurs approximatives{strong_end}. Avant d'acheter des pièces et de construire votre moteur, nous recommandons de {strong_start}revérifier{strong_end} vos calculs plusieurs fois en utilisant plus d'une source.",
      "alternate_source": "Source alternative :",
      "calver_link": "Taux de compression Calver",
      "je_pistons_link": "Taux de compression JE Pistons"
    },
    "youtube_player_title": "Lecteur vidéo YouTube",
    "math": {
      "bore_radius": "Rayon d'alésage",
      "deck_height": "Hauteur de plan de joint en centimètres",
      "deck_volume": "Volume du plan de joint",
      "ringland": "Volume de la zone de segments",
      "gasket_volume": "Volume du joint de culasse",
      "gasket_selected_formula": "le joint que vous avez sélectionné",
      "gasket_custom_formula": "le volume de joint personnalisé que vous avez saisi",
      "chamber_volume": "Volume total de la chambre de combustion",
      "swept_volume": "Cylindrée d'un cylindre",
      "ratio": "Rapport volumétrique",
      "capacity": "Cylindrée du moteur",
      "note_thou": "La hauteur du plan de joint se saisit en millièmes de pouce ; un millième vaut 0,0254 cm.",
      "note_ringland": "Une valeur fixe calibrée pour des pistons Accralite 18cc de 73,5 mm.",
      "note_two_decimals": "Arrondi à deux décimales, comme le calculateur.",
      "const_pi": "Pi",
      "const_thou": "Un millième de pouce",
      "const_cylinders": "Cylindres d'un moteur série A"
    }
  },
  "de": {
    "help_button": "Wie messe ich diese Werte?",
    "help_modal": {
      "title": "Messen Ihrer Brennräume und Decks",
      "friend_title": "Unser Freund Paul Hickey",
      "friend_description": "auf Youtube",
      "friend_text": "Wenn Sie Unterstützung beim Messen dieser Werte für den Rechner benötigen, schauen Sie sich das obige Video von Paul Hickey bei HRE IRL an. Dort behandelt er den kompletten Messvorgang am Classic Mini.",
      "close_button": "Schließen"
    },
    "form_labels": {
      "piston_size": "Kolbengröße",
      "crankshaft": "Kurbelwelle",
      "head_gasket": "Zylinderkopfdichtung",
      "custom_gasket_size": "Benutzerdefinierte Dichtungsgröße (ccm)",
      "decompression_plate": "Dekompressionsplatte",
      "piston_dish_size": "Kolbenmuldengröße (ccm)",
      "cylinder_head_chamber_volume": "Zylinderkopf-Brennraumvolumen (ccm)",
      "piston_deck_height": "Kolbendeckhöhe (tausendstel Zoll)"
    },
    "results": {
      "title": "Ergebnisse:",
      "compression_ratio": "Verdichtungsverhältnis",
      "engine_capacity": "Motorkapazität"
    },
    "disclaimer": {
      "text": "Bitte beachten Sie, dass die obigen Zahlen {strong_start}Näherungswerte{strong_end} sind. Vor dem Kauf von Teilen und dem Bau Ihres Motors empfehlen wir Ihnen, Ihre Berechnungen {strong_start}mehrfach{strong_end} mit mehr als einer Quelle zu überprüfen.",
      "alternate_source": "Alternative Quelle:",
      "calver_link": "Calver Verdichtungsverhältnis",
      "je_pistons_link": "JE Pistons Verdichtungsverhältnis"
    },
    "youtube_player_title": "YouTube-Videoplayer",
    "math": {
      "bore_radius": "Bohrungsradius",
      "deck_height": "Deckhöhe in Zentimetern",
      "deck_volume": "Deckvolumen",
      "ringland": "Ringstegvolumen",
      "gasket_volume": "Volumen der Zylinderkopfdichtung",
      "gasket_selected_formula": "die von Ihnen gewählte Dichtung",
      "gasket_custom_formula": "das von Ihnen eingegebene benutzerdefinierte Dichtungsvolumen",
      "chamber_volume": "Gesamtvolumen des Brennraums",
      "swept_volume": "Hubvolumen eines Zylinders",
      "ratio": "Verdichtungsverhältnis",
      "capacity": "Hubraum",
      "note_thou": "Die Deckhöhe wird in Tausendstel Zoll eingegeben; ein Tausendstel sind 0,0254 cm.",
      "note_ringland": "Ein fester Wert, kalibriert für 18cc Accralite Kolben mit 73,5 mm.",
      "note_two_decimals": "Auf zwei Nachkommastellen gerundet, genau wie im Rechner.",
      "const_pi": "Pi",
      "const_thou": "Ein Tausendstel Zoll",
      "const_cylinders": "Zylinder eines A-Serien-Motors"
    }
  },
  "it": {
    "help_button": "Come misuro questi valori?",
    "help_modal": {
      "title": "Misurare le camere di combustione e l'altezza del pistone",
      "friend_title": "Il nostro amico Paul Hickey",
      "friend_description": "su YouTube",
      "friend_text": "Se hai bisogno di assistenza per misurare questi valori per il calcolatore, guarda il video sopra di Paul Hickey di HRE IRL. Dove copre l'intero processo di misurazione sulla Classic Mini.",
      "close_button": "Chiudi"
    },
    "form_labels": {
      "piston_size": "Dimensione pistone",
      "crankshaft": "Albero motore",
      "head_gasket": "Guarnizione testata",
      "custom_gasket_size": "Dimensione guarnizione personalizzata (cc)",
      "decompression_plate": "Piastra di decompressione",
      "piston_dish_size": "Dimensione concavità pistone (cc)",
      "cylinder_head_chamber_volume": "Volume camera testata (cc)",
      "piston_deck_height": "Altezza pistone (millesimi)"
    },
    "results": {
      "title": "Risultati:",
      "compression_ratio": "Rapporto di compressione",
      "engine_capacity": "Cilindrata motore"
    },
    "disclaimer": {
      "text": "Si prega di notare che le cifre sopra sono {strong_start}valori approssimativi{strong_end}. Prima di acquistare parti e costruire il vostro motore raccomandiamo di {strong_start}ricontrollare{strong_end} i vostri calcoli più volte utilizzando più di una fonte.",
      "alternate_source": "Fonte alternativa:",
      "calver_link": "Rapporto di compressione Calver",
      "je_pistons_link": "Rapporto di compressione JE Pistons"
    },
    "youtube_player_title": "Lettore video YouTube",
    "math": {
      "bore_radius": "Raggio dell'alesaggio",
      "deck_height": "Altezza del piano in centimetri",
      "deck_volume": "Volume del piano",
      "ringland": "Volume della zona fasce",
      "gasket_volume": "Volume della guarnizione della testata",
      "gasket_selected_formula": "la guarnizione che hai selezionato",
      "gasket_custom_formula": "il volume di guarnizione personalizzato che hai inserito",
      "chamber_volume": "Volume totale della camera di combustione",
      "swept_volume": "Cilindrata di un cilindro",
      "ratio": "Rapporto di compressione",
      "capacity": "Cilindrata del motore",
      "note_thou": "L'altezza del piano si inserisce in millesimi di pollice; un millesimo è 0,0254 cm.",
      "note_ringland": "Un valore fisso calibrato per pistoni Accralite da 18cc e 73,5 mm.",
      "note_two_decimals": "Arrotondato a due decimali, come fa il calcolatore.",
      "const_pi": "Pi greco",
      "const_thou": "Un millesimo di pollice",
      "const_cylinders": "Cilindri di un motore serie A"
    }
  },
  "ja": {
    "help_button": "これらの値はどのように測定しますか？",
    "help_modal": {
      "title": "チャンバーとデッキの測定方法",
      "friend_title": "私たちの友人Paul Hickey",
      "friend_description": "YouTube上で",
      "friend_text": "計算機用のこれらの値の測定にサポートが必要な場合は、HRE IRLのPaul Hickeyによる上記の動画をご覧ください。彼はClassic Miniでの全測定プロセスをカバーしています。",
      "close_button": "閉じる"
    },
    "form_labels": {
      "piston_size": "ピストンサイズ",
      "crankshaft": "クランクシャフト",
      "head_gasket": "ヘッドガスケット",
      "custom_gasket_size": "カスタムガスケットサイズ (cc)",
      "decompression_plate": "デコンプレッションプレート",
      "piston_dish_size": "ピストンディッシュサイズ (cc)",
      "cylinder_head_chamber_volume": "シリンダーヘッドチャンバー容積 (cc)",
      "piston_deck_height": "ピストンデッキハイト (thou)"
    },
    "results": {
      "title": "結果:",
      "compression_ratio": "圧縮比",
      "engine_capacity": "エンジン排気量"
    },
    "disclaimer": {
      "text": "上記の数値は{strong_start}概算値{strong_end}であることにご注意ください。パーツを購入してエンジンを構築する前に、複数のソースを使用して計算を{strong_start}再確認{strong_end}することをお勧めします。",
      "alternate_source": "代替ソース:",
      "calver_link": "Calver圧縮比",
      "je_pistons_link": "JEピストン圧縮比"
    },
    "youtube_player_title": "YouTube動画プレーヤー",
    "math": {
      "bore_radius": "ボア半径",
      "deck_height": "デッキハイト（センチメートル）",
      "deck_volume": "デッキ容積",
      "ringland": "リングランド容積",
      "gasket_volume": "ヘッドガスケット容積",
      "gasket_selected_formula": "選択したガスケット",
      "gasket_custom_formula": "入力したカスタムガスケット容積",
      "chamber_volume": "燃焼室の総容積",
      "swept_volume": "1気筒あたりの行程容積",
      "ratio": "圧縮比",
      "capacity": "排気量",
      "note_thou": "デッキハイトは1000分の1インチ単位で入力します。1thouは0.0254 cmです。",
      "note_ringland": "18cc Accralite 73.5 mm ピストンに合わせた固定値です。",
      "note_two_decimals": "計算機と同じく、小数点以下2桁に四捨五入しています。",
      "const_pi": "円周率",
      "const_thou": "1000分の1インチ",
      "const_cylinders": "Aシリーズエンジンの気筒数"
    }
  },
  "ko": {
    "help_button": "이 값들을 어떻게 측정하나요?",
    "help_modal": {
      "title": "연소실과 데크 측정하기",
      "friend_title": "우리 친구 Paul Hickey",
      "friend_description": "YouTube에서",
      "friend_text": "계산기에 필요한 이런 값들을 측정하는데 도움이 필요하다면, HRE IRL의 Paul Hickey가 만든 위 동영상을 확인해보세요. 그는 Classic Mini의 전체 측정 과정을 다룹니다.",
      "close_button": "닫기"
    },
    "form_labels": {
      "piston_size": "피스톤 크기",
      "crankshaft": "크랭크샤프트",
      "head_gasket": "헤드 가스켓",
      "custom_gasket_size": "사용자 정의 가스켓 크기 (cc)",
      "decompression_plate": "압축 저감 플레이트",
      "piston_dish_size": "피스톤 딤플 크기 (cc)",
      "cylinder_head_chamber_volume": "실린더 헤드 연소실 용적 (cc)",
      "piston_deck_height": "피스톤 데크 높이 (thou)"
    },
    "results": {
      "title": "결과:",
      "compression_ratio": "압축비",
      "engine_capacity": "엔진 배기량"
    },
    "disclaimer": {
      "text": "위 수치들은 {strong_start}근사값{strong_end}임을 알려드립니다. 부품을 구매하고 엔진을 제작하기 전에 여러 소스를 사용하여 계산을 {strong_start}여러 번 재확인{strong_end}할 것을 권장합니다.",
      "alternate_source": "대안 소스:",
      "calver_link": "Calver 압축비",
      "je_pistons_link": "JE Pistons 압축비"
    },
    "youtube_player_title": "YouTube 비디오 플레이어",
    "math": {
      "bore_radius": "보어 반지름",
      "deck_height": "데크 높이 (센티미터)",
      "deck_volume": "데크 체적",
      "ringland": "링랜드 체적",
      "gasket_volume": "헤드 개스킷 체적",
      "gasket_selected_formula": "선택하신 개스킷",
      "gasket_custom_formula": "직접 입력하신 개스킷 체적",
      "chamber_volume": "연소실 총 체적",
      "swept_volume": "실린더 1개의 행정 체적",
      "ratio": "압축비",
      "capacity": "엔진 배기량",
      "note_thou": "데크 높이는 1000분의 1인치 단위로 입력합니다. 1 thou는 0.0254 cm입니다.",
      "note_ringland": "18cc Accralite 73.5 mm 피스톤에 맞춰 보정된 고정값입니다.",
      "note_two_decimals": "계산기와 동일하게 소수점 둘째 자리까지 반올림합니다.",
      "const_pi": "원주율",
      "const_thou": "1000분의 1인치",
      "const_cylinders": "A 시리즈 엔진의 실린더 수"
    }
  },
  "pt": {
    "help_button": "Como meço esses valores?",
    "help_modal": {
      "title": "Medindo suas câmaras e altura do pistão",
      "friend_title": "Nosso Amigo Paul Hickey",
      "friend_description": "no Youtube",
      "friend_text": "Se precisar de assistência para medir esses valores para a calculadora, confira o vídeo acima do Paul Hickey no HRE IRL. Onde ele cobre todo o processo de medição no Classic Mini.",
      "close_button": "Fechar"
    },
    "form_labels": {
      "piston_size": "Tamanho do Pistão",
      "crankshaft": "Virabrequim",
      "head_gasket": "Junta do Cabeçote",
      "custom_gasket_size": "Tamanho Personalizado da Junta (cc)",
      "decompression_plate": "Placa de Descompressão",
      "piston_dish_size": "Tamanho do Prato do Pistão (cc)",
      "cylinder_head_chamber_volume": "Volume da Câmara do Cabeçote (cc)",
      "piston_deck_height": "Altura do Pistão (milésimos)"
    },
    "results": {
      "title": "Resultados:",
      "compression_ratio": "Taxa de Compressão",
      "engine_capacity": "Capacidade do Motor"
    },
    "disclaimer": {
      "text": "Note que os valores acima são {strong_start}valores aproximados{strong_end}. Antes de comprar peças e construir seu motor, recomendamos {strong_start}verificar novamente{strong_end} seus cálculos múltiplas vezes usando mais de uma fonte.",
      "alternate_source": "Fonte Alternativa:",
      "calver_link": "Taxa de Compressão Calver",
      "je_pistons_link": "Taxa de Compressão JE Pistons"
    },
    "youtube_player_title": "Reprodutor de vídeo do YouTube",
    "math": {
      "bore_radius": "Raio do cilindro",
      "deck_height": "Altura do plano em centímetros",
      "deck_volume": "Volume do plano",
      "ringland": "Volume da zona dos anéis",
      "gasket_volume": "Volume da junta do cabeçote",
      "gasket_selected_formula": "a junta que você selecionou",
      "gasket_custom_formula": "o volume de junta personalizado que você inseriu",
      "chamber_volume": "Volume total da câmara de combustão",
      "swept_volume": "Volume deslocado de um cilindro",
      "ratio": "Taxa de compressão",
      "capacity": "Cilindrada do motor",
      "note_thou": "A altura do plano é inserida em milésimos de polegada; um milésimo é 0,0254 cm.",
      "note_ringland": "Um valor fixo calibrado para pistões Accralite de 18cc e 73,5 mm.",
      "note_two_decimals": "Arredondado para duas casas decimais, igual à calculadora.",
      "const_pi": "Pi",
      "const_thou": "Um milésimo de polegada",
      "const_cylinders": "Cilindros num motor série A"
    }
  },
  "ru": {
    "help_button": "Как измерить эти значения?",
    "help_modal": {
      "title": "Измерение камер сгорания и высоты поршня",
      "friend_title": "Наш друг Paul Hickey",
      "friend_description": "на YouTube",
      "friend_text": "Если вам нужна помощь с измерением этих значений для калькулятора, посмотрите видео выше от Paul Hickey на HRE IRL. Где он рассматривает весь процесс измерения на Classic Mini.",
      "close_button": "Закрыть"
    },
    "form_labels": {
      "piston_size": "Размер поршня",
      "crankshaft": "Коленчатый вал",
      "head_gasket": "Прокладка головки",
      "custom_gasket_size": "Размер пользовательской прокладки (куб. см)",
      "decompression_plate": "Декомпрессионная пластина",
      "piston_dish_size": "Размер выемки поршня (куб. см)",
      "cylinder_head_chamber_volume": "Объем камеры головки цилиндра (куб. см)",
      "piston_deck_height": "Высота поршня (тысячные)"
    },
    "results": {
      "title": "Результаты:",
      "compression_ratio": "Степень сжатия",
      "engine_capacity": "Объем двигателя"
    },
    "disclaimer": {
      "text": "Обратите внимание, что вышеуказанные цифры являются {strong_start}приблизительными значениями{strong_end}. Перед покупкой деталей и сборкой двигателя мы рекомендуем {strong_start}перепроверить{strong_end} ваши расчеты несколько раз, используя более одного источника.",
      "alternate_source": "Альтернативный источник:",
      "calver_link": "Calver степень сжатия",
      "je_pistons_link": "JE Pistons степень сжатия"
    },
    "youtube_player_title": "Видеоплеер YouTube",
    "math": {
      "bore_radius": "Радиус цилиндра",
      "deck_height": "Высота площадки в сантиметрах",
      "deck_volume": "Объём площадки",
      "ringland": "Объём поясов колец",
      "gasket_volume": "Объём прокладки головки блока",
      "gasket_selected_formula": "выбранная вами прокладка",
      "gasket_custom_formula": "введённый вами произвольный объём прокладки",
      "chamber_volume": "Полный объём камеры сгорания",
      "swept_volume": "Рабочий объём одного цилиндра",
      "ratio": "Степень сжатия",
      "capacity": "Рабочий объём двигателя",
      "note_thou": "Высота площадки вводится в тысячных дюйма; одна тысячная равна 0,0254 см.",
      "note_ringland": "Фиксированная поправка, откалиброванная для поршней Accralite 18cc 73,5 мм.",
      "note_two_decimals": "Округлено до двух знаков после запятой, как и в калькуляторе.",
      "const_pi": "Пи",
      "const_thou": "Одна тысячная дюйма",
      "const_cylinders": "Цилиндров в двигателе серии A"
    }
  },
  "zh": {
    "help_button": "如何测量这些数值？",
    "help_modal": {
      "title": "测量燃烧室和活塞平台",
      "friend_title": "我们的朋友Paul Hickey",
      "friend_description": "在YouTube上",
      "friend_text": "如果您需要帮助测量计算器的这些数值，请观看Paul Hickey在HRE IRL制作的上方视频。他详细介绍了Classic Mini的整个测量过程。",
      "close_button": "关闭"
    },
    "form_labels": {
      "piston_size": "活塞尺寸",
      "crankshaft": "曲轴",
      "head_gasket": "缸垫",
      "custom_gasket_size": "自定义缸垫尺寸 (cc)",
      "decompression_plate": "减压板",
      "piston_dish_size": "活塞凹面尺寸 (cc)",
      "cylinder_head_chamber_volume": "缸盖燃烧室容积 (cc)",
      "piston_deck_height": "活塞平台高度 (thou)"
    },
    "results": {
      "title": "结果：",
      "compression_ratio": "压缩比",
      "engine_capacity": "发动机排量"
    },
    "disclaimer": {
      "text": "请注意上述数值为{strong_start}近似值{strong_end}。在购买零件和组装发动机之前，我们建议您{strong_start}反复核对{strong_end}计算结果并使用多个来源验证。",
      "alternate_source": "备选来源：",
      "calver_link": "Calver压缩比",
      "je_pistons_link": "JE活塞压缩比"
    },
    "youtube_player_title": "YouTube 视频播放器",
    "math": {
      "bore_radius": "缸径半径",
      "deck_height": "缸面高度（厘米）",
      "deck_volume": "缸面容积",
      "ringland": "环岸容积",
      "gasket_volume": "缸垫容积",
      "gasket_selected_formula": "您选择的缸垫",
      "gasket_custom_formula": "您输入的自定义缸垫容积",
      "chamber_volume": "燃烧室总容积",
      "swept_volume": "单缸工作容积",
      "ratio": "压缩比",
      "capacity": "发动机排量",
      "note_thou": "缸面高度以千分之一英寸输入；1丝等于0.0254厘米。",
      "note_ringland": "针对 18cc Accralite 73.5 毫米活塞标定的固定值。",
      "note_two_decimals": "与计算器一致，四舍五入保留两位小数。",
      "const_pi": "圆周率",
      "const_thou": "千分之一英寸",
      "const_cylinders": "A系列发动机的气缸数"
    }
  }
}
</i18n>
