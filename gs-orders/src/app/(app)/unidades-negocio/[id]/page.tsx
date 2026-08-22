import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getSignedUrl } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ActiveBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils/cn";
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
 *
 * Aviso "configura folios" (THÖREN Business Units — Crear nuevas, ajuste
 * final): tras crear una Business Unit, `?created=1` llega en la URL
 * (ver business-unit-create-form.tsx) y aquí se detecta EN VIVO si esa BU
 * ya tiene alguna salesperson_quote_sequences activa — nunca se asume.
 * Solo si `created=1` Y no existe ninguna secuencia activa se muestra el
 * aviso con el enlace a la pantalla REAL de Configuración → Folios de
 * Cotización (/configuracion/folios-cotizaciones/nuevo, ya existente, sin
 * cambios). No crea ninguna secuencia, no modifica el motor de folios, no
 * inventa ningún prefijo. Deliberadamente NO persiste más allá de esta
 * visita (sin bandera en DB): visitar la URL sin `?created=1` (ej.
 * volviendo por el listado más tarde) nunca muestra el aviso, aunque la BU
 * siga sin folio — evita una advertencia permanente no solicitada sobre
 * Business Units antiguas que nunca la tuvieron.
 */
export default async function BusinessUnitDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { created?: string };
}) {
  const profile = await getCurrentProfile();
  const supabase = createSupabaseServerClient();

  const { data } = await supabase.from("business_units").select("*").eq("id", params.id).single();
  if (!data) notFound();
  const businessUnit = data as BusinessUnitRow;

  const signedLogoUrl = businessUnit.logo_path ? await getSignedUrl("business-unit-assets", businessUnit.logo_path) : null;

  const isAdmin = profile?.role === "admin";

  let showFolioNotice = false;
  if (isAdmin && searchParams.created === "1") {
    const { count } = await supabase
      .from("salesperson_quote_sequences")
      .select("id", { count: "exact", head: true })
      .eq("business_unit_id", businessUnit.id)
      .eq("active", true);
    showFolioNotice = !count;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <Link href="/unidades-negocio" className="flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          Unidades de Negocio
        </Link>
      </div>

      {showFolioNotice && (
        <div className="mb-6 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <p className="font-medium text-ink">Unidad de negocio creada correctamente.</p>
          <p className="mt-1 text-ink-soft">
            Para utilizar esta unidad en nuevas cotizaciones, configura al menos una secuencia de folio para un
            vendedor.
          </p>
          <Link
            href="/configuracion/folios-cotizaciones/nuevo"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}
          >
            Configurar folios de cotización
          </Link>
        </div>
      )}

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
