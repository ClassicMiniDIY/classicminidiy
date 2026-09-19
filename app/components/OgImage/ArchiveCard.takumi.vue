<script setup lang="ts">
  /**
   * Branded social card for one part number or one factory plate (rendered by
   * nuxt-og-image / takumi at 1200x600). The archive hub pages use illustrated
   * cards on S3 like every other hub. Sibling of ModelCard: same gradient,
   * accent and column layout, so the site has one card family.
   *
   * Text only on purpose. The plate scans live in a PRIVATE bucket behind the
   * licence kill switch, and Discord/Facebook/Slack cache OG PNGs indefinitely,
   * which would turn a takedown into "we stopped linking it". `image` is for a
   * self-owned illustration served from this origin (`/og/...`), never a plate.
   *
   * takumi/satori notes: every element with >1 child must be display:flex; only a
   * CSS subset is supported, so styles are inline and conservative. <img> needs an
   * explicit width+height. Brand colours mirror the daisyUI theme (primary
   * #859369 green, secondary #ed7135 orange).
   */
  withDefaults(
    defineProps<{
      eyebrow?: string;
      title?: string;
      subtitle?: string;
      /** Short labels rendered as pills under the title: system, category, section. */
      badges?: string[];
      /** Loud line above the title, e.g. a supersession. Orange, so it reads as a warning. */
      notice?: string;
      footerLeft?: string;
      footerRight?: string;
      /** Same-origin illustration for the right column. Omit for the full-width text card. */
      image?: string;
    }>(),
    {
      eyebrow: 'CLASSIC MINI DIY · PARTS ARCHIVE',
      title: 'Classic Mini Parts Archive',
      subtitle: '',
      badges: () => [],
      notice: '',
      footerLeft: '',
      footerRight: '',
      image: '',
    }
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
    <div style="display: flex; flex-direction: column; flex: 1; padding: 64px 70px">
      <div
        style="
          display: flex;
          align-items: center;
          color: #9aac7f;
          font-size: 26px;
          font-weight: 700;
          letter-spacing: 3px;
        "
      >
        {{ eyebrow }}
      </div>

      <div style="display: flex; flex: 1; flex-direction: column; justify-content: center">
        <div
          v-if="notice"
          style="display: flex; font-size: 26px; font-weight: 700; color: #ed7135; margin-bottom: 14px"
        >
          {{ notice }}
        </div>
        <div style="display: flex; font-size: 60px; font-weight: 800; line-height: 1.1; color: #ffffff">
          {{ title }}
        </div>
        <div v-if="subtitle" style="display: flex; font-size: 28px; color: #c8ccd4; margin-top: 20px; line-height: 1.3">
          {{ subtitle }}
        </div>
        <div v-if="badges.length" style="display: flex; flex-wrap: wrap; margin-top: 24px">
          <div
            v-for="badge in badges"
            :key="badge"
            style="
              display: flex;
              align-items: center;
              height: 44px;
              line-height: 1;
              font-size: 22px;
              font-weight: 700;
              color: #e6e8ec;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 999px;
              padding: 0 18px;
              margin-right: 12px;
              margin-bottom: 12px;
            "
          >
            {{ badge }}
          </div>
        </div>
      </div>

      <div style="display: flex; align-items: flex-end; justify-content: space-between">
        <div style="display: flex; font-size: 30px; font-weight: 800; color: #9aac7f">{{ footerLeft }}</div>
        <div v-if="footerRight" style="display: flex; font-size: 24px; color: #c8ccd4">{{ footerRight }}</div>
      </div>
    </div>

    <!-- illustration (when present) -->
    <div v-if="image" style="display: flex; width: 440px; height: 600px">
      <img :src="image" width="440" height="600" style="width: 440px; height: 600px; object-fit: cover" />
    </div>
  </div>
</template>
