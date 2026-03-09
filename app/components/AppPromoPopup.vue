<script setup lang="ts">
  const route = useRoute();
  const isVisible = ref(false);
  const STORAGE_KEY = 'cmdiy-app-promo-dismissed';

  onMounted(() => {
    // Check for force display query param (for testing)
    const forceShow = route.query.showAppPromo !== undefined;

    if (forceShow) {
      // Force show immediately for testing
      isVisible.value = true;
    } else {
      // Check if user has already dismissed the popup
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) {
        // Show popup after a short delay for better UX
        setTimeout(() => {
          isVisible.value = true;
        }, 1500);
      }
    }
  });

  const dismissPopup = () => {
    isVisible.value = false;
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  const handleAppClick = (platform: 'ios' | 'android') => {
    // Track which platform was clicked (optional)
    console.log(`User clicked ${platform} app link`);
    dismissPopup();
  };
</script>

<template>
  <UModal v-model:open="isVisible" :ui="{ width: 'max-w-2xl' }">
    <template #content>
      <div class="relative overflow-hidden">
        <!-- Close button -->
        <UButton
          @click="dismissPopup"
          size="sm"
          variant="ghost"
          color="neutral"
          square
          class="absolute right-4 top-4 z-10"
          aria-label="Close"
        >
          <i class="fas fa-times"></i>
        </UButton>

        <!-- Banner Header -->
        <div class="relative w-full">
          <img src="/app-promo/banner.png" alt="Classic Mini Toolbox Banner" class="w-full h-auto" />
        </div>

        <div class="p-6">
          <!-- Title -->
          <div class="text-center mb-6">
            <h3 class="font-bold text-2xl mb-2">{{ $t('title') }}</h3>
            <p class="text-muted">{{ $t('subtitle') }}</p>
          </div>

          <!-- Features Grid -->
          <div class="grid grid-cols-2 gap-3 mb-6">
            <div class="flex items-center gap-2 text-sm">
              <i class="fas fa-wifi-slash text-success"></i>
              <span>{{ $t('features.offline') }}</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <i class="fas fa-calculator text-success"></i>
              <span>{{ $t('features.calculators') }}</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <i class="fas fa-bolt text-success"></i>
              <span>{{ $t('features.fast') }}</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <i class="fas fa-gift text-success"></i>
              <span>{{ $t('features.free') }}</span>
            </div>
          </div>

          <!-- Download buttons -->
          <div class="flex flex-col sm:flex-row gap-3 mb-4">
            <UButton
              to="https://apps.apple.com/us/app/classic-mini-toolbox-cmdiy/id6751475172"
              target="_blank"
              color="primary"
              class="flex-1"
              @click="handleAppClick('ios')"
            >
              <i class="fab fa-apple text-xl mr-2"></i>
              {{ $t('buttons.ios') }}
            </UButton>
            <UButton
              to="https://play.google.com/store/apps/details?id=com.classicminidiy.toolbox"
              target="_blank"
              color="primary"
              class="flex-1"
              @click="handleAppClick('android')"
            >
              <i class="fab fa-google-play text-xl mr-2"></i>
              {{ $t('buttons.android') }}
            </UButton>
          </div>

          <!-- Dismiss text -->
          <div class="text-center">
            <button @click="dismissPopup" class="text-sm text-muted hover:text-default underline">
              {{ $t('dismiss') }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Classic Mini Toolbox App is Here!",
    "subtitle": "Take your favorite Classic Mini tools on the go",
    "features": {
      "offline": "Work offline - no internet required",
      "calculators": "Access all technical calculators",
      "fast": "Lightning fast native performance",
      "free": "Completely free with no ads"
    },
    "buttons": {
      "ios": "Download on App Store",
      "android": "Get it on Google Play"
    },
    "dismiss": "Maybe later"
  },
  "de": {
    "title": "Classic Mini Toolbox App ist da!",
    "subtitle": "Nehmen Sie Ihre Lieblings-Classic-Mini-Tools überall hin mit",
    "features": {
      "offline": "Offline arbeiten - kein Internet erforderlich",
      "calculators": "Zugriff auf alle technischen Rechner",
      "fast": "Blitzschnelle native Leistung",
      "free": "Völlig kostenlos ohne Werbung"
    },
    "buttons": {
      "ios": "Im App Store laden",
      "android": "Bei Google Play laden"
    },
    "dismiss": "Vielleicht später"
  },
  "es": {
    "title": "¡La aplicación Classic Mini Toolbox está aquí!",
    "subtitle": "Lleva tus herramientas favoritas del Classic Mini a donde vayas",
    "features": {
      "offline": "Trabaja sin conexión - no requiere internet",
      "calculators": "Accede a todas las calculadoras técnicas",
      "fast": "Rendimiento nativo ultrarrápido",
      "free": "Completamente gratis sin anuncios"
    },
    "buttons": {
      "ios": "Descargar en App Store",
      "android": "Obtener en Google Play"
    },
    "dismiss": "Quizás más tarde"
  },
  "fr": {
    "title": "L'application Classic Mini Toolbox est là !",
    "subtitle": "Emportez vos outils Classic Mini préférés partout",
    "features": {
      "offline": "Fonctionne hors ligne - aucun internet requis",
      "calculators": "Accédez à tous les calculateurs techniques",
      "fast": "Performances natives ultra-rapides",
      "free": "Entièrement gratuit sans publicité"
    },
    "buttons": {
      "ios": "Télécharger sur l'App Store",
      "android": "Obtenir sur Google Play"
    },
    "dismiss": "Peut-être plus tard"
  },
  "it": {
    "title": "L'app Classic Mini Toolbox è qui!",
    "subtitle": "Porta i tuoi strumenti preferiti per Classic Mini ovunque",
    "features": {
      "offline": "Lavora offline - nessuna connessione internet richiesta",
      "calculators": "Accedi a tutti i calcolatori tecnici",
      "fast": "Prestazioni native velocissime",
      "free": "Completamente gratuita senza pubblicità"
    },
    "buttons": {
      "ios": "Scarica dall'App Store",
      "android": "Scarica da Google Play"
    },
    "dismiss": "Forse più tardi"
  },
  "pt": {
    "title": "O aplicativo Classic Mini Toolbox chegou!",
    "subtitle": "Leve suas ferramentas favoritas do Classic Mini para qualquer lugar",
    "features": {
      "offline": "Funciona offline - não requer internet",
      "calculators": "Acesse todas as calculadoras técnicas",
      "fast": "Desempenho nativo ultrarrápido",
      "free": "Completamente grátis sem anúncios"
    },
    "buttons": {
      "ios": "Baixar na App Store",
      "android": "Baixar no Google Play"
    },
    "dismiss": "Talvez mais tarde"
  },
  "ru": {
    "title": "Приложение Classic Mini Toolbox уже здесь!",
    "subtitle": "Возьмите свои любимые инструменты Classic Mini с собой",
    "features": {
      "offline": "Работает офлайн - интернет не требуется",
      "calculators": "Доступ ко всем техническим калькуляторам",
      "fast": "Молниеносная нативная производительность",
      "free": "Совершенно бесплатно без рекламы"
    },
    "buttons": {
      "ios": "Загрузить из App Store",
      "android": "Скачать в Google Play"
    },
    "dismiss": "Может быть позже"
  },
  "ja": {
    "title": "Classic Mini Toolboxアプリが登場！",
    "subtitle": "お気に入りのクラシックミニツールをどこでも持ち運び",
    "features": {
      "offline": "オフラインで動作 - インターネット不要",
      "calculators": "すべての技術計算機にアクセス",
      "fast": "超高速ネイティブパフォーマンス",
      "free": "完全無料・広告なし"
    },
    "buttons": {
      "ios": "App Storeからダウンロード",
      "android": "Google Playで入手"
    },
    "dismiss": "後で"
  },
  "zh": {
    "title": "Classic Mini Toolbox应用来了！",
    "subtitle": "随身携带您最喜欢的经典Mini工具",
    "features": {
      "offline": "离线工作 - 无需互联网",
      "calculators": "访问所有技术计算器",
      "fast": "闪电般快速的原生性能",
      "free": "完全免费无广告"
    },
    "buttons": {
      "ios": "在App Store下载",
      "android": "在Google Play获取"
    },
    "dismiss": "以后再说"
  },
  "ko": {
    "title": "Classic Mini Toolbox 앱이 출시되었습니다!",
    "subtitle": "좋아하는 클래식 미니 도구를 이동 중에도 사용하세요",
    "features": {
      "offline": "오프라인 작동 - 인터넷 불필요",
      "calculators": "모든 기술 계산기 액세스",
      "fast": "초고속 네이티브 성능",
      "free": "완전 무료 광고 없음"
    },
    "buttons": {
      "ios": "App Store에서 다운로드",
      "android": "Google Play에서 다운로드"
    },
    "dismiss": "나중에"
  }
}
</i18n>

<style scoped>
  .modal-box {
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
