<script lang="ts" setup>
  /**
   * The homepage search field (design S1 / M1).
   *
   * "Search is the front door, not a corner icon" — so this is a 52px field with
   * real weight, sitting directly under the hero rather than a magnifying glass
   * tucked in the header.
   *
   * It is a button, not an input: focusing it opens the omnisearch palette,
   * which owns the real input. Two live text fields competing for the same query
   * is the alternative, and it always ends with one of them stale.
   */
  const { t } = useI18n();
  const { open } = useOmnisearch();
  const { track } = useAnalytics();

  const openSearch = () => {
    track('omnisearch_trigger_clicked', { surface: 'home_hero' });
    open();
  };
</script>

<template>
  <div class="home-search-band">
    <div class="mx-auto w-full max-w-[1232px] px-4 lg:px-6">
      <button type="button" class="home-search" @click="openSearch">
        <i class="fas fa-magnifying-glass text-secondary" aria-hidden="true"></i>
        <span class="truncate">{{ t('placeholder') }}</span>
      </button>
      <p class="mt-2.5 text-[13.5px] text-white/70">{{ t('hint') }}</p>
    </div>
  </div>
</template>

<style scoped>
  .home-search-band {
    background: #242424;
    padding: 0 0 1.75rem;
    margin-top: -1px;
  }

  .home-search {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
    max-width: 560px;
    height: 52px;
    padding: 0 1.125rem;
    background: #fff;
    border-radius: var(--radius-field, 0.5rem);
    box-shadow: 0 12px 28px rgb(0 0 0 / 0.1), 0 4px 8px rgb(0 0 0 / 0.05);
    color: #76767c;
    font-size: 16px;
    text-align: left;
    cursor: text;
  }

  @media (max-width: 640px) {
    .home-search {
      height: 48px;
      font-size: 15px;
    }
  }
</style>

<i18n lang="json">
{
  "en": {
    "placeholder": "Try \"brake bleeding\" or \"10x4.5 minilite\"…",
    "hint": "Search the toolbox, the archive, and The Mini Exchange at once."
  },
  "es": {
    "placeholder": "Prueba \"purga de frenos\" o \"10x4.5 minilite\"…",
    "hint": "Busca a la vez en las herramientas, el archivo y The Mini Exchange."
  },
  "fr": {
    "placeholder": "Essayez \"purge des freins\" ou \"10x4.5 minilite\"…",
    "hint": "Cherchez d'un coup dans les outils, les archives et The Mini Exchange."
  },
  "de": {
    "placeholder": "Versuche \"Bremsen entlüften\" oder \"10x4.5 minilite\"…",
    "hint": "Durchsuche Werkzeuge, Archiv und The Mini Exchange auf einmal."
  },
  "it": {
    "placeholder": "Prova \"spurgo freni\" o \"10x4.5 minilite\"…",
    "hint": "Cerca in una volta sola tra strumenti, archivio e The Mini Exchange."
  },
  "pt": {
    "placeholder": "Tente \"sangria de travões\" ou \"10x4.5 minilite\"…",
    "hint": "Pesquise de uma vez nas ferramentas, no arquivo e no The Mini Exchange."
  },
  "ru": {
    "placeholder": "Попробуйте «прокачка тормозов» или «10x4.5 minilite»…",
    "hint": "Ищите сразу по инструментам, архиву и The Mini Exchange."
  },
  "ja": {
    "placeholder": "「ブレーキのエア抜き」や「10x4.5 minilite」など…",
    "hint": "ツール・アーカイブ・The Mini Exchange をまとめて検索します。"
  },
  "zh": {
    "placeholder": "试试“刹车排气”或“10x4.5 minilite”…",
    "hint": "一次搜索工具箱、档案馆和 The Mini Exchange。"
  },
  "ko": {
    "placeholder": "\"브레이크 블리딩\" 또는 \"10x4.5 minilite\" 등…",
    "hint": "도구상자, 아카이브, The Mini Exchange를 한 번에 검색합니다."
  }
}
</i18n>
