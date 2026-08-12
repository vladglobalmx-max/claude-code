import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { roleHasPermission } from "@/lib/auth/permissions";

const ADMIN_TABS = [
  { href: "/admin/users", label: "Usuarios", permission: "manage_users" as const },
  { href: "/admin/roles", label: "Roles", permission: "manage_roles" as const },
  { href: "/admin/agents", label: "Agentes", permission: "manage_agents" as const },
  { href: "/admin/tools", label: "Herramientas", permission: "manage_tools" as const },
  { href: "/admin/prompts", label: "Prompts", permission: "manage_prompts" as const },
  { href: "/admin/audit", label: "Auditoría", permission: "view_audit" as const },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const visibleTabs = ADMIN_TABS.filter((tab) => roleHasPermission(user.role, tab.permission));
  if (visibleTabs.length === 0) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Administración</h1>
        <p className="text-sm text-ink-faint">Solo visible para Superadministrador y Administrador de IA, según sección.</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {visibleTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="border-b-2 border-transparent px-3 py-2 text-sm text-ink-soft hover:border-accent hover:text-ink"
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}
