<template>
  <div v-if="hasSpecifications" class="card bg-base-100 shadow-sm">
    <div class="card-body">
      <h2 class="card-title flex items-center gap-2">
        <i class="fas fa-screwdriver-wrench"></i>
        {{ t('title') }}
      </h2>

      <!-- Engine & Mechanical -->
      <div v-if="hasEngineSpecs" class="mt-4">
        <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <i class="fas fa-gear"></i>
          {{ t('sections.engine') }}
        </h3>
        <div class="grid md:grid-cols-2 gap-4">
          <div v-if="listing.engine_number" class="space-y-1">
            <div class="text-sm text-base-content/70">{{ t('fields.engineNumber') }}</div>
            <div class="font-medium font-mono">{{ listing.engine_number }}</div>
          </div>

          <div v-if="listing.gearbox_type" class="space-y-1">
            <div class="text-sm text-base-content/70">{{ t('fields.gearbox') }}</div>
            <div class="font-medium">{{ formatGearboxType(listing.gearbox_type) }}</div>
          </div>

          <div v-if="listing.carb_type" class="space-y-1">
            <div class="text-sm text-base-content/70">{{ t('fields.carburetor') }}</div>
            <div class="font-medium">{{ formatCarbType(listing.carb_type) }}</div>
          </div>

          <div v-if="listing.exhaust_type" class="space-y-1">
            <div class="text-sm text-base-content/70">{{ t('fields.exhaust') }}</div>
            <div class="font-medium">{{ formatExhaustType(listing.exhaust_type) }}</div>
          </div>

          <div v-if="listing.brake_type" class="space-y-1">
            <div class="text-sm text-base-content/70">{{ t('fields.brakes') }}</div>
            <div class="font-medium">{{ formatBrakeType(listing.brake_type) }}</div>
          </div>
        </div>
      </div>

      <!-- Exterior & Body -->
      <div v-if="hasExteriorSpecs" class="mt-6">
        <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <i class="fas fa-paintbrush"></i>
          {{ t('sections.exterior') }}
        </h3>
        <div class="grid md:grid-cols-2 gap-4">
          <div v-if="listing.body_color" class="space-y-1">
            <div class="text-sm text-base-content/70">{{ t('fields.bodyColor') }}</div>
            <div class="font-medium">{{ listing.body_color }}</div>
          </div>

          <div v-if="listing.roof_color" class="space-y-1">
            <div class="text-sm text-base-content/70">{{ t('fields.roofColor') }}</div>
            <div class="font-medium">{{ listing.roof_color }}</div>
          </div>

          <div v-if="listing.has_stripes && listing.stripe_color" class="space-y-1">
            <div class="text-sm text-base-content/70">{{ t('fields.stripeColor') }}</div>
            <div class="font-medium">{{ listing.stripe_color }}</div>
          </div>

          <div v-else-if="listing.has_stripes" class="space-y-1">
            <div class="text-sm text-base-content/70">{{ t('fields.stripes') }}</div>
            <div class="font-medium">{{ t('yes') }}</div>
          </div>

          <div v-if="listing.wheel_size || listing.wheel_type" class="space-y-1">
            <div class="text-sm text-base-content/70">{{ t('fields.wheels') }}</div>
            <div class="font-medium">
              <span v-if="listing.wheel_size">{{ listing.wheel_size }}"</span>
              <span v-if="listing.wheel_size && listing.wheel_type"> - </span>
              <span v-if="listing.wheel_type">{{ formatWheelType(listing.wheel_type) }}</span>
            </div>
          </div>

          <div v-if="listing.bumper_type" class="space-y-1">
            <div class="text-sm text-base-content/70">{{ t('fields.bumpers') }}</div>
            <div class="font-medium">{{ formatBumperType(listing.bumper_type) }}</div>
          </div>

          <div v-if="listing.window_type" class="space-y-1">
            <div class="text-sm text-base-content/70">{{ t('fields.windows') }}</div>
            <div class="font-medium">{{ formatWindowType(listing.window_type) }}</div>
          </div>

          <div v-if="listing.has_sunroof !== null" class="space-y-1">
            <div class="text-sm text-base-content/70">{{ t('fields.sunroof') }}</div>
            <div class="font-medium">{{ listing.has_sunroof ? t('yes') : t('no') }}</div>
          </div>
        </div>
      </div>

      <!-- Interior -->
      <div v-if="hasInteriorSpecs" class="mt-6">
        <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <i class="fas fa-table-cells-large"></i>
          {{ t('sections.interior') }}
        </h3>
        <div class="grid md:grid-cols-2 gap-4">
          <div v-if="listing.seat_type" class="space-y-1">
            <div class="text-sm text-base-content/70">{{ t('fields.seats') }}</div>
            <div class="font-medium">{{ formatSeatType(listing.seat_type) }}</div>
          </div>

          <div v-if="listing.interior_color" class="space-y-1">
            <div class="text-sm text-base-content/70">{{ t('fields.interiorColor') }}</div>
            <div class="font-medium">{{ listing.interior_color }}</div>
          </div>

          <div v-if="listing.dashboard_type" class="space-y-1">
            <div class="text-sm text-base-content/70">{{ t('fields.dashboard') }}</div>
            <div class="font-medium">{{ formatDashboardType(listing.dashboard_type) }}</div>
          </div>

          <div v-if="listing.steering_wheel_type" class="space-y-1">
            <div class="text-sm text-base-content/70">{{ t('fields.steeringWheel') }}</div>
            <div class="font-medium">{{ formatSteeringWheelType(listing.steering_wheel_type) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { ListingWithPhotos } from '~/composables/useListings';
  import {
    GEARBOX_TYPES,
    CARB_TYPES,
    EXHAUST_TYPES,
    BRAKE_TYPES,
    WHEEL_TYPES,
    BUMPER_TYPES,
    WINDOW_TYPES,
    SEAT_TYPES,
    DASHBOARD_TYPES,
    STEERING_WHEEL_TYPES,
    getSpecLabel,
  } from '~/utils/miniSpecs';

  const { t } = useI18n();

  interface Props {
    listing: ListingWithPhotos;
  }

  const props = defineProps<Props>();

  // Check if listing has engine/mechanical specs
  const hasEngineSpecs = computed(() => {
    return !!(
      props.listing.engine_number ||
      props.listing.gearbox_type ||
      props.listing.carb_type ||
      props.listing.exhaust_type ||
      props.listing.brake_type
    );
  });

  // Check if listing has exterior specs
  const hasExteriorSpecs = computed(() => {
    return !!(
      props.listing.body_color ||
      props.listing.roof_color ||
      props.listing.has_stripes ||
      props.listing.stripe_color ||
      props.listing.wheel_size ||
      props.listing.wheel_type ||
      props.listing.bumper_type ||
      props.listing.window_type ||
      props.listing.has_sunroof !== null
    );
  });

  // Check if listing has interior specs
  const hasInteriorSpecs = computed(() => {
    return !!(
      props.listing.seat_type ||
      props.listing.interior_color ||
      props.listing.dashboard_type ||
      props.listing.steering_wheel_type
    );
  });

  // Check if listing has any specifications to display
  const hasSpecifications = computed(() => {
    return hasEngineSpecs.value || hasExteriorSpecs.value || hasInteriorSpecs.value;
  });

  // Format helper functions
  const formatGearboxType = (value: string) => getSpecLabel(GEARBOX_TYPES, value);
  const formatCarbType = (value: string) => getSpecLabel(CARB_TYPES, value);
  const formatExhaustType = (value: string) => getSpecLabel(EXHAUST_TYPES, value);
  const formatBrakeType = (value: string) => getSpecLabel(BRAKE_TYPES, value);
  const formatWheelType = (value: string) => getSpecLabel(WHEEL_TYPES, value);
  const formatBumperType = (value: string) => getSpecLabel(BUMPER_TYPES, value);
  const formatWindowType = (value: string) => getSpecLabel(WINDOW_TYPES, value);
  const formatSeatType = (value: string) => getSpecLabel(SEAT_TYPES, value);
  const formatDashboardType = (value: string) => getSpecLabel(DASHBOARD_TYPES, value);
  const formatSteeringWheelType = (value: string) => getSpecLabel(STEERING_WHEEL_TYPES, value);
</script>

<i18n lang="json">
{
  "en": {
    "title": "Specifications",
    "yes": "Yes",
    "no": "No",
    "sections": { "engine": "Engine & Mechanical", "exterior": "Exterior & Body", "interior": "Interior" },
    "fields": {
      "engineNumber": "Engine Number",
      "gearbox": "Gearbox",
      "carburetor": "Carburetor",
      "exhaust": "Exhaust",
      "brakes": "Brakes",
      "bodyColor": "Body Color",
      "roofColor": "Roof Color",
      "stripeColor": "Stripe Color",
      "stripes": "Stripes",
      "wheels": "Wheels",
      "bumpers": "Bumpers",
      "windows": "Windows",
      "sunroof": "Sunroof",
      "seats": "Seats",
      "interiorColor": "Interior Color",
      "dashboard": "Dashboard",
      "steeringWheel": "Steering Wheel"
    }
  },
  "es": {
    "title": "Especificaciones",
    "yes": "Sí",
    "no": "No",
    "sections": { "engine": "Motor y mecánica", "exterior": "Exterior y carrocería", "interior": "Interior" },
    "fields": {
      "engineNumber": "Número de motor",
      "gearbox": "Caja de cambios",
      "carburetor": "Carburador",
      "exhaust": "Escape",
      "brakes": "Frenos",
      "bodyColor": "Color de carrocería",
      "roofColor": "Color del techo",
      "stripeColor": "Color de las franjas",
      "stripes": "Franjas",
      "wheels": "Llantas",
      "bumpers": "Parachoques",
      "windows": "Ventanas",
      "sunroof": "Techo solar",
      "seats": "Asientos",
      "interiorColor": "Color interior",
      "dashboard": "Salpicadero",
      "steeringWheel": "Volante"
    }
  },
  "fr": {
    "title": "Spécifications",
    "yes": "Oui",
    "no": "Non",
    "sections": { "engine": "Moteur et mécanique", "exterior": "Extérieur et carrosserie", "interior": "Intérieur" },
    "fields": {
      "engineNumber": "Numéro de moteur",
      "gearbox": "Boîte de vitesses",
      "carburetor": "Carburateur",
      "exhaust": "Échappement",
      "brakes": "Freins",
      "bodyColor": "Couleur de carrosserie",
      "roofColor": "Couleur du toit",
      "stripeColor": "Couleur des bandes",
      "stripes": "Bandes",
      "wheels": "Roues",
      "bumpers": "Pare-chocs",
      "windows": "Vitres",
      "sunroof": "Toit ouvrant",
      "seats": "Sièges",
      "interiorColor": "Couleur intérieure",
      "dashboard": "Tableau de bord",
      "steeringWheel": "Volant"
    }
  },
  "de": {
    "title": "Spezifikationen",
    "yes": "Ja",
    "no": "Nein",
    "sections": { "engine": "Motor & Mechanik", "exterior": "Außen & Karosserie", "interior": "Innenraum" },
    "fields": {
      "engineNumber": "Motornummer",
      "gearbox": "Getriebe",
      "carburetor": "Vergaser",
      "exhaust": "Auspuff",
      "brakes": "Bremsen",
      "bodyColor": "Karosseriefarbe",
      "roofColor": "Dachfarbe",
      "stripeColor": "Streifenfarbe",
      "stripes": "Streifen",
      "wheels": "Räder",
      "bumpers": "Stoßstangen",
      "windows": "Fenster",
      "sunroof": "Schiebedach",
      "seats": "Sitze",
      "interiorColor": "Innenraumfarbe",
      "dashboard": "Armaturenbrett",
      "steeringWheel": "Lenkrad"
    }
  },
  "it": {
    "title": "Specifiche",
    "yes": "Sì",
    "no": "No",
    "sections": { "engine": "Motore e meccanica", "exterior": "Esterno e carrozzeria", "interior": "Interni" },
    "fields": {
      "engineNumber": "Numero motore",
      "gearbox": "Cambio",
      "carburetor": "Carburatore",
      "exhaust": "Scarico",
      "brakes": "Freni",
      "bodyColor": "Colore carrozzeria",
      "roofColor": "Colore del tetto",
      "stripeColor": "Colore delle strisce",
      "stripes": "Strisce",
      "wheels": "Ruote",
      "bumpers": "Paraurti",
      "windows": "Finestrini",
      "sunroof": "Tetto apribile",
      "seats": "Sedili",
      "interiorColor": "Colore interni",
      "dashboard": "Cruscotto",
      "steeringWheel": "Volante"
    }
  },
  "pt": {
    "title": "Especificações",
    "yes": "Sim",
    "no": "Não",
    "sections": { "engine": "Motor e mecânica", "exterior": "Exterior e carroçaria", "interior": "Interior" },
    "fields": {
      "engineNumber": "Número do motor",
      "gearbox": "Caixa de velocidades",
      "carburetor": "Carburador",
      "exhaust": "Escape",
      "brakes": "Travões",
      "bodyColor": "Cor da carroçaria",
      "roofColor": "Cor do tejadilho",
      "stripeColor": "Cor das faixas",
      "stripes": "Faixas",
      "wheels": "Rodas",
      "bumpers": "Para-choques",
      "windows": "Janelas",
      "sunroof": "Teto de abrir",
      "seats": "Bancos",
      "interiorColor": "Cor do interior",
      "dashboard": "Painel de instrumentos",
      "steeringWheel": "Volante"
    }
  },
  "ru": {
    "title": "Характеристики",
    "yes": "Да",
    "no": "Нет",
    "sections": { "engine": "Двигатель и механика", "exterior": "Экстерьер и кузов", "interior": "Интерьер" },
    "fields": {
      "engineNumber": "Номер двигателя",
      "gearbox": "Коробка передач",
      "carburetor": "Карбюратор",
      "exhaust": "Выхлоп",
      "brakes": "Тормоза",
      "bodyColor": "Цвет кузова",
      "roofColor": "Цвет крыши",
      "stripeColor": "Цвет полос",
      "stripes": "Полосы",
      "wheels": "Колёса",
      "bumpers": "Бамперы",
      "windows": "Стёкла",
      "sunroof": "Люк",
      "seats": "Сиденья",
      "interiorColor": "Цвет салона",
      "dashboard": "Приборная панель",
      "steeringWheel": "Рулевое колесо"
    }
  },
  "ja": {
    "title": "仕様",
    "yes": "あり",
    "no": "なし",
    "sections": { "engine": "エンジンと機械", "exterior": "外装とボディ", "interior": "内装" },
    "fields": {
      "engineNumber": "エンジン番号",
      "gearbox": "ギアボックス",
      "carburetor": "キャブレター",
      "exhaust": "エキゾースト",
      "brakes": "ブレーキ",
      "bodyColor": "ボディカラー",
      "roofColor": "ルーフカラー",
      "stripeColor": "ストライプカラー",
      "stripes": "ストライプ",
      "wheels": "ホイール",
      "bumpers": "バンパー",
      "windows": "ウィンドウ",
      "sunroof": "サンルーフ",
      "seats": "シート",
      "interiorColor": "インテリアカラー",
      "dashboard": "ダッシュボード",
      "steeringWheel": "ステアリングホイール"
    }
  },
  "zh": {
    "title": "规格",
    "yes": "有",
    "no": "无",
    "sections": { "engine": "发动机与机械", "exterior": "外观与车身", "interior": "内饰" },
    "fields": {
      "engineNumber": "发动机编号",
      "gearbox": "变速箱",
      "carburetor": "化油器",
      "exhaust": "排气",
      "brakes": "刹车",
      "bodyColor": "车身颜色",
      "roofColor": "车顶颜色",
      "stripeColor": "条纹颜色",
      "stripes": "条纹",
      "wheels": "轮毂",
      "bumpers": "保险杠",
      "windows": "车窗",
      "sunroof": "天窗",
      "seats": "座椅",
      "interiorColor": "内饰颜色",
      "dashboard": "仪表台",
      "steeringWheel": "方向盘"
    }
  },
  "ko": {
    "title": "사양",
    "yes": "있음",
    "no": "없음",
    "sections": { "engine": "엔진 및 기계", "exterior": "외관 및 차체", "interior": "실내" },
    "fields": {
      "engineNumber": "엔진 번호",
      "gearbox": "변속기",
      "carburetor": "기화기",
      "exhaust": "배기",
      "brakes": "브레이크",
      "bodyColor": "차체 색상",
      "roofColor": "루프 색상",
      "stripeColor": "스트라이프 색상",
      "stripes": "스트라이프",
      "wheels": "휠",
      "bumpers": "범퍼",
      "windows": "창문",
      "sunroof": "선루프",
      "seats": "시트",
      "interiorColor": "실내 색상",
      "dashboard": "대시보드",
      "steeringWheel": "스티어링 휠"
    }
  }
}
</i18n>
