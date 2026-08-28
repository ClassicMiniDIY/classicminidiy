<script setup lang="ts">
  import type { DeveloperKey } from '~/composables/useDeveloperKeys';

  const { t, locale } = useI18n();
  const toast = useToast();
  const { track } = useAnalytics();
  const { isAuthenticated, user } = useAuth();
  const config = useRuntimeConfig();
  const {
    keys,
    usage,
    subscription,
    loading,
    usageLoading,
    fetchKeys,
    createKey,
    renameKey,
    revokeKey,
    fetchUsage,
    fetchSubscription,
  } = useDeveloperKeys();

  const MCP_ENDPOINT = 'https://classicminidiy.com/mcp';

  // --- Key CRUD state ---
  const creating = ref(false);
  const newKeyName = ref('');
  const busyId = ref<string | null>(null);
  const renamingId = ref<string | null>(null);
  const renameValue = ref('');
  const renameInput = ref<HTMLInputElement[] | HTMLInputElement | null>(null);
  const pendingRevoke = ref<DeveloperKey | null>(null);
  const revokeDialog = ref<HTMLDialogElement | null>(null);

  // The plaintext key lives ONLY in this ref, only while the reveal dialog is
  // open. Closing the dialog clears it — there is no way to see it again.
  const revealedKey = ref<string | null>(null);
  const revealDialog = ref<HTMLDialogElement | null>(null);

  const atKeyLimit = computed(() => keys.value.length >= MAX_DEVELOPER_KEYS);
  const isDeveloper = computed(() => subscription.value?.is_active === true);

  // Same no-code Stripe portal affordance as /membership: only meaningful for
  // a subscription sold via Stripe (the only channel this product sells on,
  // but comp exists too and has nothing to manage).
  const portalHref = computed(() => {
    const base = config.public.stripePortalUrl as string;
    if (!base || subscription.value?.platform !== 'stripe') return '';
    const email = user.value?.email;
    return email ? `${base}?prefilled_email=${encodeURIComponent(email)}` : base;
  });

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(locale.value, { year: 'numeric', month: 'short', day: 'numeric' });

  watch(
    isAuthenticated,
    (authed) => {
      if (!authed) return;
      fetchKeys().catch(() => toast.add({ title: t('load_error'), color: 'error', icon: 'fas fa-triangle-exclamation' }));
      fetchUsage().catch(() => {});
      fetchSubscription();
    },
    { immediate: true }
  );

  // --- Create + one-time reveal ---
  const handleCreate = async () => {
    const name = newKeyName.value.trim();
    if (!name) return;
    creating.value = true;
    try {
      const created = await createKey(name);
      newKeyName.value = '';
      revealedKey.value = created.key;
      revealDialog.value?.showModal();
      track('api_key_created', { key_prefix: created.key_prefix });
    } catch (error: any) {
      const limit = error?.statusCode === 409 || error?.response?.status === 409;
      toast.add({
        title: limit ? t('create_limit_error', { max: MAX_DEVELOPER_KEYS }) : t('create_error'),
        color: 'error',
        icon: 'fas fa-triangle-exclamation',
      });
    } finally {
      creating.value = false;
    }
  };

  const closeRevealDialog = () => {
    revealDialog.value?.close();
  };

  const clearRevealedKey = () => {
    revealedKey.value = null;
  };

  const copyRevealedKey = async () => {
    if (!revealedKey.value) return;
    try {
      await navigator.clipboard.writeText(revealedKey.value);
      toast.add({ title: t('copied'), color: 'success', icon: 'fas fa-circle-check' });
    } catch {
      toast.add({ title: t('copy_error'), color: 'error', icon: 'fas fa-triangle-exclamation' });
    }
  };

  const copyEndpoint = async () => {
    try {
      await navigator.clipboard.writeText(MCP_ENDPOINT);
      toast.add({ title: t('copied'), color: 'success', icon: 'fas fa-circle-check' });
    } catch {
      toast.add({ title: t('copy_error'), color: 'error', icon: 'fas fa-triangle-exclamation' });
    }
  };

  // --- Rename ---
  const startRename = async (key: DeveloperKey) => {
    renamingId.value = key.id;
    renameValue.value = key.name;
    await nextTick();
    const el = Array.isArray(renameInput.value) ? renameInput.value[0] : renameInput.value;
    el?.select();
  };

  const cancelRename = () => {
    renamingId.value = null;
    renameValue.value = '';
  };

  const confirmRename = async (id: string) => {
    const name = renameValue.value.trim();
    if (!name) return;
    busyId.value = id;
    try {
      await renameKey(id, name);
      cancelRename();
    } catch {
      toast.add({ title: t('rename_error'), color: 'error', icon: 'fas fa-triangle-exclamation' });
    } finally {
      busyId.value = null;
    }
  };

  // --- Revoke ---
  const confirmRevoke = (key: DeveloperKey) => {
    pendingRevoke.value = key;
    revokeDialog.value?.showModal();
  };

  const closeRevokeDialog = () => {
    revokeDialog.value?.close();
  };

  const performRevoke = async () => {
    const key = pendingRevoke.value;
    if (!key) return;
    revokeDialog.value?.close();
    busyId.value = key.id;
    try {
      await revokeKey(key.id);
      track('api_key_revoked', { key_prefix: key.key_prefix });
      toast.add({ title: t('revoke_success'), color: 'success', icon: 'fas fa-circle-check' });
    } catch {
      toast.add({ title: t('revoke_error'), color: 'error', icon: 'fas fa-triangle-exclamation' });
    } finally {
      busyId.value = null;
      pendingRevoke.value = null;
    }
  };

  // --- Usage chart: last 30 days, one column series per tool ---
  const totalCalls = computed(() => usage.value.reduce((sum, row) => sum + row.call_count, 0));

  const usageChartOptions = computed(() => {
    const days: string[] = [];
    const cursor = new Date();
    cursor.setUTCDate(cursor.getUTCDate() - 29);
    for (let i = 0; i < 30; i++) {
      days.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const tools = [...new Set(usage.value.map((row) => row.tool))].sort();
    const series = tools.map((tool) => ({
      name: tool,
      type: 'column' as const,
      data: days.map((day) =>
        usage.value.filter((row) => row.tool === tool && row.day === day).reduce((sum, row) => sum + row.call_count, 0)
      ),
    }));

    return {
      chart: { type: 'column', height: 280, backgroundColor: 'transparent' },
      title: { text: undefined },
      xAxis: {
        categories: days.map((day) =>
          new Date(`${day}T00:00:00Z`).toLocaleDateString(locale.value, { month: 'short', day: 'numeric' })
        ),
        tickInterval: 7,
      },
      yAxis: { min: 0, allowDecimals: false, title: { text: t('usage_axis') } },
      plotOptions: { column: { stacking: 'normal', borderWidth: 0 } },
      legend: { enabled: series.length > 1 },
      series,
    };
  });
</script>

<template>
  <div class="space-y-6">
    <!-- Plan -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body">
        <div class="flex flex-wrap items-center gap-3">
          <i class="fad fa-code text-lg" aria-hidden="true"></i>
          <h2 class="text-lg font-semibold">{{ t('plan_title') }}</h2>
          <span v-if="isDeveloper" class="badge badge-primary badge-sm">{{ t('plan_developer') }}</span>
          <span v-else class="badge badge-ghost badge-sm">{{ t('plan_free') }}</span>
          <span v-if="isDeveloper && subscription?.billing_interval === 'year'" class="badge badge-soft badge-sm">
            {{ t('plan_yearly') }}
          </span>
        </div>

        <p class="text-sm opacity-70">
          {{ isDeveloper ? t('plan_developer_description') : t('plan_free_description') }}
        </p>

        <div role="alert" class="alert alert-vertical sm:alert-horizontal mt-2">
          <i class="fas fa-plug" aria-hidden="true"></i>
          <div class="min-w-0">
            <h3 class="font-bold">{{ t('endpoint_title') }}</h3>
            <code class="text-xs break-all">{{ MCP_ENDPOINT }}</code>
          </div>
          <button type="button" class="btn btn-sm" @click="copyEndpoint">
            <i class="fas fa-copy" aria-hidden="true"></i>
            {{ t('copy') }}
          </button>
        </div>

        <div class="card-actions mt-2">
          <NuxtLink v-if="!isDeveloper" to="/developers" class="btn btn-primary btn-sm">
            <i class="fas fa-arrow-up-right-dots" aria-hidden="true"></i>
            {{ t('upgrade_cta') }}
          </NuxtLink>
          <a
            v-if="portalHref"
            :href="portalHref"
            target="_blank"
            rel="noopener"
            class="btn btn-outline btn-sm"
            @click="track('developer_portal_opened', { source: 'dashboard' })"
          >
            <i class="fas fa-credit-card" aria-hidden="true"></i>
            {{ t('manage_billing') }}
          </a>
        </div>
      </div>
    </div>

    <!-- Keys -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body">
        <div class="flex items-center gap-2">
          <i class="fad fa-key" aria-hidden="true"></i>
          <h2 class="text-lg font-semibold">{{ t('keys_title') }}</h2>
        </div>
        <p class="text-sm opacity-70">{{ t('keys_description') }}</p>

        <div v-if="loading && !keys.length" class="flex justify-center py-6">
          <span class="loading loading-spinner loading-md"></span>
        </div>

        <div v-else-if="!keys.length" class="text-sm opacity-60 py-2">
          {{ t('keys_empty') }}
        </div>

        <ul v-else class="divide-y divide-base-300">
          <li v-for="key in keys" :key="key.id" class="py-3 flex items-center gap-3">
            <i class="fas fa-key text-lg opacity-60" aria-hidden="true"></i>

            <div class="grow min-w-0">
              <div v-if="renamingId === key.id" class="flex items-center gap-2">
                <label class="sr-only" :for="`rename-key-${key.id}`">{{ t('name_placeholder') }}</label>
                <input
                  :id="`rename-key-${key.id}`"
                  ref="renameInput"
                  v-model="renameValue"
                  type="text"
                  maxlength="60"
                  :aria-label="t('name_placeholder')"
                  class="input input-sm grow"
                  :placeholder="t('name_placeholder')"
                  :disabled="busyId === key.id"
                  @keyup.enter="confirmRename(key.id)"
                  @keyup.esc="cancelRename"
                />
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  :disabled="busyId === key.id || !renameValue.trim()"
                  @click="confirmRename(key.id)"
                >
                  {{ t('save') }}
                </button>
                <button type="button" class="btn btn-ghost btn-sm" :disabled="busyId === key.id" @click="cancelRename">
                  {{ t('cancel') }}
                </button>
              </div>

              <div v-else>
                <p class="font-medium truncate">{{ key.name }}</p>
                <p class="text-xs opacity-60">
                  <code>{{ key.key_prefix }}…</code>
                  &middot; {{ t('created', { date: formatDate(key.created_at) }) }}
                  <template v-if="key.last_used_at">
                    &middot; {{ t('last_used', { date: formatDate(key.last_used_at) }) }}
                  </template>
                </p>
              </div>
            </div>

            <div v-if="renamingId !== key.id" class="flex items-center gap-1 shrink-0">
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                :aria-label="t('rename')"
                :disabled="busyId === key.id"
                @click="startRename(key)"
              >
                <i class="fas fa-pen" aria-hidden="true"></i>
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-sm text-error"
                :aria-label="t('revoke')"
                :disabled="busyId === key.id"
                @click="confirmRevoke(key)"
              >
                <i v-if="busyId === key.id" class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                <i v-else class="fas fa-trash" aria-hidden="true"></i>
              </button>
            </div>
          </li>
        </ul>

        <div class="mt-2 flex flex-wrap items-center gap-2">
          <label class="input input-sm">
            <i class="fas fa-tag opacity-60" aria-hidden="true"></i>
            <input
              v-model="newKeyName"
              type="text"
              class="grow"
              maxlength="60"
              :aria-label="t('name_placeholder')"
              :placeholder="t('name_placeholder')"
              :disabled="creating || atKeyLimit"
              @keyup.enter="handleCreate"
            />
          </label>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="creating || atKeyLimit || !newKeyName.trim()"
            @click="handleCreate"
          >
            <span v-if="creating" class="loading loading-spinner loading-xs"></span>
            <i v-else class="fas fa-plus" aria-hidden="true"></i>
            {{ t('create') }}
          </button>
          <span v-if="atKeyLimit" class="text-xs opacity-60">{{ t('key_limit', { max: MAX_DEVELOPER_KEYS }) }}</span>
        </div>
      </div>
    </div>

    <!-- Getting started: per-client setup (shared with /developers) -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body">
        <div class="flex items-center gap-2">
          <i class="fad fa-rocket" aria-hidden="true"></i>
          <h2 class="text-lg font-semibold">{{ t('setup_title') }}</h2>
        </div>
        <p class="text-sm opacity-70">{{ t('setup_description') }}</p>
        <DeveloperClientSetupAccordion class="mt-2" />
      </div>
    </div>

    <!-- Usage -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body">
        <div class="flex items-center gap-2">
          <i class="fad fa-chart-column" aria-hidden="true"></i>
          <h2 class="text-lg font-semibold">{{ t('usage_title') }}</h2>
        </div>
        <p class="text-sm opacity-70">{{ t('usage_description', { count: totalCalls }) }}</p>

        <div v-if="usageLoading" class="flex justify-center py-6">
          <span class="loading loading-spinner loading-md"></span>
        </div>

        <div v-else-if="!usage.length" class="text-sm opacity-60 py-2">
          {{ t('usage_empty') }}
        </div>

        <ClientOnly v-else>
          <highcharts :options="usageChartOptions" />
          <template #fallback>
            <div class="flex justify-center py-6">
              <span class="loading loading-spinner loading-md"></span>
            </div>
          </template>
        </ClientOnly>
      </div>
    </div>

    <!-- One-time key reveal. `close` clears the plaintext for every path, Esc
         included — after this dialog, the key exists only where the user put it. -->
    <dialog ref="revealDialog" class="modal" aria-labelledby="key-reveal-title" @close="clearRevealedKey">
      <div class="modal-box">
        <h3 id="key-reveal-title" class="text-lg font-bold">{{ t('reveal_title') }}</h3>
        <p class="py-2 text-sm opacity-70">{{ t('reveal_description') }}</p>
        <div role="alert" class="alert alert-warning">
          <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
          <span>{{ t('reveal_warning') }}</span>
        </div>
        <div class="mt-4 flex items-center gap-2">
          <code class="bg-base-200 rounded-box p-3 text-sm break-all grow [user-select:all]">{{ revealedKey }}</code>
          <button type="button" class="btn btn-primary btn-sm shrink-0" @click="copyRevealedKey">
            <i class="fas fa-copy" aria-hidden="true"></i>
            {{ t('copy') }}
          </button>
        </div>
        <div class="modal-action">
          <button type="button" class="btn btn-sm" @click="closeRevealDialog">{{ t('reveal_done') }}</button>
        </div>
      </div>
    </dialog>

    <!-- Revoke confirmation -->
    <dialog ref="revokeDialog" class="modal" aria-labelledby="key-revoke-title" @close="pendingRevoke = null">
      <div class="modal-box">
        <h3 id="key-revoke-title" class="text-lg font-bold">{{ t('revoke_title') }}</h3>
        <p class="py-4">{{ t('revoke_confirm', { name: pendingRevoke?.name ?? '' }) }}</p>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost btn-sm" @click="closeRevokeDialog">{{ t('cancel') }}</button>
          <button type="button" class="btn btn-error btn-sm" @click="performRevoke">{{ t('revoke') }}</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>{{ t('cancel') }}</button>
      </form>
    </dialog>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "plan_title": "Developer API",
    "plan_free": "Free tier",
    "plan_developer": "Developer",
    "plan_yearly": "Yearly",
    "plan_free_description": "Your keys can use the calculators and reference tables at 20 requests per minute. Subscribe to unlock the chassis and engine decoders, the wheel and color archives, and 240 requests per minute.",
    "plan_developer_description": "Your subscription unlocks all 11 MCP tools at 240 requests per minute on every key.",
    "endpoint_title": "MCP endpoint",
    "upgrade_cta": "View plans",
    "manage_billing": "Manage billing",
    "keys_title": "API keys",
    "keys_description": "Keys authenticate MCP clients against the endpoint above via a Bearer header. You can hold up to 5 active keys — use one per client or integration.",
    "keys_empty": "No API keys yet. Name one below to get started.",
    "name_placeholder": "Name this key (e.g. Claude Desktop)",
    "create": "Create key",
    "created": "Created {date}",
    "last_used": "last used {date}",
    "key_limit": "Limit of {max} active keys reached.",
    "rename": "Rename key",
    "revoke": "Revoke",
    "save": "Save",
    "cancel": "Cancel",
    "copy": "Copy",
    "copied": "Copied to clipboard.",
    "copy_error": "Could not copy. Select the text and copy it manually.",
    "reveal_title": "Your new API key",
    "reveal_description": "Paste this key into your MCP client as the Bearer token.",
    "reveal_warning": "This is the only time the key is shown. Store it now — it cannot be recovered later, only replaced.",
    "reveal_done": "I saved my key",
    "revoke_title": "Revoke key?",
    "revoke_confirm": "\"{name}\" will stop working immediately. This cannot be undone.",
    "revoke_success": "Key revoked.",
    "revoke_error": "Could not revoke that key.",
    "rename_error": "Could not rename that key.",
    "create_error": "Could not create a key.",
    "create_limit_error": "You already hold {max} active keys. Revoke one first.",
    "load_error": "Could not load your API keys.",
    "usage_title": "Usage — last 30 days",
    "usage_description": "{count} tool calls in the last 30 days, counted per tool per day.",
    "usage_empty": "No tool calls recorded yet. Point an MCP client at the endpoint above and this chart fills in.",
    "usage_axis": "Calls per day",
    "setup_title": "Getting started",
    "setup_description": "Pick your AI client below, paste the snippet, and swap in one of your keys."
  },
  "es": {
    "plan_title": "API para desarrolladores",
    "plan_free": "Nivel gratuito",
    "plan_developer": "Desarrollador",
    "plan_yearly": "Anual",
    "plan_free_description": "Tus claves pueden usar las calculadoras y tablas de referencia a 20 solicitudes por minuto. Suscríbete para desbloquear los decodificadores de chasis y motor, los archivos de ruedas y colores, y 240 solicitudes por minuto.",
    "plan_developer_description": "Tu suscripción desbloquea las 11 herramientas MCP a 240 solicitudes por minuto en cada clave.",
    "endpoint_title": "Endpoint MCP",
    "upgrade_cta": "Ver planes",
    "manage_billing": "Gestionar facturación",
    "keys_title": "Claves de API",
    "keys_description": "Las claves autentican clientes MCP contra el endpoint superior mediante una cabecera Bearer. Puedes tener hasta 5 claves activas: usa una por cliente o integración.",
    "keys_empty": "Aún no hay claves de API. Nombra una abajo para empezar.",
    "name_placeholder": "Nombra esta clave (p. ej. Claude Desktop)",
    "create": "Crear clave",
    "created": "Creada el {date}",
    "last_used": "último uso el {date}",
    "key_limit": "Se alcanzó el límite de {max} claves activas.",
    "rename": "Renombrar clave",
    "revoke": "Revocar",
    "save": "Guardar",
    "cancel": "Cancelar",
    "copy": "Copiar",
    "copied": "Copiado al portapapeles.",
    "copy_error": "No se pudo copiar. Selecciona el texto y cópialo manualmente.",
    "reveal_title": "Tu nueva clave de API",
    "reveal_description": "Pega esta clave en tu cliente MCP como token Bearer.",
    "reveal_warning": "Esta es la única vez que se muestra la clave. Guárdala ahora: no se puede recuperar después, solo reemplazar.",
    "reveal_done": "Guardé mi clave",
    "revoke_title": "¿Revocar clave?",
    "revoke_confirm": "\"{name}\" dejará de funcionar de inmediato. Esto no se puede deshacer.",
    "revoke_success": "Clave revocada.",
    "revoke_error": "No se pudo revocar esa clave.",
    "rename_error": "No se pudo renombrar esa clave.",
    "create_error": "No se pudo crear una clave.",
    "create_limit_error": "Ya tienes {max} claves activas. Revoca una primero.",
    "load_error": "No se pudieron cargar tus claves de API.",
    "usage_title": "Uso — últimos 30 días",
    "usage_description": "{count} llamadas a herramientas en los últimos 30 días, contadas por herramienta y día.",
    "usage_empty": "Aún no hay llamadas registradas. Apunta un cliente MCP al endpoint superior y este gráfico se llenará.",
    "usage_axis": "Llamadas por día",
    "setup_title": "Primeros pasos",
    "setup_description": "Elige tu cliente de IA abajo, pega el fragmento y sustituye una de tus claves."
  },
  "fr": {
    "plan_title": "API développeur",
    "plan_free": "Offre gratuite",
    "plan_developer": "Développeur",
    "plan_yearly": "Annuel",
    "plan_free_description": "Vos clés peuvent utiliser les calculateurs et les tables de référence à 20 requêtes par minute. Abonnez-vous pour débloquer les décodeurs de châssis et de moteur, les archives de roues et de couleurs, et 240 requêtes par minute.",
    "plan_developer_description": "Votre abonnement débloque les 11 outils MCP à 240 requêtes par minute sur chaque clé.",
    "endpoint_title": "Endpoint MCP",
    "upgrade_cta": "Voir les offres",
    "manage_billing": "Gérer la facturation",
    "keys_title": "Clés d'API",
    "keys_description": "Les clés authentifient les clients MCP auprès de l'endpoint ci-dessus via un en-tête Bearer. Vous pouvez détenir jusqu'à 5 clés actives — une par client ou intégration.",
    "keys_empty": "Aucune clé d'API pour le moment. Nommez-en une ci-dessous pour commencer.",
    "name_placeholder": "Nommez cette clé (p. ex. Claude Desktop)",
    "create": "Créer une clé",
    "created": "Créée le {date}",
    "last_used": "dernière utilisation le {date}",
    "key_limit": "Limite de {max} clés actives atteinte.",
    "rename": "Renommer la clé",
    "revoke": "Révoquer",
    "save": "Enregistrer",
    "cancel": "Annuler",
    "copy": "Copier",
    "copied": "Copié dans le presse-papiers.",
    "copy_error": "Copie impossible. Sélectionnez le texte et copiez-le manuellement.",
    "reveal_title": "Votre nouvelle clé d'API",
    "reveal_description": "Collez cette clé dans votre client MCP comme jeton Bearer.",
    "reveal_warning": "C'est la seule fois où la clé est affichée. Enregistrez-la maintenant — elle ne peut pas être récupérée, seulement remplacée.",
    "reveal_done": "J'ai enregistré ma clé",
    "revoke_title": "Révoquer la clé ?",
    "revoke_confirm": "« {name} » cessera de fonctionner immédiatement. Cette action est irréversible.",
    "revoke_success": "Clé révoquée.",
    "revoke_error": "Impossible de révoquer cette clé.",
    "rename_error": "Impossible de renommer cette clé.",
    "create_error": "Impossible de créer une clé.",
    "create_limit_error": "Vous détenez déjà {max} clés actives. Révoquez-en une d'abord.",
    "load_error": "Impossible de charger vos clés d'API.",
    "usage_title": "Utilisation — 30 derniers jours",
    "usage_description": "{count} appels d'outils sur les 30 derniers jours, comptés par outil et par jour.",
    "usage_empty": "Aucun appel enregistré pour le moment. Pointez un client MCP vers l'endpoint ci-dessus et ce graphique se remplira.",
    "usage_axis": "Appels par jour",
    "setup_title": "Premiers pas",
    "setup_description": "Choisissez votre client d'IA ci-dessous, collez l'extrait et insérez l'une de vos clés."
  },
  "de": {
    "plan_title": "Entwickler-API",
    "plan_free": "Kostenlose Stufe",
    "plan_developer": "Entwickler",
    "plan_yearly": "Jährlich",
    "plan_free_description": "Ihre Schlüssel können die Rechner und Referenztabellen mit 20 Anfragen pro Minute nutzen. Abonnieren Sie, um die Fahrgestell- und Motor-Decoder, die Felgen- und Farbarchive sowie 240 Anfragen pro Minute freizuschalten.",
    "plan_developer_description": "Ihr Abonnement schaltet alle 11 MCP-Tools mit 240 Anfragen pro Minute auf jedem Schlüssel frei.",
    "endpoint_title": "MCP-Endpunkt",
    "upgrade_cta": "Tarife ansehen",
    "manage_billing": "Abrechnung verwalten",
    "keys_title": "API-Schlüssel",
    "keys_description": "Schlüssel authentifizieren MCP-Clients am obigen Endpunkt über einen Bearer-Header. Sie können bis zu 5 aktive Schlüssel halten — einen pro Client oder Integration.",
    "keys_empty": "Noch keine API-Schlüssel. Benennen Sie unten einen, um zu starten.",
    "name_placeholder": "Diesen Schlüssel benennen (z. B. Claude Desktop)",
    "create": "Schlüssel erstellen",
    "created": "Erstellt am {date}",
    "last_used": "zuletzt verwendet am {date}",
    "key_limit": "Limit von {max} aktiven Schlüsseln erreicht.",
    "rename": "Schlüssel umbenennen",
    "revoke": "Widerrufen",
    "save": "Speichern",
    "cancel": "Abbrechen",
    "copy": "Kopieren",
    "copied": "In die Zwischenablage kopiert.",
    "copy_error": "Kopieren nicht möglich. Markieren Sie den Text und kopieren Sie ihn manuell.",
    "reveal_title": "Ihr neuer API-Schlüssel",
    "reveal_description": "Fügen Sie diesen Schlüssel als Bearer-Token in Ihren MCP-Client ein.",
    "reveal_warning": "Der Schlüssel wird nur dieses eine Mal angezeigt. Speichern Sie ihn jetzt — er kann später nicht wiederhergestellt, nur ersetzt werden.",
    "reveal_done": "Schlüssel gespeichert",
    "revoke_title": "Schlüssel widerrufen?",
    "revoke_confirm": "\"{name}\" funktioniert sofort nicht mehr. Dies kann nicht rückgängig gemacht werden.",
    "revoke_success": "Schlüssel widerrufen.",
    "revoke_error": "Dieser Schlüssel konnte nicht widerrufen werden.",
    "rename_error": "Dieser Schlüssel konnte nicht umbenannt werden.",
    "create_error": "Es konnte kein Schlüssel erstellt werden.",
    "create_limit_error": "Sie halten bereits {max} aktive Schlüssel. Widerrufen Sie zuerst einen.",
    "load_error": "Ihre API-Schlüssel konnten nicht geladen werden.",
    "usage_title": "Nutzung — letzte 30 Tage",
    "usage_description": "{count} Tool-Aufrufe in den letzten 30 Tagen, gezählt pro Tool und Tag.",
    "usage_empty": "Noch keine Aufrufe erfasst. Richten Sie einen MCP-Client auf den obigen Endpunkt und dieses Diagramm füllt sich.",
    "usage_axis": "Aufrufe pro Tag",
    "setup_title": "Erste Schritte",
    "setup_description": "Wählen Sie unten Ihren KI-Client, fügen Sie das Snippet ein und setzen Sie einen Ihrer Schlüssel ein."
  },
  "it": {
    "plan_title": "API per sviluppatori",
    "plan_free": "Livello gratuito",
    "plan_developer": "Sviluppatore",
    "plan_yearly": "Annuale",
    "plan_free_description": "Le tue chiavi possono usare i calcolatori e le tabelle di riferimento a 20 richieste al minuto. Abbonati per sbloccare i decodificatori di telaio e motore, gli archivi di ruote e colori e 240 richieste al minuto.",
    "plan_developer_description": "Il tuo abbonamento sblocca tutti gli 11 strumenti MCP a 240 richieste al minuto su ogni chiave.",
    "endpoint_title": "Endpoint MCP",
    "upgrade_cta": "Vedi i piani",
    "manage_billing": "Gestisci fatturazione",
    "keys_title": "Chiavi API",
    "keys_description": "Le chiavi autenticano i client MCP sull'endpoint qui sopra tramite un header Bearer. Puoi avere fino a 5 chiavi attive — una per client o integrazione.",
    "keys_empty": "Nessuna chiave API per ora. Assegna un nome qui sotto per iniziare.",
    "name_placeholder": "Assegna un nome a questa chiave (es. Claude Desktop)",
    "create": "Crea chiave",
    "created": "Creata il {date}",
    "last_used": "ultimo utilizzo il {date}",
    "key_limit": "Raggiunto il limite di {max} chiavi attive.",
    "rename": "Rinomina chiave",
    "revoke": "Revoca",
    "save": "Salva",
    "cancel": "Annulla",
    "copy": "Copia",
    "copied": "Copiato negli appunti.",
    "copy_error": "Impossibile copiare. Seleziona il testo e copialo manualmente.",
    "reveal_title": "La tua nuova chiave API",
    "reveal_description": "Incolla questa chiave nel tuo client MCP come token Bearer.",
    "reveal_warning": "Questa è l'unica volta in cui la chiave viene mostrata. Salvala ora — non può essere recuperata, solo sostituita.",
    "reveal_done": "Ho salvato la mia chiave",
    "revoke_title": "Revocare la chiave?",
    "revoke_confirm": "\"{name}\" smetterà di funzionare immediatamente. L'operazione non è reversibile.",
    "revoke_success": "Chiave revocata.",
    "revoke_error": "Impossibile revocare quella chiave.",
    "rename_error": "Impossibile rinominare quella chiave.",
    "create_error": "Impossibile creare una chiave.",
    "create_limit_error": "Hai già {max} chiavi attive. Revocane prima una.",
    "load_error": "Impossibile caricare le tue chiavi API.",
    "usage_title": "Utilizzo — ultimi 30 giorni",
    "usage_description": "{count} chiamate agli strumenti negli ultimi 30 giorni, contate per strumento e giorno.",
    "usage_empty": "Nessuna chiamata registrata per ora. Punta un client MCP all'endpoint qui sopra e questo grafico si riempirà.",
    "usage_axis": "Chiamate al giorno",
    "setup_title": "Per iniziare",
    "setup_description": "Scegli il tuo client di IA qui sotto, incolla lo snippet e inserisci una delle tue chiavi."
  },
  "pt": {
    "plan_title": "API para desenvolvedores",
    "plan_free": "Nível gratuito",
    "plan_developer": "Desenvolvedor",
    "plan_yearly": "Anual",
    "plan_free_description": "Suas chaves podem usar as calculadoras e tabelas de referência a 20 solicitações por minuto. Assine para desbloquear os decodificadores de chassi e motor, os arquivos de rodas e cores, e 240 solicitações por minuto.",
    "plan_developer_description": "Sua assinatura desbloqueia as 11 ferramentas MCP a 240 solicitações por minuto em cada chave.",
    "endpoint_title": "Endpoint MCP",
    "upgrade_cta": "Ver planos",
    "manage_billing": "Gerenciar cobrança",
    "keys_title": "Chaves de API",
    "keys_description": "As chaves autenticam clientes MCP no endpoint acima via cabeçalho Bearer. Você pode ter até 5 chaves ativas — use uma por cliente ou integração.",
    "keys_empty": "Ainda não há chaves de API. Nomeie uma abaixo para começar.",
    "name_placeholder": "Nomeie esta chave (ex.: Claude Desktop)",
    "create": "Criar chave",
    "created": "Criada em {date}",
    "last_used": "último uso em {date}",
    "key_limit": "Limite de {max} chaves ativas atingido.",
    "rename": "Renomear chave",
    "revoke": "Revogar",
    "save": "Salvar",
    "cancel": "Cancelar",
    "copy": "Copiar",
    "copied": "Copiado para a área de transferência.",
    "copy_error": "Não foi possível copiar. Selecione o texto e copie manualmente.",
    "reveal_title": "Sua nova chave de API",
    "reveal_description": "Cole esta chave no seu cliente MCP como token Bearer.",
    "reveal_warning": "Esta é a única vez que a chave é mostrada. Guarde-a agora — ela não pode ser recuperada depois, apenas substituída.",
    "reveal_done": "Salvei minha chave",
    "revoke_title": "Revogar chave?",
    "revoke_confirm": "\"{name}\" deixará de funcionar imediatamente. Isso não pode ser desfeito.",
    "revoke_success": "Chave revogada.",
    "revoke_error": "Não foi possível revogar essa chave.",
    "rename_error": "Não foi possível renomear essa chave.",
    "create_error": "Não foi possível criar uma chave.",
    "create_limit_error": "Você já tem {max} chaves ativas. Revogue uma primeiro.",
    "load_error": "Não foi possível carregar suas chaves de API.",
    "usage_title": "Uso — últimos 30 dias",
    "usage_description": "{count} chamadas de ferramentas nos últimos 30 dias, contadas por ferramenta e dia.",
    "usage_empty": "Nenhuma chamada registrada ainda. Aponte um cliente MCP para o endpoint acima e este gráfico será preenchido.",
    "usage_axis": "Chamadas por dia",
    "setup_title": "Começando",
    "setup_description": "Escolha seu cliente de IA abaixo, cole o trecho e insira uma das suas chaves."
  },
  "ru": {
    "plan_title": "API для разработчиков",
    "plan_free": "Бесплатный уровень",
    "plan_developer": "Разработчик",
    "plan_yearly": "Годовая",
    "plan_free_description": "Ваши ключи могут использовать калькуляторы и справочные таблицы с лимитом 20 запросов в минуту. Оформите подписку, чтобы открыть декодеры шасси и двигателя, архивы колёс и цветов и 240 запросов в минуту.",
    "plan_developer_description": "Ваша подписка открывает все 11 инструментов MCP с лимитом 240 запросов в минуту для каждого ключа.",
    "endpoint_title": "Endpoint MCP",
    "upgrade_cta": "Посмотреть тарифы",
    "manage_billing": "Управлять оплатой",
    "keys_title": "Ключи API",
    "keys_description": "Ключи аутентифицируют клиенты MCP на указанном выше endpoint через заголовок Bearer. Можно держать до 5 активных ключей — по одному на клиент или интеграцию.",
    "keys_empty": "Ключей API пока нет. Назовите один ниже, чтобы начать.",
    "name_placeholder": "Назовите этот ключ (например, Claude Desktop)",
    "create": "Создать ключ",
    "created": "Создан {date}",
    "last_used": "последнее использование {date}",
    "key_limit": "Достигнут лимит в {max} активных ключей.",
    "rename": "Переименовать ключ",
    "revoke": "Отозвать",
    "save": "Сохранить",
    "cancel": "Отмена",
    "copy": "Копировать",
    "copied": "Скопировано в буфер обмена.",
    "copy_error": "Не удалось скопировать. Выделите текст и скопируйте вручную.",
    "reveal_title": "Ваш новый ключ API",
    "reveal_description": "Вставьте этот ключ в ваш клиент MCP как токен Bearer.",
    "reveal_warning": "Ключ показывается только один раз. Сохраните его сейчас — восстановить его нельзя, только заменить.",
    "reveal_done": "Я сохранил ключ",
    "revoke_title": "Отозвать ключ?",
    "revoke_confirm": "«{name}» немедленно перестанет работать. Это действие необратимо.",
    "revoke_success": "Ключ отозван.",
    "revoke_error": "Не удалось отозвать этот ключ.",
    "rename_error": "Не удалось переименовать этот ключ.",
    "create_error": "Не удалось создать ключ.",
    "create_limit_error": "У вас уже {max} активных ключей. Сначала отзовите один.",
    "load_error": "Не удалось загрузить ваши ключи API.",
    "usage_title": "Использование — последние 30 дней",
    "usage_description": "{count} вызовов инструментов за последние 30 дней, по инструментам и дням.",
    "usage_empty": "Вызовы пока не зарегистрированы. Направьте клиент MCP на endpoint выше, и график заполнится.",
    "usage_axis": "Вызовы в день",
    "setup_title": "Начало работы",
    "setup_description": "Выберите ниже свой ИИ-клиент, вставьте фрагмент и подставьте один из ваших ключей."
  },
  "ja": {
    "plan_title": "開発者向けAPI",
    "plan_free": "無料プラン",
    "plan_developer": "開発者",
    "plan_yearly": "年額",
    "plan_free_description": "お使いのキーでは、計算ツールとリファレンス表を毎分20リクエストまで利用できます。サブスクリプションに登録すると、シャシー／エンジンのデコーダー、ホイールとカラーのアーカイブ、毎分240リクエストが利用可能になります。",
    "plan_developer_description": "サブスクリプションにより、すべてのキーで11個のMCPツールを毎分240リクエストまで利用できます。",
    "endpoint_title": "MCPエンドポイント",
    "upgrade_cta": "プランを見る",
    "manage_billing": "請求を管理",
    "keys_title": "APIキー",
    "keys_description": "キーは Bearer ヘッダーで上記エンドポイントに対して MCP クライアントを認証します。アクティブなキーは最大5個 — クライアントや連携ごとに1個ずつの利用を推奨します。",
    "keys_empty": "APIキーはまだありません。下で名前を付けて作成してください。",
    "name_placeholder": "このキーに名前を付ける（例：Claude Desktop）",
    "create": "キーを作成",
    "created": "{date} に作成",
    "last_used": "最終使用 {date}",
    "key_limit": "アクティブなキーの上限（{max}個）に達しました。",
    "rename": "キー名を変更",
    "revoke": "無効化",
    "save": "保存",
    "cancel": "キャンセル",
    "copy": "コピー",
    "copied": "クリップボードにコピーしました。",
    "copy_error": "コピーできませんでした。テキストを選択して手動でコピーしてください。",
    "reveal_title": "新しいAPIキー",
    "reveal_description": "このキーを Bearer トークンとして MCP クライアントに貼り付けてください。",
    "reveal_warning": "キーが表示されるのはこの一度だけです。今すぐ保存してください — 後から復元はできず、再発行のみ可能です。",
    "reveal_done": "キーを保存しました",
    "revoke_title": "キーを無効化しますか？",
    "revoke_confirm": "「{name}」は直ちに使用できなくなります。この操作は取り消せません。",
    "revoke_success": "キーを無効化しました。",
    "revoke_error": "そのキーを無効化できませんでした。",
    "rename_error": "そのキーの名前を変更できませんでした。",
    "create_error": "キーを作成できませんでした。",
    "create_limit_error": "すでに{max}個のアクティブなキーがあります。先に1つ無効化してください。",
    "load_error": "APIキーを読み込めませんでした。",
    "usage_title": "利用状況 — 過去30日間",
    "usage_description": "過去30日間のツール呼び出しは {count} 回（ツール別・日別に集計）。",
    "usage_empty": "まだ呼び出しは記録されていません。上記エンドポイントに MCP クライアントを接続すると、このグラフに反映されます。",
    "usage_axis": "1日あたりの呼び出し数",
    "setup_title": "はじめに",
    "setup_description": "下から AI クライアントを選び、スニペットを貼り付けて、お持ちのキーに置き換えてください。"
  },
  "zh": {
    "plan_title": "开发者 API",
    "plan_free": "免费档",
    "plan_developer": "开发者",
    "plan_yearly": "年付",
    "plan_free_description": "您的密钥可以每分钟 20 次请求使用计算器和参考数据表。订阅后可解锁车架号和发动机解码器、轮毂与颜色档案，以及每分钟 240 次请求。",
    "plan_developer_description": "您的订阅为每个密钥解锁全部 11 个 MCP 工具，每分钟 240 次请求。",
    "endpoint_title": "MCP 端点",
    "upgrade_cta": "查看方案",
    "manage_billing": "管理账单",
    "keys_title": "API 密钥",
    "keys_description": "密钥通过 Bearer 请求头在上述端点验证 MCP 客户端。最多可持有 5 个有效密钥——建议每个客户端或集成使用一个。",
    "keys_empty": "还没有 API 密钥。在下方命名一个即可开始。",
    "name_placeholder": "为此密钥命名（如 Claude Desktop）",
    "create": "创建密钥",
    "created": "创建于 {date}",
    "last_used": "上次使用 {date}",
    "key_limit": "已达到 {max} 个有效密钥的上限。",
    "rename": "重命名密钥",
    "revoke": "吊销",
    "save": "保存",
    "cancel": "取消",
    "copy": "复制",
    "copied": "已复制到剪贴板。",
    "copy_error": "无法复制。请选中文本手动复制。",
    "reveal_title": "您的新 API 密钥",
    "reveal_description": "将此密钥作为 Bearer 令牌粘贴到您的 MCP 客户端中。",
    "reveal_warning": "密钥仅显示这一次。请立即保存——之后无法找回，只能重新创建。",
    "reveal_done": "我已保存密钥",
    "revoke_title": "吊销密钥？",
    "revoke_confirm": "“{name}”将立即停止工作。此操作无法撤销。",
    "revoke_success": "密钥已吊销。",
    "revoke_error": "无法吊销该密钥。",
    "rename_error": "无法重命名该密钥。",
    "create_error": "无法创建密钥。",
    "create_limit_error": "您已持有 {max} 个有效密钥。请先吊销一个。",
    "load_error": "无法加载您的 API 密钥。",
    "usage_title": "用量 — 最近 30 天",
    "usage_description": "最近 30 天共 {count} 次工具调用，按工具和日期统计。",
    "usage_empty": "尚未记录任何调用。将 MCP 客户端指向上述端点，此图表就会填充。",
    "usage_axis": "每日调用次数",
    "setup_title": "快速开始",
    "setup_description": "在下方选择您的 AI 客户端，粘贴代码片段，并换成您的密钥之一。"
  },
  "ko": {
    "plan_title": "개발자 API",
    "plan_free": "무료 등급",
    "plan_developer": "개발자",
    "plan_yearly": "연간",
    "plan_free_description": "보유한 키로 계산기와 참조 표를 분당 20회 요청까지 사용할 수 있습니다. 구독하면 섀시·엔진 디코더, 휠·컬러 아카이브, 분당 240회 요청이 잠금 해제됩니다.",
    "plan_developer_description": "구독을 통해 모든 키에서 11개 MCP 도구를 분당 240회 요청으로 사용할 수 있습니다.",
    "endpoint_title": "MCP 엔드포인트",
    "upgrade_cta": "요금제 보기",
    "manage_billing": "결제 관리",
    "keys_title": "API 키",
    "keys_description": "키는 Bearer 헤더로 위 엔드포인트에서 MCP 클라이언트를 인증합니다. 활성 키는 최대 5개 — 클라이언트나 통합마다 하나씩 사용하세요.",
    "keys_empty": "아직 API 키가 없습니다. 아래에서 이름을 지정해 시작하세요.",
    "name_placeholder": "이 키의 이름을 지정하세요 (예: Claude Desktop)",
    "create": "키 만들기",
    "created": "{date}에 생성됨",
    "last_used": "마지막 사용 {date}",
    "key_limit": "활성 키 한도({max}개)에 도달했습니다.",
    "rename": "키 이름 변경",
    "revoke": "폐기",
    "save": "저장",
    "cancel": "취소",
    "copy": "복사",
    "copied": "클립보드에 복사되었습니다.",
    "copy_error": "복사할 수 없습니다. 텍스트를 선택해 직접 복사하세요.",
    "reveal_title": "새 API 키",
    "reveal_description": "이 키를 Bearer 토큰으로 MCP 클라이언트에 붙여넣으세요.",
    "reveal_warning": "키는 이번 한 번만 표시됩니다. 지금 저장하세요 — 나중에 복구할 수 없으며 교체만 가능합니다.",
    "reveal_done": "키를 저장했습니다",
    "revoke_title": "키를 폐기할까요?",
    "revoke_confirm": "\"{name}\"은(는) 즉시 작동을 멈춥니다. 이 작업은 취소할 수 없습니다.",
    "revoke_success": "키가 폐기되었습니다.",
    "revoke_error": "해당 키를 폐기하지 못했습니다.",
    "rename_error": "해당 키의 이름을 변경하지 못했습니다.",
    "create_error": "키를 만들지 못했습니다.",
    "create_limit_error": "이미 {max}개의 활성 키를 보유 중입니다. 먼저 하나를 폐기하세요.",
    "load_error": "API 키를 불러오지 못했습니다.",
    "usage_title": "사용량 — 최근 30일",
    "usage_description": "최근 30일간 도구 호출 {count}회 (도구·일 단위 집계).",
    "usage_empty": "아직 기록된 호출이 없습니다. 위 엔드포인트에 MCP 클라이언트를 연결하면 이 차트가 채워집니다.",
    "usage_axis": "일별 호출 수",
    "setup_title": "시작하기",
    "setup_description": "아래에서 AI 클라이언트를 고르고 스니펫을 붙여넣은 뒤, 보유한 키로 바꾸세요."
  }
}
</i18n>
