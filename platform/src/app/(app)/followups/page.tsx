import { CalendarClock } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatRelativeToNow } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const PRIORITY_TONE = { alta: "danger", media: "warning", baja: "neutral" } as const;

export default async function FollowupsPage() {
  const user = await getCurrentUser();
  const supabase = createSupabaseServerClient();

  const { data: followups } = user
    ? await supabase
        .from("followups")
        .select("id, type, scheduled_at, priority, status, description, clients(legal_name, trade_name)")
        .eq("company_id", user.companyId)
        .order("scheduled_at", { ascending: true })
    : { data: [] };

  const now = Date.now();
  const groups = {
    vencidos: (followups ?? []).filter((f) => f.status === "pendiente" && new Date(f.scheduled_at).getTime() < now),
    hoy: (followups ?? []).filter(
      (f) => f.status === "pendiente" && isToday(f.scheduled_at)
    ),
    proximos: (followups ?? []).filter(
      (f) => f.status === "pendiente" && new Date(f.scheduled_at).getTime() > now && !isToday(f.scheduled_at)
    ),
    completados: (followups ?? []).filter((f) => f.status === "completado"),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Seguimientos</h1>
        <p className="text-sm text-ink-faint">Llamadas, correos, visitas y recordatorios comerciales.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FollowupGroup title="Vencidos" items={groups.vencidos} tone="danger" />
        <FollowupGroup title="Para hoy" items={groups.hoy} tone="accent" />
        <FollowupGroup title="Próximos" items={groups.proximos} tone="neutral" />
        <FollowupGroup title="Completados" items={groups.completados} tone="success" />
      </div>
    </div>
  );
}

function isToday(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

function FollowupGroup({
  title,
  items,
  tone,
}: {
  title: string;
  items: any[];
  tone: "danger" | "accent" | "neutral" | "success";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title} <span className="ml-1 text-ink-faint">({items.length})</span>
        </CardTitle>
        <Badge tone={tone}>{items.length}</Badge>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Nada por aquí" />
        ) : (
          <ul className="space-y-3">
            {items.map((f) => (
              <li key={f.id} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium text-ink">
                    {f.type} — {f.clients?.trade_name || f.clients?.legal_name || "Sin cliente"}
                  </p>
                  {f.description && <p className="text-ink-faint">{f.description}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone={PRIORITY_TONE[f.priority as keyof typeof PRIORITY_TONE]}>{f.priority}</Badge>
                  <span className="text-xs text-ink-faint">{formatRelativeToNow(f.scheduled_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
