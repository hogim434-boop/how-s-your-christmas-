// ⚠️ 자동으로 만든 파일입니다. 직접 고치지 마세요.
//
// Supabase 데이터베이스의 표·함수 모양을 TypeScript 타입으로 옮긴 것입니다. (로드맵 Task 006-6, 2026-11-26)
// 데이터베이스를 바꾸면(supabase/migrations에 새 파일 추가) 이 파일도 다시 만들어야 합니다.
//  - 다시 만드는 방법: Supabase MCP의 generate_typescript_types 결과를 이 파일에 그대로 붙여 넣기
//
// 💡 쓰는 방법 (Task 007에서 Supabase 연결 코드를 만들 때):
//    createClient<Database>(주소, 키) 처럼 넘기면, supabase.from("letters") 같은 코드에서
//    칸 이름을 잘못 쓰면 빨간 줄로 알려 줍니다.
// 💡 손으로 쓴 타입은 types/domain.ts에 있습니다. (kind가 "friends" | "couple"처럼 더 좁게 적혀 있음)

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
    PostgrestVersion: "17.1"
  }
  public: {
    Tables: {
      couple_answers: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          question_no: number
          unlock_at: string
          village_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          question_no: number
          unlock_at: string
          village_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          question_no?: number
          unlock_at?: string
          village_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_answers_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_answers_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "villages"
            referencedColumns: ["id"]
          },
        ]
      }
      letters: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          opened_at: string | null
          paper: string
          recipient_id: string
          sender_id: string
          unlock_at: string
          village_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          opened_at?: string | null
          paper?: string
          recipient_id: string
          sender_id: string
          unlock_at: string
          village_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          opened_at?: string | null
          paper?: string
          recipient_id?: string
          sender_id?: string
          unlock_at?: string
          village_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "letters_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letters_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letters_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "villages"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          id: string
          kind: string
          level: number | null
          sent_at: string
          user_id: string
          village_id: string
        }
        Insert: {
          id?: string
          kind: string
          level?: number | null
          sent_at?: string
          user_id: string
          village_id: string
        }
        Update: {
          id?: string
          kind?: string
          level?: number | null
          sent_at?: string
          user_id?: string
          village_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "villages"
            referencedColumns: ["id"]
          },
        ]
      }
      residents: {
        Row: {
          character_parts: Json | null
          id: string
          joined_at: string
          user_id: string
          village_id: string
        }
        Insert: {
          character_parts?: Json | null
          id?: string
          joined_at?: string
          user_id: string
          village_id: string
        }
        Update: {
          character_parts?: Json | null
          id?: string
          joined_at?: string
          user_id?: string
          village_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "residents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residents_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "villages"
            referencedColumns: ["id"]
          },
        ]
      }
      user_secrets: {
        Row: {
          kakao_message_token: string | null
          user_id: string
        }
        Insert: {
          kakao_message_token?: string | null
          user_id: string
        }
        Update: {
          kakao_message_token?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_secrets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_provider: string
          created_at: string
          id: string
          line_notify_id: string | null
          name: string
          provider_user_id: string
        }
        Insert: {
          auth_provider: string
          created_at?: string
          id: string
          line_notify_id?: string | null
          name: string
          provider_user_id: string
        }
        Update: {
          auth_provider?: string
          created_at?: string
          id?: string
          line_notify_id?: string | null
          name?: string
          provider_user_id?: string
        }
        Relationships: []
      }
      villages: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invite_code: string
          kind: string
          max_decor_level: number
          name: string
          photo_save_count: number
          star_attached_at: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invite_code: string
          kind: string
          max_decor_level?: number
          name: string
          photo_save_count?: number
          star_attached_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          kind?: string
          max_decor_level?: number
          name?: string
          photo_save_count?: number
          star_attached_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "villages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_village: {
        Args: { p_kind: string; p_name: string }
        Returns: {
          created_at: string
          created_by: string
          id: string
          invite_code: string
          kind: string
          max_decor_level: number
          name: string
          photo_save_count: number
          star_attached_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "villages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_letter: { Args: { p_letter: string }; Returns: undefined }
      join_village: { Args: { p_code: string }; Returns: string }
      mark_letter_opened: { Args: { p_letter: string }; Returns: undefined }
      received_letters_locked: {
        Args: { p_village: string }
        Returns: {
          created_at: string
          id: string
        }[]
      }
      village_name_by_invite: {
        Args: { p_code: string }
        Returns: {
          kind: string
          name: string
        }[]
      }
      village_progress: {
        Args: { p_village: string }
        Returns: {
          done_count: number
          resident_count: number
        }[]
      }
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
    Enums: {},
  },
} as const
