import type { ProductItemDraft } from "@/components/orders/types";

/**
 * THÖREN 8B (Gap 1) — puente entre las 8 columnas nativas de order_items
 * heredadas de Thunder LED y el motor de custom_field_definitions. Este es
 * el ÚNICO archivo del proyecto autorizado a conocer estos nombres de
 * columna: el renderer universal (CustomFieldsRenderer) y
 * ProductosSection solo conocen `definition.key` — nunca "power",
 * "proyector_gobo" ni ningún concepto vertical directamente.
 *
 * DECISIÓN — no se migran datos a custom_field_values todavía: las 8
 * columnas siguen siendo la fuente de verdad (lectura y escritura). Este
 * adapter solo traduce entre esas columnas y la forma cruda (string) que
 * espera un formulario dirigido por definiciones — igual que
 * validateCustomFieldValue trata cualquier otro campo. Migrar el
 * almacenamiento en sí sería una migración de datos, fuera de alcance de
 * este Gap (ver DECISIÓN "NO DROP COLUMN. No migración destructiva" de
 * 0055/0056).
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
] as const;

export type LegacyOrderItemFieldKey = (typeof LEGACY_ORDER_ITEM_FIELD_KEYS)[number];

const LEGACY_KEY_SET: ReadonlySet<string> = new Set(LEGACY_ORDER_ITEM_FIELD_KEYS);

export function isLegacyOrderItemFieldKey(key: string): key is LegacyOrderItemFieldKey {
  return LEGACY_KEY_SET.has(key);
}

/** Valor crudo (string de formulario) de una de las 8 columnas nativas — mismo formato que espera CustomFieldsRenderer para cualquier otro campo. */
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
  }
}

/** Traduce un valor crudo de vuelta a un patch de ProductItemDraft — nunca toca customFieldValues para estas 8 claves. */
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
  }
}
