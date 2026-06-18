/**
 * Classic Mini Specifications Reference
 * Common specifications, options, and terminology for Classic Minis
 */

import type { Database } from '~~/types/database';

type GearboxType = Database['public']['Enums']['gearbox_type_enum'];
type RestorationStatus = Database['public']['Enums']['restoration_status_enum'];
type CarbType = Database['public']['Enums']['carb_type_enum'];
type WheelType = Database['public']['Enums']['wheel_type_enum'];
type BrakeType = Database['public']['Enums']['brake_type_enum'];
type WindowType = Database['public']['Enums']['window_type_enum'];
type BumperType = Database['public']['Enums']['bumper_type_enum'];
type ExhaustType = Database['public']['Enums']['exhaust_type_enum'];
type SeatType = Database['public']['Enums']['seat_type_enum'];
type DashboardType = Database['public']['Enums']['dashboard_type_enum'];
type SteeringWheelType = Database['public']['Enums']['steering_wheel_type_enum'];
type Variant = Database['public']['Enums']['variant_enum'];
type RustCondition = Database['public']['Enums']['rust_condition_enum'];
type UndersideCondition = Database['public']['Enums']['underside_condition_enum'];

/**
 * Model Options
 * Classic Mini model names for selection dropdowns
 */
export const MODEL_OPTIONS = [
  { label: 'Mini', value: 'Mini' },
  { label: 'Seven', value: 'Seven' },
  { label: 'Mini-Minor', value: 'Mini-Minor' },
  { label: 'Cooper', value: 'Cooper' },
  { label: 'Cooper S', value: 'Cooper S' },
  { label: 'Clubman', value: 'Clubman' },
  { label: 'Clubman Estate', value: 'Clubman Estate' },
  { label: 'Mini 1000', value: 'Mini 1000' },
  { label: '1275 GT', value: '1275 GT' },
  { label: 'Elf', value: 'Elf' },
  { label: 'Hornet', value: 'Hornet' },
  { label: 'Moke', value: 'Moke' },
  { label: 'Countryman', value: 'Countryman' },
  { label: 'Traveller', value: 'Traveller' },
  { label: 'Van', value: 'Van' },
  { label: 'Pickup', value: 'Pickup' },
  { label: 'Other', value: 'Other' },
] as const;

/**
 * Gearbox Types
 * Classic Mini-specific gearbox configurations
 */
export const GEARBOX_TYPES = [
  { value: 'magic_wand', label: 'Magic Wand', description: 'Pre-1968 floor-mounted shifter' },
  { value: '3_synchro_remote', label: '3 Synchro Remote', description: '3-speed with remote shifter' },
  { value: '4_synchro_remote', label: '4 Synchro Remote', description: '4-speed with remote shifter' },
  { value: 'rod_change', label: 'Rod Change', description: 'Rod linkage gearbox' },
  { value: 'automatic', label: 'Automatic', description: 'Automatic transmission' },
] as const satisfies readonly { value: GearboxType; label: string; description?: string }[];

/**
 * Restoration Status Options
 */
export const RESTORATION_STATUS = [
  { value: 'original', label: 'Original', description: 'Unrestored, original condition' },
  {
    value: 'partially_restored',
    label: 'Partially Restored',
    description: 'Some restoration work completed',
  },
  { value: 'fully_restored', label: 'Fully Restored', description: 'Comprehensive restoration' },
  { value: 'restomod', label: 'Restomod', description: 'Restored with modern upgrades' },
  { value: 'project', label: 'Project', description: 'Requires restoration work' },
  { value: 'scrap', label: 'Scrap', description: 'For parts or extensive rebuild' },
] as const satisfies readonly { value: RestorationStatus; label: string; description?: string }[];

/**
 * Carburetor Types
 */
export const CARB_TYPES = [
  { value: 'single_su', label: 'Single SU' },
  { value: 'twin_su', label: 'Twin SU' },
  { value: 'weber', label: 'Weber' },
  { value: 'stromberg', label: 'Stromberg' },
  { value: 'fuel_injection', label: 'Fuel Injection' },
  { value: 'other', label: 'Other' },
] as const satisfies readonly { value: CarbType; label: string }[];

/**
 * Wheel Sizes
 */
export const WHEEL_SIZES = [
  { value: '10', label: '10"', description: 'Standard early Mini wheels' },
  { value: '12', label: '12"', description: 'Later Mini standard size' },
  { value: '13', label: '13"', description: 'Common upgrade size' },
  { value: '14', label: '14"', description: 'Larger aftermarket wheels' },
] as const;

/**
 * Wheel Types
 */
export const WHEEL_TYPES = [
  { value: 'standard', label: 'Standard Steel' },
  { value: 'minilite', label: 'Minilite' },
  { value: 'cooper_s', label: 'Cooper S' },
  { value: 'revolution', label: 'Revolution' },
  { value: 'rose_petal', label: 'Rose Petal' },
  { value: 'other', label: 'Other Aftermarket' },
] as const satisfies readonly { value: WheelType; label: string }[];

/**
 * Brake Types
 */
export const BRAKE_TYPES = [
  { value: 'standard_drum', label: 'Standard Drum', description: '4-wheel drum brakes' },
  { value: 'disc_front', label: 'Disc Front', description: 'Front disc, rear drum' },
  { value: 'four_wheel_disc', label: 'Four-Wheel Disc', description: 'Disc brakes all around' },
] as const satisfies readonly { value: BrakeType; label: string; description?: string }[];

/**
 * Window Types
 */
export const WINDOW_TYPES = [
  { value: 'sliding', label: 'Sliding', description: 'Original sliding windows' },
  { value: 'wind_up', label: 'Wind-up', description: 'Later wind-up windows' },
] as const satisfies readonly { value: WindowType; label: string; description?: string }[];

/**
 * Bumper Types
 */
export const BUMPER_TYPES = [
  { value: 'chrome_standard', label: 'Chrome Standard' },
  { value: 'chrome_overriders', label: 'Chrome with Overriders' },
  { value: 'plastic', label: 'Plastic' },
  { value: 'deleted', label: 'Deleted/None' },
] as const satisfies readonly { value: BumperType; label: string }[];

/**
 * Exhaust Types
 */
export const EXHAUST_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'sportex', label: 'Sportex' },
  { value: 'maniflow', label: 'Maniflow' },
  { value: 'stainless', label: 'Stainless Steel' },
  { value: 'custom', label: 'Custom' },
  { value: 'other', label: 'Other' },
] as const satisfies readonly { value: ExhaustType; label: string }[];

/**
 * Seat Types
 */
export const SEAT_TYPES = [
  { value: 'original', label: 'Original' },
  { value: 'cobra', label: 'Cobra' },
  { value: 'recaro', label: 'Recaro' },
  { value: 'cooper_s', label: 'Cooper S' },
  { value: 'custom', label: 'Custom' },
  { value: 'other', label: 'Other' },
] as const satisfies readonly { value: SeatType; label: string }[];

/**
 * Dashboard Types
 */
export const DASHBOARD_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'wood_veneer', label: 'Wood Veneer' },
  { value: 'rally', label: 'Rally' },
  { value: 'carbon_fiber', label: 'Carbon Fiber' },
  { value: 'other', label: 'Other' },
] as const satisfies readonly { value: DashboardType; label: string }[];

/**
 * Steering Wheel Types
 */
export const STEERING_WHEEL_TYPES = [
  { value: 'original', label: 'Original' },
  { value: 'momo', label: 'Momo' },
  { value: 'moto_lita', label: 'Moto-Lita' },
  { value: 'wood_rim', label: 'Wood Rim' },
  { value: 'sports', label: 'Sports' },
  { value: 'custom', label: 'Custom' },
  { value: 'other', label: 'Other' },
] as const satisfies readonly { value: SteeringWheelType; label: string }[];

/**
 * Classic Mini Variants
 */
export const MINI_VARIANTS = [
  { value: 'standard', label: 'Standard Mini' },
  { value: 'cooper', label: 'Cooper' },
  { value: 'cooper_s', label: 'Cooper S' },
  { value: '1275_gt', label: '1275 GT' },
  { value: 'clubman', label: 'Clubman' },
  { value: 'clubman_estate', label: 'Clubman Estate' },
  { value: 'van', label: 'Van' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'moke', label: 'Moke' },
  { value: 'riley_elf', label: 'Riley Elf' },
  { value: 'wolseley_hornet', label: 'Wolseley Hornet' },
  { value: 'other', label: 'Other' },
] as const satisfies readonly { value: Variant; label: string }[];

/**
 * Factory Options (checkboxes)
 */
export const FACTORY_OPTIONS = [
  { value: 'hydrolastic', label: 'Hydrolastic Suspension' },
  { value: 'heated_rear_window', label: 'Heated Rear Window' },
  { value: 'servo_brakes', label: 'Servo-Assisted Brakes' },
  { value: 'radio', label: 'Original Radio' },
  { value: 'fog_lights', label: 'Fog Lights' },
  { value: 'wood_dash', label: 'Wood Veneer Dashboard' },
  { value: 'reclining_seats', label: 'Reclining Seats' },
  { value: 'center_console', label: 'Center Console' },
  { value: 'heater', label: 'Heater' },
  { value: 'passenger_sun_visor', label: 'Passenger Sun Visor' },
  { value: 'wing_mirrors', label: 'Wing Mirrors' },
  { value: 'boot_carpet', label: 'Boot Carpet' },
  { value: 'rev_counter', label: 'Rev Counter' },
  { value: 'oil_cooler', label: 'Oil Cooler' },
] as const;

/**
 * Rust Condition Assessment
 */
export const RUST_CONDITIONS = [
  { value: 'none_visible', label: 'None Visible', description: 'No visible rust' },
  { value: 'minor_surface', label: 'Minor Surface', description: 'Light surface rust only' },
  { value: 'moderate', label: 'Moderate', description: 'Some rust areas present' },
  { value: 'significant', label: 'Significant', description: 'Extensive rust requiring attention' },
] as const satisfies readonly { value: RustCondition; label: string; description?: string }[];

/**
 * Underside Condition
 */
export const UNDERSIDE_CONDITIONS = [
  { value: 'excellent', label: 'Excellent', description: 'Clean, no rust, well-maintained' },
  { value: 'good', label: 'Good', description: 'Minor imperfections, solid overall' },
  { value: 'fair', label: 'Fair', description: 'Some work needed, structurally sound' },
  { value: 'needs_work', label: 'Needs Work', description: 'Requires significant attention' },
] as const satisfies readonly { value: UndersideCondition; label: string; description?: string }[];

/**
 * Helper function to get label by value
 */
export function getSpecLabel<T extends readonly { value: string; label: string }[]>(specs: T, value: string): string {
  const spec = specs.find((s) => s.value === value);
  if (spec) return spec.label;
  // Fallback: convert snake_case to Title Case
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Helper function to get all values
 */
export function getSpecValues<T extends readonly { value: string }[]>(specs: T): string[] {
  return specs.map((s) => s.value);
}
