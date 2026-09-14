"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { invoicePayloadSchema, invoicePaymentPayloadSchema, invoiceCancelPayloadSchema } from "@/lib/validations/invoice";
import { mapDbError } from "@/lib/db-errors";
import type { Invoice } from "@/types/domain";

export type InvoiceActionResult = { error: string } | void;
export type InvoiceResult = { error: string | null; invoice?: Invoice };

export interface InvoiceWritePayload {
  sales_order_id: string;
  due_date: string;
  notes?: string;
}

/**
 * Crea la factura completa (encabezado + snapshot de TODAS las líneas de
 * la Sales Order) en una sola transacción vía rpc_create_invoice. Nace
 * SIEMPRE en 'pending' — a lo sumo una factura activa por Sales Order (el
 * propio RPC/índice único parcial lo rechaza si ya existe una).
 */
export async function createInvoice(payload: InvoiceWritePayload): Promise<InvoiceActionResult> {
  const parsed = invoicePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const invoiceId = randomUUID();

  const { error } = await supabase.rpc("rpc_create_invoice", {
    p_invoice_id: invoiceId,
    p_sales_order_id: parsed.data.sales_order_id,
    p_due_date: parsed.data.due_date,
    p_notes: parsed.data.notes ?? null,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo crear la factura. Intenta de nuevo.") };
  }

  revalidatePath("/facturas");
  revalidatePath(`/ordenes-venta/${parsed.data.sales_order_id}`);
  redirect(`/facturas/${invoiceId}`);
}

/**
 * Registra un pago vía rpc_register_invoice_payment — el propio RPC
 * enforce "no sobrepago" y DELEGA a rpc_register_sales_order_payment
 * (0068) en la misma transacción, manteniendo la Sales Order sincronizada
 * sin reimplementar esa lógica aquí.
 */
export async function registerInvoicePayment(invoiceId: string, payload: unknown): Promise<InvoiceResult> {
  const parsed = invoicePaymentPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_register_invoice_payment", {
    p_invoice_id: invoiceId,
    p_amount: parsed.data.amount,
    p_payment_date: parsed.data.payment_date || undefined,
    p_notes: parsed.data.notes ?? null,
  });

  if (error || !data) {
    return { error: mapDbError(error, "No se pudo registrar el pago. Intenta de nuevo.") };
  }

  const invoice = data as Invoice;
  revalidatePath("/facturas");
  revalidatePath(`/facturas/${invoiceId}`);
  revalidatePath(`/ordenes-venta/${invoice.sales_order_id}`);
  return { error: null, invoice };
}

/** Cancelación explícita vía rpc_cancel_invoice — motivo obligatorio, nunca permitida sobre una factura ya pagada. */
export async function cancelInvoice(invoiceId: string, payload: unknown): Promise<InvoiceResult> {
  const parsed = invoiceCancelPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_cancel_invoice", {
    p_invoice_id: invoiceId,
    p_reason: parsed.data.reason,
  });

  if (error || !data) {
    return { error: mapDbError(error, "No se pudo cancelar la factura. Intenta de nuevo.") };
  }

  const invoice = data as Invoice;
  revalidatePath("/facturas");
  revalidatePath(`/facturas/${invoiceId}`);
  revalidatePath(`/ordenes-venta/${invoice.sales_order_id}`);
  return { error: null, invoice };
}

/**
 * Refresca el status 'overdue' (por fecha y saldo) de las facturas de la
 * organización actual — sin cron en este entorno, se invoca bajo demanda
 * desde las páginas de listado/detalle (solo si el usuario tiene autoridad
 * financiera; si no, es un no-op silencioso, ver rpc_refresh_overdue_invoices).
 */
export async function refreshOverdueInvoices(): Promise<void> {
  const supabase = createSupabaseServerClient();
  await supabase.rpc("rpc_refresh_overdue_invoices", {});
}
