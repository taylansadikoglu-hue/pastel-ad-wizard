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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ad_placements: {
        Row: {
          ad_title: string | null
          ad_type: string | null
          advertiser_name: string | null
          buyer_stage: string | null
          campaign_cluster: string | null
          category: string | null
          channel: string | null
          channel_platform: string | null
          confidence_score: number | null
          created_at: string | null
          creative_hash: string | null
          creative_url: string | null
          days_running: number | null
          description: string | null
          detected_cta: string | null
          domain: string
          emotional_driver: string | null
          extracted_offer: string | null
          first_seen: string | null
          headline: string | null
          hook: string | null
          hook_analysis: string | null
          id: number
          landing_url: string | null
          last_seen: string | null
          media_url: string | null
          offer_signal: string | null
          offer_theme: string | null
          offer_type: string | null
          page_description: string | null
          page_title: string | null
          primary_cta: string | null
          product_category: string | null
          product_type: string | null
          raw: Json | null
          raw_copy: string | null
          scan_id: number | null
          source_archive_url: string | null
          source_platform: string | null
          strategist_takeaway: string | null
          times_seen: number | null
        }
        Insert: {
          ad_title?: string | null
          ad_type?: string | null
          advertiser_name?: string | null
          buyer_stage?: string | null
          campaign_cluster?: string | null
          category?: string | null
          channel?: string | null
          channel_platform?: string | null
          confidence_score?: number | null
          created_at?: string | null
          creative_hash?: string | null
          creative_url?: string | null
          days_running?: number | null
          description?: string | null
          detected_cta?: string | null
          domain: string
          emotional_driver?: string | null
          extracted_offer?: string | null
          first_seen?: string | null
          headline?: string | null
          hook?: string | null
          hook_analysis?: string | null
          id?: number
          landing_url?: string | null
          last_seen?: string | null
          media_url?: string | null
          offer_signal?: string | null
          offer_theme?: string | null
          offer_type?: string | null
          page_description?: string | null
          page_title?: string | null
          primary_cta?: string | null
          product_category?: string | null
          product_type?: string | null
          raw?: Json | null
          raw_copy?: string | null
          scan_id?: number | null
          source_archive_url?: string | null
          source_platform?: string | null
          strategist_takeaway?: string | null
          times_seen?: number | null
        }
        Update: {
          ad_title?: string | null
          ad_type?: string | null
          advertiser_name?: string | null
          buyer_stage?: string | null
          campaign_cluster?: string | null
          category?: string | null
          channel?: string | null
          channel_platform?: string | null
          confidence_score?: number | null
          created_at?: string | null
          creative_hash?: string | null
          creative_url?: string | null
          days_running?: number | null
          description?: string | null
          detected_cta?: string | null
          domain?: string
          emotional_driver?: string | null
          extracted_offer?: string | null
          first_seen?: string | null
          headline?: string | null
          hook?: string | null
          hook_analysis?: string | null
          id?: number
          landing_url?: string | null
          last_seen?: string | null
          media_url?: string | null
          offer_signal?: string | null
          offer_theme?: string | null
          offer_type?: string | null
          page_description?: string | null
          page_title?: string | null
          primary_cta?: string | null
          product_category?: string | null
          product_type?: string | null
          raw?: Json | null
          raw_copy?: string | null
          scan_id?: number | null
          source_archive_url?: string | null
          source_platform?: string | null
          strategist_takeaway?: string | null
          times_seen?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_placements_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "domain_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      advertiser_matrix: {
        Row: {
          created_at: string | null
          domain: string
          est_monthly_spend: number | null
          google_pct: number | null
          id: number
          meta_pct: number | null
          primary_channel: string | null
          prog_pct: number | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          est_monthly_spend?: number | null
          google_pct?: number | null
          id?: number
          meta_pct?: number | null
          primary_channel?: string | null
          prog_pct?: number | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          est_monthly_spend?: number | null
          google_pct?: number | null
          id?: number
          meta_pct?: number | null
          primary_channel?: string | null
          prog_pct?: number | null
        }
        Relationships: []
      }
      domain_scans: {
        Row: {
          average_cpc: number | null
          created_at: string | null
          domain: string
          estimated_monthly_spend: number | null
          id: number
          status: string
          total_paid_keywords: number | null
          user_id: string | null
        }
        Insert: {
          average_cpc?: number | null
          created_at?: string | null
          domain: string
          estimated_monthly_spend?: number | null
          id?: number
          status?: string
          total_paid_keywords?: number | null
          user_id?: string | null
        }
        Update: {
          average_cpc?: number | null
          created_at?: string | null
          domain?: string
          estimated_monthly_spend?: number | null
          id?: number
          status?: string
          total_paid_keywords?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          apify_token: string | null
          created_at: string
          dataforseo_login: string | null
          dataforseo_password: string | null
          resend_api_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          apify_token?: string | null
          created_at?: string
          dataforseo_login?: string | null
          dataforseo_password?: string | null
          resend_api_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          apify_token?: string | null
          created_at?: string
          dataforseo_login?: string | null
          dataforseo_password?: string | null
          resend_api_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agency_domain: string | null
          agency_name: string | null
          created_at: string
          id: string
          stripe_status: string
          updated_at: string
        }
        Insert: {
          agency_domain?: string | null
          agency_name?: string | null
          created_at?: string
          id: string
          stripe_status?: string
          updated_at?: string
        }
        Update: {
          agency_domain?: string | null
          agency_name?: string | null
          created_at?: string
          id?: string
          stripe_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      scan_email_log: {
        Row: {
          created_at: string
          provider_id: string | null
          recipient: string
          scan_id: number
          sent_at: string | null
        }
        Insert: {
          created_at?: string
          provider_id?: string | null
          recipient: string
          scan_id: number
          sent_at?: string | null
        }
        Update: {
          created_at?: string
          provider_id?: string | null
          recipient?: string
          scan_id?: number
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_email_log_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: true
            referencedRelation: "domain_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      sentiment_insights: {
        Row: {
          ad_angle_blueprint: string | null
          blueprint: string | null
          created_at: string
          domain: string
          dominant_theme: string | null
          friction: string | null
          funnel_stage: string | null
          good: string | null
          id: number
          scan_id: number | null
          strategist_takeaway: string | null
          user_id: string | null
        }
        Insert: {
          ad_angle_blueprint?: string | null
          blueprint?: string | null
          created_at?: string
          domain: string
          dominant_theme?: string | null
          friction?: string | null
          funnel_stage?: string | null
          good?: string | null
          id?: number
          scan_id?: number | null
          strategist_takeaway?: string | null
          user_id?: string | null
        }
        Update: {
          ad_angle_blueprint?: string | null
          blueprint?: string | null
          created_at?: string
          domain?: string
          dominant_theme?: string | null
          friction?: string | null
          funnel_stage?: string | null
          good?: string | null
          id?: number
          scan_id?: number | null
          strategist_takeaway?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sentiment_insights_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "domain_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      webhook_secrets: {
        Row: {
          created_at: string
          name: string
          value: string
        }
        Insert: {
          created_at?: string
          name: string
          value: string
        }
        Update: {
          created_at?: string
          name?: string
          value?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
