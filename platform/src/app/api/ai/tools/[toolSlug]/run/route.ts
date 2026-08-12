import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { runTool } from "@/lib/ai/run-tool";
import { TOOL_OUTPUT_SCHEMAS, type ToolSlug } from "@/lib/ai/schemas";

const bodySchema = z.object({
  input: z.record(z.string()),
  clientId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest, { params }: { params: { toolSlug: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!(params.toolSlug in TOOL_OUTPUT_SCHEMAS)) {
    return NextResponse.json({ error: "Herramienta no reconocida." }, { status: 404 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data: tool } = await supabase
    .from("tools")
    .select("allowed_roles")
    .eq("slug", params.toolSlug)
    .eq("company_id", user.companyId)
    .eq("status", "active")
    .single();

  if (!tool) {
    return NextResponse.json({ error: "Herramienta no encontrada." }, { status: 404 });
  }
  if (tool.allowed_roles.length > 0 && !tool.allowed_roles.includes(user.role)) {
    return NextResponse.json({ error: "No tienes permiso para usar esta herramienta." }, { status: 403 });
  }

  try {
    const result = await runTool({
      toolSlug: params.toolSlug as ToolSlug,
      input: parsed.data.input,
      userId: user.id,
      companyId: user.companyId,
      clientId: parsed.data.clientId,
      opportunityId: parsed.data.opportunityId,
    });

    if (result.status === "error") {
      return NextResponse.json({ error: result.message }, { status: 422 });
    }
    return NextResponse.json({ output: result.output, executionId: result.executionId });
  } catch {
    return NextResponse.json({ error: "No fue posible generar el resultado. Intenta de nuevo." }, { status: 502 });
  }
}
