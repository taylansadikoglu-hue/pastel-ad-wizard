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
      ad_creatives: {
        Row: {
          agency_id: number | null
          ai_metadata: Json | null
          brand_name: string | null
          category: string | null
          channel_type: string | null
          created_at: string | null
          creative_url: string | null
          dominant_reaction: string | null
          estimated_spend: number | null
          id: number
          sentiment_score: number | null
        }
        Insert: {
          agency_id?: number | null
          ai_metadata?: Json | null
          brand_name?: string | null
          category?: string | null
          channel_type?: string | null
          created_at?: string | null
          creative_url?: string | null
          dominant_reaction?: string | null
          estimated_spend?: number | null
          id?: number
          sentiment_score?: number | null
        }
        Update: {
          agency_id?: number | null
          ai_metadata?: Json | null
          brand_name?: string | null
          category?: string | null
          channel_type?: string | null
          created_at?: string | null
          creative_url?: string | null
          dominant_reaction?: string | null
          estimated_spend?: number | null
          id?: number
          sentiment_score?: number | null
        }
        Relationships: []
      }
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
          data_quality: string | null
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
          market_signal: string | null
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
          data_quality?: string | null
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
          market_signal?: string | null
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
          data_quality?: string | null
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
          market_signal?: string | null
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
      ad_reactions: {
        Row: {
          ad_id: number | null
          id: number
          processed_at: string | null
          sentiment_data: Json | null
        }
        Insert: {
          ad_id?: number | null
          id?: number
          processed_at?: string | null
          sentiment_data?: Json | null
        }
        Update: {
          ad_id?: number | null
          id?: number
          processed_at?: string | null
          sentiment_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_reactions_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ad_creatives"
            referencedColumns: ["id"]
          },
        ]
      }
      ads: {
        Row: {
          ai_analysis_summary: string | null
          ai_sentiment: string | null
          ai_sov_score: number | null
          ai_tags: Json | null
          created_at: string | null
          embedding: string | null
          id: number
          image_hash: string
          messaging: string | null
          sentiment: string | null
          tags: Json | null
        }
        Insert: {
          ai_analysis_summary?: string | null
          ai_sentiment?: string | null
          ai_sov_score?: number | null
          ai_tags?: Json | null
          created_at?: string | null
          embedding?: string | null
          id?: number
          image_hash: string
          messaging?: string | null
          sentiment?: string | null
          tags?: Json | null
        }
        Update: {
          ai_analysis_summary?: string | null
          ai_sentiment?: string | null
          ai_sov_score?: number | null
          ai_tags?: Json | null
          created_at?: string | null
          embedding?: string | null
          id?: number
          image_hash?: string
          messaging?: string | null
          sentiment?: string | null
          tags?: Json | null
        }
        Relationships: []
      }
      advertiser_discovery_candidates: {
        Row: {
          advertiser_id: string | null
          advertiser_name: string | null
          approved: boolean | null
          confidence: number | null
          created_at: string | null
          domain: string
          id: number
          review_decision: string | null
          source: string | null
        }
        Insert: {
          advertiser_id?: string | null
          advertiser_name?: string | null
          approved?: boolean | null
          confidence?: number | null
          created_at?: string | null
          domain: string
          id?: number
          review_decision?: string | null
          source?: string | null
        }
        Update: {
          advertiser_id?: string | null
          advertiser_name?: string | null
          approved?: boolean | null
          confidence?: number | null
          created_at?: string | null
          domain?: string
          id?: number
          review_decision?: string | null
          source?: string | null
        }
        Relationships: []
      }
      advertiser_dna_history: {
        Row: {
          created_at: string | null
          domain: string
          id: number
          placements: number | null
          snapshot_date: string
          top_buyer_stage: string | null
          top_cta: string | null
          top_emotion: string | null
          top_offer_type: string | null
          top_product: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          id?: number
          placements?: number | null
          snapshot_date?: string
          top_buyer_stage?: string | null
          top_cta?: string | null
          top_emotion?: string | null
          top_offer_type?: string | null
          top_product?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: number
          placements?: number | null
          snapshot_date?: string
          top_buyer_stage?: string | null
          top_cta?: string | null
          top_emotion?: string | null
          top_offer_type?: string | null
          top_product?: string | null
        }
        Relationships: []
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
      advertiser_registry: {
        Row: {
          category: string | null
          country: string | null
          created_at: string | null
          discovery_notes: string | null
          discovery_status: string | null
          domain: string
          google_advertiser_id: string | null
          id: number
          is_active: boolean | null
          last_discovered_at: string | null
          priority: number | null
        }
        Insert: {
          category?: string | null
          country?: string | null
          created_at?: string | null
          discovery_notes?: string | null
          discovery_status?: string | null
          domain: string
          google_advertiser_id?: string | null
          id?: number
          is_active?: boolean | null
          last_discovered_at?: string | null
          priority?: number | null
        }
        Update: {
          category?: string | null
          country?: string | null
          created_at?: string | null
          discovery_notes?: string | null
          discovery_status?: string | null
          domain?: string
          google_advertiser_id?: string | null
          id?: number
          is_active?: boolean | null
          last_discovered_at?: string | null
          priority?: number | null
        }
        Relationships: []
      }
      agencies: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      agency_profiles: {
        Row: {
          accent_color: string
          agency_name: string | null
          created_at: string | null
          id: number
          logo_url: string | null
          primary_color: string
          slack_webhook_url: string | null
          user_id: string
          white_label_enabled: boolean
        }
        Insert: {
          accent_color?: string
          agency_name?: string | null
          created_at?: string | null
          id?: number
          logo_url?: string | null
          primary_color?: string
          slack_webhook_url?: string | null
          user_id: string
          white_label_enabled?: boolean
        }
        Update: {
          accent_color?: string
          agency_name?: string | null
          created_at?: string | null
          id?: number
          logo_url?: string | null
          primary_color?: string
          slack_webhook_url?: string | null
          user_id?: string
          white_label_enabled?: boolean
        }
        Relationships: []
      }
      agency_watchlist: {
        Row: {
          agency_id: string
          created_at: string
          domain: string
          id: string
          label: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          domain: string
          id?: string
          label?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          domain?: string
          id?: string
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_watchlist_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      category_leaderboard: {
        Row: {
          category: string
          domain: string
          id: number
          keyword_coverage: number
          share_of_voice: number
          spend_volume: number
          updated_at: string
        }
        Insert: {
          category: string
          domain: string
          id?: never
          keyword_coverage: number
          share_of_voice: number
          spend_volume: number
          updated_at?: string
        }
        Update: {
          category?: string
          domain?: string
          id?: never
          keyword_coverage?: number
          share_of_voice?: number
          spend_volume?: number
          updated_at?: string
        }
        Relationships: []
      }
      client_watchlist_competitors: {
        Row: {
          competitor_domain: string
          created_at: string | null
          id: number
          watchlist_id: number | null
        }
        Insert: {
          competitor_domain: string
          created_at?: string | null
          id?: number
          watchlist_id?: number | null
        }
        Update: {
          competitor_domain?: string
          created_at?: string | null
          id?: number
          watchlist_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_watchlist_competitors_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "client_watchlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_watchlist_competitors_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "ra_client_watchlist"
            referencedColumns: ["watchlist_id"]
          },
        ]
      }
      client_watchlists: {
        Row: {
          category: string | null
          client_domain: string
          client_name: string
          country: string | null
          created_at: string | null
          id: number
        }
        Insert: {
          category?: string | null
          client_domain: string
          client_name: string
          country?: string | null
          created_at?: string | null
          id?: number
        }
        Update: {
          category?: string | null
          client_domain?: string
          client_name?: string
          country?: string | null
          created_at?: string | null
          id?: number
        }
        Relationships: []
      }
      customer_voice_items: {
        Row: {
          author_handle: string | null
          brand_domain: string
          created_at: string | null
          external_id: string | null
          id: number
          likes: number | null
          platform: string
          posted_at: string | null
          rating: number | null
          raw: Json | null
          replies: number | null
          source_url: string | null
          text: string | null
        }
        Insert: {
          author_handle?: string | null
          brand_domain: string
          created_at?: string | null
          external_id?: string | null
          id?: number
          likes?: number | null
          platform: string
          posted_at?: string | null
          rating?: number | null
          raw?: Json | null
          replies?: number | null
          source_url?: string | null
          text?: string | null
        }
        Update: {
          author_handle?: string | null
          brand_domain?: string
          created_at?: string | null
          external_id?: string | null
          id?: number
          likes?: number | null
          platform?: string
          posted_at?: string | null
          rating?: number | null
          raw?: Json | null
          replies?: number | null
          source_url?: string | null
          text?: string | null
        }
        Relationships: []
      }
      domain_scans: {
        Row: {
          average_cpc: number | null
          created_at: string | null
          domain: string
          engine_output: Json | null
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
          engine_output?: Json | null
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
          engine_output?: Json | null
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
      market_signals: {
        Row: {
          brand_domain: string | null
          captured_at: string | null
          content: string | null
          created_at: string | null
          engagement: number | null
          id: number
          platform: string | null
          signal_type: string | null
          source_url: string | null
          title: string | null
        }
        Insert: {
          brand_domain?: string | null
          captured_at?: string | null
          content?: string | null
          created_at?: string | null
          engagement?: number | null
          id?: number
          platform?: string | null
          signal_type?: string | null
          source_url?: string | null
          title?: string | null
        }
        Update: {
          brand_domain?: string | null
          captured_at?: string | null
          content?: string | null
          created_at?: string | null
          engagement?: number | null
          id?: number
          platform?: string | null
          signal_type?: string | null
          source_url?: string | null
          title?: string | null
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
      reddit_brand_sentiment: {
        Row: {
          brand_domain: string
          collected_at: string | null
          id: number
          negative_mentions: number | null
          neutral_mentions: number | null
          positive_mentions: number | null
          top_negative_theme: string | null
          top_positive_theme: string | null
        }
        Insert: {
          brand_domain: string
          collected_at?: string | null
          id?: number
          negative_mentions?: number | null
          neutral_mentions?: number | null
          positive_mentions?: number | null
          top_negative_theme?: string | null
          top_positive_theme?: string | null
        }
        Update: {
          brand_domain?: string
          collected_at?: string | null
          id?: number
          negative_mentions?: number | null
          neutral_mentions?: number | null
          positive_mentions?: number | null
          top_negative_theme?: string | null
          top_positive_theme?: string | null
        }
        Relationships: []
      }
      reddit_posts: {
        Row: {
          brand_domain: string
          collected_at: string | null
          comment_count: number | null
          created_utc: string | null
          id: number
          post_id: string | null
          score: number | null
          selftext: string | null
          subreddit: string | null
          title: string | null
          url: string | null
        }
        Insert: {
          brand_domain: string
          collected_at?: string | null
          comment_count?: number | null
          created_utc?: string | null
          id?: number
          post_id?: string | null
          score?: number | null
          selftext?: string | null
          subreddit?: string | null
          title?: string | null
          url?: string | null
        }
        Update: {
          brand_domain?: string
          collected_at?: string | null
          comment_count?: number | null
          created_utc?: string | null
          id?: number
          post_id?: string | null
          score?: number | null
          selftext?: string | null
          subreddit?: string | null
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      reddit_themes: {
        Row: {
          brand_domain: string
          created_at: string | null
          evidence: string | null
          id: number
          mentions: number | null
          sentiment: string | null
          theme: string
        }
        Insert: {
          brand_domain: string
          created_at?: string | null
          evidence?: string | null
          id?: number
          mentions?: number | null
          sentiment?: string | null
          theme: string
        }
        Update: {
          brand_domain?: string
          created_at?: string | null
          evidence?: string | null
          id?: number
          mentions?: number | null
          sentiment?: string | null
          theme?: string
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
      sightings: {
        Row: {
          ad_id: number | null
          id: number
          medium: string | null
          seen_at: string | null
          source_url: string | null
        }
        Insert: {
          ad_id?: number | null
          id?: number
          medium?: string | null
          seen_at?: string | null
          source_url?: string | null
        }
        Update: {
          ad_id?: number | null
          id?: number
          medium?: string | null
          seen_at?: string | null
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sightings_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      spend_alerts: {
        Row: {
          alert_type: string
          change_pct: number | null
          domain: string
          fired_at: string
          id: number
          new_value: number | null
          old_value: number | null
          user_id: string | null
        }
        Insert: {
          alert_type: string
          change_pct?: number | null
          domain: string
          fired_at?: string
          id?: number
          new_value?: number | null
          old_value?: number | null
          user_id?: string | null
        }
        Update: {
          alert_type?: string
          change_pct?: number | null
          domain?: string
          fired_at?: string
          id?: number
          new_value?: number | null
          old_value?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      spend_history: {
        Row: {
          ai_sentiment: string | null
          ai_sov_score: number | null
          channel: string | null
          domain: string | null
          estimated_spend: number | null
          id: number
          snapshot_date: string | null
        }
        Insert: {
          ai_sentiment?: string | null
          ai_sov_score?: number | null
          channel?: string | null
          domain?: string | null
          estimated_spend?: number | null
          id?: number
          snapshot_date?: string | null
        }
        Update: {
          ai_sentiment?: string | null
          ai_sov_score?: number | null
          channel?: string | null
          domain?: string | null
          estimated_spend?: number | null
          id?: number
          snapshot_date?: string | null
        }
        Relationships: []
      }
      spend_snapshots: {
        Row: {
          avg_cpc: number | null
          created_at: string | null
          creative_count: number | null
          domain: string
          id: number
          keywords: number | null
          scan_id: number | null
          snapshot_date: string
          spend: number | null
        }
        Insert: {
          avg_cpc?: number | null
          created_at?: string | null
          creative_count?: number | null
          domain: string
          id?: number
          keywords?: number | null
          scan_id?: number | null
          snapshot_date?: string
          spend?: number | null
        }
        Update: {
          avg_cpc?: number | null
          created_at?: string | null
          creative_count?: number | null
          domain?: string
          id?: number
          keywords?: number | null
          scan_id?: number | null
          snapshot_date?: string
          spend?: number | null
        }
        Relationships: []
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
      trend_signals: {
        Row: {
          brand_domain: string
          created_at: string | null
          id: number
          interest_score: number
          keyword: string
          source: string | null
          trend_date: string
        }
        Insert: {
          brand_domain: string
          created_at?: string | null
          id?: number
          interest_score: number
          keyword: string
          source?: string | null
          trend_date: string
        }
        Update: {
          brand_domain?: string
          created_at?: string | null
          id?: number
          interest_score?: number
          keyword?: string
          source?: string | null
          trend_date?: string
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
      advertiser_benchmark: {
        Row: {
          domain: string | null
          placements: number | null
          primary_buyer_stage: string | null
          primary_emotion: string | null
          primary_offer_strategy: string | null
          primary_product: string | null
        }
        Relationships: []
      }
      advertiser_campaign_analytics: {
        Row: {
          avg_sentiment: number | null
          brand_name: string | null
          channel_type: string | null
          flight_end: string | null
          flight_start: string | null
          total_creatives: number | null
          total_spend: number | null
        }
        Relationships: []
      }
      advertiser_candidate_review: {
        Row: {
          advertiser_id: string | null
          advertiser_name: string | null
          approved: boolean | null
          category: string | null
          confidence: number | null
          current_advertiser_id: string | null
          domain: string | null
          review_status: string | null
        }
        Relationships: []
      }
      advertiser_coverage: {
        Row: {
          category: string | null
          coverage_status: string | null
          domain: string | null
          google_advertiser_id: string | null
          latest_placement: string | null
          placements: number | null
        }
        Relationships: []
      }
      advertiser_emotion_mix: {
        Row: {
          domain: string | null
          emotional_driver: string | null
          placements: number | null
          share_percent: number | null
        }
        Relationships: []
      }
      advertiser_market_dna: {
        Row: {
          domain: string | null
          placements: number | null
          top_buyer_stage: string | null
          top_cta: string | null
          top_emotion: string | null
          top_offer_type: string | null
          top_product: string | null
        }
        Relationships: []
      }
      advertiser_market_dna_dashboard: {
        Row: {
          buyer_stage: string | null
          dna_signature: string | null
          domain: string | null
          funnel_focus: string | null
          offer_strategy: string | null
          placements: number | null
          primary_cta: string | null
          primary_emotion: string | null
          primary_product: string | null
        }
        Relationships: []
      }
      advertiser_market_dna_summary: {
        Row: {
          domain: string | null
          market_dna: string | null
          placements: number | null
          top_buyer_stage: string | null
          top_cta: string | null
          top_emotion: string | null
          top_offer_type: string | null
          top_product: string | null
        }
        Relationships: []
      }
      advertiser_pipeline: {
        Row: {
          category: string | null
          domain: string | null
          pipeline_stage: string | null
        }
        Insert: {
          category?: string | null
          domain?: string | null
          pipeline_stage?: never
        }
        Update: {
          category?: string | null
          domain?: string | null
          pipeline_stage?: never
        }
        Relationships: []
      }
      advertiser_positioning: {
        Row: {
          buyer_stage: string | null
          domain: string | null
          emotion: string | null
          emotion_score: number | null
          funnel_score: number | null
          placements: number | null
          product: string | null
        }
        Relationships: []
      }
      advertiser_product_mix: {
        Row: {
          domain: string | null
          placements: number | null
          product_type: string | null
          share_percent: number | null
        }
        Relationships: []
      }
      advertiser_recommendations: {
        Row: {
          domain: string | null
          recommendation: string | null
          top_buyer_stage: string | null
          top_cta: string | null
          top_emotion: string | null
          top_offer_type: string | null
          top_product: string | null
        }
        Relationships: []
      }
      advertiser_scorecard: {
        Row: {
          domain: string | null
          funnel_focus: string | null
          placements: number | null
          top_buyer_stage: string | null
          top_cta: string | null
          top_emotion: string | null
          top_offer_type: string | null
          top_product: string | null
        }
        Relationships: []
      }
      advertiser_snapshot: {
        Row: {
          domain: string | null
          placements: number | null
          top_buyer_stage: string | null
          top_cta: string | null
          top_emotion: string | null
          top_offer_type: string | null
          top_product: string | null
        }
        Relationships: []
      }
      advertiser_stage_mix: {
        Row: {
          buyer_stage: string | null
          domain: string | null
          placements: number | null
          share_percent: number | null
        }
        Relationships: []
      }
      advertiser_strategy_profile: {
        Row: {
          buyer_stage: string | null
          dna_signature: string | null
          domain: string | null
          funnel_focus: string | null
          offer_strategy: string | null
          placements: number | null
          positioning_archetype: string | null
          primary_cta: string | null
          primary_emotion: string | null
          primary_product: string | null
          strategy_summary: string | null
        }
        Relationships: []
      }
      advertiser_strategy_snapshot: {
        Row: {
          domain: string | null
          placements: number | null
          strategist_summary: string | null
          top_buyer_stage: string | null
          top_cta: string | null
          top_emotion: string | null
          top_offer_type: string | null
          top_product: string | null
        }
        Relationships: []
      }
      brand_dna: {
        Row: {
          brand: string | null
          creative_volume: number | null
          customer_stage: string | null
          emotion_mix: string | null
          primary_category: string | null
          primary_cta: string | null
        }
        Relationships: []
      }
      brand_dna_v2: {
        Row: {
          brand: string | null
          creative_volume: number | null
          customer_stage: string | null
          dominant_emotion: string | null
          emotion_mix: string | null
          primary_category: string | null
          primary_cta: string | null
        }
        Relationships: []
      }
      category_heatmap: {
        Row: {
          category: string | null
          competition_level: string | null
          placements: number | null
        }
        Relationships: []
      }
      category_leaders: {
        Row: {
          category: string | null
          domain: string | null
          market_rank: number | null
          placements: number | null
        }
        Relationships: []
      }
      category_ownership: {
        Row: {
          category: string | null
          domain: string | null
          placements: number | null
          share_of_voice: number | null
        }
        Relationships: []
      }
      category_whitespace: {
        Row: {
          emotional_driver: string | null
          market_condition: string | null
          placements: number | null
          product_type: string | null
          share_percent: number | null
        }
        Relationships: []
      }
      competitive_pressure: {
        Row: {
          avg_creatives_per_brand: number | null
          category: string | null
          competitors: number | null
          total_creatives: number | null
        }
        Relationships: []
      }
      dashboard_health: {
        Row: {
          ads_analysed: number | null
          ads_collected: number | null
          coverage_score: number | null
          empty_records: number | null
          pending_analysis: number | null
        }
        Relationships: []
      }
      emotion_distribution: {
        Row: {
          domain: string | null
          emotional_driver: string | null
          placements: number | null
          share_percent: number | null
        }
        Relationships: []
      }
      market_category_leaders: {
        Row: {
          domain: string | null
          market_rank: number | null
          normalized_product: string | null
          placements: number | null
        }
        Relationships: []
      }
      market_dna: {
        Row: {
          buyer_stage: string | null
          domain: string | null
          emotional_driver: string | null
          offer_signal: string | null
          offer_type: string | null
          placements: number | null
          primary_cta: string | null
          product_type: string | null
        }
        Relationships: []
      }
      market_dna_v2: {
        Row: {
          domain: string | null
          emotion_mix: string | null
        }
        Relationships: []
      }
      market_emotion_opportunity_gaps: {
        Row: {
          emotional_driver: string | null
          opportunity_status: string | null
          placements: number | null
          share_percent: number | null
        }
        Relationships: []
      }
      market_leaders: {
        Row: {
          category: string | null
          leader: string | null
          placements: number | null
          top_buyer_stage: string | null
          top_emotion: string | null
          top_offer_type: string | null
        }
        Relationships: []
      }
      market_positioning_matrix: {
        Row: {
          advertiser: string | null
          buyer_stage: string | null
          dna_signature: string | null
          funnel_focus: string | null
          offer_strategy: string | null
          placements: number | null
          positioning_archetype: string | null
          primary_cta: string | null
          primary_emotion: string | null
          primary_product: string | null
        }
        Relationships: []
      }
      market_shift_alerts: {
        Row: {
          current_emotion: string | null
          current_product: string | null
          current_stage: string | null
          domain: string | null
          previous_emotion: string | null
          previous_product: string | null
          previous_stage: string | null
          shift_type: string | null
        }
        Relationships: []
      }
      market_whitespace: {
        Row: {
          emotional_driver: string | null
          opportunity_status: string | null
          share_percent: number | null
          strategic_priority: string | null
        }
        Relationships: []
      }
      mv_safety_ad_trends: {
        Row: {
          ad_count: number | null
          category: string | null
          week: string | null
        }
        Relationships: []
      }
      normalized_ad_placements: {
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
          domain: string | null
          emotional_driver: string | null
          extracted_offer: string | null
          first_seen: string | null
          headline: string | null
          hook: string | null
          hook_analysis: string | null
          id: number | null
          landing_url: string | null
          last_seen: string | null
          market_signal: string | null
          media_url: string | null
          normalized_product: string | null
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
          domain?: string | null
          emotional_driver?: string | null
          extracted_offer?: string | null
          first_seen?: string | null
          headline?: string | null
          hook?: string | null
          hook_analysis?: string | null
          id?: number | null
          landing_url?: string | null
          last_seen?: string | null
          market_signal?: string | null
          media_url?: string | null
          normalized_product?: never
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
          domain?: string | null
          emotional_driver?: string | null
          extracted_offer?: string | null
          first_seen?: string | null
          headline?: string | null
          hook?: string | null
          hook_analysis?: string | null
          id?: number | null
          landing_url?: string | null
          last_seen?: string | null
          market_signal?: string | null
          media_url?: string | null
          normalized_product?: never
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
      normalized_products: {
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
          domain: string | null
          emotional_driver: string | null
          extracted_offer: string | null
          first_seen: string | null
          headline: string | null
          hook: string | null
          hook_analysis: string | null
          id: number | null
          landing_url: string | null
          last_seen: string | null
          market_signal: string | null
          media_url: string | null
          normalized_product: string | null
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
          domain?: string | null
          emotional_driver?: string | null
          extracted_offer?: string | null
          first_seen?: string | null
          headline?: string | null
          hook?: string | null
          hook_analysis?: string | null
          id?: number | null
          landing_url?: string | null
          last_seen?: string | null
          market_signal?: string | null
          media_url?: string | null
          normalized_product?: never
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
          domain?: string | null
          emotional_driver?: string | null
          extracted_offer?: string | null
          first_seen?: string | null
          headline?: string | null
          hook?: string | null
          hook_analysis?: string | null
          id?: number | null
          landing_url?: string | null
          last_seen?: string | null
          market_signal?: string | null
          media_url?: string | null
          normalized_product?: never
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
      placement_quality: {
        Row: {
          ad_title: string | null
          domain: string | null
          id: number | null
          product_type: string | null
          quality: string | null
        }
        Insert: {
          ad_title?: string | null
          domain?: string | null
          id?: number | null
          product_type?: string | null
          quality?: never
        }
        Update: {
          ad_title?: string | null
          domain?: string | null
          id?: number | null
          product_type?: string | null
          quality?: never
        }
        Relationships: []
      }
      platform_data_quality: {
        Row: {
          empty_ads: number | null
          needs_enrichment_ads: number | null
          strategist_ready_ads: number | null
          strategist_ready_rate: number | null
          total_ads: number | null
        }
        Relationships: []
      }
      platform_health: {
        Row: {
          classification_rate: number | null
          classified_ads: number | null
          total_ads: number | null
        }
        Relationships: []
      }
      platform_pipeline_summary: {
        Row: {
          coverage_percent: number | null
          live_brands: number | null
          pending_brands: number | null
          tracked_brands: number | null
        }
        Relationships: []
      }
      platform_status: {
        Row: {
          coverage_rate: number | null
          missing_advertisers: number | null
          ready_advertisers: number | null
          total_advertisers: number | null
        }
        Relationships: []
      }
      positioning_matrix: {
        Row: {
          buyer_stage: string | null
          domain: string | null
          emotional_driver: string | null
          normalized_product: string | null
          placements: number | null
        }
        Relationships: []
      }
      positioning_quadrant: {
        Row: {
          domain: string | null
          placements: number | null
          top_buyer_stage: string | null
          top_emotion: string | null
          top_product: string | null
          x_axis: number | null
          y_axis: number | null
        }
        Relationships: []
      }
      ra_advertiser_discovery_queue: {
        Row: {
          category: string | null
          country: string | null
          discovery_status: string | null
          domain: string | null
          id: number | null
        }
        Insert: {
          category?: never
          country?: string | null
          discovery_status?: string | null
          domain?: string | null
          id?: number | null
        }
        Update: {
          category?: never
          country?: string | null
          discovery_status?: string | null
          domain?: string | null
          id?: number | null
        }
        Relationships: []
      }
      ra_advertiser_priority_dashboard: {
        Row: {
          advertisers: number | null
          category: string | null
          portfolio_share: number | null
          priority: number | null
        }
        Relationships: []
      }
      ra_advisor: {
        Row: {
          category: string | null
          emotion: string | null
          market_density: string | null
          opportunity_score: number | null
          recommendation: string | null
          strategic_priority: string | null
        }
        Relationships: []
      }
      ra_audience_signals: {
        Row: {
          brand: string | null
          emotion: string | null
          placements: number | null
          share_percent: number | null
        }
        Relationships: []
      }
      ra_barbs_brief: {
        Row: {
          category: string | null
          client_domain: string | null
          client_name: string | null
          emerging_challenger: string | null
          fastest_mover: string | null
          report_date: string | null
          strongest_threat: string | null
          whitespace_category: string | null
          whitespace_emotion: string | null
          whitespace_recommendation: string | null
          whitespace_score: number | null
        }
        Relationships: []
      }
      ra_barbs_brief_cards: {
        Row: {
          emerging_challenger: string | null
          headline: string | null
          observation: string | null
          recommended_action: string | null
          strategic_opening: string | null
          strongest_threat: string | null
          why_it_matters: string | null
        }
        Relationships: []
      }
      ra_barbs_client_brief: {
        Row: {
          category: string | null
          client_domain: string | null
          client_name: string | null
          emerging_challenger: string | null
          fastest_mover: string | null
          headline: string | null
          recommended_action: string | null
          strategic_opening: string | null
          strongest_threat: string | null
          summary: string | null
          whitespace_category: string | null
          whitespace_emotion: string | null
          whitespace_score: number | null
        }
        Relationships: []
      }
      ra_barbs_confidence: {
        Row: {
          ads_analysed: number | null
          brands_tracked: number | null
          classification_coverage: number | null
          trend_points: number | null
        }
        Relationships: []
      }
      ra_barbs_context_pack: {
        Row: {
          content: string | null
          section: string | null
        }
        Relationships: []
      }
      ra_barbs_customer_reality: {
        Row: {
          brand_domain: string | null
          conversations: number | null
          discussion_depth: number | null
          engagement: number | null
        }
        Relationships: []
      }
      ra_barbs_evidence: {
        Row: {
          competitor_domain: string | null
          creative_volume: number | null
          demand: number | null
          strategic_position: string | null
          threat_index: number | null
          threat_rank: number | null
          threat_score: number | null
        }
        Relationships: []
      }
      ra_barbs_evidence_pack: {
        Row: {
          competitor_domain: string | null
          confidence: string | null
          creative_volume: number | null
          demand: number | null
          market_rank: string | null
          threat_context: string | null
          threat_score: number | null
        }
        Relationships: []
      }
      ra_barbs_executive_brief: {
        Row: {
          challenger_summary: string | null
          headline: string | null
          opening_summary: string | null
          recommended_action: string | null
          summary: string | null
          threat_summary: string | null
        }
        Relationships: []
      }
      ra_barbs_executive_brief_v2: {
        Row: {
          challenger_summary: string | null
          headline: string | null
          opening_summary: string | null
          recommended_action: string | null
          summary: string | null
          threat_summary: string | null
        }
        Relationships: []
      }
      ra_barbs_launch_brief: {
        Row: {
          emerging_challenger: string | null
          headline: string | null
          observation: string | null
          recommended_action: string | null
          strategic_opening: string | null
          strongest_threat: string | null
          why_it_matters: string | null
        }
        Relationships: []
      }
      ra_barbs_prompt_pack: {
        Row: {
          answer: string | null
          question: string | null
        }
        Relationships: []
      }
      ra_barbs_quant: {
        Row: {
          competitor_domain: string | null
          confidence: string | null
          creative_volume: number | null
          demand: number | null
          demand_vs_avg_pct: number | null
          threat_rank: number | null
          threat_score: number | null
          threat_vs_avg_pct: number | null
        }
        Relationships: []
      }
      ra_barbs_recommendations: {
        Row: {
          category: string | null
          client_domain: string | null
          client_name: string | null
          emerging_challenger: string | null
          recommendation: string | null
          strongest_threat: string | null
          whitespace_emotion: string | null
        }
        Relationships: []
      }
      ra_barbs_verdict: {
        Row: {
          verdict: string | null
        }
        Relationships: []
      }
      ra_brand_intelligence: {
        Row: {
          brand: string | null
          creative_volume: number | null
          customer_stage: string | null
          dominant_emotion: string | null
          emotion_mix: string | null
          primary_category: string | null
          primary_cta: string | null
        }
        Relationships: []
      }
      ra_brand_opportunities: {
        Row: {
          brand_domain: string | null
          creative_volume: number | null
          keyword: string | null
          latest_interest: number | null
          momentum: string | null
          opportunity_score: number | null
          pressure: string | null
        }
        Relationships: []
      }
      ra_ceo_summary: {
        Row: {
          ceo_summary: string | null
        }
        Relationships: []
      }
      ra_client_actions: {
        Row: {
          client_name: string | null
          emerging_challenger: string | null
          recommended_action: string | null
          strongest_threat: string | null
          whitespace_emotion: string | null
        }
        Relationships: []
      }
      ra_client_health: {
        Row: {
          client_name: string | null
          emerging_challenger: string | null
          recommended_action: string | null
          strategic_health_score: number | null
          strongest_threat: string | null
        }
        Relationships: []
      }
      ra_client_impact: {
        Row: {
          client_domain: string | null
          client_name: string | null
          competitor: string | null
          momentum: string | null
          opportunity_score: number | null
          pressure: string | null
          threat_level: string | null
        }
        Relationships: []
      }
      ra_client_snapshot: {
        Row: {
          category: string | null
          client_name: string | null
          emerging_challenger: string | null
          recommended_action: string | null
          strategic_opening: string | null
          strongest_threat: string | null
        }
        Relationships: []
      }
      ra_client_threats: {
        Row: {
          competitor_domain: string | null
          creative_volume: number | null
          demand: number | null
          threat_score: number | null
        }
        Relationships: []
      }
      ra_client_watchlist: {
        Row: {
          category: string | null
          client_domain: string | null
          client_name: string | null
          competitor_domain: string | null
          country: string | null
          watchlist_id: number | null
        }
        Relationships: []
      }
      ra_cmo_brief: {
        Row: {
          headline: string | null
          market_temperature: string | null
          observation: string | null
          pressure_summary: string | null
          recommended_action: string | null
        }
        Relationships: []
      }
      ra_competitive_gap: {
        Row: {
          gap_narrative: string | null
          strategic_opening: string | null
          strongest_threat: string | null
        }
        Relationships: []
      }
      ra_competitor_rankings: {
        Row: {
          competitor_domain: string | null
          threat_index: number | null
          threat_rank: number | null
          threat_score: number | null
        }
        Relationships: []
      }
      ra_customer_voice: {
        Row: {
          brand: string | null
          negative_mentions: number | null
          neutral_mentions: number | null
          positive_mentions: number | null
          top_negative_theme: string | null
          top_positive_theme: string | null
        }
        Relationships: []
      }
      ra_customer_voice_leaderboard: {
        Row: {
          avg_likes: number | null
          avg_replies: number | null
          brand_domain: string | null
          total_mentions: number | null
        }
        Relationships: []
      }
      ra_customer_voice_summary: {
        Row: {
          avg_likes: number | null
          avg_replies: number | null
          brand_domain: string | null
          mentions: number | null
          platform: string | null
        }
        Relationships: []
      }
      ra_daily_alerts: {
        Row: {
          alert: string | null
          alert_type: string | null
        }
        Relationships: []
      }
      ra_daily_brief: {
        Row: {
          headline: string | null
          observation: string | null
          recommended_action: string | null
          why_it_matters: string | null
        }
        Relationships: []
      }
      ra_daily_change_feed: {
        Row: {
          brand_domain: string | null
          latest_interest: number | null
          market_change: string | null
          momentum: string | null
          pressure: string | null
        }
        Relationships: []
      }
      ra_dashboard: {
        Row: {
          ads_collected: number | null
          brands_tracked: number | null
          intelligence_coverage: number | null
          live_brands: number | null
          open_opportunities: number | null
          pending_brands: number | null
        }
        Relationships: []
      }
      ra_dashboard_hero: {
        Row: {
          fastest_momentum: string | null
          market_leader: string | null
          market_story: string | null
          opportunity_score: number | null
          top_opportunity: string | null
        }
        Relationships: []
      }
      ra_demo_story: {
        Row: {
          headline: string | null
          observation: string | null
          recommended_action: string | null
          why_it_matters: string | null
        }
        Relationships: []
      }
      ra_emotion_ownership: {
        Row: {
          brand: string | null
          emotion: string | null
          share_percent: number | null
        }
        Relationships: []
      }
      ra_executive_pack: {
        Row: {
          ceo_summary: string | null
          headline: string | null
          market_temperature: string | null
          observation: string | null
          outlook: string | null
          pressure_summary: string | null
          recommended_action: string | null
        }
        Relationships: []
      }
      ra_executive_scorecard: {
        Row: {
          biggest_threat: string | null
          brands_monitored: number | null
          challenger: string | null
          creatives_monitored: number | null
          opportunity: string | null
        }
        Relationships: []
      }
      ra_executive_summary: {
        Row: {
          dominant_emotion: string | null
          dominant_market: string | null
          strongest_brand: string | null
          top_opportunity_category: string | null
          top_opportunity_emotion: string | null
        }
        Relationships: []
      }
      ra_executive_summary_v2: {
        Row: {
          brand_opportunity_score: number | null
          market_leader: string | null
          report_date: string | null
          top_brand_opportunity: string | null
          whitespace_category: string | null
          whitespace_emotion: string | null
          whitespace_recommendation: string | null
        }
        Relationships: []
      }
      ra_executive_takeaways: {
        Row: {
          takeaway: string | null
        }
        Relationships: []
      }
      ra_investment_signal: {
        Row: {
          investment_signal: string | null
          recommended_action: string | null
          whitespace_emotion: string | null
        }
        Relationships: []
      }
      ra_launch_health: {
        Row: {
          brands: number | null
          creatives: number | null
          threats_identified: number | null
          trend_points: number | null
        }
        Relationships: []
      }
      ra_market_intelligence: {
        Row: {
          avg_creatives_per_brand: number | null
          brand: string | null
          category: string | null
          competitors: number | null
          placements: number | null
          share_of_voice: number | null
          top_buyer_stage: string | null
          top_emotion: string | null
          total_creatives: number | null
          x_axis: number | null
          y_axis: number | null
        }
        Relationships: []
      }
      ra_market_map_100: {
        Row: {
          category: string | null
          country: string | null
          discovery_status: string | null
          domain: string | null
          is_active: boolean | null
        }
        Insert: {
          category?: never
          country?: string | null
          discovery_status?: string | null
          domain?: string | null
          is_active?: boolean | null
        }
        Update: {
          category?: never
          country?: string | null
          discovery_status?: string | null
          domain?: string | null
          is_active?: boolean | null
        }
        Relationships: []
      }
      ra_market_momentum: {
        Row: {
          avg_interest: number | null
          brand_domain: string | null
          keyword: string | null
          latest_interest: number | null
          momentum: string | null
          peak_interest: number | null
        }
        Relationships: []
      }
      ra_market_opportunities: {
        Row: {
          category: string | null
          emotion: string | null
          market_density: string | null
          recommendation: string | null
          strategic_priority: string | null
        }
        Relationships: []
      }
      ra_market_outlook: {
        Row: {
          market_temperature: string | null
          outlook: string | null
          pressure_summary: string | null
        }
        Relationships: []
      }
      ra_market_pressure: {
        Row: {
          brand_domain: string | null
          creative_volume: number | null
          keyword: string | null
          latest_interest: number | null
          momentum: string | null
          pressure: string | null
        }
        Relationships: []
      }
      ra_market_snapshot: {
        Row: {
          snapshot: string | null
        }
        Relationships: []
      }
      ra_market_summary: {
        Row: {
          ads: number | null
          category: string | null
          share_of_market: number | null
        }
        Relationships: []
      }
      ra_market_temperature: {
        Row: {
          market_temperature: string | null
        }
        Relationships: []
      }
      ra_meeting_prep: {
        Row: {
          content: string | null
          section: string | null
        }
        Relationships: []
      }
      ra_narrative_gap: {
        Row: {
          brand: string | null
          dominant_emotion: string | null
          gap_risk: string | null
          narrative_gap_summary: string | null
          negative_mentions: number | null
          top_negative_theme: string | null
        }
        Relationships: []
      }
      ra_opportunity_score: {
        Row: {
          brand_domain: string | null
          creative_volume: number | null
          keyword: string | null
          latest_interest: number | null
          momentum: string | null
          opportunity_score: number | null
          pressure: string | null
        }
        Relationships: []
      }
      ra_opportunity_score_v2: {
        Row: {
          brand_domain: string | null
          creative_volume: number | null
          keyword: string | null
          latest_interest: number | null
          momentum: string | null
          opportunity_score: number | null
          pressure: string | null
        }
        Relationships: []
      }
      ra_opportunity_summary: {
        Row: {
          emotion: string | null
          opportunity_score: number | null
          priority: string | null
        }
        Relationships: []
      }
      ra_pitch_brief: {
        Row: {
          action: string | null
          category: string | null
          category_leader: string | null
          dominant_emotion: string | null
          recommendation: string | null
          whitespace_emotion: string | null
        }
        Relationships: []
      }
      ra_pressure_summary: {
        Row: {
          critical_threats: number | null
          high_threats: number | null
          low_threats: number | null
          medium_threats: number | null
          pressure_narrative: string | null
        }
        Relationships: []
      }
      ra_product_normalization: {
        Row: {
          id: number | null
          normalized_product: string | null
        }
        Insert: {
          id?: number | null
          normalized_product?: never
        }
        Update: {
          id?: number | null
          normalized_product?: never
        }
        Relationships: []
      }
      ra_strategic_actions: {
        Row: {
          action: string | null
          priority: number | null
        }
        Relationships: []
      }
      ra_strategic_risks: {
        Row: {
          competitor_domain: string | null
          risk_level: string | null
          risk_narrative: string | null
          threat_score: number | null
        }
        Relationships: []
      }
      ra_strategic_score: {
        Row: {
          brand_domain: string | null
          creative_volume: number | null
          keyword: string | null
          latest_interest: number | null
          momentum: string | null
          pressure: string | null
          strategic_score: number | null
        }
        Relationships: []
      }
      ra_strategic_territories: {
        Row: {
          avg_share: number | null
          brands_using: number | null
          emotion: string | null
          territory_status: string | null
        }
        Relationships: []
      }
      ra_strategy_brief: {
        Row: {
          fastest_momentum: string | null
          generated_date: string | null
          market_leader: string | null
          opportunity_score: number | null
          recommendation: string | null
          top_opportunity: string | null
        }
        Relationships: []
      }
      ra_strategy_narratives: {
        Row: {
          ads: number | null
          category: string | null
          category_narrative: string | null
          share_of_market: number | null
        }
        Relationships: []
      }
      ra_threat_radar: {
        Row: {
          competitor_domain: string | null
          creative_volume: number | null
          demand: number | null
          threat_level: string | null
          threat_score: number | null
        }
        Relationships: []
      }
      ra_top_opportunities: {
        Row: {
          category: string | null
          emotion: string | null
          market_density: string | null
          opportunity_score: number | null
          recommendation: string | null
          strategic_priority: string | null
        }
        Relationships: []
      }
      ra_trend_opportunities: {
        Row: {
          brand_domain: string | null
          creative_volume: number | null
          keyword: string | null
          latest_interest: number | null
          momentum: string | null
          pressure: string | null
          recommendation: string | null
        }
        Relationships: []
      }
      ra_trend_summary: {
        Row: {
          avg_interest: number | null
          brand_domain: string | null
          data_points: number | null
          keyword: string | null
          latest_date: string | null
          latest_interest: number | null
          peak_interest: number | null
        }
        Relationships: []
      }
      ra_weekly_email: {
        Row: {
          headline: string | null
          observation: string | null
          recommended_action: string | null
          why_it_matters: string | null
        }
        Relationships: []
      }
      ra_win_themes: {
        Row: {
          messaging_direction: string | null
          theme: string | null
        }
        Relationships: []
      }
      revenuead_health: {
        Row: {
          active_advertisers: number | null
          classification_rate: number | null
          coverage_rate: number | null
          total_ads: number | null
          total_advertisers: number | null
        }
        Relationships: []
      }
      strategic_change_feed: {
        Row: {
          current_emotional_positioning: string | null
          current_funnel_strategy: string | null
          current_offer_strategy: string | null
          current_product_focus: string | null
          domain: string | null
          previous_emotional_positioning: string | null
          previous_funnel_strategy: string | null
          previous_offer_strategy: string | null
          previous_product_focus: string | null
          strategic_change: string | null
          strategist_summary: string | null
        }
        Relationships: []
      }
      strategic_recommendations: {
        Row: {
          domain: string | null
          primary_buyer_stage: string | null
          primary_emotion: string | null
          primary_offer_strategy: string | null
          primary_product: string | null
          recommendation: string | null
        }
        Relationships: []
      }
      strategist_brief: {
        Row: {
          brand: string | null
          customer_stage: string | null
          dominant_emotion: string | null
          emotion_mix: string | null
          executive_summary: string | null
          primary_category: string | null
          share_of_voice: number | null
        }
        Relationships: []
      }
      strategist_headlines: {
        Row: {
          domain: string | null
          headline: string | null
          supporting_text: string | null
        }
        Relationships: []
      }
      strategist_opportunities: {
        Row: {
          category: string | null
          emotion: string | null
          market_density: string | null
          recommendation: string | null
          strategic_priority: string | null
        }
        Relationships: []
      }
      whitespace_matrix: {
        Row: {
          advertisers: number | null
          category: string | null
          emotion: string | null
          market_density: string | null
        }
        Relationships: []
      }
      whitespace_recommendations: {
        Row: {
          emotional_driver: string | null
          product_type: string | null
          share_percent: number | null
          strategist_recommendation: string | null
        }
        Relationships: []
      }
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
