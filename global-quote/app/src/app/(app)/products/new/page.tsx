import Link from "next/link";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";

import { NewProductForm } from "./new-product-form";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ businessUnit?: string }>;
}) {
  const session = await requireSession();
  const role = session.user.role;

  if (!hasPermission(role, PERMISSIONS.MANAGE_PRODUCTS) || !hasPermission(role, PERMISSIONS.VIEW_COSTS)) {
    redirect("/dashboard?error=forbidden");
  }

  const { businessUnit: requestedCode } = await searchParams;

  const assignedUnits = await prisma.userBusinessUnit.findMany({
    where: { userId: session.user.id },
    include: {
      businessUnit: {
        include: { priceLists: { where: { active: true }, take: 1 } },
      },
    },
  });

  const unitsWithPriceList = assignedUnits
    .map((assignment) => assignment.businessUnit)
    .filter((unit) => unit.priceLists.length > 0);

  if (unitsWithPriceList.length === 0) {
    return (
      <div className="max-w-xl rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
        Ninguna de tus líneas de negocio tiene una lista de precios activa todavía. Configúrala
        antes de dar de alta productos (Módulo 2).
      </div>
    );
  }

  const selectedUnit =
    unitsWithPriceList.find((unit) => unit.code === requestedCode) ?? unitsWithPriceList[0];
  const priceList = selectedUnit.priceLists[0];

  const categories = await prisma.category.findMany({
    where: { businessUnitId: selectedUnit.id, deletedAt: null },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/products" className="text-sm text-zinc-500 hover:underline">
          ← Productos
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">Nuevo producto</h1>
        {unitsWithPriceList.length > 1 ? (
          <p className="mt-1 text-xs text-zinc-500">
            Línea:{" "}
            {unitsWithPriceList.map((unit, index) => (
              <span key={unit.id}>
                {index > 0 ? " · " : ""}
                <Link
                  href={`/products/new?businessUnit=${unit.code}`}
                  className={
                    unit.id === selectedUnit.id
                      ? "font-semibold text-zinc-900 dark:text-zinc-50"
                      : "hover:underline"
                  }
                >
                  {unit.code}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <NewProductForm
          businessUnitId={selectedUnit.id}
          businessUnitLabel={`${selectedUnit.code} — ${selectedUnit.name}`}
          priceListId={priceList.id}
          priceListLabel={priceList.name}
          categories={categories}
        />
      </div>
    </div>
  );
}
