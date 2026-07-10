import type { Database } from "@/types/database.types";

export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type Contact = Database["public"]["Tables"]["contacts"]["Row"];
export type Opportunity = Database["public"]["Tables"]["opportunities"]["Row"];
export type Followup = Database["public"]["Tables"]["followups"]["Row"];
export type Agent = Database["public"]["Tables"]["agents"]["Row"];
export type Tool = Database["public"]["Tables"]["tools"]["Row"];
export type Prompt = Database["public"]["Tables"]["prompts"]["Row"];
export type PromptVersion = Database["public"]["Tables"]["prompt_versions"]["Row"];
export type BusinessUnit = Database["public"]["Tables"]["business_units"]["Row"];
export type AppUser = Database["public"]["Tables"]["users"]["Row"];
export type ToolExecution = Database["public"]["Tables"]["tool_executions"]["Row"];
export type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
export type ConversationMessage = Database["public"]["Tables"]["conversation_messages"]["Row"];
export type Document = Database["public"]["Tables"]["documents"]["Row"];

export const OPPORTUNITY_STAGES: { value: Opportunity["stage"]; label: string }[] = [
  { value: "prospecto", label: "Prospecto" },
  { value: "contactado", label: "Contactado" },
  { value: "calificado", label: "Calificado" },
  { value: "diagnostico", label: "Diagnóstico" },
  { value: "propuesta", label: "Propuesta" },
  { value: "negociacion", label: "Negociación" },
  { value: "prueba_piloto", label: "Prueba piloto" },
  { value: "cierre_ganado", label: "Cierre ganado" },
  { value: "cierre_perdido", label: "Cierre perdido" },
  { value: "seguimiento_futuro", label: "Seguimiento futuro" },
];
