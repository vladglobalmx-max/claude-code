import type { CustomFieldDefinition, CustomFieldParsedValue, CustomFieldRawValue } from "./types";

export type CustomFieldValidationResult =
  | { ok: true; value: CustomFieldParsedValue }
  | { ok: false; error: string };

const EMPTY_VALUE: Omit<CustomFieldParsedValue, "definitionId"> = {
  valueText: null,
  valueNumber: null,
  valueBoolean: null,
  valueDate: null,
  valueJson: null,
};

/** Parsea la forma cruda de un campo "file"/"image": un JSON de rutas de Storage (ver ProductosSection/order-form.tsx). `null`/vacío/JSON inválido → arreglo vacío. */
function parseFileRawValue(raw: CustomFieldRawValue): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Valida y tipa un valor crudo de formulario contra su definición —
 * autoridad real (frontend NUNCA es suficiente, ver DECISIÓN en
 * 0055_custom_fields_core.sql: la RLS protege el organization_id/entidad
 * padre, pero required/tipo/opción válida se validan aquí, no en la DB).
 * `checkbox` usa "on"/"" (mismo criterio que el resto del proyecto, ver
 * formData.get("active") === "on" en configuracion/*\/actions.ts) — nunca
 * "true"/"false" literal.
 */
export function validateCustomFieldValue(
  definition: CustomFieldDefinition,
  raw: CustomFieldRawValue
): CustomFieldValidationResult {
  // checkbox nunca está "vacío" — siempre resuelve a true/false, nunca a
  // null (a diferencia de los demás tipos, donde ausencia = sin responder).
  if (definition.fieldType === "checkbox") {
    const checked = raw === "on";
    if (definition.required && !checked) {
      return { ok: false, error: `${definition.label} es obligatorio.` };
    }
    return { ok: true, value: { definitionId: definition.id, ...EMPTY_VALUE, valueBoolean: checked } };
  }

  // "file"/"image" nunca están "vacíos" por trim de string — su forma
  // cruda es un JSON de rutas, y "vacío" significa arreglo sin elementos.
  if (definition.fieldType === "file" || definition.fieldType === "image") {
    const paths = parseFileRawValue(raw);
    if (definition.required && paths.length === 0) {
      return { ok: false, error: `${definition.label} es obligatorio.` };
    }
    return {
      ok: true,
      value: { definitionId: definition.id, ...EMPTY_VALUE, valueJson: paths.length > 0 ? paths : null },
    };
  }

  const trimmed = raw?.trim() ?? "";
  const isEmpty = trimmed === "";

  if (definition.required && isEmpty) {
    return { ok: false, error: `${definition.label} es obligatorio.` };
  }

  if (isEmpty) {
    return { ok: true, value: { definitionId: definition.id, ...EMPTY_VALUE } };
  }

  switch (definition.fieldType) {
    case "text":
    case "textarea":
      return { ok: true, value: { definitionId: definition.id, ...EMPTY_VALUE, valueText: trimmed } };

    case "number": {
      const n = Number(trimmed);
      if (!Number.isFinite(n)) {
        return { ok: false, error: `${definition.label} debe ser un número válido.` };
      }
      return { ok: true, value: { definitionId: definition.id, ...EMPTY_VALUE, valueNumber: n } };
    }

    case "date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return { ok: false, error: `${definition.label} debe ser una fecha válida (YYYY-MM-DD).` };
      }
      return { ok: true, value: { definitionId: definition.id, ...EMPTY_VALUE, valueDate: trimmed } };
    }

    case "select": {
      const options = definition.options ?? [];
      if (!options.includes(trimmed)) {
        return { ok: false, error: `${definition.label}: opción no válida.` };
      }
      return { ok: true, value: { definitionId: definition.id, ...EMPTY_VALUE, valueText: trimmed } };
    }

    default:
      return { ok: false, error: `${definition.label}: tipo de campo no soportado.` };
  }
}

/** Valida un conjunto completo de definiciones contra los valores crudos de un formulario — se detiene en el primer error. */
export function validateCustomFields(
  definitions: CustomFieldDefinition[],
  rawValues: Record<string, CustomFieldRawValue>
): { ok: true; values: CustomFieldParsedValue[] } | { ok: false; error: string } {
  const values: CustomFieldParsedValue[] = [];
  for (const def of definitions) {
    if (!def.active) continue;
    const result = validateCustomFieldValue(def, rawValues[def.key]);
    if (!result.ok) return result;
    values.push(result.value);
  }
  return { ok: true, values };
}
