import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, ShoppingCart } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canWriteRecord } from "@/lib/auth/ownership";
import { canManageSalesOrderFinance } from "@/lib/auth/logistics";
import { canPreparePurchaseOrders } from "@/lib/auth/purchase-orders";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { cn } from "@/lib/utils/cn";
import { formatDateShort, formatMoneyByCurrency } from "@/lib/utils/format";
import { SALES_ORDER_STATUS_BADGE, SALES_ORDER_STATUS_LABELS } from "@/types/domain";
import type { SalesOrder, SalesOrderItem } from "@/types/domain";
import { SalesOrderStatusActions } from "./sales-order-status-actions";
import { SalesOrderInternalNotesEditor } from "./sales-order-internal-notes-editor";
import { SalesOrderFinancialPanel } from "./sales-order-financial-panel";

export const dynamic = "force-dynamic";

export default async function VerOrdenVentaPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  const supabase = createSupabaseServerClient();
  const [{ data: soData }, { data: itemsData }, capabilities] = await Promise.all([
    supabase.from("sales_orders").select("*").eq("id", params.id).single(),
    supabase.from("sales_order_items").select("*").eq("sales_order_id", params.id).order("position"),
    getCurrentCapabilities(profile?.userId),
  ]);

  if (!soData) notFound();
  const salesOrder = soData as SalesOrder;
  const items = (itemsData ?? []) as SalesOrderItem[];

  const [{ data: customerData }, { data: salespersonData }] = await Promise.all([
    supabase.from("customers").select("name").eq("id", salesOrder.customer_id).maybeSingle(),
    supabase.from("salespeople").select("name").eq("id", salesOrder.salesperson_id).maybeSingle(),
  ]);

  // VIEW != WRITE (mismo criterio que Quotes): can_view_all_sales amplía
  // qué Sales Orders puede VER un vendedor, pero canWriteRecord nunca
  // conoce esa capacidad. RLS sigue siendo la autoridad final; esto solo
  // evita ofrecer en la UI un control que el backend rechazaría en silencio.
  const canWrite = canWriteRecord(profile, salesOrder.salesperson_id);
  // Autoridad financiera (THÖREN Financial Release, 0068) — completamente
  // separada de canWrite: una persona de Finanzas normalmente NO es dueña
  // comercial de la Sales Order (ver sales_orders_update_finance, 0068).
  const canManageFinance = canManageSalesOrderFinance(profile, capabilities);
  // THÖREN 0069 — Sales Order → Procurement: crear una requisición de
  // compra solo tiene sentido para una Sales Order ya liberada (financiera
  // o parcialmente) para surtido — la elegibilidad REAL la impone
  // trg_check_purchase_requisition_eligible en DB; esto solo evita
  // ofrecer un botón que llevaría a un formulario que la rechazaría.
  const canPrepare = canPreparePurchaseOrders(profile, capabilities);
  const canCreateRequisition = canPrepare && ["released", "partially_released"].includes(salesOrder.fulfillment_release_status);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/ordenes-venta" className="flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          Órdenes de Venta
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && <SalesOrderStatusActions salesOrder={salesOrder} />}
          {canCreateRequisition && (
            <Link
              href={`/requisiciones/nueva?sales_order_id=${salesOrder.id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Crear requisición de compra
            </Link>
          )}
          {salesOrder.status === "draft" && canWrite && (
            <Link
              href={`/ordenes-venta/${salesOrder.id}/editar`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Link>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-mono text-base">{salesOrder.order_number}</CardTitle>
            <p className="mt-1 text-sm text-ink-faint">{customerData?.name ?? "—"}</p>
          </div>
          <StatusBadge status={salesOrder.status} labels={SALES_ORDER_STATUS_LABELS} variants={SALES_ORDER_STATUS_BADGE} />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Cliente</p>
              <p className="text-ink">{customerData?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Vendedor</p>
              <p className="text-ink">{salespersonData?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Fecha</p>
              <p className="text-ink">{formatDateShort(salesOrder.created_at)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Moneda</p>
              <p className="text-ink">{salesOrder.currency}</p>
            </div>
            {salesOrder.exchange_rate != null && (
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-faint">Tipo de cambio</p>
                <p className="text-ink">{salesOrder.exchange_rate}</p>
              </div>
            )}
            {salesOrder.requested_delivery_date && (
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-faint">Fecha requerida</p>
                <p className="text-ink">{formatDateShort(salesOrder.requested_delivery_date)}</p>
              </div>
            )}
            {salesOrder.confirmed_at && (
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-faint">Confirmada</p>
                <p className="text-ink">{formatDateShort(salesOrder.confirmed_at)}</p>
              </div>
            )}
          </div>

          {(salesOrder.payment_terms || salesOrder.customer_contact_snapshot || salesOrder.commercial_notes) && (
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-xs uppercase tracking-wide text-ink-faint">Condiciones comerciales</p>
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                {salesOrder.payment_terms && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-faint">Condición de pago</p>
                    <p className="text-ink">{salesOrder.payment_terms}</p>
                  </div>
                )}
                {salesOrder.customer_contact_snapshot && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-faint">Contacto</p>
                    <p className="text-ink">{salesOrder.customer_contact_snapshot}</p>
                  </div>
                )}
              </div>
              {salesOrder.commercial_notes && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-faint">Notas comerciales</p>
                  <p className="whitespace-pre-wrap text-sm text-ink">{salesOrder.commercial_notes}</p>
                </div>
              )}
            </div>
          )}

          <SalesOrderInternalNotesEditor
            salesOrderId={salesOrder.id}
            initialNotes={salesOrder.internal_notes ?? ""}
            canWrite={canWrite}
          />

          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-ink-faint">Líneas</p>

            <div className="space-y-2 sm:hidden">
              {items.map((item) => (
                <div key={item.id} className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium text-ink">{item.sku_snapshot}</p>
                  {item.description_snapshot && <p className="text-xs text-ink-faint">{item.description_snapshot}</p>}
                  <p className="mt-1 text-xs text-ink-faint">
                    {item.quantity}
                    {item.uom_snapshot ? ` ${item.uom_snapshot}` : ""} × {formatMoneyByCurrency(item.unit_price, salesOrder.currency)}
                    {item.discount > 0 ? ` · -${item.discount}%` : ""}
                    {item.tax > 0 ? ` · +${item.tax}% imp.` : ""}
                  </p>
                  <p className="mt-1 text-right text-sm font-medium text-ink">
                    {formatMoneyByCurrency(item.line_total, salesOrder.currency)}
                  </p>
                </div>
              ))}
            </div>

            <div className="hidden sm:block">
              <Table>
                <Thead>
                  <Tr>
                    <Th>SKU</Th>
                    <Th>Cantidad</Th>
                    <Th>Precio unitario</Th>
                    <Th>Descuento</Th>
                    <Th>Impuesto</Th>
                    <Th>Total</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {items.map((item) => (
                    <Tr key={item.id}>
                      <Td>
                        <p className="font-medium text-ink">{item.sku_snapshot}</p>
                        {item.description_snapshot && <p className="text-xs text-ink-faint">{item.description_snapshot}</p>}
                      </Td>
                      <Td className="text-ink-soft">
                        {item.quantity}
                        {item.uom_snapshot ? ` ${item.uom_snapshot}` : ""}
                      </Td>
                      <Td className="text-ink-soft">{formatMoneyByCurrency(item.unit_price, salesOrder.currency)}</Td>
                      <Td className="text-ink-soft">{item.discount}%</Td>
                      <Td className="text-ink-soft">{item.tax}%</Td>
                      <Td className="text-ink-soft">{formatMoneyByCurrency(item.line_total, salesOrder.currency)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          </div>

          <div className="space-y-1.5 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-faint">Subtotal</span>
              <span className="text-ink">{formatMoneyByCurrency(salesOrder.subtotal, salesOrder.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-faint">Impuestos</span>
              <span className="text-ink">{formatMoneyByCurrency(salesOrder.tax_total, salesOrder.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
              <span className="text-ink">Total</span>
              <span className="text-ink">{formatMoneyByCurrency(salesOrder.total, salesOrder.currency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-5">
        <SalesOrderFinancialPanel salesOrder={salesOrder} canManageFinance={canManageFinance} />
      </div>
    </div>
  );
}
