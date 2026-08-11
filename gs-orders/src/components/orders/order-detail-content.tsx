import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatBytes, formatDate, formatMeasure } from "@/lib/utils/format";
import {
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABELS,
  ORIENTATION_LABELS,
  PRODUCT_TYPE_LABELS,
  SURFACE_MATERIAL_LABELS,
  SURFACE_TYPE_LABELS,
  USE_LABELS,
} from "@/types/domain";
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

export function OrderDetailContent({
  detail,
  variant = "view",
}: {
  detail: OrderDetail;
  variant?: "view" | "print";
}) {
  const { order, salesperson, items, images, files, mediaUrls, fileUrls } = detail;
  const isProjector = order.product_type === "proyector_gobo";
  const projectionSize =
    order.projection_width != null && order.projection_height != null
      ? `${order.projection_width} ${order.projection_size_unit} × ${order.projection_height} ${order.projection_size_unit}`
      : null;
  const projectionImageUrl = order.projection_file_path ? mediaUrls[order.projection_file_path] : null;
  const projectionIsImage = order.projection_file_type?.startsWith("image/") ?? false;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Folio</p>
          <p className="font-mono text-2xl font-bold text-ink">{order.folio}</p>
        </div>
        {variant === "view" && (
          <Badge variant={ORDER_STATUS_BADGE[order.status]} className="text-sm">
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-border bg-surface-2/50 p-4 sm:grid-cols-3">
        <Field label="Fecha" value={formatDate(order.order_date)} />
        <Field label="Vendedor" value={`${salesperson.name} (${salesperson.prefix})`} />
        <Field label="Cliente" value={order.client_name} />
        <Field label="Proveedor" value={order.supplier_name} />
        <Field label="Tipo de producto" value={PRODUCT_TYPE_LABELS[order.product_type]} />
      </dl>

      {items.length > 0 && (
        <Section title="Productos">
          <div className="space-y-3">
            {items.map((item) => {
              const imageUrl = item.image_path ? mediaUrls[item.image_path] : null;
              return (
                <div key={item.id} className="flex gap-3 rounded-lg border border-border p-3">
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
                      {item.model} <span className="font-normal text-ink-faint">× {item.quantity}</span>
                    </p>
                    {item.description && <p className="text-sm text-ink-soft">{item.description}</p>}
                    {item.notes && <p className="text-xs text-ink-faint">{item.notes}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {isProjector && (
        <>
          <Section title="Proyector">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <Field label="Modelo" value={order.projector_model} />
              <Field label="Cantidad" value={order.projector_quantity} />
              <Field label="Potencia / versión" value={order.projector_power} />
              <Field
                label="Lente"
                value={order.projector_lens_pending_factory ? "Por definir por fábrica" : order.projector_lens_type}
              />
            </dl>
          </Section>

          <Section title="Proyección">
            <div className="space-y-3">
              <Field label="Descripción" value={order.projection_description} />
              {projectionSize && <Field label="Tamaño de proyección" value={projectionSize} />}
              {order.projection_file_path && (
                <div>
                  <dt className="mb-1.5 text-xs text-ink-faint">Imagen a proyectar</dt>
                  {projectionIsImage && projectionImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={projectionImageUrl}
                      alt="Imagen a proyectar"
                      className="max-h-72 w-auto rounded-lg border border-border object-contain"
                    />
                  ) : (
                    <a
                      href={projectionImageUrl ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-accent hover:underline"
                    >
                      <FileText className="h-4 w-4" />
                      {order.projection_file_name ?? "Ver archivo"}
                    </a>
                  )}
                </div>
              )}
            </div>
          </Section>

          <Section title="Instalación">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <Field
                label="Altura"
                value={formatMeasure(order.installation_height, order.installation_height_unit)}
              />
              <Field
                label="Distancia"
                value={formatMeasure(order.installation_distance, order.installation_height_unit)}
              />
              <Field
                label="Orientación"
                value={order.installation_orientation ? ORIENTATION_LABELS[order.installation_orientation] : null}
              />
              <Field label="Uso" value={order.installation_use ? USE_LABELS[order.installation_use] : null} />
            </dl>
          </Section>

          <Section title="Superficie">
            <p className="text-sm text-ink">
              {[
                order.surface_type ? SURFACE_TYPE_LABELS[order.surface_type] : null,
                order.surface_material ? SURFACE_MATERIAL_LABELS[order.surface_material] : null,
              ]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
            {order.surface_notes && <p className="mt-1 text-sm text-ink-soft">{order.surface_notes}</p>}
          </Section>
        </>
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
                    <figcaption className="border-t border-border px-2 py-1 text-xs text-ink-faint">
                      {img.caption}
                    </figcaption>
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
          {variant === "view" && order.general_notes && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink-faint">{order.general_notes}</p>
          )}
        </Section>
      )}

      {variant === "view" && files.length > 0 && (
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
