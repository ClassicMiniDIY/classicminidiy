<script setup lang="ts">
  const { t } = useI18n();
  const supabase = useSupabase();

  const { data, pending, refresh } = await useAsyncData('models-mine', async () => {
    if (!import.meta.client) return { models: [] as any[] };
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) return { models: [] as any[] };
    return await $fetch<{ models: any[] }>('/api/models/mine', { headers: { Authorization: `Bearer ${token}` } });
  });

  const models = computed(() => data.value?.models ?? []);

  const statusTone: Record<string, string> = {
    draft: 'badge-ghost',
    pending: 'badge-warning',
    published: 'badge-success',
    rejected: 'badge-error',
    flagged: 'badge-warning',
    archived: 'badge-neutral',
    removed: 'badge-error',
  };

  const busy = ref<string | null>(null);
  async function authHeaders(): Promise<Record<string, string>> {
    const { data: s } = await supabase.auth.getSession();
    return s.session?.access_token ? { Authorization: `Bearer ${s.session.access_token}` } : {};
  }

  // Start a new draft version on a published model, then open the wizard for it.
  async function newVersion(id: string) {
    busy.value = id;
    try {
      const headers = await authHeaders();
      await $fetch(`/api/models/${id}/versions`, { method: 'POST', headers });
      await navigateTo(`/models/upload?model=${id}`);
    } catch {
      busy.value = null;
    }
  }

  const deleteTarget = ref<any | null>(null);
  async function confirmDelete() {
    const m = deleteTarget.value;
    if (!m) return;
    busy.value = m.id;
    const headers = await authHeaders();
    await $fetch(`/api/models/${m.id}` as string, { method: 'DELETE', headers }).catch(() => {});
    busy.value = null;
    deleteTarget.value = null;
    await refresh();
  }
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <i class="fad fa-cube"></i>
        <h2 class="text-lg font-semibold">{{ t('heading') }}</h2>
      </div>
      <NuxtLink to="/models/upload" class="btn btn-primary btn-sm">
        <i class="fas fa-plus mr-1"></i> {{ t('uploadBtn') }}
      </NuxtLink>
    </div>

    <div v-if="pending" class="flex justify-center py-16">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else-if="models.length === 0" class="text-center py-16">
      <i class="fas fa-cube text-5xl opacity-20"></i>
      <p class="mt-4 text-lg font-semibold">{{ t('emptyTitle') }}</p>
      <p class="opacity-60 mb-4">{{ t('emptySubtitle') }}</p>
      <NuxtLink to="/models/upload" class="btn btn-primary"><i class="fas fa-plus mr-1"></i> {{ t('uploadBtn') }}</NuxtLink>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="m in models" :key="m.id" class="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
        <figure class="aspect-[4/3] bg-base-200">
          <img
            v-if="m.primaryImage"
            :src="m.primaryImage"
            :alt="m.title"
            class="w-full h-full object-cover"
            loading="lazy"
          />
          <div v-else class="w-full h-full flex items-center justify-center text-base-content/30">
            <i class="fas fa-cube text-4xl"></i>
          </div>
        </figure>
        <div class="card-body p-4 gap-2">
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-semibold leading-tight line-clamp-2">{{ m.title }}</h3>
            <span class="badge badge-sm shrink-0 capitalize" :class="statusTone[m.status] || 'badge-ghost'">{{
              m.status
            }}</span>
          </div>
          <p class="text-xs opacity-60">
            v{{ m.versionCount }} · <i class="fas fa-download"></i> {{ m.downloadCount }} · <i class="fas fa-heart"></i>
            {{ m.likeCount }}
          </p>
          <div class="flex gap-1.5 mt-1 flex-wrap">
            <NuxtLink v-if="m.status === 'published'" :to="`/models/${m.slug}`" class="btn btn-ghost btn-xs">
              <i class="fas fa-eye mr-1"></i> {{ t('actionView') }}
            </NuxtLink>
            <NuxtLink
              v-if="['draft', 'rejected'].includes(m.status)"
              :to="`/models/upload?model=${m.id}`"
              class="btn btn-primary btn-xs"
            >
              <i class="fas fa-pen mr-1"></i> {{ t('actionContinue') }}
            </NuxtLink>
            <NuxtLink v-if="m.status === 'published'" :to="`/models/upload?model=${m.id}`" class="btn btn-ghost btn-xs">
              <i class="fas fa-pen mr-1"></i> {{ t('actionEdit') }}
            </NuxtLink>
            <button
              v-if="m.status === 'published'"
              type="button"
              class="btn btn-ghost btn-xs"
              :disabled="busy === m.id"
              @click="newVersion(m.id)"
            >
              <i class="fas fa-code-branch mr-1"></i> {{ t('actionNewVersion') }}
            </button>
            <button
              v-if="['draft', 'rejected'].includes(m.status)"
              type="button"
              class="btn btn-ghost btn-xs text-error"
              :disabled="busy === m.id"
              @click="deleteTarget = m"
            >
              <i class="fas fa-trash"></i>
            </button>
            <span v-if="m.status === 'pending'" class="text-xs opacity-50 self-center">{{ t('awaitingReview') }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete confirmation -->
    <dialog class="modal" :class="{ 'modal-open': !!deleteTarget }">
      <div class="modal-box">
        <h3 class="font-bold text-lg"><i class="fas fa-trash text-error mr-1"></i> {{ t('deleteModal.title') }}</h3>
        <p class="py-3 text-sm">
          {{ t('deleteModal.body', { name: deleteTarget?.title }) }}
        </p>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="deleteTarget = null">{{ t('deleteModal.cancel') }}</button>
          <button type="button" class="btn btn-error" :disabled="busy === deleteTarget?.id" @click="confirmDelete">
            <span v-if="busy === deleteTarget?.id" class="loading loading-spinner loading-sm"></span>
            <i v-else class="fas fa-trash mr-1"></i> {{ t('deleteModal.confirm') }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="deleteTarget = null"><button>{{ t('deleteModal.close') }}</button></form>
    </dialog>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "heading": "My 3D Models",
    "uploadBtn": "Upload a model",
    "emptyTitle": "No models yet",
    "emptySubtitle": "Share your first Classic Mini print.",
    "actionView": "View",
    "actionContinue": "Continue",
    "actionEdit": "Edit",
    "actionNewVersion": "New version",
    "awaitingReview": "Awaiting review",
    "deleteModal": {
      "title": "Delete draft?",
      "body": "Delete {name}? This permanently removes the draft and its uploaded files. This can't be undone.",
      "cancel": "Cancel",
      "confirm": "Delete",
      "close": "close"
    }
  },
  "es": {
    "heading": "Mis modelos 3D",
    "uploadBtn": "Subir un modelo",
    "emptyTitle": "Aún no hay modelos",
    "emptySubtitle": "Comparte tu primera impresión del Mini Clásico.",
    "actionView": "Ver",
    "actionContinue": "Continuar",
    "actionEdit": "Editar",
    "actionNewVersion": "Nueva versión",
    "awaitingReview": "Pendiente de revisión",
    "deleteModal": {
      "title": "¿Eliminar borrador?",
      "body": "¿Eliminar {name}? Esto borra permanentemente el borrador y sus archivos subidos. Esta acción no se puede deshacer.",
      "cancel": "Cancelar",
      "confirm": "Eliminar",
      "close": "cerrar"
    }
  },
  "fr": {
    "heading": "Mes modèles 3D",
    "uploadBtn": "Envoyer un modèle",
    "emptyTitle": "Aucun modèle pour l'instant",
    "emptySubtitle": "Partagez votre première impression de Classic Mini.",
    "actionView": "Voir",
    "actionContinue": "Continuer",
    "actionEdit": "Modifier",
    "actionNewVersion": "Nouvelle version",
    "awaitingReview": "En attente de révision",
    "deleteModal": {
      "title": "Supprimer le brouillon ?",
      "body": "Supprimer {name} ? Cela efface définitivement le brouillon et ses fichiers téléversés. Cette action est irréversible.",
      "cancel": "Annuler",
      "confirm": "Supprimer",
      "close": "fermer"
    }
  },
  "de": {
    "heading": "Meine 3D-Modelle",
    "uploadBtn": "Modell hochladen",
    "emptyTitle": "Noch keine Modelle",
    "emptySubtitle": "Teile deinen ersten Classic-Mini-Druck.",
    "actionView": "Ansehen",
    "actionContinue": "Weiter",
    "actionEdit": "Bearbeiten",
    "actionNewVersion": "Neue Version",
    "awaitingReview": "Wartet auf Überprüfung",
    "deleteModal": {
      "title": "Entwurf löschen?",
      "body": "„{name}“ löschen? Dadurch wird der Entwurf samt hochgeladener Dateien dauerhaft entfernt. Dies kann nicht rückgängig gemacht werden.",
      "cancel": "Abbrechen",
      "confirm": "Löschen",
      "close": "schließen"
    }
  },
  "it": {
    "heading": "I miei modelli 3D",
    "uploadBtn": "Carica un modello",
    "emptyTitle": "Nessun modello ancora",
    "emptySubtitle": "Condividi la tua prima stampa di Classic Mini.",
    "actionView": "Visualizza",
    "actionContinue": "Continua",
    "actionEdit": "Modifica",
    "actionNewVersion": "Nuova versione",
    "awaitingReview": "In attesa di revisione",
    "deleteModal": {
      "title": "Eliminare la bozza?",
      "body": "Eliminare {name}? Questo rimuove definitivamente la bozza e i file caricati. L'operazione non può essere annullata.",
      "cancel": "Annulla",
      "confirm": "Elimina",
      "close": "chiudi"
    }
  },
  "pt": {
    "heading": "Meus modelos 3D",
    "uploadBtn": "Enviar um modelo",
    "emptyTitle": "Nenhum modelo ainda",
    "emptySubtitle": "Compartilhe sua primeira impressão de Classic Mini.",
    "actionView": "Ver",
    "actionContinue": "Continuar",
    "actionEdit": "Editar",
    "actionNewVersion": "Nova versão",
    "awaitingReview": "Aguardando revisão",
    "deleteModal": {
      "title": "Excluir rascunho?",
      "body": "Excluir {name}? Isso remove permanentemente o rascunho e seus arquivos enviados. Esta ação não pode ser desfeita.",
      "cancel": "Cancelar",
      "confirm": "Excluir",
      "close": "fechar"
    }
  },
  "ru": {
    "heading": "Мои 3D-модели",
    "uploadBtn": "Загрузить модель",
    "emptyTitle": "Моделей пока нет",
    "emptySubtitle": "Поделитесь своей первой печатью Classic Mini.",
    "actionView": "Смотреть",
    "actionContinue": "Продолжить",
    "actionEdit": "Изменить",
    "actionNewVersion": "Новая версия",
    "awaitingReview": "Ожидает проверки",
    "deleteModal": {
      "title": "Удалить черновик?",
      "body": "Удалить «{name}»? Черновик и загруженные файлы будут удалены безвозвратно. Это действие нельзя отменить.",
      "cancel": "Отмена",
      "confirm": "Удалить",
      "close": "закрыть"
    }
  },
  "ja": {
    "heading": "マイ3Dモデル",
    "uploadBtn": "モデルをアップロード",
    "emptyTitle": "まだモデルがありません",
    "emptySubtitle": "最初のクラシックミニの印刷物をシェアしましょう。",
    "actionView": "表示",
    "actionContinue": "続ける",
    "actionEdit": "編集",
    "actionNewVersion": "新しいバージョン",
    "awaitingReview": "レビュー待ち",
    "deleteModal": {
      "title": "下書きを削除しますか？",
      "body": "「{name}」を削除しますか？下書きとアップロードされたファイルが完全に削除されます。この操作は元に戻せません。",
      "cancel": "キャンセル",
      "confirm": "削除",
      "close": "閉じる"
    }
  },
  "zh": {
    "heading": "我的3D模型",
    "uploadBtn": "上传模型",
    "emptyTitle": "暂无模型",
    "emptySubtitle": "分享您的第一个经典Mini打印作品。",
    "actionView": "查看",
    "actionContinue": "继续",
    "actionEdit": "编辑",
    "actionNewVersion": "新版本",
    "awaitingReview": "等待审核",
    "deleteModal": {
      "title": "删除草稿？",
      "body": "删除「{name}」？这将永久移除草稿及其上传文件，此操作无法撤销。",
      "cancel": "取消",
      "confirm": "删除",
      "close": "关闭"
    }
  },
  "ko": {
    "heading": "내 3D 모델",
    "uploadBtn": "모델 업로드",
    "emptyTitle": "아직 모델이 없습니다",
    "emptySubtitle": "첫 번째 클래식 미니 프린트를 공유해 보세요.",
    "actionView": "보기",
    "actionContinue": "계속",
    "actionEdit": "편집",
    "actionNewVersion": "새 버전",
    "awaitingReview": "검토 대기 중",
    "deleteModal": {
      "title": "초안을 삭제하시겠습니까?",
      "body": "「{name}」을(를) 삭제하시겠습니까? 초안과 업로드된 파일이 영구적으로 삭제됩니다. 이 작업은 취소할 수 없습니다.",
      "cancel": "취소",
      "confirm": "삭제",
      "close": "닫기"
    }
  }
}
</i18n>
