import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * THÖREN Fase 9 / Block 1 (0064_purchase_requirements.sql) — capa de
 * datos para "Necesidades de compra". RLS ya scopa por organización/
 * salesperson (purchase_requirements_select) — este archivo nunca filtra
 * por organización por su cuenta, solo agrega el join de display.
 */
export type OpenPurchaseRequirement = {
  id: string;
  orderId: string;
  orderFolio: string;
  catalogProductId: string;
  productName: string;
  supplierId: string | null;
  supplierName: string | null;
  requiredQty: number;
  allocatedQty: number;
  remainingQty: number;
  status: "open" | "partially_allocated" | "allocated" | "cancelled";
  requiredDate: string | null;
};

/**
 * Necesidades abiertas o parcialmente asignadas (nunca 'allocated'/
 * 'cancelled' — esas ya no requieren acción de Compras). `remainingQty`
 * es lo que TODAVÍA falta cubrir con una PO (required_qty - allocated_qty),
 * el número que de verdad le importa a Compras al decidir cuánto pedir.
 */
export async function getOpenPurchaseRequirements(
  supabase: SupabaseClient<Database>
): Promise<OpenPurchaseRequirement[]> {
  const { data, error } = await supabase
    .from("purchase_requirements")
    .select(
      "id, required_qty, allocated_qty, status, required_date, supplier_id, catalog_product_id, order_id, orders(folio), product_catalog(name), suppliers(name)"
    )
    .in("status", ["open", "partially_allocated"])
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    orderFolio: row.orders?.folio ?? "—",
    catalogProductId: row.catalog_product_id,
    productName: row.product_catalog?.name ?? "—",
    supplierId: row.supplier_id,
    supplierName: row.suppliers?.name ?? null,
    requiredQty: row.required_qty,
    allocatedQty: row.allocated_qty,
    remainingQty: row.required_qty - row.allocated_qty,
    status: row.status,
    requiredDate: row.required_date,
  }));
}

/**
 * order_item "representativo" de un requirement agregado (ver DECISIÓN de
 * granularidad en 0064): el de menor `position` entre los que aportaron a
 * ese requirement — se usa como plantilla de model/description/color/
 * unit al crear la partida de la PO (rpc_create_purchase_order sigue sin
 * cambios: solo necesita UN order_item_id válido por partida).
 */
export async function getRequirementRepresentativeOrderItem(
  supabase: SupabaseClient<Database>,
  requirementId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("purchase_requirement_source_items")
    .select("order_item_id, order_items(position)")
    .eq("purchase_requirement_id", requirementId);

  if (!data || data.length === 0) return null;

  const sorted = [...data].sort((a, b) => (a.order_items?.position ?? 0) - (b.order_items?.position ?? 0));
  return sorted[0]?.order_item_id ?? null;
}
