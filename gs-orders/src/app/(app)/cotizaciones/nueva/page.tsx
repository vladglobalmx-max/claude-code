import { randomUUID } from "crypto";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getBusinessToday, addDays } from "@/lib/business-date";
import { getCurrentOrganizationTimezone } from "@/lib/auth/organization";
import { getSignedUrls } from "@/lib/storage";
import { fetchAllPages } from "@/lib/products/paginated-fetch";
import { buildBusinessUnitIdsByProduct, type ProductBusinessUnitRow } from "@/lib/products/business-unit-map";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { QuoteForm, type EligibleQuotePair } from "@/components/quotes/quote-form";
import { emptyQuoteForm, type QuoteCatalogProductOption } from "@/components/quotes/types";
import { createQuote } from "../actions";
import type { Customer, ProductCatalogItem } from "@/types/domain";
import { isBusinessUnitAllowedForPerson } from "@/lib/quotes/business-unit-assignment";

export const dynamic = "force-dynamic";

/** Tamaño de página para traer product_catalog/product_business_units completos — ver DECISIÓN en paginated-fetch.ts (max_rows de PostgREST). */
const PRODUCT_CATALOG_PAGE_SIZE = 1000;

type CatalogRow = ProductCatalogItem & { product_types: { name: string } | null };

interface OneOrMany<T> {
  [index: number]: T;
}
function one<T>(value: T | OneOrMany<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : (value as T);
}

interface SequenceJoinRow {
  salesperson_id: string;
  business_unit_id: string;
  salespeople: { name: string; person_id: string | null } | OneOrMany<{ name: string; person_id: string | null }> | null;
  business_units: { name: string } | OneOrMany<{ name: string }> | null;
}

/**
 * ¿Qué Business Units puede elegir un vendedor al crear una Quote? La
 * fuente BASE es salesperson_quote_sequences (activas) — ver Discovery de
 * Q4: sin una fila activa ahí, ni configurar el folio es posible, sin
 * importar person_business_units. SOBRE esa base, THÖREN | ASIGNACIÓN DE
 * BUSINESS UNITS A USUARIOS (0094) agrega un segundo filtro, ADITIVO:
 * si la Person del salesperson tiene 1+ Business Units ACTIVAS asignadas
 * en person_business_units, solo esas quedan elegibles aquí — mismo
 * criterio fallback-safe que el chequeo real en rpc_create_quote (0094):
 * sin ninguna asignación, no se restringe nada. Esto es solo UX — la
 * autoridad real vive en el RPC (requisito 10 del ticket: "aplicar la
 * restricción también en el servidor, no únicamente en el selector
 * visual"), así que aunque este filtro tuviera un hueco, el RPC rechazaría
 * igual cualquier combinación no asignada.
 */
export default async function NuevaCotizacionPage() {
  const profile = await getCurrentProfile();
  const supabase = createSupabaseServerClient();
  const isAdmin = profile?.role === "admin";

  const [{ data: sequencesData }, { data: customersData }, catalogResult, catalogBuResult] = await Promise.all([
    supabase
      .from("salesperson_quote_sequences")
      .select("salesperson_id, business_unit_id, salespeople(name, person_id), business_units(name)")
      .eq("active", true),
    supabase.from("customers").select("*").order("name"),
    // DECISIÓN — fix "FIX SISTÉMICO DE PAGINACIÓN DE PRODUCT CATALOG":
    // sin .range() esto quedaba silenciosamente limitado a max_rows=1,000
    // (PostgREST) — un producto cuyo nombre ordenara después de esa
    // ventana era invisible en el picker del Quote Builder (caso real:
    // GSMJPTAZ078PO / TAZA JANIS). fetchAllPages trae TODO el catálogo
    // activo en páginas de PRODUCT_CATALOG_PAGE_SIZE.
    fetchAllPages<CatalogRow>(
      async (from, to) =>
        await supabase
          .from("product_catalog")
          .select("*, product_types(name)")
          .eq("active", true)
          .order("name", { ascending: true })
          .range(from, to),
      PRODUCT_CATALOG_PAGE_SIZE
    ),
    // Mismo fix — product_business_units también quedaba truncado; con la
    // semántica "0 asociaciones = TODAS las BUs", una asociación real
    // fuera de la ventana visible podía mostrar un producto restringido
    // como si fuera compartido con todas. Orden por (product_id,
    // business_unit_id) = la PK compuesta real (0019) — estable entre
    // páginas.
    fetchAllPages<ProductBusinessUnitRow>(
      async (from, to) =>
        await supabase
          .from("product_business_units")
          .select("product_id, business_unit_id")
          .order("product_id", { ascending: true })
          .order("business_unit_id", { ascending: true })
          .range(from, to),
      PRODUCT_CATALOG_PAGE_SIZE
    ),
  ]);

  if ("error" in catalogResult || "error" in catalogBuResult) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-6 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-danger" />
          <p className="text-sm font-medium text-ink">No se pudo cargar el catálogo completo</p>
          <p className="max-w-sm text-sm text-ink-faint">
            Ocurrió un error leyendo los productos. Intenta recargar la página en unos momentos.
          </p>
        </div>
      </div>
    );
  }

  const allPairsWithPersonId = ((sequencesData ?? []) as unknown as SequenceJoinRow[]).map((row) => ({
    salespersonId: row.salesperson_id,
    salespersonName: one(row.salespeople)?.name ?? "—",
    businessUnitId: row.business_unit_id,
    businessUnitName: one(row.business_units)?.name ?? "—",
    personId: one(row.salespeople)?.person_id ?? null,
  }));

  const preEligiblePairs = isAdmin
    ? allPairsWithPersonId
    : allPairsWithPersonId.filter((pair) => pair.salespersonId === profile?.salespersonId);

  // THÖREN | ASIGNACIÓN DE BUSINESS UNITS A USUARIOS — ver comentario de
  // SequenceJoinRow arriba. ADMIN lee person_business_units directo (su
  // propia RLS ya lo permite, 0017); un VENDEDOR no puede leerla
  // directamente (RLS admin-only), así que usa rpc_list_own_business_units
  // (SECURITY DEFINER, "vista propia", 0094) — nunca acepta un person_id
  // ajeno, solo puede traer la asignación del propio usuario.
  const personIds = [...new Set(preEligiblePairs.map((pair) => pair.personId).filter((id): id is string => !!id))];
  const assignedBusinessUnitIdsByPersonId = new Map<string, string[]>();
  if (isAdmin) {
    if (personIds.length > 0) {
      const { data: assignments } = await supabase
        .from("person_business_units")
        .select("person_id, business_unit_id")
        .in("person_id", personIds)
        .eq("active", true);
      for (const row of assignments ?? []) {
        assignedBusinessUnitIdsByPersonId.set(row.person_id, [
          ...(assignedBusinessUnitIdsByPersonId.get(row.person_id) ?? []),
          row.business_unit_id,
        ]);
      }
    }
  } else if (personIds[0]) {
    const { data: ownAssignments } = await supabase.rpc("rpc_list_own_business_units");
    assignedBusinessUnitIdsByPersonId.set(
      personIds[0],
      (ownAssignments ?? []).map((row) => row.business_unit_id)
    );
  }

  const eligiblePairs: EligibleQuotePair[] = preEligiblePairs
    .filter((pair) =>
      isBusinessUnitAllowedForPerson(
        pair.businessUnitId,
        pair.personId ? assignedBusinessUnitIdsByPersonId.get(pair.personId) ?? [] : []
      )
    )
    .map(({ salespersonId, salespersonName, businessUnitId, businessUnitName }) => ({
      salespersonId,
      salespersonName,
      businessUnitId,
      businessUnitName,
    }));

  if (eligiblePairs.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <PageHeader title="Nueva cotización" />
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="No hay configuración de folio disponible"
            description={
              isAdmin
                ? "No hay ninguna configuración de folio activa en tu organización. Crea una en Configuración → Folios de Cotización."
                : "No tienes una configuración de folio activa. Contacta a un ADMIN para que te asigne un prefijo y Business Unit en Configuración → Folios de Cotización."
            }
            action={
              isAdmin ? (
                <Link href="/configuracion/folios-cotizaciones/nuevo">
                  <Button>Configurar folio</Button>
                </Link>
              ) : undefined
            }
          />
        </Card>
      </div>
    );
  }

  const customers = (customersData ?? []) as Customer[];

  const businessUnitIdsByProduct = buildBusinessUnitIdsByProduct(catalogBuResult.rows);

  const catalogRows = catalogResult.rows;
  const catalogImagePaths = catalogRows.map((p) => p.image_path).filter((p): p is string => !!p);
  const catalogImageUrls = await getSignedUrls("order-media", catalogImagePaths);

  const catalogProducts: QuoteCatalogProductOption[] = catalogRows.map((p) => ({
    id: p.id,
    category: p.category ?? "",
    sku: p.sku,
    name: p.name,
    model: p.model,
    brand: p.brand,
    unit: p.unit,
    productTypeName: p.product_types?.name ?? null,
    defaultPriceMxn: p.default_price_mxn,
    defaultPriceUsd: p.default_price_usd,
    businessUnitIds: businessUnitIdsByProduct.get(p.id) ?? [],
    imagePath: p.image_path,
    imagePreviewUrl: p.image_path ? catalogImageUrls[p.image_path] ?? null : null,
  }));

  const quoteId = randomUUID();
  const [firstPair] = eligiblePairs;
  const timezone = await getCurrentOrganizationTimezone();
  const validUntil = addDays(getBusinessToday(timezone), 15);

  if (!firstPair) {
    // Inalcanzable: eligiblePairs.length === 0 ya retornó arriba. Solo para que TypeScript estreche el tipo.
    return null;
  }

  return (
    <div>
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Nueva cotización</h1>
      </div>
      <QuoteForm
        mode="create"
        quoteId={quoteId}
        eligiblePairs={eligiblePairs}
        customers={customers}
        catalogProducts={catalogProducts}
        initialState={emptyQuoteForm({
          businessUnitId: firstPair.businessUnitId,
          salespersonId: firstPair.salespersonId,
          validUntil,
        })}
        onSubmit={createQuote}
      />
    </div>
  );
}
