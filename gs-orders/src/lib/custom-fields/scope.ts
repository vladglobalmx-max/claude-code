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
  businessUnitId: string | null
): CustomFieldDefinition[] {
  return definitions.filter((def) => def.businessUnitId === null || def.businessUnitId === businessUnitId);
}

/**
 * THÖREN — Bug real: custom fields aplicados al Tipo de Producto
 * incorrecto (0065). Definiciones visibles para UN order_item concreto:
 * BU-scope (igual que arriba) Y Tipo de Producto-scope, combinados con
 * AND — nunca basta con uno solo. `productTypeId` es el del PRODUCTO de
 * esa línea (product_catalog.product_type_id vía su catalogProductId),
 * nunca orders.product_type (snapshot del Pedido completo, no de la
 * partida) — así un Pedido con partidas de Tipos de Producto distintos
 * resuelve la aplicabilidad de cada una por separado, nunca por la
 * primera partida ni por el header. Misma condición exacta que usa el
 * servidor (fn_apply_order_item_custom_fields /
 * fn_get_missing_required_before_order_fields, 0065) — nunca debe
 * divergir de este filtro.
 */
export function scopeDefinitionsToItem(
  definitions: CustomFieldDefinition[],
  businessUnitId: string | null,
  productTypeId: string | null
): CustomFieldDefinition[] {
  return definitions.filter(
    (def) =>
      (def.businessUnitId === null || def.businessUnitId === businessUnitId) &&
      (def.productTypeId === null || def.productTypeId === productTypeId)
  );
}
