/**
 * THÖREN 8B — Tenant/Business Unit Customization Core. Tipos compartidos
 * entre Server Actions, el renderer y las pruebas — ver
 * supabase/migrations/0055_custom_fields_core.sql para el esquema real.
 */
export const CUSTOM_FIELD_ENTITY_TYPES = ["product", "quote_item", "order_item"] as const;
export type CustomFieldEntityType = (typeof CUSTOM_FIELD_ENTITY_TYPES)[number];

/**
 * THÖREN 8C — "file"/"image" se agregaron para poder eliminar el último
 * hardcode real de Thunder (la imagen a proyectar, hasta 8C forzada por
 * `isProjector`): un adjunto (1 o varios archivos) scoped exactamente
 * igual que cualquier otro custom field — organización + definición +
 * entidad. Reutilizan el Storage/RLS ya existente (uploadMediaFile) — no
 * es un sistema de documentos nuevo. Se guardan como un arreglo de rutas
 * en `custom_field_values.value_json` (columna ya reservada desde 0055
 * exactamente para "un futuro tipo compuesto"). "image" es idéntico a
 * "file" salvo el `accept` del selector — no hay lógica de servidor
 * distinta entre los dos.
 */
export const CUSTOM_FIELD_TYPES = ["text", "textarea", "number", "select", "checkbox", "date", "file", "image"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export interface CustomFieldDefinition {
  id: string;
  organizationId: string;
  businessUnitId: string | null;
  entityType: CustomFieldEntityType;
  key: string;
  label: string;
  fieldType: CustomFieldType;
  required: boolean;
  active: boolean;
  sortOrder: number;
  placeholder: string | null;
  helpText: string | null;
  /** Solo relevante para fieldType === "select" — lista de opciones válidas. */
  options: string[] | null;
  /**
   * THÖREN 8D — obligatorio para marcar un pedido como "Pedido" (no para
   * guardar un Borrador, ver `required` arriba). Enforcement real vive en
   * fn_get_missing_required_before_order_fields (0061), nunca solo en TS.
   */
  requiredBeforeOrder: boolean;
  /**
   * THÖREN 8D — se guarda y se administra, pero esta fase NO conecta
   * ninguna validación real sobre él (deferred a propósito, ver 0061).
   */
  requiredBeforeFulfillment: boolean;
}

/** Valor crudo tal como llega de un <input>/<select> — siempre string u undefined, nunca tipado todavía. */
export type CustomFieldRawValue = string | undefined;

/** Valor ya validado/tipado, listo para persistir en custom_field_values. */
export interface CustomFieldParsedValue {
  definitionId: string;
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  valueDate: string | null;
  /** Solo para fieldType "file"/"image" — arreglo de rutas de Storage (ver 0059). */
  valueJson: string[] | null;
}
