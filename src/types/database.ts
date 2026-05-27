export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserType = 'customer' | 'tailor';
export type OrderStatus = 'pending' | 'cutting' | 'stitching' | 'ready' | 'delivered';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_type: UserType;
          full_name: string | null;
          phone: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          user_type: UserType;
          full_name?: string | null;
          phone?: string | null;
          created_at?: string;
        };
        Update: {
          user_type?: UserType;
          full_name?: string | null;
          phone?: string | null;
        };
      };
      tailor_profiles: {
        Row: {
          id: string;
          shop_name: string;
          darzi_id: number;
          location_lat: number | null;
          location_lng: number | null;
          address: string | null;
          pricing_json: Json;
          expertise_tags: string[];
          rating: number;
        };
        Insert: {
          id: string;
          shop_name: string;
          location_lat?: number | null;
          location_lng?: number | null;
          address?: string | null;
          pricing_json?: Json;
          expertise_tags?: string[];
          rating?: number;
        };
        Update: {
          shop_name?: string;
          location_lat?: number | null;
          location_lng?: number | null;
          address?: string | null;
          pricing_json?: Json;
          expertise_tags?: string[];
          rating?: number;
        };
      };
      measurement_vault: {
        Row: {
          id: string;
          customer_id: string;
          measurements_json: Json;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          measurements_json?: Json;
          updated_at?: string;
        };
        Update: {
          measurements_json?: Json;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          customer_id: string | null;
          tailor_id: string | null;
          customer_name: string;
          customer_mobile: string;
          suit_type: string;
          delivery_date: string;
          measurements_json: Json;
          total_bill: number;
          advance_paid: number;
          remaining_balance: number;
          status: OrderStatus;
          qr_code_str: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id?: string | null;
          tailor_id?: string | null;
          customer_name: string;
          customer_mobile: string;
          suit_type: string;
          delivery_date: string;
          measurements_json?: Json;
          total_bill: number;
          advance_paid: number;
          remaining_balance: number;
          status?: OrderStatus;
          qr_code_str?: string | null;
          created_at?: string;
        };
        Update: {
          customer_id?: string | null;
          tailor_id?: string | null;
          customer_name?: string;
          customer_mobile?: string;
          suit_type?: string;
          delivery_date?: string;
          measurements_json?: Json;
          total_bill?: number;
          advance_paid?: number;
          remaining_balance?: number;
          status?: OrderStatus;
          qr_code_str?: string | null;
        };
      };
      whatsapp_auth_challenges: {
        Row: {
          id: string;
          lookup_token: string;
          phone: string;
          user_type: UserType;
          challenge_code: string;
          status: 'pending' | 'verified' | 'expired' | 'rejected';
          auth_user_id: string | null;
          verification_note: string | null;
          created_at: string;
          expires_at: string;
          verified_at: string | null;
        };
        Insert: {
          id: string;
          lookup_token: string;
          phone: string;
          user_type: UserType;
          challenge_code: string;
          status?: 'pending' | 'verified' | 'expired' | 'rejected';
          auth_user_id?: string | null;
          verification_note?: string | null;
          created_at?: string;
          expires_at: string;
          verified_at?: string | null;
        };
        Update: {
          status?: 'pending' | 'verified' | 'expired' | 'rejected';
          auth_user_id?: string | null;
          verification_note?: string | null;
          verified_at?: string | null;
        };
      };
    };
    Functions: {
      get_whatsapp_auth_challenge_status: {
        Args: {
          target_id: string;
          target_lookup_token: string;
        };
        Returns: {
          status: 'pending' | 'verified' | 'expired' | 'rejected';
          phone: string;
          user_type: UserType;
          verified_at: string | null;
          expires_at: string;
        }[];
      };
    };
  };
};
