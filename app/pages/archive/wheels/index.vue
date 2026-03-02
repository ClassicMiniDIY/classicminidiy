<script lang="ts" setup>
  import { HERO_TYPES } from '../../../../data/models/generic';

  useHead({
    title: $t('title'),
    meta: [
      {
        key: 'description',
        name: 'description',
        content: $t('description'),
      },
      {
        name: 'keywords',
        content: $t('keywords'),
      },
    ],
    link: [
      {
        rel: 'canonical',
        href: 'https://classicminidiy.com/archive/wheels',
      },
      {
        rel: 'preconnect',
        href: 'https://classicminidiy.s3.amazonaws.com',
      },
    ],
  });

  // CollectionPage structured data for wheels archive
  const wheelsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Classic Mini Wheels Archive',
    description: $t('description'),
    url: 'https://classicminidiy.com/archive/wheels',
    mainEntity: {
      '@type': 'ItemList',
      name: 'Classic Mini Wheel Fitment Database',
      description: 'Comprehensive database of wheels that fit Classic Mini vehicles',
      itemListElement: {
        '@type': 'ListItem',
        name: 'Classic Mini Compatible Wheels',
      },
    },
    provider: {
      '@type': 'Organization',
      name: 'Classic Mini DIY',
      url: 'https://classicminidiy.com',
    },
  };

  // Add JSON-LD structured data to head
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(wheelsJsonLd),
      },
    ],
  });

  useSeoMeta({
    ogTitle: $t('seo.og_title'),
    ogDescription: $t('seo.og_description'),
    ogUrl: 'https://classicminidiy.com/archive/wheels',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/wheels.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: $t('seo.twitter_title'),
    twitterDescription: $t('seo.twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/wheels.png',
  });
</script>

<template>
  <div>
    <hero :navigation="true" :title="$t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />
    <div class="container mx-auto px-4">
      <breadcrumb :page="$t('breadcrumb_title')" class="my-6"></breadcrumb>

      <!-- Contribute Banner -->
      <UCard class="mb-6 bg-primary/5">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <i class="fad fa-hand-holding-heart text-xl text-primary"></i>
            <div>
              <p class="font-medium">{{ $t('contribute_banner_title') }}</p>
              <p class="text-sm opacity-70">{{ $t('contribute_banner_description') }}</p>
            </div>
          </div>
          <UButton to="/contribute/wheel" color="primary" variant="outline" size="sm">
            {{ $t('contribute_banner_button') }}
          </UButton>
        </div>
      </UCard>

      <div class="grid grid-cols-12 gap-4 items-center">
        <div class="col-span-12 md:col-span-8">
          <h1 class="text-3xl font-bold mb-2">{{ $t('main_heading') }}</h1>
          <p class="pb-5">
            {{ $t('description_text') }}
          </p>
        </div>
        <div class="col-span-12 md:col-span-4">
          <NuxtLink :to="'/contribute/wheel?newWheel=true'" :title="$t('add_wheel_card.link_title')">
            <UCard class="hover:shadow-2xl transition-shadow">
              <div class="flex items-start">
                <div class="mr-4">
                  <i class="fad fa-rectangle-history-circle-plus text-3xl"></i>
                </div>
                <div>
                  <h2 class="text-lg font-semibold">{{ $t('add_wheel_card.title') }}</h2>
                  <p>{{ $t('add_wheel_card.description') }}</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>
        </div>
      </div>
      <USeparator class="my-4" />
      <div class="grid grid-cols-12 gap-4 mb-4">
        <div class="col-span-12">
          <WheelGrid></WheelGrid>
        </div>
      </div>
      <footer class="bg-muted text-center p-6 rounded-lg">
        <div>
          <h2 class="text-xl font-bold mb-2">
            {{ $t('footer.title') }}
            <a
              href="https://www.mini-forum.de/"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary hover:underline"
              >Mini-Forum.de</a
            >.
          </h2>
          <p class="pb-5">
            {{ $t('footer.description') }}
            <i class="fad fa-tombstone"></i>www.wheeldictionary.net
          </p>
        </div>
      </footer>
      <USeparator class="my-4" />
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Classic Mini Wheels Archive - Classic Mini DIY",
    "description": "Browse and contribute to the Classic Mini wheels database",
    "keywords": "Classic Mini wheels, Mini Cooper wheels, wheel fitment, wheel database, aftermarket wheels, factory wheels, wheel offset, bolt pattern",
    "hero_title": "Classic Mini Wheels",
    "breadcrumb_title": "Wheels",
    "main_heading": "Classic Mini Wheels Archive",
    "description_text": "Explore our comprehensive database of Classic Mini wheels. From original factory options to aftermarket alternatives, find detailed information about wheels that fit your Classic Mini.",
    "add_wheel_card": {
      "title": "Add a Wheel",
      "description": "Contribute to our wheels database",
      "link_title": "Add a new wheel to the database"
    },
    "contribute_banner_title": "Know something we're missing?",
    "contribute_banner_description": "Help grow the archive with your knowledge.",
    "contribute_banner_button": "Contribute",
    "footer": {
      "title": "Special thanks to",
      "description": "This database was originally sourced from the now-defunct"
    },
    "seo": {
      "og_title": "Classic Mini Wheels Archive - Classic Mini DIY",
      "og_description": "Browse and contribute to the Classic Mini wheels database",
      "twitter_title": "Classic Mini Wheels Archive - Classic Mini DIY",
      "twitter_description": "Browse and contribute to the Classic Mini wheels database"
    }
  }
}
</i18n>
