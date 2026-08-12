import { z } from "zod";

/**
 * Un Zod schema por herramienta — es la fuente de verdad de "output_schema"
 * en el servidor. La copia guardada en la tabla `prompts.output_schema`
 * (JSON Schema) es la que ve/edita el Administrador de IA en `/admin/prompts`;
 * esta es la que valida la respuesta real de Claude antes de devolverla al cliente.
 *
 * Las 5 herramientas funcionales de la Fase 1 (Instrucción Maestra §22).
 */

export const prospectResearchSchema = z.object({
  summary: z.string(),
  industry: z.string(),
  company_size_estimate: z.string(),
  pain_points: z.array(z.string()),
  recommended_solutions: z.array(z.string()),
  discovery_questions: z.array(z.string()),
  risk_level: z.enum(["bajo", "medio", "alto"]),
  next_action: z.string(),
});
export type ProspectResearchResult = z.infer<typeof prospectResearchSchema>;

export const visitPreparationSchema = z.object({
  summary: z.string(),
  industry: z.string(),
  pain_points: z.array(z.string()),
  recommended_solutions: z.array(z.string()),
  discovery_questions: z.array(z.string()),
  objections: z.array(z.string()),
  roi_arguments: z.array(z.string()),
  closing_strategy: z.string(),
  next_action: z.string(),
  risk_level: z.enum(["bajo", "medio", "alto"]),
  closing_probability: z.number().min(0).max(100),
});
export type VisitPreparationResult = z.infer<typeof visitPreparationSchema>;

export const followUpSchema = z.object({
  summary: z.string(),
  recommended_channel: z.enum(["llamada", "correo", "whatsapp", "visita"]),
  message_draft: z.string(),
  objections_to_anticipate: z.array(z.string()),
  next_action: z.string(),
  suggested_follow_up_date: z.string(),
});
export type FollowUpResult = z.infer<typeof followUpSchema>;

export const proposalGenerationSchema = z.object({
  title: z.string(),
  executive_summary: z.string(),
  client_needs: z.array(z.string()),
  proposed_solution: z.array(z.string()),
  roi_arguments: z.array(z.string()),
  investment_summary: z.string(),
  terms_and_conditions: z.array(z.string()),
  next_action: z.string(),
});
export type ProposalGenerationResult = z.infer<typeof proposalGenerationSchema>;

export const opportunityAnalysisSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  risks: z.array(z.string()),
  competitors_detected: z.array(z.string()),
  recommended_stage: z.string(),
  closing_probability: z.number().min(0).max(100),
  next_action: z.string(),
});
export type OpportunityAnalysisResult = z.infer<typeof opportunityAnalysisSchema>;

/** Registro tool.slug -> Zod schema. Debe mantenerse sincronizado con supabase/seed. */
export const TOOL_OUTPUT_SCHEMAS = {
  "investigacion-prospectos": prospectResearchSchema,
  "preparacion-visita": visitPreparationSchema,
  "seguimiento-comercial": followUpSchema,
  "generacion-propuesta": proposalGenerationSchema,
  "analisis-oportunidad": opportunityAnalysisSchema,
} as const;

export type ToolSlug = keyof typeof TOOL_OUTPUT_SCHEMAS;
