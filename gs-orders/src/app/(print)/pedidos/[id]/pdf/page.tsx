import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { formatDate } from "@/lib/utils/format";
import { buildOrderPdfFilename } from "@/lib/utils/filename";
import { Badge } from "@/components/ui/badge";
import {
  BUSINESS_UNIT_LABELS,
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABELS,
  ORIENTATION_LABELS,
  SURFACE_MATERIAL_LABELS,
  SURFACE_TYPE_LABELS,
  USE_LABELS,
} from "@/types/domain";
import { getOrderDetail } from "@/components/orders/get-order-detail";
import { getProviderDocumentLanguage, type ProviderDocumentLanguage } from "@/lib/orders/process-settings";
import {
  providerLabel,
  translateDate,
  translateOrderStatus,
  translateOrientation,
  translateSurfaceMaterial,
  translateSurfaceType,
  translateUnit,
  translateUse,
} from "./provider-i18n";
import { PrintButton } from "./print-button";
import { PrintDocumentScaler } from "@/app/(print)/print-document-scaler";

export const dynamic = "force-dynamic";

/**
 * document.title de esta página — el navegador lo usa como nombre
 * sugerido al "Guardar como PDF" (window.print()) y como título de la
 * pestaña/encabezado de impresión. Antes esta página nunca lo
 * sobreescribía, así que siempre heredaba "THÖREN" del layout raíz — el
 * mismo bug que ya se había resuelto para el PDF de Quote
 * (buildQuotePdfFilename) nunca se replicó aquí. Consulta liviana propia
 * (solo `folio`), separada de getOrderDetail(), para no duplicar el fetch
 * completo del pedido solo para el título.
 *
 * IDIOMA (Adenda PDF Pedido — idioma para Proveedor, 0063): el nombre de
 * archivo también depende de `business_unit_process_settings.
 * provider_document_language` — "Pedido-{FOLIO}" en español (default,
 * sin cambio) o "Purchase-Order-{FOLIO}" cuando la Business Unit del
 * pedido está configurada en inglés. El folio real siempre queda visible
 * en ambos casos.
 */
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("orders")
    .select("folio, business_unit_id")
    .eq("id", params.id)
    .single();
  if (!data) return {};
  const documentLanguage = await getProviderDocumentLanguage(supabase, data.business_unit_id);
  return { title: buildOrderPdfFilename(data.folio, documentLanguage) };
}

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
 * IDIOMA (ajuste post-6G, español completo): el PDF salía en inglés para
 * fábrica; el usuario pidió español completo (mismo idioma que la app y
 * la captura de datos) — ya no usa las columnas *_en (vendor_notes_en/
 * projection_description_en/surface_notes_en); esas columnas siguen
 * existiendo en la BD pero no se leen aquí.
 *
 * IDIOMA PARA PROVEEDOR (Adenda PDF Pedido, 0063): español sigue siendo
 * el idioma real de captura y el default de este documento. Cuando
 * `business_unit_process_settings.provider_document_language` de la
 * Business Unit del pedido es 'en' (dato, nunca
 * `if businessUnit.code === 'thunder_led'`), las etiquetas fijas del
 * documento y los valores de los enums legacy (orientación/uso/
 * superficie/unidad/estado/fecha) se traducen vía `./provider-i18n`
 * (`providerLabel`/`translate*`), reutilizando las mismas constantes de
 * dominio (ORIENTATION_LABELS/USE_LABELS/SURFACE_TYPE_LABELS/
 * SURFACE_MATERIAL_LABELS) solo como fallback en español. Nombre de
 * cliente/proveedor, modelo/SKU y cualquier texto libre
 * (descripción/notas/requisitos) NUNCA pasan por una función de
 * traducción — se imprimen tal cual, en cualquier idioma.
 *
 * COMPACTACIÓN (ajuste post-6G): cada partida condensa Modelo/SKU +
 * Cantidad + Unidad en una sola línea, y solo agrega líneas adicionales
 * cuando el dato realmente existe (descripción/requisitos del
 * cliente/specs/notas) — menos padding/alto por tarjeta para aprovechar
 * mejor la hoja A4 en pedidos con varias partidas.
 *
 * BRANDING: el header muestra el logo real de la Business Unit del pedido
 * (business_units.logo_path, mismo bucket/patrón que Quote PDF) cuando
 * order.business_unit_id está asignado y esa BU tiene logo. Si no hay logo
 * (o no hay business_unit_id — la columna es nullable, a diferencia de
 * quotes.business_unit_id, ver 0022/0032), cae a un bloque de texto: THÖREN
 * / nombre de organización / nombre de Business Unit — nombre real de
 * business_units si hay business_unit_id, o la etiqueta del enum legacy
 * `business_unit` si no (todo pedido creado antes de Fase 6F cae en este
 * último caso). Igual que Quote PDF: toda lectura respeta RLS: si algo no
 * es visible o no existe, la variable queda null/"" y esa línea
 * simplemente no se imprime — el PDF nunca se rompe por falta de logo.
 *
 * ORIGEN DE COTIZACIÓN: si `order.source_quote_id` existe, se muestra una
 * línea discreta con el folio de la Quote origen (texto pequeño, tenue)
 * debajo de la barra de metadatos — deliberadamente sutil, es trazabilidad
 * para quien lee el PDF, no un dato comercial destacado.
 *
 * FUERA DE ALCANCE (pedido explícito del usuario): payment_terms/
 * delivery_time/warranty/customer_notes NO se agregan — esas columnas no
 * existen hoy en `orders`/`order_items` (son exclusivas de `quotes`/
 * `quote_items`, 0025) y agregarlas requeriría su propia migración, fuera
 * de esta fase.
 */

/**
 * Igual que formatMeasure (lib/utils/format.ts) pero traduce la unidad
 * ("pies" → "ft") cuando el documento es en inglés — deliberadamente
 * local a esta página de impresión, no toca formatMeasure (usado por el
 * resto de la app, siempre en español).
 */
function formatMeasureLocalized(
  value: number | null | undefined,
  unit: string | null | undefined,
  language: ProviderDocumentLanguage
) {
  if (value === null || value === undefined) return null;
  const unitLabel = unit ? translateUnit(unit, language) : "";
  return `${value} ${unitLabel}`.trim();
}

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
            alt={img.file_name ?? "Imagen de referencia"}
            className="h-16 w-16 rounded-lg border border-border object-cover"
          />
        ) : (
          <span
            key={img.id}
            className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border border-border text-center text-[10px] text-ink-faint"
          >
            <FileText className="h-4 w-4" />
            {img.file_name ?? "Archivo"}
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
  const [{ data: organization }, { data: businessUnit }, { data: sourceQuote }, documentLanguage] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", order.organization_id).maybeSingle(),
    order.business_unit_id
      ? supabase.from("business_units").select("name, logo_path").eq("id", order.business_unit_id).maybeSingle()
      : Promise.resolve({ data: null as { name: string; logo_path: string | null } | null }),
    order.source_quote_id
      ? supabase.from("quotes").select("folio").eq("id", order.source_quote_id).maybeSingle()
      : Promise.resolve({ data: null as { folio: string } | null }),
    getProviderDocumentLanguage(supabase, order.business_unit_id),
  ]);

  const organizationName = organization?.name ?? "";
  const signedLogoUrl = businessUnit?.logo_path ? await getSignedUrl("business-unit-assets", businessUnit.logo_path) : null;
  // Nombre a mostrar cuando no hay logo: el real de business_units si el
  // pedido ya tiene business_unit_id asignado (Fase 6F); si no, la
  // etiqueta del enum legacy `business_unit` — nunca se inventa un nombre.
  const businessUnitDisplayName =
    businessUnit?.name ?? (order.business_unit ? BUSINESS_UNIT_LABELS[order.business_unit] : "");
  const sourceQuoteFolio = sourceQuote?.folio ?? null;

  const productTypeName = order.product_type_name_snapshot ?? order.product_type;
  const nowIso = new Date().toISOString();
  const generatedOn = translateDate(nowIso, documentLanguage, formatDate(nowIso));

  return (
    <div className="min-h-screen overflow-x-hidden bg-surface-2 py-8 print:min-h-0 print:overflow-visible print:bg-white print:py-0">
      <div className="no-print sticky top-0 z-10 mb-6 flex justify-center">
        <PrintButton />
      </div>

      <PrintDocumentScaler>
        <div className="mx-auto w-[768px] max-w-none rounded-xl border border-border bg-surface p-8 shadow-card print:w-auto print:max-w-3xl print:rounded-none print:border-0 print:shadow-none print:p-0">
          <header className="mb-6 flex items-start justify-between gap-6 border-b-2 border-border pb-6 break-inside-avoid print:mb-3 print:pb-3">
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
              <p className="text-xs uppercase tracking-wide text-ink-faint">{providerLabel("purchaseProductionOrder", documentLanguage)}</p>
              <p className="font-mono text-2xl font-bold text-ink">{order.folio}</p>
              <Badge variant={ORDER_STATUS_BADGE[order.status]} className="mt-1.5">
                {translateOrderStatus(order.status, documentLanguage, ORDER_STATUS_LABELS[order.status])}
              </Badge>
            </div>
          </header>

          <div className="mb-2 grid grid-cols-2 gap-4 rounded-lg bg-surface-2/60 px-4 py-3 text-sm break-inside-avoid sm:grid-cols-3 print:py-2">
            <Field label={providerLabel("date", documentLanguage)} value={translateDate(order.order_date, documentLanguage, formatDate(order.order_date))} />
            <Field label={providerLabel("salesperson", documentLanguage)} value={`${salesperson.name} (${salesperson.prefix})`} />
            <Field label={providerLabel("customer", documentLanguage)} value={order.client_name} />
            <Field label={providerLabel("supplier", documentLanguage)} value={order.supplier_name} />
            <Field label={providerLabel("productType", documentLanguage)} value={productTypeName} />
          </div>

          {sourceQuoteFolio && (
            <p className="mb-6 text-xs text-ink-faint break-inside-avoid print:mb-2">{providerLabel("sourceQuote", documentLanguage)} {sourceQuoteFolio}</p>
          )}

          {items.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{providerLabel("products", documentLanguage)}</p>
              <div className="space-y-2.5 print:space-y-1.5">
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
                    item.power ? `${providerLabel("powerVersion", documentLanguage)}: ${item.power}` : null,
                    item.color ? `${providerLabel("color", documentLanguage)}: ${item.color}` : null,
                    item.lens_pending_factory
                      ? `${providerLabel("lens", documentLanguage)}: ${providerLabel("lensPendingFactory", documentLanguage)}`
                      : item.lens_type
                        ? `${providerLabel("lens", documentLanguage)}: ${item.lens_type}`
                        : null,
                  ].filter(Boolean);

                  return (
                    <div key={item.id} className="break-inside-avoid rounded-lg border border-border p-2.5 print:p-2">
                      <div className="flex gap-2.5">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-2">
                          {imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imageUrl} alt={item.model} className="h-full w-full object-cover" />
                          ) : (
                            <FileText className="h-5 w-5 text-ink-faint" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                            {providerLabel("lineItem", documentLanguage)} {index + 1}
                          </p>
                          <p className="text-sm font-semibold text-ink">
                            {providerLabel("modelSku", documentLanguage)}: {item.model}{" "}
                            <span className="font-normal text-ink-faint">
                              · {providerLabel("quantity", documentLanguage)}: {item.quantity}
                              {item.unit ? ` · ${providerLabel("unit", documentLanguage)}: ${translateUnit(item.unit, documentLanguage)}` : ""}
                            </span>
                          </p>
                          {item.description && <p className="text-sm text-ink-soft">{item.description}</p>}
                          {item.customer_requirements && (
                            <p className="text-xs text-ink-faint">{providerLabel("customerRequirements", documentLanguage)}: {item.customer_requirements}</p>
                          )}
                          {specs.length > 0 && <p className="text-xs text-ink-faint">{specs.join(" · ")}</p>}
                          {item.notes && <p className="text-xs text-ink-faint">{item.notes}</p>}
                        </div>
                      </div>

                      {referenceImages.length > 0 && (
                        <div className="mt-2">
                          <p className="mb-1 text-xs text-ink-faint">{providerLabel("referenceImages", documentLanguage)}</p>
                          <ImageThumbRow images={referenceImages} mediaUrls={mediaUrls} />
                        </div>
                      )}

                      {isProjector && (projectionImages.length > 0 || item.projection_description || itemProjectionSize) && (
                        <div className="mt-2 border-t border-border pt-2">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">{providerLabel("imageToProject", documentLanguage)}</p>
                          {item.projection_description && (
                            <p className="text-sm text-ink">{providerLabel("whatToProject", documentLanguage)}: {item.projection_description}</p>
                          )}
                          {projectionImages.length > 0 && (
                            <div className="mt-1.5">
                              <ImageThumbRow images={projectionImages} mediaUrls={mediaUrls} />
                            </div>
                          )}
                          {itemProjectionSize && (
                            <p className="mt-1.5 text-sm text-ink-soft">
                              {providerLabel("requiredProjectionSize", documentLanguage)}: <span className="font-medium text-ink">{itemProjectionSize}</span>
                            </p>
                          )}
                        </div>
                      )}

                      {isProjector &&
                        (item.installation_height != null ||
                          item.installation_orientation ||
                          item.installation_distance != null ||
                          item.installation_use) && (
                          <div className="mt-2 border-t border-border pt-2">
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">{providerLabel("installation", documentLanguage)}</p>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
                              <Field
                                label={providerLabel("height", documentLanguage)}
                                value={formatMeasureLocalized(item.installation_height, item.installation_height_unit, documentLanguage)}
                              />
                              <Field
                                label={providerLabel("orientation", documentLanguage)}
                                value={
                                  item.installation_orientation
                                    ? translateOrientation(item.installation_orientation, documentLanguage, ORIENTATION_LABELS[item.installation_orientation])
                                    : null
                                }
                              />
                              <Field
                                label={providerLabel("distance", documentLanguage)}
                                value={formatMeasureLocalized(item.installation_distance, item.installation_height_unit, documentLanguage)}
                              />
                              <Field
                                label={providerLabel("use", documentLanguage)}
                                value={item.installation_use ? translateUse(item.installation_use, documentLanguage, USE_LABELS[item.installation_use]) : null}
                              />
                            </dl>
                          </div>
                        )}

                      {isProjector && (item.surface_type || item.surface_material || item.surface_notes) && (
                        <div className="mt-2 border-t border-border pt-2">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">{providerLabel("surface", documentLanguage)}</p>
                          <p className="text-sm text-ink">
                            {[
                              item.surface_type
                                ? translateSurfaceType(item.surface_type, documentLanguage, SURFACE_TYPE_LABELS[item.surface_type])
                                : null,
                              item.surface_material
                                ? translateSurfaceMaterial(item.surface_material, documentLanguage, SURFACE_MATERIAL_LABELS[item.surface_material])
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                          {item.surface_notes && <p className="mt-0.5 text-sm text-ink-soft">{item.surface_notes}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {images.length > 0 && (
            <section className="mt-6 print:mt-2">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">{providerLabel("photos", documentLanguage)}</p>
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
            </section>
          )}

          {order.vendor_notes && (
            <section className="mt-6 break-inside-avoid print:mt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{providerLabel("notes", documentLanguage)}</p>
              <p className="whitespace-pre-wrap rounded-lg border border-border px-4 py-3 text-sm text-ink print:py-2">
                {order.vendor_notes}
              </p>
            </section>
          )}

          <footer className="mt-10 border-t border-border pt-4 text-xs text-ink-faint print:mt-2 print:pt-1.5">
            {/* Vista en pantalla: dos filas legibles, sin restricción de layout. */}
            <div className="print:hidden">
              <div className="flex items-center justify-between">
                <span>
                  {businessUnitDisplayName}
                  {organizationName ? ` · ${organizationName}` : ""}
                </span>
                <span>{providerLabel("orderNumber", documentLanguage)}: {order.folio}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>{providerLabel("generatedOn", documentLanguage)} {generatedOn}</span>
                <span>{providerLabel("generatedByThoren", documentLanguage)}</span>
              </div>
            </div>
            {/*
              Impresión: una sola línea compacta, sin break-inside-avoid.
              El footer con dos filas + break-inside-avoid era exactamente
              lo que empujaba una 3ra página casi vacía (BUG REAL POST-
              DEPLOY, KST-20261009-010): si el contenido de arriba llegaba
              casi al final de la página 2, el footer completo no cabía y
              el navegador lo movía entero a una página 3 nueva. Una línea
              siempre cabe en el espacio que sobra, y sin break-inside-avoid
              el navegador puede acomodarla donde corresponda en vez de
              forzar un salto de página completo.
            */}
            <p className="hidden print:block">
              {businessUnitDisplayName}
              {organizationName ? ` · ${organizationName}` : ""}
              {" · "}
              {providerLabel("orderNumber", documentLanguage)}: {order.folio}
              {" · "}
              {providerLabel("generatedOn", documentLanguage)} {generatedOn}
              {" · "}
              {providerLabel("generatedByThoren", documentLanguage)}
            </p>
          </footer>
        </div>
      </PrintDocumentScaler>
    </div>
  );
}
