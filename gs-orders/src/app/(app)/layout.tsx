import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { getCurrentOrganizationName, getDisabledModules } from "@/lib/auth/organization";
import { canManageUsers as canManageUsersGuard } from "@/lib/auth/user-management";
import { canManageCommissions as canManageCommissionsGuard, canViewOwnCommissions as canViewOwnCommissionsGuard } from "@/lib/auth/logistics";
import { resolveAssignedDepartments } from "@/lib/auth/departments";
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
  // THÖREN 7B — nombre real de la organización para el sidebar (ver
  // DECISIÓN en organization.ts). "THÖREN" es el único fallback neutro
  // aceptable si por algún motivo no resuelve — nunca el nombre de un
  // tenant específico.
  const organizationName = (await getCurrentOrganizationName()) ?? "THÖREN";
  // THÖREN 0084 — módulos deshabilitados por la organización activa; oculta
  // las entradas correspondientes del sidebar (la protección real por URL
  // vive en middleware.ts, no aquí — ver DECISIÓN en sidebar.tsx).
  const disabledModules = await getDisabledModules();
  // THÖREN | CONTROL DE ACCESO POR DEPARTAMENTOS — mismo criterio que
  // disabledModules arriba: se resuelve en el servidor y se pasa como
  // array plano (no Set) porque un Set no cruza limpio la frontera
  // server/client component. La protección real por URL vive en
  // middleware.ts (resuelve sus propios departamentos de forma
  // independiente, idéntico criterio vía isModuleAllowedForDepartments) —
  // esto es solo para que el sidebar oculte lo mismo que el servidor ya
  // bloquea, nunca al revés.
  const departments = resolveAssignedDepartments(capabilities);

  return (
    <AppShell
      role={profile.role}
      canManageUsers={canManageUsersGuard(profile, capabilities)}
      canManageCommissions={canManageCommissionsGuard(profile, capabilities)}
      canViewOwnCommissions={canViewOwnCommissionsGuard(profile, capabilities)}
      disabledModules={disabledModules}
      departments={departments}
      name={profile.name}
      email={profile.email}
      organizationName={organizationName}
    >
      {children}
    </AppShell>
  );
}
