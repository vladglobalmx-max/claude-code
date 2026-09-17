/**
 * Fix de performance — Configuración/Catálogo. Lógica pura (sin
 * Supabase/Next) de paginación real del listado, extraída para poder
 * probarla igual que filterCatalogRows/fetchAllPages.
 *
 * DECISIÓN — dos rutas de datos en catalog/page.tsx:
 *   - "rápida" (default: sin búsqueda `q` ni filtro `bu`): pagina y filtra
 *     estado/tipo directo en SQL (`.range()` + `.eq()`), solo firma
 *     imágenes de la página actual. Cubre el caso reportado como lento
 *     (abrir/navegar Catálogo sin buscar).
 *   - "lenta" (con `q` y/o `bu`): sigue trayendo el catálogo completo
 *     (fetchAllPages) y filtrando en JS (filterCatalogRows) — la regla de
 *     negocio "Business Unit sin fila propia = compartido con todas" no es
 *     expresable de forma segura en un filtro PostgREST sin una vista/RPC
 *     nueva (fuera de alcance de un fix mínimo); la búsqueda de texto por
 *     `.or()` requeriría escapar manualmente comas/paréntesis del término
 *     para no romper ni manipular el filtro. Ambos casos quedan
 *     documentados como mejora futura, no implementados aquí. Esta ruta
 *     SIGUE beneficiándose del fix de imágenes (solo se firma la página
 *     actual del resultado ya filtrado, nunca todo el resultado).
 */
export const CATALOG_PAGE_SIZE = 50;

export function needsSlowCatalogPath(params: { q?: string; bu?: string }): boolean {
  return Boolean(params.q?.trim()) || Boolean(params.bu);
}

/** Nunca negativo ni fraccionario — cualquier valor inválido/ausente cae a la página 1. */
export function resolveCatalogPageNumber(pageParam: string | undefined): number {
  const n = Number(pageParam);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function catalogPageRange(page: number, pageSize: number = CATALOG_PAGE_SIZE): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function catalogPageCount(totalMatching: number, pageSize: number = CATALOG_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(totalMatching / pageSize));
}

/**
 * Ajuste operativo — "Seleccionar todos los N que coinciden con estos
 * filtros" (bulk deactivate masivo, 0078). V1 deliberadamente acotada:
 * SOLO se ofrece cuando el filtro Estado es "Activo"/omitido (default) Y
 * no hay búsqueda de texto activa. Evita dos discrepancias reales entre
 * lo que el usuario ve contar y lo que en verdad se desactivaría:
 *   - `q`: ILIKE (Postgres, usado por el RPC) no es insensible a acentos
 *     como canonicalize() (JS, usado por la pantalla) — un producto
 *     "México" podría contarse en pantalla pero no coincidir en el RPC.
 *   - Estado "Inactivo"/"Todos": el RPC siempre opera sobre active=true
 *     únicamente; bajo esos filtros el conteo mostrado incluiría
 *     productos que el RPC nunca tocaría (ya inactivos), o sería
 *     directamente engañoso ("Todos" mezcla ambos estados).
 * Business Unit y Tipo de Producto (solos o combinados) sí son seguros —
 * el RPC los replica EXACTAMENTE igual que filterCatalogRows.ts.
 */
export function canOfferSelectAllMatching(params: { q?: string; estado?: string }): boolean {
  const estado = params.estado || "activo";
  return !params.q?.trim() && estado === "activo";
}
