import type { MediaDraft, ProductItemDraft } from "@/components/orders/types";

/**
 * THÖREN 8B/8C — puente entre las columnas nativas de order_items
 * heredadas de Thunder LED y el motor de custom_field_definitions. Este es
 * el ÚNICO archivo del proyecto autorizado a conocer estos nombres de
 * columna: el renderer universal (CustomFieldsRenderer) y
 * ProductosSection solo conocen `definition.key` — nunca "power",
 * "proyector_gobo", "installation_*"/"surface_*" ni ningún concepto
 * vertical directamente.
 *
 * DECISIÓN — no se migran datos a custom_field_values todavía: las
 * columnas siguen siendo la fuente de verdad (lectura y escritura). Este
 * adapter solo traduce entre esas columnas y la forma cruda (string) que
 * espera un formulario dirigido por definiciones — igual que
 * validateCustomFieldValue trata cualquier otro campo. Migrar el
 * almacenamiento en sí sería una migración de datos, fuera de alcance
 * (ver DECISIÓN "NO DROP COLUMN. No migración destructiva" de 0055/0056).
 *
 * 8C agrega las 11 claves residuales que hasta entonces seguían
 * gobernadas por `isProjector`/`product_type==='proyector_gobo'` en
 * ProductosSection (imagen a proyectar, instalación, superficie) — el
 * único cambio real es QUIÉN decide mostrarlas (custom_field_definitions,
 * no un product_type hardcodeado); el almacenamiento (columnas de
 * order_items, tabla order_item_images para las imágenes) no cambia.
 *
 * DECISIÓN — opciones de "select" con el código legacy tal cual (p. ej.
 * "piso"/"pared", no "Piso"/"Pared"): las columnas de destino tienen un
 * CHECK con esos códigos exactos en minúsculas (0007_item_installation_
 * and_multi_images.sql) y el modelo de custom_field_definitions.options
 * es un arreglo de strings auto-etiquetado (mismo valor = texto mostrado
 * y valor guardado, ver 0055) — no admite un par código/etiqueta
 * separado. Cambiar ese modelo sería reabrir el motor de 8B, fuera de
 * alcance de 8C. El código en minúsculas queda como texto visible en el
 * selector — una regresión cosmética menor, documentada, no funcional.
 */
export const LEGACY_ORDER_ITEM_FIELD_KEYS = [
  "power",
  "color",
  "lens_type",
  "lens_pending_factory",
  "projection_description",
  "projection_description_en",
  "surface_notes",
  "surface_notes_en",
  "projection_width",
  "projection_height",
  "projection_size_unit",
  "installation_height",
  "installation_height_unit",
  "installation_distance",
  "installation_orientation",
  "installation_use",
  "surface_type",
  "surface_material",
] as const;

export type LegacyOrderItemFieldKey = (typeof LEGACY_ORDER_ITEM_FIELD_KEYS)[number];

const LEGACY_KEY_SET: ReadonlySet<string> = new Set(LEGACY_ORDER_ITEM_FIELD_KEYS);

export function isLegacyOrderItemFieldKey(key: string): key is LegacyOrderItemFieldKey {
  return LEGACY_KEY_SET.has(key);
}

/** Valor crudo (string de formulario) de una columna nativa — mismo formato que espera CustomFieldsRenderer para cualquier otro campo. */
export function getLegacyOrderItemFieldRawValue(item: ProductItemDraft, key: LegacyOrderItemFieldKey): string {
  switch (key) {
    case "power":
      return item.power;
    case "color":
      return item.color;
    case "lens_type":
      return item.lensType;
    case "lens_pending_factory":
      return item.lensPendingFactory ? "on" : "";
    case "projection_description":
      return item.projectionDescription;
    case "projection_description_en":
      return item.projectionDescriptionEn;
    case "surface_notes":
      return item.surfaceNotes;
    case "surface_notes_en":
      return item.surfaceNotesEn;
    case "projection_width":
      return item.projectionWidth;
    case "projection_height":
      return item.projectionHeight;
    case "projection_size_unit":
      return item.projectionSizeUnit;
    case "installation_height":
      return item.installationHeight;
    case "installation_height_unit":
      return item.installationHeightUnit;
    case "installation_distance":
      return item.installationDistance;
    case "installation_orientation":
      return item.orientation;
    case "installation_use":
      return item.use;
    case "surface_type":
      return item.surfaceType;
    case "surface_material":
      return item.surfaceMaterial;
  }
}

/** Traduce un valor crudo de vuelta a un patch de ProductItemDraft — nunca toca customFieldValues para estas claves. */
export function applyLegacyOrderItemFieldValue(key: LegacyOrderItemFieldKey, rawValue: string): Partial<ProductItemDraft> {
  switch (key) {
    case "power":
      return { power: rawValue };
    case "color":
      return { color: rawValue };
    case "lens_type":
      return { lensType: rawValue };
    case "lens_pending_factory":
      return { lensPendingFactory: rawValue === "on" };
    case "projection_description":
      return { projectionDescription: rawValue };
    case "projection_description_en":
      return { projectionDescriptionEn: rawValue };
    case "surface_notes":
      return { surfaceNotes: rawValue };
    case "surface_notes_en":
      return { surfaceNotesEn: rawValue };
    case "projection_width":
      return { projectionWidth: rawValue };
    case "projection_height":
      return { projectionHeight: rawValue };
    case "projection_size_unit":
      return { projectionSizeUnit: rawValue as ProductItemDraft["projectionSizeUnit"] };
    case "installation_height":
      return { installationHeight: rawValue };
    case "installation_height_unit":
      return { installationHeightUnit: rawValue as ProductItemDraft["installationHeightUnit"] };
    case "installation_distance":
      return { installationDistance: rawValue };
    case "installation_orientation":
      return { orientation: rawValue as ProductItemDraft["orientation"] };
    case "installation_use":
      return { use: rawValue as ProductItemDraft["use"] };
    case "surface_type":
      return { surfaceType: rawValue as ProductItemDraft["surfaceType"] };
    case "surface_material":
      return { surfaceMaterial: rawValue as ProductItemDraft["surfaceMaterial"] };
  }
}

/**
 * THÖREN 8C — la única clave legacy respaldada por archivos, no por texto
 * (projection_images vive en order_item_images, no en una columna de
 * order_items — ver 0006_item_projection.sql). Contrato separado del de
 * arriba: MediaDraft[] en vez de string, porque un adjunto no cabe en un
 * <input> de texto — mismo criterio que el resto del adapter (traduce,
 * nunca reinventa dónde vive el dato).
 */
export const LEGACY_ORDER_ITEM_FILE_FIELD_KEYS = ["projection_images"] as const;
export type LegacyOrderItemFileFieldKey = (typeof LEGACY_ORDER_ITEM_FILE_FIELD_KEYS)[number];

const LEGACY_FILE_KEY_SET: ReadonlySet<string> = new Set(LEGACY_ORDER_ITEM_FILE_FIELD_KEYS);

export function isLegacyOrderItemFileFieldKey(key: string): key is LegacyOrderItemFileFieldKey {
  return LEGACY_FILE_KEY_SET.has(key);
}

export function getLegacyOrderItemFileValue(item: ProductItemDraft, key: LegacyOrderItemFileFieldKey): MediaDraft[] {
  switch (key) {
    case "projection_images":
      return item.projectionImages;
  }
}

export function applyLegacyOrderItemFileValue(
  key: LegacyOrderItemFileFieldKey,
  files: MediaDraft[]
): Partial<ProductItemDraft> {
  switch (key) {
    case "projection_images":
      return { projectionImages: files };
  }
}
