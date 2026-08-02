/**
 * Toolbox catalog — the wayfinding metadata that sits *around* the tools.
 *
 * The tools themselves are untouched by the UX cohesion pass; this file only
 * describes them so three surfaces can agree without duplicating strings:
 *
 *   1. Omnisearch — the TOOLS group. Tool names live here in English rather than
 *      as i18n keys because search runs server-side in `/api/search`, which has
 *      no `useI18n()`. `searchTerms` is what makes "CR", "lb-ft" and "HIF44"
 *      find the right calculator.
 *   2. The Toolbox subnav — `category` drives Calculators / Decoders /
 *      References.
 *   3. Tool detail pages — `relatedArchive` renders the FROM THE ARCHIVE box.
 *
 * `archiveBacked` marks tools whose related data is *community-contributed*
 * (registry, wheels, documents) rather than a fixed reference table. It is what
 * renders the olive "Archive data" tag on the tool card, so it should only be
 * true where a contribution actually improves the tool.
 *
 * ToolboxItems in ./generic.ts stays the source of truth for the card grid
 * (icons, i18n keys). This catalog is keyed on the same `to` paths — keep them
 * in sync when a tool is added or moved.
 */

export type ToolCategory = 'calculator' | 'decoder' | 'reference';

export interface ArchiveLink {
  /** FontAwesome 6 class form. The Iconify `i-fa6-*` form renders nothing here. */
  icon: string;
  label: string;
  to: string;
}

export interface ToolCatalogEntry {
  slug: string;
  to: string;
  name: string;
  summary: string;
  category: ToolCategory;
  icon: string;
  archiveBacked?: boolean;
  /** Extra tokens the tool should match on. Names are matched separately. */
  searchTerms: string[];
  /** 2–3 curated cross-links rendered under the tool (design S5). */
  relatedArchive: ArchiveLink[];
}

export const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = {
  calculator: 'Calculator',
  decoder: 'Decoder',
  reference: 'Reference',
};

export const ToolCatalog: ToolCatalogEntry[] = [
  {
    slug: 'compression',
    to: '/technical/compression',
    name: 'Compression Ratio Calculator',
    summary: 'CR for any combo of bore, stroke, head cc and deck height.',
    category: 'calculator',
    icon: 'fas fa-gauge',
    searchTerms: ['cr', 'compression', 'bore', 'stroke', 'head cc', 'deck height', 'gasket', 'squish'],
    relatedArchive: [
      { icon: 'fas fa-table', label: 'Standard engine specs table', to: '/archive/engines' },
      { icon: 'fas fa-id-card', label: 'Engine number decoder', to: '/technical/engine-decoder' },
    ],
  },
  {
    slug: 'gearing',
    to: '/technical/gearing',
    name: 'Gearbox Calculator',
    summary: 'Final-drive math across SPi, MPi, and pre-Verto cars.',
    category: 'calculator',
    icon: 'fas fa-cogs',
    searchTerms: ['gear ratio', 'gearing', 'final drive', 'diff', 'drop gears', 'speedo', 'mph', 'rpm'],
    relatedArchive: [
      { icon: 'fas fa-table', label: 'Standard engine specs table', to: '/archive/engines' },
      { icon: 'fas fa-weight-hanging', label: 'Vehicle weights reference', to: '/archive/weights' },
    ],
  },
  {
    slug: 'needles',
    to: '/technical/needles',
    name: 'Carb Needle Configurator',
    summary: 'Compare SU HS2/HS4/HIF44 needle profiles side-by-side.',
    category: 'calculator',
    icon: 'fas fa-bolt',
    searchTerms: ['su', 'needle', 'needles', 'hs2', 'hs4', 'hif44', 'carb', 'carburettor', 'jet', 'mixture', 'afr'],
    relatedArchive: [
      { icon: 'fas fa-table', label: 'Standard engine specs table', to: '/archive/engines' },
      { icon: 'fas fa-books', label: 'Tuning guides in the archive', to: '/archive/documents' },
    ],
  },
  {
    slug: 'alignment',
    to: '/technical/alignment',
    name: 'Alignment Calculator',
    summary: 'Camber, caster and toe, live — factory presets through track.',
    category: 'calculator',
    icon: 'fas fa-ruler-combined',
    archiveBacked: true,
    searchTerms: ['camber', 'caster', 'toe', 'tracking', 'geometry', 'alignment', 'suspension'],
    relatedArchive: [
      { icon: 'fas fa-ring', label: 'Wheel fitment library', to: '/archive/wheels' },
      { icon: 'fas fa-screwdriver-wrench', label: 'Suspension torque specs', to: '/technical/torque' },
    ],
  },
  {
    slug: 'chassis-decoder',
    to: '/technical/chassis-decoder',
    name: 'Chassis Number Decoder',
    summary: 'Year, plant, and trim from your VIN/chassis number.',
    category: 'decoder',
    icon: 'fas fa-hashtag',
    archiveBacked: true,
    searchTerms: ['vin', 'chassis', 'chassis number', 'plate', 'identification', 'body number', 'heritage'],
    relatedArchive: [
      { icon: 'fas fa-clipboard-list', label: 'Mini Registry', to: '/archive/registry' },
      { icon: 'fas fa-books', label: 'Workshop manuals', to: '/archive/documents' },
    ],
  },
  {
    slug: 'engine-decoder',
    to: '/technical/engine-decoder',
    name: 'Engine Number Decoder',
    summary: 'Decode A-series engine codes, displacement, and date stamps.',
    category: 'decoder',
    icon: 'fas fa-engine',
    archiveBacked: true,
    searchTerms: ['engine number', 'engine code', 'prefix', 'casting', 'date stamp', 'a-series', '998', '1275'],
    relatedArchive: [
      { icon: 'fas fa-table', label: 'Engine sizes reference', to: '/archive/engines' },
      { icon: 'fas fa-clipboard-list', label: 'Mini Registry', to: '/archive/registry' },
    ],
  },
  {
    slug: 'torque',
    to: '/technical/torque',
    name: 'Torque Specs',
    summary: 'Every torque value for the A-series and aux components.',
    category: 'reference',
    icon: 'fas fa-screwdriver-wrench',
    searchTerms: ['torque', 'nm', 'lb-ft', 'ft-lb', 'tightening', 'fasteners', 'bolts', 'head bolts', 'flywheel'],
    relatedArchive: [
      { icon: 'fas fa-ruler', label: 'Common clearances', to: '/technical/clearance' },
      { icon: 'fas fa-books', label: 'Workshop manuals', to: '/archive/documents' },
    ],
  },
  {
    slug: 'clearance',
    to: '/technical/clearance',
    name: 'Common Clearances',
    summary: 'Tappet gaps, bearing tolerances, and assembly clearances.',
    category: 'reference',
    icon: 'fas fa-ruler',
    searchTerms: ['clearance', 'tappet', 'valve gap', 'bearing', 'tolerance', 'end float', 'shim'],
    relatedArchive: [
      { icon: 'fas fa-screwdriver-wrench', label: 'Torque specifications', to: '/technical/torque' },
      { icon: 'fas fa-table', label: 'Engine sizes reference', to: '/archive/engines' },
    ],
  },
  {
    slug: 'parts',
    to: '/technical/parts',
    name: 'Parts Equivalency',
    summary: 'Cross-reference part numbers across vendors and brands.',
    category: 'reference',
    icon: 'fas fa-gears',
    archiveBacked: true,
    searchTerms: ['part number', 'cross reference', 'interchange', 'equivalent', 'gpd', 'gex', 'oem'],
    relatedArchive: [
      { icon: 'fas fa-books', label: 'Vendor catalogues', to: '/archive/documents' },
      { icon: 'fas fa-ring', label: 'Wheel fitment library', to: '/archive/wheels' },
    ],
  },
];

export const toolBySlug = (slug: string): ToolCatalogEntry | undefined =>
  ToolCatalog.find((tool) => tool.slug === slug);

export const toolByPath = (path: string): ToolCatalogEntry | undefined =>
  ToolCatalog.find((tool) => tool.to === path);

/**
 * Toolbox row-2 subnav (design S4). `to` carries a `?category=` filter rather
 * than separate routes so the existing single toolbox page keeps working and no
 * new URLs enter the sitemap.
 */
export const TOOLBOX_SECTIONS = [
  { key: 'calculator', label: 'Calculators', to: '/technical?category=calculator' },
  { key: 'decoder', label: 'Decoders', to: '/technical?category=decoder' },
  { key: 'reference', label: 'References', to: '/technical?category=reference' },
] as const;

/** Archive row-2 subnav (design S6). */
export const ARCHIVE_SECTIONS = [
  { key: 'documents', label: 'Manuals', to: '/archive/documents' },
  { key: 'registry', label: 'Registries', to: '/archive/registry' },
  { key: 'wheels', label: 'Wheels', to: '/archive/wheels' },
  { key: 'electrical', label: 'Electrical', to: '/archive/electrical' },
] as const;
