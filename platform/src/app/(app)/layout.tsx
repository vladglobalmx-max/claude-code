import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ROLE_KEYS } from "@/lib/auth/permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Salvaguarda defensiva: si el rol no coincide con el catálogo conocido, tratar como el más restrictivo.
  const role = ROLE_KEYS.includes(user.role) ? user.role : "vendedor";

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar role={role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userName={user.fullName} roleName={roleLabel(role)} />
        <main className="scrollbar-thin flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    superadmin: "Superadministrador",
    director_general: "Director General",
    director_comercial: "Director Comercial",
    vendedor: "Vendedor",
    marketing: "Marketing",
    operaciones: "Operaciones",
    admin_ia: "Administrador de IA",
  };
  return labels[role] ?? role;
}
