import Link from "next/link";
import { PackageCheck, Plus } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDateShort, formatNumber } from "@/lib/utils/format";
import { DELIVERY_STATUS_BADGE, DELIVERY_STATUS_LABELS, DELIVERY_TYPE_LABELS } from "@/types/domain";
import type { Delivery, DeliveryItem } from "@/types/domain";

interface DeliverySummaryRow extends Delivery {
  delivery_items: Pick<DeliveryItem, "quantity_delivered">[];
}

/**
 * THÖREN Fase 6P §7 — sección "Entregas / Instalaciones" en el detalle del
 * Pedido. Muestra las Entregas relacionadas (RLS ya limita visibilidad,
 * mismo criterio que el resto de la página) y la acción para crear una
 * nueva usando las partidas ya surtidas. NO cambia operational_status
 * directamente — eso lo hace, cuando corresponde, el trigger de 0039 al
 * completar una Entrega.
 *
 * THÖREN 6R.1B-2B — "Nueva entrega" se muestra por dos vías independientes:
 * `canWrite` (ownership/admin, ver src/lib/auth/ownership.ts) O
 * `canManageDeliveries` (capability logística, ver
 * src/lib/auth/logistics.ts) — cualquiera de las dos basta.
 */
export async function DeliveriesSection({
  orderId,
  orderFolio,
  canWrite,
  canManageDeliveries,
}: {
  orderId: string;
  orderFolio: string;
  canWrite: boolean;
  canManageDeliveries: boolean;
}) {
  const supabase = createSupabaseServerClient();

  const { data } = await supabase
    .from("deliveries")
    .select("*, delivery_items(quantity_delivered)")
    .eq("order_id", orderId)
    .order("sequence_number", { ascending: true });

  const deliveries = (data ?? []) as unknown as DeliverySummaryRow[];

  return (
    <Card className="no-print mb-6">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Entregas / Instalaciones</CardTitle>
        {(canWrite || canManageDeliveries) && (
          <Link href={`/pedidos/${orderId}/nueva-entrega`}>
            <Button size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5" />
              Nueva entrega
            </Button>
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {deliveries.length === 0 ? (
          <EmptyState icon={PackageCheck} title="Sin entregas" description="Este Pedido todavía no tiene entregas registradas." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Entrega</Th>
                <Th>Fecha</Th>
                <Th>Tipo</Th>
                <Th>Estado</Th>
                <Th>Entregado / total</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {deliveries.map((d) => {
                const total = d.delivery_items.reduce((sum, i) => sum + i.quantity_delivered, 0);
                return (
                  <Tr key={d.id}>
                    <Td>
                      <Link href={`/entregas/${d.id}`} className="font-mono text-sm font-medium text-accent hover:underline">
                        {orderFolio}-E{d.sequence_number}
                      </Link>
                    </Td>
                    <Td className="text-ink-soft">{d.scheduled_date ? formatDateShort(d.scheduled_date) : "—"}</Td>
                    <Td className="text-ink-soft">{DELIVERY_TYPE_LABELS[d.delivery_type]}</Td>
                    <Td>
                      <StatusBadge status={d.status} labels={DELIVERY_STATUS_LABELS} variants={DELIVERY_STATUS_BADGE} />
                    </Td>
                    <Td className="tabular-nums text-ink-soft">{formatNumber(total)}</Td>
                    <Td className="text-right">
                      <Link href={`/entregas/${d.id}`} className="text-sm text-accent hover:underline">
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
