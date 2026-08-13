import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { getCurrentProfile } from "@/lib/auth/profile";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

/**
 * El middleware ya redirige sin sesión/perfil/activo antes de llegar aquí,
 * pero se vuelve a verificar en el layout (defensa en profundidad, y
 * porque de aquí sale el role/name que necesitan Sidebar/Topbar). Nunca
 * hay que asumir acceso solo porque existe una sesión de Supabase Auth
 * válida — el perfil (user_profiles) es la fuente de verdad de rol/estado.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile || !profile.active) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg">
      <Sidebar role={profile.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar name={profile.name} role={profile.role} email={profile.email} />
        <main className="flex-1 overflow-y-auto scrollbar-thin">{children}</main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
