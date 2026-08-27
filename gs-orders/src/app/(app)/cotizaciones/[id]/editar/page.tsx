import { notFound, redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedUrls } from "@/lib/storage";
import { fetchAllPages } from "@/lib/products/paginated-fetch";
import { buildBusinessUnitIdsByProduct, type ProductBusinessUnitRow } from "@/lib/products/business-unit-map";
import { QuoteForm } from "@/components/quotes/quote-form";
import { emptyQuoteItem, type QuoteCatalogProductOption, type QuoteFormState } from "@/components/quotes/types";
import { updateQuote } from "../../actions";
import type { Customer, ProductCatalogItem, Quote, QuoteItem } from "@/types/domain";

export const dynamic = "force-dynamic";

/** Tamaño de página para traer product_catalog/product_business_units completos — ver DECISIÓN en paginated-fetch.ts (max_rows de PostgREST). */
const PRODUCT_CATALOG_PAGE_SIZE = 1000;

type CatalogRow = ProductCatalogItem & { product_types: { name: string } | null };

/**
 * Edición de una Quote — BORRADOR-only. Fuera de "borrador",
 * trg_quote_status_transition (0020_core_quotes.sql) congela el contenido
 * comercial en DB: redirige al detalle antes de renderizar un formulario
 * que fallaría al guardar (mismo criterio que /clientes/[id]/editar para
 * el guard de rol — aquí el guard es de status, no de rol).
 */
export default async function EditarCotizacionPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();

  const [{ data: quoteData }, { data: itemsData }, { data: customersData }, catalogResult, catalogBuResult] =
    await Promise.all([
      supabase.from("quotes").select("*").eq("id", params.id).single(),
      supabase.from("quote_items").select("*").eq("quote_id", params.id).order("position"),
      supabase.from("customers").select("*").order("name"),
      // DECISIÓN — fix "FIX SISTÉMICO DE PAGINACIÓN DE PRODUCT CATALOG": ver
      // cotizaciones/nueva/page.tsx (mismo problema, misma corrección).
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

  if (!quoteData) notFound();
  const quote = quoteData as Quote;

  if (quote.status !== "borrador") {
    redirect(`/cotizaciones/${quote.id}`);
  }

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

  const items = (itemsData ?? []) as QuoteItem[];
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

  const initialState: QuoteFormState = {
    businessUnitId: quote.business_unit_id,
    salespersonId: quote.salesperson_id,
    customerId: quote.customer_id,
    currency: quote.currency,
    taxRate: String(quote.tax_rate),
    globalDiscountPercent: String(quote.global_discount_percent),
    validUntil: quote.valid_until,
    notes: quote.notes ?? "",
    paymentTerms: quote.payment_terms ?? "",
    deliveryTime: quote.delivery_time ?? "",
    customerNotes: quote.customer_notes ?? "",
    warranty: quote.warranty ?? "",
    items:
      items.length > 0
        ? items.map((item) => ({
            key: item.id,
            catalogProductId: item.catalog_product_id,
            model: item.model,
            description: item.description ?? "",
            quantity: item.quantity,
            unitPrice: String(item.unit_price),
            lineDiscountPercent: String(item.line_discount_percent),
            unit: item.unit ?? "",
            customerRequirements: item.customer_requirements ?? "",
          }))
        : [emptyQuoteItem()],
  };

  return (
    <div>
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Editar cotización</h1>
      </div>
      <QuoteForm
        mode="edit"
        quoteId={quote.id}
        folio={quote.folio}
        eligiblePairs={[]}
        businessUnitName={quote.business_unit_name}
        salespersonName={quote.salesperson_name}
        customers={customers}
        catalogProducts={catalogProducts}
        initialState={initialState}
        onSubmit={updateQuote}
      />
    </div>
  );
}
