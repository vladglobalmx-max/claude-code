import { Boxes } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { InventoryCommittedLevel, InventoryReservation, InventoryStockLevel, Warehouse } from "@/types/domain";
import { ReservationRow } from "./reservation-row";

type OneOrMany<T> = T | T[];
function one<T>(value: OneOrMany<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

interface OrderItemProductRow {
  catalog_product_id: string | null;
  product: OneOrMany<{ id: string; sku: string; name: string; unit: string | null }> | null;
}

export interface ReservationRowData {
  productId: string;
  sku: string;
  name: string;
  unit: string | null;
  reservation: InventoryReservation | null;
  reservationWarehouseName: string | null;
  // AVAILABLE por almacén (on_hand - committed) y ON HAND real (sin
  // ajustar) — este último es el tope real de SURTIR (Fase 6O). Para el
  // almacén de la reserva activa (si existe), `available` YA incluye de
  // vuelta el PENDIENTE de esa misma reserva (on_hand - (committed -
  // pendiente)) — es el tope real al que se puede AUMENTAR, no el
  // disponible "para alguien más".
  availability: { warehouseId: string; warehouseName: string; available: number; onHand: number }[];
  // THÖREN Fase 6N — AJUSTE FINAL: true cuando este producto ya NO está
  // entre las partidas actuales del Pedido (se eliminó/editó), pero la
  // reserva sigue activa — ver DECISIÓN abajo.
  isOrphaned: boolean;
}

/**
 * THÖREN Fase 6N §3/6, extendido en Fase 6O — sección "Reservas de
 * Inventario" en el detalle del Pedido: para cada producto de catálogo de
 * este Pedido (líneas manuales sin catalog_product_id no aparecen aquí,
 * requisito #4), permite reservar/aumentar/reducir/liberar/surtir.
 * Visible para quien ya puede ver este Pedido (RLS de `orders`) — desde
 * THÖREN 6R.1B-1 (can_view_all_sales, 0041) eso ya NO implica ser ADMIN o
 * el vendedor dueño (premisa original de 0037, ahora inválida): `canWrite`
 * (calculado en pedidos/[id]/page.tsx vía canWriteRecord, ver
 * src/lib/auth/ownership.ts) se propaga hasta ReservationRow para ocultar
 * reservar/ajustar/liberar/surtir cuando el Pedido no es propio ni el
 * usuario es admin — la lectura de reservas/disponibilidad nunca se oculta.
 *
 * DECISIÓN (AJUSTE FINAL 6N, reforzada en 6O) — reservas "huérfanas":
 * editar el Pedido borra y reinserta order_items (rpc_update_order, 0034)
 * sin tocar inventory_reservations (la reserva es por order_id+product_id,
 * nunca por order_item_id — ver 0037). Si el producto reservado deja de
 * estar entre las partidas actuales, la reserva NO se libera ni se borra
 * automáticamente (ninguna lógica destructiva): se sigue calculando desde
 * `reservations` (fuente real vía RLS/RPC, no desde `items`) y se marca
 * `isOrphaned` para que la UI la señale como "Reserva sin partida activa" y
 * quede visible para que ADMIN/propietario decida — liberarla sigue
 * funcionando con total normalidad, pero surtirla queda bloqueado
 * server-side (rpc_fulfill_inventory_reservation, requisito #8 de 6O).
 */
export async function ReservationsSection({ orderId, canWrite }: { orderId: string; canWrite: boolean }) {
  const supabase = createSupabaseServerClient();

  const [{ data: itemsData }, { data: warehousesData }, { data: reservationsData }, { data: onHandData }, { data: committedData }] =
    await Promise.all([
      supabase
        .from("order_items")
        .select("catalog_product_id, product:product_catalog(id, sku, name, unit)")
        .eq("order_id", orderId)
        .not("catalog_product_id", "is", null),
      supabase.from("warehouses").select("*").eq("active", true).order("name"),
      supabase.from("inventory_reservations").select("*, warehouse:warehouses(name)").eq("order_id", orderId).is("released_at", null),
      supabase.rpc("rpc_inventory_stock_levels"),
      supabase.rpc("rpc_inventory_committed_levels"),
    ]);

  const items = (itemsData ?? []) as unknown as OrderItemProductRow[];
  const warehouses = (warehousesData ?? []) as Warehouse[];
  const reservations = (reservationsData ?? []) as unknown as (InventoryReservation & { warehouse: OneOrMany<{ name: string }> | null })[];
  const onHandLevels = (onHandData ?? []) as InventoryStockLevel[];
  const committedLevels = (committedData ?? []) as InventoryCommittedLevel[];

  const onHandMap = new Map(onHandLevels.map((l) => [`${l.product_id}:${l.warehouse_id}`, l.on_hand]));
  const committedMap = new Map(committedLevels.map((l) => [`${l.product_id}:${l.warehouse_id}`, l.committed]));
  const reservationByProduct = new Map(reservations.map((r) => [r.product_id, r]));

  // Un mismo producto puede aparecer en varias partidas del Pedido — la
  // reserva es por producto, no por partida (requisito #3: "para cada
  // producto de catálogo"), así que se deduplica aquí.
  const productsById = new Map<string, { id: string; sku: string; name: string; unit: string | null }>();
  for (const item of items) {
    const product = one(item.product);
    if (product) productsById.set(product.id, product);
  }

  // Reservas activas cuyo producto YA NO está entre las partidas actuales
  // — huérfanas (ver DECISIÓN arriba). Se resuelve su ficha de catálogo
  // aparte porque order_items ya no las referencia.
  const orphanProductIds = reservations.map((r) => r.product_id).filter((id) => !productsById.has(id));
  if (orphanProductIds.length > 0) {
    const { data: orphanProductsData } = await supabase
      .from("product_catalog")
      .select("id, sku, name, unit")
      .in("id", orphanProductIds);
    for (const product of (orphanProductsData ?? []) as { id: string; sku: string; name: string; unit: string | null }[]) {
      productsById.set(product.id, product);
    }
  }
  const orphanProductIdSet = new Set(orphanProductIds);

  const rows: ReservationRowData[] = Array.from(productsById.values()).map((product) => {
    const reservation = reservationByProduct.get(product.id) ?? null;
    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      reservation,
      reservationWarehouseName: reservation ? (one(reservation.warehouse)?.name ?? null) : null,
      availability: warehouses.map((w) => {
        const onHand = onHandMap.get(`${product.id}:${w.id}`) ?? 0;
        const committed = committedMap.get(`${product.id}:${w.id}`) ?? 0;
        const ownPendingHere =
          reservation && reservation.warehouse_id === w.id ? reservation.quantity - reservation.fulfilled_quantity : 0;
        return { warehouseId: w.id, warehouseName: w.name, available: onHand - committed + ownPendingHere, onHand };
      }),
      isOrphaned: orphanProductIdSet.has(product.id),
    };
  });

  return (
    <Card className="no-print mb-6">
      <CardHeader>
        <CardTitle>Reservas de Inventario</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="Sin productos de catálogo"
            description="Este Pedido no tiene partidas vinculadas al Catálogo de Productos — solo esas se pueden reservar."
          />
        ) : (
          rows.map((row) => <ReservationRow key={row.productId} orderId={orderId} row={row} canWrite={canWrite} />)
        )}
      </CardContent>
    </Card>
  );
}
