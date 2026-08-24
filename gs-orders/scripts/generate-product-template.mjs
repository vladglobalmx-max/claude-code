// Regenera public/plantillas/productos.xlsx a partir de
// src/lib/products/catalog-workbook.ts (buildTemplateWorkbook) — mismas
// columnas que usa el importador (IMPORT_HEADERS, import-parsing.ts) y la
// exportación en vivo. Correr con: node --loader ... no aplica (proyecto
// usa Next/TS); se ejecuta vía tsx/ts-node ad hoc, ver invocación en el
// reporte de Fase 6C. No se agrega como npm script porque se corre una
// sola vez por cambio de columnas, no en cada build.
import { buildTemplateWorkbook } from "../src/lib/products/catalog-workbook.ts";
import { fileURLToPath } from "node:url";
import path from "node:path";

const workbook = buildTemplateWorkbook();
const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "plantillas", "productos.xlsx");
await workbook.xlsx.writeFile(outPath);
console.log("Plantilla regenerada:", outPath);
