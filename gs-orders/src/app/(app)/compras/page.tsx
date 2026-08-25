import Link from "next/link";
import { Package } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDateShort } from "@/lib/utils/format";
import { PURCHASE_ORDER_STATUS_BADGE, PURCHASE_ORDER_STATUS_LABELS } from "@/types/domain";
import type { PurchaseOrderStatus, Supplier } from "@/types/domain";
import { PurchaseOrderFilters } from "./purchase-order-filters";

export const dynamic = "force-dynamic";

type OneOrMany<T> = T | T[];
function one<T>(value: OneOrMany<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

interface PurchaseOrderRow {
  id: string;
  folio: string;
  status: PurchaseOrderStatus;
  supplier_commitment_date: string | null;
  estimated_reception_date: string | null;
  supplier: OneOrMany<{ name: string }> | null;
  order: OneOrMany<{ id: string; folio: string; business_unit_id: string | null; business_units: OneOrMany<{ name: string }> | null }> | null;
}

/**
 * THÖREN Fase 6L — listado principal de "Compras". RLS
 * (purchase_orders_select, 0035) ya limita: ADMIN ve todas las de su
 * organización, VENDEDOR solo las de Pedidos que le pertenecen —
 * visibilidad heredada, nunca un filtro adicional aquí.
 */
export default async function ComprasPage({
  searchParams,
}: {
  searchParams: { q?: string; estado?: string; proveedor?: string; bu?: string };
}) {
  const supabase = createSupabaseServerClient();

  const [{ data: suppliersData }, { data: businessUnitsData }] = await Promise.all([
    supabase.from("suppliers").select("*").order("name"),
    supabase.from("business_units").select("id, name").eq("active", true).order("name"),
  ]);
  const suppliers = (suppliersData ?? []) as Supplier[];
  const businessUnits = (businessUnitsData ?? []) as { id: string; name: string }[];

  let query = supabase
    .from("purchase_orders")
    .select(
      searchParams.bu
        ? "id, folio, status, supplier_commitment_date, estimated_reception_date, supplier:suppliers(name), order:orders!inner(id, folio, business_unit_id, business_units(name))"
        : "id, folio, status, supplier_commitment_date, estimated_reception_date, supplier:suppliers(name), order:orders(id, folio, business_unit_id, business_units(name))"
    )
    .order("created_at", { ascending: false });

  if (searchParams.estado) query = query.eq("status", searchParams.estado);
  if (searchParams.proveedor) query = query.eq("supplier_id", searchParams.proveedor);
  if (searchParams.bu) query = query.eq("order.business_unit_id", searchParams.bu);

  const { data } = await query.limit(200);
  let purchaseOrders = (data ?? []) as unknown as PurchaseOrderRow[];

  if (searchParams.q) {
    const q = searchParams.q.trim().toLowerCase();
    purchaseOrders = purchaseOrders.filter((po) => {
      const supplierName = one(po.supplier)?.name ?? "";
      const orderFolio = one(po.order)?.folio ?? "";
      return po.folio.toLowerCase().includes(q) || supplierName.toLowerCase().includes(q) || orderFolio.toLowerCase().includes(q);
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Compras" description="Purchase Orders generadas desde los Pedidos, por proveedor." />

      <PurchaseOrderFilters suppliers={suppliers} businessUnits={businessUnits} />

      {purchaseOrders.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title="No hay Purchase Orders que coincidan"
            description="Ajusta la búsqueda o los filtros, o crea una desde el detalle de un Pedido."
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {purchaseOrders.map((po) => {
              const order = one(po.order);
              const supplier = one(po.supplier);
              return (
                <Card key={po.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/compras/${po.id}`} className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium text-accent">{po.folio}</p>
                      <p className="mt-0.5 truncate text-sm font-medium text-ink">{supplier?.name ?? "—"}</p>
                    </Link>
                    <StatusBadge status={po.status} labels={PURCHASE_ORDER_STATUS_LABELS} variants={PURCHASE_ORDER_STATUS_BADGE} />
                  </div>
                  <p className="mt-2 text-xs text-ink-faint">
                    Pedido {order ? <Link href={`/pedidos/${order.id}`} className="font-mono text-accent hover:underline">{order.folio}</Link> : "—"}
                    {" · "}
                    {one(order?.business_units)?.name ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    Compromiso: {po.supplier_commitment_date ? formatDateShort(po.supplier_commitment_date) : "—"}
                  </p>
                </Card>
              );
            })}
          </div>

          <Card className="hidden overflow-hidden sm:block">
            <Table>
              <Thead>
                <Tr>
                  <Th>Folio</Th>
                  <Th>Proveedor</Th>
                  <Th>Pedido</Th>
                  <Th>Business Unit</Th>
                  <Th>Estado</Th>
                  <Th>Fecha compromiso</Th>
                  <Th>Recepción estimada</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {purchaseOrders.map((po) => {
                  const order = one(po.order);
                  const supplier = one(po.supplier);
                  return (
                    <Tr key={po.id}>
                      <Td>
                        <Link href={`/compras/${po.id}`} className="font-mono text-sm font-medium text-accent hover:underline">
                          {po.folio}
                        </Link>
                      </Td>
                      <Td>{supplier?.name ?? "—"}</Td>
                      <Td className="text-ink-soft">
                        {order ? (
                          <Link href={`/pedidos/${order.id}`} className="font-mono text-accent hover:underline">
                            {order.folio}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="text-ink-soft">{one(order?.business_units)?.name ?? "—"}</Td>
                      <Td>
                        <StatusBadge status={po.status} labels={PURCHASE_ORDER_STATUS_LABELS} variants={PURCHASE_ORDER_STATUS_BADGE} />
                      </Td>
                      <Td className="text-ink-soft">
                        {po.supplier_commitment_date ? formatDateShort(po.supplier_commitment_date) : "—"}
                      </Td>
                      <Td className="text-ink-soft">
                        {po.estimated_reception_date ? formatDateShort(po.estimated_reception_date) : "—"}
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
          </Card>
        </>
      )}
    </div>
  );
}
