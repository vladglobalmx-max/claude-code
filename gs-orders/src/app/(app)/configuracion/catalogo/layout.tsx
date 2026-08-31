import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";

/**
 * THÖREN 6R.1B-4B — guard admin-only ESTRICTO, propio de este subárbol.
 * Antes de esta fase, /configuracion/layout.tsx (el padre) ya era
 * admin-only y bastaba con eso; ahora que el padre se amplió a admin O
 * can_manage_users (para dar paso a /configuracion/usuarios), este
 * subárbol necesita su propio guard para seguir siendo admin-only
 * exclusivo — can_manage_users NUNCA debe llegar hasta aquí (Catálogo de
 * productos es autoridad de negocio, fuera del alcance de 0046).
 */
export default async function CatalogoLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile || !profile.active || profile.role !== "admin") {
    redirect("/pedidos");
  }

  return <>{children}</>;
}
