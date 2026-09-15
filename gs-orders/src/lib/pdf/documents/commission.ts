import "server-only";
import { COMMISSION_RECORD_STATUS_LABELS } from "@/types/domain";
import type { CommissionRecord, SalesOrderCurrency } from "@/types/domain";
import { formatDate, formatDateTime, formatMoneyByCurrency } from "@/lib/utils/format";
import { canManageCommissions } from "@/lib/auth/logistics";
import { resolveBranding } from "../branding";
import { buildPdfFilename } from "../filename";
import type { PdfDocumentSpec } from "../types";
import type { PdfDocumentAdapter } from "./types";

/**
 * SEGURIDAD CRÍTICA (THÖREN 0078, requisito explícito) — este es el único
 * de los 7 adapters con un chequeo de autoridad EXPLÍCITO además de RLS.
 * Espeja exactamente current_user_has_commission_authority() (0073): NO
 * hay atajo de "admin siempre true" — canManageCommissions (logistics.ts)
 * está deliberadamente escrito sin ese atajo para este dominio (a
 * diferencia de todos los demás helpers del archivo), así que un admin SIN
 * la capability can_manage_commissions recibe null (-> 404) aquí, ANTES de
 * intentar ninguna consulta a commission_records — nunca depende
 * únicamente de que RLS lo bloquee más abajo.
 */
export const commissionPdfAdapter: PdfDocumentAdapter = {
  docType: "commission",
  async build({ supabase, id, profile, capabilities }) {
    if (!canManageCommissions(profile, capabilities)) return null;

    const { data } = await supabase.from("commission_records").select("*").eq("id", id).maybeSingle();
    if (!data) return null;
    const record = data as CommissionRecord;

    const [{ data: soData }, { data: salesperson }] = await Promise.all([
      supabase
        .from("sales_orders")
        .select("order_number, customer_id, currency, is_test")
        .eq("id", record.sales_order_id)
        .maybeSingle(),
      supabase.from("salespeople").select("name").eq("id", record.salesperson_id).maybeSingle(),
    ]);
    const currency: SalesOrderCurrency = (soData?.currency as SalesOrderCurrency | undefined) ?? "MXN";

    const { data: customer } = soData
      ? await supabase.from("customers").select("name").eq("id", soData.customer_id).maybeSingle()
      : { data: null };

    const branding = await resolveBranding(supabase, record.organization_id, null);

    const spec: PdfDocumentSpec = {
      documentTypeLabel: "Comisión",
      folio: soData?.order_number ? `Comisión — ${soData.order_number}` : "Comisión",
      statusLabel: COMMISSION_RECORD_STATUS_LABELS[record.status] ?? record.status,
      dateLabel: `Generada: ${formatDate(record.created_at)}`,
      relatedData: [
        { label: "Sales Order", value: soData?.order_number ?? "—" },
        { label: "Cliente", value: customer?.name ?? "—" },
        { label: "Vendedor", value: salesperson?.name ?? "—" },
      ],
      columns: [
        { key: "concept", label: "Concepto" },
        { key: "value", label: "Valor", align: "right" },
      ],
      rows: [
        { concept: "Base de comisión", value: formatMoneyByCurrency(record.commission_base, currency) },
        { concept: "Tasa", value: `${record.commission_rate}%` },
        { concept: "Monto de comisión", value: formatMoneyByCurrency(record.commission_amount, currency) },
        { concept: "Monto elegible (cobro real)", value: formatMoneyByCurrency(record.eligible_amount, currency) },
        { concept: "Pagado", value: formatMoneyByCurrency(record.paid_amount, currency) },
      ],
      totals: null,
      notes: null,
      isTest: soData?.is_test ?? false,
      disclaimer: "Documento privado — Dirección General. Prohibida su distribución fuera de la organización.",
      branding,
      generatedAtLabel: formatDateTime(new Date().toISOString()),
    };

    return {
      spec,
      filename: buildPdfFilename(["COMISION", soData?.order_number ?? record.sales_order_id, salesperson?.name ?? "vendedor"]),
    };
  },
};
