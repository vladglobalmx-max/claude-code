import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDateShort } from "@/lib/utils/format";
import { PURCHASE_ORDER_STATUS_BADGE, PURCHASE_ORDER_STATUS_LABELS } from "@/types/domain";
import type { PurchaseOrderStatus } from "@/types/domain";

type OneOrMany<T> = T | T[];
function one<T>(value: OneOrMany<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

interface PurchaseOrderSummaryRow {
  id: string;
  folio: string;
  status: PurchaseOrderStatus;
  supplier_commitment_date: string | null;
  supplier: OneOrMany<{ name: string }> | null;
  purchase_order_items: { quantity_ordered: number; quantity_received: number }[];
}

/**
 * THÖREN Fase 6L §5, autoridad actualizada en 6R.1B-3B — sección "Compras /
 * Proveedores" en el detalle del Pedido. Muestra las Purchase Orders
 * relacionadas (RLS ya limita visibilidad — mismo criterio que el resto de
 * la página) y, si `canPrepare` (admin OR can_prepare_purchase_orders,
 * ver src/lib/auth/purchase-orders.ts), la acción para crear una nueva
 * usando sus partidas — preparar una OC desde un Pedido ajeno es válido
 * para Karla/Rodolfo (0045: sin ownership de OC ni del Pedido). NO cambia
 * operational_status del Pedido — fuera de alcance explícito de esta fase.
 */
export async function PurchaseOrdersSection({ orderId, canPrepare }: { orderId: string; canPrepare: boolean }) {
  const supabase = createSupabaseServerClient();

  const { data } = await supabase
    .from("purchase_orders")
    .select("id, folio, status, supplier_commitment_date, supplier:suppliers(name), purchase_order_items(quantity_ordered, quantity_received)")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  const purchaseOrders = (data ?? []) as unknown as PurchaseOrderSummaryRow[];

  return (
    <Card className="no-print mb-6">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Compras / Proveedores</CardTitle>
        {canPrepare && (
          <Link href={`/pedidos/${orderId}/nueva-compra`}>
            <Button size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5" />
              Nueva Purchase Order
            </Button>
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {purchaseOrders.length === 0 ? (
          <EmptyState icon={Package} title="Sin Purchase Orders" description="Este Pedido todavía no tiene compras generadas." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Folio</Th>
                <Th>Proveedor</Th>
                <Th>Estado</Th>
                <Th>Fecha compromiso</Th>
                <Th>Recepción</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {purchaseOrders.map((po) => {
                const supplier = one(po.supplier);
                const ordered = po.purchase_order_items.reduce((sum, i) => sum + i.quantity_ordered, 0);
                const received = po.purchase_order_items.reduce((sum, i) => sum + i.quantity_received, 0);
                return (
                  <Tr key={po.id}>
                    <Td>
                      <Link href={`/compras/${po.id}`} className="font-mono text-sm font-medium text-accent hover:underline">
                        {po.folio}
                      </Link>
                    </Td>
                    <Td>{supplier?.name ?? "—"}</Td>
                    <Td>
                      <StatusBadge status={po.status} labels={PURCHASE_ORDER_STATUS_LABELS} variants={PURCHASE_ORDER_STATUS_BADGE} />
                    </Td>
                    <Td className="text-ink-soft">{po.supplier_commitment_date ? formatDateShort(po.supplier_commitment_date) : "—"}</Td>
                    <Td className="tabular-nums text-ink-soft">
                      {received}/{ordered}
                    </Td>
                    <Td className="text-right">
                      <Link href={`/compras/${po.id}`} className="text-sm text-accent hover:underline">
                        Ver
                      </Link>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
