import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, ROLE_LABELS, hasPermission } from "@/lib/auth/permissions";

export default async function DashboardPage() {
  const session = await requireSession();
  const role = session.user.role;

  const businessUnits = await prisma.businessUnit.findMany({
    where: { deletedAt: null },
    orderBy: { code: "asc" },
  });

  const canViewCosts = hasPermission(role, PERMISSIONS.VIEW_COSTS);
  const canViewAudit = hasPermission(role, PERMISSIONS.VIEW_AUDIT);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Bienvenido, {session.user.fullName}
        </h1>
        <p className="text-sm text-zinc-500">
          Rol: {ROLE_LABELS[role]} · Módulo 1 (Cimientos) — login, roles/permisos y líneas de
          negocio.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Líneas de negocio ({businessUnits.length})
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {businessUnits.map((bu) => (
            <li
              key={bu.id}
              className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
            >
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">{bu.code}</p>
              <p className="text-xs text-zinc-500">{bu.name}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Visibilidad de costos y márgenes (RBAC)
        </h2>
        {canViewCosts ? (
          <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
            Tu rol puede ver costos y márgenes monetarios. Estos campos se calcularán en el
            catálogo (Módulo 3).
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">
            Tu rol no tiene permiso para ver costos ni utilidad monetaria — el servidor nunca
            envía esos campos a este usuario (docs/ARCHITECTURE.md §3.1).
          </p>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Auditoría</h2>
        <p className="mt-2 text-sm text-zinc-500">
          {canViewAudit
            ? "Tu rol podrá consultar el registro de auditoría cuando se construya el Módulo 10."
            : "Tu rol no tiene acceso al registro de auditoría."}
        </p>
      </section>
    </div>
  );
}
