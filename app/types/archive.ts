// Supabase row shapes (snake_case, matching DB columns)

export interface SupabaseColor {
  id: string;
  name: string;
  code: string;
  short_code: string;
  ditzler_ppg_code: string;
  dulux_code: string;
  hex_value: string;
  year_start: number | null;
  year_end: number | null;
  has_swatch: boolean;
  swatch_path: string | null;
  contributor_images: { url: string; contributor: string }[] | null;
  metadata: Record<string, any> | null;
  legacy_submitted_by: string | null;
  legacy_submitted_by_email: string | null;
  status: 'pending' | 'approved' | 'rejected';
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupabaseWheel {
  id: string;
  name: string;
  wheel_type: string;
  size: number;
  width: string;
  offset_value: string;
  bolt_pattern: string | null;
  center_bore: string | null;
  manufacturer: string | null;
  weight: string | null;
  notes: string | null;
  photos: string[] | null;
  metadata: Record<string, any> | null;
  legacy_submitted_by: string | null;
  legacy_submitted_by_email: string | null;
  status: 'pending' | 'approved' | 'rejected';
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupabaseRegistryEntry {
  id: string;
  year: number;
  model: string;
  body_number: string;
  engine_number: string;
  engine_size: number | null;
  body_type: string | null;
  color: string | null;
  trim: string | null;
  build_date: string | null;
  owner: string | null;
  location: string | null;
  notes: string | null;
  photos: string[] | null;
  legacy_submitted_by: string | null;
  legacy_submitted_by_email: string | null;
  status: 'pending' | 'approved' | 'rejected';
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupabaseArchiveDocument {
  id: string;
  slug: string;
  legacy_slug: string | null;
  type: 'manual' | 'advert' | 'catalogue' | 'tuning' | 'electrical';
  collection_id: string | null;
  title: string;
  description: string | null;
  code: string | null;
  author: string | null;
  year: number | null;
  file_path: string | null;
  thumbnail_path: string | null;
  metadata: Record<string, any> | null;
  sort_order: number;
  status: 'pending' | 'approved' | 'rejected';
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupabaseSubmissionQueue {
  id: string;
  type: 'new_item' | 'edit_suggestion' | 'new_collection';
  target_type: 'document' | 'collection' | 'registry' | 'color' | 'wheel';
  target_id: string | null;
  submitted_by: string | null;
  status: 'pending' | 'approved' | 'rejected';
  data: Record<string, any>;
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}
