<script lang="ts" setup>
  import type { Giveaway } from '~~/data/models/giveaways';

  const props = withDefaults(
    defineProps<{
      giveaway: Giveaway;
      /** Milliseconds between auto-advances. Set to 0 to disable autoplay. */
      interval?: number;
      /** PostHog group label so callers can tell the /links card from any future placement. */
      analyticsGroup?: string;
    }>(),
    { interval: 4500, analyticsGroup: 'giveaway' }
  );

  const { t } = useI18n();
  const { capture } = usePostHog();

  // Written out as literal classes so Tailwind's scanner can see them — a
  // computed `aspect-${x}` string would get tree-shaken out of the build.
  const ASPECT_CLASS = {
    square: 'aspect-square',
    portrait: 'aspect-3/4',
    landscape: 'aspect-4/3',
  } as const;

  const aspectClass = computed(() => ASPECT_CLASS[props.giveaway.aspect ?? 'square']);
  /** Requested render size, matched to the window so ipx doesn't over-fetch. */
  const renderSize = computed(() => {
    const shape = props.giveaway.aspect ?? 'square';
    if (shape === 'portrait') return { width: 640, height: 853 };
    if (shape === 'landscape') return { width: 640, height: 480 };
    return { width: 640, height: 640 };
  });

  const images = computed(() => props.giveaway.images);
  const activeIndex = ref(0);

  function goTo(index: number) {
    const count = images.value.length;
    if (count === 0) return;
    activeIndex.value = ((index % count) + count) % count;
  }

  function step(direction: number) {
    goTo(activeIndex.value + direction);
    pauseAutoplay();
  }

  // ---- Autoplay -------------------------------------------------------------
  // Client-only: SSR renders slide 0 and nothing else, so hydration always agrees.
  const timer = ref<ReturnType<typeof setInterval> | null>(null);
  const paused = ref(false);

  function stopAutoplay() {
    if (timer.value) {
      clearInterval(timer.value);
      timer.value = null;
    }
  }

  function startAutoplay() {
    stopAutoplay();
    if (props.interval <= 0 || paused.value || images.value.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    timer.value = setInterval(() => goTo(activeIndex.value + 1), props.interval);
  }

  /** Hand control to the visitor the moment they touch the carousel. */
  function pauseAutoplay() {
    paused.value = true;
    stopAutoplay();
  }

  onMounted(startAutoplay);
  onUnmounted(stopAutoplay);

  // ---- Touch swipe ----------------------------------------------------------
  const touchStartX = ref(0);
  const SWIPE_THRESHOLD = 40;

  function onTouchStart(event: TouchEvent) {
    touchStartX.value = event.changedTouches[0]?.clientX ?? 0;
  }

  function onTouchEnd(event: TouchEvent) {
    const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.value;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    step(delta < 0 ? 1 : -1);
  }

  // ---- Countdown ------------------------------------------------------------
  // Rendered only after mount. The server's "now" and the browser's "now" are
  // never the same, so SSRing this would be a guaranteed hydration mismatch.
  const hasMounted = ref(false);
  const now = ref(0);
  let clock: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    hasMounted.value = true;
    now.value = Date.now();
    clock = setInterval(() => (now.value = Date.now()), 60_000);
  });

  onUnmounted(() => {
    if (clock) clearInterval(clock);
  });

  const countdown = computed(() => {
    if (!hasMounted.value) return null;
    const remaining = new Date(props.giveaway.endsAt).getTime() - now.value;
    if (!Number.isFinite(remaining) || remaining <= 0) return null;

    const minutes = Math.floor(remaining / 60_000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days >= 1) return t('countdown.days', { count: days });
    if (hours >= 1) return t('countdown.hours', { count: hours });
    return t('countdown.minutes', { count: Math.max(minutes, 1) });
  });

  // A missing/expired photo URL would otherwise render as a broken-image icon
  // with its alt text sprawling across the card. Drop it and let the placeholder
  // layer show through instead.
  const failedImages = ref(new Set<string>());

  function onImageError(src: string) {
    failedImages.value = new Set(failedImages.value).add(src);
  }

  function trackClick() {
    capture('links_page_click', {
      link_id: `giveaway_${props.giveaway.id}`,
      label: props.giveaway.title,
      destination: props.giveaway.href,
      group: props.analyticsGroup,
    });
  }
</script>

<template>
  <div
    v-if="images.length"
    class="card bg-base-100 border border-base-300 shadow-md overflow-hidden"
    @mouseenter="pauseAutoplay"
    @focusin="pauseAutoplay"
  >
    <figure
      class="relative bg-base-200"
      :class="aspectClass"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <span class="absolute inset-0 flex items-center justify-center text-base-content/20">
        <i class="fas fa-gift text-5xl"></i>
      </span>

      <!-- NuxtPicture, not NuxtImg: NuxtImg emits a single <img> in the source
           format (JPEG here), which ignores the `image.format` list in
           nuxt.config. NuxtPicture emits a real <picture> with a WebP <source>
           and the JPEG as fallback — measured 32% smaller across these eight
           photos. Positioning lives on this wrapper because NuxtPicture puts
           fallthrough classes on the inner <img>, not the <picture> root. -->
      <div
        v-for="(image, index) in images"
        v-show="!failedImages.has(image.src)"
        :key="image.src"
        class="absolute inset-0 transition-opacity duration-500"
        :class="index === activeIndex ? 'opacity-100' : 'opacity-0'"
        :aria-hidden="index === activeIndex ? undefined : 'true'"
      >
        <!-- `img-attrs`, not plain class/@error: NuxtPicture's fallthrough attrs
             land on the <picture> root, where `object-cover` is meaningless
             (it's display:inline) and where an img `error` never arrives —
             error doesn't bubble. Both have to be aimed at the <img> itself.

             `sizes="448px"`: the card lives in a `max-w-md` column, so the image
             is never wider than 448 CSS px at any breakpoint. `100vw` overstated
             it on a phone and pulled a needlessly large variant. -->
        <nuxt-picture
          :src="image.src"
          :alt="image.alt"
          :loading="index === 0 ? 'eager' : 'lazy'"
          :width="renderSize.width"
          :height="renderSize.height"
          format="webp"
          sizes="448px"
          class="block w-full h-full"
          :img-attrs="{
            class: 'w-full h-full object-cover',
            onError: () => onImageError(image.src),
          }"
        />
      </div>

      <span class="absolute top-3 left-3 badge badge-warning gap-1 font-semibold shadow">
        <i class="fas fa-gift"></i>
        {{ t('badge') }}
      </span>

      <span v-if="countdown" class="absolute top-3 right-3 badge badge-neutral badge-sm gap-1 shadow">
        <i class="fas fa-clock"></i>
        {{ countdown }}
      </span>

      <template v-if="images.length > 1">
        <button
          type="button"
          class="btn btn-circle btn-sm absolute left-2 top-1/2 -translate-y-1/2 bg-base-100/80 hover:bg-base-100 border-none shadow"
          :aria-label="t('previousPhoto')"
          @click="step(-1)"
        >
          <i class="fas fa-chevron-left"></i>
        </button>
        <button
          type="button"
          class="btn btn-circle btn-sm absolute right-2 top-1/2 -translate-y-1/2 bg-base-100/80 hover:bg-base-100 border-none shadow"
          :aria-label="t('nextPhoto')"
          @click="step(1)"
        >
          <i class="fas fa-chevron-right"></i>
        </button>

        <!-- Keeps the dots legible over pale backgrounds (these are outdoor
             photos — half the shots have concrete behind the indicators). -->
        <div class="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/50 to-transparent pointer-events-none" />

        <div class="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          <button
            v-for="(image, index) in images"
            :key="`dot-${image.src}`"
            type="button"
            class="w-2 h-2 rounded-full transition-all"
            :class="index === activeIndex ? 'bg-base-100 w-5' : 'bg-base-100/50 hover:bg-base-100/80'"
            :aria-label="t('goToPhoto', { index: index + 1 })"
            :aria-current="index === activeIndex ? 'true' : undefined"
            @click="
              goTo(index);
              pauseAutoplay();
            "
          />
        </div>
      </template>
    </figure>

    <div class="card-body p-4 gap-3">
      <div>
        <h3 class="font-bold text-lg leading-tight">{{ giveaway.title }}</h3>
        <p class="text-sm text-base-content/70 mt-1">{{ giveaway.subtitle }}</p>
      </div>

      <a
        :href="giveaway.href"
        target="_blank"
        rel="noopener"
        class="btn btn-warning btn-block justify-between"
        @click="trackClick"
      >
        <span class="font-bold">{{ giveaway.ctaLabel || t('cta') }}</span>
        <i class="fas fa-arrow-right"></i>
      </a>

      <p class="text-xs text-base-content/60 text-center">
        {{ t('hostedOn', { host: giveaway.hostLabel }) }}
      </p>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "badge": "Giveaway",
    "cta": "Enter the Giveaway",
    "hostedOn": "Entries hosted on {host}. Terms and eligibility apply.",
    "previousPhoto": "Previous photo",
    "nextPhoto": "Next photo",
    "goToPhoto": "Go to photo {index}",
    "countdown": {
      "days": "{count}d left",
      "hours": "{count}h left",
      "minutes": "{count}m left"
    }
  },
  "es": {
    "badge": "Sorteo",
    "cta": "Participar en el sorteo",
    "hostedOn": "Participaciones alojadas en {host}. Aplican términos y requisitos.",
    "previousPhoto": "Foto anterior",
    "nextPhoto": "Foto siguiente",
    "goToPhoto": "Ir a la foto {index}",
    "countdown": {
      "days": "Quedan {count}d",
      "hours": "Quedan {count}h",
      "minutes": "Quedan {count}m"
    }
  },
  "fr": {
    "badge": "Concours",
    "cta": "Participer au concours",
    "hostedOn": "Participations hébergées sur {host}. Conditions et éligibilité applicables.",
    "previousPhoto": "Photo précédente",
    "nextPhoto": "Photo suivante",
    "goToPhoto": "Aller à la photo {index}",
    "countdown": {
      "days": "{count}j restants",
      "hours": "{count}h restantes",
      "minutes": "{count}min restantes"
    }
  },
  "de": {
    "badge": "Gewinnspiel",
    "cta": "Am Gewinnspiel teilnehmen",
    "hostedOn": "Teilnahme über {host}. Es gelten die Teilnahmebedingungen.",
    "previousPhoto": "Vorheriges Foto",
    "nextPhoto": "Nächstes Foto",
    "goToPhoto": "Zu Foto {index}",
    "countdown": {
      "days": "Noch {count} T",
      "hours": "Noch {count} Std",
      "minutes": "Noch {count} Min"
    }
  },
  "it": {
    "badge": "Concorso",
    "cta": "Partecipa al concorso",
    "hostedOn": "Partecipazioni ospitate su {host}. Si applicano termini e requisiti.",
    "previousPhoto": "Foto precedente",
    "nextPhoto": "Foto successiva",
    "goToPhoto": "Vai alla foto {index}",
    "countdown": {
      "days": "{count}g rimasti",
      "hours": "{count}h rimaste",
      "minutes": "{count}min rimasti"
    }
  },
  "pt": {
    "badge": "Sorteio",
    "cta": "Participar do sorteio",
    "hostedOn": "Inscrições hospedadas no {host}. Termos e elegibilidade se aplicam.",
    "previousPhoto": "Foto anterior",
    "nextPhoto": "Próxima foto",
    "goToPhoto": "Ir para a foto {index}",
    "countdown": {
      "days": "Faltam {count}d",
      "hours": "Faltam {count}h",
      "minutes": "Faltam {count}min"
    }
  },
  "ru": {
    "badge": "Розыгрыш",
    "cta": "Участвовать в розыгрыше",
    "hostedOn": "Заявки принимаются на {host}. Действуют правила и условия участия.",
    "previousPhoto": "Предыдущее фото",
    "nextPhoto": "Следующее фото",
    "goToPhoto": "Перейти к фото {index}",
    "countdown": {
      "days": "Осталось {count} дн.",
      "hours": "Осталось {count} ч.",
      "minutes": "Осталось {count} мин."
    }
  },
  "ja": {
    "badge": "プレゼント企画",
    "cta": "プレゼント企画に応募",
    "hostedOn": "応募は{host}で受け付けています。参加条件が適用されます。",
    "previousPhoto": "前の写真",
    "nextPhoto": "次の写真",
    "goToPhoto": "写真{index}へ移動",
    "countdown": {
      "days": "残り{count}日",
      "hours": "残り{count}時間",
      "minutes": "残り{count}分"
    }
  },
  "zh": {
    "badge": "抽奖活动",
    "cta": "参加抽奖",
    "hostedOn": "抽奖由 {host} 承办，须符合参与条款与资格要求。",
    "previousPhoto": "上一张照片",
    "nextPhoto": "下一张照片",
    "goToPhoto": "转到第 {index} 张照片",
    "countdown": {
      "days": "剩余 {count} 天",
      "hours": "剩余 {count} 小时",
      "minutes": "剩余 {count} 分钟"
    }
  },
  "ko": {
    "badge": "경품 이벤트",
    "cta": "경품 이벤트 참여",
    "hostedOn": "응모는 {host}에서 진행됩니다. 약관 및 참가 자격이 적용됩니다.",
    "previousPhoto": "이전 사진",
    "nextPhoto": "다음 사진",
    "goToPhoto": "{index}번째 사진으로 이동",
    "countdown": {
      "days": "{count}일 남음",
      "hours": "{count}시간 남음",
      "minutes": "{count}분 남음"
    }
  }
}
</i18n>
