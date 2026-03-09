<script lang="ts" setup>
  const { t } = useI18n();
  const { capture } = usePostHog();
  const { isAuthenticated } = useAuth();
  const { submitEditSuggestion } = useSubmissions();

  const props = defineProps<{
    modelValue: boolean;
    targetType: 'document' | 'color' | 'wheel' | 'registry';
    targetId: string;
    currentData: Record<string, any>;
    editableFields: Array<{
      key: string;
      label: string;
      type?: 'text' | 'number' | 'textarea' | 'select';
      options?: Array<{ value: string | null; label: string }>;
      conditionalFields?: Record<string, Array<{ key: string; label: string; type?: 'text' | 'textarea' }>>;
    }>;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    submitted: [];
  }>();

  const isOpen = computed({
    get: () => props.modelValue,
    set: (value: boolean) => emit('update:modelValue', value),
  });

  const formData = reactive<Record<string, any>>({});
  const reason = ref('');
  const submitted = ref(false);
  const processing = ref(false);
  const error = ref('');

  // Populate formData from source data (currentData or override)
  function initFormData(source: Record<string, any>) {
    for (const field of props.editableFields) {
      if (field.type === 'select') {
        formData[field.key] = source[field.key] !== undefined ? source[field.key] : null;
      } else {
        formData[field.key] = source[field.key] ?? '';
      }
      // Initialize conditional sub-field keys
      // Note: sub-field values from inactive branches persist in formData but are not submitted.
      if (field.conditionalFields) {
        for (const subFields of Object.values(field.conditionalFields)) {
          for (const cf of subFields) {
            formData[cf.key] = source[cf.key] ?? '';
          }
        }
      }
    }
  }

  watch(
    () => props.currentData,
    (newData) => {
      if (newData) initFormData(newData);
    },
    { immediate: true, deep: true }
  );

  watch(isOpen, (open) => {
    if (open && props.currentData) initFormData(props.currentData);
  });

  const hasChanges = computed(() => {
    return props.editableFields.some((field) => {
      if (field.type === 'select') {
        // Direct comparison for select fields (preserves null vs '' distinction)
        if (formData[field.key] !== props.currentData[field.key]) return true;
        // Check active conditional sub-fields for actual changes vs currentData
        const selectedValue = formData[field.key] != null ? String(formData[field.key]) : null;
        const activeSubFields = selectedValue != null ? field.conditionalFields?.[selectedValue] : undefined;
        if (activeSubFields) {
          return activeSubFields.some((cf) => {
            const from = String(props.currentData[cf.key] ?? '').trim();
            const to = String(formData[cf.key] ?? '').trim();
            return from !== to;
          });
        }
        return false;
      }
      const current = String(props.currentData[field.key] ?? '').trim();
      const proposed = String(formData[field.key] ?? '').trim();
      return current !== proposed;
    });
  });

  async function submit() {
    error.value = '';

    if (!isAuthenticated.value) {
      error.value = t('error.auth_required');
      return;
    }

    if (!hasChanges.value) {
      error.value = t('error.no_changes');
      return;
    }

    if (!reason.value.trim()) {
      error.value = t('error.reason_required');
      return;
    }

    processing.value = true;

    try {
      // Build changes diff — only include fields that actually changed
      const changes: Record<string, { from: any; to: any }> = {};
      const changedFields: string[] = [];

      for (const field of props.editableFields) {
        if (field.type === 'select') {
          // Direct comparison for select fields (preserves null)
          if (formData[field.key] !== props.currentData[field.key]) {
            changes[field.key] = { from: props.currentData[field.key] ?? null, to: formData[field.key] ?? null };
            changedFields.push(field.key);
          }
        } else {
          const from = String(props.currentData[field.key] ?? '').trim();
          const to = String(formData[field.key] ?? '').trim();
          if (from !== to) {
            changes[field.key] = { from: props.currentData[field.key] ?? '', to: formData[field.key] ?? '' };
            changedFields.push(field.key);
          }
        }
      }

      // Second pass: include active conditional sub-field values that actually changed
      for (const field of props.editableFields) {
        if (field.type === 'select' && field.conditionalFields) {
          const selectedValue = formData[field.key] != null ? String(formData[field.key]) : null;
          const activeSubFields = selectedValue != null ? field.conditionalFields[selectedValue] : undefined;
          if (activeSubFields) {
            for (const cf of activeSubFields) {
              const from = String(props.currentData[cf.key] ?? '').trim();
              const to = String(formData[cf.key] ?? '').trim();
              if (to !== '' && from !== to) {
                changes[cf.key] = { from: props.currentData[cf.key] ?? '', to: formData[cf.key] ?? '' };
                changedFields.push(cf.key);
              }
            }
          }
        }
      }

      await submitEditSuggestion(props.targetType, props.targetId, changes, reason.value.trim());

      submitted.value = true;

      capture('edit_suggestion_submitted', {
        target_type: props.targetType,
        target_id: props.targetId,
        changed_fields: changedFields,
      });

      emit('submitted');
    } catch (err: any) {
      error.value = err?.message || t('error.default');
      console.error('Error submitting edit suggestion:', err);
    } finally {
      processing.value = false;
    }
  }

  function close() {
    isOpen.value = false;
    setTimeout(() => {
      submitted.value = false;
      error.value = '';
      reason.value = '';
      initFormData(props.currentData);
    }, 300);
  }
</script>

<template>
  <UModal v-model:open="isOpen" :ui="{ width: 'max-w-2xl' }">
    <template #content>
      <div class="flex flex-col max-h-[90vh]">
        <!-- Header (fixed) -->
        <div class="flex items-center justify-between p-5 border-b border-base-content/10 shrink-0">
          <h2 class="text-lg font-semibold">
            <i class="fad fa-pen-to-square mr-2"></i>
            {{ t('title') }}
          </h2>
          <UButton variant="ghost" color="neutral" square size="sm" @click="close">
            <i class="i-fa6-solid-xmark"></i>
          </UButton>
        </div>

        <!-- Scrollable body -->
        <div class="overflow-y-auto flex-1 p-5">
          <!-- Success State -->
          <div v-if="submitted" class="text-center py-8">
            <div class="mb-4">
              <i class="fad fa-circle-check text-5xl text-success"></i>
            </div>
            <h3 class="text-2xl font-bold mb-2">{{ t('success.title') }}</h3>
            <p class="opacity-70 mb-6">{{ t('success.description') }}</p>
            <UButton color="primary" @click="close">
              {{ t('success.close') }}
            </UButton>
          </div>

          <!-- Form -->
          <div v-else>
            <p class="text-sm opacity-70 mb-6">{{ t('form.description') }}</p>

            <form @submit.prevent="submit" class="space-y-4">
              <!-- Editable fields -->
              <div v-for="field in editableFields" :key="field.key">
                <UFormField :label="field.label">
                  <template #hint>
                    <span class="text-xs opacity-60">
                      {{ t('form.current_value') }}:
                      <template v-if="field.type === 'select' && field.options">
                        {{ field.options.find((o) => o.value === currentData[field.key])?.label || '—' }}
                      </template>
                      <template v-else>
                        {{ currentData[field.key] || '—' }}
                      </template>
                    </span>
                  </template>
                  <UTextarea
                    v-if="field.type === 'textarea'"
                    v-model="formData[field.key]"
                    class="w-full"
                    :rows="3"
                    :disabled="processing"
                  />
                  <USelect
                    v-else-if="field.type === 'select'"
                    v-model="formData[field.key]"
                    :items="field.options ?? []"
                    value-key="value"
                    label-key="label"
                    class="w-full"
                    :disabled="processing"
                  />
                  <UInput
                    v-else
                    v-model="formData[field.key]"
                    :type="field.type === 'number' ? 'number' : 'text'"
                    class="w-full"
                    :disabled="processing"
                  />
                </UFormField>

                <!-- Conditional sub-fields for select fields -->
                <template v-if="field.type === 'select' && field.conditionalFields?.[String(formData[field.key])]">
                  <div
                    v-for="cf in field.conditionalFields[String(formData[field.key])]"
                    :key="cf.key"
                    class="mt-3 pl-4 border-l-2 border-primary/30"
                  >
                    <UFormField :label="cf.label">
                      <UTextarea
                        v-if="cf.type === 'textarea'"
                        v-model="formData[cf.key]"
                        class="w-full"
                        :rows="3"
                        :disabled="processing"
                      />
                      <UInput v-else v-model="formData[cf.key]" type="text" class="w-full" :disabled="processing" />
                    </UFormField>
                  </div>
                </template>
              </div>

              <USeparator />

              <!-- Reason for change -->
              <UFormField :label="`${t('form.reason.label')} *`" :help="t('form.reason.help')">
                <UTextarea
                  v-model="reason"
                  :placeholder="t('form.reason.placeholder')"
                  class="w-full"
                  :rows="3"
                  :disabled="processing"
                  required
                />
              </UFormField>

              <!-- Error alert -->
              <UAlert v-if="error" color="error">
                <template #icon>
                  <i class="fad fa-circle-exclamation"></i>
                </template>
                <template #title>{{ t('error.title') }}</template>
                <template #description>{{ error }}</template>
              </UAlert>

              <!-- No changes warning -->
              <UAlert v-if="!hasChanges && !error" color="warning">
                <template #icon>
                  <i class="fad fa-triangle-exclamation"></i>
                </template>
                <template #title>{{ t('warning.no_changes') }}</template>
              </UAlert>

              <!-- Actions -->
              <div class="flex justify-end gap-3 pt-2">
                <UButton variant="outline" @click="close" :disabled="processing">
                  {{ t('form.cancel') }}
                </UButton>
                <UButton
                  type="submit"
                  color="primary"
                  :disabled="!hasChanges || !reason.trim() || processing"
                  :loading="processing"
                >
                  <i class="fad fa-paper-plane mr-2" v-if="!processing"></i>
                  {{ processing ? t('form.submitting') : t('form.submit') }}
                </UButton>
              </div>
            </form>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Suggest an Edit",
    "success": {
      "title": "Edit Suggestion Submitted",
      "description": "A moderator will review your changes.",
      "close": "Close"
    },
    "form": {
      "description": "Propose changes to this item. Only modified fields will be submitted.",
      "current_value": "Current",
      "reason": {
        "label": "Reason for change",
        "placeholder": "Explain why this change is needed...",
        "help": "Please describe the source of your correction (e.g. original document, factory records, etc.)"
      },
      "cancel": "Cancel",
      "submit": "Submit Suggestion",
      "submitting": "Submitting..."
    },
    "warning": {
      "no_changes": "No changes detected. Modify at least one field to submit."
    },
    "error": {
      "title": "Error",
      "auth_required": "You must be signed in to suggest edits.",
      "no_changes": "No changes detected. Please modify at least one field.",
      "reason_required": "Please provide a reason for your edit suggestion.",
      "default": "There was an error submitting your suggestion. Please try again."
    }
  },
  "es": {
    "title": "Sugerir una edición",
    "success": {
      "title": "Sugerencia de edición enviada",
      "description": "Un moderador revisará tus cambios.",
      "close": "Cerrar"
    },
    "form": {
      "description": "Propón cambios a este elemento. Solo se enviarán los campos modificados.",
      "current_value": "Actual",
      "reason": {
        "label": "Motivo del cambio",
        "placeholder": "Explica por qué se necesita este cambio...",
        "help": "Describe la fuente de tu corrección (p.ej. documento original, registros de fábrica, etc.)"
      },
      "cancel": "Cancelar",
      "submit": "Enviar sugerencia",
      "submitting": "Enviando..."
    },
    "warning": {
      "no_changes": "No se detectaron cambios. Modifica al menos un campo para enviar."
    },
    "error": {
      "title": "Error",
      "auth_required": "Debes iniciar sesión para sugerir ediciones.",
      "no_changes": "No se detectaron cambios. Por favor modifica al menos un campo.",
      "reason_required": "Por favor proporciona un motivo para tu sugerencia de edición.",
      "default": "Hubo un error al enviar tu sugerencia. Por favor intenta de nuevo."
    }
  },
  "fr": {
    "title": "Suggérer une modification",
    "success": {
      "title": "Suggestion de modification soumise",
      "description": "Un modérateur examinera vos modifications.",
      "close": "Fermer"
    },
    "form": {
      "description": "Proposez des modifications à cet élément. Seuls les champs modifiés seront soumis.",
      "current_value": "Actuel",
      "reason": {
        "label": "Raison de la modification",
        "placeholder": "Expliquez pourquoi ce changement est nécessaire...",
        "help": "Veuillez décrire la source de votre correction (par ex. document original, archives d'usine, etc.)"
      },
      "cancel": "Annuler",
      "submit": "Soumettre la suggestion",
      "submitting": "Envoi en cours..."
    },
    "warning": {
      "no_changes": "Aucun changement détecté. Modifiez au moins un champ pour soumettre."
    },
    "error": {
      "title": "Erreur",
      "auth_required": "Vous devez être connecté pour suggérer des modifications.",
      "no_changes": "Aucun changement détecté. Veuillez modifier au moins un champ.",
      "reason_required": "Veuillez indiquer une raison pour votre suggestion de modification.",
      "default": "Une erreur s'est produite lors de la soumission de votre suggestion. Veuillez réessayer."
    }
  },
  "it": {
    "title": "Suggerisci una modifica",
    "success": {
      "title": "Suggerimento di modifica inviato",
      "description": "Un moderatore esaminerà le tue modifiche.",
      "close": "Chiudi"
    },
    "form": {
      "description": "Proponi modifiche a questo elemento. Solo i campi modificati verranno inviati.",
      "current_value": "Attuale",
      "reason": {
        "label": "Motivo della modifica",
        "placeholder": "Spiega perché questa modifica è necessaria...",
        "help": "Descrivi la fonte della tua correzione (es. documento originale, archivi di fabbrica, ecc.)"
      },
      "cancel": "Annulla",
      "submit": "Invia suggerimento",
      "submitting": "Invio in corso..."
    },
    "warning": {
      "no_changes": "Nessuna modifica rilevata. Modifica almeno un campo per inviare."
    },
    "error": {
      "title": "Errore",
      "auth_required": "Devi essere connesso per suggerire modifiche.",
      "no_changes": "Nessuna modifica rilevata. Modifica almeno un campo.",
      "reason_required": "Fornisci un motivo per il tuo suggerimento di modifica.",
      "default": "Si è verificato un errore durante l'invio del tuo suggerimento. Riprova."
    }
  },
  "de": {
    "title": "Bearbeitung vorschlagen",
    "success": {
      "title": "Bearbeitungsvorschlag eingereicht",
      "description": "Ein Moderator wird Ihre Änderungen überprüfen.",
      "close": "Schließen"
    },
    "form": {
      "description": "Schlagen Sie Änderungen an diesem Element vor. Nur geänderte Felder werden eingereicht.",
      "current_value": "Aktuell",
      "reason": {
        "label": "Grund für die Änderung",
        "placeholder": "Erklären Sie, warum diese Änderung erforderlich ist...",
        "help": "Bitte beschreiben Sie die Quelle Ihrer Korrektur (z.B. Originaldokument, Fabrikaufzeichnungen usw.)"
      },
      "cancel": "Abbrechen",
      "submit": "Vorschlag einreichen",
      "submitting": "Wird eingereicht..."
    },
    "warning": {
      "no_changes": "Keine Änderungen erkannt. Ändern Sie mindestens ein Feld zum Einreichen."
    },
    "error": {
      "title": "Fehler",
      "auth_required": "Sie müssen angemeldet sein, um Bearbeitungen vorzuschlagen.",
      "no_changes": "Keine Änderungen erkannt. Bitte ändern Sie mindestens ein Feld.",
      "reason_required": "Bitte geben Sie einen Grund für Ihren Bearbeitungsvorschlag an.",
      "default": "Bei der Einreichung Ihres Vorschlags ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut."
    }
  },
  "pt": {
    "title": "Sugerir uma edição",
    "success": {
      "title": "Sugestão de edição enviada",
      "description": "Um moderador revisará suas alterações.",
      "close": "Fechar"
    },
    "form": {
      "description": "Proponha alterações a este item. Apenas os campos modificados serão enviados.",
      "current_value": "Atual",
      "reason": {
        "label": "Motivo da alteração",
        "placeholder": "Explique por que essa alteração é necessária...",
        "help": "Descreva a fonte da sua correção (ex. documento original, registros de fábrica, etc.)"
      },
      "cancel": "Cancelar",
      "submit": "Enviar sugestão",
      "submitting": "Enviando..."
    },
    "warning": {
      "no_changes": "Nenhuma alteração detectada. Modifique pelo menos um campo para enviar."
    },
    "error": {
      "title": "Erro",
      "auth_required": "Você precisa estar conectado para sugerir edições.",
      "no_changes": "Nenhuma alteração detectada. Modifique pelo menos um campo.",
      "reason_required": "Por favor, forneça um motivo para sua sugestão de edição.",
      "default": "Ocorreu um erro ao enviar sua sugestão. Por favor, tente novamente."
    }
  },
  "ru": {
    "title": "Предложить правку",
    "success": {
      "title": "Предложение правки отправлено",
      "description": "Модератор рассмотрит ваши изменения.",
      "close": "Закрыть"
    },
    "form": {
      "description": "Предложите изменения к этому элементу. Будут отправлены только измененные поля.",
      "current_value": "Текущее",
      "reason": {
        "label": "Причина изменения",
        "placeholder": "Объясните, почему это изменение необходимо...",
        "help": "Пожалуйста, опишите источник вашей корректировки (напр. оригинальный документ, заводские записи и т.д.)"
      },
      "cancel": "Отмена",
      "submit": "Отправить предложение",
      "submitting": "Отправка..."
    },
    "warning": {
      "no_changes": "Изменения не обнаружены. Измените хотя бы одно поле для отправки."
    },
    "error": {
      "title": "Ошибка",
      "auth_required": "Вы должны войти в систему, чтобы предлагать правки.",
      "no_changes": "Изменения не обнаружены. Пожалуйста, измените хотя бы одно поле.",
      "reason_required": "Пожалуйста, укажите причину вашего предложения по правке.",
      "default": "Произошла ошибка при отправке вашего предложения. Пожалуйста, попробуйте снова."
    }
  },
  "ja": {
    "title": "編集を提案する",
    "success": {
      "title": "編集提案が送信されました",
      "description": "モデレーターがあなたの変更を確認します。",
      "close": "閉じる"
    },
    "form": {
      "description": "この項目への変更を提案してください。変更されたフィールドのみが送信されます。",
      "current_value": "現在の値",
      "reason": {
        "label": "変更の理由",
        "placeholder": "この変更が必要な理由を説明してください...",
        "help": "訂正の出典を記載してください（例：原本、工場記録など）"
      },
      "cancel": "キャンセル",
      "submit": "提案を送信",
      "submitting": "送信中..."
    },
    "warning": {
      "no_changes": "変更が検出されませんでした。送信するには少なくとも1つのフィールドを変更してください。"
    },
    "error": {
      "title": "エラー",
      "auth_required": "編集を提案するにはログインが必要です。",
      "no_changes": "変更が検出されませんでした。少なくとも1つのフィールドを変更してください。",
      "reason_required": "編集提案の理由を入力してください。",
      "default": "提案の送信中にエラーが発生しました。もう一度お試しください。"
    }
  },
  "zh": {
    "title": "建议编辑",
    "success": {
      "title": "编辑建议已提交",
      "description": "管理员将审核您的更改。",
      "close": "关闭"
    },
    "form": {
      "description": "对此项目提出修改建议。只有修改过的字段才会被提交。",
      "current_value": "当前值",
      "reason": {
        "label": "修改原因",
        "placeholder": "请说明为什么需要此更改...",
        "help": "请描述您的更正来源（例如：原始文件、工厂记录等）"
      },
      "cancel": "取消",
      "submit": "提交建议",
      "submitting": "提交中..."
    },
    "warning": {
      "no_changes": "未检测到更改。请至少修改一个字段后再提交。"
    },
    "error": {
      "title": "错误",
      "auth_required": "您必须登录才能建议编辑。",
      "no_changes": "未检测到更改。请至少修改一个字段。",
      "reason_required": "请提供编辑建议的原因。",
      "default": "提交建议时出错。请重试。"
    }
  },
  "ko": {
    "title": "편집 제안",
    "success": {
      "title": "편집 제안이 제출되었습니다",
      "description": "관리자가 변경 사항을 검토합니다.",
      "close": "닫기"
    },
    "form": {
      "description": "이 항목에 대한 변경을 제안하세요. 수정된 필드만 제출됩니다.",
      "current_value": "현재 값",
      "reason": {
        "label": "변경 이유",
        "placeholder": "이 변경이 필요한 이유를 설명하세요...",
        "help": "수정의 출처를 설명해 주세요 (예: 원본 문서, 공장 기록 등)"
      },
      "cancel": "취소",
      "submit": "제안 제출",
      "submitting": "제출 중..."
    },
    "warning": {
      "no_changes": "변경 사항이 감지되지 않았습니다. 제출하려면 최소 하나의 필드를 수정하세요."
    },
    "error": {
      "title": "오류",
      "auth_required": "편집을 제안하려면 로그인해야 합니다.",
      "no_changes": "변경 사항이 감지되지 않았습니다. 최소 하나의 필드를 수정하세요.",
      "reason_required": "편집 제안 이유를 입력해 주세요.",
      "default": "제안을 제출하는 중 오류가 발생했습니다. 다시 시도해 주세요."
    }
  }
}
</i18n>
