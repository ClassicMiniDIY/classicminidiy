<template>
  <div class="flex h-full flex-col items-center justify-center gap-8 py-8 text-center">
    <div class="space-y-3">
      <div
        class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl text-primary"
        aria-hidden="true"
      >
        <i class="fas fa-comments"></i>
      </div>
      <h2 class="text-2xl font-bold sm:text-3xl">{{ t('greeting') }}</h2>
      <p class="mx-auto max-w-xl text-sm leading-relaxed text-base-content/70 sm:text-base">
        {{ t('body') }}
      </p>
    </div>

    <!-- Conversation starters. These double as capability disclosure: each one
         points at a different tool the assistant can actually reach. -->
    <div class="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
      <button
        v-for="starter in starters"
        :key="starter.key"
        type="button"
        @click="emit('pick', starter.prompt)"
        class="group flex items-start gap-3 rounded-xl border border-base-300 bg-base-200/60 p-3 text-left transition-colors hover:border-primary/40 hover:bg-base-200"
      >
        <i
          :class="starter.icon"
          class="mt-0.5 w-4 shrink-0 text-center text-sm text-base-content/50 transition-colors group-hover:text-primary"
          aria-hidden="true"
        ></i>
        <span class="min-w-0 text-sm leading-snug">{{ starter.prompt }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  const emit = defineEmits<{ pick: [prompt: string] }>();

  const starters = computed(() => [
    { key: 'chassis', icon: 'fas fa-hashtag', prompt: t('starter_chassis') },
    { key: 'needle', icon: 'fas fa-gauge-high', prompt: t('starter_needle') },
    { key: 'torque', icon: 'fas fa-screwdriver-wrench', prompt: t('starter_torque') },
    { key: 'gearing', icon: 'fas fa-gears', prompt: t('starter_gearing') },
  ]);
</script>

<i18n lang="json">
{
  "en": {
    "greeting": "How can I help with your Mini?",
    "body": "Ask technical questions, decode chassis and engine numbers, look up parts and specifications, or get guidance on a restoration. I can search the Classic Mini DIY archive as we go.",
    "starter_chassis": "Decode the chassis number XN2S1N123456",
    "starter_needle": "Which SU needle suits a 1275 with an HIF44?",
    "starter_torque": "What are the cylinder head torque settings on an A-series?",
    "starter_gearing": "What final drive should I run for motorway cruising?"
  },
  "es": {
    "greeting": "¿Cómo puedo ayudarte con tu Mini?",
    "body": "Haz preguntas técnicas, decodifica números de chasis y motor, busca piezas y especificaciones, u obtén guía sobre una restauración. Puedo buscar en el archivo de Classic Mini DIY sobre la marcha.",
    "starter_chassis": "Decodifica el número de chasis XN2S1N123456",
    "starter_needle": "¿Qué aguja SU conviene a un 1275 con un HIF44?",
    "starter_torque": "¿Cuáles son los pares de apriete de la culata en un A-series?",
    "starter_gearing": "¿Qué grupo final debo usar para viajar por autopista?"
  },
  "fr": {
    "greeting": "Comment puis-je aider avec votre Mini ?",
    "body": "Posez des questions techniques, décodez les numéros de châssis et de moteur, recherchez des pièces et des spécifications, ou obtenez des conseils de restauration. Je peux consulter l'archive Classic Mini DIY au fil de la discussion.",
    "starter_chassis": "Décode le numéro de châssis XN2S1N123456",
    "starter_needle": "Quelle aiguille SU convient à une 1275 avec un HIF44 ?",
    "starter_torque": "Quels sont les couples de serrage de culasse sur un A-series ?",
    "starter_gearing": "Quel pont dois-je monter pour rouler sur autoroute ?"
  },
  "de": {
    "greeting": "Wie kann ich bei Ihrem Mini helfen?",
    "body": "Stellen Sie technische Fragen, dekodieren Sie Fahrgestell- und Motornummern, suchen Sie Teile und Spezifikationen oder holen Sie sich Rat zur Restaurierung. Ich kann dabei das Classic Mini DIY Archiv durchsuchen.",
    "starter_chassis": "Dekodiere die Fahrgestellnummer XN2S1N123456",
    "starter_needle": "Welche SU-Nadel passt zu einem 1275 mit HIF44?",
    "starter_torque": "Wie sind die Zylinderkopf-Drehmomente beim A-series?",
    "starter_gearing": "Welche Achsübersetzung eignet sich für Autobahnfahrten?"
  },
  "it": {
    "greeting": "Come posso aiutarti con la tua Mini?",
    "body": "Fai domande tecniche, decodifica numeri di telaio e motore, cerca ricambi e specifiche, o ricevi indicazioni su un restauro. Posso consultare l'archivio Classic Mini DIY mentre parliamo.",
    "starter_chassis": "Decodifica il numero di telaio XN2S1N123456",
    "starter_needle": "Quale spillo SU è adatto a una 1275 con HIF44?",
    "starter_torque": "Quali sono le coppie di serraggio della testata su un A-series?",
    "starter_gearing": "Quale rapporto finale conviene per viaggiare in autostrada?"
  },
  "pt": {
    "greeting": "Como posso ajudar com o seu Mini?",
    "body": "Faça perguntas técnicas, decodifique números de chassi e motor, procure peças e especificações, ou obtenha orientação sobre uma restauração. Posso pesquisar o arquivo do Classic Mini DIY durante a conversa.",
    "starter_chassis": "Decodifique o número de chassi XN2S1N123456",
    "starter_needle": "Qual agulha SU serve para um 1275 com HIF44?",
    "starter_torque": "Quais são os torques do cabeçote num A-series?",
    "starter_gearing": "Que relação final devo usar para viagens em autoestrada?"
  },
  "ru": {
    "greeting": "Чем помочь с вашим Mini?",
    "body": "Задавайте технические вопросы, расшифровывайте номера шасси и двигателя, ищите детали и характеристики или получайте советы по реставрации. По ходу разговора я могу искать в архиве Classic Mini DIY.",
    "starter_chassis": "Расшифруй номер шасси XN2S1N123456",
    "starter_needle": "Какая игла SU подходит для 1275 с HIF44?",
    "starter_torque": "Каковы моменты затяжки головки блока на A-series?",
    "starter_gearing": "Какую главную пару выбрать для езды по трассе?"
  },
  "ja": {
    "greeting": "あなたのMiniについて何をお手伝いしましょう？",
    "body": "技術的な質問、シャーシ番号やエンジン番号の解読、パーツや仕様の検索、レストアの相談ができます。会話の中でClassic Mini DIYのアーカイブを検索できます。",
    "starter_chassis": "シャーシ番号 XN2S1N123456 を解読して",
    "starter_needle": "HIF44を付けた1275に合うSUニードルは？",
    "starter_torque": "A-seriesのシリンダーヘッドの締付トルクは？",
    "starter_gearing": "高速巡航にはどのファイナルギアが良い？"
  },
  "zh": {
    "greeting": "您的Mini需要什么帮助？",
    "body": "提出技术问题、解码底盘号和发动机号、查找零件和规格，或获取修复指导。我可以在对话中检索Classic Mini DIY档案。",
    "starter_chassis": "解码底盘号 XN2S1N123456",
    "starter_needle": "装HIF44的1275适合哪种SU油针？",
    "starter_torque": "A-series的缸盖扭矩规格是多少？",
    "starter_gearing": "高速巡航应该用什么主减速比？"
  },
  "ko": {
    "greeting": "당신의 Mini에 대해 무엇을 도와드릴까요?",
    "body": "기술적인 질문을 하고, 섀시와 엔진 번호를 해독하고, 부품과 사양을 찾고, 복원에 대한 안내를 받으세요. 대화 중에 Classic Mini DIY 아카이브를 검색할 수 있습니다.",
    "starter_chassis": "섀시 번호 XN2S1N123456을 해독해 줘",
    "starter_needle": "HIF44를 장착한 1275에 맞는 SU 니들은?",
    "starter_torque": "A-series의 실린더 헤드 토크 값은?",
    "starter_gearing": "고속도로 주행에는 어떤 종감속비가 좋을까?"
  }
}
</i18n>
