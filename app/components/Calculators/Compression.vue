<script setup lang="ts">
  const { t } = useI18n();

  import { formOptions } from '../../../data/models/compression';

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

  const ratio = computed(() => {
    const preRoundratio = (stroke.value * (boreRadius.value * boreRadius.value) * pi + vc.value) / vc.value;
    return Math.round((preRoundratio + Number.EPSILON) * 100) / 100;
  });

  const capacity = computed(() => {
    const preRoundcap = stroke.value * (boreRadius.value * boreRadius.value) * pi * 4;
    return Math.round((preRoundcap + Number.EPSILON) * 100) / 100;
  });

  const { capture } = usePostHog();
  let captureTimer: ReturnType<typeof setTimeout> | null = null;
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
</script>

<template>
  <div class="grid grid-cols-1 gap-6">
    <div class="col-span-1">
      <UButton color="primary" class="mb-5" @click="showHelpModal = true">
        <i class="fad fa-question-circle mr-2"></i>
        {{ t('help_button') }}
      </UButton>

      <!-- Help Modal -->
      <UModal v-model:open="showHelpModal">
        <template #content>
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold">{{ t('help_modal.title') }}</h2>
            </template>
            <div class="aspect-video w-full">
              <iframe
                class="w-full h-full"
                allowfullscreen
                src="https://www.youtube.com/embed/GxlgkbrfK2Y"
                title="YouTube video player"
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
            <template #footer>
              <div class="flex justify-end">
                <UButton color="primary" @click="showHelpModal = false">
                  {{ t('help_modal.close_button') }}
                </UButton>
              </div>
            </template>
          </UCard>
        </template>
      </UModal>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Piston Size Select -->
      <UFormField>
        <template #label>
          <span class="flex items-center gap-2">
            <i class="fad fa-engine"></i>
            {{ t('form_labels.piston_size') }}
          </span>
        </template>
        <USelect v-model="bore" :items="reactiveFormOptions.pistonOptions" value-key="value" class="w-full" />
      </UFormField>

      <!-- Crankshaft Select -->
      <UFormField>
        <template #label>
          <span class="flex items-center gap-2">
            <i class="fad fa-arrows-rotate fa-spin"></i>
            {{ t('form_labels.crankshaft') }}
          </span>
        </template>
        <USelect v-model="stroke" :items="reactiveFormOptions.crankshaftOptions" value-key="value" class="w-full" />
      </UFormField>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Head Gasket Select -->
      <div>
        <UFormField>
          <template #label>
            <span class="flex items-center gap-2">
              <i class="fad fa-head-side-gear"></i>
              {{ t('form_labels.head_gasket') }}
            </span>
          </template>
          <USelect
            v-model.number="gasket"
            :items="reactiveFormOptions.headGasketOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>
        <div v-if="gasket === 0" class="mt-2">
          <UFormField>
            <template #label>
              <span class="flex items-center gap-2">
                <i class="fad fa-ruler"></i>
                {{ t('form_labels.custom_gasket_size') }}
              </span>
            </template>
            <UInput type="number" min="0.1" max="10" step="0.1" v-model.number="customGasket" class="w-full" />
          </UFormField>
        </div>
      </div>

      <!-- Decompression Plate Select -->
      <UFormField>
        <template #label>
          <span class="flex items-center gap-2">
            <i class="fad fa-arrow-down-to-line"></i>
            {{ t('form_labels.decompression_plate') }}
          </span>
        </template>
        <USelect v-model="decomp" :items="reactiveFormOptions.decompPlateOptions" value-key="value" class="w-full" />
      </UFormField>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- Piston Dish Size -->
      <UFormField>
        <template #label>
          <span class="flex items-center gap-2">
            <i class="fad fa-circle-half fa-rotate-270"></i>
            {{ t('form_labels.piston_dish_size') }}
          </span>
        </template>
        <UInput v-model.number="pistonDish" type="number" min="0" max="20" step="0.1" class="w-full" />
      </UFormField>

      <!-- Cylinder Head Chamber Volume -->
      <UFormField>
        <template #label>
          <span class="flex items-center gap-2">
            <i class="fad fa-arrows-to-dot"></i>
            {{ t('form_labels.cylinder_head_chamber_volume') }}
          </span>
        </template>
        <UInput v-model.number="headVolume" type="number" min="15" max="35" step="0.1" class="w-full" />
      </UFormField>

      <!-- Piston Deck Height -->
      <UFormField>
        <template #label>
          <span class="flex items-center gap-2">
            <i class="fad fa-arrow-up-to-line"></i>
            {{ t('form_labels.piston_deck_height') }}
          </span>
        </template>
        <UInput v-model.number="deckHeight" type="number" min="0" max="80" step="1" class="w-full" />
      </UFormField>
    </div>

    <!-- Results Section -->
    <div class="mt-8">
      <h2 class="text-2xl font-bold mb-4">{{ t('results.title') }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
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

    <!-- Disclaimer -->
    <div class="text-center mt-4">
      <div class="max-w-3xl mx-auto">
        <p class="mb-2">
          <span v-html="t('disclaimer.text', { strong_start: '<strong>', strong_end: '</strong>' })"></span>
          <a
            href="https://github.com/SomethingNew71/classicminidiy/blob/master/components/CompressionCalculator.vue#L344"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary hover:underline"
          >
            {{ t('disclaimer.equation_source') }}
          </a>
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
      "text": "Please note the above figures are {strong_start}approximate values{strong_end}. Before purchasing parts and building your engine we recommend {strong_start}doublechecking{strong_end} your calculations multiple times using more than one source. The mathematical equations used in this tool can be found here:",
      "equation_source": "Equation Source Code",
      "alternate_source": "Alternate Source:",
      "calver_link": "Calver Compression Ratio",
      "je_pistons_link": "JE Pistons Compression Ratio"
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
      "text": "Ten en cuenta que las cifras anteriores son {strong_start}valores aproximados{strong_end}. Antes de comprar piezas y construir tu motor, recomendamos {strong_start}verificar{strong_end} tus cálculos múltiples veces usando más de una fuente. Las ecuaciones matemáticas usadas en esta herramienta se pueden encontrar aquí:",
      "equation_source": "Código Fuente de las Ecuaciones",
      "alternate_source": "Fuente Alternativa:",
      "calver_link": "Relación de Compresión Calver",
      "je_pistons_link": "Relación de Compresión JE Pistons"
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
      "text": "Veuillez noter que les chiffres ci-dessus sont des {strong_start}valeurs approximatives{strong_end}. Avant d'acheter des pièces et de construire votre moteur, nous recommandons de {strong_start}revérifier{strong_end} vos calculs plusieurs fois en utilisant plus d'une source. Les équations mathématiques utilisées dans cet outil peuvent être trouvées ici :",
      "equation_source": "Code source des équations",
      "alternate_source": "Source alternative :",
      "calver_link": "Taux de compression Calver",
      "je_pistons_link": "Taux de compression JE Pistons"
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
      "text": "Bitte beachten Sie, dass die obigen Zahlen {strong_start}Näherungswerte{strong_end} sind. Vor dem Kauf von Teilen und dem Bau Ihres Motors empfehlen wir Ihnen, Ihre Berechnungen {strong_start}mehrfach{strong_end} mit mehr als einer Quelle zu überprüfen. Die in diesem Tool verwendeten mathematischen Gleichungen finden Sie hier:",
      "equation_source": "Gleichungsquellcode",
      "alternate_source": "Alternative Quelle:",
      "calver_link": "Calver Verdichtungsverhältnis",
      "je_pistons_link": "JE Pistons Verdichtungsverhältnis"
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
      "text": "Si prega di notare che le cifre sopra sono {strong_start}valori approssimativi{strong_end}. Prima di acquistare parti e costruire il vostro motore raccomandiamo di {strong_start}ricontrollare{strong_end} i vostri calcoli più volte utilizzando più di una fonte. Le equazioni matematiche utilizzate in questo strumento possono essere trovate qui:",
      "equation_source": "Codice sorgente equazioni",
      "alternate_source": "Fonte alternativa:",
      "calver_link": "Rapporto di compressione Calver",
      "je_pistons_link": "Rapporto di compressione JE Pistons"
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
      "text": "上記の数値は{strong_start}概算値{strong_end}であることにご注意ください。パーツを購入してエンジンを構築する前に、複数のソースを使用して計算を{strong_start}再確認{strong_end}することをお勧めします。このツールで使用される数学的方程式は以下で確認できます:",
      "equation_source": "方程式ソースコード",
      "alternate_source": "代替ソース:",
      "calver_link": "Calver圧縮比",
      "je_pistons_link": "JEピストン圧縮比"
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
      "text": "위 수치들은 {strong_start}근사값{strong_end}임을 알려드립니다. 부품을 구매하고 엔진을 제작하기 전에 여러 소스를 사용하여 계산을 {strong_start}여러 번 재확인{strong_end}할 것을 권장합니다. 이 도구에 사용된 수학 공식은 여기에서 찾을 수 있습니다:",
      "equation_source": "공식 소스 코드",
      "alternate_source": "대안 소스:",
      "calver_link": "Calver 압축비",
      "je_pistons_link": "JE Pistons 압축비"
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
      "text": "Note que os valores acima são {strong_start}valores aproximados{strong_end}. Antes de comprar peças e construir seu motor, recomendamos {strong_start}verificar novamente{strong_end} seus cálculos múltiplas vezes usando mais de uma fonte. As equações matemáticas usadas nesta ferramenta podem ser encontradas aqui:",
      "equation_source": "Código Fonte da Equação",
      "alternate_source": "Fonte Alternativa:",
      "calver_link": "Taxa de Compressão Calver",
      "je_pistons_link": "Taxa de Compressão JE Pistons"
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
      "text": "Обратите внимание, что вышеуказанные цифры являются {strong_start}приблизительными значениями{strong_end}. Перед покупкой деталей и сборкой двигателя мы рекомендуем {strong_start}перепроверить{strong_end} ваши расчеты несколько раз, используя более одного источника. Математические уравнения, используемые в этом инструменте, можно найти здесь:",
      "equation_source": "Исходный код уравнений",
      "alternate_source": "Альтернативный источник:",
      "calver_link": "Calver степень сжатия",
      "je_pistons_link": "JE Pistons степень сжатия"
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
      "text": "请注意上述数值为{strong_start}近似值{strong_end}。在购买零件和组装发动机之前，我们建议您{strong_start}反复核对{strong_end}计算结果并使用多个来源验证。此工具使用的数学公式可在此处找到：",
      "equation_source": "公式源代码",
      "alternate_source": "备选来源：",
      "calver_link": "Calver压缩比",
      "je_pistons_link": "JE活塞压缩比"
    }
  }
}
</i18n>
