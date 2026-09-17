import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, PackageCheck } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { canCreatePurchaseOrderReceipt } from "@/lib/auth/logistics";
import { canPreparePurchaseOrders, canApprovePurchaseOrders } from "@/lib/auth/purchase-orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { TestOperationBadge } from "@/components/ui/test-operation-badge";
import { DownloadPdfButton } from "@/components/ui/download-pdf-button";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { formatDateShort } from "@/lib/utils/format";
import { resolveSupplierReferenceSnapshot, isMissingSupplierReference } from "@/lib/purchasing/supplier-reference-display";
import {
  PURCHASE_ORDER_STATUS_BADGE,
  PURCHASE_ORDER_STATUS_LABELS,
  PURCHASE_ORDER_ORIGIN_LABELS,
  PURCHASE_ORDER_DIRECT_REASON_LABELS,
} from "@/types/domain";
import type { OrderItem, PurchaseOrder, PurchaseOrderItem, Supplier } from "@/types/domain";
import { PurchaseOrderStatusActions } from "./status-actions";
import { PurchaseOrderDetailsForm } from "./details-form";
import { ReplaceItemsForm } from "./replace-items-form";
import { RefreshSupplierReferencesButton } from "./refresh-supplier-references-button";

export const dynamic = "force-dynamic";

type OneOrMany<T> = T | T[];
function one<T>(value: OneOrMany<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * THÖREN Fase 6L, autoridad reescrita en 6R.1B-3B — detalle de una
 * Purchase Order. RLS (purchase_orders_select) ya limita el acceso: si no
 * existe/no es visible, `data` viene null y se muestra 404 — igual que
 * /pedidos/[id].
 *
 * Tres autoridades independientes, ninguna implica otra (0044/0045):
 *   - canPrepare  -> can_prepare_purchase_orders (o admin): detalles,
 *     partidas y cancelar, SOLO mientras status = 'borrador'.
 *   - canApprove  -> can_approve_purchase_orders (o admin): sacar de
 *     borrador y administrar el ciclo posterior, incluida cancelar
 *     post-borrador.
 *   - canCreateReceipt (canCreatePurchaseOrderReceipt, logistics.ts) ->
 *     can_receive_inventory (o admin, 0044) Y la PO en un status
 *     receptible (PURCHASE_ORDER_RECEIVABLE_STATUSES, domain.ts —
 *     incluye 'en_transito'; excluye 'borrador'/'cancelada'/'recibida'):
 *     botón "Recibir mercancía" -> /recepciones/nueva. THÖREN 0070 retira
 *     la columna de recepción en línea por partida (ReceiveItemForm) — la
 *     recepción ahora es un documento (goods_receipts) con folio propio y
 *     ciclo draft/posted, UN solo punto de entrada en vez de dos (ver
 *     DECISIÓN de UI en la migración 0070). rpc_receive_purchase_order_item
 *     en sí NO se retira — sigue siendo la pieza real que mueve
 *     inventario, ahora invocada solo desde rpc_post_goods_receipt.
 * El proveedor es inmutable después de creación para TODOS (trigger de
 * 0035) — nunca se ofrece un selector para cambiarlo, ni siquiera a admin.
 */
export default async function CompraDetailPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";
  const capabilities = await getCurrentCapabilities(profile?.userId);
  const canPrepare = canPreparePurchaseOrders(profile, capabilities);
  const canApprove = canApprovePurchaseOrders(profile, capabilities);
  const supabase = createSupabaseServerClient();

  const { data } = await supabase
    .from("purchase_orders")
    .select(
      "*, supplier:suppliers(*), order:orders(id, folio, business_unit_id, business_units(name)), business_unit:business_units(name), destination_warehouse:warehouses(name)"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();

  const po = data as unknown as PurchaseOrder & {
    supplier: OneOrMany<Supplier> | null;
    order: OneOrMany<{ id: string; folio: string; business_unit_id: string | null; business_units: OneOrMany<{ name: string }> | null }> | null;
    business_unit: OneOrMany<{ name: string }> | null;
    destination_warehouse: OneOrMany<{ name: string }> | null;
  };
  const supplier = one(po.supplier);
  const order = one(po.order);
  const businessUnitName = one(order?.business_units)?.name ?? one(po.business_unit)?.name ?? "—";
  const destinationWarehouseName = one(po.destination_warehouse)?.name ?? null;

  // Detalles: admin puede seguir editando en cualquier status no cancelado
  // (0045, sin cambio); un preparador no-admin SOLO en borrador — mismo
  // guard exacto del RPC, espejado aquí solo para decidir qué mostrar.
  const canEditDetails = isAdmin ? po.status !== "cancelada" : canPrepare && po.status === "borrador";
  // Partidas: SIEMPRE borrador, para admin y preparador por igual (0045 —
  // editar partidas nunca aplica fuera de preparación, sin excepción de rol).
  // THÖREN 0069 — además exige `order` (Pedido de origen): una Purchase
  // Order originada en una Requisición de Compra tiene order_id NULL y sus
  // partidas provienen de purchase_requisition_items, no de order_items —
  // "Reemplazar partidas" nunca aplica ahí (rpc_replace_purchase_order_items
  // lo rechaza explícitamente en DB, ver 0069 sección 19). Se gestionan
  // exclusivamente desde la propia Requisición.
  const canEditItems = (isAdmin || canPrepare) && po.status === "borrador" && order !== null;
  // THÖREN 0074 — fix puntual: para una PO de Requisición (order === null),
  // "Reemplazar partidas" nunca es la vía (ver comentario arriba) — el
  // único camino real para corregir un snapshot vacío es refrescar SOLO
  // los 4 campos de snapshot (rpc_refresh_purchase_order_supplier_references),
  // sin tocar cantidades/líneas/estructura. Mismas dos autoridades y mismo
  // requisito de status que canEditItems, sin el requisito de `order`.
  const canRefreshSupplierReferences = (isAdmin || canPrepare) && po.status === "borrador" && order === null;

  const { data: itemsData } = await supabase
    .from("purchase_order_items")
    .select("*")
    .eq("purchase_order_id", po.id)
    .order("position");
  const items = (itemsData ?? []) as PurchaseOrderItem[];

  // Universo de partidas seleccionables para reemplazar (mismo criterio
  // que al crear la PO) — solo se necesita si de verdad se va a mostrar
  // el formulario de edición.
  const { data: orderItemsData } =
    canEditItems && order
      ? await supabase.from("order_items").select("*").eq("order_id", order.id).order("position")
      : { data: [] as OrderItem[] };
  const orderItems = (orderItemsData ?? []) as OrderItem[];
  const missingReferenceCount = items.filter(isMissingSupplierReference).length;
  const canCreateReceipt = canCreatePurchaseOrderReceipt(profile, capabilities, po.status);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/compras" className="flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          Compras
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <DownloadPdfButton docType="purchase-order" id={po.id} />
          {canCreateReceipt && (
            <Link href={`/recepciones/nueva?purchase_order_id=${po.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <PackageCheck className="h-3.5 w-3.5" />
              Recibir mercancía
            </Link>
          )}
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Folio</p>
            <p className="font-mono text-2xl font-bold text-ink">{po.folio}</p>
          </div>
          <div className="flex items-center gap-2">
            <TestOperationBadge isTest={po.is_test} />
            <StatusBadge status={po.status} labels={PURCHASE_ORDER_STATUS_LABELS} variants={PURCHASE_ORDER_STATUS_BADGE} className="text-sm" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-border bg-surface-2/50 p-4 sm:grid-cols-3">
            <div>
              {/* Proveedor: SIEMPRE solo lectura — inmutable tras crear la
                  Purchase Order (trigger 0035), sin excepción de rol. */}
              <dt className="text-xs text-ink-faint">Proveedor</dt>
              <dd className="text-sm font-medium text-ink">{supplier?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Origen</dt>
              <dd className="text-sm font-medium text-ink">{PURCHASE_ORDER_ORIGIN_LABELS[po.origin]}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Pedido origen</dt>
              <dd className="text-sm font-medium text-ink">
                {order ? (
                  <Link href={`/pedidos/${order.id}`} className="font-mono text-accent hover:underline">
                    {order.folio}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Business Unit</dt>
              <dd className="text-sm font-medium text-ink">{businessUnitName}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Fecha de orden</dt>
              <dd className="text-sm font-medium text-ink">{formatDateShort(po.po_date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Referencia del proveedor</dt>
              <dd className="text-sm font-medium text-ink">{po.supplier_reference ?? "—"}</dd>
            </div>
            {po.origin === "directa" && (
              <>
                <div>
                  <dt className="text-xs text-ink-faint">Moneda</dt>
                  <dd className="text-sm font-medium text-ink">{po.currency ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-faint">Tipo/motivo de compra</dt>
                  <dd className="text-sm font-medium text-ink">
                    {po.direct_purchase_reason ? PURCHASE_ORDER_DIRECT_REASON_LABELS[po.direct_purchase_reason] : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-faint">Almacén destino</dt>
                  <dd className="text-sm font-medium text-ink">{destinationWarehouseName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-faint">Fecha requerida</dt>
                  <dd className="text-sm font-medium text-ink">{po.required_date ? formatDateShort(po.required_date) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-faint">Condiciones de pago</dt>
                  <dd className="text-sm font-medium text-ink">{po.payment_terms ?? "—"}</dd>
                </div>
              </>
            )}
          </dl>

          {/* Autorización de compra: acciones de status separadas de
              preparación — oculta por completo si no hay ninguna acción
              ejecutable (nunca botones deshabilitados de relleno). */}
          <div className="border-t border-border pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Autorización de compra</p>
            <PurchaseOrderStatusActions
              purchaseOrderId={po.id}
              folio={po.folio}
              status={po.status}
              canPrepare={canPrepare}
              canApprove={canApprove}
            />
          </div>

          {canEditDetails ? (
            <PurchaseOrderDetailsForm purchaseOrderId={po.id} purchaseOrder={po} />
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-ink-faint">Fecha compromiso proveedor</dt>
                <dd className="text-sm text-ink">{po.supplier_commitment_date ? formatDateShort(po.supplier_commitment_date) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Fecha estimada de recepción</dt>
                <dd className="text-sm text-ink">{po.estimated_reception_date ? formatDateShort(po.estimated_reception_date) : "—"}</dd>
              </div>
              {po.notes && (
                <div className="col-span-2 sm:col-span-3">
                  <dt className="text-xs text-ink-faint">Notas</dt>
                  <dd className="whitespace-pre-wrap text-sm text-ink">{po.notes}</dd>
                </div>
              )}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Partidas</CardTitle>
        </CardHeader>
        <CardContent className={canEditItems ? undefined : "p-0"}>
          {canEditItems ? (
            <ReplaceItemsForm purchaseOrderId={po.id} orderItems={orderItems} currentItems={items} />
          ) : (
            <>
              {/* THÖREN — Supplier Product References (0066): mientras la PO
                  sigue en borrador, la falta de referencia es corregible
                  (Catálogo → Editar producto + "Reemplazar partidas" para
                  refrescar el snapshot) — aviso visible, sin bloquear el
                  borrador. Fuera de borrador ya no aplica (o bien se
                  resolvió al aprobar, o es una PO histórica anterior a esta
                  migración — nunca se revalida retroactivamente).
                  THÖREN 0074 — fix puntual: una PO de Requisición nunca
                  tiene "Reemplazar partidas" (order === null), así que esa
                  instrucción era un callejón sin salida real (bug
                  OC-20261409-009) — aquí se ofrece en su lugar el botón
                  "Actualizar referencias de proveedor", que SOLO refresca
                  el snapshot sin tocar líneas/cantidades/estructura. */}
              {po.status === "borrador" && missingReferenceCount > 0 && (
                <div className="flex items-start gap-2 border-b border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-2">
                    <p>
                      Falta referencia del proveedor para {missingReferenceCount}{" "}
                      {missingReferenceCount === 1 ? "producto" : "productos"} — agrégala en Catálogo → Editar
                      producto{" "}
                      {canRefreshSupplierReferences
                        ? "y usa el botón de abajo para actualizarla aquí."
                        : 'y usa "Reemplazar partidas" para actualizarla aquí.'}{" "}
                      Sin ella, no podrás autorizar esta Purchase Order.
                    </p>
                    {canRefreshSupplierReferences && <RefreshSupplierReferencesButton purchaseOrderId={po.id} />}
                  </div>
                </div>
              )}
              <Table>
                <Thead>
                  <Tr>
                    <Th>Modelo</Th>
                    <Th>Ordenado</Th>
                    <Th>Recibido</Th>
                    <Th>Pendiente</Th>
                    {po.origin === "directa" && (
                      <>
                        <Th className="text-right">Precio unitario</Th>
                        <Th className="text-right">Impuesto</Th>
                        <Th className="text-right">Importe</Th>
                      </>
                    )}
                  </Tr>
                </Thead>
                <Tbody>
                  {items.map((item) => {
                    const supplierRef = resolveSupplierReferenceSnapshot(item);
                    const missingRef = isMissingSupplierReference(item);
                    return (
                      <Tr key={item.id}>
                        <Td>
                          {supplierRef ? (
                            <>
                              {/* Referencia del proveedor — lo que se le
                                  envió a ÉL, nunca el modelo interno. */}
                              <p className="font-medium text-ink">{supplierRef}</p>
                              <p className="text-xs text-ink-faint">→ {item.model} (interno)</p>
                            </>
                          ) : (
                            <>
                              <p className="font-medium text-ink">{item.model}</p>
                              {missingRef && (
                                <p
                                  className={
                                    po.status === "borrador"
                                      ? "flex items-center gap-1 text-xs text-warning"
                                      : "text-xs text-ink-faint"
                                  }
                                >
                                  {po.status === "borrador" && <AlertTriangle className="h-3 w-3 shrink-0" />}
                                  Falta referencia del proveedor para este producto.
                                </p>
                              )}
                            </>
                          )}
                          {item.description && <p className="text-xs text-ink-faint">{item.description}</p>}
                          {item.customer_requirements && <p className="text-xs text-ink-faint">Requisitos: {item.customer_requirements}</p>}
                        </Td>
                        <Td className="tabular-nums text-ink-soft">
                          {item.quantity_ordered}
                          {item.unit ? ` ${item.unit}` : ""}
                        </Td>
                        <Td className="tabular-nums text-ink-soft">{item.quantity_received}</Td>
                        <Td className="tabular-nums text-ink-soft">{item.quantity_ordered - item.quantity_received}</Td>
                        {po.origin === "directa" && (
                          <>
                            <Td className="text-right tabular-nums text-ink-soft">
                              {item.unit_price != null ? `$${item.unit_price.toFixed(2)}` : "—"}
                            </Td>
                            <Td className="text-right tabular-nums text-ink-soft">{item.tax_percent != null ? `${item.tax_percent}%` : "—"}</Td>
                            <Td className="text-right tabular-nums text-ink-soft">
                              {item.line_total != null ? `$${item.line_total.toFixed(2)}` : "—"}
                            </Td>
                          </>
                        )}
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
              {po.origin === "directa" && (
                <div className="flex justify-end border-t border-border px-4 py-3">
                  <dl className="w-full max-w-xs space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-ink-faint">Subtotal</dt>
                      <dd className="tabular-nums text-ink">${po.subtotal.toFixed(2)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-faint">Impuestos</dt>
                      <dd className="tabular-nums text-ink">${po.tax_total.toFixed(2)}</dd>
                    </div>
                    <div className="flex justify-between font-medium">
                      <dt className="text-ink">Total</dt>
                      <dd className="tabular-nums text-ink">
                        ${po.total.toFixed(2)} {po.currency}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
