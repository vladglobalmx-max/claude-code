import { notFound } from "next/navigation";
import Link from "next/link";
import { TrendingUp, FileSignature, History as HistoryIcon } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StageSelector } from "@/components/opportunities/stage-selector";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate, formatRelativeToNow } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function OpportunityDetailPage({ params }: { params: { opportunityId: string } }) {
  const user = await getCurrentUser();
  if (!user) notFound();
  const supabase = createSupabaseServerClient();

  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("*, clients(id, legal_name, trade_name), business_units(name)")
    .eq("id", params.opportunityId)
    .eq("company_id", user.companyId)
    .single();

  if (!opportunity) notFound();

  const { data: stageHistory } = await supabase
    .from("opportunity_stage_history")
    .select("from_stage, to_stage, changed_at")
    .eq("opportunity_id", opportunity.id)
    .order("changed_at", { ascending: false });

  const client = (opportunity as any).clients;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">{opportunity.name}</h1>
          <p className="text-sm text-ink-faint">
            {client && (
              <Link href={`/clients/${client.id}`} className="hover:text-accent">
                {client.trade_name || client.legal_name}
              </Link>
            )}{" "}
            · {(opportunity as any).business_units?.name}
          </p>
        </div>
        <StageSelector opportunityId={opportunity.id} currentStage={opportunity.stage} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Metric label="Valor estimado" value={formatCurrency(opportunity.estimated_value)} />
              <Metric label="Margen estimado" value={opportunity.estimated_margin ? `${opportunity.estimated_margin}%` : "—"} />
              <Metric label="Probabilidad" value={`${opportunity.probability}%`} />
              <Metric label="Cierre estimado" value={formatDate(opportunity.expected_close_date)} />
              <Metric label="Última actividad" value={formatRelativeToNow(opportunity.last_activity_at)} />
              <Metric label="Próxima actividad" value={formatRelativeToNow(opportunity.next_activity_at)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <HistoryIcon className="h-4 w-4" /> Historial de etapa
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!stageHistory || stageHistory.length === 0 ? (
                <EmptyState icon={HistoryIcon} title="Sin cambios de etapa registrados" />
              ) : (
                <ul className="space-y-2 text-sm">
                  {stageHistory.map((h, idx) => (
                    <li key={idx} className="flex items-center justify-between">
                      <span className="text-ink-soft">
                        {h.from_stage ?? "—"} → <span className="text-ink">{h.to_stage}</span>
                      </span>
                      <span className="text-xs text-ink-faint">{formatRelativeToNow(h.changed_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Herramientas de IA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href={`/tools/analisis-oportunidad?opportunityId=${opportunity.id}`}>
              <Button variant="secondary" className="w-full justify-start">
                <TrendingUp className="h-4 w-4" /> Analizar oportunidad
              </Button>
            </Link>
            <Link href={`/tools/generacion-propuesta?opportunityId=${opportunity.id}`}>
              <Button variant="secondary" className="w-full justify-start">
                <FileSignature className="h-4 w-4" /> Generar propuesta
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-1 font-medium text-ink">{value}</p>
    </div>
  );
}
