import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { buildCatalogWorkbook, type CatalogWorkbookRow } from "@/lib/products/catalog-workbook";
import { fetchAllPages } from "@/lib/products/paginated-fetch";

export const dynamic = "force-dynamic";

/** Tamaño de página para exportar product_catalog completo — ver DECISIÓN en paginated-fetch.ts (max_rows de PostgREST). */
const PRODUCT_CATALOG_PAGE_SIZE = 1000;

interface ExportCatalogRow {
  sku: string;
  name: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  unit: string | null;
  default_price_mxn: number | null;
  default_price_usd: number | null;
  active: boolean;
  product_types: { name: string } | null;
  product_business_units: { business_unit_id: string; business_units: { name: string } | null }[] | null;
}

/**
 * Exportar Excel del Catálogo Maestro (Fase 6C) — mismas columnas que la
 * plantilla de importación (IMPORT_HEADERS), para poder editar
 * masivamente y reimportar sin transformar IDs a mano. `/configuracion/*`
 * ya es ADMIN-only vía middleware.ts (ADMIN_ONLY_PREFIXES) — el chequeo
 * de rol aquí es una segunda capa explícita (esta ruta entrega un archivo
 * descargable, no solo una página; defensa en profundidad consistente con
 * "no depender únicamente de ocultar botones", pedido explícito de Fase
 * 6C), no la única barrera real.
 */
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "No tienes permiso para exportar el catálogo." }, { status: 403 });
  }

  const supabase = createSupabaseServerClient();
  // DECISIÓN — fix "FIX SISTÉMICO DE PAGINACIÓN DE PRODUCT CATALOG": sin
  // .range() esto quedaba silenciosamente limitado a max_rows=1,000
  // (PostgREST) — exportar un catálogo >1,000 SKUs producía un archivo
  // incompleto sin ningún error visible. product_business_units viene
  // embebido en el mismo select, así que paginar product_catalog trae
  // también TODAS las asociaciones de Business Unit reales.
  const productsResult = await fetchAllPages<ExportCatalogRow>(
    async (from, to) =>
      await supabase
        .from("product_catalog")
        .select("*, product_types(name), product_business_units(business_unit_id, business_units(name))")
        .order("sku", { ascending: true })
        .range(from, to),
    PRODUCT_CATALOG_PAGE_SIZE
  );

  if ("error" in productsResult) {
    return NextResponse.json({ error: "No se pudo leer el catálogo." }, { status: 500 });
  }

  const rows: CatalogWorkbookRow[] = productsResult.rows.map((p) => {
    const buRows = p.product_business_units ?? [];
    // Lista COMPLETA de nombres — nunca se recorta a la primera. El orden
    // determinístico (por nombre canonicalizado) lo aplica
    // formatBusinessUnitCell (catalog-workbook.ts) al momento de escribir
    // la celda, así exportar → reimportar produce SIEMPRE el mismo texto.
    const businessUnitNames = buRows.map((r) => r.business_units?.name).filter((n): n is string => !!n);

    const currency: "MXN" | "USD" | null = p.default_price_usd != null ? "USD" : p.default_price_mxn != null ? "MXN" : null;
    const basePrice = currency === "USD" ? p.default_price_usd : currency === "MXN" ? p.default_price_mxn : null;

    return {
      sku: p.sku,
      name: p.name,
      description: p.description,
      businessUnitNames,
      productTypeName: p.product_types?.name ?? "",
      brand: p.brand,
      model: p.model,
      unit: p.unit,
      currency,
      basePrice,
      active: p.active,
    };
  });

  const workbook = buildCatalogWorkbook(rows);
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="catalogo-productos.xlsx"`,
    },
  });
}
