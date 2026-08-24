/**
 * Construcción del workbook Excel (.xlsx) del Catálogo Maestro de
 * Productos — compartido entre la plantilla estática
 * (public/plantillas/productos.xlsx, regenerada por
 * scripts/generate-product-template.mjs) y la exportación en vivo
 * (configuracion/catalogo/exportar/route.ts). Mismas columnas en ambos
 * casos — un archivo exportado se puede reimportar sin transformar nada
 * (mismo orden/encabezados que IMPORT_HEADERS, import-parsing.ts).
 *
 * `businessUnitNames`: lista YA resuelta de nombres reales (nunca ids) —
 * `formatBusinessUnitCell` (import-parsing.ts) hace exactamente lo
 * inverso del parser: [] → "TODAS", 1 → el nombre, 2+ → nombres unidos
 * por " | " en orden determinístico — para que exportar → reimportar
 * produzca siempre el mismo texto (y por lo tanto SIN CAMBIOS).
 *
 * server-only en la práctica (usa exceljs, pensado para Node) — nunca se
 * importa desde un Client Component.
 */
import ExcelJS from "exceljs";
import { IMPORT_HEADERS, formatBusinessUnitCell } from "./import-parsing";

export interface CatalogWorkbookRow {
  sku: string;
  name: string;
  description: string | null;
  businessUnitNames: string[];
  productTypeName: string;
  brand: string | null;
  model: string | null;
  unit: string | null;
  currency: "MXN" | "USD" | null;
  basePrice: number | null;
  active: boolean;
}

function addSheet(workbook: ExcelJS.Workbook, rows: CatalogWorkbookRow[]) {
  const sheet = workbook.addWorksheet("Productos");
  sheet.columns = IMPORT_HEADERS.map((header) => ({ header, key: header, width: Math.max(header.length + 2, 16) }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow([
      row.sku,
      row.name,
      row.description ?? "",
      formatBusinessUnitCell(row.businessUnitNames),
      row.productTypeName,
      row.brand ?? "",
      row.model ?? "",
      row.unit ?? "",
      row.currency ?? "",
      row.basePrice ?? "",
      row.active ? "SI" : "NO",
    ]);
  }

  return sheet;
}

/** Workbook con el catálogo real — usado por /configuracion/catalogo/exportar. */
export function buildCatalogWorkbook(rows: CatalogWorkbookRow[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  addSheet(workbook, rows);
  return workbook;
}

/**
 * Workbook de plantilla — encabezados + 2 filas de ejemplo (una con una
 * sola Business Unit, otra con varias separadas por " | ") — usado para
 * regenerar public/plantillas/productos.xlsx.
 */
export function buildTemplateWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  addSheet(workbook, [
    {
      sku: "TP-RT40076-2",
      name: "PROYECTOR SEÑALIZACION LED DUAL",
      description: "Proyector LED 400W doble haz para grúa/montacargas",
      businessUnitNames: ["Thunder LED Lights"],
      productTypeName: "Proyector / GOBO",
      brand: "Thunder LED Lights",
      model: "RT40076-2",
      unit: "pza",
      currency: "USD",
      basePrice: 2341.0,
      active: true,
    },
    {
      sku: "TP-SAFE-100",
      name: "SEÑALIZACIÓN LED DE ADVERTENCIA",
      description: "Compatible con Thunder LED Lights y Thunder Safety Solutions",
      businessUnitNames: ["Thunder LED Lights", "Thunder Safety Solutions"],
      productTypeName: "Equipo de seguridad",
      brand: "Thunder",
      model: "SAFE-100",
      unit: "pza",
      currency: "MXN",
      basePrice: 899.0,
      active: true,
    },
  ]);
  return workbook;
}
