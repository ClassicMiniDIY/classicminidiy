export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      archive_documents: {
        Row: {
          author: string | null
          code: string | null
          collection_id: string | null
          created_at: string
          description: string | null
          file_path: string | null
          id: string
          legacy_slug: string | null
          metadata: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          sort_order: number | null
          status: Database["public"]["Enums"]["moderation_status_enum"]
          submitted_by: string | null
          thumbnail_path: string | null
          title: string
          type: Database["public"]["Enums"]["document_type_enum"]
          updated_at: string
          year: number | null
        }
        Insert: {
          author?: string | null
          code?: string | null
          collection_id?: string | null
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          legacy_slug?: string | null
          metadata?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug: string
          sort_order?: number | null
          status?: Database["public"]["Enums"]["moderation_status_enum"]
          submitted_by?: string | null
          thumbnail_path?: string | null
          title: string
          type: Database["public"]["Enums"]["document_type_enum"]
          updated_at?: string
          year?: number | null
        }
        Update: {
          author?: string | null
          code?: string | null
          collection_id?: string | null
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          legacy_slug?: string | null
          metadata?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string
          sort_order?: number | null
          status?: Database["public"]["Enums"]["moderation_status_enum"]
          submitted_by?: string | null
          thumbnail_path?: string | null
          title?: string
          type?: Database["public"]["Enums"]["document_type_enum"]
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "archive_documents_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "document_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archive_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archive_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archive_documents_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archive_documents_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_migration_log: {
        Row: {
          created_at: string
          email: string | null
          error_message: string | null
          firebase_data: Json | null
          firebase_uid: string
          id: string
          migrated_at: string | null
          migration_status: string
          provider: string | null
          supabase_user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          error_message?: string | null
          firebase_data?: Json | null
          firebase_uid: string
          id?: string
          migrated_at?: string | null
          migration_status?: string
          provider?: string | null
          supabase_user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          error_message?: string | null
          firebase_data?: Json | null
          firebase_uid?: string
          id?: string
          migrated_at?: string | null
          migration_status?: string
          provider?: string | null
          supabase_user_id?: string | null
        }
        Relationships: []
      }
      colors: {
        Row: {
          code: string | null
          contributor_images: Json | null
          created_at: string
          ditzler_ppg_code: string | null
          dulux_code: string | null
          has_swatch: boolean
          hex_value: string | null
          id: string
          legacy_submitted_by: string | null
          legacy_submitted_by_email: string | null
          metadata: Json | null
          name: string
          reviewed_at: string | null
          reviewed_by: string | null
          short_code: string | null
          status: Database["public"]["Enums"]["moderation_status_enum"]
          submitted_by: string | null
          swatch_path: string | null
          updated_at: string
          year_end: number | null
          year_start: number | null
        }
        Insert: {
          code?: string | null
          contributor_images?: Json | null
          created_at?: string
          ditzler_ppg_code?: string | null
          dulux_code?: string | null
          has_swatch?: boolean
          hex_value?: string | null
          id?: string
          legacy_submitted_by?: string | null
          legacy_submitted_by_email?: string | null
          metadata?: Json | null
          name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          short_code?: string | null
          status?: Database["public"]["Enums"]["moderation_status_enum"]
          submitted_by?: string | null
          swatch_path?: string | null
          updated_at?: string
          year_end?: number | null
          year_start?: number | null
        }
        Update: {
          code?: string | null
          contributor_images?: Json | null
          created_at?: string
          ditzler_ppg_code?: string | null
          dulux_code?: string | null
          has_swatch?: boolean
          hex_value?: string | null
          id?: string
          legacy_submitted_by?: string | null
          legacy_submitted_by_email?: string | null
          metadata?: Json | null
          name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          short_code?: string | null
          status?: Database["public"]["Enums"]["moderation_status_enum"]
          submitted_by?: string | null
          swatch_path?: string | null
          updated_at?: string
          year_end?: number | null
          year_start?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "colors_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colors_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colors_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colors_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contributions: {
        Row: {
          action: Database["public"]["Enums"]["contribution_action_enum"]
          created_at: string
          details: string | null
          id: string
          target_id: string
          target_title: string | null
          target_type: Database["public"]["Enums"]["target_type_enum"]
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["contribution_action_enum"]
          created_at?: string
          details?: string | null
          id?: string
          target_id: string
          target_title?: string | null
          target_type: Database["public"]["Enums"]["target_type_enum"]
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["contribution_action_enum"]
          created_at?: string
          details?: string | null
          id?: string
          target_id?: string
          target_title?: string | null
          target_type?: Database["public"]["Enums"]["target_type_enum"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contributions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          buyer_id: string
          buyer_unread_count: number | null
          created_at: string | null
          id: string
          last_message_at: string | null
          listing_id: string | null
          seller_id: string
          seller_unread_count: number | null
          updated_at: string | null
          wanted_post_id: string | null
        }
        Insert: {
          buyer_id: string
          buyer_unread_count?: number | null
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          listing_id?: string | null
          seller_id: string
          seller_unread_count?: number | null
          updated_at?: string | null
          wanted_post_id?: string | null
        }
        Update: {
          buyer_id?: string
          buyer_unread_count?: number | null
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          listing_id?: string | null
          seller_id?: string
          seller_unread_count?: number | null
          updated_at?: string | null
          wanted_post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_wanted_post_id_fkey"
            columns: ["wanted_post_id"]
            isOneToOne: false
            referencedRelation: "wanted_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      discord_links: {
        Row: {
          claim_issued_at: string | null
          claim_token_jti: string | null
          claimed_at: string | null
          created_at: string
          discord_user_id: string | null
          ghost_email: string
          ghost_member_id: string | null
          id: string
          last_error: string | null
          revoked_at: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          claim_issued_at?: string | null
          claim_token_jti?: string | null
          claimed_at?: string | null
          created_at?: string
          discord_user_id?: string | null
          ghost_email: string
          ghost_member_id?: string | null
          id?: string
          last_error?: string | null
          revoked_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          claim_issued_at?: string | null
          claim_token_jti?: string | null
          claimed_at?: string | null
          created_at?: string
          discord_user_id?: string | null
          ghost_email?: string
          ghost_member_id?: string | null
          id?: string
          last_error?: string | null
          revoked_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      document_collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          status: Database["public"]["Enums"]["moderation_status_enum"]
          submitted_by: string | null
          thumbnail_path: string | null
          title: string
          type: Database["public"]["Enums"]["document_type_enum"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug: string
          status?: Database["public"]["Enums"]["moderation_status_enum"]
          submitted_by?: string | null
          thumbnail_path?: string | null
          title: string
          type: Database["public"]["Enums"]["document_type_enum"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["moderation_status_enum"]
          submitted_by?: string | null
          thumbnail_path?: string | null
          title?: string
          type?: Database["public"]["Enums"]["document_type_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_collections_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_collections_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_collections_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_collections_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_suppressions: {
        Row: {
          created_at: string | null
          details: string | null
          email: string
          id: string
          reason: string
          source: string | null
        }
        Insert: {
          created_at?: string | null
          details?: string | null
          email: string
          id?: string
          reason: string
          source?: string | null
        }
        Update: {
          created_at?: string | null
          details?: string | null
          email?: string
          id?: string
          reason?: string
          source?: string | null
        }
        Relationships: []
      }
      entitlement_grants: {
        Row: {
          action: string
          channel: string
          created_at: string
          detail: Json | null
          id: number
          success: boolean
          user_id: string
        }
        Insert: {
          action: string
          channel: string
          created_at?: string
          detail?: Json | null
          id?: never
          success: boolean
          user_id: string
        }
        Update: {
          action?: string
          channel?: string
          created_at?: string
          detail?: Json | null
          id?: never
          success?: boolean
          user_id?: string
        }
        Relationships: []
      }
      entitlement_outbox: {
        Row: {
          attempts: number
          claimed_at: string | null
          desired_state: string
          id: number
          last_error: string | null
          occurred_at: string
          processed_at: string | null
          reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          desired_state: string
          id?: never
          last_error?: string | null
          occurred_at?: string
          processed_at?: string | null
          reason?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          desired_state?: string
          id?: never
          last_error?: string | null
          occurred_at?: string
          processed_at?: string | null
          reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      external_listing_likes: {
        Row: {
          created_at: string | null
          external_listing_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          external_listing_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          external_listing_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_listing_likes_external_listing_id_fkey"
            columns: ["external_listing_id"]
            isOneToOne: false
            referencedRelation: "external_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_listing_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_listing_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_listing_watchlist: {
        Row: {
          created_at: string | null
          external_listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          external_listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          external_listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_listing_watchlist_external_listing_id_fkey"
            columns: ["external_listing_id"]
            isOneToOne: false
            referencedRelation: "external_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_listing_watchlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_listing_watchlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_listings: {
        Row: {
          admin_notes: string | null
          auction_end_time: string | null
          category: string | null
          comment_count: number | null
          created_at: string | null
          description: string | null
          editor_commentary: string | null
          id: string
          is_editors_pick: boolean | null
          like_count: number | null
          metadata_fetched_at: string | null
          model: string | null
          og_description: string | null
          og_image_url: string | null
          price: number | null
          price_label: string | null
          published_at: string | null
          slug: string
          source_site: string
          source_url: string
          status: string
          submitted_by: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          year: number | null
        }
        Insert: {
          admin_notes?: string | null
          auction_end_time?: string | null
          category?: string | null
          comment_count?: number | null
          created_at?: string | null
          description?: string | null
          editor_commentary?: string | null
          id?: string
          is_editors_pick?: boolean | null
          like_count?: number | null
          metadata_fetched_at?: string | null
          model?: string | null
          og_description?: string | null
          og_image_url?: string | null
          price?: number | null
          price_label?: string | null
          published_at?: string | null
          slug: string
          source_site: string
          source_url: string
          status?: string
          submitted_by?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          year?: number | null
        }
        Update: {
          admin_notes?: string | null
          auction_end_time?: string | null
          category?: string | null
          comment_count?: number | null
          created_at?: string | null
          description?: string | null
          editor_commentary?: string | null
          id?: string
          is_editors_pick?: boolean | null
          like_count?: number | null
          metadata_fetched_at?: string | null
          model?: string | null
          og_description?: string | null
          og_image_url?: string | null
          price?: number | null
          price_label?: string | null
          published_at?: string | null
          slug?: string
          source_site?: string
          source_url?: string
          status?: string
          submitted_by?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "external_listings_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_listings_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_model_images: {
        Row: {
          alt_text: string | null
          created_at: string
          external_model_id: string
          id: string
          is_primary: boolean
          sort_order: number
          storage_path: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          external_model_id: string
          id?: string
          is_primary?: boolean
          sort_order?: number
          storage_path: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          external_model_id?: string
          id?: string
          is_primary?: boolean
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_model_images_external_model_id_fkey"
            columns: ["external_model_id"]
            isOneToOne: false
            referencedRelation: "external_models"
            referencedColumns: ["id"]
          },
        ]
      }
      external_model_likes: {
        Row: {
          created_at: string
          external_model_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          external_model_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          external_model_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_model_likes_external_model_id_fkey"
            columns: ["external_model_id"]
            isOneToOne: false
            referencedRelation: "external_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_model_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_model_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_models: {
        Row: {
          admin_notes: string | null
          category_slug: string
          click_count: number
          comment_count: number
          commercial_use_allowed: boolean | null
          created_at: string
          description: string | null
          id: string
          is_featured: boolean
          like_count: number
          metadata_fetched_at: string | null
          print_settings: Json
          published_at: string | null
          rejection_reason: string | null
          remixes_allowed: boolean | null
          reviewed_at: string | null
          reviewed_by: string | null
          search: unknown
          slug: string
          source_author_name: string | null
          source_author_url: string | null
          source_external_id: string | null
          source_license: string | null
          source_site: string
          source_url: string
          status: string
          submitted_by: string | null
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          category_slug: string
          click_count?: number
          comment_count?: number
          commercial_use_allowed?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          like_count?: number
          metadata_fetched_at?: string | null
          print_settings?: Json
          published_at?: string | null
          rejection_reason?: string | null
          remixes_allowed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          search?: unknown
          slug: string
          source_author_name?: string | null
          source_author_url?: string | null
          source_external_id?: string | null
          source_license?: string | null
          source_site: string
          source_url: string
          status?: string
          submitted_by?: string | null
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          category_slug?: string
          click_count?: number
          comment_count?: number
          commercial_use_allowed?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          like_count?: number
          metadata_fetched_at?: string | null
          print_settings?: Json
          published_at?: string | null
          rejection_reason?: string | null
          remixes_allowed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          search?: unknown
          slug?: string
          source_author_name?: string | null
          source_author_url?: string | null
          source_external_id?: string | null
          source_license?: string | null
          source_site?: string
          source_url?: string
          status?: string
          submitted_by?: string | null
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_models_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "model_categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "external_models_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_models_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_models_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_models_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_comments: {
        Row: {
          content: string
          created_at: string | null
          external_listing_id: string | null
          id: string
          is_flagged: boolean | null
          is_question: boolean | null
          is_seller_response: boolean | null
          listing_id: string | null
          moderation_status: string | null
          parent_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          external_listing_id?: string | null
          id?: string
          is_flagged?: boolean | null
          is_question?: boolean | null
          is_seller_response?: boolean | null
          listing_id?: string | null
          moderation_status?: string | null
          parent_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          external_listing_id?: string | null
          id?: string
          is_flagged?: boolean | null
          is_question?: boolean | null
          is_seller_response?: boolean | null
          listing_id?: string | null
          moderation_status?: string | null
          parent_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_comments_external_listing_id_fkey"
            columns: ["external_listing_id"]
            isOneToOne: false
            referencedRelation: "external_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_comments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "listing_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_history: {
        Row: {
          change_type: string
          created_at: string | null
          edit_id: string | null
          field_name: string
          id: string
          listing_id: string
          new_value: string | null
          old_value: string | null
          user_id: string
        }
        Insert: {
          change_type: string
          created_at?: string | null
          edit_id?: string | null
          field_name: string
          id?: string
          listing_id: string
          new_value?: string | null
          old_value?: string | null
          user_id: string
        }
        Update: {
          change_type?: string
          created_at?: string | null
          edit_id?: string | null
          field_name?: string
          id?: string
          listing_id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_photos: {
        Row: {
          caption: string | null
          category: string | null
          created_at: string | null
          display_order: number
          id: string
          is_primary: boolean | null
          listing_id: string
          storage_path: string
        }
        Insert: {
          caption?: string | null
          category?: string | null
          created_at?: string | null
          display_order?: number
          id?: string
          is_primary?: boolean | null
          listing_id: string
          storage_path: string
        }
        Update: {
          caption?: string | null
          category?: string | null
          created_at?: string | null
          display_order?: number
          id?: string
          is_primary?: boolean | null
          listing_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_photos_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_promotions: {
        Row: {
          amount_paid: number
          created_at: string | null
          features: Json | null
          id: string
          listing_id: string
          payment_method: string | null
          payment_reference: string | null
          tier: string
        }
        Insert: {
          amount_paid: number
          created_at?: string | null
          features?: Json | null
          id?: string
          listing_id: string
          payment_method?: string | null
          payment_reference?: string | null
          tier: string
        }
        Update: {
          amount_paid?: number
          created_at?: string | null
          features?: Json | null
          id?: string
          listing_id?: string
          payment_method?: string | null
          payment_reference?: string | null
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_promotions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          brake_type: Database["public"]["Enums"]["brake_type_enum"] | null
          build_date: string | null
          bumper_type: Database["public"]["Enums"]["bumper_type_enum"] | null
          carb_type: Database["public"]["Enums"]["carb_type_enum"] | null
          casing_stamps: string | null
          chassis_number: string | null
          city: string | null
          color: string | null
          condition:
            | Database["public"]["Enums"]["listing_condition_enum"]
            | null
          country: string | null
          created_at: string | null
          currency: string | null
          dashboard_type:
            | Database["public"]["Enums"]["dashboard_type_enum"]
            | null
          description: string
          email_blast_sent: boolean | null
          engine_displacement: string | null
          engine_mods: string | null
          engine_number: string | null
          engine_plate_details: string | null
          engine_series:
            | Database["public"]["Enums"]["engine_series_enum"]
            | null
          engine_size: string | null
          estimated_delivery_days_max: number | null
          estimated_delivery_days_min: number | null
          exhaust_type: Database["public"]["Enums"]["exhaust_type_enum"] | null
          factory_options: string[] | null
          featured_until: string | null
          final_price: number | null
          fits_models: string[] | null
          formatted_address: string | null
          gearbox_type: Database["public"]["Enums"]["gearbox_type_enum"] | null
          has_heritage_cert: boolean | null
          has_service_history: boolean | null
          has_stripes: boolean | null
          has_sunroof: boolean | null
          heritage_cert_details: string | null
          heritage_cert_number: string | null
          id: string
          interior_color: string | null
          last_restoration_date: string | null
          latitude: number | null
          listing_category:
            | Database["public"]["Enums"]["listing_category_enum"]
            | null
          listing_type: Database["public"]["Enums"]["listing_type_enum"]
          location: string
          longitude: number | null
          manufacturer: Database["public"]["Enums"]["manufacturer_enum"] | null
          matching_numbers: boolean | null
          mileage: number | null
          model: string | null
          oem_or_aftermarket:
            | Database["public"]["Enums"]["oem_or_aftermarket_enum"]
            | null
          original_color: string | null
          other_modifications: string | null
          package_dimensions: string | null
          package_weight_kg: number | null
          paid_amount: number | null
          part_condition:
            | Database["public"]["Enums"]["part_condition_enum"]
            | null
          part_number: string | null
          parts_subcategory:
            | Database["public"]["Enums"]["parts_subcategory_enum"]
            | null
          payment_status:
            | Database["public"]["Enums"]["payment_status_enum"]
            | null
          performance_upgrades: string | null
          postal_code: string | null
          previous_owners_count: number | null
          previous_price: number | null
          price: number | null
          price_updated_at: string | null
          promoted_on_social: boolean | null
          promoted_on_social_at: string | null
          published_at: string | null
          quantity_available: number | null
          restoration_details: string | null
          restoration_status:
            | Database["public"]["Enums"]["restoration_status_enum"]
            | null
          roof_color: string | null
          rust_condition:
            | Database["public"]["Enums"]["rust_condition_enum"]
            | null
          seat_type: Database["public"]["Enums"]["seat_type_enum"] | null
          shipping_available: boolean | null
          shipping_cost: number | null
          shipping_cost_international: number | null
          shipping_methods: string[] | null
          ships_to: string | null
          ships_to_countries: string[] | null
          slug: string
          sold_date: string | null
          state_province: string | null
          status: Database["public"]["Enums"]["listing_status_enum"]
          steering_wheel_type:
            | Database["public"]["Enums"]["steering_wheel_type_enum"]
            | null
          stripe_color: string | null
          suspension_mods: string | null
          tier: Database["public"]["Enums"]["listing_tier_enum"] | null
          tier_payment_id: string | null
          title: string
          tracking_carrier: string | null
          tracking_number: string | null
          transmission: Database["public"]["Enums"]["gearbox_type_enum"] | null
          underside_condition:
            | Database["public"]["Enums"]["underside_condition_enum"]
            | null
          updated_at: string | null
          user_id: string
          variant: Database["public"]["Enums"]["variant_enum"] | null
          views_count: number | null
          vin_number: string | null
          wheel_size: string | null
          wheel_type: Database["public"]["Enums"]["wheel_type_enum"] | null
          window_type: Database["public"]["Enums"]["window_type_enum"] | null
          year: number | null
        }
        Insert: {
          brake_type?: Database["public"]["Enums"]["brake_type_enum"] | null
          build_date?: string | null
          bumper_type?: Database["public"]["Enums"]["bumper_type_enum"] | null
          carb_type?: Database["public"]["Enums"]["carb_type_enum"] | null
          casing_stamps?: string | null
          chassis_number?: string | null
          city?: string | null
          color?: string | null
          condition?:
            | Database["public"]["Enums"]["listing_condition_enum"]
            | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          dashboard_type?:
            | Database["public"]["Enums"]["dashboard_type_enum"]
            | null
          description: string
          email_blast_sent?: boolean | null
          engine_displacement?: string | null
          engine_mods?: string | null
          engine_number?: string | null
          engine_plate_details?: string | null
          engine_series?:
            | Database["public"]["Enums"]["engine_series_enum"]
            | null
          engine_size?: string | null
          estimated_delivery_days_max?: number | null
          estimated_delivery_days_min?: number | null
          exhaust_type?: Database["public"]["Enums"]["exhaust_type_enum"] | null
          factory_options?: string[] | null
          featured_until?: string | null
          final_price?: number | null
          fits_models?: string[] | null
          formatted_address?: string | null
          gearbox_type?: Database["public"]["Enums"]["gearbox_type_enum"] | null
          has_heritage_cert?: boolean | null
          has_service_history?: boolean | null
          has_stripes?: boolean | null
          has_sunroof?: boolean | null
          heritage_cert_details?: string | null
          heritage_cert_number?: string | null
          id?: string
          interior_color?: string | null
          last_restoration_date?: string | null
          latitude?: number | null
          listing_category?:
            | Database["public"]["Enums"]["listing_category_enum"]
            | null
          listing_type?: Database["public"]["Enums"]["listing_type_enum"]
          location: string
          longitude?: number | null
          manufacturer?: Database["public"]["Enums"]["manufacturer_enum"] | null
          matching_numbers?: boolean | null
          mileage?: number | null
          model?: string | null
          oem_or_aftermarket?:
            | Database["public"]["Enums"]["oem_or_aftermarket_enum"]
            | null
          original_color?: string | null
          other_modifications?: string | null
          package_dimensions?: string | null
          package_weight_kg?: number | null
          paid_amount?: number | null
          part_condition?:
            | Database["public"]["Enums"]["part_condition_enum"]
            | null
          part_number?: string | null
          parts_subcategory?:
            | Database["public"]["Enums"]["parts_subcategory_enum"]
            | null
          payment_status?:
            | Database["public"]["Enums"]["payment_status_enum"]
            | null
          performance_upgrades?: string | null
          postal_code?: string | null
          previous_owners_count?: number | null
          previous_price?: number | null
          price?: number | null
          price_updated_at?: string | null
          promoted_on_social?: boolean | null
          promoted_on_social_at?: string | null
          published_at?: string | null
          quantity_available?: number | null
          restoration_details?: string | null
          restoration_status?:
            | Database["public"]["Enums"]["restoration_status_enum"]
            | null
          roof_color?: string | null
          rust_condition?:
            | Database["public"]["Enums"]["rust_condition_enum"]
            | null
          seat_type?: Database["public"]["Enums"]["seat_type_enum"] | null
          shipping_available?: boolean | null
          shipping_cost?: number | null
          shipping_cost_international?: number | null
          shipping_methods?: string[] | null
          ships_to?: string | null
          ships_to_countries?: string[] | null
          slug: string
          sold_date?: string | null
          state_province?: string | null
          status?: Database["public"]["Enums"]["listing_status_enum"]
          steering_wheel_type?:
            | Database["public"]["Enums"]["steering_wheel_type_enum"]
            | null
          stripe_color?: string | null
          suspension_mods?: string | null
          tier?: Database["public"]["Enums"]["listing_tier_enum"] | null
          tier_payment_id?: string | null
          title: string
          tracking_carrier?: string | null
          tracking_number?: string | null
          transmission?: Database["public"]["Enums"]["gearbox_type_enum"] | null
          underside_condition?:
            | Database["public"]["Enums"]["underside_condition_enum"]
            | null
          updated_at?: string | null
          user_id: string
          variant?: Database["public"]["Enums"]["variant_enum"] | null
          views_count?: number | null
          vin_number?: string | null
          wheel_size?: string | null
          wheel_type?: Database["public"]["Enums"]["wheel_type_enum"] | null
          window_type?: Database["public"]["Enums"]["window_type_enum"] | null
          year?: number | null
        }
        Update: {
          brake_type?: Database["public"]["Enums"]["brake_type_enum"] | null
          build_date?: string | null
          bumper_type?: Database["public"]["Enums"]["bumper_type_enum"] | null
          carb_type?: Database["public"]["Enums"]["carb_type_enum"] | null
          casing_stamps?: string | null
          chassis_number?: string | null
          city?: string | null
          color?: string | null
          condition?:
            | Database["public"]["Enums"]["listing_condition_enum"]
            | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          dashboard_type?:
            | Database["public"]["Enums"]["dashboard_type_enum"]
            | null
          description?: string
          email_blast_sent?: boolean | null
          engine_displacement?: string | null
          engine_mods?: string | null
          engine_number?: string | null
          engine_plate_details?: string | null
          engine_series?:
            | Database["public"]["Enums"]["engine_series_enum"]
            | null
          engine_size?: string | null
          estimated_delivery_days_max?: number | null
          estimated_delivery_days_min?: number | null
          exhaust_type?: Database["public"]["Enums"]["exhaust_type_enum"] | null
          factory_options?: string[] | null
          featured_until?: string | null
          final_price?: number | null
          fits_models?: string[] | null
          formatted_address?: string | null
          gearbox_type?: Database["public"]["Enums"]["gearbox_type_enum"] | null
          has_heritage_cert?: boolean | null
          has_service_history?: boolean | null
          has_stripes?: boolean | null
          has_sunroof?: boolean | null
          heritage_cert_details?: string | null
          heritage_cert_number?: string | null
          id?: string
          interior_color?: string | null
          last_restoration_date?: string | null
          latitude?: number | null
          listing_category?:
            | Database["public"]["Enums"]["listing_category_enum"]
            | null
          listing_type?: Database["public"]["Enums"]["listing_type_enum"]
          location?: string
          longitude?: number | null
          manufacturer?: Database["public"]["Enums"]["manufacturer_enum"] | null
          matching_numbers?: boolean | null
          mileage?: number | null
          model?: string | null
          oem_or_aftermarket?:
            | Database["public"]["Enums"]["oem_or_aftermarket_enum"]
            | null
          original_color?: string | null
          other_modifications?: string | null
          package_dimensions?: string | null
          package_weight_kg?: number | null
          paid_amount?: number | null
          part_condition?:
            | Database["public"]["Enums"]["part_condition_enum"]
            | null
          part_number?: string | null
          parts_subcategory?:
            | Database["public"]["Enums"]["parts_subcategory_enum"]
            | null
          payment_status?:
            | Database["public"]["Enums"]["payment_status_enum"]
            | null
          performance_upgrades?: string | null
          postal_code?: string | null
          previous_owners_count?: number | null
          previous_price?: number | null
          price?: number | null
          price_updated_at?: string | null
          promoted_on_social?: boolean | null
          promoted_on_social_at?: string | null
          published_at?: string | null
          quantity_available?: number | null
          restoration_details?: string | null
          restoration_status?:
            | Database["public"]["Enums"]["restoration_status_enum"]
            | null
          roof_color?: string | null
          rust_condition?:
            | Database["public"]["Enums"]["rust_condition_enum"]
            | null
          seat_type?: Database["public"]["Enums"]["seat_type_enum"] | null
          shipping_available?: boolean | null
          shipping_cost?: number | null
          shipping_cost_international?: number | null
          shipping_methods?: string[] | null
          ships_to?: string | null
          ships_to_countries?: string[] | null
          slug?: string
          sold_date?: string | null
          state_province?: string | null
          status?: Database["public"]["Enums"]["listing_status_enum"]
          steering_wheel_type?:
            | Database["public"]["Enums"]["steering_wheel_type_enum"]
            | null
          stripe_color?: string | null
          suspension_mods?: string | null
          tier?: Database["public"]["Enums"]["listing_tier_enum"] | null
          tier_payment_id?: string | null
          title?: string
          tracking_carrier?: string | null
          tracking_number?: string | null
          transmission?: Database["public"]["Enums"]["gearbox_type_enum"] | null
          underside_condition?:
            | Database["public"]["Enums"]["underside_condition_enum"]
            | null
          updated_at?: string | null
          user_id?: string
          variant?: Database["public"]["Enums"]["variant_enum"] | null
          views_count?: number | null
          vin_number?: string | null
          wheel_size?: string | null
          wheel_type?: Database["public"]["Enums"]["wheel_type_enum"] | null
          window_type?: Database["public"]["Enums"]["window_type_enum"] | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_instances: {
        Row: {
          completed_at: string | null
          completed_task_ids: string[]
          created_at: string
          due_date: string | null
          id: string
          interval_id: string
          status: Database["public"]["Enums"]["maintenance_instance_status"]
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_task_ids?: string[]
          created_at?: string
          due_date?: string | null
          id: string
          interval_id: string
          status?: Database["public"]["Enums"]["maintenance_instance_status"]
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          completed_at?: string | null
          completed_task_ids?: string[]
          created_at?: string
          due_date?: string | null
          id?: string
          interval_id?: string
          status?: Database["public"]["Enums"]["maintenance_instance_status"]
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_instances_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_records: {
        Row: {
          completed_at: string
          created_at: string
          custom_task_description: string | null
          custom_task_name: string | null
          id: string
          instance_id: string | null
          interval_id: string
          is_custom_task: boolean
          mileage: number | null
          notes: string | null
          task_id: string | null
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          completed_at: string
          created_at?: string
          custom_task_description?: string | null
          custom_task_name?: string | null
          id: string
          instance_id?: string | null
          interval_id: string
          is_custom_task?: boolean
          mileage?: number | null
          notes?: string | null
          task_id?: string | null
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          custom_task_description?: string | null
          custom_task_name?: string | null
          id?: string
          instance_id?: string | null
          interval_id?: string
          is_custom_task?: boolean
          mileage?: number | null
          notes?: string | null
          task_id?: string | null
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      message_attachments: {
        Row: {
          created_at: string
          expires_at: string
          height: number | null
          id: string
          message_id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          width: number | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          height?: number | null
          id?: string
          message_id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          width?: number | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          height?: number | null
          id?: string
          message_id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          deleted_at: string | null
          id: string
          is_read: boolean | null
          is_system_message: boolean
          moderation_issues: string[] | null
          moderation_status: string | null
          report_reason: string | null
          reported_at: string | null
          reported_by: string[] | null
          sender_id: string
          updated_at: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_read?: boolean | null
          is_system_message?: boolean
          moderation_issues?: string[] | null
          moderation_status?: string | null
          report_reason?: string | null
          reported_at?: string | null
          reported_by?: string[] | null
          sender_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_read?: boolean | null
          is_system_message?: boolean
          moderation_issues?: string[] | null
          moderation_status?: string | null
          report_reason?: string | null
          reported_at?: string | null
          reported_by?: string[] | null
          sender_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      model_categories: {
        Row: {
          icon: string | null
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          icon?: string | null
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          icon?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      model_comments: {
        Row: {
          content: string
          created_at: string
          edited_at: string | null
          id: string
          is_flagged: boolean
          model_id: string
          moderation_status: string
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_flagged?: boolean
          model_id: string
          moderation_status?: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_flagged?: boolean
          model_id?: string
          moderation_status?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_comments_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "model_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      model_downloads: {
        Row: {
          created_at: string
          day_bucket: string
          file_id: string
          id: string
          model_id: string
          user_id: string
          version_id: string
        }
        Insert: {
          created_at?: string
          day_bucket?: string
          file_id: string
          id?: string
          model_id: string
          user_id: string
          version_id: string
        }
        Update: {
          created_at?: string
          day_bucket?: string
          file_id?: string
          id?: string
          model_id?: string
          user_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_downloads_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "model_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_downloads_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_downloads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_downloads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_downloads_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "model_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      model_files: {
        Row: {
          created_at: string
          download_count: number
          file_ext: string
          file_name: string
          id: string
          is_renderable: boolean
          kind: string
          model_id: string
          s3_key: string
          sha256: string | null
          size_bytes: number
          upload_status: string
          version_id: string
        }
        Insert: {
          created_at?: string
          download_count?: number
          file_ext: string
          file_name: string
          id?: string
          is_renderable?: boolean
          kind?: string
          model_id: string
          s3_key: string
          sha256?: string | null
          size_bytes: number
          upload_status?: string
          version_id: string
        }
        Update: {
          created_at?: string
          download_count?: number
          file_ext?: string
          file_name?: string
          id?: string
          is_renderable?: boolean
          kind?: string
          model_id?: string
          s3_key?: string
          sha256?: string | null
          size_bytes?: number
          upload_status?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_files_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_files_version_model_fkey"
            columns: ["version_id", "model_id"]
            isOneToOne: false
            referencedRelation: "model_versions"
            referencedColumns: ["id", "model_id"]
          },
        ]
      }
      model_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          is_auto_thumbnail: boolean
          is_primary: boolean
          model_id: string
          sort_order: number
          storage_path: string
          version_id: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_auto_thumbnail?: boolean
          is_primary?: boolean
          model_id: string
          sort_order?: number
          storage_path: string
          version_id?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_auto_thumbnail?: boolean
          is_primary?: boolean
          model_id?: string
          sort_order?: number
          storage_path?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_images_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_images_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "model_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      model_licenses: {
        Row: {
          allows_commercial_use: boolean
          allows_derivatives: boolean
          allows_file_redistribution: boolean
          code: string
          is_active: boolean
          is_paid_license: boolean
          license_text: string | null
          name: string
          requires_attribution: boolean
          requires_share_alike: boolean
          sort_order: number
          url: string | null
        }
        Insert: {
          allows_commercial_use: boolean
          allows_derivatives: boolean
          allows_file_redistribution: boolean
          code: string
          is_active?: boolean
          is_paid_license?: boolean
          license_text?: string | null
          name: string
          requires_attribution: boolean
          requires_share_alike?: boolean
          sort_order?: number
          url?: string | null
        }
        Update: {
          allows_commercial_use?: boolean
          allows_derivatives?: boolean
          allows_file_redistribution?: boolean
          code?: string
          is_active?: boolean
          is_paid_license?: boolean
          license_text?: string | null
          name?: string
          requires_attribution?: boolean
          requires_share_alike?: boolean
          sort_order?: number
          url?: string | null
        }
        Relationships: []
      }
      model_likes: {
        Row: {
          created_at: string
          id: string
          model_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_likes_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      model_purchases: {
        Row: {
          amount_cents: number
          application_fee_cents: number
          buyer_id: string
          commission_bps: number
          created_at: string
          currency: string
          id: string
          kind: string
          model_id: string
          refunded_at: string | null
          seller_id: string
          status: string
          stripe_account_id: string
          stripe_checkout_session_id: string
          stripe_payment_intent_id: string
        }
        Insert: {
          amount_cents: number
          application_fee_cents?: number
          buyer_id: string
          commission_bps: number
          created_at?: string
          currency?: string
          id?: string
          kind: string
          model_id: string
          refunded_at?: string | null
          seller_id: string
          status?: string
          stripe_account_id: string
          stripe_checkout_session_id: string
          stripe_payment_intent_id: string
        }
        Update: {
          amount_cents?: number
          application_fee_cents?: number
          buyer_id?: string
          commission_bps?: number
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          model_id?: string
          refunded_at?: string | null
          seller_id?: string
          status?: string
          stripe_account_id?: string
          stripe_checkout_session_id?: string
          stripe_payment_intent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_purchases_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_purchases_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_purchases_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_purchases_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_purchases_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      model_reports: {
        Row: {
          created_at: string
          details: string
          id: string
          model_id: string
          reason: string
          reporter_email: string | null
          reporter_id: string | null
          resolution_action: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          details: string
          id?: string
          model_id: string
          reason: string
          reporter_email?: string | null
          reporter_id?: string | null
          resolution_action?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          model_id?: string
          reason?: string
          reporter_email?: string | null
          reporter_id?: string | null
          resolution_action?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_reports_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      model_versions: {
        Row: {
          assembly: Json
          changelog: string | null
          created_at: string
          hardware_bom: Json
          id: string
          label: string
          license_code: string | null
          model_id: string
          print_settings: Json
          published_at: string | null
          rejection_reason: string | null
          status: string
          updated_at: string
          version_number: number
        }
        Insert: {
          assembly?: Json
          changelog?: string | null
          created_at?: string
          hardware_bom?: Json
          id?: string
          label?: string
          license_code?: string | null
          model_id: string
          print_settings?: Json
          published_at?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          version_number: number
        }
        Update: {
          assembly?: Json
          changelog?: string | null
          created_at?: string
          hardware_bom?: Json
          id?: string
          label?: string
          license_code?: string | null
          model_id?: string
          print_settings?: Json
          published_at?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "model_versions_license_code_fkey"
            columns: ["license_code"]
            isOneToOne: false
            referencedRelation: "model_licenses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "model_versions_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      models: {
        Row: {
          category_slug: string
          comment_count: number
          created_at: string
          currency: string
          current_version_id: string | null
          description: string | null
          download_count: number
          id: string
          is_featured: boolean
          license_code: string
          like_count: number
          min_price_cents: number | null
          owner_id: string
          price_cents: number | null
          pricing_mode: string
          purchase_count: number
          rejection_reason: string | null
          remix_of_model_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          safety_ack: boolean
          safety_critical: boolean
          search: unknown
          slug: string
          source_url: string | null
          status: string
          suggested_price_cents: number | null
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
          version_count: number
        }
        Insert: {
          category_slug: string
          comment_count?: number
          created_at?: string
          currency?: string
          current_version_id?: string | null
          description?: string | null
          download_count?: number
          id?: string
          is_featured?: boolean
          license_code: string
          like_count?: number
          min_price_cents?: number | null
          owner_id: string
          price_cents?: number | null
          pricing_mode?: string
          purchase_count?: number
          rejection_reason?: string | null
          remix_of_model_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          safety_ack?: boolean
          safety_critical?: boolean
          search?: unknown
          slug: string
          source_url?: string | null
          status?: string
          suggested_price_cents?: number | null
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          version_count?: number
        }
        Update: {
          category_slug?: string
          comment_count?: number
          created_at?: string
          currency?: string
          current_version_id?: string | null
          description?: string | null
          download_count?: number
          id?: string
          is_featured?: boolean
          license_code?: string
          like_count?: number
          min_price_cents?: number | null
          owner_id?: string
          price_cents?: number | null
          pricing_mode?: string
          purchase_count?: number
          rejection_reason?: string | null
          remix_of_model_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          safety_ack?: boolean
          safety_critical?: boolean
          search?: unknown
          slug?: string
          source_url?: string | null
          status?: string
          suggested_price_cents?: number | null
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          version_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "models_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "model_categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "models_current_version_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "model_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "models_license_code_fkey"
            columns: ["license_code"]
            isOneToOne: false
            referencedRelation: "model_licenses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "models_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "models_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "models_remix_of_model_id_fkey"
            columns: ["remix_of_model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "models_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "models_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_sends: {
        Row: {
          created_at: string | null
          error_message: string | null
          free_count: number
          id: string
          listing_ids: string[]
          premium_count: number
          recipient_count: number
          sent_at: string | null
          sent_by: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          free_count?: number
          id?: string
          listing_ids?: string[]
          premium_count?: number
          recipient_count?: number
          sent_at?: string | null
          sent_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          free_count?: number
          id?: string
          listing_ids?: string[]
          premium_count?: number
          recipient_count?: number
          sent_at?: string | null
          sent_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_sends_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_sends_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          email_comment_replies: boolean | null
          email_listing_status: boolean | null
          email_new_comments: boolean | null
          email_new_messages: boolean | null
          email_saved_search_matches: boolean | null
          email_submission_updates: boolean | null
          email_weekly_digest: boolean | null
          push_new_messages: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_comment_replies?: boolean | null
          email_listing_status?: boolean | null
          email_new_comments?: boolean | null
          email_new_messages?: boolean | null
          email_saved_search_matches?: boolean | null
          email_submission_updates?: boolean | null
          email_weekly_digest?: boolean | null
          push_new_messages?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_comment_replies?: boolean | null
          email_listing_status?: boolean | null
          email_new_comments?: boolean | null
          email_new_messages?: boolean | null
          email_saved_search_matches?: boolean | null
          email_submission_updates?: boolean | null
          email_weekly_digest?: boolean | null
          push_new_messages?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          batch_key: string
          channel: string
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          retry_count: number
          status: string
          user_id: string
        }
        Insert: {
          batch_key: string
          channel?: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          retry_count?: number
          status?: string
          user_id: string
        }
        Update: {
          batch_key?: string
          channel?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          retry_count?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_external_memberships: {
        Row: {
          claim_issued_at: string | null
          claim_jti: string | null
          claimed_at: string | null
          claimed_user_id: string | null
          created_at: string
          email: string
          expires_at: string | null
          external_ref: string
          id: number
          provider: string
          raw: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          claim_issued_at?: string | null
          claim_jti?: string | null
          claimed_at?: string | null
          claimed_user_id?: string | null
          created_at?: string
          email: string
          expires_at?: string | null
          external_ref: string
          id?: never
          provider: string
          raw?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          claim_issued_at?: string | null
          claim_jti?: string | null
          claimed_at?: string | null
          claimed_user_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string | null
          external_ref?: string
          id?: never
          provider?: string
          raw?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_private: {
        Row: {
          auth_provider: string | null
          created_at: string
          email: string | null
          firebase_uid: string | null
          is_admin: boolean
          updated_at: string
          user_id: string
          warning_count: number
        }
        Insert: {
          auth_provider?: string | null
          created_at?: string
          email?: string | null
          firebase_uid?: string | null
          is_admin?: boolean
          updated_at?: string
          user_id: string
          warning_count?: number
        }
        Update: {
          auth_provider?: string | null
          created_at?: string
          email?: string | null
          firebase_uid?: string | null
          is_admin?: boolean
          updated_at?: string
          user_id?: string
          warning_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_private_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_private_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved_submissions: number
          auth_provider: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          firebase_uid: string | null
          id: string
          is_admin: boolean | null
          is_banned: boolean | null
          is_public: boolean
          location: string | null
          onboarding_completed: boolean
          onboarding_completed_app: boolean | null
          preferred_currency: string | null
          profile_completed_at: string | null
          rejected_submissions: number
          show_vehicles: boolean
          social_links: Json
          total_submissions: number
          trust_level: Database["public"]["Enums"]["trust_level_enum"]
          unit_system: string | null
          updated_at: string | null
          username: string | null
          warning_count: number | null
        }
        Insert: {
          approved_submissions?: number
          auth_provider?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          firebase_uid?: string | null
          id: string
          is_admin?: boolean | null
          is_banned?: boolean | null
          is_public?: boolean
          location?: string | null
          onboarding_completed?: boolean
          onboarding_completed_app?: boolean | null
          preferred_currency?: string | null
          profile_completed_at?: string | null
          rejected_submissions?: number
          show_vehicles?: boolean
          social_links?: Json
          total_submissions?: number
          trust_level?: Database["public"]["Enums"]["trust_level_enum"]
          unit_system?: string | null
          updated_at?: string | null
          username?: string | null
          warning_count?: number | null
        }
        Update: {
          approved_submissions?: number
          auth_provider?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          firebase_uid?: string | null
          id?: string
          is_admin?: boolean | null
          is_banned?: boolean | null
          is_public?: boolean
          location?: string | null
          onboarding_completed?: boolean
          onboarding_completed_app?: boolean | null
          preferred_currency?: string | null
          profile_completed_at?: string | null
          rejected_submissions?: number
          show_vehicles?: boolean
          social_links?: Json
          total_submissions?: number
          trust_level?: Database["public"]["Enums"]["trust_level_enum"]
          unit_system?: string | null
          updated_at?: string | null
          username?: string | null
          warning_count?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys: Json
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys: Json
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys?: Json
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_entries: {
        Row: {
          body_number: string | null
          body_type: string | null
          build_date: string | null
          color: string | null
          created_at: string
          engine_number: string | null
          engine_size: number | null
          id: string
          legacy_submitted_by: string | null
          legacy_submitted_by_email: string | null
          location: string | null
          model: string
          notes: string | null
          owner: string | null
          photos: string[] | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["moderation_status_enum"]
          submitted_by: string | null
          trim: string | null
          updated_at: string
          year: number
        }
        Insert: {
          body_number?: string | null
          body_type?: string | null
          build_date?: string | null
          color?: string | null
          created_at?: string
          engine_number?: string | null
          engine_size?: number | null
          id?: string
          legacy_submitted_by?: string | null
          legacy_submitted_by_email?: string | null
          location?: string | null
          model: string
          notes?: string | null
          owner?: string | null
          photos?: string[] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["moderation_status_enum"]
          submitted_by?: string | null
          trim?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          body_number?: string | null
          body_type?: string | null
          build_date?: string | null
          color?: string | null
          created_at?: string
          engine_number?: string | null
          engine_size?: number | null
          id?: string
          legacy_submitted_by?: string | null
          legacy_submitted_by_email?: string | null
          location?: string | null
          model?: string
          notes?: string | null
          owner?: string | null
          photos?: string[] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["moderation_status_enum"]
          submitted_by?: string | null
          trim?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "registry_entries_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_entries_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_entries_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_entries_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_alignment_configs: {
        Row: {
          created_at: string
          front_camber: number
          front_caster: number
          front_toe: number
          id: string
          is_public: boolean
          journal: Json
          name: string
          notes: string | null
          preset: string | null
          rear_camber: number
          rear_toe: number
          updated_at: string
          user_id: string
          wheel_size: string | null
        }
        Insert: {
          created_at?: string
          front_camber: number
          front_caster: number
          front_toe: number
          id?: string
          is_public?: boolean
          journal?: Json
          name: string
          notes?: string | null
          preset?: string | null
          rear_camber: number
          rear_toe: number
          updated_at?: string
          user_id: string
          wheel_size?: string | null
        }
        Update: {
          created_at?: string
          front_camber?: number
          front_caster?: number
          front_toe?: number
          id?: string
          is_public?: boolean
          journal?: Json
          name?: string
          notes?: string | null
          preset?: string | null
          rear_camber?: number
          rear_toe?: number
          updated_at?: string
          user_id?: string
          wheel_size?: string | null
        }
        Relationships: []
      }
      saved_gear_configs: {
        Row: {
          created_at: string
          drop_gear: string
          final_drive: string
          gearset: string
          id: string
          is_public: boolean
          max_rpm: number
          name: string
          speedo_drive: string
          tire: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          drop_gear: string
          final_drive: string
          gearset: string
          id?: string
          is_public?: boolean
          max_rpm: number
          name: string
          speedo_drive: string
          tire: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          drop_gear?: string
          final_drive?: string
          gearset?: string
          id?: string
          is_public?: boolean
          max_rpm?: number
          name?: string
          speedo_drive?: string
          tire?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          created_at: string
          filters: Json
          id: string
          is_active: boolean
          last_notified_at: string | null
          name: string
          notify_email: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          is_active?: boolean
          last_notified_at?: string | null
          name: string
          notify_email?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          is_active?: boolean
          last_notified_at?: string | null
          name?: string
          notify_email?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_accounts: {
        Row: {
          charges_enabled: boolean
          country: string | null
          created_at: string
          default_currency: string | null
          details_submitted: boolean
          payouts_enabled: boolean
          selling_disabled: boolean
          stripe_account_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          charges_enabled?: boolean
          country?: string | null
          created_at?: string
          default_currency?: string | null
          details_submitted?: boolean
          payouts_enabled?: boolean
          selling_disabled?: boolean
          stripe_account_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          charges_enabled?: boolean
          country?: string | null
          created_at?: string
          default_currency?: string | null
          details_submitted?: boolean
          payouts_enabled?: boolean
          selling_disabled?: boolean
          stripe_account_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_announcements: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          is_enabled: boolean
          title: string | null
          type: Database["public"]["Enums"]["announcement_type_enum"]
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          is_enabled?: boolean
          title?: string | null
          type?: Database["public"]["Enums"]["announcement_type_enum"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          is_enabled?: boolean
          title?: string | null
          type?: Database["public"]["Enums"]["announcement_type_enum"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_announcements_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_announcements_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          created_at: string | null
          id: number
          show_example_listings: boolean
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          show_example_listings?: boolean
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          show_example_listings?: boolean
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_queue: {
        Row: {
          created_at: string
          data: Json
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["moderation_status_enum"]
          submitted_by: string
          target_id: string | null
          target_type: Database["public"]["Enums"]["target_type_enum"]
          type: Database["public"]["Enums"]["submission_type_enum"]
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["moderation_status_enum"]
          submitted_by: string
          target_id?: string | null
          target_type: Database["public"]["Enums"]["target_type_enum"]
          type: Database["public"]["Enums"]["submission_type_enum"]
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["moderation_status_enum"]
          submitted_by?: string
          target_id?: string | null
          target_type?: Database["public"]["Enums"]["target_type_enum"]
          type?: Database["public"]["Enums"]["submission_type_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "submission_queue_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_queue_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_queue_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_queue_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          apple_original_transaction_id: string | null
          apple_product_id: string | null
          cancelled_at: string | null
          comp_granted_by: string | null
          comp_note: string | null
          created_at: string
          expires_at: string | null
          external_ref: string | null
          google_order_id: string | null
          google_purchase_token: string | null
          id: string
          last_verified_at: string | null
          platform: string
          product_id: string
          raw_receipt: Json | null
          starts_at: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          apple_original_transaction_id?: string | null
          apple_product_id?: string | null
          cancelled_at?: string | null
          comp_granted_by?: string | null
          comp_note?: string | null
          created_at?: string
          expires_at?: string | null
          external_ref?: string | null
          google_order_id?: string | null
          google_purchase_token?: string | null
          id?: string
          last_verified_at?: string | null
          platform: string
          product_id?: string
          raw_receipt?: Json | null
          starts_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          apple_original_transaction_id?: string | null
          apple_product_id?: string | null
          cancelled_at?: string | null
          comp_granted_by?: string | null
          comp_note?: string | null
          created_at?: string
          expires_at?: string | null
          external_ref?: string | null
          google_order_id?: string | null
          google_purchase_token?: string | null
          id?: string
          last_verified_at?: string | null
          platform?: string
          product_id?: string
          raw_receipt?: Json | null
          starts_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          color: Database["public"]["Enums"]["vehicle_color"]
          created_at: string
          id: string
          make: string | null
          model: string | null
          name: string
          notes: string | null
          updated_at: string
          user_id: string
          vin: string | null
          year: number | null
        }
        Insert: {
          color?: Database["public"]["Enums"]["vehicle_color"]
          created_at?: string
          id: string
          make?: string | null
          model?: string | null
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          color?: Database["public"]["Enums"]["vehicle_color"]
          created_at?: string
          id?: string
          make?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: []
      }
      wanted_posts: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          category: Database["public"]["Enums"]["listing_category_enum"]
          city: string | null
          condition_preference: string | null
          country: string | null
          created_at: string | null
          currency: string | null
          description: string
          expires_at: string
          id: string
          moderation_issues: string[] | null
          moderation_status: string
          parts_subcategory:
            | Database["public"]["Enums"]["parts_subcategory_enum"]
            | null
          state_province: string | null
          status: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          category: Database["public"]["Enums"]["listing_category_enum"]
          city?: string | null
          condition_preference?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          description: string
          expires_at?: string
          id?: string
          moderation_issues?: string[] | null
          moderation_status?: string
          parts_subcategory?:
            | Database["public"]["Enums"]["parts_subcategory_enum"]
            | null
          state_province?: string | null
          status?: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          category?: Database["public"]["Enums"]["listing_category_enum"]
          city?: string | null
          condition_preference?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string
          expires_at?: string
          id?: string
          moderation_issues?: string[] | null
          moderation_status?: string
          parts_subcategory?:
            | Database["public"]["Enums"]["parts_subcategory_enum"]
            | null
          state_province?: string | null
          status?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wanted_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wanted_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist: {
        Row: {
          created_at: string | null
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wheels: {
        Row: {
          bolt_pattern: string | null
          center_bore: string | null
          created_at: string
          id: string
          legacy_submitted_by: string | null
          legacy_submitted_by_email: string | null
          manufacturer: string | null
          metadata: Json | null
          name: string
          notes: string | null
          offset_value: string | null
          photos: string[] | null
          reviewed_at: string | null
          reviewed_by: string | null
          size: number | null
          status: Database["public"]["Enums"]["moderation_status_enum"]
          submitted_by: string | null
          updated_at: string
          weight: string | null
          wheel_type: string | null
          width: string | null
        }
        Insert: {
          bolt_pattern?: string | null
          center_bore?: string | null
          created_at?: string
          id?: string
          legacy_submitted_by?: string | null
          legacy_submitted_by_email?: string | null
          manufacturer?: string | null
          metadata?: Json | null
          name: string
          notes?: string | null
          offset_value?: string | null
          photos?: string[] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size?: number | null
          status?: Database["public"]["Enums"]["moderation_status_enum"]
          submitted_by?: string | null
          updated_at?: string
          weight?: string | null
          wheel_type?: string | null
          width?: string | null
        }
        Update: {
          bolt_pattern?: string | null
          center_bore?: string | null
          created_at?: string
          id?: string
          legacy_submitted_by?: string | null
          legacy_submitted_by_email?: string | null
          manufacturer?: string | null
          metadata?: Json | null
          name?: string
          notes?: string | null
          offset_value?: string | null
          photos?: string[] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size?: number | null
          status?: Database["public"]["Enums"]["moderation_status_enum"]
          submitted_by?: string | null
          updated_at?: string
          weight?: string | null
          wheel_type?: string | null
          width?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wheels_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wheels_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wheels_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wheels_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      market_insights: {
        Row: {
          condition:
            | Database["public"]["Enums"]["listing_condition_enum"]
            | null
          final_price: number | null
          list_price: number | null
          listing_category:
            | Database["public"]["Enums"]["listing_category_enum"]
            | null
          location: string | null
          model: string | null
          sold_date: string | null
          sold_month: number | null
          sold_year: number | null
          year: number | null
        }
        Insert: {
          condition?:
            | Database["public"]["Enums"]["listing_condition_enum"]
            | null
          final_price?: number | null
          list_price?: number | null
          listing_category?:
            | Database["public"]["Enums"]["listing_category_enum"]
            | null
          location?: string | null
          model?: string | null
          sold_date?: string | null
          sold_month?: never
          sold_year?: never
          year?: number | null
        }
        Update: {
          condition?:
            | Database["public"]["Enums"]["listing_condition_enum"]
            | null
          final_price?: number | null
          list_price?: number | null
          listing_category?:
            | Database["public"]["Enums"]["listing_category_enum"]
            | null
          location?: string | null
          model?: string | null
          sold_date?: string | null
          sold_month?: never
          sold_year?: never
          year?: number | null
        }
        Relationships: []
      }
      model_browse_cards: {
        Row: {
          author_id: string | null
          category_slug: string | null
          click_count: number | null
          comment_count: number | null
          created_at: string | null
          currency: string | null
          download_count: number | null
          engagement_count: number | null
          id: string | null
          is_featured: boolean | null
          kind: string | null
          license_code: string | null
          like_count: number | null
          min_price_cents: number | null
          price_cents: number | null
          pricing_mode: string | null
          primary_image_path: string | null
          published_at: string | null
          safety_critical: boolean | null
          search: unknown
          slug: string | null
          sort_at: string | null
          source_author_name: string | null
          source_site: string | null
          source_url: string | null
          summary: string | null
          title: string | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          approved_submissions: number | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          location: string | null
          show_vehicles: boolean | null
          social_links: Json | null
          total_submissions: number | null
          trust_level: Database["public"]["Enums"]["trust_level_enum"] | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          approved_submissions?: number | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          location?: string | null
          show_vehicles?: boolean | null
          social_links?: Json | null
          total_submissions?: number | null
          trust_level?: Database["public"]["Enums"]["trust_level_enum"] | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          approved_submissions?: number | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          location?: string | null
          show_vehicles?: boolean | null
          social_links?: Json | null
          total_submissions?: number | null
          trust_level?: Database["public"]["Enums"]["trust_level_enum"] | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_get_membership: {
        Args: { p_user_id: string }
        Returns: {
          active_platform: string
          comp_expires_at: string
          comp_note: string
          has_active_comp: boolean
          is_member: boolean
        }[]
      }
      admin_increment_warning_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      approve_model_version: {
        Args: { p_notes?: string; p_version_id: string }
        Returns: undefined
      }
      array_to_search_text: { Args: { arr: string[] }; Returns: string }
      calculate_distance_miles: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      claim_entitlement_batch: {
        Args: {
          p_batch_size: number
          p_max_attempts: number
          p_reclaim_before: string
        }
        Returns: {
          attempts: number
          claimed_at: string | null
          desired_state: string
          id: number
          last_error: string | null
          occurred_at: string
          processed_at: string | null
          reason: string | null
          status: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "entitlement_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_external_membership: {
        Args: { p_code: string }
        Returns: {
          expires_at: string
          platform: string
          status: string
        }[]
      }
      count_probation_cold_outreach: {
        Args: { p_sender: string }
        Returns: number
      }
      find_user_id_by_email: { Args: { p_email: string }; Returns: string }
      generate_location_string: {
        Args: { p_city: string; p_country: string; p_state_province: string }
        Returns: string
      }
      get_comment_count: { Args: { p_listing_id: string }; Returns: number }
      get_listing_analytics: {
        Args: { p_listing_id: string }
        Returns: {
          days_active: number
          inquiry_count: number
          views_count: number
          watchlist_count: number
        }[]
      }
      get_listings_within_distance: {
        Args: {
          p_distance_miles: number
          p_latitude: number
          p_longitude: number
          p_status?: Database["public"]["Enums"]["listing_status_enum"]
        }
        Returns: {
          city: string
          color: string
          condition: Database["public"]["Enums"]["listing_condition_enum"]
          country: string
          created_at: string
          description: string
          distance_miles: number
          engine_size: string
          formatted_address: string
          id: string
          latitude: number
          listing_category: Database["public"]["Enums"]["listing_category_enum"]
          listing_type: Database["public"]["Enums"]["listing_type_enum"]
          location: string
          longitude: number
          mileage: number
          model: string
          parts_subcategory: Database["public"]["Enums"]["parts_subcategory_enum"]
          postal_code: string
          price: number
          slug: string
          state_province: string
          status: Database["public"]["Enums"]["listing_status_enum"]
          tier: Database["public"]["Enums"]["listing_tier_enum"]
          title: string
          transmission: Database["public"]["Enums"]["gearbox_type_enum"]
          updated_at: string
          user_id: string
          year: number
        }[]
      }
      get_model_sales_summary: {
        Args: never
        Returns: {
          fee_cents: number
          gross_cents: number
          model_id: string
          model_title: string
          net_cents: number
          sale_count: number
          tip_count: number
        }[]
      }
      get_my_membership: {
        Args: never
        Returns: {
          expires_at: string
          is_member: boolean
          platform: string
        }[]
      }
      get_public_profile_by_id: {
        Args: { p_user_id: string }
        Returns: {
          avatar_url: string
          bio: string
          created_at: string
          display_name: string
          id: string
          is_sustaining_member: boolean
          location: string
          show_vehicles: boolean
          social_links: Json
          updated_at: string
          username: string
        }[]
      }
      get_public_profile_by_username: {
        Args: { p_username: string }
        Returns: {
          avatar_url: string
          bio: string
          created_at: string
          display_name: string
          id: string
          is_sustaining_member: boolean
          location: string
          show_vehicles: boolean
          social_links: Json
          updated_at: string
          username: string
        }[]
      }
      get_related_listings: {
        Args: { p_limit?: number; p_listing_id: string }
        Returns: {
          condition: string
          currency: string
          id: string
          listing_category: Database["public"]["Enums"]["listing_category_enum"]
          location: string
          model: string
          price: number
          primary_photo_url: string
          slug: string
          title: string
          year: number
        }[]
      }
      get_seller_stats: {
        Args: { p_user_id: string }
        Returns: {
          active_listings: number
          avg_response_time_hours: number
          is_sustaining_member: boolean
          member_since: string
          sold_listings: number
          total_listings: number
        }[]
      }
      get_watchlist_count: { Args: { p_listing_id: string }; Returns: number }
      get_watchlist_users_for_listing: {
        Args: { p_listing_id: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      grant_comp_membership: {
        Args: { p_expires_at?: string; p_note?: string; p_user_id: string }
        Returns: {
          apple_original_transaction_id: string | null
          apple_product_id: string | null
          cancelled_at: string | null
          comp_granted_by: string | null
          comp_note: string | null
          created_at: string
          expires_at: string | null
          external_ref: string | null
          google_order_id: string | null
          google_purchase_token: string | null
          id: string
          last_verified_at: string | null
          platform: string
          product_id: string
          raw_receipt: Json | null
          starts_at: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_model_entitlement: {
        Args: { p_model_id: string; p_user_id?: string }
        Returns: boolean
      }
      increment_external_model_click: {
        Args: { p_id: string }
        Returns: undefined
      }
      increment_listing_views: {
        Args: { listing_id_param: string }
        Returns: undefined
      }
      is_account_on_probation: { Args: { p_user_id: string }; Returns: boolean }
      is_admin: { Args: { user_id?: string }; Returns: boolean }
      is_username_available: { Args: { p_username: string }; Returns: boolean }
      is_watchlisted: {
        Args: { p_listing_id: string; p_user_id: string }
        Returns: boolean
      }
      mark_messages_as_read: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: undefined
      }
      moderate_external_model: {
        Args: { p_id: string; p_notes?: string; p_status: string }
        Returns: undefined
      }
      promote_tenured_users: { Args: never; Returns: number }
      publish_model_version: {
        Args: { p_version_id: string }
        Returns: undefined
      }
      reassign_subscription_user: {
        Args: { p_new_user_id: string; p_subscription_id: string }
        Returns: {
          apple_original_transaction_id: string | null
          apple_product_id: string | null
          cancelled_at: string | null
          comp_granted_by: string | null
          comp_note: string | null
          created_at: string
          expires_at: string | null
          external_ref: string | null
          google_order_id: string | null
          google_purchase_token: string | null
          id: string
          last_verified_at: string | null
          platform: string
          product_id: string
          raw_receipt: Json | null
          starts_at: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recalculate_trust_level: { Args: { user_id: string }; Returns: undefined }
      reject_model_version: {
        Args: { p_reason: string; p_version_id: string }
        Returns: undefined
      }
      report_message: {
        Args: { p_message_id: string; p_reason: string }
        Returns: undefined
      }
      revoke_comp_membership: {
        Args: { p_user_id: string }
        Returns: {
          apple_original_transaction_id: string | null
          apple_product_id: string | null
          cancelled_at: string | null
          comp_granted_by: string | null
          comp_note: string | null
          created_at: string
          expires_at: string | null
          external_ref: string | null
          google_order_id: string | null
          google_purchase_token: string | null
          id: string
          last_verified_at: string | null
          platform: string
          product_id: string
          raw_receipt: Json | null
          starts_at: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      seller_can_sell: { Args: { p_user_id: string }; Returns: boolean }
      submit_model_version: {
        Args: { p_version_id: string }
        Returns: {
          model_status: string
          version_status: string
        }[]
      }
      sync_instances: {
        Args: { p_last_sync: string; p_vehicle_id: string }
        Returns: Json
      }
      sync_records: {
        Args: { p_last_sync: string; p_vehicle_id: string }
        Returns: Json
      }
      sync_vehicles: {
        Args: { p_client_vehicle_ids?: string[]; p_last_sync: string }
        Returns: Json
      }
      truncate_all_tables: { Args: never; Returns: undefined }
      user_has_subscription: {
        Args: { p_product_id?: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      announcement_type_enum: "error" | "warning" | "info" | "success"
      brake_type_enum: "standard_drum" | "disc_front" | "four_wheel_disc"
      bumper_type_enum:
        | "chrome_standard"
        | "chrome_overriders"
        | "plastic"
        | "deleted"
      carb_type_enum:
        | "single_su"
        | "twin_su"
        | "weber"
        | "stromberg"
        | "fuel_injection"
        | "other"
      contribution_action_enum: "submitted" | "edited" | "approved" | "rejected"
      dashboard_type_enum:
        | "standard"
        | "wood_veneer"
        | "rally"
        | "carbon_fiber"
        | "other"
      document_type_enum:
        | "manual"
        | "advert"
        | "catalogue"
        | "tuning"
        | "electrical"
      engine_series_enum: "A-Series" | "A+-Series"
      exhaust_type_enum:
        | "standard"
        | "sportex"
        | "maniflow"
        | "stainless"
        | "custom"
        | "other"
      gearbox_type_enum:
        | "magic_wand"
        | "3_synchro_remote"
        | "4_synchro_remote"
        | "rod_change"
        | "automatic"
      listing_category_enum: "vehicle" | "engine" | "parts"
      listing_condition_enum:
        | "excellent"
        | "good"
        | "fair"
        | "project"
        | "scrap"
        | "new"
        | "used"
        | "rebuilt"
        | "running"
        | "running_fair"
        | "not_running"
        | "core"
        | "parts_only"
      listing_status_enum:
        | "draft"
        | "pending"
        | "active"
        | "sold"
        | "expired"
        | "cancelled"
        | "example_free"
        | "example_paid"
      listing_tier_enum: "free" | "paid"
      listing_type_enum: "fixed_price"
      maintenance_instance_status:
        | "incomplete"
        | "partially_complete"
        | "completed"
      manufacturer_enum:
        | "morris"
        | "austin"
        | "rover"
        | "leyland"
        | "innocenti"
        | "wolseley"
        | "riley"
        | "other"
      moderation_status_enum: "draft" | "pending" | "approved" | "rejected"
      oem_or_aftermarket_enum: "oem" | "aftermarket" | "reproduction"
      part_condition_enum:
        | "new"
        | "used_excellent"
        | "used_good"
        | "used_fair"
        | "rebuild"
        | "core"
      parts_subcategory_enum:
        | "body_exterior"
        | "interior"
        | "wheels_tires"
        | "engine_internals"
        | "suspension"
        | "electrical"
        | "other"
      payment_status_enum: "pending" | "paid" | "refunded"
      restoration_status_enum:
        | "original"
        | "partially_restored"
        | "fully_restored"
        | "restomod"
        | "project"
        | "scrap"
      rust_condition_enum:
        | "none_visible"
        | "minor_surface"
        | "moderate"
        | "significant"
      seat_type_enum:
        | "original"
        | "cobra"
        | "recaro"
        | "cooper_s"
        | "custom"
        | "other"
      steering_wheel_type_enum:
        | "original"
        | "momo"
        | "moto_lita"
        | "wood_rim"
        | "sports"
        | "custom"
        | "other"
      submission_type_enum: "new_item" | "edit_suggestion" | "new_collection"
      target_type_enum:
        | "document"
        | "collection"
        | "registry"
        | "color"
        | "wheel"
        | "model_version"
        | "external_model"
        | "listing"
      trust_level_enum:
        | "new"
        | "contributor"
        | "trusted"
        | "moderator"
        | "admin"
      underside_condition_enum: "excellent" | "good" | "fair" | "needs_work"
      variant_enum:
        | "standard"
        | "cooper"
        | "cooper_s"
        | "1275_gt"
        | "clubman"
        | "clubman_estate"
        | "van"
        | "pickup"
        | "moke"
        | "riley_elf"
        | "wolseley_hornet"
        | "other"
      vehicle_color:
        | "red"
        | "orange"
        | "yellow"
        | "green"
        | "teal"
        | "blue"
        | "indigo"
        | "purple"
        | "pink"
        | "brown"
        | "gray"
        | "black"
        | "sage"
        | "rust"
        | "olive"
        | "forest"
        | "crimson"
      wheel_type_enum:
        | "standard"
        | "minilite"
        | "cooper_s"
        | "revolution"
        | "rose_petal"
        | "other"
      window_type_enum: "sliding" | "wind_up"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      announcement_type_enum: ["error", "warning", "info", "success"],
      brake_type_enum: ["standard_drum", "disc_front", "four_wheel_disc"],
      bumper_type_enum: [
        "chrome_standard",
        "chrome_overriders",
        "plastic",
        "deleted",
      ],
      carb_type_enum: [
        "single_su",
        "twin_su",
        "weber",
        "stromberg",
        "fuel_injection",
        "other",
      ],
      contribution_action_enum: ["submitted", "edited", "approved", "rejected"],
      dashboard_type_enum: [
        "standard",
        "wood_veneer",
        "rally",
        "carbon_fiber",
        "other",
      ],
      document_type_enum: [
        "manual",
        "advert",
        "catalogue",
        "tuning",
        "electrical",
      ],
      engine_series_enum: ["A-Series", "A+-Series"],
      exhaust_type_enum: [
        "standard",
        "sportex",
        "maniflow",
        "stainless",
        "custom",
        "other",
      ],
      gearbox_type_enum: [
        "magic_wand",
        "3_synchro_remote",
        "4_synchro_remote",
        "rod_change",
        "automatic",
      ],
      listing_category_enum: ["vehicle", "engine", "parts"],
      listing_condition_enum: [
        "excellent",
        "good",
        "fair",
        "project",
        "scrap",
        "new",
        "used",
        "rebuilt",
        "running",
        "running_fair",
        "not_running",
        "core",
        "parts_only",
      ],
      listing_status_enum: [
        "draft",
        "pending",
        "active",
        "sold",
        "expired",
        "cancelled",
        "example_free",
        "example_paid",
      ],
      listing_tier_enum: ["free", "paid"],
      listing_type_enum: ["fixed_price"],
      maintenance_instance_status: [
        "incomplete",
        "partially_complete",
        "completed",
      ],
      manufacturer_enum: [
        "morris",
        "austin",
        "rover",
        "leyland",
        "innocenti",
        "wolseley",
        "riley",
        "other",
      ],
      moderation_status_enum: ["draft", "pending", "approved", "rejected"],
      oem_or_aftermarket_enum: ["oem", "aftermarket", "reproduction"],
      part_condition_enum: [
        "new",
        "used_excellent",
        "used_good",
        "used_fair",
        "rebuild",
        "core",
      ],
      parts_subcategory_enum: [
        "body_exterior",
        "interior",
        "wheels_tires",
        "engine_internals",
        "suspension",
        "electrical",
        "other",
      ],
      payment_status_enum: ["pending", "paid", "refunded"],
      restoration_status_enum: [
        "original",
        "partially_restored",
        "fully_restored",
        "restomod",
        "project",
        "scrap",
      ],
      rust_condition_enum: [
        "none_visible",
        "minor_surface",
        "moderate",
        "significant",
      ],
      seat_type_enum: [
        "original",
        "cobra",
        "recaro",
        "cooper_s",
        "custom",
        "other",
      ],
      steering_wheel_type_enum: [
        "original",
        "momo",
        "moto_lita",
        "wood_rim",
        "sports",
        "custom",
        "other",
      ],
      submission_type_enum: ["new_item", "edit_suggestion", "new_collection"],
      target_type_enum: [
        "document",
        "collection",
        "registry",
        "color",
        "wheel",
        "model_version",
        "external_model",
        "listing",
      ],
      trust_level_enum: ["new", "contributor", "trusted", "moderator", "admin"],
      underside_condition_enum: ["excellent", "good", "fair", "needs_work"],
      variant_enum: [
        "standard",
        "cooper",
        "cooper_s",
        "1275_gt",
        "clubman",
        "clubman_estate",
        "van",
        "pickup",
        "moke",
        "riley_elf",
        "wolseley_hornet",
        "other",
      ],
      vehicle_color: [
        "red",
        "orange",
        "yellow",
        "green",
        "teal",
        "blue",
        "indigo",
        "purple",
        "pink",
        "brown",
        "gray",
        "black",
        "sage",
        "rust",
        "olive",
        "forest",
        "crimson",
      ],
      wheel_type_enum: [
        "standard",
        "minilite",
        "cooper_s",
        "revolution",
        "rose_petal",
        "other",
      ],
      window_type_enum: ["sliding", "wind_up"],
    },
  },
} as const
