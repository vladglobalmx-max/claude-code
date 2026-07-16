import "server-only";

import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { computeLandedCost } from "@/lib/catalog/margin";
import { detectDuplicateSkus, type ProductImportRow } from "@/lib/imports/products";
import { detectDuplicateCustomers, type CustomerImportRow } from "@/lib/imports/customers";

export class ImportMutationError extends Error {}

export type ResolvedProductRow =
  | { rowNumber: number; sku: string; status: "creatable"; categoryId: string | null; priceListId: string }
  | { rowNumber: number; sku: string; status: "duplicate" }
  | { rowNumber: number; sku: string; status: "error"; message: string };

/**
 * Resuelve cada fila contra la base de datos (categoría/lista de precios
 * por código, duplicados por SKU) sin escribir nada — el mismo cálculo
 * alimenta tanto la vista previa (docs/ARCHITECTURE.md §10, Módulo 14:
 * "vista previa, detección de duplicados") como la importación real, para
 * no tener dos implementaciones del mismo criterio de duplicado/resolución
 * que puedan desalinearse.
 */
export async function resolveProductImportRows(
  client: Prisma.TransactionClient | typeof prisma,
  input: {
    businessUnitId: string;
    businessUnitCode: string;
    rows: (ProductImportRow & { rowNumber: number })[];
  },
): Promise<ResolvedProductRow[]> {
  const mismatched = input.rows.find(
    (row) => row.businessUnitCode.toUpperCase() !== input.businessUnitCode.toUpperCase(),
  );
  if (mismatched) {
    throw new ImportMutationError(
      `Fila ${mismatched.rowNumber}: la línea "${mismatched.businessUnitCode}" no coincide con la línea seleccionada (${input.businessUnitCode}).`,
    );
  }

  const existingProducts = await client.product.findMany({ select: { internalSku: true } });
  const existingSkus = new Set(existingProducts.map((p) => p.internalSku.toUpperCase()));
  const duplicateRowNumbers = new Set(
    detectDuplicateSkus(
      input.rows.map((r) => ({ rowNumber: r.rowNumber, sku: r.sku })),
      existingSkus,
    ).map((d) => d.rowNumber),
  );

  const categories = await client.category.findMany({
    where: { businessUnitId: input.businessUnitId, deletedAt: null },
    select: { id: true, name: true },
  });
  const categoryIdByName = new Map(categories.map((c) => [c.name.toUpperCase(), c.id]));

  const priceLists = await client.priceList.findMany({
    where: { businessUnitId: input.businessUnitId },
    select: { id: true, code: true },
  });
  const priceListIdByCode = new Map(priceLists.map((p) => [p.code.toUpperCase(), p.id]));

  return input.rows.map((row) => {
    if (duplicateRowNumbers.has(row.rowNumber)) {
      return { rowNumber: row.rowNumber, sku: row.sku, status: "duplicate" };
    }

    if (row.categoryName && !categoryIdByName.has(row.categoryName.toUpperCase())) {
      return {
        rowNumber: row.rowNumber,
        sku: row.sku,
        status: "error",
        message: `La categoría "${row.categoryName}" no existe en esta línea de negocio.`,
      };
    }

    const priceListId = priceListIdByCode.get(row.priceListCode.toUpperCase());
    if (!priceListId) {
      return {
        rowNumber: row.rowNumber,
        sku: row.sku,
        status: "error",
        message: `La lista de precios "${row.priceListCode}" no existe en esta línea de negocio.`,
      };
    }

    return {
      rowNumber: row.rowNumber,
      sku: row.sku,
      status: "creatable",
      categoryId: row.categoryName ? (categoryIdByName.get(row.categoryName.toUpperCase()) ?? null) : null,
      priceListId,
    };
  });
}

export type ResolvedCustomerRow =
  | { rowNumber: number; legalName: string; status: "creatable" }
  | { rowNumber: number; legalName: string; status: "duplicate" };

export async function resolveCustomerImportRows(
  client: Prisma.TransactionClient | typeof prisma,
  input: {
    businessUnitId: string;
    businessUnitCode: string;
    rows: (CustomerImportRow & { rowNumber: number })[];
  },
): Promise<ResolvedCustomerRow[]> {
  const mismatched = input.rows.find(
    (row) => row.businessUnitCode.toUpperCase() !== input.businessUnitCode.toUpperCase(),
  );
  if (mismatched) {
    throw new ImportMutationError(
      `Fila ${mismatched.rowNumber}: la línea "${mismatched.businessUnitCode}" no coincide con la línea seleccionada (${input.businessUnitCode}).`,
    );
  }

  const existingCustomers = await client.customer.findMany({
    where: { businessUnitId: input.businessUnitId, deletedAt: null },
    select: { legalName: true, taxId: true },
  });
  const existingKeys = {
    taxIds: new Set(existingCustomers.flatMap((c) => (c.taxId ? [c.taxId.toUpperCase()] : []))),
    legalNames: new Set(existingCustomers.map((c) => c.legalName.toUpperCase())),
  };
  const duplicateRowNumbers = new Set(
    detectDuplicateCustomers(
      input.rows.map((r) => ({
        rowNumber: r.rowNumber,
        businessUnitCode: r.businessUnitCode,
        legalName: r.legalName,
        taxId: r.taxId,
      })),
      existingKeys,
    ).map((d) => d.rowNumber),
  );

  return input.rows.map((row) => ({
    rowNumber: row.rowNumber,
    legalName: row.legalName,
    status: duplicateRowNumbers.has(row.rowNumber) ? "duplicate" : "creatable",
  }));
}

export type ImportRowOutcome = { rowNumber: number; status: "created" | "skipped_duplicate" };

export type ImportResult = {
  totalRows: number;
  createdCount: number;
  skippedDuplicateCount: number;
  rows: ImportRowOutcome[];
};

/**
 * Todo o nada (docs/ARCHITECTURE.md §10, Módulo 14 — "importación con
 * errores no aplica parcialmente"): si `resolveProductImportRows` marca
 * cualquier fila como `error` dentro de esta misma transacción, se lanza
 * antes de crear nada y Postgres revierte el lote completo. Los
 * duplicados (mismo SKU) sí pueden convivir con filas nuevas — se omiten,
 * no bloquean el resto.
 */
export async function importProducts(input: {
  businessUnitId: string;
  businessUnitCode: string;
  rows: (ProductImportRow & { rowNumber: number })[];
  fileName: string;
  actorId: string;
}): Promise<ImportResult> {
  return prisma.$transaction(async (tx) => {
    const resolved = await resolveProductImportRows(tx, input);

    const firstError = resolved.find((r) => r.status === "error");
    if (firstError && firstError.status === "error") {
      throw new ImportMutationError(`Fila ${firstError.rowNumber}: ${firstError.message}`);
    }

    const rowsBySku = new Map(input.rows.map((r) => [r.sku, r]));
    const rowOutcomes: ImportRowOutcome[] = [];
    let createdCount = 0;
    let skippedDuplicateCount = 0;

    for (const resolvedRow of resolved) {
      if (resolvedRow.status === "duplicate") {
        skippedDuplicateCount += 1;
        rowOutcomes.push({ rowNumber: resolvedRow.rowNumber, status: "skipped_duplicate" });
        continue;
      }
      // Ya se lanzó arriba si alguna fila quedó en "error" — para cuando se
      // llega aquí, todo lo que no es duplicado es creatable.
      if (resolvedRow.status === "error") continue;

      const row = rowsBySku.get(resolvedRow.sku)!;
      const landedCost = computeLandedCost(row);

      const product = await tx.product.create({
        data: {
          businessUnitId: input.businessUnitId,
          categoryId: resolvedRow.categoryId,
          internalSku: row.sku,
          name: row.name,
          uom: row.uom,
          status: "ACTIVE",
        },
      });

      await tx.productCost.create({
        data: {
          productId: product.id,
          purchaseCost: row.purchaseCost,
          logisticsCost: row.logisticsCost,
          importExpenses: row.importExpenses,
          landedCost: landedCost.toNumber(),
          targetMarginPct: row.targetMarginPct,
          minMarginPct: row.minMarginPct,
          createdBy: input.actorId,
        },
      });

      await tx.priceListItem.create({
        data: { priceListId: resolvedRow.priceListId, productId: product.id, listPrice: row.listPrice },
      });

      createdCount += 1;
      rowOutcomes.push({ rowNumber: resolvedRow.rowNumber, status: "created" });
    }

    await tx.importLog.create({
      data: {
        entityType: "PRODUCT",
        businessUnitId: input.businessUnitId,
        fileName: input.fileName,
        totalRows: input.rows.length,
        createdCount,
        skippedDuplicateCount,
        actorId: input.actorId,
      },
    });

    return { totalRows: input.rows.length, createdCount, skippedDuplicateCount, rows: rowOutcomes };
  });
}

export async function importCustomers(input: {
  businessUnitId: string;
  businessUnitCode: string;
  rows: (CustomerImportRow & { rowNumber: number })[];
  fileName: string;
  actorId: string;
}): Promise<ImportResult> {
  return prisma.$transaction(async (tx) => {
    const resolved = await resolveCustomerImportRows(tx, input);
    const rowsByNumber = new Map(input.rows.map((r) => [r.rowNumber, r]));

    const rowOutcomes: ImportRowOutcome[] = [];
    let createdCount = 0;
    let skippedDuplicateCount = 0;

    for (const resolvedRow of resolved) {
      if (resolvedRow.status === "duplicate") {
        skippedDuplicateCount += 1;
        rowOutcomes.push({ rowNumber: resolvedRow.rowNumber, status: "skipped_duplicate" });
        continue;
      }

      const row = rowsByNumber.get(resolvedRow.rowNumber)!;
      await tx.customer.create({
        data: {
          businessUnitId: input.businessUnitId,
          legalName: row.legalName,
          tradeName: row.tradeName,
          taxId: row.taxId,
          industry: row.industry,
          segment: row.segment,
          notes: row.notes,
          status: "PROSPECT",
        },
      });

      createdCount += 1;
      rowOutcomes.push({ rowNumber: resolvedRow.rowNumber, status: "created" });
    }

    await tx.importLog.create({
      data: {
        entityType: "CUSTOMER",
        businessUnitId: input.businessUnitId,
        fileName: input.fileName,
        totalRows: input.rows.length,
        createdCount,
        skippedDuplicateCount,
        actorId: input.actorId,
      },
    });

    return { totalRows: input.rows.length, createdCount, skippedDuplicateCount, rows: rowOutcomes };
  });
}
