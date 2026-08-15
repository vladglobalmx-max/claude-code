import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
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

  return (
    <AppShell role={profile.role} name={profile.name} email={profile.email}>
      {children}
    </AppShell>
  );
}
