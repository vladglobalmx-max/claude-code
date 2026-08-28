import Link from "next/link";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DueDateStatusIndicator } from "@/components/ui/due-date-status-indicator";
import { cn } from "@/lib/utils/cn";
import { formatDateShort } from "@/lib/utils/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canWriteRecord } from "@/lib/auth/ownership";
import { getOrderDetail } from "@/components/orders/get-order-detail";
import { OrderDetailContent } from "@/components/orders/order-detail-content";
import { classifyDueDateStatus } from "@/lib/dashboard/due-dates";
import { ORDER_OPERATIONAL_STATUS_BADGE, ORDER_OPERATIONAL_STATUS_LABELS } from "@/types/domain";
import type { OrderOperationalStatusHistoryEntry } from "@/types/domain";
import { DuplicateButton } from "../duplicate-button";
import { OrderStatusQuickActions } from "./status-quick-actions";
import { OrderOperationalStatusActions } from "./operational-status-actions";
import { OrderOperationalStatusHistory } from "./operational-status-history";
import { PurchaseOrdersSection } from "./purchase-orders-section";
import { ReservationsSection } from "./reservations-section";
import { DeliveriesSection } from "./deliveries-section";

export const dynamic = "force-dynamic";

/**
 * "Origen: Cotización" (THÖREN Quote → Order V2, 0023) se resuelve aquí con
 * un fetch adicional: source_quote_id ya viene incluido en detail.order
 * (columna real de orders, select("*")); solo falta el folio de la Quote,
 * que se resuelve con un segundo query bajo RLS. El PDF ((print)/pedidos/
 * [id]/pdf) desde Fase 6G ya no comparte OrderDetailContent con esta
 * página — tiene su propia resolución de sourceQuoteFolio, así que este
 * fetch es exclusivo de la vista en pantalla.
 */
export default async function VerPedidoPage({ params }: { params: { id: string } }) {
  const detail = await getOrderDetail(params.id);
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile();
  // VIEW != WRITE (THÖREN 6R.1B-1 UX fix) — ver src/lib/auth/ownership.ts.
  const canWrite = canWriteRecord(profile, detail.order.salesperson_id);

  let sourceQuoteFolio: string | null = null;
  if (detail.order.source_quote_id) {
    const { data: sourceQuote } = await supabase
      .from("quotes")
      .select("folio")
      .eq("id", detail.order.source_quote_id)
      .maybeSingle();
    sourceQuoteFolio = sourceQuote?.folio ?? null;
  }

  // Seguimiento operativo (THÖREN Fase 6H) — más reciente primero.
  const { data: operationalHistoryData } = await supabase
    .from("order_operational_status_history")
    .select("*")
    .eq("order_id", detail.order.id)
    .order("changed_at", { ascending: false });
  const operationalHistory = (operationalHistoryData ?? []) as OrderOperationalStatusHistoryEntry[];

  // THÖREN Fase 6K — vencimiento contra la fecha compromiso relevante según
  // operational_status (lib/dashboard/due-dates.ts, misma lógica que el
  // Dashboard y el listado — nunca reimplementada).
  const dueDateStatus = classifyDueDateStatus(
    detail.order.operational_status,
    {
      supplierCommitmentDate: detail.order.supplier_commitment_date,
      estimatedReceptionDate: detail.order.estimated_reception_date,
      scheduledDeliveryDate: detail.order.scheduled_delivery_date,
    },
    new Date()
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/pedidos" className="flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          Pedidos
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && <OrderStatusQuickActions order={detail.order} />}
          <DuplicateButton
            orderId={detail.order.id}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          />
          {canWrite && (
            <Link href={`/pedidos/${detail.order.id}/editar`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Link>
          )}
          <Link href={`/pedidos/${detail.order.id}/pdf`} target="_blank" className={cn(buttonVariants({ size: "sm" }))}>
            <Printer className="h-3.5 w-3.5" />
            PDF
          </Link>
        </div>
      </div>

      {detail.order.source_quote_id && (
        <p className="no-print mb-4 text-sm text-ink-faint">
          Origen: Cotización{" "}
          {sourceQuoteFolio ? (
            <Link href={`/cotizaciones/${detail.order.source_quote_id}`} className="font-mono text-accent hover:underline">
              {sourceQuoteFolio}
            </Link>
          ) : (
            "—"
          )}
        </p>
      )}

      <Card className="no-print mb-6">
        <CardHeader>
          <CardTitle>Seguimiento operativo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge
              status={detail.order.operational_status}
              labels={ORDER_OPERATIONAL_STATUS_LABELS}
              variants={ORDER_OPERATIONAL_STATUS_BADGE}
              className="text-sm"
            />
            {canWrite && <OrderOperationalStatusActions order={detail.order} />}
            {dueDateStatus && <DueDateStatusIndicator status={dueDateStatus} />}
          </div>
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Fecha compromiso proveedor</p>
              <p className="text-ink-soft">
                {detail.order.supplier_commitment_date ? formatDateShort(detail.order.supplier_commitment_date) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Fecha estimada de recepción</p>
              <p className="text-ink-soft">
                {detail.order.estimated_reception_date ? formatDateShort(detail.order.estimated_reception_date) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Fecha programada de entrega/instalación</p>
              <p className="text-ink-soft">
                {detail.order.scheduled_delivery_date ? formatDateShort(detail.order.scheduled_delivery_date) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Fecha real de entrega/cierre</p>
              <p className="text-ink-soft">
                {detail.order.actual_completion_date ? formatDateShort(detail.order.actual_completion_date) : "—"}
              </p>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Historial</p>
            <OrderOperationalStatusHistory entries={operationalHistory} />
          </div>
        </CardContent>
      </Card>

      <PurchaseOrdersSection orderId={detail.order.id} />

      <ReservationsSection orderId={detail.order.id} canWrite={canWrite} />

      <DeliveriesSection orderId={detail.order.id} orderFolio={detail.order.folio} canWrite={canWrite} />

      <Card>
        <CardContent className="p-6">
          <OrderDetailContent detail={detail} />
        </CardContent>
      </Card>
    </div>
  );
}
