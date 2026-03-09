<script lang="ts" setup>
  import { HERO_TYPES } from '../../../data/models/generic';

  const { t } = useI18n();
  const route = useRoute();
  const userId = route.params.id as string;

  const { getContributorProfile, listContributions, getContributionStats } = useContributions();

  const [profileResult, contributionsResult, statsResult] = await Promise.all([
    useAsyncData(`contributor-${userId}`, () => getContributorProfile(userId)),
    useAsyncData(`contributions-${userId}`, () => listContributions(userId, { limit: 50 })),
    useAsyncData(`contribution-stats-${userId}`, () => getContributionStats(userId)),
  ]);

  const profile = profileResult.data;
  const contributions = contributionsResult.data;
  const stats = statsResult.data;

  const displayName = computed(() => profile.value?.displayName || t('profile.unknown'));

  const initials = computed(() => {
    const name = profile.value?.displayName;
    if (!name) return '?';
    return name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  });

  const trustLevelConfig = computed(() => {
    const level = profile.value?.trustLevel || 'new';
    const configs: Record<string, { color: string; label: string }> = {
      new: { color: 'neutral', label: t('trust_level.new') },
      contributor: { color: 'info', label: t('trust_level.contributor') },
      trusted: { color: 'success', label: t('trust_level.trusted') },
      moderator: { color: 'warning', label: t('trust_level.moderator') },
      admin: { color: 'primary', label: t('trust_level.admin') },
    };
    return configs[level] || configs['new'];
  });

  const memberSince = computed(() => {
    if (!profile.value?.joinedAt) return '';
    return new Date(profile.value.joinedAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
    });
  });

  const hasStats = computed(() => {
    return stats.value && Object.keys(stats.value).length > 0;
  });

  const targetTypeIcon = (targetType: string): string => {
    const icons: Record<string, string> = {
      document: 'fa-books',
      collection: 'fa-books',
      registry: 'fa-clipboard-list',
      color: 'fa-palette',
      wheel: 'fa-tire',
    };
    return icons[targetType] || 'fa-file';
  };

  const actionBadgeColor = (action: string): string => {
    const colors: Record<string, string> = {
      submitted: 'info',
      edited: 'warning',
      approved: 'success',
      rejected: 'error',
    };
    return colors[action] || 'neutral';
  };

  const relativeDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
    return `${Math.floor(diff / 31536000)}y ago`;
  };

  // SEO
  useHead({
    title: profile.value ? `${displayName.value} - ${t('title')}` : t('not_found.title'),
    meta: [
      {
        key: 'description',
        name: 'description',
        content: profile.value ? t('description', { name: displayName.value }) : t('not_found.description'),
      },
    ],
  });

  useSeoMeta({
    ogTitle: profile.value ? `${displayName.value} - ${t('title')}` : t('not_found.title'),
    ogDescription: profile.value ? t('description', { name: displayName.value }) : t('not_found.description'),
    ogType: 'profile',
  });
</script>

<template>
  <hero :navigation="true" :title="t('hero_title')" textSize="text-3xl" :heroType="HERO_TYPES.ARCHIVE" />
  <div class="container mx-auto px-4">
    <div class="mt-5">
      <div class="w-full">
        <breadcrumb
          class="my-6"
          :page="profile ? displayName : t('not_found.title')"
          subpage="Contributors"
          subpageHref="/contributors"
        />
      </div>

      <!-- Not found state -->
      <div v-if="!profile" class="flex flex-col items-center justify-center py-16 text-center">
        <UCard class="max-w-md w-full">
          <div class="py-6">
            <i class="fa-duotone fa-user-slash text-6xl text-base-content/30 mb-4"></i>
            <h1 class="text-2xl font-bold mb-2">{{ t('not_found.title') }}</h1>
            <p class="text-base-content/60 mb-6">{{ t('not_found.description') }}</p>
            <UButton color="primary" to="/contributors">
              <i class="fa-duotone fa-arrow-left mr-2"></i>
              {{ t('not_found.back') }}
            </UButton>
          </div>
        </UCard>
      </div>

      <!-- Profile found -->
      <div v-else class="max-w-4xl mx-auto space-y-6 pb-12">
        <!-- Profile Card -->
        <UCard>
          <div class="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-2">
            <UAvatar
              :src="profile.avatarUrl || undefined"
              :alt="displayName"
              :text="!profile.avatarUrl ? initials : undefined"
              size="3xl"
            />
            <div class="flex-1 text-center sm:text-left">
              <h1 class="text-3xl font-bold mb-2">{{ displayName }}</h1>
              <div class="mb-3">
                <UBadge :color="trustLevelConfig.color as any" variant="subtle" size="md">
                  {{ trustLevelConfig.label }}
                </UBadge>
              </div>
              <p v-if="profile.bio" class="text-base-content/70 max-w-prose">
                {{ profile.bio }}
              </p>
              <p v-if="memberSince" class="text-sm text-base-content/50 mt-2">
                <i class="fa-duotone fa-calendar mr-1"></i>
                {{ t('profile.member_since') }}: {{ memberSince }}
              </p>
            </div>
          </div>
        </UCard>

        <!-- Stats Row -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UCard>
            <div class="text-center py-4">
              <p class="text-4xl font-bold text-primary">{{ profile.totalSubmissions }}</p>
              <p class="text-sm text-base-content/60 mt-1">{{ t('stats.total_submissions') }}</p>
            </div>
          </UCard>
          <UCard>
            <div class="text-center py-4">
              <p class="text-4xl font-bold text-success">{{ profile.approvedSubmissions }}</p>
              <p class="text-sm text-base-content/60 mt-1">{{ t('stats.approved') }}</p>
            </div>
          </UCard>
          <UCard>
            <div class="text-center py-4">
              <p class="text-lg font-semibold">{{ memberSince }}</p>
              <p class="text-sm text-base-content/60 mt-1">{{ t('stats.member_since') }}</p>
            </div>
          </UCard>
        </div>

        <!-- Contribution Type Breakdown -->
        <UCard v-if="hasStats">
          <template #header>
            <h2 class="text-lg font-semibold">{{ t('stats_breakdown.title') }}</h2>
          </template>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2">
            <div v-if="stats!['document'] || stats!['collection']" class="flex items-center gap-3">
              <i class="fa-duotone fa-books text-2xl text-secondary"></i>
              <div>
                <p class="font-bold text-xl">{{ (stats!['document'] || 0) + (stats!['collection'] || 0) }}</p>
                <p class="text-xs text-base-content/60">{{ t('stats_breakdown.documents') }}</p>
              </div>
            </div>
            <div v-if="stats!['registry']" class="flex items-center gap-3">
              <i class="fa-duotone fa-clipboard-list text-2xl text-info"></i>
              <div>
                <p class="font-bold text-xl">{{ stats!['registry'] }}</p>
                <p class="text-xs text-base-content/60">{{ t('stats_breakdown.registry') }}</p>
              </div>
            </div>
            <div v-if="stats!['color']" class="flex items-center gap-3">
              <i class="fa-duotone fa-palette text-2xl text-warning"></i>
              <div>
                <p class="font-bold text-xl">{{ stats!['color'] }}</p>
                <p class="text-xs text-base-content/60">{{ t('stats_breakdown.colors') }}</p>
              </div>
            </div>
            <div v-if="stats!['wheel']" class="flex items-center gap-3">
              <i class="fa-duotone fa-tire text-2xl text-primary"></i>
              <div>
                <p class="font-bold text-xl">{{ stats!['wheel'] }}</p>
                <p class="text-xs text-base-content/60">{{ t('stats_breakdown.wheels') }}</p>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Recent Contributions -->
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">{{ t('contributions.title') }}</h2>
          </template>

          <!-- Empty state -->
          <div v-if="!contributions || contributions.length === 0" class="text-center py-10">
            <i class="fa-duotone fa-inbox text-5xl text-base-content/20 mb-3"></i>
            <p class="text-base-content/50">{{ t('contributions.empty') }}</p>
          </div>

          <!-- Contribution list -->
          <ul v-else class="divide-y divide-base-200">
            <li v-for="item in contributions" :key="item.id" class="flex items-center gap-3 py-3 px-1">
              <i
                :class="`fa-duotone fa-${targetTypeIcon(item.targetType)} text-xl text-base-content/40 shrink-0 w-6 text-center`"
              ></i>
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate">
                  {{ item.targetTitle || t('contributions.untitled') }}
                </p>
                <p class="text-xs text-base-content/50 capitalize">
                  {{ t(`contributions.target.${item.targetType}`) }}
                </p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <UBadge :color="actionBadgeColor(item.action) as any" variant="subtle" size="sm">
                  {{ t(`contributions.action.${item.action}`) }}
                </UBadge>
                <span class="text-xs text-base-content/40 hidden sm:inline">
                  {{ relativeDate(item.createdAt) }}
                </span>
              </div>
            </li>
          </ul>
        </UCard>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Contributor Profile | Classic Mini DIY",
    "description": "View {name}'s contributor profile, trust level, and contribution history on Classic Mini DIY.",
    "hero_title": "Contributor Profile",
    "breadcrumb_title": "Contributor",
    "not_found": {
      "title": "Contributor Not Found",
      "description": "This contributor profile does not exist or has been removed.",
      "back": "Back to Contributors"
    },
    "profile": {
      "member_since": "Member since",
      "bio": "About",
      "unknown": "Unknown Contributor"
    },
    "trust_level": {
      "new": "New Member",
      "contributor": "Contributor",
      "trusted": "Trusted Contributor",
      "moderator": "Moderator",
      "admin": "Admin"
    },
    "stats": {
      "total_submissions": "Total Submissions",
      "approved": "Approved Submissions",
      "member_since": "Member Since"
    },
    "contributions": {
      "title": "Recent Contributions",
      "empty": "No contributions yet.",
      "untitled": "Untitled",
      "action": {
        "submitted": "Submitted",
        "edited": "Edited",
        "approved": "Approved",
        "rejected": "Rejected"
      },
      "target": {
        "document": "Document",
        "collection": "Collection",
        "registry": "Registry",
        "color": "Color",
        "wheel": "Wheel"
      }
    },
    "stats_breakdown": {
      "title": "Contributions by Type",
      "documents": "Documents",
      "registry": "Registry",
      "colors": "Colors",
      "wheels": "Wheels"
    }
  },
  "de": {
    "title": "Beitragsprofil | Classic Mini DIY",
    "description": "Zeigen Sie das Beitragsprofil, das Vertrauenslevel und den Beitragsverlauf von {name} auf Classic Mini DIY an.",
    "hero_title": "Beitragsprofil",
    "breadcrumb_title": "Beitragende",
    "not_found": {
      "title": "Beitragende nicht gefunden",
      "description": "Dieses Beitragsprofil existiert nicht oder wurde entfernt.",
      "back": "Zurück zu den Beitragenden"
    },
    "profile": {
      "member_since": "Mitglied seit",
      "bio": "Über mich",
      "unknown": "Unbekannte beitragende Person"
    },
    "trust_level": {
      "new": "Neues Mitglied",
      "contributor": "Beitragende",
      "trusted": "Vertrauenswürdige Beitragende",
      "moderator": "Moderator",
      "admin": "Admin"
    },
    "stats": {
      "total_submissions": "Gesamteinreichungen",
      "approved": "Genehmigte Einreichungen",
      "member_since": "Mitglied seit"
    },
    "contributions": {
      "title": "Neueste Beiträge",
      "empty": "Noch keine Beiträge.",
      "untitled": "Ohne Titel",
      "action": {
        "submitted": "Eingereicht",
        "edited": "Bearbeitet",
        "approved": "Genehmigt",
        "rejected": "Abgelehnt"
      },
      "target": {
        "document": "Dokument",
        "collection": "Sammlung",
        "registry": "Verzeichnis",
        "color": "Farbe",
        "wheel": "Felge"
      }
    },
    "stats_breakdown": {
      "title": "Beiträge nach Typ",
      "documents": "Dokumente",
      "registry": "Verzeichnis",
      "colors": "Farben",
      "wheels": "Felgen"
    }
  },
  "es": {
    "title": "Perfil de Colaborador | Classic Mini DIY",
    "description": "Ver el perfil de colaborador, nivel de confianza e historial de contribuciones de {name} en Classic Mini DIY.",
    "hero_title": "Perfil de Colaborador",
    "breadcrumb_title": "Colaborador",
    "not_found": {
      "title": "Colaborador No Encontrado",
      "description": "Este perfil de colaborador no existe o ha sido eliminado.",
      "back": "Volver a Colaboradores"
    },
    "profile": {
      "member_since": "Miembro desde",
      "bio": "Acerca de",
      "unknown": "Colaborador Desconocido"
    },
    "trust_level": {
      "new": "Nuevo Miembro",
      "contributor": "Colaborador",
      "trusted": "Colaborador de Confianza",
      "moderator": "Moderador",
      "admin": "Admin"
    },
    "stats": {
      "total_submissions": "Envíos Totales",
      "approved": "Envíos Aprobados",
      "member_since": "Miembro Desde"
    },
    "contributions": {
      "title": "Contribuciones Recientes",
      "empty": "Aún no hay contribuciones.",
      "untitled": "Sin título",
      "action": {
        "submitted": "Enviado",
        "edited": "Editado",
        "approved": "Aprobado",
        "rejected": "Rechazado"
      },
      "target": {
        "document": "Documento",
        "collection": "Colección",
        "registry": "Registro",
        "color": "Color",
        "wheel": "Rueda"
      }
    },
    "stats_breakdown": {
      "title": "Contribuciones por Tipo",
      "documents": "Documentos",
      "registry": "Registro",
      "colors": "Colores",
      "wheels": "Ruedas"
    }
  },
  "fr": {
    "title": "Profil du Contributeur | Classic Mini DIY",
    "description": "Consultez le profil contributeur, le niveau de confiance et l'historique des contributions de {name} sur Classic Mini DIY.",
    "hero_title": "Profil du Contributeur",
    "breadcrumb_title": "Contributeur",
    "not_found": {
      "title": "Contributeur Introuvable",
      "description": "Ce profil de contributeur n'existe pas ou a été supprimé.",
      "back": "Retour aux Contributeurs"
    },
    "profile": {
      "member_since": "Membre depuis",
      "bio": "À propos",
      "unknown": "Contributeur Inconnu"
    },
    "trust_level": {
      "new": "Nouveau Membre",
      "contributor": "Contributeur",
      "trusted": "Contributeur de Confiance",
      "moderator": "Modérateur",
      "admin": "Admin"
    },
    "stats": {
      "total_submissions": "Soumissions Totales",
      "approved": "Soumissions Approuvées",
      "member_since": "Membre Depuis"
    },
    "contributions": {
      "title": "Contributions Récentes",
      "empty": "Aucune contribution pour l'instant.",
      "untitled": "Sans titre",
      "action": {
        "submitted": "Soumis",
        "edited": "Modifié",
        "approved": "Approuvé",
        "rejected": "Rejeté"
      },
      "target": {
        "document": "Document",
        "collection": "Collection",
        "registry": "Registre",
        "color": "Couleur",
        "wheel": "Roue"
      }
    },
    "stats_breakdown": {
      "title": "Contributions par Type",
      "documents": "Documents",
      "registry": "Registre",
      "colors": "Couleurs",
      "wheels": "Roues"
    }
  },
  "it": {
    "title": "Profilo Collaboratore | Classic Mini DIY",
    "description": "Visualizza il profilo collaboratore, il livello di fiducia e la cronologia dei contributi di {name} su Classic Mini DIY.",
    "hero_title": "Profilo Collaboratore",
    "breadcrumb_title": "Collaboratore",
    "not_found": {
      "title": "Collaboratore Non Trovato",
      "description": "Questo profilo collaboratore non esiste o è stato rimosso.",
      "back": "Torna ai Collaboratori"
    },
    "profile": {
      "member_since": "Membro dal",
      "bio": "Informazioni",
      "unknown": "Collaboratore Sconosciuto"
    },
    "trust_level": {
      "new": "Nuovo Membro",
      "contributor": "Collaboratore",
      "trusted": "Collaboratore di Fiducia",
      "moderator": "Moderatore",
      "admin": "Admin"
    },
    "stats": {
      "total_submissions": "Invii Totali",
      "approved": "Invii Approvati",
      "member_since": "Membro Dal"
    },
    "contributions": {
      "title": "Contributi Recenti",
      "empty": "Nessun contributo ancora.",
      "untitled": "Senza titolo",
      "action": {
        "submitted": "Inviato",
        "edited": "Modificato",
        "approved": "Approvato",
        "rejected": "Rifiutato"
      },
      "target": {
        "document": "Documento",
        "collection": "Collezione",
        "registry": "Registro",
        "color": "Colore",
        "wheel": "Ruota"
      }
    },
    "stats_breakdown": {
      "title": "Contributi per Tipo",
      "documents": "Documenti",
      "registry": "Registro",
      "colors": "Colori",
      "wheels": "Ruote"
    }
  },
  "pt": {
    "title": "Perfil do Colaborador | Classic Mini DIY",
    "description": "Veja o perfil do colaborador, nível de confiança e histórico de contribuições de {name} no Classic Mini DIY.",
    "hero_title": "Perfil do Colaborador",
    "breadcrumb_title": "Colaborador",
    "not_found": {
      "title": "Colaborador Não Encontrado",
      "description": "Este perfil de colaborador não existe ou foi removido.",
      "back": "Voltar aos Colaboradores"
    },
    "profile": {
      "member_since": "Membro desde",
      "bio": "Sobre",
      "unknown": "Colaborador Desconhecido"
    },
    "trust_level": {
      "new": "Novo Membro",
      "contributor": "Colaborador",
      "trusted": "Colaborador de Confiança",
      "moderator": "Moderador",
      "admin": "Admin"
    },
    "stats": {
      "total_submissions": "Total de Envios",
      "approved": "Envios Aprovados",
      "member_since": "Membro Desde"
    },
    "contributions": {
      "title": "Contribuições Recentes",
      "empty": "Nenhuma contribuição ainda.",
      "untitled": "Sem título",
      "action": {
        "submitted": "Enviado",
        "edited": "Editado",
        "approved": "Aprovado",
        "rejected": "Rejeitado"
      },
      "target": {
        "document": "Documento",
        "collection": "Coleção",
        "registry": "Registro",
        "color": "Cor",
        "wheel": "Roda"
      }
    },
    "stats_breakdown": {
      "title": "Contribuições por Tipo",
      "documents": "Documentos",
      "registry": "Registro",
      "colors": "Cores",
      "wheels": "Rodas"
    }
  },
  "ru": {
    "title": "Профиль участника | Classic Mini DIY",
    "description": "Просматривайте профиль участника, уровень доверия и историю вкладов {name} на Classic Mini DIY.",
    "hero_title": "Профиль участника",
    "breadcrumb_title": "Участник",
    "not_found": {
      "title": "Участник не найден",
      "description": "Этот профиль участника не существует или был удалён.",
      "back": "Вернуться к участникам"
    },
    "profile": {
      "member_since": "Участник с",
      "bio": "О себе",
      "unknown": "Неизвестный участник"
    },
    "trust_level": {
      "new": "Новый участник",
      "contributor": "Участник",
      "trusted": "Доверенный участник",
      "moderator": "Модератор",
      "admin": "Администратор"
    },
    "stats": {
      "total_submissions": "Всего заявок",
      "approved": "Одобренных заявок",
      "member_since": "Участник с"
    },
    "contributions": {
      "title": "Последние вклады",
      "empty": "Вкладов пока нет.",
      "untitled": "Без названия",
      "action": {
        "submitted": "Отправлено",
        "edited": "Отредактировано",
        "approved": "Одобрено",
        "rejected": "Отклонено"
      },
      "target": {
        "document": "Документ",
        "collection": "Коллекция",
        "registry": "Реестр",
        "color": "Цвет",
        "wheel": "Колесо"
      }
    },
    "stats_breakdown": {
      "title": "Вклады по типам",
      "documents": "Документы",
      "registry": "Реестр",
      "colors": "Цвета",
      "wheels": "Колёса"
    }
  },
  "ja": {
    "title": "投稿者プロフィール | Classic Mini DIY",
    "description": "Classic Mini DIY での {name} の投稿者プロフィール、信頼レベル、貢献履歴を確認する。",
    "hero_title": "投稿者プロフィール",
    "breadcrumb_title": "投稿者",
    "not_found": {
      "title": "投稿者が見つかりません",
      "description": "この投稿者プロフィールは存在しないか、削除されました。",
      "back": "投稿者一覧に戻る"
    },
    "profile": {
      "member_since": "参加日",
      "bio": "自己紹介",
      "unknown": "不明な投稿者"
    },
    "trust_level": {
      "new": "新規メンバー",
      "contributor": "投稿者",
      "trusted": "信頼された投稿者",
      "moderator": "モデレーター",
      "admin": "管理者"
    },
    "stats": {
      "total_submissions": "総申請数",
      "approved": "承認済み申請数",
      "member_since": "参加日"
    },
    "contributions": {
      "title": "最近の貢献",
      "empty": "まだ貢献がありません。",
      "untitled": "無題",
      "action": {
        "submitted": "提出",
        "edited": "編集",
        "approved": "承認",
        "rejected": "却下"
      },
      "target": {
        "document": "ドキュメント",
        "collection": "コレクション",
        "registry": "レジストリ",
        "color": "カラー",
        "wheel": "ホイール"
      }
    },
    "stats_breakdown": {
      "title": "種類別の貢献",
      "documents": "ドキュメント",
      "registry": "レジストリ",
      "colors": "カラー",
      "wheels": "ホイール"
    }
  },
  "zh": {
    "title": "贡献者资料 | Classic Mini DIY",
    "description": "查看 {name} 在 Classic Mini DIY 上的贡献者资料、信任等级和贡献历史。",
    "hero_title": "贡献者资料",
    "breadcrumb_title": "贡献者",
    "not_found": {
      "title": "未找到贡献者",
      "description": "此贡献者资料不存在或已被删除。",
      "back": "返回贡献者列表"
    },
    "profile": {
      "member_since": "加入时间",
      "bio": "关于",
      "unknown": "未知贡献者"
    },
    "trust_level": {
      "new": "新成员",
      "contributor": "贡献者",
      "trusted": "受信任的贡献者",
      "moderator": "版主",
      "admin": "管理员"
    },
    "stats": {
      "total_submissions": "总提交数",
      "approved": "已批准提交",
      "member_since": "加入时间"
    },
    "contributions": {
      "title": "最近的贡献",
      "empty": "暂无贡献。",
      "untitled": "无标题",
      "action": {
        "submitted": "已提交",
        "edited": "已编辑",
        "approved": "已批准",
        "rejected": "已拒绝"
      },
      "target": {
        "document": "文档",
        "collection": "集合",
        "registry": "注册表",
        "color": "颜色",
        "wheel": "轮毂"
      }
    },
    "stats_breakdown": {
      "title": "按类型统计贡献",
      "documents": "文档",
      "registry": "注册表",
      "colors": "颜色",
      "wheels": "轮毂"
    }
  },
  "ko": {
    "title": "기여자 프로필 | Classic Mini DIY",
    "description": "Classic Mini DIY에서 {name}의 기여자 프로필, 신뢰 수준 및 기여 내역을 확인하세요.",
    "hero_title": "기여자 프로필",
    "breadcrumb_title": "기여자",
    "not_found": {
      "title": "기여자를 찾을 수 없습니다",
      "description": "이 기여자 프로필이 존재하지 않거나 삭제되었습니다.",
      "back": "기여자 목록으로 돌아가기"
    },
    "profile": {
      "member_since": "가입일",
      "bio": "소개",
      "unknown": "알 수 없는 기여자"
    },
    "trust_level": {
      "new": "신규 멤버",
      "contributor": "기여자",
      "trusted": "신뢰된 기여자",
      "moderator": "모더레이터",
      "admin": "관리자"
    },
    "stats": {
      "total_submissions": "총 제출 수",
      "approved": "승인된 제출",
      "member_since": "가입일"
    },
    "contributions": {
      "title": "최근 기여",
      "empty": "아직 기여가 없습니다.",
      "untitled": "제목 없음",
      "action": {
        "submitted": "제출됨",
        "edited": "편집됨",
        "approved": "승인됨",
        "rejected": "거부됨"
      },
      "target": {
        "document": "문서",
        "collection": "컬렉션",
        "registry": "레지스트리",
        "color": "색상",
        "wheel": "휠"
      }
    },
    "stats_breakdown": {
      "title": "유형별 기여",
      "documents": "문서",
      "registry": "레지스트리",
      "colors": "색상",
      "wheels": "휠"
    }
  }
}
</i18n>
