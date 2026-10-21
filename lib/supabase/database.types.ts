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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      addons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      albums: {
        Row: {
          category_id: string | null
          cover_path: string | null
          created_at: string
          description: string | null
          id: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          cover_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          cover_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "albums_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_dates: {
        Row: {
          blocked_on: string
          reason: string | null
        }
        Insert: {
          blocked_on: string
          reason?: string | null
        }
        Update: {
          blocked_on?: string
          reason?: string | null
        }
        Relationships: []
      }
      booking_addons: {
        Row: {
          addon_id: string
          booking_id: string
          id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          addon_id: string
          booking_id: string
          id?: string
          quantity?: number
          unit_price: number
        }
        Update: {
          addon_id?: string
          booking_id?: string
          id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_addons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_payment_summary"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_addons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_events: {
        Row: {
          actor_id: string | null
          booking_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["booking_status"] | null
          id: string
          note: string | null
          to_status: Database["public"]["Enums"]["booking_status"] | null
          type: string
        }
        Insert: {
          actor_id?: string | null
          booking_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["booking_status"] | null
          type: string
        }
        Update: {
          actor_id?: string | null
          booking_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["booking_status"] | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_payment_summary"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          addons_total: number
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          discount_amount: number
          ends_at: string
          id: string
          notes: string | null
          package_id: string
          package_price: number
          promotion_id: string | null
          reference: string
          slot: unknown
          source: string
          staff_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          status_before_cancel:
            | Database["public"]["Enums"]["booking_status"]
            | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          addons_total?: number
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          discount_amount?: number
          ends_at: string
          id?: string
          notes?: string | null
          package_id: string
          package_price: number
          promotion_id?: string | null
          reference?: string
          slot?: unknown
          source: string
          staff_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          status_before_cancel?:
            | Database["public"]["Enums"]["booking_status"]
            | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          addons_total?: number
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          discount_amount?: number
          ends_at?: string
          id?: string
          notes?: string | null
          package_id?: string
          package_price?: number
          promotion_id?: string | null
          reference?: string
          slot?: unknown
          source?: string
          staff_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          status_before_cancel?:
            | Database["public"]["Enums"]["booking_status"]
            | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions_with_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          closes_at: string
          is_open: boolean
          opens_at: string
          weekday: number
        }
        Insert: {
          closes_at?: string
          is_open?: boolean
          opens_at?: string
          weekday: number
        }
        Update: {
          closes_at?: string
          is_open?: boolean
          opens_at?: string
          weekday?: number
        }
        Relationships: []
      }
      categories: {
        Row: {
          cover_path: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          cover_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cover_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          is_read: boolean
          message: string
          name: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_read?: boolean
          message: string
          name: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_read?: boolean
          message?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      customer_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          customer_id: string
          id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          customer_id: string
          id?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          customer_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          profile_id: string | null
          status: Database["public"]["Enums"]["entity_status"]
          tier: Database["public"]["Enums"]["customer_tier"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          profile_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          tier?: Database["public"]["Enums"]["customer_tier"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          profile_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          tier?: Database["public"]["Enums"]["customer_tier"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          booking_id: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          provider_id: string | null
          status: string
          subject: string
          template: string
          to_email: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          provider_id?: string | null
          status?: string
          subject: string
          template: string
          to_email: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          provider_id?: string | null
          status?: string
          subject?: string
          template?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_payment_summary"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "email_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_requests: {
        Row: {
          booking_id: string
          completed_at: string | null
          id: string
          sent_at: string
          token: string
        }
        Insert: {
          booking_id: string
          completed_at?: string | null
          id?: string
          sent_at?: string
          token?: string
        }
        Update: {
          booking_id?: string
          completed_at?: string | null
          id?: string
          sent_at?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_payment_summary"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "feedback_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      package_addons: {
        Row: {
          addon_id: string
          package_id: string
        }
        Insert: {
          addon_id: string
          package_id: string
        }
        Update: {
          addon_id?: string
          package_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_addons_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      package_images: {
        Row: {
          alt: string | null
          created_at: string
          id: string
          package_id: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          id?: string
          package_id: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          id?: string
          package_id?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_images_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          backdrops: number | null
          category_id: string
          cover_path: string | null
          created_at: string
          description: string | null
          digital_images: boolean
          duration_minutes: number
          id: string
          inclusions: string[]
          is_active: boolean
          magazine_cover: boolean
          name: string
          outfits: number | null
          photos_included: string | null
          price: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          backdrops?: number | null
          category_id: string
          cover_path?: string | null
          created_at?: string
          description?: string | null
          digital_images?: boolean
          duration_minutes: number
          id?: string
          inclusions?: string[]
          is_active?: boolean
          magazine_cover?: boolean
          name: string
          outfits?: number | null
          photos_included?: string | null
          price: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          backdrops?: number | null
          category_id?: string
          cover_path?: string | null
          created_at?: string
          description?: string | null
          digital_images?: boolean
          duration_minutes?: number
          id?: string
          inclusions?: string[]
          is_active?: boolean
          magazine_cover?: boolean
          name?: string
          outfits?: number | null
          photos_included?: string | null
          price?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          paid_at: string
          receipt_path: string | null
          recorded_by: string | null
          reference_no: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
          receipt_path?: string | null
          recorded_by?: string | null
          reference_no?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
          receipt_path?: string | null
          recorded_by?: string | null
          reference_no?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_payment_summary"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_photos: {
        Row: {
          album_id: string | null
          category_id: string | null
          created_at: string
          description: string | null
          height: number | null
          id: string
          package_id: string | null
          sort_order: number
          storage_path: string
          title: string | null
          width: number | null
        }
        Insert: {
          album_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          height?: number | null
          id?: string
          package_id?: string | null
          sort_order?: number
          storage_path: string
          title?: string | null
          width?: number | null
        }
        Update: {
          album_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          height?: number | null
          id?: string
          package_id?: string | null
          sort_order?: number
          storage_path?: string
          title?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_photos_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_photos_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_photos_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      promotion_packages: {
        Row: {
          package_id: string
          promotion_id: string
        }
        Insert: {
          package_id: string
          promotion_id: string
        }
        Update: {
          package_id?: string
          promotion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_packages_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_packages_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          created_at: string
          discount_percent: number
          ends_on: string
          id: string
          name: string
          starts_on: string
          updated_at: string
          visible_to_customers: boolean
        }
        Insert: {
          created_at?: string
          discount_percent: number
          ends_on: string
          id?: string
          name: string
          starts_on: string
          updated_at?: string
          visible_to_customers?: boolean
        }
        Update: {
          created_at?: string
          discount_percent?: number
          ends_on?: string
          id?: string
          name?: string
          starts_on?: string
          updated_at?: string
          visible_to_customers?: boolean
        }
        Relationships: []
      }
      staff_members: {
        Row: {
          address: string | null
          bio: string | null
          birthday: string | null
          created_at: string
          email: string | null
          full_name: string
          hire_date: string | null
          id: string
          phone: string | null
          photo_path: string | null
          position: Database["public"]["Enums"]["staff_position"]
          profile_id: string | null
          show_on_about: boolean
          sort_order: number
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          bio?: string | null
          birthday?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          phone?: string | null
          photo_path?: string | null
          position?: Database["public"]["Enums"]["staff_position"]
          profile_id?: string | null
          show_on_about?: boolean
          sort_order?: number
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          bio?: string | null
          birthday?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          phone?: string | null
          photo_path?: string | null
          position?: Database["public"]["Enums"]["staff_position"]
          profile_id?: string | null
          show_on_about?: boolean
          sort_order?: number
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_settings: {
        Row: {
          address: string | null
          cancel_cutoff_hours: number
          currency: string
          email: string | null
          id: boolean
          map_url: string | null
          max_advance_days: number
          min_lead_hours: number
          phone: string | null
          slot_interval_minutes: number
          socials: Json
          studio_name: string
          timezone: string
          undo_window_seconds: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          cancel_cutoff_hours?: number
          currency?: string
          email?: string | null
          id?: boolean
          map_url?: string | null
          max_advance_days?: number
          min_lead_hours?: number
          phone?: string | null
          slot_interval_minutes?: number
          socials?: Json
          studio_name?: string
          timezone?: string
          undo_window_seconds?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          cancel_cutoff_hours?: number
          currency?: string
          email?: string | null
          id?: boolean
          map_url?: string | null
          max_advance_days?: number
          min_lead_hours?: number
          phone?: string | null
          slot_interval_minutes?: number
          socials?: Json
          studio_name?: string
          timezone?: string
          undo_window_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          admin_notes: string | null
          author_name: string | null
          booking_id: string | null
          created_at: string
          customer_id: string
          id: string
          is_featured: boolean
          message: string
          package_id: string | null
          rating: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["testimonial_status"]
        }
        Insert: {
          admin_notes?: string | null
          author_name?: string | null
          booking_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          is_featured?: boolean
          message: string
          package_id?: string | null
          rating: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["testimonial_status"]
        }
        Update: {
          admin_notes?: string | null
          author_name?: string | null
          booking_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          is_featured?: boolean
          message?: string
          package_id?: string | null
          rating?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["testimonial_status"]
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "booking_payment_summary"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "testimonials_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonials_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonials_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonials_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      booking_payment_summary: {
        Row: {
          balance: number | null
          booking_id: string | null
          paid_total: number | null
          payment_status: string | null
          total_amount: number | null
        }
        Relationships: []
      }
      promotions_with_status: {
        Row: {
          created_at: string | null
          discount_percent: number | null
          ends_on: string | null
          id: string | null
          name: string | null
          starts_on: string | null
          status: string | null
          updated_at: string | null
          visible_to_customers: boolean | null
        }
        Insert: {
          created_at?: string | null
          discount_percent?: number | null
          ends_on?: string | null
          id?: string | null
          name?: string | null
          starts_on?: string | null
          status?: never
          updated_at?: string | null
          visible_to_customers?: boolean | null
        }
        Update: {
          created_at?: string | null
          discount_percent?: number | null
          ends_on?: string | null
          id?: string | null
          name?: string | null
          starts_on?: string | null
          status?: never
          updated_at?: string | null
          visible_to_customers?: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_booking_staff: {
        Args: { p_booking_id: string; p_staff_id?: string }
        Returns: {
          addons_total: number
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          discount_amount: number
          ends_at: string
          id: string
          notes: string | null
          package_id: string
          package_price: number
          promotion_id: string | null
          reference: string
          slot: unknown
          source: string
          staff_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          status_before_cancel:
            | Database["public"]["Enums"]["booking_status"]
            | null
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      available_slots: {
        Args: { p_date: string; p_package_id: string }
        Returns: {
          ends_at: string
          starts_at: string
        }[]
      }
      cancel_booking: {
        Args: { p_booking_id: string }
        Returns: {
          addons_total: number
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          discount_amount: number
          ends_at: string
          id: string
          notes: string | null
          package_id: string
          package_price: number
          promotion_id: string | null
          reference: string
          slot: unknown
          source: string
          staff_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          status_before_cancel:
            | Database["public"]["Enums"]["booking_status"]
            | null
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_booking: {
        Args: {
          p_addon_ids?: string[]
          p_notes?: string
          p_package_id: string
          p_starts_at: string
        }
        Returns: {
          addons_total: number
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          discount_amount: number
          ends_at: string
          id: string
          notes: string | null
          package_id: string
          package_price: number
          promotion_id: string | null
          reference: string
          slot: unknown
          source: string
          staff_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          status_before_cancel:
            | Database["public"]["Enums"]["booking_status"]
            | null
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_staff_booking: {
        Args: {
          p_addon_ids?: string[]
          p_customer_email?: string
          p_customer_id?: string
          p_customer_name?: string
          p_customer_phone?: string
          p_notes?: string
          p_package_id: string
          p_staff_id?: string
          p_starts_at: string
        }
        Returns: {
          addons_total: number
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          discount_amount: number
          ends_at: string
          id: string
          notes: string | null
          package_id: string
          package_price: number
          promotion_id: string | null
          reference: string
          slot: unknown
          source: string
          staff_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          status_before_cancel:
            | Database["public"]["Enums"]["booking_status"]
            | null
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      quote_booking: {
        Args: { p_addon_ids?: string[]; p_package_id: string }
        Returns: {
          addons_total: number
          discount_amount: number
          discount_percent: number
          package_price: number
          promotion_id: string
          total_amount: number
        }[]
      }
      record_payment: {
        Args: {
          p_amount: number
          p_booking_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_note?: string
          p_paid_at?: string
          p_reference_no?: string
        }
        Returns: {
          amount: number
          booking_id: string
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          paid_at: string
          receipt_path: string | null
          recorded_by: string | null
          reference_no: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reschedule_booking: {
        Args: { p_booking_id: string; p_note?: string; p_starts_at: string }
        Returns: {
          addons_total: number
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          discount_amount: number
          ends_at: string
          id: string
          notes: string | null
          package_id: string
          package_price: number
          promotion_id: string | null
          reference: string
          slot: unknown
          source: string
          staff_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          status_before_cancel:
            | Database["public"]["Enums"]["booking_status"]
            | null
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_booking_status: {
        Args: {
          p_booking_id: string
          p_note?: string
          p_status: Database["public"]["Enums"]["booking_status"]
        }
        Returns: {
          addons_total: number
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          discount_amount: number
          ends_at: string
          id: string
          notes: string | null
          package_id: string
          package_price: number
          promotion_id: string | null
          reference: string
          slot: unknown
          source: string
          staff_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          status_before_cancel:
            | Database["public"]["Enums"]["booking_status"]
            | null
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      staff_available_slots: {
        Args: {
          p_date: string
          p_duration_minutes: number
          p_exclude_booking_id?: string
        }
        Returns: {
          ends_at: string
          starts_at: string
        }[]
      }
      undo_cancel_booking: {
        Args: { p_booking_id: string }
        Returns: {
          addons_total: number
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          discount_amount: number
          ends_at: string
          id: string
          notes: string | null
          package_id: string
          package_price: number
          promotion_id: string | null
          reference: string
          slot: unknown
          source: string
          staff_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          status_before_cancel:
            | Database["public"]["Enums"]["booking_status"]
            | null
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      void_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: {
          amount: number
          booking_id: string
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          paid_at: string
          receipt_path: string | null
          recorded_by: string | null
          reference_no: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      booking_status:
        | "pending"
        | "approved"
        | "completed"
        | "cancelled"
        | "rejected"
        | "expired"
      customer_tier: "regular" | "vip" | "corporate"
      entity_status: "active" | "inactive"
      payment_method: "cash" | "gcash" | "bank_transfer" | "card" | "other"
      staff_position:
        | "photographer"
        | "videographer"
        | "makeup_artist"
        | "assistant"
        | "editor"
        | "other"
      testimonial_status: "pending" | "approved" | "rejected"
      user_role: "admin" | "staff" | "customer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      booking_status: [
        "pending",
        "approved",
        "completed",
        "cancelled",
        "rejected",
        "expired",
      ],
      customer_tier: ["regular", "vip", "corporate"],
      entity_status: ["active", "inactive"],
      payment_method: ["cash", "gcash", "bank_transfer", "card", "other"],
      staff_position: [
        "photographer",
        "videographer",
        "makeup_artist",
        "assistant",
        "editor",
        "other",
      ],
      testimonial_status: ["pending", "approved", "rejected"],
      user_role: ["admin", "staff", "customer"],
    },
  },
} as const
