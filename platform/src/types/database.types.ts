/**
 * Tipos de la base de datos. Este archivo es un punto de partida escrito a
 * mano para que el proyecto compile antes de tener un proyecto Supabase real.
 *
 * En cuanto exista el proyecto Supabase con las migraciones aplicadas,
 * reemplazar este archivo ejecutando:
 *   npm run supabase:types
 * (definido en package.json, usa `supabase gen types typescript --local`).
 */

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: { id: string; name: string; slug: string; created_at: string };
        Insert: { id?: string; name: string; slug: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["companies"]["Row"]>;
      };
      business_units: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          slug: string;
          description: string | null;
          icon: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["business_units"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["business_units"]["Row"]>;
      };
      roles: {
        Row: {
          id: string;
          company_id: string | null;
          key: string;
          name: string;
          description: string | null;
          is_system: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["roles"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["roles"]["Row"]>;
      };
      users: {
        Row: {
          id: string;
          company_id: string;
          role_id: string;
          full_name: string;
          email: string;
          avatar_url: string | null;
          status: "active" | "invited" | "disabled";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["users"]["Row"], "created_at"> & { created_at?: string };
        Update: Partial<Database["public"]["Tables"]["users"]["Row"]>;
      };
      user_business_units: {
        Row: { user_id: string; business_unit_id: string };
        Insert: Database["public"]["Tables"]["user_business_units"]["Row"];
        Update: Partial<Database["public"]["Tables"]["user_business_units"]["Row"]>;
      };
      clients: {
        Row: {
          id: string;
          company_id: string;
          business_unit_id: string;
          legal_name: string;
          trade_name: string | null;
          industry: string | null;
          size: string | null;
          employees_count: number | null;
          website: string | null;
          phone: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          status: "active" | "inactive" | "prospect";
          source: string | null;
          owner_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["clients"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Row"]>;
      };
      contacts: {
        Row: {
          id: string;
          company_id: string;
          client_id: string;
          name: string;
          position: string | null;
          email: string | null;
          phone: string | null;
          whatsapp: string | null;
          area: string | null;
          decision_level: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["contacts"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["contacts"]["Row"]>;
      };
      opportunities: {
        Row: {
          id: string;
          company_id: string;
          business_unit_id: string;
          client_id: string;
          contact_id: string | null;
          name: string;
          owner_id: string;
          estimated_value: number | null;
          estimated_margin: number | null;
          stage:
            | "prospecto"
            | "contactado"
            | "calificado"
            | "diagnostico"
            | "propuesta"
            | "negociacion"
            | "prueba_piloto"
            | "cierre_ganado"
            | "cierre_perdido"
            | "seguimiento_futuro";
          probability: number;
          expected_close_date: string | null;
          last_activity_at: string | null;
          next_activity_at: string | null;
          competitors: string[];
          objections: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["opportunities"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["opportunities"]["Row"]>;
      };
      followups: {
        Row: {
          id: string;
          company_id: string;
          business_unit_id: string;
          client_id: string | null;
          contact_id: string | null;
          opportunity_id: string | null;
          user_id: string;
          type: string;
          scheduled_at: string;
          priority: "alta" | "media" | "baja";
          status: "pendiente" | "completado" | "vencido" | "cancelado";
          description: string | null;
          result: string | null;
          next_action: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["followups"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["followups"]["Row"]>;
      };
      prompts: {
        Row: {
          id: string;
          company_id: string;
          business_unit_id: string | null;
          name: string;
          code: string;
          objective: string | null;
          system_prompt: string;
          user_prompt_template: string;
          variables: unknown;
          output_schema: unknown;
          model: string;
          temperature: number;
          version: number;
          status: "active" | "inactive" | "draft";
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["prompts"]["Row"], "id" | "created_at" | "updated_at" | "version"> & {
          id?: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["prompts"]["Row"]>;
      };
      prompt_versions: {
        Row: {
          id: string;
          prompt_id: string;
          version: number;
          system_prompt: string;
          user_prompt_template: string;
          variables: unknown;
          output_schema: unknown;
          model: string;
          temperature: number;
          change_note: string | null;
          changed_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["prompt_versions"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["prompt_versions"]["Row"]>;
      };
      agents: {
        Row: {
          id: string;
          company_id: string;
          business_unit_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          icon: string | null;
          objective: string | null;
          system_prompt_id: string;
          model: string;
          temperature: number;
          tool_ids: string[];
          allowed_roles: string[];
          status: "active" | "inactive";
          version: number;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["agents"]["Row"], "id" | "updated_at" | "version"> & {
          id?: string;
          version?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["agents"]["Row"]>;
      };
      tools: {
        Row: {
          id: string;
          company_id: string;
          business_unit_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          category: string | null;
          agent_id: string | null;
          input_schema: unknown;
          output_schema: unknown;
          prompt_id: string;
          allowed_roles: string[];
          status: "active" | "inactive";
          version: number;
        };
        Insert: Omit<Database["public"]["Tables"]["tools"]["Row"], "id" | "version"> & {
          id?: string;
          version?: number;
        };
        Update: Partial<Database["public"]["Tables"]["tools"]["Row"]>;
      };
      conversations: {
        Row: {
          id: string;
          company_id: string;
          agent_id: string;
          user_id: string;
          client_id: string | null;
          opportunity_id: string | null;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["conversations"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["conversations"]["Row"]>;
      };
      conversation_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          attachments: unknown;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["conversation_messages"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["conversation_messages"]["Row"]>;
      };
      tool_executions: {
        Row: {
          id: string;
          company_id: string;
          business_unit_id: string | null;
          tool_id: string;
          prompt_id: string;
          prompt_version: number;
          user_id: string;
          client_id: string | null;
          opportunity_id: string | null;
          input: unknown;
          output: unknown;
          status: "success" | "error";
          error_message: string | null;
          tokens_input: number | null;
          tokens_output: number | null;
          cost_estimate: number | null;
          duration_ms: number | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["tool_executions"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tool_executions"]["Row"]>;
      };
      documents: {
        Row: {
          id: string;
          company_id: string;
          business_unit_id: string | null;
          name: string;
          category: string | null;
          description: string | null;
          file_path: string;
          file_type: string | null;
          tags: string[];
          version: number;
          status: "active" | "archived";
          allowed_roles: string[];
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["documents"]["Row"], "id" | "created_at" | "version"> & {
          id?: string;
          version?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Row"]>;
      };
      audit_log: {
        Row: {
          id: string;
          company_id: string;
          user_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          metadata: unknown;
          ip_address: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["audit_log"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Row"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
