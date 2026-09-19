import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";

/**
 * THÖREN 0084 — admin-only estricto, mismo criterio que
 * /configuracion/folios-cotizaciones: can_manage_users (no-admin) llega al
 * hub de /configuracion pero nunca debe entrar aquí. Datos de la
 * organización y módulos habilitados son autoridad exclusiva de Admin.
 */
export default async function OrganizacionLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile || !profile.active || profile.role !== "admin") {
    redirect("/inicio");
  }

  return <>{children}</>;
}
