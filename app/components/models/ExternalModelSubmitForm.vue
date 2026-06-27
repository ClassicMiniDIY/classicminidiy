<script setup lang="ts">
  import { EXTERNAL_SOURCES, SUPPORTED_SOURCE_SITES } from '~~/data/models/external-sources';

  const { t } = useI18n();

  const f = useExternalModelSubmit();

  // Categories from the API — same pattern as upload.vue.
  const { data: categoriesData } = await useFetch('/api/models/categories');
  const categories = computed(() => categoriesData.value?.categories ?? []);

  // Comma-separated tag input.
  const tagInput = ref('');
  function commitTags() {
    const parts = tagInput.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const p of parts) {
      if (f.tags.value.length < 10 && !f.tags.value.includes(p)) {
        f.tags.value.push(p);
      }
    }
    tagInput.value = '';
  }

  // Human-readable supported sites list for the hint line.
  const supportedSiteLabels = SUPPORTED_SOURCE_SITES.map((s) => EXTERNAL_SOURCES[s].label).join(', ');

  // Whether we are showing step 2 (preview loaded, not yet submitted, not already listed).
  const showStep2 = computed(
    () => !!f.preview.value && !f.submittedSlug.value && !f.alreadyListed.value
  );

  // Primary image from preview for the thumbnail.
  const primaryImage = computed(
    () => f.preview.value?.images?.find((i) => i.isPrimary)?.url ?? f.preview.value?.images?.[0]?.url ?? null
  );
</script>

<template>
  <!-- ── SUCCESS STATE ───────────────────────────────────────────────── -->
  <div v-if="f.submittedSlug.value" class="card bg-base-100 border border-base-300 shadow-sm">
    <div class="card-body items-center text-center gap-3 py-10">
      <i class="fas fa-circle-check text-5xl text-success"></i>
      <h2 class="card-title">{{ t('success.title') }}</h2>
      <p class="opacity-70 max-w-sm">{{ t('success.body') }}</p>
      <div class="flex gap-2 flex-wrap justify-center mt-1">
        <NuxtLink to="/dashboard/external" class="btn btn-primary">
          <i class="fas fa-list mr-1"></i> {{ t('success.mySubmissions') }}
        </NuxtLink>
        <button type="button" class="btn btn-ghost" @click="f.reset()">
          <i class="fas fa-plus mr-1"></i> {{ t('success.submitAnother') }}
        </button>
      </div>
    </div>
  </div>

  <template v-else>
    <!-- ── STEP 1: URL INPUT ───────────────────────────────────────────── -->
    <div class="card bg-base-100 border border-base-300 shadow-sm">
      <div class="card-body gap-4">
        <h2 class="card-title">
          <i class="fas fa-link mr-1 text-primary"></i>
          {{ t('step1.heading') }}
        </h2>

        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('step1.urlLabel') }}</legend>
          <div class="flex gap-2">
            <input
              v-model="f.url.value"
              type="url"
              class="input flex-1"
              :placeholder="t('step1.urlPlaceholder')"
              @keydown.enter.prevent="f.fetchPreview()"
            />
            <button
              type="button"
              class="btn btn-primary"
              :disabled="!f.isValidUrl.value || f.fetching.value"
              @click="f.fetchPreview()"
            >
              <span v-if="f.fetching.value" class="loading loading-spinner loading-sm"></span>
              <i v-else class="fas fa-magnifying-glass mr-1"></i>
              {{ t('step1.fetchBtn') }}
            </button>
          </div>

          <!-- Detected source badge -->
          <div v-if="f.detectedSite.value" class="mt-2 flex items-center gap-2 text-sm">
            <span class="opacity-60">{{ t('step1.detectedLabel') }}</span>
            <ModelsSourceBadge :site="f.detectedSite.value" size="md" />
          </div>

          <!-- Supported sites hint -->
          <p class="label opacity-60 text-xs mt-1">
            {{ t('step1.sitesHint', { sites: supportedSiteLabels }) }}
          </p>
        </fieldset>

        <!-- Fetch error -->
        <div v-if="f.fetchError.value" class="alert alert-error">
          <i class="fas fa-circle-exclamation"></i>
          <span>{{ f.fetchError.value }}</span>
        </div>

        <!-- Already listed (from preview dedupe check) -->
        <div v-if="f.alreadyListed.value" class="alert alert-info">
          <i class="fas fa-circle-info"></i>
          <div>
            <p class="font-semibold">{{ t('step1.alreadyListedTitle') }}</p>
            <p class="text-sm opacity-80">{{ t('step1.alreadyListedBody') }}</p>
            <NuxtLink
              :to="`/models/external/${f.alreadyListed.value.slug}`"
              class="link link-primary text-sm"
            >
              {{ t('step1.alreadyListedLink') }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <!-- ── STEP 2: PREVIEW + METADATA ─────────────────────────────────── -->
    <div v-if="showStep2" class="card bg-base-100 border border-base-300 shadow-sm mt-4">
      <div class="card-body gap-5">
        <h2 class="card-title">
          <i class="fas fa-file-circle-check mr-1 text-primary"></i>
          {{ t('step2.heading') }}
        </h2>

        <!-- Preview summary row -->
        <div class="flex gap-4 items-start">
          <div
            v-if="primaryImage"
            class="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-base-300 bg-base-200"
          >
            <img :src="primaryImage" :alt="f.preview.value!.title" class="w-full h-full object-cover" />
          </div>
          <div class="flex-1 min-w-0 space-y-1">
            <div class="flex flex-wrap gap-2 items-center">
              <ModelsSourceBadge :site="f.preview.value!.sourceSite" size="md" />
              <span v-if="f.preview.value!.images.length > 1" class="badge badge-ghost badge-sm">
                {{ t('step2.imageCount', { count: f.preview.value!.images.length }) }}
              </span>
            </div>
            <p class="text-xs opacity-60 break-all">{{ f.preview.value!.sourceUrl }}</p>
            <!-- Read-only scraped metadata -->
            <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs mt-2">
              <template v-if="f.preview.value!.authorName">
                <dt class="opacity-50">{{ t('step2.author') }}</dt>
                <dd>
                  <a
                    v-if="f.preview.value!.authorUrl"
                    :href="f.preview.value!.authorUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="link link-primary"
                  >{{ f.preview.value!.authorName }}</a>
                  <span v-else>{{ f.preview.value!.authorName }}</span>
                </dd>
              </template>
              <template v-if="f.preview.value!.license">
                <dt class="opacity-50">{{ t('step2.license') }}</dt>
                <dd>{{ f.preview.value!.license }}</dd>
              </template>
            </dl>
          </div>
        </div>

        <div class="divider my-0"></div>

        <!-- Editable title -->
        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('step2.titleLabel') }}</legend>
          <input
            v-model="f.title.value"
            type="text"
            maxlength="120"
            class="input w-full"
            :placeholder="t('step2.titlePlaceholder')"
          />
        </fieldset>

        <!-- Editable description -->
        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('step2.descriptionLabel') }}</legend>
          <textarea
            v-model="f.description.value"
            rows="4"
            maxlength="20000"
            class="textarea w-full"
            :placeholder="t('step2.descriptionPlaceholder')"
          ></textarea>
        </fieldset>

        <!-- Category (required) -->
        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('step2.categoryLabel') }}</legend>
          <select v-model="f.categorySlug.value" class="select w-full">
            <option value="" disabled>{{ t('step2.categoryPlaceholder') }}</option>
            <option v-for="c in categories" :key="c.slug" :value="c.slug">{{ c.name }}</option>
          </select>
        </fieldset>

        <!-- Tags -->
        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('step2.tagsLabel') }}</legend>
          <input
            v-model="tagInput"
            type="text"
            class="input w-full"
            :placeholder="t('step2.tagsPlaceholder')"
            @keydown.enter.prevent="commitTags"
            @blur="commitTags"
          />
          <div v-if="f.tags.value.length" class="flex flex-wrap gap-1.5 mt-2">
            <span v-for="(tag, i) in f.tags.value" :key="tag" class="badge badge-neutral gap-1">
              {{ tag }}
              <button type="button" @click="f.tags.value.splice(i, 1)">
                <i class="fas fa-xmark text-[0.6rem]"></i>
              </button>
            </span>
          </div>
        </fieldset>

        <!-- Review notice -->
        <div class="alert alert-soft alert-info items-start">
          <i class="fas fa-circle-info mt-0.5"></i>
          <span class="text-sm">{{ t('step2.reviewNotice') }}</span>
        </div>

        <!-- Submit error -->
        <div v-if="f.submitError.value" class="alert alert-error">
          <i class="fas fa-circle-exclamation"></i>
          <div>
            <span>{{ f.submitError.value }}</span>
            <span v-if="f.alreadyListed.value">
              &nbsp;
              <NuxtLink
                :to="`/models/external/${f.alreadyListed.value.slug}`"
                class="link link-primary"
              >{{ t('step2.viewExisting') }}</NuxtLink>
            </span>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-between items-center pt-2 border-t border-base-300">
          <button type="button" class="btn btn-ghost" @click="f.reset()">
            <i class="fas fa-arrow-left mr-1"></i> {{ t('step2.back') }}
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!f.categorySlug.value || f.submitting.value"
            @click="f.submit()"
          >
            <span v-if="f.submitting.value" class="loading loading-spinner loading-sm"></span>
            <i v-else class="fas fa-paper-plane mr-1"></i>
            {{ t('step2.submitBtn') }}
          </button>
        </div>
      </div>
    </div>
  </template>
</template>

<i18n lang="json">
{
  "en": {
    "success": {
      "title": "Submitted for review",
      "body": "Thanks! Our moderators will review it shortly. You can track it under My Submissions.",
      "mySubmissions": "My Submissions",
      "submitAnother": "Submit another"
    },
    "step1": {
      "heading": "Paste the model URL",
      "urlLabel": "URL",
      "urlPlaceholder": "https://www.printables.com/model/...",
      "fetchBtn": "Fetch details",
      "detectedLabel": "Detected site:",
      "sitesHint": "Works best with {sites}. Any other URL is also accepted as a generic listing.",
      "alreadyListedTitle": "This model is already in the library.",
      "alreadyListedBody": "Someone has already added this model, so there's nothing more to submit.",
      "alreadyListedLink": "View the existing listing"
    },
    "step2": {
      "heading": "Review and confirm",
      "imageCount": "{count} images",
      "author": "Author",
      "license": "License",
      "titleLabel": "Title",
      "titlePlaceholder": "Give the model a clear title",
      "descriptionLabel": "Description",
      "descriptionPlaceholder": "What it is, what it fits, how it prints…",
      "categoryLabel": "Category",
      "categoryPlaceholder": "Choose a category",
      "tagsLabel": "Tags",
      "tagsPlaceholder": "Comma-separated, press Enter",
      "reviewNotice": "Submissions are reviewed by a moderator before appearing publicly. You will be notified once it is approved or if we need more information.",
      "viewExisting": "View the existing listing",
      "back": "Back",
      "submitBtn": "Submit for review"
    }
  },
  "es": {
    "success": {
      "title": "Enviado para revisión",
      "body": "¡Gracias! Nuestros moderadores lo revisarán pronto. Puedes seguirlo en Mis envíos.",
      "mySubmissions": "Mis envíos",
      "submitAnother": "Enviar otro"
    },
    "step1": {
      "heading": "Pega la URL del modelo",
      "urlLabel": "URL",
      "urlPlaceholder": "https://www.printables.com/model/...",
      "fetchBtn": "Obtener detalles",
      "detectedLabel": "Sitio detectado:",
      "sitesHint": "Funciona mejor con {sites}. Cualquier otra URL también se acepta como listado genérico.",
      "alreadyListedTitle": "Este modelo ya está en la biblioteca.",
      "alreadyListedBody": "Alguien ya añadió este modelo, así que no hay nada más que enviar.",
      "alreadyListedLink": "Ver el listado existente"
    },
    "step2": {
      "heading": "Revisar y confirmar",
      "imageCount": "{count} imágenes",
      "author": "Autor",
      "license": "Licencia",
      "titleLabel": "Título",
      "titlePlaceholder": "Dale un título claro al modelo",
      "descriptionLabel": "Descripción",
      "descriptionPlaceholder": "Qué es, para qué sirve, cómo se imprime…",
      "categoryLabel": "Categoría",
      "categoryPlaceholder": "Elige una categoría",
      "tagsLabel": "Etiquetas",
      "tagsPlaceholder": "Separadas por comas, presiona Intro",
      "reviewNotice": "Los envíos son revisados por un moderador antes de aparecer públicamente. Serás notificado una vez aprobado o si necesitamos más información.",
      "viewExisting": "Ver el listado existente",
      "back": "Atrás",
      "submitBtn": "Enviar para revisión"
    }
  },
  "fr": {
    "success": {
      "title": "Soumis pour révision",
      "body": "Merci ! Nos modérateurs l'examineront sous peu. Vous pouvez le suivre dans Mes soumissions.",
      "mySubmissions": "Mes soumissions",
      "submitAnother": "Soumettre un autre"
    },
    "step1": {
      "heading": "Collez l'URL du modèle",
      "urlLabel": "URL",
      "urlPlaceholder": "https://www.printables.com/model/...",
      "fetchBtn": "Récupérer les détails",
      "detectedLabel": "Site détecté :",
      "sitesHint": "Fonctionne mieux avec {sites}. Toute autre URL est aussi acceptée comme listage générique.",
      "alreadyListedTitle": "Ce modèle est déjà dans la bibliothèque.",
      "alreadyListedBody": "Quelqu'un a déjà ajouté ce modèle, il n'y a donc rien de plus à soumettre.",
      "alreadyListedLink": "Voir le listage existant"
    },
    "step2": {
      "heading": "Réviser et confirmer",
      "imageCount": "{count} images",
      "author": "Auteur",
      "license": "Licence",
      "titleLabel": "Titre",
      "titlePlaceholder": "Donnez un titre clair au modèle",
      "descriptionLabel": "Description",
      "descriptionPlaceholder": "Ce que c'est, à quoi ça sert, comment ça s'imprime…",
      "categoryLabel": "Catégorie",
      "categoryPlaceholder": "Choisir une catégorie",
      "tagsLabel": "Étiquettes",
      "tagsPlaceholder": "Séparées par des virgules, appuyez sur Entrée",
      "reviewNotice": "Les soumissions sont examinées par un modérateur avant d'apparaître publiquement. Vous serez notifié une fois approuvé ou si nous avons besoin de plus d'informations.",
      "viewExisting": "Voir le listage existant",
      "back": "Retour",
      "submitBtn": "Soumettre pour révision"
    }
  },
  "de": {
    "success": {
      "title": "Zur Überprüfung eingereicht",
      "body": "Danke! Unsere Moderatoren werden es in Kürze prüfen. Du kannst es unter Meine Einsendungen verfolgen.",
      "mySubmissions": "Meine Einsendungen",
      "submitAnother": "Weitere einreichen"
    },
    "step1": {
      "heading": "Modell-URL einfügen",
      "urlLabel": "URL",
      "urlPlaceholder": "https://www.printables.com/model/...",
      "fetchBtn": "Details abrufen",
      "detectedLabel": "Erkannte Seite:",
      "sitesHint": "Funktioniert am besten mit {sites}. Jede andere URL wird auch als generisches Listing akzeptiert.",
      "alreadyListedTitle": "Dieses Modell ist bereits in der Bibliothek.",
      "alreadyListedBody": "Jemand hat dieses Modell bereits hinzugefügt, es gibt also nichts mehr einzureichen.",
      "alreadyListedLink": "Vorhandenes Listing ansehen"
    },
    "step2": {
      "heading": "Überprüfen und bestätigen",
      "imageCount": "{count} Bilder",
      "author": "Autor",
      "license": "Lizenz",
      "titleLabel": "Titel",
      "titlePlaceholder": "Gib dem Modell einen klaren Titel",
      "descriptionLabel": "Beschreibung",
      "descriptionPlaceholder": "Was es ist, wofür es passt, wie es druckt…",
      "categoryLabel": "Kategorie",
      "categoryPlaceholder": "Kategorie wählen",
      "tagsLabel": "Tags",
      "tagsPlaceholder": "Kommagetrennt, Enter drücken",
      "reviewNotice": "Einsendungen werden von einem Moderator geprüft, bevor sie öffentlich erscheinen. Du wirst benachrichtigt, sobald es genehmigt wurde oder wenn wir weitere Informationen benötigen.",
      "viewExisting": "Vorhandenes Listing ansehen",
      "back": "Zurück",
      "submitBtn": "Zur Überprüfung einreichen"
    }
  },
  "it": {
    "success": {
      "title": "Inviato per revisione",
      "body": "Grazie! I nostri moderatori lo esamineranno a breve. Puoi seguirlo in Le mie proposte.",
      "mySubmissions": "Le mie proposte",
      "submitAnother": "Invia un altro"
    },
    "step1": {
      "heading": "Incolla l'URL del modello",
      "urlLabel": "URL",
      "urlPlaceholder": "https://www.printables.com/model/...",
      "fetchBtn": "Ottieni dettagli",
      "detectedLabel": "Sito rilevato:",
      "sitesHint": "Funziona meglio con {sites}. Qualsiasi altro URL è accettato come listato generico.",
      "alreadyListedTitle": "Questo modello è già nella libreria.",
      "alreadyListedBody": "Qualcuno ha già aggiunto questo modello, quindi non c'è altro da inviare.",
      "alreadyListedLink": "Visualizza il listato esistente"
    },
    "step2": {
      "heading": "Rivedi e conferma",
      "imageCount": "{count} immagini",
      "author": "Autore",
      "license": "Licenza",
      "titleLabel": "Titolo",
      "titlePlaceholder": "Dai un titolo chiaro al modello",
      "descriptionLabel": "Descrizione",
      "descriptionPlaceholder": "Cos'è, a cosa serve, come si stampa…",
      "categoryLabel": "Categoria",
      "categoryPlaceholder": "Scegli una categoria",
      "tagsLabel": "Tag",
      "tagsPlaceholder": "Separati da virgole, premi Invio",
      "reviewNotice": "Le proposte vengono revisionate da un moderatore prima di apparire pubblicamente. Sarai notificato una volta approvata o se abbiamo bisogno di ulteriori informazioni.",
      "viewExisting": "Visualizza il listato esistente",
      "back": "Indietro",
      "submitBtn": "Invia per revisione"
    }
  },
  "pt": {
    "success": {
      "title": "Enviado para revisão",
      "body": "Obrigado! Nossos moderadores irão revisá-lo em breve. Você pode acompanhá-lo em Minhas submissões.",
      "mySubmissions": "Minhas submissões",
      "submitAnother": "Enviar outro"
    },
    "step1": {
      "heading": "Cole o URL do modelo",
      "urlLabel": "URL",
      "urlPlaceholder": "https://www.printables.com/model/...",
      "fetchBtn": "Buscar detalhes",
      "detectedLabel": "Site detectado:",
      "sitesHint": "Funciona melhor com {sites}. Qualquer outro URL também é aceito como listagem genérica.",
      "alreadyListedTitle": "Este modelo já está na biblioteca.",
      "alreadyListedBody": "Alguém já adicionou este modelo, então não há mais nada a enviar.",
      "alreadyListedLink": "Ver a listagem existente"
    },
    "step2": {
      "heading": "Revisar e confirmar",
      "imageCount": "{count} imagens",
      "author": "Autor",
      "license": "Licença",
      "titleLabel": "Título",
      "titlePlaceholder": "Dê um título claro ao modelo",
      "descriptionLabel": "Descrição",
      "descriptionPlaceholder": "O que é, para o que serve, como imprime…",
      "categoryLabel": "Categoria",
      "categoryPlaceholder": "Escolha uma categoria",
      "tagsLabel": "Tags",
      "tagsPlaceholder": "Separadas por vírgula, pressione Enter",
      "reviewNotice": "As submissões são revisadas por um moderador antes de aparecerem publicamente. Você será notificado quando aprovado ou se precisarmos de mais informações.",
      "viewExisting": "Ver a listagem existente",
      "back": "Voltar",
      "submitBtn": "Enviar para revisão"
    }
  },
  "ru": {
    "success": {
      "title": "Отправлено на проверку",
      "body": "Спасибо! Наши модераторы скоро рассмотрят. Вы можете отследить в разделе «Мои заявки».",
      "mySubmissions": "Мои заявки",
      "submitAnother": "Отправить ещё"
    },
    "step1": {
      "heading": "Вставьте ссылку на модель",
      "urlLabel": "URL",
      "urlPlaceholder": "https://www.printables.com/model/...",
      "fetchBtn": "Получить данные",
      "detectedLabel": "Обнаруженный сайт:",
      "sitesHint": "Лучше всего работает с {sites}. Любой другой URL принимается как общий листинг.",
      "alreadyListedTitle": "Эта модель уже есть в библиотеке.",
      "alreadyListedBody": "Кто-то уже добавил эту модель, так что отправлять больше нечего.",
      "alreadyListedLink": "Посмотреть существующий листинг"
    },
    "step2": {
      "heading": "Проверьте и подтвердите",
      "imageCount": "{count} изображений",
      "author": "Автор",
      "license": "Лицензия",
      "titleLabel": "Заголовок",
      "titlePlaceholder": "Дайте модели понятное название",
      "descriptionLabel": "Описание",
      "descriptionPlaceholder": "Что это, для чего подходит, как печатается…",
      "categoryLabel": "Категория",
      "categoryPlaceholder": "Выберите категорию",
      "tagsLabel": "Теги",
      "tagsPlaceholder": "Через запятую, нажмите Enter",
      "reviewNotice": "Заявки проверяются модератором перед публичным появлением. Вы получите уведомление после одобрения или если нам понадобится дополнительная информация.",
      "viewExisting": "Посмотреть существующий листинг",
      "back": "Назад",
      "submitBtn": "Отправить на проверку"
    }
  },
  "ja": {
    "success": {
      "title": "レビュー用に提出されました",
      "body": "ありがとうございます！モデレーターがまもなく確認します。「マイ提出物」で追跡できます。",
      "mySubmissions": "マイ提出物",
      "submitAnother": "別のものを提出する"
    },
    "step1": {
      "heading": "モデルのURLを貼り付けてください",
      "urlLabel": "URL",
      "urlPlaceholder": "https://www.printables.com/model/...",
      "fetchBtn": "詳細を取得",
      "detectedLabel": "検出されたサイト：",
      "sitesHint": "{sites}で最もよく機能します。その他のURLも汎用リストとして受け付けられます。",
      "alreadyListedTitle": "このモデルはすでにライブラリにあります。",
      "alreadyListedBody": "このモデルはすでに誰かが追加しているため、提出するものはありません。",
      "alreadyListedLink": "既存のリストを見る"
    },
    "step2": {
      "heading": "確認して提出する",
      "imageCount": "{count}枚の画像",
      "author": "作者",
      "license": "ライセンス",
      "titleLabel": "タイトル",
      "titlePlaceholder": "モデルにわかりやすいタイトルをつけてください",
      "descriptionLabel": "説明",
      "descriptionPlaceholder": "何であるか、何に合うか、どう印刷するか…",
      "categoryLabel": "カテゴリー",
      "categoryPlaceholder": "カテゴリーを選択",
      "tagsLabel": "タグ",
      "tagsPlaceholder": "カンマ区切り、Enterで確定",
      "reviewNotice": "提出物はモデレーターによって審査された後、公開されます。承認後または追加情報が必要な場合に通知されます。",
      "viewExisting": "既存のリストを見る",
      "back": "戻る",
      "submitBtn": "レビュー用に提出"
    }
  },
  "zh": {
    "success": {
      "title": "已提交审核",
      "body": "谢谢！我们的审核员将很快进行审核。您可以在「我的提交」中跟踪进度。",
      "mySubmissions": "我的提交",
      "submitAnother": "提交另一个"
    },
    "step1": {
      "heading": "粘贴模型链接",
      "urlLabel": "链接",
      "urlPlaceholder": "https://www.printables.com/model/...",
      "fetchBtn": "获取详情",
      "detectedLabel": "检测到的网站：",
      "sitesHint": "最适合 {sites}。其他链接也可作为通用列表接受。",
      "alreadyListedTitle": "此模型已在库中。",
      "alreadyListedBody": "已有人添加了此模型，因此无需再提交。",
      "alreadyListedLink": "查看现有列表"
    },
    "step2": {
      "heading": "确认并提交",
      "imageCount": "{count} 张图片",
      "author": "作者",
      "license": "许可证",
      "titleLabel": "标题",
      "titlePlaceholder": "给模型起一个清晰的标题",
      "descriptionLabel": "描述",
      "descriptionPlaceholder": "它是什么，适合什么，如何打印…",
      "categoryLabel": "分类",
      "categoryPlaceholder": "选择分类",
      "tagsLabel": "标签",
      "tagsPlaceholder": "逗号分隔，按Enter确认",
      "reviewNotice": "提交内容将由审核员在公开发布前进行审核。批准后或需要更多信息时，您将收到通知。",
      "viewExisting": "查看现有列表",
      "back": "返回",
      "submitBtn": "提交审核"
    }
  },
  "ko": {
    "success": {
      "title": "검토를 위해 제출되었습니다",
      "body": "감사합니다! 모더레이터가 곧 검토할 예정입니다. 내 제출물에서 확인할 수 있습니다.",
      "mySubmissions": "내 제출물",
      "submitAnother": "다른 항목 제출"
    },
    "step1": {
      "heading": "모델 URL을 붙여넣으세요",
      "urlLabel": "URL",
      "urlPlaceholder": "https://www.printables.com/model/...",
      "fetchBtn": "세부 정보 가져오기",
      "detectedLabel": "감지된 사이트:",
      "sitesHint": "{sites}에서 가장 잘 작동합니다. 다른 URL도 일반 목록으로 허용됩니다.",
      "alreadyListedTitle": "이 모델은 이미 라이브러리에 있습니다.",
      "alreadyListedBody": "이미 다른 사용자가 이 모델을 추가했으므로 제출할 항목이 없습니다.",
      "alreadyListedLink": "기존 목록 보기"
    },
    "step2": {
      "heading": "검토 및 확인",
      "imageCount": "이미지 {count}개",
      "author": "작성자",
      "license": "라이선스",
      "titleLabel": "제목",
      "titlePlaceholder": "모델에 명확한 제목을 붙여주세요",
      "descriptionLabel": "설명",
      "descriptionPlaceholder": "무엇인지, 무엇에 맞는지, 어떻게 인쇄하는지…",
      "categoryLabel": "카테고리",
      "categoryPlaceholder": "카테고리 선택",
      "tagsLabel": "태그",
      "tagsPlaceholder": "쉼표로 구분, Enter 키로 확인",
      "reviewNotice": "제출물은 공개되기 전에 모더레이터가 검토합니다. 승인 후 또는 추가 정보가 필요한 경우 알림을 받습니다.",
      "viewExisting": "기존 목록 보기",
      "back": "뒤로",
      "submitBtn": "검토를 위해 제출"
    }
  }
}
</i18n>
