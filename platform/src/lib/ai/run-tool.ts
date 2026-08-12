import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { callClaude, estimateCostUsd } from "@/lib/ai/claude";
import { TOOL_OUTPUT_SCHEMAS, type ToolSlug } from "@/lib/ai/schemas";

export interface RunToolParams {
  toolSlug: ToolSlug;
  input: Record<string, unknown>;
  userId: string;
  companyId: string;
  clientId?: string;
  opportunityId?: string;
}

export interface RunToolSuccess {
  status: "success";
  executionId: string;
  output: unknown;
}

export interface RunToolFailure {
  status: "error";
  executionId: string;
  message: string;
}

/** Reemplaza {{variable}} en la plantilla del prompt con los valores del formulario. */
function renderTemplate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key: string) => {
    const value = variables[key];
    if (value === undefined || value === null) return "";
    return Array.isArray(value) ? value.join(", ") : String(value);
  });
}

/** Extrae el primer bloque JSON de la respuesta, tolerando ```json ... ``` o texto alrededor. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw.trim());
}

/**
 * Orquesta la ejecución de una herramienta:
 * carga el prompt activo desde la base de datos → rellena variables → llama a
 * Claude → valida contra el Zod schema de la herramienta → guarda el resultado
 * en tool_executions (historial) → devuelve al cliente SOLO el resultado
 * estructurado, nunca el system prompt.
 */
export async function runTool(params: RunToolParams): Promise<RunToolSuccess | RunToolFailure> {
  const supabase = createSupabaseServerClient();
  const startedAt = Date.now();

  const { data: tool, error: toolError } = await supabase
    .from("tools")
    .select("id, business_unit_id, prompt_id, prompts(system_prompt, user_prompt_template, model, temperature, version)")
    .eq("slug", params.toolSlug)
    .eq("status", "active")
    .single();

  if (toolError || !tool || !tool.prompts) {
    throw new Error(`Herramienta "${params.toolSlug}" no encontrada o inactiva.`);
  }

  const prompt = tool.prompts as unknown as {
    system_prompt: string;
    user_prompt_template: string;
    model: string;
    temperature: number;
    version: number;
  };

  const userMessage = renderTemplate(prompt.user_prompt_template, params.input);
  const schema = TOOL_OUTPUT_SCHEMAS[params.toolSlug];

  let output: unknown;
  let rawText = "";
  let tokensInput = 0;
  let tokensOutput = 0;
  let status: "success" | "error" = "success";
  let errorMessage: string | undefined;

  try {
    const result = await callClaude({
      systemPrompt: buildSystemPromptWithSchema(prompt.system_prompt, schema),
      userMessage,
      model: prompt.model,
      temperature: prompt.temperature,
    });
    rawText = result.text;
    tokensInput = result.tokensInput;
    tokensOutput = result.tokensOutput;

    output = schema.parse(extractJson(rawText));
  } catch (firstError) {
    // Un reintento con instrucción de corrección antes de rendirnos.
    try {
      const repaired = await callClaude({
        systemPrompt: buildSystemPromptWithSchema(prompt.system_prompt, schema),
        userMessage: `${userMessage}\n\nTu respuesta anterior no cumplió el formato JSON requerido. Responde ÚNICAMENTE con el JSON válido, sin texto adicional.`,
        model: prompt.model,
        temperature: prompt.temperature,
      });
      tokensInput += repaired.tokensInput;
      tokensOutput += repaired.tokensOutput;
      output = schema.parse(extractJson(repaired.text));
    } catch (secondError) {
      status = "error";
      errorMessage =
        secondError instanceof z.ZodError
          ? "La respuesta de la IA no cumplió el formato esperado."
          : "No fue posible generar el resultado. Intenta de nuevo.";
    }
  }

  const durationMs = Date.now() - startedAt;
  const costEstimate = estimateCostUsd(tokensInput, tokensOutput);

  const { data: execution } = await supabase
    .from("tool_executions")
    .insert({
      company_id: params.companyId,
      business_unit_id: tool.business_unit_id,
      tool_id: tool.id,
      prompt_id: tool.prompt_id,
      prompt_version: prompt.version,
      user_id: params.userId,
      client_id: params.clientId ?? null,
      opportunity_id: params.opportunityId ?? null,
      input: params.input,
      output: status === "success" ? output : null,
      status,
      error_message: errorMessage ?? null,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      cost_estimate: costEstimate,
      duration_ms: durationMs,
    })
    .select("id")
    .single();

  const executionId = execution?.id ?? "unknown";

  if (status === "error") {
    return { status: "error", executionId, message: errorMessage ?? "Error desconocido." };
  }
  return { status: "success", executionId, output };
}

function buildSystemPromptWithSchema(systemPrompt: string, schema: z.ZodTypeAny): string {
  return `${systemPrompt}\n\nResponde ÚNICAMENTE con un objeto JSON válido que cumpla esta forma (sin explicaciones fuera del JSON):\n${describeShape(
    schema
  )}`;
}

/** Descripción legible y compacta del shape esperado, para reforzar el formato en el prompt. */
function describeShape(schema: z.ZodTypeAny): string {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const entries = Object.entries(shape).map(([key, value]) => `"${key}": ${describeType(value)}`);
    return `{ ${entries.join(", ")} }`;
  }
  return "{}";
}

function describeType(value: z.ZodTypeAny): string {
  if (value instanceof z.ZodArray) return "[...]";
  if (value instanceof z.ZodEnum) return value.options.map((o: string) => `"${o}"`).join(" | ");
  if (value instanceof z.ZodNumber) return "0";
  return '"..."';
}
