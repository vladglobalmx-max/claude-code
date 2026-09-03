// Tipos escritos a mano que reflejan supabase/migrations/*.sql.
// Regenerar con `npm run supabase:types` en cuanto haya un proyecto Supabase conectado.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      salespeople: {
        Row: {
          id: string;
          // THÖREN Fase 7A (0051) — NOT NULL, DEFAULT current_user_organization_id().
          // Nunca la envía el cliente (vendedores/actions.ts no la incluye en su
          // insert): se resuelve server-side desde la sesión de quien crea el
          // vendedor. Único por (organization_id, business_unit, upper(prefix)) —
          // ver salespeople_prefix_unique_per_org_unit.
          organization_id: string;
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
          organization_id?: string;
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
          {
            foreignKeyName: "salespeople_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
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
          // THÖREN Fase 6H (0033_order_operational_status.sql) — seguimiento
          // operativo, INDEPENDIENTE de `status` (ver DECISIÓN en la
          // migración): 'pedido'|'en_proceso'|'ordenado_a_proveedor'|
          // 'en_transito'|'recibido'|'programado_entrega_instalacion'|
          // 'completado'|'cancelado'. Default 'pedido'; cambiarlo genera
          // automáticamente una fila en order_operational_status_history
          // (trigger, nunca manual).
          operational_status: string;
          general_notes: string | null;
          vendor_notes: string | null;
          vendor_notes_en: string | null;
          // THÖREN Quote → Order Hardening (0029_quote_order_hardening.sql)
          // — snapshot de datos operativos de la Quote origen, copiado una
          // sola vez por rpc_create_order_from_quote. NULL para Orders
          // manuales, o si la Quote no traía el dato. Cambios posteriores
          // en la Quote nunca los modifican.
          payment_terms: string | null;
          delivery_time: string | null;
          warranty: string | null;
          customer_notes: string | null;
          // THÖREN Fase 6K (0034_order_commitment_dates.sql) — fechas
          // compromiso de cumplimiento logístico del pedido, capturadas
          // manualmente (nunca inferidas). Todas nullable, sin default —
          // ver DECISIÓN en la migración para qué fecha es "la relevante"
          // según operational_status (lib/dashboard/due-dates.ts).
          supplier_commitment_date: string | null;
          estimated_reception_date: string | null;
          scheduled_delivery_date: string | null;
          actual_completion_date: string | null;
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
          // Nunca se envía desde rpc_update_order (no está en su lista
          // explícita de columnas) — solo el UPDATE directo de la app
          // (setOrderOperationalStatus) la toca, vía la RLS ya existente de
          // orders. Ver DECISIÓN en 0033_order_operational_status.sql.
          operational_status?: string;
          general_notes?: string | null;
          vendor_notes?: string | null;
          vendor_notes_en?: string | null;
          payment_terms?: string | null;
          delivery_time?: string | null;
          warranty?: string | null;
          customer_notes?: string | null;
          supplier_commitment_date?: string | null;
          estimated_reception_date?: string | null;
          scheduled_delivery_date?: string | null;
          actual_completion_date?: string | null;
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
      // THÖREN Fase 6H (0033_order_operational_status.sql) — historial de
      // operational_status. INSERT-only vía trigger (SECURITY DEFINER); no
      // hay policy de INSERT/UPDATE/DELETE para `authenticated`, así que el
      // shape de Insert/Update de aquí abajo nunca se ejercita desde la app
      // (documentado igual, por si algún día se necesita leer con tipos
      // fuertes en un contexto server-only).
      order_operational_status_history: {
        Row: {
          id: string;
          order_id: string;
          previous_status: string | null;
          new_status: string;
          changed_by_user_id: string | null;
          changed_by_name: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          previous_status?: string | null;
          new_status: string;
          changed_by_user_id?: string | null;
          changed_by_name?: string | null;
          changed_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["order_operational_status_history"]["Insert"], "id">>;
        Relationships: [
          {
            foreignKeyName: "order_operational_status_history_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
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
          // THÖREN Quote → Order Hardening (0029_quote_order_hardening.sql)
          // — snapshot por línea de quote_items.unit/customer_requirements,
          // copiado una sola vez por rpc_create_order_from_quote. NULL para
          // items de un Order manual, o si la Quote no traía el dato.
          unit: string | null;
          customer_requirements: string | null;
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
          unit?: string | null;
          customer_requirements?: string | null;
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
          // Fase 6C (0030_product_catalog_master.sql): category se volvió
          // nullable — product_type_id es el nuevo eje de clasificación
          // primario para productos nuevos (reutiliza product_types, ver
          // más abajo); category se conserva intacta para filas ya
          // existentes, sin backfill.
          category: string | null;
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
          product_type_id: string | null;
          brand: string | null;
          model: string | null;
          unit: string | null;
        };
        Insert: {
          id?: string;
          category?: string | null;
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
          product_type_id?: string | null;
          brand?: string | null;
          model?: string | null;
          unit?: string | null;
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
          {
            foreignKeyName: "product_catalog_product_type_id_fkey";
            columns: ["product_type_id"];
            isOneToOne: false;
            referencedRelation: "product_types";
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
          // THÖREN Fase 7A (0051) — NOT NULL, DEFAULT current_user_organization_id().
          // Nunca la envía el cliente (tipos-producto/actions.ts no la incluye en
          // su insert). `code` sigue siendo único GLOBAL a propósito (ver DECISIÓN
          // en 0051) — fuera de alcance de 7A, orders.product_type lo referencia
          // por code, no por organization_id.
          organization_id: string;
          code: string;
          name: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          code: string;
          name: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_types"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "product_types_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
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
      // THÖREN Fase 6L (0035_purchases_suppliers.sql) — a quién le
      // compramos, tabla propia (no customers/people, ver DECISIÓN en la
      // migración). "contacto" es un campo de texto libre en la propia
      // fila, sin tabla de contactos múltiples en esta fase.
      suppliers: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          tax_id: string | null;
          contact_name: string | null;
          email: string | null;
          phone: string | null;
          preferred_currency: string | null;
          notes: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          tax_id?: string | null;
          contact_name?: string | null;
          email?: string | null;
          phone?: string | null;
          preferred_currency?: string | null;
          notes?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["suppliers"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Fase 6L (0035_purchases_suppliers.sql) — motor de folio de
      // Purchase Orders, una fila por organización. Solo la escribe
      // fn_next_purchase_order_folio() (SECURITY DEFINER) — sin uso directo
      // desde la app.
      purchase_order_sequences: {
        Row: {
          organization_id: string;
          prefix: string;
          sequence_current: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          prefix?: string;
          sequence_current?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["purchase_order_sequences"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "purchase_order_sequences_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Fase 6L (0035_purchases_suppliers.sql) — cabecera de Orden
      // de Compra. business_unit_id NO existe aquí — se deriva vía
      // order_id -> orders.business_unit_id. folio/sequence_number/
      // organization_id/order_id/supplier_id son inmutables tras crearse.
      purchase_orders: {
        Row: {
          id: string;
          organization_id: string;
          order_id: string;
          supplier_id: string;
          folio: string;
          sequence_number: number;
          po_date: string;
          supplier_commitment_date: string | null;
          estimated_reception_date: string | null;
          supplier_reference: string | null;
          notes: string | null;
          status: string;
          pre_receiving_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          order_id: string;
          supplier_id: string;
          folio: string;
          sequence_number: number;
          po_date?: string;
          supplier_commitment_date?: string | null;
          estimated_reception_date?: string | null;
          supplier_reference?: string | null;
          notes?: string | null;
          status?: string;
          pre_receiving_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["purchase_orders"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "purchase_orders_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Fase 6L (0035_purchases_suppliers.sql) — partidas de una
      // Purchase Order, snapshot operativo de order_items al crearse.
      // order_item_id es INFORMATIVO, SIN FK real — ver DECISIÓN
      // ESTRUCTURAL en la migración (rpc_update_order borra y reinserta
      // order_items en cada edición del Pedido; una FK real rompería o
      // borraría Purchase Orders ya creadas).
      purchase_order_items: {
        Row: {
          id: string;
          purchase_order_id: string;
          order_item_id: string | null;
          position: number;
          catalog_product_id: string | null;
          model: string;
          description: string | null;
          color: string | null;
          unit: string | null;
          customer_requirements: string | null;
          quantity_ordered: number;
          quantity_received: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          purchase_order_id: string;
          order_item_id?: string | null;
          position?: number;
          catalog_product_id?: string | null;
          model: string;
          description?: string | null;
          color?: string | null;
          unit?: string | null;
          customer_requirements?: string | null;
          quantity_ordered: number;
          quantity_received?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["purchase_order_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_items_catalog_product_id_fkey";
            columns: ["catalog_product_id"];
            isOneToOne: false;
            referencedRelation: "product_catalog";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Fase 6M (0036_inventory_mvp.sql) — catálogo de almacenes.
      // A diferencia de suppliers/customers, INSERT también es admin-only.
      warehouses: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          code: string;
          location: string | null;
          notes: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          code: string;
          location?: string | null;
          notes?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["warehouses"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "warehouses_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Fase 6M (0036_inventory_mvp.sql), extendido en Fase 6O
      // (0038_inventory_fulfillment.sql) — ledger inmutable, única fuente
      // de verdad de ON HAND. Sin policy de insert/update/delete para
      // `authenticated` — solo lo escriben rpc_create_inventory_movement,
      // rpc_receive_purchase_order_item y rpc_fulfill_inventory_reservation
      // (las tres SECURITY DEFINER). order_id/inventory_reservation_id
      // solo se llenan para movement_type = 'surtido_pedido'.
      inventory_movements: {
        Row: {
          id: string;
          organization_id: string;
          product_id: string;
          warehouse_id: string;
          quantity_delta: number;
          movement_type: string;
          purchase_order_id: string | null;
          purchase_order_item_id: string | null;
          order_id: string | null;
          inventory_reservation_id: string | null;
          reference: string | null;
          notes: string | null;
          created_by_user_id: string;
          created_by_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          product_id: string;
          warehouse_id: string;
          quantity_delta: number;
          movement_type: string;
          purchase_order_id?: string | null;
          purchase_order_item_id?: string | null;
          order_id?: string | null;
          inventory_reservation_id?: string | null;
          reference?: string | null;
          notes?: string | null;
          created_by_user_id: string;
          created_by_name: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["inventory_movements"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "inventory_movements_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "product_catalog";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movements_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movements_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movements_purchase_order_item_id_fkey";
            columns: ["purchase_order_item_id"];
            isOneToOne: false;
            referencedRelation: "purchase_order_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movements_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movements_inventory_reservation_id_fkey";
            columns: ["inventory_reservation_id"];
            isOneToOne: false;
            referencedRelation: "inventory_reservations";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Fase 6N (0037_inventory_reservations.sql), extendido en Fase
      // 6O (0038_inventory_fulfillment.sql) — reserva explícita de
      // inventario desde un Pedido. Nunca se borra (liberar marca
      // released_at); a lo sumo una fila ACTIVA por (order_id, product_id)
      // — ver índice único parcial en la migración. `fulfilled_quantity`
      // es el acumulado ya surtido (0 <= fulfilled_quantity <= quantity);
      // COMMITTED = quantity - fulfilled_quantity (rpc_inventory_committed_levels).
      // Sin policy de insert/update para `authenticated`: solo las RPCs
      // rpc_reserve_inventory/rpc_adjust_inventory_reservation/
      // rpc_release_inventory_reservation/rpc_fulfill_inventory_reservation
      // (SECURITY DEFINER) escriben aquí.
      inventory_reservations: {
        Row: {
          id: string;
          organization_id: string;
          order_id: string;
          product_id: string;
          warehouse_id: string;
          quantity: number;
          fulfilled_quantity: number;
          created_by_user_id: string;
          created_by_name: string;
          released_by_user_id: string | null;
          released_by_name: string | null;
          released_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          order_id: string;
          product_id: string;
          warehouse_id: string;
          quantity: number;
          fulfilled_quantity?: number;
          created_by_user_id: string;
          created_by_name: string;
          released_by_user_id?: string | null;
          released_by_name?: string | null;
          released_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["inventory_reservations"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_reservations_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_reservations_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "product_catalog";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_reservations_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Fase 6N (0037_inventory_reservations.sql) — ledger
      // insert-only de cada cambio de una reserva (creada/aumentada/
      // reducida/liberada). Sin policy de insert/update/delete para
      // `authenticated`.
      inventory_reservation_events: {
        Row: {
          id: string;
          reservation_id: string;
          organization_id: string;
          order_id: string;
          product_id: string;
          warehouse_id: string;
          event_type: string;
          previous_quantity: number | null;
          new_quantity: number;
          changed_by_user_id: string;
          changed_by_name: string;
          changed_at: string;
        };
        Insert: {
          id?: string;
          reservation_id: string;
          organization_id: string;
          order_id: string;
          product_id: string;
          warehouse_id: string;
          event_type: string;
          previous_quantity?: number | null;
          new_quantity: number;
          changed_by_user_id: string;
          changed_by_name: string;
          changed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["inventory_reservation_events"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "inventory_reservation_events_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "inventory_reservations";
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
      // THÖREN Fase 6P (0039_deliveries.sql) — Entrega ligada a un Pedido.
      // Sin policy de insert/update/delete para `authenticated`: solo las
      // RPCs rpc_create_delivery/rpc_update_delivery_status/
      // rpc_update_delivery_details (SECURITY DEFINER) escriben aquí.
      deliveries: {
        Row: {
          id: string;
          organization_id: string;
          order_id: string;
          sequence_number: number;
          delivery_type: string;
          status: string;
          scheduled_date: string | null;
          actual_datetime: string | null;
          address: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          responsible_name: string | null;
          installer_name: string | null;
          installation_datetime: string | null;
          installation_notes: string | null;
          notes: string | null;
          received_by_name: string | null;
          customer_observations: string | null;
          completed_at: string | null;
          created_by_user_id: string;
          created_by_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          order_id: string;
          sequence_number: number;
          delivery_type: string;
          status?: string;
          scheduled_date?: string | null;
          actual_datetime?: string | null;
          address?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          responsible_name?: string | null;
          installer_name?: string | null;
          installation_datetime?: string | null;
          installation_notes?: string | null;
          notes?: string | null;
          received_by_name?: string | null;
          customer_observations?: string | null;
          completed_at?: string | null;
          created_by_user_id: string;
          created_by_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["deliveries"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "deliveries_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deliveries_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Fase 6P (0039_deliveries.sql) — partidas de la Entrega,
      // snapshot de order_items. INMUTABLES: sin policy de insert/update/
      // delete para `authenticated` salvo el insert que hace
      // rpc_create_delivery (SECURITY DEFINER).
      delivery_items: {
        Row: {
          id: string;
          delivery_id: string;
          catalog_product_id: string;
          model: string;
          description: string | null;
          unit: string | null;
          quantity_delivered: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          delivery_id: string;
          catalog_product_id: string;
          model: string;
          description?: string | null;
          unit?: string | null;
          quantity_delivered: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["delivery_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "delivery_items_delivery_id_fkey";
            columns: ["delivery_id"];
            isOneToOne: false;
            referencedRelation: "deliveries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_items_catalog_product_id_fkey";
            columns: ["catalog_product_id"];
            isOneToOne: false;
            referencedRelation: "product_catalog";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Fase 6P (0039_deliveries.sql) — ledger insert-only de cada
      // cambio de estado de una Entrega. Mismo patrón exacto que
      // order_operational_status_history (0033). Sin policy de insert/
      // update/delete — solo el trigger trg_deliveries_status_history
      // escribe aquí.
      delivery_status_history: {
        Row: {
          id: string;
          delivery_id: string;
          previous_status: string | null;
          new_status: string;
          changed_by_user_id: string | null;
          changed_by_name: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          delivery_id: string;
          previous_status?: string | null;
          new_status: string;
          changed_by_user_id?: string | null;
          changed_by_name?: string | null;
          changed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["delivery_status_history"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "delivery_status_history_delivery_id_fkey";
            columns: ["delivery_id"];
            isOneToOne: false;
            referencedRelation: "deliveries";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Fase 6P (0039_deliveries.sql) — evidencia (fotos/documento)
      // de una Entrega. storage_path apunta a los buckets EXISTENTES
      // order-media/order-files (mismo criterio que order_images/
      // order_files) — cero infraestructura de Storage nueva.
      delivery_files: {
        Row: {
          id: string;
          delivery_id: string;
          kind: string;
          storage_path: string;
          file_name: string;
          file_type: string | null;
          file_size: number | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          delivery_id: string;
          kind: string;
          storage_path: string;
          file_name: string;
          file_type?: string | null;
          file_size?: number | null;
          position?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["delivery_files"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "delivery_files_delivery_id_fkey";
            columns: ["delivery_id"];
            isOneToOne: false;
            referencedRelation: "deliveries";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN 6R.1B (0040_roles_capabilities.sql) — otorgamiento de una
      // capability a un usuario dentro de una organización. Escritura
      // exclusiva de admin (ver RLS); lectura server-only vía
      // getCurrentCapabilities() (src/lib/auth/capabilities.ts, 6R.1B-2B).
      user_capabilities: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          capability: string;
          active: boolean;
          granted_by_user_id: string;
          granted_at: string;
          revoked_by_user_id: string | null;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          capability: string;
          active?: boolean;
          granted_by_user_id: string;
          granted_at?: string;
          revoked_by_user_id?: string | null;
          revoked_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["user_capabilities"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "user_capabilities_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      // THÖREN Fase 6L (0035) — SECURITY INVOKER, ADMIN-only (verificado
      // dentro del RPC). Crea la PO + sus partidas en una transacción.
      // p_items es un array de {order_item_id, quantity_ordered} — el
      // resto de cada partida (modelo/descripción/catalog_product_id/
      // unit/customer_requirements) se snapshotea server-side desde
      // order_items, nunca se confía en lo que mande el cliente.
      rpc_create_purchase_order: {
        Args: {
          p_purchase_order_id: string;
          p_purchase_order: Json;
          p_items: Json;
        };
        Returns: Database["public"]["Tables"]["purchase_orders"]["Row"];
      };
      // THÖREN Fase 6L (0035) — transición manual de estado. Rechaza
      // 'recibida'/'recibida_parcial' (solo los asigna
      // rpc_receive_purchase_order_item) y cualquier cambio si la PO ya
      // está 'cancelada' (terminal).
      rpc_update_purchase_order_status: {
        Args: {
          p_purchase_order_id: string;
          p_status: string;
        };
        Returns: Database["public"]["Tables"]["purchase_orders"]["Row"];
      };
      // THÖREN Fase 6L (0035) — edita solo los campos operativos de
      // cabecera (fechas/referencia/notas). folio/proveedor/Pedido origen
      // son inmutables; el estado se cambia con rpc_update_purchase_order_status.
      rpc_update_purchase_order_details: {
        Args: {
          p_purchase_order_id: string;
          p_purchase_order: Json;
        };
        Returns: Database["public"]["Tables"]["purchase_orders"]["Row"];
      };
      // THÖREN 6R.1B-3A (0045) — NUEVA. Reemplaza atómicamente el conjunto
      // completo de partidas de una Purchase Order EN BORRADOR (admin
      // incluido — nunca fuera de borrador, para nadie). p_items es un
      // array de {order_item_id, quantity_ordered}, mismo shape que
      // rpc_create_purchase_order — el resto de cada partida se
      // snapshotea server-side desde order_items.
      rpc_replace_purchase_order_items: {
        Args: {
          p_purchase_order_id: string;
          p_items: Json;
        };
        Returns: Database["public"]["Tables"]["purchase_order_items"]["Row"][];
      };
      // THÖREN Fase 6L (0035), firma actualizada en Fase 6M (0036) —
      // registra la cantidad recibida ACUMULADA (valor absoluto, no delta)
      // de una partida y recalcula el estado de la PO (recibida_parcial/
      // recibida). Nunca permite recibido > ordenado (también protegido
      // por CHECK en la tabla). Ahora SECURITY DEFINER: p_warehouse_id es
      // obligatorio para partidas con catalog_product_id — genera un
      // movimiento de inventario (delta = nueva cantidad - anterior,
      // idempotente) y queda fijo tras el primer movimiento de esa partida.
      rpc_receive_purchase_order_item: {
        Args: {
          p_purchase_order_item_id: string;
          p_quantity_received: number;
          p_warehouse_id: string | null;
        };
        Returns: Database["public"]["Tables"]["purchase_order_items"]["Row"];
      };
      // THÖREN Fase 6M (0036) — ON HAND agregado por producto × almacén,
      // derivado de inventory_movements (nunca un contador cacheado).
      // p_product_id opcional filtra a un solo producto (detalle/kardex).
      rpc_inventory_stock_levels: {
        Args: {
          p_product_id?: string | null;
        };
        Returns: { product_id: string; warehouse_id: string; on_hand: number }[];
      };
      // THÖREN Fase 6M (0036) — INCOMING agregado por producto, derivado de
      // Purchase Orders activas (nunca una copia manual). SECURITY DEFINER
      // con filtro explícito de organización — ver DECISIÓN de visibilidad
      // en la migración (purchase_order_items tiene RLS más restrictiva
      // que lo que Inventory debe mostrar a VENDEDOR).
      rpc_inventory_incoming_by_product: {
        Args: Record<PropertyKey, never>;
        Returns: { product_id: string; incoming: number }[];
      };
      // THÖREN Fase 6M (0036) — detalle trazable de lo que viene en camino
      // para UN producto (Purchase Order/proveedor/Pedido origen/cantidad
      // pendiente/fechas), resuelto vía join — nunca duplicado en Inventory.
      rpc_inventory_incoming_detail: {
        Args: {
          p_product_id: string;
        };
        Returns: {
          purchase_order_id: string;
          purchase_order_folio: string;
          supplier_id: string;
          supplier_name: string;
          order_id: string;
          order_folio: string;
          quantity_pending: number;
          supplier_commitment_date: string | null;
          estimated_reception_date: string | null;
        }[];
      };
      // THÖREN Fase 6M (0036) — entradas/salidas/ajustes manuales de
      // inventario. Solo ADMIN; bloquea cualquier operación que deje ON
      // HAND negativo.
      rpc_create_inventory_movement: {
        Args: {
          p_movement_id: string;
          p_movement: Json;
        };
        Returns: Database["public"]["Tables"]["inventory_movements"]["Row"];
      };
      // THÖREN Fase 6N (0037) — crea una reserva NUEVA para un producto de
      // catálogo dentro de un Pedido. SECURITY DEFINER; permiso "propio o
      // admin" del Pedido (mismo criterio que orders_update_own_or_admin).
      // Falla si ya existe una reserva activa para ese Pedido+producto
      // (usar rpc_adjust_inventory_reservation) o si excede AVAILABLE.
      rpc_reserve_inventory: {
        Args: {
          p_reservation_id: string;
          p_order_id: string;
          p_product_id: string;
          p_warehouse_id: string;
          p_quantity: number;
        };
        Returns: Database["public"]["Tables"]["inventory_reservations"]["Row"];
      };
      // THÖREN Fase 6N (0037), corregido en Fase 6O (0038) — cambia la
      // cantidad (valor ABSOLUTO, no delta) de una reserva ACTIVA
      // existente. Reenviar la cantidad actual es idempotente (sin evento
      // nuevo). Rechaza si el nuevo PENDIENTE (quantity - fulfilled_quantity)
      // excede AVAILABLE, o si la nueva cantidad es menor a lo ya surtido.
      rpc_adjust_inventory_reservation: {
        Args: {
          p_reservation_id: string;
          p_quantity: number;
        };
        Returns: Database["public"]["Tables"]["inventory_reservations"]["Row"];
      };
      // THÖREN Fase 6N (0037) — libera una reserva activa (released_at =
      // ahora). Nunca borra la fila — el historial de la reserva se
      // conserva.
      rpc_release_inventory_reservation: {
        Args: {
          p_reservation_id: string;
        };
        Returns: Database["public"]["Tables"]["inventory_reservations"]["Row"];
      };
      // THÖREN Fase 6O (0038) — surte físicamente una reserva ACTIVA:
      // p_fulfilled_quantity es el acumulado ABSOLUTO (no un delta, mismo
      // criterio que rpc_receive_purchase_order_item/rpc_adjust_inventory_reservation).
      // Genera un movimiento 'surtido_pedido' (ON HAND baja) y avanza
      // fulfilled_quantity (COMMITTED baja igual, AVAILABLE sin cambio).
      // Rechaza: más de lo reservado, más del ON HAND real, reducir el
      // acumulado, o una reserva huérfana (producto ya no en las partidas
      // del Pedido) — esa sí se puede liberar, nunca surtir.
      rpc_fulfill_inventory_reservation: {
        Args: {
          p_reservation_id: string;
          p_fulfilled_quantity: number;
        };
        Returns: Database["public"]["Tables"]["inventory_reservations"]["Row"];
      };
      // THÖREN Fase 6N (0037), corregido en Fase 6O (0038) — COMMITTED
      // agregado por producto × almacén = SUM(quantity - fulfilled_quantity)
      // de reservas activas (nunca `quantity` a secas — ver DECISIÓN en
      // 0038). SECURITY DEFINER con filtro explícito de organización —
      // mismo criterio de visibilidad que rpc_inventory_incoming_by_product.
      rpc_inventory_committed_levels: {
        Args: {
          p_product_id?: string | null;
        };
        Returns: { product_id: string; warehouse_id: string; committed: number }[];
      };
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
      // Fase 6C (0030_product_catalog_master.sql) — INSERT/UPDATE atómico
      // del Catálogo de Productos. SECURITY INVOKER, sujeto a
      // product_catalog_admin_write (ADMIN-only). Cada elemento de
      // p_products: { action: 'insert'|'update', id?, sku, name,
      // description?, product_type_id?, brand?, model?, unit?,
      // currency: 'MXN'|'USD', base_price?, active, business_unit_id? }.
      // Cualquier fila inválida aborta TODA la llamada.
      rpc_import_product_catalog: {
        Args: { p_products: Json };
        Returns: { sku: string; action: string; product_id: string }[];
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
      // THÖREN Fase 6P (0039) — SECURITY DEFINER, permiso "propio o admin"
      // del Pedido (verificado explícitamente dentro, no delegado a RLS —
      // deliveries/delivery_items solo tienen policy de SELECT). Crea la
      // Entrega + sus partidas en una transacción; nunca permite entregar
      // más de lo surtido disponible (surtido total - ya entregado en
      // Entregas no canceladas).
      rpc_create_delivery: {
        Args: {
          p_delivery_id: string;
          p_delivery: Json;
          p_items: Json;
        };
        Returns: Database["public"]["Tables"]["deliveries"]["Row"];
      };
      // THÖREN Fase 6P (0039) — transición de estado. 'completada'/
      // 'cancelada' son finales (rechaza cualquier cambio posterior). Al
      // completar, un trigger (trg_deliveries_status_history) verifica si
      // el Pedido completo quedó pedido=surtido=entregado y, de ser así,
      // marca operational_status='completado' reutilizando el historial
      // de 0033.
      rpc_update_delivery_status: {
        Args: {
          p_delivery_id: string;
          p_status: string;
        };
        Returns: Database["public"]["Tables"]["deliveries"]["Row"];
      };
      // THÖREN Fase 6P (0039) — edita solo cabecera (fechas/contacto/
      // responsable/instalación/notas/recepción cliente). Nunca toca
      // partidas ni estado; bloqueado si la Entrega ya está en estado final.
      rpc_update_delivery_details: {
        Args: {
          p_delivery_id: string;
          p_delivery: Json;
        };
        Returns: Database["public"]["Tables"]["deliveries"]["Row"];
      };
      // THÖREN Fase 6P (0039) — pedido/surtido/entregado/pendiente por
      // producto de catálogo de UN Pedido. SECURITY INVOKER: la
      // visibilidad que necesita ya coincide con la de quien puede ver ese
      // Pedido (own-or-admin), sin descalce como en Inventory (6M/6N).
      rpc_order_delivery_progress: {
        Args: { p_order_id: string };
        Returns: {
          catalog_product_id: string;
          ordered: number;
          fulfilled: number;
          delivered: number;
          pending_to_deliver: number;
        }[];
      };
    };
    Enums: Record<string, never>;
  };
}
