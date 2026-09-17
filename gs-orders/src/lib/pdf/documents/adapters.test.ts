import { describe, expect, it, vi } from "vitest";

// "server-only" siempre lanza fuera del bundler de Next — mockear para
// poder ejercitar los adapters directamente en Vitest (Node plano).
vi.mock("server-only", () => ({}));

const { salesOrderPdfAdapter } = await import("./sales-order");
const { requisitionPdfAdapter } = await import("./requisition");
const { purchaseOrderPdfAdapter } = await import("./purchase-order");
const { goodsReceiptPdfAdapter } = await import("./goods-receipt");
const { fulfillmentPdfAdapter } = await import("./fulfillment");
const { invoicePdfAdapter } = await import("./invoice");
const { commissionPdfAdapter } = await import("./commission");

/**
 * Stub genérico de Supabase para probar los adapters SIN Postgres real —
 * la seguridad real (RLS, autoridad de comisiones en DB) se prueba en SQL
 * (supabase/tests/*.sql); esto solo fija el contrato TS: qué construye
 * cada adapter a partir de filas YA resueltas (simulando exactamente lo
 * que RLS dejaría pasar o no). `.select()` es un no-op deliberado — las
 * fixtures ya vienen "pre-unidas" (embeds tipo `supplier:suppliers(*)` ya
 * resueltos) para no reimplementar un motor de JOIN en el mock.
 */
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

describe("salesOrderPdfAdapter (THÖREN 0078)", () => {
  const baseSalesOrder = {
    id: "so-1",
    organization_id: "org-1",
    order_number: "SO-20261509-004",
    status: "confirmed",
    currency: "MXN",
    payment_terms_type: "cash",
    customer_id: "cust-1",
    salesperson_id: "sp-1",
    subtotal: 100,
    tax_total: 16,
    total: 116,
    commercial_notes: null,
    requested_delivery_date: null,
    shipping_address_snapshot: null,
    created_at: "2026-01-01T00:00:00Z",
    is_test: false,
  };

  it("documento inexistente / oculto por RLS -> null (nunca un objeto vacío)", async () => {
    const supabase = createSupabaseStub({ sales_orders: [], organizations: [] });
    const result = await salesOrderPdfAdapter.build({ supabase, id: "no-existe", profile: null, capabilities: new Set() });
    expect(result).toBeNull();
  });

  it("folio correcto y filename derivado del order_number", async () => {
    const supabase = createSupabaseStub({
      sales_orders: [baseSalesOrder],
      sales_order_items: [{ sales_order_id: "so-1", sku_snapshot: "SKU-1", description_snapshot: "Producto 1", quantity: 2, unit_price: 50, line_total: 100 }],
      customers: [{ id: "cust-1", name: "Cliente Uno" }],
      salespeople: [{ id: "sp-1", name: "Vendedor Uno" }],
      organizations: [{ id: "org-1", name: "GS Orders" }],
    });
    const result = await salesOrderPdfAdapter.build({ supabase, id: "so-1", profile: null, capabilities: new Set() });

    expect(result?.spec.folio).toBe("SO-20261509-004");
    expect(result?.filename).toBe("SO-20261509-004.pdf");
    expect(result?.spec.rows[0]).toEqual(
      expect.objectContaining({ sku: "SKU-1", description: "Producto 1" })
    );
    // Fix de cierre 0081 — regresión: un tipo de documento ajeno a Purchase
    // Order nunca pasa overrides de sección, el layout sigue en español.
    expect(result?.spec.relatedDataSectionLabel).toBeUndefined();
    expect(result?.spec.notesSectionLabel).toBeUndefined();
    expect(result?.spec.generatedAtPrefixLabel).toBeUndefined();
  });

  it("is_test=true -> spec.isTest true (watermark); is_test=false -> false", async () => {
    const supabaseTest = createSupabaseStub({
      sales_orders: [{ ...baseSalesOrder, is_test: true }],
      sales_order_items: [],
      customers: [],
      salespeople: [],
      organizations: [],
    });
    const testResult = await salesOrderPdfAdapter.build({ supabase: supabaseTest, id: "so-1", profile: null, capabilities: new Set() });
    expect(testResult?.spec.isTest).toBe(true);

    const supabaseOfficial = createSupabaseStub({
      sales_orders: [baseSalesOrder],
      sales_order_items: [],
      customers: [],
      salespeople: [],
      organizations: [],
    });
    const officialResult = await salesOrderPdfAdapter.build({ supabase: supabaseOfficial, id: "so-1", profile: null, capabilities: new Set() });
    expect(officialResult?.spec.isTest).toBe(false);
  });
});

describe("requisitionPdfAdapter (THÖREN 0078)", () => {
  it("folio correcto, is_test resuelto vía JOIN a sales_orders, not-found -> null", async () => {
    const supabase = createSupabaseStub({
      purchase_requisitions: [{ id: "req-1", organization_id: "org-1", requisition_number: "PR-000001", status: "submitted", sales_order_id: "so-1", requested_at: "2026-01-01T00:00:00Z", notes: null }],
      sales_orders: [{ id: "so-1", order_number: "SO-1", customer_id: "cust-1", is_test: true }],
      purchase_requisition_items: [],
      customers: [{ id: "cust-1", name: "Cliente" }],
      organizations: [],
    });
    const result = await requisitionPdfAdapter.build({ supabase, id: "req-1", profile: null, capabilities: new Set() });
    expect(result?.spec.folio).toBe("PR-000001");
    expect(result?.filename).toBe("PR-000001.pdf");
    expect(result?.spec.isTest).toBe(true);

    const missing = createSupabaseStub({ purchase_requisitions: [], sales_orders: [], purchase_requisition_items: [], customers: [], organizations: [] });
    expect(await requisitionPdfAdapter.build({ supabase: missing, id: "no-existe", profile: null, capabilities: new Set() })).toBeNull();
  });
});

describe("purchaseOrderPdfAdapter (THÖREN 0078)", () => {
  it("solo campos para el proveedor — folio, referencia, cantidades/unidad de sus propios snapshots, is_test columna propia", async () => {
    const supabase = createSupabaseStub({
      purchase_orders: [
        {
          id: "po-1",
          organization_id: "org-1",
          folio: "OC-000001",
          status: "ordenada",
          po_date: "2026-01-01",
          supplier_reference: "REF-EXT-1",
          supplier_commitment_date: null,
          estimated_reception_date: null,
          notes: "Entregar en muelle 2",
          is_test: true,
          supplier: { id: "sup-1", name: "Proveedor Uno" },
        },
      ],
      purchase_order_items: [
        {
          purchase_order_id: "po-1",
          supplier_sku_snapshot: "SUP-SKU-1",
          supplier_model_snapshot: null,
          supplier_description_snapshot: "Descripción del proveedor",
          supplier_uom_snapshot: "pza",
          description: "Descripción interna",
          model: "MODELO-INTERNO",
          unit: "pza",
          quantity_ordered: 10,
        },
      ],
      organizations: [],
    });
    const result = await purchaseOrderPdfAdapter.build({ supabase, id: "po-1", profile: null, capabilities: new Set() });

    expect(result?.spec.folio).toBe("OC-000001");
    expect(result?.filename).toBe("OC-000001.pdf");
    expect(result?.spec.isTest).toBe(true);
    expect(result?.spec.relatedData).toEqual(
      expect.arrayContaining([{ label: "Proveedor", value: "Proveedor Uno" }, { label: "Referencia proveedor", value: "REF-EXT-1" }])
    );
    // usa el snapshot de proveedor, NUNCA el modelo interno.
    expect(result?.spec.rows[0]).toEqual(
      expect.objectContaining({ reference: "SUP-SKU-1", description: "Descripción del proveedor" })
    );
  });

  it("documento inexistente -> null", async () => {
    const supabase = createSupabaseStub({ purchase_orders: [], purchase_order_items: [], organizations: [] });
    expect(await purchaseOrderPdfAdapter.build({ supabase, id: "no-existe", profile: null, capabilities: new Set() })).toBeNull();
  });

  it("origin='directa' — respeta document_language, agrega precio/impuesto/importe + totales, y resuelve branding por su propia Business Unit (0081)", async () => {
    const supabase = createSupabaseStub({
      purchase_orders: [
        {
          id: "po-2",
          organization_id: "org-1",
          folio: "OC-000002",
          status: "borrador",
          po_date: "2026-01-01",
          supplier_reference: null,
          supplier_commitment_date: null,
          estimated_reception_date: null,
          notes: null,
          is_test: false,
          origin: "directa",
          business_unit_id: "bu-1",
          document_language: "en",
          currency: "USD",
          destination_warehouse_id: "wh-1",
          direct_purchase_reason: "stock",
          payment_terms: "Net 30",
          required_date: "2026-02-01",
          subtotal: 100,
          tax_total: 16,
          total: 116,
          supplier: { id: "sup-1", name: "Proveedor Uno" },
        },
      ],
      purchase_order_items: [
        {
          purchase_order_id: "po-2",
          description: "Servicio de instalación",
          model: "MODELO-INTERNO",
          unit: "pza",
          quantity_ordered: 2,
          unit_price: 50,
          tax_percent: 16,
          line_total: 116,
        },
      ],
      business_units: [{ id: "bu-1", name: "BU Uno", logo_path: null }],
      warehouses: [{ id: "wh-1", name: "Almacén Norte" }],
      organizations: [{ id: "org-1", name: "GS Orders" }],
    });
    const result = await purchaseOrderPdfAdapter.build({ supabase, id: "po-2", profile: null, capabilities: new Set() });

    expect(result?.spec.documentTypeLabel).toBe("Purchase Order");
    expect(result?.spec.statusLabel).toBe("Draft");
    // document_language='en' -> nombre de mes en inglés, nunca español (ver translatePurchaseOrderDate).
    expect(result?.spec.dateLabel).toBe("Date: January 1, 2026");
    expect(result?.spec.branding.businessUnitName).toBe("BU Uno");
    expect(result?.spec.relatedData).toEqual(
      expect.arrayContaining([
        { label: "Supplier", value: "Proveedor Uno" },
        { label: "Required Date", value: "February 1, 2026" },
        { label: "Payment Terms", value: "Net 30" },
        { label: "Ship To", value: "Almacén Norte" },
      ])
    );
    expect(result?.spec.rows[0]).toEqual(
      expect.objectContaining({ description: "Servicio de instalación", unitPrice: "$50.00", amount: "$116.00" })
    );
    expect(result?.spec.totals).toEqual([
      { label: "Subtotal", value: "$100.00" },
      { label: "Taxes", value: "$16.00" },
      { label: "Total", value: "$116.00 USD", emphasis: true },
    ]);
    // Fix de cierre 0081 — con document_language='en' NINGUNO de los 3 textos
    // del layout compartido queda en español (Datos relacionados/Notas/Generado el).
    expect(result?.spec.relatedDataSectionLabel).toBe("Related Information");
    expect(result?.spec.notesSectionLabel).toBe("Notes");
    expect(result?.spec.generatedAtPrefixLabel).toBe("Generated on");
    expect([result?.spec.relatedDataSectionLabel, result?.spec.notesSectionLabel, result?.spec.generatedAtPrefixLabel]).not.toEqual(
      expect.arrayContaining(["Datos relacionados", "Notas", "Generado el"])
    );
    // "Generado el" también respeta el idioma con mes en inglés, nunca español.
    expect(result?.spec.generatedAtLabel).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{2}:\d{2}$/);
  });

  it("origin='directa' con document_language='es' — conserva EXACTAMENTE los labels actuales del layout compartido (Datos relacionados/Notas/Generado el)", async () => {
    const supabase = createSupabaseStub({
      purchase_orders: [
        {
          id: "po-4",
          organization_id: "org-1",
          folio: "OC-000004",
          status: "borrador",
          po_date: "2026-01-01",
          supplier_reference: null,
          supplier_commitment_date: null,
          estimated_reception_date: null,
          notes: "Ver anexo",
          is_test: false,
          origin: "directa",
          business_unit_id: "bu-1",
          document_language: "es",
          currency: "MXN",
          direct_purchase_reason: "stock",
          subtotal: 100,
          tax_total: 16,
          total: 116,
          supplier: { id: "sup-1", name: "Proveedor Uno" },
        },
      ],
      purchase_order_items: [
        { purchase_order_id: "po-4", description: "Servicio", model: "MOD-1", unit: "pza", quantity_ordered: 1, unit_price: 100, tax_percent: 16, line_total: 116 },
      ],
      business_units: [{ id: "bu-1", name: "BU Uno", logo_path: null }],
      organizations: [{ id: "org-1", name: "GS Orders" }],
    });
    const result = await purchaseOrderPdfAdapter.build({ supabase, id: "po-4", profile: null, capabilities: new Set() });

    expect(result?.spec.relatedDataSectionLabel).toBe("Datos relacionados");
    expect(result?.spec.notesSectionLabel).toBe("Notas");
    expect(result?.spec.generatedAtPrefixLabel).toBe("Generado el");
  });

  it("origin='pedido' (default legado) — nunca agrega columnas/totales de precio, mismo comportamiento previo a 0081", async () => {
    const supabase = createSupabaseStub({
      purchase_orders: [
        {
          id: "po-3",
          organization_id: "org-1",
          folio: "OC-000003",
          status: "ordenada",
          po_date: "2026-01-01",
          supplier_reference: "REF-1",
          supplier_commitment_date: null,
          estimated_reception_date: null,
          notes: null,
          is_test: false,
          origin: "pedido",
          business_unit_id: null,
          document_language: "es",
          currency: null,
          supplier: { id: "sup-1", name: "Proveedor Uno" },
        },
      ],
      purchase_order_items: [
        { purchase_order_id: "po-3", description: "Item 1", model: "MOD-1", unit: "pza", quantity_ordered: 3 },
      ],
      organizations: [],
    });
    const result = await purchaseOrderPdfAdapter.build({ supabase, id: "po-3", profile: null, capabilities: new Set() });

    expect(result?.spec.documentTypeLabel).toBe("Purchase Order");
    expect(result?.spec.totals).toBeNull();
    expect(result?.spec.columns.map((c) => c.key)).toEqual(["reference", "description", "unit", "quantity"]);
    // Fix de cierre 0081 — un PO legado NUNCA pasa overrides: el layout
    // compartido debe caer a sus 3 textos en español de siempre, sin cambio.
    expect(result?.spec.relatedDataSectionLabel).toBeUndefined();
    expect(result?.spec.notesSectionLabel).toBeUndefined();
    expect(result?.spec.generatedAtPrefixLabel).toBeUndefined();
  });
});

describe("goodsReceiptPdfAdapter (THÖREN 0078)", () => {
  it("folio correcto, is_test vía purchase_orders.is_test, not-found -> null", async () => {
    const supabase = createSupabaseStub({
      goods_receipts: [
        {
          id: "gr-1",
          organization_id: "org-1",
          receipt_number: "GR-000001",
          status: "posted",
          purchase_order_id: "po-1",
          warehouse_id: "wh-1",
          received_at: "2026-01-01T00:00:00Z",
          supplier_document_number: "REM-123",
          notes: null,
        },
      ],
      purchase_orders: [{ id: "po-1", folio: "OC-000001", supplier_id: "sup-1", is_test: true, suppliers: { name: "Proveedor Uno" } }],
      warehouses: [{ id: "wh-1", name: "Almacén Central" }],
      goods_receipt_items: [{ goods_receipt_id: "gr-1", description_snapshot: "Producto A", uom_snapshot: "pza", quantity_received: 5 }],
      organizations: [],
    });
    const result = await goodsReceiptPdfAdapter.build({ supabase, id: "gr-1", profile: null, capabilities: new Set() });

    expect(result?.spec.folio).toBe("GR-000001");
    expect(result?.filename).toBe("GR-000001.pdf");
    expect(result?.spec.isTest).toBe(true);
    expect(result?.spec.totals).toBeNull();

    const missing = createSupabaseStub({ goods_receipts: [], purchase_orders: [], warehouses: [], goods_receipt_items: [], organizations: [] });
    expect(await goodsReceiptPdfAdapter.build({ supabase: missing, id: "no-existe", profile: null, capabilities: new Set() })).toBeNull();
  });
});

describe("fulfillmentPdfAdapter (THÖREN 0078)", () => {
  it("dirección/contacto vienen del snapshot de la Sales Order, is_test vía SO, not-found -> null", async () => {
    const supabase = createSupabaseStub({
      sales_fulfillments: [
        {
          id: "sf-1",
          organization_id: "org-1",
          fulfillment_number: "SF-000001",
          status: "shipped",
          sales_order_id: "so-1",
          warehouse_id: "wh-1",
          shipped_at: "2026-01-02T00:00:00Z",
          delivered_at: null,
          delivery_contact: null,
          delivery_notes: "Entregar en recepción",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      sales_orders: [
        { id: "so-1", order_number: "SO-1", customer_id: "cust-1", shipping_address_snapshot: "Calle Falsa 123", customer_contact_snapshot: "Juan Pérez · 555-0001", is_test: false },
      ],
      warehouses: [{ id: "wh-1", name: "Almacén Central" }],
      sales_fulfillment_items: [{ sales_fulfillment_id: "sf-1", description_snapshot: "Producto A", uom_snapshot: "pza", quantity_requested: 3 }],
      customers: [{ id: "cust-1", name: "Cliente Uno" }],
      organizations: [],
    });
    const result = await fulfillmentPdfAdapter.build({ supabase, id: "sf-1", profile: null, capabilities: new Set() });

    expect(result?.spec.folio).toBe("SF-000001");
    expect(result?.filename).toBe("SF-000001.pdf");
    expect(result?.spec.isTest).toBe(false);
    expect(result?.spec.relatedData).toEqual(
      expect.arrayContaining([
        { label: "Dirección de entrega", value: "Calle Falsa 123" },
        { label: "Contacto", value: "Juan Pérez · 555-0001" },
      ])
    );

    const missing = createSupabaseStub({ sales_fulfillments: [], sales_orders: [], warehouses: [], sales_fulfillment_items: [], customers: [], organizations: [] });
    expect(await fulfillmentPdfAdapter.build({ supabase: missing, id: "no-existe", profile: null, capabilities: new Set() })).toBeNull();
  });
});

describe("invoicePdfAdapter (THÖREN 0078)", () => {
  it("disclaimer de 'no es CFDI' SIEMPRE presente, incluye cobrado/saldo, is_test vía SO, not-found -> null", async () => {
    const supabase = createSupabaseStub({
      invoices: [
        {
          id: "inv-1",
          organization_id: "org-1",
          invoice_number: "INV-000001",
          status: "partially_paid",
          sales_order_id: "so-1",
          payment_terms_type: "credit",
          issue_date: "2026-01-01",
          due_date: "2026-01-31",
          subtotal: 100,
          tax_total: 16,
          total: 116,
          amount_paid: 50,
          notes: null,
        },
      ],
      sales_orders: [{ id: "so-1", order_number: "SO-1", customer_id: "cust-1", currency: "MXN", is_test: true }],
      invoice_items: [{ invoice_id: "inv-1", description_snapshot: "Concepto A", quantity: 1, unit_price: 100, line_total: 116 }],
      customers: [{ id: "cust-1", name: "Cliente Uno" }],
      organizations: [],
    });
    const result = await invoicePdfAdapter.build({ supabase, id: "inv-1", profile: null, capabilities: new Set() });

    expect(result?.spec.folio).toBe("INV-000001");
    expect(result?.filename).toBe("INV-000001.pdf");
    expect(result?.spec.isTest).toBe(true);
    expect(result?.spec.disclaimer).toBe("Documento comercial interno — No constituye CFDI");
    expect(result?.spec.totals).toEqual(
      expect.arrayContaining([
        { label: "Cobrado", value: expect.stringContaining("50") },
        { label: "Saldo", value: expect.stringContaining("66") },
      ])
    );

    const missing = createSupabaseStub({ invoices: [], sales_orders: [], invoice_items: [], customers: [], organizations: [] });
    expect(await invoicePdfAdapter.build({ supabase: missing, id: "no-existe", profile: null, capabilities: new Set() })).toBeNull();
  });
});

describe("commissionPdfAdapter (THÖREN 0078) — seguridad crítica", () => {
  const baseRecord = {
    id: "cr-1",
    organization_id: "org-1",
    sales_order_id: "so-1",
    salesperson_id: "sp-1",
    status: "eligible",
    commission_base: 1000,
    commission_rate: 5,
    commission_amount: 50,
    eligible_amount: 50,
    paid_amount: 0,
    created_at: "2026-01-01T00:00:00Z",
  };
  const tables = {
    commission_records: [baseRecord],
    sales_orders: [{ id: "so-1", order_number: "SO-1", customer_id: "cust-1", currency: "MXN", is_test: false }],
    salespeople: [{ id: "sp-1", name: "Vendedor Uno" }],
    customers: [{ id: "cust-1", name: "Cliente Uno" }],
    organizations: [],
  };

  it("admin SIN can_manage_commissions -> null, sin siquiera tocar commission_records (NO agregar excepción para admins)", async () => {
    const supabase = createSupabaseStub(tables);
    const fromSpy = vi.spyOn(supabase, "from");
    const adminProfile = { userId: "u-admin", email: null, name: "Admin", role: "admin" as const, salespersonId: null, active: true };

    const result = await commissionPdfAdapter.build({ supabase, id: "cr-1", profile: adminProfile, capabilities: new Set() });

    expect(result).toBeNull();
    expect(fromSpy).not.toHaveBeenCalledWith("commission_records");
  });

  it("usuario con can_manage_commissions -> obtiene el PDF (folio incluye la Sales Order, filename COMISION-<folio-SO>-<vendedor>)", async () => {
    const supabase = createSupabaseStub(tables);
    const managerProfile = { userId: "u-2", email: null, name: "Directora", role: "vendedor" as const, salespersonId: null, active: true };

    const result = await commissionPdfAdapter.build({
      supabase,
      id: "cr-1",
      profile: managerProfile,
      capabilities: new Set(["can_manage_commissions"]),
    });

    expect(result).not.toBeNull();
    expect(result?.spec.folio).toContain("SO-1");
    expect(result?.filename).toBe("COMISION-SO-1-Vendedor-Uno.pdf");
  });

  it("is_test=true en la Sales Order de origen -> spec.isTest true", async () => {
    const supabase = createSupabaseStub({ ...tables, sales_orders: [{ ...tables.sales_orders[0], is_test: true }] });
    const managerProfile = { userId: "u-2", email: null, name: "Directora", role: "vendedor" as const, salespersonId: null, active: true };

    const result = await commissionPdfAdapter.build({
      supabase,
      id: "cr-1",
      profile: managerProfile,
      capabilities: new Set(["can_manage_commissions"]),
    });

    expect(result?.spec.isTest).toBe(true);
  });

  it("documento inexistente (incluso con capability) -> null", async () => {
    const supabase = createSupabaseStub({ commission_records: [], sales_orders: [], salespeople: [], customers: [], organizations: [] });
    const managerProfile = { userId: "u-2", email: null, name: "Directora", role: "vendedor" as const, salespersonId: null, active: true };

    const result = await commissionPdfAdapter.build({
      supabase,
      id: "no-existe",
      profile: managerProfile,
      capabilities: new Set(["can_manage_commissions"]),
    });

    expect(result).toBeNull();
  });
});
