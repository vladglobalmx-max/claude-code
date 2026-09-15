import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { TestOperationBadge } from "@/components/ui/test-operation-badge";
import { IncludeTestDataToggle } from "@/components/ui/include-test-data-toggle";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDateShort } from "@/lib/utils/format";
import { GOODS_RECEIPT_STATUS_BADGE, GOODS_RECEIPT_STATUS_LABELS } from "@/types/domain";
import type { GoodsReceipt } from "@/types/domain";

export const dynamic = "force-dynamic";

/**
 * Lista de Recepciones de Mercancía (THÖREN Receiving + Inventory MVP,
 * 0070). Visibilidad por RLS (goods_receipts_select): cualquier miembro
 * activo de la organización — mismo criterio que Inventory
 * (inventory_movements_select, 0036), sin filtro extra aquí.
 */
export default async function RecepcionesPage({ searchParams }: { searchParams: { incluir_pruebas?: string } }) {
  const supabase = createSupabaseServerClient();
  const includeTest = searchParams.incluir_pruebas === "1";

  const { data } = await supabase.from("goods_receipts").select("*").order("created_at", { ascending: false }).limit(200);
  let receipts = (data ?? []) as GoodsReceipt[];

  const purchaseOrderIds = Array.from(new Set(receipts.map((r) => r.purchase_order_id)));
  const { data: poData } = purchaseOrderIds.length
    ? await supabase.from("purchase_orders").select("id, folio, supplier_id, is_test").in("id", purchaseOrderIds)
    : { data: [] };
  const poById = new Map((poData ?? []).map((po) => [po.id, po]));

  // THÖREN 0077 — is_test se hereda de la Purchase Order (columna propia,
  // ver DISEÑO en 0077_test_data_purge.sql). Filtro en memoria, mismo
  // criterio que el resto de esta página.
  if (!includeTest) {
    receipts = receipts.filter((r) => !(poById.get(r.purchase_order_id)?.is_test ?? false));
  }

  const supplierIds = Array.from(new Set((poData ?? []).map((po) => po.supplier_id)));
  const { data: suppliersData } = supplierIds.length
    ? await supabase.from("suppliers").select("id, name").in("id", supplierIds)
    : { data: [] };
  const supplierNameById = new Map((suppliersData ?? []).map((s) => [s.id, s.name as string]));

  const warehouseIds = Array.from(new Set(receipts.map((r) => r.warehouse_id)));
  const { data: warehousesData } = warehouseIds.length
    ? await supabase.from("warehouses").select("id, name").in("id", warehouseIds)
    : { data: [] };
  const warehouseNameById = new Map((warehousesData ?? []).map((w) => [w.id, w.name as string]));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title="Recepciones de Mercancía"
        description="Recepciones registradas contra Purchase Orders."
        actions={<IncludeTestDataToggle />}
      />

      {receipts.length === 0 ? (
        <Card>
          <EmptyState
            icon={PackageCheck}
            title="No hay recepciones de mercancía todavía"
            description="Créalas desde el detalle de una Purchase Order (botón &ldquo;Recibir mercancía&rdquo;)."
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {receipts.map((r) => {
              const po = poById.get(r.purchase_order_id);
              return (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/recepciones/${r.id}`} className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium text-accent">{r.receipt_number}</p>
                      <p className="mt-0.5 truncate text-sm font-medium text-ink">{po ? supplierNameById.get(po.supplier_id) ?? "—" : "—"}</p>
                    </Link>
                    <div className="flex items-center gap-2">
                      <TestOperationBadge isTest={po?.is_test ?? false} />
                      <StatusBadge status={r.status} labels={GOODS_RECEIPT_STATUS_LABELS} variants={GOODS_RECEIPT_STATUS_BADGE} />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-ink-faint">
                    {po?.folio ?? "—"} · {warehouseNameById.get(r.warehouse_id) ?? "—"} · {formatDateShort(r.received_at)}
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
                  <Th>Purchase Order</Th>
                  <Th>Proveedor</Th>
                  <Th>Almacén</Th>
                  <Th>Fecha</Th>
                  <Th>Estado</Th>
                </Tr>
              </Thead>
              <Tbody>
                {receipts.map((r) => {
                  const po = poById.get(r.purchase_order_id);
                  return (
                    <Tr key={r.id}>
                      <Td>
                        <Link href={`/recepciones/${r.id}`} className="font-mono text-sm font-medium text-accent hover:underline">
                          {r.receipt_number}
                        </Link>
                      </Td>
                      <Td className="text-ink-soft">
                        {po ? (
                          <Link href={`/compras/${po.id}`} className="font-mono text-accent hover:underline">
                            {po.folio}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>{po ? supplierNameById.get(po.supplier_id) ?? "—" : "—"}</Td>
                      <Td className="text-ink-soft">{warehouseNameById.get(r.warehouse_id) ?? "—"}</Td>
                      <Td className="text-ink-soft">{formatDateShort(r.received_at)}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <TestOperationBadge isTest={po?.is_test ?? false} />
                          <StatusBadge status={r.status} labels={GOODS_RECEIPT_STATUS_LABELS} variants={GOODS_RECEIPT_STATUS_BADGE} />
                        </div>
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
