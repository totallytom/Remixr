import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing Supabase environment variables!");
  console.error("📝 Please create a .env file in the root directory with:");
  console.error("   VITE_SUPABASE_URL=your_supabase_url");
  console.error("   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key");
  console.error("");
  console.error("⚠️ The app may not work correctly without these variables.");
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key",
  {
    global: {
      fetch: (url, options) => {
        // Auth requests (sign in, token refresh) must NOT be aborted — killing them
        // causes TOKEN_REFRESH_FAILED which logs the user out on every reload.
        // Only apply the timeout to regular data queries.
        const isAuthRequest = typeof url === 'string' && url.includes('/auth/v1/');
        if (isAuthRequest) {
          return fetch(url, options);
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        return fetch(url, { ...options, signal: controller.signal })
          .finally(() => clearTimeout(timeout));
      },
    },
  }
);


// Database types
export interface Database {
  public: {
    Tables: {
      albums: {
        Row: {
          id: string;
          title: string;
          artist: string;
          cover: string;
          genre: string;
          price?: number;
          description?: string;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          artist: string;
          cover: string;
          genre: string;
          price?: number;
          description?: string;
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          artist?: string;
          cover?: string;
          genre?: string;
          price?: number;
          description?: string;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "albums_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      users: {
        Row: {
          id: string;
          username: string;
          email: string;
          avatar: string;
          followers: number;
          following: number;
          role: 'musician' | 'consumer';
          is_verified: boolean;
          is_private: boolean;
          is_admin?: boolean;
          suspended_at?: string | null;
          is_verified_artist?: boolean;
          artist_name?: string;
          bio?: string;
          genres?: string[];
          external_links?: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          email: string;
          avatar?: string;
          followers?: number;
          following?: number;
          role: 'musician' | 'consumer';
          is_verified?: boolean;
          is_private?: boolean;
          is_admin?: boolean;
          is_verified_artist?: boolean;
          artist_name?: string;
          bio?: string;
          genres?: string[];
          external_links?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          email?: string;
          avatar?: string;
          followers?: number;
          following?: number;
          role?: 'musician' | 'consumer';
          is_verified?: boolean;
          is_private?: boolean;
          is_admin?: boolean;
          is_verified_artist?: boolean;
          artist_name?: string;
          bio?: string;
          genres?: string[];
          external_links?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tracks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "playlists_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_receiver_id_fkey";
            columns: ["receiver_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      tracks: {
        Row: {
          id: string;
          title: string;
          artist: string;
          album: string;
          album_id?: string;
          duration: number;
          cover: string;
          audio_url: string;
          price?: number;
          genre: string;
          user_id: string;
          created_at: string;
          updated_at: string;
          preview_start_sec?: number;
          preview_duration_sec?: number;
          status: TrackStatus;
          audio_path: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          artist: string;
          album: string;
          album_id?: string;
          duration: number;
          cover: string;
          audio_url: string;
          price?: number;
          genre: string;
          user_id: string;
          created_at?: string;
          updated_at?: string;
          preview_start_sec?: number;
          preview_duration_sec?: number;
        };
        Update: {
          id?: string;
          title?: string;
          artist?: string;
          album?: string;
          album_id?: string;
          duration?: number;
          cover?: string;
          audio_url?: string;
          price?: number;
          genre?: string;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
          preview_start_sec?: number;
          preview_duration_sec?: number;
        };
        Relationships: [
          {
            foreignKeyName: "tracks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_track_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["track_id"];
          },
          {
            foreignKeyName: "playlist_tracks_track_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "playlist_tracks";
            referencedColumns: ["track_id"];
          }
        ];
      };
      user_play_history: {
        Row: {
          id: string;
          user_id: string;
          track_id: string;
          played_at: string;
          play_duration: number;
          completed: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          track_id: string;
          played_at?: string;
          play_duration?: number;
          completed?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          track_id?: string;
          played_at?: string;
          play_duration?: number;
          completed?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "user_play_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_play_history_track_id_fkey";
            columns: ["track_id"];
            isOneToOne: false;
            referencedRelation: "tracks";
            referencedColumns: ["id"];
          }
        ];
      };
      comments: {
        Row: {
          id: string;
          track_id: string;
          post_id?: string;
          user_id: string;
          content: string;
          likes: number;
          liked_by: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          track_id?: string;
          post_id?: string;
          user_id: string;
          content: string;
          likes?: number;
          liked_by?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          track_id?: string;
          post_id?: string;
          user_id?: string;
          content?: string;
          likes?: number;
          liked_by?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_track_id_fkey";
            columns: ["track_id"];
            isOneToOne: false;
            referencedRelation: "tracks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      playlists: {
        Row: {
          id: string;
          name: string;
          description?: string;
          cover?: string;
          created_by: string;
          is_public: boolean;
          created_at: string;
          updated_at: string;
          followers: number;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          cover?: string;
          created_by: string;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
          followers?: number;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          cover?: string;
          created_by?: string;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
          followers?: number;
        };
        Relationships: [
          {
            foreignKeyName: "playlists_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "playlist_tracks_playlist_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "playlist_tracks";
            referencedColumns: ["playlist_id"];
          }
        ];
      };
      playlist_tracks: {
        Row: {
          id: string;
          playlist_id: string;
          track_id: string;
          position: number;
          added_at: string;
        };
        Insert: {
          id?: string;
          playlist_id: string;
          track_id: string;
          position: number;
          added_at?: string;
        };
        Update: {
          id?: string;
          playlist_id?: string;
          track_id?: string;
          position?: number;
          added_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "playlist_tracks_playlist_id_fkey";
            columns: ["playlist_id"];
            isOneToOne: false;
            referencedRelation: "playlists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "playlist_tracks_track_id_fkey";
            columns: ["track_id"];
            isOneToOne: false;
            referencedRelation: "tracks";
            referencedColumns: ["id"];
          }
        ];
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          receiver_id: string;
          content: string;
          type: 'text' | 'audio' | 'image' | 'track';
          created_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          receiver_id: string;
          content: string;
          type?: 'text' | 'audio' | 'image' | 'track';
          created_at?: string;
        };
        Update: {
          id?: string;
          sender_id?: string;
          receiver_id?: string;
          content?: string;
          type?: 'text' | 'audio' | 'image' | 'track';
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_receiver_id_fkey";
            columns: ["receiver_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          caption: string;
          image_url?: string | null;
          music_url?: string | null;
          likes: number;
          liked_by: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          caption: string;
          image_url?: string | null;
          music_url?: string | null;
          likes?: number;
          liked_by?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          caption?: string;
          image_url?: string | null;
          music_url?: string | null;
          likes?: number;
          liked_by?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      follow_requests: {
        Row: {
          id: string;
          requester_id: string;
          target_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          target_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          requester_id?: string;
          target_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      concerts: {
        Row: {
          id: string;
          title: string;
          date: string;
          location: string;
          venue: string;
          description?: string;
          ticket_price?: number;
          ticket_url?: string;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          date: string;
          location: string;
          venue: string;
          description?: string;
          ticket_price?: number;
          ticket_url?: string;
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          date?: string;
          location?: string;
          venue?: string;
          description?: string;
          ticket_price?: number;
          ticket_url?: string;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "concerts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_follows: {
        Row: {
          id: string;
          follower_id: string;
          following_id: string;
          followed_at: string;
        };
        Insert: {
          id?: string;
          follower_id: string;
          following_id: string;
          followed_at?: string;
        };
        Update: {
          id?: string;
          follower_id?: string;
          following_id?: string;
          followed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_follows_follower_id_fkey";
            columns: ["follower_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_follows_following_id_fkey";
            columns: ["following_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      bookmarks: {
        Row: {
          id: string;
          user_id: string;
          track_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          track_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          track_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookmarks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookmarks_track_id_fkey";
            columns: ["track_id"];
            isOneToOne: false;
            referencedRelation: "tracks";
            referencedColumns: ["id"];
          }
        ];
      };
      track_rights: {
        Row: TrackRightsRow;
        Insert: never; // submit-track-rights Edge Function only
        Update: never;
        Relationships: [];
      };
      takedown_requests: {
        Row: TakedownRequestRow;
        Insert: {
          source: 'user_report';
          reason: TakedownReason;
          track_id: string;
          reporter_user_id: string;
          details?: string | null;
        };
        Update: Partial<Pick<TakedownRequestRow, 'status' | 'actioned_at' | 'actioned_by'>>; // admins
        Relationships: [];
      };
      counter_notices: {
        Row: CounterNoticeRow;
        Insert: never; // submit-counter-notice Edge Function only
        Update: { lawsuit_filed?: boolean }; // admins
        Relationships: [];
      };
      strikes: {
        Row: StrikeRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: never;
        Update: { read_at?: string | null };
        Relationships: [];
      };
      push_tokens: {
        Row: PushTokenRow;
        Insert: { user_id: string; expo_push_token: string; platform: PushPlatform };
        Update: { platform?: PushPlatform };
        Relationships: [];
      };
      audit_log: {
        Row: AuditLogRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      dmca_notices_legacy: {
        Row: {
          id: string;
          claimant_name: string;
          claimant_email: string;
          claimant_address: string | null;
          infringing_url: string;
          original_work: string;
          sworn_statement: boolean;
          track_id: string | null;
          status: string;
          submitted_at: string;
          resolved_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      submit_track_report: {
        Args: { p_track_id: string; p_reason: string; p_details?: string | null };
        Returns: 'ok' | 'already_reported';
      };
      get_takedown_for_uploader: {
        Args: { p_request_id: string };
        Returns: UploaderTakedownView[];
      };
      register_push_token: {
        Args: { p_token: string; p_platform: PushPlatform };
        Returns: undefined;
      };
      active_strike_count: {
        Args: { p_user_id: string };
        Returns: number;
      };
      strike_limit: {
        Args: Record<string, never>;
        Returns: number;
      };
      get_recommended_tracks: {
        Args: {
          user_uuid: string;
          limit_count?: number;
        };
        Returns: {
          id: string;
          title: string;
          artist: string;
          album: string;
          duration: number;
          cover: string;
          audio_url: string;
          price?: number;
          genre: string;
          user_id: string;
          created_at: string;
          recommendation_score: number;
        }[];
      };
      get_tracks_by_genre: {
        Args: {
          genre_filter: string;
          limit_count?: number;
          offset_count?: number;
        };
        Returns: {
          id: string;
          title: string;
          artist: string;
          album: string;
          duration: number;
          cover: string;
          audio_url: string;
          price?: number;
          genre: string;
          user_id: string;
          created_at: string;
          play_count: number;
        }[];
      };
      get_popular_tracks: {
        Args: {
          limit_count?: number;
          offset_count?: number;
        };
        Returns: {
          id: string;
          title: string;
          artist: string;
          album: string;
          duration: number;
          cover: string;
          audio_url: string;
          price?: number;
          genre: string;
          user_id: string;
          created_at: string;
          play_count: number;
        }[];
      };
      search_tracks: {
        Args: {
          search_query: string;
          limit_count?: number;
          offset_count?: number;
        };
        Returns: {
          id: string;
          title: string;
          artist: string;
          album: string;
          duration: number;
          cover: string;
          audio_url: string;
          price?: number;
          genre: string;
          user_id: string;
          created_at: string;
        }[];
      };
    };
    Enums: {
      rights_ownership_type: RightsOwnershipType;
      rights_samples: RightsSamples;
      rights_verification_status: RightsVerificationStatus;
      takedown_source: TakedownSource;
      takedown_reason: TakedownReason;
      takedown_status: TakedownStatus;
      notification_type: NotificationType;
    };
  };
}

// ─── Copyright compliance types (mirror supabase/migrations/20260926*) ───────

/** tracks.status — TEXT column with a CHECK constraint (not a Postgres enum). */
export type TrackStatus = 'pending_review' | 'published' | 'disabled' | 'removed';
export type RightsOwnershipType = 'original' | 'on_behalf' | 'remix';
export type RightsSamples = 'none' | 'royalty_free' | 'cleared' | 'uncleared';
export type RightsVerificationStatus = 'auto_passed' | 'flagged' | 'approved' | 'rejected';
export type TakedownSource = 'dmca_notice' | 'user_report';
export type TakedownReason = 'copyright' | 'impersonation' | 'other';
export type TakedownStatus = 'received' | 'removed' | 'rejected' | 'counter_noticed' | 'restored';
export type NotificationType =
  | 'track_flagged'
  | 'track_removed'
  | 'track_restored'
  | 'strike_added'
  | 'account_suspended';
export type PushPlatform = 'ios' | 'android' | 'web';

export interface TrackRightsRow {
  track_id: string;
  ownership_type: RightsOwnershipType;
  songwriters: string[];
  samples: RightsSamples;
  sample_source: string | null;
  permission_proof_path: string | null;
  legal_name: string;
  attested_at: string;
  attestation_version: string;
  isrc: string | null;
  already_released: boolean;
  distributor: string | null;
  release_url: string | null;
  p_line: string | null;
  c_line: string | null;
  pro: string | null;
  ipi: string | null;
  copyright_reg_number: string | null;
  verification_status: RightsVerificationStatus;
  verification_notes: Record<string, unknown>;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TakedownRequestRow {
  id: string;
  source: TakedownSource;
  reason: TakedownReason;
  track_id: string | null;
  track_owner_id: string | null;
  reporter_user_id: string | null;
  claimant_name: string | null;
  claimant_company: string | null;
  claimant_email: string | null;
  claimant_phone: string | null;
  claimant_address: string | null;
  copyrighted_work_description: string | null;
  infringing_url: string | null;
  good_faith_statement: boolean | null;
  accuracy_statement: boolean | null;
  signature: string | null;
  details: string | null;
  status: TakedownStatus;
  received_at: string;
  actioned_at: string | null;
  actioned_by: string | null;
  legacy_notice_id: string | null;
  updated_at: string;
}

export interface CounterNoticeRow {
  id: string;
  takedown_request_id: string;
  user_id: string;
  full_name: string;
  address: string;
  phone: string;
  email: string;
  removed_material_description: string;
  perjury_statement: boolean;
  jurisdiction_consent: boolean;
  service_of_process_consent: boolean;
  signature: string;
  submitted_at: string;
  forwarded_to_claimant_at: string | null;
  restore_after: string | null;
  lawsuit_filed: boolean;
  restored_at: string | null;
  updated_at: string;
}

export interface StrikeRow {
  id: string;
  user_id: string;
  track_id: string | null;
  takedown_request_id: string;
  created_at: string;
  voided_at: string | null;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  track_id: string | null;
  title: string;
  body: string;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
}

export interface PushTokenRow {
  id: string;
  user_id: string;
  expo_push_token: string;
  platform: PushPlatform;
  created_at: string;
  updated_at: string;
}

export interface AuditLogRow {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Row returned by the get_takedown_for_uploader RPC (no claimant contact details). */
export interface UploaderTakedownView {
  id: string;
  source: TakedownSource;
  reason: TakedownReason;
  status: TakedownStatus;
  claimant_name: string | null;
  claimant_company: string | null;
  copyrighted_work_description: string | null;
  infringing_url: string | null;
  details: string | null;
  received_at: string;
  actioned_at: string | null;
  track_id: string | null;
  track_title: string | null;
  track_artist: string | null;
  has_counter_notice: boolean;
} 