<template>
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body">
      <h3 class="card-title text-base">{{ title }}</h3>
      <div class="h-64 flex items-center justify-center">
        <Doughnut :data="chartData" :options="chartOptions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Doughnut } from 'vue-chartjs';
  import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

  ChartJS.register(ArcElement, Tooltip, Legend);

  const props = withDefaults(
    defineProps<{
      title: string;
      labels: string[];
      data: number[];
      colors?: string[];
    }>(),
    {
      colors: () => [
        'oklch(0.65 0.19 160)', // success green
        'oklch(0.75 0.18 80)', // warning amber
        'oklch(0.65 0.19 250)', // info blue
        'oklch(0.65 0.24 15)', // error red
        'oklch(0.7 0.15 200)', // accent
        'oklch(0.6 0.2 300)', // secondary
      ],
    }
  );

  const chartData = computed(() => ({
    labels: props.labels,
    datasets: [
      {
        data: props.data,
        backgroundColor: props.colors.slice(0, props.data.length),
        borderWidth: 2,
        borderColor: 'oklch(1 0 0)',
      },
    ],
  }));

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 10,
        },
      },
    },
  };
</script>
