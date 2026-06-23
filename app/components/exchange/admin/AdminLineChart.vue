<template>
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body">
      <h3 class="card-title text-base">{{ title }}</h3>
      <div class="h-64">
        <Line :data="chartData" :options="chartOptions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Line } from 'vue-chartjs';
  import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Filler,
  } from 'chart.js';

  ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

  const props = defineProps<{
    title: string;
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      borderColor?: string;
      backgroundColor?: string;
    }>;
  }>();

  const chartData = computed(() => ({
    labels: props.labels,
    datasets: props.datasets.map((ds) => ({
      ...ds,
      borderColor: ds.borderColor || 'oklch(0.65 0.19 160)',
      backgroundColor: ds.backgroundColor || 'oklch(0.65 0.19 160 / 0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5,
    })),
  }));

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        ticks: { maxTicksLimit: 8 },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
      },
    },
  };
</script>
