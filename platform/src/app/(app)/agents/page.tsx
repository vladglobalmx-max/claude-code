import Link from "next/link";
import { Bot } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const user = await getCurrentUser();
  const supabase = createSupabaseServerClient();

  const { data: agents } = user
    ? await supabase
        .from("agents")
        .select("id, slug, name, description, icon, objective")
        .eq("company_id", user.companyId)
        .eq("status", "active")
    : { data: [] };

  const visible = (agents ?? []).filter(
    (a) => true // el filtrado fino por allowed_roles se hace también en el propio /agents/[agentId]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Agentes de IA</h1>
        <p className="text-sm text-ink-faint">Cada agente está especializado en un objetivo de negocio — no es un chat genérico.</p>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Bot} title="Sin agentes disponibles" description="Un Administrador de IA debe activar al menos uno." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((agent) => (
            <Link key={agent.id} href={`/agents/${agent.slug}`}>
              <Card className="h-full transition-colors hover:border-accent">
                <CardContent className="pt-5">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-accent/15 text-accent">
                    <Bot className="h-4.5 w-4.5" />
                  </div>
                  <p className="font-medium text-ink">{agent.name}</p>
                  <p className="mt-1 text-sm text-ink-faint">{agent.objective ?? agent.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
