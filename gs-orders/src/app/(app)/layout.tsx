import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { canManageUsers as canManageUsersGuard } from "@/lib/auth/user-management";
import { AppShell } from "@/components/layout/app-shell";

/**
 * El middleware ya redirige sin sesión/perfil/activo antes de llegar aquí,
 * pero se vuelve a verificar en el layout (defensa en profundidad, y
 * porque de aquí sale el role/name que necesita AppShell). Nunca hay que
 * asumir acceso solo porque existe una sesión de Supabase Auth válida — el
 * perfil (user_profiles) es la fuente de verdad de rol/estado.
 *
 * AppShell (client component) es dueño del estado de colapso/drawer del
 * sidebar — este layout se queda como server component para poder leer
 * getCurrentProfile() sin filtrar la sesión al cliente.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile || !profile.active) {
    redirect("/login");
  }

  // THÖREN 6R.1B-4B — una sola carga de capabilities por request, reutilizada
  // solo para decidir si el Sidebar muestra la entrada de Configuración a un
  // titular de can_manage_users no-admin (UX; la autorización real vive en
  // middleware.ts/layouts de servidor, no aquí).
  const capabilities = await getCurrentCapabilities(profile.userId);

  return (
    <AppShell role={profile.role} canManageUsers={canManageUsersGuard(profile, capabilities)} name={profile.name} email={profile.email}>
      {children}
    </AppShell>
  );
}
