<script lang="ts" setup>
  import { HERO_TYPES } from '../../../../data/models/generic';
  import type { RegistryItem } from '../../../../data/models/registry';
  import { RegistryItemStatus } from '../../../../data/models/registry';

  const { t } = useI18n();
  const { track } = useAnalytics();
  const { openWizard } = useContributeWizard();

  const addYourMini = () => {
    track('contribute_cta_clicked', { type: 'registry', location: 'archive_registry_pending' });
    openWizard({ kind: 'registry', origin: '/archive/registry/pending' });
  };

  // Define table columns
  const tableHeaders = [
    { title: t('table_headers.year'), key: 'year' },
    { title: t('table_headers.model'), key: 'model' },
    { title: t('table_headers.body_number'), key: 'bodyNum' },
    { title: t('table_headers.submitted_by'), key: 'submittedBy' },
    { title: t('table_headers.status'), key: 'status', width: '100px' },
  ];

  // Fetch pending registry items
  const { data: pendingItemsRaw, status } = await useAdminFetch<RegistryItem[]>('/api/registry/queue/list');

  /**
   * Pending rows that sit on `registry_entries` itself rather than in
   * submission_queue — the DynamoDB MiniRegisterQueue submissions that were never
   * approved and whose submitters never had accounts (classicminidiy-supabase
   * 20260727000004). The table above reads submission_queue, so without this they
   * are reachable only by SQL.
   */
  interface LegacyPendingEntry {
    id: string;
    year: number;
    model: string;
    bodyNum: string;
    submittedBy: string;
    submittedByEmail: string;
  }

  const { data: legacyPendingRaw, refresh: refreshLegacy } = await useAdminFetch<LegacyPendingEntry[]>(
    '/api/registry/pending-entries/list'
  );

  const legacyPending = computed(() => legacyPendingRaw.value ?? []);
  const moderating = ref<string | null>(null);
  const legacyError = ref('');

  // $adminFetch, not useAdminFetch: this runs from a click handler, and
  // useAdminFetch wraps useFetch, which belongs in setup rather than an event
  // callback. $adminFetch is the $fetch-based mutation wrapper.
  const moderate = async (entry: LegacyPendingEntry, action: 'approve' | 'reject') => {
    moderating.value = entry.id;
    legacyError.value = '';
    try {
      await $adminFetch('/api/registry/pending-entries/moderate', {
        method: 'POST',
        body: { id: entry.id, action },
      });
      await refreshLegacy();
    } catch (e: any) {
      // The endpoint refuses an entry that already has a submitter account, so
      // its message is worth showing verbatim rather than a generic failure.
      legacyError.value = e?.data?.message || e?.statusMessage || e?.message || 'Failed to moderate entry';
    } finally {
      moderating.value = null;
    }
  };

  // Computed property to filter only pending items
  const pendingItems = computed(() => {
    if (!pendingItemsRaw.value) return [];
    return pendingItemsRaw.value.filter((item) => item.status === RegistryItemStatus.PENDING);
  });

  useHead({
    title: t('title'),
    meta: [
      {
        key: 'description',
        name: 'description',
        content: t('description'),
      },
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  });
  useSeoMeta({
    ogTitle: t('seo.og_title'),
    ogDescription: t('seo.og_description'),
    ogUrl: 'classicminidiy.com/archive/registry/pending',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/registry.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: t('seo.twitter_title'),
    twitterDescription: t('seo.twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/registry.png',
  });
</script>

<template>
  <hero :navigation="true" :title="t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />
  <div class="container mx-auto px-4">
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12">
        <breadcrumb class="my-6" :page="t('breadcrumb_title')">
          <template #parent>
            <nuxt-link to="/archive/registry">{{ t('breadcrumb_parent') }}</nuxt-link>
          </template>
        </breadcrumb>
        <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div class="col-span-12 md:col-span-8">
            <PageIntro
              :eyebrow="t('eyebrow')"
              :title="t('main_heading')"
              :description="t('description_text')"
              class="mb-6"
              as="h2"
            />
            <h2 class="text-xl mt-4">
              <strong>{{ pendingItems?.length || '0' }}</strong>
              {{ t('subtitle') }}
            </h2>
            <p class="my-4">
              {{ t('description_text') }}
            </p>
            <p class="my-4">
              {{ t('contact_text') }}
              <NuxtLink to="/contact" class="link link-primary">{{ t('contact_link') }}</NuxtLink
              >.
            </p>
          </div>
          <div class="col-span-12 md:col-span-4">
            <div class="card bg-base-100 shadow-sm border border-base-300">
              <div class="card-body">
                <h2 class="text-lg font-semibold mb-4">{{ t('status_card.title') }}</h2>
                <div class="flex items-center gap-2 mb-2">
                  <span class="badge badge-primary">
                    {{ t('status_card.pending') }}
                  </span>
                  <span>{{ t('status_card.pending_description') }}</span>
                </div>
                <div class="flex items-center gap-2 mb-2">
                  <span class="badge badge-success">
                    {{ t('status_card.approved') }}
                  </span>
                  <span>{{ t('status_card.approved_description') }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="badge badge-error">
                    {{ t('status_card.rejected') }}
                  </span>
                  <span>{{ t('status_card.rejected_description') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-span-12">
        <RegistryTable
          :items="pendingItemsRaw || []"
          :loading="status === 'pending'"
          :tableHeaders="tableHeaders"
          :defaultPageSize="10"
        />
      </div>
      <!-- Legacy imports: pending rows that live on registry_entries rather than
           submission_queue, so they don't appear in the table above. -->
      <div v-if="legacyPending.length > 0" class="col-span-12">
        <div class="card bg-base-100 shadow-sm border border-warning/40">
          <div class="card-body">
            <h2 class="card-title text-lg">
              <i class="fas fa-box-archive text-warning mr-2" aria-hidden="true"></i>
              {{ t('legacy.title', legacyPending.length) }}
            </h2>
            <p class="text-sm text-base-content/70">{{ t('legacy.description') }}</p>

            <p v-if="legacyError" class="text-error text-sm mt-2">{{ legacyError }}</p>

            <div class="overflow-x-auto mt-3">
              <table class="table table-zebra">
                <thead>
                  <tr>
                    <th>{{ t('table_headers.year') }}</th>
                    <th>{{ t('table_headers.model') }}</th>
                    <th>{{ t('table_headers.body_number') }}</th>
                    <th>{{ t('table_headers.submitted_by') }}</th>
                    <th class="text-right">{{ t('legacy.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="entry in legacyPending" :key="entry.id">
                    <td>{{ entry.year }}</td>
                    <td>{{ entry.model || '---' }}</td>
                    <td>{{ entry.bodyNum || '---' }}</td>
                    <td>
                      <div>{{ entry.submittedBy || '---' }}</div>
                      <div class="text-xs text-base-content/60">{{ entry.submittedByEmail || '---' }}</div>
                    </td>
                    <td class="text-right whitespace-nowrap">
                      <button
                        type="button"
                        class="btn btn-success btn-xs mr-2"
                        :disabled="moderating === entry.id"
                        @click="moderate(entry, 'approve')"
                      >
                        {{ t('legacy.approve') }}
                      </button>
                      <button
                        type="button"
                        class="btn btn-error btn-outline btn-xs"
                        :disabled="moderating === entry.id"
                        @click="moderate(entry, 'reject')"
                      >
                        {{ t('legacy.reject') }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div class="col-span-12 md:col-span-10 md:col-start-2">
        <div class="divider">{{ t('submit_divider') }}</div>
      </div>
      <div class="col-span-12 md:col-span-10 md:col-start-2 pb-15">
        <div class="card border border-base-300 bg-base-100 shadow-sm">
          <div class="card-body flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
            <i class="fad fa-clipboard-list text-2xl text-primary" aria-hidden="true"></i>
            <div class="flex-1">
              <p class="font-semibold">{{ t('submit_cta.title') }}</p>
              <p class="text-sm opacity-70">{{ t('submit_cta.description') }}</p>
            </div>
            <button type="button" class="btn btn-primary" @click="addYourMini()">
              {{ t('submit_cta.button') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Pending Registry Submissions - Classic Mini DIY",
    "description": "Track the status of pending Classic Mini registry submissions",
    "hero_title": "Pending Registry Submissions",
    "breadcrumb_title": "Pending Submissions",
    "breadcrumb_parent": "Registry",
    "main_heading": "Pending Registry Submissions",
    "eyebrow": "REGISTRY",
    "subtitle": "submissions pending review",
    "description_text": "Below you can see all pending registry submissions that are currently being reviewed. Submissions are typically processed within 7-14 days.",
    "contact_text": "If you have questions about your submission, please",
    "contact_link": "contact us",
    "legacy": {
      "title": "1 legacy submission needs review | {count} legacy submissions need review",
      "description": "These were submitted before the site moved to Supabase and were never approved. Their submitters have no account, so they are not in the queue above. Approving publishes the entry to the register; rejecting hides it.",
      "approve": "Approve",
      "reject": "Reject",
      "actions": "Actions"
    },
    "table_headers": {
      "year": "Year",
      "model": "Model",
      "body_number": "Body Number",
      "submitted_by": "Submitted By",
      "status": "Status"
    },
    "status_card": {
      "title": "Submission Status Guide",
      "pending": "Pending",
      "pending_description": "Under review",
      "approved": "Approved",
      "approved_description": "Added to registry",
      "rejected": "Rejected",
      "rejected_description": "Needs correction"
    },
    "submit_divider": "Submit Your Mini",
    "seo": {
      "og_title": "Pending Registry Submissions - Classic Mini DIY",
      "og_description": "Track the status of pending Classic Mini registry submissions",
      "twitter_title": "Pending Registry Submissions - Classic Mini DIY",
      "twitter_description": "Track the status of pending Classic Mini registry submissions"
    },
    "submit_cta": {
      "title": "Got another Mini to add?",
      "description": "Registering a car takes a minute and helps the whole community.",
      "button": "Add your Mini"
    }
  },
  "de": {
    "title": "Ausstehende Registry-Einreichungen - Classic Mini DIY",
    "description": "Verfolgen Sie den Status ausstehender Classic Mini Registry-Einreichungen",
    "hero_title": "Ausstehende Registry-Einreichungen",
    "breadcrumb_title": "Ausstehende Einreichungen",
    "breadcrumb_parent": "Registry",
    "main_heading": "Ausstehende Registry-Einreichungen",
    "eyebrow": "REGISTER",
    "subtitle": "Einreichungen warten auf Überprüfung",
    "description_text": "Unten können Sie alle ausstehenden Registry-Einreichungen sehen, die derzeit überprüft werden. Einreichungen werden normalerweise innerhalb von 7-14 Tagen bearbeitet.",
    "contact_text": "Wenn Sie Fragen zu Ihrer Einreichung haben, bitte",
    "contact_link": "kontaktieren Sie uns",
    "legacy": {
      "title": "1 Alteinreichung wartet auf Prüfung | {count} Alteinreichungen warten auf Prüfung",
      "description": "Diese wurden vor dem Wechsel zu Supabase eingereicht und nie genehmigt. Ihre Einreicher haben kein Konto, daher stehen sie nicht in der Liste oben. Genehmigen veröffentlicht den Eintrag im Register, Ablehnen blendet ihn aus.",
      "approve": "Genehmigen",
      "reject": "Ablehnen",
      "actions": "Aktionen"
    },
    "table_headers": {
      "year": "Jahr",
      "model": "Modell",
      "body_number": "Karosserienummer",
      "submitted_by": "Eingereicht von",
      "status": "Status"
    },
    "status_card": {
      "title": "Einreichungsstatus-Leitfaden",
      "pending": "Ausstehend",
      "pending_description": "Wird überprüft",
      "approved": "Genehmigt",
      "approved_description": "Zur Registry hinzugefügt",
      "rejected": "Abgelehnt",
      "rejected_description": "Benötigt Korrektur"
    },
    "submit_divider": "Ihren Mini einreichen",
    "seo": {
      "og_title": "Ausstehende Registry-Einreichungen - Classic Mini DIY",
      "og_description": "Verfolgen Sie den Status ausstehender Classic Mini Registry-Einreichungen",
      "twitter_title": "Ausstehende Registry-Einreichungen - Classic Mini DIY",
      "twitter_description": "Verfolgen Sie den Status ausstehender Classic Mini Registry-Einreichungen"
    },
    "submit_cta": {
      "title": "Noch einen Mini hinzuzufügen?",
      "description": "Ein Auto einzutragen dauert eine Minute und hilft der ganzen Community.",
      "button": "Deinen Mini eintragen"
    }
  },
  "es": {
    "title": "Envíos de Registro Pendientes - Classic Mini DIY",
    "description": "Rastrea el estado de los envíos de registro de Classic Mini pendientes",
    "hero_title": "Envíos de Registro Pendientes",
    "breadcrumb_title": "Envíos Pendientes",
    "breadcrumb_parent": "Registro",
    "main_heading": "Envíos de Registro Pendientes",
    "eyebrow": "REGISTRO",
    "subtitle": "envíos pendientes de revisión",
    "description_text": "A continuación puedes ver todos los envíos de registro pendientes que están siendo revisados actualmente. Los envíos se procesan típicamente dentro de 7-14 días.",
    "contact_text": "Si tienes preguntas sobre tu envío, por favor",
    "contact_link": "contáctanos",
    "legacy": {
      "title": "1 envío heredado requiere revisión | {count} envíos heredados requieren revisión",
      "description": "Se enviaron antes de la migración a Supabase y nunca se aprobaron. Sus autores no tienen cuenta, por lo que no aparecen en la cola anterior. Aprobar publica la entrada en el registro; rechazar la oculta.",
      "approve": "Aprobar",
      "reject": "Rechazar",
      "actions": "Acciones"
    },
    "table_headers": {
      "year": "Año",
      "model": "Modelo",
      "body_number": "Número de Carrocería",
      "submitted_by": "Enviado por",
      "status": "Estado"
    },
    "status_card": {
      "title": "Guía de Estado de Envío",
      "pending": "Pendiente",
      "pending_description": "Bajo revisión",
      "approved": "Aprobado",
      "approved_description": "Agregado al registro",
      "rejected": "Rechazado",
      "rejected_description": "Necesita corrección"
    },
    "submit_divider": "Envía tu Mini",
    "seo": {
      "og_title": "Envíos de Registro Pendientes - Classic Mini DIY",
      "og_description": "Rastrea el estado de los envíos de registro de Classic Mini pendientes",
      "twitter_title": "Envíos de Registro Pendientes - Classic Mini DIY",
      "twitter_description": "Rastrea el estado de los envíos de registro de Classic Mini pendientes"
    },
    "submit_cta": {
      "title": "¿Tienes otro Mini que añadir?",
      "description": "Registrar un coche lleva un minuto y ayuda a toda la comunidad.",
      "button": "Añade tu Mini"
    }
  },
  "fr": {
    "title": "Soumissions de Registre en Attente - Classic Mini DIY",
    "description": "Suivez le statut des soumissions de registre Classic Mini en attente",
    "hero_title": "Soumissions de Registre en Attente",
    "breadcrumb_title": "Soumissions en Attente",
    "breadcrumb_parent": "Registre",
    "main_heading": "Soumissions de Registre en Attente",
    "eyebrow": "REGISTRE",
    "subtitle": "soumissions en attente de révision",
    "description_text": "Ci-dessous, vous pouvez voir toutes les soumissions de registre en attente qui sont actuellement en cours de révision. Les soumissions sont généralement traitées dans les 7-14 jours.",
    "contact_text": "Si vous avez des questions sur votre soumission, veuillez",
    "contact_link": "nous contacter",
    "legacy": {
      "title": "1 soumission héritée à examiner | {count} soumissions héritées à examiner",
      "description": "Elles ont été soumises avant le passage à Supabase et n'ont jamais été approuvées. Leurs auteurs n'ont pas de compte, elles n'apparaissent donc pas dans la file ci-dessus. Approuver publie l'entrée au registre ; rejeter la masque.",
      "approve": "Approuver",
      "reject": "Rejeter",
      "actions": "Actions"
    },
    "table_headers": {
      "year": "Année",
      "model": "Modèle",
      "body_number": "Numéro de Carrosserie",
      "submitted_by": "Soumis par",
      "status": "Statut"
    },
    "status_card": {
      "title": "Guide du Statut de Soumission",
      "pending": "En Attente",
      "pending_description": "Sous révision",
      "approved": "Approuvé",
      "approved_description": "Ajouté au registre",
      "rejected": "Rejeté",
      "rejected_description": "Nécessite une correction"
    },
    "submit_divider": "Soumettez votre Mini",
    "seo": {
      "og_title": "Soumissions de Registre en Attente - Classic Mini DIY",
      "og_description": "Suivez le statut des soumissions de registre Classic Mini en attente",
      "twitter_title": "Soumissions de Registre en Attente - Classic Mini DIY",
      "twitter_description": "Suivez le statut des soumissions de registre Classic Mini en attente"
    },
    "submit_cta": {
      "title": "Une autre Mini à ajouter ?",
      "description": "Enregistrer une voiture prend une minute et profite à toute la communauté.",
      "button": "Ajouter votre Mini"
    }
  },
  "it": {
    "title": "Invii di Registro in Sospeso - Classic Mini DIY",
    "description": "Traccia lo stato degli invii di registro Classic Mini in sospeso",
    "hero_title": "Invii di Registro in Sospeso",
    "breadcrumb_title": "Invii in Sospeso",
    "breadcrumb_parent": "Registro",
    "main_heading": "Invii di Registro in Sospeso",
    "eyebrow": "REGISTRO",
    "subtitle": "invii in attesa di revisione",
    "description_text": "Di seguito puoi vedere tutti gli invii di registro in sospeso che sono attualmente in fase di revisione. Gli invii vengono generalmente elaborati entro 7-14 giorni.",
    "contact_text": "Se hai domande sul tuo invio, per favore",
    "contact_link": "contattaci",
    "legacy": {
      "title": "1 invio legacy da revisionare | {count} invii legacy da revisionare",
      "description": "Sono stati inviati prima del passaggio a Supabase e mai approvati. Chi li ha inviati non ha un account, quindi non compaiono nella coda sopra. Approvare pubblica la voce nel registro; rifiutare la nasconde.",
      "approve": "Approva",
      "reject": "Rifiuta",
      "actions": "Azioni"
    },
    "table_headers": {
      "year": "Anno",
      "model": "Modello",
      "body_number": "Numero Carrozzeria",
      "submitted_by": "Inviato da",
      "status": "Stato"
    },
    "status_card": {
      "title": "Guida allo Stato dell'Invio",
      "pending": "In Sospeso",
      "pending_description": "Sotto revisione",
      "approved": "Approvato",
      "approved_description": "Aggiunto al registro",
      "rejected": "Rifiutato",
      "rejected_description": "Necessita correzione"
    },
    "submit_divider": "Invia la tua Mini",
    "seo": {
      "og_title": "Invii di Registro in Sospeso - Classic Mini DIY",
      "og_description": "Traccia lo stato degli invii di registro Classic Mini in sospeso",
      "twitter_title": "Invii di Registro in Sospeso - Classic Mini DIY",
      "twitter_description": "Traccia lo stato degli invii di registro Classic Mini in sospeso"
    },
    "submit_cta": {
      "title": "Hai un altro Mini da aggiungere?",
      "description": "Registrare un’auto richiede un minuto e aiuta tutta la comunità.",
      "button": "Aggiungi il tuo Mini"
    }
  },
  "pt": {
    "title": "Submissões de Registro Pendentes - Classic Mini DIY",
    "description": "Acompanhe o status das submissões de registro Classic Mini pendentes",
    "hero_title": "Submissões de Registro Pendentes",
    "breadcrumb_title": "Submissões Pendentes",
    "breadcrumb_parent": "Registro",
    "main_heading": "Submissões de Registro Pendentes",
    "eyebrow": "REGISTRO",
    "subtitle": "submissões aguardando revisão",
    "description_text": "Abaixo você pode ver todas as submissões de registro pendentes que estão sendo revisadas atualmente. As submissões são normalmente processadas dentro de 7-14 dias.",
    "contact_text": "Se você tem perguntas sobre sua submissão, por favor",
    "contact_link": "entre em contato conosco",
    "legacy": {
      "title": "1 envio antigo precisa de revisão | {count} envios antigos precisam de revisão",
      "description": "Foram enviados antes da migração para o Supabase e nunca aprovados. Os autores não têm conta, por isso não aparecem na fila acima. Aprovar publica a entrada no registro; rejeitar a oculta.",
      "approve": "Aprovar",
      "reject": "Rejeitar",
      "actions": "Ações"
    },
    "table_headers": {
      "year": "Ano",
      "model": "Modelo",
      "body_number": "Número da Carroceria",
      "submitted_by": "Enviado por",
      "status": "Status"
    },
    "status_card": {
      "title": "Guia de Status de Submissão",
      "pending": "Pendente",
      "pending_description": "Sob revisão",
      "approved": "Aprovado",
      "approved_description": "Adicionado ao registro",
      "rejected": "Rejeitado",
      "rejected_description": "Precisa de correção"
    },
    "submit_divider": "Envie seu Mini",
    "seo": {
      "og_title": "Submissões de Registro Pendentes - Classic Mini DIY",
      "og_description": "Acompanhe o status das submissões de registro Classic Mini pendentes",
      "twitter_title": "Submissões de Registro Pendentes - Classic Mini DIY",
      "twitter_description": "Acompanhe o status das submissões de registro Classic Mini pendentes"
    },
    "submit_cta": {
      "title": "Tem outro Mini para adicionar?",
      "description": "Registar um carro demora um minuto e ajuda toda a comunidade.",
      "button": "Adicione o seu Mini"
    }
  },
  "ru": {
    "title": "Ожидающие заявки в реестр - Classic Mini DIY",
    "description": "Отслеживайте статус ожидающих заявок в реестр Classic Mini",
    "hero_title": "Ожидающие заявки в реестр",
    "breadcrumb_title": "Ожидающие заявки",
    "breadcrumb_parent": "Реестр",
    "main_heading": "Ожидающие заявки в реестр",
    "eyebrow": "РЕЕСТР",
    "subtitle": "заявок ожидают проверки",
    "description_text": "Ниже вы можете видеть все ожидающие заявки в реестр, которые в данный момент проходят проверку. Заявки обычно обрабатываются в течение 7-14 дней.",
    "contact_text": "Если у вас есть вопросы по вашей заявке, пожалуйста",
    "contact_link": "свяжитесь с нами",
    "legacy": {
      "title": "1 старая заявка ожидает проверки | {count} старых заявок ожидают проверки",
      "description": "Они были отправлены до перехода на Supabase и никогда не одобрялись. У их авторов нет аккаунта, поэтому они не попадают в очередь выше. Одобрение публикует запись в реестре, отклонение скрывает её.",
      "approve": "Одобрить",
      "reject": "Отклонить",
      "actions": "Действия"
    },
    "table_headers": {
      "year": "Год",
      "model": "Модель",
      "body_number": "Номер кузова",
      "submitted_by": "Отправил",
      "status": "Статус"
    },
    "status_card": {
      "title": "Руководство по статусу заявки",
      "pending": "Ожидает",
      "pending_description": "На проверке",
      "approved": "Одобрено",
      "approved_description": "Добавлено в реестр",
      "rejected": "Отклонено",
      "rejected_description": "Требует исправления"
    },
    "submit_divider": "Добавьте ваш Mini",
    "seo": {
      "og_title": "Ожидающие заявки в реестр - Classic Mini DIY",
      "og_description": "Отслеживайте статус ожидающих заявок в реестр Classic Mini",
      "twitter_title": "Ожидающие заявки в реестр - Classic Mini DIY",
      "twitter_description": "Отслеживайте статус ожидающих заявок в реестр Classic Mini"
    },
    "submit_cta": {
      "title": "Есть ещё один Mini?",
      "description": "Регистрация занимает минуту и помогает всему сообществу.",
      "button": "Добавить свой Mini"
    }
  },
  "ja": {
    "title": "審査中のレジストリ申請 - Classic Mini DIY",
    "description": "クラシックミニ レジストリの審査中申請状況を追跡する",
    "hero_title": "審査中のレジストリ申請",
    "breadcrumb_title": "審査中の申請",
    "breadcrumb_parent": "レジストリ",
    "main_heading": "審査中のレジストリ申請",
    "eyebrow": "レジストリ",
    "subtitle": "件の申請が審査待ち",
    "description_text": "現在審査中のすべてのレジストリ申請を以下でご確認いただけます。申請は通常7〜14日以内に処理されます。",
    "contact_text": "申請についてご質問がある場合は、",
    "contact_link": "お問い合わせください",
    "legacy": {
      "title": "確認待ちの旧申請が1件あります | 確認待ちの旧申請が{count}件あります",
      "description": "Supabase移行前に申請され、承認されないままだったものです。申請者にアカウントがないため、上のキューには表示されません。承認すると登録簿に公開され、却下すると非表示になります。",
      "approve": "承認",
      "reject": "却下",
      "actions": "操作"
    },
    "table_headers": {
      "year": "年式",
      "model": "モデル",
      "body_number": "ボディ番号",
      "submitted_by": "申請者",
      "status": "ステータス"
    },
    "status_card": {
      "title": "申請ステータスガイド",
      "pending": "審査中",
      "pending_description": "確認中",
      "approved": "承認済み",
      "approved_description": "レジストリに追加済み",
      "rejected": "却下",
      "rejected_description": "修正が必要"
    },
    "submit_divider": "あなたのミニを登録",
    "seo": {
      "og_title": "審査中のレジストリ申請 - Classic Mini DIY",
      "og_description": "クラシックミニ レジストリの審査中申請状況を追跡する",
      "twitter_title": "審査中のレジストリ申請 - Classic Mini DIY",
      "twitter_description": "クラシックミニ レジストリの審査中申請状況を追跡する"
    },
    "submit_cta": {
      "title": "追加したい Mini はありますか？",
      "description": "登録は1分ほどで、コミュニティ全体の役に立ちます。",
      "button": "Mini を登録する"
    }
  },
  "zh": {
    "title": "待审核的注册表提交 - Classic Mini DIY",
    "description": "追踪经典迷你注册表待审核提交的状态",
    "hero_title": "待审核的注册表提交",
    "breadcrumb_title": "待审核提交",
    "breadcrumb_parent": "注册表",
    "main_heading": "待审核的注册表提交",
    "eyebrow": "注册库",
    "subtitle": "条提交待审核",
    "description_text": "以下您可以查看所有正在审核中的待处理注册表提交。提交通常在7-14天内处理完成。",
    "contact_text": "如果您对提交有疑问，请",
    "contact_link": "联系我们",
    "legacy": {
      "title": "有 1 条旧提交待审核 | 有 {count} 条旧提交待审核",
      "description": "这些是在迁移到 Supabase 之前提交且从未审核通过的记录。提交者没有账户，因此不会出现在上面的队列中。通过后将公开显示在登记簿中，拒绝则会隐藏。",
      "approve": "通过",
      "reject": "拒绝",
      "actions": "操作"
    },
    "table_headers": {
      "year": "年份",
      "model": "型号",
      "body_number": "车身编号",
      "submitted_by": "提交者",
      "status": "状态"
    },
    "status_card": {
      "title": "提交状态指南",
      "pending": "待审核",
      "pending_description": "审核中",
      "approved": "已批准",
      "approved_description": "已添加到注册表",
      "rejected": "已拒绝",
      "rejected_description": "需要修正"
    },
    "submit_divider": "提交您的迷你",
    "seo": {
      "og_title": "待审核的注册表提交 - Classic Mini DIY",
      "og_description": "追踪经典迷你注册表待审核提交的状态",
      "twitter_title": "待审核的注册表提交 - Classic Mini DIY",
      "twitter_description": "追踪经典迷你注册表待审核提交的状态"
    },
    "submit_cta": {
      "title": "还有其他 Mini 要登记吗？",
      "description": "登记一辆车只要一分钟，却能帮到整个社区。",
      "button": "登记你的 Mini"
    }
  },
  "ko": {
    "title": "대기 중인 레지스트리 제출 - Classic Mini DIY",
    "description": "클래식 미니 레지스트리 대기 중인 제출 상태 추적",
    "hero_title": "대기 중인 레지스트리 제출",
    "breadcrumb_title": "대기 중인 제출",
    "breadcrumb_parent": "레지스트리",
    "main_heading": "대기 중인 레지스트리 제출",
    "eyebrow": "등록부",
    "subtitle": "건의 제출이 검토 대기 중",
    "description_text": "아래에서 현재 검토 중인 모든 대기 중인 레지스트리 제출을 확인할 수 있습니다. 제출은 보통 7-14일 이내에 처리됩니다.",
    "contact_text": "제출에 대한 질문이 있으시면",
    "contact_link": "문의하세요",
    "legacy": {
      "title": "검토가 필요한 이전 제출 1건 | 검토가 필요한 이전 제출 {count}건",
      "description": "Supabase로 이전하기 전에 제출되어 승인되지 않은 항목입니다. 제출자에게 계정이 없어 위 대기열에 표시되지 않습니다. 승인하면 등록부에 공개되고, 거부하면 숨겨집니다.",
      "approve": "승인",
      "reject": "거부",
      "actions": "작업"
    },
    "table_headers": {
      "year": "연도",
      "model": "모델",
      "body_number": "차체 번호",
      "submitted_by": "제출자",
      "status": "상태"
    },
    "status_card": {
      "title": "제출 상태 안내",
      "pending": "대기 중",
      "pending_description": "검토 중",
      "approved": "승인됨",
      "approved_description": "레지스트리에 추가됨",
      "rejected": "거부됨",
      "rejected_description": "수정 필요"
    },
    "submit_divider": "미니를 등록하세요",
    "seo": {
      "og_title": "대기 중인 레지스트리 제출 - Classic Mini DIY",
      "og_description": "클래식 미니 레지스트리 대기 중인 제출 상태 추적",
      "twitter_title": "대기 중인 레지스트리 제출 - Classic Mini DIY",
      "twitter_description": "클래식 미니 레지스트리 대기 중인 제출 상태 추적"
    },
    "submit_cta": {
      "title": "등록할 Mini가 더 있나요?",
      "description": "차 한 대 등록에 1분이면 되고, 커뮤니티 전체에 도움이 됩니다.",
      "button": "내 Mini 등록하기"
    }
  }
}
</i18n>
