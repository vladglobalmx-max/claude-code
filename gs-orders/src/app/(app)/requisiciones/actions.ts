"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  convertRequisitionToPurchaseOrderSchema,
  purchaseRequisitionPayloadSchema,
} from "@/lib/validations/purchase-requisition";
import { mapDbError } from "@/lib/db-errors";
import type { PurchaseOrder, PurchaseRequisition } from "@/types/domain";

export type PurchaseRequisitionActionResult = { error: string } | void;
export type PurchaseRequisitionResult = { error: string | null; requisition?: PurchaseRequisition };

export interface PurchaseRequisitionWriteItemPayload {
  sales_order_item_id: string;
  quantity_required: number;
  preferred_supplier_id?: string | null;
  supplier_product_reference_id?: string | null;
  notes?: string;
}

/**
 * Payload que arma el formulario de Requisición de Compra para
 * rpc_create_purchase_requisition/rpc_update_purchase_requisition (ver
 * 0069_sales_order_procurement.sql). sales_order_id solo lo usa
 * createPurchaseRequisition — updatePurchaseRequisition lo ignora porque
 * es inmutable una vez creada la requisición
 * (trg_prevent_purchase_requisition_identity_change).
 */
export interface PurchaseRequisitionWritePayload {
  sales_order_id: string;
  notes?: string;
  items: PurchaseRequisitionWriteItemPayload[];
}

/**
 * Crea la requisición completa (encabezado + líneas) en una sola
 * transacción vía rpc_create_purchase_requisition. El requisition_number
 * lo asigna fn_next_purchase_requisition_number() dentro del RPC.
 */
export async function createPurchaseRequisition(payload: PurchaseRequisitionWritePayload): Promise<PurchaseRequisitionActionResult> {
  const parsed = purchaseRequisitionPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const requisitionId = randomUUID();

  const { error } = await supabase.rpc("rpc_create_purchase_requisition", {
    p_requisition_id: requisitionId,
    p_requisition: {
      sales_order_id: parsed.data.sales_order_id,
      notes: parsed.data.notes ?? null,
    },
    p_items: parsed.data.items,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo crear la requisición de compra. Intenta de nuevo.") };
  }

  revalidatePath("/requisiciones");
  revalidatePath(`/ordenes-venta/${parsed.data.sales_order_id}`);
  redirect(`/requisiciones/${requisitionId}`);
}

/**
 * Reemplaza notas + líneas de una requisición vía
 * rpc_update_purchase_requisition — el propio RPC aborta si la
 * requisición ya no está en "draft".
 */
export async function updatePurchaseRequisition(
  requisitionId: string,
  payload: PurchaseRequisitionWritePayload
): Promise<PurchaseRequisitionActionResult> {
  const parsed = purchaseRequisitionPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_update_purchase_requisition", {
    p_requisition_id: requisitionId,
    p_requisition: { notes: parsed.data.notes ?? null },
    p_items: parsed.data.items,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudieron guardar los cambios. Intenta de nuevo.") };
  }

  revalidatePath("/requisiciones");
  revalidatePath(`/requisiciones/${requisitionId}`);
  redirect(`/requisiciones/${requisitionId}`);
}

/** draft -> submitted vía rpc_submit_purchase_requisition (exige al menos 1 línea, verificado en el RPC). */
export async function submitPurchaseRequisition(requisitionId: string): Promise<PurchaseRequisitionResult> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_submit_purchase_requisition", { p_requisition_id: requisitionId });

  if (error || !data) {
    return { error: mapDbError(error, "No se pudo enviar la requisición de compra. Intenta de nuevo.") };
  }

  revalidatePath("/requisiciones");
  revalidatePath(`/requisiciones/${requisitionId}`);
  return { error: null, requisition: data as PurchaseRequisition };
}

/** Cancelación explícita desde cualquier status no terminal vía rpc_cancel_purchase_requisition. */
export async function cancelPurchaseRequisition(requisitionId: string): Promise<PurchaseRequisitionResult> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_cancel_purchase_requisition", { p_requisition_id: requisitionId });

  if (error || !data) {
    return { error: mapDbError(error, "No se pudo cancelar la requisición de compra. Intenta de nuevo.") };
  }

  revalidatePath("/requisiciones");
  revalidatePath(`/requisiciones/${requisitionId}`);
  return { error: null, requisition: data as PurchaseRequisition };
}

export interface ConvertRequisitionPayload {
  supplier_id: string;
  requisition_item_ids: string[];
  supplier_commitment_date?: string;
  estimated_reception_date?: string;
  supplier_reference?: string;
  notes?: string;
}

/**
 * Convierte un subconjunto de líneas de una requisición en UNA Purchase
 * Order (mismo proveedor para todas las líneas seleccionadas) vía
 * rpc_convert_requisition_to_purchase_order — atómico: si falla, la
 * requisición queda exactamente como estaba (garantizado por el RPC, no
 * por este action).
 */
export async function convertPurchaseRequisitionToPurchaseOrder(
  requisitionId: string,
  payload: ConvertRequisitionPayload
): Promise<{ error: string | null; purchaseOrder?: PurchaseOrder }> {
  const parsed = convertRequisitionToPurchaseOrderSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const purchaseOrderId = randomUUID();

  const { data, error } = await supabase.rpc("rpc_convert_requisition_to_purchase_order", {
    p_purchase_order_id: purchaseOrderId,
    p_requisition_id: requisitionId,
    p_supplier_id: parsed.data.supplier_id,
    p_requisition_item_ids: parsed.data.requisition_item_ids,
    p_purchase_order: {
      supplier_commitment_date: parsed.data.supplier_commitment_date ?? null,
      estimated_reception_date: parsed.data.estimated_reception_date ?? null,
      supplier_reference: parsed.data.supplier_reference ?? null,
      notes: parsed.data.notes ?? null,
    },
  });

  if (error || !data) {
    return { error: mapDbError(error, "No se pudo convertir la requisición en Purchase Order. Intenta de nuevo.") };
  }

  revalidatePath("/requisiciones");
  revalidatePath(`/requisiciones/${requisitionId}`);
  revalidatePath("/compras");
  return { error: null, purchaseOrder: data as PurchaseOrder };
}
