import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { canManageSalesFulfillment } from "@/lib/auth/logistics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDateShort, formatDateTime } from "@/lib/utils/format";
import { SALES_FULFILLMENT_STATUS_BADGE, SALES_FULFILLMENT_STATUS_LABELS } from "@/types/domain";
import type { SalesFulfillment, SalesFulfillmentEvent, SalesFulfillmentItem } from "@/types/domain";
import { SalesFulfillmentStatusActions } from "./status-actions";

export const dynamic = "force-dynamic";

/**
 * THÖREN 0071 — detalle de un surtido. RLS (sales_fulfillments_select) ya
 * acota la visibilidad: si no existe/no es visible para el usuario, `data`
 * viene null -> 404 (mismo criterio que /requisiciones/[id]/[recepciones]/[id]).
 */
export default async function SurtidoDetailPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  const capabilities = await getCurrentCapabilities(profile?.userId);
  const canManage = canManageSalesFulfillment(profile, capabilities);
  const supabase = createSupabaseServerClient();

  const { data } = await supabase.from("sales_fulfillments").select("*").eq("id", params.id).maybeSingle();
  if (!data) notFound();
  const fulfillment = data as SalesFulfillment;

  const [{ data: soData }, { data: warehouseData }, { data: itemsData }, { data: eventsData }] = await Promise.all([
    supabase
      .from("sales_orders")
      .select("id, order_number, customer_id, shipping_address_snapshot, customer_contact_snapshot")
      .eq("id", fulfillment.sales_order_id)
      .maybeSingle(),
    supabase.from("warehouses").select("name").eq("id", fulfillment.warehouse_id).maybeSingle(),
    supabase.from("sales_fulfillment_items").select("*").eq("sales_fulfillment_id", fulfillment.id).order("created_at"),
    supabase.from("sales_fulfillment_events").select("*").eq("sales_fulfillment_id", fulfillment.id).order("created_at"),
  ]);
  const items = (itemsData ?? []) as SalesFulfillmentItem[];
  const events = (eventsData ?? []) as SalesFulfillmentEvent[];

  const { data: customerData } = soData
    ? await supabase.from("customers").select("name").eq("id", soData.customer_id).maybeSingle()
    : { data: null };
  const customerName = customerData?.name ?? null;

  const catalogProductIds = Array.from(new Set(items.map((i) => i.catalog_product_id).filter((id): id is string => !!id)));
  const { data: stockData } = catalogProductIds.length
    ? await supabase
        .from("inventory_movements")
        .select("product_id, quantity_delta")
        .eq("warehouse_id", fulfillment.warehouse_id)
        .in("product_id", catalogProductIds)
    : { data: [] };
  const stockByProduct = new Map<string, number>();
  for (const row of (stockData ?? []) as { product_id: string; quantity_delta: number }[]) {
    stockByProduct.set(row.product_id, (stockByProduct.get(row.product_id) ?? 0) + row.quantity_delta);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/surtidos" className="flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          Surtidos
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Surtido</p>
            <p className="font-mono text-2xl font-bold text-ink">{fulfillment.fulfillment_number}</p>
          </div>
          <StatusBadge
            status={fulfillment.status}
            labels={SALES_FULFILLMENT_STATUS_LABELS}
            variants={SALES_FULFILLMENT_STATUS_BADGE}
            className="text-sm"
          />
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
              <dd className="text-sm font-medium text-ink">{customerName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Almacén</dt>
              <dd className="text-sm font-medium text-ink">{warehouseData?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Dirección de entrega</dt>
              <dd className="text-sm font-medium text-ink">{soData?.shipping_address_snapshot ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Contacto</dt>
              <dd className="text-sm font-medium text-ink">{fulfillment.delivery_contact ?? soData?.customer_contact_snapshot ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Fecha de salida</dt>
              <dd className="text-sm font-medium text-ink">{fulfillment.shipped_at ? formatDateShort(fulfillment.shipped_at) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Fecha de entrega</dt>
              <dd className="text-sm font-medium text-ink">{fulfillment.delivered_at ? formatDateShort(fulfillment.delivered_at) : "—"}</dd>
            </div>
            {fulfillment.delivery_notes && (
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-xs text-ink-faint">Notas</dt>
                <dd className="whitespace-pre-wrap text-sm text-ink">{fulfillment.delivery_notes}</dd>
              </div>
            )}
          </dl>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <SalesFulfillmentStatusActions
              fulfillmentId={fulfillment.id}
              fulfillmentNumber={fulfillment.fulfillment_number}
              status={fulfillment.status}
              canManage={canManage}
            />
            {fulfillment.status === "draft" && canManage && (
              <Link href={`/surtidos/${fulfillment.id}/editar`} className="text-sm text-accent hover:underline">
                Editar líneas
              </Link>
            )}
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
                <Th>A surtir</Th>
                <Th>Surtido</Th>
                <Th>Stock disponible</Th>
              </Tr>
            </Thead>
            <Tbody>
              {items.map((item) => (
                <Tr key={item.id}>
                  <Td className="font-medium text-ink">{item.description_snapshot}</Td>
                  <Td className="tabular-nums text-ink-soft">
                    {item.quantity_requested}
                    {item.uom_snapshot ? ` ${item.uom_snapshot}` : ""}
                  </Td>
                  <Td className="tabular-nums text-ink-soft">{item.quantity_fulfilled}</Td>
                  <Td className="tabular-nums text-ink-soft">
                    {item.catalog_product_id ? (stockByProduct.get(item.catalog_product_id) ?? 0) : "—"}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
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
