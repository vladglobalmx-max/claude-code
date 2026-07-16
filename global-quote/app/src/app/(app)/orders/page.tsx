import Link from "next/link";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { orderScopeWhere } from "@/lib/orders/scope";

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
};

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
};

export default async function OrdersPage() {
  const session = await requireSession();
  const role = session.user.role;

  const userBusinessUnits = await prisma.userBusinessUnit.findMany({
    where: { userId: session.user.id },
    select: { businessUnitId: true },
  });
  const businessUnitIds = userBusinessUnits.map((ubu) => ubu.businessUnitId);

  const where = orderScopeWhere({ role, userId: session.user.id, businessUnitIds });

  const orders = where
    ? await prisma.order.findMany({
        where,
        include: {
          customer: { select: { legalName: true } },
          seller: { select: { fullName: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Pedidos</h1>
        <p className="text-sm text-zinc-500">
          Módulo 12 — ver docs/ARCHITECTURE.md §5.2/§6.1/§10. Un pedido nace al convertir una
          cotización aceptada; conserva su propio folio (serie PED-) y las partidas congeladas al
          momento de la conversión.
        </p>
      </div>

      {where === null ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
          Tu rol no tiene acceso a pedidos.
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
          No hay pedidos en tu alcance todavía.
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
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  <td className="px-4 py-3">
                    <Link
                      href={`/orders/${order.id}`}
                      className="font-mono text-xs font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {order.folio}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{order.customer.legalName}</td>
                  <td className="px-4 py-3 text-zinc-500">{order.seller.fullName}</td>
                  <td className="px-4 py-3">
                    {order.total.toNumber().toLocaleString("es-MX", {
                      style: "currency",
                      currency: order.currency,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[order.status]}`}
                    >
                      {STATUS_LABELS[order.status]}
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
