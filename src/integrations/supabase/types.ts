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
      action_limits: {
        Row: {
          action: string
          attempts: number
          user_id: string
          window_start: string
        }
        Insert: {
          action: string
          attempts?: number
          user_id: string
          window_start: string
        }
        Update: {
          action?: string
          attempts?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      bids: {
        Row: {
          amount: number
          created_at: string
          id: string
          participant_id: string
          request_id: string | null
          room_id: string
          room_player_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          participant_id: string
          request_id?: string | null
          room_id: string
          room_player_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          participant_id?: string
          request_id?: string | null
          room_id?: string
          room_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bids_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_room_player_id_fkey"
            columns: ["room_player_id"]
            isOneToOne: false
            referencedRelation: "room_players"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_lineups: {
        Row: {
          captain: string
          lineup: string[]
          participant_id: string
          room_id: string
          updated_at: string
          vice_captain: string
        }
        Insert: {
          captain: string
          lineup: string[]
          participant_id: string
          room_id: string
          updated_at?: string
          vice_captain: string
        }
        Update: {
          captain?: string
          lineup?: string[]
          participant_id?: string
          room_id?: string
          updated_at?: string
          vice_captain?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_lineups_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_lineups_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_snapshots: {
        Row: {
          cohorts: Json
          coverage: Json
          cutoff: string
          id: string
          imported_at: string
          provenance: Json
          status: string
          version: string
        }
        Insert: {
          cohorts: Json
          coverage: Json
          cutoff: string
          id: string
          imported_at?: string
          provenance: Json
          status?: string
          version: string
        }
        Update: {
          cohorts?: Json
          coverage?: Json
          cutoff?: string
          id?: string
          imported_at?: string
          provenance?: Json
          status?: string
          version?: string
        }
        Relationships: []
      }
      evidence_innings: {
        Row: {
          aggregates: Json
          format: string
          innings: number
          played_on: string
          snapshot_id: string
          source_id: string
          source_player_id: string
        }
        Insert: {
          aggregates: Json
          format: string
          innings: number
          played_on: string
          snapshot_id: string
          source_id: string
          source_player_id: string
        }
        Update: {
          aggregates?: Json
          format?: string
          innings?: number
          played_on?: string
          snapshot_id?: string
          source_id?: string
          source_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_innings_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "evaluation_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_matches: {
        Row: {
          competition: string
          content_hash: string
          info: Json
          played_on: string
          revision: number
          snapshot_id: string
          source_id: string
        }
        Insert: {
          competition: string
          content_hash: string
          info: Json
          played_on: string
          revision: number
          snapshot_id: string
          source_id: string
        }
        Update: {
          competition?: string
          content_hash?: string
          info?: Json
          played_on?: string
          revision?: number
          snapshot_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_matches_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "evaluation_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_players: {
        Row: {
          country: string
          identity_key: string
          mapping: Json
          name: string
          snapshot_id: string
          source_player_id: string | null
          stats: Json
        }
        Insert: {
          country: string
          identity_key: string
          mapping: Json
          name: string
          snapshot_id: string
          source_player_id?: string | null
          stats: Json
        }
        Update: {
          country?: string
          identity_key?: string
          mapping?: Json
          name?: string
          snapshot_id?: string
          source_player_id?: string | null
          stats?: Json
        }
        Relationships: [
          {
            foreignKeyName: "evidence_players_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "evaluation_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_positions: {
        Row: {
          cutoff: string
          format: string
          groups: Json
          identity_key: string
          method: string
          snapshot_id: string
        }
        Insert: {
          cutoff: string
          format: string
          groups: Json
          identity_key: string
          method?: string
          snapshot_id: string
        }
        Update: {
          cutoff?: string
          format?: string
          groups?: Json
          identity_key?: string
          method?: string
          snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_positions_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "evaluation_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      leadership_reviews: {
        Row: {
          captain_rating: number
          confidence: number
          created_at: string
          cutoff: string
          id: string
          player_id: string
          rationale: string
          reviewer: string
          rubric_version: string
          sources: Json
          status: string
          vice_captain_rating: number
        }
        Insert: {
          captain_rating?: number
          confidence?: number
          created_at?: string
          cutoff: string
          id?: string
          player_id: string
          rationale?: string
          reviewer: string
          rubric_version?: string
          sources?: Json
          status?: string
          vice_captain_rating?: number
        }
        Update: {
          captain_rating?: number
          confidence?: number
          created_at?: string
          cutoff?: string
          id?: string
          player_id?: string
          rationale?: string
          reviewer?: string
          rubric_version?: string
          sources?: Json
          status?: string
          vice_captain_rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "leadership_reviews_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          color: string
          id: string
          is_ready: boolean
          joined_at: string
          last_seen: string
          nickname: string
          purse: number
          room_id: string
          team_name: string
          user_id: string
        }
        Insert: {
          color?: string
          id?: string
          is_ready?: boolean
          joined_at?: string
          last_seen?: string
          nickname: string
          purse: number
          room_id: string
          team_name: string
          user_id: string
        }
        Update: {
          color?: string
          id?: string
          is_ready?: boolean
          joined_at?: string
          last_seen?: string
          nickname?: string
          purse?: number
          room_id?: string
          team_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          age_group: string
          base_price: number
          batting_hand: string
          bowling_style: string
          country: string
          created_at: string
          format: string
          id: string
          image_placeholder: string | null
          name: string
          nationality_type: string
          photo_credit: string | null
          photo_source: string | null
          photo_url: string | null
          rating: number
          role: string
          sub_role: string
          tier: string
        }
        Insert: {
          age_group?: string
          base_price: number
          batting_hand?: string
          bowling_style?: string
          country: string
          created_at?: string
          format: string
          id?: string
          image_placeholder?: string | null
          name: string
          nationality_type: string
          photo_credit?: string | null
          photo_source?: string | null
          photo_url?: string | null
          rating: number
          role: string
          sub_role: string
          tier: string
        }
        Update: {
          age_group?: string
          base_price?: number
          batting_hand?: string
          bowling_style?: string
          country?: string
          created_at?: string
          format?: string
          id?: string
          image_placeholder?: string | null
          name?: string
          nationality_type?: string
          photo_credit?: string | null
          photo_source?: string | null
          photo_url?: string | null
          rating?: number
          role?: string
          sub_role?: string
          tier?: string
        }
        Relationships: []
      }
      private_notes: {
        Row: {
          id: string
          notes: string
          room_id: string
          targets: Json
          updated_at: string
          user_id: string
          xi: Json
        }
        Insert: {
          id?: string
          notes?: string
          room_id: string
          targets?: Json
          updated_at?: string
          user_id: string
          xi?: Json
        }
        Update: {
          id?: string
          notes?: string
          room_id?: string
          targets?: Json
          updated_at?: string
          user_id?: string
          xi?: Json
        }
        Relationships: [
          {
            foreignKeyName: "private_notes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_evaluation_inputs: {
        Row: {
          frozen_at: string
          player_facts: Json
          room_id: string
          rules: Json
          snapshot_id: string | null
          version: string
        }
        Insert: {
          frozen_at?: string
          player_facts: Json
          room_id: string
          rules: Json
          snapshot_id?: string | null
          version: string
        }
        Update: {
          frozen_at?: string
          player_facts?: Json
          room_id?: string
          rules?: Json
          snapshot_id?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_evaluation_inputs_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_evaluation_inputs_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "evaluation_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      room_evaluations: {
        Row: {
          computed_at: string
          holdings_hash: string
          result: Json
          room_id: string
          snapshot_id: string | null
          version: string
        }
        Insert: {
          computed_at?: string
          holdings_hash: string
          result: Json
          room_id: string
          snapshot_id?: string | null
          version: string
        }
        Update: {
          computed_at?: string
          holdings_hash?: string
          result?: Json
          room_id?: string
          snapshot_id?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_evaluations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_evaluations_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "evaluation_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      room_events: {
        Row: {
          created_at: string
          id: number
          kind: string
          message: string
          room_id: string
          room_player_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          kind: string
          message: string
          room_id: string
          room_player_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          kind?: string
          message?: string
          room_id?: string
          room_player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_players: {
        Row: {
          id: string
          lot_order: number
          player_id: string
          room_id: string
          round: number
          set_name: string
          sold_price: number | null
          sold_to: string | null
          status: string
        }
        Insert: {
          id?: string
          lot_order: number
          player_id: string
          room_id: string
          round?: number
          set_name: string
          sold_price?: number | null
          sold_to?: string | null
          status?: string
        }
        Update: {
          id?: string
          lot_order?: number
          player_id?: string
          room_id?: string
          round?: number
          set_name?: string
          sold_price?: number | null
          sold_to?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_players_sold_to_fkey"
            columns: ["sold_to"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      room_updates: {
        Row: {
          revision: number
          room_id: string
        }
        Insert: {
          revision?: number
          room_id: string
        }
        Update: {
          revision?: number
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_updates_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          accel_done: boolean
          accelerated_order: string[] | null
          code: string
          created_at: string
          current_bid: number | null
          current_bidder: string | null
          current_rp: string | null
          evaluation_version: string
          first_round_order: string[] | null
          format: string
          host_id: string
          id: string
          lot_ends_at: string | null
          lot_version: number
          name: string
          paused_remaining_ms: number | null
          review_ends_at: string | null
          scoring_patch: string | null
          settings: Json
          status: string
          trade_ends_at: string | null
        }
        Insert: {
          accel_done?: boolean
          accelerated_order?: string[] | null
          code: string
          created_at?: string
          current_bid?: number | null
          current_bidder?: string | null
          current_rp?: string | null
          evaluation_version?: string
          first_round_order?: string[] | null
          format: string
          host_id: string
          id?: string
          lot_ends_at?: string | null
          lot_version?: number
          name: string
          paused_remaining_ms?: number | null
          review_ends_at?: string | null
          scoring_patch?: string | null
          settings: Json
          status?: string
          trade_ends_at?: string | null
        }
        Update: {
          accel_done?: boolean
          accelerated_order?: string[] | null
          code?: string
          created_at?: string
          current_bid?: number | null
          current_bidder?: string | null
          current_rp?: string | null
          evaluation_version?: string
          first_round_order?: string[] | null
          format?: string
          host_id?: string
          id?: string
          lot_ends_at?: string | null
          lot_version?: number
          name?: string
          paused_remaining_ms?: number | null
          review_ends_at?: string | null
          scoring_patch?: string | null
          settings?: Json
          status?: string
          trade_ends_at?: string | null
        }
        Relationships: []
      }
      sales: {
        Row: {
          created_at: string
          id: string
          participant_id: string | null
          price: number | null
          room_id: string
          room_player_id: string
          undone: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          participant_id?: string | null
          price?: number | null
          room_id: string
          room_player_id: string
          undone?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          participant_id?: string | null
          price?: number | null
          room_id?: string
          room_player_id?: string
          undone?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sales_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_room_player_id_fkey"
            columns: ["room_player_id"]
            isOneToOne: false
            referencedRelation: "room_players"
            referencedColumns: ["id"]
          },
        ]
      }
      squads: {
        Row: {
          acquired_via: string
          created_at: string
          id: string
          participant_id: string
          player_id: string
          price: number
          room_id: string
          room_player_id: string
        }
        Insert: {
          acquired_via?: string
          created_at?: string
          id?: string
          participant_id: string
          player_id: string
          price: number
          room_id: string
          room_player_id: string
        }
        Update: {
          acquired_via?: string
          created_at?: string
          id?: string
          participant_id?: string
          player_id?: string
          price?: number
          room_id?: string
          room_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squads_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squads_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squads_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squads_room_player_id_fkey"
            columns: ["room_player_id"]
            isOneToOne: false
            referencedRelation: "room_players"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          cash: number
          created_at: string
          from_participant: string
          id: string
          offer_players: string[]
          parent_trade_id: string | null
          request_players: string[]
          resolved_at: string | null
          room_id: string
          status: string
          to_participant: string
        }
        Insert: {
          cash?: number
          created_at?: string
          from_participant: string
          id?: string
          offer_players?: string[]
          parent_trade_id?: string | null
          request_players?: string[]
          resolved_at?: string | null
          room_id: string
          status?: string
          to_participant: string
        }
        Update: {
          cash?: number
          created_at?: string
          from_participant?: string
          id?: string
          offer_players?: string[]
          parent_trade_id?: string | null
          request_players?: string[]
          resolved_at?: string | null
          room_id?: string
          status?: string
          to_participant?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_from_participant_fkey"
            columns: ["from_participant"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_parent_trade_id_fkey"
            columns: ["parent_trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_to_participant_fkey"
            columns: ["to_participant"]
            isOneToOne: false
            referencedRelation: "participants"
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
      _advance_lot: { Args: { p_room: string }; Returns: undefined }
      _check_after_trade: {
        Args: { p_before: Json; p_part: string; p_settings: Json }
        Returns: undefined
      }
      _is_pacer: { Args: { p_role: string; p_sub: string }; Returns: boolean }
      _is_spinner: { Args: { p_sub: string }; Returns: boolean }
      _log: {
        Args: { p_kind: string; p_msg: string; p_room: string }
        Returns: undefined
      }
      _max_bid: {
        Args: {
          p_counts: Json
          p_purse: number
          p_role: string
          p_settings: Json
        }
        Returns: number
      }
      _me: {
        Args: { p_room: string }
        Returns: {
          color: string
          id: string
          is_ready: boolean
          joined_at: string
          last_seen: string
          nickname: string
          purse: number
          room_id: string
          team_name: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "participants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _release_limit: {
        Args: { p_action: string; p_limit: number; p_seconds: number }
        Returns: boolean
      }
      _resolve_lot: {
        Args: { p_force_unsold: boolean; p_room: string }
        Returns: undefined
      }
      _shuffle_player_ids: { Args: { p_ids: string[] }; Returns: string[] }
      _squad_counts: { Args: { p_part: string }; Returns: Json }
      allow_evaluation: { Args: { p_room: string }; Returns: boolean }
      commit_room_evaluation: {
        Args: {
          p_hash: string
          p_result: Json
          p_room: string
          p_snapshot: string
        }
        Returns: Json
      }
      create_room: {
        Args: {
          p_color: string
          p_format: string
          p_name: string
          p_nickname: string
          p_settings: Json
          p_team: string
        }
        Returns: Json
      }
      evaluation_holdings_hash: { Args: { p_room: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      heartbeat: { Args: { p_room: string }; Returns: undefined }
      host_control:
        | { Args: { p_action: string; p_room: string }; Returns: undefined }
        | {
            Args: {
              p_action: string
              p_room: string
              p_sale: string
              p_status: string
              p_version: number
            }
            Returns: undefined
          }
      import_evidence_bundle: { Args: { p_bundle: Json }; Returns: string }
      import_evidence_bundle_with_positions: {
        Args: { p_bundle: Json }
        Returns: string
      }
      is_room_member: { Args: { p_room: string }; Returns: boolean }
      join_room: {
        Args: {
          p_code: string
          p_color: string
          p_nickname: string
          p_team: string
        }
        Returns: string
      }
      my_rooms: { Args: never; Returns: Json }
      next_bid_amount: {
        Args: { p_base: number; p_current: number; p_settings: Json }
        Returns: number
      }
      open_trades: {
        Args: { p_minutes: number; p_room: string }
        Returns: undefined
      }
      place_bid:
        | { Args: { p_amount: number; p_room: string }; Returns: number }
        | {
            Args: {
              p_amount: number
              p_lot: string
              p_request: string
              p_room: string
              p_version: number
            }
            Returns: number
          }
      propose_trade: {
        Args: {
          p_cash: number
          p_offer: string[]
          p_parent?: string
          p_request: string[]
          p_room: string
          p_to: string
        }
        Returns: string
      }
      respond_trade: {
        Args: { p_action: string; p_trade: string }
        Returns: undefined
      }
      review_leadership: {
        Args: {
          p_captain: number
          p_confidence: number
          p_cutoff: string
          p_player: string
          p_rationale: string
          p_sources: Json
          p_status: string
          p_vice: number
        }
        Returns: string
      }
      room_projection: { Args: { p_room: string }; Returns: Json }
      server_now: { Args: never; Returns: string }
      set_pool: {
        Args: { p_player_ids: string[]; p_room: string }
        Returns: number
      }
      start_review: { Args: { p_room: string }; Returns: undefined }
      submit_evaluation_lineup: {
        Args: {
          p_auto?: boolean
          p_captain: string
          p_lineup: string[]
          p_room: string
          p_vice: string
        }
        Returns: undefined
      }
      tick: { Args: { p_room: string }; Returns: string }
      transfer_host: {
        Args: { p_participant: string; p_room: string }
        Returns: undefined
      }
      update_my_team: {
        Args: {
          p_color: string
          p_ready: boolean
          p_room: string
          p_team: string
        }
        Returns: undefined
      }
      update_room_settings: {
        Args: { p_room: string; p_settings: Json }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
