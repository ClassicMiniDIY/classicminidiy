<script setup lang="ts">
  import type { HardwareItem } from '~~/data/models/model-library';

  const props = defineProps<{ items: HardwareItem[] }>();
  const hasItems = computed(() => Array.isArray(props.items) && props.items.length > 0);
</script>

<template>
  <div v-if="hasItems" class="card bg-base-100 shadow-sm border border-base-300">
    <div class="card-body">
      <h3 class="card-title text-lg">
        <i class="fas fa-screwdriver-wrench text-primary mr-1"></i> Hardware / bill of materials
      </h3>
      <div class="overflow-x-auto">
        <table class="table table-sm w-full">
          <thead>
            <tr class="border-b border-base-300">
              <th class="text-left">Item</th>
              <th class="text-center w-16">Qty</th>
              <th class="text-left">Notes</th>
              <th class="w-10"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, i) in items" :key="i" class="border-b border-base-300 last:border-0">
              <td class="font-medium">
                {{ item.item }}
                <span v-if="item.optional" class="badge badge-ghost badge-xs ml-1">optional</span>
              </td>
              <td class="text-center">{{ item.quantity }}</td>
              <td class="text-sm opacity-80">{{ item.notes || '—' }}</td>
              <td>
                <a
                  v-if="item.purchaseUrl"
                  :href="item.purchaseUrl"
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  class="btn btn-ghost btn-xs"
                  title="Where to buy"
                >
                  <i class="fas fa-cart-shopping"></i>
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
