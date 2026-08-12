import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { runAgentTurn } from "@/lib/ai/run-agent";

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
});

/**
 * Único punto de entrada del chat con un agente. El componente cliente
 * (ChatWindow) nunca ve el system prompt del agente ni llama a Claude
 * directamente — solo envía el mensaje del usuario y recibe la respuesta.
 */
export async function POST(request: NextRequest, { params }: { params: { agentId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  const { data: agent } = await supabase
    .from("agents")
    .select("id, allowed_roles")
    .eq("slug", params.agentId)
    .eq("company_id", user.companyId)
    .eq("status", "active")
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agente no encontrado." }, { status: 404 });
  }

  if (agent.allowed_roles.length > 0 && !agent.allowed_roles.includes(user.role)) {
    return NextResponse.json({ error: "No tienes permiso para usar este agente." }, { status: 403 });
  }

  let conversationId = parsed.data.conversationId;

  if (!conversationId) {
    const { data: conversation, error } = await supabase
      .from("conversations")
      .insert({
        company_id: user.companyId,
        agent_id: agent.id,
        user_id: user.id,
        client_id: parsed.data.clientId ?? null,
        opportunity_id: parsed.data.opportunityId ?? null,
        title: parsed.data.message.slice(0, 60),
      })
      .select("id")
      .single();

    if (error || !conversation) {
      return NextResponse.json({ error: "No se pudo iniciar la conversación." }, { status: 500 });
    }
    conversationId = conversation.id;
  }

  try {
    const result = await runAgentTurn({
      agentId: agent.id,
      conversationId,
      userId: user.id,
      companyId: user.companyId,
      message: parsed.data.message,
    });

    return NextResponse.json({ conversationId, reply: result.reply });
  } catch {
    // Nunca se expone el detalle técnico al cliente (Instrucción Maestra §16).
    return NextResponse.json({ error: "No fue posible generar una respuesta. Intenta de nuevo." }, { status: 502 });
  }
}
