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
          // vendedor. Único por (organization_id, upper(prefix)) — ver
          // salespeople_prefix_unique_per_org (renombrado en 0056: antes incluía
          // business_unit en la clave, ver DECISIÓN ahí).
          organization_id: string;
          // THÖREN Fase 8B (0056) — legacy, deprecated desde 0022. Ya NO tiene
          // DEFAULT ni CHECK — nullable, nunca se escribe desde la app (la
          // relación real con Business Units es organization_id + la propia
          // asignación de folio/BU en orders/quotes, nunca este enum).
          business_unit: string | null;
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
          // THÖREN Fase 8B (0056) — legacy, deprecated desde 0022. Ya NO tiene
          // DEFAULT ni CHECK — nullable. La relación real es business_unit_id.
          business_unit: string | null;
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
          // THÖREN Fase 9 / Block 1 (0064, aclaración GAP 2) — visibilidad
          // de si la última sincronización de procurement (reserva +
          // purchase_requirements) de este Pedido terminó bien o falló.
          // Solo importa de verdad mientras status='pedido'; 'ok' es el
          // default para el resto de los casos.
          procurement_sync_status: "ok" | "failed";
          procurement_sync_error: string | null;
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
          procurement_sync_status?: "ok" | "failed";
          procurement_sync_error?: string | null;
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
      // THÖREN Fase 8B (0055) — motor mínimo de campos personalizados por
      // Organization/Business Unit. Ver DECISIÓN en
      // 0055_custom_fields_core.sql: business_unit_id NULL = campo
      // organization-wide; un uuid real = exclusivo de esa BU.
      custom_field_definitions: {
        Row: {
          id: string;
          organization_id: string;
          business_unit_id: string | null;
          entity_type: "product" | "quote_item" | "order_item";
          key: string;
          label: string;
          field_type: "text" | "textarea" | "number" | "select" | "checkbox" | "date" | "file" | "image";
          required: boolean;
          active: boolean;
          sort_order: number;
          placeholder: string | null;
          help_text: string | null;
          options: string[] | null;
          // THÖREN 8D (0061) — ver DECISIÓN en la migración: tiers
          // independientes de `required` (obligatorio al capturar).
          required_before_order: boolean;
          required_before_fulfillment: boolean;
          // THÖREN — Adenda PDF Pedido (0063): etiqueta alterna para
          // documentos de proveedor (ej. inglés) — NULL = usar `label` tal
          // cual, nunca una traducción automática.
          supplier_label: string | null;
          // THÖREN — Bug real: custom fields aplicados al Tipo de Producto
          // incorrecto (0065): NULL = aplica a todos los Tipos de Producto
          // dentro del scope de Business Unit ya existente; con valor,
          // aplica ÚNICAMENTE a ese Tipo de Producto (AND, no OR, con
          // business_unit_id).
          product_type_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          business_unit_id?: string | null;
          entity_type: "product" | "quote_item" | "order_item";
          key: string;
          label: string;
          field_type: "text" | "textarea" | "number" | "select" | "checkbox" | "date" | "file" | "image";
          required?: boolean;
          active?: boolean;
          sort_order?: number;
          placeholder?: string | null;
          help_text?: string | null;
          options?: string[] | null;
          required_before_order?: boolean;
          required_before_fulfillment?: boolean;
          supplier_label?: string | null;
          product_type_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["custom_field_definitions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "custom_field_definitions_business_unit_id_fkey";
            columns: ["business_unit_id"];
            isOneToOne: false;
            referencedRelation: "business_units";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "custom_field_definitions_product_type_id_fkey";
            columns: ["product_type_id"];
            isOneToOne: false;
            referencedRelation: "product_types";
            referencedColumns: ["id"];
          },
        ];
      };
      custom_field_values: {
        Row: {
          id: string;
          organization_id: string;
          definition_id: string;
          entity_type: "product" | "quote_item" | "order_item";
          entity_id: string;
          value_text: string | null;
          value_number: number | null;
          value_boolean: boolean | null;
          value_date: string | null;
          value_json: unknown | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          definition_id: string;
          entity_type: "product" | "quote_item" | "order_item";
          entity_id: string;
          value_text?: string | null;
          value_number?: number | null;
          value_boolean?: boolean | null;
          value_date?: string | null;
          value_json?: unknown | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["custom_field_values"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "custom_field_values_definition_id_fkey";
            columns: ["definition_id"];
            isOneToOne: false;
            referencedRelation: "custom_field_definitions";
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
          // THÖREN Fase 7C (0053) — NOT NULL, DEFAULT 'America/Monterrey'.
          // IANA timezone identifier (ej. "America/Mexico_City") — usado por
          // business-date.ts para calcular la fecha/hora de negocio de ESTA
          // organización (folios de pedido/cotización, saludo del dashboard).
          timezone: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          timezone?: string;
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
      // THÖREN 8D (gap final, 0062) — requisitos CORE configurables por
      // Business Unit antes de "Pedido" (hoy solo Proveedor). Ver DECISIÓN
      // en 0062_business_unit_process_settings.sql: diseñada para admitir
      // más flags booleanos CORE después sin migrar arquitectura.
      business_unit_process_settings: {
        Row: {
          id: string;
          organization_id: string;
          business_unit_id: string;
          require_supplier_before_order: boolean;
          // THÖREN — Adenda PDF Pedido (0063): idioma del documento de
          // Pedido/Orden para Proveedor, configurable por Business Unit.
          provider_document_language: "es" | "en";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          business_unit_id: string;
          require_supplier_before_order?: boolean;
          provider_document_language?: "es" | "en";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["business_unit_process_settings"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "business_unit_process_settings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_unit_process_settings_business_unit_id_fkey";
            columns: ["business_unit_id"];
            isOneToOne: true;
            referencedRelation: "business_units";
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
          // THÖREN Fase 9 (0064) — idioma preferido de ESTE proveedor para
          // documentos (Purchase Order). Prioridad: supplier →
          // business_unit_process_settings.provider_document_language
          // (0063) → 'es'. Nullable: sin preferencia explícita, cae al
          // siguiente nivel.
          preferred_document_language: "es" | "en" | null;
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
          preferred_document_language?: "es" | "en" | null;
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
      // THÖREN — Supplier Product References (0066): MAESTRO vivo de la
      // referencia de cada proveedor para un producto de catálogo — 1
      // producto puede tener N proveedores, cada uno con su propio código.
      // Sin organization_id propio (junction pura, mismo patrón que
      // product_business_units, 0019) — tenancy resuelto vía join a
      // product_catalog.organization_id en RLS + trigger cross-org.
      supplier_product_references: {
        Row: {
          id: string;
          catalog_product_id: string;
          supplier_id: string;
          supplier_sku: string | null;
          supplier_model: string | null;
          supplier_description: string | null;
          // Informativo únicamente — ningún cálculo de inventario/shortage/
          // recepción lo lee ni lo convierte (ver DECISIÓN, 0066).
          supplier_uom: string | null;
          preferred: boolean;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          catalog_product_id: string;
          supplier_id: string;
          supplier_sku?: string | null;
          supplier_model?: string | null;
          supplier_description?: string | null;
          supplier_uom?: string | null;
          preferred?: boolean;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["supplier_product_references"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "supplier_product_references_catalog_product_id_fkey";
            columns: ["catalog_product_id"];
            isOneToOne: false;
            referencedRelation: "product_catalog";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_product_references_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
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
          // THÖREN — Supplier Product References (0066): snapshot congelado
          // de la referencia del proveedor, tomado al crear/reemplazar esta
          // partida — nunca se recalcula si el maestro cambia después.
          supplier_sku_snapshot: string | null;
          supplier_model_snapshot: string | null;
          supplier_description_snapshot: string | null;
          supplier_uom_snapshot: string | null;
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
          supplier_sku_snapshot?: string | null;
          supplier_model_snapshot?: string | null;
          supplier_description_snapshot?: string | null;
          supplier_uom_snapshot?: string | null;
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
      // THÖREN Fase 9 / Block 1 (0064_purchase_requirements.sql) — una
      // fila por (order_id, catalog_product_id) con demanda pendiente de
      // cubrir vía compra. Sin policy de insert/update/delete — solo
      // rpc_sync_order_procurement/rpc_allocate_purchase_requirement
      // (SECURITY DEFINER) escriben aquí.
      purchase_requirements: {
        Row: {
          id: string;
          organization_id: string;
          business_unit_id: string | null;
          order_id: string;
          catalog_product_id: string;
          supplier_id: string | null;
          required_qty: number;
          allocated_qty: number;
          status: "open" | "partially_allocated" | "allocated" | "cancelled";
          required_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          business_unit_id?: string | null;
          order_id: string;
          catalog_product_id: string;
          supplier_id?: string | null;
          required_qty: number;
          allocated_qty?: number;
          status?: "open" | "partially_allocated" | "allocated" | "cancelled";
          required_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["purchase_requirements"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "purchase_requirements_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_requirements_catalog_product_id_fkey";
            columns: ["catalog_product_id"];
            isOneToOne: false;
            referencedRelation: "product_catalog";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_requirements_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Fase 9 / Block 1 (0064) — trazabilidad PURAMENTE
      // informativa hacia las partidas de origen de un purchase_requirement
      // agregado (ver DECISIÓN de granularidad en la migración) — nunca
      // participa en el cálculo de disponibilidad/shortage.
      purchase_requirement_source_items: {
        Row: {
          id: string;
          purchase_requirement_id: string;
          order_item_id: string;
          requested_qty: number;
        };
        Insert: {
          id?: string;
          purchase_requirement_id: string;
          order_item_id: string;
          requested_qty: number;
        };
        Update: Partial<Database["public"]["Tables"]["purchase_requirement_source_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "purchase_requirement_source_items_purchase_requirement_id_fkey";
            columns: ["purchase_requirement_id"];
            isOneToOne: false;
            referencedRelation: "purchase_requirements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_requirement_source_items_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Fase 9 / Block 1 (0064) — vínculo real Order Item ↔ PO Item
      // (Parte B), vía el requirement como intermediaria. N:N genuino sin
      // tocar purchase_orders/purchase_order_items.
      purchase_requirement_allocations: {
        Row: {
          id: string;
          purchase_requirement_id: string;
          purchase_order_item_id: string;
          allocated_qty: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_requirement_id: string;
          purchase_order_item_id: string;
          allocated_qty: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["purchase_requirement_allocations"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "purchase_requirement_allocations_purchase_requirement_id_fkey";
            columns: ["purchase_requirement_id"];
            isOneToOne: false;
            referencedRelation: "purchase_requirements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_requirement_allocations_purchase_order_item_id_fkey";
            columns: ["purchase_order_item_id"];
            isOneToOne: false;
            referencedRelation: "purchase_order_items";
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
      // THÖREN Sales Orders MVP (0067_sales_orders_mvp.sql) — motor de
      // order_number, un row por organización. Sin policy de insert/update
      // para `authenticated`: solo fn_next_sales_order_number (SECURITY
      // DEFINER) escribe aquí.
      sales_order_sequences: {
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
        Update: Partial<Database["public"]["Tables"]["sales_order_sequences"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "sales_order_sequences_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Sales Orders MVP (0067_sales_orders_mvp.sql) — encabezado.
      // subtotal/tax_total/total/customer_contact_snapshot los calcula
      // exclusivamente rpc_create_sales_order/rpc_update_sales_order; nunca
      // se escriben directo desde la app. Congelados fuera de status
      // "draft" (trg_sales_order_status_transition), excepto
      // internal_notes.
      sales_orders: {
        Row: {
          id: string;
          organization_id: string;
          customer_id: string;
          salesperson_id: string;
          order_number: string;
          sequence_number: number;
          status: string;
          currency: string;
          exchange_rate: number | null;
          payment_terms: string | null;
          requested_delivery_date: string | null;
          billing_address_snapshot: string | null;
          shipping_address_snapshot: string | null;
          customer_contact_snapshot: string | null;
          commercial_notes: string | null;
          internal_notes: string | null;
          subtotal: number;
          tax_total: number;
          total: number;
          created_by: string;
          confirmed_at: string | null;
          // THÖREN Financial Release (0068_sales_order_financial_release.sql)
          // — nunca escritos directo desde la app, ver trg_sales_order_financial_guard.
          payment_terms_type: string;
          financial_status: string;
          fulfillment_release_status: string;
          financial_released_at: string | null;
          financial_released_by: string | null;
          financial_hold_reason: string | null;
          amount_paid: number;
          payment_required_amount: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          customer_id: string;
          salesperson_id: string;
          // order_number/sequence_number los asigna fn_next_sales_order_number() dentro de rpc_create_sales_order; nunca se envían.
          order_number?: string;
          sequence_number?: number;
          status?: string;
          currency: string;
          exchange_rate?: number | null;
          payment_terms?: string | null;
          requested_delivery_date?: string | null;
          billing_address_snapshot?: string | null;
          shipping_address_snapshot?: string | null;
          customer_contact_snapshot?: string | null;
          commercial_notes?: string | null;
          internal_notes?: string | null;
          subtotal?: number;
          tax_total?: number;
          total?: number;
          created_by?: string;
          confirmed_at?: string | null;
          // Los resuelve rpc_create_sales_order/rpc_update_sales_order (payment_terms_type) o
          // exclusivamente las RPCs financieras (0068) — nunca se envían desde un .insert()/.update() directo.
          payment_terms_type?: string;
          financial_status?: string;
          fulfillment_release_status?: string;
          financial_released_at?: string | null;
          financial_released_by?: string | null;
          financial_hold_reason?: string | null;
          amount_paid?: number;
          payment_required_amount?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sales_orders"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "sales_orders_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_orders_salesperson_id_fkey";
            columns: ["salesperson_id"];
            isOneToOne: false;
            referencedRelation: "salespeople";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Sales Orders MVP (0067_sales_orders_mvp.sql) — líneas.
      // Snapshot completo (sku_snapshot/description_snapshot/uom_snapshot)
      // resuelto en cada escritura de draft — nunca se vuelve a leer
      // product_catalog una vez la SO deja de ser draft. line_subtotal/
      // line_total los calcula exclusivamente el RPC.
      sales_order_items: {
        Row: {
          id: string;
          sales_order_id: string;
          position: number;
          catalog_product_id: string | null;
          sku_snapshot: string;
          description_snapshot: string | null;
          uom_snapshot: string | null;
          quantity: number;
          unit_price: number;
          discount: number;
          tax: number;
          line_subtotal: number;
          line_total: number;
          estimated_unit_cost: number | null;
          estimated_margin: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sales_order_id: string;
          position?: number;
          catalog_product_id?: string | null;
          sku_snapshot: string;
          description_snapshot?: string | null;
          uom_snapshot?: string | null;
          quantity: number;
          unit_price: number;
          discount?: number;
          tax?: number;
          // Los calcula rpc_create_sales_order/rpc_update_sales_order; nunca se envían desde la app.
          line_subtotal?: number;
          line_total?: number;
          estimated_unit_cost?: number | null;
          estimated_margin?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sales_order_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey";
            columns: ["sales_order_id"];
            isOneToOne: false;
            referencedRelation: "sales_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_order_items_catalog_product_id_fkey";
            columns: ["catalog_product_id"];
            isOneToOne: false;
            referencedRelation: "product_catalog";
            referencedColumns: ["id"];
          },
        ];
      };
      // THÖREN Financial Release (0068_sales_order_financial_release.sql) —
      // historial mínimo, inmutable (solo INSERT — sin policy de
      // update/delete para `authenticated`). Escrito exclusivamente por
      // las 4 RPCs financieras.
      sales_order_financial_events: {
        Row: {
          id: string;
          sales_order_id: string;
          event_type: string;
          amount: number | null;
          previous_financial_status: string | null;
          new_financial_status: string | null;
          previous_release_status: string | null;
          new_release_status: string | null;
          reason: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          sales_order_id: string;
          event_type: string;
          amount?: number | null;
          previous_financial_status?: string | null;
          new_financial_status?: string | null;
          previous_release_status?: string | null;
          new_release_status?: string | null;
          reason?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sales_order_financial_events"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "sales_order_financial_events_sales_order_id_fkey";
            columns: ["sales_order_id"];
            isOneToOne: false;
            referencedRelation: "sales_orders";
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
      // THÖREN — Supplier Product References (0066) — SECURITY INVOKER,
      // ADMIN-only (verificado dentro del RPC). Reemplaza atómicamente el
      // conjunto completo de referencias de proveedor de un producto —
      // DELETE + INSERT en UNA sola transacción implícita: si cualquier
      // validación o el INSERT falla, TODO se revierte (el producto
      // conserva su set anterior). p_references es un array de
      // {supplier_id, supplier_sku, supplier_model, supplier_description,
      // supplier_uom, preferred, active}.
      rpc_replace_supplier_product_references: {
        Args: {
          p_catalog_product_id: string;
          p_references: Json;
        };
        Returns: Database["public"]["Tables"]["supplier_product_references"]["Row"][];
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
      // THÖREN Fase 9 / Block 1 (0064) — solo lectura, disponibilidad/
      // shortage agregada por (order_id, catalog_product_id). Omite
      // order_items sin catalog_product_id (ver DECISIÓN en la migración).
      fn_order_product_shortage: {
        Args: { p_order_id: string };
        Returns: {
          catalog_product_id: string;
          requested_qty: number;
          on_hand_qty: number;
          reserved_other_orders_qty: number;
          reserved_this_order_qty: number;
          available_qty: number;
          incoming_qty: number;
          shortage_qty: number;
        }[];
      };
      // THÖREN Fase 9 / Block 1 (0064, aclaración GAP 1/GAP 2) — SECURITY
      // DEFINER, ÚNICO punto de entrada para sincronizar procurement de un
      // Pedido. Lee el status ACTUAL y decide: 'pedido' → disponibilidad/
      // reserva (repartida entre TODOS los almacenes activos con stock
      // libre, GAP 1) + purchase_requirement; 'cancelado' → libera TODAS
      // las reservas activas + cancela requirements; cualquier otro
      // status → no-op. Idempotente en los 3 casos — mismo punto de
      // entrada para confirmar, editar cantidades, cancelar, o
      // reintentar manualmente (recalculateOrderProcurement).
      rpc_sync_order_procurement: {
        Args: { p_order_id: string };
        Returns: {
          catalog_product_id: string;
          requested_qty: number;
          available_qty: number;
          reserved_qty: number;
          shortage_qty: number;
          requirement_id: string | null;
        }[];
      };
      // THÖREN Fase 9 / Block 1 (0064) — SECURITY DEFINER, ADMIN o
      // can_prepare_purchase_orders. Registra que una partida de PO ya
      // creada cubre (total o parcialmente) un purchase_requirement.
      rpc_allocate_purchase_requirement: {
        Args: {
          p_requirement_id: string;
          p_purchase_order_item_id: string;
          p_allocated_qty: number;
        };
        Returns: Database["public"]["Tables"]["purchase_requirements"]["Row"];
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
      // THÖREN Sales Orders MVP (0067) — SECURITY INVOKER, transacción
      // única: pide order_number a fn_next_sales_order_number(), resuelve
      // customer_contact_snapshot y calcula totales server-side. p_items es
      // un array de objetos con catalog_product_id?/sku_snapshot?/
      // description_snapshot?/uom_snapshot?/quantity/unit_price/discount?/
      // tax?/estimated_unit_cost?/estimated_margin?.
      rpc_create_sales_order: {
        Args: {
          p_sales_order_id: string;
          p_sales_order: Json;
          p_items: Json;
        };
        Returns: Database["public"]["Tables"]["sales_orders"]["Row"];
      };
      // THÖREN Sales Orders MVP (0067) — SECURITY INVOKER. Solo permite
      // escribir si la Sales Order sigue en status "draft" (verificado
      // dentro del RPC, además de RLS/trigger). Reemplaza todo el set de
      // sales_order_items en la MISMA transacción (nunca delete+insert por
      // separado desde la app).
      rpc_update_sales_order: {
        Args: {
          p_sales_order_id: string;
          p_sales_order: Json;
          p_items: Json;
        };
        Returns: Database["public"]["Tables"]["sales_orders"]["Row"];
      };
      // THÖREN Sales Orders MVP (0067) — SECURITY INVOKER. Confirma/
      // cancela/avanza el estado (confirmed/in_progress/fulfilled/closed/
      // cancelled) — "draft" nunca es un destino aceptado. La máquina de
      // estados real la impone trg_sales_order_status_transition.
      rpc_update_sales_order_status: {
        Args: {
          p_sales_order_id: string;
          p_status: string;
        };
        Returns: Database["public"]["Tables"]["sales_orders"]["Row"];
      };
      // THÖREN Financial Release (0068) — SECURITY INVOKER, requiere
      // can_manage_sales_order_finance (o admin). Registra un pago,
      // recalcula amount_paid/financial_status y libera automáticamente
      // cuando corresponde (nunca para crédito).
      rpc_register_sales_order_payment: {
        Args: {
          p_sales_order_id: string;
          p_amount: number;
          p_note?: string | null;
        };
        Returns: Database["public"]["Tables"]["sales_orders"]["Row"];
      };
      // THÖREN Financial Release (0068) — SECURITY INVOKER, requiere
      // can_manage_sales_order_finance (o admin). Solo para SO con
      // payment_terms_type = 'credit'.
      rpc_approve_sales_order_credit: {
        Args: {
          p_sales_order_id: string;
        };
        Returns: Database["public"]["Tables"]["sales_orders"]["Row"];
      };
      // THÖREN Financial Release (0068) — SECURITY INVOKER, requiere
      // can_manage_sales_order_finance (o admin). p_reason obligatorio
      // (no blanco) — validado dentro del RPC.
      rpc_set_sales_order_financial_hold: {
        Args: {
          p_sales_order_id: string;
          p_reason: string;
        };
        Returns: Database["public"]["Tables"]["sales_orders"]["Row"];
      };
      // THÖREN Financial Release (0068) — SECURITY INVOKER, requiere
      // can_manage_sales_order_finance (o admin). Re-evalúa y libera
      // ÚNICAMENTE si la condición financiera ya se cumple — contrapunto
      // de rpc_set_sales_order_financial_hold.
      rpc_release_sales_order: {
        Args: {
          p_sales_order_id: string;
        };
        Returns: Database["public"]["Tables"]["sales_orders"]["Row"];
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
      // THÖREN 8B (Gap 2, 0058) — wrappers additivos de rpc_create_order/
      // rpc_update_order que además validan/guardan custom_field_values de
      // cada order_item en la misma transacción.
      rpc_create_order_with_custom_fields: {
        Args: {
          p_order_id: string;
          p_order: Json;
          p_items: Json;
          p_images: Json;
          p_files: Json;
        };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      rpc_update_order_with_custom_fields: {
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
      // THÖREN 8D (0061) — autoridad real de "obligatorio antes de Pedido",
      // reutilizada por rpc_create_order_with_custom_fields/
      // rpc_update_order_with_custom_fields (internamente) y por
      // setOrderStatus (vía RPC directo).
      fn_get_missing_required_before_order_fields: {
        Args: { p_order_id: string };
        Returns: string[];
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
