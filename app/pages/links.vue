<script lang="ts" setup>
  const { t } = useI18n();
  const { capture } = usePostHog();

  type LinkItem = {
    id: string;
    label: string;
    sub?: string;
    href: string;
    icon: string;
    btnClass: string;
  };

  const primaryLinks = computed<LinkItem[]>(() => [
    {
      id: 'patreon',
      label: t('links.patreon.label'),
      sub: t('links.patreon.sub'),
      href: 'https://patreon.com/classicminidiy',
      icon: 'fab fa-patreon',
      btnClass: 'is-patreon',
    },
    {
      id: 'newsletter',
      label: t('links.newsletter.label'),
      sub: t('links.newsletter.sub'),
      href: 'https://classicminidiy.substack.com/',
      icon: 'fad fa-envelope-open-text',
      btnClass: 'btn-primary',
    },
    {
      id: 'store',
      label: t('links.store.label'),
      sub: t('links.store.sub'),
      href: 'https://store.classicminidiy.com/',
      icon: 'fad fa-store',
      btnClass: 'btn-secondary',
    },
  ]);

  const secondaryLinks = computed<LinkItem[]>(() => [
    {
      id: 'toolbox',
      label: t('links.toolbox.label'),
      href: '/technical',
      icon: 'fad fa-toolbox',
      btnClass: 'btn-neutral',
    },
    {
      id: 'maps',
      label: t('links.maps.label'),
      href: '/maps',
      icon: 'fad fa-map',
      btnClass: 'btn-neutral',
    },
    {
      id: 'contact',
      label: t('links.contact.label'),
      href: '/contact',
      icon: 'fad fa-envelope',
      btnClass: 'btn-neutral',
    },
  ]);

  const socialLinks = [
    {
      id: 'youtube',
      label: 'YouTube',
      href: 'https://www.youtube.com/c/ClassicMiniDIY',
      icon: 'fab fa-youtube',
      colorClass: 'text-red-600',
    },
    {
      id: 'instagram',
      label: 'Instagram',
      href: 'https://www.instagram.com/classicminidiy/',
      icon: 'fab fa-instagram',
      colorClass: 'text-pink-500',
    },
    {
      id: 'facebook',
      label: 'Facebook',
      href: 'https://www.facebook.com/classicminidiy',
      icon: 'fab fa-facebook',
      colorClass: 'text-blue-600',
    },
  ];

  function trackClick(link: { id: string; label: string; href: string }, group: string) {
    capture('links_page_click', {
      link_id: link.id,
      label: link.label,
      destination: link.href,
      group,
    });
  }

  const { data: videos, status, error } = await useFetch('/api/youtube/videos', {
    query: { limit: 50 },
    key: 'links-page-videos',
  });

  useHead({
    title: t('links.seo.title'),
    meta: [
      { name: 'description', content: t('links.seo.description') },
      { name: 'keywords', content: t('links.seo.keywords') },
    ],
    link: [
      { rel: 'canonical', href: 'https://classicminidiy.com/links' },
      { rel: 'preconnect', href: 'https://classicminidiy.s3.amazonaws.com' },
    ],
  });

  useSeoMeta({
    ogTitle: t('links.seo.title'),
    ogDescription: t('links.seo.description'),
    ogUrl: 'https://classicminidiy.com/links',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/root.jpg',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: t('links.seo.title'),
    twitterDescription: t('links.seo.description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/root.jpg',
  });

  const allLinks = computed(() => [...primaryLinks.value, ...secondaryLinks.value, ...socialLinks]);
  const linksJsonLd = computed(() => ({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t('links.seo.title'),
    url: 'https://classicminidiy.com/links',
    description: t('links.seo.description'),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: allLinks.value.map((link, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: link.label,
        url: link.href,
      })),
    },
  }));

  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(linksJsonLd.value),
      },
    ],
  });
</script>

<template>
  <div class="bg-base-200">
    <div class="container mx-auto px-4 py-10 md:py-16">
      <div class="max-w-md mx-auto">
        <div class="flex flex-col items-center text-center mb-8">
          <nuxt-img
            src="https://classicminidiy.s3.amazonaws.com/misc/seo-images/avatar.jpg"
            alt="Classic Mini DIY"
            width="120"
            height="120"
            loading="eager"
            class="rounded-full shadow-lg ring-4 ring-base-100 mb-4"
          />
          <h1 class="fancy-font-bold text-3xl md:text-4xl">{{ $t('links.heading') }}</h1>
          <p class="fancy-font-book-oblique text-base-content/70 mt-2">{{ $t('links.tagline') }}</p>
        </div>

        <div class="flex flex-col gap-3 mb-6">
          <a
            v-for="link in primaryLinks"
            :key="link.id"
            :href="link.href"
            target="_blank"
            rel="noopener"
            :class="['btn', 'btn-block', 'btn-lg', 'h-auto', 'min-h-16', 'py-3', 'justify-start', link.btnClass]"
            @click="trackClick(link, 'primary')"
          >
            <i :class="[link.icon, 'text-2xl', 'shrink-0', 'w-8']"></i>
            <span class="flex flex-col items-start text-left leading-tight grow">
              <span class="font-bold">{{ link.label }}</span>
              <span v-if="link.sub" class="text-xs font-normal opacity-80">{{ link.sub }}</span>
            </span>
            <i class="fas fa-arrow-right opacity-60 shrink-0"></i>
          </a>
        </div>

        <div class="flex flex-col gap-2 mb-8">
          <component
            :is="link.href.startsWith('/') ? 'NuxtLink' : 'a'"
            v-for="link in secondaryLinks"
            :key="link.id"
            :to="link.href.startsWith('/') ? link.href : undefined"
            :href="link.href.startsWith('/') ? undefined : link.href"
            :target="link.href.startsWith('/') ? undefined : '_blank'"
            :rel="link.href.startsWith('/') ? undefined : 'noopener'"
            :class="['btn', 'btn-block', 'btn-md', 'justify-start', 'btn-outline']"
            @click="trackClick(link, 'secondary')"
          >
            <i :class="[link.icon, 'text-lg', 'w-6']"></i>
            <span class="font-medium">{{ link.label }}</span>
          </component>
        </div>

        <div class="flex justify-center items-center gap-6 mb-2">
          <a
            v-for="link in socialLinks"
            :key="link.id"
            :href="link.href"
            target="_blank"
            rel="noopener"
            :aria-label="link.label"
            class="grow-icon"
            @click="trackClick(link, 'social')"
          >
            <i :class="[link.icon, 'text-3xl', link.colorClass]"></i>
          </a>
        </div>
      </div>
    </div>
  </div>

  <div class="container mx-auto px-4 py-12">
    <div class="max-w-5xl mx-auto">
      <div class="text-center mb-8">
        <p class="fancy-font-book-oblique"><i class="fab fa-youtube text-red-600"></i> {{ $t('links.videos.eyebrow') }}</p>
        <h2 class="text-3xl font-bold pt-2">{{ $t('links.videos.heading') }}</h2>
      </div>

      <div v-if="status === 'pending'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="i in 6" :key="i" class="card bg-base-200 animate-pulse h-80"></div>
      </div>

      <div v-else-if="error" class="alert alert-warning">
        <i class="fas fa-triangle-exclamation"></i>
        <span>{{ $t('links.videos.error') }}</span>
      </div>

      <div v-else-if="videos && videos.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <a
          v-for="video in videos"
          :key="video.videoUrl"
          :href="video.videoUrl"
          target="_blank"
          rel="noopener"
          class="card bg-base-100 shadow-md border border-base-300 overflow-hidden hover:shadow-lg transition-shadow"
          @click="capture('links_page_click', { link_id: 'video', group: 'video', destination: video.videoUrl, label: video.title })"
        >
          <figure class="relative">
            <nuxt-picture
              :src="video.thumbnails.maxres"
              :alt="video.title"
              class="w-full"
              loading="lazy"
              width="720"
              height="404"
            />
            <span class="absolute inset-0 flex items-center justify-center">
              <span class="rounded-full bg-black/60 text-white w-14 h-14 flex items-center justify-center">
                <i class="fas fa-play text-xl"></i>
              </span>
            </span>
          </figure>
          <div class="card-body p-4">
            <h3 class="card-title text-base font-semibold line-clamp-2">{{ video.title }}</h3>
            <p class="text-xs text-base-content/60">{{ $t('links.videos.published_on') }} {{ video.publishedOn }}</p>
          </div>
        </a>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .grow-icon {
    transition: transform 0.2s ease-in-out;
  }
  .grow-icon:hover {
    transform: scale(1.15);
  }
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>

<i18n lang="json">
{
  "en": {
    "links": {
      "heading": "Classic Mini DIY",
      "tagline": "Your friendly neighborhood Classic Mini resource",
      "patreon": {
        "label": "Support on Patreon",
        "sub": "Help keep the channel rolling"
      },
      "newsletter": {
        "label": "Subscribe to the Newsletter",
        "sub": "Build updates, deep dives, and project notes"
      },
      "store": {
        "label": "CMDIY Store",
        "sub": "Merch, tools, and Mini gear"
      },
      "toolbox": { "label": "Online Toolbox" },
      "maps": { "label": "ECU Maps" },
      "contact": { "label": "Email Cole" },
      "videos": {
        "eyebrow": "FROM THE CHANNEL",
        "heading": "Latest YouTube Videos",
        "published_on": "Published",
        "error": "Couldn't load videos right now — try the YouTube channel directly."
      },
      "seo": {
        "title": "Links | Classic Mini DIY",
        "description": "Every Classic Mini DIY link in one place — Patreon, newsletter, store, toolbox, ECU maps, social channels, and the latest YouTube videos.",
        "keywords": "classic mini diy, links, patreon, newsletter, store, youtube, classic mini cooper"
      }
    }
  }
}
</i18n>
