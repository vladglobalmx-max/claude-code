import type { CustomFieldDefinition } from "./types";

/**
 * Definiciones visibles para una Business Unit concreta: org-wide
 * (businessUnitId null) + las de esa BU puntual — nunca las de otra BU
 * (mismo criterio que getCustomFieldDefinitions en el servidor, aplicado
 * aquí en el cliente porque businessUnitId puede cambiar sin recargar la
 * página, ver ProductosSection). Función pura — sin fetch, sin React.
 */
export function scopeDefinitionsToBusinessUnit(
  definitions: CustomFieldDefinition[],
  businessUnitId: string
): CustomFieldDefinition[] {
  return definitions.filter((def) => def.businessUnitId === null || def.businessUnitId === businessUnitId);
}
