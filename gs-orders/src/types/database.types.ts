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
          // THÖREN Core 2C (0016_core_people_salespeople_integration.sql) —
          // nullable, unique cuando no es null. Backfill determinista vía
          // user_profiles.person_id o, para salespeople históricos sin
          // user_profile, vía Person nueva en Global Supplier MTY.
          person_id: string | null;
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
          person_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["salespeople"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "salespeople_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: true;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          // THÖREN Orders V2 Foundation (0022_orders_v2_foundation.sql) —
          // organization_id NOT NULL (server-side exclusivo, inmutable vía
          // trg_orders_prevent_organization_change); customer_id/
          // business_unit_id nullable, sin backfill histórico por
          // ambigüedad/sin consumidor. business_unit (legacy, abajo) sigue
          // existiendo sin cambios, deprecated pero compatible.
          organization_id: string;
          customer_id: string | null;
          business_unit_id: string | null;
          // THÖREN Quote → Order (0023_quote_to_order.sql) — nullable,
          // único parcial (orders_source_quote_id_unique). Solo lo asigna
          // rpc_create_order_from_quote.
          source_quote_id: string | null;
          business_unit: string;
          folio: string;
          sequence_number: number;
          salesperson_id: string;
          order_date: string;
          client_name: string;
          supplier_name: string | null;
          product_type: string;
          product_type_name_snapshot: string | null;
          status: string;
          general_notes: string | null;
          vendor_notes: string | null;
          vendor_notes_en: string | null;
          projector_model: string | null;
          projector_quantity: number | null;
          projector_power: string | null;
          projector_lens_type: string | null;
          projector_lens_pending_factory: boolean;
          projection_description: string | null;
          projection_description_en: string | null;
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
          surface_notes_en: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          // Las tres las resuelve rpc_create_order server-side (0022) —
          // organization_id nunca se envía desde la app; customer_id/
          // business_unit_id se leen de p_order dentro del RPC, no de un
          // INSERT directo vía PostgREST (Orders no se crea así).
          organization_id?: string;
          customer_id?: string | null;
          business_unit_id?: string | null;
          // Solo la asigna rpc_create_order_from_quote (0023), vía la
          // clave source_quote_id dentro de p_order — no se envía desde
          // ningún otro call-site.
          source_quote_id?: string | null;
          business_unit?: string;
          // folio y sequence_number los asigna el trigger de la base de datos; nunca se envían.
          salesperson_id: string;
          order_date?: string;
          client_name: string;
          supplier_name?: string | null;
          product_type: string;
          // La calcula rpc_create_order/rpc_update_order internamente; no se envía desde la app.
          product_type_name_snapshot?: string | null;
          status?: string;
          general_notes?: string | null;
          vendor_notes?: string | null;
          vendor_notes_en?: string | null;
          projector_model?: string | null;
          projector_quantity?: number | null;
          projector_power?: string | null;
          projector_lens_type?: string | null;
          projector_lens_pending_factory?: boolean;
          projection_description?: string | null;
          projection_description_en?: string | null;
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
          surface_notes_en?: string | null;
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
          {
            foreignKeyName: "orders_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_business_unit_id_fkey";
            columns: ["business_unit_id"];
            isOneToOne: false;
            referencedRelation: "business_units";
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
          catalog_product_id: string | null;
          color: string | null;
          power: string | null;
          lens_type: string | null;
          lens_pending_factory: boolean;
          projection_description: string | null;
          projection_description_en: string | null;
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
          surface_notes_en: string | null;
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
          catalog_product_id?: string | null;
          color?: string | null;
          power?: string | null;
          lens_type?: string | null;
          lens_pending_factory?: boolean;
          projection_description?: string | null;
          projection_description_en?: string | null;
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
          surface_notes_en?: string | null;
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
          {
            foreignKeyName: "order_items_catalog_product_id_fkey";
            columns: ["catalog_product_id"];
            isOneToOne: false;
            referencedRelation: "product_catalog";
            referencedColumns: ["id"];
          },
        ];
      };
      order_item_images: {
        Row: {
          id: string;
          order_item_id: string;
          kind: string;
          position: number;
          storage_path: string;
          file_name: string | null;
          file_type: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_item_id: string;
          kind: string;
          position?: number;
          storage_path: string;
          file_name?: string | null;
          file_type?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["order_item_images"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "order_item_images_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
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
      // THÖREN Quotes Q2 (0019_core_product_catalog_pricing.sql) —
      // organization-scoped + precio sugerido MXN/USD (nunca source of
      // truth histórico; el snapshot vivirá en quote_items a futuro).
      product_catalog: {
        Row: {
          id: string;
          category: string;
          sku: string;
          name: string;
          description: string | null;
          image_path: string | null;
          power: string | null;
          color: string | null;
          lens_type: string | null;
          technical_notes: string | null;
          organization_id: string;
          default_price_mxn: number | null;
          default_price_usd: number | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category: string;
          sku: string;
          name: string;
          description?: string | null;
          image_path?: string | null;
          power?: string | null;
          color?: string | null;
          lens_type?: string | null;
          technical_notes?: string | null;
          organization_id: string;
          default_price_mxn?: number | null;
          default_price_usd?: number | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_catalog"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "product_catalog_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Quotes Q2 (0019_core_product_catalog_pricing.sql) — N:M
      // Product ↔ Business Unit. 0 filas para un product_id = producto
      // compartido con TODAS las Business Units de su organización; 1+
      // filas = disponible únicamente para esas Business Units. Sin
      // columna `active`: la fila es la relación, existe o no existe.
      product_business_units: {
        Row: {
          product_id: string;
          business_unit_id: string;
          created_at: string;
        };
        Insert: {
          product_id: string;
          business_unit_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_business_units"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "product_business_units_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "product_catalog";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_business_units_business_unit_id_fkey";
            columns: ["business_unit_id"];
            isOneToOne: false;
            referencedRelation: "business_units";
            referencedColumns: ["id"];
          },
        ];
      };
      product_types: {
        Row: {
          id: string;
          code: string;
          name: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_types"]["Insert"]>;
        Relationships: [];
      };
      user_profiles: {
        Row: {
          user_id: string;
          name: string;
          role: string;
          salesperson_id: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
          // THÖREN Core 2B (0015_core_people.sql) — nullable, unique cuando no
          // es null. NULL para cualquier usuario dado de alta antes de esta
          // migración que no calificó para el bootstrap, o dado de alta
          // después (createUserAccess/createUserAccessLink no lo escriben
          // todavía).
          person_id: string | null;
        };
        Insert: {
          user_id: string;
          name: string;
          role?: string;
          salesperson_id?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
          person_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["user_profiles"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "user_profiles_salesperson_id_fkey";
            columns: ["salesperson_id"];
            isOneToOne: true;
            referencedRelation: "salespeople";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: true;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Core 1 (0013_core_organizations_membership.sql) — fundación
      // multi-tenant. No consumida todavía por ninguna pantalla ni por la
      // RLS de orders/salespeople/etc., solo por el alta de usuarios.
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
        Relationships: [];
      };
      organization_members: {
        Row: {
          organization_id: string;
          user_id: string;
          role: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          user_id: string;
          role?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organization_members"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      business_units: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          code: string;
          active: boolean;
          created_at: string;
          updated_at: string;
          // THÖREN Business Unit Branding (0024) — referencia al archivo en
          // el bucket business-unit-assets, nunca una URL absoluta.
          logo_path: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          code: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
          logo_path?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["business_units"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "business_units_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Quotes Q1 (0018_core_customers.sql) — entidad Core
      // reutilizable (Quotes, y a futuro Orders/CRM/Documents/Invoices).
      // Sin relación con orders.client_name (texto libre, sin FK).
      customers: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          legal_name: string | null;
          tax_id: string | null;
          email: string | null;
          phone: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          legal_name?: string | null;
          tax_id?: string | null;
          email?: string | null;
          phone?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Customer Contacts (0021_core_customer_contacts.sql) —
      // organización resuelta indirectamente vía customer_id →
      // customers.organization_id, sin columna propia. is_primary lo
      // mantiene trg_customer_contacts_enforce_primary — como máximo un
      // contacto principal ACTIVO por Customer.
      customer_contacts: {
        Row: {
          id: string;
          customer_id: string;
          name: string;
          email: string | null;
          phone: string | null;
          is_primary: boolean;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          is_primary?: boolean;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customer_contacts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Core 2B (0015_core_people.sql) — identidad humana, distinta
      // de auth.users/organization_members/salespeople. Sin UI ni RPC
      // consumidora todavía; solo el bootstrap (owner de la tabla) y
      // user_profiles.person_id la usan por ahora.
      people: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          email: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          email?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["people"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "people_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Core 2D (0017_core_person_business_units.sql) — relación N:M
      // Person <-> Business Unit, ambas de la misma organización (forzado
      // por trigger, no expresable en un CHECK). Sin UI ni RPC consumidora
      // todavía; solo SELECT admin-scoped, sin backfill.
      person_business_units: {
        Row: {
          person_id: string;
          business_unit_id: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          person_id: string;
          business_unit_id: string;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["person_business_units"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "person_business_units_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "person_business_units_business_unit_id_fkey";
            columns: ["business_unit_id"];
            isOneToOne: false;
            referencedRelation: "business_units";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Quotes Q3 (0020_core_quotes.sql). folio/sequence_number/
      // salesperson_id/business_unit_id/quote_date inmutables una vez
      // generado el folio (trg_prevent_quote_folio_change). Snapshots y
      // totales los calcula exclusivamente rpc_create_quote/rpc_update_quote.
      quotes: {
        Row: {
          id: string;
          organization_id: string;
          business_unit_id: string;
          salesperson_id: string;
          customer_id: string;
          folio: string;
          sequence_number: number;
          quote_date: string;
          status: string;
          currency: string;
          tax_rate: number;
          global_discount_percent: number;
          valid_until: string;
          customer_name: string;
          customer_legal_name: string | null;
          customer_tax_id: string | null;
          business_unit_name: string;
          business_unit_code: string;
          salesperson_name: string;
          subtotal: number;
          discount_total: number;
          tax_total: number;
          total: number;
          notes: string | null;
          payment_terms: string | null;
          delivery_time: string | null;
          customer_notes: string | null;
          // THÖREN Quotes Historical Import (0028). source='thoren' para
          // toda Quote real; original_folio solo existe si source='cotizia'
          // (CHECK en DB) y conserva el folio CRUDO de CotizIA, distinto de
          // `folio` (ya corregido). customer_contact_*/historical_pdf_path:
          // snapshot histórico, nunca resueltos en vivo.
          source: string;
          original_folio: string | null;
          historical_pdf_path: string | null;
          customer_contact_name: string | null;
          customer_email: string | null;
          customer_phone: string | null;
          warranty: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          business_unit_id: string;
          salesperson_id: string;
          customer_id: string;
          // folio/sequence_number los asigna fn_next_quote_folio() dentro de rpc_create_quote; nunca se envían.
          folio?: string;
          sequence_number?: number;
          quote_date?: string;
          status?: string;
          currency: string;
          tax_rate?: number;
          global_discount_percent?: number;
          valid_until?: string;
          // Snapshots — los resuelve rpc_create_quote/rpc_update_quote server-side; nunca se envían desde la app.
          customer_name?: string;
          customer_legal_name?: string | null;
          customer_tax_id?: string | null;
          business_unit_name?: string;
          business_unit_code?: string;
          salesperson_name?: string;
          subtotal?: number;
          discount_total?: number;
          tax_total?: number;
          total?: number;
          notes?: string | null;
          payment_terms?: string | null;
          delivery_time?: string | null;
          customer_notes?: string | null;
          // THÖREN Quotes Historical Import (0028) — solo poblados por el
          // script de datos histórico; toda Quote creada por rpc_create_quote
          // deja estos en su default ('thoren'/null).
          source?: string;
          original_folio?: string | null;
          historical_pdf_path?: string | null;
          customer_contact_name?: string | null;
          customer_email?: string | null;
          customer_phone?: string | null;
          warranty?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["quotes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "quotes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_business_unit_id_fkey";
            columns: ["business_unit_id"];
            isOneToOne: false;
            referencedRelation: "business_units";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_salesperson_id_fkey";
            columns: ["salesperson_id"];
            isOneToOne: false;
            referencedRelation: "salespeople";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Quotes Q3 (0020_core_quotes.sql). Snapshot completo por línea
      // (model/description/unit_price/quantity/line_discount_percent) —
      // nunca vuelve a leer product_catalog una vez creada.
      // line_subtotal lo calcula exclusivamente el RPC.
      quote_items: {
        Row: {
          id: string;
          quote_id: string;
          position: number;
          catalog_product_id: string | null;
          model: string;
          description: string | null;
          quantity: number;
          unit_price: number;
          line_discount_percent: number;
          // THÖREN Quotes Historical Import (0028) — texto libre tal como
          // aparece en el PDF histórico; NULL si el PDF no trae unidad.
          unit: string | null;
          // "Requisitos del cliente" por línea (0028) — especificación
          // técnica de esa línea, separado de description/customer_notes.
          customer_requirements: string | null;
          line_subtotal: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quote_id: string;
          position?: number;
          catalog_product_id?: string | null;
          model: string;
          description?: string | null;
          quantity: number;
          unit_price: number;
          line_discount_percent?: number;
          unit?: string | null;
          customer_requirements?: string | null;
          // Lo calcula rpc_create_quote/rpc_update_quote; nunca se envía desde la app.
          line_subtotal?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["quote_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_items_catalog_product_id_fkey";
            columns: ["catalog_product_id"];
            isOneToOne: false;
            referencedRelation: "product_catalog";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Quotes Q3 (0020_core_quotes.sql) — motor de folios de Quotes,
      // propio e independiente de salespeople.prefix/sequence_current. Clave
      // Salesperson × Business Unit. sequence_current es propiedad exclusiva
      // de fn_next_quote_folio() (SECURITY DEFINER) — RLS bloquea cualquier
      // UPDATE directo de VENDEDOR, incluso sobre su propia fila; solo ADMIN
      // tiene INSERT/UPDATE/DELETE (ver salesperson_quote_sequences_*_admin).
      salesperson_quote_sequences: {
        Row: {
          id: string;
          organization_id: string;
          salesperson_id: string;
          business_unit_id: string;
          quote_prefix: string;
          sequence_current: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          salesperson_id: string;
          business_unit_id: string;
          quote_prefix: string;
          sequence_current?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["salesperson_quote_sequences"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "salesperson_quote_sequences_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "salesperson_quote_sequences_salesperson_id_fkey";
            columns: ["salesperson_id"];
            isOneToOne: false;
            referencedRelation: "salespeople";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "salesperson_quote_sequences_business_unit_id_fkey";
            columns: ["business_unit_id"];
            isOneToOne: false;
            referencedRelation: "business_units";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      // THÖREN Quotes Q3 (0020) — SECURITY INVOKER, transacción única:
      // resuelve snapshots, pide folio a fn_next_quote_folio() y calcula
      // totales server-side. p_items es un array de objetos con
      // catalog_product_id?/model/description?/quantity/unit_price/
      // line_discount_percent?.
      rpc_create_quote: {
        Args: {
          p_quote_id: string;
          p_quote: Json;
          p_items: Json;
        };
        Returns: Database["public"]["Tables"]["quotes"]["Row"];
      };
      // THÖREN Quotes Q3 (0020) — SECURITY INVOKER. Solo permite escribir si
      // la Quote sigue en status "borrador" (verificado dentro del RPC,
      // además de RLS/trigger). Reemplaza todos los quote_items.
      rpc_update_quote: {
        Args: {
          p_quote_id: string;
          p_quote: Json;
          p_items: Json;
        };
        Returns: Database["public"]["Tables"]["quotes"]["Row"];
      };
      // THÖREN Customer Contacts (0021) — SECURITY INVOKER, transacción
      // única: inserta el Customer y todos sus contactos; si cualquier
      // contacto falla, revierte el Customer también. organization_id se
      // resuelve server-side vía current_user_organization_id() — nunca se
      // envía desde la app. p_contacts es un array de objetos con
      // name/email?/phone?/is_primary?.
      rpc_create_customer_with_contacts: {
        Args: {
          p_customer: Json;
          p_contacts?: Json;
        };
        Returns: Database["public"]["Tables"]["customers"]["Row"];
      };
      rpc_create_order: {
        Args: {
          p_order_id: string;
          p_order: Json;
          p_items: Json;
          p_images: Json;
          p_files: Json;
        };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      rpc_update_order: {
        Args: {
          p_order_id: string;
          p_order: Json;
          p_items: Json;
          p_images: Json;
          p_files: Json;
        };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      rpc_duplicate_order: {
        Args: { p_source_order_id: string; p_order_date: string };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      // THÖREN Quote → Order (0023) — SECURITY INVOKER. La app SOLO manda
      // estos 3 valores; organization_id/customer_id/business_unit_id/
      // salesperson_id/client_name/items se leen server-side de la Quote
      // (bajo RLS) y se delegan a rpc_create_order, que hace la creación
      // real. Exige quote.status = 'aceptada'; una Quote ya convertida
      // falla por el índice único orders_source_quote_id_unique.
      rpc_create_order_from_quote: {
        Args: { p_quote_id: string; p_product_type: string; p_order_date: string };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      rpc_delete_order: {
        Args: { p_order_id: string };
        Returns: { orphaned_media_paths: string[]; orphaned_file_paths: string[] }[];
      };
      admin_list_user_profiles: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          email: string;
          name: string;
          role: string;
          salesperson_id: string | null;
          salesperson_name: string | null;
          salesperson_prefix: string | null;
          active: boolean;
          created_at: string;
        }[];
      };
      // THÖREN Core 1 — ver nota de diseño en 0013: null sin membership, el
      // id si hay exactamente una activa, excepción si hay más de una.
      current_user_organization_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      // THÖREN Core 1 — actualización atómica de role/active en
      // user_profiles + organization_members (ver 0013). Lanza excepción
      // (no devuelve fila) si no hay permiso o no existe la membership.
      admin_update_user_role_and_active: {
        Args: { p_user_id: string; p_role: string; p_active: boolean };
        Returns: undefined;
      };
      // THÖREN Core 2C (0016) — crea una Person y vincula
      // user_profiles.person_id en una sola transacción, para el alta de un
      // usuario nuevo. Lanza excepción (no devuelve fila) si el perfil no
      // existe o ya tenía una Person vinculada.
      rpc_create_person_for_user: {
        Args: {
          p_user_id: string;
          p_organization_id: string;
          p_name: string;
          p_email: string | null;
          p_active: boolean;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
  };
}
