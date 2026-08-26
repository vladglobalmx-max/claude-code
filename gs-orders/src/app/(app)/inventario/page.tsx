import Link from "next/link";
import { Boxes } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatNumber } from "@/lib/utils/format";
import { canonicalize } from "@/lib/products/import-parsing";
import type { InventoryCommittedLevel, InventoryIncomingByProduct, InventoryStockLevel, Warehouse } from "@/types/domain";
import { InventoryFilters } from "./inventory-filters";

export const dynamic = "force-dynamic";

interface CatalogRow {
  id: string;
  sku: string;
  name: string;
  model: string | null;
  unit: string | null;
  product_business_units: { business_unit_id: string }[] | null;
}

interface InventoryRow {
  productId: string;
  sku: string;
  name: string;
  model: string | null;
  unit: string | null;
  businessUnitNames: string;
  warehouseId: string;
  warehouseName: string;
  onHand: number;
  committed: number;
  available: number;
  incoming: number;
}

/**
 * THÖREN Fase 6M — vista principal de Inventory: una fila por producto ×
 * almacén activo (cross-join en JS, mismo criterio que /configuracion/
 * catalogo: escala de un distribuidor interno, no millones de filas).
 * ON HAND/COMMITTED/INCOMING se DERIVAN vía RPC (rpc_inventory_stock_levels /
 * rpc_inventory_committed_levels / rpc_inventory_incoming_by_product) —
 * nunca se cachean aquí. COMMITTED = suma de reservas ACTIVAS por producto
 * × almacén (THÖREN Fase 6N, 0037_inventory_reservations.sql). INCOMING es
 * por producto (todavía no tiene almacén asignado) — se repite en cada
 * fila de almacén de ese producto, documentado en la propia columna.
 */
export default async function InventarioPage({
  searchParams,
}: {
  searchParams: { q?: string; almacen?: string; bu?: string };
}) {
  const supabase = createSupabaseServerClient();

  const [
    { data: productsData },
    { data: businessUnitsData },
    { data: warehousesData },
    { data: onHandData },
    { data: committedData },
    { data: incomingData },
  ] = await Promise.all([
    supabase
      .from("product_catalog")
      .select("id, sku, name, model, unit, product_business_units(business_unit_id)")
      .eq("active", true)
      .order("sku"),
    supabase.from("business_units").select("id, name").eq("active", true).order("name"),
    supabase.from("warehouses").select("*").eq("active", true).order("name"),
    supabase.rpc("rpc_inventory_stock_levels"),
    supabase.rpc("rpc_inventory_committed_levels"),
    supabase.rpc("rpc_inventory_incoming_by_product"),
  ]);

  const products = (productsData ?? []) as unknown as CatalogRow[];
  const businessUnits = (businessUnitsData ?? []) as { id: string; name: string }[];
  const warehouses = (warehousesData ?? []) as Warehouse[];
  const onHandLevels = (onHandData ?? []) as InventoryStockLevel[];
  const committedLevels = (committedData ?? []) as InventoryCommittedLevel[];
  const incomingByProduct = (incomingData ?? []) as InventoryIncomingByProduct[];

  const onHandMap = new Map(onHandLevels.map((l) => [`${l.product_id}:${l.warehouse_id}`, l.on_hand]));
  const committedMap = new Map(committedLevels.map((l) => [`${l.product_id}:${l.warehouse_id}`, l.committed]));
  const incomingMap = new Map(incomingByProduct.map((i) => [i.product_id, i.incoming]));
  const businessUnitNameById = new Map(businessUnits.map((bu) => [bu.id, bu.name]));

  let rows: InventoryRow[] = [];
  for (const product of products) {
    const buRows = product.product_business_units ?? [];
    const businessUnitNames =
      buRows.length === 0 ? "Todas" : buRows.map((r) => businessUnitNameById.get(r.business_unit_id)).filter(Boolean).join(", ") || "—";

    for (const warehouse of warehouses) {
      const onHand = onHandMap.get(`${product.id}:${warehouse.id}`) ?? 0;
      const committed = committedMap.get(`${product.id}:${warehouse.id}`) ?? 0;
      rows.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        model: product.model,
        unit: product.unit,
        businessUnitNames,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        onHand,
        committed,
        available: onHand - committed,
        incoming: incomingMap.get(product.id) ?? 0,
      });
    }
  }

  if (searchParams.almacen) {
    rows = rows.filter((r) => r.warehouseId === searchParams.almacen);
  }
  if (searchParams.bu) {
    rows = rows.filter((r) => {
      const product = products.find((p) => p.id === r.productId);
      const buRows = product?.product_business_units ?? [];
      return buRows.length === 0 || buRows.some((br) => br.business_unit_id === searchParams.bu);
    });
  }
  if (searchParams.q) {
    const q = canonicalize(searchParams.q.trim());
    rows = rows.filter((r) => canonicalize([r.sku, r.name, r.model ?? ""].join(" ")).includes(q));
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Inventario" description="On Hand, Available e Incoming por producto y almacén." />

      <InventoryFilters warehouses={warehouses} businessUnits={businessUnits} />

      {warehouses.length === 0 ? (
        <Card>
          <EmptyState
            icon={Boxes}
            title="Sin almacenes"
            description="Crea al menos un almacén en /almacenes para empezar a llevar inventario."
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={Boxes} title="Sin resultados" description="Ajusta la búsqueda o los filtros." />
        </Card>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {rows.map((r) => (
              <Card key={`${r.productId}-${r.warehouseId}`} className="p-4">
                <Link href={`/inventario/${r.productId}`} className="block">
                  <p className="truncate text-sm font-medium text-ink">{r.name}</p>
                  <p className="font-mono text-xs text-ink-faint">{r.sku}</p>
                </Link>
                <p className="mt-1 text-xs text-ink-faint">
                  {r.warehouseName} · {r.businessUnitNames}
                </p>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
                  <div>
                    <p className="text-ink-faint">On Hand</p>
                    <p className="font-semibold text-ink">{formatNumber(r.onHand)}</p>
                  </div>
                  <div>
                    <p className="text-ink-faint">Committed</p>
                    <p className="font-semibold text-ink">{formatNumber(r.committed)}</p>
                  </div>
                  <div>
                    <p className="text-ink-faint">Available</p>
                    <p className="font-semibold text-ink">{formatNumber(r.available)}</p>
                  </div>
                  <div>
                    <p className="text-ink-faint">Incoming</p>
                    <p className="font-semibold text-ink">{formatNumber(r.incoming)}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="hidden overflow-hidden sm:block">
            <Table>
              <Thead>
                <Tr>
                  <Th>Producto</Th>
                  <Th>SKU</Th>
                  <Th>Business Unit(s)</Th>
                  <Th>Almacén</Th>
                  <Th>Unidad</Th>
                  <Th>On Hand</Th>
                  <Th>Committed</Th>
                  <Th>Available</Th>
                  <Th>Incoming</Th>
                </Tr>
              </Thead>
              <Tbody>
                {rows.map((r) => (
                  <Tr key={`${r.productId}-${r.warehouseId}`}>
                    <Td>
                      <Link href={`/inventario/${r.productId}`} className="font-medium text-accent hover:underline">
                        {r.name}
                      </Link>
                      {r.model && <p className="text-xs text-ink-faint">{r.model}</p>}
                    </Td>
                    <Td className="font-mono text-ink-soft">{r.sku}</Td>
                    <Td className="text-ink-soft">{r.businessUnitNames}</Td>
                    <Td className="text-ink-soft">{r.warehouseName}</Td>
                    <Td className="text-ink-soft">{r.unit ?? "—"}</Td>
                    <Td className="tabular-nums">{formatNumber(r.onHand)}</Td>
                    <Td className="tabular-nums text-ink-soft">{formatNumber(r.committed)}</Td>
                    <Td className="tabular-nums font-medium">{formatNumber(r.available)}</Td>
                    <Td className="tabular-nums text-ink-soft">{formatNumber(r.incoming)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
