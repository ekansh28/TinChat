
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient, createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-side Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client component client (for use in client components)
export const createSupabaseClient = () => {
  return createClientComponentClient()
}

// Server component client (for use in server components)
export const createSupabaseServerClient = () => {
  return createServerComponentClient({ cookies })
}

// Database types
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          auth_id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
          profile_complete: boolean
          created_at: string
          updated_at: string
          is_online: boolean
          last_seen: string | null
          blocked_users: string[]
          bio: string | null
          profile_card_css: string | null
          banner_url: string | null
          pronouns: string | null
          status: string
          display_name_color: string
          display_name_animation: string
          rainbow_speed: number
          easy_customization_data: any
          badges: any
        }
        Insert: {
          id?: string
          auth_id: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          profile_complete?: boolean
          created_at?: string
          updated_at?: string
          is_online?: boolean
          last_seen?: string | null
          blocked_users?: string[]
          bio?: string | null
          profile_card_css?: string | null
          banner_url?: string | null
          pronouns?: string | null
          status?: string
          display_name_color?: string
          display_name_animation?: string
          rainbow_speed?: number
          easy_customization_data?: any
          badges?: any
        }
        Update: {
          id?: string
          auth_id?: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          profile_complete?: boolean
          created_at?: string
          updated_at?: string
          is_online?: boolean
          last_seen?: string | null
          blocked_users?: string[]
          bio?: string | null
          profile_card_css?: string | null
          banner_url?: string | null
          pronouns?: string | null
          status?: string
          display_name_color?: string
          display_name_animation?: string
          rainbow_speed?: number
          easy_customization_data?: any
          badges?: any
        }
      }
      friendships: {
        Row: {
          id: string
          user_id: string
          friend_id: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          friend_id: string
          status: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          friend_id?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      friend_requests: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string
          message: string | null
          status: string
          created_at: string
          updated_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          sender_id: string
          receiver_id: string
          message?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          expires_at?: string
        }
        Update: {
          id?: string
          sender_id?: string
          receiver_id?: string
          message?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          expires_at?: string
        }
      }
    }
  }
}
