import Link from "next/link";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { customerScopeWhere } from "@/lib/customers/scope";

const STATUS_LABELS: Record<string, string> = {
  PROSPECT: "Prospecto",
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
};

export default async function CustomersPage() {
  const session = await requireSession();
  const role = session.user.role;

  const userBusinessUnits = await prisma.userBusinessUnit.findMany({
    where: { userId: session.user.id },
    select: { businessUnitId: true },
  });
  const businessUnitIds = userBusinessUnits.map((ubu) => ubu.businessUnitId);

  const where = customerScopeWhere({ role, userId: session.user.id, businessUnitIds });
  const canCreate = hasPermission(role, PERMISSIONS.CREATE_CUSTOMER);
  const canManage = hasPermission(role, PERMISSIONS.MANAGE_CUSTOMERS);

  const customers = where
    ? await prisma.customer.findMany({
        where,
        include: {
          businessUnit: { select: { code: true } },
          assignedSeller: { select: { fullName: true } },
          _count: { select: { contacts: true } },
        },
        orderBy: { legalName: "asc" },
      })
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Clientes · Contactos
          </h1>
          <p className="text-sm text-zinc-500">
            Módulo 4 (alcance básico) — ver docs/ARCHITECTURE.md §11. Alcance limitado a las
            líneas de negocio asignadas
            {hasPermission(role, PERMISSIONS.VIEW_OWN_CUSTOMERS) &&
            !hasPermission(role, PERMISSIONS.VIEW_ALL_CUSTOMERS)
              ? " y a tus clientes asignados"
              : ""}
            .
          </p>
        </div>
        {canCreate ? (
          <Link
            href="/customers/new"
            className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            + Nuevo cliente
          </Link>
        ) : null}
      </div>

      {where === null ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
          Tu rol no tiene acceso a la ficha de clientes.
        </div>
      ) : customers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
          No hay clientes en tu alcance todavía.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3">Razón social</th>
                <th className="px-4 py-3">Línea</th>
                <th className="px-4 py-3">Vendedor asignado</th>
                <th className="px-4 py-3">Estatus</th>
                <th className="px-4 py-3">Contactos</th>
                {canManage ? <th className="px-4 py-3">Descuento autorizado</th> : null}
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {customer.legalName}
                    </Link>
                    {customer.tradeName ? (
                      <p className="text-xs text-zinc-500">{customer.tradeName}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                    {customer.businessUnit.code}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {customer.assignedSeller?.fullName ?? "Sin asignar"}
                  </td>
                  <td className="px-4 py-3">{STATUS_LABELS[customer.status]}</td>
                  <td className="px-4 py-3 text-zinc-500">{customer._count.contacts}</td>
                  {canManage ? (
                    <td className="px-4 py-3">{customer.authorizedDiscountPct.toString()}%</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
