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
    title: profile.value
      ? `${displayName.value} - ${t('title')}`
      : t('not_found.title'),
    meta: [
      {
        key: 'description',
        name: 'description',
        content: profile.value
          ? t('description', { name: displayName.value })
          : t('not_found.description'),
      },
    ],
  });

  useSeoMeta({
    ogTitle: profile.value ? `${displayName.value} - ${t('title')}` : t('not_found.title'),
    ogDescription: profile.value
      ? t('description', { name: displayName.value })
      : t('not_found.description'),
    ogType: 'profile',
  });
</script>

<template>
  <hero
    :navigation="true"
    :title="t('hero_title')"
    textSize="text-3xl"
    :heroType="HERO_TYPES.ARCHIVE"
  />
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
                <UBadge
                  :color="trustLevelConfig.color as any"
                  variant="subtle"
                  size="md"
                >
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
            <li
              v-for="item in contributions"
              :key="item.id"
              class="flex items-center gap-3 py-3 px-1"
            >
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
                <UBadge
                  :color="actionBadgeColor(item.action) as any"
                  variant="subtle"
                  size="sm"
                >
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
  "nl": {
    "title": "Bijdrager Profiel | Classic Mini DIY",
    "description": "Bekijk het bijdragerprofiel, vertrouwensniveau en bijdragegeschiedenis van {name} op Classic Mini DIY.",
    "hero_title": "Bijdragerprofiel",
    "breadcrumb_title": "Bijdrager",
    "not_found": {
      "title": "Bijdrager Niet Gevonden",
      "description": "Dit bijdragerprofiel bestaat niet of is verwijderd.",
      "back": "Terug naar Bijdragers"
    },
    "profile": {
      "member_since": "Lid sinds",
      "bio": "Over",
      "unknown": "Onbekende Bijdrager"
    },
    "trust_level": {
      "new": "Nieuw Lid",
      "contributor": "Bijdrager",
      "trusted": "Vertrouwde Bijdrager",
      "moderator": "Moderator",
      "admin": "Admin"
    },
    "stats": {
      "total_submissions": "Totaal Ingediend",
      "approved": "Goedgekeurde Inzendingen",
      "member_since": "Lid Sinds"
    },
    "contributions": {
      "title": "Recente Bijdragen",
      "empty": "Nog geen bijdragen.",
      "untitled": "Zonder titel",
      "action": {
        "submitted": "Ingediend",
        "edited": "Bewerkt",
        "approved": "Goedgekeurd",
        "rejected": "Afgewezen"
      },
      "target": {
        "document": "Document",
        "collection": "Collectie",
        "registry": "Register",
        "color": "Kleur",
        "wheel": "Wiel"
      }
    },
    "stats_breakdown": {
      "title": "Bijdragen op Type",
      "documents": "Documenten",
      "registry": "Register",
      "colors": "Kleuren",
      "wheels": "Wielen"
    }
  },
  "sv": {
    "title": "Bidragsprofil | Classic Mini DIY",
    "description": "Visa {name}:s bidragsprofil, förtroendenivå och bidragshistorik på Classic Mini DIY.",
    "hero_title": "Bidragsprofil",
    "breadcrumb_title": "Bidragsgivare",
    "not_found": {
      "title": "Bidragsgivare Hittades Inte",
      "description": "Denna bidragsprofil finns inte eller har tagits bort.",
      "back": "Tillbaka till Bidragsgivare"
    },
    "profile": {
      "member_since": "Medlem sedan",
      "bio": "Om",
      "unknown": "Okänd Bidragsgivare"
    },
    "trust_level": {
      "new": "Ny Medlem",
      "contributor": "Bidragsgivare",
      "trusted": "Betrodd Bidragsgivare",
      "moderator": "Moderator",
      "admin": "Admin"
    },
    "stats": {
      "total_submissions": "Totalt Inskickat",
      "approved": "Godkända Bidrag",
      "member_since": "Medlem Sedan"
    },
    "contributions": {
      "title": "Senaste Bidrag",
      "empty": "Inga bidrag ännu.",
      "untitled": "Namnlös",
      "action": {
        "submitted": "Inskickat",
        "edited": "Redigerat",
        "approved": "Godkänt",
        "rejected": "Avvisat"
      },
      "target": {
        "document": "Dokument",
        "collection": "Samling",
        "registry": "Register",
        "color": "Färg",
        "wheel": "Hjul"
      }
    },
    "stats_breakdown": {
      "title": "Bidrag efter Typ",
      "documents": "Dokument",
      "registry": "Register",
      "colors": "Färger",
      "wheels": "Hjul"
    }
  },
  "da": {
    "title": "Bidragyderprofil | Classic Mini DIY",
    "description": "Se {name}s bidragyderprofil, tillidsniveau og bidragshistorik på Classic Mini DIY.",
    "hero_title": "Bidragyderprofil",
    "breadcrumb_title": "Bidragyder",
    "not_found": {
      "title": "Bidragyder Ikke Fundet",
      "description": "Denne bidragyderprofil eksisterer ikke eller er blevet fjernet.",
      "back": "Tilbage til Bidragydere"
    },
    "profile": {
      "member_since": "Medlem siden",
      "bio": "Om",
      "unknown": "Ukendt Bidragyder"
    },
    "trust_level": {
      "new": "Nyt Medlem",
      "contributor": "Bidragyder",
      "trusted": "Betroet Bidragyder",
      "moderator": "Moderator",
      "admin": "Admin"
    },
    "stats": {
      "total_submissions": "Samlede Indsendelser",
      "approved": "Godkendte Indsendelser",
      "member_since": "Medlem Siden"
    },
    "contributions": {
      "title": "Seneste Bidrag",
      "empty": "Ingen bidrag endnu.",
      "untitled": "Uden titel",
      "action": {
        "submitted": "Indsendt",
        "edited": "Redigeret",
        "approved": "Godkendt",
        "rejected": "Afvist"
      },
      "target": {
        "document": "Dokument",
        "collection": "Samling",
        "registry": "Register",
        "color": "Farve",
        "wheel": "Hjul"
      }
    },
    "stats_breakdown": {
      "title": "Bidrag efter Type",
      "documents": "Dokumenter",
      "registry": "Register",
      "colors": "Farver",
      "wheels": "Hjul"
    }
  },
  "no": {
    "title": "Bidragsyterprofil | Classic Mini DIY",
    "description": "Se {name}s bidragsyterprofil, tillitsnivå og bidragshistorikk på Classic Mini DIY.",
    "hero_title": "Bidragsyterprofil",
    "breadcrumb_title": "Bidragsyter",
    "not_found": {
      "title": "Bidragsyter Ikke Funnet",
      "description": "Denne bidragsyterprofilen eksisterer ikke eller er blitt fjernet.",
      "back": "Tilbake til Bidragsytere"
    },
    "profile": {
      "member_since": "Medlem siden",
      "bio": "Om",
      "unknown": "Ukjent Bidragsyter"
    },
    "trust_level": {
      "new": "Nytt Medlem",
      "contributor": "Bidragsyter",
      "trusted": "Betrodd Bidragsyter",
      "moderator": "Moderator",
      "admin": "Admin"
    },
    "stats": {
      "total_submissions": "Totale Innsendelser",
      "approved": "Godkjente Innsendelser",
      "member_since": "Medlem Siden"
    },
    "contributions": {
      "title": "Nylige Bidrag",
      "empty": "Ingen bidrag ennå.",
      "untitled": "Uten tittel",
      "action": {
        "submitted": "Innsendt",
        "edited": "Redigert",
        "approved": "Godkjent",
        "rejected": "Avvist"
      },
      "target": {
        "document": "Dokument",
        "collection": "Samling",
        "registry": "Register",
        "color": "Farge",
        "wheel": "Hjul"
      }
    },
    "stats_breakdown": {
      "title": "Bidrag etter Type",
      "documents": "Dokumenter",
      "registry": "Register",
      "colors": "Farger",
      "wheels": "Hjul"
    }
  }
}
</i18n>
