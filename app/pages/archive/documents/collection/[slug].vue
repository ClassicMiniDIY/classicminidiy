<script lang="ts" setup>
  import { HERO_TYPES } from '../../../../../data/models/generic';

  const { t } = useI18n();
  const route = useRoute();
  const slug = route.params.slug as string;

  const { getCollectionBySlug } = useArchiveDocuments();

  const { data: result, status, error } = await useAsyncData(`collection-${slug}`, () => getCollectionBySlug(slug));

  const collection = computed(() => result.value?.collection || null);
  const documents = computed(() => result.value?.documents || []);

  // Type config for badge display
  const typeConfig: Record<string, { icon: string; label: string; color: string }> = {
    manual: { icon: 'fas fa-book', label: t('type.manual'), color: 'primary' },
    advert: { icon: 'fas fa-rectangle-ad', label: t('type.advert'), color: 'secondary' },
    catalogue: { icon: 'fas fa-book-open', label: t('type.catalogue'), color: 'info' },
    tuning: { icon: 'fas fa-gauge-high', label: t('type.tuning'), color: 'warning' },
    electrical: { icon: 'fas fa-bolt', label: t('type.electrical'), color: 'error' },
  };

  const totalPages = computed(() => documents.value.reduce((sum, doc) => sum + (doc.pageCount || 0), 0));

  useHead({
    title: computed(() => (collection.value ? `${collection.value.title} | Classic Mini DIY` : t('title'))),
    meta: [
      {
        key: 'description',
        name: 'description',
        content: computed(() => collection.value?.description || t('description')),
      },
    ],
    link: [
      {
        rel: 'canonical',
        href: `https://classicminidiy.com/archive/documents/collection/${slug}`,
      },
    ],
  });

  useSeoMeta({
    ogTitle: computed(() => collection.value?.title || t('title')),
    ogDescription: computed(() => collection.value?.description || t('description')),
    ogUrl: `https://classicminidiy.com/archive/documents/collection/${slug}`,
    ogType: 'website',
  });
</script>

<template>
  <hero :navigation="true" :title="collection?.title || t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />
  <div class="container mx-auto px-4">
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12">
        <!-- Breadcrumbs -->
        <nav class="my-6 text-sm">
          <NuxtLink to="/archive" class="hover:underline text-muted">{{ t('breadcrumb_archive') }}</NuxtLink>
          <span class="mx-2 text-muted">/</span>
          <NuxtLink to="/archive/documents" class="hover:underline text-muted">{{
            t('breadcrumb_documents')
          }}</NuxtLink>
          <span class="mx-2 text-muted">/</span>
          <span>{{ collection?.title || '...' }}</span>
        </nav>

        <!-- Loading state -->
        <div v-if="status === 'pending'" class="space-y-4">
          <USkeleton class="h-8 w-1/2" />
          <USkeleton class="h-4 w-3/4" />
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            <UCard v-for="k in 6" :key="k" class="animate-pulse">
              <template #header><div class="h-[150px] bg-muted rounded-t-lg"></div></template>
              <div class="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div class="h-3 bg-muted rounded w-1/2"></div>
            </UCard>
          </div>
        </div>

        <!-- Error state -->
        <div v-else-if="error || !collection" class="text-center py-12">
          <UCard>
            <div class="py-8">
              <i class="fad fa-exclamation-triangle text-4xl text-warning mb-4"></i>
              <h2 class="text-xl font-bold mb-2">{{ t('not_found_title') }}</h2>
              <p class="text-muted mb-4">{{ t('not_found_text') }}</p>
              <UButton to="/archive/documents" color="primary">{{ t('back_to_documents') }}</UButton>
            </div>
          </UCard>
        </div>

        <!-- Collection content -->
        <div v-else>
          <!-- Collection header -->
          <div class="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
            <div class="col-span-12 md:col-span-4" v-if="collection.image">
              <img :src="collection.image" :alt="collection.title" class="w-full rounded-lg shadow-md" />
            </div>
            <div :class="collection.image ? 'col-span-12 md:col-span-8' : 'col-span-12'">
              <div class="flex items-center gap-3 mb-2">
                <UBadge
                  v-if="collection.type && typeConfig[collection.type]"
                  size="lg"
                  :color="typeConfig[collection.type].color as any"
                >
                  <i :class="[typeConfig[collection.type].icon, 'mr-1']"></i>
                  {{ typeConfig[collection.type].label }}
                </UBadge>
                <h1 class="text-2xl font-bold">{{ collection.title }}</h1>
              </div>
              <p v-if="collection.description" class="text-muted mb-4">{{ collection.description }}</p>
              <div class="flex items-center gap-2">
                <div class="badge badge-primary badge-lg">
                  {{ collection.itemCount }} {{ t('items_in_collection') }}
                </div>
                <div v-if="totalPages > 0" class="badge badge-secondary badge-lg">
                  {{ totalPages }} {{ t('total_pages') }}
                </div>
              </div>
            </div>
          </div>

          <!-- Collection items -->
          <h2 class="text-lg font-semibold mb-4">{{ t('items_heading') }}</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <archive-document-card v-for="doc in documents" :key="doc.title" :item="doc" />
          </div>

          <!-- Empty collection -->
          <div v-if="documents.length === 0" class="text-center py-8">
            <UCard>
              <p class="text-muted">{{ t('empty_collection') }}</p>
            </UCard>
          </div>
        </div>

        <!-- Support section -->
        <div class="mt-8 mb-10">
          <USeparator :label="t('support_divider')" class="mb-6" />
          <patreon-card size="large" />
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Collection | Classic Mini DIY",
    "description": "Browse a collection of related Classic Mini documents.",
    "hero_title": "Document Collection",
    "breadcrumb_archive": "Archive",
    "breadcrumb_documents": "Documents",
    "items_in_collection": "documents in this collection",
    "total_pages": "total pages",
    "items_heading": "Documents in this Collection",
    "empty_collection": "No documents in this collection yet.",
    "not_found_title": "Collection Not Found",
    "not_found_text": "The collection you are looking for does not exist or has been removed.",
    "back_to_documents": "Back to Documents",
    "support_divider": "Support",
    "type": {
      "manual": "Manual",
      "advert": "Advert",
      "catalogue": "Catalogue",
      "tuning": "Tuning",
      "electrical": "Electrical"
    }
  },
  "de": {
    "title": "Sammlung | Classic Mini DIY",
    "description": "Durchsuchen Sie eine Sammlung verwandter Classic Mini Dokumente.",
    "hero_title": "Dokumentensammlung",
    "breadcrumb_archive": "Archiv",
    "breadcrumb_documents": "Dokumente",
    "items_in_collection": "Dokumente in dieser Sammlung",
    "total_pages": "Seiten gesamt",
    "items_heading": "Dokumente in dieser Sammlung",
    "empty_collection": "Noch keine Dokumente in dieser Sammlung.",
    "not_found_title": "Sammlung nicht gefunden",
    "not_found_text": "Die gesuchte Sammlung existiert nicht oder wurde entfernt.",
    "back_to_documents": "Zurück zu Dokumenten",
    "support_divider": "Support",
    "type": {
      "manual": "Handbuch",
      "advert": "Anzeige",
      "catalogue": "Katalog",
      "tuning": "Tuning",
      "electrical": "Elektrik"
    }
  },
  "es": {
    "title": "Colección | Classic Mini DIY",
    "description": "Explore una colección de documentos relacionados del Classic Mini.",
    "hero_title": "Colección de Documentos",
    "breadcrumb_archive": "Archivo",
    "breadcrumb_documents": "Documentos",
    "items_in_collection": "documentos en esta colección",
    "total_pages": "páginas en total",
    "items_heading": "Documentos en esta Colección",
    "empty_collection": "Aún no hay documentos en esta colección.",
    "not_found_title": "Colección No Encontrada",
    "not_found_text": "La colección que busca no existe o ha sido eliminada.",
    "back_to_documents": "Volver a Documentos",
    "support_divider": "Soporte",
    "type": {
      "manual": "Manual",
      "advert": "Anuncio",
      "catalogue": "Catálogo",
      "tuning": "Preparación",
      "electrical": "Eléctrico"
    }
  },
  "fr": {
    "title": "Collection | Classic Mini DIY",
    "description": "Parcourez une collection de documents Classic Mini associés.",
    "hero_title": "Collection de Documents",
    "breadcrumb_archive": "Archive",
    "breadcrumb_documents": "Documents",
    "items_in_collection": "documents dans cette collection",
    "total_pages": "pages au total",
    "items_heading": "Documents dans cette Collection",
    "empty_collection": "Pas encore de documents dans cette collection.",
    "not_found_title": "Collection Non Trouvée",
    "not_found_text": "La collection que vous recherchez n'existe pas ou a été supprimée.",
    "back_to_documents": "Retour aux Documents",
    "support_divider": "Support",
    "type": {
      "manual": "Manuel",
      "advert": "Publicité",
      "catalogue": "Catalogue",
      "tuning": "Préparation",
      "electrical": "Électrique"
    }
  },
  "it": {
    "title": "Collezione | Classic Mini DIY",
    "description": "Sfoglia una collezione di documenti Classic Mini correlati.",
    "hero_title": "Collezione di Documenti",
    "breadcrumb_archive": "Archivio",
    "breadcrumb_documents": "Documenti",
    "items_in_collection": "documenti in questa collezione",
    "total_pages": "pagine totali",
    "items_heading": "Documenti in questa Collezione",
    "empty_collection": "Ancora nessun documento in questa collezione.",
    "not_found_title": "Collezione Non Trovata",
    "not_found_text": "La collezione che stai cercando non esiste o è stata rimossa.",
    "back_to_documents": "Torna ai Documenti",
    "support_divider": "Supporto",
    "type": {
      "manual": "Manuale",
      "advert": "Annuncio",
      "catalogue": "Catalogo",
      "tuning": "Preparazione",
      "electrical": "Elettrico"
    }
  },
  "pt": {
    "title": "Coleção | Classic Mini DIY",
    "description": "Navegue por uma coleção de documentos Classic Mini relacionados.",
    "hero_title": "Coleção de Documentos",
    "breadcrumb_archive": "Arquivo",
    "breadcrumb_documents": "Documentos",
    "items_in_collection": "documentos nesta coleção",
    "total_pages": "páginas no total",
    "items_heading": "Documentos nesta Coleção",
    "empty_collection": "Ainda não há documentos nesta coleção.",
    "not_found_title": "Coleção Não Encontrada",
    "not_found_text": "A coleção que você procura não existe ou foi removida.",
    "back_to_documents": "Voltar aos Documentos",
    "support_divider": "Suporte",
    "type": {
      "manual": "Manual",
      "advert": "Anúncio",
      "catalogue": "Catálogo",
      "tuning": "Preparação",
      "electrical": "Elétrico"
    }
  },
  "ru": {
    "title": "Коллекция | Classic Mini DIY",
    "description": "Просматривайте коллекцию связанных документов Classic Mini.",
    "hero_title": "Коллекция Документов",
    "breadcrumb_archive": "Архив",
    "breadcrumb_documents": "Документы",
    "items_in_collection": "документов в этой коллекции",
    "total_pages": "страниц всего",
    "items_heading": "Документы в этой Коллекции",
    "empty_collection": "В этой коллекции пока нет документов.",
    "not_found_title": "Коллекция Не Найдена",
    "not_found_text": "Коллекция, которую вы ищете, не существует или была удалена.",
    "back_to_documents": "Вернуться к Документам",
    "support_divider": "Поддержка",
    "type": {
      "manual": "Руководство",
      "advert": "Реклама",
      "catalogue": "Каталог",
      "tuning": "Тюнинг",
      "electrical": "Электрика"
    }
  },
  "ja": {
    "title": "コレクション | Classic Mini DIY",
    "description": "関連するClassic Miniドキュメントのコレクションを閲覧。",
    "hero_title": "ドキュメントコレクション",
    "breadcrumb_archive": "アーカイブ",
    "breadcrumb_documents": "ドキュメント",
    "items_in_collection": "このコレクションのドキュメント",
    "total_pages": "総ページ数",
    "items_heading": "このコレクションのドキュメント",
    "empty_collection": "このコレクションにはまだドキュメントがありません。",
    "not_found_title": "コレクションが見つかりません",
    "not_found_text": "お探しのコレクションは存在しないか、削除されました。",
    "back_to_documents": "ドキュメントに戻る",
    "support_divider": "サポート",
    "type": {
      "manual": "マニュアル",
      "advert": "広告",
      "catalogue": "カタログ",
      "tuning": "チューニング",
      "electrical": "電装"
    }
  },
  "zh": {
    "title": "合集 | Classic Mini DIY",
    "description": "浏览相关的Classic Mini文件合集。",
    "hero_title": "文件合集",
    "breadcrumb_archive": "存档",
    "breadcrumb_documents": "文件",
    "items_in_collection": "此合集中的文件",
    "total_pages": "总页数",
    "items_heading": "此合集中的文件",
    "empty_collection": "此合集中还没有文件。",
    "not_found_title": "未找到合集",
    "not_found_text": "您查找的合集不存在或已被删除。",
    "back_to_documents": "返回文件",
    "support_divider": "支持",
    "type": {
      "manual": "手册",
      "advert": "广告",
      "catalogue": "目录",
      "tuning": "调校",
      "electrical": "电气"
    }
  },
  "ko": {
    "title": "컬렉션 | Classic Mini DIY",
    "description": "관련 Classic Mini 문서 컬렉션을 찾아보세요.",
    "hero_title": "문서 컬렉션",
    "breadcrumb_archive": "아카이브",
    "breadcrumb_documents": "문서",
    "items_in_collection": "이 컬렉션의 문서",
    "total_pages": "총 페이지",
    "items_heading": "이 컬렉션의 문서",
    "empty_collection": "이 컬렉션에는 아직 문서가 없습니다.",
    "not_found_title": "컬렉션을 찾을 수 없습니다",
    "not_found_text": "찾으시는 컬렉션이 존재하지 않거나 삭제되었습니다.",
    "back_to_documents": "문서로 돌아가기",
    "support_divider": "지원",
    "type": {
      "manual": "매뉴얼",
      "advert": "광고",
      "catalogue": "카탈로그",
      "tuning": "튜닝",
      "electrical": "전장"
    }
  }
}
</i18n>
