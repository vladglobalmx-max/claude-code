import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDateShort } from "@/lib/utils/format";
import { PURCHASE_ORDER_STATUS_BADGE, PURCHASE_ORDER_STATUS_LABELS } from "@/types/domain";
import type { PurchaseOrder, PurchaseOrderItem, Supplier } from "@/types/domain";
import { PurchaseOrderStatusActions } from "./status-actions";
import { PurchaseOrderDetailsForm } from "./details-form";
import { ReceiveItemForm } from "./receive-item-form";

export const dynamic = "force-dynamic";

type OneOrMany<T> = T | T[];
function one<T>(value: OneOrMany<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * THÖREN Fase 6L — detalle de una Purchase Order. RLS
 * (purchase_orders_select) ya limita el acceso: si no existe/no es
 * visible, `data` viene null y se muestra 404 — igual que /pedidos/[id].
 */
export default async function CompraDetailPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";
  const supabase = createSupabaseServerClient();

  const { data } = await supabase
    .from("purchase_orders")
    .select("*, supplier:suppliers(*), order:orders(id, folio, business_unit_id, business_units(name))")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();

  const po = data as unknown as PurchaseOrder & {
    supplier: OneOrMany<Supplier> | null;
    order: OneOrMany<{ id: string; folio: string; business_unit_id: string | null; business_units: OneOrMany<{ name: string }> | null }> | null;
  };
  const supplier = one(po.supplier);
  const order = one(po.order);

  const { data: itemsData } = await supabase
    .from("purchase_order_items")
    .select("*")
    .eq("purchase_order_id", po.id)
    .order("position");
  const items = (itemsData ?? []) as PurchaseOrderItem[];

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/compras" className="flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          Compras
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Folio</p>
            <p className="font-mono text-2xl font-bold text-ink">{po.folio}</p>
          </div>
          <StatusBadge status={po.status} labels={PURCHASE_ORDER_STATUS_LABELS} variants={PURCHASE_ORDER_STATUS_BADGE} className="text-sm" />
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-border bg-surface-2/50 p-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-ink-faint">Proveedor</dt>
              <dd className="text-sm font-medium text-ink">{supplier?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Pedido origen</dt>
              <dd className="text-sm font-medium text-ink">
                {order ? (
                  <Link href={`/pedidos/${order.id}`} className="font-mono text-accent hover:underline">
                    {order.folio}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Business Unit</dt>
              <dd className="text-sm font-medium text-ink">{one(order?.business_units)?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Fecha de orden</dt>
              <dd className="text-sm font-medium text-ink">{formatDateShort(po.po_date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Referencia del proveedor</dt>
              <dd className="text-sm font-medium text-ink">{po.supplier_reference ?? "—"}</dd>
            </div>
          </dl>

          {isAdmin && (
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Estado</span>
              <PurchaseOrderStatusActions purchaseOrderId={po.id} status={po.status} />
            </div>
          )}

          {isAdmin ? (
            <PurchaseOrderDetailsForm purchaseOrderId={po.id} purchaseOrder={po} />
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-ink-faint">Fecha compromiso proveedor</dt>
                <dd className="text-sm text-ink">{po.supplier_commitment_date ? formatDateShort(po.supplier_commitment_date) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Fecha estimada de recepción</dt>
                <dd className="text-sm text-ink">{po.estimated_reception_date ? formatDateShort(po.estimated_reception_date) : "—"}</dd>
              </div>
              {po.notes && (
                <div className="col-span-2 sm:col-span-3">
                  <dt className="text-xs text-ink-faint">Notas</dt>
                  <dd className="whitespace-pre-wrap text-sm text-ink">{po.notes}</dd>
                </div>
              )}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Partidas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <Thead>
              <Tr>
                <Th>Modelo</Th>
                <Th>Ordenado</Th>
                <Th>Recibido</Th>
                <Th>Pendiente</Th>
                {isAdmin && <Th />}
              </Tr>
            </Thead>
            <Tbody>
              {items.map((item) => (
                <Tr key={item.id}>
                  <Td>
                    <p className="font-medium text-ink">{item.model}</p>
                    {item.description && <p className="text-xs text-ink-faint">{item.description}</p>}
                    {item.customer_requirements && <p className="text-xs text-ink-faint">Requisitos: {item.customer_requirements}</p>}
                  </Td>
                  <Td className="tabular-nums text-ink-soft">
                    {item.quantity_ordered}
                    {item.unit ? ` ${item.unit}` : ""}
                  </Td>
                  <Td className="tabular-nums text-ink-soft">{item.quantity_received}</Td>
                  <Td className="tabular-nums text-ink-soft">{item.quantity_ordered - item.quantity_received}</Td>
                  {isAdmin && (
                    <Td>
                      <ReceiveItemForm
                        purchaseOrderId={po.id}
                        purchaseOrderItemId={item.id}
                        quantityOrdered={item.quantity_ordered}
                        quantityReceived={item.quantity_received}
                        status={po.status}
                      />
                    </Td>
                  )}
                </Tr>
              ))}
            </Tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
