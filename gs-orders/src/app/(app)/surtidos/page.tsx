import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDateShort } from "@/lib/utils/format";
import { SALES_FULFILLMENT_STATUS_BADGE, SALES_FULFILLMENT_STATUS_LABELS } from "@/types/domain";
import type { SalesFulfillment } from "@/types/domain";

export const dynamic = "force-dynamic";

/**
 * Lista de Surtidos (THÖREN Fulfillment/Picking/Delivery MVP, 0071).
 * Visibilidad por RLS (sales_fulfillments_select): admin,
 * can_manage_sales_fulfillment o can_view_all_sales — sin filtro extra
 * aquí, RLS ya acota a la organización.
 */
export default async function SurtidosPage() {
  const supabase = createSupabaseServerClient();

  const { data } = await supabase.from("sales_fulfillments").select("*").order("created_at", { ascending: false }).limit(200);
  const fulfillments = (data ?? []) as SalesFulfillment[];

  const salesOrderIds = Array.from(new Set(fulfillments.map((f) => f.sales_order_id)));
  const { data: salesOrdersData } = salesOrderIds.length
    ? await supabase.from("sales_orders").select("id, order_number, customer_id").in("id", salesOrderIds)
    : { data: [] };
  const soById = new Map((salesOrdersData ?? []).map((so) => [so.id, so]));

  const customerIds = Array.from(new Set((salesOrdersData ?? []).map((so) => so.customer_id)));
  const { data: customersData } = customerIds.length
    ? await supabase.from("customers").select("id, name").in("id", customerIds)
    : { data: [] };
  const customerNameById = new Map((customersData ?? []).map((c) => [c.id, c.name as string]));

  const warehouseIds = Array.from(new Set(fulfillments.map((f) => f.warehouse_id)));
  const { data: warehousesData } = warehouseIds.length
    ? await supabase.from("warehouses").select("id, name").in("id", warehouseIds)
    : { data: [] };
  const warehouseNameById = new Map((warehousesData ?? []).map((w) => [w.id, w.name as string]));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Surtidos" description="Surtidos (fulfillment) de Sales Orders liberadas financieramente." />

      {fulfillments.length === 0 ? (
        <Card>
          <EmptyState
            icon={PackageCheck}
            title="No hay surtidos todavía"
            description="Créalos desde el detalle de una Sales Order liberada (botón &ldquo;Crear surtido&rdquo;)."
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {fulfillments.map((f) => {
              const so = soById.get(f.sales_order_id);
              return (
                <Card key={f.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/surtidos/${f.id}`} className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium text-accent">{f.fulfillment_number}</p>
                      <p className="mt-0.5 truncate text-sm font-medium text-ink">{so ? customerNameById.get(so.customer_id) ?? "—" : "—"}</p>
                    </Link>
                    <StatusBadge status={f.status} labels={SALES_FULFILLMENT_STATUS_LABELS} variants={SALES_FULFILLMENT_STATUS_BADGE} />
                  </div>
                  <p className="mt-2 text-xs text-ink-faint">
                    {so?.order_number ?? "—"} · {warehouseNameById.get(f.warehouse_id) ?? "—"} · {formatDateShort(f.created_at)}
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
                  <Th>Sales Order</Th>
                  <Th>Cliente</Th>
                  <Th>Almacén</Th>
                  <Th>Fecha</Th>
                  <Th>Estado</Th>
                </Tr>
              </Thead>
              <Tbody>
                {fulfillments.map((f) => {
                  const so = soById.get(f.sales_order_id);
                  return (
                    <Tr key={f.id}>
                      <Td>
                        <Link href={`/surtidos/${f.id}`} className="font-mono text-sm font-medium text-accent hover:underline">
                          {f.fulfillment_number}
                        </Link>
                      </Td>
                      <Td className="text-ink-soft">
                        {so ? (
                          <Link href={`/ordenes-venta/${so.id}`} className="hover:underline">
                            {so.order_number}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>{so ? customerNameById.get(so.customer_id) ?? "—" : "—"}</Td>
                      <Td className="text-ink-soft">{warehouseNameById.get(f.warehouse_id) ?? "—"}</Td>
                      <Td className="text-ink-soft">{formatDateShort(f.created_at)}</Td>
                      <Td>
                        <StatusBadge status={f.status} labels={SALES_FULFILLMENT_STATUS_LABELS} variants={SALES_FULFILLMENT_STATUS_BADGE} />
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
