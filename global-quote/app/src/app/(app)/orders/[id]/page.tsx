import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { orderScopeWhere } from "@/lib/orders/scope";

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
};

const currency = (value: number, code: string) =>
  value.toLocaleString("es-MX", { style: "currency", currency: code });

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const role = session.user.role;

  const userBusinessUnits = await prisma.userBusinessUnit.findMany({
    where: { userId: session.user.id },
    select: { businessUnitId: true },
  });
  const businessUnitIds = userBusinessUnits.map((ubu) => ubu.businessUnitId);
  const where = orderScopeWhere({ role, userId: session.user.id, businessUnitIds });
  if (!where) {
    notFound();
  }

  const order = await prisma.order.findFirst({
    where: { ...where, id },
    include: {
      businessUnit: { select: { code: true, name: true } },
      customer: { select: { legalName: true, tradeName: true } },
      seller: { select: { fullName: true } },
      quotation: { select: { id: true, folio: true } },
      items: {
        include: { product: { select: { internalSku: true, name: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!order) {
    notFound();
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Link href="/orders" className="text-sm text-zinc-500 hover:underline">
          ← Pedidos
        </Link>
        <h1 className="mt-1 font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {order.folio}
        </h1>
        <p className="text-sm text-zinc-500">
          {order.businessUnit.code} · {order.customer.legalName} · Vendedor: {order.seller.fullName}{" "}
          · {STATUS_LABELS[order.status]}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Origen:{" "}
          <Link href={`/quotations/${order.quotation.id}`} className="font-mono text-sky-600 hover:underline dark:text-sky-400">
            {order.quotation.folio}
          </Link>
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Productos</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="py-2 pr-3">Producto</th>
                <th className="py-2 pr-3">Cant.</th>
                <th className="py-2 pr-3">Precio</th>
                <th className="py-2 pr-3">Desc.</th>
                <th className="py-2 pr-3">Importe</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  <td className="py-2 pr-3">
                    <p className="font-medium">{item.product.name}</p>
                    <p className="font-mono text-xs text-zinc-500">{item.product.internalSku}</p>
                  </td>
                  <td className="py-2 pr-3">{item.qty}</td>
                  <td className="py-2 pr-3">{currency(item.unitPrice.toNumber(), order.currency)}</td>
                  <td className="py-2 pr-3">{item.discountPct.toString()}%</td>
                  <td className="py-2 pr-3 font-semibold">
                    {currency(item.lineTotal.toNumber(), order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
          <div>
            <dt className="text-zinc-500">Subtotal</dt>
            <dd>{currency(order.subtotal.toNumber(), order.currency)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Descuento</dt>
            <dd>{currency(order.discountTotal.toNumber(), order.currency)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Total</dt>
            <dd className="font-semibold">{currency(order.total.toNumber(), order.currency)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
