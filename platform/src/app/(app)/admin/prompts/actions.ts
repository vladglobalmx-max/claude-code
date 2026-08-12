"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { roleHasPermission } from "@/lib/auth/permissions";
import { callClaude } from "@/lib/ai/claude";

const updateSchema = z.object({
  promptId: z.string().uuid(),
  system_prompt: z.string().min(1),
  user_prompt_template: z.string().min(1),
  model: z.string().min(1),
  temperature: z.coerce.number().min(0).max(1),
  status: z.enum(["active", "inactive", "draft"]),
  change_note: z.string().optional(),
});

export interface UpdatePromptState {
  error?: string;
  success?: boolean;
}

/**
 * Actualiza un prompt. El trigger `trg_snapshot_prompt_version` en la base de
 * datos garantiza que la versión anterior queda en `prompt_versions` antes de
 * aplicar el cambio — este código no tiene que (ni debe) implementar eso.
 */
export async function updatePromptAction(_prev: UpdatePromptState, formData: FormData): Promise<UpdatePromptState> {
  const user = await getCurrentUser();
  if (!user || !roleHasPermission(user.role, "manage_prompts")) {
    return { error: "No tienes permiso para editar prompts." };
  }

  const parsed = updateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Datos inválidos." };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("prompts")
    .update({
      system_prompt: parsed.data.system_prompt,
      user_prompt_template: parsed.data.user_prompt_template,
      model: parsed.data.model,
      temperature: parsed.data.temperature,
      status: parsed.data.status,
      created_by: user.id, // el trigger usa created_by como changed_by del snapshot
    })
    .eq("id", parsed.data.promptId)
    .eq("company_id", user.companyId);

  if (error) return { error: "No se pudo guardar el prompt." };

  await supabase.from("audit_log").insert({
    company_id: user.companyId,
    user_id: user.id,
    action: "edit_prompt",
    entity_type: "prompts",
    entity_id: parsed.data.promptId,
  });

  revalidatePath(`/admin/prompts/${parsed.data.promptId}`);
  return { success: true };
}

const testSchema = z.object({
  systemPrompt: z.string(),
  userMessage: z.string(),
  model: z.string(),
  temperature: z.coerce.number(),
});

export interface TestPromptResult {
  output?: string;
  error?: string;
}

/** Ejecuta el prompt tal como está en el editor (sin guardar) contra Claude, para revisión del Administrador de IA. */
export async function testPromptAction(input: unknown): Promise<TestPromptResult> {
  const user = await getCurrentUser();
  if (!user || !roleHasPermission(user.role, "test_tools")) {
    return { error: "No tienes permiso para probar prompts." };
  }

  const parsed = testSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos de prueba inválidos." };

  try {
    const result = await callClaude({
      systemPrompt: parsed.data.systemPrompt,
      userMessage: parsed.data.userMessage,
      model: parsed.data.model,
      temperature: parsed.data.temperature,
    });
    return { output: result.text };
  } catch {
    return { error: "No se pudo ejecutar la prueba. Verifica la configuración del modelo." };
  }
}
