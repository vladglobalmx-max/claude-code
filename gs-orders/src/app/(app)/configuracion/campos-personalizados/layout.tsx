import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";

/** Admin-only estricto, mismo criterio que tipos-producto/layout.tsx — configuración de negocio, fuera del alcance de can_manage_users (0046). */
export default async function CamposPersonalizadosLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile || !profile.active || profile.role !== "admin") {
    redirect("/pedidos");
  }

  return <>{children}</>;
}
