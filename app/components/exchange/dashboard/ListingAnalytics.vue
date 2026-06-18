<template>
  <!-- Stage 7 stub: full views/contacts analytics (chart.js) ported with the
       dashboard. ListingCard references this behind v-if="showAnalytics", which
       is false on browse, so it renders nothing until the dashboard slice lands. -->
  <div v-if="false" :data-listing-id="listingId"></div>
</template>

<script setup lang="ts">
  defineProps<{
    listingId: string;
  }>();
</script>
