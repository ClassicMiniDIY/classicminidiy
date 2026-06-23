<template>
  <div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <!-- Vehicle Option -->
      <button
        type="button"
        class="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer border-2"
        :class="modelValue === 'vehicle' ? 'border-primary' : 'border-transparent'"
        @click="selectCategory('vehicle')"
      >
        <div class="card-body items-center text-center py-8">
          <i class="fas fa-truck text-6xl text-primary mb-4"></i>
          <h3 class="card-title">{{ t('vehicle.title') }}</h3>
          <p class="text-base-content/70 text-sm">{{ t('vehicle.desc') }}</p>
        </div>
      </button>

      <!-- Engine Option -->
      <button
        type="button"
        class="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer border-2"
        :class="modelValue === 'engine' ? 'border-primary' : 'border-transparent'"
        @click="selectCategory('engine')"
      >
        <div class="card-body items-center text-center py-8">
          <i class="fas fa-gear text-6xl text-primary mb-4"></i>
          <h3 class="card-title">{{ t('engine.title') }}</h3>
          <p class="text-base-content/70 text-sm">{{ t('engine.desc') }}</p>
        </div>
      </button>

      <!-- Parts Option -->
      <button
        type="button"
        class="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer border-2"
        :class="modelValue === 'parts' ? 'border-primary' : 'border-transparent'"
        @click="selectCategory('parts')"
      >
        <div class="card-body items-center text-center py-8">
          <i class="fas fa-screwdriver-wrench text-6xl text-primary mb-4"></i>
          <h3 class="card-title">{{ t('parts.title') }}</h3>
          <p class="text-base-content/70 text-sm">{{ t('parts.desc') }}</p>
        </div>
      </button>
    </div>

    <!-- Parts Subcategory (shown when parts selected) -->
    <div v-if="modelValue === 'parts'" class="mb-8">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">{{ t('subcategory.legend') }}</legend>
        <select v-model="subcategoryModel" class="select select-bordered w-full">
          <option value="">{{ t('subcategory.placeholder') }}</option>
          <option value="body_exterior">{{ t('subcategory.body_exterior') }}</option>
          <option value="engine_internals">{{ t('subcategory.engine_internals') }}</option>
          <option value="electrical">{{ t('subcategory.electrical') }}</option>
          <option value="suspension">{{ t('subcategory.suspension') }}</option>
          <option value="interior">{{ t('subcategory.interior') }}</option>
          <option value="wheels_tires">{{ t('subcategory.wheels_tires') }}</option>
          <option value="other">{{ t('subcategory.other') }}</option>
        </select>
        <p class="text-sm text-base-content/60 mt-2">{{ t('subcategory.help') }}</p>
      </fieldset>
    </div>

    <!-- Bulk Upload Callout -->
    <div class="alert alert-soft mb-6">
      <i class="fas fa-square-plus"></i>
      <div>
        <span class="font-medium">{{ t('bulk.prompt') }}</span>
        <span class="text-sm ml-1">{{ t('bulk.saveTime') }}</span>
        <NuxtLink to="/exchange/listings/bulk" class="link link-primary text-sm ml-1">{{ t('bulk.link') }}</NuxtLink>
      </div>
    </div>

    <!-- Next Button -->
    <div class="flex justify-end">
      <button type="button" class="btn btn-primary" :disabled="!canProceed" @click="$emit('next')">
        {{ t('continue') }}
        <i class="fas fa-arrow-right"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  type Category = 'vehicle' | 'engine' | 'parts' | '';

  const props = defineProps<{
    modelValue: Category;
    subcategory: string;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: Category];
    'update:subcategory': [value: string];
    next: [];
  }>();

  const { capture } = usePostHog();

  const subcategoryModel = computed({
    get: () => props.subcategory,
    set: (value) => {
      emit('update:subcategory', value);
      // Track subcategory selection for parts
      if (props.modelValue === 'parts' && value) {
        capture('category_selected', {
          category: 'parts',
          subcategory: value,
        });
      }
    },
  });

  const selectCategory = (category: Category) => {
    emit('update:modelValue', category);
    if (category !== 'parts') {
      emit('update:subcategory', '');
      // Track category selection (non-parts categories don't have subcategory)
      if (category) {
        capture('category_selected', {
          category: category as 'vehicle' | 'engine' | 'parts',
        });
      }
    }
  };

  const canProceed = computed(() => {
    if (!props.modelValue) return false;
    if (props.modelValue === 'parts' && !props.subcategory) return false;
    return true;
  });
</script>

<i18n lang="json">
{
  "en": {
    "vehicle": { "title": "Complete Vehicle", "desc": "Sell a complete Classic Mini Cooper (1959-2000)" },
    "engine": { "title": "Engine", "desc": "Sell a Classic Mini engine or engine assembly" },
    "parts": { "title": "Parts", "desc": "Sell Classic Mini parts, accessories, or memorabilia" },
    "subcategory": {
      "legend": "Parts Category",
      "placeholder": "Select a category...",
      "body_exterior": "Body Panels & Trim",
      "engine_internals": "Engine & Drivetrain Parts",
      "electrical": "Electrical & Lighting",
      "suspension": "Suspension & Brakes",
      "interior": "Interior & Upholstery",
      "wheels_tires": "Wheels & Tires",
      "other": "Accessories & Other",
      "help": "We welcome all parts and accessories useful to Mini owners, not just original or first-party Mini parts. Tuning tools, gauges, aftermarket upgrades, and other items commonly used on Classic Minis are all fair game."
    },
    "bulk": { "prompt": "Have multiple parts to list?", "saveTime": "Save time with our", "link": "bulk uploader" },
    "continue": "Continue"
  },
  "es": {
    "vehicle": { "title": "Vehículo completo", "desc": "Vende un Classic Mini Cooper completo (1959-2000)" },
    "engine": { "title": "Motor", "desc": "Vende un motor o conjunto de motor de Classic Mini" },
    "parts": { "title": "Piezas", "desc": "Vende piezas, accesorios o coleccionables de Classic Mini" },
    "subcategory": {
      "legend": "Categoría de piezas",
      "placeholder": "Selecciona una categoría...",
      "body_exterior": "Carrocería y molduras",
      "engine_internals": "Piezas de motor y transmisión",
      "electrical": "Eléctrico e iluminación",
      "suspension": "Suspensión y frenos",
      "interior": "Interior y tapicería",
      "wheels_tires": "Ruedas y neumáticos",
      "other": "Accesorios y otros",
      "help": "Aceptamos todas las piezas y accesorios útiles para los propietarios de Mini, no solo piezas originales o de primera mano. Herramientas de ajuste, relojes, mejoras de posventa y otros artículos de uso común en los Classic Mini son bienvenidos."
    },
    "bulk": { "prompt": "¿Tienes varias piezas que publicar?", "saveTime": "Ahorra tiempo con nuestro", "link": "cargador masivo" },
    "continue": "Continuar"
  },
  "fr": {
    "vehicle": { "title": "Véhicule complet", "desc": "Vendez une Classic Mini Cooper complète (1959-2000)" },
    "engine": { "title": "Moteur", "desc": "Vendez un moteur ou un ensemble moteur de Classic Mini" },
    "parts": { "title": "Pièces", "desc": "Vendez des pièces, accessoires ou objets de collection Classic Mini" },
    "subcategory": {
      "legend": "Catégorie de pièces",
      "placeholder": "Sélectionnez une catégorie...",
      "body_exterior": "Carrosserie et garnitures",
      "engine_internals": "Pièces moteur et transmission",
      "electrical": "Électricité et éclairage",
      "suspension": "Suspension et freins",
      "interior": "Intérieur et sellerie",
      "wheels_tires": "Roues et pneus",
      "other": "Accessoires et autres",
      "help": "Nous acceptons toutes les pièces et accessoires utiles aux propriétaires de Mini, pas seulement les pièces d'origine ou de première monte. Les outils de réglage, les jauges, les améliorations du marché secondaire et autres articles couramment utilisés sur les Classic Mini sont les bienvenus."
    },
    "bulk": { "prompt": "Plusieurs pièces à publier ?", "saveTime": "Gagnez du temps avec notre", "link": "outil de téléversement en masse" },
    "continue": "Continuer"
  },
  "de": {
    "vehicle": { "title": "Komplettes Fahrzeug", "desc": "Verkaufe einen kompletten Classic Mini Cooper (1959-2000)" },
    "engine": { "title": "Motor", "desc": "Verkaufe einen Classic-Mini-Motor oder eine Motorbaugruppe" },
    "parts": { "title": "Teile", "desc": "Verkaufe Classic-Mini-Teile, Zubehör oder Sammlerstücke" },
    "subcategory": {
      "legend": "Teilekategorie",
      "placeholder": "Kategorie auswählen...",
      "body_exterior": "Karosserie und Zierteile",
      "engine_internals": "Motor- und Antriebsteile",
      "electrical": "Elektrik und Beleuchtung",
      "suspension": "Fahrwerk und Bremsen",
      "interior": "Innenraum und Polster",
      "wheels_tires": "Räder und Reifen",
      "other": "Zubehör und Sonstiges",
      "help": "Wir akzeptieren alle Teile und Zubehörteile, die für Mini-Besitzer nützlich sind, nicht nur originale oder Erstausrüsterteile. Tuning-Werkzeuge, Anzeigen, Nachrüst-Upgrades und andere bei Classic Minis übliche Artikel sind willkommen."
    },
    "bulk": { "prompt": "Mehrere Teile einzustellen?", "saveTime": "Spare Zeit mit unserem", "link": "Massen-Uploader" },
    "continue": "Weiter"
  },
  "it": {
    "vehicle": { "title": "Veicolo completo", "desc": "Vendi una Classic Mini Cooper completa (1959-2000)" },
    "engine": { "title": "Motore", "desc": "Vendi un motore o un gruppo motore Classic Mini" },
    "parts": { "title": "Ricambi", "desc": "Vendi ricambi, accessori o oggetti da collezione Classic Mini" },
    "subcategory": {
      "legend": "Categoria ricambi",
      "placeholder": "Seleziona una categoria...",
      "body_exterior": "Carrozzeria e finiture",
      "engine_internals": "Ricambi motore e trasmissione",
      "electrical": "Impianto elettrico e illuminazione",
      "suspension": "Sospensioni e freni",
      "interior": "Interni e tappezzeria",
      "wheels_tires": "Ruote e pneumatici",
      "other": "Accessori e altro",
      "help": "Accettiamo tutti i ricambi e gli accessori utili ai proprietari di Mini, non solo i ricambi originali o di primo impianto. Strumenti di messa a punto, indicatori, upgrade aftermarket e altri articoli comunemente usati sulle Classic Mini sono i benvenuti."
    },
    "bulk": { "prompt": "Hai più ricambi da pubblicare?", "saveTime": "Risparmia tempo con il nostro", "link": "caricatore in blocco" },
    "continue": "Continua"
  },
  "pt": {
    "vehicle": { "title": "Veículo completo", "desc": "Venda um Classic Mini Cooper completo (1959-2000)" },
    "engine": { "title": "Motor", "desc": "Venda um motor ou conjunto de motor do Classic Mini" },
    "parts": { "title": "Peças", "desc": "Venda peças, acessórios ou itens de coleção do Classic Mini" },
    "subcategory": {
      "legend": "Categoria de peças",
      "placeholder": "Selecione uma categoria...",
      "body_exterior": "Carroceria e acabamentos",
      "engine_internals": "Peças de motor e transmissão",
      "electrical": "Elétrica e iluminação",
      "suspension": "Suspensão e freios",
      "interior": "Interior e estofamento",
      "wheels_tires": "Rodas e pneus",
      "other": "Acessórios e outros",
      "help": "Aceitamos todas as peças e acessórios úteis para proprietários de Mini, não apenas peças originais ou de primeira linha. Ferramentas de ajuste, medidores, upgrades de pós-venda e outros itens comumente usados em Classic Minis são bem-vindos."
    },
    "bulk": { "prompt": "Tem várias peças para anunciar?", "saveTime": "Economize tempo com nosso", "link": "carregador em massa" },
    "continue": "Continuar"
  },
  "ru": {
    "vehicle": { "title": "Готовый автомобиль", "desc": "Продайте готовый Classic Mini Cooper (1959-2000)" },
    "engine": { "title": "Двигатель", "desc": "Продайте двигатель Classic Mini или агрегат в сборе" },
    "parts": { "title": "Запчасти", "desc": "Продайте запчасти, аксессуары или памятные вещи Classic Mini" },
    "subcategory": {
      "legend": "Категория запчастей",
      "placeholder": "Выберите категорию...",
      "body_exterior": "Кузовные панели и отделка",
      "engine_internals": "Детали двигателя и трансмиссии",
      "electrical": "Электрика и освещение",
      "suspension": "Подвеска и тормоза",
      "interior": "Интерьер и обивка",
      "wheels_tires": "Колёса и шины",
      "other": "Аксессуары и прочее",
      "help": "Мы принимаем все запчасти и аксессуары, полезные владельцам Mini, а не только оригинальные или фирменные детали. Инструменты для настройки, приборы, тюнинговые улучшения и другие предметы, обычно используемые на Classic Mini, тоже подходят."
    },
    "bulk": { "prompt": "Нужно разместить несколько запчастей?", "saveTime": "Сэкономьте время с нашим", "link": "массовым загрузчиком" },
    "continue": "Продолжить"
  },
  "ja": {
    "vehicle": { "title": "完成車両", "desc": "完成したクラシック・ミニ・クーパー（1959〜2000年）を販売" },
    "engine": { "title": "エンジン", "desc": "クラシック・ミニのエンジンまたはエンジンアッセンブリを販売" },
    "parts": { "title": "パーツ", "desc": "クラシック・ミニのパーツ、アクセサリー、記念品を販売" },
    "subcategory": {
      "legend": "パーツカテゴリ",
      "placeholder": "カテゴリを選択...",
      "body_exterior": "ボディパネルとトリム",
      "engine_internals": "エンジン・駆動系パーツ",
      "electrical": "電装・ライト",
      "suspension": "サスペンション・ブレーキ",
      "interior": "インテリア・内張り",
      "wheels_tires": "ホイール・タイヤ",
      "other": "アクセサリー・その他",
      "help": "純正部品や正規部品だけでなく、ミニオーナーに役立つあらゆるパーツやアクセサリーを歓迎します。チューニング工具、ゲージ、アフターマーケットのアップグレードなど、クラシック・ミニでよく使われる品もすべて対象です。"
    },
    "bulk": { "prompt": "出品するパーツが複数ありますか？", "saveTime": "時間を節約できる", "link": "一括アップローダー" },
    "continue": "続ける"
  },
  "zh": {
    "vehicle": { "title": "整车", "desc": "出售一辆完整的经典 Mini Cooper（1959-2000）" },
    "engine": { "title": "发动机", "desc": "出售经典 Mini 发动机或发动机总成" },
    "parts": { "title": "配件", "desc": "出售经典 Mini 配件、附件或纪念品" },
    "subcategory": {
      "legend": "配件类别",
      "placeholder": "选择一个类别...",
      "body_exterior": "车身板件与饰条",
      "engine_internals": "发动机与传动配件",
      "electrical": "电气与照明",
      "suspension": "悬挂与制动",
      "interior": "内饰与软包",
      "wheels_tires": "轮毂与轮胎",
      "other": "附件与其他",
      "help": "我们欢迎所有对 Mini 车主有用的配件和附件，而不仅限于原厂或正厂配件。调校工具、仪表、改装升级件以及其他经典 Mini 常用物品都可以发布。"
    },
    "bulk": { "prompt": "有多个配件要刊登？", "saveTime": "使用我们的工具节省时间", "link": "批量上传工具" },
    "continue": "继续"
  },
  "ko": {
    "vehicle": { "title": "완성 차량", "desc": "완성된 클래식 미니 쿠퍼(1959-2000) 판매" },
    "engine": { "title": "엔진", "desc": "클래식 미니 엔진 또는 엔진 어셈블리 판매" },
    "parts": { "title": "부품", "desc": "클래식 미니 부품, 액세서리 또는 기념품 판매" },
    "subcategory": {
      "legend": "부품 카테고리",
      "placeholder": "카테고리 선택...",
      "body_exterior": "보디 패널 및 트림",
      "engine_internals": "엔진 및 구동계 부품",
      "electrical": "전기 및 조명",
      "suspension": "서스펜션 및 브레이크",
      "interior": "인테리어 및 시트",
      "wheels_tires": "휠 및 타이어",
      "other": "액세서리 및 기타",
      "help": "정품이나 1차 부품뿐 아니라 미니 소유자에게 유용한 모든 부품과 액세서리를 환영합니다. 튜닝 공구, 게이지, 애프터마켓 업그레이드 등 클래식 미니에 흔히 쓰이는 품목도 모두 가능합니다."
    },
    "bulk": { "prompt": "등록할 부품이 여러 개인가요?", "saveTime": "다음 도구로 시간을 절약하세요", "link": "대량 업로더" },
    "continue": "계속"
  }
}
</i18n>
