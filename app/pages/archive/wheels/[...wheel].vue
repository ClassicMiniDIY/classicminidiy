<script lang="ts" setup>
  import { HERO_TYPES } from '../../../../data/models/generic';
  import { shareWheelItem } from '../../../../data/models/helper-utils';
  import type { IWheelsData } from '../../../../data/models/wheels';

  const route = useRoute();
  const wheelId = ref(route.params.wheel);
  const { getWheel } = useWheels();
  const {
    data: wheel,
    pending,
    error,
  } = await useAsyncData(
    `wheel-${wheelId.value?.[0] || 'noWheel'}`,
    () => getWheel(wheelId.value?.[0] || 'noWheel'),
    {
      server: !!wheelId.value?.[0],
      default: () => ({}) as IWheelsData,
    }
  );

  const copied = ref<boolean>(false);
  const shareImage = computed(() => {
    if (!wheel.value?.images?.length) return 'no-image';
    return wheel.value.images[0].src;
  });

  async function copyUrl() {
    const url = `https://classicminidiy.com/archive/wheels/${wheel.value?.uuid}`;
    try {
      await navigator.clipboard.writeText(url);
      copied.value = true;
      setTimeout(() => (copied.value = false), 1000);
    } catch ($e) {
      copied.value = false;
    }
  }

  // Update head and meta tags when wheel data is loaded
  watchEffect(() => {
    if (wheel.value) {
      const title = $t('seo.title_template', {
        name: wheel.value.name,
        size: wheel.value.size,
        width: wheel.value.width,
      });
      const description = $t('seo.description');

      useHead({
        title,
        meta: [
          {
            key: 'description',
            name: 'description',
            content: description,
          },
          {
            key: 'keywords',
            name: 'keywords',
            content: $t('seo.keywords'),
          },
        ],
        link: [
          {
            rel: 'canonical',
            href: `https://classicminidiy.com/archive/wheels/${wheel.value.uuid}`,
          },
          {
            rel: 'preconnect',
            href: 'https://classicminidiy.s3.amazonaws.com',
          },
        ],
      });

      useSeoMeta({
        ogTitle: title,
        ogDescription: description,
        ogUrl: `classicminidiy.com/archive/wheels/${wheel.value.uuid}`,
        ogImage: shareImage.value,
        ogType: 'website',
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        twitterImage: shareImage.value,
      });
    }
  });
</script>
<template>
  <hero :navigation="true" :title="$t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />
  <div class="container mx-auto px-4 py-4">
    <!-- Loading State -->
    <div v-if="pending" class="flex justify-center items-center min-h-[50vh]">
      <div class="text-center">
        <span class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary inline-block"></span>
        <p class="mt-4">{{ $t('loading_text') }}</p>
      </div>
    </div>

    <!-- Error State -->
    <UAlert v-else-if="error" color="error" class="my-8" icon="i-fa6-solid-triangle-exclamation">
      <template #title>{{ $t('error_message') }}</template>
      <template #actions>
        <UButton to="/archive/wheels" size="sm" variant="ghost">
          <i class="fas fa-arrow-left mr-2"></i> {{ $t('back_to_wheels') }}
        </UButton>
      </template>
    </UAlert>

    <!-- Content -->
    <div v-else>
      <div class="grid grid-cols-12 gap-4 items-center">
        <div class="col-span-12 md:col-span-8">
          <breadcrumb
            class="mt-6"
            :page="wheel?.name || $t('breadcrumb_fallback')"
            :subpage="$t('breadcrumb_subpage')"
            subpage-href="/archive/wheels"
          ></breadcrumb>
        </div>
      </div>
      <div class="grid grid-cols-12 gap-4">
        <div class="col-span-12">
          <UCard>
            <div v-if="wheel">
              <div class="flex flex-col md:flex-row gap-8">
                <div class="flex-1">
                  <h1 class="text-3xl font-bold mb-4">{{ wheel.name }}</h1>
                  <p v-if="wheel.notes" class="text-gray-600 text-lg">{{ wheel.notes }}</p>
                </div>

                <div class="w-full md:w-1/3 flex justify-center">
                  <div class="w-full max-w-sm">
                    <div
                      v-if="wheel.images && wheel.images.length > 1"
                      class="carousel w-full rounded-lg overflow-hidden"
                    >
                      <div
                        v-for="(image, index) in wheel.images"
                        :key="index"
                        :id="`slide${index}`"
                        class="carousel-item relative w-full aspect-[4/3]"
                      >
                        <img :src="image.src" class="w-full h-full object-cover" />
                        <div class="absolute flex justify-between transform -translate-y-1/2 left-2 right-2 top-1/2">
                          <a
                            :href="`#slide${index === 0 ? wheel.images.length - 1 : index - 1}`"
                            class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/80 hover:bg-white text-gray-800 shadow-md"
                          >
                            <i class="fas fa-chevron-left"></i>
                          </a>
                          <a
                            :href="`#slide${index === wheel.images.length - 1 ? 0 : index + 1}`"
                            class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/80 hover:bg-white text-gray-800 shadow-md"
                          >
                            <i class="fas fa-chevron-right"></i>
                          </a>
                        </div>
                      </div>
                    </div>
                    <img
                      v-else-if="wheel.images && wheel.images[0]"
                      :alt="$t('image_alt', { name: wheel.name })"
                      class="w-full h-auto rounded-lg shadow-md"
                      :src="wheel.images[0].src"
                    />
                    <div v-else class="w-full aspect-square flex items-center justify-center bg-gray-100 rounded-lg">
                      <i class="fas fa-image text-6xl text-gray-300" :title="$t('no_image_placeholder')"></i>
                    </div>
                  </div>
                </div>
              </div>

              <USeparator class="my-4" />
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 py-4">
                <div class="flex flex-col items-center text-center">
                  <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <i class="fad fa-arrow-right-to-line text-xl text-primary"></i>
                  </div>
                  <h3 class="font-semibold text-gray-600 mb-1">
                    {{ $t('specifications.offset') }}
                  </h3>
                  <p v-if="wheel.offset" class="text-lg font-medium">{{ wheel.offset }}</p>
                  <p v-else class="text-error text-sm">
                    {{ $t('specifications.not_specified') }}
                  </p>
                </div>
                <div class="flex flex-col items-center text-center">
                  <div class="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-2">
                    <i class="fad fa-arrows-to-line text-xl text-secondary"></i>
                  </div>
                  <h3 class="font-semibold text-gray-600 mb-1">
                    {{ $t('specifications.diameter') }}
                  </h3>
                  <p v-if="wheel.size" class="text-lg font-medium">{{ wheel.size }}</p>
                  <p v-else class="text-error text-sm">
                    {{ $t('specifications.not_specified') }}
                  </p>
                </div>
                <div class="flex flex-col items-center text-center">
                  <div class="w-12 h-12 rounded-full bg-info/10 flex items-center justify-center mb-2">
                    <i class="fad fa-arrows-left-right-to-line text-xl text-info"></i>
                  </div>
                  <h3 class="font-semibold text-gray-600 mb-1">
                    {{ $t('specifications.width') }}
                  </h3>
                  <p v-if="wheel.width" class="text-lg font-medium">{{ wheel.width }}</p>
                  <p v-else class="text-error text-sm">
                    {{ $t('specifications.not_specified') }}
                  </p>
                </div>
              </div>
              <USeparator class="my-4" />
              <div class="flex flex-wrap justify-center gap-3 pt-2">
                <UButton v-if="copied" size="lg" color="neutral" disabled>
                  <i class="fad fa-check text-success mr-2"></i>
                  <span>{{ $t('actions.copied') }}</span>
                </UButton>
                <UButton v-else size="lg" color="primary" @click="copyUrl">
                  <i class="fad fa-link mr-2"></i>
                  <span>{{ $t('actions.copy_link') }}</span>
                </UButton>
                <UButton
                  v-if="wheel.name && wheel.uuid"
                  size="lg"
                  color="secondary"
                  @click="shareWheelItem(wheel.name, wheel.uuid)"
                >
                  <i class="fad fa-share mr-2"></i>
                  <span>{{ $t('actions.share') }}</span>
                </UButton>
                <UButton
                  v-if="wheel.uuid"
                  :to="`/archive/wheels/submit?uuid=${wheel.uuid}`"
                  size="lg"
                  variant="outline"
                >
                  <i class="fad fa-edit mr-2"></i>
                  <span>{{ $t('actions.contribute') }}</span>
                </UButton>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
  @media (max-width: 600px) {
    .top-section {
      text-align: center;
    }
  }

  .wheel-image {
    margin-left: auto;

    @media (max-width: 600px) {
      margin-left: unset;
      margin: auto;
    }
  }
</style>

<i18n lang="json">
{
  "en": {
    "hero_title": "Classic Mini Wheels",
    "loading_text": "Loading wheel details...",
    "error_message": "Failed to load wheel details. Please try again later.",
    "back_to_wheels": "Back to Wheels",
    "breadcrumb_fallback": "Wheel Details",
    "breadcrumb_subpage": "Wheels",
    "image_alt": "Image of {name} wheel",
    "no_image_placeholder": "No image available",
    "specifications": {
      "offset": "Offset",
      "diameter": "Diameter",
      "width": "Width",
      "not_specified": "Not specified"
    },
    "actions": {
      "copied": "Link copied!",
      "copy_link": "Copy Link",
      "share": "Share",
      "contribute": "Edit/Contribute"
    },
    "seo": {
      "title_template": "{name} - {size}x{width} Classic Mini Wheel",
      "description": "Detailed specifications and images for this Classic Mini wheel",
      "keywords": "classic mini, wheels, specifications, offset, diameter, width"
    }
  }
}
</i18n>
