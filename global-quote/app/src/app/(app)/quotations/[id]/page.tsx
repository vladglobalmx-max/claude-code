import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { quotationScopeWhere } from "@/lib/quotations/scope";

import { AddQuotationItemForm } from "./add-quotation-item-form";
import { removeQuotationItemAction, submitQuotationAction } from "../actions";

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

const currency = (value: number, code: string) =>
  value.toLocaleString("es-MX", { style: "currency", currency: code });

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const role = session.user.role;

  const userBusinessUnits = await prisma.userBusinessUnit.findMany({
    where: { userId: session.user.id },
    select: { businessUnitId: true },
  });
  const businessUnitIds = userBusinessUnits.map((ubu) => ubu.businessUnitId);
  const where = quotationScopeWhere({ role, userId: session.user.id, businessUnitIds });
  if (!where) {
    notFound();
  }

  const quotation = await prisma.quotation.findFirst({
    where: { ...where, id },
    include: {
      businessUnit: { select: { code: true, name: true } },
      customer: { select: { legalName: true, tradeName: true } },
      seller: { select: { fullName: true } },
      items: {
        include: { product: { select: { internalSku: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!quotation) {
    notFound();
  }

  const canManageItems =
    quotation.status === "DRAFT" && hasPermission(role, PERMISSIONS.CREATE_QUOTATION);
  const canViewMarginPct =
    hasPermission(role, PERMISSIONS.VIEW_COSTS) || hasPermission(role, PERMISSIONS.VIEW_MARGIN_PCT);

  let availableProducts: { id: string; internalSku: string; name: string }[] = [];
  if (canManageItems) {
    availableProducts = await prisma.product.findMany({
      where: { businessUnitId: quotation.businessUnitId, status: "ACTIVE", deletedAt: null },
      select: { id: true, internalSku: true, name: true },
      orderBy: { internalSku: "asc" },
    });
  }

  const submitAction = submitQuotationAction.bind(null, quotation.id);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Link href="/quotations" className="text-sm text-zinc-500 hover:underline">
          ← Cotizaciones
        </Link>
        <h1 className="mt-1 font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {quotation.folio}
        </h1>
        <p className="text-sm text-zinc-500">
          {quotation.businessUnit.code} · {quotation.customer.legalName} · Vendedor:{" "}
          {quotation.seller.fullName} · {STATUS_LABELS[quotation.status]}
        </p>
      </div>

      {quotation.requiresApproval ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
          <p className="font-semibold">Requiere autorización</p>
          <p>{quotation.approvalReason}</p>
        </div>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Productos</h2>

        {quotation.items.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Sin productos agregados todavía.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <tr>
                  <th className="py-2 pr-3">Producto</th>
                  <th className="py-2 pr-3">Cant.</th>
                  <th className="py-2 pr-3">Precio</th>
                  <th className="py-2 pr-3">Desc.</th>
                  <th className="py-2 pr-3">Importe</th>
                  {canManageItems ? <th className="py-2 pr-3" /> : null}
                </tr>
              </thead>
              <tbody>
                {quotation.items.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                    <td className="py-2 pr-3">
                      <p className="font-medium">{item.product.name}</p>
                      <p className="font-mono text-xs text-zinc-500">{item.product.internalSku}</p>
                    </td>
                    <td className="py-2 pr-3">{item.qty}</td>
                    <td className="py-2 pr-3">{currency(item.unitPrice.toNumber(), quotation.currency)}</td>
                    <td className="py-2 pr-3">{item.discountPct.toString()}%</td>
                    <td className="py-2 pr-3 font-semibold">
                      {currency(item.lineTotal.toNumber(), quotation.currency)}
                    </td>
                    {canManageItems ? (
                      <td className="py-2 pr-3">
                        <form action={removeQuotationItemAction.bind(null, quotation.id, item.id)}>
                          <button
                            type="submit"
                            className="text-xs text-red-600 hover:underline dark:text-red-400"
                          >
                            Quitar
                          </button>
                        </form>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800 sm:grid-cols-4">
          <div>
            <dt className="text-zinc-500">Subtotal</dt>
            <dd>{currency(quotation.subtotal.toNumber(), quotation.currency)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Descuento</dt>
            <dd>{currency(quotation.discountTotal.toNumber(), quotation.currency)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Total</dt>
            <dd className="font-semibold">{currency(quotation.total.toNumber(), quotation.currency)}</dd>
          </div>
          {canViewMarginPct ? (
            <div>
              <dt className="text-zinc-500">Margen</dt>
              <dd
                className={
                  quotation.requiresApproval
                    ? "font-semibold text-red-600 dark:text-red-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }
              >
                {quotation.marginPct != null ? `${quotation.marginPct.toString()}%` : "—"}
              </dd>
            </div>
          ) : null}
        </dl>

        {canManageItems ? (
          <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <AddQuotationItemForm quotationId={quotation.id} products={availableProducts} />
          </div>
        ) : null}
      </section>

      {quotation.status === "DRAFT" ? (
        <form action={submitAction}>
          <button
            type="submit"
            disabled={quotation.items.length === 0}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {quotation.requiresApproval
              ? "Enviar a autorización de Dirección General"
              : "Enviar cotización"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
