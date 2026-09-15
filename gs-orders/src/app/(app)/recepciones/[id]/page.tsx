import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { canReceiveInventory } from "@/lib/auth/logistics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { TestOperationBadge } from "@/components/ui/test-operation-badge";
import { DownloadPdfButton } from "@/components/ui/download-pdf-button";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDateShort, formatDateTime } from "@/lib/utils/format";
import { GOODS_RECEIPT_STATUS_BADGE, GOODS_RECEIPT_STATUS_LABELS, INVENTORY_MOVEMENT_TYPE_LABELS } from "@/types/domain";
import type { GoodsReceipt, GoodsReceiptItem, InventoryMovement } from "@/types/domain";
import { GoodsReceiptStatusActions } from "./status-actions";

export const dynamic = "force-dynamic";

type OneOrMany<T> = T | T[];
function one<T>(value: OneOrMany<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * THÖREN 0070 — detalle de una recepción de mercancía. RLS
 * (goods_receipts_select) ya acota la visibilidad: si no existe/no es
 * visible para el usuario, `data` viene null -> 404 (mismo criterio que
 * /requisiciones/[id]).
 */
export default async function RecepcionDetailPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  const capabilities = await getCurrentCapabilities(profile?.userId);
  const canReceive = canReceiveInventory(profile, capabilities);
  const supabase = createSupabaseServerClient();

  const { data } = await supabase.from("goods_receipts").select("*").eq("id", params.id).maybeSingle();
  if (!data) notFound();
  const goodsReceipt = data as GoodsReceipt;

  const [{ data: poData }, { data: warehouseData }, { data: itemsData }] = await Promise.all([
    supabase.from("purchase_orders").select("id, folio, supplier_id, is_test, suppliers(name)").eq("id", goodsReceipt.purchase_order_id).maybeSingle(),
    supabase.from("warehouses").select("name").eq("id", goodsReceipt.warehouse_id).maybeSingle(),
    supabase.from("goods_receipt_items").select("*").eq("goods_receipt_id", goodsReceipt.id).order("created_at"),
  ]);
  const items = (itemsData ?? []) as GoodsReceiptItem[];

  const po = poData as unknown as { id: string; folio: string; is_test: boolean; suppliers: OneOrMany<{ name: string }> | null } | null;
  const supplierName = one(po?.suppliers)?.name ?? null;

  let movements: InventoryMovement[] = [];
  if (goodsReceipt.status === "posted" && items.length > 0) {
    const { data: movementsData } = await supabase
      .from("inventory_movements")
      .select("*")
      .in(
        "purchase_order_item_id",
        items.map((i) => i.purchase_order_item_id)
      )
      .order("created_at");
    movements = (movementsData ?? []) as InventoryMovement[];
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/recepciones" className="flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          Recepciones de Mercancía
        </Link>
        <DownloadPdfButton docType="goods-receipt" id={goodsReceipt.id} />
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Recepción</p>
            <p className="font-mono text-2xl font-bold text-ink">{goodsReceipt.receipt_number}</p>
          </div>
          <div className="flex items-center gap-2">
            <TestOperationBadge isTest={po?.is_test ?? false} />
            <StatusBadge
              status={goodsReceipt.status}
              labels={GOODS_RECEIPT_STATUS_LABELS}
              variants={GOODS_RECEIPT_STATUS_BADGE}
              className="text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-border bg-surface-2/50 p-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-ink-faint">Purchase Order</dt>
              <dd className="text-sm font-medium text-ink">
                {po ? (
                  <Link href={`/compras/${po.id}`} className="font-mono text-accent hover:underline">
                    {po.folio}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Proveedor</dt>
              <dd className="text-sm font-medium text-ink">{supplierName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Almacén</dt>
              <dd className="text-sm font-medium text-ink">{warehouseData?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Fecha de recepción</dt>
              <dd className="text-sm font-medium text-ink">{formatDateShort(goodsReceipt.received_at)}</dd>
            </div>
            {goodsReceipt.supplier_document_number && (
              <div>
                <dt className="text-xs text-ink-faint">Documento del proveedor</dt>
                <dd className="text-sm font-medium text-ink">{goodsReceipt.supplier_document_number}</dd>
              </div>
            )}
            {goodsReceipt.notes && (
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-xs text-ink-faint">Notas</dt>
                <dd className="whitespace-pre-wrap text-sm text-ink">{goodsReceipt.notes}</dd>
              </div>
            )}
          </dl>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <GoodsReceiptStatusActions
              goodsReceiptId={goodsReceipt.id}
              receiptNumber={goodsReceipt.receipt_number}
              status={goodsReceipt.status}
              canReceive={canReceive}
            />
            {goodsReceipt.status === "draft" && canReceive && (
              <Link href={`/recepciones/${goodsReceipt.id}/editar`} className="text-sm text-accent hover:underline">
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
                <Th>Cantidad recibida</Th>
              </Tr>
            </Thead>
            <Tbody>
              {items.map((item) => (
                <Tr key={item.id}>
                  <Td className="font-medium text-ink">{item.description_snapshot}</Td>
                  <Td className="tabular-nums text-ink-soft">
                    {item.quantity_received}
                    {item.uom_snapshot ? ` ${item.uom_snapshot}` : ""}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </CardContent>
      </Card>

      {goodsReceipt.status === "posted" && (
        <Card>
          <CardHeader>
            <CardTitle>Movimientos de inventario generados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {movements.length === 0 ? (
              <p className="p-4 text-sm text-ink-faint">Ninguno (todas las líneas de esta recepción son partidas libres, sin producto de catálogo).</p>
            ) : (
              <Table>
                <Thead>
                  <Tr>
                    <Th>Fecha</Th>
                    <Th>Tipo</Th>
                    <Th>Cantidad</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {movements.map((m) => (
                    <Tr key={m.id}>
                      <Td className="text-ink-soft">{formatDateTime(m.created_at)}</Td>
                      <Td>{INVENTORY_MOVEMENT_TYPE_LABELS[m.movement_type]}</Td>
                      <Td className="tabular-nums font-medium text-ink">
                        {m.quantity_delta > 0 ? "+" : ""}
                        {m.quantity_delta}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
