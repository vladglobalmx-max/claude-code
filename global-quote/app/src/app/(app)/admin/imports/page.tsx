import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";

import { ImportForm } from "./import-form";

const PRODUCT_COLUMNS =
  "businessUnitCode, sku, name, uom, categoryName, purchaseCost, logisticsCost, importExpenses, targetMarginPct, minMarginPct, priceListCode, listPrice";
const CUSTOMER_COLUMNS = "businessUnitCode, legalName, tradeName, taxId, industry, segment, notes";

export default async function ImportsPage() {
  const session = await requireSession();
  if (!hasPermission(session.user.role, PERMISSIONS.IMPORT_DATA)) {
    redirect("/dashboard?error=forbidden");
  }

  const businessUnits = await prisma.businessUnit.findMany({
    where: { active: true, deletedAt: null },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Importaciones</h1>
        <p className="text-sm text-zinc-500">
          docs/ARCHITECTURE.md §10, Módulo 14 — importa productos o clientes desde un archivo CSV,
          con vista previa antes de aplicar cualquier cambio.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Columnas esperadas</h2>
        <p className="mt-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
          Productos: {PRODUCT_COLUMNS}
        </p>
        <p className="mt-1 font-mono text-xs text-zinc-600 dark:text-zinc-400">
          Clientes: {CUSTOMER_COLUMNS}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Todas las filas deben pertenecer a la línea de negocio que elijas abajo. Una fila con el
          mismo SKU o el mismo cliente (por RFC o razón social) que uno ya existente se omite, no
          se duplica. Un archivo con cualquier otro error no aplica nada — todo o nada.
        </p>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <ImportForm businessUnits={businessUnits} />
      </section>
    </div>
  );
}
