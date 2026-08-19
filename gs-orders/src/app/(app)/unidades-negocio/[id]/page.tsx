import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getSignedUrl } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActiveBadge } from "@/components/ui/status-badge";
import type { BusinessUnitRow } from "@/types/domain";
import { BusinessUnitDetailForm } from "./business-unit-detail-form";
import { BusinessUnitLogoField } from "./business-unit-logo-field";

export const dynamic = "force-dynamic";

/**
 * Detalle/administración de una Business Unit (THÖREN Business Unit
 * Branding, 0024_business_unit_branding.sql). VENDEDOR ve exactamente la
 * misma pantalla que ADMIN, salvo los controles editables — mismo
 * criterio de "ocultar UI + RLS real detrás" usado en el resto de
 * Configuración. `isAdmin` usa profile.role (flag global de
 * user_profiles), el mismo criterio ya usado en el listado
 * (unidades-negocio/page.tsx) para gatear el conteo de personas — no
 * is_organization_admin(organization_id) (que es lo que sí exige la RLS
 * real de escritura). En la práctica coinciden porque cada usuario
 * pertenece a una sola organización (current_user_organization_id()
 * exige exactamente 1) — documentado aquí como el mismo límite conocido
 * ya aceptado en esa página, no una inconsistencia nueva de esta feature.
 */
export default async function BusinessUnitDetailPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  const supabase = createSupabaseServerClient();

  const { data } = await supabase.from("business_units").select("*").eq("id", params.id).single();
  if (!data) notFound();
  const businessUnit = data as BusinessUnitRow;

  const signedLogoUrl = businessUnit.logo_path ? await getSignedUrl("business-unit-assets", businessUnit.logo_path) : null;

  const isAdmin = profile?.role === "admin";

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <Link href="/unidades-negocio" className="flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          Unidades de Negocio
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{businessUnit.name}</CardTitle>
          <ActiveBadge active={businessUnit.active} />
        </CardHeader>
        <CardContent className="space-y-8">
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">Datos generales</p>
            <BusinessUnitDetailForm
              businessUnitId={businessUnit.id}
              initialName={businessUnit.name}
              code={businessUnit.code}
              initialActive={businessUnit.active}
              canEdit={isAdmin}
            />
          </div>

          <div className="border-t border-border pt-6">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">Identidad visual</p>
            <BusinessUnitLogoField
              businessUnitId={businessUnit.id}
              initialLogoPath={businessUnit.logo_path}
              initialSignedUrl={signedLogoUrl}
              canEdit={isAdmin}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
