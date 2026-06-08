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
          channel: string | null
          channel_platform: string | null
          created_at: string | null
          creative_url: string | null
          days_running: number | null
          domain: string
          hook: string | null
          id: number
          media_url: string | null
          raw: Json | null
          raw_copy: string | null
          scan_id: number | null
        }
        Insert: {
          ad_title?: string | null
          ad_type?: string | null
          channel?: string | null
          channel_platform?: string | null
          created_at?: string | null
          creative_url?: string | null
          days_running?: number | null
          domain: string
          hook?: string | null
          id?: number
          media_url?: string | null
          raw?: Json | null
          raw_copy?: string | null
          scan_id?: number | null
        }
        Update: {
          ad_title?: string | null
          ad_type?: string | null
          channel?: string | null
          channel_platform?: string | null
          created_at?: string | null
          creative_url?: string | null
          days_running?: number | null
          domain?: string
          hook?: string | null
          id?: number
          media_url?: string | null
          raw?: Json | null
          raw_copy?: string | null
          scan_id?: number | null
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
          created_at: string | null
          domain: string
          id: number
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          id?: number
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: number
          status?: string
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
      sentiment_insights: {
        Row: {
          blueprint: string | null
          created_at: string
          domain: string
          friction: string | null
          good: string | null
          id: number
          scan_id: number | null
          user_id: string | null
        }
        Insert: {
          blueprint?: string | null
          created_at?: string
          domain: string
          friction?: string | null
          good?: string | null
          id?: number
          scan_id?: number | null
          user_id?: string | null
        }
        Update: {
          blueprint?: string | null
          created_at?: string
          domain?: string
          friction?: string | null
          good?: string | null
          id?: number
          scan_id?: number | null
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
