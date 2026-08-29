import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, History } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedUrls } from "@/lib/storage";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { canManageDeliveries } from "@/lib/auth/logistics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateShort, formatDateTime, formatNumber } from "@/lib/utils/format";
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
  salesperson_id: string;
}

/**
 * THÖREN Fase 6P — detalle de una Entrega/Instalación: cabecera editable,
 * partidas (inmutables, snapshot de order_items), cambio de estado,
 * evidencia (fotos/documento, reutiliza Storage existente) e historial de
 * estado (delivery_status_history, 0039).
 *
 * THÖREN 6R.1B-2B — `canWrite` aquí es en realidad `canManageDeliveries()`
 * (ownership/admin OR can_manage_deliveries, 0044): gobierna status,
 * formulario de detalles y subir/quitar evidencia por igual. Requisito
 * operativo conocido (documentado también en 0044): un usuario con
 * SOLO can_manage_deliveries (sin can_view_all_sales) puede ver este botón
 * de evidencia, pero el INSERT/DELETE de delivery_files le será rechazado
 * por RLS — la policy de delivery_files hace JOIN contra orders/deliveries,
 * cuya propia SELECT RLS no reconoce can_manage_deliveries. Para Rodolfo,
 * el plan de 6R.1B-2C ya contempla asignarle también can_view_all_sales,
 * así que esta limitación no debe afectar su combinación prevista de
 * permisos — no se corrige aquí porque es una decisión de asignación de
 * capabilities (2C), no un bug de esta UI.
 */
export default async function EntregaDetallePage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile();

  const { data: deliveryData } = await supabase.from("deliveries").select("*").eq("id", params.id).maybeSingle();
  if (!deliveryData) notFound();
  const delivery = deliveryData as Delivery;

  const [{ data: orderData }, { data: itemsData }, { data: historyData }, { data: filesData }] = await Promise.all([
    // salesperson_id se agrega aquí (THÖREN 6R.1B-1 UX fix) únicamente
    // para resolver ownership de la Entrega A TRAVÉS del Pedido origen —
    // sin cambio de esquema, es un campo más del mismo select existente.
    supabase.from("orders").select("id, folio, client_name, salesperson_id").eq("id", delivery.order_id).maybeSingle(),
    supabase.from("delivery_items").select("*").eq("delivery_id", delivery.id).order("created_at"),
    supabase.from("delivery_status_history").select("*").eq("delivery_id", delivery.id).order("changed_at", { ascending: false }),
    supabase.from("delivery_files").select("*").eq("delivery_id", delivery.id).order("created_at", { ascending: false }),
  ]);

  const order = orderData as OrderRow | null;
  // VIEW != WRITE (THÖREN 6R.1B-1 UX fix) — ownership de la Entrega se
  // resuelve vía el salesperson_id del Pedido origen, no de la Entrega
  // misma (deliveries no tiene su propio salesperson_id). THÖREN 6R.1B-2B:
  // canManageDeliveries() ya combina esa autoridad de ownership/admin CON
  // la capability logística can_manage_deliveries (0044) — una sola
  // llamada cubre ambas vías, igual que en /pedidos/[id]/nueva-entrega.
  const capabilities = await getCurrentCapabilities(profile?.userId);
  const canWrite = canManageDeliveries(profile, capabilities, order?.salesperson_id ?? null);
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
            {canWrite && <DeliveryStatusActions deliveryId={delivery.id} orderId={delivery.order_id} status={delivery.status} />}
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
          {canWrite ? (
            <DeliveryDetailsForm delivery={delivery} />
          ) : (
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ink-faint">Fecha programada</dt>
                <dd className="text-ink">{delivery.scheduled_date ? formatDateShort(delivery.scheduled_date) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Fecha/hora real</dt>
                <dd className="text-ink">{delivery.actual_datetime ? formatDateTime(delivery.actual_datetime) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Dirección/lugar</dt>
                <dd className="text-ink">{delivery.address ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Responsable interno</dt>
                <dd className="text-ink">{delivery.responsible_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Contacto en sitio</dt>
                <dd className="text-ink">{delivery.contact_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Teléfono de contacto</dt>
                <dd className="text-ink">{delivery.contact_phone ?? "—"}</dd>
              </div>
              {(delivery.delivery_type === "instalacion" || delivery.delivery_type === "entrega_instalacion") && (
                <>
                  <div>
                    <dt className="text-xs text-ink-faint">Técnico/responsable</dt>
                    <dd className="text-ink">{delivery.installer_name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-faint">Fecha/hora de instalación</dt>
                    <dd className="text-ink">
                      {delivery.installation_datetime ? formatDateTime(delivery.installation_datetime) : "—"}
                    </dd>
                  </div>
                  {delivery.installation_notes && (
                    <div className="col-span-1 sm:col-span-2">
                      <dt className="text-xs text-ink-faint">Notas de instalación</dt>
                      <dd className="whitespace-pre-wrap text-ink">{delivery.installation_notes}</dd>
                    </div>
                  )}
                </>
              )}
              {delivery.notes && (
                <div className="col-span-1 sm:col-span-2">
                  <dt className="text-xs text-ink-faint">Notas</dt>
                  <dd className="whitespace-pre-wrap text-ink">{delivery.notes}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-ink-faint">Recibido por</dt>
                <dd className="text-ink">{delivery.received_by_name ?? "—"}</dd>
              </div>
              {delivery.customer_observations && (
                <div className="col-span-1 sm:col-span-2">
                  <dt className="text-xs text-ink-faint">Observaciones del cliente</dt>
                  <dd className="whitespace-pre-wrap text-ink">{delivery.customer_observations}</dd>
                </div>
              )}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Evidencia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canWrite && (
            <div className="flex flex-wrap gap-3">
              <EvidenceUpload deliveryId={delivery.id} orderId={delivery.order_id} kind="foto" />
              <EvidenceUpload deliveryId={delivery.id} orderId={delivery.order_id} kind="documento" />
            </div>
          )}

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
                  {canWrite && (
                    <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <EvidenceRemoveButton fileId={f.id} deliveryId={delivery.id} orderId={delivery.order_id} />
                    </div>
                  )}
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
                  {canWrite && <EvidenceRemoveButton fileId={f.id} deliveryId={delivery.id} orderId={delivery.order_id} />}
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
