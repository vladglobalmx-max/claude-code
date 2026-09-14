import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { canManageSalesOrderFinance } from "@/lib/auth/logistics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDateShort, formatDateTime, formatMoneyByCurrency } from "@/lib/utils/format";
import { INVOICE_STATUS_BADGE, INVOICE_STATUS_LABELS, SALES_ORDER_PAYMENT_TERMS_TYPE_LABELS } from "@/types/domain";
import type { Invoice, InvoiceItem, InvoicePayment, InvoiceEvent, SalesOrderCurrency } from "@/types/domain";
import { InvoiceStatusActions } from "./status-actions";
import { refreshOverdueInvoices } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Detalle de una factura. RLS (invoices_select) ya acota la visibilidad:
 * si no existe/no es visible para el usuario, `data` viene null -> 404
 * (mismo criterio que /recepciones/[id], /surtidos/[id]). Refresca
 * 'overdue' bajo demanda (sin cron) antes de leer, solo si el usuario
 * tiene autoridad financiera — mismo criterio que /facturas.
 */
export default async function FacturaDetailPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  const capabilities = await getCurrentCapabilities(profile?.userId);
  const canManage = canManageSalesOrderFinance(profile, capabilities);

  if (canManage) {
    await refreshOverdueInvoices();
  }

  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("invoices").select("*").eq("id", params.id).maybeSingle();
  if (!data) notFound();
  const invoice = data as Invoice;

  const [{ data: soData }, { data: itemsData }, { data: paymentsData }, { data: eventsData }] = await Promise.all([
    supabase.from("sales_orders").select("id, order_number, customer_id, currency").eq("id", invoice.sales_order_id).maybeSingle(),
    supabase.from("invoice_items").select("*").eq("invoice_id", invoice.id).order("created_at"),
    supabase.from("invoice_payments").select("*").eq("invoice_id", invoice.id).order("created_at"),
    supabase.from("invoice_events").select("*").eq("invoice_id", invoice.id).order("created_at"),
  ]);
  const items = (itemsData ?? []) as InvoiceItem[];
  const payments = (paymentsData ?? []) as InvoicePayment[];
  const events = (eventsData ?? []) as InvoiceEvent[];

  const { data: customerData } = soData
    ? await supabase.from("customers").select("name").eq("id", soData.customer_id).maybeSingle()
    : { data: null };

  const currency: SalesOrderCurrency = (soData?.currency as SalesOrderCurrency | undefined) ?? "MXN";
  const balance = invoice.total - invoice.amount_paid;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/facturas" className="flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          Facturas
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Factura</p>
            <p className="font-mono text-2xl font-bold text-ink">{invoice.invoice_number}</p>
          </div>
          <StatusBadge status={invoice.status} labels={INVOICE_STATUS_LABELS} variants={INVOICE_STATUS_BADGE} className="text-sm" />
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-border bg-surface-2/50 p-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-ink-faint">Sales Order</dt>
              <dd className="text-sm font-medium text-ink">
                {soData ? (
                  <Link href={`/ordenes-venta/${soData.id}`} className="font-mono text-accent hover:underline">
                    {soData.order_number}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Cliente</dt>
              <dd className="text-sm font-medium text-ink">{customerData?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Condición de pago</dt>
              <dd className="text-sm font-medium text-ink">{SALES_ORDER_PAYMENT_TERMS_TYPE_LABELS[invoice.payment_terms_type]}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Fecha de emisión</dt>
              <dd className="text-sm font-medium text-ink">{formatDateShort(invoice.issue_date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Fecha de vencimiento</dt>
              <dd className="text-sm font-medium text-ink">{formatDateShort(invoice.due_date)}</dd>
            </div>
            {invoice.status === "cancelled" && (
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-xs text-ink-faint">Motivo de cancelación</dt>
                <dd className="text-sm text-ink">{invoice.cancellation_reason ?? "—"}</dd>
              </div>
            )}
            {invoice.notes && (
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-xs text-ink-faint">Notas</dt>
                <dd className="whitespace-pre-wrap text-sm text-ink">{invoice.notes}</dd>
              </div>
            )}
          </dl>

          <div className="space-y-1.5 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-faint">Subtotal</span>
              <span className="text-ink">{formatMoneyByCurrency(invoice.subtotal, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-faint">Impuestos</span>
              <span className="text-ink">{formatMoneyByCurrency(invoice.tax_total, currency)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
              <span className="text-ink">Total</span>
              <span className="text-ink">{formatMoneyByCurrency(invoice.total, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-faint">Cobrado</span>
              <span className="text-ink">{formatMoneyByCurrency(invoice.amount_paid, currency)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span className="text-ink">Saldo</span>
              <span className="text-ink">{formatMoneyByCurrency(balance, currency)}</span>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <InvoiceStatusActions invoiceId={invoice.id} invoiceNumber={invoice.invoice_number} status={invoice.status} balance={balance} canManage={canManage} />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Líneas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <Thead>
              <Tr>
                <Th>Producto</Th>
                <Th>Cantidad</Th>
                <Th>Precio unitario</Th>
                <Th>Total</Th>
              </Tr>
            </Thead>
            <Tbody>
              {items.map((item) => (
                <Tr key={item.id}>
                  <Td className="font-medium text-ink">{item.description_snapshot}</Td>
                  <Td className="tabular-nums text-ink-soft">
                    {item.quantity}
                    {item.uom_snapshot ? ` ${item.uom_snapshot}` : ""}
                  </Td>
                  <Td className="tabular-nums text-ink-soft">{formatMoneyByCurrency(item.unit_price, currency)}</Td>
                  <Td className="tabular-nums text-ink-soft">{formatMoneyByCurrency(item.line_total, currency)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Pagos registrados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <p className="p-4 text-sm text-ink-faint">Sin pagos registrados todavía.</p>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Fecha</Th>
                  <Th>Monto</Th>
                  <Th>Notas</Th>
                </Tr>
              </Thead>
              <Tbody>
                {payments.map((p) => (
                  <Tr key={p.id}>
                    <Td className="text-ink-soft">{formatDateShort(p.payment_date)}</Td>
                    <Td className="tabular-nums font-medium text-ink">{formatMoneyByCurrency(p.amount, currency)}</Td>
                    <Td className="text-ink-soft">{p.notes ?? "—"}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <p className="p-4 text-sm text-ink-faint">Sin eventos registrados.</p>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Fecha</Th>
                  <Th>Evento</Th>
                  <Th>Cambio de estado</Th>
                </Tr>
              </Thead>
              <Tbody>
                {events.map((e) => (
                  <Tr key={e.id}>
                    <Td className="text-ink-soft">{formatDateTime(e.created_at)}</Td>
                    <Td className="text-ink">{e.event_type}</Td>
                    <Td className="text-ink-soft">
                      {e.previous_status ?? "—"} → {e.new_status ?? "—"}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
