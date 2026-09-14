"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { salesOrderFinancialHoldSchema, salesOrderPaymentSchema, salesOrderPayloadSchema } from "@/lib/validations/sales-order";
import { mapDbError } from "@/lib/db-errors";
import type { SalesOrder, SalesOrderCurrency, SalesOrderPaymentTermsType, SalesOrderStatus } from "@/types/domain";

export type SalesOrderActionResult = { error: string } | void;

export interface SalesOrderWriteItemPayload {
  catalog_product_id: string | null;
  sku_snapshot?: string;
  description_snapshot?: string;
  uom_snapshot?: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax: number;
  estimated_unit_cost?: number;
  estimated_margin?: number;
}

/**
 * Payload que arma SalesOrderForm para rpc_create_sales_order/
 * rpc_update_sales_order (ver 0067_sales_orders_mvp.sql). salesperson_id
 * solo lo usa createSalesOrder — updateSalesOrder lo ignora porque es
 * inmutable una vez creada la SO (trg_prevent_sales_order_identity_change);
 * se valida siempre igual, es cada acción la que decide qué enviar dentro
 * de p_sales_order.
 */
export interface SalesOrderWritePayload {
  customer_id: string;
  salesperson_id: string;
  currency: SalesOrderCurrency;
  exchange_rate?: number;
  payment_terms?: string;
  /** THÖREN Financial Release (0068) — obligatorio; gatea qué camino de liberación aplica. */
  payment_terms_type: SalesOrderPaymentTermsType;
  /** Solo tiene efecto real para 'advance'/'custom' — el servidor lo fuerza para 'cash' (= total) y 'credit' (= NULL). */
  payment_required_amount?: number;
  requested_delivery_date?: string;
  billing_address_snapshot?: string;
  shipping_address_snapshot?: string;
  commercial_notes?: string;
  internal_notes?: string;
  items: SalesOrderWriteItemPayload[];
}

/**
 * Revalida server-side que cada catalog_product_id seleccionado exista y
 * pertenezca a la organización del usuario actual (capa 2, mensaje legible
 * sin viaje redondo) — rpc_create_sales_order/rpc_update_sales_order
 * repiten exactamente esta validación como capa 3 real, nunca confían en
 * que el cliente ya validó. Mismo criterio que
 * validateCatalogProductSelections en cotizaciones/actions.ts.
 */
async function validateCatalogProductSelections(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  items: { catalog_product_id?: string | null }[]
): Promise<{ error: string } | null> {
  const catalogProductIds = Array.from(
    new Set(items.map((item) => item.catalog_product_id).filter((id): id is string => !!id))
  );
  if (catalogProductIds.length === 0) return null;

  const { data: visibleProducts, error } = await supabase.from("product_catalog").select("id").in("id", catalogProductIds);
  if (error) {
    return { error: mapDbError(error, "No se pudieron validar los productos seleccionados.") };
  }
  if ((visibleProducts ?? []).length !== catalogProductIds.length) {
    return { error: "Uno o más productos seleccionados no existen o no pertenecen a tu organización." };
  }
  return null;
}

/**
 * Crea la Sales Order completa (encabezado + líneas) en una sola
 * transacción vía rpc_create_sales_order. El order_number lo asigna
 * fn_next_sales_order_number() dentro del RPC — esta acción nunca lo
 * calcula ni lo previsualiza (mismo criterio que folio de Quotes).
 */
export async function createSalesOrder(salesOrderId: string, payload: SalesOrderWritePayload): Promise<SalesOrderActionResult> {
  const parsed = salesOrderPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();

  const catalogError = await validateCatalogProductSelections(supabase, parsed.data.items);
  if (catalogError) return catalogError;

  const { error } = await supabase.rpc("rpc_create_sales_order", {
    p_sales_order_id: salesOrderId,
    p_sales_order: {
      customer_id: parsed.data.customer_id,
      salesperson_id: parsed.data.salesperson_id,
      currency: parsed.data.currency,
      exchange_rate: parsed.data.exchange_rate ?? null,
      payment_terms: parsed.data.payment_terms ?? null,
      payment_terms_type: parsed.data.payment_terms_type,
      payment_required_amount: parsed.data.payment_required_amount ?? null,
      requested_delivery_date: parsed.data.requested_delivery_date ?? null,
      billing_address_snapshot: parsed.data.billing_address_snapshot ?? null,
      shipping_address_snapshot: parsed.data.shipping_address_snapshot ?? null,
      commercial_notes: parsed.data.commercial_notes ?? null,
      internal_notes: parsed.data.internal_notes ?? null,
    },
    p_items: parsed.data.items,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo crear la Sales Order. Intenta de nuevo.") };
  }

  revalidatePath("/ordenes-venta");
  redirect(`/ordenes-venta/${salesOrderId}`);
}

/**
 * Reemplaza el contenido comercial + líneas de una Sales Order vía
 * rpc_update_sales_order — el propio RPC aborta si la SO ya no está en
 * "draft" (defensa adicional sobre RLS/trigger). salesperson_id no se
 * envía: rpc_update_sales_order no lo lee (inmutable).
 */
export async function updateSalesOrder(salesOrderId: string, payload: SalesOrderWritePayload): Promise<SalesOrderActionResult> {
  const parsed = salesOrderPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();

  const catalogError = await validateCatalogProductSelections(supabase, parsed.data.items);
  if (catalogError) return catalogError;

  const { error } = await supabase.rpc("rpc_update_sales_order", {
    p_sales_order_id: salesOrderId,
    p_sales_order: {
      customer_id: parsed.data.customer_id,
      currency: parsed.data.currency,
      exchange_rate: parsed.data.exchange_rate ?? null,
      payment_terms: parsed.data.payment_terms ?? null,
      payment_terms_type: parsed.data.payment_terms_type,
      payment_required_amount: parsed.data.payment_required_amount ?? null,
      requested_delivery_date: parsed.data.requested_delivery_date ?? null,
      billing_address_snapshot: parsed.data.billing_address_snapshot ?? null,
      shipping_address_snapshot: parsed.data.shipping_address_snapshot ?? null,
      commercial_notes: parsed.data.commercial_notes ?? null,
      internal_notes: parsed.data.internal_notes ?? null,
    },
    p_items: parsed.data.items,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudieron guardar los cambios. Intenta de nuevo.") };
  }

  revalidatePath("/ordenes-venta");
  revalidatePath(`/ordenes-venta/${salesOrderId}`);
  redirect(`/ordenes-venta/${salesOrderId}`);
}

/**
 * Cambia el status de una Sales Order (draft→confirmed|cancelled;
 * confirmed→in_progress|cancelled; in_progress→fulfilled|cancelled;
 * fulfilled→closed). No reimplementa las reglas de transición en la app:
 * trg_sales_order_status_transition (0067) ya las impone en DB, y
 * rpc_update_sales_order_status verifica la autoridad (own-or-admin) antes
 * del UPDATE — este action solo llama al RPC y traduce el error.
 *
 * Validación previa de "al menos 1 línea" al confirmar — regla de
 * razonabilidad comercial (no de integridad de datos: rpc_create_sales_order
 * permite deliberadamente un draft con 0 líneas), mismo criterio que
 * setQuoteStatus con "enviada" en cotizaciones/actions.ts.
 */
export async function setSalesOrderStatus(salesOrderId: string, status: SalesOrderStatus): Promise<SalesOrderActionResult> {
  const supabase = createSupabaseServerClient();

  if (status === "confirmed") {
    const { count, error: countError } = await supabase
      .from("sales_order_items")
      .select("id", { count: "exact", head: true })
      .eq("sales_order_id", salesOrderId);
    if (countError) {
      return { error: mapDbError(countError, "No se pudo verificar las líneas de la Sales Order.") };
    }
    if (!count) {
      return { error: "No puedes confirmar esta Sales Order porque no contiene ninguna línea." };
    }
  }

  const { error } = await supabase.rpc("rpc_update_sales_order_status", {
    p_sales_order_id: salesOrderId,
    p_status: status,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo actualizar el estado de la Sales Order.") };
  }

  revalidatePath("/ordenes-venta");
  revalidatePath(`/ordenes-venta/${salesOrderId}`);
}

/**
 * Edita únicamente `internal_notes` — nunca contenido comercial. A
 * propósito NO usa rpc_update_sales_order: ese RPC rechaza correctamente
 * cualquier escritura fuera de "draft". Un UPDATE directo de
 * internal_notes sí es legítimo en cualquier status porque es la única
 * columna que trg_sales_order_status_transition NO congela — anotación
 * interna, no contenido comercial/legal (mismo criterio que
 * updateQuoteNotes). Sujeto únicamente a RLS (sales_orders_update_own_or_admin).
 */
export async function updateSalesOrderInternalNotes(salesOrderId: string, internalNotes: string): Promise<SalesOrderActionResult> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("sales_orders")
    .update({ internal_notes: internalNotes.trim() || null })
    .eq("id", salesOrderId);

  if (error) {
    return { error: mapDbError(error, "No se pudo guardar la nota interna. Intenta de nuevo.") };
  }

  revalidatePath("/ordenes-venta");
  revalidatePath(`/ordenes-venta/${salesOrderId}`);
}

export type SalesOrderFinancialActionResult = { error: string | null; salesOrder?: SalesOrder };

/**
 * THÖREN Financial Release (0068). Registra un pago vía
 * rpc_register_sales_order_payment — el RPC recalcula amount_paid/
 * financial_status y libera automáticamente cuando corresponde (nunca
 * para crédito). Autoridad real (can_manage_sales_order_finance o admin)
 * la exige el propio RPC + trg_sales_order_financial_guard; este action no
 * reimplementa esa regla, solo traduce el error.
 */
export async function registerSalesOrderPayment(
  salesOrderId: string,
  payload: { amount: number; note?: string }
): Promise<SalesOrderFinancialActionResult> {
  const parsed = salesOrderPaymentSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_register_sales_order_payment", {
    p_sales_order_id: salesOrderId,
    p_amount: parsed.data.amount,
    p_note: parsed.data.note || null,
  });

  if (error || !data) {
    return { error: mapDbError(error, "No se pudo registrar el pago. Intenta de nuevo.") };
  }

  revalidatePath(`/ordenes-venta/${salesOrderId}`);
  return { error: null, salesOrder: data as SalesOrder };
}

/**
 * THÖREN Financial Release (0068). Aprueba crédito vía
 * rpc_approve_sales_order_credit — el RPC rechaza si la Sales Order no
 * está configurada como crédito o si el crédito ya fue aprobado.
 */
export async function approveSalesOrderCredit(salesOrderId: string): Promise<SalesOrderFinancialActionResult> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_approve_sales_order_credit", {
    p_sales_order_id: salesOrderId,
  });

  if (error || !data) {
    return { error: mapDbError(error, "No se pudo aprobar el crédito. Intenta de nuevo.") };
  }

  revalidatePath(`/ordenes-venta/${salesOrderId}`);
  return { error: null, salesOrder: data as SalesOrder };
}

/**
 * THÖREN Financial Release (0068). Bloqueo financiero explícito vía
 * rpc_set_sales_order_financial_hold — motivo obligatorio (validado en
 * capa 2 aquí y en capa 3 real dentro del RPC).
 */
export async function setSalesOrderFinancialHold(
  salesOrderId: string,
  payload: { reason: string }
): Promise<SalesOrderFinancialActionResult> {
  const parsed = salesOrderFinancialHoldSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_set_sales_order_financial_hold", {
    p_sales_order_id: salesOrderId,
    p_reason: parsed.data.reason,
  });

  if (error || !data) {
    return { error: mapDbError(error, "No se pudo bloquear financieramente la Sales Order. Intenta de nuevo.") };
  }

  revalidatePath(`/ordenes-venta/${salesOrderId}`);
  return { error: null, salesOrder: data as SalesOrder };
}

/**
 * THÖREN Financial Release (0068). Re-evalúa y libera vía
 * rpc_release_sales_order — ÚNICAMENTE si la condición financiera ya se
 * cumple (crédito aprobado, o pago suficiente); es el contrapunto de
 * "Bloquear" para cuando un hold se aplicó sobre una Sales Order que ya
 * cumplía la condición.
 */
export async function releaseSalesOrder(salesOrderId: string): Promise<SalesOrderFinancialActionResult> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_release_sales_order", {
    p_sales_order_id: salesOrderId,
  });

  if (error || !data) {
    return { error: mapDbError(error, "No se pudo liberar la Sales Order. Intenta de nuevo.") };
  }

  revalidatePath(`/ordenes-venta/${salesOrderId}`);
  return { error: null, salesOrder: data as SalesOrder };
}
