import "server-only";

import { prisma } from "@/lib/prisma/client";
import { computeLandedCost } from "@/lib/catalog/margin";
import type { Currency, ProductStatus, ProductType } from "@/generated/prisma/enums";
import { diffSensitiveFields, recordAuditLog } from "@/lib/audit/log";

const PRODUCT_COST_SENSITIVE_FIELDS = ["landedCost", "minMarginPct"] as const;

export type ProductCommercialInput = {
  businessUnitId: string;
  categoryId: string | null;
  internalSku: string;
  name: string;
  shortDescription: string | null;
  uom: string;
  status: ProductStatus;
};

export type ProductCostInput = {
  purchaseCost: number;
  logisticsCost: number;
  importExpenses: number;
  targetMarginPct: number;
  minMarginPct: number;
};

export type PriceListItemInput = {
  priceListId: string;
  listPrice: number;
};

/**
 * Crea un producto con su primera vigencia de costo y su primer precio de
 * lista en una sola transaccion. Es la unica forma de dar de alta un
 * producto: no existe un producto sin costo ni sin precio (docs/ARCHITECTURE.md §8.2).
 */
export async function createProductWithCostAndPrice(input: {
  product: ProductCommercialInput;
  cost: ProductCostInput;
  price: PriceListItemInput;
  actorId: string;
}) {
  const landedCost = computeLandedCost(input.cost);

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        businessUnitId: input.product.businessUnitId,
        categoryId: input.product.categoryId,
        internalSku: input.product.internalSku,
        name: input.product.name,
        shortDescription: input.product.shortDescription,
        uom: input.product.uom,
        status: input.product.status,
      },
    });

    await tx.productCost.create({
      data: {
        productId: product.id,
        purchaseCost: input.cost.purchaseCost,
        logisticsCost: input.cost.logisticsCost,
        importExpenses: input.cost.importExpenses,
        landedCost: landedCost.toNumber(),
        targetMarginPct: input.cost.targetMarginPct,
        minMarginPct: input.cost.minMarginPct,
        createdBy: input.actorId,
      },
    });

    await tx.priceListItem.create({
      data: {
        priceListId: input.price.priceListId,
        productId: product.id,
        listPrice: input.price.listPrice,
      },
    });

    return product;
  });
}

export async function updateProductCommercialInfo(
  productId: string,
  data: Omit<ProductCommercialInput, "businessUnitId" | "internalSku">,
) {
  return prisma.product.update({
    where: { id: productId },
    data: {
      categoryId: data.categoryId,
      name: data.name,
      shortDescription: data.shortDescription,
      uom: data.uom,
      status: data.status,
    },
  });
}

/**
 * Cierra la vigencia de costo actual (effective_to = ahora) y crea una nueva
 * vigencia abierta. Nunca se edita un costo en el lugar: cada cambio queda en
 * el historial (docs/ARCHITECTURE.md §5.2/§7.3).
 */
export async function replaceProductCost(input: {
  productId: string;
  cost: ProductCostInput;
  actorId: string;
}) {
  const landedCost = computeLandedCost(input.cost);

  return prisma.$transaction(async (tx) => {
    const previousCost = await tx.productCost.findFirst({
      where: { productId: input.productId, effectiveTo: null },
    });

    const now = new Date();
    await tx.productCost.updateMany({
      where: { productId: input.productId, effectiveTo: null },
      data: { effectiveTo: now },
    });

    const newCost = await tx.productCost.create({
      data: {
        productId: input.productId,
        purchaseCost: input.cost.purchaseCost,
        logisticsCost: input.cost.logisticsCost,
        importExpenses: input.cost.importExpenses,
        landedCost: landedCost.toNumber(),
        targetMarginPct: input.cost.targetMarginPct,
        minMarginPct: input.cost.minMarginPct,
        effectiveFrom: now,
        createdBy: input.actorId,
      },
    });

    // El costo/margen es un campo sensible (docs/ARCHITECTURE.md §5.2/§10);
    // a diferencia de las partidas de cotización, aquí no hay un "antes" si
    // es la primera vigencia del producto, así que solo se audita el cambio
    // cuando de verdad reemplaza una vigencia anterior.
    if (previousCost) {
      const changes = diffSensitiveFields(
        { landedCost: previousCost.landedCost.toString(), minMarginPct: previousCost.minMarginPct.toString() },
        { landedCost: newCost.landedCost.toString(), minMarginPct: newCost.minMarginPct.toString() },
        PRODUCT_COST_SENSITIVE_FIELDS,
      );
      for (const change of changes) {
        await recordAuditLog(tx, {
          entityType: "Product",
          entityId: input.productId,
          userId: input.actorId,
          action: "UPDATE",
          fieldChanged: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
        });
      }
    }

    return newCost;
  });
}

export async function upsertPriceListItem(input: {
  productId: string;
  priceListId: string;
  listPrice: number;
}) {
  return prisma.priceListItem.upsert({
    where: { priceListId_productId: { priceListId: input.priceListId, productId: input.productId } },
    update: { listPrice: input.listPrice },
    create: {
      priceListId: input.priceListId,
      productId: input.productId,
      listPrice: input.listPrice,
    },
  });
}

export type { Currency, ProductStatus, ProductType };
