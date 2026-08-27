/**
 * Utilidad de paginación genérica — pura, sin Supabase/red, para poder
 * probar el loop de páginas sin mockear el query builder completo.
 *
 * DECISIÓN — por qué existe: PostgREST limita silenciosamente cualquier
 * `select` sin paginación a `max_rows` (1,000, ver supabase/config.toml) —
 * sin error, HTTP 200 normal. `getProductImportCandidates()`
 * (configuracion/catalogo/importar/actions.ts) usaba un `select` sin
 * `.range()` sobre `product_catalog`; con más de 1,000 productos en la
 * organización, los productos fuera de esa ventana eran invisibles para
 * `classifyProductRows`, que los clasificaba como "new" en vez de
 * "update" — al intentar el INSERT chocaban con
 * `product_catalog_org_sku_unique` (ver auditoría "AUDITORÍA DIRIGIDA DEL
 * ERROR DE IMPORTACIÓN"). Esta utilidad trae TODO el catálogo mediante
 * páginas explícitas de `pageSize`, sin depender de `max_rows`.
 */
export interface PageFetchResult<T> {
  data: T[] | null;
  error: unknown;
}

export type FetchAllPagesResult<T> = { rows: T[] } | { error: unknown };

/**
 * Llama `fetchPage(from, to)` secuencialmente (rango inclusivo, mismo
 * criterio que `.range()` de PostgREST) hasta que una página devuelva
 * menos de `pageSize` filas. Un error en CUALQUIER página detiene la
 * carga de inmediato — nunca devuelve un catálogo parcial en silencio.
 * (Nota: para un total exactamente múltiplo de `pageSize`, la última
 * página real llega con `pageSize` filas exactas, así que se hace UNA
 * llamada adicional que devuelve 0 filas para confirmar el fin — mismo
 * criterio "detener cuando la página devuelva menos de pageSize filas".)
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<PageFetchResult<T>>,
  pageSize: number
): Promise<FetchAllPagesResult<T>> {
  if (pageSize <= 0) throw new Error("pageSize debe ser mayor a 0");

  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) return { error };

    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return { rows };
}
