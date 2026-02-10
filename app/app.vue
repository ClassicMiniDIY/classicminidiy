<script lang="ts" setup>
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
  <UApp>
    <div class="app-wrapper bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-100">
      <div class="app-content">
        <MainNav></MainNav>
        <UToaster />
        <NuxtLoadingIndicator />
        <main class="bg-white dark:bg-[#171717]">
          <NuxtPage />
        </main>
      </div>
      <Footer></Footer>
      <VitePwaManifest />
      <AppPromoPopup />
    </div>
  </UApp>
</template>

<style lang="scss">
  .bg-color-section {
    background-color: #f0f0f0;
  }

  :global(.dark) .bg-color-section {
    background-color: #171717;
  }

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
