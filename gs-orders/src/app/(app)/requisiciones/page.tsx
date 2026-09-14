import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDateShort } from "@/lib/utils/format";
import { PURCHASE_REQUISITION_STATUS_BADGE, PURCHASE_REQUISITION_STATUS_LABELS } from "@/types/domain";
import type { PurchaseRequisition } from "@/types/domain";

export const dynamic = "force-dynamic";

/**
 * Lista de Requisiciones de Compra (THÖREN Sales Order → Procurement,
 * 0069). Visibilidad por RLS (purchase_requisitions_select): admin,
 * can_prepare_purchase_orders o can_view_all_sales — sin filtro extra
 * aquí, RLS ya acota a la organización.
 */
export default async function RequisicionesPage() {
  const supabase = createSupabaseServerClient();

  const { data } = await supabase.from("purchase_requisitions").select("*").order("created_at", { ascending: false }).limit(200);
  const requisitions = (data ?? []) as PurchaseRequisition[];

  const salesOrderIds = Array.from(new Set(requisitions.map((r) => r.sales_order_id)));
  const { data: salesOrdersData } = salesOrderIds.length
    ? await supabase.from("sales_orders").select("id, order_number, customer_id").in("id", salesOrderIds)
    : { data: [] };
  const soById = new Map((salesOrdersData ?? []).map((so) => [so.id, so]));

  const customerIds = Array.from(new Set((salesOrdersData ?? []).map((so) => so.customer_id)));
  const { data: customersData } = customerIds.length
    ? await supabase.from("customers").select("id, name").in("id", customerIds)
    : { data: [] };
  const customerNameById = new Map((customersData ?? []).map((c) => [c.id, c.name as string]));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Requisiciones de Compra" description="Requisiciones originadas desde Sales Orders liberadas." />

      {requisitions.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardCheck}
            title="No hay requisiciones de compra todavía"
            description="Créalas desde el detalle de una Sales Order liberada."
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {requisitions.map((r) => {
              const so = soById.get(r.sales_order_id);
              return (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/requisiciones/${r.id}`} className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium text-accent">{r.requisition_number}</p>
                      <p className="mt-0.5 truncate text-sm font-medium text-ink">{so ? customerNameById.get(so.customer_id) ?? "—" : "—"}</p>
                    </Link>
                    <StatusBadge status={r.status} labels={PURCHASE_REQUISITION_STATUS_LABELS} variants={PURCHASE_REQUISITION_STATUS_BADGE} />
                  </div>
                  <p className="mt-2 text-xs text-ink-faint">
                    {so?.order_number ?? "—"} · {formatDateShort(r.created_at)}
                  </p>
                </Card>
              );
            })}
          </div>

          <Card className="hidden overflow-hidden sm:block">
            <Table>
              <Thead>
                <Tr>
                  <Th>Requisición</Th>
                  <Th>Fecha</Th>
                  <Th>Sales Order</Th>
                  <Th>Cliente</Th>
                  <Th>Estado</Th>
                </Tr>
              </Thead>
              <Tbody>
                {requisitions.map((r) => {
                  const so = soById.get(r.sales_order_id);
                  return (
                    <Tr key={r.id}>
                      <Td>
                        <Link href={`/requisiciones/${r.id}`} className="font-mono text-sm font-medium text-accent hover:underline">
                          {r.requisition_number}
                        </Link>
                      </Td>
                      <Td className="text-ink-soft">{formatDateShort(r.created_at)}</Td>
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
                      <Td>
                        <StatusBadge status={r.status} labels={PURCHASE_REQUISITION_STATUS_LABELS} variants={PURCHASE_REQUISITION_STATUS_BADGE} />
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
