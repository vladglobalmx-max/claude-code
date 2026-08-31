import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { canManageUsers } from "@/lib/auth/user-management";

/**
 * Guard server-side para TODO /configuracion/* (catálogo, tipos de
 * producto, usuarios). El middleware ya rechaza esta ruta para VENDEDOR (y,
 * desde THÖREN 6R.1B-4B, deja pasar a un titular de can_manage_users
 * ÚNICAMENTE hacia /configuracion y /configuracion/usuarios/* — nunca hacia
 * catálogo/tipos de producto/folios), así que este layout solo necesita
 * repetir esa misma autorización AMPLIA (admin O can_manage_users) como
 * defensa en profundidad a nivel de Server Component: si un no-admin llegó
 * hasta aquí, el middleware ya garantizó que la ruta es una de las
 * permitidas para can_manage_users. La restricción FINA por subruta (que
 * catálogo/tipos de producto/folios sigan siendo admin-only exclusivo) vive
 * en el middleware, no aquí — este layout no tiene acceso limpio al
 * pathname en un Server Component.
 */
export default async function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active) {
    redirect("/pedidos");
  }

  const capabilities = await getCurrentCapabilities(profile.userId);
  if (!canManageUsers(profile, capabilities)) {
    redirect("/pedidos");
  }

  return <>{children}</>;
}
