<script setup lang="ts">
  /**
   * Liability banner for printed parts (keystone §12). Always shows the general
   * "as-is, not certified for road use" note; escalates to a prominent warning
   * when the model is flagged `safety_critical`.
   */
  withDefaults(defineProps<{ safetyCritical?: boolean }>(), { safetyCritical: false });

  const { t } = useI18n();
</script>

<template>
  <div role="note" class="alert" :class="safetyCritical ? 'alert-warning' : 'alert-info alert-soft'">
    <i class="fas text-lg" :class="safetyCritical ? 'fa-triangle-exclamation' : 'fa-circle-info'"></i>
    <div class="text-sm">
      <p v-if="safetyCritical" class="font-bold">{{ t('safetyCriticalHeading') }}</p>
      <p :class="safetyCritical ? 'mt-1' : 'font-semibold'">
        {{ t('disclaimerPre') }} <strong>{{ t('asIs') }}</strong> {{ t('disclaimerMid') }} <strong>{{ t('notCertified') }}</strong>{{ t('disclaimerPost') }}
        <span v-if="safetyCritical">
          {{ t('safetyCriticalExtra') }}
        </span>
      </p>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "safetyCriticalHeading": "Safety-critical part — print and use at your own risk",
    "disclaimerPre": "These files are provided",
    "asIs": "as-is",
    "disclaimerMid": "and are",
    "notCertified": "not certified for road use",
    "disclaimerPost": ". You are responsible for verifying any part's strength, fit, and suitability before fitting it to a vehicle. Classic Mini DIY and the model's author accept no liability for printed parts.",
    "safetyCriticalExtra": "This model has been flagged as safety-critical — take extra care and do not use it for structural, braking, steering, or fuel-system applications without independent engineering review."
  },
  "es": {
    "safetyCriticalHeading": "Pieza de seguridad crítica — imprime y usa bajo tu propia responsabilidad",
    "disclaimerPre": "Estos archivos se proporcionan",
    "asIs": "tal cual",
    "disclaimerMid": "y",
    "notCertified": "no están certificados para uso en carretera",
    "disclaimerPost": ". Eres responsable de verificar la resistencia, el ajuste y la idoneidad de cualquier pieza antes de instalarla en un vehículo. Classic Mini DIY y el autor del modelo no aceptan ninguna responsabilidad por las piezas impresas.",
    "safetyCriticalExtra": "Este modelo ha sido marcado como de seguridad crítica — ten especial cuidado y no lo uses en aplicaciones estructurales, de frenado, de dirección o del sistema de combustible sin una revisión de ingeniería independiente."
  },
  "fr": {
    "safetyCriticalHeading": "Pièce critique pour la sécurité — impression et utilisation à vos risques et périls",
    "disclaimerPre": "Ces fichiers sont fournis",
    "asIs": "en l'état",
    "disclaimerMid": "et ne sont",
    "notCertified": "pas certifiés pour une utilisation routière",
    "disclaimerPost": ". Il vous incombe de vérifier la résistance, l'ajustement et la compatibilité de chaque pièce avant de la monter sur un véhicule. Classic Mini DIY et l'auteur du modèle déclinent toute responsabilité pour les pièces imprimées.",
    "safetyCriticalExtra": "Ce modèle a été signalé comme critique pour la sécurité — soyez particulièrement prudent et ne l'utilisez pas pour des applications structurelles, de freinage, de direction ou du système de carburant sans examen technique indépendant."
  },
  "de": {
    "safetyCriticalHeading": "Sicherheitskritisches Bauteil — Druck und Verwendung auf eigene Gefahr",
    "disclaimerPre": "Diese Dateien werden",
    "asIs": "ohne Gewähr",
    "disclaimerMid": "bereitgestellt und sind",
    "notCertified": "nicht für die Straßenverwendung zertifiziert",
    "disclaimerPost": ". Sie sind dafür verantwortlich, Festigkeit, Passform und Eignung jedes Bauteils zu prüfen, bevor es an einem Fahrzeug montiert wird. Classic Mini DIY und der Autor des Modells übernehmen keine Haftung für gedruckte Teile.",
    "safetyCriticalExtra": "Dieses Modell wurde als sicherheitskritisch eingestuft — gehen Sie besonders vorsichtig vor und verwenden Sie es nicht für strukturelle, Brems-, Lenk- oder Kraftstoffsystemanwendungen ohne unabhängige technische Prüfung."
  },
  "it": {
    "safetyCriticalHeading": "Componente critico per la sicurezza — stampa e utilizzo a proprio rischio",
    "disclaimerPre": "Questi file sono forniti",
    "asIs": "così come sono",
    "disclaimerMid": "e",
    "notCertified": "non sono certificati per l'uso su strada",
    "disclaimerPost": ". Sei responsabile della verifica della resistenza, dell'adattamento e dell'idoneità di qualsiasi parte prima di montarla su un veicolo. Classic Mini DIY e l'autore del modello non accettano alcuna responsabilità per le parti stampate.",
    "safetyCriticalExtra": "Questo modello è stato contrassegnato come critico per la sicurezza — presta la massima attenzione e non utilizzarlo per applicazioni strutturali, frenanti, di sterzo o del sistema carburante senza una revisione ingegneristica indipendente."
  },
  "pt": {
    "safetyCriticalHeading": "Peça crítica de segurança — imprima e use por sua própria conta e risco",
    "disclaimerPre": "Estes arquivos são fornecidos",
    "asIs": "no estado em que se encontram",
    "disclaimerMid": "e",
    "notCertified": "não são certificados para uso em via pública",
    "disclaimerPost": ". Você é responsável por verificar a resistência, o ajuste e a adequação de qualquer peça antes de instalá-la em um veículo. Classic Mini DIY e o autor do modelo não aceitam qualquer responsabilidade por peças impressas.",
    "safetyCriticalExtra": "Este modelo foi marcado como crítico para a segurança — tome cuidado extra e não o use em aplicações estruturais, de freio, direção ou sistema de combustível sem revisão de engenharia independente."
  },
  "ru": {
    "safetyCriticalHeading": "Критически важная для безопасности деталь — печатайте и используйте на свой страх и риск",
    "disclaimerPre": "Эти файлы предоставляются",
    "asIs": "как есть",
    "disclaimerMid": "и",
    "notCertified": "не сертифицированы для использования на дорогах общего пользования",
    "disclaimerPost": ". Вы несёте ответственность за проверку прочности, подгонки и пригодности любой детали перед её установкой на автомобиль. Classic Mini DIY и автор модели не несут никакой ответственности за напечатанные детали.",
    "safetyCriticalExtra": "Эта модель отмечена как критически важная для безопасности — будьте особенно осторожны и не используйте её в несущих конструкциях, тормозной системе, рулевом управлении или топливной системе без независимой инженерной экспертизы."
  },
  "ja": {
    "safetyCriticalHeading": "安全上重要な部品 — 印刷・使用は自己責任で行ってください",
    "disclaimerPre": "これらのファイルは",
    "asIs": "現状のまま",
    "disclaimerMid": "提供されており、",
    "notCertified": "公道使用の認証を受けていません",
    "disclaimerPost": "。車両に取り付ける前に、各部品の強度・適合性・適切さを必ずご自身で確認してください。Classic Mini DIY およびモデルの作者は、印刷した部品に関する一切の責任を負いません。",
    "safetyCriticalExtra": "このモデルは安全上重要な部品としてフラグが立てられています — 特に注意を払い、独立した工学的審査なしに構造・制動・操舵・燃料系統の用途には使用しないでください。"
  },
  "zh": {
    "safetyCriticalHeading": "安全关键零件 — 打印和使用风险自担",
    "disclaimerPre": "这些文件",
    "asIs": "按原样",
    "disclaimerMid": "提供，",
    "notCertified": "未经道路使用认证",
    "disclaimerPost": "。在将任何零件安装到车辆之前，您有责任验证其强度、配合度和适用性。Classic Mini DIY 及模型作者对打印零件不承担任何责任。",
    "safetyCriticalExtra": "此模型已被标记为安全关键 — 请格外谨慎，未经独立工程审查，请勿将其用于结构、制动、转向或燃油系统。"
  },
  "ko": {
    "safetyCriticalHeading": "안전 중요 부품 — 출력 및 사용은 본인 책임하에 진행하세요",
    "disclaimerPre": "이 파일들은",
    "asIs": "있는 그대로",
    "disclaimerMid": "제공되며",
    "notCertified": "도로 사용 인증을 받지 않았습니다",
    "disclaimerPost": ". 차량에 부품을 장착하기 전에 강도, 적합성, 적절성을 반드시 직접 확인하세요. Classic Mini DIY 및 모델 제작자는 출력된 부품에 대한 어떠한 책임도 지지 않습니다.",
    "safetyCriticalExtra": "이 모델은 안전 중요로 표시되었습니다 — 독립적인 엔지니어링 검토 없이 구조, 제동, 조향 또는 연료 시스템 용도로 사용하지 마세요."
  }
}
</i18n>
