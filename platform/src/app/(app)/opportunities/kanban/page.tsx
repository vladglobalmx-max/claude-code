import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { OPPORTUNITY_STAGES, type Opportunity } from "@/types/domain";
import { formatCurrency } from "@/lib/utils/format";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function OpportunitiesKanbanPage() {
  const user = await getCurrentUser();
  const supabase = createSupabaseServerClient();

  const { data: opportunities } = user
    ? await supabase
        .from("opportunities")
        .select("id, name, stage, estimated_value, clients(trade_name, legal_name)")
        .eq("company_id", user.companyId)
    : { data: [] };

  const byStage = new Map<Opportunity["stage"], typeof opportunities>();
  for (const stage of OPPORTUNITY_STAGES) byStage.set(stage.value, []);
  for (const o of opportunities ?? []) {
    byStage.get(o.stage)?.push(o) ?? byStage.set(o.stage, [o]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Pipeline — Vista Kanban</h1>
        <p className="text-sm text-ink-faint">Arrastra (próxima iteración) o abre cada tarjeta para actualizar la etapa.</p>
      </div>

      <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-4">
        {OPPORTUNITY_STAGES.map((stage) => {
          const items = byStage.get(stage.value) ?? [];
          return (
            <div key={stage.value} className="w-72 shrink-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{stage.label}</h3>
                <span className="text-xs text-ink-faint">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((o) => (
                  <Link key={o.id} href={`/opportunities/${o.id}`}>
                    <Card className="p-3 transition-colors hover:border-accent">
                      <p className="text-sm font-medium text-ink">{o.name}</p>
                      <p className="mt-1 text-xs text-ink-faint">
                        {(o as any).clients?.trade_name || (o as any).clients?.legal_name}
                      </p>
                      <p className="mt-2 text-xs font-medium text-accent">{formatCurrency(o.estimated_value)}</p>
                    </Card>
                  </Link>
                ))}
                {items.length === 0 && (
                  <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-ink-faint">
                    Sin oportunidades
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
