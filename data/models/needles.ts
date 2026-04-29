import StarterNeedles from '../../data/default-needles.json';
export const chartOptions = {
  chart: {
    // `zooming.*` is the modern Highcharts ≥11 config block; `zoomType` is
    // kept as the legacy fallback. Pinch on touch + drag-to-select on
    // desktop both zoom horizontally only — vertical zoom is irrelevant
    // for needle profile comparison.
    //
    // Why not a scrollbar: Highcharts' axis scrollbar lives in the Stock
    // build, which is ~50KB+ of features (navigator, candlestick, OHLC)
    // we don't need. Mouse-wheel zoom + click-and-drag panning + the
    // auto-rendered "Reset Zoom" button cover the same UX without the
    // bundle hit.
    zoomType: 'x',
    zooming: {
      type: 'x',
      pinchType: 'x',
      mouseWheel: { enabled: true, type: 'x' },
      resetButton: { position: { align: 'right', verticalAlign: 'top', x: -10, y: 10 } },
    },
    // Click-and-drag panning is always available; once zoomed it pans
    // through the stations, while not-zoomed it's effectively a no-op.
    panning: { enabled: true, type: 'x' },
    panKey: 'shift',
  },
  title: { text: 'Needle Comparison Chart' },
  exporting: {
    buttons: {
      contextButton: {
        menuItems: ['downloadPNG', 'downloadJPEG', 'downloadPDF'],
        symbol: 'download',
      },
    },
  },
  subtitle: {
    text: 'Source: <a target="_blank" href="http://www.mintylamb.co.uk/suneedle/">http://www.mintylamb.co.uk/suneedle/</a>',
  },
  // This is the data decleration
  series: StarterNeedles,
  yAxis: {
    title: { text: 'Needle Diameter (mm)' },
    labels: {
      enabled: true,
    },
    reversed: true,
  },
  xAxis: {
    title: { text: 'Needle Station' },
    labels: {
      enabled: true,
    },
  },
  legend: {
    layout: 'vertical',
    align: 'right',
    verticalAlign: 'middle',
  },
  tooltip: { headerFormat: 'Richness:<br>', shared: true },
  responsive: {
    rules: [
      {
        condition: { maxWidth: 500 },
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
};

export interface NeedleResponse {
  initial: Needle[];
  all: Needle[];
  error?: string;
}

export interface Needle {
  name: string;
  size: number;
  data: number[];
}

export interface SuggestedNeedles {
  title: string;
  items: Item[];
}

export interface Item {
  engineSize: string;
  needleStd: string;
  needleRich: string;
  needleLean: string;
  springType: SpringType;
}

export enum SpringType {
  Blue = 'Blue',
  Empty = '-',
  Red = 'Red',
  Yellow = 'Yellow',
}
