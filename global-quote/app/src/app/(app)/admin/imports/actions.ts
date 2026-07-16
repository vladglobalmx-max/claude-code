"use server";

import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { csvRowsToRecords, parseCsv } from "@/lib/imports/csv-parse";
import { parseProductImportRows } from "@/lib/imports/products";
import { parseCustomerImportRows } from "@/lib/imports/customers";
import {
  ImportMutationError,
  importCustomers,
  importProducts,
  resolveCustomerImportRows,
  resolveProductImportRows,
} from "@/lib/imports/mutations";

async function requireImporter() {
  const session = await requireSession();
  if (!hasPermission(session.user.role, PERMISSIONS.IMPORT_DATA)) {
    redirect("/dashboard?error=forbidden");
  }
  return session;
}

export type EntityType = "PRODUCT" | "CUSTOMER";

export type PreviewRow = {
  rowNumber: number;
  label: string;
  status: "creatable" | "duplicate" | "error";
  message?: string;
};

export type ImportPreview = {
  entityType: EntityType;
  businessUnitId: string;
  businessUnitCode: string;
  fileName: string;
  csvText: string;
  rows: PreviewRow[];
  creatableCount: number;
  duplicateCount: number;
  errorCount: number;
};

export type PreviewState = { preview: ImportPreview } | { error: string } | undefined;

/**
 * Paso 1 de 2 (vista previa, docs/ARCHITECTURE.md §10 Módulo 14): no
 * escribe nada — solo parsea y resuelve contra la base de datos (SKU/RFC
 * duplicados, categoría/lista de precios por código) para mostrar qué
 * pasaría. El texto crudo del CSV viaja de vuelta en un campo oculto
 * (`csvText`) para que el paso 2 lo vuelva a parsear sin tener que guardar
 * nada en el servidor entre un paso y otro.
 */
export async function previewImportAction(
  _prevState: PreviewState,
  formData: FormData,
): Promise<PreviewState> {
  await requireImporter();

  const entityTypeRaw = formData.get("entityType");
  const businessUnitId = formData.get("businessUnitId");
  const file = formData.get("file");

  if (entityTypeRaw !== "PRODUCT" && entityTypeRaw !== "CUSTOMER") {
    return { error: "Selecciona qué vas a importar." };
  }
  if (typeof businessUnitId !== "string" || businessUnitId === "") {
    return { error: "Selecciona una línea de negocio." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona un archivo CSV." };
  }

  const businessUnit = await prisma.businessUnit.findUnique({ where: { id: businessUnitId } });
  if (!businessUnit) {
    return { error: "Línea de negocio inválida." };
  }

  const csvText = await file.text();
  const records = csvRowsToRecords(parseCsv(csvText));
  if (records.length === 0) {
    return { error: "El archivo no tiene filas de datos (¿solo trae el encabezado?)." };
  }

  try {
    const rows: PreviewRow[] =
      entityTypeRaw === "PRODUCT"
        ? await previewProductRows(records, businessUnitId, businessUnit.code)
        : await previewCustomerRows(records, businessUnitId, businessUnit.code);

    rows.sort((a, b) => a.rowNumber - b.rowNumber);

    return {
      preview: {
        entityType: entityTypeRaw,
        businessUnitId,
        businessUnitCode: businessUnit.code,
        fileName: file.name,
        csvText,
        rows,
        creatableCount: rows.filter((r) => r.status === "creatable").length,
        duplicateCount: rows.filter((r) => r.status === "duplicate").length,
        errorCount: rows.filter((r) => r.status === "error").length,
      },
    };
  } catch (error) {
    if (error instanceof ImportMutationError) return { error: error.message };
    throw error;
  }
}

async function previewProductRows(
  records: Record<string, string>[],
  businessUnitId: string,
  businessUnitCode: string,
): Promise<PreviewRow[]> {
  const parsed = parseProductImportRows(records);
  const okRows = parsed.flatMap((r) => (r.ok ? [{ ...r.data, rowNumber: r.rowNumber }] : []));
  const resolved =
    okRows.length > 0
      ? await resolveProductImportRows(prisma, { businessUnitId, businessUnitCode, rows: okRows })
      : [];
  const resolvedByRow = new Map(resolved.map((r) => [r.rowNumber, r]));

  return parsed.map((r) => {
    if (!r.ok) {
      return { rowNumber: r.rowNumber, label: "—", status: "error", message: r.errors.join(" · ") };
    }
    const resolvedRow = resolvedByRow.get(r.rowNumber)!;
    return {
      rowNumber: r.rowNumber,
      label: resolvedRow.sku,
      status: resolvedRow.status,
      message: resolvedRow.status === "error" ? resolvedRow.message : undefined,
    };
  });
}

async function previewCustomerRows(
  records: Record<string, string>[],
  businessUnitId: string,
  businessUnitCode: string,
): Promise<PreviewRow[]> {
  const parsed = parseCustomerImportRows(records);
  const okRows = parsed.flatMap((r) => (r.ok ? [{ ...r.data, rowNumber: r.rowNumber }] : []));
  const resolved =
    okRows.length > 0
      ? await resolveCustomerImportRows(prisma, { businessUnitId, businessUnitCode, rows: okRows })
      : [];
  const resolvedByRow = new Map(resolved.map((r) => [r.rowNumber, r]));

  return parsed.map((r) => {
    if (!r.ok) {
      return { rowNumber: r.rowNumber, label: "—", status: "error", message: r.errors.join(" · ") };
    }
    const resolvedRow = resolvedByRow.get(r.rowNumber)!;
    return { rowNumber: r.rowNumber, label: resolvedRow.legalName, status: resolvedRow.status };
  });
}

export type ConfirmState = { result: { createdCount: number; skippedDuplicateCount: number; totalRows: number } } | { error: string } | undefined;

/** Paso 2 de 2: vuelve a parsear el mismo CSV (viajó en un campo oculto) y ahora sí escribe, todo o nada. */
export async function confirmImportAction(
  _prevState: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const session = await requireImporter();

  const entityTypeRaw = formData.get("entityType");
  const businessUnitId = formData.get("businessUnitId");
  const businessUnitCode = formData.get("businessUnitCode");
  const fileName = formData.get("fileName");
  const csvText = formData.get("csvText");

  if (
    (entityTypeRaw !== "PRODUCT" && entityTypeRaw !== "CUSTOMER") ||
    typeof businessUnitId !== "string" ||
    typeof businessUnitCode !== "string" ||
    typeof fileName !== "string" ||
    typeof csvText !== "string"
  ) {
    return { error: "La sesión de importación expiró — vuelve a subir el archivo." };
  }

  const records = csvRowsToRecords(parseCsv(csvText));

  try {
    if (entityTypeRaw === "PRODUCT") {
      const parsed = parseProductImportRows(records);
      if (parsed.some((r) => !r.ok)) {
        return { error: "El archivo cambió desde la vista previa — vuelve a subirlo." };
      }
      const rows = parsed.flatMap((r) => (r.ok ? [{ ...r.data, rowNumber: r.rowNumber }] : []));
      const result = await importProducts({
        businessUnitId,
        businessUnitCode,
        rows,
        fileName,
        actorId: session.user.id,
      });
      return { result };
    }

    const parsed = parseCustomerImportRows(records);
    if (parsed.some((r) => !r.ok)) {
      return { error: "El archivo cambió desde la vista previa — vuelve a subirlo." };
    }
    const rows = parsed.flatMap((r) => (r.ok ? [{ ...r.data, rowNumber: r.rowNumber }] : []));
    const result = await importCustomers({
      businessUnitId,
      businessUnitCode,
      rows,
      fileName,
      actorId: session.user.id,
    });
    return { result };
  } catch (error) {
    if (error instanceof ImportMutationError) return { error: error.message };
    throw error;
  }
}
