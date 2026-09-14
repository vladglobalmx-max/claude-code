import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canWriteRecord } from "@/lib/auth/ownership";
import { SalesOrderForm } from "@/components/sales-orders/sales-order-form";
import { emptySalesOrderItem, type SalesOrderCatalogProductOption, type SalesOrderFormState } from "@/components/sales-orders/types";
import { updateSalesOrder } from "../../actions";
import type { Customer, SalesOrder, SalesOrderItem } from "@/types/domain";

export const dynamic = "force-dynamic";

/**
 * Edición de una Sales Order — DRAFT-only. Fuera de "draft",
 * trg_sales_order_status_transition (0067_sales_orders_mvp.sql) congela el
 * contenido comercial en DB: redirige al detalle antes de renderizar un
 * formulario que fallaría al guardar (mismo criterio que
 * /cotizaciones/[id]/editar).
 */
export default async function EditarOrdenVentaPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  const supabase = createSupabaseServerClient();

  const [{ data: soData }, { data: itemsData }, { data: customersData }, { data: salespersonData }, { data: catalogData }] =
    await Promise.all([
      supabase.from("sales_orders").select("*").eq("id", params.id).single(),
      supabase.from("sales_order_items").select("*").eq("sales_order_id", params.id).order("position"),
      supabase.from("customers").select("*").eq("active", true).order("name"),
      supabase.from("sales_orders").select("salesperson_id, salespeople(name)").eq("id", params.id).maybeSingle(),
      supabase
        .from("product_catalog")
        .select("id, sku, name, unit, default_price_mxn, default_price_usd")
        .eq("active", true)
        .order("name"),
    ]);

  if (!soData) notFound();
  const salesOrder = soData as SalesOrder;

  if (salesOrder.status !== "draft") {
    redirect(`/ordenes-venta/${salesOrder.id}`);
  }

  // No basta con ocultar el link "Editar": can_view_all_sales permite que
  // este SELECT cargue para una Sales Order ajena — hay que bloquear el
  // formulario ANTES de renderizarlo, no solo confiar en que
  // updateSalesOrder falle al guardar (mismo criterio que Quotes).
  if (!canWriteRecord(profile, salesOrder.salesperson_id)) {
    redirect(`/ordenes-venta/${salesOrder.id}`);
  }

  const items = (itemsData ?? []) as SalesOrderItem[];
  const customers = (customersData ?? []) as Customer[];
  const catalogProducts: SalesOrderCatalogProductOption[] = (catalogData ?? []).map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    defaultPriceMxn: p.default_price_mxn,
    defaultPriceUsd: p.default_price_usd,
  }));

  interface SalespersonJoinRow {
    salespeople: { name: string } | { name: string }[] | null;
  }
  const joined = salespersonData as unknown as SalespersonJoinRow | null;
  const salespersonJoin = Array.isArray(joined?.salespeople) ? joined?.salespeople[0] : joined?.salespeople;
  const salespersonName = salespersonJoin?.name ?? "—";

  const initialState: SalesOrderFormState = {
    customerId: salesOrder.customer_id,
    salespersonId: salesOrder.salesperson_id,
    currency: salesOrder.currency,
    exchangeRate: salesOrder.exchange_rate != null ? String(salesOrder.exchange_rate) : "",
    paymentTerms: salesOrder.payment_terms ?? "",
    requestedDeliveryDate: salesOrder.requested_delivery_date ?? "",
    commercialNotes: salesOrder.commercial_notes ?? "",
    internalNotes: salesOrder.internal_notes ?? "",
    items:
      items.length > 0
        ? items.map((item) => ({
            key: item.id,
            catalogProductId: item.catalog_product_id,
            skuSnapshot: item.sku_snapshot,
            descriptionSnapshot: item.description_snapshot ?? "",
            uomSnapshot: item.uom_snapshot ?? "",
            quantity: item.quantity,
            unitPrice: String(item.unit_price),
            discount: String(item.discount),
            tax: String(item.tax),
          }))
        : [emptySalesOrderItem()],
  };

  return (
    <div>
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Editar Sales Order</h1>
      </div>
      <SalesOrderForm
        mode="edit"
        salesOrderId={salesOrder.id}
        orderNumber={salesOrder.order_number}
        isAdmin={profile?.role === "admin"}
        salespeople={[]}
        salespersonName={salespersonName}
        customers={customers}
        catalogProducts={catalogProducts}
        initialState={initialState}
        onSubmit={updateSalesOrder}
      />
    </div>
  );
}
