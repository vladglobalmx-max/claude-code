import { z } from "zod";

/**
 * Formato de `tools.input_schema` en la base de datos: define el formulario
 * dinámico que renderiza <DynamicToolForm>. Es deliberadamente más simple que
 * JSON Schema completo — suficiente para los tipos de campo de la Fase 1.
 */
export const toolFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.enum(["text", "textarea", "number", "select"]),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(), // requerido cuando type === "select"
});

export const toolInputSchema = z.object({
  fields: z.array(toolFieldSchema),
});

export type ToolField = z.infer<typeof toolFieldSchema>;
export type ToolInputSchema = z.infer<typeof toolInputSchema>;
