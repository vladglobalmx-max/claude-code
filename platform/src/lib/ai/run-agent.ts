import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { callClaudeConversation, estimateCostUsd, type ClaudeConversationTurn } from "@/lib/ai/claude";

export interface RunAgentTurnParams {
  agentId: string;
  conversationId: string;
  userId: string;
  companyId: string;
  message: string;
}

/**
 * Ejecuta un turno de conversación con un agente: carga su system prompt,
 * el historial de la conversación, llama a Claude, guarda ambos mensajes
 * (usuario + asistente) y devuelve solo el texto de respuesta.
 */
export async function runAgentTurn(params: RunAgentTurnParams) {
  const supabase = createSupabaseServerClient();

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, model, temperature, prompts(system_prompt)")
    .eq("id", params.agentId)
    .eq("status", "active")
    .single();

  if (agentError || !agent || !agent.prompts) {
    throw new Error("Agente no encontrado o inactivo.");
  }
  const systemPrompt = (agent.prompts as unknown as { system_prompt: string }).system_prompt;

  const { data: history } = await supabase
    .from("conversation_messages")
    .select("role, content")
    .eq("conversation_id", params.conversationId)
    .order("created_at", { ascending: true });

  const turns: ClaudeConversationTurn[] = [
    ...((history ?? []) as ClaudeConversationTurn[]),
    { role: "user", content: params.message },
  ];

  await supabase.from("conversation_messages").insert({
    conversation_id: params.conversationId,
    role: "user",
    content: params.message,
  });

  const result = await callClaudeConversation({
    systemPrompt,
    history: turns,
    model: agent.model,
    temperature: agent.temperature,
  });

  await supabase.from("conversation_messages").insert({
    conversation_id: params.conversationId,
    role: "assistant",
    content: result.text,
  });

  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", params.conversationId);

  return {
    reply: result.text,
    costEstimate: estimateCostUsd(result.tokensInput, result.tokensOutput),
  };
}
