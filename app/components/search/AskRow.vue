<script lang="ts" setup>
  /**
   * The "Ask DIY Mini Bot" row: the search box's second exit.
   *
   * One row, rendered by the palette (above or below the results, by the
   * query's shape) and by /search (above the results column). Its copy and
   * target follow the quota state from `useOmnisearch.askState`: available,
   * or spent for an anonymous / free / member caller. The row is always
   * present once there is a query; it is never the only option while
   * results exist, and it never hides on a guess (an unknown quota reads as
   * available — the chat route holds the real ceiling).
   *
   * Client-only by construction: the palette is under `v-if="isOpen"`, and
   * on /search the quota is null until `loadQuota` runs after mount, so SSR
   * and the first client paint both render the "available" copy.
   */
  const props = defineProps<{
    /** The query the row offers to the bot. */
    query: string;
    /** Show the Cmd/Ctrl+Enter hint. Only the palette binds that key. */
    hotkey?: boolean;
  }>();

  const { t } = useI18n();
  const { askState, quota, askBot } = useOmnisearch();

  const term = computed(() => props.query.trim());

  /** The `⌘` glyph on a Mac, `Ctrl` elsewhere. SSR renders the Ctrl form. */
  const modifierKey = ref('Ctrl');
  onMounted(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) modifierKey.value = '⌘';
  });

  const copy = computed(() => {
    switch (askState.value) {
      case 'anon-limit':
        return t('ask_sign_in', { limit: quota.value?.limit ?? 30 });
      case 'free-limit':
        return t('ask_member', { limit: quota.value?.limit ?? 100 });
      case 'member-limit':
        return t('ask_reset');
      default:
        return t('ask_bot', { query: term.value });
    }
  });
</script>

<template>
  <button
    type="button"
    class="search-ask-row flex min-h-11 w-full items-center gap-3 rounded-field px-3 py-2.5 text-left"
    :class="{ 'is-limit': askState !== 'available' }"
    :disabled="askState === 'member-limit' || term.length < 2"
    @click="askBot(term)"
  >
    <i class="fas fa-robot w-[18px] text-center text-secondary" aria-hidden="true"></i>
    <span class="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{{ copy }}</span>
    <kbd v-if="hotkey && askState === 'available'" class="kbd kbd-sm hidden sm:inline-flex">{{ modifierKey }}↵</kbd>
  </button>
</template>

<style scoped>
  .search-ask-row {
    border: 1px dashed color-mix(in srgb, var(--color-secondary) 45%, transparent);
    background: color-mix(in srgb, var(--color-secondary) 6%, transparent);
  }
  .search-ask-row:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-secondary) 14%, transparent);
  }
  .search-ask-row.is-limit {
    border-style: solid;
  }
  .search-ask-row:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>

<i18n lang="json">
{
  "en": {
    "ask_bot": "Ask DIY Mini Bot: \"{query}\"",
    "ask_sign_in": "Sign in to ask — {limit} questions a month, free",
    "ask_member": "Become a Sustaining Member — {limit} questions a month",
    "ask_reset": "Your questions reset on the 1st"
  },
  "es": {
    "ask_bot": "Pregunta a DIY Mini Bot: \"{query}\"",
    "ask_sign_in": "Inicia sesión para preguntar — {limit} preguntas al mes, gratis",
    "ask_member": "Hazte Miembro Sustentador — {limit} preguntas al mes",
    "ask_reset": "Tus preguntas se renuevan el día 1"
  },
  "fr": {
    "ask_bot": "Demander à DIY Mini Bot : « {query} »",
    "ask_sign_in": "Connectez-vous pour demander — {limit} questions par mois, gratuit",
    "ask_member": "Devenez Membre Soutien — {limit} questions par mois",
    "ask_reset": "Vos questions se renouvellent le 1er"
  },
  "de": {
    "ask_bot": "DIY Mini Bot fragen: „{query}“",
    "ask_sign_in": "Anmelden zum Fragen — {limit} Fragen pro Monat, kostenlos",
    "ask_member": "Sustaining Member werden — {limit} Fragen pro Monat",
    "ask_reset": "Deine Fragen werden am 1. zurückgesetzt"
  },
  "it": {
    "ask_bot": "Chiedi a DIY Mini Bot: \"{query}\"",
    "ask_sign_in": "Accedi per chiedere — {limit} domande al mese, gratis",
    "ask_member": "Diventa Sustaining Member — {limit} domande al mese",
    "ask_reset": "Le tue domande si rinnovano il giorno 1"
  },
  "pt": {
    "ask_bot": "Perguntar ao DIY Mini Bot: \"{query}\"",
    "ask_sign_in": "Inicie sessão para perguntar — {limit} perguntas por mês, grátis",
    "ask_member": "Torne-se Sustaining Member — {limit} perguntas por mês",
    "ask_reset": "As suas perguntas renovam-se no dia 1"
  },
  "ru": {
    "ask_bot": "Спросить DIY Mini Bot: «{query}»",
    "ask_sign_in": "Войдите, чтобы спросить — {limit} вопросов в месяц, бесплатно",
    "ask_member": "Станьте Sustaining Member — {limit} вопросов в месяц",
    "ask_reset": "Ваши вопросы обновятся 1-го числа"
  },
  "ja": {
    "ask_bot": "DIY Mini Botに質問: 「{query}」",
    "ask_sign_in": "サインインして質問 — 月{limit}回まで無料",
    "ask_member": "Sustaining Memberになる — 月{limit}回まで",
    "ask_reset": "質問回数は毎月1日にリセットされます"
  },
  "zh": {
    "ask_bot": "向 DIY Mini Bot 提问：“{query}”",
    "ask_sign_in": "登录后提问 — 每月 {limit} 个问题，免费",
    "ask_member": "成为 Sustaining Member — 每月 {limit} 个问题",
    "ask_reset": "你的提问次数将于每月 1 日重置"
  },
  "ko": {
    "ask_bot": "DIY Mini Bot에게 질문: \"{query}\"",
    "ask_sign_in": "로그인하고 질문하기 — 매월 {limit}개 질문, 무료",
    "ask_member": "Sustaining Member 되기 — 매월 {limit}개 질문",
    "ask_reset": "질문 횟수는 매월 1일에 초기화됩니다"
  }
}
</i18n>
