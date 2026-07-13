<script lang="ts" setup>
  const { t } = useI18n();
  const { userProfile } = useAuth();

  const trustLevel = computed(() => userProfile.value?.trust_level || 'new');
  const approved = computed(() => userProfile.value?.approved_submissions ?? 0);
  const rejected = computed(() => userProfile.value?.rejected_submissions ?? 0);
  const total = computed(() => userProfile.value?.total_submissions ?? 0);

  const rejectionRate = computed(() => (total.value > 0 ? rejected.value / total.value : 0));

  const levelConfig = computed(() => {
    const configs: Record<string, { color: string; icon: string }> = {
      new: { color: 'neutral', icon: 'fa-seedling' },
      contributor: { color: 'info', icon: 'fa-hand-holding-heart' },
      trusted: { color: 'success', icon: 'fa-medal' },
      moderator: { color: 'warning', icon: 'fa-shield-halved' },
      admin: { color: 'primary', icon: 'fa-crown' },
    };
    return configs[trustLevel.value] || configs['new'];
  });

  // Next milestone: 3 approved -> contributor; 10 approved + <20% rejections -> trusted.
  const nextLevel = computed(() => {
    if (trustLevel.value === 'new') return 'contributor';
    if (trustLevel.value === 'contributor') return 'trusted';
    return null;
  });

  const nextTarget = computed(() => (nextLevel.value === 'contributor' ? 3 : 10));
  const rejectionRateBlocks = computed(() => nextLevel.value === 'trusted' && rejectionRate.value >= 0.2);
</script>

<template>
  <div class="card bg-base-100 shadow-sm border border-base-300">
    <div class="card-body">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-2">
          <i class="fad fa-ranking-star mr-2"></i>
          <h2 class="text-lg font-semibold">{{ t('title') }}</h2>
        </div>
        <span class="badge badge-soft" :class="`badge-${levelConfig.color}`">
          <i :class="`fa-duotone ${levelConfig.icon} mr-1`"></i>
          {{ t(`level.${trustLevel}`) }}
        </span>
      </div>

      <!-- Progress toward the next level -->
      <div v-if="nextLevel" class="mt-2">
        <div class="flex items-center justify-between text-sm mb-1">
          <span class="text-base-content/70">
            {{ t('progress_label', { next: t(`level.${nextLevel}`) }) }}
          </span>
          <span class="font-medium">{{ t('progress_count', { approved, target: nextTarget }) }}</span>
        </div>
        <progress
          class="progress progress-primary w-full"
          :value="approved"
          :max="nextTarget"
          :aria-label="t('progress_label', { next: t(`level.${nextLevel}`) })"
        ></progress>
        <p v-if="rejectionRateBlocks" class="text-xs text-warning mt-1">
          <i class="fa-duotone fa-triangle-exclamation mr-1"></i>
          {{ t('rejection_note') }}
        </p>
        <p v-if="trustLevel === 'new'" class="text-xs text-base-content/60 mt-1">
          <i class="fa-duotone fa-clock mr-1"></i>
          {{ t('tenure_note') }}
        </p>
      </div>
      <p v-else class="text-sm text-base-content/70 mt-2">
        <i class="fa-duotone fa-circle-check text-success mr-1"></i>
        {{ t('max_level') }}
      </p>

      <!-- What counts -->
      <p class="text-sm text-base-content/60 mt-2">
        {{ t('what_counts') }}
      </p>

      <!-- What unlocks -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <div class="rounded-lg border border-base-300 p-3">
          <p class="text-sm font-semibold">
            <i class="fa-duotone fa-hand-holding-heart text-info mr-1"></i>
            {{ t('level.contributor') }}
          </p>
          <p class="text-xs text-base-content/60 mt-1">{{ t('unlocks.contributor') }}</p>
        </div>
        <div class="rounded-lg border border-base-300 p-3">
          <p class="text-sm font-semibold">
            <i class="fa-duotone fa-medal text-success mr-1"></i>
            {{ t('level.trusted') }}
          </p>
          <p class="text-xs text-base-content/60 mt-1">{{ t('unlocks.trusted') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Contributor Status",
    "level": {
      "new": "New Member",
      "contributor": "Contributor",
      "trusted": "Trusted Contributor",
      "moderator": "Moderator",
      "admin": "Admin"
    },
    "progress_label": "Progress to {next}",
    "progress_count": "{approved} of {target} approved",
    "rejection_note": "Trusted status also needs fewer than 1 in 5 of your submissions rejected.",
    "tenure_note": "Members for 30+ days who are active on Classic Mini DIY or The Mini Exchange are upgraded to Contributor automatically.",
    "max_level": "You are at the highest community level. Thank you for everything you contribute!",
    "what_counts": "Every approved contribution counts: archive documents, registry entries, colors, wheels, 3D models, external finds, and Exchange listings.",
    "unlocks": {
      "contributor": "Comments post instantly and you can sell 3D models.",
      "trusted": "Your uploads publish immediately without review."
    }
  },
  "es": {
    "title": "Estado de Colaborador",
    "level": {
      "new": "Nuevo Miembro",
      "contributor": "Colaborador",
      "trusted": "Colaborador de Confianza",
      "moderator": "Moderador",
      "admin": "Admin"
    },
    "progress_label": "Progreso hacia {next}",
    "progress_count": "{approved} de {target} aprobados",
    "rejection_note": "El estado de confianza también requiere menos de 1 de cada 5 envíos rechazados.",
    "tenure_note": "Los miembros con más de 30 días activos en Classic Mini DIY o The Mini Exchange ascienden a Colaborador automáticamente.",
    "max_level": "Estás en el nivel comunitario más alto. ¡Gracias por todo lo que aportas!",
    "what_counts": "Cada contribución aprobada cuenta: documentos de archivo, entradas del registro, colores, ruedas, modelos 3D, hallazgos externos y anuncios del Exchange.",
    "unlocks": {
      "contributor": "Los comentarios se publican al instante y puedes vender modelos 3D.",
      "trusted": "Tus subidas se publican de inmediato sin revisión."
    }
  },
  "fr": {
    "title": "Statut de Contributeur",
    "level": {
      "new": "Nouveau Membre",
      "contributor": "Contributeur",
      "trusted": "Contributeur de Confiance",
      "moderator": "Modérateur",
      "admin": "Admin"
    },
    "progress_label": "Progression vers {next}",
    "progress_count": "{approved} sur {target} approuvés",
    "rejection_note": "Le statut de confiance exige aussi moins d'1 soumission sur 5 rejetée.",
    "tenure_note": "Les membres depuis plus de 30 jours actifs sur Classic Mini DIY ou The Mini Exchange passent automatiquement Contributeur.",
    "max_level": "Vous êtes au niveau communautaire le plus élevé. Merci pour toutes vos contributions !",
    "what_counts": "Chaque contribution approuvée compte : documents d'archive, entrées du registre, couleurs, roues, modèles 3D, trouvailles externes et annonces de l'Exchange.",
    "unlocks": {
      "contributor": "Les commentaires sont publiés instantanément et vous pouvez vendre des modèles 3D.",
      "trusted": "Vos envois sont publiés immédiatement sans relecture."
    }
  },
  "de": {
    "title": "Beitragsstatus",
    "level": {
      "new": "Neues Mitglied",
      "contributor": "Beitragende",
      "trusted": "Vertrauenswürdige Beitragende",
      "moderator": "Moderator",
      "admin": "Admin"
    },
    "progress_label": "Fortschritt zu {next}",
    "progress_count": "{approved} von {target} genehmigt",
    "rejection_note": "Für den Vertrauensstatus darf zudem weniger als 1 von 5 Einreichungen abgelehnt sein.",
    "tenure_note": "Mitglieder mit 30+ Tagen, die auf Classic Mini DIY oder The Mini Exchange aktiv sind, werden automatisch zu Beitragenden hochgestuft.",
    "max_level": "Du bist auf der höchsten Community-Stufe. Danke für alles, was du beiträgst!",
    "what_counts": "Jeder genehmigte Beitrag zählt: Archivdokumente, Verzeichniseinträge, Farben, Felgen, 3D-Modelle, externe Funde und Exchange-Anzeigen.",
    "unlocks": {
      "contributor": "Kommentare erscheinen sofort und du kannst 3D-Modelle verkaufen.",
      "trusted": "Deine Uploads werden sofort ohne Prüfung veröffentlicht."
    }
  },
  "it": {
    "title": "Stato Collaboratore",
    "level": {
      "new": "Nuovo Membro",
      "contributor": "Collaboratore",
      "trusted": "Collaboratore di Fiducia",
      "moderator": "Moderatore",
      "admin": "Admin"
    },
    "progress_label": "Progresso verso {next}",
    "progress_count": "{approved} di {target} approvati",
    "rejection_note": "Lo stato di fiducia richiede anche meno di 1 invio su 5 rifiutato.",
    "tenure_note": "I membri da oltre 30 giorni attivi su Classic Mini DIY o The Mini Exchange diventano Collaboratori automaticamente.",
    "max_level": "Sei al livello più alto della community. Grazie per tutto ciò che contribuisci!",
    "what_counts": "Ogni contributo approvato conta: documenti d'archivio, voci del registro, colori, ruote, modelli 3D, scoperte esterne e annunci dell'Exchange.",
    "unlocks": {
      "contributor": "I commenti vengono pubblicati subito e puoi vendere modelli 3D.",
      "trusted": "I tuoi caricamenti vengono pubblicati immediatamente senza revisione."
    }
  },
  "pt": {
    "title": "Status de Colaborador",
    "level": {
      "new": "Novo Membro",
      "contributor": "Colaborador",
      "trusted": "Colaborador de Confiança",
      "moderator": "Moderador",
      "admin": "Admin"
    },
    "progress_label": "Progresso para {next}",
    "progress_count": "{approved} de {target} aprovados",
    "rejection_note": "O status de confiança também exige menos de 1 em cada 5 envios rejeitados.",
    "tenure_note": "Membros há mais de 30 dias ativos no Classic Mini DIY ou The Mini Exchange sobem a Colaborador automaticamente.",
    "max_level": "Você está no nível mais alto da comunidade. Obrigado por tudo que você contribui!",
    "what_counts": "Toda contribuição aprovada conta: documentos de arquivo, entradas do registro, cores, rodas, modelos 3D, achados externos e anúncios do Exchange.",
    "unlocks": {
      "contributor": "Comentários são publicados na hora e você pode vender modelos 3D.",
      "trusted": "Seus envios são publicados imediatamente sem revisão."
    }
  },
  "ru": {
    "title": "Статус участника",
    "level": {
      "new": "Новый участник",
      "contributor": "Участник",
      "trusted": "Доверенный участник",
      "moderator": "Модератор",
      "admin": "Администратор"
    },
    "progress_label": "Прогресс до уровня «{next}»",
    "progress_count": "{approved} из {target} одобрено",
    "rejection_note": "Для доверенного статуса также нужно, чтобы отклонялось менее 1 из 5 заявок.",
    "tenure_note": "Участники со стажем более 30 дней, активные на Classic Mini DIY или The Mini Exchange, автоматически получают уровень «Участник».",
    "max_level": "Вы на высшем уровне сообщества. Спасибо за ваш вклад!",
    "what_counts": "Учитывается каждый одобренный вклад: архивные документы, записи реестра, цвета, колёса, 3D-модели, внешние находки и объявления Exchange.",
    "unlocks": {
      "contributor": "Комментарии публикуются мгновенно, и вы можете продавать 3D-модели.",
      "trusted": "Ваши загрузки публикуются сразу, без проверки."
    }
  },
  "ja": {
    "title": "投稿者ステータス",
    "level": {
      "new": "新規メンバー",
      "contributor": "投稿者",
      "trusted": "信頼された投稿者",
      "moderator": "モデレーター",
      "admin": "管理者"
    },
    "progress_label": "{next}への進捗",
    "progress_count": "{target}件中{approved}件承認済み",
    "rejection_note": "信頼ステータスには、却下が5件中1件未満であることも必要です。",
    "tenure_note": "登録から30日以上で Classic Mini DIY または The Mini Exchange で活動しているメンバーは、自動的に投稿者に昇格します。",
    "max_level": "コミュニティの最高レベルに到達しています。ご貢献ありがとうございます!",
    "what_counts": "承認されたすべての貢献が対象です: アーカイブ文書、レジストリ登録、カラー、ホイール、3Dモデル、外部リンク、Exchange の出品。",
    "unlocks": {
      "contributor": "コメントが即時公開され、3Dモデルを販売できます。",
      "trusted": "アップロードが審査なしで即時公開されます。"
    }
  },
  "zh": {
    "title": "贡献者状态",
    "level": {
      "new": "新成员",
      "contributor": "贡献者",
      "trusted": "受信任的贡献者",
      "moderator": "版主",
      "admin": "管理员"
    },
    "progress_label": "距离{next}的进度",
    "progress_count": "已批准 {approved} / {target}",
    "rejection_note": "获得受信任状态还需要被拒绝的提交少于五分之一。",
    "tenure_note": "注册满 30 天且在 Classic Mini DIY 或 The Mini Exchange 上活跃的成员会自动升级为贡献者。",
    "max_level": "您已达到社区最高等级。感谢您的所有贡献!",
    "what_counts": "每一个获批准的贡献都算数: 档案文档、注册表条目、颜色、轮毂、3D 模型、外部发现以及 Exchange 的商品。",
    "unlocks": {
      "contributor": "评论即时发布，并且可以出售 3D 模型。",
      "trusted": "您的上传无需审核即刻发布。"
    }
  },
  "ko": {
    "title": "기여자 상태",
    "level": {
      "new": "신규 멤버",
      "contributor": "기여자",
      "trusted": "신뢰된 기여자",
      "moderator": "모더레이터",
      "admin": "관리자"
    },
    "progress_label": "{next}까지의 진행률",
    "progress_count": "{target}건 중 {approved}건 승인됨",
    "rejection_note": "신뢰 상태가 되려면 거부된 제출이 5건 중 1건 미만이어야 합니다.",
    "tenure_note": "가입 30일 이상이며 Classic Mini DIY 또는 The Mini Exchange에서 활동한 멤버는 자동으로 기여자로 승급됩니다.",
    "max_level": "커뮤니티 최고 레벨에 도달했습니다. 모든 기여에 감사드립니다!",
    "what_counts": "승인된 모든 기여가 반영됩니다: 아카이브 문서, 레지스트리 등록, 색상, 휠, 3D 모델, 외부 발견, Exchange 판매글.",
    "unlocks": {
      "contributor": "댓글이 즉시 게시되고 3D 모델을 판매할 수 있습니다.",
      "trusted": "업로드가 검토 없이 즉시 게시됩니다."
    }
  }
}
</i18n>
