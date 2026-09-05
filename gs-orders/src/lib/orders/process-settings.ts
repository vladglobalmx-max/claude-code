import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * THÖREN 8D (gap final) — requisitos CORE configurables por Business Unit
 * antes de "Pedido" (0062_business_unit_process_settings.sql). Deliberadamente
 * separado del motor de custom fields: `supplier_name` es una columna CORE
 * real de `orders`, no algo administrable por tenant vía
 * custom_field_definitions (ese modelo no admite entity_type='order'). La
 * fuente de verdad de "qué Business Unit exige Proveedor" es esta tabla —
 * nunca un `if business_unit.code === 'thunder_led'` en el código.
 */
export async function getRequireSupplierBeforeOrderByBusinessUnit(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<Record<string, boolean>> {
  const { data, error } = await supabase
    .from("business_unit_process_settings")
    .select("business_unit_id, require_supplier_before_order")
    .eq("organization_id", organizationId);
  if (error || !data) return {};

  const map: Record<string, boolean> = {};
  for (const row of data) map[row.business_unit_id] = row.require_supplier_before_order;
  return map;
}

/** Mismo dato que arriba, para una sola Business Unit — usado por el server pre-flight de pedidos/actions.ts. */
export async function getRequireSupplierBeforeOrder(
  supabase: SupabaseClient<Database>,
  businessUnitId: string | null
): Promise<boolean> {
  if (!businessUnitId) return false;
  const { data } = await supabase
    .from("business_unit_process_settings")
    .select("require_supplier_before_order")
    .eq("business_unit_id", businessUnitId)
    .maybeSingle();
  return data?.require_supplier_before_order ?? false;
}
