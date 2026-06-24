<script setup lang="ts">
  import { mmToInchFraction } from '../../../data/models/alignment';

  const props = defineProps<{
    frontCamber: number;
    frontCaster: number;
    frontToe: number; // mm total, negative = toe-out
    rearCamber: number;
    rearToe: number; // mm total, positive = toe-in
  }>();

  const { t } = useI18n();

  // Visual exaggeration factors — real alignment angles are tiny (<0.5° of toe), so the
  // diagram amplifies them for legibility while the numeric readouts show true values.
  const TOE_SCALE = 4; // deg shown per mm of total toe
  const CAMBER_SCALE = 6; // deg shown per deg of camber
  const CASTER_SCALE = 3.2; // deg shown per deg of caster

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  // Top-down wheel rotations. Left wheel rotates by value*scale; right is its mirror.
  // Negative toe (toe-out) splays the leading (front) edges outward; positive (toe-in) draws them in.
  const flRot = computed(() => clamp(props.frontToe * TOE_SCALE, -20, 20));
  const frRot = computed(() => -flRot.value);
  const rlRot = computed(() => clamp(props.rearToe * TOE_SCALE, -20, 20));
  const rrRot = computed(() => -rlRot.value);

  // Elevation camber rotations (about the contact patch). Negative camber leans the top inward.
  const fCamber = computed(() => clamp(props.frontCamber * CAMBER_SCALE, -24, 24));
  const fCamberLeft = computed(() => -fCamber.value);
  const fCamberRight = computed(() => fCamber.value);
  const rCamber = computed(() => clamp(props.rearCamber * CAMBER_SCALE, -24, 24));
  const rCamberLeft = computed(() => -rCamber.value);
  const rCamberRight = computed(() => rCamber.value);

  // Caster: side view, front to the left. Positive caster tilts the steering axis top rearward.
  const casterRot = computed(() => clamp(props.frontCaster * CASTER_SCALE, 0, 30));

  // ---- Readout labels ----
  const fmtDeg = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}°`;

  const toeLabel = (mm: number) => {
    if (Math.abs(mm) < 0.05) return t('parallel');
    const dir = mm < 0 ? t('out') : t('in');
    return `${mmToInchFraction(mm)} ${dir}`;
  };

  const frontToeLabel = computed(() => toeLabel(props.frontToe));
  const rearToeLabel = computed(() => toeLabel(props.rearToe));
</script>

<template>
  <div class="align-diagram">
    <!-- Top-down plan view: toe -->
    <figure class="align-diagram__panel align-diagram__topdown">
      <svg viewBox="0 0 360 540" role="img" :aria-label="t('aria.topdown')">
        <!-- centerline -->
        <line x1="180" y1="44" x2="180" y2="500" class="ad-centerline" />
        <!-- body silhouette -->
        <rect x="112" y="86" width="136" height="392" rx="46" class="ad-body" />
        <rect x="130" y="150" width="100" height="150" rx="22" class="ad-cabin" />
        <!-- front axle line -->
        <line x1="84" y1="172" x2="276" y2="172" class="ad-axle" />
        <line x1="84" y1="404" x2="276" y2="404" class="ad-axle" />

        <!-- front-left wheel -->
        <g class="ad-wheel-top" :style="{ transform: `rotate(${flRot}deg)` }" style="transform-origin: 96px 172px">
          <rect x="84" y="143" width="24" height="58" rx="6" class="ad-tyre" />
          <rect x="84" y="143" width="24" height="5" rx="2.5" class="ad-lead" />
        </g>
        <!-- front-right wheel -->
        <g class="ad-wheel-top" :style="{ transform: `rotate(${frRot}deg)` }" style="transform-origin: 264px 172px">
          <rect x="252" y="143" width="24" height="58" rx="6" class="ad-tyre" />
          <rect x="252" y="143" width="24" height="5" rx="2.5" class="ad-lead" />
        </g>
        <!-- rear-left wheel -->
        <g class="ad-wheel-top" :style="{ transform: `rotate(${rlRot}deg)` }" style="transform-origin: 96px 404px">
          <rect x="84" y="375" width="24" height="58" rx="6" class="ad-tyre" />
          <rect x="84" y="375" width="24" height="5" rx="2.5" class="ad-lead" />
        </g>
        <!-- rear-right wheel -->
        <g class="ad-wheel-top" :style="{ transform: `rotate(${rrRot}deg)` }" style="transform-origin: 264px 404px">
          <rect x="252" y="375" width="24" height="58" rx="6" class="ad-tyre" />
          <rect x="252" y="375" width="24" height="5" rx="2.5" class="ad-lead" />
        </g>

        <!-- labels -->
        <text x="180" y="34" class="ad-end-label">{{ t('front') }}</text>
        <text x="180" y="524" class="ad-end-label">{{ t('rear') }}</text>
      </svg>
      <figcaption class="align-diagram__cap">
        <span class="ad-chip">{{ t('front') }} {{ t('toe') }}: {{ frontToeLabel }}</span>
        <span class="ad-chip">{{ t('rear') }} {{ t('toe') }}: {{ rearToeLabel }}</span>
      </figcaption>
    </figure>

    <!-- Elevation / side insets -->
    <div class="align-diagram__insets">
      <!-- front camber -->
      <figure class="align-diagram__panel">
        <svg viewBox="0 0 200 132" role="img" :aria-label="t('aria.frontCamber')">
          <line x1="16" y1="112" x2="184" y2="112" class="ad-ground" />
          <g class="ad-wheel-elev" :style="{ transform: `rotate(${fCamberLeft}deg)` }" style="transform-origin: 67px 112px">
            <rect x="60" y="44" width="14" height="68" rx="4" class="ad-tyre" />
          </g>
          <g class="ad-wheel-elev" :style="{ transform: `rotate(${fCamberRight}deg)` }" style="transform-origin: 133px 112px">
            <rect x="126" y="44" width="14" height="68" rx="4" class="ad-tyre" />
          </g>
        </svg>
        <figcaption class="align-diagram__cap align-diagram__cap--single">
          <span class="ad-cap-title">{{ t('front') }} {{ t('camber') }}</span>
          <span class="ad-cap-val">{{ fmtDeg(props.frontCamber) }}</span>
        </figcaption>
      </figure>

      <!-- rear camber -->
      <figure class="align-diagram__panel">
        <svg viewBox="0 0 200 132" role="img" :aria-label="t('aria.rearCamber')">
          <line x1="16" y1="112" x2="184" y2="112" class="ad-ground" />
          <g class="ad-wheel-elev" :style="{ transform: `rotate(${rCamberLeft}deg)` }" style="transform-origin: 67px 112px">
            <rect x="60" y="44" width="14" height="68" rx="4" class="ad-tyre" />
          </g>
          <g class="ad-wheel-elev" :style="{ transform: `rotate(${rCamberRight}deg)` }" style="transform-origin: 133px 112px">
            <rect x="126" y="44" width="14" height="68" rx="4" class="ad-tyre" />
          </g>
        </svg>
        <figcaption class="align-diagram__cap align-diagram__cap--single">
          <span class="ad-cap-title">{{ t('rear') }} {{ t('camber') }}</span>
          <span class="ad-cap-val">{{ fmtDeg(props.rearCamber) }}</span>
        </figcaption>
      </figure>

      <!-- caster (side view) -->
      <figure class="align-diagram__panel">
        <svg viewBox="0 0 200 132" role="img" :aria-label="t('aria.caster')">
          <line x1="16" y1="112" x2="184" y2="112" class="ad-ground" />
          <circle cx="100" cy="76" r="36" class="ad-wheel-side" />
          <g class="ad-caster-axis" :style="{ transform: `rotate(${casterRot}deg)` }" style="transform-origin: 100px 112px">
            <line x1="100" y1="30" x2="100" y2="112" class="ad-axis" />
          </g>
          <text x="24" y="128" class="ad-side-hint">← {{ t('front') }}</text>
        </svg>
        <figcaption class="align-diagram__cap align-diagram__cap--single">
          <span class="ad-cap-title">{{ t('caster') }}</span>
          <span class="ad-cap-val">{{ fmtDeg(props.frontCaster) }}</span>
        </figcaption>
      </figure>
    </div>
  </div>
</template>

<style scoped>
  .align-diagram {
    display: grid;
    grid-template-columns: minmax(200px, 280px) 1fr;
    gap: 1.5rem;
    align-items: start;
  }
  @media (max-width: 768px) {
    .align-diagram {
      grid-template-columns: 1fr;
    }
  }

  .align-diagram__panel {
    margin: 0;
    background: var(--bg-2, #f3f3f3);
    border: 1px solid var(--border-1, rgba(0, 0, 0, 0.08));
    border-radius: 0.75rem;
    padding: 0.75rem;
  }
  .align-diagram__topdown svg {
    width: 100%;
    height: auto;
    max-height: 460px;
  }
  .align-diagram__insets {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
  }
  @media (max-width: 520px) {
    .align-diagram__insets {
      grid-template-columns: 1fr;
    }
  }
  .align-diagram__insets svg {
    width: 100%;
    height: auto;
  }

  .align-diagram__cap {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    justify-content: center;
    margin-top: 0.5rem;
  }
  .align-diagram__cap--single {
    flex-direction: column;
    gap: 0.1rem;
    text-align: center;
  }
  .ad-cap-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--fg-3, #76767c);
    font-weight: 600;
  }
  .ad-cap-val {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--fg-1, #1c1c20);
  }
  .ad-chip {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--fg-2, #4a4a4f);
    background: var(--bg-1, #fff);
    border: 1px solid var(--border-1, rgba(0, 0, 0, 0.08));
    border-radius: 999px;
    padding: 0.18rem 0.55rem;
  }

  /* SVG primitives */
  .ad-centerline {
    stroke: var(--border-2, rgba(0, 0, 0, 0.14));
    stroke-width: 1.5;
    stroke-dasharray: 4 6;
  }
  .ad-body {
    fill: var(--bg-1, #fff);
    stroke: var(--border-2, rgba(0, 0, 0, 0.14));
    stroke-width: 2;
  }
  .ad-cabin {
    fill: color-mix(in srgb, var(--cm-primary, #859369) 12%, transparent);
    stroke: var(--border-1, rgba(0, 0, 0, 0.08));
    stroke-width: 1.5;
  }
  .ad-axle,
  .ad-ground {
    stroke: var(--border-2, rgba(0, 0, 0, 0.14));
    stroke-width: 2;
  }
  .ad-ground {
    stroke-dasharray: 3 4;
  }
  .ad-tyre {
    fill: var(--fg-2, #4a4a4f);
  }
  .ad-lead {
    fill: var(--cm-secondary, #ed7135);
  }
  .ad-wheel-side {
    fill: none;
    stroke: var(--fg-2, #4a4a4f);
    stroke-width: 4;
  }
  .ad-axis {
    stroke: var(--cm-secondary, #ed7135);
    stroke-width: 3;
    stroke-linecap: round;
  }
  .ad-end-label,
  .ad-side-hint {
    fill: var(--fg-3, #76767c);
    font-size: 13px;
    font-weight: 700;
    text-anchor: middle;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .ad-side-hint {
    text-anchor: start;
    font-size: 11px;
  }

  /* Animated rotations */
  .ad-wheel-top,
  .ad-wheel-elev,
  .ad-caster-axis {
    /* Resolve transform-origin against the SVG viewBox so the px origins below are
       in user-space coordinates (the wheel's own centre / contact patch). With
       fill-box they'd be relative to each element's tiny bbox and the pivot would
       fly off toward the car centre, making wheels slide across when toe changes. */
    transform-box: view-box;
    transition: transform var(--t-base, 200ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
  }
  @media (prefers-reduced-motion: reduce) {
    .ad-wheel-top,
    .ad-wheel-elev,
    .ad-caster-axis {
      transition: none;
    }
  }
</style>

<i18n lang="json">
{
  "en": {
    "front": "Front",
    "rear": "Rear",
    "toe": "toe",
    "camber": "camber",
    "caster": "caster",
    "in": "in",
    "out": "out",
    "parallel": "parallel",
    "aria": {
      "topdown": "Top-down view of the car showing front and rear wheel toe",
      "frontCamber": "Front view showing front wheel camber",
      "rearCamber": "Rear view showing rear wheel camber",
      "caster": "Side view showing front wheel caster angle"
    }
  },
  "es": {
    "front": "Delantero",
    "rear": "Trasero",
    "toe": "convergencia",
    "camber": "caída",
    "caster": "avance",
    "in": "positiva",
    "out": "negativa",
    "parallel": "paralelo",
    "aria": {
      "topdown": "Vista cenital del coche que muestra la convergencia de las ruedas delanteras y traseras",
      "frontCamber": "Vista frontal que muestra la caída de las ruedas delanteras",
      "rearCamber": "Vista trasera que muestra la caída de las ruedas traseras",
      "caster": "Vista lateral que muestra el ángulo de avance de la rueda delantera"
    }
  },
  "fr": {
    "front": "Avant",
    "rear": "Arrière",
    "toe": "parallélisme",
    "camber": "carrossage",
    "caster": "chasse",
    "in": "vers l'intérieur",
    "out": "vers l'extérieur",
    "parallel": "parallèle",
    "aria": {
      "topdown": "Vue de dessus de la voiture montrant le parallélisme des roues avant et arrière",
      "frontCamber": "Vue de face montrant le carrossage des roues avant",
      "rearCamber": "Vue arrière montrant le carrossage des roues arrière",
      "caster": "Vue de côté montrant l'angle de chasse des roues avant"
    }
  },
  "de": {
    "front": "Vorne",
    "rear": "Hinten",
    "toe": "Spur",
    "camber": "Sturz",
    "caster": "Nachlauf",
    "in": "innen",
    "out": "außen",
    "parallel": "parallel",
    "aria": {
      "topdown": "Draufsicht des Fahrzeugs mit der Spur der Vorder- und Hinterräder",
      "frontCamber": "Frontansicht mit dem Sturz der Vorderräder",
      "rearCamber": "Heckansicht mit dem Sturz der Hinterräder",
      "caster": "Seitenansicht mit dem Nachlaufwinkel der Vorderräder"
    }
  },
  "it": {
    "front": "Anteriore",
    "rear": "Posteriore",
    "toe": "convergenza",
    "camber": "campanatura",
    "caster": "incidenza",
    "in": "in",
    "out": "out",
    "parallel": "parallelo",
    "aria": {
      "topdown": "Vista dall'alto dell'auto che mostra la convergenza delle ruote anteriori e posteriori",
      "frontCamber": "Vista anteriore che mostra la campanatura delle ruote anteriori",
      "rearCamber": "Vista posteriore che mostra la campanatura delle ruote posteriori",
      "caster": "Vista laterale che mostra l'angolo di incidenza delle ruote anteriori"
    }
  },
  "pt": {
    "front": "Dianteiro",
    "rear": "Traseiro",
    "toe": "convergência",
    "camber": "cambagem",
    "caster": "cáster",
    "in": "para dentro",
    "out": "para fora",
    "parallel": "paralelo",
    "aria": {
      "topdown": "Vista de cima do carro mostrando a convergência das rodas dianteiras e traseiras",
      "frontCamber": "Vista frontal mostrando a cambagem das rodas dianteiras",
      "rearCamber": "Vista traseira mostrando a cambagem das rodas traseiras",
      "caster": "Vista lateral mostrando o ângulo de cáster da roda dianteira"
    }
  },
  "ru": {
    "front": "Перед",
    "rear": "Зад",
    "toe": "схождение",
    "camber": "развал",
    "caster": "кастер",
    "in": "внутрь",
    "out": "наружу",
    "parallel": "параллельно",
    "aria": {
      "topdown": "Вид сверху на автомобиль, показывающий схождение передних и задних колёс",
      "frontCamber": "Вид спереди, показывающий развал передних колёс",
      "rearCamber": "Вид сзади, показывающий развал задних колёс",
      "caster": "Вид сбоку, показывающий угол кастера передних колёс"
    }
  },
  "ja": {
    "front": "フロント",
    "rear": "リア",
    "toe": "トー",
    "camber": "キャンバー",
    "caster": "キャスター",
    "in": "イン",
    "out": "アウト",
    "parallel": "平行",
    "aria": {
      "topdown": "フロントとリアのホイールのトーを示す車両の上面図",
      "frontCamber": "フロントホイールのキャンバーを示す正面図",
      "rearCamber": "リアホイールのキャンバーを示す後面図",
      "caster": "フロントホイールのキャスター角を示す側面図"
    }
  },
  "zh": {
    "front": "前轮",
    "rear": "后轮",
    "toe": "前束",
    "camber": "外倾角",
    "caster": "主销后倾角",
    "in": "内束",
    "out": "外束",
    "parallel": "平行",
    "aria": {
      "topdown": "车辆俯视图，显示前后车轮的前束",
      "frontCamber": "前视图，显示前轮外倾角",
      "rearCamber": "后视图，显示后轮外倾角",
      "caster": "侧视图，显示前轮主销后倾角"
    }
  },
  "ko": {
    "front": "앞",
    "rear": "뒤",
    "toe": "토",
    "camber": "캠버",
    "caster": "캐스터",
    "in": "인",
    "out": "아웃",
    "parallel": "평행",
    "aria": {
      "topdown": "앞바퀴와 뒷바퀴의 토를 보여주는 차량 평면도(위에서 본 모습)",
      "frontCamber": "앞바퀴 캠버를 보여주는 정면도",
      "rearCamber": "뒷바퀴 캠버를 보여주는 후면도",
      "caster": "앞바퀴 캐스터 각도를 보여주는 측면도"
    }
  }
}
</i18n>
