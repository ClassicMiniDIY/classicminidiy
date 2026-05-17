export enum BREADCRUMB_VERSIONS {
  TECH = 'technical',
  ARCHIVE = 'archive',
  ADMIN = 'admin',
  PROFILE = 'profile',
}
export enum HERO_TYPES {
  HOME = 'home',
  TECH = 'tech',
  ARCHIVE = 'archive',
  BLOG = 'blog',
  MAPS = 'maps',
  CONTACT = 'contact',
}
export interface Post {
  title?: string;
  path?: string;
  image?: string;
  author?: string;
  date?: string;
  description?: string;
  slug?: string;
  code?: string;
  download?: string;
}

export interface ToolboxItem {
  titleKey: string;
  path: string;
  iconHtml: string;
  to: string;
  /** Design-system structured fields (used by HomeToolCard). */
  descKey?: string;
  kindKey?: string;
  iconName?: string;
  iconPrimary?: string;
  iconSecondary?: string;
  iconSecondaryOpacity?: number;
}
export interface MobileMenuItem {
  title: string;
  iconHtml: string;
  drawer: DRAWER_TYPES;
}

export enum DRAWER_TYPES {
  HOME = 'home',
  ARCHIVE = 'archive',
  TOOLBOX = 'toolbox',
}
export interface ArchiveItem {
  title: string;
  path: string;
  iconHtml: string;
  to: string;
  description: string;
  image: string;
  disabled?: boolean;
  /** Design-system structured fields (used by HomeToolCard). */
  titleKey?: string;
  descKey?: string;
  kindKey?: string;
  iconName?: string;
  iconPrimary?: string;
  iconSecondary?: string;
  iconSecondaryOpacity?: number;
}
export interface SocialItem {
  title: string;
  href: string;
  icon: string;
}

export const SocialShareData = {
  preUrl: 'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fclassicminidiy.com%2Ftechnical%2Fcolors%2F',
  postUrl: '%2F',
};

export const SocialItems: SocialItem[] = [
  { title: 'YouTube', href: 'https://youtube.com/c/classicminidiy', icon: 'fab fa-youtube' },
  { title: 'Patreon', href: 'https://patreon.com/classicminidiy', icon: 'fab fa-patreon' },
  { title: 'Instagram', href: 'https://instagram.com/classicminidiy59', icon: 'fab fa-instagram' },
  { title: 'Facebook', href: 'https://facebook.com/classicminidiy', icon: 'fab fa-facebook' },
];

export const MobileMenuItems: MobileMenuItem[] = [
  {
    title: 'Home',
    iconHtml: '<i class="fa-duotone fa-house" style="--fa-primary-color: #417bbe; --fa-secondary-color: #5f6166;"></i>',
    drawer: DRAWER_TYPES.HOME,
  },
  {
    title: 'Toolbox',
    iconHtml:
      '<i class="fa-duotone fa-light fa-toolbox" style="--fa-primary-color: #2f2f2f; --fa-primary-opacity: 1; --fa-secondary-color: #fe424d; --fa-secondary-opacity: 0.9;"></i>',
    drawer: DRAWER_TYPES.TOOLBOX,
  },
  {
    title: 'Archive',
    iconHtml:
      '<i class="fa-duotone fa-solid fa-books" style="--fa-primary-color: #71784e; --fa-secondary-color: #af6946; --fa-secondary-opacity: 0.7;"></i>',
    drawer: DRAWER_TYPES.ARCHIVE,
  },
];
export const ToolboxItems: ToolboxItem[] = [
  {
    titleKey: 'toolbox.torque_specs',
    descKey: 'toolbox.torque_specs_desc',
    kindKey: 'toolbox.kind.reference',
    path: '/technical/torque',
    to: '/technical/torque',
    iconName: 'fa-screwdriver-wrench',
    iconPrimary: '#ed7135',
    iconHtml:
      '<i class="fa-duotone fa-screwdriver-wrench" style="--fa-primary-color: #ed7135; --fa-secondary-color: #ed7135;"></i>',
  },
  {
    titleKey: 'toolbox.chassis_decoder',
    descKey: 'toolbox.chassis_decoder_desc',
    kindKey: 'toolbox.kind.decoder',
    path: '/technical/chassis-decoder',
    to: '/technical/chassis-decoder',
    iconName: 'fa-hashtag',
    iconHtml: '<i class="fa-duotone fa-hashtag" ></i>',
  },
  {
    titleKey: 'toolbox.engine_decoder',
    descKey: 'toolbox.engine_decoder_desc',
    kindKey: 'toolbox.kind.decoder',
    path: '/technical/engine-decoder',
    to: '/technical/engine-decoder',
    iconName: 'fa-engine',
    iconPrimary: '#A49966',
    iconSecondary: '#000000',
    iconSecondaryOpacity: 0.6,
    iconHtml:
      '<i class="fa-duotone fa-engine" style="--fa-primary-color: #A49966; --fa-secondary-color: #000000; --fa-secondary-opacity: 0.6;"></i>',
  },
  {
    titleKey: 'toolbox.needle_configurator',
    descKey: 'toolbox.needle_configurator_desc',
    kindKey: 'toolbox.kind.calculator',
    path: '/technical/needles',
    to: '/technical/needles',
    iconName: 'fa-chart-line',
    iconPrimary: '#b74d36',
    iconSecondary: '#417bbd',
    iconSecondaryOpacity: 0.8,
    iconHtml:
      '<i class="fa-duotone fa-chart-line" style="--fa-primary-color: #b74d36; --fa-secondary-color: #417bbd; --fa-secondary-opacity: 0.8;"></i>',
  },
  {
    titleKey: 'toolbox.gearbox_calculator',
    descKey: 'toolbox.gearbox_calculator_desc',
    kindKey: 'toolbox.kind.calculator',
    path: '/technical/gearing',
    to: '/technical/gearing',
    iconName: 'fa-gears',
    iconPrimary: '#c49031',
    iconHtml: '<i class="fa-duotone fa-gears" style="--fa-primary-color: #c49031; --fa-secondary-color: #c49031;"></i>',
  },
  {
    titleKey: 'toolbox.compression_calculator',
    descKey: 'toolbox.compression_calculator_desc',
    kindKey: 'toolbox.kind.calculator',
    path: '/technical/compression',
    to: '/technical/compression',
    iconName: 'fa-calculator',
    iconPrimary: '#859369',
    iconHtml:
      '<i class="fa-duotone fa-calculator" style="--fa-primary-color: #859369; --fa-secondary-color: #859369;"></i>',
  },
  {
    titleKey: 'toolbox.parts_equivalency',
    descKey: 'toolbox.parts_equivalency_desc',
    kindKey: 'toolbox.kind.reference',
    path: '/technical/parts',
    to: '/technical/parts',
    iconName: 'fa-magnifying-glass',
    iconPrimary: '#080808',
    iconSecondary: '#f3b140',
    iconSecondaryOpacity: 0.9,
    iconHtml:
      '<i class="fa-duotone fa-magnifying-glass" style="--fa-primary-color: #080808; --fa-secondary-color: #f3b140; --fa-secondary-opacity: .9;"></i>',
  },
  {
    titleKey: 'toolbox.common_clearances',
    descKey: 'toolbox.common_clearances_desc',
    kindKey: 'toolbox.kind.reference',
    path: '/technical/clearance',
    to: '/technical/clearance',
    iconName: 'fa-ruler-triangle',
    iconPrimary: '#433016',
    iconSecondary: '#ddbd8d',
    iconSecondaryOpacity: 1,
    iconHtml:
      '<i class="fa-duotone fa-ruler-triangle" style="--fa-primary-color: #433016; --fa-secondary-color: #ddbd8d; --fa-secondary-opacity: 1;"></i>',
  },
];

export const ArchiveItems: ArchiveItem[] = [
  {
    title: 'Mini Registry',
    titleKey: 'archive_items.mini_registry',
    descKey: 'archive_items.mini_registry_desc',
    kindKey: 'archive_items.kind.database',
    description: '',
    image: 'https://cmdiy-archive.s3.us-east-1.amazonaws.com/manuals/images/registry.jpg',
    path: '/archive/registry',
    to: '/archive/registry',
    iconName: 'fa-book-circle-arrow-up',
    iconSecondary: '#ED7135',
    iconSecondaryOpacity: 0.9,
    iconHtml:
      '<i class="fa-duotone fa-book-circle-arrow-up" style="--fa-secondary-color: #ED7135; --fa-secondary-opacity: 0.9;"></i>',
  },
  {
    title: 'Engine Sizes',
    titleKey: 'archive_items.engine_sizes',
    descKey: 'archive_items.engine_sizes_desc',
    kindKey: 'archive_items.kind.reference',
    description: '',
    image: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-dashboard-100.png',
    path: '/archive/engines',
    to: '/archive/engines',
    iconName: 'fa-engine',
    iconPrimary: '#59602e',
    iconSecondary: '#000000',
    iconSecondaryOpacity: 0.6,
    iconHtml:
      '<i class="fa-duotone fa-engine" style="--fa-primary-color: #59602e; --fa-secondary-color: #000000; --fa-secondary-opacity: 0.6;"></i>',
  },
  {
    title: 'Mini Weights',
    titleKey: 'archive_items.mini_weights',
    descKey: 'archive_items.mini_weights_desc',
    kindKey: 'archive_items.kind.reference',
    description: '',
    image: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-dashboard-100.png',
    path: '/archive/weights',
    to: '/archive/weights',
    iconName: 'fa-weight-hanging',
    iconPrimary: '#7dc978',
    iconSecondary: '#1f291f',
    iconSecondaryOpacity: 0.6,
    iconHtml:
      '<i class="fa-duotone fa-solid fa-weight-hanging" style="--fa-primary-color: #7dc978; --fa-secondary-color: #1f291f; --fa-secondary-opacity: 0.6;"></i>',
  },
  {
    title: 'Documents',
    titleKey: 'archive_items.documents',
    descKey: 'archive_items.documents_desc',
    kindKey: 'archive_items.kind.library',
    description: '',
    image: 'https://cmdiy-archive.s3.us-east-1.amazonaws.com/manuals/images/manuals.jpg',
    path: '/archive/documents',
    to: '/archive/documents',
    iconName: 'fa-books',
    iconPrimary: '#71784e',
    iconSecondary: '#af6946',
    iconSecondaryOpacity: 0.7,
    iconHtml:
      '<i class="fa-duotone fa-books" style="--fa-primary-color: #71784e; --fa-secondary-color: #af6946; --fa-secondary-opacity: 0.7;"></i>',
  },
  {
    title: 'Electrical Diagrams',
    titleKey: 'archive_items.electrical_diagrams',
    descKey: 'archive_items.electrical_diagrams_desc',
    kindKey: 'archive_items.kind.library',
    description: '',
    image: 'https://cmdiy-archive.s3.us-east-1.amazonaws.com/manuals/images/wiringDiagrams+copy.jpg',
    path: '/archive/electrical',
    to: '/archive/electrical',
    iconName: 'fa-car-battery',
    iconSecondary: '#ff424d',
    iconSecondaryOpacity: 0.9,
    iconHtml:
      '<i class="fa-duotone fa-car-battery" style="--fa-secondary-color: #ff424d; --fa-secondary-opacity: 0.9;"></i>',
  },
  {
    title: 'Wheel Library',
    titleKey: 'archive_items.wheel_library',
    descKey: 'archive_items.wheel_library_desc',
    kindKey: 'archive_items.kind.library',
    description: '',
    image:
      'https://classicminidiy.s3.us-east-1.amazonaws.com/wheels/uploads/1fbb6499-c021-5c93-8030-76aeb04b5400/IMG_4568.jpeg',
    path: '/archive/wheels',
    to: '/archive/wheels',
    iconName: 'fa-tire',
    iconPrimary: '#242424',
    iconSecondary: '#242424',
    iconHtml:
      '<i class="fa-duotone fa-tire fa-spin" style="--fa-primary-color: #242424; --fa-secondary-color: #242424;"></i>',
  },
  {
    title: 'Color Picker',
    titleKey: 'archive_items.color_picker',
    descKey: 'archive_items.color_picker_desc',
    kindKey: 'archive_items.kind.tool',
    description: '',
    image: '',
    path: '/archive/colors',
    to: '/archive/colors',
    iconName: 'fa-brush',
    iconPrimary: '#431f23',
    iconSecondary: '#c3a166',
    iconSecondaryOpacity: 0.8,
    iconHtml:
      '<i class="fa-duotone fa-brush" style="--fa-primary-color: #431f23; --fa-secondary-color: #c3a166; --fa-secondary-opacity: 0.8;"></i>',
  },
];

export const LandingPageToolboxItems = [
  {
    title: 'Torque Specs',
    image: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-blueprint-zoom-100.png',
    webp: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-blueprint-zoom-100.webp',
    to: '/technical/torque',
  },
  {
    title: 'Common Clearances',
    image: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-blueprint-zoom-100.png',
    webp: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-blueprint-zoom-100.webp',
    to: '/technical/clearance',
  },
  {
    title: 'Electrical Diagrams',
    image: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-lightning-bolt-100.png',
    webp: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-lightning-bolt-100.webp',
    to: '/technical/electrical',
  },
  {
    title: 'SU Needle Comparison',
    image: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-increase-100.png',
    webp: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-increase-100.webp',
    to: '/technical/needles',
  },
  {
    title: 'Gearbox Calculator',
    image: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-level-tool-100.png',
    webp: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-level-tool-100.webp',
    to: '/technical/gearing',
  },
  {
    title: 'Wheel Library',
    image: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-fiat-500-100.png',
    webp: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-fiat-500-100.webp',
    to: '/archive/wheels',
  },
  {
    title: 'Compression Ratio Calculator',
    image: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-calculator-100.png',
    webp: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-calculator-100.webp',
    to: '/technical/compression',
  },
  {
    title: 'Color Picker',
    image: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-color-palette-100.png',
    webp: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-color-palette-100.webp',
    to: '/archive/colors',
  },
  {
    title: 'Parts Equivalency',
    image: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-support-100.png',
    webp: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-support-100.webp',
    to: '/technical/parts',
  },
  {
    title: 'Compression Ratio Calculator',
    image: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-calculator-100.png',
    webp: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-calculator-100.webp',
    to: '/technical/compression',
  },
];
