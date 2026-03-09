export const kphFactor = 1.60934;

// Tire option types
export interface TireValue {
  width: number;
  profile: number;
  size: number;
  diameter?: number; // For special tires like Hoosier
}

export interface TireOption {
  label: string;
  value: TireValue;
}

// Differential option types
export interface DiffOption {
  value: number;
  label: string;
  subtitle?: string;
}

// Speedometer ratio option types
export interface SpeedoRatioOption {
  value: number;
  label: string;
  subtitle?: string;
}

// Drop gear option types
export interface DropGearOption {
  value: number;
  label: string;
  subtitle?: string;
}

// Gear ratio option types
export interface GearRatioOption {
  value: [number, number, number, number]; // Array of 4 gear ratios
  label: string;
}

// Speedometer types
export interface SpeedometerOption {
  turns: number;
  speed: number;
  name: string;
}

export interface SpeedometerOptions {
  metric: SpeedometerOption[];
  imperial: SpeedometerOption[];
}

// RPM ticks type
export interface RpmTicks {
  [key: number]: string;
}

// Main options export interface
export interface GearingOptions {
  tires: TireOption[];
  diffs: DiffOption[];
  speedosRatios: SpeedoRatioOption[];
  dropGears: DropGearOption[];
  gearRatios: GearRatioOption[];
  speedos: SpeedometerOptions;
  rpmTicks: RpmTicks;
}

export const options: GearingOptions = {
  tires: [
    {
      label: '145/80r10',
      value: {
        width: 145,
        profile: 80,
        size: 10,
      },
    },
    {
      label: '165/70r10',
      value: {
        width: 165,
        profile: 70,
        size: 10,
      },
    },

    {
      label: '145/70r12',
      value: {
        width: 145,
        profile: 70,
        size: 12,
      },
    },
    {
      label: '145/80r12',
      value: {
        width: 145,
        profile: 80,
        size: 12,
      },
    },
    {
      label: '155/70r12',
      value: {
        width: 155,
        profile: 70,
        size: 12,
      },
    },
    {
      label: '155/80r12',
      value: {
        width: 155,
        profile: 80,
        size: 12,
      },
    },
    {
      label: '160/65r12',
      value: {
        width: 155,
        profile: 80,
        size: 12,
      },
    },
    {
      label: '165/55r12',
      value: {
        width: 165,
        profile: 55,
        size: 12,
      },
    },
    {
      label: '165/60r12',
      value: {
        width: 165,
        profile: 60,
        size: 12,
      },
    },
    {
      label: '150/65r13',
      value: {
        width: 150,
        profile: 65,
        size: 13,
      },
    },
    {
      label: '160/65r13',
      value: {
        width: 160,
        profile: 65,
        size: 13,
      },
    },
    {
      label: '175/50r13',
      value: {
        width: 175,
        profile: 50,
        size: 13,
      },
    },
    {
      label: '185/55r13',
      value: {
        width: 185,
        profile: 55,
        size: 13,
      },
    },
    {
      label: '185/70r13',
      value: {
        width: 185,
        profile: 70,
        size: 13,
      },
    },
    {
      label: '195/45r13',
      value: {
        width: 195,
        profile: 45,
        size: 13,
      },
    },
    {
      label: '195/50r13',
      value: {
        width: 195,
        profile: 50,
        size: 13,
      },
    },
    {
      label: 'Hoosier 19.0 X 5.0 - 10',
      value: {
        diameter: 477.52,
        width: 5.2,
        profile: 0,
        size: 10,
      },
    },
  ],
  diffs: [
    { value: 2.76, label: '2.760:1 21/58' },
    { value: 2.95, label: '2.950:1 20/59', subtitle: 'Metro 1.3 HLE "85 on"' },
    {
      value: 3.105,
      label: '3.105:1 19/59',
      subtitle: "Metro 1.0 HLE and Some 1.3 HLE's",
    },
    { value: 3.211, label: '3.211:1 19/61', subtitle: 'MG Metro Turbo' },
    {
      value: 3.444,
      label: '3.444:1 18/62',
      subtitle: "Most Mini's and post '84 Metro's",
    },
    {
      value: 3.47,
      label: '3.47:1 17/59',
      subtitle: 'MED Straight Cut',
    },
    {
      value: 3.647,
      label: '3.647:1 17/62',
      subtitle: 'Metro City, L and Van',
    },
    {
      value: 3.75,
      label: '3.75:1 16/60',
      subtitle: 'MED LSD or MED Straight Cut',
    },
    {
      value: 3.765,
      label: '3.765:1 17/64',
      subtitle: "MKI Mini, 850's and Vans",
    },
    {
      value: 3.88,
      label: '3.88:1 16/62',
      subtitle: 'MED LSD or MED Straight Cut',
    },
    {
      value: 3.939,
      label: '3.939:1 16/63',
      subtitle: 'Option on Cooper "S" MKI/II/III',
    },
    { value: 4.133, label: '4.133:1 15/62' },
    { value: 4.267, label: '4.267:1 15/64' },
    { value: 4.35, label: '4.350:1 15/65' },
    { value: 3.667, label: '3.667:1 15/55', subtitle: 'Straight Cut' },
    { value: 3.875, label: '3.875:1 16/62', subtitle: 'Special' },
    {
      value: 4.066,
      label: '4.066:1 15/61',
      subtitle: 'MED LSD or MED Straight Cut',
    },
    {
      value: 4.2,
      label: '4.2:1 15/63',
      subtitle: 'MED LSD or MED Straight Cut',
    },
    { value: 4.35, label: '4.307:1 13/56', subtitle: 'Special' },
    {
      value: 4.5,
      label: '4.5:1 14/63',
      subtitle: 'MED LSD',
    },
    { value: 4.571, label: '4.571:1 14/64', subtitle: 'Special' },
  ],
  speedosRatios: [
    { value: 0.2777, label: '5/18', subtitle: '12" Mini / 3.2 diff' },
    { value: 0.2941, label: '5/17', subtitle: 'Metro 1275 / 3.44 diff' },
    { value: 0.375, label: '6/16' },
    { value: 0.3529, label: '6/17', subtitle: '10" Mini / 3.44 diff' },
    { value: 0.4667, label: '7/15' },
    { value: 0.4375, label: '7/16', subtitle: '12" Mini / 3.105 diff' },
    { value: 0.4117, label: '7/17', subtitle: '10" Mini / 2.95 diff' },
    { value: 0.3888, label: '7/18' },
  ],
  dropGears: [
    { value: 0.9333, label: '0.9333:1', subtitle: '30/28 tooth' },
    { value: 0.958, label: '0.9580:1', subtitle: '24/23 tooth' },
    { value: 0.9655, label: '0.9666:1', subtitle: '30/29 tooth' },
    { value: 0.9655, label: '0.9655:1', subtitle: '29/28 tooth' },
    { value: 0.967, label: 'Overdrive 0.9670:1', subtitle: '30 tooth' },
    { value: 1, label: 'Standard 1:1', subtitle: '29 tooth' },
    { value: 1.04, label: '1.04:1', subtitle: 'Swiftune Roller Drop Gears' },
    { value: 1.0416, label: '1.0416:1', subtitle: '24/25 tooth' },
    { value: 1.0435, label: '1.0435:1', subtitle: '23/24 tooth' },
    { value: 1.045, label: '1.0450:1', subtitle: '22/23 tooth' },
    { value: 1.0869, label: '1.0869:1', subtitle: '23/25 tooth' },
    { value: 1.09, label: '1.0900:1', subtitle: '22/24 tooth' },
    { value: 1.1364, label: '1.1364:1', subtitle: '22/25 tooth' },
  ],
  gearRatios: [
    {
      value: [3.627, 2.172, 1.412, 1.0],
      label: "MKI Mini Pre '64 (Magic Wand)",
    },
    {
      value: [3.52, 2.21, 1.43, 1.001],
      label: "MKI/II Mini Post '64 (Magic Wand)",
    },
    {
      value: [3.2, 1.916, 1.357, 1.0],
      label: "MkI/II Cooper & MkI/II/III Cooper 'S'",
    },
    {
      value: [2.573, 1.722, 1.255, 1.0],
      label: "MkI/II/III Cooper 'S' (Close Ratio / Straight Cut)",
    },
    {
      value: [3.33, 2.094, 1.353, 1.0],
      label: "MkIII Cooper 'S' & 1275 GT (Close Ratio)",
    },
    {
      value: [3.52, 2.21, 1.43, 1.0],
      label: "MKIII/IV Mini & Metro (pre A+ <'84)",
    },
    {
      value: [3.647, 2.185, 1.425, 1.0],
      label: "MKV/VI/VII Mini, ERA Turbo & Metro (A+ >'84)",
    },
    { value: [4.004, 2.307, 1.435, 1.0], label: 'Metro 1.0 HLE' },
    {
      value: [2.583, 1.644, 1.25, 1.0],
      label: 'Minispares Evolution Helical Heavy Duty Kit - C-STN48',
    },
    {
      value: [2.583, 1.711, 1.25, 1.0],
      label: 'Minispares (Clubman ratios CR/SC) C-STN39 or TRAN-X (Clubman ratios CR/SC)',
    },
    {
      value: [2.544, 1.731, 1.258, 1.0],
      label: 'Minispares (Abingdon ST ratios CR/SC) C-STN77 or GRBMS4014 or TRAN-X (Abingdon ST ratios CR/SC)',
    },
    {
      value: [2.313, 1.567, 1.187, 1.0],
      label: 'Minispares (Metro Challenge CR/SC)',
    },
    {
      value: [2.173, 1.493, 1.197, 1.0],
      label: 'KAD 4 speed Dog Kit (2.173:1 1st)',
    },
    {
      value: [2.239, 1.568, 1.244, 1.0],
      label: 'MED 4 speed Dog Kit (2.239:1 1st)',
    },
    {
      value: [2.543, 1.73, 1.25, 1.0],
      label: 'MED Race Gear Kit (2.543:1 1st)',
    },
    {
      value: [2.573, 1.722, 1.255, 1.0],
      label: 'MED 3 Synchro Gear Kit (2.543:1 1st)',
    },
    {
      value: [2.309, 1.56, 1.197, 1.0],
      label: 'Quaife 4 speed Dog Kit (2.3:1 1st)',
    },
    {
      value: [2.093, 1.493, 1.197, 1.0],
      label: 'Quaife 4 speed Dog Kit (2.1:1 1st)',
    },
    {
      value: [1.692, 1.441, 1.197, 1.0],
      label: 'Quaife/Swiftune 4 speed Dog Kit (US Spec 1.692:1 1st)',
    },
  ],
  speedos: {
    metric: [
      { turns: 900, speed: 160, name: 'Smiths - Generic' },
      { turns: 880, speed: 160, name: "Smiths central ('60s Cooper)" },
      { turns: 880, speed: 140, name: 'Smiths central (850) - Generic' },
      { turns: 860, speed: 140, name: 'Smiths central (850)' },
      { turns: 820, speed: 140, name: "Smiths Early tri'clock" },
      { turns: 812, speed: 180, name: 'Late Cooper Nippon Seiki' },
      { turns: 800, speed: 200, name: 'Cooper S Smiths central' },
      { turns: 800, speed: 140, name: "Smiths central Pre '84" },
      { turns: 780, speed: 160, name: 'Smiths (Austin 1300GT)' },
      { turns: 780, speed: 200, name: 'Smiths (1275 GT/25/1100 Special)' },
      { turns: 776, speed: 140, name: 'Nippon Seike' },
      { turns: 760, speed: 140, name: "Smiths post '84" },
      { turns: 625, speed: 170, name: "All Metro's and Most modern aftermarket" },
    ],
    imperial: [
      { turns: 1440, speed: 100, name: 'Smiths - Generic' },
      { turns: 1408, speed: 110, name: "Smiths central ('60s Cooper)" },
      { turns: 1376, speed: 90, name: 'Smiths central (850)' },
      { turns: 1312, speed: 90, name: "Smiths Early tri'clock" },
      { turns: 1300, speed: 110, name: 'Late Cooper Nippon Seiki' },
      { turns: 1280, speed: 120, name: 'Cooper S Smiths central' },
      { turns: 1280, speed: 90, name: "Smiths central Pre '84" },
      { turns: 1248, speed: 90, name: 'Smiths central' },
      { turns: 1248, speed: 100, name: 'Smiths (Austin 1300GT)' },
      { turns: 1248, speed: 120, name: 'Smiths (1275 GT/25/1100 Special)' },
      { turns: 1242, speed: 90, name: 'Nippon Seike' },
      { turns: 1216, speed: 90, name: "Smiths post '84" },
      { turns: 1000, speed: 110, name: "All Metro's and Most modern aftermarket" },
    ],
  },
  rpmTicks: {
    6000: '6000',
    6500: '6500',
    7000: '7000',
    7500: '7500',
    8000: '8000',
    8500: '8500',
    9000: '9000',
  },
};

export const tableHeaders = {
  tableHeadersGearing: [
    {
      key: 'gear',
      label: 'Gear',
      title: 'Gear',
      sortable: false,
    },
    {
      key: 'ratio',
      label: 'Ratio',
      title: 'Ratio',
      sortable: false,
    },
    {
      key: 'maxSpeed',
      label: 'Max Speed (mph)',
      title: 'Max Speed (mph)',
      sortable: false,
      align: 'center',
    },
  ],
  tableHeadersSpeedos: [
    { key: 'speed', label: 'Top Speed', title: 'Top Speed', sortable: false },
    {
      key: 'turns',
      label: 'Turns',
      title: 'Turns',
      sortable: false,
    },
    {
      key: 'speedometer',
      label: 'Speedometer',
      title: 'Speedometer',
      sortable: false,
    },
    {
      key: 'result',
      label: 'Result',
      title: 'Result',
      sortable: false,
      align: 'center',
    },
  ],
};

export const chartOptions = {
  chart: { zoomType: 'x' },
  title: { text: 'Speed and RPM' },
  exporting: {
    buttons: {
      contextButton: {
        symbol: 'download',
      },
    },
  },
  // subtitle: {
  //   text: 'Source: <a target="_blank" href="http://www.mintylamb.co.uk/suneedle/">http://www.mintylamb.co.uk/suneedle/</a>',
  // },
  // This is the data decleration
  series: [],
  plotOptions: {
    series: {
      // label: {
      //   connectorAllowed: false,
      // },
      pointStart: 1000,
      pointInterval: 500,
    },
  },
  yAxis: {
    title: { text: 'Speed' },
    labels: {
      enabled: true,
    },
  },
  xAxis: {
    title: { text: 'RPM' },
    labels: {
      enabled: true,
      step: 0.5,
    },
  },
  legend: {
    layout: 'vertical',
    align: 'right',
    verticalAlign: 'middle',
  },
  tooltip: { headerFormat: 'Speed:<br>', shared: true },
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

export interface ISpeedometerTableItem {
  status: string;
  speedometer: string;
  turns: number;
  speed: number;
  result: string;
}
export interface ISpeedometer {
  name: string;
  turns: number;
  speed: number;
}

export interface IGearingTableItem {
  gear: number;
  ratio: number;
  maxSpeed: string;
}
