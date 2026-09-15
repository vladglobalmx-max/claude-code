import "server-only";
import { INVOICE_STATUS_LABELS, SALES_ORDER_PAYMENT_TERMS_TYPE_LABELS } from "@/types/domain";
import type { Invoice, InvoiceItem, SalesOrderCurrency } from "@/types/domain";
import { formatDate, formatDateTime, formatMoneyByCurrency } from "@/lib/utils/format";
import { resolveBranding } from "../branding";
import { buildPdfFilename } from "../filename";
import type { PdfDocumentSpec } from "../types";
import type { PdfDocumentAdapter } from "./types";

/**
 * Mismo criterio que src/app/(app)/facturas/[id]/page.tsx: select por id,
 * RLS (invoices_select) es la única puerta. is_test se resuelve vía
 * sales_orders.is_test (1 salto, FK directa).
 *
 * THÖREN 0078 — requisito explícito: este PDF es un "documento comercial
 * interno de THÖREN", NUNCA se presenta como CFDI ni comprobante fiscal
 * SAT. El disclaimer fijo de abajo va SIEMPRE, sin excepción — no depende
 * de is_test ni de ningún flag.
 */
const INVOICE_DISCLAIMER = "Documento comercial interno — No constituye CFDI";

export const invoicePdfAdapter: PdfDocumentAdapter = {
  docType: "invoice",
  async build({ supabase, id }) {
    const { data } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
    if (!data) return null;
    const invoice = data as Invoice;

    const [{ data: soData }, { data: itemsData }] = await Promise.all([
      supabase
        .from("sales_orders")
        .select("order_number, customer_id, currency, is_test")
        .eq("id", invoice.sales_order_id)
        .maybeSingle(),
      supabase.from("invoice_items").select("*").eq("invoice_id", id).order("created_at"),
    ]);
    const items = (itemsData ?? []) as InvoiceItem[];
    const currency: SalesOrderCurrency = (soData?.currency as SalesOrderCurrency | undefined) ?? "MXN";

    const { data: customer } = soData
      ? await supabase.from("customers").select("name").eq("id", soData.customer_id).maybeSingle()
      : { data: null };

    const branding = await resolveBranding(supabase, invoice.organization_id, null);
    const balance = invoice.total - invoice.amount_paid;

    const spec: PdfDocumentSpec = {
      documentTypeLabel: "Factura",
      folio: invoice.invoice_number,
      statusLabel: INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status,
      dateLabel: `Emisión: ${formatDate(invoice.issue_date)} · Vence: ${formatDate(invoice.due_date)}`,
      relatedData: [
        { label: "Cliente", value: customer?.name ?? "—" },
        { label: "Sales Order", value: soData?.order_number ?? "—" },
        {
          label: "Términos",
          value: SALES_ORDER_PAYMENT_TERMS_TYPE_LABELS[invoice.payment_terms_type] ?? invoice.payment_terms_type,
        },
      ],
      columns: [
        { key: "description", label: "Concepto" },
        { key: "quantity", label: "Cant.", align: "right" },
        { key: "unitPrice", label: "P. Unit.", align: "right" },
        { key: "total", label: "Total", align: "right" },
      ],
      rows: items.map((item) => ({
        description: item.description_snapshot,
        quantity: String(item.quantity),
        unitPrice: formatMoneyByCurrency(item.unit_price, currency),
        total: formatMoneyByCurrency(item.line_total, currency),
      })),
      totals: [
        { label: "Subtotal", value: formatMoneyByCurrency(invoice.subtotal, currency) },
        { label: "Impuestos", value: formatMoneyByCurrency(invoice.tax_total, currency) },
        { label: "Total", value: formatMoneyByCurrency(invoice.total, currency), emphasis: true },
        { label: "Cobrado", value: formatMoneyByCurrency(invoice.amount_paid, currency) },
        { label: "Saldo", value: formatMoneyByCurrency(balance, currency) },
      ],
      notes: invoice.notes,
      isTest: soData?.is_test ?? false,
      disclaimer: INVOICE_DISCLAIMER,
      branding,
      generatedAtLabel: formatDateTime(new Date().toISOString()),
    };

    return { spec, filename: buildPdfFilename([invoice.invoice_number]) };
  },
};
