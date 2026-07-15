import Link from "next/link";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { projectProduct, type ProductForProjection } from "@/lib/catalog/project";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";

export default async function ProductsPage() {
  const session = await requireSession();
  const role = session.user.role;

  const userBusinessUnits = await prisma.userBusinessUnit.findMany({
    where: { userId: session.user.id },
    select: { businessUnitId: true },
  });
  const businessUnitIds = userBusinessUnits.map((ubu) => ubu.businessUnitId);

  const products = await prisma.product.findMany({
    where: { businessUnitId: { in: businessUnitIds }, deletedAt: null },
    include: {
      businessUnit: { select: { code: true } },
      category: { select: { name: true } },
      costs: { where: { effectiveTo: null }, take: 1 },
      priceListItems: { take: 1, orderBy: { createdAt: "asc" } },
    },
    orderBy: { internalSku: "asc" },
  });

  const canViewCosts = hasPermission(role, PERMISSIONS.VIEW_COSTS);
  const canViewMarginPct = canViewCosts || hasPermission(role, PERMISSIONS.VIEW_MARGIN_PCT);
  const canManageProducts = hasPermission(role, PERMISSIONS.MANAGE_PRODUCTS) && canViewCosts;

  const rows = products.map((product) => {
    const cost = product.costs[0];
    const priceListItem = product.priceListItems[0];

    const forProjection: ProductForProjection = {
      id: product.id,
      internalSku: product.internalSku,
      name: product.name,
      shortDescription: product.shortDescription,
      uom: product.uom,
      status: product.status,
      categoryName: product.category?.name ?? null,
      listPrice: priceListItem ? priceListItem.listPrice.toNumber() : null,
      landedCost: cost ? cost.landedCost.toNumber() : null,
      minMarginPct: cost ? cost.minMarginPct.toNumber() : null,
    };

    return { businessUnitCode: product.businessUnit.code, ...projectProduct(forProjection, role) };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Productos · Precios
          </h1>
          <p className="text-sm text-zinc-500">
            Catálogo de tus líneas de negocio asignadas. Módulo 3 (alcance básico) — ver
            docs/ARCHITECTURE.md §6/§7/§8.
          </p>
        </div>
        {canManageProducts ? (
          <Link
            href="/products/new"
            className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            + Nuevo producto
          </Link>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
          No hay productos en tus líneas de negocio asignadas todavía.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Línea</th>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Precio de lista</th>
                {canViewCosts ? <th className="px-4 py-3">Costo aterrizado</th> : null}
                {canViewMarginPct ? <th className="px-4 py-3">Margen</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">{row.internalSku}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                    {row.businessUnitCode}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/products/${row.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{row.categoryName ?? "—"}</td>
                  <td className="px-4 py-3">
                    {row.listPrice != null
                      ? row.listPrice.toLocaleString("es-MX", {
                          style: "currency",
                          currency: "MXN",
                        })
                      : "Sin precio vigente"}
                  </td>
                  {canViewCosts ? (
                    <td className="px-4 py-3">
                      {row.landedCost != null
                        ? row.landedCost.toLocaleString("es-MX", {
                            style: "currency",
                            currency: "MXN",
                          })
                        : "—"}
                    </td>
                  ) : null}
                  {canViewMarginPct ? (
                    <td className="px-4 py-3">
                      {row.marginPct != null ? (
                        <span
                          className={
                            row.belowMinMargin
                              ? "font-semibold text-red-600 dark:text-red-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }
                          title={
                            row.belowMinMargin
                              ? "Por debajo del margen mínimo — requeriría autorización de Dirección General (docs/ARCHITECTURE.md §8.2)"
                              : undefined
                          }
                        >
                          {row.marginPct.toFixed(2)}%{row.belowMinMargin ? " ⚠" : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
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
