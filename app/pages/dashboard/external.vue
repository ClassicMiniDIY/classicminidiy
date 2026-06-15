<script setup lang="ts">
  import type { ExternalModelSubmission } from '~~/data/models/external-models';

  const { t } = useI18n();
  const supabase = useSupabase();
  const { user } = useAuth();

  // Client-only: the Supabase session is in localStorage, so a server run would
  // always come back empty and poison the payload cache / cause hydration drift.
  const { data, pending, refresh } = await useAsyncData(
    'external-submissions-mine',
    async () => {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) return { submissions: [] as ExternalModelSubmission[] };
      return await $fetch<{ submissions: ExternalModelSubmission[] }>('/api/models/external/mine', {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    { watch: [user], server: false }
  );

  const submissions = computed(() => data.value?.submissions ?? []);

  const statusTone: Record<string, string> = {
    pending: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-error',
    removed: 'badge-neutral',
  };

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString();
  }
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <i class="fad fa-link"></i>
        <h2 class="text-lg font-semibold">{{ t('heading') }}</h2>
      </div>
      <NuxtLink to="/models/submit-external" class="btn btn-primary btn-sm">
        <i class="fas fa-plus mr-1"></i> {{ t('linkBtn') }}
      </NuxtLink>
    </div>

    <div v-if="pending" class="flex justify-center py-16">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else-if="submissions.length === 0" class="text-center py-16">
      <i class="fas fa-link text-5xl opacity-20"></i>
      <p class="mt-4 text-lg font-semibold">{{ t('emptyTitle') }}</p>
      <p class="opacity-60 mb-4">{{ t('emptySubtitle') }}</p>
      <NuxtLink to="/models/submit-external" class="btn btn-primary">
        <i class="fas fa-plus mr-1"></i> {{ t('linkBtn') }}
      </NuxtLink>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="s in submissions"
        :key="s.id"
        class="card bg-base-100 border border-base-300 shadow-sm overflow-hidden"
      >
        <figure class="aspect-[4/3] bg-base-200">
          <img
            v-if="s.primaryImage"
            :src="s.primaryImage"
            :alt="s.title"
            class="w-full h-full object-cover"
            loading="lazy"
          />
          <div v-else class="w-full h-full flex items-center justify-center text-base-content/30">
            <i class="fas fa-cube text-4xl"></i>
          </div>
        </figure>

        <div class="card-body p-4 gap-2">
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-semibold leading-tight line-clamp-2">{{ s.title }}</h3>
            <span class="badge badge-sm shrink-0 capitalize" :class="statusTone[s.status] || 'badge-ghost'">
              {{ t(`status.${s.status}`) }}
            </span>
          </div>

          <ModelsSourceBadge :site="s.sourceSite" size="sm" />

          <div
            v-if="s.status === 'rejected' && s.rejectionReason"
            role="alert"
            class="alert alert-error alert-soft py-2 px-3 text-xs mt-1"
          >
            <i class="fas fa-circle-exclamation shrink-0"></i>
            <span>{{ s.rejectionReason }}</span>
          </div>

          <p class="text-xs opacity-50">{{ formatDate(s.createdAt) }}</p>

          <div class="flex gap-1.5 mt-1 flex-wrap">
            <NuxtLink
              v-if="s.status === 'approved'"
              :to="`/models/external/${s.slug}`"
              class="btn btn-ghost btn-xs"
            >
              <i class="fas fa-eye mr-1"></i> {{ t('actionView') }}
            </NuxtLink>

            <a
              :href="s.sourceUrl"
              target="_blank"
              rel="nofollow noopener"
              class="btn btn-ghost btn-xs"
            >
              <i class="fas fa-arrow-up-right-from-square mr-1"></i> {{ t('actionSource') }}
            </a>

            <span v-if="s.status === 'pending'" class="text-xs opacity-50 self-center">
              {{ t('awaitingReview') }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "heading": "My Linked Models",
    "linkBtn": "Link another model",
    "emptyTitle": "No linked models yet",
    "emptySubtitle": "Submit a link to a Classic Mini 3D model hosted on Thingiverse, Printables, or another site.",
    "actionView": "View",
    "actionSource": "View source",
    "awaitingReview": "Awaiting review",
    "status": {
      "pending": "Pending",
      "approved": "Approved",
      "rejected": "Rejected",
      "removed": "Removed"
    }
  },
  "es": {
    "heading": "Mis modelos enlazados",
    "linkBtn": "Enlazar otro modelo",
    "emptyTitle": "Aún no hay modelos enlazados",
    "emptySubtitle": "Envía un enlace a un modelo 3D de Classic Mini alojado en Thingiverse, Printables u otro sitio.",
    "actionView": "Ver",
    "actionSource": "Ver fuente",
    "awaitingReview": "Pendiente de revisión",
    "status": {
      "pending": "Pendiente",
      "approved": "Aprobado",
      "rejected": "Rechazado",
      "removed": "Eliminado"
    }
  },
  "fr": {
    "heading": "Mes modèles liés",
    "linkBtn": "Lier un autre modèle",
    "emptyTitle": "Aucun modèle lié pour l'instant",
    "emptySubtitle": "Soumettez un lien vers un modèle 3D de Classic Mini hébergé sur Thingiverse, Printables ou un autre site.",
    "actionView": "Voir",
    "actionSource": "Voir la source",
    "awaitingReview": "En attente de révision",
    "status": {
      "pending": "En attente",
      "approved": "Approuvé",
      "rejected": "Rejeté",
      "removed": "Supprimé"
    }
  },
  "de": {
    "heading": "Meine verlinkten Modelle",
    "linkBtn": "Weiteres Modell verlinken",
    "emptyTitle": "Noch keine verlinkten Modelle",
    "emptySubtitle": "Reiche einen Link zu einem Classic-Mini-3D-Modell ein, das auf Thingiverse, Printables oder einer anderen Seite gehostet wird.",
    "actionView": "Ansehen",
    "actionSource": "Quelle anzeigen",
    "awaitingReview": "Wartet auf Überprüfung",
    "status": {
      "pending": "Ausstehend",
      "approved": "Genehmigt",
      "rejected": "Abgelehnt",
      "removed": "Entfernt"
    }
  },
  "it": {
    "heading": "I miei modelli collegati",
    "linkBtn": "Collega un altro modello",
    "emptyTitle": "Nessun modello collegato ancora",
    "emptySubtitle": "Invia un link a un modello 3D di Classic Mini ospitato su Thingiverse, Printables o un altro sito.",
    "actionView": "Visualizza",
    "actionSource": "Visualizza sorgente",
    "awaitingReview": "In attesa di revisione",
    "status": {
      "pending": "In attesa",
      "approved": "Approvato",
      "rejected": "Rifiutato",
      "removed": "Rimosso"
    }
  },
  "pt": {
    "heading": "Meus modelos vinculados",
    "linkBtn": "Vincular outro modelo",
    "emptyTitle": "Nenhum modelo vinculado ainda",
    "emptySubtitle": "Envie um link para um modelo 3D de Classic Mini hospedado no Thingiverse, Printables ou outro site.",
    "actionView": "Ver",
    "actionSource": "Ver fonte",
    "awaitingReview": "Aguardando revisão",
    "status": {
      "pending": "Pendente",
      "approved": "Aprovado",
      "rejected": "Rejeitado",
      "removed": "Removido"
    }
  },
  "ru": {
    "heading": "Мои прикреплённые модели",
    "linkBtn": "Прикрепить ещё одну модель",
    "emptyTitle": "Прикреплённых моделей пока нет",
    "emptySubtitle": "Отправьте ссылку на 3D-модель Classic Mini, размещённую на Thingiverse, Printables или другом сайте.",
    "actionView": "Смотреть",
    "actionSource": "Открыть источник",
    "awaitingReview": "Ожидает проверки",
    "status": {
      "pending": "Ожидает",
      "approved": "Одобрено",
      "rejected": "Отклонено",
      "removed": "Удалено"
    }
  },
  "ja": {
    "heading": "リンクしたモデル",
    "linkBtn": "別のモデルをリンク",
    "emptyTitle": "リンクしたモデルはまだありません",
    "emptySubtitle": "Thingiverse、Printables、または他のサイトにホストされているClassic MiniのモデルへのリンクをURLで送信してください。",
    "actionView": "表示",
    "actionSource": "ソースを見る",
    "awaitingReview": "レビュー待ち",
    "status": {
      "pending": "審査中",
      "approved": "承認済み",
      "rejected": "却下",
      "removed": "削除済み"
    }
  },
  "zh": {
    "heading": "我的链接模型",
    "linkBtn": "链接另一个模型",
    "emptyTitle": "暂无链接模型",
    "emptySubtitle": "提交托管在 Thingiverse、Printables 或其他网站上的经典迷你3D模型链接。",
    "actionView": "查看",
    "actionSource": "查看来源",
    "awaitingReview": "等待审核",
    "status": {
      "pending": "待审核",
      "approved": "已批准",
      "rejected": "已拒绝",
      "removed": "已删除"
    }
  },
  "ko": {
    "heading": "내 링크된 모델",
    "linkBtn": "다른 모델 링크하기",
    "emptyTitle": "아직 링크된 모델이 없습니다",
    "emptySubtitle": "Thingiverse, Printables 또는 다른 사이트에 호스팅된 클래식 미니 3D 모델 링크를 제출하세요.",
    "actionView": "보기",
    "actionSource": "소스 보기",
    "awaitingReview": "검토 대기 중",
    "status": {
      "pending": "대기 중",
      "approved": "승인됨",
      "rejected": "거부됨",
      "removed": "삭제됨"
    }
  }
}
</i18n>
