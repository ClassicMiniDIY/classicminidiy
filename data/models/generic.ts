export enum BREADCRUMB_VERSIONS {
  TECH = 'technical',
  ARCHIVE = 'archive',
  ADMIN = 'admin',
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
  { title: 'Classic Mini DIY on Youtube', href: 'https://youtube.com/c/classicminidiy', icon: 'fab fa-youtube' },
  { title: 'Classic Mini DIY on Patreon', href: 'https://patreon.com/classicminidiy', icon: 'fab fa-patreon' },
  { title: 'Classic Mini DIY on Instagram', href: 'https://instagram.com/classicminidiy59', icon: 'fab fa-instagram' },
  { title: 'Classic Mini DIY on Facebook', href: 'https://facebook.com/classicminidiy', icon: 'fab fa-facebook' },
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
    path: '/technical/torque',
    iconHtml:
      '<i class="fa-duotone fa-screwdriver-wrench" style="--fa-primary-color: #ed7135; --fa-secondary-color: #ed7135;"></i>',
    to: '/technical/torque',
  },
  {
    titleKey: 'toolbox.chassis_decoder',
    path: '/technical/chassis-decoder',
    iconHtml: '<i class="fa-duotone fa-hashtag" ></i>',
    to: '/technical/chassis-decoder',
  },
  {
    titleKey: 'toolbox.engine_decoder',
    path: '/technical/engine-decoder',
    iconHtml:
      '<i class="fa-duotone fa-engine" style="--fa-primary-color: #A49966; --fa-secondary-color: #000000; --fa-secondary-opacity: 0.6;"></i>',
    to: '/technical/engine-decoder',
  },
  {
    titleKey: 'toolbox.needle_configurator',
    path: '/technical/needles',
    iconHtml:
      '<i class="fa-duotone fa-chart-line" style="--fa-primary-color: #b74d36; --fa-secondary-color: #417bbd; --fa-secondary-opacity: 0.8;"></i>',
    to: '/technical/needles',
  },
  {
    titleKey: 'toolbox.gearbox_calculator',
    path: '/technical/gearing',
    iconHtml: '<i class="fa-duotone fa-gears" style="--fa-primary-color: #c49031; --fa-secondary-color: #c49031;"></i>',
    to: '/technical/gearing',
  },
  {
    titleKey: 'toolbox.compression_calculator',
    path: '/technical/compression',
    iconHtml:
      '<i class="fa-duotone fa-calculator" style="--fa-primary-color: #859369; --fa-secondary-color: #859369;"></i>',
    to: '/technical/compression',
  },
  {
    titleKey: 'toolbox.parts_equivalency',
    path: '/technical/parts',
    iconHtml:
      '<i class="fa-duotone fa-magnifying-glass" style="--fa-primary-color: #080808; --fa-secondary-color: #f3b140; --fa-secondary-opacity: .9;"></i>',
    to: '/technical/parts',
  },
  {
    titleKey: 'toolbox.common_clearances',
    path: '/technical/clearance',
    iconHtml:
      '<i class="fa-duotone fa-ruler-triangle" style="--fa-primary-color: #433016; --fa-secondary-color: #ddbd8d; --fa-secondary-opacity: 1;"></i>',
    to: '/technical/clearance',
  },
];

export const ArchiveItems: ArchiveItem[] = [
  {
    title: 'Mini Registry',
    description: '',
    image: 'https://cmdiy-archive.s3.us-east-1.amazonaws.com/manuals/images/registry.jpg',
    path: '/archive/registry',
    iconHtml:
      '<i class="fa-duotone fa-book-circle-arrow-up" style="--fa-secondary-color: #ED7135; --fa-secondary-opacity: 0.9;"></i>',
    to: '/archive/registry',
  },
  {
    title: 'Engine Sizes',
    description: '',
    image: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-dashboard-100.png',
    path: '/archive/engines',
    iconHtml:
      '<i class="fa-duotone fa-engine" style="--fa-primary-color: #59602e; --fa-secondary-color: #000000; --fa-secondary-opacity: 0.6;"></i>',
    to: '/archive/engines',
  },
  {
    title: 'Mini Weights',
    description: '',
    image: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-dashboard-100.png',
    path: '/archive/weights',
    iconHtml:
      '<i class="fa-duotone fa-solid fa-weight-hanging" style="--fa-primary-color: #7dc978; --fa-secondary-color: #1f291f; --fa-secondary-opacity: 0.6;"></i>',
    to: '/archive/weights',
  },
  {
    title: 'Documents',
    description: '',
    image: 'https://cmdiy-archive.s3.us-east-1.amazonaws.com/manuals/images/manuals.jpg',
    path: '/archive/documents',
    iconHtml:
      '<i class="fa-duotone fa-books" style="--fa-primary-color: #71784e; --fa-secondary-color: #af6946; --fa-secondary-opacity: 0.7;"></i>',
    to: '/archive/documents',
  },
  {
    title: 'Electrical Diagrams',
    description: '',
    image: 'https://cmdiy-archive.s3.us-east-1.amazonaws.com/manuals/images/wiringDiagrams+copy.jpg',
    path: '/archive/electrical',
    iconHtml:
      '<i class="fa-duotone fa-car-battery" style="--fa-secondary-color: #ff424d; --fa-secondary-opacity: 0.9;"></i>',
    to: '/archive/electrical',
  },
  {
    title: 'Wheel Library',
    description: '',
    image:
      'https://classicminidiy.s3.us-east-1.amazonaws.com/wheels/uploads/1fbb6499-c021-5c93-8030-76aeb04b5400/IMG_4568.jpeg',
    path: '/archive/wheels',
    iconHtml:
      '<i class="fa-duotone fa-tire fa-spin" style="--fa-primary-color: #242424; --fa-secondary-color: #242424;"></i>',
    to: '/archive/wheels',
  },
  {
    title: 'Color Picker',
    description: '',
    image: '',
    path: '/archive/colors',
    iconHtml:
      '<i class="fa-duotone fa-brush" style="--fa-primary-color: #431f23; --fa-secondary-color: #c3a166; --fa-secondary-opacity: 0.8;"></i>',
    to: '/archive/colors',
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
