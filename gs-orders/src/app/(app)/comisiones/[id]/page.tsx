import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { canManageCommissions } from "@/lib/auth/logistics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { TestOperationBadge } from "@/components/ui/test-operation-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDateTime, formatMoneyByCurrency } from "@/lib/utils/format";
import { COMMISSION_RECORD_STATUS_BADGE, COMMISSION_RECORD_STATUS_LABELS } from "@/types/domain";
import type { CommissionRecord, CommissionEvent, SalesOrderCurrency } from "@/types/domain";
import { CommissionStatusActions } from "./status-actions";
import { refreshCommissionEligibility } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Detalle de una comisión. RLS (commission_records_select) ya acota la
 * visibilidad — SIN rama de dueño-vendedor: si no existe/no es visible
 * para el usuario (incluido el propio vendedor titular de la Sales
 * Order), `data` viene null -> 404, mismo criterio que /facturas/[id].
 */
export default async function ComisionDetailPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  const capabilities = await getCurrentCapabilities(profile?.userId);
  const canManage = canManageCommissions(profile, capabilities);

  if (canManage) {
    await refreshCommissionEligibility();
  }

  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("commission_records").select("*").eq("id", params.id).maybeSingle();
  if (!data) notFound();
  const record = data as CommissionRecord;

  const [{ data: soData }, { data: spData }, { data: eventsData }] = await Promise.all([
    supabase.from("sales_orders").select("id, order_number, customer_id, currency, total, amount_paid, is_test").eq("id", record.sales_order_id).maybeSingle(),
    supabase.from("salespeople").select("name").eq("id", record.salesperson_id).maybeSingle(),
    supabase.from("commission_events").select("*").eq("commission_record_id", record.id).order("created_at"),
  ]);
  const events = (eventsData ?? []) as CommissionEvent[];

  const { data: customerData } = soData
    ? await supabase.from("customers").select("name").eq("id", soData.customer_id).maybeSingle()
    : { data: null };

  const currency: SalesOrderCurrency = (soData?.currency as SalesOrderCurrency | undefined) ?? "MXN";
  const remainingEligible = record.eligible_amount - record.paid_amount;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/comisiones" className="flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          Comisiones
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Comisión</p>
            <p className="text-2xl font-bold text-ink">{spData?.name ?? "—"}</p>
          </div>
          <div className="flex items-center gap-2">
            <TestOperationBadge isTest={soData?.is_test ?? false} />
            <StatusBadge status={record.status} labels={COMMISSION_RECORD_STATUS_LABELS} variants={COMMISSION_RECORD_STATUS_BADGE} className="text-sm" />
          </div>
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
              <dt className="text-xs text-ink-faint">Cobro de la Sales Order</dt>
              <dd className="text-sm font-medium text-ink">
                {soData ? `${formatMoneyByCurrency(soData.amount_paid, currency)} de ${formatMoneyByCurrency(soData.total, currency)}` : "—"}
              </dd>
            </div>
            {record.status === "cancelled" && (
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-xs text-ink-faint">Motivo de cancelación</dt>
                <dd className="text-sm text-ink">{record.cancellation_reason ?? "—"}</dd>
              </div>
            )}
          </dl>

          <div className="space-y-1.5 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-faint">Base de comisión</span>
              <span className="text-ink">{formatMoneyByCurrency(record.commission_base, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-faint">Porcentaje</span>
              <span className="text-ink">{record.commission_rate}%</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
              <span className="text-ink">Comisión calculada</span>
              <span className="text-ink">{formatMoneyByCurrency(record.commission_amount, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-faint">Elegible (liberado por cobro)</span>
              <span className="text-ink">{formatMoneyByCurrency(record.eligible_amount, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-faint">Pagado</span>
              <span className="text-ink">{formatMoneyByCurrency(record.paid_amount, currency)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span className="text-ink">Saldo elegible pendiente</span>
              <span className="text-ink">{formatMoneyByCurrency(remainingEligible, currency)}</span>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <CommissionStatusActions commissionRecordId={record.id} status={record.status} remainingEligible={remainingEligible} canManage={canManage} />
          </div>
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
                  <Th>Monto</Th>
                  <Th>Cambio de estado</Th>
                </Tr>
              </Thead>
              <Tbody>
                {events.map((e) => (
                  <Tr key={e.id}>
                    <Td className="text-ink-soft">{formatDateTime(e.created_at)}</Td>
                    <Td className="text-ink">{e.event_type}</Td>
                    <Td className="text-ink-soft">{e.amount != null ? formatMoneyByCurrency(e.amount, currency) : "—"}</Td>
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
