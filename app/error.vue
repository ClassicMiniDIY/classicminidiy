<script lang="ts" setup>
  import type { NuxtError } from '#app';

  defineProps({
    error: Object as () => NuxtError,
  });

  const route = useRoute();
  const isHomepage = ref(route.path === '/');

  watch(
    () => route.path,
    () => {
      isHomepage.value = route.path === '/';
    }
  );
</script>

<template>
  <main-nav></main-nav>
  <NuxtLoadingIndicator />
  <div class="grid grid-cols-12 gap-4">
    <div class="col-span-12 md:col-span-6 md:col-start-4">
      <UCard class="mb-72 mt-10 text-center">
        <h2 class="text-6xl font-bold mb-4">{{ $t('title') }}</h2>
        <h3 class="text-5xl mb-4">{{ $t('heading', { statusCode: error?.statusCode }) }}</h3>
        <p>{{ $t('message') }}</p>
        <p>{{ $t('url_label') }} {{ route.fullPath }}</p>
        <p>{{ error?.message }}</p>
        <div class="flex justify-center gap-2 mt-10">
          <UButton to="/archive" color="primary">{{ $t('actions.archives') }}</UButton>
          <UButton to="/technical" color="secondary">{{ $t('actions.toolbox') }}</UButton>
          <UButton to="/" color="secondary">{{ $t('actions.home') }}</UButton>
        </div>
      </UCard>
    </div>
  </div>
  <Footer></Footer>
  <VitePwaManifest />
</template>

<style lang="scss">
  .error-page {
    margin-top: 10rem;
  }
</style>

<i18n lang="json">
{
  "en": {
    "title": "Oops!",
    "heading": "Error {statusCode}",
    "message": "The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.",
    "url_label": "Requested URL:",
    "actions": {
      "archives": "Browse Archives",
      "toolbox": "Open Toolbox",
      "home": "Go Home"
    }
  },
  "es": {
    "title": "¡Ups!",
    "heading": "Error {statusCode}",
    "message": "La página que buscas puede haber sido eliminada, cambiada de nombre o no está disponible temporalmente.",
    "url_label": "URL solicitada:",
    "actions": {
      "archives": "Explorar Archivos",
      "toolbox": "Abrir Herramientas",
      "home": "Ir al Inicio"
    }
  },
  "fr": {
    "title": "Oups !",
    "heading": "Erreur {statusCode}",
    "message": "La page que vous recherchez a peut-être été supprimée, renommée ou est temporairement indisponible.",
    "url_label": "URL demandée :",
    "actions": {
      "archives": "Parcourir les Archives",
      "toolbox": "Ouvrir la Boîte à Outils",
      "home": "Retour à l'Accueil"
    }
  },
  "it": {
    "title": "Ops!",
    "heading": "Errore {statusCode}",
    "message": "La pagina che stai cercando potrebbe essere stata rimossa, rinominata o è temporaneamente non disponibile.",
    "url_label": "URL richiesto:",
    "actions": {
      "archives": "Sfoglia gli Archivi",
      "toolbox": "Apri gli Strumenti",
      "home": "Vai alla Home"
    }
  },
  "de": {
    "title": "Hoppla!",
    "heading": "Fehler {statusCode}",
    "message": "Die gesuchte Seite wurde möglicherweise entfernt, umbenannt oder ist vorübergehend nicht verfügbar.",
    "url_label": "Angeforderte URL:",
    "actions": {
      "archives": "Archive durchsuchen",
      "toolbox": "Werkzeugkasten öffnen",
      "home": "Zur Startseite"
    }
  },
  "pt": {
    "title": "Ops!",
    "heading": "Erro {statusCode}",
    "message": "A página que você procura pode ter sido removida, renomeada ou está temporariamente indisponível.",
    "url_label": "URL solicitada:",
    "actions": {
      "archives": "Explorar Arquivos",
      "toolbox": "Abrir Ferramentas",
      "home": "Ir para o Início"
    }
  },
  "ru": {
    "title": "Ой!",
    "heading": "Ошибка {statusCode}",
    "message": "Страница, которую вы ищете, могла быть удалена, переименована или временно недоступна.",
    "url_label": "Запрошенный URL:",
    "actions": {
      "archives": "Просмотр архивов",
      "toolbox": "Открыть инструменты",
      "home": "На главную"
    }
  },
  "ja": {
    "title": "おっと！",
    "heading": "エラー {statusCode}",
    "message": "お探しのページは削除されたか、名前が変更されたか、一時的に利用できない可能性があります。",
    "url_label": "リクエストされたURL：",
    "actions": {
      "archives": "アーカイブを見る",
      "toolbox": "ツールボックスを開く",
      "home": "ホームに戻る"
    }
  },
  "zh": {
    "title": "糟糕！",
    "heading": "错误 {statusCode}",
    "message": "您查找的页面可能已被删除、更名或暂时不可用。",
    "url_label": "请求的URL：",
    "actions": {
      "archives": "浏览档案",
      "toolbox": "打开工具箱",
      "home": "返回首页"
    }
  },
  "ko": {
    "title": "이런!",
    "heading": "오류 {statusCode}",
    "message": "찾고 계신 페이지가 삭제되었거나, 이름이 변경되었거나, 일시적으로 사용할 수 없습니다.",
    "url_label": "요청한 URL:",
    "actions": {
      "archives": "아카이브 둘러보기",
      "toolbox": "도구 상자 열기",
      "home": "홈으로 가기"
    }
  }
}
</i18n>
