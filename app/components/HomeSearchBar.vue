<script lang="ts" setup>
  /**
   * The homepage search field (design S1 / M1).
   *
   * "Search is the front door, not a corner icon" — so this is a 52px field with
   * real weight, sitting in the hero rather than a magnifying glass tucked in
   * the header.
   *
   * It renders INSIDE the hero content column, not as a band between the hero
   * and the page. The decorative `.spacer.layer` that follows the hero carries
   * `margin-top: -10%` — ten percent of the page WIDTH, ~160px at desktop — and
   * is designed to bite up into the hero. Anything placed between the two gets
   * eaten by it.
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
  <div class="home-search-wrap">
    <button type="button" class="home-search" @click="openSearch">
      <i class="fas fa-magnifying-glass text-secondary shrink-0" aria-hidden="true"></i>
      <!--
        `min-w-0` is load-bearing, not decoration. `truncate` sets
        white-space: nowrap, and a flex child defaults to min-width: auto, so
        without this the span refuses to shrink below the full placeholder
        string. That min-content width propagates up through the hero's flex
        column (also min-width: auto) and pushes the whole hero — headline, CTAs
        and all — wider than a 375px viewport.
      -->
      <span class="min-w-0 truncate">{{ t('placeholder') }}</span>
    </button>
    <p class="home-search-hint">{{ t('hint') }}</p>
  </div>
</template>

<style scoped>
  .home-search-wrap {
    margin-top: 1.5rem;
    width: 100%;
    max-width: 560px;
    min-width: 0;
  }

  .home-search {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
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

  .home-search-hint {
    margin: 0.625rem 0 0;
    font-size: 13.5px;
    color: rgb(255 255 255 / 0.72);
  }

  @media (max-width: 640px) {
    .home-search-wrap {
      margin-top: 1.25rem;
      /* The hero content column is padded on the LEFT only (`pl-6 md:pl-20` in
         Hero.vue) and is itself a little wider than a phone viewport, so a
         full-width child would sit flush against the right edge. Clamping to the
         viewport minus the column's real left inset (16px .hero-content padding
         + 24px pl-6, twice) gives the field an even gutter on both sides without
         touching the hero, which the headline and CTAs are laid out against. */
      max-width: calc(100vw - 5rem);
    }
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
