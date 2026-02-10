<script lang="ts" setup>
  import { DateTime } from 'luxon';
  import { HERO_TYPES } from '../../data/models/generic';

  const { capture } = usePostHog();

  useHead({
    title: $t('seo.title'),
    meta: [
      {
        key: 'description',
        name: 'description',
        content: $t('seo.description'),
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
        href: 'https://classicminidiy.com/maps',
      },
      {
        rel: 'preconnect',
        href: 'https://classicminidiy.s3.amazonaws.com',
      },
    ],
  });

  useSeoMeta({
    ogTitle: $t('seo.ogTitle'),
    ogDescription: $t('seo.description'),
    ogUrl: 'https://classicminidiy.com/maps',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/maps.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: $t('seo.twitterTitle'),
    twitterDescription: $t('seo.twitterDescription'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/maps.png',
  });

  // Add structured data for the ECU maps product
  const ecuMapsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Classic Mini ECU Maps Collection',
    description:
      'Professional ECU maps for Classic Mini engines. Compatible with multiple ECU brands including Haltech, Speeduino, MegaSquirt, Emerald, and more.',
    image: 'https://classicminidiy.s3.amazonaws.com/social-share/maps.png',
    offers: {
      '@type': 'Offer',
      price: '0.00',
      priceCurrency: 'USD',
      priceValidUntil: '2025-12-31',
      availability: 'https://schema.org/InStock',
      url: 'https://classicminidiy.com/maps',
      seller: {
        '@type': 'Organization',
        name: 'Classic Mini DIY',
      },
    },
    brand: {
      '@type': 'Brand',
      name: 'Classic Mini DIY',
    },
    review: {
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: '5',
        bestRating: '5',
      },
      author: {
        '@type': 'Person',
        name: 'Classic Mini DIY Community',
      },
    },
  };

  // Add JSON-LD structured data to head
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(ecuMapsJsonLd),
      },
    ],
  });
  const { data: releases, status: releasesLoading, error: releaseError } = await useFetch('/api/github/releases');
  const { data: commits, status: commitsLoading, error: commitError } = await useFetch('/api/github/commits');

  // Merge releases and commits chronologically
  interface UpdateItem {
    type: 'commit' | 'release';
    date: string;
    displayDate: string;
    message: string;
    sha?: string;
    tagName?: string;
    url: string;
  }

  const mergedUpdates = computed(() => {
    const updates: UpdateItem[] = [];

    // Add commits with type identifier
    if (commits.value && Array.isArray(commits.value)) {
      commits.value.forEach((commit) => {
        updates.push({
          type: 'commit',
          date: commit.commit?.committer?.date || commit.date,
          displayDate: commit.date,
          message: commit.commit?.message || '',
          sha: commit.sha,
          url: `https://github.com/SomethingNew71/MiniECUMaps/commit/${commit.sha}`,
        });
      });
    }

    // Add releases with type identifier
    if (releases.value?.releases && Array.isArray(releases.value.releases)) {
      releases.value.releases.forEach((release) => {
        updates.push({
          type: 'release',
          date: release.published_at || release.created_at || '',
          displayDate: release.published_at ? DateTime.fromISO(release.published_at).toFormat('LLL dd') : 'Unknown',
          message: release.name || release.tag_name || 'New Release',
          tagName: release.tag_name || undefined,
          url: release.html_url || `https://github.com/SomethingNew71/MiniECUMaps/releases/tag/${release.tag_name}`,
        });
      });
    }

    // Sort by date (newest first)
    updates.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });

    // Limit to 15 most recent items
    return updates.slice(0, 15);
  });

  const legend = computed(() => [
    {
      name: $t('legend.included.name'),
      id: 'yes',
      description: $t('legend.included.description'),
    },
    {
      name: $t('legend.notIncluded.name'),
      id: 'no',
      description: $t('legend.notIncluded.description'),
    },
    {
      name: $t('legend.notAvailable.name'),
      id: 'na',
      description: $t('legend.notAvailable.description'),
    },
    {
      name: $t('legend.workInProgress.name'),
      id: 'wip',
      description: $t('legend.workInProgress.description'),
    },
  ]);
  const items = computed(() => [
    {
      features: $t('table.ignitionMap'),
      haltech: 'yes',
      speeduino: 'yes',
      megasquirt: 'yes',
      emerald: 'yes',
      ecuMaster: 'wip',
      maxxEcu: 'wip',
      dtaFast: 'yes',
      megaJolt: 'yes',
    },
    {
      features: $t('table.fuelMap'),
      haltech: 'yes',
      speeduino: 'yes',
      megasquirt: 'yes',
      emerald: 'yes',
      ecuMaster: 'wip',
      maxxEcu: 'wip',
      dtaFast: 'na',
      megaJolt: 'na',
    },
    {
      features: $t('table.veTable'),
      haltech: 'yes',
      speeduino: 'yes',
      megasquirt: 'yes',
      emerald: 'na',
      ecuMaster: 'wip',
      maxxEcu: 'wip',
      dtaFast: 'na',
      megaJolt: 'na',
    },
    {
      features: $t('table.targetAfr'),
      haltech: 'yes',
      speeduino: 'yes',
      megasquirt: 'yes',
      emerald: 'yes',
      ecuMaster: 'wip',
      maxxEcu: 'wip',
      dtaFast: 'yes',
      megaJolt: 'yes',
    },
    {
      features: $t('table.throttleEnrichment'),
      haltech: 'yes',
      speeduino: 'no',
      megasquirt: 'no',
      emerald: 'na',
      ecuMaster: 'wip',
      maxxEcu: 'wip',
      dtaFast: 'na',
      megaJolt: 'na',
    },
    {
      features: $t('table.driveByWire'),
      haltech: 'yes',
      speeduino: 'no',
      megasquirt: 'no',
      emerald: 'na',
      ecuMaster: 'wip',
      maxxEcu: 'wip',
      dtaFast: 'na',
      megaJolt: 'na',
    },
    {
      features: $t('table.boostControl'),
      haltech: 'yes',
      speeduino: 'no',
      megasquirt: 'no',
      emerald: 'na',
      ecuMaster: 'wip',
      maxxEcu: 'wip',
      dtaFast: 'na',
      megaJolt: 'na',
    },
    {
      features: $t('table.idleMap'),
      haltech: 'yes',
      speeduino: 'no',
      megasquirt: 'no',
      emerald: 'na',
      ecuMaster: 'wip',
      maxxEcu: 'wip',
      dtaFast: 'na',
      megaJolt: 'na',
    },
    {
      features: $t('table.sixteenVEngine'),
      haltech: 'yes',
      speeduino: 'yes',
      megasquirt: 'yes',
      emerald: 'yes',
      ecuMaster: 'wip',
      maxxEcu: 'wip',
      dtaFast: 'wip',
      megaJolt: 'wip',
    },
  ]);
</script>

<template>
  <div>
    <hero
      :navigation="true"
      :title="$t('hero.title')"
      :subtitle="$t('hero.subtitle')"
      :heroType="HERO_TYPES.MAPS"
      :textSize="'3xl'"
    />
    <div class="container mx-auto px-4">
      <div class="grid grid-cols-12 gap-4">
        <div class="col-span-12 md:col-span-6 md:col-start-4">
          <h1 class="fancy-font-bold text-2xl text-center pt-10 pb-5">{{ $t('mainTitle') }}</h1>
          <h2 class="fancy-font-book-oblique text-center text-xl">
            {{ $t('description') }}
          </h2>
        </div>
        <div class="col-span-12 md:col-span-10 md:col-start-2 py-10">
          <div class="flex flex-wrap justify-center gap-8">
            <div class="text-center">
              <i class="fad fa-flag-checkered text-3xl pb-3"></i>
              <h3 class="text-lg">{{ $t('features.lifetimeUpdates') }}</h3>
            </div>
            <div class="text-center">
              <i class="fad fa-microchip text-3xl pb-3"></i>
              <h3 class="text-lg">{{ $t('features.multipleEcus') }}</h3>
            </div>
            <div class="text-center">
              <i class="fad fa-arrows-rotate text-3xl pb-3"></i>
              <h3 class="text-lg">{{ $t('features.constantlyUpdated') }}</h3>
            </div>
            <div class="text-center">
              <i class="fad fa-money-bill fa-beat text-3xl pb-3"></i>
              <h3 class="text-lg">{{ $t('features.payWhatYouWant') }}</h3>
            </div>
          </div>
        </div>

        <div class="col-span-12 md:col-span-6 text-center">
          <UCard>
            <div class="text-center">
              <i class="fad fa-credit-card text-3xl pb-3"></i>
            </div>
            <h3 class="fancy-font-bold text-2xl">{{ $t('options.purchase.title') }}</h3>
            <h4 class="fancy-font-bold text-xl">{{ $t('options.latestRelease') }}: {{ releases?.latestRelease }}</h4>
            <p class="py-3">
              {{ $t('options.purchase.description') }}
            </p>
            <div class="flex justify-center">
              <UButton
                to="https://store.classicminidiy.com/collections/efi-base-maps"
                color="primary"
                target="_blank"
                @click="capture('maps_cta_clicked', { action: 'purchase' })"
              >
                <i class="fad fa-credit-card mr-2"></i> {{ $t('options.purchase.button') }}
              </UButton>
            </div>
          </UCard>
        </div>
        <div class="col-span-12 md:col-span-6 text-center">
          <UCard>
            <div class="text-center">
              <i class="fad fa-download text-3xl pb-3"></i>
            </div>
            <h3 class="fancy-font-bold text-2xl">{{ $t('options.download.title') }}</h3>
            <h4 class="fancy-font-bold text-xl">{{ $t('options.latestRelease') }}: {{ releases?.latestRelease }}</h4>
            <p class="py-3">
              {{ $t('options.download.description') }}
            </p>
            <div class="flex justify-center gap-2">
              <UButton
                to="https://github.com/SomethingNew71/MiniECUMaps/archive/refs/heads/master.zip"
                color="primary"
                target="_blank"
                @click="capture('maps_cta_clicked', { action: 'download' })"
              >
                <i class="fad fa-download mr-2"></i> {{ $t('options.download.button') }}
              </UButton>
              <UButton
                to="https://github.com/SomethingNew71/MiniECUMaps"
                color="neutral"
                target="_blank"
                @click="capture('maps_cta_clicked', { action: 'source' })"
              >
                <i class="fad fa-code-branch mr-2"></i> {{ $t('options.download.viewSource') }}
              </UButton>
            </div>
          </UCard>
        </div>
        <div class="col-span-12 md:col-span-10 md:col-start-2">
          <USeparator>
            <span class="text-sm text-muted">{{ $t('moreDetails') }}</span>
          </USeparator>
        </div>
        <div class="col-span-12">
          <UCard>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-default">
                    <th class="text-left p-2 font-medium">{{ $t('table.features') }}</th>
                    <th class="text-center p-2 font-medium">Haltech</th>
                    <th class="text-center p-2 font-medium">Speeduino</th>
                    <th class="text-center p-2 font-medium">MegaSquirt</th>
                    <th class="text-center p-2 font-medium">Emerald</th>
                    <th class="text-center p-2 font-medium">ECUMaster</th>
                    <th class="text-center p-2 font-medium">MaxxECU</th>
                    <th class="text-center p-2 font-medium">DTAFast</th>
                    <th class="text-center p-2 font-medium">MegaJolt</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in items"
                    class="border-b border-default last:border-0 hover:bg-muted transition-colors"
                  >
                    <td class="text-center py-3 p-2" v-for="(ecu, index) in row" :key="ecu">
                      <p class="text-left" v-if="index === 'features'">
                        {{ ecu }}
                      </p>
                      <i v-if="ecu === 'yes'" class="text-lg fa-solid fa-check" style="color: #4a7023"></i>
                      <i v-if="ecu === 'no'" class="text-lg fa-solid fa-xmark" style="color: #b22222"></i>
                      <i
                        v-if="ecu === 'wip'"
                        class="text-h6 pr-3 fa-sharp-duotone fa-solid fa-road-barrier"
                        style="--fa-primary-color: #562b00; --fa-secondary-color: #f5c147; --fa-secondary-opacity: 1"
                      ></i>
                      <i v-if="ecu === 'na'" class="text-lg fa-solid fa-dash"></i>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 pt-5">
              <div v-for="item in legend" class="flex items-center p-2">
                <div class="mr-3">
                  <i v-if="item.id === 'yes'" class="text-lg fa-solid fa-check" style="color: #4a7023"></i>
                  <i v-if="item.id === 'no'" class="text-lg fa-solid fa-xmark" style="color: #b22222"></i>
                  <i
                    v-if="item.id === 'wip'"
                    class="text-h6 pr-3 fa-sharp-duotone fa-solid fa-road-barrier"
                    style="--fa-primary-color: #562b00; --fa-secondary-color: #f5c147; --fa-secondary-opacity: 1"
                  ></i>
                  <i v-if="item.id === 'na'" class="text-lg fa-solid fa-dash"></i>
                </div>
                <div>
                  <div class="font-bold">{{ item.name }}</div>
                  <div class="text-sm opacity-70">{{ item.description }}</div>
                </div>
              </div>
            </div>
          </UCard>
        </div>
        <div class="col-span-12 md:col-span-6">
          <UCard :ui="{ body: 'p-0' }">
            <template #header>
              <div class="flex items-center">
                <i class="fad fa-code-branch mr-2"></i>
                <h5 class="font-bold text-lg">{{ $t('updates.title') }}</h5>
              </div>
            </template>
            <div class="p-2">
              <div v-if="commitsLoading === 'pending' || releasesLoading === 'pending'" class="flex justify-center p-4">
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
              <div v-else-if="mergedUpdates && mergedUpdates.length > 0">
                <a
                  v-for="(update, index) in mergedUpdates"
                  :key="`update-${index}`"
                  class="flex items-center p-3 hover:bg-muted border-b border-default transition-colors"
                  :href="update.url"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span class="mr-2">
                    <i v-if="update.type === 'release'" class="fad fa-tag text-success" aria-hidden="true"></i>
                    <i v-else class="fad fa-code-commit" aria-hidden="true"></i>
                  </span>
                  <span class="date pr-2 font-bold min-w-[15%]">
                    {{ update.displayDate }}
                  </span>
                  <span class="flex-1">
                    <UBadge v-if="update.type === 'release'" color="primary" size="sm" class="mr-2">Release</UBadge>
                    <UBadge
                      v-if="update.type === 'release' && update.tagName"
                      color="secondary"
                      size="sm"
                      class="mr-2"
                      >{{ update.tagName }}</UBadge
                    >
                    {{ update.message }}
                  </span>
                </a>
              </div>
              <div v-else-if="commitError || releaseError">
                <div class="flex items-center p-3 border-b border-default">
                  <span class="mr-2">
                    <i class="fad fa-exclamation-triangle text-warning" aria-hidden="true"></i>
                  </span>
                  <span class="date pr-2 font-bold min-w-[15%]"> --- </span>
                  <span>{{ $t('updates.error') }}</span>
                </div>
                <div v-for="i in 10" :key="`error-${i}`" class="flex items-center p-3 border-b border-default">
                  <span class="mr-2">
                    <i class="fad fa-code-commit" aria-hidden="true"></i>
                  </span>
                  <span class="date pr-2 font-bold min-w-[15%]"> --- </span>
                  <span>---</span>
                </div>
              </div>
              <div v-else>
                <div class="flex items-center p-3 border-b border-default">
                  <span class="mr-2">
                    <i class="fad fa-info-circle" aria-hidden="true"></i>
                  </span>
                  <span class="date pr-2 font-bold min-w-[15%]"> --- </span>
                  <span>{{ $t('updates.noUpdates') }}</span>
                </div>
                <div v-for="i in 10" :key="`empty-${i}`" class="flex items-center p-3 border-b border-default">
                  <span class="mr-2">
                    <i class="fad fa-code-commit" aria-hidden="true"></i>
                  </span>
                  <span class="date pr-2 font-bold min-w-[15%]"> --- </span>
                  <span>---</span>
                </div>
              </div>
              <div class="flex justify-center p-4">
                <UButton
                  to="https://github.com/SomethingNew71/MiniECUMaps"
                  color="neutral"
                  class="w-full"
                  target="_blank"
                >
                  <i class="fad fa-code-branch mr-2"></i> {{ $t('updates.viewAllCommits') }}
                </UButton>
              </div>
            </div>
          </UCard>
        </div>
        <div class="col-span-12 md:col-span-6">
          <h3 class="fancy-font-bold text-3xl text-center pb-5">{{ $t('supportedEcus.title') }}</h3>
          <UCard>
            <USeparator class="mb-4">
              <span class="text-sm text-muted">{{ $t('supportedEcus.subtitle') }}</span>
            </USeparator>
            <div class="grid grid-cols-1 gap-6">
              <div class="image">
                <img
                  class="mx-auto w-1/2"
                  src="https://classicminidiy.s3.us-east-1.amazonaws.com/misc/ecus/haltech.jpg"
                  alt="Haltech ECU"
                />
              </div>
              <div class="image">
                <img
                  class="mx-auto w-1/2"
                  src="https://classicminidiy.s3.us-east-1.amazonaws.com/misc/ecus/speeduino.jpg"
                  alt="Speeduino ECU"
                />
              </div>
              <div class="image">
                <img
                  class="mx-auto w-1/2"
                  src="https://classicminidiy.s3.us-east-1.amazonaws.com/misc/ecus/megasquirt.png"
                  alt="MegaSquirt ECU"
                />
              </div>
              <div class="image">
                <img
                  class="mx-auto w-1/2"
                  src="https://classicminidiy.s3.us-east-1.amazonaws.com/misc/ecus/emerald.png"
                  alt="Emerald ECU"
                />
              </div>
              <div class="image">
                <img
                  class="mx-auto w-1/2"
                  src="https://classicminidiy.s3.us-east-1.amazonaws.com/misc/ecus/megajolt.png"
                  alt="MegaJolt ECU"
                />
              </div>
              <div class="image">
                <img
                  class="mx-auto w-1/2"
                  src="https://classicminidiy.s3.us-east-1.amazonaws.com/misc/ecus/dta.jpg"
                  alt="DTA Fast ECU"
                />
              </div>
            </div>
          </UCard>
        </div>
        <div class="col-span-12 md:col-span-10 md:col-start-2">
          <USeparator>
            <span class="text-sm text-muted">{{ $t('otherSupport') }}</span>
          </USeparator>
        </div>
        <div class="col-span-12 md:col-span-10 md:col-start-2 pb-10">
          <patreon-card size="large" />
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "seo": {
      "title": "Classic Mini ECU Maps | Tuning Files for Multiple ECUs | Classic Mini DIY",
      "description": "Download professionally tuned ECU maps for Classic Mini engines. Compatible with Haltech, Speeduino, MegaSquirt, Emerald, and more. Pay what you want for lifetime updates.",
      "keywords": "Classic Mini ECU maps, Mini Cooper tuning, Haltech maps, Speeduino maps, MegaSquirt maps, Emerald ECU, engine tuning, fuel maps, ignition maps",
      "ogTitle": "Classic Mini ECU Maps | Tuning Files for Multiple ECUs",
      "twitterTitle": "Classic Mini ECU Maps | Multiple ECU Support",
      "twitterDescription": "Professional ECU maps for Classic Mini engines with lifetime updates."
    },
    "breadcrumb": "ECU Maps",
    "hero": {
      "title": "Classic Mini DIY ECU Maps",
      "subtitle": "Pay what your want, always"
    },
    "mainTitle": "The Classic Mini ECU Map",
    "description": "After years of tuning Classic Mini engines, building custom harnesses, and mapping multiple ECU's, I am proud to release my collection of ECU maps with two options for access. Offering support for many popular ECU's used on Classic Minis, with more added in the future.",
    "features": {
      "lifetimeUpdates": "Lifetime Updates",
      "multipleEcus": "Multiple ECU's",
      "constantlyUpdated": "Constantly Updated",
      "payWhatYouWant": "Pay what you want"
    },
    "options": {
      "latestRelease": "Latest Release",
      "purchase": {
        "title": "Option 1 - Purchase",
        "description": "Purchase the ECU maps directly from the Classic Mini DIY store. This option is perfect for those who want to support the channel and get the maps without having to use Github. This option also comes with priority support via email.",
        "button": "Download"
      },
      "download": {
        "title": "Option 2 - Download",
        "description": "Download the ECU maps directly from Github. This option is perfect for those who want to get the maps for free. This option also comes with the ability to contribute to the project by submitting pull requests.",
        "button": "Download",
        "viewSource": "View Source"
      }
    },
    "moreDetails": "More Details",
    "table": {
      "features": "Features",
      "ignitionMap": "Ignition Map",
      "fuelMap": "Fuel Map",
      "veTable": "VE Table",
      "targetAfr": "Target AFR",
      "throttleEnrichment": "Throttle Enrichment",
      "driveByWire": "Drive by Wire Ready",
      "boostControl": "Boost Control Map",
      "idleMap": "Idle Map",
      "sixteenVEngine": "16V Engine Version"
    },
    "legend": {
      "included": {
        "name": "Included",
        "description": "Included in Map"
      },
      "notIncluded": {
        "name": "Not included",
        "description": "Supported but not included"
      },
      "notAvailable": {
        "name": "Not Available",
        "description": "Feature not supported by ECU"
      },
      "workInProgress": {
        "name": "Work in progress",
        "description": "Currently still in progress being ported to this ECU"
      }
    },
    "updates": {
      "title": "Latest Updates",
      "error": "Error loading update history from Github",
      "noUpdates": "No updates available",
      "viewAllCommits": "View All Commits"
    },
    "supportedEcus": {
      "title": "Supported ECU's",
      "subtitle": "Support for the ecu you need"
    },
    "otherSupport": "Other ways to support"
  },
  "es": {
    "seo": {
      "title": "Mapas de ECU Classic Mini | Archivos de Afinación para Múltiples ECUs | Classic Mini DIY",
      "description": "Descarga mapas de ECU afinados profesionalmente para motores Classic Mini. Compatible con Haltech, Speeduino, MegaSquirt, Emerald y más. Paga lo que quieras por actualizaciones de por vida.",
      "keywords": "Mapas de ECU Classic Mini, afinación Mini Cooper, mapas Haltech, mapas Speeduino, mapas MegaSquirt, ECU Emerald, afinación de motor, mapas de combustible, mapas de encendido",
      "ogTitle": "Mapas de ECU Classic Mini | Archivos de Afinación para Múltiples ECUs",
      "twitterTitle": "Mapas de ECU Classic Mini | Soporte para Múltiples ECUs",
      "twitterDescription": "Mapas de ECU profesionales para motores Classic Mini con actualizaciones de por vida."
    },
    "breadcrumb": "Mapas de ECU",
    "hero": {
      "title": "Mapas de ECU Classic Mini DIY",
      "subtitle": "Paga lo que quieras, siempre"
    },
    "mainTitle": "El Mapa de ECU Classic Mini",
    "description": "Después de años de afinar motores Classic Mini, construir arneses personalizados y mapear múltiples ECUs, estoy orgulloso de lanzar mi colección de mapas de ECU con dos opciones de acceso. Ofreciendo soporte para muchas ECUs populares usadas en Classic Minis, con más agregadas en el futuro.",
    "features": {
      "lifetimeUpdates": "Actualizaciones de por Vida",
      "multipleEcus": "Múltiples ECUs",
      "constantlyUpdated": "Constantemente Actualizado",
      "payWhatYouWant": "Paga lo que quieras"
    },
    "options": {
      "latestRelease": "Lanzamiento Más Reciente",
      "purchase": {
        "title": "Opción 1 - Comprar",
        "description": "Compra los mapas de ECU directamente de la tienda Classic Mini DIY. Esta opción es perfecta para aquellos que quieren apoyar el canal y obtener los mapas sin tener que usar Github. Esta opción también viene con soporte prioritario por correo electrónico.",
        "button": "Descargar"
      },
      "download": {
        "title": "Opción 2 - Descargar",
        "description": "Descarga los mapas de ECU directamente de Github. Esta opción es perfecta para aquellos que quieren obtener los mapas gratis. Esta opción también viene con la capacidad de contribuir al proyecto enviando pull requests.",
        "button": "Descargar",
        "viewSource": "Ver Código Fuente"
      }
    },
    "moreDetails": "Más Detalles",
    "table": {
      "features": "Características",
      "ignitionMap": "Mapa de Encendido",
      "fuelMap": "Mapa de Combustible",
      "veTable": "Tabla VE",
      "targetAfr": "AFR Objetivo",
      "throttleEnrichment": "Enriquecimiento del Acelerador",
      "driveByWire": "Listo para Drive by Wire",
      "boostControl": "Mapa de Control de Boost",
      "idleMap": "Mapa de Ralentí",
      "sixteenVEngine": "Versión Motor 16V"
    },
    "legend": {
      "included": {
        "name": "Incluido",
        "description": "Incluido en el Mapa"
      },
      "notIncluded": {
        "name": "No incluido",
        "description": "Soportado pero no incluido"
      },
      "notAvailable": {
        "name": "No Disponible",
        "description": "Característica no soportada por la ECU"
      },
      "workInProgress": {
        "name": "Trabajo en progreso",
        "description": "Actualmente aún en progreso siendo portado a esta ECU"
      }
    },
    "updates": {
      "title": "Últimas Actualizaciones",
      "error": "Error cargando el historial de actualizaciones de Github",
      "noUpdates": "No hay actualizaciones disponibles",
      "viewAllCommits": "Ver Todos los Commits"
    },
    "supportedEcus": {
      "title": "ECUs Soportadas",
      "subtitle": "Soporte para la ECU que necesitas"
    },
    "otherSupport": "Otras formas de apoyar"
  },
  "fr": {
    "seo": {
      "title": "Cartes ECU Classic Mini | Fichiers de réglage pour plusieurs ECUs | Classic Mini DIY",
      "description": "Téléchargez des cartes ECU réglées professionnellement pour moteurs Classic Mini. Compatible avec Haltech, Speeduino, MegaSquirt, Emerald, et plus. Payez ce que vous voulez pour des mises à jour à vie.",
      "keywords": "Cartes ECU Classic Mini, réglage Mini Cooper, cartes Haltech, cartes Speeduino, cartes MegaSquirt, ECU Emerald, réglage moteur, cartes carburant, cartes allumage",
      "ogTitle": "Cartes ECU Classic Mini | Fichiers de réglage pour plusieurs ECUs",
      "twitterTitle": "Cartes ECU Classic Mini | Support d'ECUs multiples",
      "twitterDescription": "Cartes ECU professionnelles pour moteurs Classic Mini avec mises à jour à vie."
    },
    "breadcrumb": "Cartes ECU",
    "hero": {
      "title": "Cartes ECU Classic Mini DIY",
      "subtitle": "Payez ce que vous voulez, toujours"
    },
    "mainTitle": "La carte ECU Classic Mini",
    "description": "Après des années de réglage de moteurs Classic Mini, construction de faisceaux personnalisés et cartographie de multiples ECUs, je suis fier de publier ma collection de cartes ECU avec deux options d'accès. Offrant un support pour de nombreux ECUs populaires utilisés sur les Classic Minis, avec plus ajoutés à l'avenir.",
    "features": {
      "lifetimeUpdates": "Mises à jour à vie",
      "multipleEcus": "ECUs multiples",
      "constantlyUpdated": "Constamment mis à jour",
      "payWhatYouWant": "Payez ce que vous voulez"
    },
    "options": {
      "latestRelease": "Dernière version",
      "purchase": {
        "title": "Option 1 - Achat",
        "description": "Achetez les cartes ECU directement depuis la boutique Classic Mini DIY. Cette option est parfaite pour ceux qui veulent soutenir la chaîne et obtenir les cartes sans avoir à utiliser Github. Cette option vient aussi avec un support prioritaire par e-mail.",
        "button": "Télécharger"
      },
      "download": {
        "title": "Option 2 - Télécharger",
        "description": "Téléchargez les cartes ECU directement depuis Github. Cette option est parfaite pour ceux qui veulent obtenir les cartes gratuitement. Cette option vient aussi avec la capacité de contribuer au projet en soumettant des pull requests.",
        "button": "Télécharger",
        "viewSource": "Voir la source"
      }
    },
    "moreDetails": "Plus de détails",
    "table": {
      "features": "Fonctionnalités",
      "ignitionMap": "Carte d'allumage",
      "fuelMap": "Carte carburant",
      "veTable": "Table VE",
      "targetAfr": "AFR cible",
      "throttleEnrichment": "Enrichissement papillon",
      "driveByWire": "Prêt drive by wire",
      "boostControl": "Carte contrôle boost",
      "idleMap": "Carte ralenti",
      "sixteenVEngine": "Version moteur 16V"
    },
    "legend": {
      "included": {
        "name": "Inclus",
        "description": "Inclus dans la carte"
      },
      "notIncluded": {
        "name": "Non inclus",
        "description": "Supporté mais non inclus"
      },
      "notAvailable": {
        "name": "Non disponible",
        "description": "Fonctionnalité non supportée par l'ECU"
      },
      "workInProgress": {
        "name": "Travail en cours",
        "description": "Actuellement encore en cours d'être porté vers cet ECU"
      }
    },
    "updates": {
      "title": "Dernières mises à jour",
      "error": "Erreur de chargement de l'historique des mises à jour depuis Github",
      "noUpdates": "Aucune mise à jour disponible",
      "viewAllCommits": "Voir tous les commits"
    },
    "supportedEcus": {
      "title": "ECUs supportés",
      "subtitle": "Support pour l'ECU dont vous avez besoin"
    },
    "otherSupport": "Autres moyens de soutenir"
  },
  "de": {
    "seo": {
      "title": "Classic Mini ECU Karten | Tuning-Dateien für mehrere ECUs | Classic Mini DIY",
      "description": "Laden Sie professionell abgestimmte ECU-Karten für Classic Mini-Motoren herunter. Kompatibel mit Haltech, Speeduino, MegaSquirt, Emerald und mehr. Zahlen Sie was Sie wollen für lebenslange Updates.",
      "keywords": "Classic Mini ECU Karten, Mini Cooper Tuning, Haltech Karten, Speeduino Karten, MegaSquirt Karten, Emerald ECU, Motor Tuning, Kraftstoffkarten, Zündkarten",
      "ogTitle": "Classic Mini ECU Karten | Tuning-Dateien für mehrere ECUs",
      "twitterTitle": "Classic Mini ECU Karten | Mehrere ECU-Unterstützung",
      "twitterDescription": "Professionelle ECU-Karten für Classic Mini-Motoren mit lebenslangen Updates."
    },
    "breadcrumb": "ECU Karten",
    "hero": {
      "title": "Classic Mini DIY ECU Karten",
      "subtitle": "Zahlen Sie was Sie wollen, immer"
    },
    "mainTitle": "Die Classic Mini ECU Karte",
    "description": "Nach Jahren des Tunings von Classic Mini-Motoren, dem Bau von benutzerdefinierten Kabelbäumen und der Programmierung mehrerer ECUs bin ich stolz darauf, meine Sammlung von ECU-Karten mit zwei Zugangsmöglichkeiten zu veröffentlichen. Bietet Unterstützung für viele beliebte ECUs, die bei Classic Minis verwendet werden, mit mehr in der Zukunft.",
    "features": {
      "lifetimeUpdates": "Lebenslange Updates",
      "multipleEcus": "Mehrere ECUs",
      "constantlyUpdated": "Ständig aktualisiert",
      "payWhatYouWant": "Zahlen Sie was Sie wollen"
    },
    "options": {
      "latestRelease": "Neueste Veröffentlichung",
      "purchase": {
        "title": "Option 1 - Kaufen",
        "description": "Kaufen Sie die ECU-Karten direkt im Classic Mini DIY Store. Diese Option ist perfekt für diejenigen, die den Kanal unterstützen und die Karten ohne GitHub erhalten möchten. Diese Option bietet auch Prioritäts-Support per E-Mail.",
        "button": "Herunterladen"
      },
      "download": {
        "title": "Option 2 - Herunterladen",
        "description": "Laden Sie die ECU-Karten direkt von Github herunter. Diese Option ist perfekt für diejenigen, die die Karten kostenlos erhalten möchten. Diese Option bietet auch die Möglichkeit, zum Projekt beizutragen, indem Sie Pull Requests einreichen.",
        "button": "Herunterladen",
        "viewSource": "Quelle anzeigen"
      }
    },
    "moreDetails": "Weitere Details",
    "table": {
      "features": "Funktionen",
      "ignitionMap": "Zündkarte",
      "fuelMap": "Kraftstoffkarte",
      "veTable": "VE-Tabelle",
      "targetAfr": "Ziel-AFR",
      "throttleEnrichment": "Drosselklappenanreicherung",
      "driveByWire": "Drive-by-Wire bereit",
      "boostControl": "Ladedruckkarte",
      "idleMap": "Leerlaufkarte",
      "sixteenVEngine": "16V Motor Version"
    },
    "legend": {
      "included": {
        "name": "Enthalten",
        "description": "In Karte enthalten"
      },
      "notIncluded": {
        "name": "Nicht enthalten",
        "description": "Unterstützt aber nicht enthalten"
      },
      "notAvailable": {
        "name": "Nicht verfügbar",
        "description": "Funktion wird von ECU nicht unterstützt"
      },
      "workInProgress": {
        "name": "In Arbeit",
        "description": "Wird derzeit noch portiert auf diese ECU"
      }
    },
    "updates": {
      "title": "Neueste Updates",
      "error": "Fehler beim Laden der Update-Historie von Github",
      "noUpdates": "Keine Updates verfügbar",
      "viewAllCommits": "Alle Commits anzeigen"
    },
    "supportedEcus": {
      "title": "Unterstützte ECUs",
      "subtitle": "Unterstützung für die ECU, die Sie brauchen"
    },
    "otherSupport": "Andere Wege zu unterstützen"
  },
  "it": {
    "seo": {
      "title": "Mappe ECU Classic Mini | File di mappatura per più ECU | Classic Mini DIY",
      "description": "Scarica mappe ECU professionalmente mappate per motori Classic Mini. Compatibili con Haltech, Speeduino, MegaSquirt, Emerald e altri. Paga quello che vuoi per aggiornamenti a vita.",
      "keywords": "Mappe ECU Classic Mini, mappatura Mini Cooper, mappe Haltech, mappe Speeduino, mappe MegaSquirt, ECU Emerald, mappatura motore, mappe carburante, mappe accensione",
      "ogTitle": "Mappe ECU Classic Mini | File di mappatura per più ECU",
      "twitterTitle": "Mappe ECU Classic Mini | Supporto per più ECU",
      "twitterDescription": "Mappe ECU professionali per motori Classic Mini con aggiornamenti a vita."
    },
    "breadcrumb": "Mappe ECU",
    "hero": {
      "title": "Mappe ECU Classic Mini DIY",
      "subtitle": "Paga quello che vuoi, sempre"
    },
    "mainTitle": "La mappa ECU Classic Mini",
    "description": "Dopo anni di mappatura di motori Classic Mini, costruzione di cablaggi personalizzati e mappatura di più ECU, sono orgoglioso di rilasciare la mia collezione di mappe ECU con due opzioni di accesso. Offrendo supporto per molte ECU popolari utilizzate sulle Classic Mini, con altre aggiunte in futuro.",
    "features": {
      "lifetimeUpdates": "Aggiornamenti a vita",
      "multipleEcus": "Più ECU",
      "constantlyUpdated": "Costantemente aggiornato",
      "payWhatYouWant": "Paga quello che vuoi"
    },
    "options": {
      "latestRelease": "Ultima versione",
      "purchase": {
        "title": "Opzione 1 - Acquisto",
        "description": "Acquista le mappe ECU direttamente dal negozio Classic Mini DIY. Questa opzione è perfetta per coloro che vogliono supportare il canale e ottenere le mappe senza dover usare GitHub. Questa opzione viene anche con supporto prioritario via email.",
        "button": "Scarica"
      },
      "download": {
        "title": "Opzione 2 - Download",
        "description": "Scarica le mappe ECU direttamente da GitHub. Questa opzione è perfetta per coloro che vogliono ottenere le mappe gratuitamente. Questa opzione viene anche con la possibilità di contribuire al progetto inviando pull request.",
        "button": "Scarica",
        "viewSource": "Visualizza sorgente"
      }
    },
    "moreDetails": "Più dettagli",
    "table": {
      "features": "Funzionalità",
      "ignitionMap": "Mappa accensione",
      "fuelMap": "Mappa carburante",
      "veTable": "Tabella VE",
      "targetAfr": "AFR target",
      "throttleEnrichment": "Arricchimento acceleratore",
      "driveByWire": "Pronto drive by wire",
      "boostControl": "Mappa controllo pressione",
      "idleMap": "Mappa minimo",
      "sixteenVEngine": "Versione motore 16V"
    },
    "legend": {
      "included": {
        "name": "Incluso",
        "description": "Incluso nella mappa"
      },
      "notIncluded": {
        "name": "Non incluso",
        "description": "Supportato ma non incluso"
      },
      "notAvailable": {
        "name": "Non disponibile",
        "description": "Funzionalità non supportata dall'ECU"
      },
      "workInProgress": {
        "name": "Lavori in corso",
        "description": "Attualmente ancora in corso di porting su questa ECU"
      }
    },
    "updates": {
      "title": "Ultimi aggiornamenti",
      "error": "Errore nel caricamento della cronologia aggiornamenti da GitHub",
      "noUpdates": "Nessun aggiornamento disponibile",
      "viewAllCommits": "Visualizza tutti i commit"
    },
    "supportedEcus": {
      "title": "ECU supportate",
      "subtitle": "Supporto per l'ECU di cui hai bisogno"
    },
    "otherSupport": "Altri modi per supportare"
  },
  "ja": {
    "seo": {
      "title": "Classic Mini ECUマップ | 複数ECU用チューニングファイル | Classic Mini DIY",
      "description": "Classic MiniエンジンのプロフェッショナルにチューンされたECUマップをダウンロード。Haltech、Speeduino、MegaSquirt、Emeraldなどと互換性。生涯アップデートに支払いたい分だけ。",
      "keywords": "Classic Mini ECUマップ、Mini Cooperチューニング、Haltechマップ、Speeduinoマップ、MegaSquirtマップ、Emerald ECU、エンジンチューニング、燃料マップ、点火マップ",
      "ogTitle": "Classic Mini ECUマップ | 複数ECU用チューニングファイル",
      "twitterTitle": "Classic Mini ECUマップ | 複数ECUサポート",
      "twitterDescription": "生涯アップデート付きClassic MiniエンジンのプロフェッショナルECUマップ。"
    },
    "breadcrumb": "ECUマップ",
    "hero": {
      "title": "Classic Mini DIY ECUマップ",
      "subtitle": "支払いたい分だけ、いつでも"
    },
    "mainTitle": "Classic Mini ECUマップ",
    "description": "数年間Classic Miniエンジンをチューニング、カスタムハーネスを構築、複数のECUをマッピングした後、2つのアクセスオプションでECUマップのコレクションをリリースできることを誇りに思います。Classic Miniで使用される多くの人気ECUをサポートし、将来さらに追加予定です。",
    "features": {
      "lifetimeUpdates": "生涯アップデート",
      "multipleEcus": "複数のECU",
      "constantlyUpdated": "常時更新",
      "payWhatYouWant": "支払いたい分だけ"
    },
    "options": {
      "latestRelease": "最新リリース",
      "purchase": {
        "title": "オプション1 - 購入",
        "description": "Classic Mini DIYストアからECUマップを直接購入。このオプションは、チャンネルをサポートし、Githubを使用せずにマップを取得したい人に最適です。このオプションには、メール経由での優先サポートも含まれています。",
        "button": "ダウンロード"
      },
      "download": {
        "title": "オプション2 - ダウンロード",
        "description": "GithubからECUマップを直接ダウンロード。このオプションは、マップを無料で取得したい人に最適です。このオプションには、プルリクエストを送信してプロジェクトに貢献する機能も含まれています。",
        "button": "ダウンロード",
        "viewSource": "ソースを見る"
      }
    },
    "moreDetails": "詳細",
    "table": {
      "features": "機能",
      "ignitionMap": "点火マップ",
      "fuelMap": "燃料マップ",
      "veTable": "VEテーブル",
      "targetAfr": "目標AFR",
      "throttleEnrichment": "スロットルエンリッチメント",
      "driveByWire": "ドライブバイワイヤ対応",
      "boostControl": "ブーストコントロールマップ",
      "idleMap": "アイドルマップ",
      "sixteenVEngine": "16Vエンジンバージョン"
    },
    "legend": {
      "included": {
        "name": "含まれる",
        "description": "マップに含まれる"
      },
      "notIncluded": {
        "name": "含まれない",
        "description": "サポートされているが含まれない"
      },
      "notAvailable": {
        "name": "利用不可",
        "description": "ECUでサポートされていない機能"
      },
      "workInProgress": {
        "name": "作業中",
        "description": "現在このECUに移植中"
      }
    },
    "updates": {
      "title": "最新アップデート",
      "error": "Githubからアップデート履歴の読み込みエラー",
      "noUpdates": "アップデートはありません",
      "viewAllCommits": "すべてのコミットを見る"
    },
    "supportedEcus": {
      "title": "サポートされているECU",
      "subtitle": "必要なecuをサポート"
    },
    "otherSupport": "サポートする他の方法"
  },
  "ko": {
    "seo": {
      "title": "Classic Mini ECU 맵 | 다중 ECU용 튜닝 파일 | Classic Mini DIY",
      "description": "Classic Mini 엔진용 전문적으로 튜닝된 ECU 맵을 다운로드하세요. Haltech, Speeduino, MegaSquirt, Emerald 등과 호환됩니다. 평생 업데이트를 원하는 만큼 지불하세요.",
      "keywords": "Classic Mini ECU 맵, Mini Cooper 튜닝, Haltech 맵, Speeduino 맵, MegaSquirt 맵, Emerald ECU, 엔진 튜닝, 연료 맵, 점화 맵",
      "ogTitle": "Classic Mini ECU 맵 | 다중 ECU용 튜닝 파일",
      "twitterTitle": "Classic Mini ECU 맵 | 다중 ECU 지원",
      "twitterDescription": "평생 업데이트가 포함된 Classic Mini 엔진용 전문 ECU 맵."
    },
    "breadcrumb": "ECU 맵",
    "hero": {
      "title": "Classic Mini DIY ECU 맵",
      "subtitle": "원하는 만큼 지불하세요, 항상"
    },
    "mainTitle": "Classic Mini ECU 맵",
    "description": "수년간 Classic Mini 엔진을 튜닝하고, 맞춤 하네스를 제작하며, 여러 ECU를 매핑한 후, 저는 두 가지 액세스 옵션으로 ECU 맵 컬렉션을 자랑스럽게 출시합니다. Classic Mini에서 사용되는 많은 인기 ECU를 지원하며, 앞으로 더 많이 추가될 예정입니다.",
    "features": {
      "lifetimeUpdates": "평생 업데이트",
      "multipleEcus": "다중 ECU",
      "constantlyUpdated": "지속적 업데이트",
      "payWhatYouWant": "원하는 만큼 지불"
    },
    "options": {
      "latestRelease": "최신 릴리스",
      "purchase": {
        "title": "옵션 1 - 구매",
        "description": "Classic Mini DIY 스토어에서 ECU 맵을 직접 구매하세요. 이 옵션은 채널을 지원하고 GitHub를 사용하지 않고도 맵을 얻고 싶은 분들에게 완벽합니다. 이 옵션에는 이메일을 통한 우선 지원도 포함됩니다.",
        "button": "다운로드"
      },
      "download": {
        "title": "옵션 2 - 다운로드",
        "description": "GitHub에서 ECU 맵을 직접 다운로드하세요. 이 옵션은 맵을 무료로 받고 싶은 분들에게 완벽합니다. 이 옵션에는 풀 리퀘스트를 제출하여 프로젝트에 기여할 수 있는 능력도 포함됩니다.",
        "button": "다운로드",
        "viewSource": "소스 보기"
      }
    },
    "moreDetails": "자세한 정보",
    "table": {
      "features": "기능",
      "ignitionMap": "점화 맵",
      "fuelMap": "연료 맵",
      "veTable": "VE 테이블",
      "targetAfr": "목표 AFR",
      "throttleEnrichment": "스로틀 농후화",
      "driveByWire": "드라이브 바이 와이어 준비",
      "boostControl": "부스트 컨트롤 맵",
      "idleMap": "공회전 맵",
      "sixteenVEngine": "16V 엔진 버전"
    },
    "legend": {
      "included": {
        "name": "포함됨",
        "description": "맵에 포함됨"
      },
      "notIncluded": {
        "name": "포함되지 않음",
        "description": "지원되지만 포함되지 않음"
      },
      "notAvailable": {
        "name": "사용 불가",
        "description": "ECU에서 지원되지 않는 기능"
      },
      "workInProgress": {
        "name": "작업 진행 중",
        "description": "현재 이 ECU로 포팅 중"
      }
    },
    "updates": {
      "title": "최신 업데이트",
      "error": "GitHub에서 업데이트 기록을 로드하는 중 오류",
      "noUpdates": "사용 가능한 업데이트 없음",
      "viewAllCommits": "모든 커밋 보기"
    },
    "supportedEcus": {
      "title": "지원되는 ECU",
      "subtitle": "필요한 ECU 지원"
    },
    "otherSupport": "다른 지원 방법"
  },
  "pt": {
    "seo": {
      "title": "Mapas ECU Classic Mini | Arquivos de Sintonia para Múltiplas ECUs | Classic Mini DIY",
      "description": "Baixe mapas ECU profissionalmente sintonizados para motores Classic Mini. Compatível com Haltech, Speeduino, MegaSquirt, Emerald e mais. Pague o que quiser por atualizações vitalícias.",
      "keywords": "Mapas ECU Classic Mini, sintonia Mini Cooper, mapas Haltech, mapas Speeduino, mapas MegaSquirt, ECU Emerald, sintonia de motor, mapas de combustível, mapas de ignição",
      "ogTitle": "Mapas ECU Classic Mini | Arquivos de Sintonia para Múltiplas ECUs",
      "twitterTitle": "Mapas ECU Classic Mini | Suporte a Múltiplas ECUs",
      "twitterDescription": "Mapas ECU profissionais para motores Classic Mini com atualizações vitalícias."
    },
    "breadcrumb": "Mapas ECU",
    "hero": {
      "title": "Mapas ECU Classic Mini DIY",
      "subtitle": "Pague o que quiser, sempre"
    },
    "mainTitle": "O Mapa ECU Classic Mini",
    "description": "Após anos sintonizando motores Classic Mini, construindo chicotes personalizados e mapeando múltiplas ECUs, tenho o orgulho de lançar minha coleção de mapas ECU com duas opções de acesso. Oferecendo suporte para muitas ECUs populares usadas em Classic Minis, com mais a serem adicionadas no futuro.",
    "features": {
      "lifetimeUpdates": "Atualizações Vitalícias",
      "multipleEcus": "Múltiplas ECUs",
      "constantlyUpdated": "Constantemente Atualizado",
      "payWhatYouWant": "Pague o que quiser"
    },
    "options": {
      "latestRelease": "Último Lançamento",
      "purchase": {
        "title": "Opção 1 - Comprar",
        "description": "Compre os mapas ECU diretamente da loja Classic Mini DIY. Esta opção é perfeita para quem quer apoiar o canal e obter os mapas sem ter que usar o Github. Esta opção também vem com suporte prioritário via email.",
        "button": "Baixar"
      },
      "download": {
        "title": "Opção 2 - Baixar",
        "description": "Baixe os mapas ECU diretamente do Github. Esta opção é perfeita para quem quer obter os mapas gratuitamente. Esta opção também vem com a capacidade de contribuir para o projeto enviando pull requests.",
        "button": "Baixar",
        "viewSource": "Ver Código Fonte"
      }
    },
    "moreDetails": "Mais Detalhes",
    "table": {
      "features": "Recursos",
      "ignitionMap": "Mapa de Ignição",
      "fuelMap": "Mapa de Combustível",
      "veTable": "Tabela VE",
      "targetAfr": "AFR Alvo",
      "throttleEnrichment": "Enriquecimento do Acelerador",
      "driveByWire": "Pronto para Drive by Wire",
      "boostControl": "Mapa de Controle de Boost",
      "idleMap": "Mapa de Marcha Lenta",
      "sixteenVEngine": "Versão Motor 16V"
    },
    "legend": {
      "included": {
        "name": "Incluído",
        "description": "Incluído no Mapa"
      },
      "notIncluded": {
        "name": "Não incluído",
        "description": "Suportado mas não incluído"
      },
      "notAvailable": {
        "name": "Não Disponível",
        "description": "Recurso não suportado pela ECU"
      },
      "workInProgress": {
        "name": "Trabalho em andamento",
        "description": "Atualmente ainda em progresso sendo portado para esta ECU"
      }
    },
    "updates": {
      "title": "Últimas Atualizações",
      "error": "Erro ao carregar histórico de atualizações do Github",
      "noUpdates": "Nenhuma atualização disponível",
      "viewAllCommits": "Ver Todos os Commits"
    },
    "supportedEcus": {
      "title": "ECUs Suportadas",
      "subtitle": "Suporte para a ECU que você precisa"
    },
    "otherSupport": "Outras maneiras de apoiar"
  },
  "ru": {
    "seo": {
      "title": "Карты ECU Classic Mini | Файлы настройки для множества ECU | Classic Mini DIY",
      "description": "Скачайте профессионально настроенные карты ECU для двигателей Classic Mini. Совместимо с Haltech, Speeduino, MegaSquirt, Emerald и другими. Платите сколько хотите за пожизненные обновления.",
      "keywords": "Карты ECU Classic Mini, настройка Mini Cooper, карты Haltech, карты Speeduino, карты MegaSquirt, ECU Emerald, настройка двигателя, карты топлива, карты зажигания",
      "ogTitle": "Карты ECU Classic Mini | Файлы настройки для множества ECU",
      "twitterTitle": "Карты ECU Classic Mini | Поддержка множества ECU",
      "twitterDescription": "Профессиональные карты ECU для двигателей Classic Mini с пожизненными обновлениями."
    },
    "breadcrumb": "Карты ECU",
    "hero": {
      "title": "Карты ECU Classic Mini DIY",
      "subtitle": "Платите сколько хотите, всегда"
    },
    "mainTitle": "Карта ECU Classic Mini",
    "description": "После лет настройки двигателей Classic Mini, создания пользовательских жгутов проводов и настройки множества ECU, я горжусь тем, что представляю свою коллекцию карт ECU с двумя вариантами доступа. Предлагая поддержку многих популярных ECU, используемых на Classic Mini, с добавлением большего количества в будущем.",
    "features": {
      "lifetimeUpdates": "Пожизненные обновления",
      "multipleEcus": "Множество ECU",
      "constantlyUpdated": "Постоянно обновляется",
      "payWhatYouWant": "Платите сколько хотите"
    },
    "options": {
      "latestRelease": "Последний релиз",
      "purchase": {
        "title": "Вариант 1 - Покупка",
        "description": "Покупка карт ECU непосредственно в магазине Classic Mini DIY. Этот вариант идеален для тех, кто хочет поддержать канал и получить карты без использования Github. Этот вариант также включает приоритетную поддержку по электронной почте.",
        "button": "Скачать"
      },
      "download": {
        "title": "Вариант 2 - Скачать",
        "description": "Скачайте карты ECU напрямую с Github. Этот вариант идеален для тех, кто хочет получить карты бесплатно. Этот вариант также включает возможность внести вклад в проект, отправляя pull requests.",
        "button": "Скачать",
        "viewSource": "Посмотреть исходный код"
      }
    },
    "moreDetails": "Больше деталей",
    "table": {
      "features": "Функции",
      "ignitionMap": "Карта зажигания",
      "fuelMap": "Карта топлива",
      "veTable": "Таблица VE",
      "targetAfr": "Целевое AFR",
      "throttleEnrichment": "Обогащение дросселя",
      "driveByWire": "Готовность Drive by Wire",
      "boostControl": "Карта контроля наддува",
      "idleMap": "Карта холостого хода",
      "sixteenVEngine": "Версия 16V двигателя"
    },
    "legend": {
      "included": {
        "name": "Включено",
        "description": "Включено в карту"
      },
      "notIncluded": {
        "name": "Не включено",
        "description": "Поддерживается, но не включено"
      },
      "notAvailable": {
        "name": "Недоступно",
        "description": "Функция не поддерживается ECU"
      },
      "workInProgress": {
        "name": "В работе",
        "description": "В настоящее время еще в процессе переноса на этот ECU"
      }
    },
    "updates": {
      "title": "Последние обновления",
      "error": "Ошибка загрузки истории обновлений с Github",
      "noUpdates": "Нет доступных обновлений",
      "viewAllCommits": "Посмотреть все коммиты"
    },
    "supportedEcus": {
      "title": "Поддерживаемые ECU",
      "subtitle": "Поддержка для нужного вам ECU"
    },
    "otherSupport": "Другие способы поддержки"
  },
  "zh": {
    "seo": {
      "title": "Classic Mini ECU地图 | 多种ECU的调校文件 | Classic Mini DIY",
      "description": "下载专业调校的Classic Mini发动机ECU地图。兼容Haltech、Speeduino、MegaSquirt、Emerald等。按您的意愿付费，享受终身更新。",
      "keywords": "Classic Mini ECU地图, Mini Cooper调校, Haltech地图, Speeduino地图, MegaSquirt地图, Emerald ECU, 发动机调校, 燃油地图, 点火地图",
      "ogTitle": "Classic Mini ECU地图 | 多种ECU的调校文件",
      "twitterTitle": "Classic Mini ECU地图 | 多ECU支持",
      "twitterDescription": "Classic Mini发动机的专业ECU地图，享受终身更新。"
    },
    "breadcrumb": "ECU地图",
    "hero": {
      "title": "Classic Mini DIY ECU地图",
      "subtitle": "按您的意愿付费，始终如此"
    },
    "mainTitle": "Classic Mini ECU地图",
    "description": "经过多年调校Classic Mini发动机、构建定制线束和映射多种ECU，我自豪地发布我的ECU地图集合，提供两种访问选项。支持Classic Mini上使用的许多流行ECU，未来还会增加更多。",
    "features": {
      "lifetimeUpdates": "终身更新",
      "multipleEcus": "多种ECU",
      "constantlyUpdated": "持续更新",
      "payWhatYouWant": "按您的意愿付费"
    },
    "options": {
      "latestRelease": "最新发布",
      "purchase": {
        "title": "选项1 - 购买",
        "description": "直接从Classic Mini DIY商店购买ECU地图。此选项适合那些想要支持频道并获取地图而无需使用Github的人。此选项还包含通过电子邮件的优先支持。",
        "button": "下载"
      },
      "download": {
        "title": "选项2 - 下载",
        "description": "直接从Github下载ECU地图。此选项适合那些想要免费获取地图的人。此选项还包含通过提交拉取请求为项目做贡献的能力。",
        "button": "下载",
        "viewSource": "查看源码"
      }
    },
    "moreDetails": "更多详情",
    "table": {
      "features": "功能",
      "ignitionMap": "点火地图",
      "fuelMap": "燃油地图",
      "veTable": "VE表",
      "targetAfr": "目标AFR",
      "throttleEnrichment": "节气门加浓",
      "driveByWire": "电子油门就绪",
      "boostControl": "增压控制地图",
      "idleMap": "怠速地图",
      "sixteenVEngine": "16V发动机版本"
    },
    "legend": {
      "included": {
        "name": "包含",
        "description": "包含在地图中"
      },
      "notIncluded": {
        "name": "不包含",
        "description": "支持但不包含"
      },
      "notAvailable": {
        "name": "不可用",
        "description": "ECU不支持的功能"
      },
      "workInProgress": {
        "name": "进行中",
        "description": "目前仍在移植到此ECU的过程中"
      }
    },
    "updates": {
      "title": "最新更新",
      "error": "从Github加载更新历史时出错",
      "noUpdates": "没有可用更新",
      "viewAllCommits": "查看所有提交"
    },
    "supportedEcus": {
      "title": "支持的ECU",
      "subtitle": "为您需要的ECU提供支持"
    },
    "otherSupport": "其他支持方式"
  }
}
</i18n>

<style lang="scss">
  .date {
    min-width: 15%;
    font-weight: bold;
  }

  .fa-code-commit {
    color: #ff9a00;
  }
  .fa-microchip {
    color: #277dc2;
  }
  .fa-arrows-rotate {
    color: #e55f33;
  }
  .fa-money-bill {
    color: #99a078;
  }

  .image img {
    // @media screen and (max-width: 768px) {
    margin: auto;
    width: 50%;
    // }
  }
</style>
