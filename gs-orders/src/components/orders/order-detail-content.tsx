import { FileText } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatBytes, formatDate, formatMeasure } from "@/lib/utils/format";
import {
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABELS,
  ORIENTATION_LABELS,
  SURFACE_MATERIAL_LABELS,
  SURFACE_TYPE_LABELS,
  USE_LABELS,
} from "@/types/domain";
import type { OrderItemImage } from "@/types/domain";
import type { OrderDetail } from "./get-order-detail";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function ImageThumbRow({ images, mediaUrls }: { images: OrderItemImage[]; mediaUrls: Record<string, string> }) {
  if (images.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {images.map((img) => {
        const url = mediaUrls[img.storage_path];
        const isImage = img.file_type?.startsWith("image/") ?? true;
        return isImage && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={img.id}
            src={url}
            alt={img.file_name ?? "Imagen de referencia"}
            className="h-20 w-20 rounded-lg border border-border object-cover"
          />
        ) : (
          <a
            key={img.id}
            href={url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-border text-center text-[10px] text-accent hover:underline"
          >
            <FileText className="h-4 w-4" />
            {img.file_name ?? "Archivo"}
          </a>
        );
      })}
    </div>
  );
}

/**
 * Vista en pantalla del detalle de un pedido. El PDF de Pedido (Fase 6G) se
 * desacopló de este componente — vive como página dedicada en
 * (print)/pedidos/[id]/pdf/page.tsx, con su propio layout/etiquetas en
 * inglés para fábrica — así que este componente ya solo necesita cubrir el
 * caso de pantalla, en español.
 */
export function OrderDetailContent({ detail }: { detail: OrderDetail }) {
  const { order, salesperson, items, itemImages, images, files, mediaUrls, fileUrls } = detail;
  const isProjector = order.product_type === "proyector_gobo";

  // Nombre visible del tipo tal como estaba guardado al crear/editar el
  // pedido (snapshot) — nunca se recalcula contra product_types, así que
  // renombrar un tipo después no cambia pedidos ya creados.
  const productTypeName = order.product_type_name_snapshot ?? order.product_type;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Folio</p>
          <p className="font-mono text-2xl font-bold text-ink">{order.folio}</p>
        </div>
        <StatusBadge status={order.status} labels={ORDER_STATUS_LABELS} variants={ORDER_STATUS_BADGE} className="text-sm" />
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-border bg-surface-2/50 p-4 sm:grid-cols-3">
        <Field label="Fecha" value={formatDate(order.order_date)} />
        <Field label="Vendedor" value={`${salesperson.name} (${salesperson.prefix})`} />
        <Field label="Cliente" value={order.client_name} />
        <Field label="Proveedor" value={order.supplier_name} />
        <Field label="Tipo de producto" value={productTypeName} />
      </dl>

      {items.length > 0 && (
        <Section title="Productos">
          <div className="space-y-4">
            {items.map((item, index) => {
              const imageUrl = item.image_path ? mediaUrls[item.image_path] : null;
              const ownImages = itemImages.filter((img) => img.order_item_id === item.id);
              const referenceImages = ownImages.filter((img) => img.kind === "reference");
              const projectionImages = ownImages.filter((img) => img.kind === "projection");
              const itemProjectionSize =
                item.projection_width != null && item.projection_height != null
                  ? `${item.projection_width} ${item.projection_size_unit} × ${item.projection_height} ${item.projection_size_unit}`
                  : null;
              const specs = [
                item.power ? `Potencia/versión: ${item.power}` : null,
                item.color ? `Color: ${item.color}` : null,
                item.lens_pending_factory
                  ? "Lente: Por definir con fábrica"
                  : item.lens_type
                    ? `Lente: ${item.lens_type}`
                    : null,
              ].filter(Boolean);

              return (
                <div key={item.id} className="break-inside-avoid rounded-lg border border-border p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    Producto {index + 1}
                  </p>
                  <div className="flex gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-2">
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl} alt={item.model} className="h-full w-full object-cover" />
                      ) : (
                        <FileText className="h-5 w-5 text-ink-faint" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">
                        Modelo: {item.model} <span className="font-normal text-ink-faint">· Cantidad: {item.quantity}</span>
                      </p>
                      {item.description && <p className="text-sm text-ink-soft">{item.description}</p>}
                      {item.unit && <p className="mt-1 text-xs text-ink-faint">Unidad: {item.unit}</p>}
                      {item.customer_requirements && (
                        <p className="text-xs text-ink-faint">Requisitos del cliente: {item.customer_requirements}</p>
                      )}
                      {specs.length > 0 && <p className="mt-1 text-xs text-ink-faint">{specs.join(" · ")}</p>}
                      {item.notes && <p className="text-xs text-ink-faint">{item.notes}</p>}
                    </div>
                  </div>

                  {referenceImages.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1.5 text-xs text-ink-faint">Imágenes de referencia</p>
                      <ImageThumbRow images={referenceImages} mediaUrls={mediaUrls} />
                    </div>
                  )}

                  {isProjector && (projectionImages.length > 0 || item.projection_description || itemProjectionSize) && (
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Imagen a proyectar</p>
                      {item.projection_description && (
                        <p className="text-sm text-ink">Qué proyectar: {item.projection_description}</p>
                      )}
                      {projectionImages.length > 0 && (
                        <div className="mt-2">
                          <ImageThumbRow images={projectionImages} mediaUrls={mediaUrls} />
                        </div>
                      )}
                      {itemProjectionSize && (
                        <p className="mt-2 text-sm text-ink-soft">
                          Medida requerida: <span className="font-medium text-ink">{itemProjectionSize}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {isProjector &&
                    (item.installation_height != null ||
                      item.installation_orientation ||
                      item.installation_distance != null ||
                      item.installation_use) && (
                      <div className="mt-3 border-t border-border pt-3">
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Instalación</p>
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                          <Field label="Altura" value={formatMeasure(item.installation_height, item.installation_height_unit)} />
                          <Field
                            label="Orientación"
                            value={item.installation_orientation ? ORIENTATION_LABELS[item.installation_orientation] : null}
                          />
                          <Field
                            label="Distancia"
                            value={formatMeasure(item.installation_distance, item.installation_height_unit)}
                          />
                          <Field label="Uso" value={item.installation_use ? USE_LABELS[item.installation_use] : null} />
                        </dl>
                      </div>
                    )}

                  {isProjector && (item.surface_type || item.surface_material || item.surface_notes) && (
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Superficie</p>
                      <p className="text-sm text-ink">
                        {[
                          item.surface_type ? SURFACE_TYPE_LABELS[item.surface_type] : null,
                          item.surface_material ? SURFACE_MATERIAL_LABELS[item.surface_material] : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                      {item.surface_notes && <p className="mt-1 text-sm text-ink-soft">{item.surface_notes}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {images.length > 0 && (
        <Section title="Fotografías">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {images.map((img) => {
              const url = mediaUrls[img.storage_path];
              return (
                <figure key={img.id} className="break-inside-avoid overflow-hidden rounded-lg border border-border">
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={img.caption ?? "Fotografía"} className="aspect-square w-full object-cover" />
                  )}
                  {img.caption && (
                    <figcaption className="border-t border-border px-2 py-1 text-xs text-ink-faint">{img.caption}</figcaption>
                  )}
                </figure>
              );
            })}
          </div>
        </Section>
      )}

      {(order.vendor_notes || order.general_notes) && (
        <Section title="Observaciones">
          {order.vendor_notes && <p className="whitespace-pre-wrap text-sm text-ink">{order.vendor_notes}</p>}
          {order.general_notes && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-faint">{order.general_notes}</p>}
        </Section>
      )}

      {files.length > 0 && (
        <Section title="Archivos adjuntos">
          <div className="space-y-2">
            {files.map((file) => (
              <a
                key={file.id}
                href={fileUrls[file.storage_path] ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2"
              >
                <FileText className="h-4 w-4 text-ink-faint" />
                <span className="flex-1 truncate text-ink">{file.file_name}</span>
                <span className="text-xs text-ink-faint">{formatBytes(file.file_size)}</span>
              </a>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
