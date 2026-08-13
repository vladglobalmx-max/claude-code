import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";

/** Guard server-side para /vendedores/* — ver nota en configuracion/layout.tsx. */
export default async function VendedoresLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile || !profile.active || profile.role !== "admin") {
    redirect("/pedidos");
  }

  return <>{children}</>;
}
