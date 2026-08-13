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
import type {
  Orientation,
  OrderItemImage,
  ProductType,
  SurfaceMaterial,
  SurfaceType,
  UseEnvironment,
} from "@/types/domain";
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

function ImageThumbRow({
  images,
  mediaUrls,
  isEn,
}: {
  images: OrderItemImage[];
  mediaUrls: Record<string, string>;
  isEn: boolean;
}) {
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
            alt={img.file_name ?? (isEn ? "Reference image" : "Imagen de referencia")}
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
            {img.file_name ?? (isEn ? "File" : "Archivo")}
          </a>
        );
      })}
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
  const { order, salesperson, items, itemImages, images, files, mediaUrls, fileUrls } = detail;
  const isProjector = order.product_type === "proyector_gobo";
  const isEn = variant === "print";

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
          <div className="space-y-4">
            {items.map((item, index) => {
              const imageUrl = item.image_path ? mediaUrls[item.image_path] : null;
              const ownImages = itemImages.filter((img) => img.order_item_id === item.id);
              const referenceImages = ownImages.filter((img) => img.kind === "reference");
              const projectionImages = ownImages.filter((img) => img.kind === "projection");
              const itemProjectionDescription = isEn
                ? item.projection_description_en || item.projection_description
                : item.projection_description;
              const itemProjectionSize =
                item.projection_width != null && item.projection_height != null
                  ? `${item.projection_width} ${item.projection_size_unit} × ${item.projection_height} ${item.projection_size_unit}`
                  : null;
              const itemSurfaceNotes = isEn ? item.surface_notes_en || item.surface_notes : item.surface_notes;
              const specs = [
                item.power ? `${isEn ? "Power/Version" : "Potencia/versión"}: ${item.power}` : null,
                item.lens_pending_factory
                  ? `${isEn ? "Lens" : "Lente"}: ${isEn ? "To be defined by factory" : "Por definir con fábrica"}`
                  : item.lens_type
                    ? `${isEn ? "Lens" : "Lente"}: ${item.lens_type}`
                    : null,
              ].filter(Boolean);

              return (
                <div key={item.id} className="break-inside-avoid rounded-lg border border-border p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    {isEn ? `Item ${index + 1}` : `Producto ${index + 1}`}
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
                        {isEn ? "Model" : "Modelo"}: {item.model}{" "}
                        <span className="font-normal text-ink-faint">
                          · {isEn ? "Quantity" : "Cantidad"}: {item.quantity}
                        </span>
                      </p>
                      {item.description && <p className="text-sm text-ink-soft">{item.description}</p>}
                      {isProjector && specs.length > 0 && (
                        <p className="mt-1 text-xs text-ink-faint">{specs.join(" · ")}</p>
                      )}
                      {item.notes && <p className="text-xs text-ink-faint">{item.notes}</p>}
                    </div>
                  </div>

                  {referenceImages.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1.5 text-xs text-ink-faint">
                        {isEn ? "Product images / references" : "Imágenes de referencia"}
                      </p>
                      <ImageThumbRow images={referenceImages} mediaUrls={mediaUrls} isEn={isEn} />
                    </div>
                  )}

                  {isProjector && (projectionImages.length > 0 || itemProjectionDescription || itemProjectionSize) && (
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                        {isEn ? "Projected Image" : "Imagen a proyectar"}
                      </p>
                      {itemProjectionDescription && (
                        <p className="text-sm text-ink">
                          {isEn ? "Requested content: " : "Qué proyectar: "}
                          {itemProjectionDescription}
                        </p>
                      )}
                      {projectionImages.length > 0 && (
                        <div className="mt-2">
                          <ImageThumbRow images={projectionImages} mediaUrls={mediaUrls} isEn={isEn} />
                        </div>
                      )}
                      {itemProjectionSize && (
                        <p className="mt-2 text-sm text-ink-soft">
                          {isEn ? "Projection dimensions: " : "Medida requerida: "}
                          <span className="font-medium text-ink">{itemProjectionSize}</span>
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
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                          {isEn ? "Installation" : "Instalación"}
                        </p>
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                          <Field
                            label={isEn ? "Installation Height" : "Altura"}
                            value={formatMeasure(item.installation_height, item.installation_height_unit)}
                          />
                          <Field
                            label={isEn ? "Orientation" : "Orientación"}
                            value={
                              item.installation_orientation
                                ? isEn
                                  ? EN_ORIENTATION_LABELS[item.installation_orientation]
                                  : ORIENTATION_LABELS[item.installation_orientation]
                                : null
                            }
                          />
                          <Field
                            label={isEn ? "Projector-to-surface distance" : "Distancia"}
                            value={formatMeasure(item.installation_distance, item.installation_height_unit)}
                          />
                          <Field
                            label={isEn ? "Use" : "Uso"}
                            value={item.installation_use ? (isEn ? EN_USE_LABELS[item.installation_use] : USE_LABELS[item.installation_use]) : null}
                          />
                        </dl>
                      </div>
                    )}

                  {isProjector && (item.surface_type || item.surface_material || itemSurfaceNotes) && (
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                        {isEn ? "Projection Surface" : "Superficie"}
                      </p>
                      <p className="text-sm text-ink">
                        {[
                          item.surface_type
                            ? isEn
                              ? EN_SURFACE_TYPE_LABELS[item.surface_type]
                              : SURFACE_TYPE_LABELS[item.surface_type]
                            : null,
                          item.surface_material
                            ? isEn
                              ? EN_SURFACE_MATERIAL_LABELS[item.surface_material]
                              : SURFACE_MATERIAL_LABELS[item.surface_material]
                            : null,
                        ]
                          .filter(Boolean)
                          .join(isEn ? " " : " · ") || "—"}
                      </p>
                      {itemSurfaceNotes && <p className="mt-1 text-sm text-ink-soft">{itemSurfaceNotes}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
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
