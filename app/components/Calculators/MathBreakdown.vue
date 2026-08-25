<script setup lang="ts">
  import type { MathStep, MathConstant } from '../../types/mathBreakdown';

  const props = defineProps<{
    /** Calculator slug, used only for the analytics event. */
    calculator: string;
    steps: MathStep[];
    constants?: MathConstant[];
    /** Permalink to the file that implements these equations. */
    sourceUrl: string;
    /** Repo-relative path shown to the reader, e.g. app/utils/gearingCalculations.ts */
    sourceFile: string;
  }>();

  const { t } = useI18n();
  const { track } = useAnalytics();

  const open = ref(false);

  function toggle() {
    open.value = !open.value;
    if (open.value) {
      track('calculator_math_opened', { calculator: props.calculator });
    }
  }
</script>

<template>
  <div class="card bg-base-100 shadow-md border border-base-300">
    <div class="card-body">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-4 text-left"
        :aria-expanded="open"
        aria-controls="math-breakdown-panel"
        @click="toggle"
      >
        <span>
          <span class="font-semibold text-lg flex items-center">
            <i class="fad fa-square-root-variable mr-2"></i>
            {{ t('title') }}
          </span>
          <span class="block text-sm opacity-70 mt-1">{{ t('intro') }}</span>
        </span>
        <i class="fas fa-chevron-down shrink-0 transition-transform" :class="open ? 'rotate-180' : ''"></i>
      </button>

      <div v-show="open" id="math-breakdown-panel" class="mt-4">
        <ol class="space-y-4">
          <li v-for="(step, index) in steps" :key="index" class="rounded-lg border border-base-300 bg-base-200 p-4">
            <div class="flex items-baseline gap-3">
              <span class="badge badge-neutral badge-sm shrink-0">{{ index + 1 }}</span>
              <h4 class="font-semibold">{{ step.label }}</h4>
            </div>

            <dl class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-12">
              <dt class="text-xs uppercase tracking-wide opacity-60 sm:col-span-3">{{ t('formula') }}</dt>
              <dd class="font-mono text-sm break-words sm:col-span-9">{{ step.formula }}</dd>

              <dt class="text-xs uppercase tracking-wide opacity-60 sm:col-span-3">{{ t('with_values') }}</dt>
              <dd class="font-mono text-sm break-words sm:col-span-9">{{ step.substitution }}</dd>

              <dt class="text-xs uppercase tracking-wide opacity-60 sm:col-span-3">{{ t('result') }}</dt>
              <dd class="font-mono text-sm font-bold break-words sm:col-span-9">{{ step.result }}</dd>
            </dl>

            <p v-if="step.note" class="mt-2 text-xs opacity-70">
              <i class="fas fa-circle-info mr-1"></i>{{ step.note }}
            </p>
          </li>
        </ol>

        <div v-if="constants && constants.length" class="mt-6">
          <h4 class="font-semibold text-sm uppercase tracking-wide opacity-70">{{ t('constants') }}</h4>
          <div class="overflow-x-auto mt-2">
            <table class="table table-sm w-full">
              <tbody>
                <tr v-for="constant in constants" :key="constant.label">
                  <td>{{ constant.label }}</td>
                  <td class="font-mono">{{ constant.value }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="mt-6 border-t border-base-300 pt-4">
          <p class="text-sm">
            {{ t('source_intro') }}
            <a :href="sourceUrl" target="_blank" rel="noopener noreferrer" class="link link-primary break-all">
              <i class="fab fa-github mr-1"></i>{{ sourceFile }}
            </a>
          </p>
          <p class="text-sm mt-2 opacity-70">{{ t('report') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Show the math",
    "intro": "Every result above is derived from the steps below, using the values you entered. Check them by hand or read the source.",
    "formula": "Formula",
    "with_values": "With your values",
    "result": "Result",
    "constants": "Constants used",
    "source_intro": "These equations are implemented in:",
    "report": "Found a mistake? Open an issue on the repository and it will be corrected."
  },
  "es": {
    "title": "Ver los cálculos",
    "intro": "Cada resultado anterior se deriva de los pasos siguientes, usando los valores que introdujiste. Compruébalos a mano o lee el código fuente.",
    "formula": "Fórmula",
    "with_values": "Con tus valores",
    "result": "Resultado",
    "constants": "Constantes utilizadas",
    "source_intro": "Estas ecuaciones están implementadas en:",
    "report": "¿Encontraste un error? Abre una incidencia en el repositorio y se corregirá."
  },
  "fr": {
    "title": "Voir les calculs",
    "intro": "Chaque résultat ci-dessus découle des étapes ci-dessous, à partir des valeurs que vous avez saisies. Vérifiez-les à la main ou lisez le code source.",
    "formula": "Formule",
    "with_values": "Avec vos valeurs",
    "result": "Résultat",
    "constants": "Constantes utilisées",
    "source_intro": "Ces équations sont implémentées dans :",
    "report": "Vous avez trouvé une erreur ? Ouvrez un ticket sur le dépôt et elle sera corrigée."
  },
  "de": {
    "title": "Rechenweg anzeigen",
    "intro": "Jedes Ergebnis oben ergibt sich aus den folgenden Schritten mit den von Ihnen eingegebenen Werten. Prüfen Sie sie von Hand oder lesen Sie den Quellcode.",
    "formula": "Formel",
    "with_values": "Mit Ihren Werten",
    "result": "Ergebnis",
    "constants": "Verwendete Konstanten",
    "source_intro": "Diese Gleichungen sind implementiert in:",
    "report": "Einen Fehler gefunden? Melden Sie ihn im Repository, dann wird er korrigiert."
  },
  "it": {
    "title": "Mostra i calcoli",
    "intro": "Ogni risultato qui sopra deriva dai passaggi seguenti, usando i valori che hai inserito. Verificali a mano o leggi il codice sorgente.",
    "formula": "Formula",
    "with_values": "Con i tuoi valori",
    "result": "Risultato",
    "constants": "Costanti utilizzate",
    "source_intro": "Queste equazioni sono implementate in:",
    "report": "Hai trovato un errore? Apri una segnalazione nel repository e verrà corretto."
  },
  "pt": {
    "title": "Ver os cálculos",
    "intro": "Cada resultado acima vem dos passos abaixo, usando os valores que você inseriu. Confira-os à mão ou leia o código-fonte.",
    "formula": "Fórmula",
    "with_values": "Com os seus valores",
    "result": "Resultado",
    "constants": "Constantes utilizadas",
    "source_intro": "Estas equações estão implementadas em:",
    "report": "Encontrou um erro? Abra uma issue no repositório e ele será corrigido."
  },
  "ru": {
    "title": "Показать расчёт",
    "intro": "Каждый результат выше получен из шагов ниже на основе введённых вами значений. Проверьте их вручную или изучите исходный код.",
    "formula": "Формула",
    "with_values": "С вашими значениями",
    "result": "Результат",
    "constants": "Используемые константы",
    "source_intro": "Эти уравнения реализованы в:",
    "report": "Нашли ошибку? Создайте issue в репозитории, и она будет исправлена."
  },
  "ja": {
    "title": "計算過程を表示",
    "intro": "上記の結果はすべて、入力された値を用いて以下の手順から求めています。手計算で検証するか、ソースコードをご確認ください。",
    "formula": "計算式",
    "with_values": "入力値を代入",
    "result": "結果",
    "constants": "使用する定数",
    "source_intro": "これらの計算式の実装場所:",
    "report": "誤りを見つけた場合はリポジトリで issue を作成してください。修正します。"
  },
  "zh": {
    "title": "显示计算过程",
    "intro": "上面的每个结果都由下列步骤根据您输入的数值得出。您可以手动核对，或查阅源代码。",
    "formula": "公式",
    "with_values": "代入您的数值",
    "result": "结果",
    "constants": "所用常数",
    "source_intro": "这些公式的实现位置：",
    "report": "发现错误？请在代码仓库提交 issue，我们会修正。"
  },
  "ko": {
    "title": "계산 과정 보기",
    "intro": "위의 모든 결과는 입력하신 값을 사용해 아래 단계에서 도출됩니다. 직접 계산해 확인하거나 소스 코드를 읽어보세요.",
    "formula": "공식",
    "with_values": "입력값 대입",
    "result": "결과",
    "constants": "사용된 상수",
    "source_intro": "이 수식이 구현된 위치:",
    "report": "오류를 발견하셨나요? 저장소에 이슈를 등록해 주시면 수정하겠습니다."
  }
}
</i18n>
