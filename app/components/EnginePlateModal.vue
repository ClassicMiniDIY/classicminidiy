<script setup lang="ts">
  const { t } = useI18n();

  const isOpen = ref(false);
  const currentSlide = ref(0);
  const dialogEl = ref<HTMLDialogElement | null>(null);

  const slides = computed(() => [
    {
      src: 'https://classicminidiy.s3.us-east-1.amazonaws.com/engine-decoder/example1.jpg',
      alt: t('image_alts.example1'),
    },
    {
      src: 'https://classicminidiy.s3.us-east-1.amazonaws.com/engine-decoder/example2.jpg',
      alt: t('image_alts.example2'),
    },
    {
      src: 'https://classicminidiy.s3.us-east-1.amazonaws.com/engine-decoder/example3.jpg',
      alt: t('image_alts.example3'),
    },
  ]);

  const openModal = () => {
    isOpen.value = true;
    currentSlide.value = 0;
  };

  const nextSlide = () => {
    currentSlide.value = (currentSlide.value + 1) % slides.value.length;
  };

  const prevSlide = () => {
    currentSlide.value = (currentSlide.value - 1 + slides.value.length) % slides.value.length;
  };

  watch(isOpen, (open) => {
    if (!dialogEl.value) return;
    if (open && !dialogEl.value.open) {
      dialogEl.value.showModal();
    } else if (!open && dialogEl.value.open) {
      dialogEl.value.close();
    }
  });
</script>

<template>
  <div>
    <p class="font-bold pt-4 pb-2">{{ t('question_text') }}</p>
    <button type="button" class="btn btn-primary" @click="openModal">
      <i class="fas fa-clipboard-question mr-2"></i>
      {{ t('button_text') }}
    </button>

    <!-- Modal -->
    <dialog ref="dialogEl" class="modal" @close="isOpen = false">
      <div class="modal-box max-w-4xl">
        <h3 class="font-bold text-lg mb-4">{{ t('modal_title') }}</h3>

        <!-- Carousel -->
        <div class="relative w-full mb-4">
          <div class="relative w-full h-64 md:h-96 overflow-hidden rounded-lg">
            <img
              v-for="(slide, index) in slides"
              :key="index"
              :src="slide.src"
              :alt="slide.alt"
              class="w-full h-full object-cover absolute inset-0 transition-opacity duration-300"
              :class="currentSlide === index ? 'opacity-100' : 'opacity-0'"
            />
          </div>

          <!-- Navigation Buttons -->
          <button
            type="button"
            class="btn btn-sm btn-neutral btn-square absolute left-2 top-1/2 -translate-y-1/2"
            @click="prevSlide"
          >
            ❮
          </button>
          <button
            type="button"
            class="btn btn-sm btn-neutral btn-square absolute right-2 top-1/2 -translate-y-1/2"
            @click="nextSlide"
          >
            ❯
          </button>

          <!-- Indicators -->
          <div class="flex justify-center mt-2 gap-2">
            <button
              v-for="(_, index) in slides"
              :key="index"
              @click="currentSlide = index"
              class="w-3 h-3 rounded-full transition-colors"
              :class="currentSlide === index ? 'bg-primary' : 'bg-base-300'"
              :aria-label="t('slide_aria_label', { number: index + 1 })"
            ></button>
          </div>
        </div>

        <h4 class="text-lg font-semibold py-4">{{ t('location_title') }}</h4>
        <p class="mb-4">
          {{ t('location_description') }}
        </p>
        <ul class="list-disc pl-5 space-y-2 mb-4">
          <li>{{ t('missing_reasons.replaced') }}</li>
          <li>{{ t('missing_reasons.removed') }}</li>
          <li>{{ t('missing_reasons.corroded') }}</li>
        </ul>

        <div class="modal-action">
          <button type="button" class="btn btn-outline" @click="isOpen = false">{{ t('close_button') }}</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "question_text": "Unsure what your engine plate looks like?",
    "button_text": "Where is my engine plate?",
    "modal_title": "Engine Plates",
    "slide_aria_label": "Go to slide {number}",
    "location_title": "Location of Engine Plate",
    "location_description": "Engine plates were found in the same place across all model year minis. However these plates are missing in some situations:",
    "missing_reasons": {
      "replaced": "If the engine has been replaced",
      "removed": "If the plate was removed during a rebuild",
      "corroded": "If the plate has corroded or fallen off over time"
    },
    "close_button": "Close",
    "image_alts": {
      "example1": "Engine plate example 1",
      "example2": "Engine plate example 2",
      "example3": "Engine plate example 3"
    }
  },
  "de": {
    "question_text": "Unsicher, wie Ihr Motorschild aussieht?",
    "button_text": "Wo ist mein Motorschild?",
    "modal_title": "Motorschilder",
    "slide_aria_label": "Gehe zu Folie {number}",
    "location_title": "Standort des Motorschilds",
    "location_description": "Motorschilder befanden sich bei allen Modelljahren der Minis an derselben Stelle. Diese Schilder fehlen jedoch in manchen Situationen:",
    "missing_reasons": {
      "replaced": "Wenn der Motor ausgetauscht wurde",
      "removed": "Wenn das Schild während einer Überholung entfernt wurde",
      "corroded": "Wenn das Schild im Laufe der Zeit korrodiert oder abgefallen ist"
    },
    "close_button": "Schließen",
    "image_alts": {
      "example1": "Motorschild Beispiel 1",
      "example2": "Motorschild Beispiel 2",
      "example3": "Motorschild Beispiel 3"
    }
  },
  "es": {
    "question_text": "¿No estás seguro de cómo se ve tu placa del motor?",
    "button_text": "¿Dónde está mi placa del motor?",
    "modal_title": "Placas del Motor",
    "slide_aria_label": "Ir a la diapositiva {number}",
    "location_title": "Ubicación de la Placa del Motor",
    "location_description": "Las placas del motor se encontraban en el mismo lugar en todos los años de modelos mini. Sin embargo, estas placas faltan en algunas situaciones:",
    "missing_reasons": {
      "replaced": "Si el motor ha sido reemplazado",
      "removed": "Si la placa fue removida durante una reconstrucción",
      "corroded": "Si la placa se ha corroído o caído con el tiempo"
    },
    "close_button": "Cerrar",
    "image_alts": {
      "example1": "Ejemplo de placa del motor 1",
      "example2": "Ejemplo de placa del motor 2",
      "example3": "Ejemplo de placa del motor 3"
    }
  },
  "fr": {
    "question_text": "Vous n'êtes pas sûr de ce à quoi ressemble votre plaque moteur ?",
    "button_text": "Où est ma plaque moteur ?",
    "modal_title": "Plaques moteur",
    "slide_aria_label": "Aller à la diapositive {number}",
    "location_title": "Emplacement de la plaque moteur",
    "location_description": "Les plaques moteur se trouvaient au même endroit sur toutes les années de modèles mini. Cependant ces plaques sont manquantes dans certaines situations :",
    "missing_reasons": {
      "replaced": "Si le moteur a été remplacé",
      "removed": "Si la plaque a été enlevée lors d'une reconstruction",
      "corroded": "Si la plaque s'est corrodée ou est tombée avec le temps"
    },
    "close_button": "Fermer",
    "image_alts": {
      "example1": "Exemple de plaque moteur 1",
      "example2": "Exemple de plaque moteur 2",
      "example3": "Exemple de plaque moteur 3"
    }
  },
  "it": {
    "question_text": "Non sei sicuro di come sia la tua targhetta motore?",
    "button_text": "Dove si trova la mia targhetta motore?",
    "modal_title": "Targhette motore",
    "slide_aria_label": "Vai alla diapositiva {number}",
    "location_title": "Posizione della targhetta motore",
    "location_description": "Le targhette motore si trovavano nello stesso posto su tutti gli anni di modello delle Mini. Tuttavia queste targhette mancano in alcune situazioni:",
    "missing_reasons": {
      "replaced": "Se il motore è stato sostituito",
      "removed": "Se la targhetta è stata rimossa durante una ricostruzione",
      "corroded": "Se la targhetta si è corrosa o è caduta nel tempo"
    },
    "close_button": "Chiudi",
    "image_alts": {
      "example1": "Esempio targhetta motore 1",
      "example2": "Esempio targhetta motore 2",
      "example3": "Esempio targhetta motore 3"
    }
  },
  "pt": {
    "question_text": "Não tem certeza de como é sua placa do motor?",
    "button_text": "Onde está minha placa do motor?",
    "modal_title": "Placas do Motor",
    "slide_aria_label": "Ir para slide {number}",
    "location_title": "Localização da Placa do Motor",
    "location_description": "As placas do motor foram encontradas no mesmo local em todos os anos de modelo dos minis. No entanto, essas placas estão faltando em algumas situações:",
    "missing_reasons": {
      "replaced": "Se o motor foi substituído",
      "removed": "Se a placa foi removida durante uma reconstrução",
      "corroded": "Se a placa corroeu ou caiu com o tempo"
    },
    "close_button": "Fechar",
    "image_alts": {
      "example1": "Exemplo de placa do motor 1",
      "example2": "Exemplo de placa do motor 2",
      "example3": "Exemplo de placa do motor 3"
    }
  },
  "ru": {
    "question_text": "Не уверены, как выглядит ваша табличка двигателя?",
    "button_text": "Где моя табличка двигателя?",
    "modal_title": "Таблички двигателей",
    "slide_aria_label": "Перейти к слайду {number}",
    "location_title": "Расположение таблички двигателя",
    "location_description": "Таблички двигателей находились в одном и том же месте на всех годах выпуска мини. Однако эти таблички отсутствуют в некоторых ситуациях:",
    "missing_reasons": {
      "replaced": "Если двигатель был заменен",
      "removed": "Если табличка была удалена во время ремонта",
      "corroded": "Если табличка проржавела или отпала со временем"
    },
    "close_button": "Закрыть",
    "image_alts": {
      "example1": "Пример таблички двигателя 1",
      "example2": "Пример таблички двигателя 2",
      "example3": "Пример таблички двигателя 3"
    }
  },
  "ja": {
    "question_text": "エンジンプレートがどのようなものかわからない場合は？",
    "button_text": "私のエンジンプレートはどこにありますか？",
    "modal_title": "エンジンプレート",
    "slide_aria_label": "スライド{number}に移動",
    "location_title": "エンジンプレートの位置",
    "location_description": "エンジンプレートは、すべての年式のミニで同じ場所にありました。ただし、次の状況でこれらのプレートが欠落している場合があります：",
    "missing_reasons": {
      "replaced": "エンジンが交換された場合",
      "removed": "リビルド中にプレートが取り外された場合",
      "corroded": "時間の経過とともにプレートが腐食または脱落した場合"
    },
    "close_button": "閉じる",
    "image_alts": {
      "example1": "エンジンプレートの例1",
      "example2": "エンジンプレートの例2",
      "example3": "エンジンプレートの例3"
    }
  },
  "zh": {
    "question_text": "不确定您的发动机铭牌是什么样子？",
    "button_text": "我的发动机铭牌在哪里？",
    "modal_title": "发动机铭牌",
    "slide_aria_label": "转到第{number}张幻灯片",
    "location_title": "发动机铭牌位置",
    "location_description": "发动机铭牌在所有型号年份的Mini中位置相同。但在某些情况下这些铭牌会丢失：",
    "missing_reasons": {
      "replaced": "如果发动机已被更换",
      "removed": "如果在大修过程中拆除了铭牌",
      "corroded": "如果铭牌随时间腐蚀或脱落"
    },
    "close_button": "关闭",
    "image_alts": {
      "example1": "发动机铭牌示例1",
      "example2": "发动机铭牌示例2",
      "example3": "发动机铭牌示例3"
    }
  },
  "ko": {
    "question_text": "엔진 플레이트가 어떻게 생겼는지 확실하지 않으신가요?",
    "button_text": "엔진 플레이트는 어디에 있나요?",
    "modal_title": "엔진 플레이트",
    "slide_aria_label": "슬라이드 {number}로 이동",
    "location_title": "엔진 플레이트 위치",
    "location_description": "엔진 플레이트는 모든 모델 연도 미니에서 같은 위치에 있었습니다. 하지만 다음과 같은 상황에서는 이 플레이트가 없을 수 있습니다:",
    "missing_reasons": {
      "replaced": "엔진이 교체된 경우",
      "removed": "재빌드 중에 플레이트가 제거된 경우",
      "corroded": "시간이 지나면서 플레이트가 부식되거나 떨어진 경우"
    },
    "close_button": "닫기",
    "image_alts": {
      "example1": "엔진 플레이트 예시 1",
      "example2": "엔진 플레이트 예시 2",
      "example3": "엔진 플레이트 예시 3"
    }
  }
}
</i18n>

<style scoped>
  /* Add any custom styles here if needed */
  .carousel-item {
    transition: opacity 0.3s ease-in-out;
  }
</style>
