import Link from "next/link";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { quotationScopeWhere } from "@/lib/quotations/scope";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING_APPROVAL: "Pendiente de autorización",
  SENT: "Enviada",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  EXPIRED: "Vencida",
  CONVERTED_TO_ORDER: "Convertida a pedido",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  PENDING_APPROVAL: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  SENT: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
  ACCEPTED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
  EXPIRED: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  CONVERTED_TO_ORDER: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-400",
};

export default async function QuotationsPage() {
  const session = await requireSession();
  const role = session.user.role;

  const userBusinessUnits = await prisma.userBusinessUnit.findMany({
    where: { userId: session.user.id },
    select: { businessUnitId: true },
  });
  const businessUnitIds = userBusinessUnits.map((ubu) => ubu.businessUnitId);

  const where = quotationScopeWhere({ role, userId: session.user.id, businessUnitIds });
  const canCreate = hasPermission(role, PERMISSIONS.CREATE_QUOTATION);

  const quotations = where
    ? await prisma.quotation.findMany({
        where,
        include: {
          customer: { select: { legalName: true } },
          seller: { select: { fullName: true } },
          businessUnit: { select: { code: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Cotizaciones</h1>
          <p className="text-sm text-zinc-500">
            Módulo 6 (núcleo) — ver docs/ARCHITECTURE.md §6/§8.{" "}
            {hasPermission(role, PERMISSIONS.VIEW_OWN_QUOTATIONS) &&
            !hasPermission(role, PERMISSIONS.VIEW_ALL_QUOTATIONS) &&
            !hasPermission(role, PERMISSIONS.VIEW_TEAM_QUOTATIONS)
              ? "Solo se muestran las tuyas."
              : "Se muestran todas las de tus líneas de negocio."}
          </p>
        </div>
        {canCreate ? (
          <Link
            href="/quotations/new"
            className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            + Nueva cotización
          </Link>
        ) : null}
      </div>

      {where === null ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
          Tu rol no tiene acceso a cotizaciones.
        </div>
      ) : quotations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
          No hay cotizaciones en tu alcance todavía.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3">Folio</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Estatus</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((quotation) => (
                <tr
                  key={quotation.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/quotations/${quotation.id}`}
                      className="font-mono text-xs font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {quotation.folio}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{quotation.customer.legalName}</td>
                  <td className="px-4 py-3 text-zinc-500">{quotation.seller.fullName}</td>
                  <td className="px-4 py-3">
                    {quotation.total.toNumber().toLocaleString("es-MX", {
                      style: "currency",
                      currency: quotation.currency,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[quotation.status]}`}
                    >
                      {STATUS_LABELS[quotation.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
