"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { commissionPayloadSchema, commissionPaymentPayloadSchema, commissionCancelPayloadSchema } from "@/lib/validations/commission";
import { mapDbError } from "@/lib/db-errors";
import type { CommissionRecord } from "@/types/domain";

export type CommissionActionResult = { error: string } | void;
export type CommissionResult = { error: string | null; commission?: CommissionRecord };

export interface CommissionWritePayload {
  sales_order_id: string;
  salesperson_id: string;
  commission_rate: number;
  commission_base?: number;
  notes?: string;
}

/**
 * Crea la comisión vía rpc_create_commission_record — nace desde la Sales
 * Order (regla del ticket), snapshot de regla/base/tasa congelado para
 * siempre. RLS (commission_records_insert) exige can_manage_commissions/
 * admin — un vendedor sin esa capability nunca llega ni a ver este action
 * ejecutarse con éxito (el RPC lo rechaza igual, defensa en profundidad).
 */
export async function createCommissionRecord(payload: CommissionWritePayload): Promise<CommissionActionResult> {
  const parsed = commissionPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const commissionId = randomUUID();

  const { error } = await supabase.rpc("rpc_create_commission_record", {
    p_commission_id: commissionId,
    p_sales_order_id: parsed.data.sales_order_id,
    p_salesperson_id: parsed.data.salesperson_id,
    p_commission_rate: parsed.data.commission_rate,
    p_commission_base: parsed.data.commission_base ?? null,
    p_rule_snapshot: parsed.data.notes ? { rate: parsed.data.commission_rate, note: parsed.data.notes } : null,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo crear la comisión. Intenta de nuevo.") };
  }

  revalidatePath("/comisiones");
  redirect(`/comisiones/${commissionId}`);
}

/** Registra un pago de comisión — rpc_register_commission_payment recalcula eligible_amount en vivo y enforce "no pagar más de lo liberado por cobro real". */
export async function registerCommissionPayment(commissionRecordId: string, payload: unknown): Promise<CommissionResult> {
  const parsed = commissionPaymentPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_register_commission_payment", {
    p_commission_record_id: commissionRecordId,
    p_amount: parsed.data.amount,
    p_notes: parsed.data.notes ?? null,
  });

  if (error || !data) {
    return { error: mapDbError(error, "No se pudo registrar el pago de comisión. Intenta de nuevo.") };
  }

  revalidatePath("/comisiones");
  revalidatePath(`/comisiones/${commissionRecordId}`);
  return { error: null, commission: data as CommissionRecord };
}

/** Cancelación explícita vía rpc_cancel_commission_record — motivo obligatorio, nunca permitida sobre una comisión ya pagada. */
export async function cancelCommissionRecord(commissionRecordId: string, payload: unknown): Promise<CommissionResult> {
  const parsed = commissionCancelPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_cancel_commission_record", {
    p_commission_record_id: commissionRecordId,
    p_reason: parsed.data.reason,
  });

  if (error || !data) {
    return { error: mapDbError(error, "No se pudo cancelar la comisión. Intenta de nuevo.") };
  }

  revalidatePath("/comisiones");
  revalidatePath(`/comisiones/${commissionRecordId}`);
  return { error: null, commission: data as CommissionRecord };
}

/**
 * Refresca eligible_amount/status de las comisiones de la organización
 * actual contra el cobro real — sin cron en este entorno, se invoca bajo
 * demanda desde las páginas de listado/detalle (no-op silencioso para
 * quien no tiene can_manage_commissions, mismo criterio que
 * refreshOverdueInvoices, 0072).
 */
export async function refreshCommissionEligibility(): Promise<void> {
  const supabase = createSupabaseServerClient();
  await supabase.rpc("rpc_refresh_commission_eligibility", {});
}
