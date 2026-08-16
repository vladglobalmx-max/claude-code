"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveCurrentOrganizationId } from "@/lib/user-access";
import { getBusinessToday } from "@/lib/business-date";
import { quotePayloadSchema } from "@/lib/validations/quote";
import { customerSchema } from "@/lib/validations/customer";
import { mapDbError } from "@/lib/db-errors";
import type { Customer, QuoteCurrency, QuoteStatus } from "@/types/domain";

export type QuoteActionResult = { error: string } | void;

export interface QuoteWriteItemPayload {
  catalog_product_id: string | null;
  model: string;
  description?: string;
  quantity: number;
  unit_price: number;
  line_discount_percent: number;
}

/**
 * Payload que arma QuoteForm para rpc_create_quote/rpc_update_quote (ver
 * 0020_core_quotes.sql). business_unit_id/salesperson_id solo los usa
 * createQuote — updateQuote los ignora porque son inmutables una vez
 * generado el folio (trg_prevent_quote_folio_change); se validan siempre
 * igual, es cada acción la que decide qué enviar dentro de p_quote.
 */
export interface QuoteWritePayload {
  business_unit_id: string;
  salesperson_id: string;
  customer_id: string;
  currency: QuoteCurrency;
  tax_rate: number;
  global_discount_percent: number;
  valid_until: string;
  notes?: string;
  items: QuoteWriteItemPayload[];
}

/**
 * Crea la Quote completa (encabezado + líneas) en una sola transacción vía
 * rpc_create_quote. El folio lo asigna fn_next_quote_folio() dentro del
 * RPC — esta acción nunca lo calcula ni lo previsualiza (ver AJUSTE 2 de la
 * aprobación de Q4). quote_date siempre es la fecha de negocio de hoy
 * (America/Monterrey, ver business-date.ts) — no es un campo editable en
 * el Quote Builder.
 */
export async function createQuote(quoteId: string, payload: QuoteWritePayload): Promise<QuoteActionResult> {
  const parsed = quotePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_create_quote", {
    p_quote_id: quoteId,
    p_quote: {
      business_unit_id: parsed.data.business_unit_id,
      salesperson_id: parsed.data.salesperson_id,
      customer_id: parsed.data.customer_id,
      quote_date: getBusinessToday(),
      currency: parsed.data.currency,
      tax_rate: parsed.data.tax_rate,
      global_discount_percent: parsed.data.global_discount_percent,
      valid_until: parsed.data.valid_until,
      notes: parsed.data.notes ?? null,
    },
    p_items: parsed.data.items,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudo guardar la cotización. Intenta de nuevo.") };
  }

  revalidatePath("/cotizaciones");
  redirect(`/cotizaciones/${quoteId}`);
}

/**
 * Reemplaza el contenido comercial + líneas de una Quote vía
 * rpc_update_quote — el propio RPC aborta si la Quote ya no está en
 * "borrador" (defensa adicional sobre RLS/trigger). business_unit_id/
 * salesperson_id no se envían: rpc_update_quote no los lee.
 */
export async function updateQuote(quoteId: string, payload: QuoteWritePayload): Promise<QuoteActionResult> {
  const parsed = quotePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_update_quote", {
    p_quote_id: quoteId,
    p_quote: {
      customer_id: parsed.data.customer_id,
      currency: parsed.data.currency,
      tax_rate: parsed.data.tax_rate,
      global_discount_percent: parsed.data.global_discount_percent,
      valid_until: parsed.data.valid_until,
      notes: parsed.data.notes ?? null,
    },
    p_items: parsed.data.items,
  });

  if (error) {
    return { error: mapDbError(error, "No se pudieron guardar los cambios. Intenta de nuevo.") };
  }

  revalidatePath("/cotizaciones");
  revalidatePath(`/cotizaciones/${quoteId}`);
  redirect(`/cotizaciones/${quoteId}`);
}

/**
 * Alta rápida de Cliente desde el modal de Nueva Cotización. Reutiliza
 * customerSchema (Q1, cero reglas nuevas) pero devuelve el Customer creado
 * en vez de redirigir — createCustomer (clientes/actions.ts) no sirve aquí
 * porque su contrato es useFormState + redirect. ADMIN y VENDEDOR pueden
 * crear clientes (customers_insert_member, 0018_core_customers.sql) — sin
 * guard de rol adicional aquí, mismo criterio que createCustomer.
 */
export async function createCustomerInline(input: {
  name: string;
  legal_name?: string;
  tax_id?: string;
  email?: string;
  phone?: string;
}): Promise<{ customer: Customer } | { error: string }> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const orgResult = await resolveCurrentOrganizationId(supabase);
  if ("error" in orgResult) return { error: orgResult.error };

  const { data, error } = await supabase
    .from("customers")
    .insert({
      organization_id: orgResult.organizationId,
      name: parsed.data.name,
      legal_name: parsed.data.legal_name ?? null,
      tax_id: parsed.data.tax_id ?? null,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: mapDbError(error, "No se pudo crear el cliente. Intenta de nuevo.") };
  }

  revalidatePath("/clientes");
  return { customer: data as Customer };
}

/**
 * Cambia el status de una Quote (borrador→enviada|cancelada;
 * enviada→aceptada|rechazada|cancelada). No reimplementa las reglas de
 * transición en la app: trg_quote_status_transition (0020) ya las impone en
 * DB y rechaza cualquier transición inválida — este action solo hace el
 * UPDATE bajo RLS (quotes_update_own_or_admin) y traduce el error.
 */
export async function setQuoteStatus(quoteId: string, status: QuoteStatus): Promise<{ error: string } | void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("quotes").update({ status }).eq("id", quoteId);

  if (error) {
    return { error: mapDbError(error, "No se pudo actualizar el estado de la cotización.") };
  }

  revalidatePath("/cotizaciones");
  revalidatePath(`/cotizaciones/${quoteId}`);
}
