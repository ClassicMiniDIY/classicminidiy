<script lang="ts" setup>
  // One icon per maps.json feature status. Unknown statuses render as a neutral dash
  // so a new upstream status degrades instead of leaving an empty cell.
  defineProps<{ status: string; label?: string }>();
</script>

<template>
  <span :title="label">
    <i v-if="status === 'included'" class="text-lg fa-solid fa-check" style="color: #4a7023" aria-hidden="true"></i>
    <i v-else-if="status === 'started'" class="text-lg fad fa-hourglass-start" aria-hidden="true"></i>
    <i
      v-else-if="status === 'wip'"
      class="text-h6 fa-sharp-duotone fa-solid fa-road-barrier"
      style="--fa-primary-color: #562b00; --fa-secondary-color: #f5c147; --fa-secondary-opacity: 1"
      aria-hidden="true"
    ></i>
    <i
      v-else-if="status === 'not-included'"
      class="text-lg fa-solid fa-xmark"
      style="color: #b22222"
      aria-hidden="true"
    ></i>
    <i v-else class="text-lg fa-solid fa-dash" aria-hidden="true"></i>
    <span v-if="label" class="sr-only">{{ label }}</span>
  </span>
</template>
