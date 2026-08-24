import { FileText } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { formatDate, formatMeasure } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import {
  BUSINESS_UNIT_LABELS,
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABELS,
} from "@/types/domain";
import type {
  Orientation,
  ProductType,
  SurfaceMaterial,
  SurfaceType,
  UseEnvironment,
} from "@/types/domain";
import { getOrderDetail } from "@/components/orders/get-order-detail";
import { PrintButton } from "./print-button";
import { PrintDocumentScaler } from "@/app/(print)/print-document-scaler";

export const dynamic = "force-dynamic";

/**
 * PDF de un Pedido — THÖREN Fase 6G, homologado con el rediseño premium del
 * PDF de Quote (Q6/"THÖREN — REDISEÑO PREMIUM DE QUOTE PDF"): misma
 * mecánica técnica (PrintDocumentScaler para móvil, layout de documento de
 * ancho fijo, @page A4 de globals.css, break-inside-avoid por bloque), sin
 * copiar contenido comercial — Orders nunca maneja dinero, así que aquí no
 * hay tabla de precios/totales/IVA.
 *
 * DESACOPLE (Fase 6G): esta página ya NO reutiliza OrderDetailContent —
 * antes compartía ese componente con la vista en pantalla vía un prop
 * `variant`, lo que impedía rediseñar el PDF sin arriesgar la vista (y
 * viceversa). Ahora tiene su propio layout dedicado, igual que
 * (print)/cotizaciones/[id]/pdf. Sí reutiliza `getOrderDetail()` para los
 * datos (fetch puro, sin acoplamiento visual) — evita reescribir la
 * resolución de order_item_images/mediaUrls que ya funciona correctamente.
 *
 * El PDF sigue en inglés (opera con proveedores en fábrica en China); la
 * app y la captura de datos permanecen en español — mismo criterio que ya
 * existía antes de esta fase. Las constantes EN_* de aquí abajo antes
 * vivían en order-detail-content.tsx; se movieron a este archivo porque ya
 * son exclusivas del PDF (la vista en pantalla nunca las necesitó).
 *
 * BRANDING (Fase 6G): el header muestra el logo real de la Business Unit
 * del pedido (business_units.logo_path, mismo bucket/patrón que Quote PDF)
 * cuando order.business_unit_id está asignado y esa BU tiene logo. Si no
 * hay logo (o no hay business_unit_id — la columna es nullable, a
 * diferencia de quotes.business_unit_id, ver 0022/0032), cae a un bloque de
 * texto: THÖREN / nombre de organización / nombre de Business Unit — nombre
 * real de business_units si hay business_unit_id, o la etiqueta del enum
 * legacy `business_unit` si no (todo pedido creado antes de Fase 6F cae en
 * este último caso). Igual que Quote PDF: toda lectura respeta RLS: si algo
 * no es visible o no existe, la variable queda null/"" y esa línea
 * simplemente no se imprime — el PDF nunca se rompe por falta de logo.
 *
 * ORIGEN DE COTIZACIÓN (Fase 6G): si `order.source_quote_id` existe, se
 * muestra una línea discreta con el folio de la Quote origen (texto
 * pequeño, tenue) debajo de la barra de metadatos — deliberadamente sutil,
 * es trazabilidad para quien lee el PDF, no un dato comercial destacado.
 *
 * FUERA DE ALCANCE en esta fase (pedido explícito del usuario):
 * payment_terms/delivery_time/warranty/customer_notes NO se agregan — esas
 * columnas no existen hoy en `orders`/`order_items` (son exclusivas de
 * `quotes`/`quote_items`, 0025) y agregarlas requeriría su propia
 * migración, fuera de esta fase.
 */

// Solo cubre los 5 tipos históricos (ver ProductType en types/domain.ts).
// Un tipo nuevo dado de alta desde Configuración → Tipos de producto no
// tiene traducción aquí a propósito — no se inventan traducciones técnicas
// permanentes; en ese caso el PDF cae de vuelta al snapshot en español del
// pedido (mismo criterio ya usado para vendor_notes_en/
// projection_description_en/surface_notes_en: si no hay texto en inglés,
// se usa el texto en español).
const EN_PRODUCT_TYPE_LABELS: Partial<Record<ProductType, string>> = {
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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function ImageThumbRow({ images, mediaUrls }: { images: { id: string; storage_path: string; file_name: string | null; file_type: string | null }[]; mediaUrls: Record<string, string> }) {
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
            alt={img.file_name ?? "Reference image"}
            className="h-20 w-20 rounded-lg border border-border object-cover"
          />
        ) : (
          <span
            key={img.id}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-border text-center text-[10px] text-ink-faint"
          >
            <FileText className="h-4 w-4" />
            {img.file_name ?? "File"}
          </span>
        );
      })}
    </div>
  );
}

export default async function PedidoPdfPage({ params }: { params: { id: string } }) {
  const detail = await getOrderDetail(params.id);
  const { order, salesperson, items, itemImages, images, mediaUrls } = detail;
  const isProjector = order.product_type === "proyector_gobo";

  const supabase = createSupabaseServerClient();
  const [{ data: organization }, { data: businessUnit }, { data: sourceQuote }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", order.organization_id).maybeSingle(),
    order.business_unit_id
      ? supabase.from("business_units").select("name, logo_path").eq("id", order.business_unit_id).maybeSingle()
      : Promise.resolve({ data: null as { name: string; logo_path: string | null } | null }),
    order.source_quote_id
      ? supabase.from("quotes").select("folio").eq("id", order.source_quote_id).maybeSingle()
      : Promise.resolve({ data: null as { folio: string } | null }),
  ]);

  const organizationName = organization?.name ?? "";
  const signedLogoUrl = businessUnit?.logo_path ? await getSignedUrl("business-unit-assets", businessUnit.logo_path) : null;
  // Nombre a mostrar cuando no hay logo: el real de business_units si el
  // pedido ya tiene business_unit_id asignado (Fase 6F); si no, la
  // etiqueta del enum legacy `business_unit` — nunca se inventa un nombre.
  const businessUnitDisplayName = businessUnit?.name ?? BUSINESS_UNIT_LABELS[order.business_unit];
  const sourceQuoteFolio = sourceQuote?.folio ?? null;

  const productTypeNameEs = order.product_type_name_snapshot ?? order.product_type;
  const productTypeNameEn = EN_PRODUCT_TYPE_LABELS[order.product_type as ProductType] ?? productTypeNameEs;
  const vendorNotes = order.vendor_notes_en || order.vendor_notes;
  const generatedOn = formatDate(new Date().toISOString());

  return (
    <div className="min-h-screen overflow-x-hidden bg-surface-2 py-8 print:min-h-0 print:overflow-visible print:bg-white print:py-0">
      <div className="no-print sticky top-0 z-10 mb-6 flex justify-center">
        <PrintButton />
      </div>

      <PrintDocumentScaler>
        <div className="mx-auto w-[768px] max-w-none rounded-xl border border-border bg-surface p-8 shadow-card print:w-auto print:max-w-3xl print:rounded-none print:border-0 print:shadow-none print:p-0">
          <header className="mb-6 flex items-start justify-between gap-6 border-b-2 border-border pb-6 break-inside-avoid">
            <div className="min-w-0">
              {signedLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signedLogoUrl}
                  alt={businessUnitDisplayName}
                  className="max-h-24 max-w-[300px] object-contain object-left"
                />
              ) : (
                <>
                  <p className="text-lg font-bold uppercase tracking-widest text-accent">THÖREN</p>
                  {organizationName && <p className="text-sm text-ink-soft">{organizationName}</p>}
                  <p className="text-xs uppercase tracking-wide text-ink-faint">{businessUnitDisplayName}</p>
                </>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs uppercase tracking-wide text-ink-faint">Purchase / Production Order</p>
              <p className="font-mono text-2xl font-bold text-ink">{order.folio}</p>
              <Badge variant={ORDER_STATUS_BADGE[order.status]} className="mt-1.5">
                {ORDER_STATUS_LABELS[order.status]}
              </Badge>
            </div>
          </header>

          <div className="mb-2 grid grid-cols-2 gap-4 rounded-lg bg-surface-2/60 px-4 py-3 text-sm break-inside-avoid sm:grid-cols-3 print:py-2">
            <Field label="Date" value={formatDate(order.order_date)} />
            <Field label="Salesperson" value={`${salesperson.name} (${salesperson.prefix})`} />
            <Field label="Customer" value={order.client_name} />
            <Field label="Supplier" value={order.supplier_name} />
            <Field label="Product Type" value={productTypeNameEn} />
          </div>

          {sourceQuoteFolio && (
            <p className="mb-6 text-xs text-ink-faint break-inside-avoid print:mb-4">Origin: Quote {sourceQuoteFolio}</p>
          )}

          {items.length > 0 && (
            <section className="break-inside-avoid">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Products</p>
              <div className="space-y-4">
                {items.map((item, index) => {
                  const imageUrl = item.image_path ? mediaUrls[item.image_path] : null;
                  const ownImages = itemImages.filter((img) => img.order_item_id === item.id);
                  const referenceImages = ownImages.filter((img) => img.kind === "reference");
                  const projectionImages = ownImages.filter((img) => img.kind === "projection");
                  const itemProjectionDescription = item.projection_description_en || item.projection_description;
                  const itemProjectionSize =
                    item.projection_width != null && item.projection_height != null
                      ? `${item.projection_width} ${item.projection_size_unit} × ${item.projection_height} ${item.projection_size_unit}`
                      : null;
                  const itemSurfaceNotes = item.surface_notes_en || item.surface_notes;
                  const specs = [
                    item.power ? `Power/Version: ${item.power}` : null,
                    item.color ? `Color: ${item.color}` : null,
                    item.lens_pending_factory
                      ? "Lens: To be defined by factory"
                      : item.lens_type
                        ? `Lens: ${item.lens_type}`
                        : null,
                  ].filter(Boolean);

                  return (
                    <div key={item.id} className="break-inside-avoid rounded-lg border border-border p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Item {index + 1}</p>
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
                            Model: {item.model} <span className="font-normal text-ink-faint">· Quantity: {item.quantity}</span>
                          </p>
                          {item.description && <p className="text-sm text-ink-soft">{item.description}</p>}
                          {item.unit && <p className="mt-1 text-xs text-ink-faint">Unit: {item.unit}</p>}
                          {item.customer_requirements && (
                            <p className="text-xs text-ink-faint">Customer requirements: {item.customer_requirements}</p>
                          )}
                          {specs.length > 0 && <p className="mt-1 text-xs text-ink-faint">{specs.join(" · ")}</p>}
                          {item.notes && <p className="text-xs text-ink-faint">{item.notes}</p>}
                        </div>
                      </div>

                      {referenceImages.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-1.5 text-xs text-ink-faint">Product images / references</p>
                          <ImageThumbRow images={referenceImages} mediaUrls={mediaUrls} />
                        </div>
                      )}

                      {isProjector && (projectionImages.length > 0 || itemProjectionDescription || itemProjectionSize) && (
                        <div className="mt-3 border-t border-border pt-3">
                          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Projected Image</p>
                          {itemProjectionDescription && (
                            <p className="text-sm text-ink">Requested content: {itemProjectionDescription}</p>
                          )}
                          {projectionImages.length > 0 && (
                            <div className="mt-2">
                              <ImageThumbRow images={projectionImages} mediaUrls={mediaUrls} />
                            </div>
                          )}
                          {itemProjectionSize && (
                            <p className="mt-2 text-sm text-ink-soft">
                              Projection dimensions: <span className="font-medium text-ink">{itemProjectionSize}</span>
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
                            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Installation</p>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                              <Field
                                label="Installation Height"
                                value={formatMeasure(item.installation_height, item.installation_height_unit)}
                              />
                              <Field
                                label="Orientation"
                                value={item.installation_orientation ? EN_ORIENTATION_LABELS[item.installation_orientation] : null}
                              />
                              <Field
                                label="Projector-to-surface distance"
                                value={formatMeasure(item.installation_distance, item.installation_height_unit)}
                              />
                              <Field
                                label="Use"
                                value={item.installation_use ? EN_USE_LABELS[item.installation_use] : null}
                              />
                            </dl>
                          </div>
                        )}

                      {isProjector && (item.surface_type || item.surface_material || itemSurfaceNotes) && (
                        <div className="mt-3 border-t border-border pt-3">
                          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Projection Surface</p>
                          <p className="text-sm text-ink">
                            {[
                              item.surface_type ? EN_SURFACE_TYPE_LABELS[item.surface_type] : null,
                              item.surface_material ? EN_SURFACE_MATERIAL_LABELS[item.surface_material] : null,
                            ]
                              .filter(Boolean)
                              .join(" ") || "—"}
                          </p>
                          {itemSurfaceNotes && <p className="mt-1 text-sm text-ink-soft">{itemSurfaceNotes}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {images.length > 0 && (
            <section className="mt-6 break-inside-avoid print:mt-4">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Installation Photos</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {images.map((img) => {
                  const url = mediaUrls[img.storage_path];
                  return (
                    <figure key={img.id} className="break-inside-avoid overflow-hidden rounded-lg border border-border">
                      {url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={img.caption ?? "Photo"} className="aspect-square w-full object-cover" />
                      )}
                      {img.caption && (
                        <figcaption className="border-t border-border px-2 py-1 text-xs text-ink-faint">{img.caption}</figcaption>
                      )}
                    </figure>
                  );
                })}
              </div>
            </section>
          )}

          {vendorNotes && (
            <section className="mt-6 break-inside-avoid print:mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Notes</p>
              <p className="whitespace-pre-wrap rounded-lg border border-border px-4 py-3 text-sm text-ink print:py-2">
                {vendorNotes}
              </p>
            </section>
          )}

          <footer className="mt-10 border-t border-border pt-4 text-xs text-ink-faint break-inside-avoid print:mt-6 print:pt-3">
            <div className="flex items-center justify-between">
              <span>
                {businessUnitDisplayName}
                {organizationName ? ` · ${organizationName}` : ""}
              </span>
              <span>Order No. {order.folio}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Generated on {generatedOn}</span>
              <span>Generated by THÖREN</span>
            </div>
          </footer>
        </div>
      </PrintDocumentScaler>
    </div>
  );
}
