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
import type { Orientation, ProductType, SurfaceMaterial, SurfaceType, UseEnvironment } from "@/types/domain";
import type { OrderDetail } from "./get-order-detail";

// El PDF para fábrica sale en inglés (opera con proveedores en China); la
// app y la captura de datos permanecen en español. Este es el único lugar
// que necesita las dos versiones de las etiquetas.
const EN_PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  proyector_gobo: "Projector / Gobo",
  luminaria: "Luminaire",
  equipo_seguridad: "Safety Equipment",
  refaccion_accesorio: "Spare Part / Accessory",
  otro: "Other",
};

const EN_ORIENTATION_LABELS: Record<Orientation, string> = {
  piso: "Facing Floor",
  pared: "Facing Wall",
  inclinado: "Angled",
  otro: "Other",
};

const EN_USE_LABELS: Record<UseEnvironment, string> = {
  interior: "Indoor",
  exterior: "Outdoor",
  semi_exterior: "Semi-outdoor",
};

const EN_SURFACE_TYPE_LABELS: Record<SurfaceType, string> = {
  piso: "Floor",
  pared: "Wall",
  techo: "Ceiling",
  equipo: "Equipment",
  rack: "Rack",
  anden: "Loading Dock",
  pasillo: "Aisle",
  otro: "Other",
};

const EN_SURFACE_MATERIAL_LABELS: Record<SurfaceMaterial, string> = {
  concreto: "Concrete",
  epoxico: "Epoxy",
  asfalto: "Asphalt",
  metal: "Metal",
  pintura: "Painted",
  otro: "Other",
};

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
  const isEn = variant === "print";

  const projectionSize =
    order.projection_width != null && order.projection_height != null
      ? `${order.projection_width} ${order.projection_size_unit} × ${order.projection_height} ${order.projection_size_unit}`
      : null;
  const projectionImageUrl = order.projection_file_path ? mediaUrls[order.projection_file_path] : null;
  const projectionIsImage = order.projection_file_type?.startsWith("image/") ?? false;

  // Texto libre: en el PDF se usa la versión en inglés cuando existe;
  // si está vacía, se usa el texto original en español como respaldo.
  const projectionDescription = isEn
    ? order.projection_description_en || order.projection_description
    : order.projection_description;
  const surfaceNotes = isEn ? order.surface_notes_en || order.surface_notes : order.surface_notes;
  const vendorNotes = isEn ? order.vendor_notes_en || order.vendor_notes : order.vendor_notes;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{isEn ? "Order No." : "Folio"}</p>
          <p className="font-mono text-2xl font-bold text-ink">{order.folio}</p>
        </div>
        {variant === "view" && (
          <Badge variant={ORDER_STATUS_BADGE[order.status]} className="text-sm">
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-border bg-surface-2/50 p-4 print:bg-white sm:grid-cols-3">
        <Field label={isEn ? "Date" : "Fecha"} value={formatDate(order.order_date)} />
        <Field label={isEn ? "Salesperson" : "Vendedor"} value={`${salesperson.name} (${salesperson.prefix})`} />
        <Field label={isEn ? "Customer" : "Cliente"} value={order.client_name} />
        <Field label={isEn ? "Supplier" : "Proveedor"} value={order.supplier_name} />
        <Field
          label={isEn ? "Product Type" : "Tipo de producto"}
          value={isEn ? EN_PRODUCT_TYPE_LABELS[order.product_type] : PRODUCT_TYPE_LABELS[order.product_type]}
        />
      </dl>

      {items.length > 0 && (
        <Section title={isEn ? "Products" : "Productos"}>
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
          <Section title={isEn ? "Projector / Gobo" : "Proyector"}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <Field label={isEn ? "Projector Model" : "Modelo"} value={order.projector_model} />
              <Field label={isEn ? "Quantity" : "Cantidad"} value={order.projector_quantity} />
              <Field label={isEn ? "Power / Version" : "Potencia / versión"} value={order.projector_power} />
              <Field
                label={isEn ? "Lens" : "Lente"}
                value={
                  order.projector_lens_pending_factory
                    ? isEn
                      ? "To be defined by factory"
                      : "Por definir por fábrica"
                    : order.projector_lens_type
                }
              />
            </dl>
          </Section>

          <Section title={isEn ? "Projection" : "Proyección"}>
            <div className="space-y-3">
              <Field label={isEn ? "Requested Projection" : "Descripción"} value={projectionDescription} />
              <Field label={isEn ? "Projection Width" : "Ancho"} value={formatMeasure(order.projection_width, order.projection_size_unit)} />
              <Field label={isEn ? "Projection Height" : "Alto"} value={formatMeasure(order.projection_height, order.projection_size_unit)} />
              {projectionSize && <Field label={isEn ? "Projection Size" : "Tamaño de proyección"} value={projectionSize} />}
              {order.projection_file_path && (
                <div>
                  <dt className="mb-1.5 text-xs text-ink-faint">{isEn ? "Projection Image" : "Imagen a proyectar"}</dt>
                  {projectionIsImage && projectionImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={projectionImageUrl}
                      alt={isEn ? "Projection image" : "Imagen a proyectar"}
                      className="max-h-96 w-auto max-w-full rounded-lg border border-border object-contain print:max-h-[420px]"
                    />
                  ) : (
                    <a
                      href={projectionImageUrl ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-accent hover:underline"
                    >
                      <FileText className="h-4 w-4" />
                      {order.projection_file_name ?? (isEn ? "View file" : "Ver archivo")}
                    </a>
                  )}
                </div>
              )}
            </div>
          </Section>

          <Section title={isEn ? "Installation" : "Instalación"}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <Field
                label={isEn ? "Installation Height" : "Altura"}
                value={formatMeasure(order.installation_height, order.installation_height_unit)}
              />
              <Field
                label={isEn ? "Projection Distance" : "Distancia"}
                value={formatMeasure(order.installation_distance, order.installation_height_unit)}
              />
              <Field
                label={isEn ? "Installation Orientation" : "Orientación"}
                value={
                  order.installation_orientation
                    ? isEn
                      ? EN_ORIENTATION_LABELS[order.installation_orientation]
                      : ORIENTATION_LABELS[order.installation_orientation]
                    : null
                }
              />
              <Field
                label={isEn ? "Indoor / Outdoor" : "Uso"}
                value={order.installation_use ? (isEn ? EN_USE_LABELS[order.installation_use] : USE_LABELS[order.installation_use]) : null}
              />
            </dl>
          </Section>

          <Section title={isEn ? "Projection Surface" : "Superficie"}>
            <p className="text-sm text-ink">
              {[
                order.surface_type ? (isEn ? EN_SURFACE_TYPE_LABELS[order.surface_type] : SURFACE_TYPE_LABELS[order.surface_type]) : null,
                order.surface_material
                  ? isEn
                    ? EN_SURFACE_MATERIAL_LABELS[order.surface_material]
                    : SURFACE_MATERIAL_LABELS[order.surface_material]
                  : null,
              ]
                .filter(Boolean)
                .join(isEn ? " " : " · ") || "—"}
            </p>
            {surfaceNotes && <p className="mt-1 text-sm text-ink-soft">{surfaceNotes}</p>}
          </Section>
        </>
      )}

      {images.length > 0 && (
        <Section title={isEn ? "Installation Photos" : "Fotografías"}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {images.map((img) => {
              const url = mediaUrls[img.storage_path];
              return (
                <figure key={img.id} className="break-inside-avoid overflow-hidden rounded-lg border border-border">
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={img.caption ?? (isEn ? "Photo" : "Fotografía")} className="aspect-square w-full object-cover" />
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

      {(vendorNotes || order.general_notes) && (
        <Section title={isEn ? "Notes" : "Observaciones"}>
          {vendorNotes && <p className="whitespace-pre-wrap text-sm text-ink">{vendorNotes}</p>}
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
