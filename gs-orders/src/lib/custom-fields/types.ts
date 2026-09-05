/**
 * THÖREN 8B — Tenant/Business Unit Customization Core. Tipos compartidos
 * entre Server Actions, el renderer y las pruebas — ver
 * supabase/migrations/0055_custom_fields_core.sql para el esquema real.
 */
export const CUSTOM_FIELD_ENTITY_TYPES = ["product", "quote_item", "order_item"] as const;
export type CustomFieldEntityType = (typeof CUSTOM_FIELD_ENTITY_TYPES)[number];

export const CUSTOM_FIELD_TYPES = ["text", "textarea", "number", "select", "checkbox", "date"] as const;
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
}
