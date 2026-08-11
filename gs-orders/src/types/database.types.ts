// Tipos escritos a mano que reflejan supabase/migrations/*.sql.
// Regenerar con `npm run supabase:types` en cuanto haya un proyecto Supabase conectado.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      salespeople: {
        Row: {
          id: string;
          business_unit: string;
          name: string;
          prefix: string;
          sequence_current: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_unit?: string;
          name: string;
          prefix: string;
          sequence_current?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["salespeople"]["Insert"]>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          business_unit: string;
          folio: string;
          sequence_number: number;
          salesperson_id: string;
          order_date: string;
          client_name: string;
          supplier_name: string | null;
          product_type: string;
          status: string;
          general_notes: string | null;
          vendor_notes: string | null;
          projector_model: string | null;
          projector_quantity: number | null;
          projector_power: string | null;
          projector_lens_type: string | null;
          projector_lens_pending_factory: boolean;
          projection_description: string | null;
          projection_file_path: string | null;
          projection_file_name: string | null;
          projection_file_type: string | null;
          projection_width: number | null;
          projection_height: number | null;
          projection_size_unit: string | null;
          installation_height: number | null;
          installation_height_unit: string | null;
          installation_distance: number | null;
          installation_orientation: string | null;
          installation_use: string | null;
          surface_type: string | null;
          surface_material: string | null;
          surface_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_unit?: string;
          // folio y sequence_number los asigna el trigger de la base de datos; nunca se envían.
          salesperson_id: string;
          order_date?: string;
          client_name: string;
          supplier_name?: string | null;
          product_type: string;
          status?: string;
          general_notes?: string | null;
          vendor_notes?: string | null;
          projector_model?: string | null;
          projector_quantity?: number | null;
          projector_power?: string | null;
          projector_lens_type?: string | null;
          projector_lens_pending_factory?: boolean;
          projection_description?: string | null;
          projection_file_path?: string | null;
          projection_file_name?: string | null;
          projection_file_type?: string | null;
          projection_width?: number | null;
          projection_height?: number | null;
          projection_size_unit?: string | null;
          installation_height?: number | null;
          installation_height_unit?: string | null;
          installation_distance?: number | null;
          installation_orientation?: string | null;
          installation_use?: string | null;
          surface_type?: string | null;
          surface_material?: string | null;
          surface_notes?: string | null;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["orders"]["Insert"], "id">>;
        Relationships: [
          {
            foreignKeyName: "orders_salesperson_id_fkey";
            columns: ["salesperson_id"];
            isOneToOne: false;
            referencedRelation: "salespeople";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          position: number;
          image_path: string | null;
          model: string;
          description: string | null;
          quantity: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          position?: number;
          image_path?: string | null;
          model: string;
          description?: string | null;
          quantity?: number;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_images: {
        Row: {
          id: string;
          order_id: string;
          position: number;
          storage_path: string;
          caption: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          position?: number;
          storage_path: string;
          caption?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["order_images"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "order_images_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_files: {
        Row: {
          id: string;
          order_id: string;
          storage_path: string;
          file_name: string;
          file_type: string | null;
          file_size: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          storage_path: string;
          file_name: string;
          file_type?: string | null;
          file_size?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["order_files"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "order_files_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
