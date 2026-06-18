<template>
  <dialog ref="dialogRef" class="modal">
    <div class="modal-box">
      <h3 class="font-bold text-lg">{{ title }}</h3>
      <p class="py-4">{{ message }}</p>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="handleCancel">{{ t('cancel') }}</button>
        <button class="btn" :class="confirmButtonClass" @click="handleConfirm">
          {{ confirmText ?? t('confirm') }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="handleCancel">close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  interface Props {
    title?: string;
    message?: string;
    confirmText?: string;
    confirmColor?: 'primary' | 'error' | 'success' | 'warning';
  }

  const props = withDefaults(defineProps<Props>(), {
    title: 'Confirm',
    message: 'Are you sure?',
    confirmText: undefined,
    confirmColor: 'primary',
  });

  const emit = defineEmits<{
    confirm: [];
    cancel: [];
  }>();

  const dialogRef = ref<HTMLDialogElement | null>(null);

  const confirmButtonClass = computed(() => {
    switch (props.confirmColor) {
      case 'error':
        return 'btn-error';
      case 'success':
        return 'btn-success';
      case 'warning':
        return 'btn-warning';
      default:
        return 'btn-primary';
    }
  });

  const show = () => {
    dialogRef.value?.showModal();
  };

  const hide = () => {
    dialogRef.value?.close();
  };

  const handleConfirm = () => {
    hide();
    emit('confirm');
  };

  const handleCancel = () => {
    hide();
    emit('cancel');
  };

  defineExpose({ show, hide });
</script>

<i18n lang="json">
{
  "en": { "confirm": "Confirm", "cancel": "Cancel" },
  "es": { "confirm": "Confirmar", "cancel": "Cancelar" },
  "fr": { "confirm": "Confirmer", "cancel": "Annuler" },
  "de": { "confirm": "Bestätigen", "cancel": "Abbrechen" },
  "it": { "confirm": "Conferma", "cancel": "Annulla" },
  "pt": { "confirm": "Confirmar", "cancel": "Cancelar" },
  "ru": { "confirm": "Подтвердить", "cancel": "Отмена" },
  "ja": { "confirm": "確認", "cancel": "キャンセル" },
  "zh": { "confirm": "确认", "cancel": "取消" },
  "ko": { "confirm": "확인", "cancel": "취소" }
}
</i18n>
