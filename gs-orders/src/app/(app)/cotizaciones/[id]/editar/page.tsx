import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { QuoteForm } from "@/components/quotes/quote-form";
import { emptyQuoteItem, type QuoteCatalogProductOption, type QuoteFormState } from "@/components/quotes/types";
import { updateQuote } from "../../actions";
import type { Customer, ProductCatalogItem, Quote, QuoteItem } from "@/types/domain";

export const dynamic = "force-dynamic";

/**
 * Edición de una Quote — BORRADOR-only. Fuera de "borrador",
 * trg_quote_status_transition (0020_core_quotes.sql) congela el contenido
 * comercial en DB: redirige al detalle antes de renderizar un formulario
 * que fallaría al guardar (mismo criterio que /clientes/[id]/editar para
 * el guard de rol — aquí el guard es de status, no de rol).
 */
export default async function EditarCotizacionPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();

  const [
    { data: quoteData },
    { data: itemsData },
    { data: customersData },
    { data: catalogData },
    { data: catalogBuData },
  ] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", params.id).single(),
    supabase.from("quote_items").select("*").eq("quote_id", params.id).order("position"),
    supabase.from("customers").select("*").order("name"),
    supabase.from("product_catalog").select("*").eq("active", true).order("name"),
    supabase.from("product_business_units").select("product_id, business_unit_id"),
  ]);

  if (!quoteData) notFound();
  const quote = quoteData as Quote;

  if (quote.status !== "borrador") {
    redirect(`/cotizaciones/${quote.id}`);
  }

  const items = (itemsData ?? []) as QuoteItem[];
  const customers = (customersData ?? []) as Customer[];

  const businessUnitIdsByProduct = new Map<string, string[]>();
  for (const row of (catalogBuData ?? []) as { product_id: string; business_unit_id: string }[]) {
    const list = businessUnitIdsByProduct.get(row.product_id) ?? [];
    list.push(row.business_unit_id);
    businessUnitIdsByProduct.set(row.product_id, list);
  }

  const catalogProducts: QuoteCatalogProductOption[] = ((catalogData ?? []) as ProductCatalogItem[]).map((p) => ({
    id: p.id,
    category: p.category,
    sku: p.sku,
    name: p.name,
    defaultPriceMxn: p.default_price_mxn,
    defaultPriceUsd: p.default_price_usd,
    businessUnitIds: businessUnitIdsByProduct.get(p.id) ?? [],
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
