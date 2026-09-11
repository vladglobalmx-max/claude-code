import type { OrderItemPayload } from "@/lib/validations/order";
import type { CatalogProductOption, ProductItemDraft } from "@/components/orders/types";
import {
  isLegacyOrderItemFieldKey,
  isLegacyOrderItemFileFieldKey,
  getLegacyOrderItemFieldRawValue,
  getLegacyOrderItemFileValue,
} from "./legacy-order-item-adapter";
import { scopeDefinitionsToItem } from "./scope";
import type { CustomFieldDefinition } from "./types";

/**
 * THÖREN 8D — reemplaza por completo a getMissingProjectorFields/
 * getMissingProjectorFieldsFromRow (validations/order.ts, eliminadas):
 * cero conocimiento de Thunder/GOBO/proyector, cero chequeo de
 * `product_type`. "Qué es obligatorio antes de Pedido" vive ahora
 * exclusivamente en `definition.requiredBeforeOrder` — esta función solo
 * recorre definiciones activas y decide si cada una está "completa" para
 * un producto dado, sin saber qué representa esa clave.
 *
 * Esta es la capa 1 (UX en el cliente) del enforcement de 3 capas — la
 * autoridad real vive en fn_get_missing_required_before_order_fields
 * (0061), invocada dentro de rpc_create_order_with_custom_fields/
 * rpc_update_order_with_custom_fields. Un resultado vacío aquí NUNCA
 * garantiza que el servidor acepte el pedido; solo evita un viaje redondo
 * innecesario para el caso común.
 */
function itemDisplayLabel(model: string | undefined, index: number): string {
  return model && model.trim() ? `Producto ${index + 1} (${model})` : `Producto ${index + 1}`;
}

/** ¿Este producto (borrador de UI) tiene un valor para esta definición? Legacy vía el adapter, custom fields vía customFieldValues/customFieldFiles. */
function isDraftFieldComplete(definition: CustomFieldDefinition, item: ProductItemDraft): boolean {
  if (isLegacyOrderItemFileFieldKey(definition.key)) {
    return getLegacyOrderItemFileValue(item, definition.key).length > 0;
  }
  if (isLegacyOrderItemFieldKey(definition.key)) {
    return getLegacyOrderItemFieldRawValue(item, definition.key).trim() !== "";
  }
  if (definition.fieldType === "file" || definition.fieldType === "image") {
    return (item.customFieldFiles[definition.key]?.length ?? 0) > 0;
  }
  const raw = item.customFieldValues[definition.key];
  if (definition.fieldType === "checkbox") return raw === "on";
  return !!raw && raw.trim() !== "";
}

/**
 * Capa 1 (UX, borrador en memoria de order-form.tsx) — ver documentación
 * arriba del módulo. `productsById` resuelve el Tipo de Producto REAL de
 * cada partida (vía su catalogProductId -> product_catalog.product_type_id)
 * — la aplicabilidad se evalúa POR PARTIDA, nunca por la primera partida
 * ni por un Tipo de Producto general del Pedido (ver DECISIÓN, THÖREN —
 * Bug real: custom fields aplicados al Tipo de Producto incorrecto,
 * 0065).
 */
export function getMissingRequiredCustomFields(
  definitions: CustomFieldDefinition[],
  businessUnitId: string,
  items: ProductItemDraft[],
  productsById: Map<string, CatalogProductOption>
): string[] {
  const missing: string[] = [];
  items.forEach((item, index) => {
    const productTypeId = item.catalogProductId ? productsById.get(item.catalogProductId)?.productTypeId ?? null : null;
    const required = scopeDefinitionsToItem(definitions, businessUnitId, productTypeId).filter(
      (def) => def.active && def.requiredBeforeOrder
    );
    for (const def of required) {
      if (!isDraftFieldComplete(def, item)) {
        missing.push(`${itemDisplayLabel(item.model, index)}: ${def.label}`);
      }
    }
  });
  return missing;
}

/** ¿Este producto (payload a punto de enviarse al servidor) tiene un valor para esta definición? */
function isPayloadFieldComplete(definition: CustomFieldDefinition, item: OrderItemPayload): boolean {
  if (isLegacyOrderItemFileFieldKey(definition.key)) {
    // OrderItemPayload nombra sus campos de archivo igual que las claves
    // legacy del adapter (ver DESCUBRIMIENTO de simetría de nombres, 8D) —
    // projection_images es la única, y su forma en el payload es un
    // arreglo de { path } (orderItemSchema).
    const value = item[definition.key as keyof OrderItemPayload];
    return Array.isArray(value) && value.length > 0;
  }
  if (isLegacyOrderItemFieldKey(definition.key)) {
    const value = item[definition.key as keyof OrderItemPayload];
    if (definition.key === "lens_pending_factory") return value === true;
    return value !== null && value !== undefined && String(value).trim() !== "";
  }
  if (definition.fieldType === "file" || definition.fieldType === "image") {
    try {
      const raw = item.custom_field_values?.[definition.key];
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  }
  const raw = item.custom_field_values?.[definition.key];
  if (definition.fieldType === "checkbox") return raw === "on";
  return !!raw && raw.trim() !== "";
}

/**
 * Capa 2 (pre-flight en el servidor, pedidos/actions.ts, antes del RPC) —
 * ver documentación arriba del módulo. `productTypeIdByCatalogProductId`
 * resuelve el Tipo de Producto REAL de cada partida (vía su
 * catalog_product_id -> product_catalog.product_type_id, obtenido por el
 * llamador con una sola consulta) — la aplicabilidad se evalúa POR
 * PARTIDA, nunca por la primera partida ni por un Tipo de Producto
 * general del Pedido (ver DECISIÓN, THÖREN — Bug real: custom fields
 * aplicados al Tipo de Producto incorrecto, 0065). Esta capa es UX
 * (viaje redondo evitado); la autoridad real que un payload manipulado no
 * puede saltarse usa esta MISMA condición dentro de
 * fn_get_missing_required_before_order_fields (0065).
 */
export function getMissingRequiredCustomFieldsFromPayload(
  definitions: CustomFieldDefinition[],
  businessUnitId: string | null,
  items: OrderItemPayload[],
  productTypeIdByCatalogProductId: Map<string, string | null>
): string[] {
  const missing: string[] = [];
  items.forEach((item, index) => {
    const productTypeId = item.catalog_product_id
      ? productTypeIdByCatalogProductId.get(item.catalog_product_id) ?? null
      : null;
    const required = scopeDefinitionsToItem(definitions, businessUnitId, productTypeId).filter(
      (def) => def.active && def.requiredBeforeOrder
    );
    for (const def of required) {
      if (!isPayloadFieldComplete(def, item)) {
        missing.push(`${itemDisplayLabel(item.model, index)}: ${def.label}`);
      }
    }
  });
  return missing;
}
