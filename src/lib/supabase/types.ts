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
    PostgrestVersion: "14.4"
  }
  gym: {
    Tables: {
      ai_usage: {
        Row: {
          created_at: string
          estimated_cost: number
          id: string
          model: string
          task_type: string
          tokens_in: number
          tokens_out: number
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_cost?: number
          id?: string
          model: string
          task_type: string
          tokens_in?: number
          tokens_out?: number
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_cost?: number
          id?: string
          model?: string
          task_type?: string
          tokens_in?: number
          tokens_out?: number
          user_id?: string
        }
        Relationships: []
      }
      body_check_ins: {
        Row: {
          check_in_date: string
          created_at: string
          energy: number | null
          id: string
          notes: string | null
          sleep_quality: number | null
          soreness_map: Json
          user_id: string
        }
        Insert: {
          check_in_date: string
          created_at?: string
          energy?: number | null
          id?: string
          notes?: string | null
          sleep_quality?: number | null
          soreness_map?: Json
          user_id: string
        }
        Update: {
          check_in_date?: string
          created_at?: string
          energy?: number | null
          id?: string
          notes?: string | null
          sleep_quality?: number | null
          soreness_map?: Json
          user_id?: string
        }
        Relationships: []
      }
      class_attendances: {
        Row: {
          attended_at: string
          class_id: string
          id: string
          notes: string | null
          rating: number | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          attended_at?: string
          class_id: string
          id?: string
          notes?: string | null
          rating?: number | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          attended_at?: string
          class_id?: string
          id?: string
          notes?: string | null
          rating?: number | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_attendances_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "gym_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_attendances_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          role: string
          tool_calls: Json | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          tool_calls?: Json | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ended_at: string | null
          id: string
          session_id: string | null
          started_at: string
          type: string
          user_id: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          session_id?: string | null
          started_at?: string
          type: string
          user_id: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          session_id?: string | null
          started_at?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          created_at: string
          description: string | null
          gym_id: string
          id: string
          name: string
          photo_url: string | null
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          gym_id: string
          id?: string
          name: string
          photo_url?: string | null
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          gym_id?: string
          id?: string
          name?: string
          photo_url?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "user_gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_muscle_groups: {
        Row: {
          exercise_id: string
          muscle_group_id: number
        }
        Insert: {
          exercise_id: string
          muscle_group_id: number
        }
        Update: {
          exercise_id?: string
          muscle_group_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "exercise_muscle_groups_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_muscle_groups_muscle_group_id_fkey"
            columns: ["muscle_group_id"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          description: string | null
          equipment_type: string | null
          id: string
          movement_type: string | null
          name: string
          primary_muscle_group: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          equipment_type?: string | null
          id?: string
          movement_type?: string | null
          name: string
          primary_muscle_group?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          equipment_type?: string | null
          id?: string
          movement_type?: string | null
          name?: string
          primary_muscle_group?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_primary_muscle_group_fkey"
            columns: ["primary_muscle_group"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_classes: {
        Row: {
          created_at: string
          day_of_week: number | null
          description: string | null
          difficulty_estimate: number | null
          duration_minutes: number | null
          gym_id: string
          id: string
          instructor: string | null
          muscle_group_tags: number[] | null
          name: string
          start_time: string | null
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          description?: string | null
          difficulty_estimate?: number | null
          duration_minutes?: number | null
          gym_id: string
          id?: string
          instructor?: string | null
          muscle_group_tags?: number[] | null
          name: string
          start_time?: string | null
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          description?: string | null
          difficulty_estimate?: number | null
          duration_minutes?: number | null
          gym_id?: string
          id?: string
          instructor?: string | null
          muscle_group_tags?: number[] | null
          name?: string
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gym_classes_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "user_gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      model_config: {
        Row: {
          config: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      muscle_groups: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: never
          name: string
        }
        Update: {
          id?: never
          name?: string
        }
        Relationships: []
      }
      pending_tasks: {
        Row: {
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          id: string
          input: Json
          max_retries: number
          output: Json | null
          retry_count: number
          status: string
          task_type: string
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          input?: Json
          max_retries?: number
          output?: Json | null
          retry_count?: number
          status?: string
          task_type: string
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          input?: Json
          max_retries?: number
          output?: Json | null
          retry_count?: number
          status?: string
          task_type?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_day_exercises: {
        Row: {
          exercise_id: string
          exercise_order: number
          id: string
          notes: string | null
          plan_day_id: string
          suggested_reps: string | null
          suggested_sets: number | null
          suggested_weight_kg: number | null
        }
        Insert: {
          exercise_id: string
          exercise_order: number
          id?: string
          notes?: string | null
          plan_day_id: string
          suggested_reps?: string | null
          suggested_sets?: number | null
          suggested_weight_kg?: number | null
        }
        Update: {
          exercise_id?: string
          exercise_order?: number
          id?: string
          notes?: string | null
          plan_day_id?: string
          suggested_reps?: string | null
          suggested_sets?: number | null
          suggested_weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_day_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_day_exercises_plan_day_id_fkey"
            columns: ["plan_day_id"]
            isOneToOne: false
            referencedRelation: "plan_days"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_day_muscle_groups: {
        Row: {
          muscle_group_id: number
          plan_day_id: string
        }
        Insert: {
          muscle_group_id: number
          plan_day_id: string
        }
        Update: {
          muscle_group_id?: number
          plan_day_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_day_muscle_groups_muscle_group_id_fkey"
            columns: ["muscle_group_id"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_day_muscle_groups_plan_day_id_fkey"
            columns: ["plan_day_id"]
            isOneToOne: false
            referencedRelation: "plan_days"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_days: {
        Row: {
          created_at: string
          day_order: number
          id: string
          label: string
          plan_id: string
        }
        Insert: {
          created_at?: string
          day_order: number
          id?: string
          label: string
          plan_id: string
        }
        Update: {
          created_at?: string
          day_order?: number
          id?: string
          label?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          split_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          split_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          split_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          experience_level: string | null
          fitness_goal: string | null
          height_cm: number | null
          id: string
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          experience_level?: string | null
          fitness_goal?: string | null
          height_cm?: number | null
          id: string
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          experience_level?: string | null
          fitness_goal?: string | null
          height_cm?: number | null
          id?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      session_cardio: {
        Row: {
          avg_heart_rate: number | null
          created_at: string
          distance_km: number | null
          duration_s: number
          exercise_id: string
          id: string
          notes: string | null
          session_id: string
        }
        Insert: {
          avg_heart_rate?: number | null
          created_at?: string
          distance_km?: number | null
          duration_s: number
          exercise_id: string
          id?: string
          notes?: string | null
          session_id: string
        }
        Update: {
          avg_heart_rate?: number | null
          created_at?: string
          distance_km?: number | null
          duration_s?: number
          exercise_id?: string
          id?: string
          notes?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_cardio_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_cardio_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_sets: {
        Row: {
          created_at: string
          duration_s: number | null
          exercise_id: string
          id: string
          notes: string | null
          reps: number | null
          rpe: number | null
          session_id: string
          set_number: number
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          duration_s?: number | null
          exercise_id: string
          id?: string
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          session_id: string
          set_number: number
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          duration_s?: number | null
          exercise_id?: string
          id?: string
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          session_id?: string
          set_number?: number
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_sets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          gym_id: string | null
          id: string
          notes: string | null
          plan_day_id: string | null
          pre_energy: number | null
          pre_mood: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          gym_id?: string | null
          id?: string
          notes?: string | null
          plan_day_id?: string | null
          pre_energy?: number | null
          pre_mood?: string | null
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          gym_id?: string | null
          id?: string
          notes?: string | null
          plan_day_id?: string | null
          pre_energy?: number | null
          pre_mood?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "user_gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_plan_day_id_fkey"
            columns: ["plan_day_id"]
            isOneToOne: false
            referencedRelation: "plan_days"
            referencedColumns: ["id"]
          },
        ]
      }
      supplement_logs: {
        Row: {
          dosage: number | null
          id: string
          notes: string | null
          supplement_id: string
          taken_at: string
          user_id: string
        }
        Insert: {
          dosage?: number | null
          id?: string
          notes?: string | null
          supplement_id: string
          taken_at?: string
          user_id: string
        }
        Update: {
          dosage?: number | null
          id?: string
          notes?: string | null
          supplement_id?: string
          taken_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplement_logs_supplement_id_fkey"
            columns: ["supplement_id"]
            isOneToOne: false
            referencedRelation: "supplements"
            referencedColumns: ["id"]
          },
        ]
      }
      supplements: {
        Row: {
          created_at: string
          dosage_unit: string | null
          id: string
          name: string
          notes: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          dosage_unit?: string | null
          id?: string
          name: string
          notes?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          dosage_unit?: string | null
          id?: string
          name?: string
          notes?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_gyms: {
        Row: {
          created_at: string
          id: string
          location: string | null
          name: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          user_id?: string
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
  gym: {
    Enums: {},
  },
} as const
