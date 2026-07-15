import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma/client";
import {
  createProductWithCostAndPrice,
  replaceProductCost,
  updateProductCommercialInfo,
  upsertPriceListItem,
} from "@/lib/catalog/mutations";

const createdProductIds: string[] = [];

afterEach(async () => {
  while (createdProductIds.length > 0) {
    const productId = createdProductIds.pop()!;
    await prisma.priceListItem.deleteMany({ where: { productId } });
    await prisma.productCost.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
  }
});

async function gfbFixtures() {
  const businessUnit = await prisma.businessUnit.findUniqueOrThrow({ where: { code: "GFB" } });
  const priceList = await prisma.priceList.findUniqueOrThrow({
    where: { code: "GFB-LISTA-GENERAL" },
  });
  const actor = await prisma.user.findUniqueOrThrow({
    where: { email: "laura.gonzalez@globalsuppliermty.com" },
  });
  return { businessUnit, priceList, actor };
}

describe("createProductWithCostAndPrice", () => {
  it("creates a product with exactly one open cost vigencia and one price list item", async () => {
    const { businessUnit, priceList, actor } = await gfbFixtures();

    const product = await createProductWithCostAndPrice({
      product: {
        businessUnitId: businessUnit.id,
        categoryId: null,
        internalSku: "TEST-CREATE-001",
        name: "Producto de prueba de creación",
        shortDescription: null,
        uom: "PZA",
        status: "ACTIVE",
      },
      cost: {
        purchaseCost: 20,
        logisticsCost: 1,
        importExpenses: 0,
        targetMarginPct: 35,
        minMarginPct: 25,
      },
      price: { priceListId: priceList.id, listPrice: 32.31 },
      actorId: actor.id,
    });
    createdProductIds.push(product.id);

    const costs = await prisma.productCost.findMany({ where: { productId: product.id } });
    expect(costs).toHaveLength(1);
    expect(costs[0].landedCost.toNumber()).toBe(21);
    expect(costs[0].effectiveTo).toBeNull();

    const priceItems = await prisma.priceListItem.findMany({ where: { productId: product.id } });
    expect(priceItems).toHaveLength(1);
    expect(priceItems[0].listPrice.toNumber()).toBe(32.31);
  });

  it("rejects a duplicate SKU", async () => {
    const { businessUnit, priceList, actor } = await gfbFixtures();
    const sku = "TEST-CREATE-DUP-001";

    const first = await createProductWithCostAndPrice({
      product: {
        businessUnitId: businessUnit.id,
        categoryId: null,
        internalSku: sku,
        name: "Producto original",
        shortDescription: null,
        uom: "PZA",
        status: "ACTIVE",
      },
      cost: { purchaseCost: 10, logisticsCost: 0, importExpenses: 0, targetMarginPct: 30, minMarginPct: 20 },
      price: { priceListId: priceList.id, listPrice: 14.29 },
      actorId: actor.id,
    });
    createdProductIds.push(first.id);

    await expect(
      createProductWithCostAndPrice({
        product: {
          businessUnitId: businessUnit.id,
          categoryId: null,
          internalSku: sku,
          name: "Producto duplicado",
          shortDescription: null,
          uom: "PZA",
          status: "ACTIVE",
        },
        cost: {
          purchaseCost: 10,
          logisticsCost: 0,
          importExpenses: 0,
          targetMarginPct: 30,
          minMarginPct: 20,
        },
        price: { priceListId: priceList.id, listPrice: 14.29 },
        actorId: actor.id,
      }),
    ).rejects.toThrow();
  });
});

describe("replaceProductCost", () => {
  it("closes the previous vigencia and opens a new one, preserving history", async () => {
    const { businessUnit, priceList, actor } = await gfbFixtures();

    const product = await createProductWithCostAndPrice({
      product: {
        businessUnitId: businessUnit.id,
        categoryId: null,
        internalSku: "TEST-REPLACE-COST-001",
        name: "Producto de prueba de recosteo",
        shortDescription: null,
        uom: "PZA",
        status: "ACTIVE",
      },
      cost: { purchaseCost: 10, logisticsCost: 0, importExpenses: 0, targetMarginPct: 30, minMarginPct: 20 },
      price: { priceListId: priceList.id, listPrice: 14.29 },
      actorId: actor.id,
    });
    createdProductIds.push(product.id);

    await replaceProductCost({
      productId: product.id,
      cost: { purchaseCost: 15, logisticsCost: 1, importExpenses: 0, targetMarginPct: 30, minMarginPct: 20 },
      actorId: actor.id,
    });

    const allCosts = await prisma.productCost.findMany({
      where: { productId: product.id },
      orderBy: { createdAt: "asc" },
    });
    expect(allCosts).toHaveLength(2);
    expect(allCosts[0].effectiveTo).not.toBeNull();
    expect(allCosts[1].effectiveTo).toBeNull();
    expect(allCosts[1].landedCost.toNumber()).toBe(16);
  });
});

describe("updateProductCommercialInfo + upsertPriceListItem", () => {
  it("updates name/category/status and the list price without touching cost history", async () => {
    const { businessUnit, priceList, actor } = await gfbFixtures();

    const product = await createProductWithCostAndPrice({
      product: {
        businessUnitId: businessUnit.id,
        categoryId: null,
        internalSku: "TEST-UPDATE-INFO-001",
        name: "Nombre original",
        shortDescription: null,
        uom: "PZA",
        status: "ACTIVE",
      },
      cost: { purchaseCost: 10, logisticsCost: 0, importExpenses: 0, targetMarginPct: 30, minMarginPct: 20 },
      price: { priceListId: priceList.id, listPrice: 14.29 },
      actorId: actor.id,
    });
    createdProductIds.push(product.id);

    await updateProductCommercialInfo(product.id, {
      categoryId: null,
      name: "Nombre actualizado",
      shortDescription: "Nueva descripción",
      uom: "CAJA",
      status: "DISCONTINUED",
    });
    await upsertPriceListItem({ productId: product.id, priceListId: priceList.id, listPrice: 20 });

    const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updated.name).toBe("Nombre actualizado");
    expect(updated.status).toBe("DISCONTINUED");

    const priceItem = await prisma.priceListItem.findFirstOrThrow({
      where: { productId: product.id },
    });
    expect(priceItem.listPrice.toNumber()).toBe(20);

    const costs = await prisma.productCost.findMany({ where: { productId: product.id } });
    expect(costs).toHaveLength(1);
  });
});
