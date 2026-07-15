import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma/client";
import { computeLandedCost, computeMarginPctFromSalePrice } from "@/lib/catalog/margin";

describe("seeded GFB catalog", () => {
  it("has the 12 demo products with a current (open-ended) cost", async () => {
    const gfb = await prisma.businessUnit.findUniqueOrThrow({ where: { code: "GFB" } });
    const products = await prisma.product.findMany({
      where: { businessUnitId: gfb.id, deletedAt: null },
      include: { costs: { where: { effectiveTo: null } } },
    });

    expect(products.length).toBeGreaterThanOrEqual(12);
    for (const product of products) {
      expect(product.costs).toHaveLength(1);
    }
  });

  it("flags GFB-ENJ-004 as priced below its minimum margin (stale price fixture)", async () => {
    const product = await prisma.product.findUniqueOrThrow({
      where: { internalSku: "GFB-ENJ-004" },
      include: {
        costs: { where: { effectiveTo: null } },
        priceListItems: true,
      },
    });

    const cost = product.costs[0];
    const priceItem = product.priceListItems[0];
    const marginPct = computeMarginPctFromSalePrice({
      landedCost: cost.landedCost.toNumber(),
      salePrice: priceItem.listPrice.toNumber(),
    });

    expect(marginPct.toNumber()).toBeLessThan(cost.minMarginPct.toNumber());
  });
});

describe("product_costs no-overlap constraint (docs/ARCHITECTURE.md §5.3)", () => {
  const sku = "TEST-NO-OVERLAP-001";
  let productId: string;

  beforeAll(async () => {
    const gfb = await prisma.businessUnit.findUniqueOrThrow({ where: { code: "GFB" } });
    const product = await prisma.product.create({
      data: { internalSku: sku, name: "Producto de prueba de vigencias", businessUnitId: gfb.id },
    });
    productId = product.id;

    const landedCost = computeLandedCost({ purchaseCost: 10, logisticsCost: 0, importExpenses: 0 });
    await prisma.productCost.create({
      data: {
        productId,
        purchaseCost: 10,
        landedCost: landedCost.toNumber(),
        targetMarginPct: 30,
        minMarginPct: 20,
      },
    });
  });

  afterAll(async () => {
    await prisma.priceListItem.deleteMany({ where: { productId } });
    await prisma.productCost.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
  });

  it("rejects a second open-ended cost vigencia for the same product", async () => {
    await expect(
      prisma.productCost.create({
        data: {
          productId,
          purchaseCost: 12,
          landedCost: 12,
          targetMarginPct: 30,
          minMarginPct: 20,
        },
      }),
    ).rejects.toThrow();
  });

  it("allows a second vigencia once the first one is closed (effectiveTo set)", async () => {
    const [currentCost] = await prisma.productCost.findMany({
      where: { productId, effectiveTo: null },
    });
    await prisma.productCost.update({
      where: { id: currentCost.id },
      data: { effectiveTo: new Date() },
    });

    await expect(
      prisma.productCost.create({
        data: {
          productId,
          purchaseCost: 12,
          landedCost: 12,
          targetMarginPct: 30,
          minMarginPct: 20,
        },
      }),
    ).resolves.toBeDefined();
  });
});
