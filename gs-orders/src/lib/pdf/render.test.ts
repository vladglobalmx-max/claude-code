import { describe, expect, it, vi } from "vitest";

// "server-only" siempre lanza fuera del bundler de Next — mockear para
// poder ejercitar render.tsx y los 7 adapters reales en Vitest.
vi.mock("server-only", () => ({}));

const { renderDocumentPdf } = await import("./render");
const { salesOrderPdfAdapter } = await import("./documents/sales-order");
const { requisitionPdfAdapter } = await import("./documents/requisition");
const { purchaseOrderPdfAdapter } = await import("./documents/purchase-order");
const { goodsReceiptPdfAdapter } = await import("./documents/goods-receipt");
const { fulfillmentPdfAdapter } = await import("./documents/fulfillment");
const { invoicePdfAdapter } = await import("./documents/invoice");
const { commissionPdfAdapter } = await import("./documents/commission");

function createSupabaseStub(tables: Record<string, Record<string, unknown>[]>) {
  function makeQuery(table: string) {
    const rows = tables[table] ?? [];
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    const resolveRows = () => rows.filter((row) => filters.every((f) => f(row)));
    const api = {
      select: () => api,
      eq: (col: string, val: unknown) => {
        filters.push((row) => row[col] === val);
        return api;
      },
      in: (col: string, vals: unknown[]) => {
        filters.push((row) => vals.includes(row[col]));
        return api;
      },
      order: () => api,
      maybeSingle: async () => ({ data: resolveRows()[0] ?? null }),
      single: async () => ({ data: resolveRows()[0] ?? null }),
      then: (resolve: (result: { data: Record<string, unknown>[] }) => void) => resolve({ data: resolveRows() }),
    };
    return api;
  }
  return {
    from: (table: string) => makeQuery(table),
    storage: { from: () => ({ createSignedUrl: async () => ({ data: null }) }) },
  } as any;
}

function expectValidPdf(buffer: Buffer) {
  expect(buffer.length).toBeGreaterThan(500);
  expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(buffer.subarray(-10).toString("latin1")).toContain("%%EOF");
}

/**
 * THÖREN 0078 — integración real adapter -> render, sin mocks de
 * @react-pdf/renderer: para los 7 tipos de documento, genera el PDF de
 * verdad (adapter construye el spec con datos reales de fila -> el layout
 * único lo convierte en bytes PDF) y confirma que abre correctamente
 * (cabecera %PDF-/trailer %%EOF válidos, tamaño no trivial). El contenido
 * exacto (folio/snapshot/is_test) ya se prueba a nivel de spec en
 * documents/adapters.test.ts — react-pdf subsetea fuentes, así que el
 * texto plano no es buscable dentro del binario sin agregar un parser de
 * PDF como dependencia extra (deliberadamente fuera de alcance, ver
 * reporte 0078).
 */
describe("renderDocumentPdf — PDF válido de extremo a extremo, uno por tipo de documento (THÖREN 0078)", () => {
  it("Sales Order, con watermark PRUEBA (is_test=true)", async () => {
    const supabase = createSupabaseStub({
      sales_orders: [{ id: "so-1", organization_id: "org-1", order_number: "SO-1", status: "confirmed", currency: "MXN", payment_terms_type: "cash", customer_id: "c-1", salesperson_id: "sp-1", subtotal: 100, tax_total: 16, total: 116, commercial_notes: null, requested_delivery_date: null, shipping_address_snapshot: null, created_at: "2026-01-01T00:00:00Z", is_test: true }],
      sales_order_items: [{ sales_order_id: "so-1", sku_snapshot: "SKU-1", description_snapshot: "Producto", quantity: 1, unit_price: 100, line_total: 116 }],
      customers: [{ id: "c-1", name: "Cliente" }],
      salespeople: [{ id: "sp-1", name: "Vendedor" }],
      organizations: [{ id: "org-1", name: "GS Orders" }],
    });
    const result = await salesOrderPdfAdapter.build({ supabase, id: "so-1", profile: null, capabilities: new Set() });
    expectValidPdf(await renderDocumentPdf(result!.spec));
  });

  it("Purchase Requisition, sin watermark (is_test=false)", async () => {
    const supabase = createSupabaseStub({
      purchase_requisitions: [{ id: "req-1", organization_id: "org-1", requisition_number: "PR-1", status: "submitted", sales_order_id: "so-1", requested_at: "2026-01-01T00:00:00Z", notes: null }],
      sales_orders: [{ id: "so-1", order_number: "SO-1", customer_id: "c-1", is_test: false }],
      purchase_requisition_items: [{ purchase_requisition_id: "req-1", description_snapshot: "Producto", uom_snapshot: "pza", quantity_required: 5, quantity_ordered: 0 }],
      customers: [{ id: "c-1", name: "Cliente" }],
      organizations: [],
    });
    const result = await requisitionPdfAdapter.build({ supabase, id: "req-1", profile: null, capabilities: new Set() });
    expectValidPdf(await renderDocumentPdf(result!.spec));
  });

  it("Purchase Order", async () => {
    const supabase = createSupabaseStub({
      purchase_orders: [{ id: "po-1", organization_id: "org-1", folio: "OC-1", status: "ordenada", po_date: "2026-01-01", supplier_reference: null, supplier_commitment_date: null, estimated_reception_date: null, notes: null, is_test: false, supplier: { id: "sup-1", name: "Proveedor" } }],
      purchase_order_items: [{ purchase_order_id: "po-1", supplier_sku_snapshot: "SUP-1", supplier_model_snapshot: null, supplier_description_snapshot: "Descripción", supplier_uom_snapshot: "pza", description: "Interna", model: "MOD", unit: "pza", quantity_ordered: 3 }],
      organizations: [],
    });
    const result = await purchaseOrderPdfAdapter.build({ supabase, id: "po-1", profile: null, capabilities: new Set() });
    expectValidPdf(await renderDocumentPdf(result!.spec));
  });

  it("Goods Receipt", async () => {
    const supabase = createSupabaseStub({
      goods_receipts: [{ id: "gr-1", organization_id: "org-1", receipt_number: "GR-1", status: "posted", purchase_order_id: "po-1", warehouse_id: "wh-1", received_at: "2026-01-01T00:00:00Z", supplier_document_number: null, notes: null }],
      purchase_orders: [{ id: "po-1", folio: "OC-1", supplier_id: "sup-1", is_test: false, suppliers: { name: "Proveedor" } }],
      warehouses: [{ id: "wh-1", name: "Almacén" }],
      goods_receipt_items: [{ goods_receipt_id: "gr-1", description_snapshot: "Producto", uom_snapshot: "pza", quantity_received: 2 }],
      organizations: [],
    });
    const result = await goodsReceiptPdfAdapter.build({ supabase, id: "gr-1", profile: null, capabilities: new Set() });
    expectValidPdf(await renderDocumentPdf(result!.spec));
  });

  it("Sales Fulfillment", async () => {
    const supabase = createSupabaseStub({
      sales_fulfillments: [{ id: "sf-1", organization_id: "org-1", fulfillment_number: "SF-1", status: "shipped", sales_order_id: "so-1", warehouse_id: "wh-1", shipped_at: "2026-01-01T00:00:00Z", delivered_at: null, delivery_contact: null, delivery_notes: null, created_at: "2026-01-01T00:00:00Z" }],
      sales_orders: [{ id: "so-1", order_number: "SO-1", customer_id: "c-1", shipping_address_snapshot: "Calle 1", customer_contact_snapshot: "Contacto", is_test: false }],
      warehouses: [{ id: "wh-1", name: "Almacén" }],
      sales_fulfillment_items: [{ sales_fulfillment_id: "sf-1", description_snapshot: "Producto", uom_snapshot: "pza", quantity_requested: 2 }],
      customers: [{ id: "c-1", name: "Cliente" }],
      organizations: [],
    });
    const result = await fulfillmentPdfAdapter.build({ supabase, id: "sf-1", profile: null, capabilities: new Set() });
    expectValidPdf(await renderDocumentPdf(result!.spec));
  });

  it("Invoice, con disclaimer de 'no CFDI'", async () => {
    const supabase = createSupabaseStub({
      invoices: [{ id: "inv-1", organization_id: "org-1", invoice_number: "INV-1", status: "pending", sales_order_id: "so-1", payment_terms_type: "credit", issue_date: "2026-01-01", due_date: "2026-01-31", subtotal: 100, tax_total: 16, total: 116, amount_paid: 0, notes: null }],
      sales_orders: [{ id: "so-1", order_number: "SO-1", customer_id: "c-1", currency: "MXN", is_test: false }],
      invoice_items: [{ invoice_id: "inv-1", description_snapshot: "Concepto", quantity: 1, unit_price: 100, line_total: 116 }],
      customers: [{ id: "c-1", name: "Cliente" }],
      organizations: [],
    });
    const result = await invoicePdfAdapter.build({ supabase, id: "inv-1", profile: null, capabilities: new Set() });
    expectValidPdf(await renderDocumentPdf(result!.spec));
  });

  it("Commission, solo con can_manage_commissions", async () => {
    const supabase = createSupabaseStub({
      commission_records: [{ id: "cr-1", organization_id: "org-1", sales_order_id: "so-1", salesperson_id: "sp-1", status: "eligible", commission_base: 1000, commission_rate: 5, commission_amount: 50, eligible_amount: 50, paid_amount: 0, created_at: "2026-01-01T00:00:00Z" }],
      sales_orders: [{ id: "so-1", order_number: "SO-1", customer_id: "c-1", currency: "MXN", is_test: false }],
      salespeople: [{ id: "sp-1", name: "Vendedor" }],
      customers: [{ id: "c-1", name: "Cliente" }],
      organizations: [],
    });
    const profile = { userId: "u-1", email: null, name: "Directora", role: "vendedor" as const, salespersonId: null, active: true };
    const result = await commissionPdfAdapter.build({ supabase, id: "cr-1", profile, capabilities: new Set(["can_manage_commissions"]) });
    expectValidPdf(await renderDocumentPdf(result!.spec));
  });
});
