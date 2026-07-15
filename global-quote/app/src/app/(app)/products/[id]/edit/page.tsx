import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";

import { EditProductForm } from "./edit-product-form";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const role = session.user.role;

  if (!hasPermission(role, PERMISSIONS.MANAGE_PRODUCTS) || !hasPermission(role, PERMISSIONS.VIEW_COSTS)) {
    redirect("/dashboard?error=forbidden");
  }

  const userBusinessUnits = await prisma.userBusinessUnit.findMany({
    where: { userId: session.user.id },
    select: { businessUnitId: true },
  });
  const businessUnitIds = userBusinessUnits.map((ubu) => ubu.businessUnitId);

  const product = await prisma.product.findFirst({
    where: { id, businessUnitId: { in: businessUnitIds }, deletedAt: null },
    include: {
      businessUnit: { include: { priceLists: { where: { active: true }, take: 1 } } },
      costs: { where: { effectiveTo: null }, take: 1 },
      priceListItems: { take: 1, orderBy: { createdAt: "asc" } },
    },
  });

  if (!product) {
    notFound();
  }

  const priceList = product.businessUnit.priceLists[0];
  if (!priceList) {
    notFound();
  }

  const categories = await prisma.category.findMany({
    where: { businessUnitId: product.businessUnitId, deletedAt: null },
    orderBy: { name: "asc" },
  });

  const cost = product.costs[0];
  const priceItem = product.priceListItems[0];

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href={`/products/${product.id}`} className="text-sm text-zinc-500 hover:underline">
          ← {product.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">Editar producto</h1>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <EditProductForm
          productId={product.id}
          businessUnitLabel={`${product.businessUnit.code} — ${product.businessUnit.name}`}
          priceListId={priceList.id}
          priceListLabel={priceList.name}
          categories={categories}
          defaults={{
            categoryId: product.categoryId ?? "",
            name: product.name,
            shortDescription: product.shortDescription ?? "",
            uom: product.uom,
            status: product.status,
            purchaseCost: cost?.purchaseCost.toString() ?? "",
            logisticsCost: cost?.logisticsCost.toString() ?? "0",
            importExpenses: cost?.importExpenses.toString() ?? "0",
            targetMarginPct: cost?.targetMarginPct.toString() ?? "",
            minMarginPct: cost?.minMarginPct.toString() ?? "",
            listPrice: priceItem?.listPrice.toString() ?? "",
          }}
        />
      </div>
    </div>
  );
}
