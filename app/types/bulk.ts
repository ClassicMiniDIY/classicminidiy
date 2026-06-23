import type { CurrencyCode } from '~/composables/useCurrency';
import type { Database } from '~~/types/database';
import type { OptimizeResult } from '~/utils/imageOptimizer';

type PartCondition = Database['public']['Enums']['part_condition_enum'];
type OemOrAftermarket = Database['public']['Enums']['oem_or_aftermarket_enum'];
type PartsSubcategory = Database['public']['Enums']['parts_subcategory_enum'];

export interface BulkListingItem {
  id: string;
  title: string;
  price: number | null;
  currency: CurrencyCode;
  description: string;
  partCondition: PartCondition | '';
  partNumber: string;
  oemOrAftermarket: OemOrAftermarket | '';
  quantityAvailable: number;
  fitsModels: string[];
  parts_subcategory: PartsSubcategory | '';
  shippingAvailable: boolean;
  shipsTo: string;
  tier: 'free' | 'paid';
  location: {
    city: string;
    state_province: string;
    country: string;
    postal_code: string;
    latitude: number | null;
    longitude: number | null;
    formatted_address: string;
  };
  photos: OptimizeResult[];
  isValid: boolean;
  errors: Record<string, string>;
  isExpanded: boolean;
  createdListingId?: string;
}
