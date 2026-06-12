<script setup lang="ts">
  import { HERO_TYPES } from '~~/data/models/generic';
  import { type ModelDetail, type ModelFileInfo, priceLabel, formatBytes } from '~~/data/models/model-library';

  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const slug = computed(() => String(route.params.slug));
  const { isAuthenticated, user } = useAuth();
  const supabase = useSupabase();
  const { verifyPurchase } = useModelCheckout();

  const { data, error } = await useFetch<ModelDetail>(() => `/api/models/${slug.value}`);
  if (error.value) {
    throw createError({ statusCode: error.value.statusCode || 404, statusMessage: 'Model not found', fatal: true });
  }
  const model = computed(() => data.value);

  const renderableFiles = computed(() => model.value?.files.filter((f) => f.isRenderable) ?? []);
  const isFree = computed(() => (model.value ? ['free', 'tips'].includes(model.value.pricingMode) : false));
  const price = computed(() => (model.value ? priceLabel(model.value) : ''));
  const licenseTxtUrl = computed(() =>
    model.value?.version ? `/api/models/${model.value.id}/versions/${model.value.version.id}/license.txt` : null
  );

  function downloadUrl(fileId: string) {
    return `/api/models/${model.value?.id}/files/${fileId}/download`;
  }

  const isOwner = computed(() => !!user.value && model.value?.author?.id === user.value.id);
  const acceptsTips = computed(() => !!model.value && model.value.pricingMode !== 'free');

  // Whether the viewer may download. Free/tips and the owner are always allowed;
  // paid models need a purchase, confirmed by the has_model_entitlement RPC
  // (auto-authed via PostgREST). Seeded so free models show downloads on SSR.
  const entitled = ref(isFree.value);
  async function refreshEntitlement() {
    if (!model.value) return;
    if (isFree.value || isOwner.value) {
      entitled.value = true;
      return;
    }
    if (!isAuthenticated.value) {
      entitled.value = false;
      return;
    }
    const { data } = await supabase.rpc('has_model_entitlement', { p_model_id: model.value.id });
    entitled.value = !!data;
  }

  // Success-page handling: the Stripe redirect lands back here with
  // ?purchase=success&session_id=… — verify (webhook-lag fallback) then unlock.
  const purchaseNotice = ref<{ type: 'success' | 'info'; text: string } | null>(null);
  async function handlePurchaseReturn() {
    const q = route.query;
    if (q.purchase === 'success') {
      const sid = typeof q.session_id === 'string' ? q.session_id : '';
      if (sid && model.value) {
        const res = await verifyPurchase(model.value.id, sid);
        if (res.verified) {
          purchaseNotice.value = {
            type: 'success',
            text: res.kind === 'tip' ? t('notice.thankYouTip') : t('notice.purchaseComplete'),
          };
          await refreshEntitlement();
        } else {
          purchaseNotice.value = {
            type: 'info',
            text: t('notice.paymentPending'),
          };
        }
      } else {
        purchaseNotice.value = { type: 'success', text: t('notice.thankYouSupport') };
      }
      router.replace({ query: {} });
    } else if (q.purchase === 'cancelled') {
      purchaseNotice.value = { type: 'info', text: t('notice.checkoutCancelled') };
      router.replace({ query: {} });
    }
  }

  onMounted(async () => {
    await refreshEntitlement();
    await handlePurchaseReturn();
  });
  watch(isAuthenticated, () => refreshEntitlement());

  // Media area: a renderable file (3D) or a gallery image. Driven by a watcher so
  // it re-initializes if the page component is reused across /models/[slug]
  // navigations (the model data changes but setup runs only once).
  type Media = { kind: '3d'; file: ModelFileInfo } | { kind: 'image'; url: string; alt: string };
  const activeMedia = ref<Media | null>(null);
  function initMedia() {
    const m = model.value;
    if (!m) {
      activeMedia.value = null;
      return;
    }
    if (renderableFiles.value.length) activeMedia.value = { kind: '3d', file: renderableFiles.value[0]! };
    else if (m.images.length)
      activeMedia.value = { kind: 'image', url: m.images[0]!.url, alt: m.images[0]!.altText || m.title };
    else activeMedia.value = null;
  }
  watch(model, initMedia, { immediate: true });

  const fileExtIcon: Record<string, string> = {
    stl: 'fa-cube',
    '3mf': 'fa-cube',
    obj: 'fa-cube',
    step: 'fa-drafting-compass',
    stp: 'fa-drafting-compass',
    f3d: 'fa-drafting-compass',
    f3z: 'fa-drafting-compass',
    pdf: 'fa-file-pdf',
  };

  useHead(() => ({ title: `${model.value?.title ?? t('meta.defaultTitle')} | Classic Mini DIY` }));
  useSeoMeta({
    title: () => `${model.value?.title ?? t('meta.defaultTitle')} | Classic Mini DIY`,
    description: () => model.value?.summary || t('meta.defaultDescription'),
    ogTitle: () => model.value?.title,
    ogDescription: () => model.value?.summary || '',
    ogImage: () => model.value?.images?.[0]?.url || '',
    ogType: 'article',
  });
</script>

<template>
  <hero :navigation="true" :title="t('hero.title')" :heroType="HERO_TYPES.ARCHIVE" />
  <div class="container mx-auto px-4" v-if="model">
    <breadcrumb class="my-6" :page="model.title" :subpage="t('breadcrumb.subpage')" subpageHref="/models" />

    <div class="grid grid-cols-12 gap-6">
      <!-- Media column -->
      <div class="col-span-12 lg:col-span-7 space-y-3">
        <div v-if="activeMedia?.kind === '3d'">
          <ModelsModelViewer3D
            :key="activeMedia.file.id"
            :model-id="model.id"
            :file-id="activeMedia.file.id"
            :file-ext="activeMedia.file.fileExt"
            :file-name="activeMedia.file.fileName"
            :size-bytes="activeMedia.file.sizeBytes"
          />
        </div>
        <div
          v-else-if="activeMedia?.kind === 'image'"
          class="rounded-xl overflow-hidden border border-base-300 bg-base-200"
          style="aspect-ratio: 4 / 3"
        >
          <img :src="activeMedia.url" :alt="activeMedia.alt" class="w-full h-full object-contain" />
        </div>
        <div
          v-else
          class="rounded-xl border border-base-300 bg-base-200 flex items-center justify-center"
          style="aspect-ratio: 4 / 3"
        >
          <i class="fas fa-cube text-5xl opacity-20"></i>
        </div>

        <!-- Thumbnail strip -->
        <div v-if="renderableFiles.length + model.images.length > 1" class="flex flex-wrap gap-2">
          <button
            v-for="file in renderableFiles"
            :key="file.id"
            class="w-16 h-16 rounded-lg border-2 flex flex-col items-center justify-center text-xs gap-0.5"
            :class="
              activeMedia?.kind === '3d' && activeMedia.file.id === file.id
                ? 'border-primary bg-primary/10'
                : 'border-base-300 hover:border-primary/50'
            "
            @click="activeMedia = { kind: '3d', file }"
          >
            <i class="fas fa-cube"></i>
            <span class="uppercase opacity-60">{{ file.fileExt }}</span>
          </button>
          <button
            v-for="img in model.images"
            :key="img.id"
            class="w-16 h-16 rounded-lg border-2 overflow-hidden"
            :class="
              activeMedia?.kind === 'image' && activeMedia.url === img.url
                ? 'border-primary'
                : 'border-base-300 hover:border-primary/50'
            "
            @click="activeMedia = { kind: 'image', url: img.url, alt: img.altText || model.title }"
          >
            <img :src="img.url" :alt="img.altText || model.title" class="w-full h-full object-cover" loading="lazy" />
          </button>
        </div>
      </div>

      <!-- Info column -->
      <div class="col-span-12 lg:col-span-5 space-y-4">
        <div>
          <h1 class="text-3xl font-bold leading-tight">{{ model.title }}</h1>
          <p v-if="model.summary" class="mt-1 opacity-70">{{ model.summary }}</p>
        </div>

        <div v-if="model.author" class="flex items-center gap-2">
          <img
            v-if="model.author.avatarUrl"
            :src="model.author.avatarUrl"
            class="w-8 h-8 rounded-full object-cover"
            :alt="model.author.displayName || t('author.fallback')"
          />
          <i v-else class="fas fa-circle-user text-2xl opacity-60"></i>
          <span class="text-sm"
            >{{ t('author.by') }} <strong>{{ model.author.displayName || model.author.username || t('author.anonymous') }}</strong></span
          >
        </div>

        <!-- Stats + actions -->
        <div class="flex items-center gap-3 flex-wrap">
          <ModelsModelLikeButton :model-id="model.id" :initial-count="model.likeCount" />
          <span class="text-sm opacity-70"><i class="fas fa-comment mr-1"></i>{{ model.commentCount }}</span>
          <span class="text-sm opacity-70"><i class="fas fa-download mr-1"></i>{{ model.downloadCount }}</span>
          <span v-if="model.versionCount > 1" class="text-sm opacity-70">
            <i class="fas fa-code-branch mr-1"></i>v{{ model.version?.versionNumber }}
          </span>
          <ModelsModelReportModal :model-id="model.id" class="ml-auto" />
        </div>

        <ModelsSafetyDisclaimer :safety-critical="model.safetyCritical" />

        <!-- License -->
        <div class="space-y-2">
          <ModelsLicenseBadge :license="model.license" />
          <a
            v-if="licenseTxtUrl"
            :href="licenseTxtUrl"
            target="_blank"
            rel="noopener"
            class="text-xs link link-hover opacity-70 block"
          >
            <i class="fas fa-file-lines mr-1"></i> {{ t('license.viewTxt') }}
          </a>
          <NuxtLink
            v-if="model.license.isPaid"
            to="/legal/paid-file-license"
            class="text-xs link link-hover opacity-70 block"
          >
            <i class="fas fa-scale-balanced mr-1"></i> {{ t('license.paidTerms') }}
          </NuxtLink>
        </div>

        <!-- Pricing + download -->
        <div class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body p-4 gap-3">
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-2xl font-bold" :class="isFree ? 'text-success' : 'text-primary'">{{ price }}</span>
              <span v-if="isOwner" class="badge badge-neutral badge-sm">{{ t('pricing.yourModel') }}</span>
              <span v-else-if="entitled && !isFree" class="badge badge-success badge-sm">
                <i class="fas fa-check mr-1"></i> {{ t('pricing.purchased') }}
              </span>
              <span v-else class="text-xs opacity-60">{{ t('pricing.buyersGetAllVersions') }}</span>
            </div>

            <div
              v-if="purchaseNotice"
              role="alert"
              class="alert alert-soft py-2 text-sm"
              :class="purchaseNotice.type === 'success' ? 'alert-success' : 'alert-info'"
            >
              <i class="fas" :class="purchaseNotice.type === 'success' ? 'fa-circle-check' : 'fa-circle-info'"></i>
              <span>{{ purchaseNotice.text }}</span>
            </div>

            <template v-if="entitled">
              <a
                v-for="file in model.files"
                :key="file.id"
                :href="downloadUrl(file.id)"
                class="btn btn-sm justify-start gap-2"
                :class="file.isRenderable ? 'btn-primary' : 'btn-outline'"
              >
                <i class="fas" :class="fileExtIcon[file.fileExt] || 'fa-file'"></i>
                <span class="truncate flex-1 text-left">{{ file.fileName }}</span>
                <span class="text-xs opacity-70">{{ formatBytes(file.sizeBytes) }}</span>
              </a>
              <p v-if="!isAuthenticated" class="text-xs opacity-60">
                <i class="fas fa-circle-info mr-1"></i> {{ t('download.signInRequired') }}
              </p>
            </template>

            <ModelsPriceBox v-else :model="model" />
          </div>
        </div>

        <!-- Tips -->
        <ModelsTipPicker v-if="acceptsTips && !isOwner" :model-id="model.id" :currency="model.currency" />

        <!-- Tags -->
        <div v-if="model.tags.length" class="flex flex-wrap gap-1.5">
          <span v-for="tag in model.tags" :key="tag" class="badge badge-ghost badge-sm">#{{ tag }}</span>
        </div>
      </div>

      <!-- Description -->
      <div v-if="model.description" class="col-span-12 lg:col-span-7">
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h2 class="card-title text-lg"><i class="fas fa-align-left text-primary mr-1"></i> {{ t('about.heading') }}</h2>
            <p class="whitespace-pre-line text-sm leading-relaxed">{{ model.description }}</p>
            <a
              v-if="model.sourceUrl"
              :href="model.sourceUrl"
              target="_blank"
              rel="noopener noreferrer nofollow"
              class="link link-primary text-sm mt-2"
            >
              <i class="fas fa-link mr-1"></i> {{ t('about.sourceLink') }}
            </a>
          </div>
        </div>
      </div>

      <!-- Spec sidebar -->
      <div class="col-span-12 lg:col-span-5 space-y-6">
        <ModelsModelPrintSettings :settings="model.version?.printSettings ?? null" />
      </div>

      <div class="col-span-12 lg:col-span-7 space-y-6">
        <ModelsModelHardwareBom :items="model.version?.hardwareBom ?? []" />
        <ModelsModelAssembly :assembly="model.version?.assembly ?? null" />
      </div>

      <!-- Changelog -->
      <div v-if="model.version?.changelog" class="col-span-12 lg:col-span-5">
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h3 class="card-title text-lg">
              <i class="fas fa-code-branch text-primary mr-1"></i> {{ t('changelog.heading', { version: model.version.versionNumber }) }}
            </h3>
            <p class="whitespace-pre-line text-sm opacity-80">{{ model.version.changelog }}</p>
          </div>
        </div>
      </div>

      <!-- Comments -->
      <div class="col-span-12 lg:col-span-8">
        <ModelsModelComments :model-id="model.id" />
      </div>

      <div class="col-span-12 md:col-span-10 md:col-start-2 pb-10 pt-4">
        <patreon-card size="large" />
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "hero": { "title": "3D Model Library" },
    "breadcrumb": { "subpage": "3D Models" },
    "meta": {
      "defaultTitle": "3D Model",
      "defaultDescription": "A 3D-printable part for the Classic Mini."
    },
    "author": {
      "fallback": "Author",
      "by": "by",
      "anonymous": "Anonymous"
    },
    "pricing": {
      "yourModel": "Your model",
      "purchased": "Purchased",
      "buyersGetAllVersions": "buyers get every version"
    },
    "download": {
      "signInRequired": "You'll need to sign in to download."
    },
    "notice": {
      "purchaseComplete": "Purchase complete — your files are unlocked below.",
      "thankYouTip": "Thank you for the tip!",
      "paymentPending": "Payment received — we're finalizing it. If your files aren't unlocked, refresh in a moment.",
      "thankYouSupport": "Thanks for your support!",
      "checkoutCancelled": "Checkout cancelled."
    },
    "license": {
      "viewTxt": "View LICENSE.txt",
      "paidTerms": "Paid File License terms"
    },
    "about": {
      "heading": "About this model",
      "sourceLink": "Source / original design"
    },
    "changelog": {
      "heading": "v{version} changelog"
    }
  },
  "es": {
    "hero": { "title": "Biblioteca de modelos 3D" },
    "breadcrumb": { "subpage": "Modelos 3D" },
    "meta": {
      "defaultTitle": "Modelo 3D",
      "defaultDescription": "Una pieza imprimible en 3D para el Classic Mini."
    },
    "author": {
      "fallback": "Autor",
      "by": "por",
      "anonymous": "Anónimo"
    },
    "pricing": {
      "yourModel": "Tu modelo",
      "purchased": "Comprado",
      "buyersGetAllVersions": "los compradores obtienen todas las versiones"
    },
    "download": {
      "signInRequired": "Debes iniciar sesión para descargar."
    },
    "notice": {
      "purchaseComplete": "Compra completada — tus archivos están desbloqueados abajo.",
      "thankYouTip": "¡Gracias por la propina!",
      "paymentPending": "Pago recibido — lo estamos procesando. Si tus archivos no se desbloquean, actualiza en un momento.",
      "thankYouSupport": "¡Gracias por tu apoyo!",
      "checkoutCancelled": "Pago cancelado."
    },
    "license": {
      "viewTxt": "Ver LICENSE.txt",
      "paidTerms": "Términos de licencia de archivo de pago"
    },
    "about": {
      "heading": "Acerca de este modelo",
      "sourceLink": "Fuente / diseño original"
    },
    "changelog": {
      "heading": "Registro de cambios v{version}"
    }
  },
  "fr": {
    "hero": { "title": "Bibliothèque de modèles 3D" },
    "breadcrumb": { "subpage": "Modèles 3D" },
    "meta": {
      "defaultTitle": "Modèle 3D",
      "defaultDescription": "Une pièce imprimable en 3D pour la Classic Mini."
    },
    "author": {
      "fallback": "Auteur",
      "by": "par",
      "anonymous": "Anonyme"
    },
    "pricing": {
      "yourModel": "Votre modèle",
      "purchased": "Acheté",
      "buyersGetAllVersions": "les acheteurs obtiennent toutes les versions"
    },
    "download": {
      "signInRequired": "Vous devez vous connecter pour télécharger."
    },
    "notice": {
      "purchaseComplete": "Achat effectué — vos fichiers sont déverrouillés ci-dessous.",
      "thankYouTip": "Merci pour le pourboire !",
      "paymentPending": "Paiement reçu — nous finalisons. Si vos fichiers ne sont pas déverrouillés, actualisez dans un instant.",
      "thankYouSupport": "Merci pour votre soutien !",
      "checkoutCancelled": "Paiement annulé."
    },
    "license": {
      "viewTxt": "Voir LICENSE.txt",
      "paidTerms": "Conditions de licence fichier payant"
    },
    "about": {
      "heading": "À propos de ce modèle",
      "sourceLink": "Source / design original"
    },
    "changelog": {
      "heading": "Journal des modifications v{version}"
    }
  },
  "de": {
    "hero": { "title": "3D-Modellbibliothek" },
    "breadcrumb": { "subpage": "3D-Modelle" },
    "meta": {
      "defaultTitle": "3D-Modell",
      "defaultDescription": "Ein 3D-druckbares Teil für den Classic Mini."
    },
    "author": {
      "fallback": "Autor",
      "by": "von",
      "anonymous": "Anonym"
    },
    "pricing": {
      "yourModel": "Dein Modell",
      "purchased": "Gekauft",
      "buyersGetAllVersions": "Käufer erhalten alle Versionen"
    },
    "download": {
      "signInRequired": "Zum Herunterladen musst du dich anmelden."
    },
    "notice": {
      "purchaseComplete": "Kauf abgeschlossen — deine Dateien sind unten freigeschaltet.",
      "thankYouTip": "Danke für das Trinkgeld!",
      "paymentPending": "Zahlung eingegangen — wir schließen ab. Falls deine Dateien noch gesperrt sind, aktualisiere in einem Moment.",
      "thankYouSupport": "Danke für deine Unterstützung!",
      "checkoutCancelled": "Checkout abgebrochen."
    },
    "license": {
      "viewTxt": "LICENSE.txt ansehen",
      "paidTerms": "Lizenzbedingungen für kostenpflichtige Dateien"
    },
    "about": {
      "heading": "Über dieses Modell",
      "sourceLink": "Quelle / Originaldesign"
    },
    "changelog": {
      "heading": "v{version} Änderungsprotokoll"
    }
  },
  "it": {
    "hero": { "title": "Libreria di modelli 3D" },
    "breadcrumb": { "subpage": "Modelli 3D" },
    "meta": {
      "defaultTitle": "Modello 3D",
      "defaultDescription": "Un pezzo stampabile in 3D per la Classic Mini."
    },
    "author": {
      "fallback": "Autore",
      "by": "di",
      "anonymous": "Anonimo"
    },
    "pricing": {
      "yourModel": "Il tuo modello",
      "purchased": "Acquistato",
      "buyersGetAllVersions": "gli acquirenti ricevono ogni versione"
    },
    "download": {
      "signInRequired": "Devi accedere per scaricare."
    },
    "notice": {
      "purchaseComplete": "Acquisto completato — i tuoi file sono sbloccati qui sotto.",
      "thankYouTip": "Grazie per la mancia!",
      "paymentPending": "Pagamento ricevuto — stiamo finalizzando. Se i file non si sbloccano, aggiorna tra un momento.",
      "thankYouSupport": "Grazie per il tuo supporto!",
      "checkoutCancelled": "Checkout annullato."
    },
    "license": {
      "viewTxt": "Visualizza LICENSE.txt",
      "paidTerms": "Termini della licenza file a pagamento"
    },
    "about": {
      "heading": "Informazioni su questo modello",
      "sourceLink": "Fonte / design originale"
    },
    "changelog": {
      "heading": "Changelog v{version}"
    }
  },
  "pt": {
    "hero": { "title": "Biblioteca de modelos 3D" },
    "breadcrumb": { "subpage": "Modelos 3D" },
    "meta": {
      "defaultTitle": "Modelo 3D",
      "defaultDescription": "Uma peça impressa em 3D para o Classic Mini."
    },
    "author": {
      "fallback": "Autor",
      "by": "por",
      "anonymous": "Anônimo"
    },
    "pricing": {
      "yourModel": "Seu modelo",
      "purchased": "Comprado",
      "buyersGetAllVersions": "compradores recebem todas as versões"
    },
    "download": {
      "signInRequired": "Você precisa fazer login para baixar."
    },
    "notice": {
      "purchaseComplete": "Compra concluída — seus arquivos estão desbloqueados abaixo.",
      "thankYouTip": "Obrigado pela gorjeta!",
      "paymentPending": "Pagamento recebido — estamos finalizando. Se seus arquivos não forem desbloqueados, atualize em um momento.",
      "thankYouSupport": "Obrigado pelo seu apoio!",
      "checkoutCancelled": "Checkout cancelado."
    },
    "license": {
      "viewTxt": "Ver LICENSE.txt",
      "paidTerms": "Termos da licença de arquivo pago"
    },
    "about": {
      "heading": "Sobre este modelo",
      "sourceLink": "Fonte / design original"
    },
    "changelog": {
      "heading": "Changelog v{version}"
    }
  },
  "ru": {
    "hero": { "title": "Библиотека 3D-моделей" },
    "breadcrumb": { "subpage": "3D-модели" },
    "meta": {
      "defaultTitle": "3D-модель",
      "defaultDescription": "Деталь для печати на 3D-принтере для Classic Mini."
    },
    "author": {
      "fallback": "Автор",
      "by": "автор:",
      "anonymous": "Аноним"
    },
    "pricing": {
      "yourModel": "Ваша модель",
      "purchased": "Куплено",
      "buyersGetAllVersions": "покупатели получают все версии"
    },
    "download": {
      "signInRequired": "Для загрузки необходимо войти в аккаунт."
    },
    "notice": {
      "purchaseComplete": "Покупка завершена — ваши файлы разблокированы ниже.",
      "thankYouTip": "Спасибо за чаевые!",
      "paymentPending": "Платёж получен — мы завершаем обработку. Если файлы не разблокированы, обновите страницу через мгновение.",
      "thankYouSupport": "Спасибо за вашу поддержку!",
      "checkoutCancelled": "Оформление заказа отменено."
    },
    "license": {
      "viewTxt": "Просмотреть LICENSE.txt",
      "paidTerms": "Условия лицензии на платный файл"
    },
    "about": {
      "heading": "Об этой модели",
      "sourceLink": "Источник / оригинальный дизайн"
    },
    "changelog": {
      "heading": "Журнал изменений v{version}"
    }
  },
  "ja": {
    "hero": { "title": "3Dモデルライブラリ" },
    "breadcrumb": { "subpage": "3Dモデル" },
    "meta": {
      "defaultTitle": "3Dモデル",
      "defaultDescription": "クラシックミニ用の3Dプリント可能なパーツ。"
    },
    "author": {
      "fallback": "作者",
      "by": "作成者：",
      "anonymous": "匿名"
    },
    "pricing": {
      "yourModel": "あなたのモデル",
      "purchased": "購入済み",
      "buyersGetAllVersions": "購入者はすべてのバージョンを取得できます"
    },
    "download": {
      "signInRequired": "ダウンロードにはサインインが必要です。"
    },
    "notice": {
      "purchaseComplete": "購入完了 — ファイルは以下でダウンロードできます。",
      "thankYouTip": "チップをありがとうございます！",
      "paymentPending": "支払いを受け付けました。処理中です。ファイルがまだロックされている場合は、しばらくしてから更新してください。",
      "thankYouSupport": "ご支援ありがとうございます！",
      "checkoutCancelled": "チェックアウトがキャンセルされました。"
    },
    "license": {
      "viewTxt": "LICENSE.txtを表示",
      "paidTerms": "有料ファイルライセンス条項"
    },
    "about": {
      "heading": "このモデルについて",
      "sourceLink": "ソース / オリジナルデザイン"
    },
    "changelog": {
      "heading": "v{version} 変更履歴"
    }
  },
  "zh": {
    "hero": { "title": "3D模型库" },
    "breadcrumb": { "subpage": "3D模型" },
    "meta": {
      "defaultTitle": "3D模型",
      "defaultDescription": "适用于经典迷你的3D打印零件。"
    },
    "author": {
      "fallback": "作者",
      "by": "作者：",
      "anonymous": "匿名"
    },
    "pricing": {
      "yourModel": "您的模型",
      "purchased": "已购买",
      "buyersGetAllVersions": "购买者可获得所有版本"
    },
    "download": {
      "signInRequired": "下载需要登录。"
    },
    "notice": {
      "purchaseComplete": "购买完成 — 您的文件已在下方解锁。",
      "thankYouTip": "感谢您的打赏！",
      "paymentPending": "已收到付款 — 我们正在处理中。如果文件尚未解锁，请稍后刷新。",
      "thankYouSupport": "感谢您的支持！",
      "checkoutCancelled": "结账已取消。"
    },
    "license": {
      "viewTxt": "查看 LICENSE.txt",
      "paidTerms": "付费文件许可条款"
    },
    "about": {
      "heading": "关于此模型",
      "sourceLink": "来源 / 原始设计"
    },
    "changelog": {
      "heading": "v{version} 更新日志"
    }
  },
  "ko": {
    "hero": { "title": "3D 모델 라이브러리" },
    "breadcrumb": { "subpage": "3D 모델" },
    "meta": {
      "defaultTitle": "3D 모델",
      "defaultDescription": "클래식 미니용 3D 프린팅 부품."
    },
    "author": {
      "fallback": "작성자",
      "by": "작성:",
      "anonymous": "익명"
    },
    "pricing": {
      "yourModel": "내 모델",
      "purchased": "구매 완료",
      "buyersGetAllVersions": "구매자는 모든 버전을 받습니다"
    },
    "download": {
      "signInRequired": "다운로드하려면 로그인이 필요합니다."
    },
    "notice": {
      "purchaseComplete": "구매 완료 — 파일이 아래에서 잠금 해제되었습니다.",
      "thankYouTip": "팁 감사합니다!",
      "paymentPending": "결제가 접수되었습니다 — 처리 중입니다. 파일이 잠금 해제되지 않으면 잠시 후 새로 고침하세요.",
      "thankYouSupport": "지원해 주셔서 감사합니다!",
      "checkoutCancelled": "결제가 취소되었습니다."
    },
    "license": {
      "viewTxt": "LICENSE.txt 보기",
      "paidTerms": "유료 파일 라이선스 조항"
    },
    "about": {
      "heading": "이 모델에 대하여",
      "sourceLink": "출처 / 원본 디자인"
    },
    "changelog": {
      "heading": "v{version} 변경 로그"
    }
  }
}
</i18n>
