<script lang="ts" setup>
  /**
   * Header entry point to the marketplace inbox, sitting next to the
   * light/dark toggle. Before this the inbox had no link anywhere in the
   * shell — sellers only found new buyer messages through the notification
   * email, and buyers often not at all.
   *
   * SSR renders the count at 0 (the Supabase session lives in localStorage, so
   * the server has no session to read), and the first client render matches
   * because the fetch starts on mount. No `hasMounted` gate is needed here —
   * the badge is simply absent until the number arrives.
   */
  const { t } = useI18n();
  const { track } = useAnalytics();
  const { unreadCount, start } = useUnreadMessages();

  start();

  /** Two digits is all the header has room for. */
  const badgeLabel = computed(() => (unreadCount.value > 99 ? '99+' : String(unreadCount.value)));

  const label = computed(() => (unreadCount.value > 0 ? t('aria_unread', { count: unreadCount.value }) : t('aria')));
</script>

<template>
  <!-- The `indicator` wraps the link rather than being the link: daisyUI pins
       `.indicator-item` to the corner of the indicator box, and a `btn-circle`
       clips it visually when the badge is a child of the button itself. -->
  <div class="indicator">
    <!-- `end-1.5` pulls the badge in from daisyUI's default corner. At its
         default the widest state ("99+") reaches ~4px PAST the button box and
         collides with the theme toggle, which sits one `gap-3` away. -->
    <span
      v-if="unreadCount > 0"
      class="indicator-item badge badge-primary badge-xs end-1.5 px-1 font-semibold"
      aria-hidden="true"
    >
      {{ badgeLabel }}
    </span>
    <NuxtLink
      to="/exchange/messages"
      class="btn btn-ghost btn-sm btn-circle"
      :aria-label="label"
      :title="t('aria')"
      @click="track('nav_item_clicked', { label: 'Messages', surface: 'header' })"
    >
      <i class="fas fa-envelope text-base" aria-hidden="true"></i>
    </NuxtLink>
  </div>
</template>

<i18n lang="json">
{
  "en": { "aria": "Messages", "aria_unread": "Messages, {count} unread" },
  "es": { "aria": "Mensajes", "aria_unread": "Mensajes, {count} sin leer" },
  "fr": { "aria": "Messages", "aria_unread": "Messages, {count} non lus" },
  "de": { "aria": "Nachrichten", "aria_unread": "Nachrichten, {count} ungelesen" },
  "it": { "aria": "Messaggi", "aria_unread": "Messaggi, {count} non letti" },
  "pt": { "aria": "Mensagens", "aria_unread": "Mensagens, {count} não lidas" },
  "ru": { "aria": "Сообщения", "aria_unread": "Сообщения, непрочитанных: {count}" },
  "ja": { "aria": "メッセージ", "aria_unread": "メッセージ、未読 {count} 件" },
  "zh": { "aria": "消息", "aria_unread": "消息，{count} 条未读" },
  "ko": { "aria": "메시지", "aria_unread": "메시지, 읽지 않음 {count}개" }
}
</i18n>
