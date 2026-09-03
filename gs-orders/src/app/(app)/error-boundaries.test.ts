import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * THÖREN 7C — TESTS 9/10 del set de 16: los segmentos principales de /(app)
 * tienen su propio error.tsx (patrón ya establecido, ver pedidos/error.tsx),
 * y ninguno expone texto de error crudo de Postgres/RLS en su copy
 * estático (el único texto que existe en estos archivos es literal, no hay
 * interpolación de mensajes de Supabase).
 */
const APP_DIR = __dirname;

const REQUIRED_SEGMENTS = [
  "compras",
  "inventario",
  "entregas",
  "almacenes",
  "proveedores",
  "configuracion/catalogo",
  "configuracion/tipos-producto",
  "configuracion/folios-cotizaciones",
  // Ya existentes antes de 7C — se re-confirman aquí para que esta prueba
  // sea la referencia única de cobertura, no solo la lista nueva.
  "pedidos",
  "cotizaciones",
  "clientes",
  "personas",
  "vendedores",
  "unidades-negocio",
  "configuracion/usuarios",
];

// Fragmentos que jamás deberían aparecer en el copy ESTÁTICO de un
// error.tsx — indicarían que un mensaje crudo de Postgres/RLS/PostgREST se
// filtró al texto que ve el usuario (no aplica a los props `error`/`reset`
// en sí, que son dinámicos y correctos).
const RAW_DB_ERROR_MARKERS = [
  "row-level security",
  "violates",
  "constraint",
  "relation \"",
  "syntax error",
  "duplicate key",
  "pg_",
  "P0001",
  "23505",
];

describe("error.tsx boundaries (THÖREN 7C)", () => {
  it.each(REQUIRED_SEGMENTS)("%s tiene error.tsx", (segment) => {
    const filePath = path.join(APP_DIR, segment, "error.tsx");
    expect(fs.existsSync(filePath), `Falta ${filePath}`).toBe(true);
  });

  it.each(REQUIRED_SEGMENTS)("%s: copy estático no expone errores DB crudos", (segment) => {
    const filePath = path.join(APP_DIR, segment, "error.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    for (const marker of RAW_DB_ERROR_MARKERS) {
      expect(content.toLowerCase().includes(marker.toLowerCase()), `${segment}/error.tsx menciona "${marker}"`).toBe(
        false
      );
    }
  });

  it.each(REQUIRED_SEGMENTS)("%s: ofrece reintentar (reset)", (segment) => {
    const filePath = path.join(APP_DIR, segment, "error.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content.includes("reset()"), `${segment}/error.tsx no llama reset()`).toBe(true);
  });
});
