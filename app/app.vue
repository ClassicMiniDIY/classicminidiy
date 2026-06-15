<script lang="ts" setup>
  const route = useRoute();
  const isHomepage = ref(route.path === '/');
  watch(
    () => route.path,
    () => {
      isHomepage.value = route.path === '/';
    }
  );

  // Initialize Supabase auth state on app mount
  const { initAuth } = useAuth();
  // Initialize color mode on client
  useColorMode();

  // Dedup title template. nuxt-seo-utils (automaticDefaults) sets a low-priority
  // `%s %separator %siteName` template, which doubled the brand on titles that
  // already contain it (homepage, model listings, contact). This normal-priority
  // override wins over its `tagPriority: 'low'` and appends the brand only when it
  // isn't already present. (Must live here, not nuxt.config app.head — functions
  // there don't serialize.)
  useHead({
    titleTemplate: (title?: string) => {
      const brand = 'Classic Mini DIY';
      if (!title || title === brand) return brand;
      return title.includes(brand) ? title : `${title} | ${brand}`;
    },
  });

  // Site-wide schema.org base graph (nuxt-schema-org). This replaces the old
  // hand-rolled WebSite + Organization JSON-LD that lived in nuxt.config head.
  // The module auto-creates @id-linked WebSite + per-route WebPage from site
  // config and wires this Organization as their publisher/identity.
  //
  // The founder Person (#founder) is the E-E-A-T authority entity: it's the
  // Organization's `founder`, the author of the technical articles (referenced by
  // @id), and its canonical home is /about. Given an explicit @id it stays a
  // regular node — the Organization remains the site identity (#identity).
  useSchemaOrg([
    defineOrganization({
      name: 'Classic Mini DIY',
      logo: 'https://classicminidiy.s3.us-east-1.amazonaws.com/misc/seo-images/avatar.jpg',
      sameAs: [
        'https://www.youtube.com/c/ClassicMiniDIY',
        'https://www.facebook.com/classicminidiy',
        'https://www.instagram.com/classicminidiy/',
      ],
      founder: { '@id': 'https://classicminidiy.com/#founder' },
    }),
    definePerson({
      '@id': 'https://classicminidiy.com/#founder',
      name: 'Cole Gentry',
      url: 'https://classicminidiy.com/about',
      image: 'https://classicminidiy.s3.us-east-1.amazonaws.com/misc/seo-images/avatar.jpg',
      jobTitle: 'Founder',
      sameAs: ['https://www.youtube.com/c/ClassicMiniDIY'],
      knowsAbout: [
        'Classic Mini',
        'Mini Cooper restoration',
        'A-series engine',
        'SU carburettors',
        'classic car maintenance',
        'engine tuning',
      ],
    }),
  ]);

  onMounted(() => {
    initAuth();
  });
</script>

<template>
  <div class="app-wrapper bg-base-100 text-base-content">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-content focus:rounded-md focus:shadow-lg"
    >
      Skip to main content
    </a>
    <div class="app-content">
      <MainNav></MainNav>
      <Toaster />
      <NuxtLoadingIndicator />
      <main id="main-content" class="bg-base-100">
        <NuxtPage />
      </main>
    </div>
    <Footer></Footer>
    <VitePwaManifest />
  </div>
</template>

<style lang="scss">
  html,
  body {
    height: 100%;
    margin: 0;
  }

  #__nuxt {
    height: 100%;
  }

  .app-wrapper {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }

  .app-content {
    flex: 1 0 auto;
  }

  footer {
    flex-shrink: 0;
  }
</style>
