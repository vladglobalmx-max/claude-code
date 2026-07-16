import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { auditVisibleEntityTypes } from "@/lib/audit/scope";
import type { Prisma } from "@/generated/prisma/client";

const ALL_ENTITY_TYPES = ["Customer", "Product"] as const;

const ENTITY_TYPE_LABELS: Record<string, string> = {
  Customer: "Cliente",
  Product: "Producto",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Alta",
  UPDATE: "Cambio",
  DELETE: "Baja",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; userId?: string; from?: string; to?: string }>;
}) {
  const session = await requireSession();
  const role = session.user.role;

  if (!hasPermission(role, PERMISSIONS.VIEW_AUDIT)) {
    redirect("/dashboard?error=forbidden");
  }

  const { entityType, userId, from, to } = await searchParams;

  // docs/ARCHITECTURE.md §4.1: Administración tiene acceso "parcial" — solo
  // a su propio dominio comercial. Se resuelve aquí, no confiando en el
  // <select> del formulario, porque un query param se puede editar a mano.
  const visibleEntityTypes = auditVisibleEntityTypes(role);
  const allowedEntityTypes = visibleEntityTypes ?? ALL_ENTITY_TYPES;
  const entityTypeFilter = entityType && (allowedEntityTypes as readonly string[]).includes(entityType)
    ? entityType
    : undefined;

  const where: Prisma.AuditLogWhereInput = {
    entityType: entityTypeFilter ?? { in: allowedEntityTypes as unknown as string[] },
    ...(userId ? { userId } : {}),
    ...(from || to
      ? {
          occurredAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
          },
        }
      : {}),
  };

  const [logs, users] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { fullName: true } } },
      orderBy: { occurredAt: "desc" },
      take: 200,
    }),
    prisma.user.findMany({ select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Auditoría</h1>
        <p className="text-sm text-zinc-500">
          Módulo 10 — ver docs/ARCHITECTURE.md §5.2/§10. Registro append-only de cambios a campos
          sensibles.
          {visibleEntityTypes ? " Tu rol solo ve auditoría de tu dominio comercial (clientes, productos)." : ""}
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <label className="flex flex-col gap-1 text-sm">
          Entidad
          <select
            name="entityType"
            defaultValue={entityTypeFilter ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Todas</option>
            {allowedEntityTypes.map((type) => (
              <option key={type} value={type}>
                {ENTITY_TYPE_LABELS[type] ?? type}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Usuario
          <select
            name="userId"
            defaultValue={userId ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Todos</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Desde
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Hasta
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Filtrar
        </button>
      </form>

      {logs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
          No hay movimientos de auditoría con estos filtros.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Entidad</th>
                <th className="px-4 py-2">Campo</th>
                <th className="px-4 py-2">Antes</th>
                <th className="px-4 py-2">Después</th>
                <th className="px-4 py-2">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  <td className="px-4 py-2 whitespace-nowrap text-xs text-zinc-500">
                    {log.occurredAt.toLocaleString("es-MX")}
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs">{ENTITY_TYPE_LABELS[log.entityType] ?? log.entityType}</span>
                    <span className="ml-1 text-xs text-zinc-400">({ACTION_LABELS[log.action] ?? log.action})</span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{log.fieldChanged ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-red-600 dark:text-red-400">{log.oldValue ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-emerald-600 dark:text-emerald-400">{log.newValue ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{log.user.fullName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
