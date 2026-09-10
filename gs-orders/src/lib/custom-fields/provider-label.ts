import type { CustomFieldDefinition } from "./types";
import type { ProviderDocumentLanguage } from "@/lib/orders/process-settings";

/**
 * THÖREN — Adenda PDF Pedido: etiqueta de un custom field para un
 * documento de PROVEEDOR (ej. inglés), nunca para la UI interna de
 * captura (esa siempre usa `definition.label` tal cual, ver
 * CustomFieldsRenderer — sin cambios). Genérico: no conoce
 * `projection_description` ni ningún campo/BU por nombre.
 *
 * Regla: en español, o sin `supplierLabel` configurado, se usa siempre
 * `label` — nunca se inventa una traducción automática de un texto libre
 * administrado por el tenant.
 */
export function getProviderFieldLabel(
  definition: CustomFieldDefinition,
  language: ProviderDocumentLanguage
): string {
  if (language === "en" && definition.supplierLabel) {
    return definition.supplierLabel;
  }
  return definition.label;
}
