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
