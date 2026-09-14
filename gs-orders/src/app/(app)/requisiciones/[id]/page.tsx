import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { canPreparePurchaseOrders } from "@/lib/auth/purchase-orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDateShort } from "@/lib/utils/format";
import { PURCHASE_REQUISITION_STATUS_BADGE, PURCHASE_REQUISITION_STATUS_LABELS } from "@/types/domain";
import type { PurchaseRequisition, PurchaseRequisitionItem, Supplier } from "@/types/domain";
import { PurchaseRequisitionStatusActions } from "./status-actions";
import { ConvertToPurchaseOrderDialog } from "./convert-dialog";
import type { ConvertibleLine } from "./convert-dialog";

export const dynamic = "force-dynamic";

/**
 * THÖREN 0069 — detalle de una Purchase Requisition. RLS
 * (purchase_requisitions_select) ya acota la visibilidad: si no
 * existe/no es visible para el usuario, `data` viene null -> 404 (mismo
 * criterio que /compras/[id]).
 */
export default async function RequisicionDetailPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  const capabilities = await getCurrentCapabilities(profile?.userId);
  const canPrepare = canPreparePurchaseOrders(profile, capabilities);
  const supabase = createSupabaseServerClient();

  const { data } = await supabase.from("purchase_requisitions").select("*").eq("id", params.id).maybeSingle();
  if (!data) notFound();
  const requisition = data as PurchaseRequisition;

  const [{ data: soData }, { data: itemsData }] = await Promise.all([
    supabase.from("sales_orders").select("id, order_number, customer_id").eq("id", requisition.sales_order_id).maybeSingle(),
    supabase.from("purchase_requisition_items").select("*").eq("purchase_requisition_id", requisition.id).order("created_at"),
  ]);
  const items = (itemsData ?? []) as PurchaseRequisitionItem[];

  const [{ data: customerData }, { data: suppliersData }] = await Promise.all([
    soData ? supabase.from("customers").select("name").eq("id", soData.customer_id).maybeSingle() : Promise.resolve({ data: null }),
    canPrepare && (requisition.status === "submitted" || requisition.status === "partially_ordered")
      ? supabase.from("suppliers").select("*").eq("active", true).order("name")
      : Promise.resolve({ data: [] as Supplier[] }),
  ]);
  const suppliers = (suppliersData ?? []) as Supplier[];

  const preferredSupplierIds = Array.from(new Set(items.map((i) => i.preferred_supplier_id).filter((id): id is string => !!id)));
  const { data: preferredSuppliersData } = preferredSupplierIds.length
    ? await supabase.from("suppliers").select("id, name").in("id", preferredSupplierIds)
    : { data: [] };
  const preferredSupplierNameById = new Map((preferredSuppliersData ?? []).map((s) => [s.id, s.name as string]));

  const convertibleLines: ConvertibleLine[] = items
    .filter((i) => i.quantity_required - i.quantity_ordered > 0)
    .map((i) => ({
      id: i.id,
      skuSnapshot: i.description_snapshot,
      descriptionSnapshot: i.description_snapshot,
      uomSnapshot: i.uom_snapshot,
      remaining: i.quantity_required - i.quantity_ordered,
      suggestedSupplierId: i.preferred_supplier_id,
    }));

  const canConvert = canPrepare && (requisition.status === "submitted" || requisition.status === "partially_ordered");

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/requisiciones" className="flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          Requisiciones de Compra
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Requisición</p>
            <p className="font-mono text-2xl font-bold text-ink">{requisition.requisition_number}</p>
          </div>
          <StatusBadge
            status={requisition.status}
            labels={PURCHASE_REQUISITION_STATUS_LABELS}
            variants={PURCHASE_REQUISITION_STATUS_BADGE}
            className="text-sm"
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-border bg-surface-2/50 p-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-ink-faint">Sales Order de origen</dt>
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
              <dd className="text-sm font-medium text-ink">{customerData?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Fecha de solicitud</dt>
              <dd className="text-sm font-medium text-ink">{formatDateShort(requisition.requested_at)}</dd>
            </div>
            {requisition.notes && (
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-xs text-ink-faint">Notas</dt>
                <dd className="whitespace-pre-wrap text-sm text-ink">{requisition.notes}</dd>
              </div>
            )}
          </dl>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <PurchaseRequisitionStatusActions
              requisitionId={requisition.id}
              requisitionNumber={requisition.requisition_number}
              status={requisition.status}
              canPrepare={canPrepare}
            />
            {canConvert && <ConvertToPurchaseOrderDialog requisitionId={requisition.id} lines={convertibleLines} suppliers={suppliers} />}
            {requisition.status === "draft" && canPrepare && (
              <Link href={`/requisiciones/${requisition.id}/editar`} className="text-sm text-accent hover:underline">
                Editar líneas
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Líneas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <Thead>
              <Tr>
                <Th>Producto</Th>
                <Th>Requerido</Th>
                <Th>Ordenado</Th>
                <Th>Balance</Th>
                <Th>Proveedor sugerido</Th>
              </Tr>
            </Thead>
            <Tbody>
              {items.map((item) => (
                <Tr key={item.id}>
                  <Td>
                    <p className="font-medium text-ink">{item.description_snapshot}</p>
                    {item.notes && <p className="text-xs text-ink-faint">{item.notes}</p>}
                  </Td>
                  <Td className="tabular-nums text-ink-soft">
                    {item.quantity_required}
                    {item.uom_snapshot ? ` ${item.uom_snapshot}` : ""}
                  </Td>
                  <Td className="tabular-nums text-ink-soft">{item.quantity_ordered}</Td>
                  <Td className="tabular-nums text-ink-soft">{item.quantity_required - item.quantity_ordered}</Td>
                  <Td className="text-ink-soft">
                    {item.preferred_supplier_id ? preferredSupplierNameById.get(item.preferred_supplier_id) ?? "—" : "—"}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
