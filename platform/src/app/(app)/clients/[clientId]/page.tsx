import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, Building2, Users, Target, History as HistoryIcon } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientStatusBadge } from "@/components/clients/status-badge";
import { formatCurrency } from "@/lib/utils/format";
import { OPPORTUNITY_STAGES } from "@/types/domain";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: { clientId: string } }) {
  const user = await getCurrentUser();
  if (!user) notFound();
  const supabase = createSupabaseServerClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*, business_units(name)")
    .eq("id", params.clientId)
    .eq("company_id", user.companyId)
    .single();

  if (!client) notFound();

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, position, email, phone, whatsapp")
    .eq("client_id", client.id);

  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("id, name, stage, estimated_value, probability")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-ink">{client.trade_name || client.legal_name}</h1>
            <ClientStatusBadge status={client.status} />
          </div>
          <p className="text-sm text-ink-faint">
            {client.industry ?? "Industria no especificada"} · {(client as any).business_units?.name ?? "—"}
          </p>
        </div>
        <Link href={`/tools/investigacion-prospectos?clientId=${client.id}`}>
          <Button variant="secondary">Investigar con IA</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Información general</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow label="Razón social" value={client.legal_name} />
            <InfoRow label="Sitio web" value={client.website} />
            <InfoRow label="Teléfono" value={client.phone} />
            <InfoRow label="Ciudad" value={[client.city, client.state, client.country].filter(Boolean).join(", ")} />
            <InfoRow label="Empleados" value={client.employees_count ? String(client.employees_count) : undefined} />
            <InfoRow label="Fuente" value={client.source} />
            {client.notes && (
              <div className="pt-2">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Notas</p>
                <p className="mt-1 text-ink-soft">{client.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> Contactos
                </span>
              </CardTitle>
              <Button size="sm" variant="ghost">
                <Plus className="h-4 w-4" /> Agregar
              </Button>
            </CardHeader>
            <CardContent>
              {!contacts || contacts.length === 0 ? (
                <EmptyState icon={Users} title="Sin contactos registrados" />
              ) : (
                <ul className="divide-y divide-border">
                  {contacts.map((c) => (
                    <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <p className="font-medium text-ink">{c.name}</p>
                        <p className="text-ink-faint">{c.position}</p>
                      </div>
                      <p className="text-ink-soft">{c.email}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <Target className="h-4 w-4" /> Oportunidades
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!opportunities || opportunities.length === 0 ? (
                <EmptyState icon={Target} title="Sin oportunidades todavía" />
              ) : (
                <ul className="divide-y divide-border">
                  {opportunities.map((o) => (
                    <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                      <Link href={`/opportunities/${o.id}`} className="font-medium text-ink hover:text-accent">
                        {o.name}
                      </Link>
                      <div className="flex items-center gap-3 text-ink-soft">
                        <span>{OPPORTUNITY_STAGES.find((s) => s.value === o.stage)?.label}</span>
                        <span>{formatCurrency(o.estimated_value)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <HistoryIcon className="h-4 w-4" /> Historial e inteligencia comercial
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={Building2}
                title="Aún no hay conversaciones con IA relacionadas"
                description="Usa una herramienta desde este cliente para empezar a construir su inteligencia comercial."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink-faint">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  );
}
