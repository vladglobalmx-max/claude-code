import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma/client";
import {
  importCustomers,
  importProducts,
  ImportMutationError,
  resolveCustomerImportRows,
  resolveProductImportRows,
} from "@/lib/imports/mutations";
import { parseProductImportRows, type ProductImportRow } from "@/lib/imports/products";
import { parseCustomerImportRows, type CustomerImportRow } from "@/lib/imports/customers";

const createdProductIds: string[] = [];
const createdCustomerIds: string[] = [];
const createdImportLogIds: string[] = [];

afterEach(async () => {
  while (createdImportLogIds.length > 0) {
    await prisma.importLog.deleteMany({ where: { id: createdImportLogIds.pop()! } });
  }
  while (createdProductIds.length > 0) {
    const id = createdProductIds.pop()!;
    await prisma.priceListItem.deleteMany({ where: { productId: id } });
    await prisma.productCost.deleteMany({ where: { productId: id } });
    await prisma.product.deleteMany({ where: { id } });
  }
  while (createdCustomerIds.length > 0) {
    await prisma.customer.deleteMany({ where: { id: createdCustomerIds.pop()! } });
  }
});

async function gfb() {
  return prisma.businessUnit.findUniqueOrThrow({ where: { code: "GFB" } });
}

function validProductRecord(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    businessUnitCode: "GFB",
    sku: `GFB-IMPORT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    name: "Producto importado de prueba",
    uom: "PZA",
    categoryName: "Enjuagues bucales",
    purchaseCost: "10",
    logisticsCost: "1",
    importExpenses: "0.5",
    targetMarginPct: "30",
    minMarginPct: "20",
    priceListCode: "GFB-LISTA-GENERAL",
    listPrice: "20",
    ...overrides,
  };
}

function toRows(records: Record<string, string>[]): (ProductImportRow & { rowNumber: number })[] {
  return parseProductImportRows(records).map((result) => {
    if (!result.ok) throw new Error(`fixture inválido: ${result.errors.join(", ")}`);
    return { ...result.data, rowNumber: result.rowNumber };
  });
}

describe("resolveProductImportRows / importProducts (docs/ARCHITECTURE.md §10, Módulo 14)", () => {
  it("creates a product with its cost and price atomically, and writes one import_logs row", async () => {
    const businessUnit = await gfb();
    const sku = `GFB-IMPORT-${Date.now()}`;
    const rows = toRows([validProductRecord({ sku })]);

    const result = await importProducts({
      businessUnitId: businessUnit.id,
      businessUnitCode: "GFB",
      rows,
      fileName: "test-products.csv",
      actorId: (await prisma.user.findUniqueOrThrow({ where: { email: "ana.torres@globalsuppliermty.com" } })).id,
    });

    const product = await prisma.product.findUniqueOrThrow({ where: { internalSku: sku } });
    createdProductIds.push(product.id);
    expect(result.createdCount).toBe(1);
    expect(result.skippedDuplicateCount).toBe(0);

    const cost = await prisma.productCost.findFirstOrThrow({ where: { productId: product.id } });
    expect(cost.landedCost.toString()).toBe("11.5");
    const priceItem = await prisma.priceListItem.findFirstOrThrow({ where: { productId: product.id } });
    expect(priceItem.listPrice.toString()).toBe("20");

    const importLog = await prisma.importLog.findFirstOrThrow({ where: { fileName: "test-products.csv" } });
    createdImportLogIds.push(importLog.id);
    expect(importLog).toMatchObject({ entityType: "PRODUCT", createdCount: 1, skippedDuplicateCount: 0 });
  });

  it("all-or-nothing: a batch with one unresolvable row creates nothing at all", async () => {
    const businessUnit = await gfb();
    const goodSku = `GFB-IMPORT-GOOD-${Date.now()}`;
    const rows = toRows([
      validProductRecord({ sku: goodSku }),
      validProductRecord({ priceListCode: "NO-EXISTE-ESTA-LISTA" }),
    ]);

    await expect(
      importProducts({
        businessUnitId: businessUnit.id,
        businessUnitCode: "GFB",
        rows,
        fileName: "test-products-bad.csv",
        actorId: (await prisma.user.findUniqueOrThrow({ where: { email: "ana.torres@globalsuppliermty.com" } })).id,
      }),
    ).rejects.toThrow(ImportMutationError);

    const product = await prisma.product.findUnique({ where: { internalSku: goodSku } });
    expect(product).toBeNull(); // la fila válida tampoco se aplicó
    const importLog = await prisma.importLog.findFirst({ where: { fileName: "test-products-bad.csv" } });
    expect(importLog).toBeNull(); // ni siquiera la bitácora se escribió
  });

  it("skips a duplicate SKU (already in the database) but still creates the rest of the batch", async () => {
    const businessUnit = await gfb();
    const newSku = `GFB-IMPORT-NEW-${Date.now()}`;
    const rows = toRows([
      validProductRecord({ sku: "GFB-ENJ-001" }), // ya existe en el seed
      validProductRecord({ sku: newSku }),
    ]);

    const result = await importProducts({
      businessUnitId: businessUnit.id,
      businessUnitCode: "GFB",
      rows,
      fileName: "test-products-dup.csv",
      actorId: (await prisma.user.findUniqueOrThrow({ where: { email: "ana.torres@globalsuppliermty.com" } })).id,
    });

    expect(result.createdCount).toBe(1);
    expect(result.skippedDuplicateCount).toBe(1);

    const created = await prisma.product.findUniqueOrThrow({ where: { internalSku: newSku } });
    createdProductIds.push(created.id);
    const importLog = await prisma.importLog.findFirstOrThrow({ where: { fileName: "test-products-dup.csv" } });
    createdImportLogIds.push(importLog.id);
  });

  it("rejects a row whose businessUnitCode does not match the selected business unit", async () => {
    const businessUnit = await gfb();
    const rows = toRows([validProductRecord({ businessUnitCode: "TSS" })]);

    await expect(
      resolveProductImportRows(prisma, { businessUnitId: businessUnit.id, businessUnitCode: "GFB", rows }),
    ).rejects.toThrow(ImportMutationError);
  });
});

function validCustomerRecord(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    businessUnitCode: "GFB",
    legalName: `Cliente Importado ${Math.random().toString(36).slice(2, 8)}`,
    tradeName: "",
    taxId: "",
    industry: "",
    segment: "",
    notes: "",
    ...overrides,
  };
}

function toCustomerRows(records: Record<string, string>[]): (CustomerImportRow & { rowNumber: number })[] {
  return parseCustomerImportRows(records).map((result) => {
    if (!result.ok) throw new Error(`fixture inválido: ${result.errors.join(", ")}`);
    return { ...result.data, rowNumber: result.rowNumber };
  });
}

describe("resolveCustomerImportRows / importCustomers (Módulo 14)", () => {
  it("creates a prospect and writes one import_logs row", async () => {
    const businessUnit = await gfb();
    const legalName = `Cliente Importado ${Date.now()}`;
    const rows = toCustomerRows([validCustomerRecord({ legalName })]);

    const result = await importCustomers({
      businessUnitId: businessUnit.id,
      businessUnitCode: "GFB",
      rows,
      fileName: "test-customers.csv",
      actorId: (await prisma.user.findUniqueOrThrow({ where: { email: "ana.torres@globalsuppliermty.com" } })).id,
    });

    expect(result.createdCount).toBe(1);
    const customer = await prisma.customer.findFirstOrThrow({ where: { legalName } });
    createdCustomerIds.push(customer.id);
    expect(customer.status).toBe("PROSPECT");
    expect(customer.assignedSellerId).toBeNull();

    const importLog = await prisma.importLog.findFirstOrThrow({ where: { fileName: "test-customers.csv" } });
    createdImportLogIds.push(importLog.id);
    expect(importLog.entityType).toBe("CUSTOMER");
  });

  it("skips a duplicate legal name within the same business unit but still creates the rest", async () => {
    const businessUnit = await gfb();
    const existing = await prisma.customer.findFirstOrThrow({
      where: { businessUnitId: businessUnit.id, legalName: { contains: "Higiene del Norte" } },
    });
    const newLegalName = `Cliente Importado ${Date.now()}`;
    const rows = toCustomerRows([
      validCustomerRecord({ legalName: existing.legalName }),
      validCustomerRecord({ legalName: newLegalName }),
    ]);

    const result = await importCustomers({
      businessUnitId: businessUnit.id,
      businessUnitCode: "GFB",
      rows,
      fileName: "test-customers-dup.csv",
      actorId: (await prisma.user.findUniqueOrThrow({ where: { email: "ana.torres@globalsuppliermty.com" } })).id,
    });

    expect(result.createdCount).toBe(1);
    expect(result.skippedDuplicateCount).toBe(1);

    const created = await prisma.customer.findFirstOrThrow({ where: { legalName: newLegalName } });
    createdCustomerIds.push(created.id);
    const importLog = await prisma.importLog.findFirstOrThrow({ where: { fileName: "test-customers-dup.csv" } });
    createdImportLogIds.push(importLog.id);
  });

  it("rejects a row whose businessUnitCode does not match the selected business unit", async () => {
    const businessUnit = await gfb();
    const rows = toCustomerRows([validCustomerRecord({ businessUnitCode: "TSS" })]);

    await expect(
      resolveCustomerImportRows(prisma, { businessUnitId: businessUnit.id, businessUnitCode: "GFB", rows }),
    ).rejects.toThrow(ImportMutationError);
  });
});
