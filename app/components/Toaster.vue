<script setup lang="ts">
const { toasts, remove } = useToast();

const alertClass = (color: string) => {
  switch (color) {
    case 'success':
      return 'alert-success';
    case 'error':
      return 'alert-error';
    case 'warning':
      return 'alert-warning';
    case 'info':
      return 'alert-info';
    default:
      return '';
  }
};
</script>

<template>
  <div class="toast toast-bottom toast-end z-[9999]">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        role="alert"
        :class="['alert shadow-lg max-w-sm', alertClass(t.color)]"
      >
        <i v-if="t.icon" :class="[t.icon, 'text-lg']" aria-hidden="true"></i>
        <div class="flex-1">
          <div v-if="t.title" class="font-semibold">{{ t.title }}</div>
          <div v-if="t.description" class="text-sm opacity-90">{{ t.description }}</div>
        </div>
        <button class="btn btn-sm btn-ghost btn-circle" :aria-label="$t('dismiss')" @click="remove(t.id)">
          <i class="fas fa-xmark"></i>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(16px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>

<i18n lang="json">
{
  "en": { "dismiss": "Dismiss" },
  "es": { "dismiss": "Descartar" },
  "fr": { "dismiss": "Ignorer" },
  "de": { "dismiss": "Schließen" },
  "it": { "dismiss": "Ignora" },
  "pt": { "dismiss": "Dispensar" },
  "ru": { "dismiss": "Закрыть" },
  "ja": { "dismiss": "閉じる" },
  "zh": { "dismiss": "关闭" },
  "ko": { "dismiss": "닫기" }
}
</i18n>
