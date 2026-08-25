import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateShort, formatDateTime, formatNumber } from "@/lib/utils/format";
import { INVENTORY_MOVEMENT_TYPE_LABELS } from "@/types/domain";
import type { InventoryIncomingDetail, InventoryMovement, InventoryStockLevel, Warehouse } from "@/types/domain";
import { ManualMovementForm } from "./manual-movement-form";

export const dynamic = "force-dynamic";

type OneOrMany<T> = T | T[];
function one<T>(value: OneOrMany<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

interface ProductRow {
  id: string;
  sku: string;
  name: string;
  model: string | null;
  unit: string | null;
}

interface MovementRow extends InventoryMovement {
  warehouse: OneOrMany<{ name: string }> | null;
  purchase_order: OneOrMany<{ folio: string }> | null;
}

/**
 * THÖREN Fase 6M §8 — detalle/kardex de un producto: existencia por
 * almacén, On Hand/Committed/Available/Incoming, e historial cronológico
 * de movimientos. Cada movimiento de compra permite identificar su
 * Purchase Order (join, nunca duplicado). Movimientos manuales solo ADMIN.
 */
export default async function InventarioDetallePage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";
  const supabase = createSupabaseServerClient();

  const { data: productData } = await supabase
    .from("product_catalog")
    .select("id, sku, name, model, unit")
    .eq("id", params.id)
    .maybeSingle();
  if (!productData) notFound();
  const product = productData as ProductRow;

  const [{ data: warehousesData }, { data: levelsData }, { data: incomingData }, { data: movementsData }] = await Promise.all([
    supabase.from("warehouses").select("*").eq("active", true).order("name"),
    supabase.rpc("rpc_inventory_stock_levels", { p_product_id: product.id }),
    supabase.rpc("rpc_inventory_incoming_detail", { p_product_id: product.id }),
    supabase
      .from("inventory_movements")
      .select("*, warehouse:warehouses(name), purchase_order:purchase_orders(folio)")
      .eq("product_id", product.id)
      .order("created_at", { ascending: false }),
  ]);

  const warehouses = (warehousesData ?? []) as Warehouse[];
  const levels = (levelsData ?? []) as InventoryStockLevel[];
  const incomingDetail = (incomingData ?? []) as InventoryIncomingDetail[];
  const movements = (movementsData ?? []) as unknown as MovementRow[];

  const onHandByWarehouse = new Map(levels.map((l) => [l.warehouse_id, l.on_hand]));
  const totalOnHand = levels.reduce((sum, l) => sum + l.on_hand, 0);
  const totalCommitted = 0;
  const totalIncoming = incomingDetail.reduce((sum, d) => sum + d.quantity_pending, 0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link href="/inventario" className="mb-6 flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Inventario
      </Link>

      <PageHeader
        title={product.name}
        description={`SKU ${product.sku}${product.model ? ` · ${product.model}` : ""}${product.unit ? ` · Unidad: ${product.unit}` : ""}`}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 text-center">
          <p className="text-xs text-ink-faint">On Hand</p>
          <p className="text-2xl font-semibold text-ink">{formatNumber(totalOnHand)}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-ink-faint">Committed</p>
          <p className="text-2xl font-semibold text-ink">{formatNumber(totalCommitted)}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-ink-faint">Available</p>
          <p className="text-2xl font-semibold text-ink">{formatNumber(totalOnHand - totalCommitted)}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-ink-faint">Incoming</p>
          <p className="text-2xl font-semibold text-ink">{formatNumber(totalIncoming)}</p>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Existencia por almacén</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {warehouses.length === 0 ? (
            <EmptyState icon={History} title="Sin almacenes" description="Crea un almacén en /almacenes." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Almacén</Th>
                  <Th>On Hand</Th>
                </Tr>
              </Thead>
              <Tbody>
                {warehouses.map((w) => (
                  <Tr key={w.id}>
                    <Td>{w.name}</Td>
                    <Td className="tabular-nums">{formatNumber(onHandByWarehouse.get(w.id) ?? 0)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Registrar movimiento manual</CardTitle>
          </CardHeader>
          <CardContent>
            <ManualMovementForm productId={product.id} warehouses={warehouses} />
          </CardContent>
        </Card>
      )}

      {incomingDetail.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Incoming — en camino</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <Thead>
                <Tr>
                  <Th>Purchase Order</Th>
                  <Th>Proveedor</Th>
                  <Th>Pedido origen</Th>
                  <Th>Pendiente</Th>
                  <Th>Fecha compromiso</Th>
                  <Th>Fecha estimada</Th>
                </Tr>
              </Thead>
              <Tbody>
                {incomingDetail.map((d) => (
                  <Tr key={d.purchase_order_id}>
                    <Td>
                      <Link href={`/compras/${d.purchase_order_id}`} className="font-mono text-accent hover:underline">
                        {d.purchase_order_folio}
                      </Link>
                    </Td>
                    <Td>{d.supplier_name}</Td>
                    <Td>
                      <Link href={`/pedidos/${d.order_id}`} className="font-mono text-accent hover:underline">
                        {d.order_folio}
                      </Link>
                    </Td>
                    <Td className="tabular-nums">{formatNumber(d.quantity_pending)}</Td>
                    <Td className="text-ink-soft">{d.supplier_commitment_date ? formatDateShort(d.supplier_commitment_date) : "—"}</Td>
                    <Td className="text-ink-soft">{d.estimated_reception_date ? formatDateShort(d.estimated_reception_date) : "—"}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historial de movimientos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {movements.length === 0 ? (
            <EmptyState icon={History} title="Sin movimientos" description="Este producto todavía no tiene movimientos de inventario." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Fecha</Th>
                  <Th>Tipo</Th>
                  <Th>Almacén</Th>
                  <Th>Cantidad</Th>
                  <Th>Origen</Th>
                  <Th>Usuario</Th>
                </Tr>
              </Thead>
              <Tbody>
                {movements.map((m) => {
                  const warehouse = one(m.warehouse);
                  const po = one(m.purchase_order);
                  return (
                    <Tr key={m.id}>
                      <Td className="text-ink-soft">{formatDateTime(m.created_at)}</Td>
                      <Td>
                        <Badge variant={m.quantity_delta > 0 ? "success" : "danger"}>{INVENTORY_MOVEMENT_TYPE_LABELS[m.movement_type]}</Badge>
                      </Td>
                      <Td className="text-ink-soft">{warehouse?.name ?? "—"}</Td>
                      <Td className="tabular-nums font-medium">
                        {m.quantity_delta > 0 ? "+" : ""}
                        {formatNumber(m.quantity_delta)}
                      </Td>
                      <Td className="text-ink-soft">
                        {po && m.purchase_order_id ? (
                          <Link href={`/compras/${m.purchase_order_id}`} className="font-mono text-accent hover:underline">
                            {po.folio}
                          </Link>
                        ) : (
                          m.reference ?? "—"
                        )}
                      </Td>
                      <Td className="text-ink-soft">{m.created_by_name}</Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
