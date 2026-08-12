import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { toolInputSchema } from "@/lib/validations/tool-input-schema";
import { DynamicToolForm } from "@/components/tools/dynamic-tool-form";

export const dynamic = "force-dynamic";

export default async function ToolRunnerPage({
  params,
  searchParams,
}: {
  params: { toolSlug: string };
  searchParams: { clientId?: string; opportunityId?: string };
}) {
  const user = await getCurrentUser();
  if (!user) notFound();
  const supabase = createSupabaseServerClient();

  const { data: tool } = await supabase
    .from("tools")
    .select("id, slug, name, description, input_schema, allowed_roles")
    .eq("slug", params.toolSlug)
    .eq("company_id", user.companyId)
    .eq("status", "active")
    .single();

  if (!tool) notFound();
  if (tool.allowed_roles.length > 0 && !tool.allowed_roles.includes(user.role)) {
    notFound();
  }

  const parsedSchema = toolInputSchema.safeParse(tool.input_schema);
  if (!parsedSchema.success) {
    return (
      <p className="text-sm text-danger">
        Esta herramienta tiene un formulario mal configurado. Repórtalo al Administrador de IA.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">{tool.name}</h1>
        {tool.description && <p className="text-sm text-ink-faint">{tool.description}</p>}
      </div>
      <DynamicToolForm
        toolSlug={tool.slug}
        inputSchema={parsedSchema.data}
        clientId={searchParams.clientId}
        opportunityId={searchParams.opportunityId}
      />
    </div>
  );
}
