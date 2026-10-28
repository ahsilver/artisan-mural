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
      artwork_colorways: {
        Row: {
          artwork_path: string
          current_original_id: string | null
          id: string
          name: string
          position: number
          print_file_url: string | null
          upload_id: string
        }
        Insert: {
          artwork_path: string
          current_original_id?: string | null
          id?: string
          name: string
          position: number
          print_file_url?: string | null
          upload_id: string
        }
        Update: {
          artwork_path?: string
          current_original_id?: string | null
          id?: string
          name?: string
          position?: number
          print_file_url?: string | null
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artwork_colorways_current_original_id_fkey"
            columns: ["current_original_id"]
            isOneToOne: false
            referencedRelation: "print_originals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_colorways_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "artwork_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      artwork_mockups: {
        Row: {
          colorway_id: string
          id: string
          image_path: string
          room: number
        }
        Insert: {
          colorway_id: string
          id?: string
          image_path: string
          room: number
        }
        Update: {
          colorway_id?: string
          id?: string
          image_path?: string
          room?: number
        }
        Relationships: [
          {
            foreignKeyName: "artwork_mockups_colorway_id_fkey"
            columns: ["colorway_id"]
            isOneToOne: false
            referencedRelation: "artwork_colorways"
            referencedColumns: ["id"]
          },
        ]
      }
      artwork_uploads: {
        Row: {
          categories: string[]
          created_at: string
          designer_notes: string | null
          error: string | null
          height_cm: number | null
          id: string
          kind: string
          lease_until: string | null
          made_for: string[]
          max_print_height_cm: number | null
          max_print_width_cm: number | null
          owner_id: string
          print_file_url: string | null
          repeat_style: string
          review_note: string | null
          review_status: string
          sku: string | null
          status: string
          story: string | null
          submitted_at: string | null
          title: string
          width_cm: number | null
        }
        Insert: {
          categories?: string[]
          created_at?: string
          designer_notes?: string | null
          error?: string | null
          height_cm?: number | null
          id?: string
          kind: string
          lease_until?: string | null
          made_for?: string[]
          max_print_height_cm?: number | null
          max_print_width_cm?: number | null
          owner_id: string
          print_file_url?: string | null
          repeat_style?: string
          review_note?: string | null
          review_status?: string
          sku?: string | null
          status?: string
          story?: string | null
          submitted_at?: string | null
          title: string
          width_cm?: number | null
        }
        Update: {
          categories?: string[]
          created_at?: string
          designer_notes?: string | null
          error?: string | null
          height_cm?: number | null
          id?: string
          kind?: string
          lease_until?: string | null
          made_for?: string[]
          max_print_height_cm?: number | null
          max_print_width_cm?: number | null
          owner_id?: string
          print_file_url?: string | null
          repeat_style?: string
          review_note?: string | null
          review_status?: string
          sku?: string | null
          status?: string
          story?: string | null
          submitted_at?: string | null
          title?: string
          width_cm?: number | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          custom_request_id: string | null
          customer_id: string
          design_slug: string | null
          designer_slug: string
          id: string
          title: string
        }
        Insert: {
          created_at?: string
          custom_request_id?: string | null
          customer_id: string
          design_slug?: string | null
          designer_slug: string
          id?: string
          title: string
        }
        Update: {
          created_at?: string
          custom_request_id?: string | null
          customer_id?: string
          design_slug?: string | null
          designer_slug?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_custom_request_id_fkey"
            columns: ["custom_request_id"]
            isOneToOne: false
            referencedRelation: "custom_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_requests: {
        Row: {
          brief: string
          budget: string | null
          created_at: string
          customer_email: string
          customer_name: string
          design_slug: string | null
          designer_slug: string
          id: string
          material: string
          photo_paths: string[]
          room: string
          selection: Json | null
          status: string
          user_id: string
          wall_size: string
        }
        Insert: {
          brief: string
          budget?: string | null
          created_at?: string
          customer_email: string
          customer_name: string
          design_slug?: string | null
          designer_slug?: string
          id?: string
          material: string
          photo_paths?: string[]
          room: string
          selection?: Json | null
          status?: string
          user_id: string
          wall_size: string
        }
        Update: {
          brief?: string
          budget?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          design_slug?: string | null
          designer_slug?: string
          id?: string
          material?: string
          photo_paths?: string[]
          room?: string
          selection?: Json | null
          status?: string
          user_id?: string
          wall_size?: string
        }
        Relationships: []
      }
      design_listing: {
        Row: {
          hidden: boolean
          slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          hidden?: boolean
          slug: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          hidden?: boolean
          slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      design_offers: {
        Row: {
          accepted_at: string | null
          amount: number
          conversation_id: string
          conversation_kind: string
          created_at: string
          created_by: string
          delivered_at: string | null
          delivery_days: number | null
          description: string
          designer_slug: string
          id: string
          proof_approved_at: string | null
          proof_note: string | null
          proof_path: string | null
          proof_status: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          amount: number
          conversation_id: string
          conversation_kind: string
          created_at?: string
          created_by: string
          delivered_at?: string | null
          delivery_days?: number | null
          description: string
          designer_slug: string
          id?: string
          proof_approved_at?: string | null
          proof_note?: string | null
          proof_path?: string | null
          proof_status?: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          amount?: number
          conversation_id?: string
          conversation_kind?: string
          created_at?: string
          created_by?: string
          delivered_at?: string | null
          delivery_days?: number | null
          description?: string
          designer_slug?: string
          id?: string
          proof_approved_at?: string | null
          proof_note?: string | null
          proof_path?: string | null
          proof_status?: string
          status?: string
        }
        Relationships: []
      }
      design_overrides: {
        Row: {
          added_photos: string[]
          description: string | null
          image_path: string | null
          price_per_sqft: number | null
          removed_photos: string[]
          slug: string
          story: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          added_photos?: string[]
          description?: string | null
          image_path?: string | null
          price_per_sqft?: number | null
          removed_photos?: string[]
          slug: string
          story?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          added_photos?: string[]
          description?: string | null
          image_path?: string | null
          price_per_sqft?: number | null
          removed_photos?: string[]
          slug?: string
          story?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      designer_accounts: {
        Row: {
          slug: string
          user_id: string
        }
        Insert: {
          slug: string
          user_id: string
        }
        Update: {
          slug?: string
          user_id?: string
        }
        Relationships: []
      }
      designer_collections: {
        Row: {
          created_at: string
          description: string
          design_slugs: string[]
          designer_slug: string
          id: string
          owner_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          design_slugs?: string[]
          designer_slug: string
          id?: string
          owner_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          design_slugs?: string[]
          designer_slug?: string
          id?: string
          owner_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      designer_messages: {
        Row: {
          attachment_path: string | null
          body: string
          conversation_id: string
          created_at: string
          id: string
          selection: Json | null
          sender_id: string
          sender_role: string
        }
        Insert: {
          attachment_path?: string | null
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          selection?: Json | null
          sender_id: string
          sender_role?: string
        }
        Update: {
          attachment_path?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          selection?: Json | null
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "designer_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      designer_payouts: {
        Row: {
          amount: number
          created_by: string
          designer_user_id: string
          id: string
          note: string | null
          paid_at: string
        }
        Insert: {
          amount: number
          created_by: string
          designer_user_id: string
          id?: string
          note?: string | null
          paid_at?: string
        }
        Update: {
          amount?: number
          created_by?: string
          designer_user_id?: string
          id?: string
          note?: string | null
          paid_at?: string
        }
        Relationships: []
      }
      designer_profiles: {
        Row: {
          bio: string
          country: string
          created_at: string
          full_name: string
          payout_details: string | null
          payout_method: string | null
          portfolio_links: string[]
          review_note: string | null
          reviewed_at: string | null
          status: string
          studio_name: string | null
          styles: string[]
          trusted: boolean
          user_id: string
        }
        Insert: {
          bio: string
          country: string
          created_at?: string
          full_name: string
          payout_details?: string | null
          payout_method?: string | null
          portfolio_links?: string[]
          review_note?: string | null
          reviewed_at?: string | null
          status?: string
          studio_name?: string | null
          styles?: string[]
          trusted?: boolean
          user_id: string
        }
        Update: {
          bio?: string
          country?: string
          created_at?: string
          full_name?: string
          payout_details?: string | null
          payout_method?: string | null
          portfolio_links?: string[]
          review_note?: string | null
          reviewed_at?: string | null
          status?: string
          studio_name?: string | null
          styles?: string[]
          trusted?: boolean
          user_id?: string
        }
        Relationships: []
      }
      designer_reviews: {
        Row: {
          body: string
          created_at: string
          designer_slug: string
          id: string
          rating: number
          reviewer_name: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          designer_slug: string
          id?: string
          rating: number
          reviewer_name: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          designer_slug?: string
          id?: string
          rating?: number
          reviewer_name?: string
          user_id?: string
        }
        Relationships: []
      }
      guest_conversation_messages: {
        Row: {
          attachment_path: string | null
          body: string
          conversation_id: string
          created_at: string
          id: string
          selection: Json | null
          sender: string
        }
        Insert: {
          attachment_path?: string | null
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          selection?: Json | null
          sender: string
        }
        Update: {
          attachment_path?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          selection?: Json | null
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "guest_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_conversations: {
        Row: {
          created_at: string
          customer_name: string
          design_slug: string | null
          designer_slug: string
          id: string
          title: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          customer_name: string
          design_slug?: string | null
          designer_slug: string
          id?: string
          title: string
          token_hash: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          design_slug?: string | null
          designer_slug?: string
          id?: string
          title?: string
          token_hash?: string
        }
        Relationships: []
      }
      guest_designer_requests: {
        Row: {
          body: string
          created_at: string
          customer_email: string
          customer_name: string
          design_slug: string
          designer_slug: string
          id: string
          selection: Json
        }
        Insert: {
          body: string
          created_at?: string
          customer_email: string
          customer_name: string
          design_slug: string
          designer_slug: string
          id?: string
          selection: Json
        }
        Update: {
          body?: string
          created_at?: string
          customer_email?: string
          customer_name?: string
          design_slug?: string
          designer_slug?: string
          id?: string
          selection?: Json
        }
        Relationships: []
      }
      material_settings: {
        Row: {
          active: boolean
          blurb: string
          factor: number
          id: string
          name: string
          texture: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          blurb?: string
          factor?: number
          id: string
          name: string
          texture?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          blurb?: string
          factor?: number
          id?: string
          name?: string
          texture?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      order_requests: {
        Row: {
          carrier: string | null
          cart_id: string | null
          created_at: string
          custom_offer_id: string | null
          customer_email: string
          customer_name: string
          delivery_date: string | null
          design_slug: string
          estimated_total: number
          finish: string
          id: string
          notes: string | null
          payment_method: string | null
          phone: string | null
          print_design_snapshot: Json | null
          print_original_id: string | null
          selection: Json
          shipping_address: string
          source: string
          square_feet: number
          status: string
          status_updated_at: string
          tracking_number: string | null
          user_id: string | null
        }
        Insert: {
          carrier?: string | null
          cart_id?: string | null
          created_at?: string
          custom_offer_id?: string | null
          customer_email: string
          customer_name: string
          delivery_date?: string | null
          design_slug: string
          estimated_total: number
          finish: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          print_design_snapshot?: Json | null
          print_original_id?: string | null
          selection: Json
          shipping_address: string
          source?: string
          square_feet: number
          status?: string
          status_updated_at?: string
          tracking_number?: string | null
          user_id?: string | null
        }
        Update: {
          carrier?: string | null
          cart_id?: string | null
          created_at?: string
          custom_offer_id?: string | null
          customer_email?: string
          customer_name?: string
          delivery_date?: string | null
          design_slug?: string
          estimated_total?: number
          finish?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          print_design_snapshot?: Json | null
          print_original_id?: string | null
          selection?: Json
          shipping_address?: string
          source?: string
          square_feet?: number
          status?: string
          status_updated_at?: string
          tracking_number?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_requests_print_original_id_fkey"
            columns: ["print_original_id"]
            isOneToOne: false
            referencedRelation: "print_originals"
            referencedColumns: ["id"]
          },
        ]
      }
      print_originals: {
        Row: {
          byte_size: number
          colorway_id: string | null
          created_at: string
          effective_dpi: number | null
          filename: string
          id: string
          mime_type: string
          owner_id: string
          pixel_height: number | null
          pixel_width: number | null
          storage_path: string
          validation_status: string
        }
        Insert: {
          byte_size: number
          colorway_id?: string | null
          created_at?: string
          effective_dpi?: number | null
          filename: string
          id?: string
          mime_type: string
          owner_id: string
          pixel_height?: number | null
          pixel_width?: number | null
          storage_path: string
          validation_status?: string
        }
        Update: {
          byte_size?: number
          colorway_id?: string | null
          created_at?: string
          effective_dpi?: number | null
          filename?: string
          id?: string
          mime_type?: string
          owner_id?: string
          pixel_height?: number | null
          pixel_width?: number | null
          storage_path?: string
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_originals_colorway_id_fkey"
            columns: ["colorway_id"]
            isOneToOne: false
            referencedRelation: "artwork_colorways"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_project_quote: {
        Args: { _customer: string; _offer: string }
        Returns: boolean
      }
      claim_artwork_mockups: { Args: { _id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      link_custom_project_order: {
        Args: { _offer: string; _order: string }
        Returns: boolean
      }
      read_guest_conversation: {
        Args: { _id: string; _token_hash: string }
        Returns: {
          body: string
          created_at: string
          design_slug: string
          designer_slug: string
          id: string
          selection: Json
          sender: string
          title: string
        }[]
      }
      read_guest_conversation_v2: {
        Args: { _id: string; _token_hash: string }
        Returns: {
          attachment_path: string
          body: string
          created_at: string
          design_slug: string
          designer_slug: string
          id: string
          selection: Json
          sender: string
          title: string
        }[]
      }
      send_guest_conversation_message: {
        Args: {
          _body: string
          _id: string
          _selection: Json
          _token_hash: string
        }
        Returns: boolean
      }
      send_guest_conversation_message_v2: {
        Args: {
          _attachment: string
          _body: string
          _id: string
          _selection: Json
          _token_hash: string
        }
        Returns: boolean
      }
      start_guest_conversation: {
        Args: {
          _body: string
          _design: string
          _designer: string
          _name: string
          _selection: Json
          _title: string
          _token_hash: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin"
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
      app_role: ["admin"],
    },
  },
} as const
