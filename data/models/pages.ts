export interface PageDescription {
  route: string;
  title: string;
  description: string;
  functions: string[];
  category: 'home' | 'technical' | 'archive' | 'admin' | 'utility';
}

export const PAGE_DESCRIPTIONS: PageDescription[] = [
  // Home & Main Pages
  {
    route: '/',
    title: 'Home - Classic Mini DIY',
    description:
      'The main landing page showcasing the Classic Mini DIY mission, channel statistics, recent videos, and information about supporting the channel through Patreon.',
    functions: [
      'Display channel mission and goals',
      'Show recent YouTube videos',
      'Present Patreon membership benefits',
      'Provide channel statistics and metrics',
      'Link to technical toolbox and other sections',
    ],
    category: 'home',
  },
  {
    route: '/maps',
    title: 'Interactive Maps',
    description:
      'Interactive mapping system for locating Classic Mini related businesses, services, and points of interest worldwide.',
    functions: [
      'Display interactive world map',
      'Show Mini-related businesses and services',
      'Filter locations by type and region',
      'Provide contact information for businesses',
    ],
    category: 'utility',
  },
  {
    route: '/privacy',
    title: 'Privacy Policy',
    description:
      'Legal privacy policy document outlining data collection, usage, and user rights for the Classic Mini DIY website.',
    functions: [
      'Display privacy policy terms',
      'Explain data collection practices',
      'Outline user rights and protections',
      'Provide contact information for privacy concerns',
    ],
    category: 'utility',
  },

  // Technical Toolbox Pages
  {
    route: '/technical',
    title: 'Technical Toolbox',
    description:
      'Main hub for all technical tools, calculators, and decoders designed to help Classic Mini owners with maintenance, restoration, and technical specifications.',
    functions: [
      'Provide overview of available technical tools',
      'Link to chassis and engine decoders',
      'Access compression ratio calculator',
      'Navigate to torque specifications and other tools',
    ],
    category: 'technical',
  },
  {
    route: '/technical/chassis-decoder',
    title: 'Chassis Number Decoder',
    description:
      'Comprehensive tool for decoding Classic Mini chassis numbers from 1959 onwards, providing detailed information about manufacturing year, body type, engine, and assembly plant.',
    functions: [
      'Decode chassis numbers by year range',
      'Validate chassis number format',
      'Provide position-by-position breakdown',
      'Show manufacturing specifications and details',
    ],
    category: 'technical',
  },
  {
    route: '/technical/engine-decoder',
    title: 'Engine Number Decoder',
    description:
      'Tool for decoding Classic Mini engine numbers to identify engine type, specifications, and manufacturing details.',
    functions: [
      'Decode engine numbers and prefixes',
      'Identify engine specifications',
      'Provide engine manufacturing information',
      'Validate engine number formats',
    ],
    category: 'technical',
  },
  {
    route: '/technical/compression',
    title: 'Compression Ratio Calculator',
    description:
      'Advanced calculator for determining compression ratios when modifying Classic Mini engines, including head skimming and piston changes.',
    functions: [
      'Calculate compression ratios',
      'Account for head skimming modifications',
      'Consider different piston types',
      'Provide recommendations for fuel requirements',
    ],
    category: 'technical',
  },
  {
    route: '/technical/torque',
    title: 'Torque Specifications',
    description:
      'Comprehensive database of torque specifications for Classic Mini components, organized by system and component type.',
    functions: [
      'Provide torque specifications by component',
      'Search torque values by system',
      'Display proper tightening sequences',
      'Include special notes and warnings',
    ],
    category: 'technical',
  },
  {
    route: '/technical/gearing',
    title: 'Gearing Calculator',
    description:
      'Tool for calculating gear ratios, final drive ratios, and speed/RPM relationships for different Classic Mini transmission setups.',
    functions: [
      'Calculate gear ratios',
      'Determine final drive ratios',
      'Show speed vs RPM relationships',
      'Compare different gearbox configurations',
    ],
    category: 'technical',
  },
  {
    route: '/technical/needles',
    title: 'SU Carb Needle Calculator',
    description:
      'Interactive tool for selecting the correct SU carburetor needles based on engine modifications and performance requirements.',
    functions: [
      'Recommend needle profiles',
      'Account for engine modifications',
      'Provide tuning guidance',
      'Display needle characteristics charts',
    ],
    category: 'technical',
  },
  {
    route: '/technical/clearance',
    title: 'Valve Clearance Specifications',
    description:
      'Reference guide for valve clearance specifications across different Classic Mini engine types and configurations.',
    functions: [
      'Provide valve clearance specifications',
      'Show adjustment procedures',
      'List specifications by engine type',
      'Include measurement guidelines',
    ],
    category: 'technical',
  },
  {
    route: '/technical/parts',
    title: 'Parts Cross-Reference',
    description:
      'Cross-reference tool for finding equivalent parts across different suppliers and part numbering systems.',
    functions: [
      'Cross-reference part numbers',
      'Find equivalent parts from different suppliers',
      'Provide part compatibility information',
      'Link to supplier websites',
    ],
    category: 'technical',
  },

  // Archive Pages
  {
    route: '/archive',
    title: 'Classic Mini Archives',
    description:
      'Central hub for historical Classic Mini documents, manuals, registries, and preserved digital resources for enthusiasts and restorers.',
    functions: [
      'Provide access to historical documents',
      'Navigate to different archive categories',
      'Search archived materials',
      'Submit new archive materials',
    ],
    category: 'archive',
  },
  {
    route: '/archive/engines',
    title: 'Engine Archive',
    description:
      'Historical database of Classic Mini engines with specifications, production numbers, and technical details.',
    functions: [
      'Display engine specifications by type',
      'Show production numbers and dates',
      'Provide technical specifications',
      'Include historical context and notes',
    ],
    category: 'archive',
  },
  {
    route: '/archive/electrical',
    title: 'Electrical Systems Archive',
    description:
      'Historical reference for Classic Mini electrical systems, wiring diagrams, and component specifications across different model years.',
    functions: [
      'Provide wiring diagrams by year',
      'Show electrical component specifications',
      'Display system evolution over time',
      'Include troubleshooting guides',
    ],
    category: 'archive',
  },
  {
    route: '/archive/weights',
    title: 'Weight Specifications Archive',
    description:
      'Historical database of Classic Mini weight specifications including curb weight, distribution, and load capacities by model and year.',
    functions: [
      'Display weight specifications by model',
      'Show weight distribution data',
      'Provide load capacity information',
      'Compare weights across different years',
    ],
    category: 'archive',
  },
  {
    route: '/archive/colors',
    title: 'Paint Colors Archive',
    description:
      'Comprehensive database of original Classic Mini paint colors with codes, names, and availability by year and model.',
    functions: [
      'Browse colors by year and model',
      'Search colors by name or code',
      'View color samples and descriptions',
      'Submit new color information',
    ],
    category: 'archive',
  },
  {
    route: '/archive/colors/contribute',
    title: 'Contribute Paint Colors',
    description: 'Form for submitting new paint color information to expand the Classic Mini color database.',
    functions: [
      'Submit new color information',
      'Upload color photos and samples',
      'Provide color code verification',
      'Add historical context for colors',
    ],
    category: 'archive',
  },
  {
    route: '/archive/documents?type=manual',
    title: 'Manuals Archive',
    description: "Collection of original Classic Mini owner's manuals, workshop manuals, and technical publications.",
    functions: [
      'Access digitized manuals by year',
      'Download PDF versions',
      'Search manual contents',
      'Submit missing manuals',
    ],
    category: 'archive',
  },
  {
    route: '/archive/registry',
    title: 'Mini Registry',
    description: 'Database of registered Classic Minis with owner information, specifications, and historical records.',
    functions: [
      'Search registered Minis',
      'Register your Mini',
      'View Mini histories and specifications',
      'Connect with other owners',
    ],
    category: 'archive',
  },
  {
    route: '/archive/registry/pending',
    title: 'Pending Registry Entries',
    description: 'Review queue for Classic Mini registry submissions awaiting approval and verification.',
    functions: [
      'Review pending submissions',
      'Verify Mini information',
      'Approve or reject entries',
      'Manage registry database',
    ],
    category: 'archive',
  },
  {
    route: '/archive/wheels',
    title: 'Wheels Archive',
    description:
      'Comprehensive database of Classic Mini wheels including original equipment, aftermarket options, and specifications.',
    functions: [
      'Browse wheels by type and era',
      'View wheel specifications and fitment',
      'Submit new wheel information',
      'Compare wheel options',
    ],
    category: 'archive',
  },
  {
    route: '/archive/wheels/submit',
    title: 'Submit Wheel Information',
    description: 'Form for contributing new wheel information and photos to expand the wheels database.',
    functions: [
      'Submit wheel specifications',
      'Upload wheel photos',
      'Provide fitment information',
      'Add historical context',
    ],
    category: 'archive',
  },
  {
    route: '/archive/documents?type=tuning',
    title: 'Tuning & Carburetors Archive',
    description:
      'Historical database of Classic Mini tuning documentation including carburetors, SU, Weber, and other tuning specifications.',
    functions: [
      'Browse tuning documents by type',
      'View carburetor specifications',
      'Access tuning information',
      'Submit tuning documentation',
    ],
    category: 'archive',
  },
  {
    route: '/archive/documents?type=advert',
    title: 'Classic Advertisements',
    description:
      'Collection of historical Classic Mini advertisements, brochures, and marketing materials from the BMC/British Leyland era.',
    functions: [
      'Browse historical advertisements',
      'View marketing materials by year',
      'Search ads by model or campaign',
      'Submit historical advertising materials',
    ],
    category: 'archive',
  },

  // Admin Pages
  {
    route: '/admin/wheels/review',
    title: 'Wheels Review Admin',
    description: 'Administrative interface for reviewing and approving wheel submissions to the wheels database.',
    functions: [
      'Review pending wheel submissions',
      'Approve or reject wheel entries',
      'Edit wheel information',
      'Manage wheel database',
    ],
    category: 'admin',
  },
  {
    route: '/admin/registry/review',
    title: 'Registry Review Admin',
    description: 'Administrative interface for reviewing and managing Classic Mini registry submissions.',
    functions: [
      'Review registry submissions',
      'Verify Mini information',
      'Approve or reject entries',
      'Manage registry database',
    ],
    category: 'admin',
  },
];

// Helper functions for working with page descriptions
export function getPageDescription(route: string): PageDescription | undefined {
  return PAGE_DESCRIPTIONS.find((page) => page.route === route);
}

export function getPagesByCategory(category: PageDescription['category']): PageDescription[] {
  return PAGE_DESCRIPTIONS.filter((page) => page.category === category);
}

// Categories for filtering and organization
export const PAGE_CATEGORIES = {
  HOME: 'home' as const,
  TECHNICAL: 'technical' as const,
  ARCHIVE: 'archive' as const,
  ADMIN: 'admin' as const,
  UTILITY: 'utility' as const,
} as const;

export type PageCategory = (typeof PAGE_CATEGORIES)[keyof typeof PAGE_CATEGORIES];
