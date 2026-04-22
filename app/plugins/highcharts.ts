import Highcharts from 'highcharts';
import 'highcharts/highcharts-more';
import 'highcharts/modules/exporting';
import 'highcharts/modules/offline-exporting';
import 'highcharts/modules/accessibility';
import HighchartsVue from 'highcharts-vue';
import { getCurrentInstance, onBeforeUnmount } from 'vue';

// Set global Highcharts options for better rendering
Highcharts.setOptions({
  credits: {
    enabled: false,
  },
  chart: {
    animation: false, // Disable animations for better initial rendering
    reflow: true,
    events: {
      load() {
        // Force redraw after chart is loaded
        setTimeout(() => {
          if (this.reflow) {
            this.reflow();
          }
        }, 100);
      },
      render() {
        // Add another reflow after render to ensure proper sizing
        setTimeout(() => {
          if (this.reflow) {
            this.reflow();
          }
        }, 300);
      },
    },
  },
  plotOptions: {
    series: {
      animation: false, // Disable series animation for better initial rendering
      states: {
        inactive: {
          opacity: 0.6,
        },
        hover: {
          enabled: true,
          lineWidth: 2,
        },
      },
      // Improve accessibility with better point descriptions
      point: {
        events: {},
      },
    },
  },
  // Improve SEO with better text rendering
  title: {
    style: {
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      fontWeight: 'bold',
    },
  },
  // Ensure responsive behavior
  responsive: {
    rules: [
      {
        condition: {
          maxWidth: 500,
        },
        chartOptions: {
          legend: {
            layout: 'horizontal',
            align: 'center',
            verticalAlign: 'bottom',
          },
        },
      },
    ],
  },
});

// Create the download button for highcharts
Highcharts.SVGRenderer.prototype.symbols.download = (x: number, y: number, w: number, h: number) => [
  // Arrow stem
  'M',
  x + w * 0.5,
  y,
  'L',
  x + w * 0.5,
  y + h * 0.7,
  // Arrow head
  'M',
  x + w * 0.3,
  y + h * 0.5,
  'L',
  x + w * 0.5,
  y + h * 0.7,
  'L',
  x + w * 0.7,
  y + h * 0.5,
  // Box
  'M',
  x,
  y + h * 0.9,
  'L',
  x,
  y + h,
  'L',
  x + w,
  y + h,
  'L',
  x + w,
  y + h * 0.9,
];

export default defineNuxtPlugin((nuxtApp) => {
  // Only register Highcharts on client-side to prevent SSR issues
  if (import.meta.client) {
    // Register Highcharts with Vue using the plugin which will register the component automatically
    nuxtApp.vueApp.use(HighchartsVue, {
      highcharts: Highcharts,
      tagName: 'highcharts', // Ensure consistent component name
    });

    // Add a global mixin to handle chart resizing on tab/window visibility changes
    nuxtApp.vueApp.mixin({
      mounted() {
        if (this.$refs.chart && this.$refs.chart.chart) {
          const handleVisibilityChange = () => {
            if (!document.hidden && this.$refs.chart && this.$refs.chart.chart) {
              this.$refs.chart.chart.reflow();
            }
          };

          document.addEventListener('visibilitychange', handleVisibilityChange);

          // Store cleanup function for unmounted hook
          const cleanup = () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
          };

          // Access the current component instance for cleanup
          const instance = getCurrentInstance();
          if (instance) {
            // Use onBeforeUnmount for Vue 3 cleanup
            onBeforeUnmount(cleanup, instance);
          }
        }
      },
    });
  }

  // Add a hook to ensure charts are properly rendered after route changes
  nuxtApp.hook('page:finish', () => {
    // Allow time for the DOM to update
    setTimeout(() => {
      // Find all chart instances and reflow them
      const charts = Highcharts.charts.filter(Boolean);
      charts.forEach((chart) => {
        if (chart && chart.reflow) {
          chart.reflow();
        }
      });
    }, 200);
  });

  // Return Highcharts for use in components if needed
  return {
    provide: {
      highcharts: Highcharts,
    },
  };
});
