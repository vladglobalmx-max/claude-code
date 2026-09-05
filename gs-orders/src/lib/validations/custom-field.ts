import { z } from "zod";
import { CUSTOM_FIELD_ENTITY_TYPES, CUSTOM_FIELD_TYPES } from "@/lib/custom-fields/types";

/**
 * `key` es el identificador estable que usa el formulario/persistencia
 * (custom_field_values.definition_id de por medio, pero `key` es lo que
 * ata el valor al campo dentro de un mismo entity_type) — mismo criterio
 * de inmutabilidad-tras-crear que product_types.code (ver
 * validations/product-type.ts): nunca se expone editable en la edición.
 */
export const customFieldKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "La clave debe tener al menos 2 caracteres")
  .max(50, "La clave debe tener máximo 50 caracteres")
  .regex(/^[a-z][a-z0-9_]*$/, "La clave debe iniciar con una letra y usar solo minúsculas, números y guion bajo");

const optionsFromTextarea = (value: unknown) =>
  typeof value === "string"
    ? value
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    : value;

export const customFieldDefinitionSchema = z.object({
  entityType: z.enum(CUSTOM_FIELD_ENTITY_TYPES),
  businessUnitId: z.string().uuid().nullable(),
  key: customFieldKeySchema,
  label: z.string().trim().min(1, "La etiqueta es obligatoria").max(200),
  fieldType: z.enum(CUSTOM_FIELD_TYPES),
  required: z.boolean(),
  // THÖREN 8D — tiers independientes de `required` (obligatorio al
  // capturar): ver DECISIÓN en 0061_configurable_completeness_rules.sql.
  requiredBeforeOrder: z.boolean(),
  requiredBeforeFulfillment: z.boolean(),
  active: z.boolean(),
  sortOrder: z.coerce.number().int(),
  placeholder: z.string().trim().max(200).optional(),
  helpText: z.string().trim().max(500).optional(),
  // Solo tiene sentido para field_type = "select"; se ignora para el resto (ver actions.ts).
  options: z.preprocess(optionsFromTextarea, z.array(z.string().min(1)).optional()),
});

export type CustomFieldDefinitionFormValues = z.infer<typeof customFieldDefinitionSchema>;
