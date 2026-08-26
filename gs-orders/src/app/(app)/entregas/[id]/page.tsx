import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, History } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedUrls } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, formatNumber } from "@/lib/utils/format";
import { DELIVERY_STATUS_BADGE, DELIVERY_STATUS_LABELS, DELIVERY_TYPE_LABELS } from "@/types/domain";
import type { Delivery, DeliveryFile, DeliveryItem, DeliveryStatusHistoryEntry } from "@/types/domain";
import { DeliveryStatusActions } from "./status-actions";
import { DeliveryDetailsForm } from "./details-form";
import { EvidenceUpload } from "./evidence-upload";
import { EvidenceRemoveButton } from "./evidence-remove-button";

export const dynamic = "force-dynamic";

interface OrderRow {
  id: string;
  folio: string;
  client_name: string;
}

/**
 * THÖREN Fase 6P — detalle de una Entrega/Instalación: cabecera editable,
 * partidas (inmutables, snapshot de order_items), cambio de estado,
 * evidencia (fotos/documento, reutiliza Storage existente) e historial de
 * estado (delivery_status_history, 0039).
 */
export default async function EntregaDetallePage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();

  const { data: deliveryData } = await supabase.from("deliveries").select("*").eq("id", params.id).maybeSingle();
  if (!deliveryData) notFound();
  const delivery = deliveryData as Delivery;

  const [{ data: orderData }, { data: itemsData }, { data: historyData }, { data: filesData }] = await Promise.all([
    supabase.from("orders").select("id, folio, client_name").eq("id", delivery.order_id).maybeSingle(),
    supabase.from("delivery_items").select("*").eq("delivery_id", delivery.id).order("created_at"),
    supabase.from("delivery_status_history").select("*").eq("delivery_id", delivery.id).order("changed_at", { ascending: false }),
    supabase.from("delivery_files").select("*").eq("delivery_id", delivery.id).order("created_at", { ascending: false }),
  ]);

  const order = orderData as OrderRow | null;
  const items = (itemsData ?? []) as DeliveryItem[];
  const history = (historyData ?? []) as DeliveryStatusHistoryEntry[];
  const files = (filesData ?? []) as DeliveryFile[];

  const photoFiles = files.filter((f) => f.kind === "foto");
  const documentFiles = files.filter((f) => f.kind === "documento");
  const [photoUrls, documentUrls] = await Promise.all([
    getSignedUrls("order-media", photoFiles.map((f) => f.storage_path)),
    getSignedUrls("order-files", documentFiles.map((f) => f.storage_path)),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href={`/pedidos/${delivery.order_id}`} className="mb-6 flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Pedido {order?.folio ?? "—"}
      </Link>

      <PageHeader
        title={`${order?.folio ?? "—"}-E${delivery.sequence_number}`}
        description={`${DELIVERY_TYPE_LABELS[delivery.delivery_type]} · Cliente: ${order?.client_name ?? "—"}`}
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Estado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={delivery.status} labels={DELIVERY_STATUS_LABELS} variants={DELIVERY_STATUS_BADGE} className="text-sm" />
            <DeliveryStatusActions deliveryId={delivery.id} orderId={delivery.order_id} status={delivery.status} />
          </div>
          {delivery.completed_at && (
            <p className="text-xs text-ink-faint">Completada el {formatDateTime(delivery.completed_at)}</p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Partidas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <Thead>
              <Tr>
                <Th>Producto/Modelo</Th>
                <Th>Cantidad</Th>
              </Tr>
            </Thead>
            <Tbody>
              {items.map((item) => (
                <Tr key={item.id}>
                  <Td>
                    <p className="font-medium text-ink">{item.model}</p>
                    {item.description && <p className="text-xs text-ink-faint">{item.description}</p>}
                  </Td>
                  <Td className="tabular-nums">
                    {formatNumber(item.quantity_delivered)}
                    {item.unit ? ` ${item.unit}` : ""}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Datos de la entrega</CardTitle>
        </CardHeader>
        <CardContent>
          <DeliveryDetailsForm delivery={delivery} />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Evidencia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <EvidenceUpload deliveryId={delivery.id} orderId={delivery.order_id} kind="foto" />
            <EvidenceUpload deliveryId={delivery.id} orderId={delivery.order_id} kind="documento" />
          </div>

          {photoFiles.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {photoFiles.map((f) => (
                <div key={f.id} className="group relative overflow-hidden rounded-lg border border-border">
                  <div className="aspect-square bg-surface-2">
                    {photoUrls[f.storage_path] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoUrls[f.storage_path]} alt={f.file_name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <FileText className="h-6 w-6 text-ink-faint" />
                      </div>
                    )}
                  </div>
                  <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <EvidenceRemoveButton fileId={f.id} deliveryId={delivery.id} orderId={delivery.order_id} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {documentFiles.length > 0 && (
            <div className="space-y-2">
              {documentFiles.map((f) => (
                <div key={f.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-ink-faint" />
                  <div className="min-w-0 flex-1">
                    {documentUrls[f.storage_path] ? (
                      <a
                        href={documentUrls[f.storage_path]}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-sm text-accent hover:underline"
                      >
                        {f.file_name}
                      </a>
                    ) : (
                      <p className="truncate text-sm text-ink">{f.file_name}</p>
                    )}
                  </div>
                  <EvidenceRemoveButton fileId={f.id} deliveryId={delivery.id} orderId={delivery.order_id} />
                </div>
              ))}
            </div>
          )}

          {files.length === 0 && (
            <p className="text-sm text-ink-faint">Sin fotos ni documentos adjuntos todavía.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de estado</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <EmptyState icon={History} title="Sin historial" description="Todavía no hay cambios de estado registrados." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Fecha</Th>
                  <Th>Cambio</Th>
                  <Th>Usuario</Th>
                </Tr>
              </Thead>
              <Tbody>
                {history.map((h) => (
                  <Tr key={h.id}>
                    <Td className="text-ink-soft">{formatDateTime(h.changed_at)}</Td>
                    <Td>
                      {h.previous_status ? `${DELIVERY_STATUS_LABELS[h.previous_status]} → ` : ""}
                      {DELIVERY_STATUS_LABELS[h.new_status]}
                    </Td>
                    <Td className="text-ink-soft">{h.changed_by_name ?? "—"}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
