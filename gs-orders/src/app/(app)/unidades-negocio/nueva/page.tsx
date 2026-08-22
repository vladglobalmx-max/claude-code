import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { BusinessUnitCreateForm } from "./business-unit-create-form";

export const dynamic = "force-dynamic";

/**
 * Alta de Business Unit (THÖREN Business Units — Crear nuevas,
 * 0026_business_unit_creation.sql). Guard de rol server-side aquí es
 * defensa adicional de UX (evita renderizar un formulario que fallaría al
 * guardar) — la protección real es business_units_insert_admin (0026): un
 * VENDEDOR que llegara a esta URL a mano vería el formulario pero el
 * INSERT sería rechazado por RLS igual, mismo criterio que
 * /cotizaciones/[id]/editar con status !== "borrador".
 */
export default async function NuevaUnidadNegocioPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    redirect("/unidades-negocio");
  }

  return (
    <div>
      <div className="mx-auto max-w-2xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Nueva unidad de negocio</h1>
      </div>
      <BusinessUnitCreateForm />
    </div>
  );
}
