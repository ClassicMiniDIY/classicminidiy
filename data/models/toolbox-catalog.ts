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

/**
 * Archive sections as SEARCH targets.
 *
 * Several archive surfaces are static reference tables rather than rows in
 * Postgres — engine sizes, vehicle weights, the electrical index — so
 * `omnisearch()` cannot see them at all. Without these entries, searching
 * "weights" or "wiring" returned nothing from the archive, which is exactly the
 * kind of miss that makes people stop using search.
 *
 * These are SECTION-level on purpose. A weights row ("Mk1 Saloon, 587kg") has no
 * page of its own, so returning forty rows that all link to /archive/weights
 * would be noise. Electrical is the exception and is indexed per diagram in
 * `server/api/search`, because each one is a distinct named document and that
 * page can filter to it via `?q=`.
 */
export interface ArchiveSectionSearchEntry {
  key: string;
  name: string;
  summary: string;
  to: string;
  icon: string;
  searchTerms: string[];
}

export const ARCHIVE_SEARCH_SECTIONS: ArchiveSectionSearchEntry[] = [
  {
    key: 'electrical',
    name: 'Electrical Diagrams',
    summary: 'Wiring diagrams by model, year and ground polarity.',
    to: '/archive/electrical',
    icon: 'fas fa-bolt',
    searchTerms: ['wiring', 'wiring diagram', 'electrical', 'loom', 'harness', 'schematic', 'earth', 'ground'],
  },
  {
    key: 'engines',
    name: 'Engine Sizes',
    summary: 'Bore, stroke, power and torque for every A-series displacement.',
    to: '/archive/engines',
    icon: 'fas fa-engine',
    searchTerms: ['engine size', 'displacement', 'bore', 'stroke', 'a-series', '850', '997', '998', '1100', '1275', 'bhp', 'torque'],
  },
  {
    key: 'weights',
    name: 'Vehicle Weights',
    summary: 'Curb and component weights by model and body type.',
    to: '/archive/weights',
    icon: 'fas fa-weight-hanging',
    searchTerms: ['weight', 'weights', 'curb weight', 'kerb weight', 'mass', 'kg', 'lbs'],
  },
  {
    key: 'manuals',
    name: 'Workshop Manuals & Documents',
    summary: 'Scanned manuals, adverts, catalogues and tuning guides.',
    to: '/archive/documents',
    icon: 'fas fa-books',
    searchTerms: ['manual', 'manuals', 'workshop manual', 'handbook', 'catalogue', 'advert', 'brochure', 'tuning guide'],
  },
  {
    key: 'registry',
    name: 'Mini Registry',
    summary: 'Community-submitted cars with chassis and engine numbers.',
    to: '/archive/registry',
    icon: 'fas fa-clipboard-list',
    searchTerms: ['registry', 'register', 'my mini', 'chassis plate', 'heritage', 'owners'],
  },
  {
    key: 'wheels',
    name: 'Wheel Library',
    summary: 'Fitment, offsets and photos for hundreds of wheels.',
    to: '/archive/wheels',
    icon: 'fas fa-ring',
    searchTerms: ['wheel library', 'wheels', 'fitment', 'offset', 'backspace', 'rim'],
  },
  {
    key: 'colors',
    name: 'Colour Picker',
    summary: 'Factory paint colours with codes and swatches.',
    to: '/archive/colors',
    icon: 'fas fa-brush',
    searchTerms: ['colour', 'color', 'paint', 'swatch', 'ditzler', 'dulux', 'paint code'],
  },
];

/**
 * Archive row-2 subnav (design S6).
 *
 * EVERY archive section belongs here, not the four the design mocked. Unlike the
 * Toolbox bar — which filters cards on one page via `?category=` — these are
 * real routes, so a partial list does not read as "here are some shortcuts", it
 * reads as "the archive contains these four things" and hides the other three.
 *
 * Labels match each destination's own page title, so following a link never
 * lands you somewhere that calls itself something else.
 *
 * 3D Models is deliberately absent: it lives at /models under its own top-level
 * nav item, not inside the archive.
 */
export const ARCHIVE_SECTIONS = [
  { key: 'registry', label: 'Registry', to: '/archive/registry' },
  { key: 'documents', label: 'Documents', to: '/archive/documents' },
  { key: 'wheels', label: 'Wheels', to: '/archive/wheels' },
  { key: 'colors', label: 'Colours', to: '/archive/colors' },
  { key: 'electrical', label: 'Electrical', to: '/archive/electrical' },
  { key: 'engines', label: 'Engines', to: '/archive/engines' },
  { key: 'weights', label: 'Weights', to: '/archive/weights' },
] as const;
