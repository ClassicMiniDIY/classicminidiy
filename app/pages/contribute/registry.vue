<script lang="ts" setup>
  /**
   * Registry contributions run through the shared wizard now. The route stays put
   * so existing links and the `nuxt.config.ts` 301s keep working — see
   * ContributeLauncher for the reasoning.
   */
  const { t } = useI18n();

  useHead({
    title: t('page_title'),
    meta: [
      { name: 'description', content: t('description') },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  });
</script>

<template>
  <ContributeLauncher
    kind="registry"
    :title="t('title')"
    :description="t('description')"
    :button-label="t('button')"
  />
</template>

<i18n lang="json">
{
  "en": {
    "page_title": "Register your Mini - Classic Mini DIY",
    "title": "Register your Mini",
    "description": "Add your car to the Mini Registry — year, model, chassis and engine numbers. A moderator reviews every entry.",
    "button": "Open the form"
  },
  "es": {
    "page_title": "Registra tu Mini - Classic Mini DIY",
    "title": "Registra tu Mini",
    "description": "Añade tu coche al Registro Mini: año, modelo, números de chasis y motor. Un moderador revisa cada entrada.",
    "button": "Abrir el formulario"
  },
  "fr": {
    "page_title": "Enregistrez votre Mini - Classic Mini DIY",
    "title": "Enregistrez votre Mini",
    "description": "Ajoutez votre voiture au Registre Mini : année, modèle, numéros de châssis et de moteur. Chaque entrée est relue.",
    "button": "Ouvrir le formulaire"
  },
  "de": {
    "page_title": "Registriere deinen Mini - Classic Mini DIY",
    "title": "Registriere deinen Mini",
    "description": "Trag dein Auto ins Mini-Register ein — Baujahr, Modell, Fahrgestell- und Motornummer. Jeder Eintrag wird geprüft.",
    "button": "Formular öffnen"
  },
  "it": {
    "page_title": "Registra il tuo Mini - Classic Mini DIY",
    "title": "Registra il tuo Mini",
    "description": "Aggiungi la tua auto al Registro Mini: anno, modello, numeri di telaio e motore. Ogni voce viene revisionata.",
    "button": "Apri il modulo"
  },
  "pt": {
    "page_title": "Registe o seu Mini - Classic Mini DIY",
    "title": "Registe o seu Mini",
    "description": "Adicione o seu carro ao Registo Mini — ano, modelo, números de chassi e motor. Cada entrada é revista.",
    "button": "Abrir o formulário"
  },
  "ru": {
    "page_title": "Зарегистрируйте свой Mini - Classic Mini DIY",
    "title": "Зарегистрируйте свой Mini",
    "description": "Добавьте машину в реестр Mini — год, модель, номера кузова и двигателя. Каждую запись проверяет модератор.",
    "button": "Открыть форму"
  },
  "ja": {
    "page_title": "あなたの Mini を登録 - Classic Mini DIY",
    "title": "あなたの Mini を登録",
    "description": "年式・モデル・シャシー番号・エンジン番号をミニ・レジストリに登録します。すべての登録を確認しています。",
    "button": "フォームを開く"
  },
  "zh": {
    "page_title": "登记你的 Mini - Classic Mini DIY",
    "title": "登记你的 Mini",
    "description": "把你的车加入 Mini 注册库——年份、车型、车架号和发动机号。每条记录都会经过审核。",
    "button": "打开表单"
  },
  "ko": {
    "page_title": "내 Mini 등록 - Classic Mini DIY",
    "title": "내 Mini 등록하기",
    "description": "연식, 모델, 섀시·엔진 번호를 Mini 레지스트리에 등록하세요. 모든 항목은 검토를 거칩니다.",
    "button": "양식 열기"
  }
}
</i18n>
