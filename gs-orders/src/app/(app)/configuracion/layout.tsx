import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";

/**
 * Guard server-side para TODO /configuracion/* (catálogo, tipos de
 * producto, usuarios). El middleware ya rechaza esta ruta para VENDEDOR,
 * pero se repite aquí como defensa en profundidad a nivel de Server
 * Component — y porque cubre cualquier página nueva que se agregue bajo
 * este árbol sin tener que acordarse de guardarla una por una.
 */
export default async function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile || !profile.active || profile.role !== "admin") {
    redirect("/pedidos");
  }

  return <>{children}</>;
}
