<script setup lang="ts">
/**
 * Branded social card for 3D Model Library listings (rendered by nuxt-og-image /
 * satori at 1200x630). Shows the model photo on the right when present, otherwise
 * a full-width branded text card — so EVERY listing gets an on-brand share image.
 *
 * satori notes: every element with >1 child must be display:flex; only a CSS
 * subset is supported, so styles are inline and conservative. <img> needs an
 * explicit width+height. Brand colors mirror the daisyUI theme (primary #859369
 * green, secondary #ed7135 orange).
 */
withDefaults(
  defineProps<{
    title?: string;
    summary?: string;
    price?: string;
    author?: string;
    image?: string;
  }>(),
  { title: 'Classic Mini DIY 3D Model', summary: '', price: '', author: '', image: '' }
);
</script>

<template>
  <div
    style="
      display: flex;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #1a1c22 0%, #2a2e38 100%);
      color: #ffffff;
      font-family: 'Inter';
    "
  >
    <!-- text column -->
    <div style="display: flex; flex-direction: column; flex: 1; padding: 70px">
      <div
        style="display: flex; align-items: center; color: #9aac7f; font-size: 26px; font-weight: 700; letter-spacing: 3px"
      >
        CLASSIC MINI DIY · 3D MODEL LIBRARY
      </div>

      <div style="display: flex; flex: 1; flex-direction: column; justify-content: center">
        <div style="display: flex; font-size: 60px; font-weight: 800; line-height: 1.1; color: #ffffff">{{ title }}</div>
        <div v-if="summary" style="display: flex; font-size: 28px; color: #c8ccd4; margin-top: 22px; line-height: 1.3">
          {{ summary }}
        </div>
      </div>

      <div style="display: flex; align-items: flex-end; justify-content: space-between">
        <div style="display: flex; font-size: 48px; font-weight: 800; color: #9aac7f">{{ price }}</div>
        <div v-if="author" style="display: flex; font-size: 28px; color: #c8ccd4">by {{ author }}</div>
      </div>
    </div>

    <!-- model photo (when present) -->
    <div v-if="image" style="display: flex; width: 440px; height: 630px">
      <img :src="image" width="440" height="630" style="width: 440px; height: 630px; object-fit: cover" />
    </div>
  </div>
</template>
