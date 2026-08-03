<script lang="ts" setup>
  /**
   * Document contributions run through the shared wizard now. The route stays put
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
    kind="document"
    :title="t('title')"
    :description="t('description')"
    :button-label="t('button')"
  />
</template>

<i18n lang="json">
{
  "en": {
    "page_title": "Contribute a document - Classic Mini DIY",
    "title": "Add a manual or document",
    "description": "Scans, guides, spec sheets and diagrams. PDFs and images welcome — a moderator reviews every upload.",
    "button": "Open the form"
  },
  "es": {
    "page_title": "Contribuir un documento - Classic Mini DIY",
    "title": "Añade un manual o documento",
    "description": "Escaneos, guías, fichas técnicas y esquemas. PDF e imágenes bienvenidos; un moderador revisa cada subida.",
    "button": "Abrir el formulario"
  },
  "fr": {
    "page_title": "Contribuer un document - Classic Mini DIY",
    "title": "Ajouter un manuel ou un document",
    "description": "Scans, guides, fiches techniques et schémas. PDF et images bienvenus — chaque envoi est relu.",
    "button": "Ouvrir le formulaire"
  },
  "de": {
    "page_title": "Dokument beitragen - Classic Mini DIY",
    "title": "Handbuch oder Dokument hinzufügen",
    "description": "Scans, Anleitungen, Datenblätter und Schaltpläne. PDFs und Bilder willkommen — jeder Upload wird geprüft.",
    "button": "Formular öffnen"
  },
  "it": {
    "page_title": "Contribuisci un documento - Classic Mini DIY",
    "title": "Aggiungi un manuale o documento",
    "description": "Scansioni, guide, schede tecniche e schemi. PDF e immagini benvenuti: ogni caricamento viene revisionato.",
    "button": "Apri il modulo"
  },
  "pt": {
    "page_title": "Contribuir um documento - Classic Mini DIY",
    "title": "Adicione um manual ou documento",
    "description": "Digitalizações, guias, fichas técnicas e esquemas. PDF e imagens são bem-vindos — cada envio é revisto.",
    "button": "Abrir o formulário"
  },
  "ru": {
    "page_title": "Добавить документ - Classic Mini DIY",
    "title": "Добавьте руководство или документ",
    "description": "Сканы, руководства, спецификации и схемы. PDF и изображения — каждую загрузку проверяет модератор.",
    "button": "Открыть форму"
  },
  "ja": {
    "page_title": "資料を投稿 - Classic Mini DIY",
    "title": "マニュアルや資料を追加",
    "description": "スキャン、ガイド、仕様書、図面。PDF と画像に対応し、すべての投稿を確認しています。",
    "button": "フォームを開く"
  },
  "zh": {
    "page_title": "贡献文档 - Classic Mini DIY",
    "title": "添加手册或文档",
    "description": "扫描件、指南、规格表和图纸。支持 PDF 和图片，每次上传都会经过审核。",
    "button": "打开表单"
  },
  "ko": {
    "page_title": "문서 기여 - Classic Mini DIY",
    "title": "매뉴얼 또는 문서 추가",
    "description": "스캔본, 가이드, 사양서, 도면. PDF와 이미지를 받으며 모든 업로드를 검토합니다.",
    "button": "양식 열기"
  }
}
</i18n>
