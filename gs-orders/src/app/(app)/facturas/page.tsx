import Link from "next/link";
import { FileText } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { canManageSalesOrderFinance } from "@/lib/auth/logistics";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { TestOperationBadge } from "@/components/ui/test-operation-badge";
import { IncludeTestDataToggle } from "@/components/ui/include-test-data-toggle";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDateShort, formatMoneyByCurrency } from "@/lib/utils/format";
import { INVOICE_STATUS_BADGE, INVOICE_STATUS_LABELS } from "@/types/domain";
import type { Invoice, SalesOrderCurrency } from "@/types/domain";
import { refreshOverdueInvoices } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Lista de Facturas (THÖREN Facturación + Cobranza básica MVP, 0072).
 * Visibilidad por RLS (invoices_select): admin, dueño-vendedor de la Sales
 * Order de origen, can_view_all_sales o can_manage_sales_order_finance —
 * mismo criterio exacto que sales_order_financial_events (0068).
 * rpc_refresh_overdue_invoices se invoca aquí bajo demanda (sin cron en
 * este entorno) — un no-op silencioso para quien no tiene autoridad
 * financiera.
 */
export default async function FacturasPage({ searchParams }: { searchParams: { incluir_pruebas?: string } }) {
  const profile = await getCurrentProfile();
  const capabilities = await getCurrentCapabilities(profile?.userId);
  const canManageFinance = canManageSalesOrderFinance(profile, capabilities);
  const includeTest = searchParams.incluir_pruebas === "1";

  if (canManageFinance) {
    await refreshOverdueInvoices();
  }

  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(200);
  let invoices = (data ?? []) as Invoice[];

  const salesOrderIds = Array.from(new Set(invoices.map((inv) => inv.sales_order_id)));
  const { data: soData } = salesOrderIds.length
    ? await supabase.from("sales_orders").select("id, order_number, customer_id, currency, is_test").in("id", salesOrderIds)
    : { data: [] };
  const soById = new Map(
    (soData ?? []).map((so) => [so.id, { ...so, currency: so.currency as SalesOrderCurrency }])
  );

  // THÖREN 0077 — is_test se hereda de la Sales Order (join, sin columna
  // propia). Filtro en memoria, mismo criterio que el resto de la página.
  if (!includeTest) {
    invoices = invoices.filter((inv) => !(soById.get(inv.sales_order_id)?.is_test ?? false));
  }

  const customerIds = Array.from(new Set((soData ?? []).map((so) => so.customer_id)));
  const { data: customersData } = customerIds.length
    ? await supabase.from("customers").select("id, name").in("id", customerIds)
    : { data: [] };
  const customerNameById = new Map((customersData ?? []).map((c) => [c.id, c.name as string]));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Facturas" description="Facturación y cobranza de Sales Orders." actions={<IncludeTestDataToggle />} />

      {invoices.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="No hay facturas todavía"
            description="Créalas desde el detalle de una Sales Order confirmada (botón &ldquo;Crear factura&rdquo;)."
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {invoices.map((inv) => {
              const so = soById.get(inv.sales_order_id);
              const balance = inv.total - inv.amount_paid;
              return (
                <Card key={inv.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/facturas/${inv.id}`} className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium text-accent">{inv.invoice_number}</p>
                      <p className="mt-0.5 truncate text-sm font-medium text-ink">{so ? customerNameById.get(so.customer_id) ?? "—" : "—"}</p>
                    </Link>
                    <div className="flex items-center gap-2">
                      <TestOperationBadge isTest={so?.is_test ?? false} />
                      <StatusBadge status={inv.status} labels={INVOICE_STATUS_LABELS} variants={INVOICE_STATUS_BADGE} />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-ink-faint">
                    {so?.order_number ?? "—"} · Vence {formatDateShort(inv.due_date)}
                  </p>
                  <p className="mt-1 text-sm text-ink">
                    Saldo: {formatMoneyByCurrency(balance, so?.currency ?? "MXN")} de {formatMoneyByCurrency(inv.total, so?.currency ?? "MXN")}
                  </p>
                </Card>
              );
            })}
          </div>

          <Card className="hidden overflow-hidden sm:block">
            <Table>
              <Thead>
                <Tr>
                  <Th>Folio</Th>
                  <Th>Sales Order</Th>
                  <Th>Cliente</Th>
                  <Th>Vencimiento</Th>
                  <Th>Total</Th>
                  <Th>Cobrado</Th>
                  <Th>Saldo</Th>
                  <Th>Estado</Th>
                </Tr>
              </Thead>
              <Tbody>
                {invoices.map((inv) => {
                  const so = soById.get(inv.sales_order_id);
                  const currency = so?.currency ?? "MXN";
                  const balance = inv.total - inv.amount_paid;
                  return (
                    <Tr key={inv.id}>
                      <Td>
                        <Link href={`/facturas/${inv.id}`} className="font-mono text-sm font-medium text-accent hover:underline">
                          {inv.invoice_number}
                        </Link>
                      </Td>
                      <Td className="text-ink-soft">
                        {so ? (
                          <Link href={`/ordenes-venta/${so.id}`} className="font-mono text-accent hover:underline">
                            {so.order_number}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>{so ? customerNameById.get(so.customer_id) ?? "—" : "—"}</Td>
                      <Td className="text-ink-soft">{formatDateShort(inv.due_date)}</Td>
                      <Td className="text-ink-soft">{formatMoneyByCurrency(inv.total, currency)}</Td>
                      <Td className="text-ink-soft">{formatMoneyByCurrency(inv.amount_paid, currency)}</Td>
                      <Td className="font-medium text-ink">{formatMoneyByCurrency(balance, currency)}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <TestOperationBadge isTest={so?.is_test ?? false} />
                          <StatusBadge status={inv.status} labels={INVOICE_STATUS_LABELS} variants={INVOICE_STATUS_BADGE} />
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
