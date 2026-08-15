import { Building2 } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ActiveBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

interface BusinessUnitCardRow {
  id: string;
  name: string;
  code: string;
  active: boolean;
  // Solo se puede contar de forma confiable para ADMIN: person_business_units
  // solo tiene policy SELECT para admin (ver 0017_core_person_business_units.sql).
  // Para VENDEDOR esta relación siempre llega vacía por RLS, así que el
  // conteo NUNCA se muestra fuera de la rama admin — mostrar "0" ahí sería
  // engañoso, no un dato real (mismo criterio que el desglose por vendedor
  // del Dashboard: gating de presentación, no un intento de sustituir RLS).
  person_business_units: { person_id: string }[] | null;
}

export default async function UnidadesNegocioPage() {
  const profile = await getCurrentProfile();
  const supabase = createSupabaseServerClient();

  const { data } = await supabase
    .from("business_units")
    .select("id, name, code, active, person_business_units(person_id)")
    .order("name");

  const businessUnits = (data ?? []) as unknown as BusinessUnitCardRow[];
  const isAdmin = profile?.role === "admin";

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Unidades de Negocio" description="Unidades de negocio reales de la organización." />

      {businessUnits.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="No hay unidades de negocio"
            description="Aún no se han dado de alta unidades de negocio para esta organización."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {businessUnits.map((bu) => (
            <Card key={bu.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-ink">{bu.name}</p>
                <ActiveBadge active={bu.active} />
              </div>
              <p className="mt-1 font-mono text-xs text-ink-faint">{bu.code}</p>
              {isAdmin && (
                <p className="mt-3 text-xs text-ink-faint">
                  {(bu.person_business_units ?? []).length} persona
                  {(bu.person_business_units ?? []).length === 1 ? "" : "s"} asociada
                  {(bu.person_business_units ?? []).length === 1 ? "" : "s"}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
