import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { computeMarginPctFromSalePrice } from "@/lib/catalog/margin";

const currency = (value: number) =>
  value.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default async function ProductDetailPage({
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

  const product = await prisma.product.findFirst({
    where: { id, businessUnitId: { in: businessUnitIds }, deletedAt: null },
    include: {
      businessUnit: { select: { code: true, name: true } },
      category: { select: { name: true } },
      costs: { orderBy: { effectiveFrom: "desc" } },
      priceListItems: { include: { priceList: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!product) {
    notFound();
  }

  const canViewCosts = hasPermission(role, PERMISSIONS.VIEW_COSTS);
  const currentCost = product.costs.find((cost) => cost.effectiveTo === null);
  const currentPriceItem = product.priceListItems[0];
  const listPrice = currentPriceItem?.listPrice.toNumber() ?? null;

  const canManageProducts = hasPermission(role, PERMISSIONS.MANAGE_PRODUCTS) && canViewCosts;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/products" className="text-sm text-zinc-500 hover:underline">
            ← Productos
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {product.name}
          </h1>
          <p className="text-sm text-zinc-500">
            {product.businessUnit.code} · {product.businessUnit.name} · SKU {product.internalSku}
          </p>
        </div>
        {canManageProducts ? (
          <Link
            href={`/products/${product.id}/edit`}
            className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Editar
          </Link>
        ) : null}
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Información comercial
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-zinc-500">Categoría</dt>
            <dd>{product.category?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Unidad de medida</dt>
            <dd>{product.uom}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Estatus</dt>
            <dd>{product.status}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Precio de lista vigente</dt>
            <dd>{listPrice != null ? currency(listPrice) : "Sin precio vigente"}</dd>
          </div>
        </dl>
        {product.shortDescription ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            {product.shortDescription}
          </p>
        ) : null}
      </section>

      {canViewCosts ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Costos y márgenes
          </h2>
          {currentCost ? (
            <>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-zinc-500">Costo de compra</dt>
                  <dd>{currency(currentCost.purchaseCost.toNumber())}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Logística</dt>
                  <dd>{currency(currentCost.logisticsCost.toNumber())}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Importación</dt>
                  <dd>{currency(currentCost.importExpenses.toNumber())}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Costo aterrizado</dt>
                  <dd className="font-semibold">{currency(currentCost.landedCost.toNumber())}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Margen objetivo</dt>
                  <dd>{currentCost.targetMarginPct.toString()}%</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Margen mínimo</dt>
                  <dd>{currentCost.minMarginPct.toString()}%</dd>
                </div>
                {listPrice != null ? (
                  <div>
                    <dt className="text-zinc-500">Margen real (precio de lista)</dt>
                    <dd>
                      {computeMarginPctFromSalePrice({
                        landedCost: currentCost.landedCost.toNumber(),
                        salePrice: listPrice,
                      })
                        .toDecimalPlaces(2)
                        .toString()}
                      %
                    </dd>
                  </div>
                ) : null}
              </dl>

              {product.costs.length > 1 ? (
                <>
                  <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Historial de vigencias
                  </h3>
                  <ul className="mt-2 flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {product.costs.map((cost) => (
                      <li key={cost.id}>
                        {cost.effectiveFrom.toLocaleDateString("es-MX")} –{" "}
                        {cost.effectiveTo ? cost.effectiveTo.toLocaleDateString("es-MX") : "vigente"}
                        : costo aterrizado {currency(cost.landedCost.toNumber())}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">
              Este producto no tiene un costo vigente — no debería poder cotizarse
              (docs/ARCHITECTURE.md §8.2).
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
