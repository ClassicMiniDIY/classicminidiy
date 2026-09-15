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
    box-shadow:
      0 12px 28px rgb(0 0 0 / 0.1),
      0 4px 8px rgb(0 0 0 / 0.05);
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
      /* No viewport clamp here. The hero column used to be padded on the LEFT
         only (`pl-6 md:pl-20`), so a full-width child ran off the right edge and
         had to be clamped by hand. Hero.vue now lays the column out in the same
         `container mx-auto` every page body uses, which is symmetric — so 100%
         already lines the field up with the headline and the sections below it,
         and re-adding a clamp would only pull it back off that grid. */
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
    "placeholder": "Search or ask anything about your Mini…",
    "hint": "Tools, the archive, videos, parts and The Mini Exchange at once — or ask DIY Mini Bot."
  },
  "es": {
    "placeholder": "Busca o pregunta lo que sea sobre tu Mini…",
    "hint": "Herramientas, archivo, vídeos, piezas y The Mini Exchange a la vez — o pregunta a DIY Mini Bot."
  },
  "fr": {
    "placeholder": "Cherchez ou demandez n’importe quoi sur votre Mini…",
    "hint": "Outils, archives, vidéos, pièces et The Mini Exchange d’un coup — ou demandez à DIY Mini Bot."
  },
  "de": {
    "placeholder": "Suche oder frag alles über deinen Mini…",
    "hint": "Werkzeuge, Archiv, Videos, Teile und The Mini Exchange auf einmal — oder frag DIY Mini Bot."
  },
  "it": {
    "placeholder": "Cerca o chiedi qualsiasi cosa sulla tua Mini…",
    "hint": "Strumenti, archivio, video, ricambi e The Mini Exchange in una volta — o chiedi a DIY Mini Bot."
  },
  "pt": {
    "placeholder": "Pesquise ou pergunte o que quiser sobre o seu Mini…",
    "hint": "Ferramentas, arquivo, vídeos, peças e The Mini Exchange de uma vez — ou pergunte ao DIY Mini Bot."
  },
  "ru": {
    "placeholder": "Ищите или спрашивайте что угодно о вашем Mini…",
    "hint": "Инструменты, архив, видео, детали и The Mini Exchange сразу — или спросите DIY Mini Bot."
  },
  "ja": {
    "placeholder": "Mini について何でも検索・質問…",
    "hint": "ツール・アーカイブ・動画・部品・The Mini Exchange をまとめて検索。DIY Mini Bot への質問も。"
  },
  "zh": {
    "placeholder": "搜索或询问关于你的 Mini 的任何问题…",
    "hint": "一次搜索工具、档案、视频、零件和 The Mini Exchange，或向 DIY Mini Bot 提问。"
  },
  "ko": {
    "placeholder": "Mini에 대해 무엇이든 검색하거나 질문하세요…",
    "hint": "도구, 아카이브, 영상, 부품, The Mini Exchange를 한 번에 — 또는 DIY Mini Bot에게 질문하세요."
  }
}
</i18n>
