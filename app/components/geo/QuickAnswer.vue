<script setup lang="ts">
  import type { Faq } from '~/utils/schema/faqPage';

  /**
   * Above-the-fold "answer-first" block for GEO. Renders the SAME {q,a}[] that
   * backs a page's FAQPage JSON-LD (app/utils/geo/generateFaqs.ts) so the markup
   * matches visible content (Google requires this). Uses native <details> so the
   * questions + answers are in the SSR HTML with no JS — which is what lets AI
   * answer-bots and crawlers read the content on the JS-heavy calculator pages.
   *
   * Content (questions/answers/lead) is English domain data — it mirrors the
   * decoder/spec tables, which the site already renders English-only in every
   * locale. Only the component chrome is translated (the <i18n> block below).
   */
  defineProps<{
    faqs: Faq[];
    /** Optional answer-first lead sentence shown above the Q&A list. */
    lead?: string;
    /** Optional heading override; defaults to the localized "Quick answers". */
    heading?: string;
  }>();

  const { t } = useI18n();
</script>

<template>
  <section v-if="faqs.length" class="my-6" aria-labelledby="geo-quick-answer-heading">
    <div class="rounded-lg border border-base-300 bg-base-200/60 p-5">
      <h2 id="geo-quick-answer-heading" class="text-xl font-semibold mb-3 flex items-center gap-2">
        <i class="fas fa-circle-question text-primary" aria-hidden="true"></i>
        {{ heading || t('qa.heading') }}
      </h2>

      <p v-if="lead" class="text-base-content/90 leading-relaxed mb-4">{{ lead }}</p>

      <div class="space-y-2">
        <details
          v-for="(faq, i) in faqs"
          :key="i"
          class="collapse collapse-arrow border border-base-300 bg-base-100 rounded-lg"
        >
          <summary class="collapse-title text-base font-medium">{{ faq.q }}</summary>
          <div class="collapse-content">
            <p class="text-base-content/80 leading-relaxed pt-1">{{ faq.a }}</p>
          </div>
        </details>
      </div>
    </div>
  </section>
</template>

<i18n lang="json">
{
  "en": { "qa": { "heading": "Quick answers" } },
  "es": { "qa": { "heading": "Respuestas rápidas" } },
  "fr": { "qa": { "heading": "Réponses rapides" } },
  "it": { "qa": { "heading": "Risposte rapide" } },
  "de": { "qa": { "heading": "Schnelle Antworten" } },
  "pt": { "qa": { "heading": "Respostas rápidas" } },
  "ru": { "qa": { "heading": "Быстрые ответы" } },
  "ja": { "qa": { "heading": "クイック回答" } },
  "zh": { "qa": { "heading": "快速解答" } },
  "ko": { "qa": { "heading": "빠른 답변" } }
}
</i18n>
