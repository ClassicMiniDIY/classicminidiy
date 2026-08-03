<script lang="ts" setup>
  /**
   * Wheel contributions run through the shared wizard now. The route stays put
   * so existing links and the `nuxt.config.ts` 301 from /archive/wheels/submit
   * keep working — see ContributeLauncher for the reasoning.
   *
   * Two query params were already in use and must keep meaning what they meant:
   *   ?uuid=<wheel id>  — add photos/specs to an EXISTING entry. This is the
   *                       link on a wheel detail page and on the Wheel Library's
   *                       "missing photos" gap state, so it maps to the wizard's
   *                       gap-fill (target_type wheel + target_id).
   *   ?newWheel=true    — a brand-new wheel, which is just the default.
   */
  const { t } = useI18n();
  const route = useRoute();
  const { getWheel } = useWheels();

  const targetId = computed(() => {
    const raw = route.query.uuid;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value ? String(value) : null;
  });

  // Only for the wizard's "Adding to …" line. getWheel() already returns null
  // for a malformed or unknown id, so a stale link degrades to a plain new-wheel
  // submission rather than an error.
  const { data: existingWheel } = await useAsyncData(
    () => `contribute-wheel-${targetId.value ?? 'new'}`,
    () => (targetId.value ? getWheel(targetId.value) : Promise.resolve(null)),
    { watch: [targetId] }
  );

  const isGapFill = computed(() => Boolean(existingWheel.value));

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
    kind="wheel"
    :target-type="isGapFill ? 'wheel' : undefined"
    :target-id="isGapFill ? targetId : null"
    :target-title="existingWheel?.name ?? null"
    :title="isGapFill ? t('title_existing', { name: existingWheel?.name }) : t('title')"
    :description="isGapFill ? t('description_existing') : t('description')"
    :button-label="t('button')"
  />
</template>

<i18n lang="json">
{
  "en": {
    "page_title": "Contribute a wheel - Classic Mini DIY",
    "title": "Add a wheel",
    "title_existing": "Add to \"{name}\"",
    "description": "Wheel name, size, width, offset and photos. A moderator reviews every submission.",
    "description_existing": "Add photos or corrected specs to an entry that already exists.",
    "button": "Open the form"
  },
  "es": {
    "page_title": "Contribuir una rueda - Classic Mini DIY",
    "title": "Añadir una rueda",
    "title_existing": "Añadir a \"{name}\"",
    "description": "Nombre, tamaño, ancho, offset y fotos. Un moderador revisa cada envío.",
    "description_existing": "Añade fotos o corrige los datos de una entrada que ya existe.",
    "button": "Abrir el formulario"
  },
  "fr": {
    "page_title": "Contribuer une jante - Classic Mini DIY",
    "title": "Ajouter une jante",
    "title_existing": "Ajouter à « {name} »",
    "description": "Nom, taille, largeur, déport et photos. Chaque envoi est relu.",
    "description_existing": "Ajoutez des photos ou corrigez les données d'une entrée existante.",
    "button": "Ouvrir le formulaire"
  },
  "de": {
    "page_title": "Rad beitragen - Classic Mini DIY",
    "title": "Rad hinzufügen",
    "title_existing": "Zu „{name}“ hinzufügen",
    "description": "Name, Größe, Breite, Einpresstiefe und Fotos. Jede Einreichung wird geprüft.",
    "description_existing": "Ergänze Fotos oder korrigierte Daten zu einem vorhandenen Eintrag.",
    "button": "Formular öffnen"
  },
  "it": {
    "page_title": "Contribuisci un cerchio - Classic Mini DIY",
    "title": "Aggiungi un cerchio",
    "title_existing": "Aggiungi a \"{name}\"",
    "description": "Nome, misura, larghezza, offset e foto. Ogni invio viene revisionato.",
    "description_existing": "Aggiungi foto o dati corretti a una voce già esistente.",
    "button": "Apri il modulo"
  },
  "pt": {
    "page_title": "Contribuir uma jante - Classic Mini DIY",
    "title": "Adicionar uma jante",
    "title_existing": "Adicionar a \"{name}\"",
    "description": "Nome, tamanho, largura, offset e fotos. Cada envio é revisto.",
    "description_existing": "Adicione fotos ou dados corrigidos a uma entrada já existente.",
    "button": "Abrir o formulário"
  },
  "ru": {
    "page_title": "Добавить диск - Classic Mini DIY",
    "title": "Добавить диск",
    "title_existing": "Дополнить «{name}»",
    "description": "Название, размер, ширина, вылет и фото. Каждую заявку проверяет модератор.",
    "description_existing": "Добавьте фото или уточните данные существующей записи.",
    "button": "Открыть форму"
  },
  "ja": {
    "page_title": "ホイールを投稿 - Classic Mini DIY",
    "title": "ホイールを追加",
    "title_existing": "「{name}」に追加",
    "description": "名称・サイズ・幅・オフセット・写真。すべての投稿を確認しています。",
    "description_existing": "既存のエントリーに写真や修正した仕様を追加します。",
    "button": "フォームを開く"
  },
  "zh": {
    "page_title": "贡献轮毂 - Classic Mini DIY",
    "title": "添加轮毂",
    "title_existing": "补充“{name}”",
    "description": "名称、尺寸、宽度、偏距和照片。每次提交都会经过审核。",
    "description_existing": "为已有条目补充照片或更正参数。",
    "button": "打开表单"
  },
  "ko": {
    "page_title": "휠 기여 - Classic Mini DIY",
    "title": "휠 추가",
    "title_existing": "\"{name}\"에 추가",
    "description": "이름, 사이즈, 폭, 오프셋, 사진. 모든 제출은 검토를 거칩니다.",
    "description_existing": "기존 항목에 사진이나 수정된 사양을 추가합니다.",
    "button": "양식 열기"
  }
}
</i18n>
